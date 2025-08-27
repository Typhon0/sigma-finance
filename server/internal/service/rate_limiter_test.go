package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryRateLimiter_CheckRateLimit(t *testing.T) {
	limiter := NewInMemoryRateLimiter()
	ctx := context.Background()

	t.Run("allows requests within limit", func(t *testing.T) {
		key := "test:user1"
		limit := 5
		window := time.Minute

		// Should allow first 5 requests
		for i := 0; i < limit; i++ {
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			assert.NoError(t, err, "Request %d should be allowed", i+1)
		}
	})

	t.Run("blocks requests exceeding limit", func(t *testing.T) {
		key := "test:user2"
		limit := 3
		window := time.Minute

		// Use up the limit
		for i := 0; i < limit; i++ {
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			require.NoError(t, err)
		}

		// Next request should be blocked
		err := limiter.CheckRateLimit(ctx, key, limit, window)
		assert.Error(t, err)
		assert.True(t, IsRateLimitError(err))

		rateLimitErr := err.(*RateLimitError)
		assert.Equal(t, key, rateLimitErr.Key)
		assert.Equal(t, limit, rateLimitErr.Limit)
		assert.Equal(t, window, rateLimitErr.Window)
	})

	t.Run("resets after window expires", func(t *testing.T) {
		key := "test:user3"
		limit := 2
		window := 100 * time.Millisecond

		// Use up the limit
		for i := 0; i < limit; i++ {
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			require.NoError(t, err)
		}

		// Should be blocked
		err := limiter.CheckRateLimit(ctx, key, limit, window)
		assert.Error(t, err)

		// Wait for window to expire
		time.Sleep(window + 10*time.Millisecond)

		// Should be allowed again
		err = limiter.CheckRateLimit(ctx, key, limit, window)
		assert.NoError(t, err)
	})

	t.Run("different keys are independent", func(t *testing.T) {
		key1 := "test:user4"
		key2 := "test:user5"
		limit := 2
		window := time.Minute

		// Use up limit for key1
		for i := 0; i < limit; i++ {
			err := limiter.CheckRateLimit(ctx, key1, limit, window)
			require.NoError(t, err)
		}

		// key1 should be blocked
		err := limiter.CheckRateLimit(ctx, key1, limit, window)
		assert.Error(t, err)

		// key2 should still be allowed
		err = limiter.CheckRateLimit(ctx, key2, limit, window)
		assert.NoError(t, err)
	})
}

func TestInMemoryRateLimiter_GetAttempts(t *testing.T) {
	limiter := NewInMemoryRateLimiter()
	ctx := context.Background()

	t.Run("returns zero for new key", func(t *testing.T) {
		key := "test:attempts1"
		attempts, err := limiter.GetAttempts(ctx, key)
		assert.NoError(t, err)
		assert.Equal(t, 0, attempts)
	})

	t.Run("returns correct attempt count", func(t *testing.T) {
		key := "test:attempts2"
		limit := 5
		window := time.Minute

		// Make 3 requests
		for i := 0; i < 3; i++ {
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			require.NoError(t, err)
		}

		attempts, err := limiter.GetAttempts(ctx, key)
		assert.NoError(t, err)
		assert.Equal(t, 3, attempts)
	})

	t.Run("returns zero after window expires", func(t *testing.T) {
		key := "test:attempts3"
		limit := 5
		window := 100 * time.Millisecond

		// Make some requests
		err := limiter.CheckRateLimit(ctx, key, limit, window)
		require.NoError(t, err)

		// Wait for window to expire
		time.Sleep(window + 10*time.Millisecond)

		attempts, err := limiter.GetAttempts(ctx, key)
		assert.NoError(t, err)
		assert.Equal(t, 0, attempts)
	})
}

func TestInMemoryRateLimiter_Reset(t *testing.T) {
	limiter := NewInMemoryRateLimiter()
	ctx := context.Background()

	t.Run("resets rate limit for key", func(t *testing.T) {
		key := "test:reset1"
		limit := 2
		window := time.Minute

		// Use up the limit
		for i := 0; i < limit; i++ {
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			require.NoError(t, err)
		}

		// Should be blocked
		err := limiter.CheckRateLimit(ctx, key, limit, window)
		assert.Error(t, err)

		// Reset the limit
		err = limiter.Reset(ctx, key)
		assert.NoError(t, err)

		// Should be allowed again
		err = limiter.CheckRateLimit(ctx, key, limit, window)
		assert.NoError(t, err)
	})

	t.Run("reset non-existent key doesn't error", func(t *testing.T) {
		key := "test:reset2"
		err := limiter.Reset(ctx, key)
		assert.NoError(t, err)
	})
}

func TestRateLimitKeyGenerators(t *testing.T) {
	t.Run("LoginRateLimitKey", func(t *testing.T) {
		email := "user@example.com"
		key := LoginRateLimitKey(email)
		assert.Equal(t, "login:user@example.com", key)
	})

	t.Run("IPRateLimitKey", func(t *testing.T) {
		ip := "192.168.1.1"
		key := IPRateLimitKey(ip)
		assert.Equal(t, "ip:192.168.1.1", key)
	})

	t.Run("RegistrationRateLimitKey", func(t *testing.T) {
		ip := "10.0.0.1"
		key := RegistrationRateLimitKey(ip)
		assert.Equal(t, "register:10.0.0.1", key)
	})

	t.Run("PasswordResetRateLimitKey", func(t *testing.T) {
		email := "test@example.com"
		key := PasswordResetRateLimitKey(email)
		assert.Equal(t, "password_reset:test@example.com", key)
	})

	t.Run("EmailVerificationRateLimitKey", func(t *testing.T) {
		email := "verify@example.com"
		key := EmailVerificationRateLimitKey(email)
		assert.Equal(t, "email_verify:verify@example.com", key)
	})
}

func TestRateLimitError(t *testing.T) {
	t.Run("error message format", func(t *testing.T) {
		key := "test:key"
		limit := 5
		window := time.Minute
		resetTime := time.Now().Add(window)

		err := NewRateLimitError(key, limit, window, resetTime)

		assert.Contains(t, err.Error(), key)
		assert.Contains(t, err.Error(), "5 requests")
		assert.Contains(t, err.Error(), "1m0s")
	})

	t.Run("IsRateLimitError", func(t *testing.T) {
		rateLimitErr := NewRateLimitError("key", 5, time.Minute, time.Now())
		assert.True(t, IsRateLimitError(rateLimitErr))

		otherErr := assert.AnError
		assert.False(t, IsRateLimitError(otherErr))
	})
}

func TestInMemoryRateLimiter_Concurrent(t *testing.T) {
	limiter := NewInMemoryRateLimiter()
	ctx := context.Background()
	key := "test:concurrent"
	limit := 10
	window := time.Minute

	// Test concurrent access
	done := make(chan bool, 20)
	allowed := make(chan bool, 20)

	for i := 0; i < 20; i++ {
		go func() {
			defer func() { done <- true }()
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			allowed <- (err == nil)
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < 20; i++ {
		<-done
	}

	// Count allowed requests
	allowedCount := 0
	for i := 0; i < 20; i++ {
		if <-allowed {
			allowedCount++
		}
	}

	// Should allow exactly the limit
	assert.Equal(t, limit, allowedCount)
}

func TestInMemoryRateLimiter_AccountLockoutScenario(t *testing.T) {
	limiter := NewInMemoryRateLimiter()
	ctx := context.Background()

	// Simulate account lockout scenario (5 attempts in 15 minutes)
	email := "user@example.com"
	key := LoginRateLimitKey(email)
	limit := 5
	window := 15 * time.Minute

	t.Run("allows 5 login attempts", func(t *testing.T) {
		for i := 0; i < limit; i++ {
			err := limiter.CheckRateLimit(ctx, key, limit, window)
			assert.NoError(t, err, "Attempt %d should be allowed", i+1)
		}
	})

	t.Run("blocks 6th attempt", func(t *testing.T) {
		err := limiter.CheckRateLimit(ctx, key, limit, window)
		assert.Error(t, err)
		assert.True(t, IsRateLimitError(err))
	})

	t.Run("can reset after successful login", func(t *testing.T) {
		// Simulate successful login by resetting rate limit
		err := limiter.Reset(ctx, key)
		assert.NoError(t, err)

		// Should allow new attempts
		err = limiter.CheckRateLimit(ctx, key, limit, window)
		assert.NoError(t, err)
	})
}
