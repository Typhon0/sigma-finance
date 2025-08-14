package model

import (
	"github.com/uptrace/bun"
)

type PortfolioAsset struct {
	bun.BaseModel `bun:"table:sigma_finance.portfolio_asset"`

	PortfolioID          int     `bun:"portfolio_id,pk"`
	AssetID              int     `bun:"asset_id,pk"`
	Quantity             float64 `bun:"quantity"`
	AveragePurchasePrice float64 `bun:"average_purchase_price"`
}
