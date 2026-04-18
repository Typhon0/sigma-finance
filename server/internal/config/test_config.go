package config

import (
	"database/sql"
	"fmt"
	"context"
	"net/url"
	"strings"

	"github.com/lib/pq"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

// TestDBConfig holds test database configuration
type TestDBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// TestAdminDBConfig holds admin (superuser) test database configuration.
// This is used for schema ownership and permission grants.
type TestAdminDBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// GetTestDBConfig returns test database configuration
func GetTestDBConfig() *TestDBConfig {
	return &TestDBConfig{
		Host:     getEnvOrDefault("TEST_DB_HOST", "192.168.1.170"),
		Port:     getEnvOrDefault("TEST_DB_PORT", "5432"),
		User:     getEnvOrDefault("TEST_DB_USER", "sigma_finance"),
		Password: getEnvOrDefault("TEST_DB_PASSWORD", "xQxW&yATWuC2N3*8"),
		DBName:   getEnvOrDefault("TEST_DB_NAME", "sigma_finance_test"),
		SSLMode:  getEnvOrDefault("TEST_DB_SSLMODE", "disable"),
	}
}

// GetTestAdminDBConfig returns admin test database configuration.
// Falls back to TEST_DB_* env vars with admin-specific overrides.
func GetTestAdminDBConfig() *TestAdminDBConfig {
	testCfg := GetTestDBConfig()
	return &TestAdminDBConfig{
		Host:     getEnvOrDefault("TEST_DB_ADMIN_HOST", testCfg.Host),
		Port:     getEnvOrDefault("TEST_DB_ADMIN_PORT", testCfg.Port),
		User:     getEnvOrDefault("TEST_DB_ADMIN_USER", "postgres"),
		Password: getEnvOrDefault("TEST_DB_ADMIN_PASSWORD", "postgres"),
		DBName:   getEnvOrDefault("TEST_DB_ADMIN_NAME", testCfg.DBName),
		SSLMode:  getEnvOrDefault("TEST_DB_ADMIN_SSLMODE", testCfg.SSLMode),
	}
}

// NewTestDB creates a new test database connection
func NewTestDB() (*bun.DB, error) {
	config := GetTestDBConfig()

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		url.PathEscape(config.User), url.PathEscape(config.Password), config.Host, config.Port, config.DBName, config.SSLMode)

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to test database: %w", err)
	}

	return db, nil
}

// NewAdminTestDB creates a new admin (superuser) test database connection.
// This is used for schema ownership and permission grants.
func NewAdminTestDB() (*bun.DB, error) {
	config := GetTestAdminDBConfig()

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		url.PathEscape(config.User), url.PathEscape(config.Password), config.Host, config.Port, config.DBName, config.SSLMode)

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to admin test database: %w", err)
	}

	return db, nil
}

// EnsureTestSchemaPermissions grants the test DB user full access to the
// sigma_finance schema. This must be called with an admin (superuser)
// connection. It ensures the schema exists, grants USAGE/CREATE, and sets
// default privileges for future objects created by the admin user.
//
// When running multiple test packages in parallel, each process may execute
// GRANTs concurrently, causing "tuple concurrently updated" (SQLSTATE XX000).
// This is harmless — it means another process already granted — so we ignore it.
func EnsureTestSchemaPermissions(ctx context.Context, adminDB *bun.DB) error {
	testUser := pq.QuoteIdentifier(GetTestDBConfig().User)
	schemaName := pq.QuoteIdentifier("sigma_finance")
	adminUser := pq.QuoteIdentifier(GetTestAdminDBConfig().User)

	grant := func(sql string, desc string) error {
		_, err := adminDB.ExecContext(ctx, sql)
		if err != nil {
			if isConcurrentTupleUpdate(err) {
				return nil // another process already granted
			}
			return fmt.Errorf("%s: %w", desc, err)
		}
		return nil
	}

	// Ensure schema exists
	_, err := adminDB.ExecContext(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName))
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	// Grant schema-level privileges
	if err := grant(fmt.Sprintf("GRANT USAGE, CREATE ON SCHEMA %s TO %s", schemaName, testUser),
		"grant schema privileges"); err != nil {
		return err
	}

	// Grant table/sequence/function privileges
	if err := grant(fmt.Sprintf("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %s TO %s", schemaName, testUser),
		"grant table privileges"); err != nil {
		return err
	}
	if err := grant(fmt.Sprintf("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %s TO %s", schemaName, testUser),
		"grant sequence privileges"); err != nil {
		return err
	}
	if err := grant(fmt.Sprintf("GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA %s TO %s", schemaName, testUser),
		"grant function privileges"); err != nil {
		return err
	}

	// Set default privileges for future objects created by the admin user
	if err := grant(fmt.Sprintf(
		"ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA %s GRANT ALL PRIVILEGES ON TABLES TO %s",
		adminUser, schemaName, testUser),
		"set default table privileges"); err != nil {
		return err
	}
	if err := grant(fmt.Sprintf(
		"ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA %s GRANT ALL PRIVILEGES ON SEQUENCES TO %s",
		adminUser, schemaName, testUser),
		"set default sequence privileges"); err != nil {
		return err
	}

	return nil
}

// isConcurrentTupleUpdate returns true if the error is a PostgreSQL
// "tuple concurrently updated" error (SQLSTATE XX000), which occurs when
// multiple processes GRANT simultaneously and is harmless.
func isConcurrentTupleUpdate(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "tuple concurrently updated")
}

// Removed duplicate getEnvOrDefault function - using the one from config.go
