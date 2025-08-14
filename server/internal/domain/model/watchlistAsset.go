package model

import (
	"github.com/uptrace/bun"
)

type WatchlistAsset struct {
	bun.BaseModel `bun:"table:sigma_finance.watchlist_asset"`

	WatchlistID int `bun:"watchlist_id,pk"`
	AssetID     int `bun:"asset_id,pk"`
}
