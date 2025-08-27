package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// TestRateLimitingAndAccountLockoutIntegration tests the complete integration
// of rate limiting, account lockout, and security middleware
func TestRateLimitingAndAccountLockoutIntegration(t *testing.T) {
	ctx := context.Background()

	// Setup services
	rateLimiter := NewInMemoryRateLimiter()
	mockUserRepo := &MockLockoutUserRepo{}
	mockAudit := &MockLockoutAuditService{}
	config := DefaultAccountLockoutConfig()

	lockoutService := NewAccountLockoutService(mockUserRepo, mockAudit, rateLimiter, config)

	userID := "test-user-123"
	email := "test@example.com"
	ipAddress := "192.168.1.100"
	userAgent := "Test-Browser/1.0"

	t.Run("complete failed login scenario with rate limiting and account lockout", func(t *testing.T) {
		// Test scenario: User fails to login 5 times, gets rate limited and account locked

		for attempt := 1; attempt <= 5; attempt++ {
			t.Logf("Failed login attempt %d", attempt)

			// Mock user state after each failed attempt
			user := &model.User{
				ID:               userID,
				Email:            email,
				FailedLoginCount: attempt,
				LockedUntil:      nil,
			}

			// On the 5th attempt, the account should be locked
			if attempt == 5 {
				lockUntil := time.Now().Add(30 * time.Minute)
				user.LockedUntil = &lockUntil
			}

			// Setup mocks for this attempt
			mockUserRepo.On("IncrementFailedLoginCount", ctx, userID).Return(nil).Once()
			mockUserRepo.On("GetByStringID", ctx, userID).Return(user, nil).Once()

			// Expect audit logging
			if attempt == 5 {
				// Two audit events: failed login + account lock
				mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Times(2)
			} else {
				// One audit event: failed login
				mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Once()
			}

			// Perform failed login
			err := lockoutService.HandleFailedLogin(ctx, userID, email, ipAddress, userAgent)

			if attempt < 5 {
				// Should succeed for first 4 attempts
				assert.NoError(t, err, "Attempt %d should not be blocked", attempt)
			} else {
				// 5th attempt should result in account lock
				assert.Error(t, err, "5th attempt should result in account lock")
				assert.True(t, IsAccountLockedError(err), "Error should be account locked error")
			}
		}

		// Verify all mocks were called as expected
		mockUserRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)

		// Reset mocks for next test
		mockUserRepo.ExpectedCalls = nil
		mockAudit.ExpectedCalls = nil
	})

	t.Run("rate limiting prevents excessive attempts", func(t *testing.T) {
		// Test that rate limiting kicks in before account lockout for rapid attempts
		differentEmail := "ratelimit@example.com"
		loginKey := LoginRateLimitKey(differentEmail)

		// Exhaust rate limit quickly
		for i := 0; i < config.MaxFailedAttempts; i++ {
			err := rateLimiter.CheckRateLimit(ctx, loginKey, config.MaxFailedAttempts, config.RateLimitWindow)
			assert.NoError(t, err, "Rate limit attempt %d should succeed", i+1)
		}

		// Next attempt should be rate limited
		mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Once()

		err := lockoutService.HandleFailedLogin(ctx, "different-user", differentEmail, ipAddress, userAgent)
		assert.Error(t, err)
		assert.True(t, IsRateLimitError(err), "Should be rate limited")

		// Verify user repository methods were NOT called (rate limit prevented it)
		mockUserRepo.AssertNotCalled(t, "IncrementFailedLoginCount")
		mockAudit.AssertExpectations(t)

		// Reset mocks
		mockAudit.ExpectedCalls = nil
	})

	t.Run("successful login resets both rate limit and failed count", func(t *testing.T) {
		// Test that successful login resets everything
		successUserID := "success-user"
		successEmail := "success@example.com"

		// Setup mocks for successful login
		mockUserRepo.On("ResetFailedLoginCount", ctx, successUserID).Return(nil).Once()
		mockUserRepo.On("UpdateLastLogin", ctx, successUserID, mock.AnythingOfType("time.Time"), ipAddress).Return(nil).Once()
		mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Once()

		err := lockoutService.HandleSuccessfulLogin(ctx, successUserID, successEmail, ipAddress, userAgent)
		assert.NoError(t, err)

		// Verify rate limit was reset
		loginKey := LoginRateLimitKey(successEmail)
		attempts, err := rateLimiter.GetAttempts(ctx, loginKey)
		assert.NoError(t, err)
		assert.Equal(t, 0, attempts, "Rate limit should be reset after successful login")

		mockUserRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)

		// Reset mocks
		mockUserRepo.ExpectedCalls = nil
		mockAudit.ExpectedCalls = nil
	})

	t.Run("account lockout check prevents access", func(t *testing.T) {
		// Test that locked accounts are properly blocked
		lockedUserID := "locked-user"
		lockUntil := time.Now().Add(time.Hour)

		lockedUser := &model.User{
			ID:               lockedUserID,
			Email:            "locked@example.com",
			FailedLoginCount: 5,
			LockedUntil:      &lockUntil,
		}

		mockUserRepo.On("GetByStringID", ctx, lockedUserID).Return(lockedUser, nil).Once()

		err := lockoutService.CheckAccountLockout(ctx, lockedUserID)
		assert.Error(t, err)
		assert.True(t, IsAccountLockedError(err), "Should be account locked error")

		mockUserRepo.AssertExpectations(t)

		// Reset mocks
		mockUserRepo.ExpectedCalls = nil
	})

	t.Run("manual account unlock resets everything", func(t *testing.T) {
		// Test manual unlock functionality
		lockedUserID := "manual-unlock-user"
		adminUserID := "admin-123"
		lockUntil := time.Now().Add(time.Hour)

		lockedUser := &model.User{
			ID:               lockedUserID,
			Email:            "unlock@example.com",
			FailedLoginCount: 5,
			LockedUntil:      &lockUntil,
		}

		// Setup mocks for unlock operation
		mockUserRepo.On("GetByStringID", ctx, lockedUserID).Return(lockedUser, nil).Once()
		mockUserRepo.On("UnlockAccount", ctx, lockedUserID).Return(nil).Once()
		mockUserRepo.On("ResetFailedLoginCount", ctx, lockedUserID).Return(nil).Once()
		mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Once()

		err := lockoutService.UnlockAccount(ctx, lockedUserID, adminUserID)
		assert.NoError(t, err)

		mockUserRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)
	})
}

// TestRateLimitKeyGeneration tests that rate limit keys are generated correctly
// for different scenarios
func TestRateLimitKeyGeneration(t *testing.T) {
	tests := []struct {
		name     string
		function func(string) string
		input    string
		expected string
	}{
		{
			name:     "login rate limit key",
			function: LoginRateLimitKey,
			input:    "user@example.com",
			expected: "login:user@example.com",
		},
		{
			name:     "IP rate limit key",
			function: IPRateLimitKey,
			input:    "192.168.1.1",
			expected: "ip:192.168.1.1",
		},
		{
			name:     "registration rate limit key",
			function: RegistrationRateLimitKey,
			input:    "10.0.0.1",
			expected: "register:10.0.0.1",
		},
		{
			name:     "password reset rate limit key",
			function: PasswordResetRateLimitKey,
			input:    "reset@example.com",
			expected: "password_reset:reset@example.com",
		},
		{
			name:     "email verification rate limit key",
			function: EmailVerificationRateLimitKey,
			input:    "verify@example.com",
			expected: "email_verify:verify@example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.function(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestSecurityConfiguration tests that security configurations are properly validated
func TestSecurityConfiguration(t *testing.T) {
	t.Run("default account lockout config", func(t *testing.T) {
		config := DefaultAccountLockoutConfig()

		// Verify default values match requirements
		assert.Equal(t, 5, config.MaxFailedAttempts, "Should allow 5 failed attempts")
		assert.Equal(t, 30*time.Minute, config.LockoutDuration, "Should lock for 30 minutes")
		assert.Equal(t, 15*time.Minute, config.RateLimitWindow, "Should have 15 minute rate limit window")
	})

	t.Run("custom account lockout config", func(t *testing.T) {
		config := AccountLockoutConfig{
			MaxFailedAttempts: 3,
			LockoutDuration:   time.Hour,
			RateLimitWindow:   30 * time.Minute,
		}

		rateLimiter := NewInMemoryRateLimiter()
		mockUserRepo := &MockLockoutUserRepo{}
		mockAudit := &MockLockoutAuditService{}

		service := NewAccountLockoutService(mockUserRepo, mockAudit, rateLimiter, config)
		assert.NotNil(t, service, "Should create service with custom config")
	})
}

// TestConcurrentRateLimiting tests rate limiting under concurrent access
func TestConcurrentRateLimiting(t *testing.T) {
	rateLimiter := NewInMemoryRateLimiter()
	ctx := context.Background()

	t.Run("concurrent rate limiting maintains accuracy", func(t *testing.T) {
		key := "concurrent:test"
		limit := 10
		window := time.Minute
		goroutines := 20

		// Channel to collect results
		results := make(chan bool, goroutines)

		// Launch concurrent goroutines
		for i := 0; i < goroutines; i++ {
			go func() {
				err := rateLimiter.CheckRateLimit(ctx, key, limit, window)
				results <- (err == nil)
			}()
		}

		// Collect results
		allowed := 0
		blocked := 0
		for i := 0; i < goroutines; i++ {
			if <-results {
				allowed++
			} else {
				blocked++
			}
		}

		// Should allow exactly the limit
		assert.Equal(t, limit, allowed, "Should allow exactly %d requests", limit)
		assert.Equal(t, goroutines-limit, blocked, "Should block %d requests", goroutines-limit)
	})
}
