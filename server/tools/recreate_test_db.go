//go:build tools
// +build tools

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/lib/pq"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

func main() {
	// Connect to default postgres database to drop and recreate test database
	// Use admin credentials since only a superuser can DROP/CREATE DATABASE
	host := getEnvOrDefault("TEST_DB_HOST", "localhost")
	port := getEnvOrDefault("TEST_DB_PORT", "5432")
	user := getEnvOrDefault("TEST_DB_ADMIN_USER", "postgres")
	password := getEnvOrDefault("TEST_DB_ADMIN_PASSWORD", "postgres")
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

	db.Close()

	// Connect to the new test database and grant schema permissions
	// NOTE: Keep these GRANTs in sync with config.EnsureTestSchemaPermissions().
	schemaUser := getEnvOrDefault("TEST_DB_USER", "sigma_finance")
	adminUser := getEnvOrDefault("TEST_DB_ADMIN_USER", "postgres")
	adminPassword := getEnvOrDefault("TEST_DB_ADMIN_PASSWORD", "postgres")

	adminDSN := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		adminUser, adminPassword, host, port, testDBName, sslmode)
	adminSqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(adminDSN)))
	adminDB := bun.NewDB(adminSqldb, pgdialect.New())
	defer adminDB.Close()

	if err := adminDB.Ping(); err != nil {
		log.Fatalf("Failed to connect to test database as admin: %v", err)
	}

	qSchema := pq.QuoteIdentifier("sigma_finance")
	qUser := pq.QuoteIdentifier(schemaUser)
	qAdmin := pq.QuoteIdentifier(adminUser)

	// Create schema and grant permissions
	_, err = adminDB.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", qSchema))
	if err != nil {
		log.Fatalf("Failed to create schema: %v", err)
	}
	_, err = adminDB.Exec(fmt.Sprintf("GRANT USAGE, CREATE ON SCHEMA %s TO %s", qSchema, qUser))
	if err != nil {
		log.Fatalf("Failed to grant schema privileges: %v", err)
	}
	_, err = adminDB.Exec(fmt.Sprintf("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %s TO %s", qSchema, qUser))
	if err != nil {
		log.Fatalf("Failed to grant table privileges: %v", err)
	}
	_, err = adminDB.Exec(fmt.Sprintf("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %s TO %s", qSchema, qUser))
	if err != nil {
		log.Fatalf("Failed to grant sequence privileges: %v", err)
	}
	_, err = adminDB.Exec(fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA %s GRANT ALL PRIVILEGES ON TABLES TO %s", qAdmin, qSchema, qUser))
	if err != nil {
		log.Fatalf("Failed to set default privileges: %v", err)
	}
	_, err = adminDB.Exec(fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA %s GRANT ALL PRIVILEGES ON SEQUENCES TO %s", qAdmin, qSchema, qUser))
	if err != nil {
		log.Fatalf("Failed to set default sequence privileges: %v", err)
	}

	fmt.Printf("Schema permissions granted to %s\n", schemaUser)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
