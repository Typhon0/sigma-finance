//go:build tools
// +build tools

package main

import (
	"context"
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

	// Update user to verify email
	result, err := db.ExecContext(ctx, "UPDATE sigma_finance.user SET email_verified = true WHERE email = ?", "testuser@test.com")
	if err != nil {
		log.Printf("Error: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	log.Printf("Updated %d rows", rows)
}
