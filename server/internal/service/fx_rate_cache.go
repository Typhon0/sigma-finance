package service

import (
	"sync"
	"time"

	"sigma_finance/internal/domain/model"
)

// fxRateCacheEntry represents a cached FX rate entry
type fxRateCacheEntry struct {
	Rate      *model.FXRate
	CachedAt  time.Time
	ExpiresAt time.Time
}

// FXRateCache provides in-memory caching for FX rates.
// FX rates are GLOBAL (shared across all users), so a single cache instance suffices.
// Uses RWMutex for concurrent read/write access and TTL for cache expiration.
type FXRateCache struct {
	rates map[string]*fxRateCacheEntry // key: "BASE/QUOTE"
	mutex sync.RWMutex
	ttl   time.Duration
}

// NewFXRateCache creates a new FX rate cache with the specified TTL.
func NewFXRateCache(ttl time.Duration) *FXRateCache {
	return &FXRateCache{
		rates: make(map[string]*fxRateCacheEntry),
		ttl:   ttl,
	}
}

// cacheKey generates a consistent cache key for a currency pair.
func (c *FXRateCache) cacheKey(base, quote model.Currency) string {
	return base.String() + "/" + quote.String()
}

// Get retrieves a cached FX rate if it exists and is not expired.
func (c *FXRateCache) Get(base, quote model.Currency) *model.FXRate {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	entry, exists := c.rates[c.cacheKey(base, quote)]
	if !exists {
		return nil
	}

	if time.Now().After(entry.ExpiresAt) {
		return nil
	}

	return entry.Rate
}

// Set stores an FX rate in the cache with the configured TTL.
func (c *FXRateCache) Set(rate *model.FXRate) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	now := time.Now()
	c.rates[rate.BaseCurrency.String()+"/"+rate.QuoteCurrency.String()] = &fxRateCacheEntry{
		Rate:      rate,
		CachedAt:  now,
		ExpiresAt: now.Add(c.ttl),
	}
}

// Invalidate removes a specific currency pair from the cache.
func (c *FXRateCache) Invalidate(base, quote model.Currency) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	delete(c.rates, c.cacheKey(base, quote))
}

// Clear removes all entries from the cache.
func (c *FXRateCache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.rates = make(map[string]*fxRateCacheEntry)
}

// Size returns the number of cached entries.
func (c *FXRateCache) Size() int {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return len(c.rates)
}
