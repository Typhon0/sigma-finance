//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure"
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

	ctx := context.Background()

	// Seed asset types
	assetTypes := []model.AssetType{
		{Name: "Stock"},
		{Name: "Crypto"},
		{Name: "Bank"},
		{Name: "RealEstate"},
		{Name: "Insurance"},
		{Name: "Watch"},
	}

	for _, assetType := range assetTypes {
		_, err := db.NewInsert().Model(&assetType).Returning("*").Exec(ctx)
		if err != nil {
			log.Printf("Failed to insert asset type %s: %v", assetType.Name, err)
		} else {
			fmt.Printf("Inserted asset type: %s (ID: %d)\n", assetType.Name, assetType.ID)
		}
	}

	// Seed some test users
	users := []model.User{
		{Username: "alice", Email: "alice@example.com", Password: "password123"},
		{Username: "bob", Email: "bob@example.com", Password: "password123"},
	}

	for _, user := range users {
		_, err := db.NewInsert().Model(&user).Returning("*").Exec(ctx)
		if err != nil {
			log.Printf("Failed to insert user %s: %v", user.Username, err)
		} else {
			fmt.Printf("Inserted user: %s (ID: %d)\n", user.Username, user.ID)
		}
	}

	// Seed some test portfolios
	portfolios := []model.Portfolio{
		{UserID: 1, Name: "Tech Portfolio"},
		{UserID: 1, Name: "Crypto Portfolio"},
		{UserID: 2, Name: "Conservative Portfolio"},
	}

	for _, portfolio := range portfolios {
		_, err := db.NewInsert().Model(&portfolio).Returning("*").Exec(ctx)
		if err != nil {
			log.Printf("Failed to insert portfolio %s: %v", portfolio.Name, err)
		} else {
			fmt.Printf("Inserted portfolio: %s (ID: %d)\n", portfolio.Name, portfolio.ID)
		}
	}

	// Seed some test watchlists
	watchlists := []model.Watchlist{
		{UserID: 1, Name: "Actions à surveiller"},
		{UserID: 2, Name: "Crypto Watch"},
	}

	for _, watchlist := range watchlists {
		_, err := db.NewInsert().Model(&watchlist).Returning("*").Exec(ctx)
		if err != nil {
			log.Printf("Failed to insert watchlist %s: %v", watchlist.Name, err)
		} else {
			fmt.Printf("Inserted watchlist: %s (ID: %d)\n", watchlist.Name, watchlist.ID)
		}
	}

	fmt.Println("Database seeding completed successfully!")
}
