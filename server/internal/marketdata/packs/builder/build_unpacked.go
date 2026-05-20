package builder

import (
	"context"
	"fmt"
	"log"
	"os"
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

func BuildUnpackedPack(ctx context.Context, plan *BuildPlan, opts BuildUnpackedOptions) (*BuildUnpackedResult, error) {
	if plan == nil || plan.Spec == nil || plan.Universe == nil {
		return nil, fmt.Errorf("build plan is required")
	}
	if opts.MaxSymbolsSet && !opts.AllSymbols && opts.MaxSymbols <= 0 {
		return nil, fmt.Errorf("--max-symbols must be > 0 unless --all is set")
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

	source, err := newSourceForProvider(plan.Spec.SourceProvider, opts.SourceBaseURL)
	if err != nil {
		return nil, err
	}
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

	return &BuildUnpackedResult{
		PackDir:     writeResult.PackDir,
		Manifest:    writeResult.Manifest,
		FilesCount:  len(writeResult.Manifest.Files),
		RowsCount:   writeResult.Manifest.RowsCount,
		AssetsCount: writeResult.Manifest.AssetsCount,
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
	for candlesCh != nil || errCh != nil {
		select {
		case candle, ok := <-candlesCh:
			if !ok {
				candlesCh = nil
				continue
			}
			candles = append(candles, candle)
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
	sort.Slice(allSymbols, func(i, j int) bool {
		return allSymbols[i].Symbol < allSymbols[j].Symbol
	})

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

	source, err := newSourceForProvider(first.Spec.SourceProvider, opts.SourceBaseURL)
	if err != nil {
		return nil, err
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
