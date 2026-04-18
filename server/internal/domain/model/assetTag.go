package model

import (
	"time"

	"github.com/uptrace/bun"
)

type AssetTag struct {
	bun.BaseModel `bun:"table:sigma_finance.asset_tag"`

	ID        string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	AssetID   string    `bun:"asset_id,notnull,type:uuid"`
	TagID     string    `bun:"tag_id,notnull,type:uuid"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

// AssetTag doesn't implement Entity interface since it's a junction table with composite primary key
