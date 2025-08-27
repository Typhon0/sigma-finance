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
	tests := []struct {
		name        string
		config      SecurityConfig
		expectError bool
	}{
		{
			name: "valid configuration",
			config: SecurityConfig{
				JWTPrivateKey: getTestPrivateKey(),
				JWTPublicKey:  getTestPublicKey(),
				BCryptCost:    12,
			},
			expectError: false,
		},
		{
			name: "invalid private key",
			config: SecurityConfig{
				JWTPrivateKey: "invalid-key",
				JWTPublicKey:  getTestPublicKey(),
				BCryptCost:    12,
			},
			expectError: true,
		},
		{
			name: "invalid public key",
			config: SecurityConfig{
				JWTPrivateKey: getTestPrivateKey(),
				JWTPublicKey:  "invalid-key",
				BCryptCost:    12,
			},
			expectError: true,
		},
		{
			name: "low bcrypt cost gets adjusted to minimum",
			config: SecurityConfig{
				JWTPrivateKey: getTestPrivateKey(),
				JWTPublicKey:  getTestPublicKey(),
				BCryptCost:    4, // Below minimum
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service, err := NewSecurityService(tt.config)

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

	// Generate an expired token
	expiredToken, err := service.GenerateJWT(userID, time.Now().Add(-time.Hour))
	require.Error(t, err) // Should fail due to past expiration

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

	// Test placeholder implementation
	err := service.CheckRateLimit(ctx, "test-key", 5, time.Minute)
	assert.NoError(t, err, "Rate limit check should pass (placeholder implementation)")
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

	service, err := NewSecurityService(config)
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
	config := SecurityConfig{
		JWTPrivateKey: getTestPrivateKey(),
		JWTPublicKey:  getTestPublicKey(),
		BCryptCost:    12,
	}

	service, err := NewSecurityService(config)
	require.NoError(t, err)
	return service
}
