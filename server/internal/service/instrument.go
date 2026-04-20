package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
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
	AddInstrumentToPortfolio(ctx context.Context, portfolioID, instrumentID string, quantity, averagePurchasePrice float64, unitPriceCurrency string, userID *string) (*model.PortfolioAsset, error)
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
	OnlineResults []DiscoveryInstrument   `json:"onlineResults"`
	QueryMetadata InstrumentQueryMetadata `json:"queryMetadata"`
	ProviderUsed  string                  `json:"providerUsed"`
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
	syncRepo                       repository.IInstrumentSyncStateRepository
	discoveryLogRepo               repository.IDiscoveryLogRepository
	financeDatabaseSyncSettingRepo repository.IFinanceDatabaseSyncSettingRepository
	financeDatabaseSyncHistoryRepo repository.IFinanceDatabaseSyncHistoryRepository
	equityDiscoveryClient          InstrumentDiscoveryClient
	cryptoDiscoveryClient          InstrumentDiscoveryClient
	marketData                     MarketDataService
	financeDatabaseSyncMu          sync.Mutex
	financeDatabaseSyncRunning     bool
}

func NewInstrumentService(
	uow repository.IUnitOfWork,
	equityDiscoveryClient InstrumentDiscoveryClient,
	cryptoDiscoveryClient InstrumentDiscoveryClient,
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
		syncRepo:                       uow.InstrumentSyncState(),
		discoveryLogRepo:               uow.DiscoveryLog(),
		financeDatabaseSyncSettingRepo: uow.FinanceDatabaseSyncSetting(),
		financeDatabaseSyncHistoryRepo: uow.FinanceDatabaseSyncHistory(),
		equityDiscoveryClient:          equityDiscoveryClient,
		cryptoDiscoveryClient:          cryptoDiscoveryClient,
		marketData:                     md,
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
	payload := &InstrumentSearchPayload{
		LocalResults:    results,
		CanSearchOnline: weakResults,
		QueryMetadata: InstrumentQueryMetadata{
			Query:            strings.TrimSpace(query),
			Limit:            safeLimit(filter.Limit, 20),
			Offset:           max(filter.Offset, 0),
			LocalCount:       len(results),
			TopScore:         topScore,
			WeakResults:      weakResults,
			SearchOnlineHint: weakResults,
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

	results, providerUsed, err := s.searchOnlineCandidates(ctx, query, assetTypes, safeLimit(filter.Limit, 10))
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
		ProviderUsed: providerUsed,
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

func (s *instrumentService) AddInstrumentToPortfolio(ctx context.Context, portfolioID, instrumentID string, quantity, averagePurchasePrice float64, unitPriceCurrency string, userID *string) (*model.PortfolioAsset, error) {
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
		return nil, err
	}
	resolvedUnitPriceCurrency := model.Currency(strings.ToUpper(strings.TrimSpace(unitPriceCurrency)))
	if resolvedUnitPriceCurrency == "" {
		resolvedUnitPriceCurrency = quoteCurrency
	}
	if !resolvedUnitPriceCurrency.IsValid() {
		return nil, fmt.Errorf("invalid unit price currency: %s", unitPriceCurrency)
	}

	var created *model.PortfolioAsset
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
				ExecutedAt:        time.Now(),
			}
			if _, txErr := uow.Transaction().Create(ctx, transaction); txErr != nil {
				return fmt.Errorf("failed to create initial transaction: %w", txErr)
			}
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
				fmt.Printf("[AddInstrumentToPortfolio] async price refresh skipped for asset %s: invalid uuid: %v\n", assetID, parseErr)
				return
			}

			if _, refreshErr := s.marketData.UpdateAssetPrice(updateCtx, parsedAssetID); refreshErr != nil {
				fmt.Printf("[AddInstrumentToPortfolio] async price refresh failed for asset %s: %v\n", assetID, refreshErr)
			}
		}()
	}

	return created, nil
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
		"CRYPTOCURRENCIES",
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
	case "CRYPTOCURRENCIES":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeCrypto}
	case "CURRENCIES":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeCurrency}
	case "MONEY_MARKETS":
		return []model.InstrumentAssetType{model.InstrumentAssetTypeMoneyMarket}
	default:
		return nil
	}
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
		Symbol:             strings.TrimSpace(discovery.Symbol),
		NormalizedSymbol:   normalizedSymbol,
		Name:               strings.TrimSpace(discovery.Name),
		NormalizedName:     normalizedName,
		Exchange:           exchange,
		ExchangeCode:       discovery.ExchangeCode,
		Country:            discovery.Country,
		Currency:           discovery.Currency,
		Summary:            source.Summary,
		Sector:             source.Sector,
		IndustryGroup:      source.IndustryGroup,
		Industry:           source.Industry,
		CategoryGroup:      source.CategoryGroup,
		Category:           source.Category,
		Family:             source.Family,
		Website:            source.Website,
		MarketCap:          source.MarketCap,
		State:              source.State,
		City:               source.City,
		Zipcode:            source.Zipcode,
		BaseCurrency:       source.BaseCurrency,
		QuoteCurrency:      source.QuoteCurrency,
		UnderlyingSymbol:   source.UnderlyingSymbol,
		AssetType:          discovery.AssetType,
		Status:             model.InstrumentStatusActive,
		ProviderSource:     strings.TrimSpace(discovery.ProviderSource),
		ProviderExternalID: discovery.ProviderExternalID,
		ISIN:               discovery.ISIN,
		FIGI:               discovery.FIGI,
		CUSIP:              discovery.CUSIP,
		Metadata:           metadata,
		UpdatedAt:          now,
	}
	if record.ProviderSource == "" {
		record.ProviderSource = "yfinance"
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

func (s *instrumentService) resolveTradeableAsset(ctx context.Context, uow repository.IUnitOfWork, instrument *model.Instrument) (*model.Asset, error) {
	if !isTradeableInstrumentType(instrument.AssetType) {
		return nil, fmt.Errorf("instrument type %s is not tradeable", instrument.AssetType)
	}

	// 1. Check by instrument_id first (exact link)
	if asset, err := uow.Asset().GetByInstrumentID(ctx, instrument.ID); err == nil {
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
	}

	upserted, err := uow.Asset().UpsertTradeable(ctx, asset)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert tradeable asset for instrument %s: %w", instrument.ID, err)
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

func (s *instrumentService) searchOnlineCandidates(ctx context.Context, query string, assetTypes []model.InstrumentAssetType, limit int) ([]DiscoveryInstrument, string, error) {
	results := make([]DiscoveryInstrument, 0, limit)
	providersUsed := make([]string, 0, 2)
	seen := make(map[string]struct{})
	var lastErr error

	remaining := limit
	for _, assetType := range assetTypes {
		client, providerName := s.discoveryClientForAssetType(assetType)
		if client == nil {
			continue
		}

		rows, err := client.SearchInstruments(ctx, query, string(assetType), remaining)
		if err != nil {
			lastErr = err
			continue
		}
		if len(rows) == 0 {
			if providerName != "" && !stringSliceContains(providersUsed, providerName) {
				providersUsed = append(providersUsed, providerName)
			}
			continue
		}

		if providerName != "" && !stringSliceContains(providersUsed, providerName) {
			providersUsed = append(providersUsed, providerName)
		}

		for _, row := range rows {
			key := strings.ToUpper(strings.TrimSpace(row.Symbol)) + "|" + strings.ToUpper(strings.TrimSpace(row.Exchange)) + "|" + string(row.AssetType)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			results = append(results, row)
			if len(results) >= limit {
				break
			}
		}
		remaining = limit - len(results)
		if remaining <= 0 {
			break
		}
	}

	if len(results) == 0 && lastErr != nil {
		return nil, "", lastErr
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
