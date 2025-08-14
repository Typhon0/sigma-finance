package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// WatchlistRepository defines the interface for watchlist-specific database operations.
// It extends the generic repository with domain-specific methods for user associations and asset management.
type WatchlistRepository interface {
	IRepository[model.Watchlist]

	// FindByUserID retrieves all watchlists for a specific user
	FindByUserID(ctx context.Context, userID int) ([]model.Watchlist, error)

	// FindByUserIDWithAssets retrieves watchlists for a user with their associated assets
	FindByUserIDWithAssets(ctx context.Context, userID int) ([]model.Watchlist, error)

	// FindWithAssets retrieves a watchlist with its associated assets
	FindWithAssets(ctx context.Context, watchlistID int) (model.Watchlist, error)

	// AddAssetToWatchlist adds an asset to a watchlist
	AddAssetToWatchlist(ctx context.Context, watchlistID, assetID int) error

	// RemoveAssetFromWatchlist removes an asset from a watchlist
	RemoveAssetFromWatchlist(ctx context.Context, watchlistID, assetID int) error

	// GetWatchlistAssets retrieves all assets in a watchlist
	GetWatchlistAssets(ctx context.Context, watchlistID int) ([]model.Asset, error)

	// IsAssetInWatchlist checks if an asset is in a watchlist
	IsAssetInWatchlist(ctx context.Context, watchlistID, assetID int) (bool, error)
}

// watchlistRepository is the concrete implementation of WatchlistRepository
type watchlistRepository struct {
	*Repository[model.Watchlist]
	watchlistAssetRepo IRepository[model.WatchlistAsset]
	assetRepo          IRepository[model.Asset]
}

// NewWatchlistRepository creates a new watchlist repository instance
func NewWatchlistRepository(
	repo *Repository[model.Watchlist],
	watchlistAssetRepo IRepository[model.WatchlistAsset],
	assetRepo IRepository[model.Asset],
) WatchlistRepository {
	return &watchlistRepository{
		Repository:         repo,
		watchlistAssetRepo: watchlistAssetRepo,
		assetRepo:          assetRepo,
	}
}

// FindByUserID retrieves all watchlists for a specific user
func (r *watchlistRepository) FindByUserID(ctx context.Context, userID int) ([]model.Watchlist, error) {
	return r.FindAllBy(ctx, ByColumn("user_id", userID))
}

// FindByUserIDWithAssets retrieves watchlists for a user with their associated assets
func (r *watchlistRepository) FindByUserIDWithAssets(ctx context.Context, userID int) ([]model.Watchlist, error) {
	return r.FindAllBy(ctx,
		ByColumn("user_id", userID),
		WithPreload("Assets"),
	)
}

// FindWithAssets retrieves a watchlist with its associated assets
func (r *watchlistRepository) FindWithAssets(ctx context.Context, watchlistID int) (model.Watchlist, error) {
	return r.FindOneBy(ctx,
		ByColumn("watchlist_id", watchlistID),
		WithPreload("Assets"),
	)
}

// AddAssetToWatchlist adds an asset to a watchlist
func (r *watchlistRepository) AddAssetToWatchlist(ctx context.Context, watchlistID, assetID int) error {
	// Check if the association already exists
	exists, err := r.IsAssetInWatchlist(ctx, watchlistID, assetID)
	if err != nil {
		return err
	}
	if exists {
		return nil // Already exists, no need to add again
	}

	watchlistAsset := &model.WatchlistAsset{
		WatchlistID: watchlistID,
		AssetID:     assetID,
	}

	_, err = r.watchlistAssetRepo.Create(ctx, watchlistAsset)
	return err
}

// RemoveAssetFromWatchlist removes an asset from a watchlist
func (r *watchlistRepository) RemoveAssetFromWatchlist(ctx context.Context, watchlistID, assetID int) error {
	// Find the watchlist asset association
	watchlistAssets, err := r.watchlistAssetRepo.FindAllBy(ctx,
		ByColumn("watchlist_id", watchlistID),
		ByColumn("asset_id", assetID),
	)
	if err != nil {
		return err
	}

	if len(watchlistAssets) == 0 {
		return ErrNotFound
	}

	// Delete the association - we need to construct a composite key
	// Since the generic repository Delete method expects a single ID, we'll use a custom query
	return r.deleteWatchlistAsset(ctx, watchlistID, assetID)
}

// deleteWatchlistAsset is a helper method to delete watchlist asset associations
func (r *watchlistRepository) deleteWatchlistAsset(ctx context.Context, watchlistID, assetID int) error {
	// Use the GetDB method to access the database connection
	db := r.watchlistAssetRepo.GetDB()
	_, err := db.NewDelete().
		Model((*model.WatchlistAsset)(nil)).
		Where("watchlist_id = ? AND asset_id = ?", watchlistID, assetID).
		Exec(ctx)
	return err
}

// GetWatchlistAssets retrieves all assets in a watchlist
func (r *watchlistRepository) GetWatchlistAssets(ctx context.Context, watchlistID int) ([]model.Asset, error) {
	// Get watchlist asset associations
	watchlistAssets, err := r.watchlistAssetRepo.FindAllBy(ctx, ByColumn("watchlist_id", watchlistID))
	if err != nil {
		return nil, err
	}

	if len(watchlistAssets) == 0 {
		return []model.Asset{}, nil
	}

	// Extract asset IDs
	assetIDs := make([]int, len(watchlistAssets))
	for i, wa := range watchlistAssets {
		assetIDs[i] = wa.AssetID
	}

	// Get assets by IDs
	return r.assetRepo.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("asset_id IN (?)", bun.In(assetIDs))
	})
}

// IsAssetInWatchlist checks if an asset is in a watchlist
func (r *watchlistRepository) IsAssetInWatchlist(ctx context.Context, watchlistID, assetID int) (bool, error) {
	count, err := r.watchlistAssetRepo.Count(ctx,
		ByColumn("watchlist_id", watchlistID),
		ByColumn("asset_id", assetID),
	)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
