package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sigma_finance/cmd/bun/migrations"
	"sigma_finance/internal/config"
	"sigma_finance/internal/handler/graphql"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/infrastructure"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"strconv"
	"strings"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

// parseUserIDFromString converts string user ID to uint for service calls
func parseUserIDFromString(userID string) uint {
	id, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		return 0
	}
	return uint(id)
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

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

	// Load configuration
	cfg := config.LoadConfig()

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
	serviceContainer := service.NewServiceContainer(uow, cfg)

	// Initialize GraphQL resolver
	resolver := &graphql.Resolver{
		PortfolioService:      serviceContainer.Portfolio,
		UserService:           serviceContainer.User,
		AssetService:          serviceContainer.Asset,
		TagService:            serviceContainer.Tag,
		TransactionService:    serviceContainer.Transaction,
		WatchlistService:      serviceContainer.Watchlist,
		AuthenticationService: serviceContainer.Authentication,
		SecurityService:       serviceContainer.Security,
		MarketDataService:     serviceContainer.MarketData,
		UOW:                   uow,
	}

	// Initialize Fiber app
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "https://d7g9j7jl-5174.uks1.devtunnels.ms,http://localhost:5173",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))
	app.Use(logger.New())
	app.Use(recover.New())

	// Setup GraphQL endpoint with authentication middleware and directives
	config := graphql.Config{
		Resolvers: resolver,
		Directives: graphql.DirectiveRoot{
			Auth:                 graphql.AuthDirective,
			RequireEmailVerified: graphql.RequireEmailVerifiedDirective,
		},
	}

	srv := handler.NewDefaultServer(graphql.NewExecutableSchema(config))

	// Add GraphQL authentication middleware
	srv.Use(middleware.GraphQLAuthMiddleware(serviceContainer.Session, serviceContainer.User))

	pg := playground.Handler("GraphQL playground", "/graphql")

	app.All("/graphql", func(c *fiber.Ctx) error {
		// Handle authentication at the HTTP level before passing to GraphQL
		authHeader := c.Get("Authorization")
		fmt.Printf("DEBUG: Fiber handler - Auth header: '%s'\n", authHeader)

		// Create a custom handler that includes authentication context
		customHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Start with the original request context
			ctx := r.Context()

			// If we have an auth header, validate it and add user info to context
			if authHeader != "" {
				tokenParts := strings.Split(authHeader, " ")
				if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
					token := tokenParts[1]
					fmt.Printf("DEBUG: Fiber handler - Extracted token: '%s...'\n", token[:min(10, len(token))])

					// Validate the session
					session, err := serviceContainer.Session.ValidateSession(context.Background(), token)
					if err != nil {
						fmt.Printf("DEBUG: Fiber handler - Session validation failed: %v\n", err)
					} else {
						fmt.Printf("DEBUG: Fiber handler - Session valid for user: %s\n", session.UserID)

						// Get user information using string ID
						user, err := serviceContainer.User.GetByStringID(context.Background(), session.UserID)
						if err != nil {
							fmt.Printf("DEBUG: Fiber handler - User lookup failed: %v\n", err)
						} else {
							fmt.Printf("DEBUG: Fiber handler - User found: %s\n", user.Email)

							// Add authenticated user to context
							authenticatedUser := &middleware.AuthenticatedUser{
								ID:            session.UserID,
								Email:         user.Email,
								Name:          user.Name,
								EmailVerified: user.EmailVerified,
							}

							sessionInfo := &middleware.SessionInfo{
								ID:        session.ID,
								UserID:    session.UserID,
								ExpiresAt: session.ExpiresAt,
								IPAddress: session.IPAddress,
								UserAgent: session.UserAgent,
							}

							// Add to context using the middleware keys
							ctx = context.WithValue(ctx, middleware.UserKey, authenticatedUser)
							ctx = context.WithValue(ctx, middleware.SessionKey, sessionInfo)

							fmt.Printf("DEBUG: Fiber handler - Added user to context: %s\n", authenticatedUser.Email)
						}
					}
				} else {
					fmt.Printf("DEBUG: Fiber handler - Invalid auth header format\n")
				}
			} else {
				fmt.Printf("DEBUG: Fiber handler - No auth header found\n")
			}

			// Create a new request with the enhanced context
			r = r.WithContext(ctx)
			srv.ServeHTTP(w, r)
		})

		fasthttpadaptor.NewFastHTTPHandler(customHandler)(c.Context())
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
