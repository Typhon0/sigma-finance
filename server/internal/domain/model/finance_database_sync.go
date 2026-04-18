package model

import (
	"time"

	"github.com/uptrace/bun"
)

type FinanceDatabaseSyncStatus string

const (
	FinanceDatabaseSyncStatusIdle     FinanceDatabaseSyncStatus = "IDLE"
	FinanceDatabaseSyncStatusSyncing  FinanceDatabaseSyncStatus = "SYNCING"
	FinanceDatabaseSyncStatusComplete FinanceDatabaseSyncStatus = "COMPLETE"
	FinanceDatabaseSyncStatusError    FinanceDatabaseSyncStatus = "ERROR"
)

func (s FinanceDatabaseSyncStatus) IsValid() bool {
	switch s {
	case FinanceDatabaseSyncStatusIdle, FinanceDatabaseSyncStatusSyncing, FinanceDatabaseSyncStatusComplete, FinanceDatabaseSyncStatusError:
		return true
	default:
		return false
	}
}

type FinanceDatabaseSyncSetting struct {
	bun.BaseModel `bun:"table:sigma_finance.finance_database_sync_settings"`

	AssetType     string     `bun:"asset_type,pk"`
	IsEnabled     bool       `bun:"is_enabled,notnull,default:true"`
	LastSyncedAt  *time.Time `bun:"last_synced_at"`
	RecordCount   int        `bun:"record_count,notnull,default:0"`
	SyncStatus    string     `bun:"sync_status,notnull,default:'IDLE'"`
	Progress      int        `bun:"progress,notnull,default:0"`
	CurrentRecord *string    `bun:"current_record"`
	ErrorMessage  *string    `bun:"error_message"`
	CreatedAt     time.Time  `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt     time.Time  `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

type FinanceDatabaseSyncHistory struct {
	bun.BaseModel `bun:"table:sigma_finance.finance_database_sync_history"`

	ID           string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	AssetType    string    `bun:"asset_type,notnull"`
	Timestamp    time.Time `bun:"timestamp,notnull,default:current_timestamp"`
	RecordCount  int       `bun:"record_count,notnull,default:0"`
	Status       string    `bun:"status,notnull"`
	ErrorMessage *string   `bun:"error_message"`
	CreatedAt    time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}
