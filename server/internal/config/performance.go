package config

import (
	"time"
)

// PerformanceConfig holds performance-related configuration
type PerformanceConfig struct {
	Database DatabasePerformanceConfig
	Cache    CacheConfig
	Charts   ChartConfig
}

// DatabasePerformanceConfig holds database performance settings
type DatabasePerformanceConfig struct {
	// Connection pool settings
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
	
	// Query optimization settings
	QueryTimeout        time.Duration
	SlowQueryThreshold  time.Duration
	EnableQueryLogging  bool
	
	// Batch processing settings
	BatchSize           int
	MaxBatchWaitTime    time.Duration
	
	// Read replica settings
	EnableReadReplicas  bool
	ReadReplicaHosts    []string
	ReadReplicaRatio    float64 // 0.0-1.0, percentage of reads to route to replicas
}

// CacheConfig holds caching configuration
type CacheConfig struct {
	// Redis settings
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int
	
	// Cache TTL settings
	MarketDataTTL       time.Duration
	PerformanceTTL      time.Duration
	PortfolioTTL        time.Duration
	ChartDataTTL        time.Duration
	
	// Cache size limits
	MaxMemoryUsage      string // e.g., "100mb"
	EvictionPolicy      string // e.g., "allkeys-lru"
	
	// Background refresh settings
	EnableBackgroundRefresh bool
	RefreshInterval         time.Duration
	RefreshBatchSize        int
}

// ChartConfig holds chart performance settings
type ChartConfig struct {
	// Data sampling settings
	MaxDataPoints       int
	SamplingThreshold   int
	SamplingAlgorithm   string // "lttb", "average", "min-max"
	
	// Virtualization settings
	EnableVirtualization bool
	VirtualChunkSize     int
	PreloadChunks        int
	
	// Compression settings
	EnableCompression    bool
	CompressionLevel     int
	CompressionAlgorithm string // "gzip", "brotli"
}

// LoadPerformanceConfig loads performance configuration from environment variables
func LoadPerformanceConfig() *PerformanceConfig {
	return &PerformanceConfig{
		Database: DatabasePerformanceConfig{
			MaxOpenConns:        getEnvIntOrDefault("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:        getEnvIntOrDefault("DB_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime:     getEnvDurationOrDefault("DB_CONN_MAX_LIFETIME", 5*time.Minute),
			ConnMaxIdleTime:     getEnvDurationOrDefault("DB_CONN_MAX_IDLE_TIME", 5*time.Minute),
			QueryTimeout:        getEnvDurationOrDefault("DB_QUERY_TIMEOUT", 30*time.Second),
			SlowQueryThreshold:  getEnvDurationOrDefault("DB_SLOW_QUERY_THRESHOLD", 1*time.Second),
			EnableQueryLogging:  getEnvBoolOrDefault("DB_ENABLE_QUERY_LOGGING", false),
			BatchSize:           getEnvIntOrDefault("DB_BATCH_SIZE", 100),
			MaxBatchWaitTime:    getEnvDurationOrDefault("DB_MAX_BATCH_WAIT_TIME", 10*time.Millisecond),
			EnableReadReplicas:  getEnvBoolOrDefault("DB_ENABLE_READ_REPLICAS", false),
			ReadReplicaHosts:    getEnvSliceOrDefault("DB_READ_REPLICA_HOSTS", []string{}),
			ReadReplicaRatio:    getEnvFloatOrDefault("DB_READ_REPLICA_RATIO", 0.7),
		},
		Cache: CacheConfig{
			RedisHost:               getEnvOrDefault("REDIS_HOST", "localhost"),
			RedisPort:               getEnvOrDefault("REDIS_PORT", "6379"),
			RedisPassword:           getEnvOrDefault("REDIS_PASSWORD", ""),
			RedisDB:                 getEnvIntOrDefault("REDIS_DB", 0),
			MarketDataTTL:           getEnvDurationOrDefault("CACHE_MARKET_DATA_TTL", 1*time.Minute),
			PerformanceTTL:          getEnvDurationOrDefault("CACHE_PERFORMANCE_TTL", 5*time.Minute),
			PortfolioTTL:            getEnvDurationOrDefault("CACHE_PORTFOLIO_TTL", 30*time.Second),
			ChartDataTTL:            getEnvDurationOrDefault("CACHE_CHART_DATA_TTL", 2*time.Minute),
			MaxMemoryUsage:          getEnvOrDefault("REDIS_MAX_MEMORY", "100mb"),
			EvictionPolicy:          getEnvOrDefault("REDIS_EVICTION_POLICY", "allkeys-lru"),
			EnableBackgroundRefresh: getEnvBoolOrDefault("CACHE_ENABLE_BACKGROUND_REFRESH", true),
			RefreshInterval:         getEnvDurationOrDefault("CACHE_REFRESH_INTERVAL", 30*time.Second),
			RefreshBatchSize:        getEnvIntOrDefault("CACHE_REFRESH_BATCH_SIZE", 10),
		},
		Charts: ChartConfig{
			MaxDataPoints:        getEnvIntOrDefault("CHART_MAX_DATA_POINTS", 1000),
			SamplingThreshold:    getEnvIntOrDefault("CHART_SAMPLING_THRESHOLD", 2000),
			SamplingAlgorithm:    getEnvOrDefault("CHART_SAMPLING_ALGORITHM", "lttb"),
			EnableVirtualization: getEnvBoolOrDefault("CHART_ENABLE_VIRTUALIZATION", true),
			VirtualChunkSize:     getEnvIntOrDefault("CHART_VIRTUAL_CHUNK_SIZE", 100),
			PreloadChunks:        getEnvIntOrDefault("CHART_PRELOAD_CHUNKS", 3),
			EnableCompression:    getEnvBoolOrDefault("CHART_ENABLE_COMPRESSION", true),
			CompressionLevel:     getEnvIntOrDefault("CHART_COMPRESSION_LEVEL", 6),
			CompressionAlgorithm: getEnvOrDefault("CHART_COMPRESSION_ALGORITHM", "gzip"),
		},
	}
}

// Helper functions for new config types
func getEnvSliceOrDefault(key string, defaultValue []string) []string {
	// Implementation would parse comma-separated values
	// For now, return default
	return defaultValue
}

func getEnvFloatOrDefault(key string, defaultValue float64) float64 {
	// Implementation would parse float from env
	// For now, return default
	return defaultValue
}