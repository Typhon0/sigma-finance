package middleware

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsPublicOperation(t *testing.T) {
	t.Run("nil field context", func(t *testing.T) {
		result := isPublicOperation(nil)
		assert.False(t, result)
	})

	// Note: Full testing of isPublicOperation would require proper GraphQL setup
	// This is a basic test to ensure the function doesn't panic
}

func TestExtractTokenFromContext(t *testing.T) {
	tests := []struct {
		name     string
		setupCtx func() context.Context
		expected string
	}{
		{
			name: "valid bearer token in headers",
			setupCtx: func() context.Context {
				headers := map[string]string{
					"Authorization": "Bearer valid-token-123",
				}
				return context.WithValue(context.Background(), "headers", headers)
			},
			expected: "valid-token-123",
		},
		{
			name: "invalid authorization format",
			setupCtx: func() context.Context {
				headers := map[string]string{
					"Authorization": "InvalidFormat token",
				}
				return context.WithValue(context.Background(), "headers", headers)
			},
			expected: "",
		},
		{
			name: "no authorization header",
			setupCtx: func() context.Context {
				headers := map[string]string{}
				return context.WithValue(context.Background(), "headers", headers)
			},
			expected: "",
		},
		{
			name: "no headers in context",
			setupCtx: func() context.Context {
				return context.Background()
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupCtx()
			result := extractTokenFromContext(ctx)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetUserFromContext(t *testing.T) {
	t.Run("user exists in context", func(t *testing.T) {
		user := &AuthenticatedUser{
			ID:    "user-123",
			Email: "test@example.com",
			Name:  "Test User",
		}
		ctx := context.WithValue(context.Background(), UserKey, user)

		result, ok := GetUserFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, user, result)
	})

	t.Run("user does not exist in context", func(t *testing.T) {
		ctx := context.Background()

		result, ok := GetUserFromContext(ctx)
		assert.False(t, ok)
		assert.Nil(t, result)
	})
}

func TestGetSessionFromContext(t *testing.T) {
	t.Run("session exists in context", func(t *testing.T) {
		session := &SessionInfo{
			ID:     "session-123",
			UserID: "user-123",
		}
		ctx := context.WithValue(context.Background(), SessionKey, session)

		result, ok := GetSessionFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, session, result)
	})

	t.Run("session does not exist in context", func(t *testing.T) {
		ctx := context.Background()

		result, ok := GetSessionFromContext(ctx)
		assert.False(t, ok)
		assert.Nil(t, result)
	})
}

func TestRequireAuth(t *testing.T) {
	t.Run("authenticated user", func(t *testing.T) {
		user := &AuthenticatedUser{
			ID:    "user-123",
			Email: "test@example.com",
			Name:  "Test User",
		}
		ctx := context.WithValue(context.Background(), UserKey, user)

		result, err := RequireAuth(ctx)
		assert.NoError(t, err)
		assert.Equal(t, user, result)
	})

	t.Run("no user in context", func(t *testing.T) {
		ctx := context.Background()

		result, err := RequireAuth(ctx)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "authentication required")
		assert.Nil(t, result)
	})
}
