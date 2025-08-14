package model

import (
	"github.com/uptrace/bun"
)

type PortfolioTag struct {
	bun.BaseModel `bun:"table:sigma_finance.portfolio_tag"`

	PortfolioID int `bun:"portfolio_id,pk"`
	TagID       int `bun:"tag_id,pk"`
}
