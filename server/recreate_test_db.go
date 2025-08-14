//go:build ignore
// +build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func main() {
	// Connect to default postgres database to drop and recreate test database
	host := getEnvOrDefault("TEST_DB_HOST", "localhost")
	port := getEnvOrDefault("TEST_DB_PORT", "5432")
	user := getEnvOrDefault("TEST_DB_USER", "postgres")
	password := getEnvOrDefault("TEST_DB_PASSWORD", "postgres")
	sslmode := getEnvOrDefault("TEST_DB_SSLMODE", "disable")
	testDBName := getEnvOrDefault("TEST_DB_NAME", "sigma_finance_test")

	// Connect to postgres database first
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/postgres?sslmode=%s",
		user, password, host, port, sslmode)

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	defer db.Close()

	// Drop test database if it exists
	_, err := db.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %s", testDBName))
	if err != nil {
		log.Fatalf("Failed to drop test database: %v", err)
	}
	fmt.Printf("Dropped test database %s\n", testDBName)

	// Create test database
	_, err = db.Exec(fmt.Sprintf("CREATE DATABASE %s", testDBName))
	if err != nil {
		log.Fatalf("Failed to create test database: %v", err)
	}
	fmt.Printf("Created test database %s\n", testDBName)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
