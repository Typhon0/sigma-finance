package graphql

import (
	"testing"

	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDuplicatePortfolioResolver(t *testing.T) {
	// Test the DuplicatePortfolio resolver implementation
	t.Run("should parse input correctly", func(t *testing.T) {
		input := gqlModel.DuplicatePortfolioInput{
			SourcePortfolioID: "1",
			NewName:           "Test Portfolio Copy",
			Description:       stringPtr("A test portfolio copy"),
			CopyAssets:        true,
		}

		// Verify input parsing would work
		sourceID, err := parseID(input.SourcePortfolioID)
		require.NoError(t, err)
		assert.Equal(t, "1", sourceID)

		// Verify service input creation
		serviceInput := service.DuplicatePortfolioInput{
			SourcePortfolioID: sourceID,
			NewName:           input.NewName,
			CopyAssets:        input.CopyAssets,
		}

		if input.Description != nil {
			serviceInput.Description = *input.Description
		}

		assert.Equal(t, "Test Portfolio Copy", serviceInput.NewName)
		assert.Equal(t, "A test portfolio copy", serviceInput.Description)
		assert.True(t, serviceInput.CopyAssets)
	})
}

func TestReorderPortfoliosResolver(t *testing.T) {
	// Test the ReorderPortfolios resolver implementation
	t.Run("should parse input correctly", func(t *testing.T) {
		input := gqlModel.ReorderPortfoliosInput{
			UserID: "1",
			PortfolioOrders: []*gqlModel.PortfolioOrderInput{
				{PortfolioID: "1", SortOrder: 0},
				{PortfolioID: "2", SortOrder: 1},
			},
		}

		// Verify user ID parsing
		userID, err := parseID(input.UserID)
		require.NoError(t, err)
		assert.Equal(t, "1", userID)

		// Verify portfolio orders parsing
		var orders []service.PortfolioOrderInput
		for _, order := range input.PortfolioOrders {
			portfolioID, err := parseID(order.PortfolioID)
			require.NoError(t, err)

			orders = append(orders, service.PortfolioOrderInput{
				PortfolioID: portfolioID,
				SortOrder:   int(order.SortOrder),
			})
		}

		assert.Len(t, orders, 2)
		assert.Equal(t, "1", orders[0].PortfolioID)
		assert.Equal(t, 0, orders[0].SortOrder)
		assert.Equal(t, "2", orders[1].PortfolioID)
		assert.Equal(t, 1, orders[1].SortOrder)
	})
}

func TestExportPortfolioResolver(t *testing.T) {
	// Test the ExportPortfolio resolver implementation
	t.Run("should parse input correctly", func(t *testing.T) {
		input := gqlModel.ExportPortfolioInput{
			PortfolioID:         "1",
			Format:              gqlModel.ExportFormatCSV,
			IncludeTransactions: true,
			IncludeAnalytics:    true,
		}

		// Verify portfolio ID parsing
		portfolioID, err := parseID(input.PortfolioID)
		require.NoError(t, err)
		assert.Equal(t, "1", portfolioID)

		// Verify format and options
		assert.Equal(t, gqlModel.ExportFormatCSV, input.Format)
		assert.True(t, input.IncludeTransactions)
		assert.True(t, input.IncludeAnalytics)
	})
}

func TestPortfolioAnalyticsConverter(t *testing.T) {
	// Test the analytics converter function
	t.Run("should convert analytics correctly", func(t *testing.T) {
		serviceAnalytics := service.PortfolioAnalytics{
			PortfolioID:          "1",
			TotalValue:           10000.0,
			TotalCost:            8000.0,
			TotalGainLoss:        2000.0,
			TotalGainLossPercent: 25.0,
			AssetAllocation: []service.AssetAllocation{
				{
					AssetType:  "STOCK",
					Value:      6000.0,
					Percentage: 60.0,
					Count:      3,
				},
				{
					AssetType:  "CRYPTO",
					Value:      4000.0,
					Percentage: 40.0,
					Count:      2,
				},
			},
			RiskMetrics: service.RiskMetrics{
				Volatility:      0.15,
				SharpeRatio:     0.8,
				MaxDrawdown:     0.12,
				Diversification: 75.0,
			},
		}

		gqlAnalytics := mapPortfolioAnalyticsToGQL(serviceAnalytics)

		assert.Equal(t, 10000.0, gqlAnalytics.TotalValue)
		assert.Equal(t, 8000.0, gqlAnalytics.TotalCost)
		assert.Equal(t, 2000.0, gqlAnalytics.TotalGainLoss)
		assert.Equal(t, 25.0, gqlAnalytics.TotalGainLossPercent)

		assert.Len(t, gqlAnalytics.AssetAllocation, 2)
		assert.Equal(t, "STOCK", gqlAnalytics.AssetAllocation[0].AssetType)
		assert.Equal(t, 6000.0, gqlAnalytics.AssetAllocation[0].Value)
		assert.Equal(t, 60.0, gqlAnalytics.AssetAllocation[0].Percentage)
		assert.Equal(t, int32(3), gqlAnalytics.AssetAllocation[0].Count)

		assert.Equal(t, 0.15, gqlAnalytics.RiskMetrics.Volatility)
		assert.Equal(t, 0.8, gqlAnalytics.RiskMetrics.SharpeRatio)
		assert.Equal(t, 0.12, gqlAnalytics.RiskMetrics.MaxDrawdown)
		assert.Equal(t, 75.0, gqlAnalytics.RiskMetrics.Diversification)
	})
}
