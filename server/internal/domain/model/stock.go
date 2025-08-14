package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Stock struct {
	bun.BaseModel `bun:"table:sigma_finance.stock"`

	AssetID     int     `bun:"asset_id,pk"`
	Ticker      string  `bun:"ticker"`
	Quantity    float64 `bun:"quantity"`
	BuyingPrice float64 `bun:"buying_price"`
}

// Implement Entity interface
func (s Stock) GetID() int64              { return int64(s.AssetID) }
func (s *Stock) SetID(id int64)           { s.AssetID = int(id) }
func (s Stock) GetCreatedAt() time.Time   { return time.Time{} }
func (s *Stock) SetCreatedAt(t time.Time) {}
func (s Stock) GetUpdatedAt() time.Time   { return time.Time{} }
func (s *Stock) SetUpdatedAt(t time.Time) {}
