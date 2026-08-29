//go:build tools
// +build tools

// One-off CLI used to rebuild sigma_finance.portfolio_performance for a specific
// portfolio over a [start, end] window.
//
// Why this exists: the historical rebuild SQL in
// internal/repository/performance_repo.go (CalculateAndSaveHistoricalSnapshots)
// runs an UPSERT (ON CONFLICT DO UPDATE), which makes it safe to invoke
// repeatedly.  The background snapshot job
// (background_processor.processPortfolioPerformance) is currently a stub;
// this tool is the manual trigger when we need to refresh a portfolio's
// snapshots after bad data is purged or new prices arrive.
//
// Rebuild-window safety: the SQL CROSS JOINs sigma_finance.positions and uses
// each position's CURRENT total_cost_basis against the historical asset_price
// fetched with LEFT JOIN LATERAL.  Pre-acquisition days therefore produce
// total_value=0 with cost_basis>0 → return_percentage=-100%, which is exactly
// the bad-seed pattern we just deleted.  Always pick a window where asset_prices
// exist for every currently-held position.
//
// Usage:
//
//	cd server
//	go run -tags tools ./tools/rebuild_portfolio_snapshots.go \
//	    -portfolio 262686f8-bad8-4fb2-9842-34453fb4930c \
//	    -start    2026-04-20 \
//	    -end      2026-06-20
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"time"

	"sigma_finance/internal/infrastructure"
	"sigma_finance/internal/repository"

	"github.com/joho/godotenv"
	"github.com/uptrace/bun"
)

type snapshotRow struct {
	SnapshotDate       time.Time
	TotalValue         int64
	TotalCostBasis     int64
	UnrealizedGainLoss int64
	RealizedGainLoss   int64
	ReturnPercentage   float64
}

type healthAggregateRow struct {
	MinTotalValue int64
	MaxTotalValue int64
	AvgReturn     float64
	BadRows       int64
}

func main() {
	portfolioID := flag.String("portfolio", "", "portfolio UUID (required)")
	startStr := flag.String("start", "", "inclusive start date YYYY-MM-DD (required)")
	endStr := flag.String("end", "", "inclusive end date YYYY-MM-DD (required)")
	showSample := flag.Bool("sample", true, "print sample of rebuilt rows after rebuild")
	flag.Parse()

	if *portfolioID == "" || *startStr == "" || *endStr == "" {
		flag.Usage()
		log.Fatalf("\nall three flags are required: -portfolio -start -end")
	}

	startDate, err := time.Parse(time.DateOnly, *startStr)
	if err != nil {
		log.Fatalf("invalid -start %q: %v", *startStr, err)
	}
	endDate, err := time.Parse(time.DateOnly, *endStr)
	if err != nil {
		log.Fatalf("invalid -end %q: %v", *endStr, err)
	}
	if endDate.Before(startDate) {
		log.Fatalf("-end %s is before -start %s",
			endDate.Format(time.DateOnly), startDate.Format(time.DateOnly))
	}

	if err := godotenv.Load(); err != nil {
		log.Printf("[rebuild-snapshots] no .env file found, relying on OS env vars: %v", err)
	}

	fmt.Printf("[rebuild-snapshots] connecting to database...\n")
	db, err := infrastructure.NewDB()
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	uow := repository.NewUnitOfWork(db)
	ctx := context.Background()

	fmt.Printf("[rebuild-snapshots] counting rows BEFORE for portfolio=%s window=[%s..%s]\n",
		*portfolioID, startDate.Format(time.DateOnly), endDate.Format(time.DateOnly))
	rowsBefore, err := countSnapshots(ctx, db, *portfolioID, startDate, endDate)
	if err != nil {
		log.Fatalf("count before failed: %v", err)
	}
	fmt.Printf("[rebuild-snapshots] existing rows in window: %d\n", rowsBefore)

	if !portfolioExists(ctx, db, *portfolioID) {
		log.Fatalf("portfolio %s does not exist in sigma_finance.portfolio", *portfolioID)
	}

	fmt.Printf("[rebuild-snapshots] running CalculateAndSaveHistoricalSnapshots...\n")
	startedAt := time.Now()
	if err := uow.Performance().CalculateAndSaveHistoricalSnapshots(ctx, *portfolioID, startDate, endDate); err != nil {
		log.Fatalf("rebuild failed: %v", err)
	}
	fmt.Printf("[rebuild-snapshots] rebuild complete in %s\n",
		time.Since(startedAt).Round(time.Millisecond))

	rowsAfter, err := countSnapshots(ctx, db, *portfolioID, startDate, endDate)
	if err != nil {
		log.Fatalf("count after failed: %v", err)
	}
	fmt.Printf("[rebuild-snapshots] rows in window AFTER rebuild: %d (delta %+d)\n",
		rowsAfter, rowsAfter-rowsBefore)

	health, err := healthAggregate(ctx, db, *portfolioID, startDate, endDate)
	if err != nil {
		log.Fatalf("health aggregate failed: %v", err)
	}
	fmt.Printf("[rebuild-snapshots] health: total_value range [%d..%d] cents avg_return=%.2f%% rows_below_-10%%=%d\n",
		health.MinTotalValue, health.MaxTotalValue, health.AvgReturn, health.BadRows)

	if *showSample {
		fmt.Println("[rebuild-snapshots] first 3 / last 3 rebuilt rows:")
		sample, err := sampleSnapshots(ctx, db, *portfolioID, startDate, endDate)
		if err != nil {
			log.Fatalf("sample failed: %v", err)
		}
		for _, row := range sample {
			fmt.Printf("  %s  total_value=%d cents  total_cost_basis=%d cents  unrealized_gl=%d cents  realized_gl=%d cents  return=%.2f%%\n",
				row.SnapshotDate.Format(time.DateOnly),
				row.TotalValue,
				row.TotalCostBasis,
				row.UnrealizedGainLoss,
				row.RealizedGainLoss,
				row.ReturnPercentage,
			)
		}
	}

	if health.BadRows > 0 {
		fmt.Printf("[rebuild-snapshots] WARN: %d rows still show return_percentage<-10; consider a tighter window or pruning bad rows afterward\n", health.BadRows)
	} else {
		fmt.Println("[rebuild-snapshots] OK: all rebuilt rows have healthy return percentages")
	}
}

func countSnapshots(ctx context.Context, db *bun.DB, portfolioID string, start, end time.Time) (int64, error) {
	var n int64
	err := db.NewSelect().
		TableExpr("sigma_finance.portfolio_performance").
		ColumnExpr("count(*)").
		Where("portfolio_id = ?", portfolioID).
		Where("snapshot_date >= ?", start).
		Where("snapshot_date <= ?", end).
		Scan(ctx, &n)
	return n, err
}

func portfolioExists(ctx context.Context, db *bun.DB, portfolioID string) bool {
	var n int64
	if err := db.NewSelect().
		TableExpr("sigma_finance.portfolio").
		ColumnExpr("count(*)").
		Where("id = ?", portfolioID).
		Scan(ctx, &n); err != nil {
		return false
	}
	return n > 0
}

func healthAggregate(ctx context.Context, db *bun.DB, portfolioID string, start, end time.Time) (healthAggregateRow, error) {
	var row healthAggregateRow
	err := db.NewSelect().
		TableExpr("sigma_finance.portfolio_performance").
		ColumnExpr("COALESCE(MIN(total_value),0) AS min_total_value").
		ColumnExpr("COALESCE(MAX(total_value),0) AS max_total_value").
		ColumnExpr("COALESCE(AVG(return_percentage),0) AS avg_return").
		ColumnExpr("COALESCE(SUM(CASE WHEN return_percentage < -10 THEN 1 ELSE 0 END),0) AS bad_rows").
		Where("portfolio_id = ?", portfolioID).
		Where("snapshot_date >= ?", start).
		Where("snapshot_date <= ?", end).
		Scan(ctx, &row)
	return row, err
}

func sampleSnapshots(ctx context.Context, db *bun.DB, portfolioID string, start, end time.Time) ([]snapshotRow, error) {
	out := make([]snapshotRow, 0, 6)
	if err := db.NewSelect().
		TableExpr("sigma_finance.portfolio_performance").
		ColumnExpr("snapshot_date, total_value, total_cost_basis, unrealized_gain_loss, realized_gain_loss, return_percentage::float8 AS return_percentage").
		Where("portfolio_id = ?", portfolioID).
		Where("snapshot_date >= ?", start).
		Where("snapshot_date <= ?", end).
		OrderExpr("snapshot_date ASC").
		Limit(3).
		Scan(ctx, &out); err != nil {
		return nil, err
	}
	if err := db.NewSelect().
		TableExpr("sigma_finance.portfolio_performance").
		ColumnExpr("snapshot_date, total_value, total_cost_basis, unrealized_gain_loss, realized_gain_loss, return_percentage::float8 AS return_percentage").
		Where("portfolio_id = ?", portfolioID).
		Where("snapshot_date >= ?", start).
		Where("snapshot_date <= ?", end).
		OrderExpr("snapshot_date DESC").
		Limit(3).
		Scan(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}
