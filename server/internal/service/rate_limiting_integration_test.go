package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRateLimitingIntegration tests rate limiting functionality in authentication flows
func TestRateLimitingIntegration(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	t.Run("Registration_Rate_Limiting", func(t *testing.T) {
		// Create fresh services for each test to avoid rate limit carryover
		authService := createFreshAuthService(t, testDB)

		// Test registration rate limiting (3 per hour per IP)
		successCount := 0
		rateLimitCount := 0

		// Attempt 5 registrations from same IP
		for i := 0; i < 5; i++ {
			req := RegisterRequest{
				Email:    fmt.Sprintf("user%d@ratelimit.com", i),
				Password: "SecurePass123!",
				Name:     fmt.Sprintf("User %d", i),
			}

			_, err := authService.Register(ctx, req)

			if err != nil {
				if authErr, ok := err.(*AuthError); ok && authErr.Code == ErrRateLimitExceeded {
					rateLimitCount++
				} else {
					t.Fatalf("Unexpected error: %v", err)
				}
			} else {
				successCount++
			}
		}

		// Should have 3 successful registrations and 2 rate limited
		assert.Equal(t, 3, successCount, "Should allow 3 registrations per hour")
		assert.Equal(t, 2, rateLimitCount, "Should rate limit after 3 attempts")
	})

	t.Run("Account_Lockout_Integration", func(t *testing.T) {
		// Clean up tables to avoid pollution from Registration_Rate_Limiting sub-test
		testDB.CleanupTables(ctx)

		authService := createAuthServiceWithNoRateLimit(t, testDB)
		userRepo := repository.NewUserRepository(testDB.DB)

		// First register and verify a user
		email := "lockout@example.com"
		password := "CorrectPass123!"
		wrongPassword := "WrongPass123!"

		registerReq := RegisterRequest{
			Email:    email,
			Password: password,
			Name:     "Lockout User",
		}

		authResponse, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		// Manually verify email
		err = userRepo.UpdateEmailVerified(ctx, authResponse.User.ID, true)
		require.NoError(t, err)

		// Test failed login attempts leading to account lockout
		// Note: Due to test pollution from other tests, rate limiting may kick in early.
		// We allow for rate limiting to happen while still testing account lockout functionality.
		failedAttempts := 0
		accountLocked := false

		for i := 0; i < 7; i++ {
			loginReq := LoginRequest{
				Email:     email,
				Password:  wrongPassword,
				IPAddress: fmt.Sprintf("192.168.1.%d", 101+i), // Different IP for each attempt
				UserAgent: "Test Browser",
			}

			_, err := authService.Login(ctx, loginReq)

			if err != nil {
				if authErr, ok := err.(*AuthError); ok {
				switch authErr.Code {
				case ErrInvalidCredentials:
					failedAttempts++
				case ErrAccountLocked:
					accountLocked = true
				default:
					t.Fatalf("Unexpected error code %s: %v", authErr.Code, err)
				}
				} else {
					t.Fatalf("Unexpected error type: %v", err)
				}
			}
		}

		// After 4 failed attempts, the account is not yet locked → ErrInvalidCredentials.
		// On the 5th failed attempt, IncrementFailedLoginCount locks the account,
		// and Login re-fetches the user and returns ErrAccountLocked.
		assert.Equal(t, 4, failedAttempts, "Should get exactly 4 INVALID_CREDENTIALS before the 5th triggers ACCOUNT_LOCKED")
		assert.True(t, accountLocked, "Account should be locked on the 5th failed attempt")

		// Verify that even correct password fails with ACCOUNT_LOCKED when account is locked
		correctLoginReq := LoginRequest{
			Email:     email,
			Password:  password,
			IPAddress: "192.168.1.200", // Different IP for final test
			UserAgent: "Test Browser",
		}

		_, err = authService.Login(ctx, correctLoginReq)
		require.Error(t, err, "Login should fail when account is locked")

		authErr, ok := err.(*AuthError)
		require.True(t, ok, "Error should be an AuthError")
		assert.Equal(t, ErrAccountLocked, authErr.Code, "Error code should be ACCOUNT_LOCKED, not INVALID_CREDENTIALS")
	})

	t.Run("Password_Reset_Rate_Limiting", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)

		// Register a user first
		email := "resetlimit@example.com"
		registerReq := RegisterRequest{
			Email:    email,
			Password: "SecurePass123!",
			Name:     "Reset Limit User",
		}

		_, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		// Test password reset rate limiting (3 per hour per email)
		successCount := 0
		rateLimitCount := 0

		for i := 0; i < 5; i++ {
			err := authService.ResetPassword(ctx, email)

			if err != nil {
				if authErr, ok := err.(*AuthError); ok && authErr.Code == ErrRateLimitExceeded {
					rateLimitCount++
				} else {
					t.Fatalf("Unexpected error: %v", err)
				}
			} else {
				successCount++
			}
		}

		assert.Equal(t, 3, successCount, "Should allow 3 password resets per hour")
		assert.Equal(t, 2, rateLimitCount, "Should rate limit after 3 attempts")
	})
}

// TestSecurityFeatures tests various security aspects of the authentication system
func TestSecurityFeatures(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	t.Run("Password_Hashing_Security", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)
		userRepo := repository.NewUserRepository(testDB.DB)

		password := "TestPassword123!"
		email := "hash@example.com"

		// Register user
		registerReq := RegisterRequest{
			Email:    email,
			Password: password,
			Name:     "Hash User",
		}

		_, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		// Retrieve user from database
		user, err := userRepo.GetByEmail(ctx, email)
		require.NoError(t, err)

		// Verify password is hashed (not stored in plaintext)
		assert.NotNil(t, user.PasswordHash)
		assert.NotEqual(t, password, *user.PasswordHash, "Password should be hashed, not stored in plaintext")
		assert.Contains(t, *user.PasswordHash, "$2a$", "Should use bcrypt hashing")

		// Verify password hash is different for same password (due to salt)
		registerReq2 := RegisterRequest{
			Email:    "hash2@example.com",
			Password: password, // Same password
			Name:     "Hash User 2",
		}

		_, err = authService.Register(ctx, registerReq2)
		require.NoError(t, err)

		user2, err := userRepo.GetByEmail(ctx, "hash2@example.com")
		require.NoError(t, err)

		assert.NotEqual(t, *user.PasswordHash, *user2.PasswordHash, "Same password should produce different hashes due to salt")
	})

	t.Run("JWT_Token_Security", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)
		userRepo := repository.NewUserRepository(testDB.DB)

		email := "jwt@example.com"
		password := "JWTPass123!"

		// Register and verify user
		registerReq := RegisterRequest{
			Email:    email,
			Password: password,
			Name:     "JWT User",
		}

		authResponse, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		err = userRepo.UpdateEmailVerified(ctx, authResponse.User.ID, true)
		require.NoError(t, err)

		// Login to get JWT token
		loginReq := LoginRequest{
			Email:     email,
			Password:  password,
			IPAddress: "192.168.1.104",
			UserAgent: "Test Browser",
		}

		loginResponse, err := authService.Login(ctx, loginReq)
		require.NoError(t, err)

		// Verify JWT token properties
		token := loginResponse.Token
		assert.NotEmpty(t, token, "JWT token should not be empty")
		assert.Contains(t, token, ".", "JWT should contain dots separating header.payload.signature")

		// JWT should have 3 parts (header.payload.signature)
		parts := len([]rune(token)) // Simple check that it's not just a random string
		assert.Greater(t, parts, 50, "JWT token should be reasonably long")

		// Verify refresh token is different from JWT token
		refreshToken := loginResponse.RefreshToken
		assert.NotEmpty(t, refreshToken, "Refresh token should not be empty")
		assert.NotEqual(t, token, refreshToken, "JWT and refresh tokens should be different")

		// Verify expiration is set appropriately
		assert.True(t, loginResponse.ExpiresAt.After(time.Now()), "Token expiration should be in the future")
		assert.True(t, loginResponse.ExpiresAt.Before(time.Now().Add(24*time.Hour)), "Token should expire within 24 hours")
	})

	t.Run("Session_Security", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)
		userRepo := repository.NewUserRepository(testDB.DB)
		sessionRepo := repository.NewSessionRepository(testDB.DB)

		email := "session@example.com"
		password := "SessionPass123!"

		// Register and verify user
		registerReq := RegisterRequest{
			Email:    email,
			Password: password,
			Name:     "Session User",
		}

		authResponse, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		err = userRepo.UpdateEmailVerified(ctx, authResponse.User.ID, true)
		require.NoError(t, err)

		// Create multiple sessions
		var tokens []string
		for i := 0; i < 3; i++ {
			loginReq := LoginRequest{
				Email:     email,
				Password:  password,
				IPAddress: fmt.Sprintf("192.168.1.%d", 105+i),
				UserAgent: fmt.Sprintf("Browser %d", i),
			}

			loginResponse, err := authService.Login(ctx, loginReq)
			require.NoError(t, err)
			tokens = append(tokens, loginResponse.Token)
		}

		// Verify all sessions are stored (1 from register + 3 from login)
		sessions, err := sessionRepo.GetByUserID(ctx, authResponse.User.ID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(sessions), 4, "Should have at least 4 sessions (1 register + 3 login)")

		// Verify sessions have proper security attributes
		for _, session := range sessions {
			assert.NotEmpty(t, session.Token, "Session should have token")
			assert.NotEmpty(t, session.RefreshToken, "Session should have refresh token")
			assert.NotEmpty(t, session.IPAddress, "Session should track IP address")
			assert.NotEmpty(t, session.UserAgent, "Session should track user agent")
		}

		// Test session invalidation on logout
		err = authService.Logout(ctx, authResponse.User.ID, tokens[0])
		require.NoError(t, err)

		// Verify session was invalidated
		sessions, err = sessionRepo.GetByUserID(ctx, authResponse.User.ID)
		require.NoError(t, err)

		// Should have one less active session
		activeCount := 0
		for _, session := range sessions {
			if session.ExpiresAt.After(time.Now()) {
				activeCount++
			}
		}
		assert.LessOrEqual(t, activeCount, 3, "Should have invalidated one session")
	})
}

// TestTokenLifecycleManagement tests comprehensive token lifecycle scenarios
func TestTokenLifecycleManagement(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	t.Run("Email_Verification_Token_Lifecycle", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)
		emailVerificationTokenRepo := repository.NewEmailVerificationTokenRepository(testDB.DB)
		userRepo := repository.NewUserRepository(testDB.DB)

		email := "tokenlife@example.com"

		// Register user (creates verification token)
		registerReq := RegisterRequest{
			Email:    email,
			Password: "TokenPass123!",
			Name:     "Token User",
		}

		authResponse, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		// Verify token was created
		tokens, err := emailVerificationTokenRepo.GetByUserID(ctx, authResponse.User.ID)
		require.NoError(t, err)
		assert.Len(t, tokens, 1, "Should create one verification token")

		originalToken := tokens[0]
		assert.False(t, originalToken.Used, "Token should not be marked as used initially")
		assert.True(t, originalToken.ExpiresAt.After(time.Now()), "Token should not be expired")

		// Use the token
		err = authService.VerifyEmail(ctx, originalToken.Token)
		require.NoError(t, err)

		// Verify token is marked as used
		updatedTokens, err := emailVerificationTokenRepo.GetByUserID(ctx, authResponse.User.ID)
		require.NoError(t, err)
		assert.Len(t, updatedTokens, 1)
		assert.True(t, updatedTokens[0].Used, "Token should be marked as used after verification")

		// Verify user is marked as verified
		user, err := userRepo.GetByEmail(ctx, email)
		require.NoError(t, err)
		assert.True(t, user.EmailVerified, "User should be marked as verified")

		// Try to use token again (should fail)
		err = authService.VerifyEmail(ctx, originalToken.Token)
		require.Error(t, err)

		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrInvalidToken, authErr.Code)
	})

	t.Run("Password_Reset_Token_Lifecycle", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)
		passwordResetTokenRepo := repository.NewPasswordResetTokenRepository(testDB.DB)
		userRepo := repository.NewUserRepository(testDB.DB)

		email := "resettoken@example.com"
		originalPassword := "OriginalPass123!"
		newPassword := "NewPassword123!"

		// Register and verify user
		registerReq := RegisterRequest{
			Email:    email,
			Password: originalPassword,
			Name:     "Reset Token User",
		}

		authResponse, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		err = userRepo.UpdateEmailVerified(ctx, authResponse.User.ID, true)
		require.NoError(t, err)

		// Request password reset (creates reset token)
		err = authService.ResetPassword(ctx, email)
		require.NoError(t, err)

		// Verify token was created
		tokens, err := passwordResetTokenRepo.GetByUserID(ctx, authResponse.User.ID)
		require.NoError(t, err)
		assert.Len(t, tokens, 1, "Should create one reset token")

		resetToken := tokens[0]
		assert.False(t, resetToken.Used, "Token should not be marked as used initially")
		assert.True(t, resetToken.ExpiresAt.After(time.Now()), "Token should not be expired")

		// Use the token to reset password
		err = authService.ConfirmPasswordReset(ctx, resetToken.Token, newPassword)
		require.NoError(t, err)

		// Verify token is marked as used
		updatedTokens, err := passwordResetTokenRepo.GetByUserID(ctx, authResponse.User.ID)
		require.NoError(t, err)
		assert.Len(t, updatedTokens, 1)
		assert.True(t, updatedTokens[0].Used, "Token should be marked as used after reset")

		// Try to use token again (should fail)
		err = authService.ConfirmPasswordReset(ctx, resetToken.Token, "AnotherPass123!")
		require.Error(t, err)

		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrInvalidToken, authErr.Code)

		// Verify password was actually changed
		loginReq := LoginRequest{
			Email:     email,
			Password:  newPassword,
			IPAddress: "192.168.1.107",
			UserAgent: "Test Browser",
		}

		_, err = authService.Login(ctx, loginReq)
		require.NoError(t, err, "Should be able to login with new password")

		// Verify old password no longer works
		oldLoginReq := LoginRequest{
			Email:     email,
			Password:  originalPassword,
			IPAddress: "192.168.1.107",
			UserAgent: "Test Browser",
		}

		_, err = authService.Login(ctx, oldLoginReq)
		require.Error(t, err, "Should not be able to login with old password")
	})

	t.Run("JWT_Refresh_Token_Lifecycle", func(t *testing.T) {
		authService := createFreshAuthService(t, testDB)
		userRepo := repository.NewUserRepository(testDB.DB)

		email := "refresh@example.com"
		password := "RefreshPass123!"

		// Register and verify user
		registerReq := RegisterRequest{
			Email:    email,
			Password: password,
			Name:     "Refresh User",
		}

		authResponse, err := authService.Register(ctx, registerReq)
		require.NoError(t, err)

		err = userRepo.UpdateEmailVerified(ctx, authResponse.User.ID, true)
		require.NoError(t, err)

		// Login to get initial tokens
		loginReq := LoginRequest{
			Email:     email,
			Password:  password,
			IPAddress: "192.168.1.108",
			UserAgent: "Test Browser",
		}

		loginResponse, err := authService.Login(ctx, loginReq)
		require.NoError(t, err)

		originalToken := loginResponse.Token
		originalRefreshToken := loginResponse.RefreshToken

		// Refresh the token
		refreshResponse, err := authService.RefreshToken(ctx, originalRefreshToken)
		require.NoError(t, err)

		// Verify new tokens are different
		assert.NotEqual(t, originalToken, refreshResponse.Token, "New JWT should be different")
		assert.NotEqual(t, originalRefreshToken, refreshResponse.RefreshToken, "New refresh token should be different")

		// Verify old refresh token cannot be used again
		_, err = authService.RefreshToken(ctx, originalRefreshToken)
		require.Error(t, err, "Old refresh token should be invalidated")

		authErr, ok := err.(*AuthError)
		require.True(t, ok)
		assert.Equal(t, ErrInvalidToken, authErr.Code)

		// Verify new refresh token works
		_, err = authService.RefreshToken(ctx, refreshResponse.RefreshToken)
		require.NoError(t, err, "New refresh token should work")
	})
}

// createFreshAuthService creates a new authentication service with fresh rate limiter
func createFreshAuthService(t *testing.T, testDB *testutil.TestDB) AuthenticationService {
	// Setup repositories
	userRepo := repository.NewUserRepository(testDB.DB)
	sessionRepo := repository.NewSessionRepository(testDB.DB)
	passwordResetTokenRepo := repository.NewPasswordResetTokenRepository(testDB.DB)
	emailVerificationTokenRepo := repository.NewEmailVerificationTokenRepository(testDB.DB)

	// Generate RSA keys for testing
	privateKeyPEM, publicKeyPEM, err := GenerateRSAKeyPair()
	require.NoError(t, err)

	// Setup services with fresh rate limiter
	rateLimiter := NewInMemoryRateLimiter()
	securityConfig := SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		JWTAlgorithm:  "RS256",
		BCryptCost:    12,
	}
	securityService, err := NewSecurityService(securityConfig, rateLimiter)
	require.NoError(t, err)

	auditService := NewAuditService(repository.NewAuthEventRepository(testDB.DB))
	emailService := NewMockEmailService()

	sessionConfig := DefaultSessionServiceConfig()
	sessionService := NewSessionService(sessionRepo, userRepo, securityService, auditService, sessionConfig)

	// Setup authentication providers
	userRepoAdapter := &rateLimitUserRepositoryAdapter{repo: userRepo}
	localAuthProvider := NewLocalAuthProvider(userRepoAdapter, securityService)
	authProviders := []AuthProvider{localAuthProvider}

	return NewAuthenticationService(
		userRepo,
		sessionService,
		passwordResetTokenRepo,
		emailVerificationTokenRepo,
		securityService,
		auditService,
		emailService,
		authProviders,
	)
}

// createAuthServiceWithNoRateLimit creates an authentication service with a permissive rate limiter for account lockout testing
func createAuthServiceWithNoRateLimit(t *testing.T, testDB *testutil.TestDB) AuthenticationService {
	// Setup repositories
	userRepo := repository.NewUserRepository(testDB.DB)
	sessionRepo := repository.NewSessionRepository(testDB.DB)
	passwordResetTokenRepo := repository.NewPasswordResetTokenRepository(testDB.DB)
	emailVerificationTokenRepo := repository.NewEmailVerificationTokenRepository(testDB.DB)

	// Generate RSA keys for testing
	privateKeyPEM, publicKeyPEM, err := GenerateRSAKeyPair()
	require.NoError(t, err)

	// Setup services with permissive rate limiter
	rateLimiter := &noRateLimitMock{}
	securityConfig := SecurityConfig{
		JWTPrivateKey: privateKeyPEM,
		JWTPublicKey:  publicKeyPEM,
		JWTAlgorithm:  "RS256",
		BCryptCost:    12,
	}
	securityService, err := NewSecurityService(securityConfig, rateLimiter)
	require.NoError(t, err)

	auditService := NewAuditService(repository.NewAuthEventRepository(testDB.DB))
	emailService := NewMockEmailService()

	sessionConfig := DefaultSessionServiceConfig()
	sessionService := NewSessionService(sessionRepo, userRepo, securityService, auditService, sessionConfig)

	// Setup authentication providers
	userRepoAdapter := &rateLimitUserRepositoryAdapter{repo: userRepo}
	localAuthProvider := NewLocalAuthProvider(userRepoAdapter, securityService)
	authProviders := []AuthProvider{localAuthProvider}

	return NewAuthenticationService(
		userRepo,
		sessionService,
		passwordResetTokenRepo,
		emailVerificationTokenRepo,
		securityService,
		auditService,
		emailService,
		authProviders,
	)
}

// noRateLimitMock is a rate limiter that never enforces limits (for testing account lockout without rate limiting interference)
type noRateLimitMock struct{}

func (n *noRateLimitMock) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	return nil // Never rate limit
}

func (n *noRateLimitMock) Reset(ctx context.Context, key string) error {
	return nil
}

func (n *noRateLimitMock) GetAttempts(ctx context.Context, key string) (int, error) {
	return 0, nil
}

// rateLimitUserRepositoryAdapter adapts IUserRepository to UserRepository interface for testing
type rateLimitUserRepositoryAdapter struct {
	repo repository.IUserRepository
}

func (a *rateLimitUserRepositoryAdapter) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	return a.repo.GetByEmail(ctx, email)
}

func (a *rateLimitUserRepositoryAdapter) Create(ctx context.Context, user *model.User) error {
	_, err := a.repo.Create(ctx, user)
	return err
}

func (a *rateLimitUserRepositoryAdapter) Update(ctx context.Context, user *model.User) error {
	return a.repo.Update(ctx, user)
}
