package model

import (
	"github.com/uptrace/bun"
)

type Ownership struct {
	bun.BaseModel `bun:"table:sigma_finance.ownership"`

	AssetID             int     `bun:"asset_id,pk"`
	UserID              int     `bun:"user_id,pk"`
	OwnershipPercentage float64 `bun:"ownership_percentage"`
}
