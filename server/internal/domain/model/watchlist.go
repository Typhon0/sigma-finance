package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Watchlist struct {
	bun.BaseModel `bun:"table:sigma_finance.watchlist"`

	ID        int       `bun:"id,pk,autoincrement"`
	UserID    string    `bun:"user_id,notnull,type:uuid"`
	Name      string    `bun:"name,notnull"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
