package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAssetPriceCache(t *testing.T) {
	cache := NewAssetPriceCache()

	t.Run("set and get price", func(t *testing.T) {
		assetID := uuid.New()
		priceData := &AssetPriceData{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Timestamp: time.Now(),
			Source:    "test",
			IsStale:   false,
		}

		// Set in cache
		cache.Set(assetID, priceData, 5*time.Minute)

		// Get from cache
		cached := cache.Get(assetID)

		require.NotNil(t, cached)
		assert.Equal(t, assetID, cached.AssetID)
		assert.Equal(t, decimal.NewFromFloat(150.0), cached.Price)
		assert.Equal(t, "test", cached.Source)
		assert.False(t, cached.IsStale)
	})

	t.Run("cache expiration", func(t *testing.T) {
		assetID := uuid.New()
		priceData := &AssetPriceData{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Timestamp: time.Now(),
			Source:    "test",
			IsStale:   false,
		}

		// Set in cache with very short TTL
		cache.Set(assetID, priceData, 1*time.Millisecond)

		// Wait for expiration
		time.Sleep(2 * time.Millisecond)

		// Should be expired
		cached := cache.Get(assetID)
		assert.Nil(t, cached)
	})

	t.Run("clear cache", func(t *testing.T) {
		assetID := uuid.New()
		priceData := &AssetPriceData{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Timestamp: time.Now(),
			Source:    "test",
			IsStale:   false,
		}

		cache.Set(assetID, priceData, 5*time.Minute)
		cache.Clear()

		cached := cache.Get(assetID)
		assert.Nil(t, cached)
	})

	t.Run("cache stats", func(t *testing.T) {
		cache.Clear() // Start fresh

		assetID1 := uuid.New()
		assetID2 := uuid.New()

		priceData1 := &AssetPriceData{AssetID: assetID1, Price: decimal.NewFromFloat(150.0), Timestamp: time.Now(), Source: "test"}
		priceData2 := &AssetPriceData{AssetID: assetID2, Price: decimal.NewFromFloat(200.0), Timestamp: time.Now(), Source: "test"}

		cache.Set(assetID1, priceData1, 5*time.Minute)
		cache.Set(assetID2, priceData2, 5*time.Minute)

		stats := cache.GetStats()

		assert.Equal(t, 2, stats.TotalEntries)
		assert.True(t, stats.AvgAge >= 0)
	})
}

func TestMarketDataService_ValidateAssetPriceData(t *testing.T) {
	// Create a minimal service for testing validation
	service := &marketDataService{}
	ctx := context.Background()

	t.Run("valid price data", func(t *testing.T) {
		assetID := uuid.New().String()
		price := &model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Timestamp: time.Now(),
			Source:    "test",
		}

		err := service.ValidateAssetPriceData(ctx, price)
		assert.NoError(t, err)
	})

	t.Run("nil price data", func(t *testing.T) {
		err := service.ValidateAssetPriceData(ctx, nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "price data is required")
	})

	t.Run("zero price", func(t *testing.T) {
		assetID := uuid.New().String()
		price := &model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.Zero,
			Timestamp: time.Now(),
			Source:    "test",
		}

		err := service.ValidateAssetPriceData(ctx, price)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "price must be positive")
	})

	t.Run("negative price", func(t *testing.T) {
		assetID := uuid.New().String()
		price := &model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(-10.0),
			Timestamp: time.Now(),
			Source:    "test",
		}

		err := service.ValidateAssetPriceData(ctx, price)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "price must be positive")
	})

	t.Run("negative volume", func(t *testing.T) {
		assetID := uuid.New().String()
		volume := int64(-1000)
		price := &model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Volume:    &volume,
			Timestamp: time.Now(),
			Source:    "test",
		}

		err := service.ValidateAssetPriceData(ctx, price)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "volume cannot be negative")
	})

	t.Run("future timestamp", func(t *testing.T) {
		assetID := uuid.New().String()
		price := &model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Timestamp: time.Now().Add(2 * time.Hour),
			Source:    "test",
		}

		err := service.ValidateAssetPriceData(ctx, price)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "timestamp cannot be in the future")
	})

	t.Run("empty source", func(t *testing.T) {
		assetID := uuid.New().String()
		price := &model.AssetPrice{
			AssetID:   assetID,
			Price:     decimal.NewFromFloat(150.0),
			Timestamp: time.Now(),
			Source:    "",
		}

		err := service.ValidateAssetPriceData(ctx, price)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "price source is required")
	})
}

func TestMarketDataService_GetMaxAgeForAssetType(t *testing.T) {
	service := &marketDataService{}

	tests := []struct {
		assetType   model.AssetType
		expectedAge time.Duration
	}{
		{model.AssetTypeStock, 15 * time.Minute},
		{model.AssetTypeCrypto, 5 * time.Minute},
		{model.AssetTypeBankAccount, 1 * time.Hour},
		{model.AssetTypeRealEstate, 1 * time.Hour},
	}

	for _, test := range tests {
		t.Run(string(test.assetType), func(t *testing.T) {
			maxAge := service.getMaxAgeForAssetType(test.assetType)
			assert.Equal(t, test.expectedAge, maxAge)
		})
	}
}

func TestMarketDataService_SchedulerOperations(t *testing.T) {
	service := &marketDataService{}
	ctx := context.Background()

	t.Run("schedule and stop price updates", func(t *testing.T) {
		// Reset scheduler state
		assetPriceScheduler.mutex.Lock()
		assetPriceScheduler.running = false
		assetPriceScheduler.mutex.Unlock()

		// Schedule updates
		err := service.SchedulePriceUpdates(ctx, 100*time.Millisecond)
		assert.NoError(t, err)

		// Verify scheduler is running
		assetPriceScheduler.mutex.Lock()
		running := assetPriceScheduler.running
		assetPriceScheduler.mutex.Unlock()
		assert.True(t, running)

		// Stop updates
		service.StopPriceUpdates()

		// Verify scheduler is stopped
		assetPriceScheduler.mutex.Lock()
		running = assetPriceScheduler.running
		assetPriceScheduler.mutex.Unlock()
		assert.False(t, running)
	})

	t.Run("schedule already running", func(t *testing.T) {
		// Start scheduler
		err := service.SchedulePriceUpdates(ctx, 100*time.Millisecond)
		require.NoError(t, err)

		// Try to start again
		err = service.SchedulePriceUpdates(ctx, 100*time.Millisecond)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "already scheduled")

		// Clean up
		service.StopPriceUpdates()
	})
}
