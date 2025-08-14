package model

import (
	"time"

	"github.com/uptrace/bun"
)

// AssetPrice represents historical price data for an asset
type AssetPrice struct {
	AssetID   int       `bun:"asset_id"`
	Price     float64   `bun:"price"`
	Timestamp time.Time `bun:"timestamp"`
}

// AssetDocument represents a document attached to an asset
type AssetDocument struct {
	DocumentID  int       `bun:"document_id"`
	AssetID     int       `bun:"asset_id"`
	FileName    string    `bun:"file_name"`
	Description string    `bun:"description"`
	StorageKey  string    `bun:"storage_key"`
	ContentType string    `bun:"content_type"`
	Size        int64     `bun:"size"`
	UploadedBy  int       `bun:"uploaded_by"`
	UploadedAt  time.Time `bun:"uploaded_at"`
}

type Asset struct {
	bun.BaseModel `bun:"table:sigma_finance.asset"`

	ID            int       `bun:"id,pk,autoincrement"`
	Name          string    `bun:"name,notnull"`
	AssetTypeID   int       `bun:"asset_type_id,notnull"`
	CurrentValue  float64   `bun:"current_value"`
	PurchaseDate  time.Time `bun:"purchase_date"`
	PurchasePrice float64   `bun:"purchase_price"`
	UpdatedAt     time.Time `bun:"-"` // Not stored in database
	Tags          []Tag     `bun:"-"`
}

// Implement Entity interface
func (a Asset) GetID() int64             { return int64(a.ID) }
func (a Asset) SetID(id int64)           { a.ID = int(id) }
func (a Asset) GetCreatedAt() time.Time  { return time.Time{} }
func (a Asset) SetCreatedAt(t time.Time) {}
func (a Asset) GetUpdatedAt() time.Time  { return time.Time{} }
func (a Asset) SetUpdatedAt(t time.Time) {}
