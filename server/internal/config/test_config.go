package config

import (
	"database/sql"
	"fmt"
	"os"

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

// GetTestDBConfig returns test database configuration
func GetTestDBConfig() *TestDBConfig {
	return &TestDBConfig{
		Host:     getEnvOrDefault("TEST_DB_HOST", "localhost"),
		Port:     getEnvOrDefault("TEST_DB_PORT", "5432"),
		User:     getEnvOrDefault("TEST_DB_USER", "postgres"),
		Password: getEnvOrDefault("TEST_DB_PASSWORD", "postgres"),
		DBName:   getEnvOrDefault("TEST_DB_NAME", "sigma_finance_test"),
		SSLMode:  getEnvOrDefault("TEST_DB_SSLMODE", "disable"),
	}
}

// NewTestDB creates a new test database connection
func NewTestDB() (*bun.DB, error) {
	config := GetTestDBConfig()

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		config.User, config.Password, config.Host, config.Port, config.DBName, config.SSLMode)

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to test database: %w", err)
	}

	return db, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
