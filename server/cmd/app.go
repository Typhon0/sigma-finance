package main

import (
	"context"
	"fmt"
	"log"
	"sigma_finance/cmd/bun/migrations"
	"sigma_finance/internal/handler/graphql"
	"sigma_finance/internal/infrastructure"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

// AppContainer holds all the dependencies for the application.
type AppContainer struct {
	FiberApp *fiber.App
	// Add other dependencies here, e.g., DB, services
}

// NewApp creates and wires the entire application.
func NewApp() (*AppContainer, error) {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	db, err := infrastructure.NewDB()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Run migrations
	ctx := context.Background()
	err = migrations.Migrate(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize Unit of Work
	uow := repository.NewUnitOfWork(db)

	// Initialize services
	serviceContainer := service.NewServiceContainer(uow)

	// Initialize GraphQL resolver
	resolver := &graphql.Resolver{
		PortfolioService:   serviceContainer.Portfolio,
		UserService:        serviceContainer.User,
		AssetService:       serviceContainer.Asset,
		TagService:         serviceContainer.Tag,
		TransactionService: serviceContainer.Transaction,
		WatchlistService:   serviceContainer.Watchlist,
		UOW:                uow,
	}

	// Initialize Fiber app
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins: "https://d7g9j7jl-5173.uks1.devtunnels.ms",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))
	app.Use(logger.New())
	app.Use(recover.New())

	// Setup GraphQL endpoint
	srv := handler.NewDefaultServer(graphql.NewExecutableSchema(graphql.Config{Resolvers: resolver}))
	pg := playground.Handler("GraphQL playground", "/graphql")

	app.All("/graphql", func(c *fiber.Ctx) error {
		fasthttpadaptor.NewFastHTTPHandler(srv)(c.Context())
		return nil
	})

	app.All("/playground", func(c *fiber.Ctx) error {
		fasthttpadaptor.NewFastHTTPHandler(pg)(c.Context())
		return nil
	})

	return &AppContainer{
		FiberApp: app,
	}, nil
}
