//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure"
	"time"

	"github.com/google/uuid"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run setup_api_key.go <provider> <api_key>")
		fmt.Println("")
		fmt.Println("Providers: FINNHUB, TIINGO, TWELVEDATA, ALPHAVANTAGE")
		fmt.Println("")
		fmt.Println("Example:")
		fmt.Println("  go run setup_api_key.go FINNHUB your-finnhub-api-key")
		fmt.Println("  go run setup_api_key.go TIINGO your-tiingo-api-key")
		os.Exit(1)
	}

	provider := os.Args[1]
	apiKey := os.Args[2]

	// Validate provider
	validProviders := map[string]bool{
		"FINNHUB":       true,
		"TIINGO":        true,
		"TWELVEDATA":    true,
		"ALPHAVANTAGE":  true,
		"BINANCE":       true,
		"CRYPTOCOMPARE": true,
	}

	if !validProviders[provider] {
		log.Fatalf("Invalid provider: %s. Valid providers: FINNHUB, TIINGO, TWELVEDATA, ALPHAVANTAGE, BINANCE, CRYPTOCOMPARE", provider)
	}

	// Connect to database
	fmt.Println("Connecting to database...")
	db, err := infrastructure.NewDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	// Check if system-wide credential already exists for this provider
	var existing model.MarketDataCredential
	err = db.NewSelect().
		Model(&existing).
		Where("provider = ? AND is_system = ?", provider, true).
		Scan(ctx)

	if err == nil {
		// Update existing
		fmt.Printf("Updating existing system-wide API key for %s...\n", provider)
		existing.APIKey = apiKey
		existing.UpdatedAt = time.Now()

		// Encrypt if possible
		if encErr := existing.Encrypt(); encErr != nil {
			fmt.Printf("Warning: Could not encrypt API key: %v\n", encErr)
		}

		_, err = db.NewUpdate().Model(&existing).WherePK().Exec(ctx)
		if err != nil {
			log.Fatalf("Failed to update credential: %v", err)
		}
		fmt.Printf("✓ Updated system-wide API key for %s\n", provider)
	} else {
		// Create new
		fmt.Printf("Creating new system-wide API key for %s...\n", provider)
		cred := &model.MarketDataCredential{
			ID:        uuid.New().String(),
			Provider:  provider,
			APIKey:    apiKey,
			IsSystem:  true,
			UserID:    "", // Empty for system-wide
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Encrypt if possible
		if encErr := cred.Encrypt(); encErr != nil {
			fmt.Printf("Warning: Could not encrypt API key: %v\n", encErr)
		}

		_, err = db.NewInsert().Model(cred).Exec(ctx)
		if err != nil {
			log.Fatalf("Failed to create credential: %v", err)
		}
		fmt.Printf("✓ Created system-wide API key for %s\n", provider)
	}

	// Verify the credential was saved
	var verify model.MarketDataCredential
	err = db.NewSelect().
		Model(&verify).
		Where("provider = ? AND is_system = ?", provider, true).
		Scan(ctx)

	if err != nil {
		log.Fatalf("Failed to verify credential: %v", err)
	}

	fmt.Println("")
	fmt.Println("=== API Key Setup Complete ===")
	fmt.Printf("Provider: %s\n", verify.Provider)
	fmt.Printf("Is System-wide: %v\n", verify.IsSystem)
	fmt.Printf("Created At: %s\n", verify.CreatedAt.Format(time.RFC3339))
	fmt.Println("")
	fmt.Println("You can now restart the server and prices will be fetched automatically.")
}
