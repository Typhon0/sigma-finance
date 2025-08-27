package config

import (
	"os"
	"testing"
	"time"
)

// TestConfigurationIntegration tests that the configuration integrates properly
// with the authentication system requirements
func TestConfigurationIntegration(t *testing.T) {
	// Save original environment
	originalEnv := make(map[string]string)
	envVars := []string{
		"JWT_SECRET", "BCRYPT_COST", "PASSWORD_MIN_LENGTH",
		"ACCOUNT_LOCKOUT_THRESHOLD", "EMAIL_VERIFICATION_EXPIRY",
		"PASSWORD_RESET_EXPIRY", "APP_ENV",
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

	t.Run("production configuration requirements", func(t *testing.T) {
		// Set production environment
		os.Setenv("APP_ENV", "production")
		os.Setenv("JWT_SECRET", "production-secret-key-that-is-secure-and-long-enough-32chars")
		os.Setenv("BCRYPT_COST", "14") // Higher cost for production

		config := LoadConfig()

		// Verify production settings
		if !config.IsProduction() {
			t.Error("Should detect production environment")
		}

		if config.Security.BcryptCost != 14 {
			t.Errorf("Expected production bcrypt cost 14, got %d", config.Security.BcryptCost)
		}

		if len(config.JWT.SecretKey) < 32 {
			t.Errorf("Production JWT secret should be at least 32 chars, got %d", len(config.JWT.SecretKey))
		}
	})

	t.Run("security requirements compliance", func(t *testing.T) {
		config := LoadConfig()

		// Verify security requirements from design document

		// Requirement 6.1: bcrypt with minimum cost factor of 12
		if config.Security.BcryptCost < 12 {
			t.Errorf("Bcrypt cost should be at least 12, got %d", config.Security.BcryptCost)
		}

		// Requirement 6.2: JWT with secure secret
		if len(config.JWT.SecretKey) < 32 {
			t.Errorf("JWT secret should be at least 32 characters, got %d", len(config.JWT.SecretKey))
		}

		// Password policy: minimum 8 characters
		if config.Security.PasswordMinLength < 8 {
			t.Errorf("Password minimum length should be at least 8, got %d", config.Security.PasswordMinLength)
		}

		// Account lockout: 5 attempts in 15 minutes
		if config.Security.AccountLockoutThreshold != 5 {
			t.Errorf("Account lockout threshold should be 5, got %d", config.Security.AccountLockoutThreshold)
		}

		if config.Security.RateLimitWindow != 15*time.Minute {
			t.Errorf("Rate limit window should be 15 minutes, got %v", config.Security.RateLimitWindow)
		}

		// Session timeout: 24 hours
		if config.Security.SessionTimeout != 24*time.Hour {
			t.Errorf("Session timeout should be 24 hours, got %v", config.Security.SessionTimeout)
		}
	})

	t.Run("token expiration requirements", func(t *testing.T) {
		config := LoadConfig()

		// Access tokens should be short-lived (15 minutes default)
		if config.JWT.AccessTokenExpiration != 15*time.Minute {
			t.Errorf("Access token expiration should be 15 minutes, got %v", config.JWT.AccessTokenExpiration)
		}

		// Refresh tokens should be longer-lived (7 days default)
		if config.JWT.RefreshTokenExpiration != 7*24*time.Hour {
			t.Errorf("Refresh token expiration should be 7 days, got %v", config.JWT.RefreshTokenExpiration)
		}

		// Email verification: 24 hours
		if config.Auth.EmailVerificationExpiry != 24*time.Hour {
			t.Errorf("Email verification expiry should be 24 hours, got %v", config.Auth.EmailVerificationExpiry)
		}

		// Password reset: 1 hour
		if config.Auth.PasswordResetExpiry != 1*time.Hour {
			t.Errorf("Password reset expiry should be 1 hour, got %v", config.Auth.PasswordResetExpiry)
		}
	})

	t.Run("email verification requirements", func(t *testing.T) {
		config := LoadConfig()

		// Email verification should be required by default
		if !config.Auth.RequireEmailVerification {
			t.Error("Email verification should be required by default")
		}

		// Registration should be allowed by default
		if !config.Auth.AllowRegistration {
			t.Error("Registration should be allowed by default")
		}
	})

	t.Run("jwt algorithm security", func(t *testing.T) {
		// Test with secure algorithms
		secureAlgorithms := []string{"HS256", "HS384", "HS512", "RS256", "RS384", "RS512"}

		for _, alg := range secureAlgorithms {
			os.Setenv("JWT_ALGORITHM", alg)
			config := LoadConfig()

			if config.JWT.Algorithm != alg {
				t.Errorf("Expected JWT algorithm %s, got %s", alg, config.JWT.Algorithm)
			}
		}

		// Clean up
		os.Unsetenv("JWT_ALGORITHM")
	})
}

// TestConfigurationWithExistingServices tests that the configuration
// provides the expected values for integration with existing services
func TestConfigurationWithExistingServices(t *testing.T) {
	config := LoadConfig()

	t.Run("authentication service integration", func(t *testing.T) {
		// Verify configuration provides all required values for AuthenticationService

		// JWT configuration
		if config.JWT.SecretKey == "" {
			t.Error("JWT secret key should not be empty")
		}

		if config.JWT.AccessTokenExpiration <= 0 {
			t.Error("Access token expiration should be positive")
		}

		if config.JWT.RefreshTokenExpiration <= 0 {
			t.Error("Refresh token expiration should be positive")
		}

		// Security configuration
		if config.Security.BcryptCost <= 0 {
			t.Error("Bcrypt cost should be positive")
		}

		if config.Security.PasswordMinLength <= 0 {
			t.Error("Password minimum length should be positive")
		}

		// Rate limiting configuration
		if config.Security.AccountLockoutThreshold <= 0 {
			t.Error("Account lockout threshold should be positive")
		}

		if config.Security.AccountLockoutDuration <= 0 {
			t.Error("Account lockout duration should be positive")
		}
	})

	t.Run("email service integration", func(t *testing.T) {
		// Verify configuration provides all required values for EmailService

		if config.Email.FromEmail == "" {
			t.Error("From email should not be empty")
		}

		if config.Email.FromName == "" {
			t.Error("From name should not be empty")
		}

		if config.Email.BaseURL == "" {
			t.Error("Base URL should not be empty")
		}

		// Token expiration for email workflows
		if config.Auth.EmailVerificationExpiry <= 0 {
			t.Error("Email verification expiry should be positive")
		}

		if config.Auth.PasswordResetExpiry <= 0 {
			t.Error("Password reset expiry should be positive")
		}
	})

	t.Run("session service integration", func(t *testing.T) {
		// Verify configuration provides all required values for SessionService

		if config.Security.SessionTimeout <= 0 {
			t.Error("Session timeout should be positive")
		}

		if config.JWT.AccessTokenExpiration <= 0 {
			t.Error("Access token expiration should be positive")
		}

		if config.JWT.RefreshTokenExpiration <= 0 {
			t.Error("Refresh token expiration should be positive")
		}
	})
}
