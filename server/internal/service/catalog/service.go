package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
	"time"
)

type CatalogAsset struct {
	ExternalID    string
	Symbol        string
	Name          string
	MarketCapRank *int
	ImageURL      *string
	Platforms     map[string]string
}

type CatalogClient interface {
	ListAssets(ctx context.Context, listingStatus string, start int, limit int) ([]CatalogAsset, error)
	GetAssetByID(ctx context.Context, externalID string) (*CatalogAsset, error)
}

type SyncMode string

const (
	SyncModeFullSeed       SyncMode = "full_seed"
	SyncModeSearchImport   SyncMode = "search_import"
	SyncModeSnapshotImport SyncMode = "snapshot_import"

	DefaultCatalogSource  = "TRUSTWALLET"
	DefaultCatalogVersion = "trustwallet-v1"
	maxFailureLogSamples  = 20
)

type SyncRequest struct {
	Mode                   SyncMode
	ExternalID             string
	SnapshotPath           string
	ExpectedCatalogVersion string
}

type SyncResult struct {
	Run      *model.CatalogSyncRun
	Stats    SyncStats
	Imported *model.Instrument
}

type SyncStats struct {
	Scanned  int `json:"scanned"`
	Upserted int `json:"upserted"`
	Failed   int `json:"failed"`
}

type SnapshotFile struct {
	CatalogVersion string           `json:"catalogVersion"`
	Source         string           `json:"source"`
	ExportedAt     time.Time        `json:"exportedAt"`
	Records        []SnapshotRecord `json:"records"`
	Metadata       map[string]any   `json:"metadata,omitempty"`
}

type SnapshotRecord struct {
	ExternalID    string            `json:"externalId"`
	Symbol        string            `json:"symbol"`
	Name          string            `json:"name"`
	MarketCapRank *int              `json:"marketCapRank,omitempty"`
	ImageURL      *string           `json:"imageUrl,omitempty"`
	Platforms     map[string]string `json:"platforms,omitempty"`
	Currency      *string           `json:"currency,omitempty"`
	QuoteCurrency *string           `json:"quoteCurrency,omitempty"`
}

type SnapshotExportSummary struct {
	Path           string
	CatalogVersion string
	RecordCount    int
}

type SyncService interface {
	Sync(ctx context.Context, request SyncRequest) (*SyncResult, error)
	ExportSnapshot(ctx context.Context, outputPath string, catalogVersion string) (*SnapshotExportSummary, error)
	ImportSnapshotIfCatalogEmpty(ctx context.Context, snapshotPath string, expectedCatalogVersion string) (bool, *SyncResult, error)
	IsCryptoCatalogEmpty(ctx context.Context) (bool, error)
	GetLatestRun(ctx context.Context, source string) (*model.CatalogSyncRun, error)
}

type service struct {
	client         CatalogClient
	instrumentRepo repository.IInstrumentRepository
	mappingRepo    repository.IInstrumentProviderMappingRepository
	syncRunRepo    repository.ICatalogSyncRunRepository
	now            func() time.Time
}

func NewSyncService(
	client CatalogClient,
	instrumentRepo repository.IInstrumentRepository,
	mappingRepo repository.IInstrumentProviderMappingRepository,
	syncRunRepo repository.ICatalogSyncRunRepository,
) SyncService {
	return &service{
		client:         client,
		instrumentRepo: instrumentRepo,
		mappingRepo:    mappingRepo,
		syncRunRepo:    syncRunRepo,
		now:            time.Now,
	}
}

func (s *service) GetLatestRun(ctx context.Context, source string) (*model.CatalogSyncRun, error) {
	return s.syncRunRepo.GetLatestBySource(ctx, strings.ToUpper(strings.TrimSpace(source)))
}

func (s *service) IsCryptoCatalogEmpty(ctx context.Context) (bool, error) {
	if s.instrumentRepo == nil {
		return false, errors.New("instrument repository is not configured")
	}

	count, err := s.instrumentRepo.GetDB().NewSelect().
		Model((*model.Instrument)(nil)).
		Where("asset_type = ?", model.InstrumentAssetTypeCrypto).
		Where("external_source = ?", DefaultCatalogSource).
		Count(ctx)
	if err != nil {
		return false, err
	}

	return count == 0, nil
}

func (s *service) ImportSnapshotIfCatalogEmpty(ctx context.Context, snapshotPath string, expectedCatalogVersion string) (bool, *SyncResult, error) {
	empty, err := s.IsCryptoCatalogEmpty(ctx)
	if err != nil {
		return false, nil, err
	}
	if !empty {
		return false, nil, nil
	}

	if strings.TrimSpace(snapshotPath) == "" {
		return false, nil, errors.New("catalog snapshot path is required when crypto catalog is empty")
	}

	result, err := s.Sync(ctx, SyncRequest{
		Mode:                   SyncModeSnapshotImport,
		SnapshotPath:           snapshotPath,
		ExpectedCatalogVersion: expectedCatalogVersion,
	})
	if err != nil {
		return true, nil, err
	}

	return true, result, nil
}

func (s *service) ExportSnapshot(ctx context.Context, outputPath string, catalogVersion string) (*SnapshotExportSummary, error) {
	if s.instrumentRepo == nil {
		return nil, errors.New("instrument repository is not configured")
	}

	normalizedPath := strings.TrimSpace(outputPath)
	if normalizedPath == "" {
		return nil, errors.New("output path is required")
	}

	normalizedVersion := strings.TrimSpace(catalogVersion)
	if normalizedVersion == "" {
		normalizedVersion = DefaultCatalogVersion
	}

	var instruments []model.Instrument
	err := s.instrumentRepo.GetDB().NewSelect().
		Model(&instruments).
		Where("asset_type = ?", model.InstrumentAssetTypeCrypto).
		Where("external_source = ?", DefaultCatalogSource).
		Order("external_id ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	records := make([]SnapshotRecord, 0, len(instruments))
	for _, instrument := range instruments {
		externalID := strings.TrimSpace(stringOrEmpty(instrument.ExternalID))
		if externalID == "" {
			continue
		}

		records = append(records, SnapshotRecord{
			ExternalID:    externalID,
			Symbol:        strings.TrimSpace(instrument.Symbol),
			Name:          strings.TrimSpace(instrument.Name),
			MarketCapRank: instrument.MarketCapRank,
			ImageURL:      instrument.ImageURL,
			Platforms:     parsePlatformsJSON(instrument.PlatformsJSON),
			Currency:      instrument.Currency,
			QuoteCurrency: instrument.QuoteCurrency,
		})
	}

	snapshot := SnapshotFile{
		CatalogVersion: normalizedVersion,
		Source:         DefaultCatalogSource,
		ExportedAt:     s.now().UTC(),
		Records:        records,
		Metadata: map[string]any{
			"generator": "sigma-finance",
		},
	}

	bytes, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(normalizedPath), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(normalizedPath, bytes, 0o644); err != nil {
		return nil, err
	}

	return &SnapshotExportSummary{
		Path:           normalizedPath,
		CatalogVersion: normalizedVersion,
		RecordCount:    len(records),
	}, nil
}

func (s *service) Sync(ctx context.Context, request SyncRequest) (*SyncResult, error) {
	if s.syncRunRepo == nil {
		return nil, errors.New("catalog sync repository is not configured")
	}

	mode := request.Mode
	if mode == "" {
		mode = SyncModeFullSeed
	}

	if mode != SyncModeSnapshotImport && s.client == nil {
		return nil, errors.New("catalog client is not configured")
	}

	run := &model.CatalogSyncRun{
		Source: DefaultCatalogSource,
		Mode:   string(mode),
		Status: string(model.CatalogSyncRunStatusRunning),
	}
	if _, err := s.syncRunRepo.Create(ctx, run); err != nil {
		return nil, err
	}

	result := &SyncResult{Run: run}

	updateRun := func(status model.CatalogSyncRunStatus, syncErr error, stats SyncStats, cursor *string) {
		run.Status = string(status)
		run.Cursor = cursor
		if syncErr != nil {
			errText := syncErr.Error()
			run.ErrorText = &errText
		}
		statsPayload := map[string]any{
			"scanned":  stats.Scanned,
			"upserted": stats.Upserted,
			"failed":   stats.Failed,
		}
		if payload, err := json.Marshal(statsPayload); err == nil {
			run.StatsJSON = payload
		}
		finishedAt := s.now()
		run.FinishedAt = &finishedAt
		_ = s.syncRunRepo.Update(ctx, run)
	}

	var syncErr error
	var stats SyncStats
	var imported *model.Instrument

	switch mode {
	case SyncModeSearchImport:
		imported, stats, syncErr = s.runSearchImport(ctx, strings.TrimSpace(request.ExternalID))
	case SyncModeFullSeed:
		stats, syncErr = s.runFullSeed(ctx)
	case SyncModeSnapshotImport:
		stats, syncErr = s.runSnapshotImport(ctx, strings.TrimSpace(request.SnapshotPath), strings.TrimSpace(request.ExpectedCatalogVersion))
	default:
		syncErr = fmt.Errorf("unsupported catalog sync mode: %s", mode)
	}

	result.Stats = stats
	result.Imported = imported

	if syncErr != nil {
		updateRun(model.CatalogSyncRunStatusFailed, syncErr, stats, nil)
		return nil, syncErr
	}

	if stats.Failed > 0 {
		updateRun(model.CatalogSyncRunStatusPartial, nil, stats, nil)
	} else {
		updateRun(model.CatalogSyncRunStatusSuccess, nil, stats, nil)
	}

	return result, nil
}

func (s *service) runFullSeed(ctx context.Context) (SyncStats, error) {
	const pageSize = 5000
	stats := SyncStats{}
	failureLogCount := 0

	for start := 1; ; start += pageSize {
		assets, err := s.client.ListAssets(ctx, "active", start, pageSize)
		if err != nil {
			return stats, err
		}
		if len(assets) == 0 {
			break
		}

		stats.Scanned += len(assets)
		for _, asset := range assets {
			record := SnapshotRecord{
				ExternalID:    strings.TrimSpace(asset.ExternalID),
				Symbol:        strings.TrimSpace(asset.Symbol),
				Name:          strings.TrimSpace(asset.Name),
				MarketCapRank: asset.MarketCapRank,
				ImageURL:      asset.ImageURL,
				Platforms:     normalizePlatforms(asset.Platforms),
			}
			if _, upsertErr := s.upsertCatalogRecord(ctx, record); upsertErr != nil {
				stats.Failed++
				if failureLogCount < maxFailureLogSamples {
					log.Printf("[catalog-sync] mode=full_seed upsert failed external_id=%s symbol=%s err=%v", record.ExternalID, record.Symbol, upsertErr)
					failureLogCount++
				}
				continue
			}
			stats.Upserted++
		}

		if len(assets) < pageSize {
			break
		}
	}
	if stats.Failed > failureLogCount {
		log.Printf("[catalog-sync] mode=full_seed additional failures suppressed=%d", stats.Failed-failureLogCount)
	}

	return stats, nil
}

func (s *service) runSearchImport(ctx context.Context, externalID string) (*model.Instrument, SyncStats, error) {
	if externalID == "" {
		return nil, SyncStats{}, errors.New("externalId is required")
	}

	if existing, err := s.instrumentRepo.FindByExternalKey(ctx, DefaultCatalogSource, externalID); err == nil && existing != nil {
		return existing, SyncStats{Scanned: 1, Upserted: 1}, nil
	} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, SyncStats{}, err
	}

	asset, err := s.client.GetAssetByID(ctx, externalID)
	if err != nil {
		return nil, SyncStats{}, err
	}
	if asset == nil {
		return nil, SyncStats{Scanned: 1}, fmt.Errorf("trustwallet asset %s not found", externalID)
	}

	record := SnapshotRecord{
		ExternalID:    strings.TrimSpace(asset.ExternalID),
		Symbol:        strings.TrimSpace(asset.Symbol),
		Name:          strings.TrimSpace(asset.Name),
		MarketCapRank: asset.MarketCapRank,
		ImageURL:      asset.ImageURL,
		Platforms:     normalizePlatforms(asset.Platforms),
	}
	instrument, upsertErr := s.upsertCatalogRecord(ctx, record)
	if upsertErr != nil {
		return nil, SyncStats{Scanned: 1, Failed: 1}, upsertErr
	}

	return instrument, SyncStats{Scanned: 1, Upserted: 1}, nil
}

func (s *service) runSnapshotImport(ctx context.Context, snapshotPath string, expectedCatalogVersion string) (SyncStats, error) {
	if strings.TrimSpace(snapshotPath) == "" {
		return SyncStats{}, errors.New("snapshot path is required")
	}

	bytes, err := os.ReadFile(snapshotPath)
	if err != nil {
		return SyncStats{}, err
	}

	var snapshot SnapshotFile
	if err := json.Unmarshal(bytes, &snapshot); err != nil {
		return SyncStats{}, err
	}

	if strings.ToUpper(strings.TrimSpace(snapshot.Source)) != DefaultCatalogSource {
		return SyncStats{}, fmt.Errorf("unsupported snapshot source %q", snapshot.Source)
	}

	expectedVersion := strings.TrimSpace(expectedCatalogVersion)
	if expectedVersion == "" {
		expectedVersion = DefaultCatalogVersion
	}
	if strings.TrimSpace(snapshot.CatalogVersion) == "" {
		return SyncStats{}, errors.New("snapshot catalog version is required")
	}
	if !strings.EqualFold(snapshot.CatalogVersion, expectedVersion) {
		return SyncStats{}, fmt.Errorf("snapshot version %q is incompatible with expected version %q", snapshot.CatalogVersion, expectedVersion)
	}

	stats := SyncStats{Scanned: len(snapshot.Records)}
	failureLogCount := 0
	for _, record := range snapshot.Records {
		if _, upsertErr := s.upsertCatalogRecord(ctx, record); upsertErr != nil {
			stats.Failed++
			if failureLogCount < maxFailureLogSamples {
				log.Printf("[catalog-sync] mode=snapshot_import upsert failed external_id=%s symbol=%s err=%v", record.ExternalID, record.Symbol, upsertErr)
				failureLogCount++
			}
			continue
		}
		stats.Upserted++
	}
	if stats.Failed > failureLogCount {
		log.Printf("[catalog-sync] mode=snapshot_import additional failures suppressed=%d", stats.Failed-failureLogCount)
	}

	return stats, nil
}

func (s *service) upsertCatalogRecord(ctx context.Context, record SnapshotRecord) (*model.Instrument, error) {
	if s.instrumentRepo == nil {
		return nil, errors.New("instrument repository is not configured")
	}

	normalizedExternalID := strings.TrimSpace(record.ExternalID)
	normalizedSymbol := strings.ToUpper(strings.TrimSpace(record.Symbol))
	normalizedName := normalizeInstrumentName(record.Name)
	if normalizedExternalID == "" || normalizedSymbol == "" || normalizedName == "" {
		return nil, errors.New("externalId, symbol, and name are required")
	}

	now := s.now().UTC()
	externalSource := DefaultCatalogSource
	exchangeCode := "trustwallet"
	providerSource := "trustwallet"
	instrumentStatus := "active"
	currency := firstNonEmptyPtr(stringOrEmpty(record.Currency), "USD")
	quoteCurrency := firstNonEmptyPtr(stringOrEmpty(record.QuoteCurrency), "USD")

	instrument := &model.Instrument{
		Symbol:                 normalizedSymbol,
		NormalizedSymbol:       normalizeInstrumentText(normalizedSymbol),
		Name:                   strings.TrimSpace(record.Name),
		NormalizedName:         normalizedName,
		Exchange:               "Trust Wallet",
		ExchangeCode:           &exchangeCode,
		Currency:               currency,
		QuoteCurrency:          quoteCurrency,
		AssetType:              model.InstrumentAssetTypeCrypto,
		Status:                 model.InstrumentStatusActive,
		ProviderSource:         providerSource,
		ProviderExternalID:     ptrString(normalizedExternalID),
		ExternalSource:         &externalSource,
		ExternalID:             ptrString(normalizedExternalID),
		PlatformsJSON:          marshalPlatforms(record.Platforms),
		PrimaryContractAddress: derivePrimaryContractAddress(record.Platforms),
		InstrumentStatus:       &instrumentStatus,
		MarketCapRank:          record.MarketCapRank,
		ImageURL:               record.ImageURL,
		MetadataUpdatedAt:      &now,
		LastVerifiedAt:         &now,
		UpdatedAt:              now,
	}

	metadata := map[string]any{
		"catalog": map[string]any{
			"source":      DefaultCatalogSource,
			"imported_at": now.Format(time.RFC3339),
		},
	}
	if payload, err := json.Marshal(metadata); err == nil {
		instrument.Metadata = payload
	}

	persisted, err := s.instrumentRepo.UpsertCatalogInstrument(ctx, instrument)
	if err != nil {
		return nil, err
	}

	if persisted != nil {
		if err := s.upsertDefaultMappings(ctx, persisted); err != nil {
			return nil, err
		}
	}

	return persisted, nil
}

func (s *service) upsertDefaultMappings(ctx context.Context, instrument *model.Instrument) error {
	if s.mappingRepo == nil || instrument == nil {
		return nil
	}

	providers := []string{"BINANCE", "CRYPTOCOMPARE", "TWELVEDATA", "ALPHAVANTAGE"}
	now := s.now().UTC()

	for _, provider := range providers {
		providerAssetID, providerSymbol, providerMarket, quoteCurrency := deriveProviderIdentity(instrument, provider)
		mappingStatus := model.InstrumentProviderMappingStatusVerified
		lastVerifiedAt := &now
		var lastErrorText *string

		if strings.TrimSpace(providerAssetID) == "" {
			mappingStatus = model.InstrumentProviderMappingStatusUnmapped
			lastVerifiedAt = nil
			lastErrorText = ptrString("deterministic mapping unavailable")
		}

		mapping := &model.InstrumentProviderMapping{
			InstrumentID:    instrument.ID,
			Provider:        provider,
			ProviderAssetID: firstNonEmpty(providerAssetID, instrument.ID),
			ProviderSymbol:  providerSymbol,
			ProviderMarket:  providerMarket,
			QuoteCurrency:   quoteCurrency,
			MappingStatus:   mappingStatus,
			LastVerifiedAt:  lastVerifiedAt,
			LastErrorText:   lastErrorText,
		}

		if _, err := s.mappingRepo.Upsert(ctx, mapping); err != nil {
			return err
		}
	}

	return nil
}

func deriveProviderIdentity(instrument *model.Instrument, provider string) (string, *string, *string, *string) {
	if instrument == nil {
		return "", nil, nil, nil
	}

	symbol := strings.ToUpper(strings.TrimSpace(instrument.Symbol))
	if symbol == "" {
		return "", nil, nil, nil
	}

	providerSymbol := symbol
	providerMarket := strings.TrimSpace(firstNonEmpty(stringOrEmpty(instrument.ExchangeCode), instrument.Exchange))
	quoteCurrency := strings.ToUpper(strings.TrimSpace(firstNonEmpty(stringOrEmpty(instrument.QuoteCurrency), stringOrEmpty(instrument.Currency), "USD")))

	if instrument.AssetType == model.InstrumentAssetTypeCrypto {
		switch provider {
		case "BINANCE":
			if !strings.HasSuffix(providerSymbol, "USDT") && !strings.Contains(providerSymbol, "/") && quoteCurrency == "USD" {
				providerSymbol += "USDT"
				quoteCurrency = "USDT"
			}
		case "TWELVEDATA":
			if !strings.Contains(providerSymbol, "/") {
				providerSymbol += "/" + quoteCurrency
			}
		}
	}

	providerAssetID := providerSymbol

	if instrument.ProviderExternalID != nil && strings.EqualFold(instrument.ProviderSource, provider) {
		providerAssetID = strings.TrimSpace(*instrument.ProviderExternalID)
	}

	return providerAssetID, ptrString(providerSymbol), ptrString(providerMarket), ptrString(quoteCurrency)
}

func normalizeInstrumentText(value string) string {
	trimmed := strings.TrimSpace(strings.ToUpper(value))
	return strings.Join(strings.Fields(trimmed), " ")
}

func normalizeInstrumentName(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	return strings.Join(strings.Fields(trimmed), " ")
}

func normalizePlatforms(platforms map[string]string) map[string]string {
	if len(platforms) == 0 {
		return nil
	}
	normalized := make(map[string]string, len(platforms))
	for chain, contract := range platforms {
		chainName := strings.TrimSpace(strings.ToLower(chain))
		address := strings.TrimSpace(contract)
		if chainName == "" || address == "" {
			continue
		}
		normalized[chainName] = address
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func marshalPlatforms(platforms map[string]string) json.RawMessage {
	normalized := normalizePlatforms(platforms)
	if len(normalized) == 0 {
		return nil
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return nil
	}
	return payload
}

func parsePlatformsJSON(payload json.RawMessage) map[string]string {
	if len(payload) == 0 {
		return nil
	}
	var platforms map[string]string
	if err := json.Unmarshal(payload, &platforms); err != nil {
		return nil
	}
	return normalizePlatforms(platforms)
}

func derivePrimaryContractAddress(platforms map[string]string) *string {
	if len(platforms) == 0 {
		return nil
	}
	preferred := []string{"ethereum", "binance-smart-chain", "polygon-pos", "arbitrum-one", "optimistic-ethereum", "solana", "avalanche"}
	for _, chain := range preferred {
		if address, ok := platforms[chain]; ok && strings.TrimSpace(address) != "" {
			return ptrString(address)
		}
	}
	for _, address := range platforms {
		if strings.TrimSpace(address) != "" {
			return ptrString(address)
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func ptrString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	return &trimmed
}

func firstNonEmptyPtr(values ...string) *string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			trimmed := strings.TrimSpace(value)
			return &trimmed
		}
	}
	return nil
}

func intPtrIfPositive(value int) *int {
	if value <= 0 {
		return nil
	}
	v := value
	return &v
}
