package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Ownership struct {
	bun.BaseModel `bun:"table:sigma_finance.ownership"`

	ID                  string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	AssetID             string    `bun:"asset_id,notnull,type:uuid"`
	UserID              string    `bun:"user_id,notnull,type:uuid"`
	OwnershipPercentage float64   `bun:"ownership_percentage"`
	CreatedAt           time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt           time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
