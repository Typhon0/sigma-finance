package packs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sigma_finance/internal/domain/model"
	licensegate "sigma_finance/internal/marketdata/packs/license"
	"sigma_finance/internal/marketdata/packs/sources"
	providersource "sigma_finance/internal/marketdata/packs/sources/provider"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/providers"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type StartLocalPackBuildInput struct {
	PackID                *string
	SourceProvider        string
	AssetTypes            []string
	HistoryStart          *time.Time
	HistoryEnd            *time.Time
	PortfolioFirst        bool
	UniverseInstrumentIDs []string
	RequestsPerMinute     *int
	RequestsPerDay        *int
	ConcurrentRequests    *int
}

type localBuildConfig struct {
	AssetTypes            []string                `json:"asset_types"`
	HistoryStart          string                  `json:"history_start"`
	HistoryEnd            string                  `json:"history_end"`
	PortfolioFirst        bool                    `json:"portfolio_first"`
	UniverseInstrumentIDs []string                `json:"universe_instrument_ids"`
	RateLimit             sources.RateLimitConfig `json:"rate_limit"`
}

func (s *packService) StartLocalPackBuild(ctx context.Context, userID string, input StartLocalPackBuildInput) (*model.MarketDataPackBuildJob, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, fmt.Errorf("user id is required")
	}
	sourceProvider := strings.ToUpper(strings.TrimSpace(input.SourceProvider))
	if sourceProvider == "" {
		return nil, fmt.Errorf("source provider is required")
	}
	providerInstance, err := createLocalBuildProvider(sourceProvider)
	if err != nil {
		return nil, err
	}

	assetTypes := normalizeLocalBuildAssetTypes(input.AssetTypes)
	startDate, endDate := resolveLocalBuildDates(input.HistoryStart, input.HistoryEnd)
	if endDate.Before(startDate) {
		return nil, fmt.Errorf("historyEnd must be on or after historyStart")
	}
	caps := providerInstance.Capabilities()
	rate := resolveLocalBuildRateLimits(input, caps.RateLimit)
	portfolioFirst := input.PortfolioFirst
	if !portfolioFirst {
		portfolioFirst = true
	}
	candidates, err := s.collectLocalBuildUniverse(ctx, userID, assetTypes, portfolioFirst, input.UniverseInstrumentIDs)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no instruments available for local build")
	}

	packID := buildLocalPackID(sourceProvider, input.PackID)
	cfg := localBuildConfig{
		AssetTypes:            assetTypes,
		HistoryStart:          startDate.Format(time.DateOnly),
		HistoryEnd:            endDate.Format(time.DateOnly),
		PortfolioFirst:        portfolioFirst,
		UniverseInstrumentIDs: uniqueStrings(input.UniverseInstrumentIDs),
		RateLimit:             rate,
	}
	cfgBytes, err := json.Marshal(cfg)
	if err != nil {
		return nil, err
	}
	job := &model.MarketDataPackBuildJob{
		ID:               uuid.NewString(),
		UserID:           userID,
		PackID:           packID,
		SourceProvider:   sourceProvider,
		BuildConfig:      cfgBytes,
		Status:           "queued",
		ProgressPercent:  decimal.Zero,
		TotalSymbols:     len(candidates),
		CompletedSymbols: 0,
		FailedSymbols:    0,
		CreatedAt:        time.Now().UTC(),
	}
	if err := s.repo.CreateBuildJob(ctx, job); err != nil {
		return nil, err
	}

	items := make([]model.MarketDataPackBuildJobItem, 0, len(candidates))
	for _, candidate := range candidates {
		items = append(items, model.MarketDataPackBuildJobItem{
			ID:           uuid.NewString(),
			JobID:        job.ID,
			InstrumentID: candidate.InstrumentID,
			Symbol:       candidate.Symbol,
			Status:       "queued",
			AttemptCount: 0,
		})
	}
	if err := s.repo.CreateBuildJobItems(ctx, items); err != nil {
		return nil, err
	}

	go func() {
		_ = s.runLocalBuildJob(context.Background(), job.ID)
	}()
	return job, nil
}

func (s *packService) GetLocalPackBuildJob(ctx context.Context, userID string, jobID string) (*model.MarketDataPackBuildJob, error) {
	job, err := s.repo.GetBuildJob(ctx, jobID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(job.UserID) != strings.TrimSpace(userID) {
		return nil, fmt.Errorf("forbidden")
	}
	return job, nil
}

func (s *packService) ListLocalPackBuildJobs(ctx context.Context, userID string, limit int) ([]model.MarketDataPackBuildJob, error) {
	return s.repo.ListBuildJobsByUser(ctx, userID, limit)
}

func (s *packService) CancelLocalPackBuild(ctx context.Context, userID string, jobID string) (*model.MarketDataPackBuildJob, error) {
	job, err := s.GetLocalPackBuildJob(ctx, userID, jobID)
	if err != nil {
		return nil, err
	}
	if job.Status == "succeeded" || job.Status == "failed" || job.Status == "canceled" {
		return job, nil
	}
	now := time.Now().UTC()
	job.Status = "canceled"
	job.FinishedAt = &now
	if err := s.repo.UpdateBuildJob(ctx, job); err != nil {
		return nil, err
	}
	items, err := s.repo.ListBuildJobItemsByStatus(ctx, job.ID, "queued", "running", "failed")
	if err != nil {
		return nil, err
	}
	for i := range items {
		item := items[i]
		item.Status = "canceled"
		item.NextRetryAt = nil
		_ = s.repo.UpdateBuildJobItem(ctx, &item)
	}
	return job, nil
}

func (s *packService) ResumeQueuedLocalPackBuilds(ctx context.Context) error {
	staleBefore := time.Now().UTC().Add(-s.cfg.BuildJobStaleAfter)
	jobs, err := s.repo.ListBuildJobsForResume(ctx, staleBefore)
	if err != nil {
		return err
	}
	for _, job := range jobs {
		jobID := job.ID
		go func() {
			_ = s.runLocalBuildJob(context.Background(), jobID)
		}()
	}
	return nil
}

func (s *packService) runLocalBuildJob(ctx context.Context, jobID string) error {
	job, err := s.repo.GetBuildJob(ctx, jobID)
	if err != nil {
		return err
	}
	if job.Status == "canceled" || job.Status == "succeeded" {
		return nil
	}

	now := time.Now().UTC()
	job.Status = "running"
	if job.StartedAt == nil {
		job.StartedAt = &now
	}
	if err := s.repo.UpdateBuildJob(ctx, job); err != nil {
		return err
	}

	config, err := parseLocalBuildConfig(job.BuildConfig)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	startDate, _ := time.Parse(time.DateOnly, config.HistoryStart)
	endDate, _ := time.Parse(time.DateOnly, config.HistoryEnd)

	providerInstance, err := createLocalBuildProvider(job.SourceProvider)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	credential, credErr := s.repo.GetUserCredentialForProvider(ctx, job.UserID, job.SourceProvider)
	if credErr != nil && providerInstance.Capabilities().RequiresAPIKey {
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("enabled credential for provider %s is required", job.SourceProvider))
	}
	apiKey := ""
	if credential != nil {
		if err := credential.Decrypt(); err != nil {
			return s.failLocalBuildJob(ctx, job, fmt.Errorf("decrypt credential: %w", err))
		}
		apiKey = strings.TrimSpace(credential.APIKey)
	}
	if providerInstance.Capabilities().RequiresAPIKey && apiKey == "" {
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("enabled credential for provider %s is required", job.SourceProvider))
	}

	items, err := s.repo.ListBuildJobItems(ctx, job.ID)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	instrumentIDs := make([]string, 0, len(items))
	for i := range items {
		instrumentIDs = append(instrumentIDs, items[i].InstrumentID)
	}
	instrumentRows, err := s.repo.ListInstrumentsByIDs(ctx, instrumentIDs, config.AssetTypes)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	assetTypeByInstrument := make(map[string]string, len(instrumentRows))
	for _, row := range instrumentRows {
		assetTypeByInstrument[row.InstrumentID] = strings.ToUpper(strings.TrimSpace(row.AssetType))
	}

	itemByInstrument := make(map[string]*model.MarketDataPackBuildJobItem, len(items))
	symbols := make([]sources.UniverseSymbol, 0, len(items))
	for i := range items {
		item := items[i]
		if item.Status == "succeeded" || item.Status == "canceled" {
			continue
		}
		if item.NextRetryAt != nil && item.NextRetryAt.After(time.Now().UTC()) {
			continue
		}
		itemByInstrument[item.InstrumentID] = &items[i]
		assetType := assetTypeByInstrument[item.InstrumentID]
		if assetType == "" {
			assetType = firstAssetType(config.AssetTypes)
		}
		symbols = append(symbols, sources.UniverseSymbol{
			InstrumentID: item.InstrumentID,
			Symbol:       item.Symbol,
			AssetType:    assetType,
		})
	}
	if len(symbols) == 0 {
		return s.completeLocalBuildJob(ctx, job, nil)
	}

	source := providersource.NewSource(providerInstance, job.SourceProvider, apiKey, config.RateLimit)
	allCandles := make([]sources.NormalizedCandle, 0, len(symbols)*300)
	processed := 0
	completed := job.CompletedSymbols
	failed := job.FailedSymbols
	for _, symbol := range symbols {
		fresh, err := s.repo.GetBuildJob(ctx, job.ID)
		if err != nil {
			return err
		}
		if fresh.Status == "canceled" {
			return nil
		}
		item := itemByInstrument[symbol.InstrumentID]
		if item == nil {
			continue
		}
		item.Status = "running"
		item.AttemptCount++
		item.ErrorMessage = nil
		item.NextRetryAt = nil
		_ = s.repo.UpdateBuildJobItem(ctx, item)

		currentSymbol := symbol.Symbol
		fresh.CurrentSymbol = &currentSymbol
		fresh.ProgressPercent = localBuildProgressPercent(processed, len(symbols))
		_ = s.repo.UpdateBuildJob(ctx, fresh)

		candles, fetchErr := collectSourceCandles(ctx, source, sources.FetchCandlesRequest{
			PackSpec: sources.PackSpec{
				PackID:         job.PackID,
				AssetType:      firstAssetType(config.AssetTypes),
				Interval:       providersource.Interval1D,
				QuoteCurrency:  "",
				SourceProvider: strings.ToLower(job.SourceProvider),
			},
			Symbols:   []sources.UniverseSymbol{symbol},
			StartDate: startDate,
			EndDate:   endDate,
			RateLimit: config.RateLimit,
		})
		if fetchErr != nil {
			nextRetry := nextRetryAt(item.AttemptCount, fetchErr)
			msg := fetchErr.Error()
			item.Status = "failed"
			item.ErrorMessage = &msg
			item.NextRetryAt = nextRetry
			_ = s.repo.UpdateBuildJobItem(ctx, item)
			failed++
			processed++
			continue
		}

		item.Status = "succeeded"
		item.ErrorMessage = nil
		item.NextRetryAt = nil
		if len(candles) > 0 {
			first := candles[0].Timestamp
			last := candles[len(candles)-1].Timestamp
			item.FirstDate = &first
			item.LastDate = &last
		}
		_ = s.repo.UpdateBuildJobItem(ctx, item)
		allCandles = append(allCandles, candles...)
		completed++
		processed++
	}

	job.CompletedSymbols = completed
	job.FailedSymbols = failed
	if failed > 0 && completed == 0 {
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("all symbols failed"))
	}
	return s.completeLocalBuildJob(ctx, job, allCandles)
}

func (s *packService) completeLocalBuildJob(ctx context.Context, job *model.MarketDataPackBuildJob, candles []sources.NormalizedCandle) error {
	config, err := parseLocalBuildConfig(job.BuildConfig)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	startDate, _ := time.Parse(time.DateOnly, config.HistoryStart)
	endDate, _ := time.Parse(time.DateOnly, config.HistoryEnd)
	rootDir := filepath.Join(s.cfg.StoragePath, "local-builds", job.ID)
	if err := os.MkdirAll(rootDir, 0o755); err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	manifest := s.localBuildManifest(job, config, startDate, endDate)
	writeResult, err := buildLocalUnpackedDirectory(ctx, candles, localBuildWriteOptions{
		RootDir:     rootDir,
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest:    manifest,
	})
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}

	packChecksum, err := sha256FileHex(writeResult.ManifestPath)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	description := writeResult.Manifest.Description
	now := time.Now().UTC()
	pack := &model.MarketDataPack{
		ID:                writeResult.Manifest.PackID,
		Version:           writeResult.Manifest.Version,
		Name:              writeResult.Manifest.Name,
		Description:       &description,
		FormatVersion:     writeResult.Manifest.FormatVersion,
		Status:            "installed",
		ParentPackID:      writeResult.Manifest.ParentPackID,
		PackPriority:      int(now.Unix()),
		FilePath:          writeResult.PackDir,
		Checksum:          packChecksum,
		SignatureVerified: false,
		AssetsCount:       writeResult.Manifest.AssetsCount,
		RowsCount:         writeResult.Manifest.RowsCount,
		InstalledAt:       &now,
		UpdatedAt:         &now,
	}
	if err := s.repo.UpsertPack(ctx, pack); err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	coverage, err := manifestCoverageToModels(writeResult.Manifest)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	if err := s.repo.ReplaceCoverage(ctx, pack.ID, coverage); err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}

	job.Status = "succeeded"
	job.ProgressPercent = decimal.NewFromInt(100)
	job.CurrentSymbol = nil
	job.ErrorMessage = nil
	job.CompletedSymbols = maxInt(job.CompletedSymbols, job.TotalSymbols-job.FailedSymbols)
	job.FinishedAt = &now
	return s.repo.UpdateBuildJob(ctx, job)
}

func (s *packService) failLocalBuildJob(ctx context.Context, job *model.MarketDataPackBuildJob, err error) error {
	message := err.Error()
	now := time.Now().UTC()
	job.Status = "failed"
	job.ErrorMessage = &message
	job.FinishedAt = &now
	_ = s.repo.UpdateBuildJob(ctx, job)
	return err
}

func (s *packService) localBuildManifest(job *model.MarketDataPackBuildJob, cfg localBuildConfig, startDate, endDate time.Time) Manifest {
	providerPolicy, _ := lookupLocalProviderLicense(strings.ToUpper(strings.TrimSpace(job.SourceProvider)))
	licenseName := "unknown-local-license"
	licenseURL := ""
	attributionRequired := false
	if providerPolicy != nil {
		licenseName = providerPolicy.LicenseName
		licenseURL = providerPolicy.SourceURL
		attributionRequired = providerPolicy.AttributionRequired
	}
	name := fmt.Sprintf("Local %s Daily", strings.ToUpper(strings.TrimSpace(job.SourceProvider)))
	return Manifest{
		PackID:                job.PackID,
		Version:               time.Now().UTC().Format("2006.01.02.150405"),
		Name:                  name,
		Description:           "Local user-built daily candles",
		FormatVersion:         CurrentFormatVersion,
		Distribution:          "local",
		Interval:              string(model.Interval1d),
		AssetTypes:            cfg.AssetTypes,
		QuoteCurrencies:       []string{"USD"},
		SourceProvider:        strings.ToLower(strings.TrimSpace(job.SourceProvider)),
		DataLicense:           licenseName,
		RedistributionAllowed: false,
		CommercialUseAllowed:  false,
		AttributionRequired:   attributionRequired,
		LicenseURL:            licenseURL,
		GeneratedBy:           "sigma-finance pack-builder",
		GeneratedByUser:       true,
		UploadForbidden:       true,
		InstallMode:           "build_local",
		GeneratedAt:           time.Now().UTC(),
		CreatedAt:             time.Now().UTC(),
		HistoryStart:          startDate.UTC().Format(time.DateOnly),
		HistoryEnd:            endDate.UTC().Format(time.DateOnly),
		Compression:           "zstd",
	}
}

func (s *packService) collectLocalBuildUniverse(ctx context.Context, userID string, assetTypes []string, portfolioFirst bool, selectedIDs []string) ([]repository.LocalBuildInstrumentCandidate, error) {
	result := make([]repository.LocalBuildInstrumentCandidate, 0, 256)
	seen := make(map[string]struct{}, 256)
	if portfolioFirst {
		rows, err := s.repo.ListUserBuildUniverse(ctx, userID, assetTypes)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			if _, exists := seen[row.InstrumentID]; exists {
				continue
			}
			seen[row.InstrumentID] = struct{}{}
			result = append(result, row)
		}
	}
	manualRows, err := s.repo.ListInstrumentsByIDs(ctx, uniqueStrings(selectedIDs), assetTypes)
	if err != nil {
		return nil, err
	}
	for _, row := range manualRows {
		if _, exists := seen[row.InstrumentID]; exists {
			continue
		}
		seen[row.InstrumentID] = struct{}{}
		result = append(result, row)
	}
	return result, nil
}

func parseLocalBuildConfig(raw json.RawMessage) (localBuildConfig, error) {
	var cfg localBuildConfig
	if len(raw) == 0 {
		return cfg, fmt.Errorf("build config is missing")
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, err
	}
	if cfg.HistoryStart == "" || cfg.HistoryEnd == "" {
		return cfg, fmt.Errorf("build history range is missing")
	}
	if _, err := time.Parse(time.DateOnly, cfg.HistoryStart); err != nil {
		return cfg, fmt.Errorf("invalid history_start: %w", err)
	}
	if _, err := time.Parse(time.DateOnly, cfg.HistoryEnd); err != nil {
		return cfg, fmt.Errorf("invalid history_end: %w", err)
	}
	if len(cfg.AssetTypes) == 0 {
		cfg.AssetTypes = []string{"STOCK", "FUND"}
	}
	return cfg, nil
}

func resolveLocalBuildDates(startInput, endInput *time.Time) (time.Time, time.Time) {
	start := time.Now().UTC().AddDate(-5, 0, 0)
	end := time.Now().UTC()
	if startInput != nil && !startInput.IsZero() {
		start = startInput.UTC()
	}
	if endInput != nil && !endInput.IsZero() {
		end = endInput.UTC()
	}
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	end = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.UTC)
	return start, end
}

func resolveLocalBuildRateLimits(input StartLocalPackBuildInput, providerLimit providers.RateLimit) sources.RateLimitConfig {
	limit := sources.RateLimitConfig{
		RequestsPerMinute: providerLimit.RequestsPerMinute,
		RequestsPerDay:    providerLimit.RequestsPerDay,
	}
	if input.RequestsPerMinute != nil && *input.RequestsPerMinute > 0 {
		if limit.RequestsPerMinute == 0 || *input.RequestsPerMinute < limit.RequestsPerMinute {
			limit.RequestsPerMinute = *input.RequestsPerMinute
		}
	}
	if input.RequestsPerDay != nil && *input.RequestsPerDay > 0 {
		if limit.RequestsPerDay == 0 || *input.RequestsPerDay < limit.RequestsPerDay {
			limit.RequestsPerDay = *input.RequestsPerDay
		}
	}
	if input.ConcurrentRequests != nil && *input.ConcurrentRequests > 0 {
		limit.ConcurrentRequests = *input.ConcurrentRequests
	}
	return limit
}

func buildLocalPackID(provider string, candidate *string) string {
	if candidate != nil {
		value := strings.TrimSpace(*candidate)
		if value != "" {
			return value
		}
	}
	return fmt.Sprintf("local-%s-daily-%s", strings.ToLower(strings.TrimSpace(provider)), time.Now().UTC().Format("20060102150405"))
}

func createLocalBuildProvider(providerID string) (providers.Provider, error) {
	switch strings.ToUpper(strings.TrimSpace(providerID)) {
	case "TIINGO":
		return providers.NewTiingoProvider(), nil
	case "TWELVEDATA":
		return providers.NewTwelveDataProvider(), nil
	case "ALPHAVANTAGE":
		return providers.NewAlphaVantageProvider(), nil
	case "FINNHUB":
		return providers.NewFinnhubProvider(), nil
	case "YFINANCE":
		return nil, fmt.Errorf("provider YFINANCE is not supported for local key builds")
	default:
		return nil, fmt.Errorf("provider %s is not supported for local key builds", strings.ToUpper(strings.TrimSpace(providerID)))
	}
}

func lookupLocalProviderLicense(providerID string) (*licensegate.Policy, error) {
	mapped := map[string]string{
		"TIINGO":       "eodhd-local-only",
		"TWELVEDATA":   "eodhd-local-only",
		"ALPHAVANTAGE": "eodhd-local-only",
		"FINNHUB":      "eodhd-local-only",
	}
	name := mapped[providerID]
	if name == "" {
		return nil, fmt.Errorf("no policy for provider %s", providerID)
	}
	candidates := []string{
		filepath.Clean(filepath.Join("packs", "licenses", name+".yaml")),
		filepath.Clean(filepath.Join("..", "packs", "licenses", name+".yaml")),
	}
	for _, base := range candidates {
		if _, err := os.Stat(base); err == nil {
			return licensegate.LoadPolicy(base)
		}
	}
	return nil, fmt.Errorf("license policy file not found for %s", providerID)
}

func collectSourceCandles(ctx context.Context, source sources.CandleSource, req sources.FetchCandlesRequest) ([]sources.NormalizedCandle, error) {
	candleCh, errCh := source.FetchCandles(ctx, req)
	rows := make([]sources.NormalizedCandle, 0, 512)
	for candleCh != nil || errCh != nil {
		select {
		case row, ok := <-candleCh:
			if !ok {
				candleCh = nil
				continue
			}
			rows = append(rows, row)
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
	return rows, nil
}

func nextRetryAt(attempt int, err error) *time.Time {
	if !isRetryableLocalBuildError(err) {
		return nil
	}
	wait := time.Duration(attempt) * time.Minute
	next := time.Now().UTC().Add(wait)
	return &next
}

func isRetryableLocalBuildError(err error) bool {
	if err == nil {
		return false
	}
	if providers.IsRateLimited(err) {
		return true
	}
	var providerErr *providers.ProviderError
	if errors.As(err, &providerErr) {
		return providerErr.Retryable
	}
	return false
}

func normalizeLocalBuildAssetTypes(raw []string) []string {
	if len(raw) == 0 {
		return []string{"STOCK", "FUND"}
	}
	out := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, value := range raw {
		v := strings.ToUpper(strings.TrimSpace(value))
		if v == "" {
			continue
		}
		if v != "STOCK" && v != "FUND" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	if len(out) == 0 {
		return []string{"STOCK", "FUND"}
	}
	return out
}

func uniqueStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		v := strings.TrimSpace(value)
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func firstAssetType(values []string) string {
	if len(values) == 0 {
		return "STOCK"
	}
	return values[0]
}

func localBuildProgressPercent(processed int, total int) decimal.Decimal {
	if total <= 0 {
		return decimal.Zero
	}
	value := decimal.NewFromInt(int64(processed)).Mul(decimal.NewFromInt(100)).Div(decimal.NewFromInt(int64(total)))
	if value.GreaterThan(decimal.NewFromInt(100)) {
		return decimal.NewFromInt(100)
	}
	return value
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
