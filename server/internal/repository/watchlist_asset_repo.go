package repository

import (
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IWatchlistAssetRepository defines the interface for watchlist asset data operations.
type IWatchlistAssetRepository interface {
	IRepository[model.WatchlistAsset]
}

// WatchlistAssetRepository is the concrete implementation of IWatchlistAssetRepository
type WatchlistAssetRepository struct {
	*Repository[model.WatchlistAsset]
}

// NewWatchlistAssetRepository creates a new watchlist asset repository.
func NewWatchlistAssetRepository(db bun.IDB) IWatchlistAssetRepository {
	return &WatchlistAssetRepository{
		Repository: NewRepository[model.WatchlistAsset](db),
	}
}
