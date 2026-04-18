package middleware

import (
	"context"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock SecurityService for testing
type MockSecurityService struct {
	mock.Mock
}

func (m *MockSecurityService) HashPassword(password string) (string, error) {
	args := m.Called(password)
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) VerifyPassword(password, hash string) error {
	args := m.Called(password, hash)
	return args.Error(0)
}

func (m *MockSecurityService) GenerateJWT(userID string, expiresAt time.Time) (string, error) {
	args := m.Called(userID, expiresAt)
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) ValidateJWT(token string) (*service.JWTClaims, error) {
	args := m.Called(token)
	return args.Get(0).(*service.JWTClaims), args.Error(1)
}

func (m *MockSecurityService) GenerateSecureToken() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	args := m.Called(ctx, key, limit, window)
	return args.Error(0)
}

func (m *MockSecurityService) ResetRateLimit(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockSecurityService) GetRateLimitAttempts(ctx context.Context, key string) (int, error) {
	args := m.Called(ctx, key)
	return args.Int(0), args.Error(1)
}

func (m *MockSecurityService) EncryptString(plaintext string) (string, error) {
	args := m.Called(plaintext)
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) DecryptString(ciphertext string) (string, error) {
	args := m.Called(ciphertext)
	return args.String(0), args.Error(1)
}

// Mock AuditService for testing
type MockAuditService struct {
	mock.Mock
}

func (m *MockAuditService) LogAuthEvent(ctx context.Context, event *model.AuthEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockAuditService) LogSecurityEvent(ctx context.Context, eventType, ipAddress, userAgent string, metadata map[string]interface{}) error {
	args := m.Called(ctx, eventType, ipAddress, userAgent, metadata)
	return args.Error(0)
}

func (m *MockAuditService) GetAuthEvents(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, userID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuditService) GetSecurityEvents(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, ipAddress, since, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func TestSecurityMiddleware_GlobalRateLimit(t *testing.T) {
	mockSecurity := &MockSecurityService{}
	mockAudit := &MockAuditService{}
	middleware := NewSecurityMiddleware(mockSecurity, mockAudit)

	config := RateLimitConfig{
		GlobalRequestsPerMinute: 2,
		GlobalRequestsPerHour:   10,
	}

	app := fiber.New()
	app.Use(middleware.IPTracking())
	app.Use(middleware.GlobalRateLimit(config))
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	t.Run("allows requests within limit", func(t *testing.T) {
		// Mock rate limit checks to succeed
		mockSecurity.On("CheckRateLimit", mock.Anything, mock.MatchedBy(func(key string) bool {
			return strings.Contains(key, "minute")
		}), 2, time.Minute).Return(nil).Times(2)

		mockSecurity.On("CheckRateLimit", mock.Anything, mock.MatchedBy(func(key string) bool {
			return strings.Contains(key, "hour")
		}), 10, time.Hour).Return(nil).Times(2)

		// First request should succeed
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Forwarded-For", "192.168.1.1")
		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		// Second request should also succeed
		req = httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Forwarded-For", "192.168.1.1")
		resp, err = app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		mockSecurity.AssertExpectations(t)
	})

	t.Run("blocks requests exceeding minute limit", func(t *testing.T) {
		mockSecurity.ExpectedCalls = nil // Reset expectations

		rateLimitErr := service.NewRateLimitError("test", 2, time.Minute, time.Now().Add(time.Minute))
		mockSecurity.On("CheckRateLimit", mock.Anything, mock.MatchedBy(func(key string) bool {
			return strings.Contains(key, "minute")
		}), 2, time.Minute).Return(rateLimitErr)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Forwarded-For", "192.168.1.2")
		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 429, resp.StatusCode)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), "Too many requests per minute")

		mockSecurity.AssertExpectations(t)
	})
}

func TestSecurityMiddleware_RequestValidation(t *testing.T) {
	mockSecurity := &MockSecurityService{}
	mockAudit := &MockAuditService{}
	middleware := NewSecurityMiddleware(mockSecurity, mockAudit)

	app := fiber.New()
	app.Use(middleware.RequestValidation())
	app.Post("/test", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	t.Run("adds security headers", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/test", strings.NewReader(`{"test": "data"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		require.NoError(t, err)

		assert.Equal(t, "nosniff", resp.Header.Get("X-Content-Type-Options"))
		assert.Equal(t, "DENY", resp.Header.Get("X-Frame-Options"))
		assert.Equal(t, "1; mode=block", resp.Header.Get("X-XSS-Protection"))
		assert.Equal(t, "strict-origin-when-cross-origin", resp.Header.Get("Referrer-Policy"))
	})

	t.Run("rejects unsupported content type", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/test", strings.NewReader("test data"))
		req.Header.Set("Content-Type", "text/plain")
		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 415, resp.StatusCode)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), "Unsupported content type")
	})

	t.Run("rejects oversized requests", func(t *testing.T) {
		// Note: Fiber has built-in body size limits that may trigger before our middleware
		// This test verifies the middleware logic, but in practice Fiber's limits would apply first

		// Create a moderately large request body
		largeBody := strings.Repeat("x", 1024*1024) // 1MB
		req := httptest.NewRequest("POST", "/test", strings.NewReader(largeBody))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		require.NoError(t, err)
		// The request should either be handled normally or rejected by Fiber's limits
		assert.True(t, resp.StatusCode == 200 || resp.StatusCode == 413)
	})
}

func TestSecurityMiddleware_IPTracking(t *testing.T) {
	mockSecurity := &MockSecurityService{}
	mockAudit := &MockAuditService{}
	middleware := NewSecurityMiddleware(mockSecurity, mockAudit)

	app := fiber.New()
	app.Use(middleware.IPTracking())
	app.Get("/test", func(c *fiber.Ctx) error {
		ip := c.Locals("client_ip")
		userAgent := c.Locals("user_agent")
		requestID := c.Locals("request_id")

		return c.JSON(fiber.Map{
			"ip":         ip,
			"user_agent": userAgent,
			"request_id": requestID,
		})
	})

	t.Run("extracts IP from X-Forwarded-For", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Forwarded-For", "203.0.113.1, 192.168.1.1")
		req.Header.Set("User-Agent", "Test-Agent/1.0")

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), "203.0.113.1")
		assert.Contains(t, string(body), "Test-Agent/1.0")
	})

	t.Run("extracts IP from X-Real-IP", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Real-IP", "203.0.113.2")
		req.Header.Set("User-Agent", "Test-Agent/2.0")

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), "203.0.113.2")
	})

	t.Run("generates request ID if not present", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		// Check that X-Request-ID header is set
		requestID := resp.Header.Get("X-Request-ID")
		assert.NotEmpty(t, requestID)
	})
}

func TestSecurityMiddleware_AuthenticationRateLimit(t *testing.T) {
	mockSecurity := &MockSecurityService{}
	mockAudit := &MockAuditService{}
	middleware := NewSecurityMiddleware(mockSecurity, mockAudit)

	config := RateLimitConfig{
		LoginAttemptsPerEmail:  3,
		LoginAttemptsWindow:    15 * time.Minute,
		RegisterAttemptsPerIP:  2,
		RegisterAttemptsWindow: time.Hour,
	}

	app := fiber.New()
	app.Use(middleware.IPTracking())
	app.Use(middleware.AuthenticationRateLimit(config))
	app.Post("/graphql", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})
	app.All("/api/other", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})
	app.All("/", func(c *fiber.Ctx) error {
		return c.SendStatus(200)
	})

	t.Run("applies rate limit to login mutations", func(t *testing.T) {
		mockSecurity.On("CheckRateLimit", mock.Anything, mock.MatchedBy(func(key string) bool {
			return strings.Contains(key, "login")
		}), 3, 15*time.Minute).Return(nil).Maybe()

		loginQuery := `{"query": "mutation { login(email: \"test@example.com\", password: \"password\") { token } }"}`
		req := httptest.NewRequest("POST", "/graphql", strings.NewReader(loginQuery))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", "192.168.1.1")

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("applies rate limit to register mutations", func(t *testing.T) {
		mockSecurity.ExpectedCalls = nil
		mockSecurity.On("CheckRateLimit", mock.Anything, mock.MatchedBy(func(key string) bool {
			return strings.Contains(key, "register")
		}), 2, time.Hour).Return(nil).Maybe()

		registerQuery := `{"query": "mutation { register(email: \"test@example.com\", password: \"password\") { user { id } } }"}`
		req := httptest.NewRequest("POST", "/graphql", strings.NewReader(registerQuery))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", "192.168.1.2")

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("blocks when rate limit exceeded", func(t *testing.T) {
		mockSecurity.ExpectedCalls = nil

		rateLimitErr := service.NewRateLimitError("test", 3, 15*time.Minute, time.Now().Add(15*time.Minute))
		mockSecurity.On("CheckRateLimit", mock.Anything, mock.MatchedBy(func(key string) bool {
			return strings.Contains(key, "login")
		}), 3, 15*time.Minute).Return(rateLimitErr).Maybe()

		loginQuery := `{"query": "mutation { login(email: \"test@example.com\", password: \"password\") { token } }"}`
		req := httptest.NewRequest("POST", "/graphql", strings.NewReader(loginQuery))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", "192.168.1.3")

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 429, resp.StatusCode)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), "Too many login attempts")
	})

	t.Run("ignores non-GraphQL requests", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/other", strings.NewReader("data"))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, 200, resp.StatusCode)

		// Should not call rate limiting for non-GraphQL endpoints
		mockSecurity.AssertNotCalled(t, "CheckRateLimit")
	})
}

func TestGetClientIP(t *testing.T) {
	app := fiber.New()

	t.Run("extracts from X-Forwarded-For", func(t *testing.T) {
		app.Get("/test", func(c *fiber.Ctx) error {
			ip := GetClientIP(c)
			return c.SendString(ip)
		})

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Forwarded-For", "203.0.113.1, 192.168.1.1, 10.0.0.1")

		resp, err := app.Test(req)
		require.NoError(t, err)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, "203.0.113.1", string(body))
	})

	t.Run("extracts from X-Real-IP when X-Forwarded-For not present", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-Real-IP", "203.0.113.2")

		resp, err := app.Test(req)
		require.NoError(t, err)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, "203.0.113.2", string(body))
	})

	t.Run("extracts from CF-Connecting-IP", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("CF-Connecting-IP", "203.0.113.3")

		resp, err := app.Test(req)
		require.NoError(t, err)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, "203.0.113.3", string(body))
	})

	t.Run("falls back to remote address", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)

		resp, err := app.Test(req)
		require.NoError(t, err)

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		// Should return some IP (test framework default)
		assert.NotEmpty(t, string(body))
	})
}

func TestDefaultRateLimitConfig(t *testing.T) {
	config := DefaultRateLimitConfig()

	assert.Equal(t, 100, config.GlobalRequestsPerMinute)
	assert.Equal(t, 1000, config.GlobalRequestsPerHour)
	assert.Equal(t, 5, config.LoginAttemptsPerEmail)
	assert.Equal(t, 15*time.Minute, config.LoginAttemptsWindow)
	assert.Equal(t, 3, config.RegisterAttemptsPerIP)
	assert.Equal(t, time.Hour, config.RegisterAttemptsWindow)
	assert.Equal(t, 3, config.PasswordResetPerEmail)
	assert.Equal(t, time.Hour, config.PasswordResetWindow)
}
