package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Tag struct {
	bun.BaseModel `bun:"table:sigma_finance.tag"`

	ID     string `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID string `bun:"user_id,notnull,type:uuid,unique:user_id_name"`
	Name   string `bun:"name,notnull,unique:user_id_name"`
}

// Implement Entity interface
func (t Tag) GetID() string              { return t.ID }
func (t Tag) SetID(id string)            { t.ID = id }
func (t Tag) GetCreatedAt() time.Time   { return time.Time{} }
func (t Tag) SetCreatedAt(tm time.Time) {}
func (t Tag) GetUpdatedAt() time.Time   { return time.Time{} }
func (t Tag) SetUpdatedAt(tm time.Time) {}
