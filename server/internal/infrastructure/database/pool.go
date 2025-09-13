package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"sigma_finance/internal/config"
)

// PoolManager manages database connection pools with performance optimizations
type PoolManager struct {
	primary   *bun.DB
	replicas  []*bun.DB
	config    *config.DatabasePerformanceConfig
	stats     *PoolStats
}

// PoolStats tracks connection pool statistics
type PoolStats struct {
	TotalQueries     int64
	SlowQueries      int64
	ReplicaQueries   int64
	AvgQueryTime     time.Duration
	ConnectionErrors int64
}

// NewPoolManager creates a new database pool manager with optimized settings
func NewPoolManager(dbConfig *config.DatabaseConfig, perfConfig *config.DatabasePerformanceConfig) (*PoolManager, error) {
	// Create primary database connection
	primary, err := createOptimizedConnection(dbConfig, perfConfig, "primary")
	if err != nil {
		return nil, fmt.Errorf("failed to create primary connection: %w", err)
	}

	pm := &PoolManager{
		primary: primary,
		config:  perfConfig,
		stats:   &PoolStats{},
	}

	// Create read replica connections if enabled
	if perfConfig.EnableReadReplicas {
		for i, host := range perfConfig.ReadReplicaHosts {
			replicaConfig := *dbConfig
			replicaConfig.Host = host
			
			replica, err := createOptimizedConnection(&replicaConfig, perfConfig, fmt.Sprintf("replica-%d", i))
			if err != nil {
				log.Printf("Warning: Failed to create replica connection to %s: %v", host, err)
				continue
			}
			pm.replicas = append(pm.replicas, replica)
		}
	}

	// Start background monitoring
	go pm.monitorConnections()

	return pm, nil
}

// createOptimizedConnection creates a database connection with performance optimizations
func createOptimizedConnection(dbConfig *config.DatabaseConfig, perfConfig *config.DatabasePerformanceConfig, name string) (*bun.DB, error) {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		dbConfig.User, dbConfig.Password, dbConfig.Host, dbConfig.Port, dbConfig.DBName, dbConfig.SSLMode)

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	
	// Configure connection pool for optimal performance
	sqldb.SetMaxOpenConns(perfConfig.MaxOpenConns)
	sqldb.SetMaxIdleConns(perfConfig.MaxIdleConns)
	sqldb.SetConnMaxLifetime(perfConfig.ConnMaxLifetime)
	sqldb.SetConnMaxIdleTime(perfConfig.ConnMaxIdleTime)

	db := bun.NewDB(sqldb, pgdialect.New())

	// Add query hooks for monitoring and optimization
	if perfConfig.EnableQueryLogging || perfConfig.SlowQueryThreshold > 0 {
		db.AddQueryHook(&QueryMonitorHook{
			slowThreshold: perfConfig.SlowQueryThreshold,
			enableLogging: perfConfig.EnableQueryLogging,
			name:          name,
		})
	}

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// GetReadDB returns a database connection optimized for read operations
func (pm *PoolManager) GetReadDB() *bun.DB {
	// Use replica if available and configured
	if len(pm.replicas) > 0 && pm.shouldUseReplica() {
		// Simple round-robin selection
		replica := pm.replicas[int(pm.stats.ReplicaQueries)%len(pm.replicas)]
		pm.stats.ReplicaQueries++
		return replica
	}
	return pm.primary
}

// GetWriteDB returns the primary database connection for write operations
func (pm *PoolManager) GetWriteDB() *bun.DB {
	return pm.primary
}

// shouldUseReplica determines if a replica should be used based on configuration
func (pm *PoolManager) shouldUseReplica() bool {
	if pm.config.ReadReplicaRatio <= 0 {
		return false
	}
	
	// Simple probability-based selection
	totalQueries := pm.stats.TotalQueries + pm.stats.ReplicaQueries
	if totalQueries == 0 {
		return true
	}
	
	currentRatio := float64(pm.stats.ReplicaQueries) / float64(totalQueries)
	return currentRatio < pm.config.ReadReplicaRatio
}

// monitorConnections monitors connection pool health and performance
func (pm *PoolManager) monitorConnections() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		pm.logPoolStats()
	}
}

// logPoolStats logs connection pool statistics
func (pm *PoolManager) logPoolStats() {
	primaryStats := pm.primary.Stats()
	
	log.Printf("DB Pool Stats - Primary: Open=%d, InUse=%d, Idle=%d, WaitCount=%d, WaitDuration=%v",
		primaryStats.OpenConnections,
		primaryStats.InUse,
		primaryStats.Idle,
		primaryStats.WaitCount,
		primaryStats.WaitDuration,
	)

	for i, replica := range pm.replicas {
		replicaStats := replica.Stats()
		log.Printf("DB Pool Stats - Replica %d: Open=%d, InUse=%d, Idle=%d",
			i, replicaStats.OpenConnections, replicaStats.InUse, replicaStats.Idle)
	}
}

// Close closes all database connections
func (pm *PoolManager) Close() error {
	var errs []error

	if err := pm.primary.Close(); err != nil {
		errs = append(errs, fmt.Errorf("failed to close primary connection: %w", err))
	}

	for i, replica := range pm.replicas {
		if err := replica.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close replica %d: %w", i, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors closing connections: %v", errs)
	}

	return nil
}

// GetStats returns current pool statistics
func (pm *PoolManager) GetStats() *PoolStats {
	return pm.stats
}

// QueryMonitorHook monitors query performance and logs slow queries
type QueryMonitorHook struct {
	slowThreshold time.Duration
	enableLogging bool
	name          string
}

func (h *QueryMonitorHook) BeforeQuery(ctx context.Context, event *bun.QueryEvent) context.Context {
	return ctx
}

func (h *QueryMonitorHook) AfterQuery(ctx context.Context, event *bun.QueryEvent) {
	duration := time.Since(event.StartTime)
	
	if h.slowThreshold > 0 && duration > h.slowThreshold {
		log.Printf("SLOW QUERY [%s] %v: %s", h.name, duration, event.Query)
	}
	
	if h.enableLogging {
		log.Printf("QUERY [%s] %v: %s", h.name, duration, event.Query)
	}
}