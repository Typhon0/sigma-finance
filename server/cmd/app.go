package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sigma_finance/cmd/bun/migrations"
	"sigma_finance/internal/config"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/handler/graphql"
	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/infrastructure"
	"sigma_finance/internal/infrastructure/trustwallet"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	catalogservice "sigma_finance/internal/service/catalog"
	marketdatapacks "sigma_finance/internal/service/marketdata/packs"
	"slices"
	"strconv"
	"strings"
	"time"

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

	// Set encryption key for MarketDataCredential model (must happen before any Encrypt/Decrypt calls)
	model.SetEncryptionKey(cfg.MarketData.EncryptionKey)

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

	catalogSyncService := catalogservice.NewSyncService(
		trustwallet.NewClient(),
		uow.Instrument(),
		uow.InstrumentProviderMapping(),
		uow.CatalogSyncRun(),
	)

	if strings.TrimSpace(cfg.Catalog.SnapshotPath) != "" {
		imported, result, importErr := catalogSyncService.ImportSnapshotIfCatalogEmpty(ctx, cfg.Catalog.SnapshotPath, cfg.Catalog.CatalogVersion)
		if importErr != nil {
			return nil, fmt.Errorf("startup catalog snapshot import failed: %w", importErr)
		}
		if imported {
			stats := result.Stats
			log.Printf("[startup-catalog] snapshot imported from %s (scanned=%d upserted=%d failed=%d)", cfg.Catalog.SnapshotPath, stats.Scanned, stats.Upserted, stats.Failed)
		}
	} else {
		empty, emptyErr := catalogSyncService.IsCryptoCatalogEmpty(ctx)
		if emptyErr != nil {
			return nil, fmt.Errorf("startup catalog emptiness check failed: %w", emptyErr)
		}
		if empty {
			return nil, fmt.Errorf("crypto catalog is empty and CATALOG_SNAPSHOT_PATH is not configured")
		}
	}

	// Initialize services
	serviceContainer := service.NewServiceContainer(uow, cfg)
	if err := bootstrapAdminRoles(ctx, uow.User()); err != nil {
		return nil, fmt.Errorf("failed to bootstrap admin roles: %w", err)
	}

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
		MarketDataPackService: serviceContainer.MarketDataPacks,
		InstrumentService:     serviceContainer.Instrument,
		UOW:                   uow,
	}

	// Initialize Fiber app
	app := fiber.New()
	
	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173"
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))
	app.Use(logger.New())
	app.Use(recover.New())

	localPackBuildGroup := app.Group("/market-data/packs/build-jobs", middleware.AuthMiddleware(serviceContainer.Session))
	localPackBuildGroup.Get("/", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		limit := c.QueryInt("limit", 20)
		jobs, err := serviceContainer.MarketDataPacks.ListLocalPackBuildJobs(c.Context(), user.ID, limit)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"jobs": mapLocalBuildJobsDTO(jobs)})
	})
	localPackBuildGroup.Post("/", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		var body startLocalBuildRequest
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		input, err := localBuildInputFromRequest(body)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		job, err := serviceContainer.MarketDataPacks.StartLocalPackBuild(c.Context(), user.ID, input)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusCreated).JSON(mapLocalBuildJobDTO(job))
	})
	localPackBuildGroup.Post("/estimate", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		var body startLocalBuildRequest
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		input, err := localBuildInputFromRequest(body)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		estimate, err := serviceContainer.MarketDataPacks.EstimateLocalPackBuild(c.Context(), user.ID, input)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(estimate)
	})
	localPackBuildGroup.Post("/repair-local", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		repaired, err := serviceContainer.MarketDataPacks.RepairLocalBuildStorage(c.Context())
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"repaired": repaired})
	})
	localPackBuildGroup.Get("/:jobId", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		job, err := serviceContainer.MarketDataPacks.GetLocalPackBuildJob(c.Context(), user.ID, c.Params("jobId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(mapLocalBuildJobDTO(job))
	})
	localPackBuildGroup.Get("/:jobId/items", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		items, err := serviceContainer.MarketDataPacks.GetLocalPackBuildJobItems(c.Context(), user.ID, c.Params("jobId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"items": mapLocalBuildItemsDTO(items)})
	})
	localPackBuildGroup.Post("/:jobId/cancel", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		job, err := serviceContainer.MarketDataPacks.CancelLocalPackBuild(c.Context(), user.ID, c.Params("jobId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(mapLocalBuildJobDTO(job))
	})
	localPackBuildGroup.Post("/:jobId/retry-failed", func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*middleware.AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication required"})
		}
		job, err := serviceContainer.MarketDataPacks.RetryFailedLocalPackBuild(c.Context(), user.ID, c.Params("jobId"))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(mapLocalBuildJobDTO(job))
	})

	// Admin log streaming endpoint (auth + admin role required)
	adminGroup := app.Group("/admin",
		middleware.AuthMiddleware(serviceContainer.Session),
		middleware.AdminMiddleware(serviceContainer.User),
	)
	adminGroup.Get("/logs/go", func(c *fiber.Ctx) error {
		// Check for SSE stream vs initial fetch
		if c.Get("Accept") == "text/event-stream" || c.Query("stream") == "true" {
			return handleLogSSE(c, serviceContainer.LogBuffer)
		}

		// Return recent logs
		limit := c.QueryInt("limit", 200)
		filter := c.Query("filter", "")
		level := c.Query("level", "")

		entries := serviceContainer.LogBuffer.Recent(limit)
		filtered := filterLogEntries(entries, filter, level)

		return c.JSON(fiber.Map{
			"logs":       filtered,
			"total":      len(filtered),
			"bufferSize": len(entries),
		})
	})

	// Proxy yfinance logs
	adminGroup.Get("/logs/yfinance", func(c *fiber.Ctx) error {
		yfinanceHost := os.Getenv("YFINANCE_HOST")
		yfinanceHTTPPort := os.Getenv("YFINANCE_HTTP_PORT")
		if yfinanceHTTPPort == "" {
			yfinanceHTTPPort = "50052"
		}
		if yfinanceHost == "" {
			yfinanceHost = "localhost"
		}

		limit := c.Query("limit", "200")
		filter := c.Query("filter", "")
		level := c.Query("level", "")

		yfURL := fmt.Sprintf("http://%s:%s/logs?limit=%s&filter=%s&level=%s",
			yfinanceHost, yfinanceHTTPPort,
			url.QueryEscape(limit), url.QueryEscape(filter), url.QueryEscape(level))

		// Use a custom HTTP client to proxy the request
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(yfURL)
		if err != nil {
			return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
				"error": fmt.Sprintf("Failed to reach yfinance service: %v", err),
			})
		}
		defer resp.Body.Close()

		c.Set("Content-Type", "application/json")
		c.Status(resp.StatusCode)

		var result interface{}
		decoder := json.NewDecoder(resp.Body)
		decoder.Decode(&result)
		return c.JSON(result)
	})

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

		// Create a custom handler that includes authentication context
		customHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Start with the original request context
			ctx := r.Context()

			// If we have an auth header, validate it and add user info to context
			if authHeader != "" {
				tokenParts := strings.Split(authHeader, " ")
				if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
					token := tokenParts[1]

					// Validate the session
					session, err := serviceContainer.Session.ValidateSession(context.Background(), token)
					if err == nil {
						// Get user information using ID
						user, err := serviceContainer.User.GetByID(context.Background(), session.UserID)
						if err == nil {
							// Add authenticated user to context
							authenticatedUser := &middleware.AuthenticatedUser{
								ID:            session.UserID,
								Email:         user.Email,
								Role:          string(user.Role),
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
						}
					}
				}
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

func bootstrapAdminRoles(ctx context.Context, userRepo repository.IUserRepository) error {
	adminEmails := parseAdminEmails(
		os.Getenv("CATALOG_ADMIN_EMAILS"),
		os.Getenv("ADMIN_EMAILS"),
	)
	if len(adminEmails) == 0 {
		return nil
	}

	for _, email := range adminEmails {
		user, err := userRepo.GetByEmail(ctx, email)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				log.Printf("[auth] skipped admin bootstrap for %s (user not found)", email)
				continue
			}
			return fmt.Errorf("lookup user %s: %w", email, err)
		}

		if user.IsAdmin() {
			continue
		}

		user.Role = model.UserRoleAdmin
		if err := userRepo.Update(ctx, user); err != nil {
			return fmt.Errorf("set admin role for %s: %w", email, err)
		}

		log.Printf("[auth] granted ADMIN role to %s", email)
	}

	return nil
}

func parseAdminEmails(rawValues ...string) []string {
	emails := make(map[string]struct{})
	for _, rawValue := range rawValues {
		normalized := strings.NewReplacer(";", ",", "\n", ",", "\t", ",").Replace(rawValue)
		for _, token := range strings.Split(normalized, ",") {
			email := strings.ToLower(strings.TrimSpace(token))
			if email == "" {
				continue
			}
			emails[email] = struct{}{}
		}
	}

	result := make([]string, 0, len(emails))
	for email := range emails {
		result = append(result, email)
	}
	slices.Sort(result)
	return result
}

type startLocalBuildRequest struct {
	PackID                  *string  `json:"pack_id"`
	SourceProvider          string   `json:"source_provider"`
	SourceMode              *string  `json:"source_mode"`
	ImportPath              *string  `json:"import_path"`
	MarketParquetSourceMode *string  `json:"marketparquet_source_mode"`
	MarketParquetLocalPath  *string  `json:"marketparquet_local_path"`
	AssetTypes              []string `json:"asset_types"`
	HistoryStart            *string  `json:"history_start"`
	HistoryEnd              *string  `json:"history_end"`
	PortfolioFirst          *bool    `json:"portfolio_first"`
	UniverseInstrumentIDs   []string `json:"universe_instrument_ids"`
	RequestsPerMinute       *int     `json:"requests_per_minute"`
	RequestsPerDay          *int     `json:"requests_per_day"`
	ConcurrentRequests      *int     `json:"concurrent_requests"`
}

func parseOptionalTime(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	raw := strings.TrimSpace(*value)
	if len(raw) == len(time.DateOnly) {
		parsed, err := time.Parse(time.DateOnly, raw)
		if err != nil {
			return nil, fmt.Errorf("invalid date %q", raw)
		}
		utc := parsed.UTC()
		return &utc, nil
	}
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil, fmt.Errorf("invalid datetime %q", raw)
	}
	utc := parsed.UTC()
	return &utc, nil
}

func optionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func localBuildInputFromRequest(body startLocalBuildRequest) (marketdatapacks.StartLocalPackBuildInput, error) {
	historyStart, err := parseOptionalTime(body.HistoryStart)
	if err != nil {
		return marketdatapacks.StartLocalPackBuildInput{}, err
	}
	historyEnd, err := parseOptionalTime(body.HistoryEnd)
	if err != nil {
		return marketdatapacks.StartLocalPackBuildInput{}, err
	}
	return marketdatapacks.StartLocalPackBuildInput{
		PackID:                  optionalString(body.PackID),
		SourceProvider:          body.SourceProvider,
		SourceMode:              optionalString(body.SourceMode),
		ImportPath:              optionalString(body.ImportPath),
		MarketParquetSourceMode: optionalString(body.MarketParquetSourceMode),
		MarketParquetLocalPath:  optionalString(body.MarketParquetLocalPath),
		AssetTypes:              body.AssetTypes,
		HistoryStart:            historyStart,
		HistoryEnd:              historyEnd,
		PortfolioFirst:          body.PortfolioFirst == nil || *body.PortfolioFirst,
		UniverseInstrumentIDs:   body.UniverseInstrumentIDs,
		RequestsPerMinute:       body.RequestsPerMinute,
		RequestsPerDay:          body.RequestsPerDay,
		ConcurrentRequests:      body.ConcurrentRequests,
	}, nil
}

func mapLocalBuildJobDTO(job *model.MarketDataPackBuildJob) fiber.Map {
	if job == nil {
		return fiber.Map{}
	}
	progress, _ := job.ProgressPercent.Float64()
	return fiber.Map{
		"id":                 job.ID,
		"pack_id":            job.PackID,
		"source_provider":    job.SourceProvider,
		"status":             job.Status,
		"progress_percent":   progress,
		"current_symbol":     job.CurrentSymbol,
		"current_date":       job.CurrentDate,
		"current_asset_type": job.CurrentAssetType,
		"total_symbols":      job.TotalSymbols,
		"completed_symbols":  job.CompletedSymbols,
		"failed_symbols":     job.FailedSymbols,
		"completed_dates":    job.CompletedDates,
		"total_dates":        job.TotalDates,
		"rows_written":       job.RowsWritten,
		"error_message":      job.ErrorMessage,
		"created_at":         job.CreatedAt,
		"started_at":         job.StartedAt,
		"finished_at":        job.FinishedAt,
	}
}

func mapLocalBuildJobsDTO(jobs []model.MarketDataPackBuildJob) []fiber.Map {
	out := make([]fiber.Map, 0, len(jobs))
	for i := range jobs {
		out = append(out, mapLocalBuildJobDTO(&jobs[i]))
	}
	return out
}

func mapLocalBuildItemsDTO(items []model.MarketDataPackBuildJobItem) []fiber.Map {
	out := make([]fiber.Map, 0, len(items))
	for i := range items {
		out = append(out, fiber.Map{
			"id":                  items[i].ID,
			"job_id":              items[i].JobID,
			"instrument_id":       items[i].InstrumentID,
			"symbol":              items[i].Symbol,
			"status":              items[i].Status,
			"first_date":          items[i].FirstDate,
			"last_date":           items[i].LastDate,
			"attempt_count":       items[i].AttemptCount,
			"next_retry_at":       items[i].NextRetryAt,
			"error_message":       items[i].ErrorMessage,
			"provider_error_code": items[i].ProviderErrorCode,
			"http_status":         items[i].HTTPStatus,
			"retryable":           items[i].Retryable,
		})
	}
	return out
}

// handleLogSSE streams log entries via Server-Sent Events.
func handleLogSSE(c *fiber.Ctx, lb *service.LogBuffer) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	filter := c.Query("filter", "")
	level := c.Query("level", "")

	ch, unsubscribe := lb.Subscribe()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer unsubscribe()
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case entries, ok := <-ch:
				if !ok {
					return
				}
				for _, entry := range entries {
					if !logEntryMatches(entry, filter, level) {
						continue
					}
					data, _ := json.Marshal(entry)
					if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
						return
					}
					if err := w.Flush(); err != nil {
						return
					}
				}
			case <-ticker.C:
				// Send keepalive comment
				if _, err := fmt.Fprintf(w, ": keepalive\n\n"); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})

	return nil
}

// filterLogEntries filters log entries by keyword and level.
func filterLogEntries(entries []service.LogEntry, filter, level string) []service.LogEntry {
	if filter == "" && level == "" {
		return entries
	}

	result := make([]service.LogEntry, 0, len(entries))
	for _, entry := range entries {
		if logEntryMatches(entry, filter, level) {
			result = append(result, entry)
		}
	}
	return result
}

// logEntryMatches checks if a single entry matches filter criteria.
func logEntryMatches(entry service.LogEntry, filter, level string) bool {
	if filter != "" && !strings.Contains(strings.ToLower(entry.Message), strings.ToLower(filter)) {
		return false
	}
	if level != "" && string(entry.Level) != strings.ToUpper(level) {
		return false
	}
	return true
}
