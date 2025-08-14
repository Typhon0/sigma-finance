package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Crypto struct {
	bun.BaseModel `bun:"table:sigma_finance.crypto"`

	AssetID           int     `bun:"asset_id,pk"`
	WalletAddress     string  `bun:"wallet_address"`
	BlockchainNetwork string  `bun:"blockchain_network"`
	Quantity          float64 `bun:"quantity"`
}

// Implement Entity interface
func (c Crypto) GetID() int64              { return int64(c.AssetID) }
func (c *Crypto) SetID(id int64)           { c.AssetID = int(id) }
func (c Crypto) GetCreatedAt() time.Time   { return time.Time{} }
func (c *Crypto) SetCreatedAt(t time.Time) {}
func (c Crypto) GetUpdatedAt() time.Time   { return time.Time{} }
func (c *Crypto) SetUpdatedAt(t time.Time) {}
