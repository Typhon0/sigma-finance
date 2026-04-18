//go:build tools
// +build tools

package main

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/cmd/bun/migrations"
	"sigma_finance/internal/infrastructure"

	"github.com/uptrace/bun/migrate"
)

func main() {
	// Connect to main database
	fmt.Println("Connecting to main database...")
	db, err := infrastructure.NewDB()
	if err != nil {
		log.Fatalf("Failed to connect to main database: %v", err)
	}
	defer db.Close()
	fmt.Println("Connected successfully")

	// Create migrator
	migrator := migrate.NewMigrator(db, migrations.Migrations)

	ctx := context.Background()

	// Initialize migration tables
	if err := migrator.Init(ctx); err != nil {
		log.Fatalf("Failed to initialize migrations: %v", err)
	}

	// Unlock migrations first (in case they were left locked)
	migrator.Unlock(ctx)

	// Run migrations
	if err := migrator.Lock(ctx); err != nil {
		log.Fatalf("Failed to lock migrations: %v", err)
	}
	defer migrator.Unlock(ctx)

	group, err := migrator.Migrate(ctx)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	if group.IsZero() {
		fmt.Println("No new migrations to run (database is up to date)")
	} else {
		fmt.Printf("Migrated to %s\n", group)
	}
}
