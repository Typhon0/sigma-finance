package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Stock struct {
	bun.BaseModel `bun:"table:sigma_finance.stock"`

	AssetID     string  `bun:"asset_id,pk"`
	Ticker      string  `bun:"ticker"`
	Quantity    float64 `bun:"quantity"`
	BuyingPrice float64 `bun:"buying_price"`
}

// Implement Entity interface
func (s Stock) GetID() string             { return s.AssetID }
func (s *Stock) SetID(id string)          { s.AssetID = id }
func (s Stock) GetCreatedAt() time.Time   { return time.Time{} }
func (s *Stock) SetCreatedAt(t time.Time) {}
func (s Stock) GetUpdatedAt() time.Time   { return time.Time{} }
func (s *Stock) SetUpdatedAt(t time.Time) {}
