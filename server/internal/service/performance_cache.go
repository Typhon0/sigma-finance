package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"sigma_finance/internal/infrastructure/cache"
)

// PerformanceCacheService handles caching of performance calculations
type PerformanceCacheService struct {
	cache          *cache.RedisCache
	computeService PerformanceService // Original performance service
	
	// Background processing
	refreshQueue   chan RefreshRequest
	workers        int
	stopCh         chan struct{}
	wg             sync.WaitGroup
	
	// Metrics
	cacheHits   int64
	cacheMisses int64
	mu          sync.RWMutex
}

// RefreshRequest represents a background refresh request
type RefreshRequest struct {
	Type       string
	Key        string
	Priority   int
	Timestamp  time.Time
	RetryCount int
}

// CachedPerformanceMetrics represents cached performance data
type CachedPerformanceMetrics struct {
	PortfolioID     string                 `json:"portfolio_id"`
	TotalValue      int64                  `json:"total_value"`
	TotalReturn     float64                `json:"total_return"`
	DailyChange     float64                `json:"daily_change"`
	Allocation      map[string]float64     `json:"allocation"`
	TopAssets       []AssetPerformance     `json:"top_assets"`
	CalculatedAt    time.Time              `json:"calculated_at"`
	DataVersion     int                    `json:"data_version"`
}

// AssetPerformance represents individual asset performance
type AssetPerformance struct {
	AssetID      string  `json:"asset_id"`
	Symbol       string  `json:"symbol"`
	Name         string  `json:"name"`
	Value        int64   `json:"value"`
	Change       float64 `json:"change"`
	ChangePercent float64 `json:"change_percent"`
}

// NewPerformanceCacheService creates a new performance cache service
func NewPerformanceCacheService(cache *cache.RedisCache, computeService PerformanceService) *PerformanceCacheService {
	pcs := &PerformanceCacheService{
		cache:          cache,
		computeService: computeService,
		refreshQueue:   make(chan RefreshRequest, 1000),
		workers:        5, // Number of background workers
		stopCh:         make(chan struct{}),
	}

	// Start background workers
	for i := 0; i < pcs.workers; i++ {
		pcs.wg.Add(1)
		go pcs.backgroundWorker(i)
	}

	// Start refresh scheduler
	pcs.wg.Add(1)
	go pcs.refreshScheduler()

	return pcs
}

// GetPortfolioPerformance retrieves portfolio performance with caching
func (pcs *PerformanceCacheService) GetPortfolioPerformance(ctx context.Context, portfolioID string, forceRefresh bool) (*CachedPerformanceMetrics, error) {
	cacheKey := fmt.Sprintf("portfolio:%s", portfolioID)

	// Try cache first unless force refresh is requested
	if !forceRefresh {
		var cached CachedPerformanceMetrics
		err := pcs.cache.Get(ctx, cache.PerformanceKey, cacheKey, &cached)
		if err == nil {
			pcs.incrementCacheHits()
			
			// Check if data is still fresh (less than 2 minutes old)
			if time.Since(cached.CalculatedAt) < 2*time.Minute {
				return &cached, nil
			}
			
			// Data is stale, schedule background refresh but return cached data
			pcs.scheduleRefresh(RefreshRequest{
				Type:      "portfolio_performance",
				Key:       portfolioID,
				Priority:  1,
				Timestamp: time.Now(),
			})
			
			return &cached, nil
		}
		
		if err != cache.ErrCacheMiss {
			log.Printf("Cache error for portfolio %s: %v", portfolioID, err)
		}
		pcs.incrementCacheMisses()
	}

	// Cache miss or force refresh - compute fresh data
	metrics, err := pcs.computePortfolioPerformance(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to compute portfolio performance: %w", err)
	}

	// Store in cache asynchronously
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		if err := pcs.cache.Set(ctx, cache.PerformanceKey, cacheKey, metrics); err != nil {
			log.Printf("Failed to cache portfolio performance for %s: %v", portfolioID, err)
		}
	}()

	return metrics, nil
}

// GetMultiplePortfolioPerformance retrieves performance for multiple portfolios efficiently
func (pcs *PerformanceCacheService) GetMultiplePortfolioPerformance(ctx context.Context, portfolioIDs []string) (map[string]*CachedPerformanceMetrics, error) {
	// Prepare cache requests
	requests := make([]cache.CacheRequest, len(portfolioIDs))
	for i, id := range portfolioIDs {
		requests[i] = cache.CacheRequest{
			KeyType: cache.PerformanceKey,
			Key:     fmt.Sprintf("portfolio:%s", id),
		}
	}

	// Get cached data in batch
	cached, err := pcs.cache.GetMultiple(ctx, requests)
	if err != nil {
		log.Printf("Batch cache retrieval error: %v", err)
	}

	results := make(map[string]*CachedPerformanceMetrics)
	var missingIDs []string

	// Process cached results
	for _, portfolioID := range portfolioIDs {
		cacheKey := fmt.Sprintf("portfolio:%s", portfolioID)
		if data, exists := cached[cacheKey]; exists {
			if metrics, ok := data.(*CachedPerformanceMetrics); ok {
				results[portfolioID] = metrics
				pcs.incrementCacheHits()
				continue
			}
		}
		
		missingIDs = append(missingIDs, portfolioID)
		pcs.incrementCacheMisses()
	}

	// Compute missing data
	if len(missingIDs) > 0 {
		computed, err := pcs.computeMultiplePortfolioPerformance(ctx, missingIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to compute missing portfolio performance: %w", err)
		}

		// Merge computed results
		for id, metrics := range computed {
			results[id] = metrics
		}

		// Cache computed results asynchronously
		go pcs.cacheMultipleResults(missingIDs, computed)
	}

	return results, nil
}

// GetChartData retrieves chart data with caching and sampling
func (pcs *PerformanceCacheService) GetChartData(ctx context.Context, portfolioID string, timeRange string, maxPoints int) ([]ChartDataPoint, error) {
	cacheKey := fmt.Sprintf("chart:%s:%s:%d", portfolioID, timeRange, maxPoints)

	// Try cache first
	var cached []ChartDataPoint
	err := pcs.cache.Get(ctx, cache.ChartDataKey, cacheKey, &cached)
	if err == nil {
		pcs.incrementCacheHits()
		return cached, nil
	}

	if err != cache.ErrCacheMiss {
		log.Printf("Chart cache error for portfolio %s: %v", portfolioID, err)
	}
	pcs.incrementCacheMisses()

	// Compute chart data with sampling
	chartData, err := pcs.computeChartData(ctx, portfolioID, timeRange, maxPoints)
	if err != nil {
		return nil, fmt.Errorf("failed to compute chart data: %w", err)
	}

	// Cache result asynchronously
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		if err := pcs.cache.Set(ctx, cache.ChartDataKey, cacheKey, chartData); err != nil {
			log.Printf("Failed to cache chart data for %s: %v", portfolioID, err)
		}
	}()

	return chartData, nil
}

// computePortfolioPerformance computes fresh portfolio performance data
func (pcs *PerformanceCacheService) computePortfolioPerformance(ctx context.Context, portfolioID string) (*CachedPerformanceMetrics, error) {
	// This would call the original performance service
	// For now, return mock data
	return &CachedPerformanceMetrics{
		PortfolioID:  portfolioID,
		TotalValue:   100000, // $1000.00
		TotalReturn:  0.15,   // 15%
		DailyChange:  0.02,   // 2%
		Allocation:   map[string]float64{"STOCK": 0.6, "CRYPTO": 0.3, "CASH": 0.1},
		CalculatedAt: time.Now(),
		DataVersion:  1,
	}, nil
}

// computeMultiplePortfolioPerformance computes performance for multiple portfolios
func (pcs *PerformanceCacheService) computeMultiplePortfolioPerformance(ctx context.Context, portfolioIDs []string) (map[string]*CachedPerformanceMetrics, error) {
	results := make(map[string]*CachedPerformanceMetrics)
	
	for _, id := range portfolioIDs {
		metrics, err := pcs.computePortfolioPerformance(ctx, id)
		if err != nil {
			log.Printf("Failed to compute performance for portfolio %s: %v", id, err)
			continue
		}
		results[id] = metrics
	}
	
	return results, nil
}

// computeChartData computes chart data with sampling
func (pcs *PerformanceCacheService) computeChartData(ctx context.Context, portfolioID string, timeRange string, maxPoints int) ([]ChartDataPoint, error) {
	// This would implement data sampling algorithms (LTTB, etc.)
	// For now, return mock data
	points := make([]ChartDataPoint, maxPoints)
	baseTime := time.Now().Add(-24 * time.Hour)
	
	for i := 0; i < maxPoints; i++ {
		points[i] = ChartDataPoint{
			Timestamp: baseTime.Add(time.Duration(i) * time.Minute),
			Value:     100000 + int64(i*100), // Trending up
		}
	}
	
	return points, nil
}

// ChartDataPoint represents a single chart data point
type ChartDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     int64     `json:"value"`
}

// backgroundWorker processes refresh requests
func (pcs *PerformanceCacheService) backgroundWorker(workerID int) {
	defer pcs.wg.Done()
	
	log.Printf("Performance cache worker %d started", workerID)
	
	for {
		select {
		case req := <-pcs.refreshQueue:
			pcs.processRefreshRequest(req, workerID)
		case <-pcs.stopCh:
			log.Printf("Performance cache worker %d stopping", workerID)
			return
		}
	}
}

// processRefreshRequest processes a single refresh request
func (pcs *PerformanceCacheService) processRefreshRequest(req RefreshRequest, workerID int) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	log.Printf("Worker %d processing refresh request: %s:%s", workerID, req.Type, req.Key)

	switch req.Type {
	case "portfolio_performance":
		_, err := pcs.computePortfolioPerformance(ctx, req.Key)
		if err != nil {
			log.Printf("Worker %d failed to refresh portfolio performance %s: %v", workerID, req.Key, err)
			
			// Retry logic
			if req.RetryCount < 3 {
				req.RetryCount++
				req.Timestamp = time.Now().Add(time.Duration(req.RetryCount) * time.Minute)
				
				select {
				case pcs.refreshQueue <- req:
				default:
					log.Printf("Refresh queue full, dropping retry for %s", req.Key)
				}
			}
		}
	default:
		log.Printf("Unknown refresh request type: %s", req.Type)
	}
}

// refreshScheduler schedules periodic cache refreshes
func (pcs *PerformanceCacheService) refreshScheduler() {
	defer pcs.wg.Done()
	
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Schedule refresh for active portfolios
			// This would be based on usage patterns
			log.Printf("Scheduled cache refresh cycle")
		case <-pcs.stopCh:
			return
		}
	}
}

// scheduleRefresh adds a refresh request to the queue
func (pcs *PerformanceCacheService) scheduleRefresh(req RefreshRequest) {
	select {
	case pcs.refreshQueue <- req:
	default:
		log.Printf("Refresh queue full, dropping request for %s", req.Key)
	}
}

// cacheMultipleResults caches multiple results in batch
func (pcs *PerformanceCacheService) cacheMultipleResults(portfolioIDs []string, results map[string]*CachedPerformanceMetrics) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	items := make(map[string]cache.CacheItem)
	for _, id := range portfolioIDs {
		if metrics, exists := results[id]; exists {
			cacheKey := fmt.Sprintf("portfolio:%s", id)
			items[cacheKey] = cache.CacheItem{
				KeyType: cache.PerformanceKey,
				Value:   metrics,
			}
		}
	}

	if err := pcs.cache.SetMultiple(ctx, items); err != nil {
		log.Printf("Failed to batch cache portfolio results: %v", err)
	}
}

// incrementCacheHits increments cache hit counter
func (pcs *PerformanceCacheService) incrementCacheHits() {
	pcs.mu.Lock()
	pcs.cacheHits++
	pcs.mu.Unlock()
}

// incrementCacheMisses increments cache miss counter
func (pcs *PerformanceCacheService) incrementCacheMisses() {
	pcs.mu.Lock()
	pcs.cacheMisses++
	pcs.mu.Unlock()
}

// GetCacheStats returns cache performance statistics
func (pcs *PerformanceCacheService) GetCacheStats() (int64, int64, float64) {
	pcs.mu.RLock()
	defer pcs.mu.RUnlock()
	
	total := pcs.cacheHits + pcs.cacheMisses
	hitRate := float64(0)
	if total > 0 {
		hitRate = float64(pcs.cacheHits) / float64(total)
	}
	
	return pcs.cacheHits, pcs.cacheMisses, hitRate
}

// Stop gracefully stops the performance cache service
func (pcs *PerformanceCacheService) Stop() {
	close(pcs.stopCh)
	pcs.wg.Wait()
	log.Printf("Performance cache service stopped")
}