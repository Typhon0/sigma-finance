package model

import (
	"encoding/json"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

type MarketDataPack struct {
	bun.BaseModel `bun:"table:sigma_finance.market_data_packs"`

	ID                string     `bun:"id,pk"`
	Version           string     `bun:"version,notnull"`
	Name              string     `bun:"name,notnull"`
	Description       *string    `bun:"description"`
	FormatVersion     int        `bun:"format_version,notnull"`
	Status            string     `bun:"status,notnull"`
	ParentPackID      *string    `bun:"parent_pack_id"`
	PackPriority      int        `bun:"pack_priority,notnull,default:0"`
	FilePath          string     `bun:"file_path,notnull"`
	Checksum          string     `bun:"checksum,notnull"`
	SignatureVerified bool       `bun:"signature_verified,notnull,default:false"`
	AssetsCount       int64      `bun:"assets_count,notnull,default:0"`
	RowsCount         int64      `bun:"rows_count,notnull,default:0"`
	InstalledAt       *time.Time `bun:"installed_at"`
	UpdatedAt         *time.Time `bun:"updated_at"`
	CreatedAt         time.Time  `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

type MarketDataPackCoverage struct {
	bun.BaseModel `bun:"table:sigma_finance.market_data_pack_coverage"`

	PackID        string          `bun:"pack_id,pk"`
	InstrumentID  string          `bun:"instrument_id,pk,type:uuid"`
	Symbol        string          `bun:"symbol,notnull"`
	AssetType     string          `bun:"asset_type,notnull"`
	Interval      CandleInterval  `bun:"interval,notnull"`
	QuoteCurrency string          `bun:"quote_currency,pk,notnull"`
	FirstDate     time.Time       `bun:"first_date,notnull"`
	LastDate      time.Time       `bun:"last_date,notnull"`
	RowCount      int64           `bun:"row_count,notnull"`
	FilePaths     json.RawMessage `bun:"file_paths,type:jsonb,notnull"`
}

type MarketDataPackJob struct {
	bun.BaseModel `bun:"table:sigma_finance.market_data_pack_jobs"`

	ID              string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	PackID          string          `bun:"pack_id,notnull"`
	JobType         string          `bun:"job_type,notnull"`
	Status          string          `bun:"status,notnull"`
	ProgressPercent decimal.Decimal `bun:"progress_percent,notnull,default:0"`
	DownloadedBytes int64           `bun:"downloaded_bytes,notnull,default:0"`
	TotalBytes      int64           `bun:"total_bytes,notnull,default:0"`
	ImportedRows    int64           `bun:"imported_rows,notnull,default:0"`
	ErrorMessage    *string         `bun:"error_message"`
	CreatedAt       time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	StartedAt       *time.Time      `bun:"started_at"`
	FinishedAt      *time.Time      `bun:"finished_at"`
}

type MarketDataPackBuildJob struct {
	bun.BaseModel `bun:"table:sigma_finance.market_data_pack_build_jobs"`

	ID               string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID           string          `bun:"user_id,notnull,type:uuid"`
	PackID           string          `bun:"pack_id,notnull"`
	SourceProvider   string          `bun:"source_provider,notnull"`
	BuildConfig      json.RawMessage `bun:"build_config,type:jsonb,notnull"`
	Status           string          `bun:"status,notnull"`
	ProgressPercent  decimal.Decimal `bun:"progress_percent,notnull,default:0"`
	CurrentSymbol    *string         `bun:"current_symbol"`
	TotalSymbols     int             `bun:"total_symbols,notnull,default:0"`
	CompletedSymbols int             `bun:"completed_symbols,notnull,default:0"`
	FailedSymbols    int             `bun:"failed_symbols,notnull,default:0"`
	ErrorMessage     *string         `bun:"error_message"`
	CreatedAt        time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	StartedAt        *time.Time      `bun:"started_at"`
	FinishedAt       *time.Time      `bun:"finished_at"`
}

type MarketDataPackBuildJobItem struct {
	bun.BaseModel `bun:"table:sigma_finance.market_data_pack_build_job_items"`

	ID           string     `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	JobID        string     `bun:"job_id,notnull,type:uuid"`
	InstrumentID string     `bun:"instrument_id,notnull,type:uuid"`
	Symbol       string     `bun:"symbol,notnull"`
	Status       string     `bun:"status,notnull"`
	FirstDate    *time.Time `bun:"first_date,type:date"`
	LastDate     *time.Time `bun:"last_date,type:date"`
	AttemptCount int        `bun:"attempt_count,notnull,default:0"`
	NextRetryAt  *time.Time `bun:"next_retry_at"`
	ErrorMessage *string    `bun:"error_message"`
}
