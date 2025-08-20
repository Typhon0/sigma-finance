package service

import (
	"sigma_finance/internal/domain/model"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPortfolioAnalytics_BasicCalculations(t *testing.T) {
	// Test the analytics calculation functions directly without mocks
	service := &PortfolioService{}

	// Test diversification calculation
	portfolioAssets := []model.PortfolioAsset{
		{
			PortfolioID:          1,
			AssetID:              1,
			Quantity:             10.0,
			AveragePurchasePrice: 100.0,
		},
		{
			PortfolioID:          1,
			AssetID:              2,
			Quantity:             5.0,
			AveragePurchasePrice: 200.0,
		},
	}

	totalValue := 2000.0 // (10 * 100) + (5 * 200)

	// Test diversification score calculation
	diversificationScore := service.calculateDiversificationScore(portfolioAssets, totalValue)
	assert.True(t, diversificationScore >= 0 && diversificationScore <= 100)

	// Test risk metrics calculation
	riskMetrics := service.calculateRiskMetrics(portfolioAssets, totalValue)
	assert.NotNil(t, riskMetrics)
	assert.True(t, riskMetrics.Diversification >= 0 && riskMetrics.Diversification <= 100)

	// Test performance history generation
	performanceHistory := service.generatePerformanceHistory(1, totalValue)
	assert.Len(t, performanceHistory, 30)
	assert.True(t, performanceHistory[0].Value > 0)
}

func TestPortfolioAnalytics_EmptyPortfolio(t *testing.T) {
	service := &PortfolioService{}

	// Test with empty portfolio
	portfolioAssets := []model.PortfolioAsset{}
	totalValue := 0.0

	diversificationScore := service.calculateDiversificationScore(portfolioAssets, totalValue)
	assert.Equal(t, 0.0, diversificationScore)

	riskMetrics := service.calculateRiskMetrics(portfolioAssets, totalValue)
	assert.NotNil(t, riskMetrics)
}

func TestPortfolioAnalytics_SingleAsset(t *testing.T) {
	service := &PortfolioService{}

	// Test with single asset (no diversification)
	portfolioAssets := []model.PortfolioAsset{
		{
			PortfolioID:          1,
			AssetID:              1,
			Quantity:             10.0,
			AveragePurchasePrice: 100.0,
		},
	}

	totalValue := 1000.0

	diversificationScore := service.calculateDiversificationScore(portfolioAssets, totalValue)
	assert.Equal(t, 100.0, diversificationScore) // Single asset case should return 100
}
