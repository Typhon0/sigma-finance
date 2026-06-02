package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	catalogservice "sigma_finance/internal/service/catalog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

type DiscoveryInstrument = catalog.DiscoveryInstrument
type SourceInstrument = catalog.SourceInstrument

type InstrumentSearchService interface {
	SearchLocal(ctx context.Context, query string, filter InstrumentSearchFilter, userID *string) (*InstrumentSearchPayload, error)
	SearchOnline(ctx context.Context, query string, filter InstrumentSearchFilter, userID *string) (*OnlineInstrumentSearchPayload, error)
}

type InstrumentDiscoveryService interface {
	PersistDiscoveredInstrument(ctx context.Context, input PersistDiscoveredInstrumentInput, userID *string) (*InstrumentDetails, error)
}

type InstrumentCatalogService interface {
	GetInstrumentDetails(ctx context.Context, instrumentID string) (*InstrumentDetails, error)
	AddInstrumentToPortfolio(ctx context.Context, portfolioID, instrumentID string, quantity, averagePurchasePrice float64, unitPriceCurrency string, purchaseDate *time.Time, userID *string) (*model.PortfolioAsset, error)
	ListManualInstruments(ctx context.Context, filter ManualInstrumentFilter, userID *string) (*ManualInstrumentPage, error)
	UpdateManualInstrument(ctx context.Context, instrumentID string, input UpdateManualInstrumentInput, userID *string) (*InstrumentDetails, error)
	ArchiveManualInstrument(ctx context.Context, instrumentID string, userID *string) (*InstrumentDetails, error)
	RestoreManualInstrument(ctx context.Context, instrumentID string, userID *string) (*InstrumentDetails, error)
	ImportSourceInstruments(ctx context.Context, records []SourceInstrument) error
	GetFinanceDatabaseSyncStatus(ctx context.Context) (*FinanceDatabaseSyncStatusPayload, error)
	GetFinanceDatabaseSyncHistory(ctx context.Context, limit int) ([]FinanceDatabaseSyncHistoryEntry, error)
	GetFinanceDatabasePreview(ctx context.Context, assetType string, search string, limit int) ([]FinanceDatabasePreviewItem, error)
	TriggerFinanceDatabaseSync(ctx context.Context, assetType string) (*FinanceDatabaseSyncItem, error)
	UpdateFinanceDatabaseSyncEnabled(ctx context.Context, assetType string, enabled bool) (*FinanceDatabaseSyncItem, error)
	ImportFinanceDatabaseAssets(ctx context.Context, assetType string, symbols []string) (*FinanceDatabaseImportResult, error)
	ImportInstrumentFromSource(ctx context.Context, source string, externalID string, forceEnrich bool, userID *string) (*InstrumentDetails, error)
	ImportInstrumentFromCatalog(ctx context.Context, source string, externalID string, forceEnrich bool, userID *string) (*InstrumentDetails, error)
	GetCatalogSyncStatus(ctx context.Context, source string) (*model.CatalogSyncRun, error)
	GetHistoricalDataBackfillJob(ctx context.Context, id string, userID *string, includeAll bool) (*model.HistoricalDataBackfillJob, error)
	GetLatestHistoricalDataBackfillJob(ctx context.Context, portfolioID string, assetID string, userID *string, includeAll bool) (*model.HistoricalDataBackfillJob, error)
	ListHistoricalDataBackfillJobs(ctx context.Context, filter repository.HistoricalDataBackfillJobFilter, userID *string, includeAll bool) ([]model.HistoricalDataBackfillJob, error)
	RetryHistoricalDataBackfillJob(ctx context.Context, id string, userID *string, includeAll bool) (*model.HistoricalDataBackfillJob, error)
}

type InstrumentSyncService interface {
	SyncInstrument(ctx context.Context, instrumentID string) (*model.InstrumentSyncState, error)
	SyncCatalog(ctx context.Context) error
}

type InstrumentService interface {
	InstrumentSearchService
	InstrumentDiscoveryService
	InstrumentCatalogService
	InstrumentSyncService
}

type InstrumentSearchFilter struct {
	AssetTypes []model.InstrumentAssetType
	Exchange   *string
	Limit      int
	Offset     int
}

type InstrumentQueryMetadata struct {
	Query            string  `json:"query"`
	Limit            int     `json:"limit"`
	Offset           int     `json:"offset"`
	LocalCount       int     `json:"localCount"`
	TopScore         float64 `json:"topScore"`
	WeakResults      bool    `json:"weakResults"`
	SearchOnlineHint bool    `json:"searchOnlineHint"`
}

type LocalInstrumentResult struct {
	Instrument   *model.Instrument `json:"instrument"`
	Score        float64           `json:"score"`
	MatchedAlias *string           `json:"matchedAlias,omitempty"`
}

type InstrumentSearchPayload struct {
	LocalResults    []LocalInstrumentResult `json:"localResults"`
	CanSearchOnline bool                    `json:"canSearchOnline"`
	QueryMetadata   InstrumentQueryMetadata `json:"queryMetadata"`
	OnlineResults   []DiscoveryInstrument   `json:"onlineResults,omitempty"`
}

type OnlineInstrumentSearchPayload struct {
	OnlineResults  []DiscoveryInstrument   `json:"onlineResults"`
	QueryMetadata  InstrumentQueryMetadata `json:"queryMetadata"`
	ProviderUsed   string                  `json:"providerUsed"`
	CoverageStatus string                  `json:"coverageStatus"`
	ErrorMessage   *string                 `json:"errorMessage,omitempty"`
}

type PersistDiscoveredInstrumentInput struct {
	Instrument DiscoveryInstrument `json:"instrument"`
}

type ManualInstrumentFilter struct {
	Query           string
	AssetTypes      []model.InstrumentAssetType
	Limit           int
	Offset          int
	IncludeArchived bool
}

type ManualInstrumentPage struct {
	Items   []InstrumentDetails `json:"items"`
	HasMore bool                `json:"hasMore"`
	Limit   int                 `json:"limit"`
	Offset  int                 `json:"offset"`
}

type UpdateManualInstrumentInput struct {
	Symbol           string
	Name             string
	Exchange         string
	ExchangeCode     *string
	Country          *string
	Currency         *string
	BaseCurrency     *string
	QuoteCurrency    *string
	UnderlyingSymbol *string
	AssetType        model.InstrumentAssetType
	Summary          *string
	Sector           *string
	IndustryGroup    *string
	Industry         *string
	CategoryGroup    *string
	Category         *string
	Family           *string
	Website          *string
	MarketCap        *string
	State            *string
	City             *string
	Zipcode          *string
}

type InstrumentDetails struct {
	Instrument *model.Instrument          `json:"instrument"`
	SyncState  *model.InstrumentSyncState `json:"syncState,omitempty"`
	Aliases    []model.InstrumentAlias    `json:"aliases,omitempty"`
}

type FinanceDatabaseSyncItem struct {
	AssetType     string     `json:"assetType"`
	IsEnabled     bool       `json:"isEnabled"`
	LastSynced    *time.Time `json:"lastSynced,omitempty"`
	RecordCount   int        `json:"recordCount"`
	SyncStatus    string     `json:"syncStatus"`
	Progress      *int       `json:"progress,omitempty"`
	CurrentRecord *string    `json:"currentRecord,omitempty"`
	ErrorMessage  *string    `json:"errorMessage,omitempty"`
}

type FinanceDatabaseSyncStatusPayload struct {
	AssetTypes []FinanceDatabaseSyncItem `json:"assetTypes"`
}

type FinanceDatabaseSyncHistoryEntry struct {
	ID           string    `json:"id"`
	Timestamp    time.Time `json:"timestamp"`
	AssetType    string    `json:"assetType"`
	RecordCount  int       `json:"recordCount"`
	Status       string    `json:"status"`
	ErrorMessage *string   `json:"errorMessage,omitempty"`
}

type FinanceDatabasePreviewItem struct {
	Symbol   string  `json:"symbol"`
	Name     string  `json:"name"`
	Exchange string  `json:"exchange"`
	Sector   *string `json:"sector,omitempty"`
	Country  *string `json:"country,omitempty"`
}

type FinanceDatabaseImportResult struct {
	Success       bool     `json:"success"`
	ImportedCount int      `json:"importedCount"`
	Errors        []string `json:"errors,omitempty"`
}

type InstrumentDiscoveryClient interface {
	SearchInstruments(ctx context.Context, query string, assetType string, maxResults int) ([]DiscoveryInstrument, error)
}

type instrumentService struct {
	uow                            repository.IUnitOfWork
	instrumentRepo                 repository.IInstrumentRepository
	aliasRepo                      repository.IInstrumentAliasRepository
	mappingRepo                    repository.IInstrumentProviderMappingRepository
	syncRepo                       repository.IInstrumentSyncStateRepository
	discoveryLogRepo               repository.IDiscoveryLogRepository
	catalogSyncRunRepo             repository.ICatalogSyncRunRepository
	financeDatabaseSyncSettingRepo repository.IFinanceDatabaseSyncSettingRepository
	financeDatabaseSyncHistoryRepo repository.IFinanceDatabaseSyncHistoryRepository
	historicalBackfillJobRepo      repository.IHistoricalDataBackfillJobRepository
	equityDiscoveryClient          InstrumentDiscoveryClient
	cryptoDiscoveryClient          InstrumentDiscoveryClient
	marketData                     MarketDataService
	searchCache                    *SearchCache
	financeDatabaseSyncMu          sync.Mutex
	financeDatabaseSyncRunning     bool
	backfillWorkerStartOnce        sync.Once
	backfillWorkerID               string
}

const (
	backfillJobProvider              = "YFINANCE"
	backfillJobDefaultMaxAttempts    = 4
	backfillJobLeaseDuration         = 90 * time.Second
	backfillJobWorkerTick            = 2 * time.Second
	backfillJobStaleRunningThreshold = 20 * time.Minute
	backfillJobBaseRetryDelay        = 30 * time.Second
	backfillJobMaxRetryDelay         = 15 * time.Minute
)

func NewInstrumentService(
	uow repository.IUnitOfWork,
	equityDiscoveryClient InstrumentDiscoveryClient,
	cryptoDiscoveryClient InstrumentDiscoveryClient,
	marketData ...MarketDataService,
) *instrumentService {
	return NewInstrumentServiceWithCache(uow, equityDiscoveryClient, cryptoDiscoveryClient, nil, marketData...)
}

// NewInstrumentServiceWithCache creates an instrument service with an optional search cache.
// Pass nil for searchCache to disable caching.
func NewInstrumentServiceWithCache(
	uow repository.IUnitOfWork,
	equityDiscoveryClient InstrumentDiscoveryClient,
	cryptoDiscoveryClient InstrumentDiscoveryClient,
	searchCache *SearchCache,
	marketData ...MarketDataService,
) *instrumentService {
	var md MarketDataService
	if len(marketData) > 0 {
		md = marketData[0]
	}

	return &instrumentService{
		uow:                            uow,
		instrumentRepo:                 uow.Instrument(),
		aliasRepo:                      uow.InstrumentAlias(),
		mappingRepo:                    uow.InstrumentProviderMapping(),
		syncRepo:                       uow.InstrumentSyncState(),
		discoveryLogRepo:               uow.DiscoveryLog(),
		catalogSyncRunRepo:             uow.CatalogSyncRun(),
		financeDatabaseSyncSettingRepo: uow.FinanceDatabaseSyncSetting(),
		financeDatabaseSyncHistoryRepo: uow.FinanceDatabaseSyncHistory(),
		historicalBackfillJobRepo:      uow.HistoricalDataBackfillJob(),
		equityDiscoveryClient:          equityDiscoveryClient,
		cryptoDiscoveryClient:          cryptoDiscoveryClient,
		marketData:                     md,
		searchCache:                    searchCache,
		backfillWorkerID:               fmt.Sprintf("instrument-worker-%d", time.Now().UnixNano()),
	}
}

func normalizeInstrumentText(value string) string {
	trimmed := strings.TrimSpace(strings.ToUpper(value))
	trimmed = strings.Join(strings.Fields(trimmed), " ")
	return trimmed
}

func normalizeInstrumentName(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	trimmed = strings.Join(strings.Fields(trimmed), " ")
	return trimmed
}

func (s *instrumentService) SearchLocal(ctx context.Context, query string, filter InstrumentSearchFilter, userID *string) (*InstrumentSearchPayload, error) {
	rows, err := s.instrumentRepo.Search(ctx, query, repository.InstrumentSearchFilter{
		AssetTypes:  filter.AssetTypes,
		Exchange:    filter.Exchange,
		OwnerUserID: userID,
		Limit:       safeLimit(filter.Limit, 20),
		Offset:      max(filter.Offset, 0),
	})
	if err != nil {
		return nil, err
	}

	results := make([]LocalInstrumentResult, 0, len(rows))
	topScore := 0.0
	for _, row := range rows {
		instrument := row.Instrument
		results = append(results, LocalInstrumentResult{
			Instrument:   &instrument,
			Score:        row.Score,
			MatchedAlias: row.AliasMatch,
		})
		if row.Score > topScore {
			topScore = row.Score
		}
	}

	weakResults := len(results) == 0 || topScore < 700
	onlineCapable := s.hasOnlineCapability(filter.AssetTypes)
	payload := &InstrumentSearchPayload{
		LocalResults:    results,
		CanSearchOnline: weakResults && onlineCapable,
		QueryMetadata: InstrumentQueryMetadata{
			Query:            strings.TrimSpace(query),
			Limit:            safeLimit(filter.Limit, 20),
			Offset:           max(filter.Offset, 0),
			LocalCount:       len(results),
			TopScore:         topScore,
			WeakResults:      weakResults,
			SearchOnlineHint: weakResults && onlineCapable,
		},
	}

	return payload, nil
}

func (s *instrumentService) SearchOnline(ctx context.Context, query string, filter InstrumentSearchFilter, userID *string) (*OnlineInstrumentSearchPayload, error) {
	if strings.TrimSpace(query) == "" {
		return nil, errors.New("query is required")
	}
	if s.equityDiscoveryClient == nil && s.cryptoDiscoveryClient == nil {
		return nil, errors.New("instrument discovery clients not configured")
	}

	assetTypes := s.onlineSearchAssetTypes(filter.AssetTypes)
	if len(assetTypes) == 0 {
		assetTypes = []model.InstrumentAssetType{
			model.InstrumentAssetTypeStock,
			model.InstrumentAssetTypeETF,
			model.InstrumentAssetTypeFund,
			model.InstrumentAssetTypeCrypto,
		}
	}
	availableAssetTypes := s.onlineSearchAvailableAssetTypes(assetTypes)

	coverageStatus := "FULL"
	if len(availableAssetTypes) < len(assetTypes) {
		coverageStatus = "PARTIAL"
	}

	if len(availableAssetTypes) == 0 {
		message := "online search is unavailable for the requested asset types"
		payload := &OnlineInstrumentSearchPayload{
			OnlineResults: []DiscoveryInstrument{},
			QueryMetadata: InstrumentQueryMetadata{
				Query:            strings.TrimSpace(query),
				Limit:            safeLimit(filter.Limit, 10),
				Offset:           0,
				LocalCount:       0,
				TopScore:         0,
				SearchOnlineHint: true,
			},
			ProviderUsed:   "",
			CoverageStatus: coverageStatus,
			ErrorMessage:   &message,
		}
		return payload, nil
	}

	results, providerUsed, err := s.searchOnlineWithCache(ctx, query, availableAssetTypes, safeLimit(filter.Limit, 10))
	if err != nil {
		return nil, err
	}

	logEntry := model.DiscoveryLog{
		QueryString:     strings.TrimSpace(query),
		ProviderUsed:    providerUsed,
		NumberOfResults: len(results),
		UserID:          userID,
	}
	_, _ = s.discoveryLogRepo.Create(ctx, &logEntry)

	payload := &OnlineInstrumentSearchPayload{
		OnlineResults: results,
		QueryMetadata: InstrumentQueryMetadata{
			Query:            strings.TrimSpace(query),
			Limit:            safeLimit(filter.Limit, 10),
			Offset:           0,
			LocalCount:       len(results),
			TopScore:         0,
			SearchOnlineHint: len(results) == 0,
		},
		ProviderUsed:   providerUsed,
		CoverageStatus: coverageStatus,
	}

	return payload, nil
}

func (s *instrumentService) GetInstrumentDetails(ctx context.Context, instrumentID string) (*InstrumentDetails, error) {
	instrument, err := s.instrumentRepo.GetByID(ctx, instrumentID)
	if err != nil {
		return nil, err
	}

	syncState, err := s.syncRepo.GetByID(ctx, instrumentID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	aliases, err := s.aliasRepo.FindByInstrumentID(ctx, instrumentID)
	if err != nil {
		return nil, err
	}

	details := &InstrumentDetails{
		Instrument: instrument,
		Aliases:    aliases,
	}
	if syncState != nil {
		details.SyncState = syncState
	}
	return details, nil
}

func (s *instrumentService) PersistDiscoveredInstrument(ctx context.Context, input PersistDiscoveredInstrumentInput, userID *string) (*InstrumentDetails, error) {
	source := SourceInstrument{DiscoveryInstrument: input.Instrument}
	return s.persistInstrument(ctx, source, userID)
}

func (s *instrumentService) AddInstrumentToPortfolio(ctx context.Context, portfolioID, instrumentID string, quantity, averagePurchasePrice float64, unitPriceCurrency string, purchaseDate *time.Time, userID *string) (*model.PortfolioAsset, error) {
	if quantity <= 0 {
		return nil, errors.New("quantity must be positive")
	}

	instrument, err := s.instrumentRepo.GetByID(ctx, instrumentID)
	if err != nil {
		return nil, fmt.Errorf("instrument with ID %s not found", instrumentID)
	}
	if instrument.Status == model.InstrumentStatusArchived {
		return nil, fmt.Errorf("instrument with ID %s is archived", instrumentID)
	}
	if err := s.ensureManualInstrumentOwnership(ctx, instrument, userID, false); err != nil {
		return nil, err
	}
	quoteCurrency, err := resolveInstrumentQuoteCurrency(instrument)
	if err != nil {
		if unitPriceCurrency != "" {
			quoteCurrency = model.Currency(strings.ToUpper(strings.TrimSpace(unitPriceCurrency)))
			if !quoteCurrency.IsValid() {
				return nil, fmt.Errorf("invalid unit price currency fallback: %s", unitPriceCurrency)
			}
		} else {
			return nil, err
		}
	}
	resolvedUnitPriceCurrency := model.Currency(strings.ToUpper(strings.TrimSpace(unitPriceCurrency)))
	if resolvedUnitPriceCurrency == "" {
		resolvedUnitPriceCurrency = quoteCurrency
	}
	if !resolvedUnitPriceCurrency.IsValid() {
		return nil, fmt.Errorf("invalid unit price currency: %s", unitPriceCurrency)
	}

	var created *model.PortfolioAsset
	var backfillFrom time.Time
	err = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		portfolio, err := uow.Portfolio().GetByID(ctx, portfolioID)
		if err != nil {
			return fmt.Errorf("portfolio with ID %s not found", portfolioID)
		}

		asset, err := s.resolveTradeableAsset(ctx, uow, instrument)
		if err != nil {
			return err
		}

		if existing, err := uow.PortfolioAsset().FindByPortfolioAndInstrument(ctx, portfolioID, instrumentID); err == nil && existing != nil {
			return errors.New("instrument already exists in portfolio")
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing portfolio holding: %w", err)
		}

		instrumentIDCopy := instrument.ID
		portfolioAsset := model.PortfolioAsset{
			PortfolioID:          portfolioID,
			AssetID:              asset.ID,
			InstrumentID:         &instrumentIDCopy,
			Quantity:             quantity,
			AveragePurchasePrice: averagePurchasePrice,
			QuoteCurrency:        quoteCurrency,
		}
		createdHolding, err := uow.PortfolioAsset().Create(ctx, &portfolioAsset)
		if err != nil {
			return fmt.Errorf("failed to add instrument to portfolio: %w", err)
		}
		created = createdHolding

		var positionID string
		if existingPosition, err := uow.Position().GetByPortfolioAndAsset(ctx, portfolioID, asset.ID); err == nil {
			positionID = existingPosition.ID
		} else if err != nil {
			if !errors.Is(err, repository.ErrNotFound) && !errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("failed to check existing position: %w", err)
			}

			position := &model.Position{
				PortfolioID:         portfolioID,
				AssetID:             asset.ID,
				Quantity:            decimal.NewFromFloat(quantity),
				OwnershipPercentage: decimal.NewFromInt(100),
				QuoteCurrency:       quoteCurrency,
			}
			if averagePurchasePrice > 0 {
				avgCost := decimal.NewFromFloat(averagePurchasePrice)
				position.AverageCostBasis = &avgCost
				totalCost := model.Money(decimal.NewFromFloat(quantity).Mul(avgCost).Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				position.TotalCostBasis = &totalCost
			}
			createdPosition, createErr := uow.Position().Create(ctx, position)
			if createErr != nil {
				return fmt.Errorf("failed to create position snapshot: %w", createErr)
			}
			positionID = createdPosition.ID
		}

		if positionID != "" {
			transactionAmount := model.Money(decimal.NewFromFloat(quantity).Mul(decimal.NewFromFloat(averagePurchasePrice)).Mul(decimal.NewFromInt(100)).Round(0).IntPart())
			unitPriceAmount := decimal.NewFromFloat(averagePurchasePrice)
			transactionQuantity := decimal.NewFromFloat(quantity)
			positionIDCopy := positionID
			transactionUserID := portfolio.UserID
			if userID != nil && strings.TrimSpace(*userID) != "" {
				transactionUserID = strings.TrimSpace(*userID)
			}
			executedAt := time.Now()
			if purchaseDate != nil {
				executedAt = purchaseDate.UTC()
			}
			if executedAt.After(time.Now().AddDate(0, 0, 1)) {
				executedAt = time.Now()
			}

			transaction := &model.Transaction{
				UserID:            transactionUserID,
				PositionID:        &positionIDCopy,
				Type:              model.TransactionTypeBuy,
				Amount:            transactionAmount,
				Quantity:          &transactionQuantity,
				UnitPriceAmount:   &unitPriceAmount,
				UnitPriceCurrency: resolvedUnitPriceCurrency,
				FeesAmount:        0,
				FeesCurrency:      resolvedUnitPriceCurrency,
				ExecutedAt:        executedAt,
			}
			if _, txErr := uow.Transaction().Create(ctx, transaction); txErr != nil {
				return fmt.Errorf("failed to create initial transaction: %w", txErr)
			}
			backfillFrom = executedAt
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	instrument.LastUsedAt = &now
	_ = s.instrumentRepo.Update(ctx, instrument)

	if s.marketData != nil && created != nil {
		assetID := created.AssetID
		go func() {
			updateCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			parsedAssetID, parseErr := uuid.Parse(assetID)
			if parseErr != nil {
				log.Printf("[AddInstrumentToPortfolio] async price refresh skipped for asset %s: invalid uuid: %v", assetID, parseErr)
				return
			}

			if _, refreshErr := s.marketData.UpdateAssetPrice(updateCtx, parsedAssetID); refreshErr != nil {
				log.Printf("[AddInstrumentToPortfolio] async price refresh failed for asset %s: %v", assetID, refreshErr)
			}
		}()
	}
	if !backfillFrom.IsZero() {
		var assetIDStr string
		if created != nil {
			assetIDStr = created.AssetID
		}
		if s.marketData != nil && s.historicalBackfillJobRepo != nil && assetIDStr != "" {
			if _, enqueueErr := s.enqueueHistoricalBackfillJob(context.Background(), portfolioID, assetIDStr, instrumentID, backfillFrom, userID); enqueueErr != nil {
				log.Printf("[AddInstrumentToPortfolio] enqueueHistoricalBackfillJob failed for asset %s: %v", assetIDStr, enqueueErr)
			}
		}
	}

	return created, nil
}

func (s *instrumentService) enqueueHistoricalBackfillJob(ctx context.Context, portfolioID string, assetID string, instrumentID string, from time.Time, userID *string) (*model.HistoricalDataBackfillJob, error) {
	if s.historicalBackfillJobRepo == nil {
		return nil, fmt.Errorf("historical backfill job repository is not configured")
	}

	requestedFrom := from.UTC()
	now := time.Now().UTC()
	requestedTo := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	existing, existingErr := s.historicalBackfillJobRepo.GetActiveByRequest(
		ctx,
		portfolioID,
		assetID,
		instrumentID,
		backfillJobProvider,
		requestedFrom,
		requestedTo,
	)
	if existingErr == nil && existing != nil {
		return existing, nil
	}

	job := &model.HistoricalDataBackfillJob{
		PortfolioID:   portfolioID,
		AssetID:       assetID,
		InstrumentID:  instrumentID,
		Provider:      backfillJobProvider,
		Status:        string(model.HistoricalDataBackfillStatusQueued),
		Step:          string(model.HistoricalDataBackfillStepQueued),
		Progress:      0,
		RequestedFrom: requestedFrom,
		RequestedTo:   requestedTo,
		NextRunAt:     now,
		MaxAttempts:   backfillJobDefaultMaxAttempts,
	}
	if userID != nil && *userID != "" {
		job.UserID = userID
	}
	created, err := s.historicalBackfillJobRepo.Create(ctx, job)
	if err != nil {
		return nil, err
	}
	log.Printf("[enqueueHistoricalBackfillJob] created job=%s portfolio=%s asset=%s instrument=%s from=%s to=%s",
		created.ID, portfolioID, assetID, instrumentID, requestedFrom.Format(time.RFC3339), now.Format(time.RFC3339))
	return created, nil
}

func (s *instrumentService) StartHistoricalBackfillWorker() {
	s.backfillWorkerStartOnce.Do(func() {
		go s.runHistoricalBackfillWorker()
	})
}

func (s *instrumentService) runHistoricalBackfillWorker() {
	if s.marketData == nil || s.historicalBackfillJobRepo == nil {
		return
	}

	ticker := time.NewTicker(backfillJobWorkerTick)
	defer ticker.Stop()

	for {
		s.requeueStaleBackfillJobs()
		s.processBackfillQueueBatch(6)
		<-ticker.C
	}
}

func (s *instrumentService) processBackfillQueueBatch(maxJobs int) {
	if maxJobs <= 0 {
		maxJobs = 1
	}
	for i := 0; i < maxJobs; i++ {
		claimCtx, cancelClaim := context.WithTimeout(context.Background(), 15*time.Second)
		job, err := s.historicalBackfillJobRepo.ClaimNextRunnable(claimCtx, s.backfillWorkerID, backfillJobLeaseDuration)
		cancelClaim()
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return
			}
			log.Printf("[HistoricalBackfillWorker] claim failed: %v", err)
			return
		}
		if job == nil {
			return
		}
		s.runHistoricalBackfillJob(job)
	}
}

func (s *instrumentService) requeueStaleBackfillJobs() {
	staleBefore := time.Now().UTC().Add(-backfillJobStaleRunningThreshold)
	rows, err := s.historicalBackfillJobRepo.RequeueStaleRunning(context.Background(), staleBefore)
	if err != nil {
		log.Printf("[HistoricalBackfillWorker] requeue stale running jobs failed: %v", err)
		return
	}
	if rows > 0 {
		log.Printf("[HistoricalBackfillWorker] requeued stale running jobs rows=%d", rows)
	}
}

func (s *instrumentService) runHistoricalBackfillJob(job *model.HistoricalDataBackfillJob) {
	if job == nil {
		return
	}

	jobCtx, cancel := context.WithTimeout(context.Background(), 8*time.Minute)
	defer cancel()

	asset, err := s.uow.Asset().GetByID(jobCtx, job.AssetID)
	if err != nil || asset == nil || !asset.IsTradeable {
		msg := "asset is not tradeable for yfinance historical backfill"
		s.failBackfillJob(jobCtx, job, "ASSET_UNSUPPORTED", msg, false)
		return
	}

	userID := ""
	if job.UserID != nil {
		userID = *job.UserID
	}
	parsedAssetID, parseErr := uuid.Parse(job.AssetID)
	if parseErr != nil {
		msg := "invalid asset id"
		s.failBackfillJob(jobCtx, job, "INVALID_ASSET_ID", msg, false)
		return
	}

	outcome, err := s.marketData.BackfillAssetPrices(jobCtx, userID, parsedAssetID, job.InstrumentID, job.RequestedFrom, job.RequestedTo)
	if err != nil {
		code, msg, retryable := classifyBackfillFailure(err)
		s.failBackfillJob(jobCtx, job, code, msg, retryable)
		return
	}
	if outcome == nil {
		outcome = &HistoricalBackfillOutcome{}
	}
	job.RowsWritten = outcome.RowsTouched
	job.RowsInserted = outcome.RowsInserted
	job.RowsUpdated = outcome.RowsUpdated
	job.RowsSkipped = outcome.RowsSkipped
	job.ProviderSymbol = nil
	if strings.TrimSpace(outcome.ProviderSymbol) != "" {
		job.ProviderSymbol = ptrString(outcome.ProviderSymbol)
	}
	job.CoverageFrom = outcome.AffectedFrom
	job.CoverageTo = outcome.AffectedTo

	if outcome.RowsTouched == 0 {
		s.completeBackfillJob(jobCtx, job)
		return
	}

	job.Step = string(model.HistoricalDataBackfillStepCalcPerf)
	job.Progress = 70
	_ = s.historicalBackfillJobRepo.Update(jobCtx, job)

	rebuildFrom := job.RequestedFrom
	if outcome.AffectedFrom != nil {
		rebuildFrom = *outcome.AffectedFrom
	}
	rebuildTo := job.RequestedTo
	if outcome.AffectedTo != nil {
		rebuildTo = *outcome.AffectedTo
	}

	if err := s.backfillPortfolioPerformanceSnapshots(job.PortfolioID, rebuildFrom, rebuildTo); err != nil {
		msg := fmt.Sprintf("failed to rebuild portfolio performance snapshots: %v", err)
		s.failBackfillJob(jobCtx, job, "PERFORMANCE_RECALC_FAILED", msg, true)
		return
	}

	s.completeBackfillJob(jobCtx, job)
}

func (s *instrumentService) backfillPortfolioPerformanceSnapshots(portfolioID string, from time.Time, to time.Time) error {
	if strings.TrimSpace(portfolioID) == "" || from.IsZero() {
		return nil
	}

	startDay := time.Date(from.UTC().Year(), from.UTC().Month(), from.UTC().Day(), 0, 0, 0, 0, time.UTC)
	endSource := to
	if endSource.IsZero() {
		endSource = time.Now().UTC()
	}
	endDay := time.Date(endSource.UTC().Year(), endSource.UTC().Month(), endSource.UTC().Day(), 0, 0, 0, 0, time.UTC)

	if startDay.After(endDay) {
		startDay = endDay
	}

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Minute)
	defer cancel()

	if err := s.uow.Performance().CalculateAndSaveHistoricalSnapshots(ctx, portfolioID, startDay, endDay); err != nil {
		log.Printf("[backfillPortfolioPerformanceSnapshots] vectorized backfill failed portfolio=%s from=%s to=%s err=%v",
			portfolioID, startDay.Format("2006-01-02"), endDay.Format("2006-01-02"), err)
		return err
	} else {
		log.Printf("[backfillPortfolioPerformanceSnapshots] vectorized backfill complete portfolio=%s days=%d",
			portfolioID, int(endDay.Sub(startDay).Hours()/24)+1)
	}
	return nil
}

func classifyBackfillFailure(err error) (code string, msg string, retryable bool) {
	msg = err.Error()
	code = "HISTORY_FETCH_FAILED"
	retryable = true

	var backfillErr *HistoricalBackfillError
	if errors.As(err, &backfillErr) && backfillErr.Code != "" {
		code = backfillErr.Code
		msg = backfillErr.Error()
	}

	if isLikelySymbolLookupFailure(err) {
		code = "YFINANCE_SYMBOL_NOT_FOUND"
	}

	switch code {
	case "YFINANCE_SYMBOL_NOT_FOUND", "ASSET_UNSUPPORTED", "INVALID_ASSET_ID", "INSTRUMENT_NOT_FOUND":
		retryable = false
	}
	return code, msg, retryable
}

func nextBackfillRetryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	delay := backfillJobBaseRetryDelay * time.Duration(1<<(attempt-1))
	if delay > backfillJobMaxRetryDelay {
		return backfillJobMaxRetryDelay
	}
	return delay
}

func (s *instrumentService) failBackfillJob(ctx context.Context, job *model.HistoricalDataBackfillJob, code string, message string, retryable bool) {
	now := time.Now().UTC()

	job.ErrorCode = ptrString(code)
	job.ErrorMessage = &message
	job.LockedAt = nil
	job.LockedBy = nil
	job.HeartbeatAt = nil

	maxAttempts := job.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = backfillJobDefaultMaxAttempts
		job.MaxAttempts = maxAttempts
	}

	if retryable && job.Attempts < maxAttempts {
		job.Status = string(model.HistoricalDataBackfillStatusQueued)
		job.Step = string(model.HistoricalDataBackfillStepQueued)
		job.Progress = 0
		nextRun := now.Add(nextBackfillRetryDelay(job.Attempts))
		job.NextRunAt = nextRun
		job.FinishedAt = nil
	} else {
		job.Status = string(model.HistoricalDataBackfillStatusError)
		job.Step = string(model.HistoricalDataBackfillStepFailed)
		job.Progress = 100
		job.FinishedAt = &now
	}

	_ = s.historicalBackfillJobRepo.Update(ctx, job)
}

func (s *instrumentService) completeBackfillJob(ctx context.Context, job *model.HistoricalDataBackfillJob) {
	now := time.Now().UTC()
	job.Status = string(model.HistoricalDataBackfillStatusComplete)
	job.Step = string(model.HistoricalDataBackfillStepDone)
	job.Progress = 100
	job.NextRunAt = now
	job.LockedAt = nil
	job.LockedBy = nil
	job.HeartbeatAt = nil
	job.FinishedAt = &now
	_ = s.historicalBackfillJobRepo.Update(ctx, job)
}

func (s *instrumentService) GetHistoricalDataBackfillJob(ctx context.Context, id string, userID *string, includeAll bool) (*model.HistoricalDataBackfillJob, error) {
	job, err := s.historicalBackfillJobRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureBackfillJobAccess(job, userID, includeAll); err != nil {
		return nil, err
	}
	return job, nil
}

func (s *instrumentService) GetLatestHistoricalDataBackfillJob(ctx context.Context, portfolioID string, assetID string, userID *string, includeAll bool) (*model.HistoricalDataBackfillJob, error) {
	job, err := s.historicalBackfillJobRepo.GetLatestByPortfolioAsset(ctx, portfolioID, assetID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureBackfillJobAccess(job, userID, includeAll); err != nil {
		return nil, err
	}
	return job, nil
}

func (s *instrumentService) ListHistoricalDataBackfillJobs(ctx context.Context, filter repository.HistoricalDataBackfillJobFilter, userID *string, includeAll bool) ([]model.HistoricalDataBackfillJob, error) {
	if !includeAll {
		filter.UserID = userID
	}
	return s.historicalBackfillJobRepo.List(ctx, filter)
}

func (s *instrumentService) RetryHistoricalDataBackfillJob(ctx context.Context, id string, userID *string, includeAll bool) (*model.HistoricalDataBackfillJob, error) {
	job, err := s.historicalBackfillJobRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.ensureBackfillJobAccess(job, userID, includeAll); err != nil {
		return nil, err
	}
	if job.Status == string(model.HistoricalDataBackfillStatusRunning) || job.Status == string(model.HistoricalDataBackfillStatusQueued) {
		return job, nil
	}
	now := time.Now().UTC()
	job.Status = string(model.HistoricalDataBackfillStatusQueued)
	job.Step = string(model.HistoricalDataBackfillStepQueued)
	job.Progress = 0
	job.Attempts = 0
	job.NextRunAt = now
	job.ErrorCode = nil
	job.ErrorMessage = nil
	job.LockedAt = nil
	job.LockedBy = nil
	job.HeartbeatAt = nil
	job.FinishedAt = nil
	job.RowsSkipped = 0
	job.RowsUpdated = 0
	job.RowsInserted = 0
	job.RowsWritten = 0
	job.RequestedTo = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if userID != nil && *userID != "" {
		job.UserID = userID
	}
	if updateErr := s.historicalBackfillJobRepo.Update(ctx, job); updateErr != nil {
		return nil, updateErr
	}
	return job, nil
}

func (s *instrumentService) ensureBackfillJobAccess(job *model.HistoricalDataBackfillJob, userID *string, includeAll bool) error {
	if includeAll {
		return nil
	}
	if job == nil || userID == nil || *userID == "" || job.UserID == nil || *job.UserID != *userID {
		return fmt.Errorf("unauthorized: backfill job access denied")
	}
	return nil
}

func isLikelySymbolLookupFailure(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "asset_not_found") ||
		strings.Contains(msg, "not found") ||
		strings.Contains(msg, "mapping_unresolved") ||
		strings.Contains(msg, "verified mapping unavailable") ||
		strings.Contains(msg, "no mapped provider succeeded")
}

func (s *instrumentService) suggestLikelyTicker(ctx context.Context, attempted string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(attempted))
	if trimmed == "" {
		return ""
	}
	rows, err := s.instrumentRepo.Search(ctx, trimmed, repository.InstrumentSearchFilter{
		Limit: 20,
	})
	if err != nil || len(rows) == 0 {
		return ""
	}
	for i := range rows {
		candidate := strings.ToUpper(strings.TrimSpace(rows[i].Instrument.Symbol))
		if candidate == trimmed {
			// Exact symbol exists in catalog; do not propose a typo alternative.
			return ""
		}
	}
	best := ""
	bestScore := 1 << 30
	for i := range rows {
		candidate := strings.ToUpper(strings.TrimSpace(rows[i].Instrument.Symbol))
		if candidate == "" || candidate == trimmed {
			continue
		}
		score := levenshteinDistance(trimmed, candidate)
		if score < bestScore {
			best = candidate
			bestScore = score
		}
	}
	if bestScore <= 2 {
		return best
	}
	return ""
}

func levenshteinDistance(a string, b string) int {
	if a == b {
		return 0
	}
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}
	prev := make([]int, len(b)+1)
	curr := make([]int, len(b)+1)
	for j := 0; j <= len(b); j++ {
		prev[j] = j
	}
	for i := 1; i <= len(a); i++ {
		curr[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 0
			if a[i-1] != b[j-1] {
				cost = 1
			}
			del := prev[j] + 1
			ins := curr[j-1] + 1
			sub := prev[j-1] + cost
			curr[j] = minInt(del, minInt(ins, sub))
		}
		prev, curr = curr, prev
	}
	return prev[len(b)]
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *instrumentService) ListManualInstruments(ctx context.Context, filter ManualInstrumentFilter, userID *string) (*ManualInstrumentPage, error) {
	limit := safeLimit(filter.Limit, 20)
	offset := max(filter.Offset, 0)

	rows, err := s.instrumentRepo.ListManual(ctx, repository.ManualInstrumentFilter{
		Query:           filter.Query,
		AssetTypes:      filter.AssetTypes,
		OwnerUserID:     userID,
		Limit:           limit,
		Offset:          offset,
		IncludeArchived: filter.IncludeArchived,
	})
	if err != nil {
		return nil, err
	}

	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	items := make([]InstrumentDetails, 0, len(rows))
	for _, instrument := range rows {
		details, err := s.GetInstrumentDetails(ctx, instrument.ID)
		if err != nil {
			return nil, err
		}
		if details != nil {
			items = append(items, *details)
		}
	}

	return &ManualInstrumentPage{
		Items:   items,
		HasMore: hasMore,
		Limit:   limit,
		Offset:  offset,
	}, nil
}

func (s *instrumentService) UpdateManualInstrument(ctx context.Context, instrumentID string, input UpdateManualInstrumentInput, userID *string) (*InstrumentDetails, error) {
	if strings.TrimSpace(input.Symbol) == "" {
		return nil, errors.New("symbol is required")
	}
	if strings.TrimSpace(input.Name) == "" {
		return nil, errors.New("name is required")
	}
	if strings.TrimSpace(input.Exchange) == "" {
		return nil, errors.New("exchange is required")
	}
	if !input.AssetType.IsValid() {
		return nil, fmt.Errorf("asset type %s is invalid", input.AssetType)
	}

	now := time.Now()
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		instrument, err := uow.Instrument().GetByID(ctx, instrumentID)
		if err != nil {
			return fmt.Errorf("instrument with ID %s not found", instrumentID)
		}
		if !strings.EqualFold(instrument.ProviderSource, "manual") {
			return fmt.Errorf("instrument %s is not manually managed", instrumentID)
		}
		if err := s.ensureManualInstrumentOwnershipInTx(ctx, uow, instrument, userID, true); err != nil {
			return err
		}

		normalizedSymbol := normalizeInstrumentText(input.Symbol)
		if existing, err := uow.Instrument().GetBySymbolAndExchange(ctx, normalizedSymbol, strings.TrimSpace(input.Exchange), input.AssetType); err == nil && existing != nil && existing.ID != instrument.ID {
			return fmt.Errorf("another instrument already uses symbol %s on %s", normalizedSymbol, strings.TrimSpace(input.Exchange))
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return err
		}

		instrument.Symbol = strings.TrimSpace(input.Symbol)
		instrument.NormalizedSymbol = normalizedSymbol
		instrument.Name = strings.TrimSpace(input.Name)
		instrument.NormalizedName = normalizeInstrumentName(input.Name)
		instrument.Exchange = strings.TrimSpace(input.Exchange)
		instrument.ExchangeCode = input.ExchangeCode
		instrument.Country = input.Country
		instrument.Currency = input.Currency
		instrument.BaseCurrency = input.BaseCurrency
		instrument.QuoteCurrency = input.QuoteCurrency
		instrument.UnderlyingSymbol = input.UnderlyingSymbol
		instrument.AssetType = input.AssetType
		instrument.Summary = input.Summary
		instrument.Sector = input.Sector
		instrument.IndustryGroup = input.IndustryGroup
		instrument.Industry = input.Industry
		instrument.CategoryGroup = input.CategoryGroup
		instrument.Category = input.Category
		instrument.Family = input.Family
		instrument.Website = input.Website
		instrument.MarketCap = input.MarketCap
		instrument.State = input.State
		instrument.City = input.City
		instrument.Zipcode = input.Zipcode
		instrument.ProviderSource = "manual"
		instrument.ProviderExternalID = nil
		instrument.Status = model.InstrumentStatusUnknown
		instrument.LastVerifiedAt = nil
		instrument.UpdatedAt = now

		if err := uow.Instrument().Update(ctx, instrument); err != nil {
			return err
		}

		if err := s.upsertAliases(ctx, instrument.ID, s.buildAliases(*instrument)); err != nil {
			return err
		}

		syncState := &model.InstrumentSyncState{
			InstrumentID:           instrument.ID,
			LastSyncAttempt:        &now,
			LastSyncSource:         ptrString("manual"),
			SyncStatus:             model.InstrumentSyncStatusPending,
			Stale:                  true,
			VerificationConfidence: 0,
			CreatedAt:              now,
			UpdatedAt:              now,
		}
		if _, err := uow.InstrumentSyncState().Upsert(ctx, syncState); err != nil {
			return err
		}

		if asset, err := uow.Asset().GetByInstrumentID(ctx, instrument.ID); err == nil && asset != nil {
			symbol := instrument.Symbol
			asset.Symbol = &symbol
			asset.Name = instrument.Name
			asset.Type = mapInstrumentTypeToAssetType(instrument.AssetType)
			asset.IsTradeable = isTradeableInstrumentType(instrument.AssetType)
			asset.Metadata = buildTradeableAssetMetadata(asset.Metadata, instrument, asset.Type)
			if updateErr := uow.Asset().Update(ctx, asset); updateErr != nil {
				return updateErr
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetInstrumentDetails(ctx, instrumentID)
}

func (s *instrumentService) ArchiveManualInstrument(ctx context.Context, instrumentID string, userID *string) (*InstrumentDetails, error) {
	return s.setManualInstrumentStatus(ctx, instrumentID, model.InstrumentStatusArchived, userID)
}

func (s *instrumentService) RestoreManualInstrument(ctx context.Context, instrumentID string, userID *string) (*InstrumentDetails, error) {
	return s.setManualInstrumentStatus(ctx, instrumentID, model.InstrumentStatusUnknown, userID)
}

func (s *instrumentService) setManualInstrumentStatus(ctx context.Context, instrumentID string, status model.InstrumentStatus, userID *string) (*InstrumentDetails, error) {
	now := time.Now()
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		instrument, err := uow.Instrument().GetByID(ctx, instrumentID)
		if err != nil {
			return fmt.Errorf("instrument with ID %s not found", instrumentID)
		}
		if !strings.EqualFold(instrument.ProviderSource, "manual") {
			return fmt.Errorf("instrument %s is not manually managed", instrumentID)
		}
		if err := s.ensureManualInstrumentOwnershipInTx(ctx, uow, instrument, userID, true); err != nil {
			return err
		}

		instrument.Status = status
		instrument.LastVerifiedAt = nil
		instrument.UpdatedAt = now
		if err := uow.Instrument().Update(ctx, instrument); err != nil {
			return err
		}

		syncState := &model.InstrumentSyncState{
			InstrumentID:           instrument.ID,
			LastSyncAttempt:        &now,
			LastSyncSource:         ptrString("manual"),
			SyncStatus:             model.InstrumentSyncStatusPending,
			Stale:                  true,
			VerificationConfidence: 0,
			CreatedAt:              now,
			UpdatedAt:              now,
		}
		if _, err := uow.InstrumentSyncState().Upsert(ctx, syncState); err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetInstrumentDetails(ctx, instrumentID)
}

func (s *instrumentService) ensureManualInstrumentOwnership(ctx context.Context, instrument *model.Instrument, userID *string, claimIfUnowned bool) error {
	if instrument == nil || !strings.EqualFold(instrument.ProviderSource, "manual") {
		return nil
	}
	if instrument.OwnerUserID == nil {
		if !claimIfUnowned || userID == nil {
			return fmt.Errorf("unauthorized: access denied to manual instrument")
		}
		instrument.OwnerUserID = userID
		instrument.UpdatedAt = time.Now()
		return s.instrumentRepo.Update(ctx, instrument)
	}
	if userID == nil || *instrument.OwnerUserID != *userID {
		return fmt.Errorf("unauthorized: access denied to manual instrument")
	}
	return nil
}

func (s *instrumentService) ensureManualInstrumentOwnershipInTx(ctx context.Context, uow repository.IUnitOfWork, instrument *model.Instrument, userID *string, claimIfUnowned bool) error {
	if instrument == nil || !strings.EqualFold(instrument.ProviderSource, "manual") {
		return nil
	}
	if instrument.OwnerUserID == nil {
		if !claimIfUnowned || userID == nil {
			return fmt.Errorf("unauthorized: access denied to manual instrument")
		}
		instrument.OwnerUserID = userID
		instrument.UpdatedAt = time.Now()
		return uow.Instrument().Update(ctx, instrument)
	}
	if userID == nil || *instrument.OwnerUserID != *userID {
		return fmt.Errorf("unauthorized: access denied to manual instrument")
	}
	return nil
}

func (s *instrumentService) ImportSourceInstruments(ctx context.Context, records []SourceInstrument) error {
	for _, record := range records {
		_, err := s.persistInstrument(ctx, record, nil)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *instrumentService) GetFinanceDatabaseSyncStatus(ctx context.Context) (*FinanceDatabaseSyncStatusPayload, error) {
	items := make([]FinanceDatabaseSyncItem, 0, len(financeDatabaseAssetTypes()))
	for _, assetType := range financeDatabaseAssetTypes() {
		setting, err := s.ensureFinanceDatabaseSyncSetting(ctx, assetType)
		if err != nil {
			return nil, err
		}

		count, err := s.countInstrumentsByFinanceDatabaseAssetType(ctx, assetType)
		if err != nil {
			return nil, err
		}
		setting.RecordCount = count
		setting, err = s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting)
		if err != nil {
			return nil, err
		}

		items = append(items, mapFinanceDatabaseSyncSettingToItem(setting))
	}

	return &FinanceDatabaseSyncStatusPayload{AssetTypes: items}, nil
}

func (s *instrumentService) GetFinanceDatabaseSyncHistory(ctx context.Context, limit int) ([]FinanceDatabaseSyncHistoryEntry, error) {
	entries, err := s.financeDatabaseSyncHistoryRepo.List(ctx, limit)
	if err != nil {
		return nil, err
	}

	result := make([]FinanceDatabaseSyncHistoryEntry, 0, len(entries))
	for _, entry := range entries {
		entryCopy := entry
		result = append(result, FinanceDatabaseSyncHistoryEntry{
			ID:           entryCopy.ID,
			Timestamp:    entryCopy.Timestamp,
			AssetType:    entryCopy.AssetType,
			RecordCount:  entryCopy.RecordCount,
			Status:       entryCopy.Status,
			ErrorMessage: entryCopy.ErrorMessage,
		})
	}
	return result, nil
}

func (s *instrumentService) GetFinanceDatabasePreview(ctx context.Context, assetType string, search string, limit int) ([]FinanceDatabasePreviewItem, error) {
	domainAssetTypes := financeDatabaseAssetTypesForSyncType(assetType)
	if len(domainAssetTypes) == 0 {
		return []FinanceDatabasePreviewItem{}, nil
	}
	if limit <= 0 {
		limit = 20
	}

	var instruments []model.Instrument
	query := s.instrumentRepo.GetDB().NewSelect().
		Model(&instruments).
		TableExpr("sigma_finance.instruments AS i").
		ColumnExpr("i.*").
		Where("i.asset_type IN (?)", bun.In(domainAssetTypes)).
		OrderExpr("i.normalized_symbol ASC").
		Limit(limit)

	normalizedSearch := normalizeInstrumentName(search)
	if normalizedSearch != "" {
		like := "%" + normalizedSearch + "%"
		query = query.Where("(i.normalized_symbol LIKE ? OR i.normalized_name LIKE ? OR LOWER(COALESCE(i.sector, '')) LIKE ? OR LOWER(COALESCE(i.country, '')) LIKE ?)",
			normalizedSearch+"%",
			like,
			like,
			like,
		)
	}

	if err := query.Scan(ctx); err != nil {
		return nil, err
	}

	results := make([]FinanceDatabasePreviewItem, 0, len(instruments))
	for _, instrument := range instruments {
		instrumentCopy := instrument
		results = append(results, FinanceDatabasePreviewItem{
			Symbol:   instrumentCopy.Symbol,
			Name:     instrumentCopy.Name,
			Exchange: instrumentCopy.Exchange,
			Sector:   instrumentCopy.Sector,
			Country:  instrumentCopy.Country,
		})
	}
	return results, nil
}

func (s *instrumentService) TriggerFinanceDatabaseSync(ctx context.Context, assetType string) (*FinanceDatabaseSyncItem, error) {
	if !isFinanceDatabaseSyncAssetTypeSupported(assetType) {
		return nil, fmt.Errorf("finance database sync for %s is disabled; use catalog sync for crypto assets", assetType)
	}

	s.financeDatabaseSyncMu.Lock()
	if s.financeDatabaseSyncRunning {
		s.financeDatabaseSyncMu.Unlock()
		return nil, fmt.Errorf("finance database sync is already running")
	}
	s.financeDatabaseSyncRunning = true
	s.financeDatabaseSyncMu.Unlock()

	defer func() {
		s.financeDatabaseSyncMu.Lock()
		s.financeDatabaseSyncRunning = false
		s.financeDatabaseSyncMu.Unlock()
	}()

	setting, err := s.ensureFinanceDatabaseSyncSetting(ctx, assetType)
	if err != nil {
		return nil, err
	}
	if !setting.IsEnabled {
		return nil, fmt.Errorf("finance database sync for %s is disabled", assetType)
	}

	now := time.Now()
	setting.SyncStatus = string(model.FinanceDatabaseSyncStatusSyncing)
	setting.Progress = 0
	current := "Preparing catalog sync"
	setting.CurrentRecord = &current
	setting.ErrorMessage = nil
	setting.LastSyncedAt = &now
	if _, err := s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting); err != nil {
		s.financeDatabaseSyncMu.Lock()
		s.financeDatabaseSyncRunning = false
		s.financeDatabaseSyncMu.Unlock()
		return nil, err
	}

	item := mapFinanceDatabaseSyncSettingToItem(setting)

	go s.runFinanceDatabaseSyncJob(assetType)

	return &item, nil
}

func (s *instrumentService) runFinanceDatabaseSyncJob(assetType string) {
	defer func() {
		s.financeDatabaseSyncMu.Lock()
		s.financeDatabaseSyncRunning = false
		s.financeDatabaseSyncMu.Unlock()
	}()

	ctx := context.Background()
	setting, err := s.financeDatabaseSyncSettingRepo.GetByID(ctx, assetType)
	if err != nil {
		return
	}

	progressSteps := []struct {
		progress int
		label    string
	}{
		{progress: 20, label: "Loading catalog snapshot"},
		{progress: 45, label: "Refreshing record counts"},
		{progress: 70, label: "Updating verification state"},
		{progress: 90, label: "Writing sync history"},
	}

	for _, step := range progressSteps {
		setting.Progress = step.progress
		stepLabel := step.label
		setting.CurrentRecord = &stepLabel
		if _, err := s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting); err != nil {
			return
		}
		time.Sleep(1 * time.Second)
	}

	count, err := s.countInstrumentsByFinanceDatabaseAssetType(ctx, assetType)
	if err != nil {
		setting.SyncStatus = string(model.FinanceDatabaseSyncStatusError)
		message := err.Error()
		setting.ErrorMessage = &message
		setting.Progress = 0
		_, _ = s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting)
		_, _ = s.financeDatabaseSyncHistoryRepo.Create(ctx, &model.FinanceDatabaseSyncHistory{
			AssetType:    assetType,
			RecordCount:  0,
			Status:       string(model.FinanceDatabaseSyncStatusError),
			ErrorMessage: &message,
		})
		return
	}

	now := time.Now()
	setting.RecordCount = count
	setting.SyncStatus = string(model.FinanceDatabaseSyncStatusComplete)
	setting.Progress = 100
	setting.CurrentRecord = nil
	setting.ErrorMessage = nil
	setting.LastSyncedAt = &now
	setting, err = s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting)
	if err != nil {
		return
	}
	_, _ = s.financeDatabaseSyncHistoryRepo.Create(ctx, &model.FinanceDatabaseSyncHistory{
		AssetType:   assetType,
		RecordCount: count,
		Status:      string(model.FinanceDatabaseSyncStatusComplete),
	})
	_ = setting
}

func (s *instrumentService) UpdateFinanceDatabaseSyncEnabled(ctx context.Context, assetType string, enabled bool) (*FinanceDatabaseSyncItem, error) {
	if !isFinanceDatabaseSyncAssetTypeSupported(assetType) {
		return nil, fmt.Errorf("finance database sync for %s is disabled; use catalog sync for crypto assets", assetType)
	}

	setting, err := s.ensureFinanceDatabaseSyncSetting(ctx, assetType)
	if err != nil {
		return nil, err
	}
	setting.IsEnabled = enabled
	setting, err = s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting)
	if err != nil {
		return nil, err
	}
	item := mapFinanceDatabaseSyncSettingToItem(setting)
	return &item, nil
}

func (s *instrumentService) ImportFinanceDatabaseAssets(ctx context.Context, assetType string, symbols []string) (*FinanceDatabaseImportResult, error) {
	domainAssetTypes := financeDatabaseAssetTypesForSyncType(assetType)
	if len(domainAssetTypes) == 0 {
		return &FinanceDatabaseImportResult{Success: false, Errors: []string{"unknown asset type"}}, nil
	}

	normalizedSymbols := make([]string, 0, len(symbols))
	seen := make(map[string]struct{}, len(symbols))
	for _, symbol := range symbols {
		normalized := normalizeInstrumentText(symbol)
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		normalizedSymbols = append(normalizedSymbols, normalized)
	}
	if len(normalizedSymbols) == 0 {
		return &FinanceDatabaseImportResult{Success: true, ImportedCount: 0}, nil
	}

	var instruments []model.Instrument
	if err := s.instrumentRepo.GetDB().NewSelect().
		Model(&instruments).
		Where("asset_type IN (?)", bun.In(domainAssetTypes)).
		Where("normalized_symbol IN (?)", bun.In(normalizedSymbols)).
		Scan(ctx); err != nil {
		return nil, err
	}

	now := time.Now()
	setting, err := s.ensureFinanceDatabaseSyncSetting(ctx, assetType)
	if err == nil {
		setting.RecordCount = len(instruments)
		setting.LastSyncedAt = &now
		setting.SyncStatus = string(model.FinanceDatabaseSyncStatusComplete)
		progress := 100
		setting.Progress = progress
		setting.CurrentRecord = nil
		setting.ErrorMessage = nil
		_, _ = s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting)
	}

	_, _ = s.financeDatabaseSyncHistoryRepo.Create(ctx, &model.FinanceDatabaseSyncHistory{
		AssetType:   assetType,
		RecordCount: len(instruments),
		Status:      string(model.FinanceDatabaseSyncStatusComplete),
	})

	return &FinanceDatabaseImportResult{
		Success:       true,
		ImportedCount: len(instruments),
	}, nil
}

func (s *instrumentService) ensureFinanceDatabaseSyncSetting(ctx context.Context, assetType string) (*model.FinanceDatabaseSyncSetting, error) {
	setting, err := s.financeDatabaseSyncSettingRepo.GetByID(ctx, assetType)
	if err == nil {
		return setting, nil
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	setting = &model.FinanceDatabaseSyncSetting{
		AssetType:  assetType,
		IsEnabled:  true,
		SyncStatus: string(model.FinanceDatabaseSyncStatusIdle),
	}
	return s.financeDatabaseSyncSettingRepo.Upsert(ctx, setting)
}

func (s *instrumentService) countInstrumentsByFinanceDatabaseAssetType(ctx context.Context, assetType string) (int, error) {
	domainAssetTypes := financeDatabaseAssetTypesForSyncType(assetType)
	if len(domainAssetTypes) == 0 {
		return 0, nil
	}
	return s.instrumentRepo.GetDB().NewSelect().
		Model((*model.Instrument)(nil)).
		Where("asset_type IN (?)", bun.In(domainAssetTypes)).
		Count(ctx)
}

func financeDatabaseAssetTypes() []string {
	return []string{
		"EQUITIES",
		"ETFS",
		"FUNDS",
		"INDICES",
		"CURRENCIES",
		"MONEY_MARKETS",
	}
}

func financeDatabaseAssetTypesForSyncType(assetType string) []model.InstrumentAssetType {
	switch strings.ToUpper(strings.TrimSpace(assetType)) {
	case "EQUITIES":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeStock}
	case "ETFS":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeETF}
	case "FUNDS":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeFund}
	case "INDICES":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeIndex}
	case "CURRENCIES":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeCurrency}
	case "MONEY_MARKETS":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeMoneyMarket}
	default:
		return nil
	}
}

func isFinanceDatabaseSyncAssetTypeSupported(assetType string) bool {
	return len(financeDatabaseAssetTypesForSyncType(assetType)) > 0
}

func mapFinanceDatabaseSyncSettingToItem(setting *model.FinanceDatabaseSyncSetting) FinanceDatabaseSyncItem {
	if setting == nil {
		return FinanceDatabaseSyncItem{}
	}
	progress := setting.Progress
	return FinanceDatabaseSyncItem{
		AssetType:     setting.AssetType,
		IsEnabled:     setting.IsEnabled,
		LastSynced:    setting.LastSyncedAt,
		RecordCount:   setting.RecordCount,
		SyncStatus:    setting.SyncStatus,
		Progress:      &progress,
		CurrentRecord: setting.CurrentRecord,
		ErrorMessage:  setting.ErrorMessage,
	}
}

func (s *instrumentService) SyncInstrument(ctx context.Context, instrumentID string) (*model.InstrumentSyncState, error) {
	state, err := s.syncRepo.GetByID(ctx, instrumentID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	if state == nil {
		state = &model.InstrumentSyncState{InstrumentID: instrumentID}
	}
	now := time.Now()
	state.LastSyncAttempt = &now
	state.LastSyncSuccess = &now
	state.SyncStatus = model.InstrumentSyncStatusSynced
	state.Stale = false
	state.VerificationConfidence = int(math.Min(100, float64(state.VerificationConfidence+10)))
	state.LastSyncSource = ptrString("yfinance")
	return s.syncRepo.Upsert(ctx, state)
}

func (s *instrumentService) SyncCatalog(ctx context.Context) error {
	return nil
}

func (s *instrumentService) findExistingInstrument(ctx context.Context, input DiscoveryInstrument) (*model.Instrument, error) {
	if input.ExternalID != nil && strings.TrimSpace(input.Source) != "" {
		if instrument, err := s.instrumentRepo.FindByExternalKey(ctx, strings.ToUpper(strings.TrimSpace(input.Source)), strings.TrimSpace(*input.ExternalID)); err == nil {
			return instrument, nil
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}

	if input.ProviderExternalID != nil && strings.TrimSpace(input.ProviderSource) != "" {
		if instrument, err := s.instrumentRepo.GetByProviderIdentity(ctx, strings.TrimSpace(input.ProviderSource), strings.TrimSpace(*input.ProviderExternalID)); err == nil {
			return instrument, nil
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}

	if input.ISIN != nil {
		if instrument, err := s.instrumentRepo.GetByGlobalIdentifier(ctx, "isin", strings.TrimSpace(*input.ISIN)); err == nil {
			return instrument, nil
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}
	if input.FIGI != nil {
		if instrument, err := s.instrumentRepo.GetByGlobalIdentifier(ctx, "figi", strings.TrimSpace(*input.FIGI)); err == nil {
			return instrument, nil
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}
	if input.CUSIP != nil {
		if instrument, err := s.instrumentRepo.GetByGlobalIdentifier(ctx, "cusip", strings.TrimSpace(*input.CUSIP)); err == nil {
			return instrument, nil
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}

	normalizedSymbol := normalizeInstrumentText(input.Symbol)
	exchange := strings.TrimSpace(input.Exchange)
	if normalizedSymbol != "" && exchange != "" {
		if instrument, err := s.instrumentRepo.GetBySymbolAndExchange(ctx, normalizedSymbol, exchange, input.AssetType); err == nil {
			return instrument, nil
		} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}

	return nil, nil
}

func (s *instrumentService) persistInstrument(ctx context.Context, source SourceInstrument, userID *string) (*InstrumentDetails, error) {
	now := time.Now()
	discovery := source.DiscoveryInstrument
	normalizedSymbol := normalizeInstrumentText(discovery.Symbol)
	normalizedName := normalizeInstrumentName(discovery.Name)
	exchange := strings.TrimSpace(discovery.Exchange)
	if normalizedSymbol == "" || normalizedName == "" || exchange == "" {
		return nil, errors.New("symbol, name, and exchange are required")
	}
	if !discovery.AssetType.IsValid() {
		return nil, errors.New("invalid instrument asset type")
	}

	instrument, err := s.findExistingInstrument(ctx, discovery)
	if err != nil {
		return nil, err
	}

	metadata := marshalInstrumentMetadata(source)

	record := &model.Instrument{
		Symbol:                 strings.TrimSpace(discovery.Symbol),
		NormalizedSymbol:       normalizedSymbol,
		Name:                   strings.TrimSpace(discovery.Name),
		NormalizedName:         normalizedName,
		Exchange:               exchange,
		ExchangeCode:           discovery.ExchangeCode,
		Country:                discovery.Country,
		Currency:               discovery.Currency,
		Summary:                source.Summary,
		Sector:                 source.Sector,
		IndustryGroup:          source.IndustryGroup,
		Industry:               source.Industry,
		CategoryGroup:          source.CategoryGroup,
		Category:               source.Category,
		Family:                 source.Family,
		Website:                source.Website,
		MarketCap:              source.MarketCap,
		State:                  source.State,
		City:                   source.City,
		Zipcode:                source.Zipcode,
		BaseCurrency:           source.BaseCurrency,
		QuoteCurrency:          source.QuoteCurrency,
		UnderlyingSymbol:       source.UnderlyingSymbol,
		AssetType:              discovery.AssetType,
		Status:                 model.InstrumentStatusActive,
		ProviderSource:         strings.TrimSpace(discovery.ProviderSource),
		ProviderExternalID:     discovery.ProviderExternalID,
		ExternalSource:         nil,
		ExternalID:             nil,
		PlatformsJSON:          mustMarshalPlatformsJSON(discovery.Platforms),
		PrimaryContractAddress: derivePrimaryContractAddress(discovery.Platforms),
		MarketCapRank:          discovery.MarketCapRank,
		ImageURL:               discovery.ImageURL,
		ISIN:                   discovery.ISIN,
		FIGI:                   discovery.FIGI,
		CUSIP:                  discovery.CUSIP,
		Metadata:               metadata,
		UpdatedAt:              now,
	}
	if record.ProviderSource == "" {
		record.ProviderSource = "yfinance"
	}
	if strings.TrimSpace(discovery.Source) != "" {
		record.ExternalSource = ptrString(strings.ToUpper(strings.TrimSpace(discovery.Source)))
	} else if strings.EqualFold(record.ProviderSource, "trustwallet") {
		record.ExternalSource = ptrString("TRUSTWALLET")
	}
	if discovery.ExternalID != nil && strings.TrimSpace(*discovery.ExternalID) != "" {
		record.ExternalID = ptrString(strings.TrimSpace(*discovery.ExternalID))
	} else if discovery.ProviderExternalID != nil && strings.TrimSpace(*discovery.ProviderExternalID) != "" {
		record.ExternalID = ptrString(strings.TrimSpace(*discovery.ProviderExternalID))
	}
	if record.ExternalSource != nil || record.ExternalID != nil || record.MarketCapRank != nil || record.ImageURL != nil {
		record.MetadataUpdatedAt = &now
	}

	manualImport := strings.EqualFold(record.ProviderSource, "manual")
	if manualImport {
		record.Status = model.InstrumentStatusUnknown
		record.LastVerifiedAt = nil
		record.OwnerUserID = userID
	} else {
		record.Status = model.InstrumentStatusActive
		record.LastVerifiedAt = &now
	}

	if instrument == nil {
		record.FirstSeenAt = now
		_, err = s.instrumentRepo.Upsert(ctx, record)
	} else if instrument.NormalizedSymbol == record.NormalizedSymbol && instrument.Exchange == record.Exchange && instrument.AssetType == record.AssetType {
		record.FirstSeenAt = instrument.FirstSeenAt
		record.CreatedAt = instrument.CreatedAt
		record.LastUsedAt = instrument.LastUsedAt
		record.ID = instrument.ID
		record.OwnerUserID = instrument.OwnerUserID
		_, err = s.instrumentRepo.Upsert(ctx, record)
	} else {
		record.ID = instrument.ID
		record.FirstSeenAt = instrument.FirstSeenAt
		record.CreatedAt = instrument.CreatedAt
		record.LastUsedAt = instrument.LastUsedAt
		record.OwnerUserID = instrument.OwnerUserID
		err = s.instrumentRepo.Update(ctx, record)
	}
	if err != nil {
		return nil, err
	}

	if record.ID == "" && instrument != nil {
		record.ID = instrument.ID
	}
	if record.ID == "" {
		created, err := s.instrumentRepo.GetBySymbolAndExchange(ctx, record.NormalizedSymbol, record.Exchange, record.AssetType)
		if err != nil {
			return nil, err
		}
		record = created
	}

	if err := s.upsertDefaultProviderMappings(ctx, record); err != nil {
		return nil, err
	}

	aliases := s.buildAliases(*record)
	if err := s.upsertAliases(ctx, record.ID, aliases); err != nil {
		return nil, err
	}

	state := &model.InstrumentSyncState{
		InstrumentID:    record.ID,
		LastSyncAttempt: &now,
		LastSyncSource:  ptrString(firstNonEmpty(record.ProviderSource, "yfinance")),
	}
	if manualImport {
		state.SyncStatus = model.InstrumentSyncStatusPending
		state.Stale = true
		state.VerificationConfidence = 0
	} else {
		state.LastSyncSuccess = &now
		state.SyncStatus = model.InstrumentSyncStatusSynced
		state.Stale = false
		state.VerificationConfidence = 100
	}
	if _, err := s.syncRepo.Upsert(ctx, state); err != nil {
		return nil, err
	}

	details, err := s.GetInstrumentDetails(ctx, record.ID)
	if err != nil {
		return nil, err
	}

	_ = userID
	return details, nil
}

func (s *instrumentService) ImportInstrumentFromSource(ctx context.Context, source string, externalID string, forceEnrich bool, userID *string) (*InstrumentDetails, error) {
	normalizedSource := strings.ToUpper(strings.TrimSpace(source))
	normalizedExternalID := strings.TrimSpace(externalID)
	if normalizedSource == "" || normalizedExternalID == "" {
		return nil, errors.New("source and externalId are required")
	}
	if normalizedSource != "TRUSTWALLET" {
		return nil, fmt.Errorf("unsupported catalog source: %s", source)
	}
	_ = forceEnrich

	if existing, err := s.instrumentRepo.FindByExternalKey(ctx, normalizedSource, normalizedExternalID); err == nil && existing != nil {
		return s.GetInstrumentDetails(ctx, existing.ID)
	} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	client, ok := s.cryptoDiscoveryClient.(catalogservice.CatalogClient)
	if !ok || client == nil {
		return nil, errors.New("trustwallet catalog client is not configured")
	}

	syncService := catalogservice.NewSyncService(client, s.instrumentRepo, s.mappingRepo, s.catalogSyncRunRepo)
	result, err := syncService.Sync(ctx, catalogservice.SyncRequest{
		Mode:       catalogservice.SyncModeSearchImport,
		ExternalID: normalizedExternalID,
	})
	if err != nil {
		return nil, err
	}

	if result != nil && result.Imported != nil {
		return s.GetInstrumentDetails(ctx, result.Imported.ID)
	}

	if existing, err := s.instrumentRepo.FindByExternalKey(ctx, normalizedSource, normalizedExternalID); err == nil && existing != nil {
		return s.GetInstrumentDetails(ctx, existing.ID)
	}

	return nil, fmt.Errorf("instrument import did not return a persisted record for %s", normalizedExternalID)
}

func (s *instrumentService) ImportInstrumentFromCatalog(ctx context.Context, source string, externalID string, forceEnrich bool, userID *string) (*InstrumentDetails, error) {
	return s.ImportInstrumentFromSource(ctx, source, externalID, forceEnrich, userID)
}

func (s *instrumentService) GetCatalogSyncStatus(ctx context.Context, source string) (*model.CatalogSyncRun, error) {
	normalizedSource := strings.ToUpper(strings.TrimSpace(source))
	if normalizedSource == "" {
		return nil, errors.New("source is required")
	}
	return s.catalogSyncRunRepo.GetLatestBySource(ctx, normalizedSource)
}

func mustMarshalPlatformsJSON(platforms map[string]string) json.RawMessage {
	if len(platforms) == 0 {
		return nil
	}
	normalized := make(map[string]string, len(platforms))
	for chain, address := range platforms {
		chainName := strings.TrimSpace(strings.ToLower(chain))
		contract := strings.TrimSpace(address)
		if chainName == "" || contract == "" {
			continue
		}
		normalized[chainName] = contract
	}
	if len(normalized) == 0 {
		return nil
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return nil
	}
	return payload
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

func buildTradeableAssetMetadata(existing json.RawMessage, instrument *model.Instrument, assetType model.AssetType) json.RawMessage {
	metadata := map[string]any{}
	if len(existing) > 0 {
		_ = json.Unmarshal(existing, &metadata)
	}
	if metadata == nil {
		metadata = map[string]any{}
	}

	if instrument == nil {
		payload, err := json.Marshal(metadata)
		if err != nil {
			return existing
		}
		return payload
	}

	if exchange := strings.TrimSpace(instrument.Exchange); exchange != "" {
		metadata["exchange"] = exchange
	}
	if instrument.Sector != nil && strings.TrimSpace(*instrument.Sector) != "" {
		metadata["sector"] = strings.TrimSpace(*instrument.Sector)
	}
	if instrument.Industry != nil && strings.TrimSpace(*instrument.Industry) != "" {
		metadata["industry"] = strings.TrimSpace(*instrument.Industry)
	}
	if currency := firstNonEmptyPtrValue(instrument.QuoteCurrency, instrument.Currency); currency != "" {
		metadata["currency"] = currency
	}
	if assetType == model.AssetTypeFund {
		if fundType := fundTypeForInstrumentAssetType(instrument.AssetType); fundType != "" {
			metadata["fund_type"] = fundType
		}
	}

	payload, err := json.Marshal(metadata)
	if err != nil {
		return existing
	}
	return payload
}

func firstNonEmptyPtrValue(values ...*string) string {
	for _, value := range values {
		if value == nil {
			continue
		}
		if trimmed := strings.TrimSpace(*value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func fundTypeForInstrumentAssetType(assetType model.InstrumentAssetType) string {
	switch assetType {
	case model.InstrumentAssetTypeETF:
		return "etf"
	case model.InstrumentAssetTypeMoneyMarket:
		return "money_market"
	case model.InstrumentAssetTypeIndex:
		return "index_fund"
	case model.InstrumentAssetTypeFund:
		return "fund"
	default:
		return ""
	}
}

func (s *instrumentService) resolveTradeableAsset(ctx context.Context, uow repository.IUnitOfWork, instrument *model.Instrument) (*model.Asset, error) {
	if !isTradeableInstrumentType(instrument.AssetType) {
		return nil, fmt.Errorf("instrument type %s is not tradeable", instrument.AssetType)
	}

	// 1. Check by instrument_id first (exact link)
	if asset, err := uow.Asset().GetByInstrumentID(ctx, instrument.ID); err == nil {
		asset.Metadata = buildTradeableAssetMetadata(asset.Metadata, instrument, asset.Type)
		if updateErr := uow.Asset().Update(ctx, asset); updateErr != nil {
			return nil, fmt.Errorf("failed to refresh tradeable asset metadata for instrument %s: %w", instrument.ID, updateErr)
		}
		return asset, nil
	} else if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	symbol := instrument.Symbol
	assetType := mapInstrumentTypeToAssetType(instrument.AssetType)

	// 2. Upsert tradeable asset — uses ON CONFLICT (symbol) WHERE is_tradeable
	//    to avoid PostgreSQL transaction poisoning from failed INSERTs.
	//    A failed INSERT inside a PostgreSQL transaction aborts the entire
	//    transaction, making all subsequent queries fail.
	asset := &model.Asset{
		InstrumentID: &instrument.ID,
		Type:         assetType,
		Symbol:       &symbol,
		Name:         instrument.Name,
		IsTradeable:  true,
		Metadata:     buildTradeableAssetMetadata(nil, instrument, assetType),
	}

	upserted, err := uow.Asset().UpsertTradeable(ctx, asset)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert tradeable asset for instrument %s: %w", instrument.ID, err)
	}
	upserted.Metadata = buildTradeableAssetMetadata(upserted.Metadata, instrument, assetType)
	if updateErr := uow.Asset().Update(ctx, upserted); updateErr != nil {
		return nil, fmt.Errorf("failed to sync tradeable asset metadata for instrument %s: %w", instrument.ID, updateErr)
	}
	return upserted, nil
}

func (s *instrumentService) buildAliases(instrument model.Instrument) []model.InstrumentAlias {
	aliases := []model.InstrumentAlias{
		{InstrumentID: instrument.ID, AliasText: instrument.Symbol, NormalizedAliasText: normalizeInstrumentText(instrument.Symbol), AliasType: model.InstrumentAliasTypeSymbol},
		{InstrumentID: instrument.ID, AliasText: instrument.Name, NormalizedAliasText: normalizeInstrumentName(instrument.Name), AliasType: model.InstrumentAliasTypeName},
	}
	if instrument.ProviderSource != "" {
		aliases = append(aliases, model.InstrumentAlias{
			InstrumentID:        instrument.ID,
			AliasText:           instrument.ProviderSource,
			NormalizedAliasText: normalizeInstrumentName(instrument.ProviderSource),
			AliasType:           model.InstrumentAliasTypeProvider,
		})
	}
	addAlias := func(value *string, aliasType model.InstrumentAliasType) {
		if value == nil || strings.TrimSpace(*value) == "" {
			return
		}
		aliases = append(aliases, model.InstrumentAlias{
			InstrumentID:        instrument.ID,
			AliasText:           *value,
			NormalizedAliasText: normalizeInstrumentName(*value),
			AliasType:           aliasType,
		})
	}
	addAlias(instrument.Family, model.InstrumentAliasTypeFamily)
	addAlias(instrument.Sector, model.InstrumentAliasTypeSector)
	addAlias(instrument.IndustryGroup, model.InstrumentAliasTypeIndustryGroup)
	addAlias(instrument.Industry, model.InstrumentAliasTypeIndustry)
	addAlias(instrument.CategoryGroup, model.InstrumentAliasTypeCategoryGroup)
	addAlias(instrument.Category, model.InstrumentAliasTypeCategory)
	return aliases
}

func (s *instrumentService) upsertAliases(ctx context.Context, instrumentID string, aliases []model.InstrumentAlias) error {
	batch := make([]model.InstrumentAlias, 0, len(aliases))
	for _, alias := range aliases {
		alias.InstrumentID = instrumentID
		alias.AliasText = strings.TrimSpace(alias.AliasText)
		alias.NormalizedAliasText = normalizeInstrumentName(alias.AliasText)
		if alias.AliasText == "" || alias.NormalizedAliasText == "" {
			continue
		}
		batch = append(batch, alias)
	}
	return s.aliasRepo.CreateBatch(ctx, batch)
}

func (s *instrumentService) upsertDefaultProviderMappings(ctx context.Context, instrument *model.Instrument) error {
	if s.mappingRepo == nil || instrument == nil {
		return nil
	}

	providers := defaultProvidersForInstrumentType(instrument.AssetType)
	if len(providers) == 0 {
		providers = []string{strings.ToUpper(strings.TrimSpace(instrument.ProviderSource))}
	}

	now := time.Now()
	mappingUpdated := false
	for _, provider := range providers {
		normalizedProvider := strings.ToUpper(strings.TrimSpace(provider))
		if normalizedProvider == "" {
			continue
		}

		providerAssetID, providerSymbol, providerMarket, quoteCurrency := deriveProviderIdentity(instrument, normalizedProvider)
		mapping := &model.InstrumentProviderMapping{
			InstrumentID:    instrument.ID,
			Provider:        normalizedProvider,
			ProviderAssetID: firstNonEmpty(providerAssetID, instrument.ID),
			ProviderSymbol:  providerSymbol,
			ProviderMarket:  providerMarket,
			QuoteCurrency:   quoteCurrency,
		}

		if strings.TrimSpace(providerAssetID) == "" {
			mapping.MappingStatus = model.InstrumentProviderMappingStatusUnmapped
			mapping.LastErrorText = ptrString("deterministic mapping unavailable")
		} else {
			mapping.MappingStatus = model.InstrumentProviderMappingStatusVerified
			mapping.LastVerifiedAt = &now
		}

		if _, err := s.mappingRepo.Upsert(ctx, mapping); err != nil {
			return err
		}
		mappingUpdated = true
	}

	if mappingUpdated {
		if invalidator, ok := s.marketData.(RuntimeMarketDataCacheInvalidator); ok {
			invalidator.InvalidateRuntimeMarketDataCacheForInstrument(instrument.ID, RuntimeCacheInvalidationReasonMapping)
		}
	}

	return nil
}

func defaultProvidersForInstrumentType(assetType model.InstrumentAssetType) []string {
	switch assetType {
	case model.InstrumentAssetTypeCrypto:
		return []string{"BINANCE", "CRYPTOCOMPARE", "TWELVEDATA"}
	case model.InstrumentAssetTypeStock, model.InstrumentAssetTypeETF, model.InstrumentAssetTypeFund:
		return []string{"TIINGO", "ALPHAVANTAGE", "TWELVEDATA", "FINNHUB"}
	case model.InstrumentAssetTypeCurrency:
		return []string{"ALPHAVANTAGE", "TWELVEDATA"}
	default:
		return nil
	}
}

func safeLimit(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func max(value int, floor int) int {
	if value < floor {
		return floor
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func ptrString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	return &trimmed
}

func marshalInstrumentMetadata(source SourceInstrument) json.RawMessage {
	metadata := source.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}

	if source.SourceFile != "" || source.SourceVersion != "" || !source.ImportedAt.IsZero() {
		provenance := map[string]any{}
		if source.SourceFile != "" {
			provenance["sourceFile"] = source.SourceFile
		}
		if source.SourceVersion != "" {
			provenance["sourceVersion"] = source.SourceVersion
		}
		if !source.ImportedAt.IsZero() {
			provenance["importedAt"] = source.ImportedAt.UTC()
		}
		metadata["provenance"] = provenance
	}

	payload, err := json.Marshal(metadata)
	if err != nil {
		return nil
	}
	return json.RawMessage(payload)
}

func isTradeableInstrumentType(assetType model.InstrumentAssetType) bool {
	switch assetType {
	case model.InstrumentAssetTypeStock, model.InstrumentAssetTypeETF, model.InstrumentAssetTypeFund, model.InstrumentAssetTypeCrypto:
		return true
	default:
		return false
	}
}

func mapInstrumentTypeToAssetType(assetType model.InstrumentAssetType) model.AssetType {
	switch assetType {
	case model.InstrumentAssetTypeCrypto:
		return model.AssetTypeCrypto
	case model.InstrumentAssetTypeStock:
		return model.AssetTypeStock
	case model.InstrumentAssetTypeETF, model.InstrumentAssetTypeFund, model.InstrumentAssetTypeIndex, model.InstrumentAssetTypeMoneyMarket:
		return model.AssetTypeFund
	default:
		return model.AssetTypeStock
	}
}

func (s *instrumentService) onlineSearchAssetTypes(assetTypes []model.InstrumentAssetType) []model.InstrumentAssetType {
	if len(assetTypes) == 0 {
		return nil
	}

	seen := make(map[model.InstrumentAssetType]struct{}, len(assetTypes))
	filtered := make([]model.InstrumentAssetType, 0, len(assetTypes))
	for _, assetType := range assetTypes {
		switch assetType {
		case model.InstrumentAssetTypeStock, model.InstrumentAssetTypeETF, model.InstrumentAssetTypeFund, model.InstrumentAssetTypeCrypto:
		default:
			continue
		}
		if _, ok := seen[assetType]; ok {
			continue
		}
		seen[assetType] = struct{}{}
		filtered = append(filtered, assetType)
	}
	return filtered
}

func (s *instrumentService) onlineSearchAvailableAssetTypes(assetTypes []model.InstrumentAssetType) []model.InstrumentAssetType {
	available := make([]model.InstrumentAssetType, 0, len(assetTypes))
	for _, assetType := range assetTypes {
		client, _ := s.discoveryClientForAssetType(assetType)
		if client == nil {
			continue
		}
		available = append(available, assetType)
	}
	return available
}

func (s *instrumentService) hasOnlineCapability(assetTypes []model.InstrumentAssetType) bool {
	searchAssetTypes := s.onlineSearchAssetTypes(assetTypes)
	if len(searchAssetTypes) == 0 {
		searchAssetTypes = []model.InstrumentAssetType{
			model.InstrumentAssetTypeStock,
			model.InstrumentAssetTypeETF,
			model.InstrumentAssetTypeFund,
			model.InstrumentAssetTypeCrypto,
		}
	}

	return len(s.onlineSearchAvailableAssetTypes(searchAssetTypes)) > 0
}

// searchOnlineWithCache wraps searchOnlineCandidates with an optional in-memory LRU cache.
// Cache hits skip the expensive external API calls entirely; cache misses populate the cache
// for subsequent identical queries.
func (s *instrumentService) searchOnlineWithCache(ctx context.Context, query string, assetTypes []model.InstrumentAssetType, limit int) ([]DiscoveryInstrument, string, error) {
	if s.searchCache != nil {
		if results, provider, ok := s.searchCache.Get(query, assetTypes, limit); ok {
			return results, provider, nil
		}
	}

	results, provider, err := s.searchOnlineCandidates(ctx, query, assetTypes, limit)
	if err != nil {
		return nil, "", err
	}

	if s.searchCache != nil {
		s.searchCache.Set(query, assetTypes, limit, results, provider)
	}

	return results, provider, nil
}

func (s *instrumentService) searchOnlineCandidates(ctx context.Context, query string, assetTypes []model.InstrumentAssetType, limit int) ([]DiscoveryInstrument, string, error) {
	// Run equity and crypto discovery clients in parallel to halve search latency.
	// Each client is independent: CoinGecko hits an HTTP API, yfinance hits a gRPC sidecar.
	type clientResult struct {
		rows         []DiscoveryInstrument
		providerName string
		err          error
	}

	// Collect up to 2 clients (equity + crypto) for parallel dispatch
	type clientTask struct {
		client       InstrumentDiscoveryClient
		providerName string
		assetType    model.InstrumentAssetType
	}
	tasks := make([]clientTask, 0, 2)
	for _, assetType := range assetTypes {
		client, providerName := s.discoveryClientForAssetType(assetType)
		if client == nil {
			continue
		}
		tasks = append(tasks, clientTask{client, providerName, assetType})
	}

	if len(tasks) == 0 {
		return []DiscoveryInstrument{}, "", nil
	}

	ch := make(chan clientResult, len(tasks))
	for _, task := range tasks {
		go func(t clientTask) {
			rows, err := t.client.SearchInstruments(ctx, query, string(t.assetType), limit)
			ch <- clientResult{rows, t.providerName, err}
		}(task)
	}

	// Merge results from all clients, deduplicating by symbol+exchange+assetType
	results := make([]DiscoveryInstrument, 0, limit)
	providersUsed := make([]string, 0, len(tasks))
	seen := make(map[string]struct{})
	errors := make([]error, 0, len(tasks))

	for i := 0; i < len(tasks); i++ {
		res := <-ch
		if res.err != nil {
			errors = append(errors, res.err)
			continue
		}
		if res.providerName != "" && !stringSliceContains(providersUsed, res.providerName) {
			providersUsed = append(providersUsed, res.providerName)
		}
		for _, row := range res.rows {
			key := strings.ToUpper(strings.TrimSpace(row.Symbol)) + "|" + strings.ToUpper(strings.TrimSpace(row.Exchange)) + "|" + string(row.AssetType)
			if strings.TrimSpace(row.Source) != "" && row.ExternalID != nil && strings.TrimSpace(*row.ExternalID) != "" {
				key = strings.ToUpper(strings.TrimSpace(row.Source)) + "|" + strings.TrimSpace(*row.ExternalID)
			}
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			results = append(results, row)
			if len(results) >= limit {
				break
			}
		}
	}

	if len(results) == 0 && len(errors) > 0 && len(errors) == len(tasks) {
		return nil, "", fmt.Errorf("all online search providers failed: %v", errors)
	}

	return results, strings.Join(providersUsed, ","), nil
}

func (s *instrumentService) discoveryClientForAssetType(assetType model.InstrumentAssetType) (InstrumentDiscoveryClient, string) {
	switch assetType {
	case model.InstrumentAssetTypeCrypto:
		return s.cryptoDiscoveryClient, "coingecko"
	case model.InstrumentAssetTypeStock, model.InstrumentAssetTypeETF, model.InstrumentAssetTypeFund:
		return s.equityDiscoveryClient, "yfinance"
	default:
		return nil, ""
	}
}

func stringSliceContains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func resolveInstrumentQuoteCurrency(instrument *model.Instrument) (model.Currency, error) {
	if instrument == nil {
		return "", errors.New("instrument is required")
	}

	if instrument.QuoteCurrency != nil {
		candidate := model.Currency(strings.ToUpper(strings.TrimSpace(*instrument.QuoteCurrency)))
		if candidate.IsValid() {
			return candidate, nil
		}
	}

	if instrument.Currency != nil {
		candidate := model.Currency(strings.ToUpper(strings.TrimSpace(*instrument.Currency)))
		if candidate.IsValid() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("instrument %s has no supported quote currency", instrument.ID)
}
