package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// AssetFilter defines filter criteria for asset queries
type AssetFilter struct {
	AssetType        *model.AssetType `json:"asset_type,omitempty"`
	IsTradeable      *bool            `json:"is_tradeable,omitempty"`
	Symbol           *string          `json:"symbol,omitempty"`
	MarketDataSource *string          `json:"market_data_source,omitempty"`
	SearchTerm       *string          `json:"search_term,omitempty"`
	Limit            *int             `json:"limit,omitempty"`
	Offset           *int             `json:"offset,omitempty"`
}

// IAssetRepository defines the interface for asset repository operations.
type IAssetRepository interface {
	IRepository[model.Asset]

	// Enhanced CRUD operations
	GetBySymbol(ctx context.Context, symbol string) (*model.Asset, error)
	GetByInstrumentID(ctx context.Context, instrumentID string) (*model.Asset, error)
	UpsertTradeable(ctx context.Context, asset *model.Asset) (*model.Asset, error)
	FindWithFilters(ctx context.Context, filter AssetFilter) ([]model.Asset, error)
	CountWithFilters(ctx context.Context, filter AssetFilter) (int, error)

	// Metadata queries
	GetAssetsByType(ctx context.Context, assetType model.AssetType) ([]model.Asset, error)
	GetTradeableAssets(ctx context.Context) ([]model.Asset, error)
	SearchAssetsByName(ctx context.Context, searchTerm string, limit int) ([]model.Asset, error)
	GetAssetsByMetadataField(ctx context.Context, field string, value interface{}) ([]model.Asset, error)

	// Batch operations
	CreateBatch(ctx context.Context, assets []model.Asset) error
	UpdateBatch(ctx context.Context, assets []model.Asset) error

	// Legacy methods for compatibility
	GetAssetTypes(ctx context.Context) ([]model.AssetType, error)
	GetAssetsByTag(ctx context.Context, tagID string) ([]model.Asset, error)
}

// AssetRepository is the concrete implementation of IAssetRepository.
type AssetRepository struct {
	*Repository[model.Asset]
}

// NewAssetRepository creates a new AssetRepository.
func NewAssetRepository(db bun.IDB) *AssetRepository {
	return &AssetRepository{
		Repository: NewRepository[model.Asset](db),
	}
}

// GetBySymbol retrieves an asset by its symbol
func (r *AssetRepository) GetBySymbol(ctx context.Context, symbol string) (*model.Asset, error) {
	var asset model.Asset
	err := r.db.NewSelect().
		Model(&asset).
		Where("symbol = ? AND is_tradeable = true", symbol).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &asset, nil
}

// GetByInstrumentID retrieves an asset by its linked instrument ID.
func (r *AssetRepository) GetByInstrumentID(ctx context.Context, instrumentID string) (*model.Asset, error) {
	var asset model.Asset
	err := r.db.NewSelect().
		Model(&asset).
		Where("instrument_id = ?", instrumentID).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &asset, nil
}

// UpsertTradeable inserts a tradeable asset or updates the existing one on
// unique_tradeable_symbol conflict (symbol WHERE is_tradeable = true).
// This avoids PostgreSQL transaction poisoning from failed INSERTs.
func (r *AssetRepository) UpsertTradeable(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	now := time.Now()
	if asset.CreatedAt.IsZero() {
		asset.CreatedAt = now
	}
	asset.UpdatedAt = now

	err := r.db.NewInsert().
		Model(asset).
		ModelTableExpr("sigma_finance.assets AS assets").
		On("CONFLICT (symbol) WHERE is_tradeable = true DO UPDATE").
		Set("instrument_id = COALESCE(EXCLUDED.instrument_id, assets.instrument_id)").
		Set("name = EXCLUDED.name").
		Set("type = EXCLUDED.type").
		Set("is_tradeable = EXCLUDED.is_tradeable").
		Set("updated_at = EXCLUDED.updated_at").
		Returning("*").
		Scan(ctx, asset)
	if err != nil {
		return nil, err
	}
	return asset, nil
}

// FindWithFilters retrieves assets with multiple filter criteria
func (r *AssetRepository) FindWithFilters(ctx context.Context, filter AssetFilter) ([]model.Asset, error) {
	query := r.db.NewSelect().Model((*model.Asset)(nil))

	// Apply filters
	query = r.applyAssetFilters(query, filter)

	// Apply ordering - prioritize tradeable assets, then by name
	query = query.OrderExpr("is_tradeable DESC, name ASC")

	// Apply pagination
	if filter.Limit != nil && *filter.Limit > 0 {
		query = query.Limit(*filter.Limit)
	}
	if filter.Offset != nil && *filter.Offset > 0 {
		query = query.Offset(*filter.Offset)
	}

	var assets []model.Asset
	err := query.Scan(ctx, &assets)
	return assets, err
}

// CountWithFilters returns the count of assets matching the filter criteria
func (r *AssetRepository) CountWithFilters(ctx context.Context, filter AssetFilter) (int, error) {
	query := r.db.NewSelect().Model((*model.Asset)(nil))
	query = r.applyAssetFilters(query, filter)
	return query.Count(ctx)
}

// applyAssetFilters applies filter criteria to a query
func (r *AssetRepository) applyAssetFilters(query *bun.SelectQuery, filter AssetFilter) *bun.SelectQuery {
	if filter.AssetType != nil {
		query = query.Where("type = ?", *filter.AssetType)
	}

	if filter.IsTradeable != nil {
		query = query.Where("is_tradeable = ?", *filter.IsTradeable)
	}

	if filter.Symbol != nil {
		query = query.Where("symbol = ?", *filter.Symbol)
	}

	if filter.MarketDataSource != nil {
		query = query.Where("market_data_source = ?", *filter.MarketDataSource)
	}

	if filter.SearchTerm != nil && *filter.SearchTerm != "" {
		searchPattern := "%" + *filter.SearchTerm + "%"
		query = query.Where("(name ILIKE ? OR symbol ILIKE ? OR description ILIKE ?)",
			searchPattern, searchPattern, searchPattern)
	}

	return query
}

// GetAssetsByType retrieves all assets of a specific type
func (r *AssetRepository) GetAssetsByType(ctx context.Context, assetType model.AssetType) ([]model.Asset, error) {
	return r.FindWithFilters(ctx, AssetFilter{AssetType: &assetType})
}

// GetTradeableAssets retrieves all tradeable assets
func (r *AssetRepository) GetTradeableAssets(ctx context.Context) ([]model.Asset, error) {
	tradeable := true
	return r.FindWithFilters(ctx, AssetFilter{IsTradeable: &tradeable})
}

// SearchAssetsByName searches assets by name with fuzzy matching
func (r *AssetRepository) SearchAssetsByName(ctx context.Context, searchTerm string, limit int) ([]model.Asset, error) {
	return r.FindWithFilters(ctx, AssetFilter{
		SearchTerm: &searchTerm,
		Limit:      &limit,
	})
}

// GetAssetsByMetadataField retrieves assets that have a specific metadata field with a given value
func (r *AssetRepository) GetAssetsByMetadataField(ctx context.Context, field string, value interface{}) ([]model.Asset, error) {
	var assets []model.Asset

	// Convert value to JSON for JSONB query
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}

	err = r.db.NewSelect().
		Model(&assets).
		Where("metadata->? = ?", field, string(valueJSON)).
		Order("name ASC").
		Scan(ctx)

	return assets, err
}

// CreateBatch creates multiple assets in a single transaction
func (r *AssetRepository) CreateBatch(ctx context.Context, assets []model.Asset) error {
	if len(assets) == 0 {
		return nil
	}

	// Set timestamps
	now := time.Now()
	for i := range assets {
		assets[i].CreatedAt = now
		assets[i].UpdatedAt = now
	}

	_, err := r.db.NewInsert().
		Model(&assets).
		Exec(ctx)

	return err
}

// UpdateBatch updates multiple assets in a single transaction
func (r *AssetRepository) UpdateBatch(ctx context.Context, assets []model.Asset) error {
	if len(assets) == 0 {
		return nil
	}

	// Set update timestamps
	now := time.Now()
	for i := range assets {
		assets[i].UpdatedAt = now
	}

	// Use bulk update with ON CONFLICT for better performance
	_, err := r.db.NewInsert().
		Model(&assets).
		On("CONFLICT (id) DO UPDATE").
		Set("type = EXCLUDED.type").
		Set("symbol = EXCLUDED.symbol").
		Set("name = EXCLUDED.name").
		Set("description = EXCLUDED.description").
		Set("metadata = EXCLUDED.metadata").
		Set("is_tradeable = EXCLUDED.is_tradeable").
		Set("market_data_source = EXCLUDED.market_data_source").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)

	return err
}

// Legacy methods for compatibility

// GetAssetTypes retrieves all asset types.
func (r *AssetRepository) GetAssetTypes(ctx context.Context) ([]model.AssetType, error) {
	var assetTypes []model.AssetType
	err := r.db.NewSelect().
		ColumnExpr("DISTINCT type").
		Model((*model.Asset)(nil)).
		Scan(ctx, &assetTypes)
	if err != nil {
		return nil, err
	}
	return assetTypes, nil
}

// GetAssetsByTag retrieves all assets associated with a given tag.
func (r *AssetRepository) GetAssetsByTag(ctx context.Context, tagID string) ([]model.Asset, error) {
	var assets []model.Asset
	err := r.db.NewSelect().
		Model(&assets).
		Join("JOIN sigma_finance.asset_tag at ON at.asset_id = assets.id").
		Where("at.tag_id = ?", tagID).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []model.Asset{}, nil
		}
		return nil, err
	}
	return assets, nil
}
