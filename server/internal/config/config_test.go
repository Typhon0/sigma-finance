package config

import (
	"os"
	"testing"
	"time"
)

func TestLoadConfig(t *testing.T) {
	// Save original environment
	originalEnv := make(map[string]string)
	envVars := []string{
		"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE",
		"SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "FROM_EMAIL", "FROM_NAME", "BASE_URL",
		"JWT_SECRET", "JWT_ACCESS_TOKEN_EXPIRY", "JWT_REFRESH_TOKEN_EXPIRY", "JWT_ALGORITHM", "JWT_ISSUER",
		"BCRYPT_COST", "PASSWORD_MIN_LENGTH", "ACCOUNT_LOCKOUT_THRESHOLD", "ACCOUNT_LOCKOUT_DURATION",
		"RATE_LIMIT_WINDOW", "MAX_LOGIN_ATTEMPTS", "SESSION_TIMEOUT",
		"EMAIL_VERIFICATION_EXPIRY", "PASSWORD_RESET_EXPIRY", "REQUIRE_EMAIL_VERIFICATION", "ALLOW_REGISTRATION",
		"APP_ENV", "ENCRYPTION_KEY",
	}

	for _, env := range envVars {
		originalEnv[env] = os.Getenv(env)
		os.Unsetenv(env)
	}

	// Restore environment after test
	defer func() {
		for env, value := range originalEnv {
			if value != "" {
				os.Setenv(env, value)
			} else {
				os.Unsetenv(env)
			}
		}
	}()

	t.Run("default configuration", func(t *testing.T) {
		config := LoadConfig()

		// Test database defaults
		if config.Database.Host != "localhost" {
			t.Errorf("Expected DB host 'localhost', got '%s'", config.Database.Host)
		}
		if config.Database.Port != "5432" {
			t.Errorf("Expected DB port '5432', got '%s'", config.Database.Port)
		}

		// Test JWT defaults
		if len(config.JWT.SecretKey) < 32 {
			t.Errorf("JWT secret key should be at least 32 characters, got %d", len(config.JWT.SecretKey))
		}
		if config.JWT.AccessTokenExpiration != 15*time.Minute {
			t.Errorf("Expected access token expiry 15m, got %v", config.JWT.AccessTokenExpiration)
		}
		if config.JWT.RefreshTokenExpiration != 7*24*time.Hour {
			t.Errorf("Expected refresh token expiry 7d, got %v", config.JWT.RefreshTokenExpiration)
		}

		// Test security defaults
		if config.Security.BcryptCost != 12 {
			t.Errorf("Expected bcrypt cost 12, got %d", config.Security.BcryptCost)
		}
		if config.Security.PasswordMinLength != 8 {
			t.Errorf("Expected password min length 8, got %d", config.Security.PasswordMinLength)
		}
		if config.Security.AccountLockoutThreshold != 5 {
			t.Errorf("Expected account lockout threshold 5, got %d", config.Security.AccountLockoutThreshold)
		}

		// Test auth defaults
		if config.Auth.EmailVerificationExpiry != 24*time.Hour {
			t.Errorf("Expected email verification expiry 24h, got %v", config.Auth.EmailVerificationExpiry)
		}
		if config.Auth.PasswordResetExpiry != 1*time.Hour {
			t.Errorf("Expected password reset expiry 1h, got %v", config.Auth.PasswordResetExpiry)
		}
		if !config.Auth.RequireEmailVerification {
			t.Error("Expected email verification to be required by default")
		}
		if !config.Auth.AllowRegistration {
			t.Error("Expected registration to be allowed by default")
		}
	})

	t.Run("environment variable override", func(t *testing.T) {
		// Set environment variables
		os.Setenv("DB_HOST", "testhost")
		os.Setenv("JWT_SECRET", "test-secret-key-that-is-long-enough-32chars")
		os.Setenv("BCRYPT_COST", "14")
		os.Setenv("JWT_ACCESS_TOKEN_EXPIRY", "30m")
		os.Setenv("REQUIRE_EMAIL_VERIFICATION", "false")

		config := LoadConfig()

		if config.Database.Host != "testhost" {
			t.Errorf("Expected DB host 'testhost', got '%s'", config.Database.Host)
		}
		if config.JWT.SecretKey != "test-secret-key-that-is-long-enough-32chars" {
			t.Errorf("Expected JWT secret to be overridden")
		}
		if config.Security.BcryptCost != 14 {
			t.Errorf("Expected bcrypt cost 14, got %d", config.Security.BcryptCost)
		}
		if config.JWT.AccessTokenExpiration != 30*time.Minute {
			t.Errorf("Expected access token expiry 30m, got %v", config.JWT.AccessTokenExpiration)
		}
		if config.Auth.RequireEmailVerification {
			t.Error("Expected email verification to be disabled")
		}
	})
}

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name        string
		config      *Config
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid configuration",
			config: &Config{
				JWT: JWTConfig{
					SecretKey:              "valid-secret-key-that-is-long-enough-32chars",
					AccessTokenExpiration:  15 * time.Minute,
					RefreshTokenExpiration: 7 * 24 * time.Hour,
					Algorithm:              "HS256",
				},
				Security: SecurityConfig{
					BcryptCost:              12,
					PasswordMinLength:       8,
					AccountLockoutThreshold: 5,
					AccountLockoutDuration:  30 * time.Minute,
					RateLimitWindow:         15 * time.Minute,
					SessionTimeout:          24 * time.Hour,
				},
				Auth: AuthConfig{
					EmailVerificationExpiry: 24 * time.Hour,
					PasswordResetExpiry:     1 * time.Hour,
				},
				MarketData: MarketDataConfig{
					CandleRequestsPerMinute: 60,
				},
			},
			expectError: false,
		},
		{
			name: "short JWT secret",
			config: &Config{
				JWT: JWTConfig{
					SecretKey:              "short",
					AccessTokenExpiration:  15 * time.Minute,
					RefreshTokenExpiration: 7 * 24 * time.Hour,
					Algorithm:              "HS256",
				},
				Security: SecurityConfig{
					BcryptCost:              12,
					PasswordMinLength:       8,
					AccountLockoutThreshold: 5,
					AccountLockoutDuration:  30 * time.Minute,
					RateLimitWindow:         15 * time.Minute,
					SessionTimeout:          24 * time.Hour,
				},
				Auth: AuthConfig{
					EmailVerificationExpiry: 24 * time.Hour,
					PasswordResetExpiry:     1 * time.Hour,
				},
				MarketData: MarketDataConfig{
					CandleRequestsPerMinute: 60,
				},
			},
			expectError: true,
			errorMsg:    "JWT secret key must be at least 32 characters long",
		},
		{
			name: "invalid bcrypt cost",
			config: &Config{
				JWT: JWTConfig{
					SecretKey:              "valid-secret-key-that-is-long-enough-32chars",
					AccessTokenExpiration:  15 * time.Minute,
					RefreshTokenExpiration: 7 * 24 * time.Hour,
					Algorithm:              "HS256",
				},
				Security: SecurityConfig{
					BcryptCost:              20, // Too high
					PasswordMinLength:       8,
					AccountLockoutThreshold: 5,
					AccountLockoutDuration:  30 * time.Minute,
					RateLimitWindow:         15 * time.Minute,
					SessionTimeout:          24 * time.Hour,
				},
				Auth: AuthConfig{
					EmailVerificationExpiry: 24 * time.Hour,
					PasswordResetExpiry:     1 * time.Hour,
				},
				MarketData: MarketDataConfig{
					CandleRequestsPerMinute: 60,
				},
			},
			expectError: true,
			errorMsg:    "bcrypt cost must be between 10 and 15, got 20",
		},
		{
			name: "invalid password minimum length",
			config: &Config{
				JWT: JWTConfig{
					SecretKey:              "valid-secret-key-that-is-long-enough-32chars",
					AccessTokenExpiration:  15 * time.Minute,
					RefreshTokenExpiration: 7 * 24 * time.Hour,
					Algorithm:              "HS256",
				},
				Security: SecurityConfig{
					BcryptCost:              12,
					PasswordMinLength:       4, // Too short
					AccountLockoutThreshold: 5,
					AccountLockoutDuration:  30 * time.Minute,
					RateLimitWindow:         15 * time.Minute,
					SessionTimeout:          24 * time.Hour,
				},
				Auth: AuthConfig{
					EmailVerificationExpiry: 24 * time.Hour,
					PasswordResetExpiry:     1 * time.Hour,
				},
				MarketData: MarketDataConfig{
					CandleRequestsPerMinute: 60,
				},
			},
			expectError: true,
			errorMsg:    "password minimum length must be at least 8 characters, got 4",
		},
		{
			name: "invalid JWT algorithm",
			config: &Config{
				JWT: JWTConfig{
					SecretKey:              "valid-secret-key-that-is-long-enough-32chars",
					AccessTokenExpiration:  15 * time.Minute,
					RefreshTokenExpiration: 7 * 24 * time.Hour,
					Algorithm:              "INVALID",
				},
				Security: SecurityConfig{
					BcryptCost:              12,
					PasswordMinLength:       8,
					AccountLockoutThreshold: 5,
					AccountLockoutDuration:  30 * time.Minute,
					RateLimitWindow:         15 * time.Minute,
					SessionTimeout:          24 * time.Hour,
				},
				Auth: AuthConfig{
					EmailVerificationExpiry: 24 * time.Hour,
					PasswordResetExpiry:     1 * time.Hour,
				},
				MarketData: MarketDataConfig{
					CandleRequestsPerMinute: 60,
				},
			},
			expectError: true,
			errorMsg:    "invalid JWT algorithm: INVALID",
		},
		{
			name: "negative duration",
			config: &Config{
				JWT: JWTConfig{
					SecretKey:              "valid-secret-key-that-is-long-enough-32chars",
					AccessTokenExpiration:  -15 * time.Minute, // Negative
					RefreshTokenExpiration: 7 * 24 * time.Hour,
					Algorithm:              "HS256",
				},
				Security: SecurityConfig{
					BcryptCost:              12,
					PasswordMinLength:       8,
					AccountLockoutThreshold: 5,
					AccountLockoutDuration:  30 * time.Minute,
					RateLimitWindow:         15 * time.Minute,
					SessionTimeout:          24 * time.Hour,
				},
				Auth: AuthConfig{
					EmailVerificationExpiry: 24 * time.Hour,
					PasswordResetExpiry:     1 * time.Hour,
				},
				MarketData: MarketDataConfig{
					CandleRequestsPerMinute: 60,
				},
			},
			expectError: true,
			errorMsg:    "JWT access token expiration must be positive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestEnvironmentHelpers(t *testing.T) {
	// Save original environment
	originalEnv := os.Getenv("APP_ENV")
	defer func() {
		if originalEnv != "" {
			os.Setenv("APP_ENV", originalEnv)
		} else {
			os.Unsetenv("APP_ENV")
		}
	}()

	config := &Config{}

	t.Run("development environment", func(t *testing.T) {
		os.Setenv("APP_ENV", "development")
		if !config.IsDevelopment() {
			t.Error("Expected IsDevelopment() to return true")
		}
		if config.IsProduction() {
			t.Error("Expected IsProduction() to return false")
		}
	})

	t.Run("production environment", func(t *testing.T) {
		os.Setenv("APP_ENV", "production")
		if config.IsDevelopment() {
			t.Error("Expected IsDevelopment() to return false")
		}
		if !config.IsProduction() {
			t.Error("Expected IsProduction() to return true")
		}
	})

	t.Run("default environment", func(t *testing.T) {
		os.Unsetenv("APP_ENV")
		if !config.IsDevelopment() {
			t.Error("Expected IsDevelopment() to return true by default")
		}
		if config.IsProduction() {
			t.Error("Expected IsProduction() to return false by default")
		}
	})
}

func TestGenerateSecureSecret(t *testing.T) {
	secret1 := generateSecureSecret()
	secret2 := generateSecureSecret()

	if len(secret1) < 32 {
		t.Errorf("Generated secret should be at least 32 characters, got %d", len(secret1))
	}

	if secret1 == secret2 {
		t.Error("Generated secrets should be different")
	}
}

func TestMarketDataEncryptionKeyPolicyByEnvironment(t *testing.T) {
	originalEnv := os.Getenv("APP_ENV")
	defer func() {
		if originalEnv != "" {
			os.Setenv("APP_ENV", originalEnv)
		} else {
			os.Unsetenv("APP_ENV")
		}
	}()

	baseConfig := &Config{
		JWT: JWTConfig{
			SecretKey:              "valid-secret-key-that-is-long-enough-32chars",
			AccessTokenExpiration:  15 * time.Minute,
			RefreshTokenExpiration: 7 * 24 * time.Hour,
			Algorithm:              "HS256",
		},
		Security: SecurityConfig{
			BcryptCost:              12,
			PasswordMinLength:       8,
			AccountLockoutThreshold: 5,
			AccountLockoutDuration:  30 * time.Minute,
			RateLimitWindow:         15 * time.Minute,
			SessionTimeout:          24 * time.Hour,
		},
		Auth: AuthConfig{
			EmailVerificationExpiry: 24 * time.Hour,
			PasswordResetExpiry:     1 * time.Hour,
		},
		MarketData: MarketDataConfig{
			CandleRequestsPerMinute: 60,
		},
	}

	t.Run("production requires encryption key", func(t *testing.T) {
		cfg := *baseConfig
		os.Setenv("APP_ENV", "production")
		err := cfg.Validate()
		if err == nil || err.Error() != "ENCRYPTION_KEY is required in production" {
			t.Fatalf("expected production encryption key error, got: %v", err)
		}
	})

	t.Run("development allows ephemeral encryption key", func(t *testing.T) {
		cfg := *baseConfig
		os.Setenv("APP_ENV", "development")
		err := cfg.Validate()
		if err != nil {
			t.Fatalf("expected no error in development, got: %v", err)
		}
		if cfg.MarketData.EncryptionKey == "" {
			t.Fatal("expected generated ephemeral encryption key in development")
		}
	})
}

func TestGetEnvHelpers(t *testing.T) {
	t.Run("getEnvOrDefault", func(t *testing.T) {
		os.Setenv("TEST_STRING", "test_value")
		defer os.Unsetenv("TEST_STRING")

		if getEnvOrDefault("TEST_STRING", "default") != "test_value" {
			t.Error("Should return environment value")
		}
		if getEnvOrDefault("NON_EXISTENT", "default") != "default" {
			t.Error("Should return default value")
		}
	})

	t.Run("getEnvIntOrDefault", func(t *testing.T) {
		os.Setenv("TEST_INT", "42")
		defer os.Unsetenv("TEST_INT")

		if getEnvIntOrDefault("TEST_INT", 10) != 42 {
			t.Error("Should return environment int value")
		}
		if getEnvIntOrDefault("NON_EXISTENT", 10) != 10 {
			t.Error("Should return default int value")
		}

		os.Setenv("TEST_INT", "invalid")
		if getEnvIntOrDefault("TEST_INT", 10) != 10 {
			t.Error("Should return default for invalid int")
		}
	})

	t.Run("getEnvBoolOrDefault", func(t *testing.T) {
		os.Setenv("TEST_BOOL", "true")
		defer os.Unsetenv("TEST_BOOL")

		if !getEnvBoolOrDefault("TEST_BOOL", false) {
			t.Error("Should return environment bool value")
		}
		if getEnvBoolOrDefault("NON_EXISTENT", false) {
			t.Error("Should return default bool value")
		}

		os.Setenv("TEST_BOOL", "invalid")
		if getEnvBoolOrDefault("TEST_BOOL", true) != true {
			t.Error("Should return default for invalid bool")
		}
	})

	t.Run("getEnvDurationOrDefault", func(t *testing.T) {
		os.Setenv("TEST_DURATION", "5m")
		defer os.Unsetenv("TEST_DURATION")

		if getEnvDurationOrDefault("TEST_DURATION", time.Hour) != 5*time.Minute {
			t.Error("Should return environment duration value")
		}
		if getEnvDurationOrDefault("NON_EXISTENT", time.Hour) != time.Hour {
			t.Error("Should return default duration value")
		}

		os.Setenv("TEST_DURATION", "invalid")
		if getEnvDurationOrDefault("TEST_DURATION", time.Hour) != time.Hour {
			t.Error("Should return default for invalid duration")
		}
	})
}
