package service

import (
	"sort"
	"strings"
	"sync"
	"time"

	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
)

// searchCacheEntry holds a cached online search result with its expiry time.
type searchCacheEntry struct {
	results  []catalog.DiscoveryInstrument
	provider string
	expires  time.Time
	created  time.Time
}

// searchCacheKey uniquely identifies a search query for caching.
type searchCacheKey struct {
	query      string
	assetTypes string // sorted, comma-separated
	limit      int
}

// SearchCache is a thread-safe, TTL-based LRU cache for online instrument search results.
// It evicts the least-recently-used entry when capacity is exceeded and
// expires entries older than the configured TTL.
type SearchCache struct {
	mu       sync.Mutex
	entries  map[searchCacheKey]*searchCacheEntry
	lru      []searchCacheKey // most-recently-used at end
	maxSize  int
	ttl      time.Duration
}

// NewSearchCache creates a new SearchCache with the given maximum number of entries and TTL.
// A TTL of 0 disables expiry (entries live until evicted by capacity).
func NewSearchCache(maxSize int, ttl time.Duration) *SearchCache {
	if maxSize <= 0 {
		maxSize = 500
	}
	return &SearchCache{
		entries: make(map[searchCacheKey]*searchCacheEntry, maxSize),
		maxSize: maxSize,
		ttl:     ttl,
	}
}

// Get returns cached search results if available and not expired.
// Returns nil, false if no cache hit.
func (c *SearchCache) Get(query string, assetTypes []model.InstrumentAssetType, limit int) ([]catalog.DiscoveryInstrument, string, bool) {
	key := makeSearchCacheKey(query, assetTypes, limit)

	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, "", false
	}

	// Check TTL expiry
	if c.ttl > 0 && time.Now().After(entry.expires) {
		delete(c.entries, key)
		c.removeFromLRU(key)
		return nil, "", false
	}

	// Promote to most-recently-used
	c.promoteLRU(key)
	return entry.results, entry.provider, true
}

// Set stores search results in the cache, evicting the least-recently-used entry
// if the cache is at capacity.
func (c *SearchCache) Set(query string, assetTypes []model.InstrumentAssetType, limit int, results []catalog.DiscoveryInstrument, provider string) {
	key := makeSearchCacheKey(query, assetTypes, limit)

	c.mu.Lock()
	defer c.mu.Unlock()

	// Evict if at capacity and this is a new key
	if _, exists := c.entries[key]; !exists && len(c.entries) >= c.maxSize {
		c.evictLRU()
	}

	now := time.Now()
	entry := &searchCacheEntry{
		results:  results,
		provider: provider,
		created:  now,
	}
	if c.ttl > 0 {
		entry.expires = now.Add(c.ttl)
	}
	c.entries[key] = entry

	// If key already existed, remove old LRU position before promoting
	c.promoteLRU(key)
}

// Invalidate removes a specific query from the cache.
func (c *SearchCache) Invalidate(query string, assetTypes []model.InstrumentAssetType, limit int) {
	key := makeSearchCacheKey(query, assetTypes, limit)

	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.entries, key)
	c.removeFromLRU(key)
}

// Purge removes all entries from the cache.
func (c *SearchCache) Purge() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries = make(map[searchCacheKey]*searchCacheEntry, c.maxSize)
	c.lru = nil
}

// Size returns the current number of cached entries.
func (c *SearchCache) Size() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.entries)
}

// makeSearchCacheKey builds a deterministic cache key from query parameters.
func makeSearchCacheKey(query string, assetTypes []model.InstrumentAssetType, limit int) searchCacheKey {
	normalizedTypes := make([]string, len(assetTypes))
	for i, t := range assetTypes {
		normalizedTypes[i] = string(t)
	}
	sort.Strings(normalizedTypes)

	return searchCacheKey{
		query:      strings.ToLower(strings.TrimSpace(query)),
		assetTypes: strings.Join(normalizedTypes, ","),
		limit:      limit,
	}
}

// promoteLRU moves the given key to the end of the LRU list (most-recently-used).
// Caller must hold c.mu.
func (c *SearchCache) promoteLRU(key searchCacheKey) {
	c.removeFromLRU(key)
	c.lru = append(c.lru, key)
}

// removeFromLRU removes the given key from the LRU list if present.
// Caller must hold c.mu.
func (c *SearchCache) removeFromLRU(key searchCacheKey) {
	for i, k := range c.lru {
		if k == key {
			c.lru = append(c.lru[:i], c.lru[i+1:]...)
			return
		}
	}
}

// evictLRU removes the least-recently-used entry from the cache.
// Caller must hold c.mu and the cache must be non-empty.
func (c *SearchCache) evictLRU() {
	if len(c.lru) == 0 {
		return
	}
	evictKey := c.lru[0]
	c.lru = c.lru[1:]
	delete(c.entries, evictKey)
}

