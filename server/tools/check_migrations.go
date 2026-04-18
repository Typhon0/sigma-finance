//go:build tools
// +build tools

package main

import (
	"database/sql"
	"fmt"
	"github.com/uptrace/bun/driver/pgdriver"
)

func main() {
	dsn := "postgres://sigma_finance:xQxW%26yATWuC2N3%2A8@192.168.1.170:5432/sigma_finance?sslmode=disable"
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	defer sqldb.Close()

	fmt.Println("=== CHECKING MIGRATION STATUS ===\n")

	// Check if migrations table exists
	var tableExists bool
	sqldb.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'sigma_finance' 
			AND table_name = 'bun_migrations'
		)
	`).Scan(&tableExists)

	if !tableExists {
		fmt.Println("❌ bun_migrations table doesn't exist")
		return
	}

	// List recent migrations
	fmt.Println("Recent migrations applied:")
	rows, _ := sqldb.Query(`
		SELECT name, created_at FROM sigma_finance.bun_migrations 
		ORDER BY created_at DESC LIMIT 10
	`)
	defer rows.Close()

	for rows.Next() {
		var name, createdAt string
		rows.Scan(&name, &createdAt)
		fmt.Printf("  • %s (%s)\n", name, createdAt[:19])
	}

	// Check if our new migration files are in the list
	fmt.Println("\nLooking for new migrations...")
	newMigs := []string{"14042026_add_2026_price_partitions", "14042026_add_system_credentials"}
	for _, m := range newMigs {
		var count int
		sqldb.QueryRow(`SELECT COUNT(*) FROM sigma_finance.bun_migrations WHERE name LIKE $1`, m+"%").Scan(&count)
		if count > 0 {
			fmt.Printf("  ✓ %s: APPLIED\n", m)
		} else {
			fmt.Printf("  ✗ %s: NOT APPLIED YET\n", m)
		}
	}
}
