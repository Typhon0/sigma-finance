//go:build tools
// +build tools

package main

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/internal/config"
	"sigma_finance/internal/infrastructure"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

func main() {
	// Load config
	cfg := config.LoadConfig()

	// Initialize database
	db, err := infrastructure.NewDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Unit of Work
	uow := repository.NewUnitOfWork(db)

	// Initialize services
	serviceContainer := service.NewServiceContainer(uow, cfg)

	// Test registration
	ctx := context.Background()

	req := service.RegisterRequest{
		Email:    "testuser999@example.com",
		Password: "TestPass123!",
		Name:     "Test User 999",
	}

	resp, err := serviceContainer.Authentication.Register(ctx, req)
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
		return
	}

	fmt.Printf("SUCCESS: %+v\n", resp)
}
