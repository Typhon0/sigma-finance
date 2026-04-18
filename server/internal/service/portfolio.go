// TODO: This service layer needs to be updated for the new asset management schema
// Temporarily excluded from build until service layer task is implemented

package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
	"time"
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
	GetPortfolioAnalytics(ctx context.Context, portfolioID string) (PortfolioAnalytics, error)
	GetPortfolioHistory(ctx context.Context, portfolioID string, period string) (PortfolioHistory, error)
	GetAssetAllocation(ctx context.Context, portfolioID string) ([]AssetAllocation, error)
	GetPerformanceVsBenchmark(ctx context.Context, portfolioID string, benchmarkSymbol string) (PerformanceBenchmark, error)
}

// PortfolioService is the concrete implementation of IPortfolioService.
type PortfolioService struct {
	uow repository.IUnitOfWork
}

// NewPortfolioService is the constructor for PortfolioService.
// It takes the Unit of Work as its dependency, from which it can access all repositories.
func NewPortfolioService(uow repository.IUnitOfWork) *PortfolioService {
	return &PortfolioService{
		uow: uow,
	}
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
	// Input validation
	if err := validateUserID(input.UserID); err != nil {
		return nil, err
	}

	if err := validatePortfolioName(input.Name); err != nil {
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
		return nil, err
	}

	return portfolio, nil
}

// UpdatePortfolio updates an existing portfolio's details.
// Returns ErrPortfolioNotFound if the portfolio doesn't exist.
// Returns ErrPortfolioNameExists if the new name conflicts with another portfolio.
func (s *PortfolioService) UpdatePortfolio(ctx context.Context, id string, input UpdatePortfolioInput) (*model.Portfolio, error) {
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
				return ErrPortfolioNotFound
			}
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
		return nil, err
	}

	return portfolioToUpdate, nil
}

// DeletePortfolio handles the removal of a portfolio.
// Returns ErrPortfolioNotFound if the portfolio doesn't exist.
// Returns ErrPortfolioHasPositions if the portfolio contains positions (optional check).
func (s *PortfolioService) DeletePortfolio(ctx context.Context, id string) error {
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

		return nil
	})
}

// AddAssetToPortfolio handles adding an asset to a portfolio, creating the join table record.
func (s *PortfolioService) AddAssetToPortfolio(ctx context.Context, portfolioID, assetID string, quantity float64, price float64) (*model.PortfolioAsset, error) {
	// 1. --- Validation ---
	if quantity <= 0 {
		return nil, errors.New("quantity must be positive")
	}

	// 2. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return nil, fmt.Errorf("portfolio with ID %s not found", portfolioID)
	}
	asset, err := s.uow.Asset().GetByID(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("asset with ID %s not found", assetID)
	}

	// 3. --- Check if asset already exists in portfolio ---
	_, err = s.uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err == nil {
		return nil, errors.New("asset already exists in portfolio")
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("failed to check existing portfolio asset: %w", err)
	}

	// 4. --- Create and Persist Join Table Record ---
	portfolioAsset := model.PortfolioAsset{
		PortfolioID:          portfolioID,
		AssetID:              assetID,
		InstrumentID:         asset.InstrumentID,
		Quantity:             quantity,
		AveragePurchasePrice: price,
	}

	createdPortfolioAsset, err := s.uow.PortfolioAsset().Create(ctx, &portfolioAsset)
	if err != nil {
		return nil, fmt.Errorf("failed to add asset to portfolio: %w", err)
	}

	return createdPortfolioAsset, nil
}

// UpdateAssetInPortfolio handles updating an asset's quantity and price in a portfolio.
func (s *PortfolioService) UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID string, quantity float64, price float64) (*model.PortfolioAsset, error) {
	// 1. --- Validation ---
	if quantity <= 0 {
		return nil, errors.New("quantity must be positive")
	}

	var updatedPortfolioAsset *model.PortfolioAsset
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 2. --- Check Existence of Portfolio and Asset ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %s not found", portfolioID)
		}
		if _, err := uow.Asset().GetByID(ctx, assetID); err != nil {
			return fmt.Errorf("asset with ID %s not found", assetID)
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
		return nil, err
	}

	return updatedPortfolioAsset, nil
}

// RemoveAssetFromPortfolio handles removing an asset from a portfolio.
func (s *PortfolioService) RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID string) error {
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
				fmt.Printf("Warning: failed to copy asset %s to new portfolio: %v\n", sourceAsset.AssetID, err)
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

// GetPortfolioAnalytics calculates comprehensive analytics for a portfolio
func (s *PortfolioService) GetPortfolioAnalytics(ctx context.Context, portfolioID string) (PortfolioAnalytics, error) {
	// Input validation
	if err := validatePortfolioID(portfolioID); err != nil {
		return PortfolioAnalytics{}, err
	}

	// 1. --- Verify Portfolio Exists ---
	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return PortfolioAnalytics{}, ErrPortfolioNotFound
		}
		return PortfolioAnalytics{}, fmt.Errorf("failed to retrieve portfolio: %w", err)
	}

	// 2. --- Get Portfolio Assets ---
	portfolioAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, portfolioID)
	if err != nil {
		return PortfolioAnalytics{}, fmt.Errorf("failed to retrieve portfolio assets: %w", err)
	}

	// 3. --- Calculate Basic Metrics ---
	analytics := PortfolioAnalytics{
		PortfolioID: portfolio.ID,
	}

	if len(portfolioAssets) == 0 {
		// Empty portfolio
		return analytics, nil
	}

	// 4. --- Calculate Total Values ---
	var totalValue, totalCost float64
	assetTypeMap := make(map[string]*AssetAllocation)

	for _, portfolioAsset := range portfolioAssets {
		// Fetch current market price
		var price float64
		latestPrice, err := s.uow.AssetPrice().GetLatestPrice(ctx, portfolioAsset.AssetID)
		if err == nil && latestPrice != nil {
			price = latestPrice.Price.InexactFloat64()
		} else if portfolioAsset.AveragePurchasePrice > 0 {
			price = portfolioAsset.AveragePurchasePrice
		}

		currentValue := portfolioAsset.Quantity * price
		cost := portfolioAsset.Quantity * portfolioAsset.AveragePurchasePrice

		totalValue += currentValue
		totalCost += cost

		// Get asset details for type classification
		assetType := "UNKNOWN"
		asset, err := s.uow.Asset().GetByID(ctx, portfolioAsset.AssetID)
		if err == nil && asset != nil {
			assetType = string(asset.Type)
		}

		if allocation, exists := assetTypeMap[assetType]; exists {
			allocation.Value += currentValue
			allocation.Count++
		} else {
			assetTypeMap[assetType] = &AssetAllocation{
				AssetType: assetType,
				Value:     currentValue,
				Count:     1,
			}
		}
	}

	// 5. --- Calculate Gain/Loss ---
	analytics.TotalValue = totalValue
	analytics.TotalCost = totalCost
	analytics.TotalGainLoss = totalValue - totalCost
	if totalCost > 0 {
		analytics.TotalGainLossPercent = (analytics.TotalGainLoss / totalCost) * 100
	}

	// 6. --- Calculate Asset Allocation Percentages ---
	for _, allocation := range assetTypeMap {
		if totalValue > 0 {
			allocation.Percentage = (allocation.Value / totalValue) * 100
		}
		analytics.AssetAllocation = append(analytics.AssetAllocation, *allocation)
	}

	// 7. --- Calculate Risk Metrics ---
	analytics.RiskMetrics = s.calculateRiskMetrics(ctx, portfolio.ID, portfolioAssets, totalValue)

	// 8. --- Generate Performance History ---
	analytics.PerformanceHistory = s.generatePerformanceHistory(ctx, portfolio.ID, totalValue)

	return analytics, nil
}

// calculateRiskMetrics calculates risk-related metrics for the portfolio
func (s *PortfolioService) calculateRiskMetrics(ctx context.Context, portfolioID string, portfolioAssets []model.PortfolioAsset, totalValue float64) RiskMetrics {
	// Calculate diversification score based on number of assets and allocation spread
	diversification := s.calculateDiversificationScore(portfolioAssets, totalValue)

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
	// Approximate Sharpe Ratio. Requires performance service ideally, or we do a simple fallback.
	// For simplicity, we fallback to 0.0 if not computed elsewhere, or rely on the PerformanceService.
	// Since PortfolioService focuses on standard analytics, we retrieve via PerformanceRepo if available.

	return RiskMetrics{
		Volatility:      volatility,
		SharpeRatio:     sharpeRatio,
		MaxDrawdown:     maxDrawdown,
		Diversification: diversification,
	}
}

// calculateDiversificationScore calculates a diversification score (0-100)
func (s *PortfolioService) calculateDiversificationScore(portfolioAssets []model.PortfolioAsset, totalValue float64) float64 {
	if len(portfolioAssets) == 0 || totalValue == 0 {
		return 0
	}

	// Calculate Herfindahl-Hirschman Index (HHI) for concentration
	var hhi float64
	for _, asset := range portfolioAssets {
		assetValue := asset.Quantity * asset.AveragePurchasePrice
		marketShare := assetValue / totalValue
		hhi += marketShare * marketShare
	}

	// Convert HHI to diversification score (lower HHI = higher diversification)
	// HHI ranges from 1/n to 1, where n is number of assets
	// We convert this to a 0-100 scale where 100 is perfectly diversified
	maxHHI := 1.0
	minHHI := 1.0 / float64(len(portfolioAssets))

	if maxHHI == minHHI {
		return 100 // Single asset case
	}

	diversificationScore := ((maxHHI - hhi) / (maxHHI - minHHI)) * 100
	return math.Max(0, math.Min(100, diversificationScore))
}

// generatePerformanceHistory fetches actual performance history from snapshots
func (s *PortfolioService) generatePerformanceHistory(ctx context.Context, portfolioID string, currentValue float64) []PerformancePoint {
	now := time.Now()
	startDate := now.AddDate(0, 0, -30) // Last 30 days

	snapshots, err := s.uow.Performance().GetPerformanceSnapshots(ctx, portfolioID, startDate, now)
	history := make([]PerformancePoint, 0, len(snapshots))

	if err == nil && len(snapshots) > 0 {
		for _, snap := range snapshots {
			history = append(history, PerformancePoint{
				Date:  snap.SnapshotDate,
				Value: float64(snap.TotalValue) / 100.0,
			})
		}
		return history
	}

	// Graceful fallback to a single point if no history is computed yet
	history = append(history, PerformancePoint{
		Date:  now,
		Value: currentValue,
	})

	return history
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

// GetAssetAllocation calculates the asset allocation via PortfolioAnalytics
func (s *PortfolioService) GetAssetAllocation(ctx context.Context, portfolioID string) ([]AssetAllocation, error) {
	analytics, err := s.GetPortfolioAnalytics(ctx, portfolioID)
	if err != nil {
		return nil, err
	}
	var allocations []AssetAllocation
	for _, alloc := range analytics.AssetAllocation {
		allocations = append(allocations, alloc)
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
