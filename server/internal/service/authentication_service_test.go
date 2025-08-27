package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Test user registration
func TestAuthenticationService_Register(t *testing.T) {
	ctx := context.Background()

	t.Run("successful registration", func(t *testing.T) {
		authService, userRepo, sessionRepo, _, emailVerificationTokenRepo, securityService, auditService, emailService := createTestAuthService(t)

		req := RegisterRequest{
			Email:    "test@example.com",
			Password: "SecurePass123!",
			Name:     "Test User",
		}

		// Mock expectations
		userRepo.On("GetByEmail", ctx, req.Email).Return(nil, repository.ErrNotFound)
		securityService.On("CheckRateLimit", ctx, mock.AnythingOfType("string"), 3, time.Hour).Return(nil)
		securityService.On("HashPassword", req.Password).Return("hashed_password", nil)

		createdUser := &model.User{
			ID:            "user-123",
			Email:         req.Email,
			Name:          req.Name,
			PasswordHash:  stringPtr("hashed_password"),
			EmailVerified: false,
		}
		userRepo.On("Create", ctx, mock.AnythingOfType("*model.User")).Return(createdUser, nil)

		securityService.On("GenerateSecureToken").Return("verification_token", nil).Once()
		emailVerificationTokenRepo.On("Create", ctx, mock.AnythingOfType("*model.EmailVerificationToken")).Return(&model.EmailVerificationToken{}, nil)

		securityService.On("GenerateJWT", createdUser.ID, mock.AnythingOfType("time.Time")).Return("jwt_token", nil)
		securityService.On("GenerateSecureToken").Return("refresh_token", nil).Once()
		sessionRepo.On("Create", ctx, mock.AnythingOfType("*model.Session")).Return(&model.Session{}, nil)

		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		response, err := authService.Register(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, "jwt_token", response.Token)
		assert.Equal(t, "refresh_token", response.RefreshToken)
		assert.Equal(t, createdUser.ID, response.User.ID)
		assert.Equal(t, createdUser.Email, response.User.Email)
		assert.False(t, response.User.EmailVerified)

		// Verify email was sent
		mockEmailService, ok := emailService.(*MockEmailService)
		require.True(t, ok)
		sentEmails := mockEmailService.GetSentEmails()
		assert.Len(t, sentEmails, 1)
		assert.Equal(t, "verification", sentEmails[0].Type)
		assert.Equal(t, req.Email, sentEmails[0].Email)

		userRepo.AssertExpectations(t)
		sessionRepo.AssertExpectations(t)
		emailVerificationTokenRepo.AssertExpectations(t)
		securityService.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})

	t.Run("email already exists", func(t *testing.T) {
		authService, userRepo, _, _, _, securityService, auditService, _ := createTestAuthService(t)

		req := RegisterRequest{
			Email:    "existing@example.com",
			Password: "SecurePass123!",
			Name:     "Test User",
		}

		existingUser := &model.User{
			ID:    "existing-user",
			Email: req.Email,
		}

		// Mock expectations
		securityService.On("CheckRateLimit", ctx, mock.AnythingOfType("string"), 3, time.Hour).Return(nil)
		userRepo.On("GetByEmail", ctx, req.Email).Return(existingUser, nil)
		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		response, err := authService.Register(ctx, req)

		// Assert
		assert.Nil(t, response)
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrEmailAlreadyExists, authErr.Code)

		userRepo.AssertExpectations(t)
		securityService.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})

	t.Run("weak password", func(t *testing.T) {
		authService, userRepo, _, _, _, securityService, _, _ := createTestAuthService(t)

		req := RegisterRequest{
			Email:    "test@example.com",
			Password: "weak", // Too short and weak
			Name:     "Test User",
		}

		// Mock expectations
		securityService.On("CheckRateLimit", ctx, mock.AnythingOfType("string"), 3, time.Hour).Return(nil)
		userRepo.On("GetByEmail", ctx, req.Email).Return(nil, repository.ErrNotFound)

		// Execute
		response, err := authService.Register(ctx, req)

		// Assert
		assert.Nil(t, response)
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrWeakPassword, authErr.Code)

		userRepo.AssertExpectations(t)
		securityService.AssertExpectations(t)
	})
}

// Test user login
func TestAuthenticationService_Login(t *testing.T) {
	ctx := context.Background()

	t.Run("successful login", func(t *testing.T) {
		authService, userRepo, sessionRepo, _, _, securityService, auditService, _ := createTestAuthService(t)

		req := LoginRequest{
			Email:     "test@example.com",
			Password:  "SecurePass123!",
			IPAddress: "192.168.1.1",
			UserAgent: "test-agent",
		}

		user := &model.User{
			ID:            "user-123",
			Email:         req.Email,
			Name:          "Test User",
			PasswordHash:  stringPtr("hashed_password"),
			EmailVerified: true,
		}

		// Mock expectations
		securityService.On("CheckRateLimit", ctx, LoginRateLimitKey(req.Email), 5, 15*time.Minute).Return(nil)
		userRepo.On("GetByEmail", ctx, req.Email).Return(user, nil)
		securityService.On("VerifyPassword", req.Password, "hashed_password").Return(nil)
		userRepo.On("ResetFailedLoginCount", ctx, user.ID).Return(nil)
		userRepo.On("UpdateLastLogin", ctx, user.ID, mock.AnythingOfType("time.Time"), req.IPAddress).Return(nil)

		securityService.On("GenerateJWT", user.ID, mock.AnythingOfType("time.Time")).Return("jwt_token", nil)
		securityService.On("GenerateSecureToken").Return("refresh_token", nil)
		sessionRepo.On("Create", ctx, mock.AnythingOfType("*model.Session")).Return(&model.Session{}, nil)

		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		response, err := authService.Login(ctx, req)

		// Assert
		require.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, "jwt_token", response.Token)
		assert.Equal(t, "refresh_token", response.RefreshToken)
		assert.Equal(t, user.ID, response.User.ID)
		assert.Equal(t, user.Email, response.User.Email)
		assert.True(t, response.User.EmailVerified)

		userRepo.AssertExpectations(t)
		sessionRepo.AssertExpectations(t)
		securityService.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})

	t.Run("invalid credentials - user not found", func(t *testing.T) {
		authService, userRepo, _, _, _, securityService, auditService, _ := createTestAuthService(t)

		req := LoginRequest{
			Email:     "nonexistent@example.com",
			Password:  "SecurePass123!",
			IPAddress: "192.168.1.1",
			UserAgent: "test-agent",
		}

		// Mock expectations
		securityService.On("CheckRateLimit", ctx, LoginRateLimitKey(req.Email), 5, 15*time.Minute).Return(nil)
		userRepo.On("GetByEmail", ctx, req.Email).Return(nil, repository.ErrNotFound)
		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		response, err := authService.Login(ctx, req)

		// Assert
		assert.Nil(t, response)
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrInvalidCredentials, authErr.Code)

		userRepo.AssertExpectations(t)
		securityService.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})

	t.Run("account locked", func(t *testing.T) {
		authService, userRepo, _, _, _, securityService, auditService, _ := createTestAuthService(t)

		req := LoginRequest{
			Email:     "test@example.com",
			Password:  "SecurePass123!",
			IPAddress: "192.168.1.1",
			UserAgent: "test-agent",
		}

		lockUntil := time.Now().Add(30 * time.Minute)
		user := &model.User{
			ID:            "user-123",
			Email:         req.Email,
			Name:          "Test User",
			PasswordHash:  stringPtr("hashed_password"),
			EmailVerified: true,
			LockedUntil:   &lockUntil,
		}

		// Mock expectations
		securityService.On("CheckRateLimit", ctx, LoginRateLimitKey(req.Email), 5, 15*time.Minute).Return(nil)
		userRepo.On("GetByEmail", ctx, req.Email).Return(user, nil)
		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		response, err := authService.Login(ctx, req)

		// Assert
		assert.Nil(t, response)
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrAccountLocked, authErr.Code)

		userRepo.AssertExpectations(t)
		securityService.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})
}

// Test logout
func TestAuthenticationService_Logout(t *testing.T) {
	ctx := context.Background()

	t.Run("successful logout", func(t *testing.T) {
		authService, userRepo, sessionRepo, _, _, _, auditService, _ := createTestAuthService(t)

		userID := "user-123"
		token := "jwt_token"

		user := &model.User{
			ID:    userID,
			Email: "test@example.com",
			Name:  "Test User",
		}

		// Mock expectations
		userRepo.On("GetByStringID", ctx, userID).Return(user, nil)
		sessionRepo.On("RevokeSession", ctx, token).Return(nil)
		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		err := authService.Logout(ctx, userID, token)

		// Assert
		require.NoError(t, err)

		userRepo.AssertExpectations(t)
		sessionRepo.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})
}

// Test email verification
func TestAuthenticationService_VerifyEmail(t *testing.T) {
	ctx := context.Background()

	t.Run("successful email verification", func(t *testing.T) {
		authService, userRepo, _, _, emailVerificationTokenRepo, _, auditService, _ := createTestAuthService(t)

		token := "verification_token"
		userID := "user-123"

		user := &model.User{
			ID:            userID,
			Email:         "test@example.com",
			Name:          "Test User",
			EmailVerified: false,
		}

		verificationToken := &model.EmailVerificationToken{
			ID:        "token-123",
			UserID:    userID,
			Token:     token,
			ExpiresAt: time.Now().Add(24 * time.Hour),
			Used:      false,
		}

		// Mock expectations
		emailVerificationTokenRepo.On("GetByToken", ctx, token).Return(verificationToken, nil)
		userRepo.On("GetByStringID", ctx, userID).Return(user, nil)
		userRepo.On("UpdateEmailVerified", ctx, userID, true).Return(nil)
		emailVerificationTokenRepo.On("Update", ctx, mock.AnythingOfType("*model.EmailVerificationToken")).Return(nil)
		auditService.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil)

		// Execute
		err := authService.VerifyEmail(ctx, token)

		// Assert
		require.NoError(t, err)

		emailVerificationTokenRepo.AssertExpectations(t)
		userRepo.AssertExpectations(t)
		auditService.AssertExpectations(t)
	})

	t.Run("invalid token", func(t *testing.T) {
		authService, _, _, _, emailVerificationTokenRepo, _, _, _ := createTestAuthService(t)

		token := "invalid_token"

		// Mock expectations
		emailVerificationTokenRepo.On("GetByToken", ctx, token).Return(nil, repository.ErrNotFound)

		// Execute
		err := authService.VerifyEmail(ctx, token)

		// Assert
		assert.Error(t, err)
		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrInvalidToken, authErr.Code)

		emailVerificationTokenRepo.AssertExpectations(t)
	})
}
