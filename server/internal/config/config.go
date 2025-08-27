package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration
type Config struct {
	Database DatabaseConfig
	Email    EmailConfig
	JWT      JWTConfig
	Security SecurityConfig
	Auth     AuthConfig
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
			SMTPHost:     getEnvOrDefault("SMTP_HOST", "localhost"),
			SMTPPort:     getEnvIntOrDefault("SMTP_PORT", 587),
			SMTPUsername: getEnvOrDefault("SMTP_USERNAME", ""),
			SMTPPassword: getEnvOrDefault("SMTP_PASSWORD", ""),
			FromEmail:    getEnvOrDefault("FROM_EMAIL", "noreply@sigmafinance.com"),
			FromName:     getEnvOrDefault("FROM_NAME", "Sigma Finance"),
			BaseURL:      getEnvOrDefault("BASE_URL", "http://localhost:3000"),
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
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		panic(fmt.Sprintf("Invalid configuration: %v", err))
	}

	return config
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
