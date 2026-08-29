package cache

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sync"
	"time"
)

// CandleCache provides intelligent caching for candle data
type CandleCache interface {
	// Get candles from cache, returns what's available and what needs to be fetched
	GetCachedRange(ctx context.Context, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) (cached []model.Candle, missingRanges []TimeRange, err error)

	// Store candles in cache
	StoreCandlesInCache(ctx context.Context, candles []model.Candle) error

	// Check if data is stale
	IsDataStale(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (bool, error)

	// Get the latest cached candle
	GetLatestCandle(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (*model.Candle, error)

	// Warm up cache for popular symbols
	WarmupCache(ctx context.Context, symbols []string, assetType string, intervals []model.CandleInterval) error
}

// TimeRange represents a time range that needs to be fetched
type TimeRange struct {
	From time.Time
	To   time.Time
}

// candleCache implements CandleCache
type candleCache struct {
	candleRepo repository.ICandleRepository

	// In-memory cache for frequently accessed data
	memCache map[string]*CacheEntry
	mutex    sync.RWMutex

	// Cache configuration
	maxMemoryEntries   int
	stalenessThreshold time.Duration
}

// CacheEntry represents an in-memory cache entry
type CacheEntry struct {
	Candles   []model.Candle
	LastFetch time.Time
	Symbol    string
	AssetType string
	Interval  model.CandleInterval
}

// NewCandleCache creates a new candle cache
func NewCandleCache(candleRepo repository.ICandleRepository, maxMemoryEntries int, stalenessThreshold time.Duration) CandleCache {
	return &candleCache{
		candleRepo:         candleRepo,
		memCache:           make(map[string]*CacheEntry),
		maxMemoryEntries:   maxMemoryEntries,
		stalenessThreshold: stalenessThreshold,
	}
}

func (c *candleCache) GetCachedRange(ctx context.Context, symbol, assetType string, interval model.CandleInterval, from, to time.Time, limit int) ([]model.Candle, []TimeRange, error) {
	cacheKey := c.getCacheKey(symbol, assetType, interval)
	log.Printf("[INFO] [CandleCache.GetCachedRange] cacheKey=%s from=%v to=%v limit=%d", cacheKey, from, to, limit)
	c.mutex.RLock()
	entry, exists := c.memCache[cacheKey]
	c.mutex.RUnlock()

	var cached []model.Candle
	var err error

	if exists && time.Since(entry.LastFetch) < c.stalenessThreshold {
		// Use in-memory cache
		log.Printf("[INFO] [CandleCache.GetCachedRange] using in-memory cache, entry.LastFetch=%v age=%v", entry.LastFetch, time.Since(entry.LastFetch))
		cached = c.filterCandlesByRange(entry.Candles, from, to, limit)
	} else {
		// Fetch from database
		log.Printf("[INFO] [CandleCache.GetCachedRange] fetching from database")
		cached, err = c.candleRepo.GetRange(ctx, symbol, assetType, interval, from, to, limit)
		if err != nil {
			log.Printf("[INFO] [CandleCache.GetCachedRange] database error: %v", err)
			return nil, nil, err
		}
		log.Printf("[INFO] [CandleCache.GetCachedRange] database returned %d candles", len(cached))
		// Update in-memory cache
		c.updateMemoryCache(cacheKey, cached, symbol, assetType, interval)
	}

	// Determine missing ranges
	missingRanges := c.findMissingRanges(cached, from, to, interval)
	log.Printf("[INFO] [CandleCache.GetCachedRange] returning %d candles, missingRanges=%d", len(cached), len(missingRanges))
	return cached, missingRanges, nil
}

func (c *candleCache) StoreCandlesInCache(ctx context.Context, candles []model.Candle) error {
	if len(candles) == 0 {
		return nil
	}

	// Store in database
	if err := c.candleRepo.BulkUpsert(ctx, candles); err != nil {
		return err
	}

	// Update in-memory cache
	first := candles[0]
	cacheKey := c.getCacheKey(first.Symbol, first.AssetType, first.Interval)

	c.mutex.Lock()
	defer c.mutex.Unlock()

	if entry, exists := c.memCache[cacheKey]; exists {
		// Merge with existing cache
		entry.Candles = c.mergeCandles(entry.Candles, candles)
		entry.LastFetch = time.Now()
	} else {
		// Create new cache entry
		c.memCache[cacheKey] = &CacheEntry{
			Candles:   candles,
			LastFetch: time.Now(),
			Symbol:    first.Symbol,
			AssetType: first.AssetType,
			Interval:  first.Interval,
		}
	}

	// Cleanup memory cache if too large
	c.cleanupMemoryCache()

	return nil
}

func (c *candleCache) IsDataStale(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (bool, error) {
	latest, err := c.candleRepo.GetLatest(ctx, symbol, assetType, interval)
	if err != nil {
		return true, err // No data = stale
	}

	// Calculate expected next candle time
	nextCandleTime := c.getNextCandleTime(latest.Timestamp, interval)

	// Data is stale if we're past the next expected candle time + buffer
	buffer := c.getIntervalDuration(interval) * 2
	return time.Now().After(nextCandleTime.Add(buffer)), nil
}

func (c *candleCache) GetLatestCandle(ctx context.Context, symbol, assetType string, interval model.CandleInterval) (*model.Candle, error) {
	return c.candleRepo.GetLatest(ctx, symbol, assetType, interval)
}

func (c *candleCache) WarmupCache(ctx context.Context, symbols []string, assetType string, intervals []model.CandleInterval) error {
	// This would typically be called by a background job
	for _, symbol := range symbols {
		for _, interval := range intervals {
			// Fetch recent data for popular symbols
			from := time.Now().Add(-24 * time.Hour) // Last 24 hours
			to := time.Now()

			_, _, err := c.GetCachedRange(ctx, symbol, assetType, interval, from, to, 1440) // Max 1440 minutes
			if err != nil {
				// Log error but continue with other symbols
				continue
			}
		}
	}

	return nil
}

// Helper methods

func (c *candleCache) getCacheKey(symbol, assetType string, interval model.CandleInterval) string {
	return fmt.Sprintf("%s:%s:%s", symbol, assetType, interval)
}

func (c *candleCache) filterCandlesByRange(candles []model.Candle, from, to time.Time, limit int) []model.Candle {
	var filtered []model.Candle

	for _, candle := range candles {
		if (from.IsZero() || candle.Timestamp.After(from) || candle.Timestamp.Equal(from)) &&
			(to.IsZero() || candle.Timestamp.Before(to) || candle.Timestamp.Equal(to)) {
			filtered = append(filtered, candle)

			if len(filtered) >= limit {
				break
			}
		}
	}

	return filtered
}

func (c *candleCache) findMissingRanges(cached []model.Candle, from, to time.Time, interval model.CandleInterval) []TimeRange {
	if len(cached) == 0 {
		return []TimeRange{{From: from, To: to}}
	}

	var missing []TimeRange
	intervalDuration := c.getIntervalDuration(interval)

	// Check for gap at the beginning
	if cached[0].Timestamp.After(from.Add(intervalDuration)) {
		missing = append(missing, TimeRange{
			From: from,
			To:   cached[0].Timestamp.Add(-intervalDuration),
		})
	}

	// Check for gaps between candles
	for i := 1; i < len(cached); i++ {
		expectedTime := cached[i-1].Timestamp.Add(intervalDuration)
		if cached[i].Timestamp.After(expectedTime.Add(intervalDuration)) {
			missing = append(missing, TimeRange{
				From: expectedTime,
				To:   cached[i].Timestamp.Add(-intervalDuration),
			})
		}
	}

	// Check for gap at the end
	lastCandle := cached[len(cached)-1]
	expectedEndTime := lastCandle.Timestamp.Add(intervalDuration)
	if to.After(expectedEndTime) {
		missing = append(missing, TimeRange{
			From: expectedEndTime,
			To:   to,
		})
	}

	return missing
}

func (c *candleCache) mergeCandles(existing, new []model.Candle) []model.Candle {
	// Create a map for quick lookup
	candleMap := make(map[time.Time]model.Candle)

	// Add existing candles
	for _, candle := range existing {
		candleMap[candle.Timestamp] = candle
	}

	// Add/update with new candles
	for _, candle := range new {
		candleMap[candle.Timestamp] = candle
	}

	// Convert back to slice and sort
	merged := make([]model.Candle, 0, len(candleMap))
	for _, candle := range candleMap {
		merged = append(merged, candle)
	}

	// Sort by timestamp
	for i := 0; i < len(merged)-1; i++ {
		for j := i + 1; j < len(merged); j++ {
			if merged[i].Timestamp.After(merged[j].Timestamp) {
				merged[i], merged[j] = merged[j], merged[i]
			}
		}
	}

	return merged
}

func (c *candleCache) updateMemoryCache(cacheKey string, candles []model.Candle, symbol, assetType string, interval model.CandleInterval) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.memCache[cacheKey] = &CacheEntry{
		Candles:   candles,
		LastFetch: time.Now(),
		Symbol:    symbol,
		AssetType: assetType,
		Interval:  interval,
	}

	c.cleanupMemoryCache()
}

func (c *candleCache) cleanupMemoryCache() {
	if len(c.memCache) <= c.maxMemoryEntries {
		return
	}

	// Simple LRU cleanup - remove oldest entries
	type entryWithKey struct {
		key   string
		entry *CacheEntry
	}

	var entries []entryWithKey
	for key, entry := range c.memCache {
		entries = append(entries, entryWithKey{key: key, entry: entry})
	}

	// Sort by last fetch time (oldest first)
	for i := 0; i < len(entries)-1; i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[i].entry.LastFetch.After(entries[j].entry.LastFetch) {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}

	// Remove oldest entries
	toRemove := len(entries) - c.maxMemoryEntries
	for i := 0; i < toRemove; i++ {
		delete(c.memCache, entries[i].key)
	}
}

func (c *candleCache) getIntervalDuration(interval model.CandleInterval) time.Duration {
	switch interval {
	case model.Interval1m:
		return time.Minute
	case model.Interval5m:
		return 5 * time.Minute
	case model.Interval15m:
		return 15 * time.Minute
	case model.Interval30m:
		return 30 * time.Minute
	case model.Interval1h:
		return time.Hour
	case model.Interval4h:
		return 4 * time.Hour
	case model.Interval1d:
		return 24 * time.Hour
	default:
		return time.Minute
	}
}

func (c *candleCache) getNextCandleTime(timestamp time.Time, interval model.CandleInterval) time.Time {
	duration := c.getIntervalDuration(interval)
	return timestamp.Add(duration)
}
