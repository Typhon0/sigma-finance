package model

import (
	"time"

	"github.com/uptrace/bun"
)

type HistoricalDataBackfillStatus string

const (
	HistoricalDataBackfillStatusQueued   HistoricalDataBackfillStatus = "QUEUED"
	HistoricalDataBackfillStatusRunning  HistoricalDataBackfillStatus = "RUNNING"
	HistoricalDataBackfillStatusComplete HistoricalDataBackfillStatus = "COMPLETE"
	HistoricalDataBackfillStatusError    HistoricalDataBackfillStatus = "ERROR"
	HistoricalDataBackfillStatusSkipped  HistoricalDataBackfillStatus = "SKIPPED_UNSUPPORTED"
)

type HistoricalDataBackfillStep string

const (
	HistoricalDataBackfillStepQueued      HistoricalDataBackfillStep = "QUEUED"
	HistoricalDataBackfillStepFetchPrices HistoricalDataBackfillStep = "FETCH_PRICES"
	HistoricalDataBackfillStepCalcPerf    HistoricalDataBackfillStep = "CALCULATE_PERFORMANCE"
	HistoricalDataBackfillStepDone        HistoricalDataBackfillStep = "DONE"
	HistoricalDataBackfillStepFailed      HistoricalDataBackfillStep = "FAILED"
)

type HistoricalDataBackfillJob struct {
	bun.BaseModel `bun:"table:sigma_finance.historical_data_backfill_jobs"`

	ID             string     `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID         *string    `bun:"user_id,type:uuid"`
	PortfolioID    string     `bun:"portfolio_id,notnull,type:uuid"`
	AssetID        string     `bun:"asset_id,notnull,type:uuid"`
	InstrumentID   string     `bun:"instrument_id,notnull,type:uuid"`
	Provider       string     `bun:"provider,notnull,default:'YFINANCE'"`
	Status         string     `bun:"status,notnull"`
	Step           string     `bun:"step,notnull,default:'QUEUED'"`
	Progress       int        `bun:"progress,notnull,default:0"`
	RowsWritten    int        `bun:"rows_written,notnull,default:0"`
	RowsInserted   int        `bun:"rows_inserted,notnull,default:0"`
	RowsUpdated    int        `bun:"rows_updated,notnull,default:0"`
	RowsSkipped    int        `bun:"rows_skipped,notnull,default:0"`
	Attempts       int        `bun:"attempts,notnull,default:0"`
	MaxAttempts    int        `bun:"max_attempts,notnull,default:4"`
	NextRunAt      time.Time  `bun:"next_run_at,notnull,default:current_timestamp"`
	LockedAt       *time.Time `bun:"locked_at"`
	LockedBy       *string    `bun:"locked_by"`
	HeartbeatAt    *time.Time `bun:"heartbeat_at"`
	CoverageFrom   *time.Time `bun:"coverage_from"`
	CoverageTo     *time.Time `bun:"coverage_to"`
	ProviderSymbol *string    `bun:"provider_symbol"`
	ErrorCode      *string    `bun:"error_code"`
	ErrorMessage   *string    `bun:"error_message"`
	RequestedFrom  time.Time  `bun:"requested_from,notnull"`
	RequestedTo    time.Time  `bun:"requested_to,notnull"`
	CreatedAt      time.Time  `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	StartedAt      *time.Time `bun:"started_at"`
	FinishedAt     *time.Time `bun:"finished_at"`
}
