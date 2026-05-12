package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

type CatalogSyncRunStatus string

const (
	CatalogSyncRunStatusRunning  CatalogSyncRunStatus = "RUNNING"
	CatalogSyncRunStatusSuccess  CatalogSyncRunStatus = "SUCCESS"
	CatalogSyncRunStatusPartial  CatalogSyncRunStatus = "PARTIAL"
	CatalogSyncRunStatusFailed   CatalogSyncRunStatus = "FAILED"
	CatalogSyncRunStatusCanceled CatalogSyncRunStatus = "CANCELED"
)

type CatalogSyncRun struct {
	bun.BaseModel `bun:"table:sigma_finance.catalog_sync_runs"`

	ID         string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Source     string          `bun:"source,notnull"`
	Mode       string          `bun:"mode,notnull"`
	Status     string          `bun:"status,notnull"`
	Cursor     *string         `bun:"cursor"`
	StatsJSON  json.RawMessage `bun:"stats_json,type:jsonb"`
	ErrorText  *string         `bun:"error_text"`
	StartedAt  time.Time       `bun:"started_at,nullzero,notnull,default:current_timestamp"`
	FinishedAt *time.Time      `bun:"finished_at"`
}
