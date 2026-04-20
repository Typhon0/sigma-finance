package model

import (
	"time"

	"github.com/uptrace/bun"
)

// PortfolioAsset represents the join table between Portfolio and Asset
type PortfolioAsset struct {
	bun.BaseModel `bun:"table:sigma_finance.portfolio_asset"`

	ID                   string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	PortfolioID          string    `bun:"portfolio_id,notnull,type:uuid"`
	AssetID              string    `bun:"asset_id,notnull,type:uuid"`
	InstrumentID         *string   `bun:"instrument_id,type:uuid"`
	Quantity             float64   `bun:"quantity,notnull"`
	AveragePurchasePrice float64   `bun:"average_purchase_price,notnull"`
	QuoteCurrency        Currency  `bun:"quote_currency,type:varchar(3)"`
	CreatedAt            time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt            time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
