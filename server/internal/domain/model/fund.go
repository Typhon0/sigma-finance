package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Fund struct {
	bun.BaseModel `bun:"table:sigma_finance.fund"`

	AssetID     string  `bun:"asset_id,pk"`
	Ticker      string  `bun:"ticker"`
	Quantity    float64 `bun:"quantity"`
	BuyingPrice float64 `bun:"buying_price"`
}

// Implement Entity interface
func (f Fund) GetID() string             { return f.AssetID }
func (f *Fund) SetID(id string)          { f.AssetID = id }
func (f Fund) GetCreatedAt() time.Time   { return time.Time{} }
func (f *Fund) SetCreatedAt(t time.Time) {}
func (f Fund) GetUpdatedAt() time.Time   { return time.Time{} }
func (f *Fund) SetUpdatedAt(t time.Time) {}
