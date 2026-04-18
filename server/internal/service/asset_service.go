package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"strings"
)

// AssetService provides business logic for asset management operations
type AssetService struct {
	assetRepo repository.IAssetRepository
}

// NewAssetService creates a new AssetService instance
func NewAssetService(assetRepo repository.IAssetRepository) *AssetService {
	return &AssetService{
		assetRepo: assetRepo,
	}
}

// IAssetService defines the interface for asset management operations
type IAssetService interface {
	// Core CRUD operations
	CreateAsset(ctx context.Context, req CreateAssetRequest) (*model.Asset, error)
	GetAsset(ctx context.Context, id string) (*model.Asset, error)
	UpdateAsset(ctx context.Context, id string, req UpdateAssetRequest) (*model.Asset, error)
	DeleteAsset(ctx context.Context, id string) error

	// Query operations
	ListAssets(ctx context.Context, filter AssetFilter) ([]*model.Asset, error)
	SearchAssets(ctx context.Context, searchTerm string, limit int) ([]*model.Asset, error)
	GetAssetsByType(ctx context.Context, assetType model.AssetType) ([]*model.Asset, error)
	GetTradeableAssets(ctx context.Context) ([]*model.Asset, error)

	// Validation operations
	ValidateAssetData(ctx context.Context, assetType model.AssetType, metadata map[string]interface{}) error
	ValidateSymbol(ctx context.Context, symbol string, assetType model.AssetType) error
}

// Request/Response structures

type CreateAssetRequest struct {
	Type             model.AssetType        `json:"type" validate:"required"`
	Symbol           *string                `json:"symbol,omitempty"`
	Name             string                 `json:"name" validate:"required,min=1,max=255"`
	Description      *string                `json:"description,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	MarketDataSource *string                `json:"market_data_source,omitempty"`
}

type UpdateAssetRequest struct {
	Symbol           *string                `json:"symbol,omitempty"`
	Name             *string                `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	Description      *string                `json:"description,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	MarketDataSource *string                `json:"market_data_source,omitempty"`
}

type AssetFilter struct {
	AssetType        *model.AssetType `json:"asset_type,omitempty"`
	IsTradeable      *bool            `json:"is_tradeable,omitempty"`
	Symbol           *string          `json:"symbol,omitempty"`
	MarketDataSource *string          `json:"market_data_source,omitempty"`
	SearchTerm       *string          `json:"search_term,omitempty"`
	Limit            *int             `json:"limit,omitempty"`
	Offset           *int             `json:"offset,omitempty"`
}

// CreateAsset creates a new asset with validation and business logic
func (s *AssetService) CreateAsset(ctx context.Context, req CreateAssetRequest) (*model.Asset, error) {
	// Validate asset type
	if !req.Type.IsValid() {
		return nil, fmt.Errorf("invalid asset type: %s", req.Type)
	}

	// Validate required fields
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("asset name is required")
	}

	// Create asset model
	asset := &model.Asset{
		Type:        req.Type,
		Name:        strings.TrimSpace(req.Name),
		IsTradeable: req.Type.IsTradeable(),
	}

	// Set optional fields
	if req.Description != nil {
		desc := strings.TrimSpace(*req.Description)
		if desc != "" {
			asset.Description = &desc
		}
	}

	// Handle symbol for tradeable assets
	if req.Type.IsTradeable() {
		if req.Symbol == nil || strings.TrimSpace(*req.Symbol) == "" {
			return nil, errors.New("symbol is required for tradeable assets")
		}

		// Validate symbol format and uniqueness
		if err := s.ValidateSymbol(ctx, *req.Symbol, req.Type); err != nil {
			return nil, fmt.Errorf("invalid symbol: %w", err)
		}

		symbol := strings.ToUpper(strings.TrimSpace(*req.Symbol))
		asset.Symbol = &symbol

		// Set market data source if provided
		if req.MarketDataSource != nil {
			source := strings.TrimSpace(*req.MarketDataSource)
			if source != "" {
				asset.MarketDataSource = &source
			}
		}
	}

	// Handle metadata
	if req.Metadata != nil {
		if err := s.ValidateAssetData(ctx, req.Type, req.Metadata); err != nil {
			return nil, fmt.Errorf("invalid metadata: %w", err)
		}

		metadataJSON, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		asset.Metadata = metadataJSON
	}

	// Validate the complete asset
	if err := asset.Validate(); err != nil {
		return nil, fmt.Errorf("asset validation failed: %w", err)
	}

	// Create in repository
	createdAsset, err := s.assetRepo.Create(ctx, asset)
	if err != nil {
		return nil, fmt.Errorf("failed to create asset: %w", err)
	}

	return createdAsset, nil
}

// GetAsset retrieves an asset by ID
func (s *AssetService) GetAsset(ctx context.Context, id string) (*model.Asset, error) {
	if id == "" {
		return nil, errors.New("asset ID is required")
	}

	asset, err := s.assetRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	return asset, nil
}

// UpdateAsset updates an existing asset
func (s *AssetService) UpdateAsset(ctx context.Context, id string, req UpdateAssetRequest) (*model.Asset, error) {
	if id == "" {
		return nil, errors.New("asset ID is required")
	}

	// Get existing asset
	asset, err := s.assetRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset: %w", err)
	}

	// Update fields if provided
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, errors.New("asset name cannot be empty")
		}
		asset.Name = name
	}

	if req.Description != nil {
		desc := strings.TrimSpace(*req.Description)
		if desc == "" {
			asset.Description = nil
		} else {
			asset.Description = &desc
		}
	}

	// Handle symbol updates for tradeable assets
	if req.Symbol != nil && asset.IsTradeable {
		symbol := strings.ToUpper(strings.TrimSpace(*req.Symbol))
		if symbol == "" {
			return nil, errors.New("symbol cannot be empty for tradeable assets")
		}

		// Validate symbol if it's different from current
		if asset.Symbol == nil || *asset.Symbol != symbol {
			if err := s.ValidateSymbol(ctx, symbol, asset.Type); err != nil {
				return nil, fmt.Errorf("invalid symbol: %w", err)
			}
		}

		asset.Symbol = &symbol
	}

	// Handle market data source updates
	if req.MarketDataSource != nil {
		if asset.IsTradeable {
			source := strings.TrimSpace(*req.MarketDataSource)
			if source == "" {
				asset.MarketDataSource = nil
			} else {
				asset.MarketDataSource = &source
			}
		}
	}

	// Handle metadata updates
	if req.Metadata != nil {
		if err := s.ValidateAssetData(ctx, asset.Type, req.Metadata); err != nil {
			return nil, fmt.Errorf("invalid metadata: %w", err)
		}

		metadataJSON, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		asset.Metadata = metadataJSON
	}

	// Validate the updated asset
	if err := asset.Validate(); err != nil {
		return nil, fmt.Errorf("asset validation failed: %w", err)
	}

	// Update in repository
	if err := s.assetRepo.Update(ctx, asset); err != nil {
		return nil, fmt.Errorf("failed to update asset: %w", err)
	}

	return asset, nil
}

// DeleteAsset removes an asset
func (s *AssetService) DeleteAsset(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("asset ID is required")
	}

	// Check if asset exists
	_, err := s.assetRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get asset: %w", err)
	}

	// TODO: Check if asset is used in any positions before deletion
	// This would require a position repository dependency

	// Note: The base repository Delete method uses uint, but we need UUID support
	// We'll need to use the repository's GetDB() method for custom deletion
	_, err = s.assetRepo.GetDB().NewDelete().
		Model((*model.Asset)(nil)).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete asset: %w", err)
	}

	return nil
}

// ListAssets retrieves assets with filtering
func (s *AssetService) ListAssets(ctx context.Context, filter AssetFilter) ([]*model.Asset, error) {
	repoFilter := repository.AssetFilter{
		AssetType:        filter.AssetType,
		IsTradeable:      filter.IsTradeable,
		Symbol:           filter.Symbol,
		MarketDataSource: filter.MarketDataSource,
		SearchTerm:       filter.SearchTerm,
		Limit:            filter.Limit,
		Offset:           filter.Offset,
	}

	assets, err := s.assetRepo.FindWithFilters(ctx, repoFilter)
	if err != nil {
		return nil, fmt.Errorf("failed to list assets: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Asset, len(assets))
	for i := range assets {
		result[i] = &assets[i]
	}

	return result, nil
}

// SearchAssets searches assets by name with fuzzy matching
func (s *AssetService) SearchAssets(ctx context.Context, searchTerm string, limit int) ([]*model.Asset, error) {
	if strings.TrimSpace(searchTerm) == "" {
		return nil, errors.New("search term is required")
	}

	if limit <= 0 {
		limit = 50 // Default limit
	}

	assets, err := s.assetRepo.SearchAssetsByName(ctx, strings.TrimSpace(searchTerm), limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search assets: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Asset, len(assets))
	for i := range assets {
		result[i] = &assets[i]
	}

	return result, nil
}

// GetAssetsByType retrieves all assets of a specific type
func (s *AssetService) GetAssetsByType(ctx context.Context, assetType model.AssetType) ([]*model.Asset, error) {
	if !assetType.IsValid() {
		return nil, fmt.Errorf("invalid asset type: %s", assetType)
	}

	assets, err := s.assetRepo.GetAssetsByType(ctx, assetType)
	if err != nil {
		return nil, fmt.Errorf("failed to get assets by type: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Asset, len(assets))
	for i := range assets {
		result[i] = &assets[i]
	}

	return result, nil
}

// GetTradeableAssets retrieves all tradeable assets
func (s *AssetService) GetTradeableAssets(ctx context.Context) ([]*model.Asset, error) {
	assets, err := s.assetRepo.GetTradeableAssets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get tradeable assets: %w", err)
	}

	// Convert to pointers
	result := make([]*model.Asset, len(assets))
	for i := range assets {
		result[i] = &assets[i]
	}

	return result, nil
}

// ValidateAssetData validates asset-specific metadata
func (s *AssetService) ValidateAssetData(ctx context.Context, assetType model.AssetType, metadata map[string]interface{}) error {
	if metadata == nil {
		return nil // Metadata is optional
	}

	// Create a temporary asset with the metadata to leverage existing validation
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	tempAsset := &model.Asset{
		Type:     assetType,
		Name:     "temp", // Temporary name for validation
		Metadata: metadataJSON,
	}

	// For tradeable assets, set a dummy symbol so Validate() doesn't fail on the symbol check
	if assetType.IsTradeable() {
		dummy := "TEMP"
		tempAsset.Symbol = &dummy
	}

	// Use the asset's built-in validation
	if err := tempAsset.Validate(); err != nil {
		return err
	}

	return nil
}

// ValidateSymbol validates symbol format and uniqueness
func (s *AssetService) ValidateSymbol(ctx context.Context, symbol string, assetType model.AssetType) error {
	if !assetType.IsTradeable() {
		return errors.New("symbol validation only applies to tradeable assets")
	}

	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	if symbol == "" {
		return errors.New("symbol cannot be empty")
	}

	// Create a temporary asset to leverage existing symbol validation
	tempAsset := &model.Asset{
		Type:   assetType,
		Name:   "temp", // Temporary name for validation
		Symbol: &symbol,
	}

	// Use the asset's built-in symbol validation
	if err := tempAsset.Validate(); err != nil {
		return err
	}

	// Check for symbol uniqueness
	existing, err := s.assetRepo.GetBySymbol(ctx, symbol)
	if err == nil && existing != nil {
		return fmt.Errorf("symbol %s already exists", symbol)
	}

	// If error is not "not found", return it
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return fmt.Errorf("failed to check symbol uniqueness: %w", err)
	}

	return nil
}
