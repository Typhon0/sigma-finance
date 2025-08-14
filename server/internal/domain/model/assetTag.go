package model

import (
	"github.com/uptrace/bun"
)

type AssetTag struct {
	bun.BaseModel `bun:"table:sigma_finance.asset_tag"`

	AssetID int `bun:"asset_id,pk"`
	TagID   int `bun:"tag_id,pk"`
}

// AssetTag doesn't implement Entity interface since it's a junction table with composite primary key
