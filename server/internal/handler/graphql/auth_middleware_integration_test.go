package graphql

import (
	"context"
	"testing"

	"sigma_finance/internal/handler/middleware"
	"sigma_finance/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockServices for integration testing
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) Register(ctx context.Context, req service.RegisterRequest) (*service.AuthResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*service.AuthResponse), args.Error(1)
}

func (m *MockAuthService) Login(ctx context.Context, req service.LoginRequest) (*service.AuthResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*service.AuthResponse), args.Error(1)
}

func (m *MockAuthService) Logout(ctx context.Context, userID string, token string) error {
	args := m.Called(ctx, userID, token)
	return args.Error(0)
}

func (m *MockAuthService) ResetPassword(ctx context.Context, email string) error {
	args := m.Called(ctx, email)
	return args.Error(0)
}

func (m *MockAuthService) ConfirmPasswordReset(ctx context.Context, token, newPassword string) error {
	args := m.Called(ctx, token, newPassword)
	return args.Error(0)
}

func (m *MockAuthService) VerifyEmail(ctx context.Context, token string) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

func (m *MockAuthService) ResendVerification(ctx context.Context, email string) error {
	args := m.Called(ctx, email)
	return args.Error(0)
}

func (m *MockAuthService) RefreshToken(ctx context.Context, refreshToken string) (*service.AuthResponse, error) {
	args := m.Called(ctx, refreshToken)
	return args.Get(0).(*service.AuthResponse), args.Error(1)
}

func (m *MockAuthService) ValidateSession(ctx context.Context, token string) (*service.SessionInfo, error) {
	args := m.Called(ctx, token)
	return args.Get(0).(*service.SessionInfo), args.Error(1)
}

func (m *MockAuthService) RevokeAllUserSessions(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}
func TestGraphQLAuthDirectives_Integration(t *testing.T) {
	// Test that @auth directive properly enforces authentication
	ctx := context.Background()

	// Test without authentication - should fail
	result, err := AuthDirective(ctx, nil, func(ctx context.Context) (interface{}, error) {
		return "protected-data", nil
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "authentication required")
	assert.Nil(t, result)

	// Test with authentication - should succeed
	user := &middleware.AuthenticatedUser{
		ID:            "user-123",
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: true,
	}

	authCtx := context.WithValue(ctx, middleware.UserKey, user)

	result, err = AuthDirective(authCtx, nil, func(ctx context.Context) (interface{}, error) {
		return "protected-data", nil
	})

	assert.NoError(t, err)
	assert.Equal(t, "protected-data", result)
}

func TestRequireEmailVerifiedDirective_Integration(t *testing.T) {
	ctx := context.Background()

	// Test without authentication - should fail
	result, err := RequireEmailVerifiedDirective(ctx, nil, func(ctx context.Context) (interface{}, error) {
		return "verified-data", nil
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "authentication required")
	assert.Nil(t, result)

	// Test with unverified email - should fail
	unverifiedUser := &middleware.AuthenticatedUser{
		ID:            "user-123",
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: false,
	}

	unverifiedCtx := context.WithValue(ctx, middleware.UserKey, unverifiedUser)

	result, err = RequireEmailVerifiedDirective(unverifiedCtx, nil, func(ctx context.Context) (interface{}, error) {
		return "verified-data", nil
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "email verification required")
	assert.Nil(t, result)

	// Test with verified email - should succeed
	verifiedUser := &middleware.AuthenticatedUser{
		ID:            "user-123",
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: true,
	}

	verifiedCtx := context.WithValue(ctx, middleware.UserKey, verifiedUser)

	result, err = RequireEmailVerifiedDirective(verifiedCtx, nil, func(ctx context.Context) (interface{}, error) {
		return "verified-data", nil
	})

	assert.NoError(t, err)
	assert.Equal(t, "verified-data", result)
}
