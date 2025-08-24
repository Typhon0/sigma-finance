package model

import (
	"time"

	"github.com/uptrace/bun"
)

// PortfolioAsset represents the join table between Portfolio and Asset
type PortfolioAsset struct {
	bun.BaseModel `bun:"table:sigma_finance.portfolio_asset"`

	ID                   int       `bun:"id,pk,autoincrement"`
	PortfolioID          int       `bun:"portfolio_id,notnull"`
	AssetID              int       `bun:"asset_id,notnull"`
	Quantity             float64   `bun:"quantity,notnull"`
	AveragePurchasePrice float64   `bun:"average_purchase_price,notnull"`
	CreatedAt            time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt            time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
