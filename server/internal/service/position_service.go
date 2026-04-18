package service

import (
	"context"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/shopspring/decimal"
)

// PositionService provides business logic for position management operations
type PositionService struct {
	positionRepo repository.IPositionRepository
	assetRepo    repository.IAssetRepository
}

// NewPositionService creates a new PositionService instance
func NewPositionService(positionRepo repository.IPositionRepository, assetRepo repository.IAssetRepository) *PositionService {
	return &PositionService{
		positionRepo: positionRepo,
		assetRepo:    assetRepo,
	}
}

// IPositionService defines the interface for position management operations
type IPositionService interface {
	// Core CRUD operations
	CreatePosition(ctx context.Context, req CreatePositionRequest) (*model.Position, error)
	GetPosition(ctx context.Context, id string) (*model.Position, error)
	UpdatePosition(ctx context.Context, id string, req UpdatePositionRequest) (*model.Position, error)
	DeletePosition(ctx context.Context, id string) error

	// Query operations
	GetPortfolioPositions(ctx context.Context, portfolioID string) ([]*model.Position, error)
	GetPortfolioPositionsWithAssets(ctx context.Context, portfolioID string) ([]*model.Position, error)
	GetPositionByPortfolioAndAsset(ctx context.Context, portfolioID, assetID string) (*model.Position, error)

	// Value calculations
	CalculatePositionValue(ctx context.Context, position *model.Position, currentPrice *decimal.Decimal) (*model.PositionValue, error)
	CalculatePortfolioValue(ctx context.Context, portfolioID string, priceMap map[string]decimal.Decimal) (*PortfolioValue, error)

	// Portfolio analytics
	GetPortfolioAggregation(ctx context.Context, portfolioID string) (*repository.PortfolioAggregation, error)
	GetAssetAllocation(ctx context.Context, portfolioID string) ([]repository.AssetAllocation, error)

	// Position management
	UpdatePositionFromTransaction(ctx context.Context, positionID string, quantity decimal.Decimal, price decimal.Decimal, amount model.Money) error
	CleanupEmptyPositions(ctx context.Context, portfolioID string) error
}

// Request/Response structures

type CreatePositionRequest struct {
	PortfolioID         string           `json:"portfolio_id" validate:"required"`
	AssetID             string           `json:"asset_id" validate:"required"`
	Quantity            decimal.Decimal  `json:"quantity" validate:"required"`
	OwnershipPercentage *decimal.Decimal `json:"ownership_percentage,omitempty"`
	AverageCostBasis    *decimal.Decimal `json:"average_cost_basis,omitempty"`
	TotalCostBasis      *model.Money     `json:"total_cost_basis,omitempty"`
	Notes               *string          `json:"notes,omitempty"`
}

type UpdatePositionRequest struct {
	Quantity            *decimal.Decimal `json:"quantity,omitempty"`
	OwnershipPercentage *decimal.Decimal `json:"ownership_percentage,omitempty"`
	AverageCostBasis    *decimal.Decimal `json:"average_cost_basis,omitempty"`
	TotalCostBasis      *model.Money     `json:"total_cost_basis,omitempty"`
	Notes               *string          `json:"notes,omitempty"`
}

type PortfolioValue struct {
	PortfolioID        string                       `json:"portfolio_id"`
	TotalValue         model.Money                  `json:"total_value"`
	TotalCostBasis     model.Money                  `json:"total_cost_basis"`
	UnrealizedGainLoss model.Money                  `json:"unrealized_gain_loss"`
	PositionValues     []*model.PositionValue       `json:"position_values"`
	AssetAllocation    []repository.AssetAllocation `json:"asset_allocation"`
}

// CreatePosition creates a new position with validation
func (s *PositionService) CreatePosition(ctx context.Context, req CreatePositionRequest) (*model.Position, error) {
	// Validate required fields
	if req.PortfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if req.AssetID == "" {
		return nil, errors.New("asset ID is required")
	}
	if req.Quantity.IsNegative() {
		return nil, errors.New("quantity cannot be negative")
	}

	// Verify asset exists
	asset, err := s.assetRepo.GetByID(ctx, req.AssetID)
	if err != nil {
		return nil, fmt.Errorf("asset not found: %w", err)
	}

	// Check if position already exists for this portfolio and asset
	existing, err := s.positionRepo.GetByPortfolioAndAsset(ctx, req.PortfolioID, req.AssetID)
	if err == nil && existing != nil {
		return nil, errors.New("position already exists for this asset in the portfolio")
	}
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("failed to check existing position: %w", err)
	}

	// Create position model
	position := &model.Position{
		PortfolioID: req.PortfolioID,
		AssetID:     req.AssetID,
		Quantity:    req.Quantity,
	}

	// Set ownership percentage (default to 100%)
	if req.OwnershipPercentage != nil {
		position.OwnershipPercentage = *req.OwnershipPercentage
	} else {
		position.OwnershipPercentage = decimal.NewFromInt(100)
	}

	// Set cost basis if provided
	if req.AverageCostBasis != nil {
		position.AverageCostBasis = req.AverageCostBasis
	}
	if req.TotalCostBasis != nil {
		position.TotalCostBasis = req.TotalCostBasis
	}

	// Set notes if provided
	if req.Notes != nil && *req.Notes != "" {
		notes := *req.Notes
		position.Notes = &notes
	}

	// Validate the position
	if err := position.Validate(); err != nil {
		return nil, fmt.Errorf("position validation failed: %w", err)
	}

	// Create in repository
	createdPosition, err := s.positionRepo.Create(ctx, position)
	if err != nil {
		return nil, fmt.Errorf("failed to create position: %w", err)
	}

	// Load the asset relation
	createdPosition.Asset = asset

	return createdPosition, nil
}

// GetPosition retrieves a position by ID
func (s *PositionService) GetPosition(ctx context.Context, id string) (*model.Position, error) {
	if id == "" {
		return nil, errors.New("position ID is required")
	}

	position, err := s.positionRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	return position, nil
}

// UpdatePosition updates an existing position
func (s *PositionService) UpdatePosition(ctx context.Context, id string, req UpdatePositionRequest) (*model.Position, error) {
	if id == "" {
		return nil, errors.New("position ID is required")
	}

	// Get existing position
	position, err := s.positionRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	// Update fields if provided
	if req.Quantity != nil {
		if req.Quantity.IsNegative() {
			return nil, errors.New("quantity cannot be negative")
		}
		position.Quantity = *req.Quantity
	}

	if req.OwnershipPercentage != nil {
		position.OwnershipPercentage = *req.OwnershipPercentage
	}

	if req.AverageCostBasis != nil {
		position.AverageCostBasis = req.AverageCostBasis
	}

	if req.TotalCostBasis != nil {
		position.TotalCostBasis = req.TotalCostBasis
	}

	if req.Notes != nil {
		if *req.Notes == "" {
			position.Notes = nil
		} else {
			notes := *req.Notes
			position.Notes = &notes
		}
	}

	// Validate the updated position
	if err := position.Validate(); err != nil {
		return nil, fmt.Errorf("position validation failed: %w", err)
	}

	// Update in repository
	if err := s.positionRepo.Update(ctx, position); err != nil {
		return nil, fmt.Errorf("failed to update position: %w", err)
	}

	return position, nil
}

// DeletePosition removes a position
func (s *PositionService) DeletePosition(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("position ID is required")
	}

	// Check if position exists
	position, err := s.positionRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get position: %w", err)
	}

	// Use generic Delete method
	if err := s.positionRepo.Delete(ctx, position.ID); err != nil {
		return fmt.Errorf("failed to delete position: %w", err)
	}

	return nil
}

// GetPortfolioPositions retrieves all positions for a portfolio
func (s *PositionService) GetPortfolioPositions(ctx context.Context, portfolioID string) ([]*model.Position, error) {
	if portfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}

	positions, err := s.positionRepo.GetPortfolioPositions(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio positions: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Position, len(positions))
	for i := range positions {
		result[i] = &positions[i]
	}

	return result, nil
}

// GetPortfolioPositionsWithAssets retrieves all positions for a portfolio with asset details
func (s *PositionService) GetPortfolioPositionsWithAssets(ctx context.Context, portfolioID string) ([]*model.Position, error) {
	if portfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}

	positions, err := s.positionRepo.GetPortfolioPositionsWithAssets(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio positions with assets: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Position, len(positions))
	for i := range positions {
		result[i] = &positions[i]
	}

	return result, nil
}

// GetPositionByPortfolioAndAsset retrieves a position by portfolio and asset IDs
func (s *PositionService) GetPositionByPortfolioAndAsset(ctx context.Context, portfolioID, assetID string) (*model.Position, error) {
	if portfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if assetID == "" {
		return nil, errors.New("asset ID is required")
	}

	position, err := s.positionRepo.GetByPortfolioAndAsset(ctx, portfolioID, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	return position, nil
}

// CalculatePositionValue calculates the current value of a position
func (s *PositionService) CalculatePositionValue(ctx context.Context, position *model.Position, currentPrice *decimal.Decimal) (*model.PositionValue, error) {
	if position == nil {
		return nil, errors.New("position is required")
	}

	// Use the position's built-in calculation method
	value := position.CalculateValue(currentPrice)

	return value, nil
}

// CalculatePortfolioValue calculates the total value of a portfolio
func (s *PositionService) CalculatePortfolioValue(ctx context.Context, portfolioID string, priceMap map[string]decimal.Decimal) (*PortfolioValue, error) {
	if portfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}

	// Get all positions with assets
	positions, err := s.GetPortfolioPositionsWithAssets(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio positions: %w", err)
	}

	portfolioValue := &PortfolioValue{
		PortfolioID:    portfolioID,
		PositionValues: make([]*model.PositionValue, 0, len(positions)),
	}

	var totalValue model.Money
	var totalCostBasis model.Money

	// Calculate value for each position
	for _, position := range positions {
		var currentPrice *decimal.Decimal
		if priceMap != nil {
			if price, exists := priceMap[position.AssetID]; exists {
				currentPrice = &price
			}
		}

		positionValue := position.CalculateValue(currentPrice)
		portfolioValue.PositionValues = append(portfolioValue.PositionValues, positionValue)

		totalValue += positionValue.CurrentValue
		if position.TotalCostBasis != nil {
			totalCostBasis += *position.TotalCostBasis
		}
	}

	portfolioValue.TotalValue = totalValue
	portfolioValue.TotalCostBasis = totalCostBasis
	portfolioValue.UnrealizedGainLoss = totalValue - totalCostBasis

	// Get asset allocation
	allocation, err := s.GetAssetAllocation(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset allocation: %w", err)
	}
	portfolioValue.AssetAllocation = allocation

	return portfolioValue, nil
}

// GetPortfolioAggregation calculates aggregated data for a portfolio
func (s *PositionService) GetPortfolioAggregation(ctx context.Context, portfolioID string) (*repository.PortfolioAggregation, error) {
	if portfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}

	aggregation, err := s.positionRepo.GetPortfolioAggregation(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get portfolio aggregation: %w", err)
	}

	return aggregation, nil
}

// GetAssetAllocation calculates asset allocation for a portfolio
func (s *PositionService) GetAssetAllocation(ctx context.Context, portfolioID string) ([]repository.AssetAllocation, error) {
	if portfolioID == "" {
		return nil, errors.New("portfolio ID is required")
	}

	allocation, err := s.positionRepo.GetAssetAllocation(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset allocation: %w", err)
	}

	return allocation, nil
}

// UpdatePositionFromTransaction updates a position based on a transaction
func (s *PositionService) UpdatePositionFromTransaction(ctx context.Context, positionID string, quantity decimal.Decimal, price decimal.Decimal, amount model.Money) error {
	if positionID == "" {
		return errors.New("position ID is required")
	}

	// Get the position
	position, err := s.positionRepo.GetByID(ctx, positionID)
	if err != nil {
		return fmt.Errorf("failed to get position: %w", err)
	}

	// Update cost basis using the position's business logic
	if err := position.UpdateCostBasis(quantity, price, amount); err != nil {
		return fmt.Errorf("failed to update cost basis: %w", err)
	}

	// Save the updated position
	if err := s.positionRepo.Update(ctx, position); err != nil {
		return fmt.Errorf("failed to save updated position: %w", err)
	}

	return nil
}

// CleanupEmptyPositions removes positions with zero quantity
func (s *PositionService) CleanupEmptyPositions(ctx context.Context, portfolioID string) error {
	if portfolioID == "" {
		return errors.New("portfolio ID is required")
	}

	if err := s.positionRepo.DeleteEmptyPositions(ctx, portfolioID); err != nil {
		return fmt.Errorf("failed to cleanup empty positions: %w", err)
	}

	return nil
}
