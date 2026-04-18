//go:build tools
// +build tools

package main

import (
	"context"
	"fmt"
	"log"

	"github.com/joho/godotenv"
	"sigma_finance/internal/infrastructure"
)

func main() {
	godotenv.Load()

	db, err := infrastructure.NewDB()
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	// List all tables in sigma_finance schema
	rows, err := db.QueryContext(ctx, `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'sigma_finance'
		ORDER BY table_name
	`)
	if err != nil {
		log.Fatalf("Failed to query tables: %v", err)
	}
	defer rows.Close()

	fmt.Println("Tables in sigma_finance schema:")
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			log.Printf("Error scanning: %v", err)
			continue
		}
		fmt.Printf("  - %s\n", tableName)
	}
}
