package graphql

import (
	"context"
	"testing"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"sigma_finance/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// userRepositoryAdapter adapts IUserRepository to UserRepository interface for testing
type userRepositoryAdapter struct {
	repo repository.IUserRepository
}

func (a *userRepositoryAdapter) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	return a.repo.GetByEmail(ctx, email)
}

func (a *userRepositoryAdapter) Create(ctx context.Context, user *model.User) error {
	_, err := a.repo.Create(ctx, user)
	return err
}

func (a *userRepositoryAdapter) Update(ctx context.Context, user *model.User) error {
	return a.repo.Update(ctx, user)
}

// TestGraphQLIntegration_AuthenticationOperations tests all authentication GraphQL operations
func TestGraphQLIntegration_AuthenticationOperations(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup repositories
	uow := repository.NewUnitOfWork(testDB.DB)
	userRepo := repository.NewUserRepository(testDB.DB)
	sessionRepo := repository.NewSessionRepository(testDB.DB)
	passwordResetTokenRepo := repository.NewPasswordResetTokenRepository(testDB.DB)
	emailVerificationTokenRepo := repository.NewEmailVerificationTokenRepository(testDB.DB)

	// Generate RSA keys for testing
	privateKeyPEM, publicKeyPEM, err := service.GenerateRSAKeyPair()
	require.NoError(t, err)

	// Setup services
	rateLimiter := service.NewInMemoryRateLimiter()
	securityConfig := service.SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		BCryptCost:    12,
	}
	securityService, err := service.NewSecurityService(securityConfig, rateLimiter)
	require.NoError(t, err)

	auditService := service.NewAuditService(repository.NewAuthEventRepository(testDB.DB))
	emailService := service.NewMockEmailService() // Use mock for testing

	sessionConfig := service.DefaultSessionServiceConfig()
	sessionService := service.NewSessionService(sessionRepo, userRepo, securityService, auditService, sessionConfig)

	// Setup authentication providers with adapter
	userRepoAdapter := &userRepositoryAdapter{repo: userRepo}
	localAuthProvider := service.NewLocalAuthProvider(userRepoAdapter, securityService)
	authProviders := []service.AuthProvider{localAuthProvider}

	// Setup authentication service
	authService := service.NewAuthenticationService(
		userRepo,
		sessionService,
		passwordResetTokenRepo,
		emailVerificationTokenRepo,
		securityService,
		auditService,
		emailService,
		authProviders,
	)

	// Setup resolver
	resolver := &Resolver{
		AuthenticationService: authService,
		SecurityService:       securityService,
		UOW:                   uow,
	}

	mutationResolver := &mutationResolver{resolver}

	t.Run("Register_Success", func(t *testing.T) {
		input := gqlModel.RegisterInput{
			Email:    "test@example.com",
			Password: "SecurePass123!",
			Name:     "Test User",
		}

		response, err := mutationResolver.Register(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		if !response.Success {
			for i, err := range response.Errors {
				t.Logf("Error %d: Code=%s, Message=%s, Field=%v", i, err.Code, err.Message, err.Field)
			}
		}
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
		require.NotNil(t, response.Data)

		// Check auth data
		assert.NotEmpty(t, response.Data.Token)
		assert.NotEmpty(t, response.Data.RefreshToken)
		assert.False(t, response.Data.ExpiresAt.IsZero())

		// Check user data
		require.NotNil(t, response.Data.User)
		assert.NotEmpty(t, response.Data.User.ID)
		assert.Equal(t, "test@example.com", response.Data.User.Email)
		assert.Equal(t, "Test User", response.Data.User.Name)
		assert.False(t, response.Data.User.EmailVerified) // Should be false initially
	})

	t.Run("Register_DuplicateEmail", func(t *testing.T) {
		// First registration
		input1 := gqlModel.RegisterInput{
			Email:    "duplicate@example.com",
			Password: "SecurePass123!",
			Name:     "First User",
		}

		response1, err := mutationResolver.Register(ctx, input1)
		require.NoError(t, err)
		assert.True(t, response1.Success)

		// Second registration with same email
		input2 := gqlModel.RegisterInput{
			Email:    "duplicate@example.com",
			Password: "AnotherPass123!",
			Name:     "Second User",
		}

		response2, err := mutationResolver.Register(ctx, input2)
		require.NoError(t, err)
		require.NotNil(t, response2)

		// Check error response
		assert.False(t, response2.Success)
		assert.Nil(t, response2.Data)
		assert.NotNil(t, response2.Errors)
		assert.Len(t, response2.Errors, 1)
		assert.Equal(t, "EMAIL_ALREADY_EXISTS", response2.Errors[0].Code)
		assert.Equal(t, "email", *response2.Errors[0].Field)
	})

	t.Run("Register_WeakPassword", func(t *testing.T) {
		input := gqlModel.RegisterInput{
			Email:    "weak@example.com",
			Password: "123", // Too weak
			Name:     "Weak User",
		}

		response, err := mutationResolver.Register(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check error response
		assert.False(t, response.Success)
		assert.Nil(t, response.Data)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		// Note: May be RATE_LIMIT_EXCEEDED if previous tests triggered rate limiting
		assert.Contains(t, []string{"WEAK_PASSWORD", "RATE_LIMIT_EXCEEDED"}, response.Errors[0].Code)
		if response.Errors[0].Field != nil {
			assert.Equal(t, "password", *response.Errors[0].Field)
		}
	})

	t.Run("Login_Success", func(t *testing.T) {
		// First register a user
		registerInput := gqlModel.RegisterInput{
			Email:    "login@example.com",
			Password: "SecurePass123!",
			Name:     "Login User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Manually verify email for testing (in real scenario, user would click verification link)
		user, err := userRepo.GetByEmail(ctx, "login@example.com")
		require.NoError(t, err)
		err = userRepo.UpdateEmailVerified(ctx, user.ID, true)
		require.NoError(t, err)

		// Now login
		loginInput := gqlModel.LoginInput{
			Email:    "login@example.com",
			Password: "SecurePass123!",
		}

		response, err := mutationResolver.Login(ctx, loginInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
		assert.NotNil(t, response.Data)

		// Check auth data
		assert.NotEmpty(t, response.Data.Token)
		assert.NotEmpty(t, response.Data.RefreshToken)
		assert.False(t, response.Data.ExpiresAt.IsZero())

		// Check user data
		assert.Equal(t, "login@example.com", response.Data.User.Email)
		assert.Equal(t, "Login User", response.Data.User.Name)
		assert.True(t, response.Data.User.EmailVerified)
	})

	t.Run("Login_InvalidCredentials", func(t *testing.T) {
		input := gqlModel.LoginInput{
			Email:    "nonexistent@example.com",
			Password: "wrongpassword",
		}

		response, err := mutationResolver.Login(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check error response
		assert.False(t, response.Success)
		assert.Nil(t, response.Data)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "INVALID_CREDENTIALS", response.Errors[0].Code)
	})

	t.Run("Login_EmailNotVerified", func(t *testing.T) {
		// Register a user but don't verify email
		registerInput := gqlModel.RegisterInput{
			Email:    "unverified@example.com",
			Password: "SecurePass123!",
			Name:     "Unverified User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Try to login without email verification
		loginInput := gqlModel.LoginInput{
			Email:    "unverified@example.com",
			Password: "SecurePass123!",
		}

		response, err := mutationResolver.Login(ctx, loginInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check error response
		assert.False(t, response.Success)
		assert.Nil(t, response.Data)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "EMAIL_NOT_VERIFIED", response.Errors[0].Code)
	})

	t.Run("Logout_Success", func(t *testing.T) {
		// First register and login a user
		registerInput := gqlModel.RegisterInput{
			Email:    "logout@example.com",
			Password: "SecurePass123!",
			Name:     "Logout User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Verify email
		user, err := userRepo.GetByEmail(ctx, "logout@example.com")
		require.NoError(t, err)
		err = userRepo.UpdateEmailVerified(ctx, user.ID, true)
		require.NoError(t, err)

		// Login
		loginInput := gqlModel.LoginInput{
			Email:    "logout@example.com",
			Password: "SecurePass123!",
		}

		loginResponse, err := mutationResolver.Login(ctx, loginInput)
		require.NoError(t, err)
		assert.True(t, loginResponse.Success)

		// Logout
		logoutInput := gqlModel.LogoutInput{
			Token: loginResponse.Data.Token,
		}

		response, err := mutationResolver.Logout(ctx, logoutInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
	})

	t.Run("RefreshToken_Success", func(t *testing.T) {
		// First register and login a user
		registerInput := gqlModel.RegisterInput{
			Email:    "refresh@example.com",
			Password: "SecurePass123!",
			Name:     "Refresh User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Verify email
		user, err := userRepo.GetByEmail(ctx, "refresh@example.com")
		require.NoError(t, err)
		err = userRepo.UpdateEmailVerified(ctx, user.ID, true)
		require.NoError(t, err)

		// Login
		loginInput := gqlModel.LoginInput{
			Email:    "refresh@example.com",
			Password: "SecurePass123!",
		}

		loginResponse, err := mutationResolver.Login(ctx, loginInput)
		require.NoError(t, err)
		assert.True(t, loginResponse.Success)

		// Refresh token
		refreshInput := gqlModel.RefreshTokenInput{
			RefreshToken: loginResponse.Data.RefreshToken,
		}

		response, err := mutationResolver.RefreshToken(ctx, refreshInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
		assert.NotNil(t, response.Data)

		// Check new tokens are different
		assert.NotEqual(t, loginResponse.Data.Token, response.Data.Token)
		assert.NotEqual(t, loginResponse.Data.RefreshToken, response.Data.RefreshToken)
	})

	t.Run("ResetPassword_Success", func(t *testing.T) {
		// First register a user
		registerInput := gqlModel.RegisterInput{
			Email:    "reset@example.com",
			Password: "SecurePass123!",
			Name:     "Reset User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Request password reset
		resetInput := gqlModel.PasswordResetInput{
			Email: "reset@example.com",
		}

		response, err := mutationResolver.ResetPassword(ctx, resetInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
	})

	t.Run("ConfirmPasswordReset_Success", func(t *testing.T) {
		// First register a user
		registerInput := gqlModel.RegisterInput{
			Email:    "confirm@example.com",
			Password: "SecurePass123!",
			Name:     "Confirm User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Request password reset
		resetInput := gqlModel.PasswordResetInput{
			Email: "confirm@example.com",
		}

		resetResponse, err := mutationResolver.ResetPassword(ctx, resetInput)
		require.NoError(t, err)
		assert.True(t, resetResponse.Success)

		// Get the reset token from database (in real scenario, user would get this from email)
		user, err := userRepo.GetByEmail(ctx, "confirm@example.com")
		require.NoError(t, err)

		tokens, err := passwordResetTokenRepo.GetByUserID(ctx, user.ID)
		require.NoError(t, err)
		require.Len(t, tokens, 1)

		// Confirm password reset
		confirmInput := gqlModel.PasswordResetConfirmInput{
			Token:       tokens[0].Token,
			NewPassword: "NewSecurePass123!",
		}

		response, err := mutationResolver.ConfirmPasswordReset(ctx, confirmInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
	})

	t.Run("VerifyEmail_Success", func(t *testing.T) {
		// First register a user
		registerInput := gqlModel.RegisterInput{
			Email:    "verify@example.com",
			Password: "SecurePass123!",
			Name:     "Verify User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Get the verification token from database (in real scenario, user would get this from email)
		user, err := userRepo.GetByEmail(ctx, "verify@example.com")
		require.NoError(t, err)

		tokens, err := emailVerificationTokenRepo.GetByUserID(ctx, user.ID)
		require.NoError(t, err)
		require.Len(t, tokens, 1)

		// Verify email
		verifyInput := gqlModel.EmailVerificationInput{
			Token: tokens[0].Token,
		}

		response, err := mutationResolver.VerifyEmail(ctx, verifyInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)

		// Verify that email is now verified
		updatedUser, err := userRepo.GetByEmail(ctx, "verify@example.com")
		require.NoError(t, err)
		assert.True(t, updatedUser.EmailVerified)
	})

	t.Run("ResendVerification_Success", func(t *testing.T) {
		// First register a user
		registerInput := gqlModel.RegisterInput{
			Email:    "resend@example.com",
			Password: "SecurePass123!",
			Name:     "Resend User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Resend verification
		resendInput := gqlModel.ResendVerificationInput{
			Email: "resend@example.com",
		}

		response, err := mutationResolver.ResendVerification(ctx, resendInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check success response
		assert.True(t, response.Success)
		assert.Nil(t, response.Errors)
	})
}

// TestGraphQLIntegration_WeakPasswordValidation tests weak password validation with fresh rate limiter
func TestGraphQLIntegration_WeakPasswordValidation(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup repositories
	uow := repository.NewUnitOfWork(testDB.DB)
	userRepo := repository.NewUserRepository(testDB.DB)
	sessionRepo := repository.NewSessionRepository(testDB.DB)
	passwordResetTokenRepo := repository.NewPasswordResetTokenRepository(testDB.DB)
	emailVerificationTokenRepo := repository.NewEmailVerificationTokenRepository(testDB.DB)

	// Generate RSA keys for testing
	privateKeyPEM, publicKeyPEM, err := service.GenerateRSAKeyPair()
	require.NoError(t, err)

	// Setup services with fresh rate limiter
	rateLimiter := service.NewInMemoryRateLimiter()
	securityConfig := service.SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		BCryptCost:    12,
	}
	securityService, err := service.NewSecurityService(securityConfig, rateLimiter)
	require.NoError(t, err)

	auditService := service.NewAuditService(repository.NewAuthEventRepository(testDB.DB))
	emailService := service.NewMockEmailService()

	sessionConfig := service.DefaultSessionServiceConfig()
	sessionService := service.NewSessionService(sessionRepo, userRepo, securityService, auditService, sessionConfig)

	userRepoAdapter := &userRepositoryAdapter{repo: userRepo}
	localAuthProvider := service.NewLocalAuthProvider(userRepoAdapter, securityService)
	authProviders := []service.AuthProvider{localAuthProvider}

	authService := service.NewAuthenticationService(
		userRepo,
		sessionService,
		passwordResetTokenRepo,
		emailVerificationTokenRepo,
		securityService,
		auditService,
		emailService,
		authProviders,
	)

	resolver := &Resolver{
		AuthenticationService: authService,
		SecurityService:       securityService,
		UOW:                   uow,
	}

	mutationResolver := &mutationResolver{resolver}

	t.Run("Register_WeakPassword", func(t *testing.T) {
		input := gqlModel.RegisterInput{
			Email:    "weak@example.com",
			Password: "123", // Too weak
			Name:     "Weak User",
		}

		response, err := mutationResolver.Register(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		// Check error response
		assert.False(t, response.Success)
		assert.Nil(t, response.Data)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "WEAK_PASSWORD", response.Errors[0].Code)
		if response.Errors[0].Field != nil {
			assert.Equal(t, "password", *response.Errors[0].Field)
		}
	})
}

// TestGraphQLIntegration_AuthenticationErrorHandling tests error scenarios
func TestGraphQLIntegration_AuthenticationErrorHandling(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Setup minimal services for error testing
	uow := repository.NewUnitOfWork(testDB.DB)
	userRepo := repository.NewUserRepository(testDB.DB)
	sessionRepo := repository.NewSessionRepository(testDB.DB)
	passwordResetTokenRepo := repository.NewPasswordResetTokenRepository(testDB.DB)
	emailVerificationTokenRepo := repository.NewEmailVerificationTokenRepository(testDB.DB)

	// Generate RSA keys for testing
	privateKeyPEM, publicKeyPEM, err := service.GenerateRSAKeyPair()
	require.NoError(t, err)

	rateLimiter := service.NewInMemoryRateLimiter()
	securityConfig := service.SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		BCryptCost:    12,
	}
	securityService, err := service.NewSecurityService(securityConfig, rateLimiter)
	require.NoError(t, err)

	auditService := service.NewAuditService(repository.NewAuthEventRepository(testDB.DB))
	emailService := service.NewMockEmailService()

	sessionConfig := service.DefaultSessionServiceConfig()
	sessionService := service.NewSessionService(sessionRepo, userRepo, securityService, auditService, sessionConfig)

	userRepoAdapter := &userRepositoryAdapter{repo: userRepo}
	localAuthProvider := service.NewLocalAuthProvider(userRepoAdapter, securityService)
	authProviders := []service.AuthProvider{localAuthProvider}

	authService := service.NewAuthenticationService(
		userRepo,
		sessionService,
		passwordResetTokenRepo,
		emailVerificationTokenRepo,
		securityService,
		auditService,
		emailService,
		authProviders,
	)

	resolver := &Resolver{
		AuthenticationService: authService,
		SecurityService:       securityService,
		UOW:                   uow,
	}

	mutationResolver := &mutationResolver{resolver}

	t.Run("Register_InvalidEmail", func(t *testing.T) {
		input := gqlModel.RegisterInput{
			Email:    "invalid-email",
			Password: "SecurePass123!",
			Name:     "Test User",
		}

		response, err := mutationResolver.Register(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		assert.False(t, response.Success)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "INVALID_INPUT", response.Errors[0].Code)
	})

	t.Run("Login_WrongPassword", func(t *testing.T) {
		// First register a user
		registerInput := gqlModel.RegisterInput{
			Email:    "wrongpass@example.com",
			Password: "SecurePass123!",
			Name:     "Wrong Pass User",
		}

		registerResponse, err := mutationResolver.Register(ctx, registerInput)
		require.NoError(t, err)
		assert.True(t, registerResponse.Success)

		// Verify email
		user, err := userRepo.GetByEmail(ctx, "wrongpass@example.com")
		require.NoError(t, err)
		err = userRepo.UpdateEmailVerified(ctx, user.ID, true)
		require.NoError(t, err)

		// Try login with wrong password
		loginInput := gqlModel.LoginInput{
			Email:    "wrongpass@example.com",
			Password: "WrongPassword123!",
		}

		response, err := mutationResolver.Login(ctx, loginInput)
		require.NoError(t, err)
		require.NotNil(t, response)

		assert.False(t, response.Success)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "INVALID_CREDENTIALS", response.Errors[0].Code)
	})

	t.Run("Logout_InvalidToken", func(t *testing.T) {
		input := gqlModel.LogoutInput{
			Token: "invalid-token",
		}

		response, err := mutationResolver.Logout(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		assert.False(t, response.Success)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "INVALID_TOKEN", response.Errors[0].Code)
	})

	t.Run("RefreshToken_InvalidToken", func(t *testing.T) {
		input := gqlModel.RefreshTokenInput{
			RefreshToken: "invalid-refresh-token",
		}

		response, err := mutationResolver.RefreshToken(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		assert.False(t, response.Success)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "INVALID_TOKEN", response.Errors[0].Code)
	})

	t.Run("VerifyEmail_ExpiredToken", func(t *testing.T) {
		input := gqlModel.EmailVerificationInput{
			Token: "expired-token",
		}

		response, err := mutationResolver.VerifyEmail(ctx, input)
		require.NoError(t, err)
		require.NotNil(t, response)

		assert.False(t, response.Success)
		assert.NotNil(t, response.Errors)
		assert.Len(t, response.Errors, 1)
		assert.Equal(t, "INVALID_TOKEN", response.Errors[0].Code)
	})
}
