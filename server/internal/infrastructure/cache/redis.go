package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
	"sigma_finance/internal/config"
)

// RedisCache implements caching using Redis with performance optimizations
type RedisCache struct {
	client *redis.Client
	config *config.CacheConfig
}

// CacheKey represents different types of cache keys
type CacheKey string

const (
	MarketDataKey    CacheKey = "market_data"
	PerformanceKey   CacheKey = "performance"
	PortfolioKey     CacheKey = "portfolio"
	ChartDataKey     CacheKey = "chart_data"
	AllocationKey    CacheKey = "allocation"
)

// NewRedisCache creates a new Redis cache instance
func NewRedisCache(config *config.CacheConfig) (*RedisCache, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", config.RedisHost, config.RedisPort),
		Password: config.RedisPassword,
		DB:       config.RedisDB,
		
		// Connection pool settings for performance
		PoolSize:     20,
		MinIdleConns: 5,
		MaxRetries:   3,
		
		// Timeouts
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolTimeout:  4 * time.Second,
		
		// Keep-alive
		IdleTimeout:    300 * time.Second,
		IdleCheckFrequency: 60 * time.Second,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	cache := &RedisCache{
		client: rdb,
		config: config,
	}

	// Configure Redis for optimal performance
	if err := cache.configureRedis(ctx); err != nil {
		log.Printf("Warning: Failed to configure Redis optimizations: %v", err)
	}

	// Start background refresh if enabled
	if config.EnableBackgroundRefresh {
		go cache.backgroundRefresh()
	}

	return cache, nil
}

// configureRedis sets up Redis for optimal performance
func (r *RedisCache) configureRedis(ctx context.Context) error {
	// Set memory policy
	if r.config.MaxMemoryUsage != "" {
		if err := r.client.ConfigSet(ctx, "maxmemory", r.config.MaxMemoryUsage).Err(); err != nil {
			return fmt.Errorf("failed to set maxmemory: %w", err)
		}
	}

	if r.config.EvictionPolicy != "" {
		if err := r.client.ConfigSet(ctx, "maxmemory-policy", r.config.EvictionPolicy).Err(); err != nil {
			return fmt.Errorf("failed to set eviction policy: %w", err)
		}
	}

	return nil
}

// Set stores a value in cache with appropriate TTL
func (r *RedisCache) Set(ctx context.Context, keyType CacheKey, key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	fullKey := r.buildKey(keyType, key)
	ttl := r.getTTL(keyType)

	return r.client.Set(ctx, fullKey, data, ttl).Err()
}

// Get retrieves a value from cache
func (r *RedisCache) Get(ctx context.Context, keyType CacheKey, key string, dest interface{}) error {
	fullKey := r.buildKey(keyType, key)
	
	data, err := r.client.Get(ctx, fullKey).Result()
	if err != nil {
		if err == redis.Nil {
			return ErrCacheMiss
		}
		return fmt.Errorf("failed to get from cache: %w", err)
	}

	return json.Unmarshal([]byte(data), dest)
}

// SetMultiple stores multiple values in a single pipeline operation
func (r *RedisCache) SetMultiple(ctx context.Context, items map[string]CacheItem) error {
	pipe := r.client.Pipeline()

	for key, item := range items {
		data, err := json.Marshal(item.Value)
		if err != nil {
			return fmt.Errorf("failed to marshal value for key %s: %w", key, err)
		}

		fullKey := r.buildKey(item.KeyType, key)
		ttl := r.getTTL(item.KeyType)
		pipe.Set(ctx, fullKey, data, ttl)
	}

	_, err := pipe.Exec(ctx)
	return err
}

// GetMultiple retrieves multiple values in a single pipeline operation
func (r *RedisCache) GetMultiple(ctx context.Context, keys []CacheRequest) (map[string]interface{}, error) {
	pipe := r.client.Pipeline()
	cmds := make(map[string]*redis.StringCmd)

	for _, req := range keys {
		fullKey := r.buildKey(req.KeyType, req.Key)
		cmds[req.Key] = pipe.Get(ctx, fullKey)
	}

	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("pipeline execution failed: %w", err)
	}

	results := make(map[string]interface{})
	for key, cmd := range cmds {
		data, err := cmd.Result()
		if err == redis.Nil {
			continue // Skip missing keys
		}
		if err != nil {
			log.Printf("Warning: Failed to get key %s: %v", key, err)
			continue
		}

		var value interface{}
		if err := json.Unmarshal([]byte(data), &value); err != nil {
			log.Printf("Warning: Failed to unmarshal key %s: %v", key, err)
			continue
		}

		results[key] = value
	}

	return results, nil
}

// Delete removes a key from cache
func (r *RedisCache) Delete(ctx context.Context, keyType CacheKey, key string) error {
	fullKey := r.buildKey(keyType, key)
	return r.client.Del(ctx, fullKey).Err()
}

// DeletePattern removes all keys matching a pattern
func (r *RedisCache) DeletePattern(ctx context.Context, keyType CacheKey, pattern string) error {
	fullPattern := r.buildKey(keyType, pattern)
	
	keys, err := r.client.Keys(ctx, fullPattern).Result()
	if err != nil {
		return fmt.Errorf("failed to get keys for pattern: %w", err)
	}

	if len(keys) == 0 {
		return nil
	}

	return r.client.Del(ctx, keys...).Err()
}

// Exists checks if a key exists in cache
func (r *RedisCache) Exists(ctx context.Context, keyType CacheKey, key string) (bool, error) {
	fullKey := r.buildKey(keyType, key)
	count, err := r.client.Exists(ctx, fullKey).Result()
	return count > 0, err
}

// GetTTL returns the remaining TTL for a key
func (r *RedisCache) GetTTL(ctx context.Context, keyType CacheKey, key string) (time.Duration, error) {
	fullKey := r.buildKey(keyType, key)
	return r.client.TTL(ctx, fullKey).Result()
}

// RefreshTTL extends the TTL for a key
func (r *RedisCache) RefreshTTL(ctx context.Context, keyType CacheKey, key string) error {
	fullKey := r.buildKey(keyType, key)
	ttl := r.getTTL(keyType)
	return r.client.Expire(ctx, fullKey, ttl).Err()
}

// buildKey creates a full cache key with namespace
func (r *RedisCache) buildKey(keyType CacheKey, key string) string {
	return fmt.Sprintf("sigma_finance:%s:%s", keyType, key)
}

// getTTL returns the appropriate TTL for a key type
func (r *RedisCache) getTTL(keyType CacheKey) time.Duration {
	switch keyType {
	case MarketDataKey:
		return r.config.MarketDataTTL
	case PerformanceKey:
		return r.config.PerformanceTTL
	case PortfolioKey:
		return r.config.PortfolioTTL
	case ChartDataKey:
		return r.config.ChartDataTTL
	default:
		return 5 * time.Minute // Default TTL
	}
}

// backgroundRefresh periodically refreshes cache entries
func (r *RedisCache) backgroundRefresh() {
	ticker := time.NewTicker(r.config.RefreshInterval)
	defer ticker.Stop()

	for range ticker.C {
		// This would be implemented to refresh specific cache entries
		// based on usage patterns and business logic
		log.Printf("Background cache refresh cycle started")
	}
}

// Close closes the Redis connection
func (r *RedisCache) Close() error {
	return r.client.Close()
}

// CacheItem represents an item to be cached
type CacheItem struct {
	KeyType CacheKey
	Value   interface{}
}

// CacheRequest represents a cache retrieval request
type CacheRequest struct {
	KeyType CacheKey
	Key     string
}

// ErrCacheMiss is returned when a key is not found in cache
var ErrCacheMiss = fmt.Errorf("cache miss")

// GetStats returns Redis statistics
func (r *RedisCache) GetStats(ctx context.Context) (map[string]string, error) {
	info, err := r.client.Info(ctx, "memory", "stats").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get Redis stats: %w", err)
	}

	// Parse info string into map
	stats := make(map[string]string)
	// Implementation would parse the Redis INFO output
	stats["info"] = info

	return stats, nil
}