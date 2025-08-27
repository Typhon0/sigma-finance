package graphql

import (
	"context"
	"testing"

	"sigma_finance/internal/handler/middleware"

	"github.com/stretchr/testify/assert"
)

func TestAuthenticationFlow_EndToEnd(t *testing.T) {
	// Test the complete authentication flow from GraphQL perspective

	// 1. Test that directives work correctly
	t.Run("Auth directive enforcement", func(t *testing.T) {
		ctx := context.Background()

		// Should fail without authentication
		result, err := AuthDirective(ctx, nil, func(ctx context.Context) (interface{}, error) {
			return "protected", nil
		})

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "authentication required")
		assert.Nil(t, result)

		// Should succeed with authentication
		user := &middleware.AuthenticatedUser{
			ID:            "test-user",
			Email:         "test@example.com",
			Name:          "Test User",
			EmailVerified: true,
		}

		authCtx := context.WithValue(ctx, middleware.UserKey, user)

		result, err = AuthDirective(authCtx, nil, func(ctx context.Context) (interface{}, error) {
			return "protected", nil
		})

		assert.NoError(t, err)
		assert.Equal(t, "protected", result)
	})

	t.Run("Email verification directive enforcement", func(t *testing.T) {
		ctx := context.Background()

		// Should fail with unverified email
		unverifiedUser := &middleware.AuthenticatedUser{
			ID:            "test-user",
			Email:         "test@example.com",
			Name:          "Test User",
			EmailVerified: false,
		}

		unverifiedCtx := context.WithValue(ctx, middleware.UserKey, unverifiedUser)

		result, err := RequireEmailVerifiedDirective(unverifiedCtx, nil, func(ctx context.Context) (interface{}, error) {
			return "verified-only", nil
		})

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "email verification required")
		assert.Nil(t, result)

		// Should succeed with verified email
		verifiedUser := &middleware.AuthenticatedUser{
			ID:            "test-user",
			Email:         "test@example.com",
			Name:          "Test User",
			EmailVerified: true,
		}

		verifiedCtx := context.WithValue(ctx, middleware.UserKey, verifiedUser)

		result, err = RequireEmailVerifiedDirective(verifiedCtx, nil, func(ctx context.Context) (interface{}, error) {
			return "verified-only", nil
		})

		assert.NoError(t, err)
		assert.Equal(t, "verified-only", result)
	})

	t.Run("Context injection and retrieval", func(t *testing.T) {
		// Test that user and session context is properly injected and retrievable
		user := &middleware.AuthenticatedUser{
			ID:            "test-user-123",
			Email:         "test@example.com",
			Name:          "Test User",
			EmailVerified: true,
		}

		session := &middleware.SessionInfo{
			ID:     "session-456",
			UserID: "test-user-123",
		}

		ctx := context.WithValue(context.Background(), middleware.UserKey, user)
		ctx = context.WithValue(ctx, middleware.SessionKey, session)

		// Test user retrieval
		retrievedUser, ok := middleware.GetUserFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, user, retrievedUser)

		// Test session retrieval
		retrievedSession, ok := middleware.GetSessionFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, session, retrievedSession)

		// Test RequireAuth helper
		authUser, err := middleware.RequireAuth(ctx)
		assert.NoError(t, err)
		assert.Equal(t, user, authUser)
	})
}
