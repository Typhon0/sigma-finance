package middleware

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGetUserFromContext(t *testing.T) {
	// Test with valid user in context
	user := &AuthenticatedUser{
		ID:            "user-123",
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: true,
	}

	ctx := context.WithValue(context.Background(), UserKey, user)

	retrievedUser, ok := GetUserFromContext(ctx)
	assert.True(t, ok)
	assert.Equal(t, user, retrievedUser)

	// Test with no user in context
	emptyCtx := context.Background()
	retrievedUser, ok = GetUserFromContext(emptyCtx)
	assert.False(t, ok)
	assert.Nil(t, retrievedUser)
}

func TestGetSessionFromContext(t *testing.T) {
	// Test with valid session in context
	session := &SessionInfo{
		ID:        "session-123",
		UserID:    "user-456",
		ExpiresAt: time.Now().Add(time.Hour),
		IPAddress: "127.0.0.1",
		UserAgent: "Test-Agent",
	}

	ctx := context.WithValue(context.Background(), SessionKey, session)

	retrievedSession, ok := GetSessionFromContext(ctx)
	assert.True(t, ok)
	assert.Equal(t, session, retrievedSession)

	// Test with no session in context
	emptyCtx := context.Background()
	retrievedSession, ok = GetSessionFromContext(emptyCtx)
	assert.False(t, ok)
	assert.Nil(t, retrievedSession)
}

func TestRequireAuth(t *testing.T) {
	// Test with authenticated user
	user := &AuthenticatedUser{
		ID:            "user-123",
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: true,
	}

	ctx := context.WithValue(context.Background(), UserKey, user)

	retrievedUser, err := RequireAuth(ctx)
	assert.NoError(t, err)
	assert.Equal(t, user, retrievedUser)

	// Test with no user in context
	emptyCtx := context.Background()
	retrievedUser, err = RequireAuth(emptyCtx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "authentication required")
	assert.Nil(t, retrievedUser)
}

func TestExtractTokenFromContext(t *testing.T) {
	tests := []struct {
		name     string
		context  context.Context
		expected string
	}{
		{
			name: "valid bearer token in headers",
			context: context.WithValue(context.Background(), "headers", map[string]string{
				"Authorization": "Bearer test-token-123",
			}),
			expected: "test-token-123",
		},
		{
			name: "invalid authorization header format",
			context: context.WithValue(context.Background(), "headers", map[string]string{
				"Authorization": "InvalidFormat test-token-123",
			}),
			expected: "",
		},
		{
			name: "missing bearer prefix",
			context: context.WithValue(context.Background(), "headers", map[string]string{
				"Authorization": "test-token-123",
			}),
			expected: "",
		},
		{
			name:     "no headers in context",
			context:  context.Background(),
			expected: "",
		},
		{
			name: "empty authorization header",
			context: context.WithValue(context.Background(), "headers", map[string]string{
				"Authorization": "",
			}),
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractTokenFromContext(tt.context)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseUserID(t *testing.T) {
	tests := []struct {
		name     string
		userID   string
		expected uint
	}{
		{"valid numeric ID", "123", 123},
		{"zero ID", "0", 0},
		{"invalid non-numeric ID", "user-123", 0},
		{"empty ID", "", 0},
		{"negative ID", "-1", 0}, // ParseUint will fail on negative numbers
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseUserID(tt.userID)
			assert.Equal(t, tt.expected, result)
		})
	}
}
