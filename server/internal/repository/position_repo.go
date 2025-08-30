package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// PositionFilter defines filter criteria for position queries
type PositionFilter struct {
	PortfolioID  *uuid.UUID       `json:"portfolio_id,omitempty"`
	AssetID      *uuid.UUID       `json:"asset_id,omitempty"`
	AssetType    *model.AssetType `json:"asset_type,omitempty"`
	MinQuantity  *decimal.Decimal `json:"min_quantity,omitempty"`
	MaxQuantity  *decimal.Decimal `json:"max_quantity,omitempty"`
	HasCostBasis *bool            `json:"has_cost_basis,omitempty"`
	UpdatedAfter *time.Time       `json:"updated_after,omitempty"`
	Limit        *int             `json:"limit,omitempty"`
	Offset       *int             `json:"offset,omitempty"`
}

// PortfolioAggregation represents aggregated portfolio data
type PortfolioAggregation struct {
	PortfolioID    uuid.UUID               `json:"portfolio_id"`
	TotalPositions int                     `json:"total_positions"`
	TotalCostBasis *model.Money            `json:"total_cost_basis,omitempty"`
	AssetTypeCount map[model.AssetType]int `json:"asset_type_count"`
	LastUpdated    time.Time               `json:"last_updated"`
}

// AssetAllocation represents asset allocation data
type AssetAllocation struct {
	AssetType      model.AssetType `json:"asset_type"`
	PositionCount  int             `json:"position_count"`
	TotalQuantity  decimal.Decimal `json:"total_quantity"`
	TotalCostBasis *model.Money    `json:"total_cost_basis,omitempty"`
	Percentage     decimal.Decimal `json:"percentage"`
}

// IPositionRepository defines the interface for position repository operations
type IPositionRepository interface {
	IRepository[model.Position]

	// Enhanced CRUD operations
	GetByUUID(ctx context.Context, id uuid.UUID) (*model.Position, error)
	GetByPortfolioAndAsset(ctx context.Context, portfolioID, assetID uuid.UUID) (*model.Position, error)
	FindWithFilters(ctx context.Context, filter PositionFilter) ([]model.Position, error)
	CountWithFilters(ctx context.Context, filter PositionFilter) (int, error)

	// Portfolio aggregation queries
	GetPortfolioPositions(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error)
	GetPortfolioPositionsWithAssets(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error)
	GetPortfolioAggregation(ctx context.Context, portfolioID uuid.UUID) (*PortfolioAggregation, error)
	GetAssetAllocation(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error)

	// Position value calculations
	GetPositionsRequiringPriceUpdate(ctx context.Context, assetIDs []uuid.UUID) ([]model.Position, error)
	GetEmptyPositions(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error)

	// Batch operations
	CreateBatch(ctx context.Context, positions []model.Position) error
	UpdateBatch(ctx context.Context, positions []model.Position) error
	DeleteEmptyPositions(ctx context.Context, portfolioID uuid.UUID) error
}

// PositionRepository is the concrete implementation of IPositionRepository
type PositionRepository struct {
	*Repository[model.Position]
}

// NewPositionRepository creates a new PositionRepository
func NewPositionRepository(db bun.IDB) *PositionRepository {
	return &PositionRepository{
		Repository: NewRepository[model.Position](db),
	}
}

// GetByUUID retrieves a position by its UUID
func (r *PositionRepository) GetByUUID(ctx context.Context, id uuid.UUID) (*model.Position, error) {
	var position model.Position
	err := r.db.NewSelect().
		Model(&position).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &position, nil
}

// GetByPortfolioAndAsset retrieves a position by portfolio and asset IDs
func (r *PositionRepository) GetByPortfolioAndAsset(ctx context.Context, portfolioID, assetID uuid.UUID) (*model.Position, error) {
	var position model.Position
	err := r.db.NewSelect().
		Model(&position).
		Where("portfolio_id = ? AND asset_id = ?", portfolioID, assetID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return &position, nil
}

// FindWithFilters retrieves positions with multiple filter criteria
func (r *PositionRepository) FindWithFilters(ctx context.Context, filter PositionFilter) ([]model.Position, error) {
	query := r.db.NewSelect().Model((*model.Position)(nil))

	// Apply filters
	query = r.applyPositionFilters(query, filter)

	// Apply ordering - by updated_at DESC for most recent changes first
	query = query.Order("updated_at DESC")

	// Apply pagination
	if filter.Limit != nil && *filter.Limit > 0 {
		query = query.Limit(*filter.Limit)
	}
	if filter.Offset != nil && *filter.Offset > 0 {
		query = query.Offset(*filter.Offset)
	}

	var positions []model.Position
	err := query.Scan(ctx, &positions)
	return positions, err
}

// CountWithFilters returns the count of positions matching the filter criteria
func (r *PositionRepository) CountWithFilters(ctx context.Context, filter PositionFilter) (int, error) {
	query := r.db.NewSelect().Model((*model.Position)(nil))
	query = r.applyPositionFilters(query, filter)
	return query.Count(ctx)
}

// applyPositionFilters applies filter criteria to a query
func (r *PositionRepository) applyPositionFilters(query *bun.SelectQuery, filter PositionFilter) *bun.SelectQuery {
	if filter.PortfolioID != nil {
		query = query.Where("portfolio_id = ?", *filter.PortfolioID)
	}

	if filter.AssetID != nil {
		query = query.Where("asset_id = ?", *filter.AssetID)
	}

	if filter.AssetType != nil {
		query = query.Join("JOIN sigma_finance.assets a ON a.id = position.asset_id").
			Where("a.type = ?", *filter.AssetType)
	}

	if filter.MinQuantity != nil {
		query = query.Where("quantity >= ?", *filter.MinQuantity)
	}

	if filter.MaxQuantity != nil {
		query = query.Where("quantity <= ?", *filter.MaxQuantity)
	}

	if filter.HasCostBasis != nil {
		if *filter.HasCostBasis {
			query = query.Where("total_cost_basis IS NOT NULL")
		} else {
			query = query.Where("total_cost_basis IS NULL")
		}
	}

	if filter.UpdatedAfter != nil {
		query = query.Where("updated_at > ?", *filter.UpdatedAfter)
	}

	return query
}

// GetPortfolioPositions retrieves all positions for a portfolio
func (r *PositionRepository) GetPortfolioPositions(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error) {
	return r.FindWithFilters(ctx, PositionFilter{PortfolioID: &portfolioID})
}

// GetPortfolioPositionsWithAssets retrieves all positions for a portfolio with asset details
func (r *PositionRepository) GetPortfolioPositionsWithAssets(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error) {
	var positions []model.Position
	err := r.db.NewSelect().
		Model(&positions).
		Relation("Asset").
		Where("portfolio_id = ?", portfolioID).
		Order("asset.name ASC").
		Scan(ctx)
	return positions, err
}

// GetPortfolioAggregation calculates aggregated data for a portfolio
func (r *PositionRepository) GetPortfolioAggregation(ctx context.Context, portfolioID uuid.UUID) (*PortfolioAggregation, error) {
	// Get basic aggregation data
	var result struct {
		TotalPositions int       `bun:"total_positions"`
		TotalCostBasis *int64    `bun:"total_cost_basis"`
		LastUpdated    time.Time `bun:"last_updated"`
	}

	err := r.db.NewSelect().
		ColumnExpr("COUNT(*) as total_positions").
		ColumnExpr("SUM(total_cost_basis) as total_cost_basis").
		ColumnExpr("MAX(updated_at) as last_updated").
		Model((*model.Position)(nil)).
		Where("portfolio_id = ?", portfolioID).
		Scan(ctx, &result)
	if err != nil {
		return nil, err
	}

	// Get asset type breakdown
	var assetTypeCounts []struct {
		AssetType model.AssetType `bun:"asset_type"`
		Count     int             `bun:"count"`
	}

	err = r.db.NewSelect().
		ColumnExpr("a.type as asset_type, COUNT(*) as count").
		Model((*model.Position)(nil)).
		Join("JOIN sigma_finance.assets a ON a.id = position.asset_id").
		Where("position.portfolio_id = ?", portfolioID).
		Group("a.type").
		Scan(ctx, &assetTypeCounts)
	if err != nil {
		return nil, err
	}

	// Build asset type count map
	assetTypeCountMap := make(map[model.AssetType]int)
	for _, atc := range assetTypeCounts {
		assetTypeCountMap[atc.AssetType] = atc.Count
	}

	aggregation := &PortfolioAggregation{
		PortfolioID:    portfolioID,
		TotalPositions: result.TotalPositions,
		AssetTypeCount: assetTypeCountMap,
		LastUpdated:    result.LastUpdated,
	}

	if result.TotalCostBasis != nil {
		costBasis := model.Money(*result.TotalCostBasis)
		aggregation.TotalCostBasis = &costBasis
	}

	return aggregation, nil
}

// GetAssetAllocation calculates asset allocation for a portfolio
func (r *PositionRepository) GetAssetAllocation(ctx context.Context, portfolioID uuid.UUID) ([]AssetAllocation, error) {
	var allocations []struct {
		AssetType      model.AssetType `bun:"asset_type"`
		PositionCount  int             `bun:"position_count"`
		TotalQuantity  decimal.Decimal `bun:"total_quantity"`
		TotalCostBasis *int64          `bun:"total_cost_basis"`
	}

	err := r.db.NewSelect().
		ColumnExpr("a.type as asset_type").
		ColumnExpr("COUNT(*) as position_count").
		ColumnExpr("SUM(p.quantity) as total_quantity").
		ColumnExpr("SUM(p.total_cost_basis) as total_cost_basis").
		Model((*model.Position)(nil)).
		TableExpr("sigma_finance.positions p").
		Join("JOIN sigma_finance.assets a ON a.id = p.asset_id").
		Where("p.portfolio_id = ?", portfolioID).
		Group("a.type").
		Order("total_cost_basis DESC NULLS LAST").
		Scan(ctx, &allocations)
	if err != nil {
		return nil, err
	}

	// Calculate total cost basis for percentage calculations
	var totalCostBasis int64
	for _, alloc := range allocations {
		if alloc.TotalCostBasis != nil {
			totalCostBasis += *alloc.TotalCostBasis
		}
	}

	// Convert to result format with percentages
	result := make([]AssetAllocation, len(allocations))
	for i, alloc := range allocations {
		result[i] = AssetAllocation{
			AssetType:     alloc.AssetType,
			PositionCount: alloc.PositionCount,
			TotalQuantity: alloc.TotalQuantity,
		}

		if alloc.TotalCostBasis != nil {
			costBasis := model.Money(*alloc.TotalCostBasis)
			result[i].TotalCostBasis = &costBasis

			// Calculate percentage
			if totalCostBasis > 0 {
				percentage := decimal.NewFromInt(*alloc.TotalCostBasis).
					Div(decimal.NewFromInt(totalCostBasis)).
					Mul(decimal.NewFromInt(100))
				result[i].Percentage = percentage
			}
		}
	}

	return result, nil
}

// GetPositionsRequiringPriceUpdate retrieves positions for assets that need price updates
func (r *PositionRepository) GetPositionsRequiringPriceUpdate(ctx context.Context, assetIDs []uuid.UUID) ([]model.Position, error) {
	if len(assetIDs) == 0 {
		return []model.Position{}, nil
	}

	var positions []model.Position
	err := r.db.NewSelect().
		Model(&positions).
		Relation("Asset").
		Where("asset_id IN (?)", bun.In(assetIDs)).
		Where("quantity > 0").
		Order("portfolio_id, asset_id").
		Scan(ctx)

	return positions, err
}

// GetEmptyPositions retrieves positions with zero quantity
func (r *PositionRepository) GetEmptyPositions(ctx context.Context, portfolioID uuid.UUID) ([]model.Position, error) {
	zeroQuantity := decimal.Zero
	return r.FindWithFilters(ctx, PositionFilter{
		PortfolioID: &portfolioID,
		MaxQuantity: &zeroQuantity,
	})
}

// CreateBatch creates multiple positions in a single transaction
func (r *PositionRepository) CreateBatch(ctx context.Context, positions []model.Position) error {
	if len(positions) == 0 {
		return nil
	}

	// Set timestamps
	now := time.Now()
	for i := range positions {
		positions[i].CreatedAt = now
		positions[i].UpdatedAt = now
	}

	_, err := r.db.NewInsert().
		Model(&positions).
		Exec(ctx)

	return err
}

// UpdateBatch updates multiple positions in a single transaction
func (r *PositionRepository) UpdateBatch(ctx context.Context, positions []model.Position) error {
	if len(positions) == 0 {
		return nil
	}

	// Set update timestamps
	now := time.Now()
	for i := range positions {
		positions[i].UpdatedAt = now
	}

	// Use bulk update with ON CONFLICT for better performance
	_, err := r.db.NewInsert().
		Model(&positions).
		On("CONFLICT (id) DO UPDATE").
		Set("quantity = EXCLUDED.quantity").
		Set("ownership_percentage = EXCLUDED.ownership_percentage").
		Set("average_cost_basis = EXCLUDED.average_cost_basis").
		Set("total_cost_basis = EXCLUDED.total_cost_basis").
		Set("notes = EXCLUDED.notes").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)

	return err
}

// DeleteEmptyPositions removes positions with zero quantity
func (r *PositionRepository) DeleteEmptyPositions(ctx context.Context, portfolioID uuid.UUID) error {
	_, err := r.db.NewDelete().
		Model((*model.Position)(nil)).
		Where("portfolio_id = ? AND quantity = 0", portfolioID).
		Exec(ctx)

	return err
}
