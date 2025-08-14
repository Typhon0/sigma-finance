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
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

// App contains the fully constructed application with all its dependencies.
type App struct {
	FiberApp *fiber.App
}

// NewApp creates and wires up the entire application.
// This function acts as our dependency injection container.
func NewApp() (*App, error) {
	// Initialize database connection with error handling
	db, err := infrastructure.NewDB()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	// Test database connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	log.Println("Database connection established successfully")

	// Run Bun ORM migrations with error handling
	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize Unit of Work
	uow := repository.NewUnitOfWork(db)

	// Initialize services by injecting the Unit of Work
	portfolioService := service.NewPortfolioService(uow)
	userService := service.NewUserService(uow)
	assetService := service.NewAssetService(uow)
	tagService := service.NewTagService(uow)
	transactionService := service.NewTransactionService(uow)
	watchlistService := service.NewWatchlistService(uow)

	// Initialize GraphQL resolver with services
	resolver := &graphql.Resolver{
		PortfolioService:   portfolioService,
		UserService:        userService,
		AssetService:       assetService,
		TagService:         tagService,
		TransactionService: transactionService,
		WatchlistService:   watchlistService,
		UOW:                uow,
	}

	// Create GraphQL schema and server
	schema := graphql.NewExecutableSchema(graphql.Config{Resolvers: resolver})
	gqlServer := handler.NewDefaultServer(schema)

	// Initialize Fiber app with configuration
	app := fiber.New(fiber.Config{
		ErrorHandler: errorHandler,
		AppName:      "Sigma Finance API",
		ServerHeader: "Sigma Finance",
	})

	// Add middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} - ${latency}\n",
	}))

	// Setup routes
	setupRoutes(app, gqlServer)

	log.Println("Application initialized successfully")
	return &App{FiberApp: app}, nil
}

// runMigrations is a helper function to keep the NewApp constructor clean.
func runMigrations(db *bun.DB) error {
	ctx := context.Background()
	migrator := migrate.NewMigrator(db, migrations.Migrations)

	if err := migrator.Init(ctx); err != nil {
		return fmt.Errorf("migration init failed: %w", err)
	}

	group, err := migrator.Migrate(ctx)
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	if group.IsZero() {
		log.Println("No new migrations to apply.")
		return nil
	}

	log.Printf("Migrations applied: %v", group)
	return nil
}

// setupRoutes centralizes all the application's routing.
func setupRoutes(app *fiber.App, gqlServer *handler.Server) {
	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "OK",
		})
	})

	// GraphQL Playground endpoint
	app.Get("/playground", func(c *fiber.Ctx) error {
		fasthttpadaptor.NewFastHTTPHandler(
			playground.Handler("GraphQL Playground", "/graphql"),
		)(c.Context())
		return nil
	})

	// The actual GraphQL endpoint
	app.Post("/graphql", func(c *fiber.Ctx) error {
		fasthttpadaptor.NewFastHTTPHandler(gqlServer)(c.Context())
		return nil
	})

	// Serve static files from public directory
	app.Static("/", "./public")
}
