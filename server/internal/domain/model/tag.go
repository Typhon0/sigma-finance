package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Tag struct {
	bun.BaseModel `bun:"table:sigma_finance.tag"`

	ID   int    `bun:"id,pk,autoincrement"`
	Name string `bun:"name,unique,notnull"`
}

// Implement Entity interface
func (t Tag) GetID() int64              { return int64(t.ID) }
func (t Tag) SetID(id int64)            { t.ID = int(id) }
func (t Tag) GetCreatedAt() time.Time   { return time.Time{} }
func (t Tag) SetCreatedAt(tm time.Time) {}
func (t Tag) GetUpdatedAt() time.Time   { return time.Time{} }
func (t Tag) SetUpdatedAt(tm time.Time) {}
