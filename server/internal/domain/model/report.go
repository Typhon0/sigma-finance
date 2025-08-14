package model

import (
	"time"

	"github.com/uptrace/bun"
)

type Report struct {
	bun.BaseModel `bun:"table:sigma_finance.report"`

	ID          int       `bun:"report_id,pk,autoincrement"`
	UserID      int       `bun:"user_id,notnull"`
	Name        string    `bun:"name,notnull"`
	GeneratedAt time.Time `bun:"generated_at,nullzero,notnull,default:current_timestamp"`
	ReportData  string    `bun:"report_data"`
}
