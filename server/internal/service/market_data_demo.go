package service

import (
	"context"
	"fmt"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// DemoMarketDataAssetPriceFeatures demonstrates the new asset price functionality
func DemoMarketDataAssetPriceFeatures() {
	fmt.Println("=== Market Data Service Asset Price Features Demo ===")

	// 1. Demonstrate AssetPriceCache
	fmt.Println("\n1. Asset Price Cache Demo:")
	cache := NewAssetPriceCache()

	assetUUID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	priceData := &AssetPriceData{
		AssetID:   assetUUID,
		Price:     decimal.NewFromFloat(150.50),
		Volume:    int64Ptr(1000000),
		MarketCap: int64Ptr(2500000000000),
		Timestamp: time.Now(),
		Source:    "demo",
		IsStale:   false,
	}

	// Set price in cache
	cache.Set(assetUUID, priceData, 5*time.Minute)
	fmt.Printf("✓ Cached price for asset %s: $%.2f\n", assetUUID.String()[:8], priceData.Price.InexactFloat64())

	// Get price from cache
	cached := cache.Get(assetUUID)
	if cached != nil {
		fmt.Printf("✓ Retrieved cached price: $%.2f (Source: %s)\n", cached.Price.InexactFloat64(), cached.Source)
	}

	// Get cache stats
	stats := cache.GetStats()
	fmt.Printf("✓ Cache stats: %d entries, avg age: %v\n", stats.TotalEntries, stats.AvgAge)

	// 2. Demonstrate price validation
	fmt.Println("\n2. Price Validation Demo:")
	service := &marketDataService{}
	ctx := context.Background()

	// Valid price
	validPrice := &model.AssetPrice{
		AssetID:   assetUUID.String(),
		Price:     decimal.NewFromFloat(150.50),
		Timestamp: time.Now(),
		Source:    "demo",
	}

	if err := service.ValidateAssetPriceData(ctx, validPrice); err == nil {
		fmt.Printf("✓ Valid price data passed validation\n")
	} else {
		fmt.Printf("✗ Validation failed: %v\n", err)
	}

	// Invalid price (negative)
	invalidPrice := &model.AssetPrice{
		AssetID:   assetUUID.String(),
		Price:     decimal.NewFromFloat(-10.0),
		Timestamp: time.Now(),
		Source:    "demo",
	}

	if err := service.ValidateAssetPriceData(ctx, invalidPrice); err != nil {
		fmt.Printf("✓ Invalid price correctly rejected: %v\n", err)
	}

	// 3. Demonstrate staleness detection
	fmt.Println("\n3. Staleness Detection Demo:")

	// Test different asset types
	assetTypes := []model.AssetType{
		model.AssetTypeStock,
		model.AssetTypeCrypto,
		model.AssetTypeBankAccount,
	}

	for _, assetType := range assetTypes {
		maxAge := service.getMaxAgeForAssetType(assetType)
		fmt.Printf("✓ %s max age: %v\n", assetType, maxAge)
	}

	// 4. Demonstrate scheduler operations
	fmt.Println("\n4. Scheduler Demo:")

	// Reset scheduler state for demo
	assetPriceScheduler.mutex.Lock()
	assetPriceScheduler.running = false
	assetPriceScheduler.mutex.Unlock()

	// Start scheduler
	if err := service.SchedulePriceUpdates(ctx, 1*time.Second); err == nil {
		fmt.Printf("✓ Price update scheduler started\n")

		// Wait a moment
		time.Sleep(100 * time.Millisecond)

		// Stop scheduler
		service.StopPriceUpdates()
		fmt.Printf("✓ Price update scheduler stopped\n")
	} else {
		fmt.Printf("✗ Failed to start scheduler: %v\n", err)
	}

	fmt.Println("\n=== Demo Complete ===")
}

// Helper function for demo
func int64Ptr(i int64) *int64 {
	return &i
}
