package middleware

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"

	"sigma_finance/internal/service"

	"github.com/gofiber/fiber/v2"
)

// SecurityMiddleware provides security-related middleware functions
type SecurityMiddleware struct {
	securityService service.SecurityService
	auditService    service.AuditService
}

// NewSecurityMiddleware creates a new security middleware instance
func NewSecurityMiddleware(securityService service.SecurityService, auditService service.AuditService) *SecurityMiddleware {
	return &SecurityMiddleware{
		securityService: securityService,
		auditService:    auditService,
	}
}

// RateLimitConfig holds configuration for rate limiting
type RateLimitConfig struct {
	// Global rate limits per IP
	GlobalRequestsPerMinute int
	GlobalRequestsPerHour   int

	// Authentication-specific rate limits
	LoginAttemptsPerEmail  int
	LoginAttemptsWindow    time.Duration
	RegisterAttemptsPerIP  int
	RegisterAttemptsWindow time.Duration
	PasswordResetPerEmail  int
	PasswordResetWindow    time.Duration
}

// DefaultRateLimitConfig returns default rate limiting configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		GlobalRequestsPerMinute: 100,
		GlobalRequestsPerHour:   1000,
		LoginAttemptsPerEmail:   5,
		LoginAttemptsWindow:     15 * time.Minute,
		RegisterAttemptsPerIP:   3,
		RegisterAttemptsWindow:  time.Hour,
		PasswordResetPerEmail:   3,
		PasswordResetWindow:     time.Hour,
	}
}

// GlobalRateLimit applies global rate limiting per IP address
func (sm *SecurityMiddleware) GlobalRateLimit(config RateLimitConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := GetClientIP(c)
		ctx := c.Context()

		// Check per-minute rate limit
		minuteKey := service.IPRateLimitKey(ip + ":minute")
		if err := sm.securityService.CheckRateLimit(ctx, minuteKey, config.GlobalRequestsPerMinute, time.Minute); err != nil {
			if service.IsRateLimitError(err) {
				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"error": "Too many requests per minute",
					"code":  "RATE_LIMIT_EXCEEDED",
				})
			}
			return err
		}

		// Check per-hour rate limit
		hourKey := service.IPRateLimitKey(ip + ":hour")
		if err := sm.securityService.CheckRateLimit(ctx, hourKey, config.GlobalRequestsPerHour, time.Hour); err != nil {
			if service.IsRateLimitError(err) {
				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"error": "Too many requests per hour",
					"code":  "RATE_LIMIT_EXCEEDED",
				})
			}
			return err
		}

		return c.Next()
	}
}

// RequestValidation validates incoming requests and adds security headers
func (sm *SecurityMiddleware) RequestValidation() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Add security headers
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Validate Content-Type for POST/PUT requests
		if c.Method() == "POST" || c.Method() == "PUT" {
			contentType := c.Get("Content-Type")
			if contentType != "" && !strings.Contains(contentType, "application/json") && !strings.Contains(contentType, "multipart/form-data") {
				return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{
					"error": "Unsupported content type",
					"code":  "INVALID_CONTENT_TYPE",
				})
			}
		}

		// Validate request size (max 10MB)
		if c.Request().Header.ContentLength() > 10*1024*1024 {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error": "Request entity too large",
				"code":  "REQUEST_TOO_LARGE",
			})
		}

		return c.Next()
	}
}

// IPTracking adds IP address and user agent to the request context
func (sm *SecurityMiddleware) IPTracking() fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := GetClientIP(c)
		userAgent := c.Get("User-Agent")

		// Add to context for use in other middleware and handlers
		c.Locals("client_ip", ip)
		c.Locals("user_agent", userAgent)

		// Add request ID if not present
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = fmt.Sprintf("%d", time.Now().UnixNano())
			c.Set("X-Request-ID", requestID)
		}
		c.Locals("request_id", requestID)

		return c.Next()
	}
}

// AuthenticationRateLimit applies rate limiting specific to authentication endpoints
func (sm *SecurityMiddleware) AuthenticationRateLimit(config RateLimitConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := c.Path()
		method := c.Method()
		ip := GetClientIP(c)
		ctx := c.Context()

		// Only apply to GraphQL POST requests (where auth mutations happen)
		if method != "POST" || !strings.Contains(path, "/graphql") {
			return c.Next()
		}

		// Parse the GraphQL query to determine if it's an auth operation
		// This is a simplified check - in production, you might want more sophisticated parsing
		body := string(c.Body())

		// Check for login operations
		if strings.Contains(body, "login") {
			// Rate limit by IP for login attempts
			loginKey := service.IPRateLimitKey(ip + ":login")
			if err := sm.securityService.CheckRateLimit(ctx, loginKey, config.LoginAttemptsPerEmail, config.LoginAttemptsWindow); err != nil {
				if service.IsRateLimitError(err) {
					return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
						"error": "Too many login attempts",
						"code":  "LOGIN_RATE_LIMIT_EXCEEDED",
					})
				}
				return err
			}
		}

		// Check for registration operations
		if strings.Contains(body, "register") {
			registerKey := service.RegistrationRateLimitKey(ip)
			if err := sm.securityService.CheckRateLimit(ctx, registerKey, config.RegisterAttemptsPerIP, config.RegisterAttemptsWindow); err != nil {
				if service.IsRateLimitError(err) {
					return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
						"error": "Too many registration attempts",
						"code":  "REGISTRATION_RATE_LIMIT_EXCEEDED",
					})
				}
				return err
			}
		}

		// Check for password reset operations
		if strings.Contains(body, "resetPassword") || strings.Contains(body, "requestPasswordReset") {
			resetKey := service.IPRateLimitKey(ip + ":password_reset")
			if err := sm.securityService.CheckRateLimit(ctx, resetKey, config.PasswordResetPerEmail, config.PasswordResetWindow); err != nil {
				if service.IsRateLimitError(err) {
					return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
						"error": "Too many password reset attempts",
						"code":  "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
					})
				}
				return err
			}
		}

		return c.Next()
	}
}

// GetClientIP extracts the real client IP address from the request
func GetClientIP(c *fiber.Ctx) string {
	// Check X-Forwarded-For header (most common)
	xForwardedFor := c.Get("X-Forwarded-For")
	if xForwardedFor != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(xForwardedFor, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if net.ParseIP(ip) != nil {
				return ip
			}
		}
	}

	// Check X-Real-IP header
	xRealIP := c.Get("X-Real-IP")
	if xRealIP != "" {
		if net.ParseIP(xRealIP) != nil {
			return xRealIP
		}
	}

	// Check CF-Connecting-IP (Cloudflare)
	cfConnectingIP := c.Get("CF-Connecting-IP")
	if cfConnectingIP != "" {
		if net.ParseIP(cfConnectingIP) != nil {
			return cfConnectingIP
		}
	}

	// Fall back to remote address
	return c.IP()
}

// SecurityEventLogger logs security-related events
func (sm *SecurityMiddleware) SecurityEventLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// Log security events for failed requests
		if c.Response().StatusCode() >= 400 {
			ip := GetClientIP(c)
			userAgent := c.Get("User-Agent")

			// Create security event context
			eventCtx := context.WithValue(c.Context(), "security_event", map[string]interface{}{
				"ip_address":    ip,
				"user_agent":    userAgent,
				"method":        c.Method(),
				"path":          c.Path(),
				"status_code":   c.Response().StatusCode(),
				"response_time": time.Since(start).Milliseconds(),
				"request_id":    c.Locals("request_id"),
			})

			// Log suspicious activity
			if c.Response().StatusCode() == 429 {
				// Rate limit exceeded
				go sm.logSecurityEvent(eventCtx, "RATE_LIMIT_EXCEEDED", ip, userAgent)
			} else if c.Response().StatusCode() == 401 {
				// Unauthorized access attempt
				go sm.logSecurityEvent(eventCtx, "UNAUTHORIZED_ACCESS", ip, userAgent)
			} else if c.Response().StatusCode() == 403 {
				// Forbidden access attempt
				go sm.logSecurityEvent(eventCtx, "FORBIDDEN_ACCESS", ip, userAgent)
			}
		}

		return err
	}
}

// logSecurityEvent logs a security event asynchronously
func (sm *SecurityMiddleware) logSecurityEvent(ctx context.Context, eventType, ipAddress, userAgent string) {
	if sm.auditService == nil {
		return
	}

	// Extract additional context
	eventData := ctx.Value("security_event")
	metadata := make(map[string]interface{})
	if eventData != nil {
		if data, ok := eventData.(map[string]interface{}); ok {
			metadata = data
		}
	}

	// Create security event
	event := map[string]interface{}{
		"event_type": eventType,
		"ip_address": ipAddress,
		"user_agent": userAgent,
		"timestamp":  time.Now(),
		"metadata":   metadata,
	}

	// Log the event (implementation depends on AuditService interface)
	// This would typically call sm.auditService.LogSecurityEvent(ctx, event)
	// For now, we'll just log it as a placeholder
	_ = event
}
