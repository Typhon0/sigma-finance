package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"time"
)

var (
	ErrPortfolioNameExists = errors.New("portfolio with this name already exists for the user")
)

// IPortfolioService defines the interface for portfolio-related services.
type IPortfolioService interface {
	GetByID(ctx context.Context, id uint) (model.Portfolio, error)
	FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error)
	CreatePortfolio(ctx context.Context, input CreatePortfolioInput) (model.Portfolio, error)
	UpdatePortfolio(ctx context.Context, id uint, input UpdatePortfolioInput) (model.Portfolio, error)
	DeletePortfolio(ctx context.Context, id uint) error
	AddAssetToPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error)
	UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error)
	RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID uint) error
	TagPortfolio(ctx context.Context, portfolioID, tagID uint) error
	UntagPortfolio(ctx context.Context, portfolioID, tagID uint) error
	GetPortfolioAssets(ctx context.Context, portfolioID uint) ([]model.PortfolioAsset, error)

	// Enhanced functionality
	DuplicatePortfolio(ctx context.Context, input DuplicatePortfolioInput) (model.Portfolio, error)
	ReorderPortfolios(ctx context.Context, userID uint, orders []PortfolioOrderInput) ([]model.Portfolio, error)
	GetPortfoliosByUser(ctx context.Context, userID uint, orderBy string) ([]model.Portfolio, error)
	GetPortfolioAnalytics(ctx context.Context, portfolioID uint) (PortfolioAnalytics, error)
	GetPortfolioHistory(ctx context.Context, portfolioID uint, period string) (PortfolioHistory, error)
	GetAssetAllocation(ctx context.Context, portfolioID uint) ([]AssetAllocation, error)
	GetPerformanceVsBenchmark(ctx context.Context, portfolioID uint, benchmarkSymbol string) (PerformanceBenchmark, error)
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

// --- Input Structs for Service Methods (keeps method signatures clean) ---

type CreatePortfolioInput struct {
	UserID      uint
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
	SourcePortfolioID uint   `validate:"required"`
	NewName           string `validate:"required,min=3,max=100"`
	Description       string `validate:"max=500"`
	CopyAssets        bool
}

// PortfolioOrderInput represents the input for reordering portfolios
type PortfolioOrderInput struct {
	PortfolioID uint `validate:"required"`
	SortOrder   int  `validate:"min=0"`
}

// PortfolioAnalytics represents comprehensive portfolio performance metrics
type PortfolioAnalytics struct {
	PortfolioID          int                `json:"portfolioId"`
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
	PortfolioHistory []PortfolioDataPoint
	BenchmarkHistory []PortfolioDataPoint
}

// --- Method Implementations ---

// GetByID retrieves a single portfolio by its primary key.
// This is a simple pass-through to the repository.
func (s *PortfolioService) GetByID(ctx context.Context, id uint) (model.Portfolio, error) {
	return s.uow.Portfolio().GetByID(ctx, id)
}

// FindAll retrieves a list of portfolios based on a dynamic set of query options.
// This method also passes the options directly to the repository layer.
func (s *PortfolioService) FindAll(ctx context.Context, opts ...repository.QueryOption) ([]model.Portfolio, error) {
	return s.uow.Portfolio().FindAllBy(ctx, opts...)
}

// CreatePortfolio creates a new portfolio for a user, ensuring the operation is atomic.
func (s *PortfolioService) CreatePortfolio(ctx context.Context, input CreatePortfolioInput) (model.Portfolio, error) {
	var portfolio model.Portfolio

	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// Check if a portfolio with the same name already exists for this user
		existing, err := uow.Portfolio().GetPortfolioByName(ctx, input.UserID, input.Name)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check for existing portfolio: %w", err)
		}
		if existing != nil && existing.ID != 0 {
			return ErrPortfolioNameExists
		}

		// Get the highest sort order for the user's portfolios and add 1
		maxSortOrder, err := uow.Portfolio().GetMaxSortOrder(ctx, input.UserID)
		if err != nil {
			return fmt.Errorf("failed to get max sort order: %w", err)
		}

		var description string
		if input.Description != nil {
			description = *input.Description
		}

		newPortfolio := model.Portfolio{
			UserID:      int(input.UserID),
			Name:        input.Name,
			Description: description,
			SortOrder:   maxSortOrder + 1,
		}

		createdPortfolio, err := uow.Portfolio().Create(ctx, &newPortfolio)
		if err != nil {
			return fmt.Errorf("failed to create portfolio in repository: %w", err)
		}
		portfolio = *createdPortfolio
		return nil
	})

	if err != nil {
		return model.Portfolio{}, err
	}

	return portfolio, nil
}

// UpdatePortfolio updates an existing portfolio's details.
func (s *PortfolioService) UpdatePortfolio(ctx context.Context, id uint, input UpdatePortfolioInput) (model.Portfolio, error) {
	// 1. --- Retrieve Existing Entity ---
	portfolioToUpdate, err := s.uow.Portfolio().GetByID(ctx, id)
	if err != nil {
		// The error from the repo (e.g., ErrNotFound) is returned directly.
		return model.Portfolio{}, err
	}

	// 2. --- Apply Changes ---
	if input.Name != nil {
		// Validation
		if len(*input.Name) < 3 {
			return model.Portfolio{}, errors.New("portfolio name must be at least 3 characters long")
		}
		portfolioToUpdate.Name = *input.Name
	}

	if input.Description != nil {
		portfolioToUpdate.Description = *input.Description
	}

	if input.SortOrder != nil {
		// Validation for sort order (should be non-negative)
		if *input.SortOrder < 0 {
			return model.Portfolio{}, errors.New("sort order must be non-negative")
		}
		portfolioToUpdate.SortOrder = *input.SortOrder
	}
	// Note: The UpdatedAt field is typically handled by the database or ORM hook.

	// 3. --- Persistence ---
	err = s.uow.Portfolio().Update(ctx, &portfolioToUpdate)
	if err != nil {
		return model.Portfolio{}, fmt.Errorf("failed to update portfolio: %w", err)
	}

	return portfolioToUpdate, nil
}

// DeletePortfolio handles the removal of a portfolio.
func (s *PortfolioService) DeletePortfolio(ctx context.Context, id uint) error {
	// Use transaction to ensure cascade deletion is atomic
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		portfolioID := int(id) // Convert uint to int for repository calls

		// 1. Check if portfolio exists
		_, err := uow.Portfolio().GetByID(ctx, id)
		if err != nil {
			return fmt.Errorf("portfolio not found: %w", err)
		}

		// 2. Get all portfolio assets to delete them first
		portfolioAssets, err := uow.PortfolioAsset().FindByPortfolioID(ctx, portfolioID)
		if err != nil {
			return fmt.Errorf("failed to get portfolio assets: %w", err)
		}

		// 3. Delete all portfolio assets by using the database directly since they have composite keys
		for _, asset := range portfolioAssets {
			err := uow.PortfolioAsset().DeleteByPortfolioAndAsset(ctx, asset.PortfolioID, asset.AssetID)
			if err != nil {
				return fmt.Errorf("failed to delete portfolio asset %d-%d: %w", asset.PortfolioID, asset.AssetID, err)
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
func (s *PortfolioService) AddAssetToPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error) {
	// 1. --- Validation ---
	if quantity <= 0 {
		return model.PortfolioAsset{}, errors.New("quantity must be positive")
	}

	// 2. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Asset().GetByID(ctx, assetID); err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("asset with ID %d not found", assetID)
	}

	// 3. --- Check if asset already exists in portfolio ---
	_, err := s.uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, int(portfolioID), int(assetID))
	if err == nil {
		return model.PortfolioAsset{}, errors.New("asset already exists in portfolio")
	}
	if !errors.Is(err, repository.ErrNotFound) {
		return model.PortfolioAsset{}, fmt.Errorf("failed to check existing portfolio asset: %w", err)
	}

	// 4. --- Create and Persist Join Table Record ---
	portfolioAsset := model.PortfolioAsset{
		PortfolioID:          int(portfolioID),
		AssetID:              int(assetID),
		Quantity:             quantity,
		AveragePurchasePrice: price,
	}

	createdPortfolioAsset, err := s.uow.PortfolioAsset().Create(ctx, &portfolioAsset)
	if err != nil {
		return model.PortfolioAsset{}, fmt.Errorf("failed to add asset to portfolio: %w", err)
	}

	return *createdPortfolioAsset, nil
}

// UpdateAssetInPortfolio handles updating an asset's quantity and price in a portfolio.
func (s *PortfolioService) UpdateAssetInPortfolio(ctx context.Context, portfolioID, assetID uint, quantity float64, price float64) (model.PortfolioAsset, error) {
	// 1. --- Validation ---
	if quantity <= 0 {
		return model.PortfolioAsset{}, errors.New("quantity must be positive")
	}

	var updatedPortfolioAsset *model.PortfolioAsset
	err := s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 2. --- Check Existence of Portfolio and Asset ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %d not found", portfolioID)
		}
		if _, err := uow.Asset().GetByID(ctx, assetID); err != nil {
			return fmt.Errorf("asset with ID %d not found", assetID)
		}

		// 3. --- Find Existing Portfolio Asset ---
		existing, err := uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, int(portfolioID), int(assetID))
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
		return model.PortfolioAsset{}, err
	}

	return *updatedPortfolioAsset, nil
}

// RemoveAssetFromPortfolio handles removing an asset from a portfolio.
func (s *PortfolioService) RemoveAssetFromPortfolio(ctx context.Context, portfolioID, assetID uint) error {
	// 1. --- Check Existence of Portfolio and Asset ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}
	if _, err := s.uow.Asset().GetByID(ctx, assetID); err != nil {
		return fmt.Errorf("asset with ID %d not found", assetID)
	}

	// 2. --- Remove Portfolio Asset ---
	err := s.uow.PortfolioAsset().DeleteByPortfolioAndAsset(ctx, int(portfolioID), int(assetID))
	if err != nil {
		return fmt.Errorf("failed to remove asset from portfolio: %w", err)
	}

	return nil
}

// TagPortfolio handles adding a tag to a portfolio.
func (s *PortfolioService) TagPortfolio(ctx context.Context, portfolioID, tagID uint) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 1. --- Check Existence of Portfolio and Tag ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %d not found", portfolioID)
		}
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			return fmt.Errorf("tag with ID %d not found", tagID)
		}

		// 2. --- Check if tag already exists on portfolio ---
		existing, err := uow.PortfolioTag().FindByPortfolioID(ctx, portfolioID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("failed to check existing portfolio tag: %w", err)
		}
		for _, pt := range existing {
			if pt.TagID == int(tagID) {
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
func (s *PortfolioService) UntagPortfolio(ctx context.Context, portfolioID, tagID uint) error {
	return s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		// 1. --- Check Existence of Portfolio and Tag ---
		if _, err := uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
			return fmt.Errorf("portfolio with ID %d not found", portfolioID)
		}
		if _, err := uow.Tag().GetByID(ctx, tagID); err != nil {
			return fmt.Errorf("tag with ID %d not found", tagID)
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
func (s *PortfolioService) GetPortfolioAssets(ctx context.Context, portfolioID uint) ([]model.PortfolioAsset, error) {
	// 1. --- Check Existence of Portfolio ---
	if _, err := s.uow.Portfolio().GetByID(ctx, portfolioID); err != nil {
		return nil, fmt.Errorf("portfolio with ID %d not found", portfolioID)
	}

	// 2. --- Get Portfolio Assets ---
	portfolioAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, int(portfolioID))
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio assets: %w", err)
	}

	return portfolioAssets, nil
}

// DuplicatePortfolio creates a copy of an existing portfolio with optional asset copying
func (s *PortfolioService) DuplicatePortfolio(ctx context.Context, input DuplicatePortfolioInput) (model.Portfolio, error) {
	// 1. --- Input Validation ---
	if len(input.NewName) < 3 {
		return model.Portfolio{}, errors.New("portfolio name must be at least 3 characters long")
	}
	if len(input.NewName) > 100 {
		return model.Portfolio{}, errors.New("portfolio name must be less than 100 characters")
	}
	if len(input.Description) > 500 {
		return model.Portfolio{}, errors.New("description must be less than 500 characters")
	}

	// 2. --- Get Source Portfolio ---
	sourcePortfolio, err := s.uow.Portfolio().GetByID(ctx, input.SourcePortfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return model.Portfolio{}, fmt.Errorf("source portfolio with ID %d not found", input.SourcePortfolioID)
		}
		return model.Portfolio{}, fmt.Errorf("failed to retrieve source portfolio: %w", err)
	}

	// 3. --- Check for Duplicate Name ---
	existingPortfolios, err := s.uow.Portfolio().FindAllBy(ctx,
		repository.ByColumn("user_id", sourcePortfolio.UserID),
		repository.ByColumn("name", input.NewName),
	)
	if err != nil {
		return model.Portfolio{}, fmt.Errorf("failed to check for duplicate portfolio name: %w", err)
	}
	if len(existingPortfolios) > 0 {
		return model.Portfolio{}, errors.New("portfolio name already exists for this user")
	}

	// 4. --- Get Next Sort Order ---
	userPortfolios, err := s.uow.Portfolio().FindAllBy(ctx,
		repository.ByColumn("user_id", sourcePortfolio.UserID),
	)
	if err != nil {
		return model.Portfolio{}, fmt.Errorf("failed to get user portfolios for sort order: %w", err)
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
		return model.Portfolio{}, fmt.Errorf("failed to create duplicated portfolio: %w", err)
	}

	// 6. --- Copy Assets if Requested ---
	if input.CopyAssets {
		sourceAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, int(input.SourcePortfolioID))
		if err != nil {
			return model.Portfolio{}, fmt.Errorf("failed to get source portfolio assets: %w", err)
		}

		for _, sourceAsset := range sourceAssets {
			newPortfolioAsset := model.PortfolioAsset{
				PortfolioID:          createdPortfolio.ID,
				AssetID:              sourceAsset.AssetID,
				Quantity:             sourceAsset.Quantity,
				AveragePurchasePrice: sourceAsset.AveragePurchasePrice,
			}

			_, err := s.uow.PortfolioAsset().Create(ctx, &newPortfolioAsset)
			if err != nil {
				// If asset copying fails, we should still return the created portfolio
				// but log the error for debugging
				fmt.Printf("Warning: failed to copy asset %d to new portfolio: %v\n", sourceAsset.AssetID, err)
			}
		}
	}

	return *createdPortfolio, nil
}

// ReorderPortfolios updates the sort order of multiple portfolios for a user
func (s *PortfolioService) ReorderPortfolios(ctx context.Context, userID uint, orders []PortfolioOrderInput) ([]model.Portfolio, error) {
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
	var portfolioIDs []uint
	for _, order := range orders {
		portfolioIDs = append(portfolioIDs, order.PortfolioID)
	}

	// Get all portfolios to verify ownership
	var updatedPortfolios []model.Portfolio
	for _, order := range orders {
		portfolio, err := s.uow.Portfolio().GetByID(ctx, order.PortfolioID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return nil, fmt.Errorf("portfolio with ID %d not found", order.PortfolioID)
			}
			return nil, fmt.Errorf("failed to retrieve portfolio %d: %w", order.PortfolioID, err)
		}

		// Verify user ownership
		if portfolio.UserID != int(userID) {
			return nil, fmt.Errorf("portfolio %d does not belong to user %d", order.PortfolioID, userID)
		}

		// Update sort order
		portfolio.SortOrder = order.SortOrder
		err = s.uow.Portfolio().Update(ctx, &portfolio)
		if err != nil {
			return nil, fmt.Errorf("failed to update portfolio %d sort order: %w", order.PortfolioID, err)
		}

		updatedPortfolios = append(updatedPortfolios, portfolio)
	}

	return updatedPortfolios, nil
}

// GetPortfoliosByUser retrieves all portfolios for a user with custom ordering
func (s *PortfolioService) GetPortfoliosByUser(ctx context.Context, userID uint, orderBy string) ([]model.Portfolio, error) {
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
		return nil, fmt.Errorf("failed to retrieve portfolios for user %d: %w", userID, err)
	}

	return portfolios, nil
}

// GetPortfolioAnalytics calculates comprehensive analytics for a portfolio
func (s *PortfolioService) GetPortfolioAnalytics(ctx context.Context, portfolioID uint) (PortfolioAnalytics, error) {
	// 1. --- Verify Portfolio Exists ---
	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return PortfolioAnalytics{}, fmt.Errorf("portfolio with ID %d not found", portfolioID)
		}
		return PortfolioAnalytics{}, fmt.Errorf("failed to retrieve portfolio: %w", err)
	}

	// 2. --- Get Portfolio Assets ---
	portfolioAssets, err := s.uow.PortfolioAsset().FindByPortfolioID(ctx, int(portfolioID))
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
		// For this implementation, we'll use the average purchase price as current value
		// In a real implementation, you'd fetch current market prices
		currentValue := portfolioAsset.Quantity * portfolioAsset.AveragePurchasePrice
		cost := portfolioAsset.Quantity * portfolioAsset.AveragePurchasePrice

		totalValue += currentValue
		totalCost += cost

		// Get asset details for type classification
		// For now, we'll use a placeholder asset type
		assetType := "UNKNOWN"

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
	analytics.RiskMetrics = s.calculateRiskMetrics(portfolioAssets, totalValue)

	// 8. --- Generate Performance History (placeholder) ---
	analytics.PerformanceHistory = s.generatePerformanceHistory(portfolio.ID, totalValue)

	return analytics, nil
}

// calculateRiskMetrics calculates risk-related metrics for the portfolio
func (s *PortfolioService) calculateRiskMetrics(portfolioAssets []model.PortfolioAsset, totalValue float64) RiskMetrics {
	// Placeholder implementation - in a real system, you'd use historical price data

	// Calculate diversification score based on number of assets and allocation spread
	diversification := s.calculateDiversificationScore(portfolioAssets, totalValue)

	return RiskMetrics{
		Volatility:      0.15, // Placeholder: 15% volatility
		SharpeRatio:     0.8,  // Placeholder: 0.8 Sharpe ratio
		MaxDrawdown:     0.12, // Placeholder: 12% max drawdown
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

// generatePerformanceHistory generates placeholder performance history
func (s *PortfolioService) generatePerformanceHistory(portfolioID int, currentValue float64) []PerformancePoint {
	// Placeholder implementation - in a real system, you'd query historical data
	now := time.Now()
	history := make([]PerformancePoint, 0, 30) // Last 30 days

	for i := 29; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		// Generate some sample variation around current value
		variation := 1.0 + (float64(i%7-3) * 0.02) // ±6% variation
		value := currentValue * variation

		history = append(history, PerformancePoint{
			Date:  date,
			Value: value,
		})
	}

	return history
}

// GetPerformanceVsBenchmark is not implemented
func (s *PortfolioService) GetPerformanceVsBenchmark(ctx context.Context, portfolioID uint, benchmarkSymbol string) (PerformanceBenchmark, error) {
	panic("unimplemented")
}

// GetAssetAllocation is not implemented
func (s *PortfolioService) GetAssetAllocation(ctx context.Context, portfolioID uint) ([]AssetAllocation, error) {
	panic("unimplemented")
}

// GetPortfolioHistory is not implemented
func (s *PortfolioService) GetPortfolioHistory(ctx context.Context, portfolioID uint, period string) (PortfolioHistory, error) {
	panic("unimplemented")
}
