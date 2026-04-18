package model

import (
	"time"

	"github.com/uptrace/bun"
)

type PortfolioTag struct {
	bun.BaseModel `bun:"table:sigma_finance.portfolio_tag"`

	ID          string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	PortfolioID string    `bun:"portfolio_id,notnull,type:uuid"`
	TagID       string    `bun:"tag_id,notnull,type:uuid"`
	CreatedAt   time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt   time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
