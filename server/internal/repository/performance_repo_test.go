package repository

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

func TestPerformanceRepository_DatabaseTransactionTests(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Run within a database transaction to verify tx behavior and table mappings
	err := testDB.DB.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// 1. Create a test user
		user := &model.User{
			ID:            uuid.NewString(),
			Email:         "perf_test@example.com",
			Name:          "Performance Test User",
			EmailVerified: true,
		}
		_, err := tx.NewInsert().Model(user).Exec(ctx)
		require.NoError(t, err)

		// 2. Create a test portfolio
		portfolio := &model.Portfolio{
			ID:          uuid.NewString(),
			UserID:      user.ID,
			Name:        "Benchmark Test Portfolio",
			Description: "For testing benchmark comparison and performance repo",
		}
		_, err = tx.NewInsert().Model(portfolio).Exec(ctx)
		require.NoError(t, err)

		// 3. Create a benchmark asset (e.g. S&P 500)
		benchmarkAsset := &model.Asset{
			ID:          uuid.NewString(),
			Type:        model.AssetTypeStock,
			Symbol:      &[]string{"SPY"}[0],
			Name:        "SPDR S&P 500 ETF Trust",
			IsTradeable: true,
		}
		_, err = tx.NewInsert().Model(benchmarkAsset).Exec(ctx)
		require.NoError(t, err)

		// 4. Create performance snapshots for the portfolio
		now := time.Now().UTC()
		startDay := now.AddDate(0, 0, -5)
		endDay := now

		snapshots := []PerformanceSnapshot{
			{
				PortfolioID:        portfolio.ID,
				TotalValue:         model.Money(1000000), // $10,000.00
				TotalCostBasis:     model.Money(1000000),
				UnrealizedGainLoss: model.Money(0),
				RealizedGainLoss:   model.Money(0),
				ReturnPercentage:   decimal.NewFromFloat(0.0),
				SnapshotDate:       startDay,
				CreatedAt:          now,
			},
			{
				PortfolioID:        portfolio.ID,
				TotalValue:         model.Money(1100000), // $11,000.00 (10% return)
				TotalCostBasis:     model.Money(1000000),
				UnrealizedGainLoss: model.Money(100000),
				RealizedGainLoss:   model.Money(0),
				ReturnPercentage:   decimal.NewFromFloat(10.0),
				SnapshotDate:       endDay,
				CreatedAt:          now,
			},
		}

		for i := range snapshots {
			_, err = tx.NewInsert().Model(&snapshots[i]).Exec(ctx)
			require.NoError(t, err)
		}

		// 5. Create price history for the benchmark asset
		prices := []model.AssetPrice{
			{
				AssetID:   benchmarkAsset.ID,
				Price:     decimal.NewFromFloat(400.00),
				Timestamp: startDay,
				Source:    "test",
			},
			{
				AssetID:   benchmarkAsset.ID,
				Price:     decimal.NewFromFloat(420.00), // 5% return
				Timestamp: endDay,
				Source:    "test",
			},
		}

		for i := range prices {
			_, err = tx.NewInsert().Model(&prices[i]).Exec(ctx)
			require.NoError(t, err)
		}

		// Initialize performance repo using the transaction tx
		repo := NewPerformanceRepository(tx)

		// Test GetPerformanceSnapshots
		t.Run("GetPerformanceSnapshots", func(t *testing.T) {
			fetched, err := repo.GetPerformanceSnapshots(ctx, portfolio.ID, startDay, endDay)
			require.NoError(t, err)
			assert.Len(t, fetched, 2)
			assert.Equal(t, model.Money(1000000), fetched[0].TotalValue)
			assert.Equal(t, model.Money(1100000), fetched[1].TotalValue)
		})

		// Test CalculateBenchmarkComparison
		t.Run("CalculateBenchmarkComparison", func(t *testing.T) {
			timeRange := TimeRange{
				Start: startDay,
				End:   endDay,
			}
			comparison, err := repo.CalculateBenchmarkComparison(ctx, portfolio.ID, benchmarkAsset.ID, timeRange)
			require.NoError(t, err)
			require.NotNil(t, comparison)

			assert.Equal(t, portfolio.ID, comparison.PortfolioID)
			assert.Equal(t, benchmarkAsset.ID, comparison.BenchmarkAssetID)

			// Portfolio return = ($11,000 - $10,000) / $10,000 * 100 = 10%
			assert.True(t, comparison.PortfolioReturn.Equal(decimal.NewFromFloat(10.0)), "expected portfolio return 10, got %s", comparison.PortfolioReturn)

			// Benchmark return = ($420 - $400) / $400 * 100 = 5%
			assert.True(t, comparison.BenchmarkReturn.Equal(decimal.NewFromFloat(5.0)), "expected benchmark return 5, got %s", comparison.BenchmarkReturn)

			// Alpha = 10% - 5% = 5%
			assert.True(t, comparison.Alpha.Equal(decimal.NewFromFloat(5.0)), "expected alpha 5, got %s", comparison.Alpha)
		})

		return nil
	})
	require.NoError(t, err)
}
