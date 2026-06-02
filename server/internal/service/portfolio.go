package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Portfolio-specific error types for better error handling and user experience
var (
	// ErrPortfolioNotFound indicates that a requested portfolio does not exist
	ErrPortfolioNotFound = errors.New("portfolio not found")

	// ErrPortfolioNameExists indicates that a portfolio with the same name already exists for the user
	ErrPortfolioNameExists = errors.New("portfolio with this name already exists for the user")

	// ErrPortfolioUnauthorized indicates that the user is not authorized to access the portfolio
	ErrPortfolioUnauthorized = errors.New("user not authorized to access this portfolio")

	// ErrPortfolioInvalidName indicates that the portfolio name is invalid
	ErrPortfolioInvalidName = errors.New("portfolio name is invalid")

	// ErrPortfolioInvalidInput indicates that the input provided is invalid
	ErrPortfolioInvalidInput = errors.New("invalid input provided")

	// ErrPortfolioHasPositions indicates that the portfolio contains positions and cannot be deleted
	ErrPortfolioHasPositions = errors.New("portfolio contains positions and cannot be deleted")
)

// IPortfolioService defines the interface for portfolio-related services.
type IPortfolioService interface {
	GetByID(ctx context.Context, id string) (*model.Portfolio, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error)
	CreatePortfolio(ctx context.Context, input CreatePortfolioInput) (*model.Portfolio, error)
	UpdatePortfolio(ctx context.Context, id string, input UpdatePortfolioInput) (*model.Portfolio, error)
	DeletePortfolio(ctx context.Context, id string) error
	AddAssetToPortfolio(ctx context.Context, portfolioID, assetID string, quantity float64, price float64) (*model.PortfolioAsset, error)
	UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID string, quantity float64, price float64) (*model.PortfolioAsset, error)
	RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID string) error
	TagPortfolio(ctx context.Context, portfolioID, tagID string) error
	UntagPortfolio(ctx context.Context, portfolioID, tagID string) error
	GetPortfolioAssets(ctx context.Context, portfolioID string) ([]model.PortfolioAsset, error)

	// Authorization and validation
	ValidatePortfolioOwnership(ctx context.Context, portfolioID string, userID string) error

	// Enhanced functionality
	DuplicatePortfolio(ctx context.Context, input DuplicatePortfolioInput) (*model.Portfolio, error)
	ReorderPortfolios(ctx context.Context, userID string, orders []PortfolioOrderInput) ([]model.Portfolio, error)
	GetPortfoliosByUser(ctx context.Context, userID string, orderBy string) ([]model.Portfolio, error)
	GetPortfolioAnalytics(ctx context.Context, portfolioID string, displayCurrency model.Currency) (*PortfolioValuation, error)
	GetPortfolioHistory(ctx context.Context, portfolioID string, period string) (PortfolioHistory, error)
	GetAssetAllocation(ctx context.Context, portfolioID string) ([]AssetAllocation, error)
	GetPerformanceVsBenchmark(ctx context.Context, portfolioID string, benchmarkSymbol string) (PerformanceBenchmark, error)
}

// PortfolioService is the concrete implementation of IPortfolioService.
type PortfolioService struct {
	uow              repository.IUnitOfWork
	valuationService IPortfolioValuationService
	marketData       MarketDataService
}

// NewPortfolioService is the constructor for PortfolioService.
// It takes the Unit of Work as its dependency, and optionally a PortfolioValuationService.
// If no valuationService is provided, a default one is created using FXRateService.
func NewPortfolioService(uow repository.IUnitOfWork, valuationService ...IPortfolioValuationService) *PortfolioService {
	var vs IPortfolioValuationService
	if len(valuationService) > 0 && valuationService[0] != nil {
		vs = valuationService[0]
	} else {
		// Create default valuation service with default FX rate service
		fxRateService := NewFXRateService(uow, 60) // 60 second cache TTL
		vs = NewPortfolioValuationService(uow, fxRateService)
	}
	return &PortfolioService{
		uow:              uow,
		valuationService: vs,
	}
}

func (s *PortfolioService) SetMarketDataService(marketData MarketDataService) {
	s.marketData = marketData
}

func (s *PortfolioService) triggerAssetPriceRefresh(asset *model.Asset) {
	if s.marketData == nil || asset == nil || !asset.IsTradeable {
		return
	}

	assetID, err := uuid.Parse(asset.ID)
	if err != nil {
		log.Printf("[PortfolioService] skipping async price refresh for asset %s: invalid uuid: %v", asset.ID, err)
		return
	}

	assetSymbol := ""
	if asset.Symbol != nil {
		assetSymbol = *asset.Symbol
	}

	go func(assetID uuid.UUID, assetSymbol, assetName string) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		if _, refreshErr := s.marketData.UpdateAssetPrice(ctx, assetID); refreshErr != nil {
			log.Printf("[PortfolioService] async price refresh failed for asset %s (%s): %v", assetName, assetSymbol, refreshErr)
		}
	}(assetID, assetSymbol, asset.Name)
}

// --- Input Validation Functions ---

// validatePortfolioName validates portfolio name according to business rules
func validatePortfolioName(name string) error {
	if name == "" {
		return fmt.Errorf("%w: portfolio name is required", ErrPortfolioInvalidName)
	}

	// Trim whitespace for validation
	trimmed := strings.TrimSpace(name)
	if len(trimmed) < 3 {
		return fmt.Errorf("%w: portfolio name must be at least 3 characters long", ErrPortfolioInvalidName)
	}

	if len(trimmed) > 100 {
		return fmt.Errorf("%w: portfolio name must be less than 100 characters", ErrPortfolioInvalidName)
	}

	// Check for invalid characters (basic validation)
	if strings.ContainsAny(trimmed, "<>\"'&") {
		return fmt.Errorf("%w: portfolio name contains invalid characters", ErrPortfolioInvalidName)
	}

	return nil
}

// validateUserID validates user ID format and presence
func validateUserID(userID string) error {
	if userID == "" {
		return fmt.Errorf("%w: user ID is required", ErrPortfolioInvalidInput)
	}

	// Trim whitespace
	trimmed := strings.TrimSpace(userID)
	if len(trimmed) == 0 {
		return fmt.Errorf("%w: user ID cannot be empty", ErrPortfolioInvalidInput)
	}

	return nil
}

// validateSortOrder validates sort order value
func validateSortOrder(sortOrder int) error {
	if sortOrder < 0 {
		return fmt.Errorf("%w: sort order must be non-negative", ErrPortfolioInvalidInput)
	}

	return nil
}

// validatePortfolioID validates portfolio ID (UUID as string)
func validatePortfolioID(id string) error {
	if id == "" {
		return fmt.Errorf("%w: portfolio ID cannot be empty", ErrPortfolioInvalidInput)
	}

	return nil
}

// ValidatePortfolioOwnership checks if a user owns a specific portfolio
// Returns ErrPortfolioNotFound if the portfolio doesn't exist
// Returns ErrPortfolioUnauthorized if the user doesn't own the portfolio
func (s *PortfolioService) ValidatePortfolioOwnership(ctx context.Context, portfolioID string, userID string) error {
	if err := validatePortfolioID(portfolioID); err != nil {
		return err
	}

	if err := validateUserID(userID); err != nil {
		return err
	}

	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrPortfolioNotFound
		}
		return fmt.Errorf("failed to retrieve portfolio for ownership validation: %w", err)
	}

	if portfolio.UserID != userID {
		return ErrPortfolioUnauthorized
	}

	return nil
}

// --- Input Structs for Service Methods (keeps method signatures clean) ---

type CreatePortfolioInput struct {
	UserID      string
	Name        string
	Description *string
}

type UpdatePortfolioInput struct {
	Name        *string
	Description *string
	SortOrder   *int
}

// DuplicatePortfolioInput represents the input for duplicating a portfolio
type DuplicatePortfolioInput struct {
	SourcePortfolioID string `validate:"required"`
	NewName           string `validate:"required,min=3,max=100"`
	Description       string `validate:"max=500"`
	CopyAssets        bool
}

// PortfolioOrderInput represents the input for reordering portfolios
type PortfolioOrderInput struct {
	PortfolioID string `validate:"required"`
	SortOrder   int    `validate:"min=0"`
}

// PortfolioAnalytics represents comprehensive portfolio performance metrics
type PortfolioAnalytics struct {
	PortfolioID          string             `json:"portfolioId"`
	TotalValue           float64            `json:"totalValue"`
	TotalCost            float64            `json:"totalCost"`
	TotalGainLoss        float64            `json:"totalGainLoss"`
	TotalGainLossPercent float64            `json:"totalGainLossPercent"`
	AssetAllocation      []AssetAllocation  `json:"assetAllocation"`
	RiskMetrics          RiskMetrics        `json:"riskMetrics"`
	PerformanceHistory   []PerformancePoint `json:"performanceHistory"`
}

// AssetAllocation represents the allocation of assets by type
type AssetAllocation struct {
	AssetType  string  `json:"assetType"`
	Value      float64 `json:"value"`
	Percentage float64 `json:"percentage"`
	Count      int     `json:"count"`
}

// RiskMetrics represents portfolio risk calculations
type RiskMetrics struct {
	Volatility      float64 `json:"volatility"`
	SharpeRatio     float64 `json:"sharpeRatio"`
	MaxDrawdown     float64 `json:"maxDrawdown"`
	Diversification float64 `json:"diversification"`
}

type PerformancePoint struct {
	Date  time.Time
	Value float64
}

type PortfolioHistory struct {
	PortfolioID string
	Period      string
	DataPoints  []PortfolioDataPoint
}

type PortfolioDataPoint struct {
	Date  time.Time
	Value float64
}

type PerformanceBenchmark struct {
	PortfolioID      string
	BenchmarkSymbol  string
	PortfolioReturn  float64
	BenchmarkReturn  float64
	Alpha            float64
	Beta             float64
	Correlation      float64
	PortfolioHistory []PortfolioDataPoint
	BenchmarkHistory []PortfolioDataPoint
}

// --- Method Implementations ---

// GetByID retrieves a single portfolio by its primary key.
// Returns ErrPortfolioNotFound if the portfolio doesn't exist.
func (s *PortfolioService) GetByID(ctx context.Context, id string) (*model.Portfolio, error) {
	// Input validation
	if err := validatePortfolioID(id); err != nil {
		return nil, err
	}

	portfolio, err := s.uow.Portfolio().GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrPortfolioNotFound
		}
		return nil, fmt.Errorf("failed to retrieve portfolio: %w", err)
	}

	return portfolio, nil
}

// FindAll retrieves a list of portfolios based on a dynamic set of query options.
// This method also passes the options directly to the repository layer.
func (s *PortfolioService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error) {
	return s.uow.Portfolio().FindAllBy(ctx, opts...)
}

// CreatePortfolio creates a new portfolio for a user, ensuring the operation is atomic.
// Returns ErrPortfolioNameExists if a portfolio with the same name already exists for the user.
func (s *PortfolioService) CreatePortfolio(ctx context.Context, input CreatePortfolioInput) (*model.Portfolio, error) {
	log.Printf("[PortfolioService] CreatePortfolio: started user=%s name=%s", input.UserID, input.Name)

	// Input validation
	if err := validateUserID(input.UserID); err != nil {
		log.Printf("[PortfolioService] CreatePortfolio: invalid user ID user=%s: %v", input.UserID, err)
		return nil, err
	}

	if err := validatePortfolioName(input.Name); err != nil {
		log.Printf("[PortfolioService] CreatePortfolio: invalid name user=%s name=%s: %v", input.UserID, input.Name, err)
		return nil, err
	}

	// Validate description length if provided
	if input.Description != nil && len(*input.Description) > 500 {
		return nil, fmt.Errorf("%w: description must be less than 500 characters", ErrPortfolioInvalidInput)
	}

	var portfolio *model.Portfolio

	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Check if a portfolio with the same name already exists for this user
		existing, err := uow.Portfolio().GetPortfolioByName(ctx, input.UserID, strings.TrimSpace(input.Name))
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check for existing portfolio: %w", err)
		}
		if existing != nil {
			return ErrPortfolioNameExists
		}

		// Get the highest sort order for the user's portfolios and add 1
		maxSortOrder, err := uow.Portfolio().GetMaxSortOrder(ctx, input.UserID)
		if err != nil {
			return fmt.Errorf("failed to get max sort order: %w", err)
		}

		var description string
		if input.Description != nil {
			description = strings.TrimSpace(*input.Description)
		}

		newPortfolio := model.Portfolio{
			UserID:      input.UserID,
			Name:        strings.TrimSpace(input.Name),
			Description: description,
			SortOrder:   maxSortOrder + 1,
		}

		createdPortfolio, err := uow.Portfolio().Create(ctx, &newPortfolio)
		if err != nil {
			return fmt.Errorf("failed to create portfolio in repository: %w", err)
		}
		portfolio = createdPortfolio
		return nil
	})

	if err != nil {
		log.Printf("[PortfolioService] CreatePortfolio: ERROR: user=%s name=%s: %v", input.UserID, input.Name, err)
		return nil, err
	}

	log.Printf("[PortfolioService] CreatePortfolio: completed portfolio=%s user=%s name=%s", portfolio.ID, input.UserID, input.Name)
	return portfolio, nil
}

// UpdatePortfolio updates an existing portfolio's details.
// Returns ErrPortfolioNotFound if the portfolio doesn't exist.
// Returns ErrPortfolioNameExists if the new name conflicts with another portfolio.
func (s *PortfolioService) UpdatePortfolio(ctx context.Context, id string, input UpdatePortfolioInput) (*model.Portfolio, error) {
	log.Printf("[PortfolioService] UpdatePortfolio: started portfolio=%s", id)

	// Input validation
	if err := validatePortfolioID(id); err != nil {
		return nil, err
	}

	if input.Name != nil {
		if err := validatePortfolioName(*input.Name); err != nil {
			return nil, err
		}
	}

	if input.Description != nil && len(*input.Description) > 500 {
		return nil, fmt.Errorf("%w: description must be less than 500 characters", ErrPortfolioInvalidInput)
	}

	if input.SortOrder != nil {
		if err := validateSortOrder(*input.SortOrder); err != nil {
			return nil, err
		}
	}

	var portfolioToUpdate *model.Portfolio

	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 1. --- Retrieve Existing Entity ---
		existing, err := uow.Portfolio().GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				log.Printf("[PortfolioService] UpdatePortfolio: portfolio not found id=%s", id)
				return ErrPortfolioNotFound
			}
			log.Printf("[PortfolioService] UpdatePortfolio: ERROR: retrieve failed id=%s: %v", id, err)
			return fmt.Errorf("failed to retrieve portfolio: %w", err)
		}
		portfolioToUpdate = existing

		// 2. --- Check for name conflicts if name is being updated ---
		if input.Name != nil {
			trimmedName := strings.TrimSpace(*input.Name)
			if trimmedName != existing.Name {
				// Check if another portfolio with this name exists for the same user
				conflicting, err := uow.Portfolio().GetPortfolioByName(ctx, existing.UserID, trimmedName)
				if err != nil && !errors.Is(err, repository.ErrNotFound) {
					return fmt.Errorf("failed to check for name conflicts: %w", err)
				}
				if conflicting != nil && conflicting.ID != existing.ID {
					return ErrPortfolioNameExists
				}
			}
			portfolioToUpdate.Name = trimmedName
		}

		// 3. --- Apply Other Changes ---
		if input.Description != nil {
			portfolioToUpdate.Description = strings.TrimSpace(*input.Description)
		}

		if input.SortOrder != nil {
			portfolioToUpdate.SortOrder = *input.SortOrder
		}

		// 4. --- Persistence ---
		err = uow.Portfolio().Update(ctx, portfolioToUpdate)
		if err != nil {
			return fmt.Errorf("failed to update portfolio: %w", err)
		}

		return nil
	})

	if err != nil {
		log.Printf("[PortfolioService] UpdatePortfolio: ERROR: update failed portfolio=%s: %v", id, err)
		return nil, err
	}

	log.Printf("[PortfolioService] UpdatePortfolio: completed portfolio=%s", id)
	return portfolioToUpdate, nil
}

// DeletePortfolio handles the removal of a portfolio.
// Returns ErrPortfolioNotFound if the portfolio doesn't exist.
// Returns ErrPortfolioHasPositions if the portfolio contains positions (optional check).
func (s *PortfolioService) DeletePortfolio(ctx context.Context, id string) error {
	log.Printf("[PortfolioService] DeletePortfolio: started portfolio=%s", id)

	// Input validation
	if err := validatePortfolioID(id); err != nil {
		return err
	}

	// Use transaction to ensure cascade deletion is atomic
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {

		// 1. Check if portfolio exists
		_, err := uow.Portfolio().GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return ErrPortfolioNotFound
			}
			return fmt.Errorf("failed to retrieve portfolio: %w", err)
		}

		// 2. Get all portfolio assets to delete them first
		portfolioAssets, err := uow.PortfolioAsset().FindByPortfolioID(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get portfolio assets: %w", err)
		}

		// 3. Delete all portfolio assets by using the database directly since they have composite keys
		for _, asset := range portfolioAssets {
			err := uow.PortfolioAsset().DeleteByPortfolioAndAsset(ctx, asset.PortfolioID, asset.AssetID)
			if err != nil {
				return fmt.Errorf("failed to delete portfolio asset %s-%s: %w", asset.PortfolioID, asset.AssetID, err)
			}
		}

		// 4. Delete portfolio tags associations (skipped for now due to schema issues)
		// TODO: Implement portfolio tag deletion when the schema is properly set up

		// 5. Finally delete the portfolio itself
		err = uow.Portfolio().Delete(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to delete portfolio: %w", err)
		}

		log.Printf("[PortfolioService] DeletePortfolio: completed portfolio=%s (deleted %d assets)", id, len(portfolioAssets))
		return nil
	})
}

// AddAssetToPortfolio handles adding an asset to a portfolio, creating the join table record.
func (s *PortfolioService) AddAssetToPortfolio(ctx context.Context, portfolioID, assetID string, quantity float64, price float64) (*model.PortfolioAsset, error) {
	log.Printf("[PortfolioService] AddAssetToPortfolio: started portfolio=%s asset=%s qty=%.4f price=%.2f", portfolioID, assetID, quantity, price)

	// 1. --- Validation ---
	if quantity <= 0 {
		return nil, errors.New("quantity must be positive")
	}

	var createdPortfolioAsset *model.PortfolioAsset
	var assetForRefresh *model.Asset
	var backfillFrom time.Time
	var portfolioUserID string
	var instrumentIDForBackfill string
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 2. --- Check Existence of Portfolio and Asset ---
		portfolio, err := uow.Portfolio().GetByID(ctx, portfolioID)
		if err != nil {
			return fmt.Errorf("portfolio with ID %s not found", portfolioID)
		}
		portfolioUserID = portfolio.UserID
		asset, err := uow.Asset().GetByID(ctx, assetID)
		if err != nil {
			return fmt.Errorf("asset with ID %s not found", assetID)
		}
		if asset.IsTradeable {
			resolvedInstrumentID, resolveErr := s.ensureTradeableAssetInstrument(ctx, uow, asset, portfolio.UserID)
			if resolveErr != nil {
				return resolveErr
			}
			if resolvedInstrumentID != "" {
				asset.InstrumentID = &resolvedInstrumentID
			}
			assetForRefresh = asset
			if asset.InstrumentID != nil {
				instrumentIDForBackfill = strings.TrimSpace(*asset.InstrumentID)
			}
		}

		quoteCurrency, resolveErr := s.resolveAssetQuoteCurrency(ctx, uow, asset)
		if resolveErr != nil {
			return resolveErr
		}

		// 3. --- Check if asset already exists in portfolio ---
		_, err = uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, portfolioID, assetID)
		if err == nil {
			return errors.New("asset already exists in portfolio")
		}
		if !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing portfolio asset: %w", err)
		}

		// 4. --- Create and Persist Join Table Record ---
		portfolioAsset := model.PortfolioAsset{
			PortfolioID:          portfolioID,
			AssetID:              assetID,
			InstrumentID:         asset.InstrumentID,
			Quantity:             quantity,
			AveragePurchasePrice: price,
			QuoteCurrency:        quoteCurrency,
		}

		createdPortfolioAsset, err = uow.PortfolioAsset().Create(ctx, &portfolioAsset)
		if err != nil {
			return fmt.Errorf("failed to add asset to portfolio: %w", err)
		}

		// Canonical quote currency lives on positions; keep it in sync at creation time.
		if _, err = uow.Position().GetByPortfolioAndAsset(ctx, portfolioID, assetID); err != nil {
			if !errors.Is(err, repository.ErrNotFound) && !errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("failed to check existing position: %w", err)
			}

			position := &model.Position{
				PortfolioID:         portfolioID,
				AssetID:             assetID,
				Quantity:            decimal.NewFromFloat(quantity),
				OwnershipPercentage: decimal.NewFromInt(100),
				QuoteCurrency:       quoteCurrency,
			}
			if price > 0 {
				avgCost := decimal.NewFromFloat(price)
				position.AverageCostBasis = &avgCost
				totalCost := model.Money(decimal.NewFromFloat(quantity).Mul(avgCost).Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				position.TotalCostBasis = &totalCost
			}
			createdPosition, createErr := uow.Position().Create(ctx, position)
			if createErr != nil {
				return fmt.Errorf("failed to create position snapshot: %w", createErr)
			}

			if price > 0 && createdPosition != nil {
				executedAt := extractPurchaseDateFromAssetMetadata(asset)
				if executedAt.IsZero() {
					executedAt = time.Now()
				}
				if executedAt.After(time.Now().AddDate(0, 0, 1)) {
					executedAt = time.Now()
				}
				amount := model.Money(decimal.NewFromFloat(quantity).Mul(decimal.NewFromFloat(price)).Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				txQuantity := decimal.NewFromFloat(quantity)
				txUnitPrice := decimal.NewFromFloat(price)
				positionIDCopy := createdPosition.ID

				transaction := &model.Transaction{
					UserID:            portfolio.UserID,
					PositionID:        &positionIDCopy,
					Type:              model.TransactionTypeBuy,
					Amount:            amount,
					Quantity:          &txQuantity,
					UnitPriceAmount:   &txUnitPrice,
					UnitPriceCurrency: quoteCurrency,
					FeesAmount:        0,
					FeesCurrency:      quoteCurrency,
					ExecutedAt:        executedAt,
				}
				if _, txErr := uow.Transaction().Create(ctx, transaction); txErr != nil {
					return fmt.Errorf("failed to create initial transaction: %w", txErr)
				}
				backfillFrom = executedAt
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	s.triggerAssetPriceRefresh(assetForRefresh)
	if !backfillFrom.IsZero() {
		if instrumentIDForBackfill != "" {
			go s.enqueueHistoricalBackfillJob(portfolioID, assetID, instrumentIDForBackfill, backfillFrom, portfolioUserID)
		}
	}

	log.Printf("[PortfolioService] AddAssetToPortfolio: completed portfolio=%s asset=%s", portfolioID, assetID)
	return createdPortfolioAsset, nil
}

func (s *PortfolioService) ensureTradeableAssetInstrument(ctx context.Context, uow repository.IUnitOfWork, asset *model.Asset, ownerUserID string) (string, error) {
	if asset == nil || !asset.IsTradeable {
		return "", nil
	}

	normalizedSymbol := strings.ToUpper(strings.TrimSpace(ptrStringValue(asset.Symbol)))
	if normalizedSymbol == "" {
		return "", fmt.Errorf("tradeable asset %s has no symbol; cannot resolve instrument", asset.ID)
	}
	if isGenericTradeableSymbol(normalizedSymbol) {
		return "", fmt.Errorf("tradeable asset %s has unsupported generic symbol %s", asset.ID, normalizedSymbol)
	}

	if asset.InstrumentID != nil && strings.TrimSpace(*asset.InstrumentID) != "" {
		linked := strings.TrimSpace(*asset.InstrumentID)
		if linkedInstrument, err := uow.Instrument().GetByID(ctx, linked); err == nil {
			linkSymbol := normalizedSymbol
			if linkedInstrument != nil && strings.TrimSpace(linkedInstrument.Symbol) != "" {
				linkSymbol = strings.ToUpper(strings.TrimSpace(linkedInstrument.Symbol))
			}
			if err := s.ensureYFinanceMappingForInstrument(ctx, uow, linked, linkSymbol, asset.Type); err != nil {
				return "", err
			}
			return linked, nil
		}
	}

	assetTypes := mapAssetTypeToInstrumentCandidates(asset.Type)
	ownerPtr := ptrString(strings.TrimSpace(ownerUserID))
	rows, err := uow.Instrument().Search(ctx, normalizedSymbol, repository.InstrumentSearchFilter{
		AssetTypes:  assetTypes,
		OwnerUserID: ownerPtr,
		Limit:       20,
		Offset:      0,
	})
	if err != nil {
		return "", fmt.Errorf("failed to search instruments for asset %s: %w", asset.ID, err)
	}

	for i := range rows {
		candidate := rows[i].Instrument
		if strings.EqualFold(strings.TrimSpace(candidate.Symbol), normalizedSymbol) {
			instrumentID := candidate.ID
			asset.InstrumentID = &instrumentID
			if err := uow.Asset().Update(ctx, asset); err != nil {
				return "", fmt.Errorf("failed to attach instrument %s to asset %s: %w", instrumentID, asset.ID, err)
			}
			if err := s.ensureYFinanceMappingForInstrument(ctx, uow, instrumentID, normalizedSymbol, asset.Type); err != nil {
				return "", err
			}
			return instrumentID, nil
		}
	}

	instrumentType, typeErr := mapAssetTypeToInstrumentType(asset.Type)
	if typeErr != nil {
		return "", typeErr
	}
	exchange := "MANUAL"
	now := time.Now().UTC()
	createdInstrument := &model.Instrument{
		Symbol:           normalizedSymbol,
		NormalizedSymbol: normalizedSymbol,
		Name:             strings.TrimSpace(asset.Name),
		NormalizedName:   strings.ToLower(strings.TrimSpace(asset.Name)),
		Exchange:         exchange,
		AssetType:        instrumentType,
		Status:           model.InstrumentStatusUnknown,
		ProviderSource:   "manual",
		OwnerUserID:      ownerPtr,
		FirstSeenAt:      now,
		LastVerifiedAt:   nil,
	}
	if createdInstrument.NormalizedName == "" {
		createdInstrument.NormalizedName = strings.ToLower(normalizedSymbol)
	}
	created, createErr := uow.Instrument().Upsert(ctx, createdInstrument)
	if createErr != nil {
		return "", fmt.Errorf("failed to create manual instrument for asset %s: %w", asset.ID, createErr)
	}
	if created == nil || strings.TrimSpace(created.ID) == "" {
		return "", fmt.Errorf("failed to create manual instrument for asset %s", asset.ID)
	}

	instrumentID := strings.TrimSpace(created.ID)
	asset.InstrumentID = &instrumentID
	if err := uow.Asset().Update(ctx, asset); err != nil {
		return "", fmt.Errorf("failed to attach created instrument %s to asset %s: %w", instrumentID, asset.ID, err)
	}

	if err := s.ensureYFinanceMappingForInstrument(ctx, uow, instrumentID, normalizedSymbol, asset.Type); err != nil {
		return "", err
	}
	return instrumentID, nil
}

func (s *PortfolioService) ensureYFinanceMappingForInstrument(ctx context.Context, uow repository.IUnitOfWork, instrumentID string, symbol string, assetType model.AssetType) error {
	mappingRepo := uow.InstrumentProviderMapping()
	if mappingRepo == nil {
		return nil
	}
	if _, err := mappingRepo.GetVerifiedByInstrumentAndProvider(ctx, instrumentID, "YFINANCE"); err == nil {
		return nil
	}

	normalizedSymbol := strings.ToUpper(strings.TrimSpace(symbol))
	if normalizedSymbol == "" {
		return fmt.Errorf("cannot create yfinance mapping for instrument %s without symbol", instrumentID)
	}

	providerSymbol := normalizedSymbol
	if assetType == model.AssetTypeCrypto && !strings.Contains(providerSymbol, "-") {
		providerSymbol = providerSymbol + "-USD"
	}
	quoteCurrency := "USD"
	if assetType == model.AssetTypeFund || assetType == model.AssetTypeStock {
		quoteCurrency = "USD"
	}
	mapping := &model.InstrumentProviderMapping{
		InstrumentID:    instrumentID,
		Provider:        "YFINANCE",
		ProviderAssetID: providerSymbol,
		ProviderSymbol:  ptrString(providerSymbol),
		QuoteCurrency:   ptrString(quoteCurrency),
		MappingStatus:   model.InstrumentProviderMappingStatusVerified,
		LastVerifiedAt:  ptrTime(time.Now().UTC()),
		LastErrorText:   nil,
	}
	if _, err := mappingRepo.Upsert(ctx, mapping); err != nil {
		return fmt.Errorf("failed to upsert yfinance mapping for instrument %s: %w", instrumentID, err)
	}
	return nil
}

func mapAssetTypeToInstrumentCandidates(assetType model.AssetType) []model.InstrumentAssetType {
	switch assetType {
	case model.AssetTypeFund:
		return []model.InstrumentAssetType{model.InstrumentAssetTypeFund, model.InstrumentAssetTypeETF}
	case model.AssetTypeCrypto:
		return []model.InstrumentAssetType{model.InstrumentAssetTypeCrypto}
	case model.AssetTypeStock:
		return []model.InstrumentAssetType{model.InstrumentAssetTypeStock}
	default:
		return []model.InstrumentAssetType{}
	}
}

func mapAssetTypeToInstrumentType(assetType model.AssetType) (model.InstrumentAssetType, error) {
	switch assetType {
	case model.AssetTypeFund:
		return model.InstrumentAssetTypeFund, nil
	case model.AssetTypeCrypto:
		return model.InstrumentAssetTypeCrypto, nil
	case model.AssetTypeStock:
		return model.InstrumentAssetTypeStock, nil
	default:
		return "", fmt.Errorf("asset type %s cannot be mapped to tradeable instrument type", assetType)
	}
}

func ptrStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func ptrTime(value time.Time) *time.Time {
	return &value
}

func isGenericTradeableSymbol(symbol string) bool {
	switch strings.ToUpper(strings.TrimSpace(symbol)) {
	case "", "EQUITIES", "EQUITY", "STOCK", "STOCKS", "FUND", "FUNDS", "ETF", "ETFS", "CRYPTO", "CRYPTOS":
		return true
	default:
		return false
	}
}

func (s *PortfolioService) enqueueHistoricalBackfillJob(portfolioID string, assetID string, instrumentID string, from time.Time, userID string) {
	if strings.TrimSpace(portfolioID) == "" || strings.TrimSpace(assetID) == "" || strings.TrimSpace(instrumentID) == "" || from.IsZero() {
		return
	}

	jobRepo := s.uow.HistoricalDataBackfillJob()
	if jobRepo == nil {
		return
	}

	now := time.Now().UTC()
	requestedTo := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	activeJob, activeErr := jobRepo.GetActiveByRequest(
		context.Background(),
		portfolioID,
		assetID,
		instrumentID,
		"YFINANCE",
		from.UTC(),
		requestedTo,
	)
	if activeErr == nil && activeJob != nil {
		return
	}

	job := &model.HistoricalDataBackfillJob{
		PortfolioID:   portfolioID,
		AssetID:       assetID,
		InstrumentID:  instrumentID,
		Provider:      "YFINANCE",
		Status:        string(model.HistoricalDataBackfillStatusQueued),
		Step:          string(model.HistoricalDataBackfillStepQueued),
		Progress:      0,
		RequestedFrom: from.UTC(),
		RequestedTo:   requestedTo,
		NextRunAt:     now,
		MaxAttempts:   4,
	}
	if strings.TrimSpace(userID) != "" {
		job.UserID = &userID
	}
	created, err := jobRepo.Create(context.Background(), job)
	if err != nil || created == nil {
		log.Printf("[PortfolioService] enqueueHistoricalBackfillJob failed portfolio=%s asset=%s instrument=%s err=%v", portfolioID, assetID, instrumentID, err)
		return
	}

	log.Printf("[PortfolioService] queued historical job=%s portfolio=%s asset=%s instrument=%s from=%s to=%s", created.ID, portfolioID, assetID, instrumentID, from.UTC().Format(time.RFC3339), requestedTo.Format(time.RFC3339))
}

// UpdateAssetInPortfolio handles updating an asset's quantity and price in a portfolio.
func (s *PortfolioService) UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID string, quantity float64, price float64) (*model.PortfolioAsset, error) {
	log.Printf("[PortfolioService] UpdateAssetInPortfolio: started portfolio=%s asset=%s qty=%.4f price=%.2f", portfolioID, assetID, quantity, price)

	// 1. --- Validation ---
	if quantity <= 0 {
		return nil, errors.New("quantity must be positive")
	}

	var updatedPortfolioAsset *model.PortfolioAsset
	var assetForRefresh *model.Asset
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 2. --- Check Existence of Portfolio and Asset ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %s not found", portfolioID)
		}
		asset, err := uow.Asset().GetByID(ctx, assetID)
		if err != nil {
			return fmt.Errorf("asset with ID %s not found", assetID)
		}
		if asset.IsTradeable {
			assetForRefresh = asset
		}

		// 3. --- Find Existing Portfolio Asset ---
		existing, err := uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, portfolioID, assetID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return errors.New("asset not found in portfolio")
			}
			return fmt.Errorf("failed to find asset in portfolio: %w", err)
		}

		// 4. --- Update Fields ---
		existing.Quantity = quantity
		existing.AveragePurchasePrice = price

		// 5. --- Persist Changes ---
		err = uow.PortfolioAsset().UpdatePortfolioAsset(ctx, existing)
		if err != nil {
			return fmt.Errorf("failed to update asset in portfolio: %w", err)
		}
		updatedPortfolioAsset = existing
		return nil
	})

	if err != nil {
		log.Printf("[PortfolioService] UpdateAssetInPortfolio: ERROR: portfolio=%s asset=%s: %v", portfolioID, assetID, err)
		return nil, err
	}

	s.triggerAssetPriceRefresh(assetForRefresh)

	log.Printf("[PortfolioService] UpdateAssetInPortfolio: completed portfolio=%s asset=%s", portfolioID, assetID)
	return updatedPortfolioAsset, nil
}

// RemoveAssetFromPortfolio handles removing an asset from a portfolio.
func (s *PortfolioService) RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID string) error {
	log.Printf("[PortfolioService] RemoveAssetFromPortfolio: started portfolio=%s asset=%s", portfolioID, assetID)

	// 1. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return fmt.Errorf("portfolio with ID %s not found", portfolioID)
	}
	if _, err := s.uow.Asset().GetByID(ctx, assetID); err != nil {
		return fmt.Errorf("asset with ID %s not found", assetID)
	}

	// 2. --- Remove Portfolio Asset ---
	err := s.uow.PortfolioAsset().DeleteByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		return fmt.Errorf("failed to remove asset from portfolio: %w", err)
	}

	log.Printf("[PortfolioService] RemoveAssetFromPortfolio: completed portfolio=%s asset=%s", portfolioID, assetID)
	return nil
}

// TagPortfolio handles adding a tag to a portfolio.
func (s *PortfolioService) TagPortfolio(ctx context.Context, portfolioID, tagID string) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 1. --- Check Existence of Portfolio and Tag ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %s not found", portfolioID)
		}
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			return fmt.Errorf("tag with ID %s not found", tagID)
		}

		// 2. --- Check if tag already exists on portfolio ---
		existing, err := uow.PortfolioTag().FindByPortfolioID(ctx, portfolioID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing portfolio tag: %w", err)
		}
		for _, pt := range existing {
			if pt.TagID == tagID {
				return errors.New("tag already exists on portfolio")
			}
		}

		// 3. --- Create Portfolio Tag ---
		err = uow.PortfolioTag().Add(ctx, portfolioID, tagID)
		if err != nil {
			return fmt.Errorf("failed to tag portfolio: %w", err)
		}

		return nil
	})
}

// UntagPortfolio handles removing a tag from a portfolio.
func (s *PortfolioService) UntagPortfolio(ctx context.Context, portfolioID, tagID string) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 1. --- Check Existence of Portfolio and Tag ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %s not found", portfolioID)
		}
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			return fmt.Errorf("tag with ID %s not found", tagID)
		}

		// 2. --- Find and Delete Portfolio Tag ---
		err := uow.PortfolioTag().Remove(ctx, portfolioID, tagID)
		if err != nil {
			// If the error is that the row doesn't exist, we can consider it a success.
			if errors.Is(err, repository.ErrNotFound) {
				return nil
			}
			return fmt.Errorf("failed to untag portfolio: %w", err)
		}

		return nil
	})
}

// GetPortfolioAssets retrieves all assets in a portfolio with their details.
func (s *PortfolioService) GetPortfolioAssets(ctx context.Context, portfolioID string) ([]model.PortfolioAsset, error) {
	// 1. --- Check Existence of Portfolio ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return nil, fmt.Errorf("portfolio with ID %s not found", portfolioID)
	}

	// 2. --- Get Portfolio Assets ---
	portfolioAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio assets: %w", err)
	}

	return portfolioAssets, nil
}

// DuplicatePortfolio creates a copy of an existing portfolio with optional asset copying
func (s *PortfolioService) DuplicatePortfolio(ctx context.Context, input DuplicatePortfolioInput) (*model.Portfolio, error) {
	// 1. --- Input Validation ---
	if len(input.NewName) < 3 {
		return nil, errors.New("portfolio name must be at least 3 characters long")
	}
	if len(input.NewName) > 100 {
		return nil, errors.New("portfolio name must be less than 100 characters")
	}
	if len(input.Description) > 500 {
		return nil, errors.New("description must be less than 500 characters")
	}

	// 2. --- Get Source Portfolio ---
	sourcePortfolio, err := s.uow.Portfolio().GetByID(ctx, input.SourcePortfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("source portfolio with ID %s not found", input.SourcePortfolioID)
		}
		return nil, fmt.Errorf("failed to retrieve source portfolio: %w", err)
	}

	// 3. --- Check for Duplicate Name ---
	existingPortfolios, err := s.uow.Portfolio().FindAllBy(ctx,
		repository.ByColumn("user_id", sourcePortfolio.UserID),
		repository.ByColumn("name", input.NewName),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to check for duplicate portfolio name: %w", err)
	}
	if len(existingPortfolios) > 0 {
		return nil, errors.New("portfolio name already exists for this user")
	}

	// 4. --- Get Next Sort Order ---
	userPortfolios, err := s.uow.Portfolio().FindAllBy(ctx,
		repository.ByColumn("user_id", sourcePortfolio.UserID),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get user portfolios for sort order: %w", err)
	}

	nextSortOrder := 0
	for _, portfolio := range userPortfolios {
		if portfolio.SortOrder >= nextSortOrder {
			nextSortOrder = portfolio.SortOrder + 1
		}
	}

	// 5. --- Create New Portfolio ---
	newPortfolio := model.Portfolio{
		UserID:      sourcePortfolio.UserID,
		Name:        input.NewName,
		Description: input.Description,
		SortOrder:   nextSortOrder,
	}

	createdPortfolio, err := s.uow.Portfolio().Create(ctx, &newPortfolio)
	if err != nil {
		return nil, fmt.Errorf("failed to create duplicated portfolio: %w", err)
	}

	// 6. --- Copy Assets if Requested ---
	if input.CopyAssets {
		sourceAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, input.SourcePortfolioID)
		if err != nil {
			return nil, fmt.Errorf("failed to get source portfolio assets: %w", err)
		}

		for _, sourceAsset := range sourceAssets {
			newPortfolioAsset := model.PortfolioAsset{
				PortfolioID:          createdPortfolio.ID,
				AssetID:              sourceAsset.AssetID,
				InstrumentID:         sourceAsset.InstrumentID,
				Quantity:             sourceAsset.Quantity,
				AveragePurchasePrice: sourceAsset.AveragePurchasePrice,
			}

			_, err := s.uow.PortfolioAsset().Create(ctx, &newPortfolioAsset)
			if err != nil {
				// If asset copying fails, we should still return the created portfolio
				// but log the error for debugging
				log.Printf("[PortfolioService] DuplicatePortfolio: warning: failed to copy asset %s to new portfolio: %v", sourceAsset.AssetID, err)
			}
		}
	}

	return createdPortfolio, nil
}

// ReorderPortfolios updates the sort order of multiple portfolios for a user
func (s *PortfolioService) ReorderPortfolios(ctx context.Context, userID string, orders []PortfolioOrderInput) ([]model.Portfolio, error) {
	// 1. --- Input Validation ---
	if len(orders) == 0 {
		return nil, errors.New("no portfolio orders provided")
	}

	// Validate that all sort orders are non-negative and unique
	sortOrderMap := make(map[int]bool)
	for _, order := range orders {
		if order.SortOrder < 0 {
			return nil, errors.New("sort order must be non-negative")
		}
		if sortOrderMap[order.SortOrder] {
			return nil, errors.New("duplicate sort orders are not allowed")
		}
		sortOrderMap[order.SortOrder] = true
	}

	// 2. --- Verify User Owns All Portfolios ---
	var portfolioIDs []string
	for _, order := range orders {
		portfolioIDs = append(portfolioIDs, order.PortfolioID)
	}

	// Get all portfolios to verify ownership
	var updatedPortfolios []model.Portfolio
	for _, order := range orders {
		portfolio, err := s.uow.Portfolio().GetByID(ctx, order.PortfolioID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return nil, fmt.Errorf("portfolio with ID %s not found", order.PortfolioID)
			}
			return nil, fmt.Errorf("failed to retrieve portfolio %s: %w", order.PortfolioID, err)
		}

		// Verify user ownership
		if portfolio.UserID != userID {
			return nil, fmt.Errorf("portfolio %s does not belong to user %s", order.PortfolioID, userID)
		}

		// Update sort order
		portfolio.SortOrder = order.SortOrder
		err = s.uow.Portfolio().Update(ctx, portfolio)
		if err != nil {
			return nil, fmt.Errorf("failed to update portfolio %s sort order: %w", order.PortfolioID, err)
		}

		updatedPortfolios = append(updatedPortfolios, *portfolio)
	}

	return updatedPortfolios, nil
}

// GetPortfoliosByUser retrieves all portfolios for a user with custom ordering
func (s *PortfolioService) GetPortfoliosByUser(ctx context.Context, userID string, orderBy string) ([]model.Portfolio, error) {
	// Input validation
	if err := validateUserID(userID); err != nil {
		return nil, err
	}

	// 1. --- Input Validation ---
	validOrderBy := map[string]string{
		"name":         "name ASC",
		"name_desc":    "name DESC",
		"created":      "created_at ASC",
		"created_desc": "created_at DESC",
		"sort_order":   "sort_order ASC",
		"updated":      "updated_at DESC",
	}

	orderClause, exists := validOrderBy[orderBy]
	if !exists {
		orderClause = "sort_order ASC" // Default ordering
	}

	// 2. --- Query Options ---
	opts := []repository.QueryOption{
		repository.ByColumn("user_id", userID),
		repository.WithOrder(orderClause),
	}

	// 3. --- Retrieve Portfolios ---
	portfolios, err := s.uow.Portfolio().FindAllBy(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve portfolios for user %s: %w", userID, err)
	}

	return portfolios, nil
}

// GetPortfolioAnalytics calculates comprehensive analytics for a portfolio using display currency.
// It uses PortfolioValuationService to calculate native and display values with proper FX conversion.
func (s *PortfolioService) GetPortfolioAnalytics(ctx context.Context, portfolioID string, displayCurrency model.Currency) (*PortfolioValuation, error) {
	log.Printf("[PortfolioService] GetPortfolioAnalytics: started portfolio=%s currency=%s", portfolioID, displayCurrency)

	// Input validation
	if err := validatePortfolioID(portfolioID); err != nil {
		return nil, err
	}

	// 1. --- Verify Portfolio Exists ---
	_, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrPortfolioNotFound
		}
		return nil, fmt.Errorf("failed to retrieve portfolio: %w", err)
	}

	// 2. --- Get Portfolio Positions ---
	positions, err := s.uow.Position().GetPortfolioPositions(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve portfolio positions: %w", err)
	}

	if len(positions) == 0 {
		log.Printf("[PortfolioService] GetPortfolioAnalytics: empty portfolio portfolio=%s", portfolioID)
		// Empty portfolio - return empty valuation
		return &PortfolioValuation{
			TotalDisplayValue:  0,
			TotalNativeValue:   0,
			IsStale:            false,
			FXState:            "EMPTY",
			CoveredValueRatio:  decimal.Zero,
			PerformanceHistory: []PerformancePoint{},
			PositionValuations: []PositionValuation{},
			DisplayCurrency:    displayCurrency,
		}, nil
	}

	// 3. --- Calculate portfolio valuation using PortfolioValuationService ---
	valuation, err := s.valuationService.CalculatePortfolioValue(ctx, positions, displayCurrency)
	if err != nil {
		log.Printf("[PortfolioService] GetPortfolioAnalytics: ERROR: valuation failed portfolio=%s: %v", portfolioID, err)
		return nil, fmt.Errorf("failed to calculate portfolio valuation: %w", err)
	}
	valuation.PerformanceHistory = s.generatePerformanceHistory(ctx, portfolioID, float64(valuation.TotalDisplayValue)/100.0)

	log.Printf("[PortfolioService] GetPortfolioAnalytics: completed portfolio=%s positions=%d totalValue=%d fxState=%s", portfolioID, len(positions), valuation.TotalDisplayValue, valuation.FXState)
	return valuation, nil
}

// calculateRiskMetrics calculates risk-related metrics for the portfolio using position data.
func (s *PortfolioService) calculateRiskMetrics(ctx context.Context, portfolioID string, positions []model.Position, totalValue model.Money) RiskMetrics {
	// Calculate diversification score based on number of assets and allocation spread
	diversification := s.calculateDiversificationScoreFromPositions(ctx, positions, totalValue)

	// Get actual risk metrics from repository if possible
	volatility := 0.0
	maxDrawdown := 0.0
	sharpeRatio := 0.0

	// We calculate over the last 365 days
	endDate := time.Now()
	startDate := endDate.AddDate(-1, 0, 0)

	if v, err := s.uow.Performance().CalculateVolatility(ctx, portfolioID, 365); err == nil {
		volatility, _ = v.Float64()
	}
	if m, err := s.uow.Performance().CalculateMaxDrawdown(ctx, portfolioID, startDate, endDate); err == nil {
		maxDrawdown, _ = m.Float64()
	}

	return RiskMetrics{
		Volatility:      volatility,
		SharpeRatio:     sharpeRatio,
		MaxDrawdown:     maxDrawdown,
		Diversification: diversification,
	}
}

// calculateDiversificationScoreFromPositions calculates a diversification score (0-100) using positions.
func (s *PortfolioService) calculateDiversificationScoreFromPositions(ctx context.Context, positions []model.Position, totalValue model.Money) float64 {
	if len(positions) == 0 || totalValue == 0 {
		return 0
	}

	// Calculate Herfindahl-Hirschman Index (HHI) for concentration
	// using each position's display value
	var hhi float64
	totalValueFloat := float64(totalValue) / 100.0 // Convert from cents to dollars

	for _, pos := range positions {
		// Get current price for this position's asset
		latestPrice, err := s.uow.AssetPrice().GetLatestPrice(ctx, pos.AssetID)
		if err != nil {
			continue
		}

		// Calculate position value: quantity * price (in native currency)
		positionValueDecimal := pos.Quantity.Mul(latestPrice.Price)
		positionValue := float64(positionValueDecimal.IntPart()) / 100.0 // Convert to dollars

		marketShare := positionValue / totalValueFloat
		hhi += marketShare * marketShare
	}

	// Convert HHI to diversification score (lower HHI = higher diversification)
	// HHI ranges from 1/n to 1, where n is number of assets
	// We convert this to a 0-100 scale where 100 is perfectly diversified
	maxHHI := 1.0
	minHHI := 1.0 / float64(len(positions))

	if maxHHI == minHHI {
		return 100 // Single asset case
	}

	diversificationScore := ((maxHHI - hhi) / (maxHHI - minHHI)) * 100
	return math.Max(0, math.Min(100, diversificationScore))
}

// generatePerformanceHistory fetches actual performance history from snapshots
func (s *PortfolioService) generatePerformanceHistory(ctx context.Context, portfolioID string, currentValue float64) []PerformancePoint {
	now := time.Now()
	startDate := now.AddDate(0, 0, -30) // Default window

	transactions, txErr := s.uow.Transaction().FindByPortfolioID(ctx, portfolioID)
	if txErr == nil && len(transactions) > 0 {
		oldest := now
		found := false
		for _, tx := range transactions {
			if tx.ExecutedAt.IsZero() {
				continue
			}
			if !found || tx.ExecutedAt.Before(oldest) {
				oldest = tx.ExecutedAt
				found = true
			}
		}
		if found {
			startDate = time.Date(oldest.Year(), oldest.Month(), oldest.Day(), 0, 0, 0, 0, oldest.Location())
		}
	}
	if earliestSnapshot := s.getEarliestPerformanceSnapshotDate(ctx, portfolioID); !earliestSnapshot.IsZero() && earliestSnapshot.Before(startDate) {
		startDate = earliestSnapshot
	}
	if earliestPrice := s.getEarliestPortfolioAssetPriceDate(ctx, portfolioID); !earliestPrice.IsZero() && earliestPrice.Before(startDate) {
		startDate = earliestPrice
	}

	if materialized := s.getMaterializedPerformanceHistory(ctx, portfolioID, startDate, now); len(materialized) > 0 {
		if coversRange(materialized, startDate, now) {
			return materialized
		}
	}

	history := s.getPortfolioPerformanceHistory(ctx, portfolioID, startDate, now)
	if !coversRange(history, startDate, now) {
		if rebuildErr := s.uow.Performance().CalculateAndSaveHistoricalSnapshots(ctx, portfolioID, startDate, now); rebuildErr != nil {
			log.Printf("[generatePerformanceHistory] snapshot rebuild failed portfolio=%s from=%s to=%s err=%v", portfolioID, startDate.Format("2006-01-02"), now.Format("2006-01-02"), rebuildErr)
		} else {
			history = s.getPortfolioPerformanceHistory(ctx, portfolioID, startDate, now)
		}
	}
	if len(history) > 0 {
		return history
	}

	// Graceful fallback to a single point if no history is computed yet
	history = append(history, PerformancePoint{
		Date:  now,
		Value: currentValue,
	})

	return history
}

func snapshotsToPerformancePoints(snapshots []repository.PerformanceSnapshot) []PerformancePoint {
	history := make([]PerformancePoint, 0, len(snapshots))
	for _, snap := range snapshots {
		history = append(history, PerformancePoint{
			Date:  snap.SnapshotDate,
			Value: float64(snap.TotalValue) / 100.0,
		})
	}
	return history
}

func (s *PortfolioService) getEarliestPerformanceSnapshotDate(ctx context.Context, portfolioID string) time.Time {
	unit, ok := s.uow.(*repository.UnitOfWork)
	if !ok || unit.GetDB() == nil {
		return time.Time{}
	}
	var row struct {
		Date *time.Time `bun:"date"`
	}
	if err := unit.GetDB().NewSelect().
		TableExpr("sigma_finance.portfolio_performance").
		ColumnExpr("MIN(snapshot_date) AS date").
		Where("portfolio_id = ?", portfolioID).
		Scan(ctx, &row); err != nil {
		return time.Time{}
	}
	if row.Date == nil || row.Date.IsZero() {
		return time.Time{}
	}
	return time.Date(row.Date.Year(), row.Date.Month(), row.Date.Day(), 0, 0, 0, 0, row.Date.Location())
}

func (s *PortfolioService) getEarliestPortfolioAssetPriceDate(ctx context.Context, portfolioID string) time.Time {
	unit, ok := s.uow.(*repository.UnitOfWork)
	if !ok || unit.GetDB() == nil {
		return time.Time{}
	}
	var row struct {
		Date *time.Time `bun:"date"`
	}
	if err := unit.GetDB().NewSelect().
		TableExpr("sigma_finance.asset_prices ap").
		ColumnExpr("MIN(ap.timestamp) AS date").
		Join("JOIN sigma_finance.positions p ON p.asset_id = ap.asset_id").
		Where("p.portfolio_id = ?", portfolioID).
		Scan(ctx, &row); err != nil {
		return time.Time{}
	}
	if row.Date == nil || row.Date.IsZero() {
		return time.Time{}
	}
	return time.Date(row.Date.Year(), row.Date.Month(), row.Date.Day(), 0, 0, 0, 0, row.Date.Location())
}

func (s *PortfolioService) getMaterializedPerformanceHistory(ctx context.Context, portfolioID string, from, to time.Time) []PerformancePoint {
	unit, ok := s.uow.(*repository.UnitOfWork)
	if !ok || unit.GetDB() == nil {
		return nil
	}
	var rows []struct {
		Date       time.Time       `bun:"date"`
		TotalValue decimal.Decimal `bun:"total_value"`
	}
	if err := unit.GetDB().NewSelect().
		TableExpr("sigma_finance.portfolio_daily_values").
		Column("date", "total_value").
		Where("portfolio_id = ?", portfolioID).
		Where("date >= ? AND date <= ?", from.Format(time.DateOnly), to.Format(time.DateOnly)).
		Order("date ASC").
		Scan(ctx, &rows); err != nil {
		return nil
	}
	history := make([]PerformancePoint, 0, len(rows))
	for _, row := range rows {
		value, _ := row.TotalValue.Float64()
		history = append(history, PerformancePoint{Date: row.Date, Value: value})
	}
	return history
}

func (s *PortfolioService) getPortfolioPerformanceHistory(ctx context.Context, portfolioID string, from, to time.Time) []PerformancePoint {
	unit, ok := s.uow.(*repository.UnitOfWork)
	if !ok || unit.GetDB() == nil {
		return nil
	}
	var rows []struct {
		Date       time.Time `bun:"snapshot_date"`
		TotalValue int64     `bun:"total_value"`
	}
	if err := unit.GetDB().NewSelect().
		TableExpr("sigma_finance.portfolio_performance").
		ColumnExpr("snapshot_date, total_value").
		Where("portfolio_id = ?", portfolioID).
		Where("snapshot_date >= ?::date", from.Format(time.DateOnly)).
		Where("snapshot_date <= ?::date", to.Format(time.DateOnly)).
		OrderExpr("snapshot_date ASC").
		Scan(ctx, &rows); err != nil {
		log.Printf("[getPortfolioPerformanceHistory] query failed portfolio=%s from=%s to=%s err=%v", portfolioID, from.Format("2006-01-02"), to.Format("2006-01-02"), err)
		return nil
	}
	history := make([]PerformancePoint, 0, len(rows))
	for _, row := range rows {
		history = append(history, PerformancePoint{
			Date:  row.Date,
			Value: float64(row.TotalValue) / 100.0,
		})
	}
	return history
}

func coversRange(points []PerformancePoint, startDate, endDate time.Time) bool {
	if len(points) == 0 {
		return false
	}
	first := points[0].Date
	last := points[len(points)-1].Date
	startDay := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())
	endDay := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 0, 0, 0, 0, endDate.Location())
	firstDay := time.Date(first.Year(), first.Month(), first.Day(), 0, 0, 0, 0, first.Location())
	lastDay := time.Date(last.Year(), last.Month(), last.Day(), 0, 0, 0, 0, last.Location())

	// Accept a small tolerance (2 days) for sparse weekends/holidays.
	return !firstDay.After(startDay.AddDate(0, 0, 2)) &&
		!lastDay.Before(endDay.AddDate(0, 0, -2))
}

// GetPerformanceVsBenchmark queries the performance repository
func (s *PortfolioService) GetPerformanceVsBenchmark(ctx context.Context, portfolioID string, benchmarkSymbol string) (PerformanceBenchmark, error) {
	// Identify benchmark asset
	benchmarkAsset, err := s.uow.Asset().GetBySymbol(ctx, benchmarkSymbol)
	if err != nil {
		return PerformanceBenchmark{}, fmt.Errorf("failed to find benchmark asset: %w", err)
	}

	now := time.Now()
	timeRange := repository.TimeRange{Start: now.AddDate(-1, 0, 0), End: now}

	comp, err := s.uow.Performance().CalculateBenchmarkComparison(ctx, portfolioID, benchmarkAsset.ID, timeRange)
	if err != nil {
		return PerformanceBenchmark{}, fmt.Errorf("failed to calculate benchmark comparison: %w", err)
	}

	portfolioReturn, _ := comp.PortfolioReturn.Float64()
	benchmarkReturn, _ := comp.BenchmarkReturn.Float64()
	alpha, _ := comp.Alpha.Float64()
	beta, _ := comp.Beta.Float64()

	return PerformanceBenchmark{
		PortfolioID:     portfolioID,
		BenchmarkSymbol: benchmarkSymbol,
		PortfolioReturn: portfolioReturn,
		BenchmarkReturn: benchmarkReturn,
		Alpha:           alpha,
		Beta:            beta,
		Correlation:     0, // not fully computed easily
	}, nil
}

// GetAssetAllocation calculates asset allocation for a portfolio.
// It fetches positions directly and calculates allocation based on display values.
func (s *PortfolioService) GetAssetAllocation(ctx context.Context, portfolioID string) ([]AssetAllocation, error) {
	// Get portfolio positions
	positions, err := s.uow.Position().GetPortfolioPositions(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio positions: %w", err)
	}

	if len(positions) == 0 {
		return []AssetAllocation{}, nil
	}

	// Calculate total portfolio value to determine allocation percentages
	var totalValue model.Money
	positionValues := make(map[string]model.Money)

	for _, pos := range positions {
		latestPrice, err := s.uow.AssetPrice().GetLatestPrice(ctx, pos.AssetID)
		if err != nil {
			continue
		}

		// Calculate position value: quantity * price
		positionValueDecimal := pos.Quantity.Mul(latestPrice.Price)
		positionValue := model.Money(positionValueDecimal.IntPart())
		positionValues[pos.AssetID] = positionValue
		totalValue += positionValue
	}

	// Group by asset type and calculate allocation
	typeMap := make(map[string]*AssetAllocation)

	for _, pos := range positions {
		positionValue, ok := positionValues[pos.AssetID]
		if !ok {
			continue
		}

		// Get asset type
		asset, err := s.uow.Asset().GetByID(ctx, pos.AssetID)
		if err != nil {
			continue
		}

		assetType := string(asset.Type)
		valueFloat := float64(positionValue) / 100.0

		if alloc, exists := typeMap[assetType]; exists {
			alloc.Value += valueFloat
			alloc.Count++
		} else {
			typeMap[assetType] = &AssetAllocation{
				AssetType: assetType,
				Value:     valueFloat,
				Count:     1,
			}
		}
	}

	// Calculate percentages
	var allocations []AssetAllocation
	totalValueFloat := float64(totalValue) / 100.0

	for _, alloc := range typeMap {
		if totalValueFloat > 0 {
			alloc.Percentage = (alloc.Value / totalValueFloat) * 100
		}
		allocations = append(allocations, *alloc)
	}

	return allocations, nil
}

// GetPortfolioHistory retrieves performance history points
func (s *PortfolioService) GetPortfolioHistory(ctx context.Context, portfolioID string, period string) (PortfolioHistory, error) {
	// Parse period to date
	now := time.Now()
	var startDate time.Time
	switch period {
	case "1W":
		startDate = now.AddDate(0, 0, -7)
	case "1M":
		startDate = now.AddDate(0, -1, 0)
	case "3M":
		startDate = now.AddDate(0, -3, 0)
	case "1Y":
		startDate = now.AddDate(-1, 0, 0)
	case "ALL":
		startDate = time.Time{}
	default:
		startDate = now.AddDate(0, -1, 0)
	}

	snapshots, err := s.uow.Performance().GetPerformanceSnapshots(ctx, portfolioID, startDate, now)
	if err != nil {
		return PortfolioHistory{}, fmt.Errorf("failed to get performance history: %w", err)
	}

	points := make([]PortfolioDataPoint, 0, len(snapshots))
	for _, snap := range snapshots {
		points = append(points, PortfolioDataPoint{
			Date:  snap.SnapshotDate,
			Value: float64(snap.TotalValue) / 100.0,
		})
	}

	return PortfolioHistory{
		PortfolioID: portfolioID,
		Period:      period,
		DataPoints:  points,
	}, nil
}

func (s *PortfolioService) resolveAssetQuoteCurrency(ctx context.Context, uow repository.IUnitOfWork, asset *model.Asset) (model.Currency, error) {
	if asset == nil {
		return "", errors.New("asset is required")
	}

	if asset.InstrumentID != nil {
		instrument, err := uow.Instrument().GetByID(ctx, *asset.InstrumentID)
		if err == nil && instrument != nil {
			if instrument.QuoteCurrency != nil {
				currency := model.Currency(strings.ToUpper(strings.TrimSpace(*instrument.QuoteCurrency)))
				if currency.IsValid() {
					return currency, nil
				}
			}
			if instrument.Currency != nil {
				currency := model.Currency(strings.ToUpper(strings.TrimSpace(*instrument.Currency)))
				if currency.IsValid() {
					return currency, nil
				}
			}
		}
	}

	if len(asset.Metadata) > 0 {
		var metadata map[string]interface{}
		if err := json.Unmarshal(asset.Metadata, &metadata); err == nil {
			if value, ok := metadata["currency"].(string); ok {
				currency := model.Currency(strings.ToUpper(strings.TrimSpace(value)))
				if currency.IsValid() {
					return currency, nil
				}
			}
		}
	}

	return "", fmt.Errorf("unable to resolve quote currency for asset %s", asset.ID)
}

func extractPurchaseDateFromAssetMetadata(asset *model.Asset) time.Time {
	if asset == nil || len(asset.Metadata) == 0 {
		return time.Time{}
	}

	var metadata map[string]interface{}
	if err := json.Unmarshal(asset.Metadata, &metadata); err != nil {
		return time.Time{}
	}

	parse := func(raw string) time.Time {
		candidate := strings.TrimSpace(raw)
		if candidate == "" {
			return time.Time{}
		}
		if parsed, err := time.Parse(time.RFC3339, candidate); err == nil {
			return parsed
		}
		if parsed, err := time.Parse("2006-01-02", candidate); err == nil {
			return parsed
		}
		return time.Time{}
	}

	if value, ok := metadata["purchase_date"].(string); ok {
		return parse(value)
	}
	if value, ok := metadata["purchaseDate"].(string); ok {
		return parse(value)
	}

	return time.Time{}
}

func (s *PortfolioService) backfillPortfolioPerformanceSnapshots(portfolioID string, from time.Time) {
	if strings.TrimSpace(portfolioID) == "" || from.IsZero() {
		return
	}

	now := time.Now().UTC()
	startDay := time.Date(from.UTC().Year(), from.UTC().Month(), from.UTC().Day(), 0, 0, 0, 0, time.UTC)
	endDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	if startDay.After(endDay) {
		startDay = endDay
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	for day := startDay; !day.After(endDay); day = day.AddDate(0, 0, 1) {
		asOf := time.Date(day.Year(), day.Month(), day.Day(), 23, 59, 59, 0, time.UTC)
		if asOf.After(now) {
			asOf = now
		}

		if err := s.uow.Performance().UpdatePerformanceSnapshots(ctx, []string{portfolioID}, asOf); err != nil {
			log.Printf("[PortfolioService] snapshot backfill failed portfolio=%s day=%s err=%v", portfolioID, day.Format("2006-01-02"), err)
			if ctx.Err() != nil {
				return
			}
			continue
		}

		if ctx.Err() != nil {
			return
		}
	}
}
