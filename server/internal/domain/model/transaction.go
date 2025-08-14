package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Transaction struct {
	bun.BaseModel `bun:"table:sigma_finance.transaction"`

	ID              int       `bun:"id,pk,autoincrement"`
	PortfolioID     int       `bun:"portfolio_id,notnull"`
	AssetID         int       `bun:"asset_id,notnull"`
	TransactionType string    `bun:"transaction_type,notnull"`
	Quantity        float64   `bun:"quantity"`
	PricePerUnit    float64   `bun:"price_per_unit"`
	TransactionDate time.Time `bun:"transaction_date,nullzero,notnull,default:current_timestamp"`
	Notes           string    `bun:"notes"`
}
