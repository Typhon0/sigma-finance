package packs

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/marketdata/packs/sources"
	"sigma_finance/internal/marketdata/packs/sources/marketparquet"
)

type marketParquetTarget struct {
	item           *model.MarketDataPackBuildJobItem
	providerSymbol string
	assetType      string
	found          bool
	firstDate      *time.Time
	lastDate       *time.Time
}

func (s *packService) runMarketParquetBuildJob(
	ctx context.Context,
	job *model.MarketDataPackBuildJob,
	config localBuildConfig,
	startDate time.Time,
	endDate time.Time,
	items []model.MarketDataPackBuildJobItem,
	assetTypeByInstrument map[string]string,
	symbolByInstrument map[string]string,
	apiKey string,
) error {
	sourceMode := normalizeLocalBuildSourceMode(&config.SourceMode)
	importPath := strings.TrimSpace(config.ImportPath)
	if sourceMode == localBuildSourceModeLocalFolder && importPath == "" {
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("marketparquet_local_path is required for local_folder mode"))
	}
	if sourceMode == localBuildSourceModeLocalFolder {
		if err := s.validateMarketParquetImportPath(importPath); err != nil {
			return s.failLocalBuildJob(ctx, job, err)
		}
	}

	timeframes := []string{marketparquet.AssetTimeframeStockDaily, marketparquet.AssetTimeframeETFDaily}
	targetsByTimeframe := map[string]map[string][]*marketParquetTarget{
		marketparquet.AssetTimeframeStockDaily: {},
		marketparquet.AssetTimeframeETFDaily:   {},
	}
	allTargets := make([]*marketParquetTarget, 0, len(items))
	for i := range items {
		item := &items[i]
		if item.Status == "succeeded" || item.Status == "canceled" {
			continue
		}
		if item.NextRetryAt != nil && item.NextRetryAt.After(time.Now().UTC()) {
			continue
		}
		assetType := strings.ToUpper(strings.TrimSpace(assetTypeByInstrument[item.InstrumentID]))
		if assetType == "" {
			assetType = firstAssetType(config.AssetTypes)
		}
		assetType = strings.ToUpper(strings.TrimSpace(assetType))
		if assetType != "STOCK" && assetType != "FUND" {
			continue
		}
		item.Status = "running"
		item.AttemptCount++
		item.ErrorMessage = nil
		item.NextRetryAt = nil
		item.ProviderErrorCode = nil
		item.HTTPStatus = nil
		item.Retryable = nil
		_ = s.repo.UpdateBuildJobItem(ctx, item)

		providerSymbol := strings.ToUpper(strings.TrimSpace(item.Symbol))
		if providerSymbol == "" {
			msg := fmt.Sprintf("No MarketParquet symbol mapping for instrument %s / %s", item.InstrumentID, symbolByInstrument[item.InstrumentID])
			item.Status = "failed"
			item.ErrorMessage = &msg
			retryable := false
			item.Retryable = &retryable
			_ = s.repo.UpdateBuildJobItem(ctx, item)
			continue
		}
		timeframe := marketparquet.AssetTimeframeETFDaily
		if assetType == "STOCK" {
			timeframe = marketparquet.AssetTimeframeStockDaily
		}
		target := &marketParquetTarget{
			item:           item,
			providerSymbol: providerSymbol,
			assetType:      assetType,
		}
		targetsByTimeframe[timeframe][providerSymbol] = append(targetsByTimeframe[timeframe][providerSymbol], target)
		allTargets = append(allTargets, target)
	}
	if len(allTargets) == 0 {
		if err := s.refreshLocalBuildCounters(ctx, job); err != nil {
			return s.failLocalBuildJob(ctx, job, err)
		}
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("all symbols failed"))
	}

	apiClient := marketparquet.NewAPIClient(s.cfg.MarketParquetAPIBaseURL, apiKey)
	datesByTimeframe := make(map[string][]time.Time, 2)
	totalDates := 0
	for _, timeframe := range timeframes {
		if len(targetsByTimeframe[timeframe]) == 0 {
			continue
		}
		dates, err := s.listMarketParquetDates(ctx, sourceMode, importPath, apiClient, timeframe)
		if err != nil {
			return s.failLocalBuildJob(ctx, job, err)
		}
		filtered := marketparquet.FilterByDateRange(dates, startDate, endDate)
		datesByTimeframe[timeframe] = filtered
		totalDates += len(filtered)
	}
	if totalDates == 0 {
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("no marketparquet date files available for selected range"))
	}

	job.TotalDates = totalDates
	job.CompletedDates = 0
	job.RowsWritten = 0
	job.ProgressPercent = localBuildProgressPercent(0, totalDates)
	if err := s.repo.UpdateBuildJob(ctx, job); err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}

	rootDir := filepath.Join(s.cfg.StoragePath, "local-builds", job.ID)
	if err := os.MkdirAll(rootDir, 0o755); err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	manifest := s.localBuildManifest(job, config, startDate, endDate)
	writer, err := newLocalBuildStreamingWriter(localBuildWriteOptions{
		RootDir:     rootDir,
		PartitionBy: []string{"asset_type", "quote_currency", "year"},
		Manifest:    manifest,
	})
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}

	for _, timeframe := range timeframes {
		targetsBySymbol := targetsByTimeframe[timeframe]
		if len(targetsBySymbol) == 0 {
			continue
		}
		assetTypeLabel := "FUND"
		if timeframe == marketparquet.AssetTimeframeStockDaily {
			assetTypeLabel = "STOCK"
		}
		currentAssetType := assetTypeLabel
		for _, day := range datesByTimeframe[timeframe] {
			fresh, err := s.repo.GetBuildJob(ctx, job.ID)
			if err != nil {
				return err
			}
			if fresh.Status == "canceled" {
				return nil
			}
			filePath, err := s.resolveMarketParquetFile(ctx, sourceMode, importPath, apiClient, timeframe, day)
			if err != nil {
				return s.failLocalBuildJob(ctx, job, err)
			}
			rows, err := marketparquet.ReadRows(filePath)
			if err != nil {
				return s.failLocalBuildJob(ctx, job, err)
			}
			for _, row := range rows {
				rowSymbol := strings.ToUpper(strings.TrimSpace(row.Symbol))
				if rowSymbol == "" {
					continue
				}
				targets := targetsBySymbol[rowSymbol]
				if len(targets) == 0 {
					continue
				}
				rowAssetType, ok := marketparquet.NormalizeAssetType(row.AssetType)
				if !ok {
					continue
				}
				if timeframe == marketparquet.AssetTimeframeStockDaily && rowAssetType != "STOCK" {
					continue
				}
				if timeframe == marketparquet.AssetTimeframeETFDaily && rowAssetType != "FUND" {
					continue
				}
				openPrice, err := marketparquet.DecimalFromFloat64(row.Open)
				if err != nil {
					return s.failLocalBuildJob(ctx, job, err)
				}
				highPrice, err := marketparquet.DecimalFromFloat64(row.High)
				if err != nil {
					return s.failLocalBuildJob(ctx, job, err)
				}
				lowPrice, err := marketparquet.DecimalFromFloat64(row.Low)
				if err != nil {
					return s.failLocalBuildJob(ctx, job, err)
				}
				closePrice, err := marketparquet.DecimalFromFloat64(row.Close)
				if err != nil {
					return s.failLocalBuildJob(ctx, job, err)
				}
				volume, err := marketparquet.DecimalFromFloat64(row.Volume)
				if err != nil {
					return s.failLocalBuildJob(ctx, job, err)
				}
				ts := marketparquet.NormalizeUTCDailyTimestamp(row.Timestamp)
				for _, target := range targets {
					adjustedClose := closePrice
					candle := sources.NormalizedCandle{
						InstrumentID:  target.item.InstrumentID,
						Symbol:        strings.TrimSpace(row.Symbol),
						AssetType:     target.assetType,
						Interval:      "1d",
						Timestamp:     ts,
						Open:          openPrice,
						High:          highPrice,
						Low:           lowPrice,
						Close:         closePrice,
						AdjustedClose: &adjustedClose,
						Volume:        volume,
						QuoteCurrency: "USD",
						Source:        "marketparquet",
					}
					if err := writer.Add(ctx, candle); err != nil {
						return s.failLocalBuildJob(ctx, job, err)
					}
					target.found = true
					if target.firstDate == nil || ts.Before(*target.firstDate) {
						dayCopy := ts
						target.firstDate = &dayCopy
					}
					if target.lastDate == nil || ts.After(*target.lastDate) {
						dayCopy := ts
						target.lastDate = &dayCopy
					}
					job.RowsWritten++
				}
			}
			completedDate := day
			job.CurrentDate = &completedDate
			job.CurrentAssetType = &currentAssetType
			job.CompletedDates++
			job.ProgressPercent = localBuildProgressPercent(job.CompletedDates, job.TotalDates)
			if err := s.repo.UpdateBuildJob(ctx, job); err != nil {
				return s.failLocalBuildJob(ctx, job, err)
			}
		}
	}

	completedSymbols := 0
	failedSymbols := 0
	for _, target := range allTargets {
		if target.found {
			target.item.Status = "succeeded"
			target.item.ErrorMessage = nil
			target.item.NextRetryAt = nil
			target.item.ProviderErrorCode = nil
			target.item.HTTPStatus = nil
			target.item.Retryable = nil
			target.item.FirstDate = target.firstDate
			target.item.LastDate = target.lastDate
			completedSymbols++
		} else {
			msg := fmt.Sprintf("no rows found in marketparquet date files for symbol %s", target.providerSymbol)
			target.item.Status = "failed"
			target.item.ErrorMessage = &msg
			target.item.NextRetryAt = nil
			target.item.ProviderErrorCode = nil
			target.item.HTTPStatus = nil
			retryable := false
			target.item.Retryable = &retryable
			failedSymbols++
		}
		if err := s.repo.UpdateBuildJobItem(ctx, target.item); err != nil {
			return s.failLocalBuildJob(ctx, job, err)
		}
	}

	job.CompletedSymbols = completedSymbols
	job.FailedSymbols = failedSymbols
	if err := s.refreshLocalBuildCounters(ctx, job); err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	if job.FailedSymbols > 0 && job.CompletedSymbols == 0 {
		return s.failLocalBuildJob(ctx, job, fmt.Errorf("all symbols failed"))
	}
	finalStatus := "succeeded"
	if job.FailedSymbols > 0 {
		finalStatus = "partial"
	}
	writeResult, err := writer.Close(ctx)
	if err != nil {
		return s.failLocalBuildJob(ctx, job, err)
	}
	return s.installLocalBuildWriteResult(ctx, job, writeResult, finalStatus)
}

func (s *packService) listMarketParquetDates(
	ctx context.Context,
	sourceMode string,
	importPath string,
	apiClient *marketparquet.APIClient,
	assetTimeframe string,
) ([]time.Time, error) {
	if sourceMode == localBuildSourceModeLocalFolder {
		return listLocalMarketParquetDates(importPath, assetTimeframe)
	}
	return apiClient.ListDates(ctx, assetTimeframe)
}

func (s *packService) resolveMarketParquetFile(
	ctx context.Context,
	sourceMode string,
	importPath string,
	apiClient *marketparquet.APIClient,
	assetTimeframe string,
	day time.Time,
) (string, error) {
	if sourceMode == localBuildSourceModeLocalFolder {
		path, err := findLocalMarketParquetFile(importPath, assetTimeframe, day)
		if err != nil {
			return "", err
		}
		if err := marketparquet.ValidateParquet(path); err != nil {
			return "", err
		}
		return path, nil
	}
	cachePath := filepath.Join(
		s.cfg.StoragePath,
		"source-cache",
		"marketparquet",
		assetTimeframe,
		day.UTC().Format(time.DateOnly)+".parquet",
	)
	if _, err := os.Stat(cachePath); err == nil {
		if validateErr := marketparquet.ValidateParquet(cachePath); validateErr == nil {
			return cachePath, nil
		}
		_ = os.Remove(cachePath)
	}
	if err := apiClient.DownloadDateFile(ctx, assetTimeframe, day, cachePath); err != nil {
		return "", err
	}
	if err := marketparquet.ValidateParquet(cachePath); err != nil {
		return "", err
	}
	return cachePath, nil
}

func listLocalMarketParquetDates(importPath string, assetTimeframe string) ([]time.Time, error) {
	dirCandidates := []string{
		filepath.Join(importPath, "by_date", assetTimeframe),
		filepath.Join(importPath, assetTimeframe),
	}
	seen := make(map[string]struct{}, 512)
	out := make([]time.Time, 0, 512)
	for _, dir := range dirCandidates {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := strings.TrimSpace(entry.Name())
			if !strings.HasSuffix(strings.ToLower(name), ".parquet") {
				continue
			}
			datePart := strings.TrimSuffix(name, filepath.Ext(name))
			day, err := time.Parse(time.DateOnly, datePart)
			if err != nil {
				continue
			}
			key := day.UTC().Format(time.DateOnly)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, day.UTC())
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no marketparquet files found for %s in %s", assetTimeframe, importPath)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Before(out[j]) })
	return out, nil
}

func findLocalMarketParquetFile(importPath string, assetTimeframe string, day time.Time) (string, error) {
	name := day.UTC().Format(time.DateOnly) + ".parquet"
	candidates := []string{
		filepath.Join(importPath, "by_date", assetTimeframe, name),
		filepath.Join(importPath, assetTimeframe, name),
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("marketparquet file not found for %s on %s", assetTimeframe, day.UTC().Format(time.DateOnly))
}
