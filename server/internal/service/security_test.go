package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSecurityService(t *testing.T) {
	privateKeyPEM, publicKeyPEM, err := GenerateRSAKeyPair()
	require.NoError(t, err)

	rateLimiter := NewInMemoryRateLimiter()

	tests := []struct {
		name        string
		config      SecurityConfig
		expectError bool
	}{
		{
			name: "valid configuration",
			config: SecurityConfig{
				JWTPrivateKey: privateKeyPEM,
				JWTPublicKey:  publicKeyPEM,
				BCryptCost:    12,
			},
			expectError: false,
		},
		{
			name: "invalid private key",
			config: SecurityConfig{
				JWTPrivateKey: "invalid-key",
				JWTPublicKey:  publicKeyPEM,
				BCryptCost:    12,
			},
			expectError: true,
		},
		{
			name: "invalid public key",
			config: SecurityConfig{
				JWTPrivateKey: privateKeyPEM,
				JWTPublicKey:  "invalid-key",
				BCryptCost:    12,
			},
			expectError: true,
		},
		{
			name: "low bcrypt cost gets adjusted to minimum",
			config: SecurityConfig{
				JWTPrivateKey: privateKeyPEM,
				JWTPublicKey:  publicKeyPEM,
				BCryptCost:    4, // Below minimum
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service, err := NewSecurityService(tt.config, rateLimiter)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, service)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, service)
			}
		})
	}
}
func TestSecurityService_HashPassword(t *testing.T) {
	service := createTestSecurityService(t)

	tests := []struct {
		name        string
		password    string
		expectError bool
	}{
		{
			name:        "valid password",
			password:    "securepassword123",
			expectError: false,
		},
		{
			name:        "empty password",
			password:    "",
			expectError: true,
		},
		{
			name:        "long password",
			password:    strings.Repeat("a", 100),
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash, err := service.HashPassword(tt.password)

			if tt.expectError {
				assert.Error(t, err)
				assert.Empty(t, hash)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, hash)
				assert.True(t, strings.HasPrefix(hash, "$2a$12$"))
			}
		})
	}
}

func TestSecurityService_VerifyPassword(t *testing.T) {
	service := createTestSecurityService(t)
	password := "securepassword123"
	hash, err := service.HashPassword(password)
	require.NoError(t, err)

	tests := []struct {
		name        string
		password    string
		hash        string
		expectError bool
	}{
		{
			name:        "correct password",
			password:    password,
			hash:        hash,
			expectError: false,
		},
		{
			name:        "incorrect password",
			password:    "wrongpassword",
			hash:        hash,
			expectError: true,
		},
		{
			name:        "empty password",
			password:    "",
			hash:        hash,
			expectError: true,
		},
		{
			name:        "empty hash",
			password:    password,
			hash:        "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.VerifyPassword(tt.password, tt.hash)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
func TestSecurityService_GenerateJWT(t *testing.T) {
	service := createTestSecurityService(t)
	userID := "test-user-123"
	expiresAt := time.Now().Add(time.Hour)

	tests := []struct {
		name        string
		userID      string
		expiresAt   time.Time
		expectError bool
	}{
		{
			name:        "valid token generation",
			userID:      userID,
			expiresAt:   expiresAt,
			expectError: false,
		},
		{
			name:        "empty user ID",
			userID:      "",
			expiresAt:   expiresAt,
			expectError: true,
		},
		{
			name:        "expired time in past",
			userID:      userID,
			expiresAt:   time.Now().Add(-time.Hour),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := service.GenerateJWT(tt.userID, tt.expiresAt)

			if tt.expectError {
				assert.Error(t, err)
				assert.Empty(t, token)
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, token)

				// Verify token can be parsed back
				claims, err := service.ValidateJWT(token)
				assert.NoError(t, err)
				assert.Equal(t, tt.userID, claims.UserID)
				assert.Equal(t, "sigma-finance", claims.Issuer)
			}
		})
	}
}

func TestSecurityService_ValidateJWT(t *testing.T) {
	service := createTestSecurityService(t)
	userID := "test-user-123"

	// Generate a valid token
	validToken, err := service.GenerateJWT(userID, time.Now().Add(time.Hour))
	require.NoError(t, err)

	// Note: We can't generate an expired token because GenerateJWT validates expiration time

	tests := []struct {
		name        string
		token       string
		expectError bool
		expectedUID string
	}{
		{
			name:        "valid token",
			token:       validToken,
			expectError: false,
			expectedUID: userID,
		},
		{
			name:        "empty token",
			token:       "",
			expectError: true,
		},
		{
			name:        "invalid token format",
			token:       "invalid.token.format",
			expectError: true,
		},
		{
			name:        "malformed token",
			token:       "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := service.ValidateJWT(tt.token)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, claims)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, claims)
				assert.Equal(t, tt.expectedUID, claims.UserID)
			}
		})
	}
}
func TestSecurityService_GenerateSecureToken(t *testing.T) {
	service := createTestSecurityService(t)

	// Generate multiple tokens to ensure uniqueness
	tokens := make(map[string]bool)
	for i := 0; i < 100; i++ {
		token, err := service.GenerateSecureToken()
		assert.NoError(t, err)
		assert.NotEmpty(t, token)

		// Check token is base64 URL encoded
		assert.NotContains(t, token, "+")
		assert.NotContains(t, token, "/")

		// Ensure uniqueness
		assert.False(t, tokens[token], "Generated duplicate token: %s", token)
		tokens[token] = true

		// Check length (32 bytes base64 encoded should be 44 characters)
		assert.Equal(t, 44, len(token))
	}
}

func TestSecurityService_CheckRateLimit(t *testing.T) {
	service := createTestSecurityService(t)
	ctx := context.Background()

	t.Run("allows requests within limit", func(t *testing.T) {
		key := "test-key"
		limit := 3
		window := time.Minute

		// Should allow first 3 requests
		for i := 0; i < limit; i++ {
			err := service.CheckRateLimit(ctx, key, limit, window)
			assert.NoError(t, err, "Request %d should be allowed", i+1)
		}
	})

	t.Run("blocks requests exceeding limit", func(t *testing.T) {
		key := "test-key-2"
		limit := 2
		window := time.Minute

		// Use up the limit
		for i := 0; i < limit; i++ {
			err := service.CheckRateLimit(ctx, key, limit, window)
			require.NoError(t, err)
		}

		// Next request should be blocked
		err := service.CheckRateLimit(ctx, key, limit, window)
		assert.Error(t, err)
		assert.True(t, IsRateLimitError(err))
	})

	t.Run("reset rate limit", func(t *testing.T) {
		key := "test-key-3"
		limit := 1
		window := time.Minute

		// Use up the limit
		err := service.CheckRateLimit(ctx, key, limit, window)
		require.NoError(t, err)

		// Should be blocked
		err = service.CheckRateLimit(ctx, key, limit, window)
		assert.Error(t, err)

		// Reset and try again
		err = service.ResetRateLimit(ctx, key)
		assert.NoError(t, err)

		// Should be allowed again
		err = service.CheckRateLimit(ctx, key, limit, window)
		assert.NoError(t, err)
	})

	t.Run("get rate limit attempts", func(t *testing.T) {
		key := "test-key-4"
		limit := 5
		window := time.Minute

		// Make 3 requests
		for i := 0; i < 3; i++ {
			err := service.CheckRateLimit(ctx, key, limit, window)
			require.NoError(t, err)
		}

		// Check attempt count
		attempts, err := service.GetRateLimitAttempts(ctx, key)
		assert.NoError(t, err)
		assert.Equal(t, 3, attempts)
	})
}

func TestGenerateRSAKeyPair(t *testing.T) {
	privateKeyPEM, publicKeyPEM, err := GenerateRSAKeyPair()

	assert.NoError(t, err)
	assert.NotEmpty(t, privateKeyPEM)
	assert.NotEmpty(t, publicKeyPEM)

	// Verify keys can be used to create a security service
	config := SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		BCryptCost:    12,
	}

	rateLimiter := NewInMemoryRateLimiter()
	service, err := NewSecurityService(config, rateLimiter)
	assert.NoError(t, err)
	assert.NotNil(t, service)

	// Test that the generated keys work for JWT operations
	userID := "test-user"
	token, err := service.GenerateJWT(userID, time.Now().Add(time.Hour))
	assert.NoError(t, err)

	claims, err := service.ValidateJWT(token)
	assert.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
}

// Helper function to create a test security service
func createTestSecurityService(t *testing.T) SecurityService {
	privateKeyPEM, publicKeyPEM, err := GenerateRSAKeyPair()
	require.NoError(t, err)

	config := SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		BCryptCost:    12,
	}

	rateLimiter := NewInMemoryRateLimiter()
	service, err := NewSecurityService(config, rateLimiter)
	require.NoError(t, err)
	return service
}
