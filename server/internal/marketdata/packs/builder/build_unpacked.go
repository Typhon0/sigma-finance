package builder

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	parquetwriter "sigma_finance/internal/marketdata/packs/writer/parquet"
	packservice "sigma_finance/internal/service/marketdata/packs"
)

const defaultSymbolCap = 2

type BuildUnpackedOptions struct {
	AllSymbols    bool
	MaxSymbols    int
	MaxSymbolsSet bool
	SourceBaseURL string
	WorkDir       string
	RateLimit     sources.RateLimitConfig
}

type BuildUnpackedResult struct {
	PackDir     string
	Manifest    *packservice.Manifest
	FilesCount  int
	RowsCount   int64
	AssetsCount int64
}

type localCoverageKey struct {
	InstrumentID  string
	Interval      string
	QuoteCurrency string
}

type localCoverageAccumulator struct {
	InstrumentID   string
	Symbol         string
	AssetType      string
	Interval       string
	QuoteCurrency  string
	Source         string
	DerivationType string
	DerivedFrom    map[string]struct{}
	FirstDate      time.Time
	LastDate       time.Time
	RowCount       int64
	FilePaths      map[string]struct{}
}

func BuildUnpackedPack(ctx context.Context, plan *BuildPlan, opts BuildUnpackedOptions) (*BuildUnpackedResult, error) {
	if plan == nil || plan.Spec == nil {
		return nil, fmt.Errorf("build plan is required")
	}
	if opts.MaxSymbolsSet && !opts.AllSymbols && opts.MaxSymbols <= 0 {
		return nil, fmt.Errorf("--max-symbols must be > 0 unless --all is set")
	}

	source, err := newSourceForProvider(plan.Spec.SourceProvider, opts.SourceBaseURL)
	if err != nil {
		return nil, err
	}

	if plan.Universe == nil {
		discoverer, ok := source.(sources.UniverseDiscoverer)
		if !ok {
			return nil, fmt.Errorf("source provider %s does not support dynamic universe discovery", plan.Spec.SourceProvider)
		}
		universe, err := discoverer.DiscoverUniverse(ctx, plan.Spec.Universe.Discover)
		if err != nil {
			return nil, fmt.Errorf("dynamic universe discovery failed: %w", err)
		}
		plan.Universe = universe
	}

	startDate, endDate, err := resolveHistoryRange(plan.Spec.History)
	if err != nil {
		return nil, err
	}
	symbols, err := applySymbolLimit(plan.Universe.Symbols, opts)
	if err != nil {
		return nil, err
	}

	workDir := strings.TrimSpace(opts.WorkDir)
	cleanupWorkDir := false
	if workDir == "" {
		tmpDir, tmpErr := os.MkdirTemp("", "sigma-finance-pack-build-*")
		if tmpErr != nil {
			return nil, tmpErr
		}
		workDir = tmpDir
		cleanupWorkDir = true
	}
	if cleanupWorkDir {
		defer os.RemoveAll(workDir) //nolint:errcheck
	}

	// Check if spec partitions by year
	hasYearPartition := false
	for _, p := range plan.Spec.Output.PartitionBy {
		if strings.ToLower(strings.TrimSpace(p)) == "year" {
			hasYearPartition = true
			break
		}
	}

	var finalPackDir string
	var allFiles []packservice.ManifestFile
	var totalRows int64
	coverageMap := make(map[localCoverageKey]*localCoverageAccumulator)
	assetTypesMap := make(map[string]struct{})
	quoteCurrenciesMap := make(map[string]struct{})

	if hasYearPartition {
		startYear := startDate.Year()
		endYear := endDate.Year()
		log.Printf("[%s] Year partition detected. Building year-by-year from %d to %d to minimize memory usage...", plan.Spec.PackID, startYear, endYear)

		for y := startYear; y <= endYear; y++ {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}

			yearStart := time.Date(y, 1, 1, 0, 0, 0, 0, time.UTC)
			if yearStart.Before(startDate) {
				yearStart = startDate
			}

			// Add a 5-day safety buffer on the end of each non-final year fetch range to capture
			// timezone-shifted candles (e.g. UTC Jan 1st daily records shift back to EST Dec 31st).
			yearEnd := time.Date(y, 12, 31, 23, 59, 59, 999999999, time.UTC)
			if y < endYear {
				yearEnd = yearEnd.AddDate(0, 0, 5)
			}
			if yearEnd.After(endDate) {
				yearEnd = endDate
			}

			if yearStart.After(yearEnd) {
				continue
			}

			log.Printf("📅 [%s] Chunk: year %d (Fetch Range: %s to %s)", plan.Spec.PackID, y, yearStart.Format(time.DateOnly), yearEnd.Format(time.DateOnly))

			candles, err := fetchCandles(ctx, source, sources.FetchCandlesRequest{
				PackSpec:  toSourcePackSpec(plan.Spec),
				Symbols:   symbols,
				StartDate: yearStart,
				EndDate:   yearEnd,
				WorkDir:   workDir,
				RateLimit: opts.RateLimit,
			})
			if err != nil {
				return nil, err
			}

			// Strict filter to only include candles that normalize to this target partition year
			var filtered []sources.NormalizedCandle
			for _, c := range candles {
				if c.Timestamp.UTC().Year() == y {
					filtered = append(filtered, c)
				}
			}

			if len(filtered) == 0 {
				log.Printf("   ℹ️ No candles matching year %d returned. Skipping partition writing.", y)
				candles = nil
				runtime.GC()
				continue
			}

			manifest := manifestFromPlan(plan, yearStart, yearEnd)
			writeResult, err := parquetwriter.BuildUnpackedDirectory(ctx, filtered, parquetwriter.BuildOptions{
				RootDir:     plan.OutputDir,
				PartitionBy: plan.Spec.Output.PartitionBy,
				Manifest:    manifest,
			})
			if err != nil {
				return nil, err
			}

			finalPackDir = writeResult.PackDir

			// Accumulate results
			allFiles = append(allFiles, writeResult.Manifest.Files...)
			totalRows += writeResult.Manifest.RowsCount

			for _, cov := range writeResult.Manifest.Coverage {
				key := localCoverageKey{
					InstrumentID:  cov.InstrumentID,
					Interval:      cov.Interval,
					QuoteCurrency: cov.QuoteCurrency,
				}
				accum, exists := coverageMap[key]
				if !exists {
					accum = &localCoverageAccumulator{
						InstrumentID:   cov.InstrumentID,
						Symbol:         cov.Symbol,
						AssetType:      cov.AssetType,
						Interval:       cov.Interval,
						QuoteCurrency:  cov.QuoteCurrency,
						Source:         cov.Source,
						DerivationType: cov.DerivationType,
						DerivedFrom:    make(map[string]struct{}),
						FilePaths:      make(map[string]struct{}),
					}
					fd, err1 := time.Parse(time.DateOnly, cov.FirstDate)
					ld, err2 := time.Parse(time.DateOnly, cov.LastDate)
					if err1 == nil {
						accum.FirstDate = fd
					}
					if err2 == nil {
						accum.LastDate = ld
					}
					coverageMap[key] = accum
				} else {
					fd, err1 := time.Parse(time.DateOnly, cov.FirstDate)
					ld, err2 := time.Parse(time.DateOnly, cov.LastDate)
					if err1 == nil && fd.Before(accum.FirstDate) {
						accum.FirstDate = fd
					}
					if err2 == nil && ld.After(accum.LastDate) {
						accum.LastDate = ld
					}
				}

				accum.RowCount += cov.RowCount
				for _, path := range cov.FilePaths {
					accum.FilePaths[path] = struct{}{}
				}
				for _, df := range cov.DerivedFrom {
					accum.DerivedFrom[df] = struct{}{}
				}
			}

			for _, at := range writeResult.Manifest.AssetTypes {
				assetTypesMap[at] = struct{}{}
			}
			for _, qc := range writeResult.Manifest.QuoteCurrencies {
				quoteCurrenciesMap[qc] = struct{}{}
			}

			// Clear slice reference and force GC
			candles = nil
			writeResult = nil
			runtime.GC()
		}

		if finalPackDir == "" {
			return nil, fmt.Errorf("no historical data was written across the entire date range")
		}

	} else {
		log.Printf("[%s] No year partition detected. Performing single-batch load/write...", plan.Spec.PackID)
		candles, err := fetchCandles(ctx, source, sources.FetchCandlesRequest{
			PackSpec:  toSourcePackSpec(plan.Spec),
			Symbols:   symbols,
			StartDate: startDate,
			EndDate:   endDate,
			WorkDir:   workDir,
			RateLimit: opts.RateLimit,
		})
		if err != nil {
			return nil, err
		}

		manifest := manifestFromPlan(plan, startDate, endDate)
		writeResult, err := parquetwriter.BuildUnpackedDirectory(ctx, candles, parquetwriter.BuildOptions{
			RootDir:     plan.OutputDir,
			PartitionBy: plan.Spec.Output.PartitionBy,
			Manifest:    manifest,
		})
		if err != nil {
			return nil, err
		}

		finalPackDir = writeResult.PackDir
		allFiles = writeResult.Manifest.Files
		totalRows = writeResult.Manifest.RowsCount

		for _, cov := range writeResult.Manifest.Coverage {
			key := localCoverageKey{
				InstrumentID:  cov.InstrumentID,
				Interval:      cov.Interval,
				QuoteCurrency: cov.QuoteCurrency,
			}
			accum := &localCoverageAccumulator{
				InstrumentID:   cov.InstrumentID,
				Symbol:         cov.Symbol,
				AssetType:      cov.AssetType,
				Interval:       cov.Interval,
				QuoteCurrency:  cov.QuoteCurrency,
				Source:         cov.Source,
				DerivationType: cov.DerivationType,
				DerivedFrom:    make(map[string]struct{}),
				FilePaths:      make(map[string]struct{}),
			}
			fd, _ := time.Parse(time.DateOnly, cov.FirstDate)
			ld, _ := time.Parse(time.DateOnly, cov.LastDate)
			accum.FirstDate = fd
			accum.LastDate = ld
			accum.RowCount = cov.RowCount
			for _, path := range cov.FilePaths {
				accum.FilePaths[path] = struct{}{}
			}
			for _, df := range cov.DerivedFrom {
				accum.DerivedFrom[df] = struct{}{}
			}
			coverageMap[key] = accum
		}

		for _, at := range writeResult.Manifest.AssetTypes {
			assetTypesMap[at] = struct{}{}
		}
		for _, qc := range writeResult.Manifest.QuoteCurrencies {
			quoteCurrenciesMap[qc] = struct{}{}
		}
		candles = nil
		writeResult = nil
		runtime.GC()
	}

	// Build the unified final manifest
	finalManifest := manifestFromPlan(plan, startDate, endDate)
	finalManifest.Files = allFiles
	finalManifest.RowsCount = totalRows
	finalManifest.AssetsCount = int64(len(coverageMap))

	// Collect and sort asset types and quote currencies
	assetTypes := make([]string, 0, len(assetTypesMap))
	for at := range assetTypesMap {
		assetTypes = append(assetTypes, at)
	}
	sort.Strings(assetTypes)
	finalManifest.AssetTypes = assetTypes

	quoteCurrencies := make([]string, 0, len(quoteCurrenciesMap))
	for qc := range quoteCurrenciesMap {
		quoteCurrencies = append(quoteCurrencies, qc)
	}
	sort.Strings(quoteCurrencies)
	finalManifest.QuoteCurrencies = quoteCurrencies

	// Construct final coverage list
	finalCoverage := make([]packservice.ManifestCoverage, 0, len(coverageMap))
	for _, accum := range coverageMap {
		paths := make([]string, 0, len(accum.FilePaths))
		for p := range accum.FilePaths {
			paths = append(paths, p)
		}
		sort.Strings(paths)

		derivedFrom := make([]string, 0, len(accum.DerivedFrom))
		for df := range accum.DerivedFrom {
			derivedFrom = append(derivedFrom, df)
		}
		sort.Strings(derivedFrom)

		cov := packservice.ManifestCoverage{
			InstrumentID:   accum.InstrumentID,
			Symbol:         accum.Symbol,
			AssetType:      accum.AssetType,
			Interval:       accum.Interval,
			QuoteCurrency:  accum.QuoteCurrency,
			Source:         accum.Source,
			DerivationType: accum.DerivationType,
			DerivedFrom:    derivedFrom,
			FirstDate:      accum.FirstDate.UTC().Format(time.DateOnly),
			LastDate:       accum.LastDate.UTC().Format(time.DateOnly),
			RowCount:       accum.RowCount,
			FilePaths:      paths,
		}
		finalCoverage = append(finalCoverage, cov)
	}

	// Sort final coverage list
	sort.Slice(finalCoverage, func(i, j int) bool {
		if finalCoverage[i].InstrumentID != finalCoverage[j].InstrumentID {
			return finalCoverage[i].InstrumentID < finalCoverage[j].InstrumentID
		}
		if finalCoverage[i].Interval != finalCoverage[j].Interval {
			return finalCoverage[i].Interval < finalCoverage[j].Interval
		}
		return finalCoverage[i].QuoteCurrency < finalCoverage[j].QuoteCurrency
	})
	finalManifest.Coverage = finalCoverage

	// Write final manifest and checksums
	manifestPath := filepath.Join(finalPackDir, "manifest.json")
	if err := parquetwriter.WriteManifest(manifestPath, &finalManifest); err != nil {
		return nil, err
	}
	manifestSum, err := parquetwriter.Sha256FileHex(manifestPath)
	if err != nil {
		return nil, err
	}

	checksumsPath := filepath.Join(finalPackDir, "checksums.sha256")
	if err := parquetwriter.WriteChecksumsFile(checksumsPath, &finalManifest, manifestSum); err != nil {
		return nil, err
	}

	log.Printf("🎉 [%s] Successfully completed compilation. Total rows: %d, Assets: %d, Files: %d", plan.Spec.PackID, totalRows, len(coverageMap), len(allFiles))

	return &BuildUnpackedResult{
		PackDir:     finalPackDir,
		Manifest:    &finalManifest,
		FilesCount:  len(allFiles),
		RowsCount:   totalRows,
		AssetsCount: int64(len(coverageMap)),
	}, nil
}

func applySymbolLimit(symbols []sources.UniverseSymbol, opts BuildUnpackedOptions) ([]sources.UniverseSymbol, error) {
	if len(symbols) == 0 {
		return nil, fmt.Errorf("universe symbols are required")
	}
	if opts.AllSymbols {
		return symbols, nil
	}
	limit := defaultSymbolCap
	if opts.MaxSymbolsSet {
		if opts.MaxSymbols <= 0 {
			return nil, fmt.Errorf("max symbols must be > 0")
		}
		limit = opts.MaxSymbols
	}
	if limit > len(symbols) {
		limit = len(symbols)
	}
	return symbols[:limit], nil
}

func fetchCandles(ctx context.Context, source sources.CandleSource, req sources.FetchCandlesRequest) ([]sources.NormalizedCandle, error) {
	candlesCh, errCh := source.FetchCandles(ctx, req)
	candles := make([]sources.NormalizedCandle, 0, 2048)
	
	seenSymbols := make(map[string]struct{})
	totalSymbols := len(req.Symbols)
	if totalSymbols == 0 {
		totalSymbols = 1 // Avoid division by zero
	}
	
	lastPrinted := -1
	
	for candlesCh != nil || errCh != nil {
		select {
		case candle, ok := <-candlesCh:
			if !ok {
				candlesCh = nil
				continue
			}
			candles = append(candles, candle)
			seenSymbols[candle.Symbol] = struct{}{}
			
			// Periodically write dynamic streaming progress to terminal on a single line
			count := len(seenSymbols)
			if count != lastPrinted && (count%50 == 0 || count == totalSymbols) {
				percent := float64(count) * 100.0 / float64(totalSymbols)
				fmt.Printf("\r   ⚡ Streaming candles: %d/%d symbols (%.1f%%) [Total candles: %d]...", count, totalSymbols, percent, len(candles))
				lastPrinted = count
			}
		case err, ok := <-errCh:
			if !ok {
				errCh = nil
				continue
			}
			if err != nil {
				return nil, err
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	
	// Final newline to clear progress bar and print complete state
	fmt.Printf("\r   ✅ Streaming complete: %d symbols successfully fetched. Total candles: %d.\n", len(seenSymbols), len(candles))
	return candles, nil
}

func manifestFromPlan(plan *BuildPlan, historyStart, historyEnd time.Time) packservice.Manifest {
	licenseName := ""
	licenseURL := ""
	redistributionAllowed := false
	commercialUseAllowed := false
	attributionRequired := false
	if plan.LicensePolicy != nil {
		licenseName = strings.TrimSpace(plan.LicensePolicy.LicenseName)
		licenseURL = strings.TrimSpace(plan.LicensePolicy.SourceURL)
		redistributionAllowed = plan.LicensePolicy.RedistributionAllowed
		commercialUseAllowed = plan.LicensePolicy.CommercialUseAllowed
		attributionRequired = plan.LicensePolicy.AttributionRequired
	}

	description := strings.TrimSpace(plan.Spec.Description)
	if description == "" {
		description = strings.TrimSpace(plan.Spec.Name)
	}

	now := time.Now().UTC()
	return packservice.Manifest{
		PackID:                strings.TrimSpace(plan.Spec.PackID),
		Version:               strings.TrimSpace(plan.Spec.Version),
		Name:                  strings.TrimSpace(plan.Spec.Name),
		Description:           description,
		FormatVersion:         plan.Spec.FormatVersion,
		Distribution:          strings.TrimSpace(plan.Spec.Distribution),
		Interval:              strings.TrimSpace(plan.Spec.Interval),
		SourceProvider:        strings.TrimSpace(plan.Spec.SourceProvider),
		DataLicense:           licenseName,
		RedistributionAllowed: redistributionAllowed,
		CommercialUseAllowed:  commercialUseAllowed,
		AttributionRequired:   attributionRequired,
		LicenseURL:            licenseURL,
		GeneratedBy:           "sigma-finance pack-builder",
		GeneratedAt:           now,
		CreatedAt:             now,
		HistoryStart:          historyStart.UTC().Format(time.DateOnly),
		HistoryEnd:            historyEnd.UTC().Format(time.DateOnly),
		Compression:           strings.TrimSpace(plan.Spec.Output.Compression),
	}
}

func BuildUnpackedPacksMulti(ctx context.Context, plans []*BuildPlan, opts BuildUnpackedOptions) ([]*BuildUnpackedResult, error) {
	if len(plans) == 0 {
		return nil, fmt.Errorf("no build plans provided")
	}
	if len(plans) == 1 {
		res, err := BuildUnpackedPack(ctx, plans[0], opts)
		if err != nil {
			return nil, err
		}
		return []*BuildUnpackedResult{res}, nil
	}

	// 1. Validate that all plans have compatible source, history, asset type, interval, and quote currency
	first := plans[0]
	for i := 1; i < len(plans); i++ {
		p := plans[i]
		if p.Spec.SourceProvider != first.Spec.SourceProvider {
			return nil, fmt.Errorf("incompatible source providers: %s and %s", p.Spec.SourceProvider, first.Spec.SourceProvider)
		}
		if p.Spec.Interval != first.Spec.Interval {
			return nil, fmt.Errorf("incompatible intervals: %s and %s", p.Spec.Interval, first.Spec.Interval)
		}
		if p.Spec.QuoteCurrency != first.Spec.QuoteCurrency {
			return nil, fmt.Errorf("incompatible quote currencies: %s and %s", p.Spec.QuoteCurrency, first.Spec.QuoteCurrency)
		}
		if p.Spec.AssetType != first.Spec.AssetType {
			return nil, fmt.Errorf("incompatible asset types: %s and %s", p.Spec.AssetType, first.Spec.AssetType)
		}
		if p.Spec.History.Start != first.Spec.History.Start || p.Spec.History.End != first.Spec.History.End {
			return nil, fmt.Errorf("incompatible history ranges")
		}
	}

	source, err := newSourceForProvider(first.Spec.SourceProvider, opts.SourceBaseURL)
	if err != nil {
		return nil, err
	}

	for _, plan := range plans {
		if plan.Universe == nil {
			discoverer, ok := source.(sources.UniverseDiscoverer)
			if !ok {
				return nil, fmt.Errorf("source provider %s does not support dynamic universe discovery", plan.Spec.SourceProvider)
			}
			universe, err := discoverer.DiscoverUniverse(ctx, plan.Spec.Universe.Discover)
			if err != nil {
				return nil, fmt.Errorf("dynamic universe discovery failed: %w", err)
			}
			plan.Universe = universe
		}
	}

	// 2. Build union of all symbols across all plans
	symbolMap := make(map[string]sources.UniverseSymbol)
	for _, p := range plans {
		for _, sym := range p.Universe.Symbols {
			symbolMap[sym.Symbol] = sym
		}
	}
	
	allSymbols := make([]sources.UniverseSymbol, 0, len(symbolMap))
	for _, sym := range symbolMap {
		allSymbols = append(allSymbols, sym)
	}

	// 2b. Sort symbols by real-time popularity if the source supports it,
	// otherwise fall back to the static YAML order.
	if ranker, ok := source.(sources.SymbolRanker); ok {
		ranked, rankErr := ranker.RankSymbols(ctx, allSymbols)
		if rankErr != nil {
			log.Printf("WARNING: real-time ranking failed, using YAML order: %v", rankErr)
		} else {
			allSymbols = ranked
		}
	} else {
		symbolRank := make(map[string]int)
		for _, p := range plans {
			for idx, sym := range p.Universe.Symbols {
				if r, exists := symbolRank[sym.Symbol]; !exists || idx < r {
					symbolRank[sym.Symbol] = idx
				}
			}
		}
		sort.Slice(allSymbols, func(i, j int) bool {
			return symbolRank[allSymbols[i].Symbol] < symbolRank[allSymbols[j].Symbol]
		})
	}

	startDate, endDate, err := resolveHistoryRange(first.Spec.History)
	if err != nil {
		return nil, err
	}

	symbolsToFetch, err := applySymbolLimit(allSymbols, opts)
	if err != nil {
		return nil, err
	}

	workDir := strings.TrimSpace(opts.WorkDir)
	cleanupWorkDir := false
	if workDir == "" {
		tmpDir, tmpErr := os.MkdirTemp("", "sigma-finance-pack-build-*")
		if tmpErr != nil {
			return nil, tmpErr
		}
		workDir = tmpDir
		cleanupWorkDir = true
	}
	if cleanupWorkDir {
		defer os.RemoveAll(workDir) //nolint:errcheck
	}

	log.Printf("Fetching candles for union of all plans (%d symbols total)...", len(symbolsToFetch))
	fetchedCandles, err := fetchCandles(ctx, source, sources.FetchCandlesRequest{
		PackSpec:  toSourcePackSpec(first.Spec),
		Symbols:   symbolsToFetch,
		StartDate: startDate,
		EndDate:   endDate,
		WorkDir:   workDir,
		RateLimit: opts.RateLimit,
	})
	if err != nil {
		return nil, err
	}

	// 3. For each plan, filter the fetched candles and build the unpacked directory
	results := make([]*BuildUnpackedResult, len(plans))
	for idx, plan := range plans {
		allowedSymbols := make(map[string]struct{}, len(plan.Universe.Symbols))
		for _, sym := range plan.Universe.Symbols {
			allowedSymbols[sym.Symbol] = struct{}{}
		}

		var filteredCandles []sources.NormalizedCandle
		for _, c := range fetchedCandles {
			if _, ok := allowedSymbols[c.Symbol]; ok {
				filteredCandles = append(filteredCandles, c)
			}
		}

		log.Printf("Building plan %s with %d filtered candles...", plan.Spec.PackID, len(filteredCandles))
		manifest := manifestFromPlan(plan, startDate, endDate)
		writeResult, err := parquetwriter.BuildUnpackedDirectory(ctx, filteredCandles, parquetwriter.BuildOptions{
			RootDir:     plan.OutputDir,
			PartitionBy: plan.Spec.Output.PartitionBy,
			Manifest:    manifest,
		})
		if err != nil {
			return nil, fmt.Errorf("build unpacked directory for plan %s failed: %w", plan.Spec.PackID, err)
		}

		results[idx] = &BuildUnpackedResult{
			PackDir:     writeResult.PackDir,
			Manifest:    writeResult.Manifest,
			FilesCount:  len(writeResult.Manifest.Files),
			RowsCount:   writeResult.Manifest.RowsCount,
			AssetsCount: writeResult.Manifest.AssetsCount,
		}
	}

	return results, nil
}
