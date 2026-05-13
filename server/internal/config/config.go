package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds application configuration
type Config struct {
	Database    DatabaseConfig
	Email       EmailConfig
	JWT         JWTConfig
	Security    SecurityConfig
	Auth        AuthConfig
	MarketData  MarketDataConfig
	Catalog     CatalogConfig
	Performance PerformanceConfig
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// EmailConfig holds email configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	FromEmail    string
	FromName     string
	BaseURL      string // Base URL for email links
	// VAPID keys for web push notifications
	VAPIDPublicKey  string
	VAPIDPrivateKey string
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	SecretKey              string
	AccessTokenExpiration  time.Duration
	RefreshTokenExpiration time.Duration
	Algorithm              string
	Issuer                 string
}

// SecurityConfig holds security-related configuration
type SecurityConfig struct {
	BcryptCost              int
	PasswordMinLength       int
	AccountLockoutThreshold int
	AccountLockoutDuration  time.Duration
	RateLimitWindow         time.Duration
	MaxLoginAttempts        int
	SessionTimeout          time.Duration
}

// AuthConfig holds authentication-related configuration
type AuthConfig struct {
	EmailVerificationExpiry  time.Duration
	PasswordResetExpiry      time.Duration
	RequireEmailVerification bool
	AllowRegistration        bool
}

// MarketDataConfig holds settings for market data hardening
type MarketDataConfig struct {
	// Base64 (raw or std) encoded 32-byte key for AES-256 encryption of user API keys
	EncryptionKey string
	// Enable in-process market data scheduler on this process.
	SchedulerEnabled bool
	// Postgres advisory lock ID used to ensure single scheduler runner across replicas.
	SchedulerLockID int64
	// Per-user candle request limit per minute (across providers)
	CandleRequestsPerMinute int
	// Default API keys (optional, for system-wide defaults)
	TiingoAPIKey        string
	AlphaVantageAPIKey  string
	CoinGeckoDemoAPIKey string
	CoinGeckoAPIBaseURL string
	// YFinance provider configuration (tier 3 fallback)
	YFinance YFinanceConfig
	// Historical daily candle pack configuration
	PackRegistryURL               string
	PackStoragePath               string
	PackSignaturePublicKey        string
	PackAutoInstall               bool
	PackAutoInstallBlocking       bool
	PackDefaultPacks              []string
	LocalBuildDefaultHistoryYears int
	MarketParquetAPIBaseURL       string
	MarketParquetImportRoot       string
}

type CatalogConfig struct {
	Source               string
	SnapshotPath         string
	RefreshEnabled       bool
	SyncProfile          string
	CatalogVersion       string
	EnrichTopN           int
	SeedArtifactPath     string
	OnlineSearchFallback bool
}

// YFinanceConfig holds configuration for the YFinance provider
type YFinanceConfig struct {
	Host string // Hostname or IP of the yfinance sidecar (e.g. "yfinance-service" or "localhost")
	Port string // Port of the yfinance sidecar (e.g. "50051")
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	config := &Config{
		Database: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     getEnvOrDefault("DB_PORT", "5432"),
			User:     getEnvOrDefault("DB_USER", "postgres"),
			Password: getEnvOrDefault("DB_PASSWORD", "postgres"),
			DBName:   getEnvOrDefault("DB_NAME", "sigma_finance"),
			SSLMode:  getEnvOrDefault("DB_SSLMODE", "disable"),
		},
		Email: EmailConfig{
			SMTPHost:        getEnvOrDefault("SMTP_HOST", "localhost"),
			SMTPPort:        getEnvIntOrDefault("SMTP_PORT", 587),
			SMTPUsername:    getEnvOrDefault("SMTP_USERNAME", ""),
			SMTPPassword:    getEnvOrDefault("SMTP_PASSWORD", ""),
			FromEmail:       getEnvOrDefault("FROM_EMAIL", "noreply@sigmafinance.com"),
			FromName:        getEnvOrDefault("FROM_NAME", "Sigma Finance"),
			BaseURL:         getEnvOrDefault("BASE_URL", "http://localhost:3000"),
			VAPIDPublicKey:  getEnvOrDefault("VAPID_PUBLIC_KEY", ""),
			VAPIDPrivateKey: getEnvOrDefault("VAPID_PRIVATE_KEY", ""),
		},
		JWT: JWTConfig{
			SecretKey:              getEnvOrDefault("JWT_SECRET", generateSecureSecret()),
			AccessTokenExpiration:  getEnvDurationOrDefault("JWT_ACCESS_TOKEN_EXPIRY", 15*time.Minute),
			RefreshTokenExpiration: getEnvDurationOrDefault("JWT_REFRESH_TOKEN_EXPIRY", 7*24*time.Hour),
			Algorithm:              getEnvOrDefault("JWT_ALGORITHM", "HS256"),
			Issuer:                 getEnvOrDefault("JWT_ISSUER", "sigma-finance"),
		},
		Security: SecurityConfig{
			BcryptCost:              getEnvIntOrDefault("BCRYPT_COST", 12),
			PasswordMinLength:       getEnvIntOrDefault("PASSWORD_MIN_LENGTH", 8),
			AccountLockoutThreshold: getEnvIntOrDefault("ACCOUNT_LOCKOUT_THRESHOLD", 5),
			AccountLockoutDuration:  getEnvDurationOrDefault("ACCOUNT_LOCKOUT_DURATION", 30*time.Minute),
			RateLimitWindow:         getEnvDurationOrDefault("RATE_LIMIT_WINDOW", 15*time.Minute),
			MaxLoginAttempts:        getEnvIntOrDefault("MAX_LOGIN_ATTEMPTS", 5),
			SessionTimeout:          getEnvDurationOrDefault("SESSION_TIMEOUT", 24*time.Hour),
		},
		Auth: AuthConfig{
			EmailVerificationExpiry:  getEnvDurationOrDefault("EMAIL_VERIFICATION_EXPIRY", 24*time.Hour),
			PasswordResetExpiry:      getEnvDurationOrDefault("PASSWORD_RESET_EXPIRY", 1*time.Hour),
			RequireEmailVerification: getEnvBoolOrDefault("REQUIRE_EMAIL_VERIFICATION", true),
			AllowRegistration:        getEnvBoolOrDefault("ALLOW_REGISTRATION", true),
		},
		MarketData: MarketDataConfig{
			EncryptionKey:           getEnvOrDefault("ENCRYPTION_KEY", ""),
			SchedulerEnabled:        getEnvBoolOrDefault("MARKET_DATA_SCHEDULER_ENABLED", true),
			SchedulerLockID:         getEnvInt64OrDefault("MARKET_DATA_SCHEDULER_LOCK_ID", 824901337),
			CandleRequestsPerMinute: getEnvIntOrDefault("CANDLE_REQUESTS_PER_MINUTE", 60),
			TiingoAPIKey:            getEnvOrDefault("TIINGO_API_KEY", ""),
			AlphaVantageAPIKey:      getEnvOrDefault("ALPHA_VANTAGE_API_KEY", ""),
			CoinGeckoDemoAPIKey:     getEnvOrDefault("COINGECKO_DEMO_API_KEY", ""),
			CoinGeckoAPIBaseURL:     getEnvOrDefault("COINGECKO_API_BASE_URL", "https://api.coingecko.com/api/v3"),
			YFinance: YFinanceConfig{
				Host: getEnvOrDefault("YFINANCE_HOST", "localhost"),
				Port: getEnvOrDefault("YFINANCE_PORT", "50051"),
			},
			PackRegistryURL:         getEnvOrDefault("MARKET_DATA_PACK_REGISTRY_URL", "https://github.com/Typhon0/sigma-finance/releases/latest/download/registry.json"),
			PackStoragePath:         getEnvOrDefault("MARKET_DATA_PACK_STORAGE_PATH", "data/market-data/packs"),
			PackSignaturePublicKey:  getEnvOrDefault("MARKET_DATA_PACK_SIGNATURE_PUBLIC_KEY", ""),
			PackAutoInstall:         getEnvBoolOrDefault("MARKET_DATA_AUTO_INSTALL", false),
			PackAutoInstallBlocking: getEnvBoolOrDefault("MARKET_DATA_AUTO_INSTALL_BLOCKING", false),
			PackDefaultPacks:        splitCSVEnv("MARKET_DATA_DEFAULT_PACKS", "core-daily"),
			MarketParquetAPIBaseURL: getEnvOrDefault(
				"MARKETPARQUET_API_BASE_URL",
				"https://www.marketparquet.com",
			),
			MarketParquetImportRoot: getEnvOrDefault(
				"MARKETPARQUET_IMPORT_ROOT",
				"data/market-data/import/marketparquet",
			),
			LocalBuildDefaultHistoryYears: clampInt(
				getEnvIntOrDefault("MARKET_DATA_LOCAL_BUILD_DEFAULT_HISTORY_YEARS", 10),
				1,
				30,
			),
		},
		Catalog: CatalogConfig{
			Source:               getEnvOrDefault("CATALOG_SOURCE", "TRUSTWALLET"),
			SnapshotPath:         getEnvOrDefault("CATALOG_SNAPSHOT_PATH", getEnvOrDefault("CATALOG_SEED_ARTIFACT_PATH", "")),
			RefreshEnabled:       getEnvBoolOrDefault("CATALOG_REFRESH_ENABLED", getEnvBoolOrDefault("CATALOG_ADMIN_REFRESH_ENABLED", false)),
			SyncProfile:          getEnvOrDefault("CATALOG_SYNC_PROFILE", "public-demo"),
			CatalogVersion:       getEnvOrDefault("CATALOG_VERSION", "trustwallet-v1"),
			EnrichTopN:           getEnvIntOrDefault("CATALOG_ENRICH_TOP_N", 5000),
			SeedArtifactPath:     getEnvOrDefault("CATALOG_SEED_ARTIFACT_PATH", ""),
			OnlineSearchFallback: getEnvBoolOrDefault("CATALOG_ONLINE_SEARCH_FALLBACK", true),
		},
		Performance: *LoadPerformanceConfig(),
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		panic(fmt.Sprintf("Invalid configuration: %v", err))
	}

	return config
}

func splitCSVEnv(key string, fallback string) []string {
	raw := getEnvOrDefault(key, fallback)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

func clampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// Validate validates the configuration and returns an error if invalid
func (c *Config) Validate() error {
	// Validate JWT secret
	if len(c.JWT.SecretKey) < 32 {
		return fmt.Errorf("JWT secret key must be at least 32 characters long")
	}

	// Validate bcrypt cost
	if c.Security.BcryptCost < 10 || c.Security.BcryptCost > 15 {
		return fmt.Errorf("bcrypt cost must be between 10 and 15, got %d", c.Security.BcryptCost)
	}

	// Validate password minimum length
	if c.Security.PasswordMinLength < 8 {
		return fmt.Errorf("password minimum length must be at least 8 characters, got %d", c.Security.PasswordMinLength)
	}

	// Validate account lockout threshold
	if c.Security.AccountLockoutThreshold < 3 || c.Security.AccountLockoutThreshold > 10 {
		return fmt.Errorf("account lockout threshold must be between 3 and 10, got %d", c.Security.AccountLockoutThreshold)
	}

	// Validate durations are positive
	if c.Security.AccountLockoutDuration <= 0 {
		return fmt.Errorf("account lockout duration must be positive")
	}
	if c.Security.RateLimitWindow <= 0 {
		return fmt.Errorf("rate limit window must be positive")
	}
	if c.Security.SessionTimeout <= 0 {
		return fmt.Errorf("session timeout must be positive")
	}
	if c.JWT.AccessTokenExpiration <= 0 {
		return fmt.Errorf("JWT access token expiration must be positive")
	}
	if c.JWT.RefreshTokenExpiration <= 0 {
		return fmt.Errorf("JWT refresh token expiration must be positive")
	}
	if c.Auth.EmailVerificationExpiry <= 0 {
		return fmt.Errorf("email verification expiry must be positive")
	}
	if c.Auth.PasswordResetExpiry <= 0 {
		return fmt.Errorf("password reset expiry must be positive")
	}

	// Validate JWT algorithm
	validAlgorithms := map[string]bool{
		"HS256": true,
		"HS384": true,
		"HS512": true,
		"RS256": true,
		"RS384": true,
		"RS512": true,
	}
	if !validAlgorithms[c.JWT.Algorithm] {
		return fmt.Errorf("invalid JWT algorithm: %s", c.JWT.Algorithm)
	}

	// Validate email configuration if SMTP is configured
	if c.Email.SMTPHost != "" && c.Email.SMTPHost != "localhost" {
		if c.Email.SMTPUsername == "" {
			return fmt.Errorf("SMTP username is required when SMTP host is configured")
		}
		if c.Email.SMTPPassword == "" {
			return fmt.Errorf("SMTP password is required when SMTP host is configured")
		}
	}

	// Validate MarketData config
	if c.MarketData.CandleRequestsPerMinute <= 0 {
		return fmt.Errorf("CANDLE_REQUESTS_PER_MINUTE must be positive")
	}
	if c.MarketData.EncryptionKey == "" {
		if c.IsProduction() {
			return fmt.Errorf("ENCRYPTION_KEY is required in production")
		}
		// Generate ephemeral dev key (not persisted) – warn via stdout
		gen := generateSecureSecret()
		fmt.Println("WARN: MARKET_DATA_ENCRYPTION_KEY not set – using ephemeral key (dev only)")
		c.MarketData.EncryptionKey = gen
	}
	if c.MarketData.SchedulerLockID == 0 {
		c.MarketData.SchedulerLockID = 824901337
	}

	return nil
}

// IsDevelopment returns true if the application is running in development mode
func (c *Config) IsDevelopment() bool {
	return getEnvOrDefault("APP_ENV", "development") == "development"
}

// IsProduction returns true if the application is running in production mode
func (c *Config) IsProduction() bool {
	return getEnvOrDefault("APP_ENV", "development") == "production"
}

// generateSecureSecret generates a cryptographically secure random secret
func generateSecureSecret() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to a default secret in case of error (should not happen in production)
		return "fallback-secret-key-change-in-production-32chars"
	}
	return base64.URLEncoding.EncodeToString(bytes)
}

// getEnvOrDefault returns the environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvIntOrDefault returns the environment variable as int or default if not set/invalid
func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvInt64OrDefault returns the environment variable as int64 or default if not set/invalid.
func getEnvInt64OrDefault(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvBoolOrDefault returns the environment variable as bool or default if not set/invalid
func getEnvBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

// getEnvDurationOrDefault returns the environment variable as duration or default if not set/invalid
func getEnvDurationOrDefault(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
