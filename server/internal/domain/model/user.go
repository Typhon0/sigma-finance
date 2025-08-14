package model

import (
	"time"

	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel `bun:"table:sigma_finance.user"`

	ID        int       `bun:"id,pk,autoincrement"`
	Username  string    `bun:"username,unique,notnull"`
	Email     string    `bun:"email,unique,notnull"`
	Password  string    `bun:"password_hash,notnull"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
