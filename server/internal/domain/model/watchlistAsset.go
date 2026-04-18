package model

import (
	"time"

	"github.com/uptrace/bun"
)

type WatchlistAsset struct {
	bun.BaseModel `bun:"table:sigma_finance.watchlist_asset"`

	ID          string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	WatchlistID string    `bun:"watchlist_id,notnull,type:uuid"`
	AssetID     string    `bun:"asset_id,notnull,type:uuid"`
	CreatedAt   time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt   time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
