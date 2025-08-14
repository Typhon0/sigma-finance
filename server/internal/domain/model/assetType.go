package model

import (
	"time"

	"github.com/uptrace/bun"
)

type AssetType struct {
	bun.BaseModel `bun:"table:sigma_finance.asset_type"`

	ID   int    `bun:"id,pk,autoincrement"`
	Name string `bun:"name,unique,notnull"`
}

// Implement Entity interface
func (at AssetType) GetID() int64              { return int64(at.ID) }
func (at *AssetType) SetID(id int64)           { at.ID = int(id) }
func (at AssetType) GetCreatedAt() time.Time   { return time.Time{} }
func (at *AssetType) SetCreatedAt(t time.Time) {}
func (at AssetType) GetUpdatedAt() time.Time   { return time.Time{} }
func (at *AssetType) SetUpdatedAt(t time.Time) {}
