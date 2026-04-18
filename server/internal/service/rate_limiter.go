package service

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// RateLimiter provides rate limiting functionality
type RateLimiter interface {
	// CheckRateLimit checks if a rate limit has been exceeded
	CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error
	// Reset clears the rate limit for a specific key
	Reset(ctx context.Context, key string) error
	// GetAttempts returns the current number of attempts for a key
	GetAttempts(ctx context.Context, key string) (int, error)
}

// InMemoryRateLimiter implements RateLimiter using in-memory storage
type InMemoryRateLimiter struct {
	mu      sync.RWMutex
	buckets map[string]*rateBucket
}

// rateBucket represents a rate limiting bucket for a specific key
type rateBucket struct {
	count     int
	resetTime time.Time
	window    time.Duration
}

// NewInMemoryRateLimiter creates a new in-memory rate limiter
func NewInMemoryRateLimiter() RateLimiter {
	limiter := &InMemoryRateLimiter{
		buckets: make(map[string]*rateBucket),
	}
	return limiter
}

// ResetAll clears all rate limit buckets - useful for testing
func (r *InMemoryRateLimiter) ResetAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.buckets = make(map[string]*rateBucket)
}

// CheckRateLimit checks if a rate limit has been exceeded
func (r *InMemoryRateLimiter) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	bucket, exists := r.buckets[key]

	// Create new bucket if it doesn't exist or has expired
	if !exists || now.After(bucket.resetTime) {
		r.buckets[key] = &rateBucket{
			count:     1,
			resetTime: now.Add(window),
			window:    window,
		}
		return nil
	}

	// Check if limit is exceeded
	if bucket.count >= limit {
		return NewRateLimitError(key, limit, window, bucket.resetTime)
	}

	// Increment count
	bucket.count++
	return nil
}

// Reset clears the rate limit for a specific key
func (r *InMemoryRateLimiter) Reset(ctx context.Context, key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.buckets, key)
	return nil
}

// GetAttempts returns the current number of attempts for a key
func (r *InMemoryRateLimiter) GetAttempts(ctx context.Context, key string) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	bucket, exists := r.buckets[key]
	if !exists {
		return 0, nil
	}

	// Check if bucket has expired
	if time.Now().After(bucket.resetTime) {
		return 0, nil
	}

	return bucket.count, nil
}

// cleanup removes expired buckets periodically
func (r *InMemoryRateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		r.mu.Lock()
		now := time.Now()
		for key, bucket := range r.buckets {
			if now.After(bucket.resetTime) {
				delete(r.buckets, key)
			}
		}
		r.mu.Unlock()
	}
}

// RateLimitError represents a rate limit exceeded error
type RateLimitError struct {
	Key       string
	Limit     int
	Window    time.Duration
	ResetTime time.Time
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("rate limit exceeded for key '%s': %d requests per %v, resets at %v",
		e.Key, e.Limit, e.Window, e.ResetTime.Format(time.RFC3339))
}

// NewRateLimitError creates a new rate limit error
func NewRateLimitError(key string, limit int, window time.Duration, resetTime time.Time) *RateLimitError {
	return &RateLimitError{
		Key:       key,
		Limit:     limit,
		Window:    window,
		ResetTime: resetTime,
	}
}

// IsRateLimitError checks if an error is a rate limit error
func IsRateLimitError(err error) bool {
	_, ok := err.(*RateLimitError)
	return ok
}

// Rate limiting key generators for different scenarios
func LoginRateLimitKey(email string) string {
	return fmt.Sprintf("login:%s", email)
}

func IPRateLimitKey(ip string) string {
	return fmt.Sprintf("ip:%s", ip)
}

func RegistrationRateLimitKey(ip string) string {
	return fmt.Sprintf("register:%s", ip)
}

func PasswordResetRateLimitKey(email string) string {
	return fmt.Sprintf("password_reset:%s", email)
}

func EmailVerificationRateLimitKey(email string) string {
	return fmt.Sprintf("email_verify:%s", email)
}
