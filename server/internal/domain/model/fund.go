package model

import (
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

type Fund struct {
	bun.BaseModel `bun:"table:sigma_finance.fund"`

	AssetID     string          `bun:"asset_id,pk"`
	Ticker      string          `bun:"ticker"`
	Quantity    decimal.Decimal `bun:"quantity,type:decimal(20,8)"`
	BuyingPrice decimal.Decimal `bun:"buying_price,type:decimal(20,8)"`
}

// Implement Entity interface
func (f Fund) GetID() string             { return f.AssetID }
func (f *Fund) SetID(id string)          { f.AssetID = id }
func (f Fund) GetCreatedAt() time.Time   { return time.Time{} }
func (f *Fund) SetCreatedAt(t time.Time) {}
func (f Fund) GetUpdatedAt() time.Time   { return time.Time{} }
func (f *Fund) SetUpdatedAt(t time.Time) {}
