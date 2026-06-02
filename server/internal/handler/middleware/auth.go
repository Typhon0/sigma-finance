package middleware

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"sigma_finance/internal/service"

	"github.com/99designs/gqlgen/graphql"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// UserContextKey is the key used to store user information in context
type UserContextKey string

const (
	// UserKey is the context key for authenticated user information
	UserKey UserContextKey = "user"
	// SessionKey is the context key for session information
	SessionKey UserContextKey = "session"
)

// AuthenticatedUser represents the authenticated user in context
type AuthenticatedUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	Name          string `json:"name"`
	EmailVerified bool   `json:"emailVerified"`
}

// SessionInfo represents session information in context
type SessionInfo struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
	IPAddress string    `json:"ipAddress"`
	UserAgent string    `json:"userAgent"`
}

// AuthMiddleware provides HTTP authentication middleware for Fiber
func AuthMiddleware(sessionService service.SessionService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip auth for health check and GraphQL playground in development
		path := c.Path()
		if path == "/health" || (path == "/playground" && os.Getenv("ENVIRONMENT") != "production") {
			return c.Next()
		}

		// Get token from header or query param (query param needed for EventSource SSE)
		token := ""
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			tokenParts := strings.Split(authHeader, " ")
			if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "Invalid authorization header format",
				})
			}
			token = tokenParts[1]
		} else if qToken := c.Query("token"); qToken != "" {
			token = qToken
		} else {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Authorization header required",
			})
		}

		// Validate session
		session, err := sessionService.ValidateSession(c.Context(), token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		// Add session and user to context
		c.Locals("session", session)
		c.Locals("user", &AuthenticatedUser{
			ID: session.UserID,
		})

		return c.Next()
	}
}

// GraphQLAuthMiddleware provides authentication middleware for GraphQL requests
func GraphQLAuthMiddleware(sessionService service.SessionService, userService service.IUserService) graphql.HandlerExtension {
	return &authExtension{
		sessionService: sessionService,
		userService:    userService,
	}
}

type authExtension struct {
	sessionService service.SessionService
	userService    service.IUserService
}

func (a *authExtension) ExtensionName() string {
	return "AuthExtension"
}

func (a *authExtension) Validate(schema graphql.ExecutableSchema) error {
	return nil
}

func (a *authExtension) InterceptOperation(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
	return next(ctx)
}

func (a *authExtension) InterceptResponse(ctx context.Context, next graphql.ResponseHandler) *graphql.Response {
	return next(ctx)
}

func (a *authExtension) InterceptField(ctx context.Context, next graphql.Resolver) (interface{}, error) {
	// Skip authentication for introspection queries
	fieldCtx := graphql.GetFieldContext(ctx)
	if fieldCtx != nil && strings.HasPrefix(fieldCtx.Field.Name, "__") {
		return next(ctx)
	}

	// Only check authentication for root-level operations (Query/Mutation fields)
	// Skip authentication for nested fields in responses
	if fieldCtx != nil && fieldCtx.Parent != nil && fieldCtx.Parent.Parent != nil {
		// This is a nested field, skip auth check
		return next(ctx)
	}

	// Skip authentication for public operations (like login, register)
	if isPublicOperation(fieldCtx) {
		return next(ctx)
	}

	// Check if user was already authenticated at the HTTP level
	if user := getUserFromHTTPContext(ctx); user != nil {
		// Add user to GraphQL context
		userCtx := context.WithValue(ctx, UserKey, user)
		if session := getSessionFromHTTPContext(ctx); session != nil {
			userCtx = context.WithValue(userCtx, SessionKey, session)
		}

		return next(userCtx)
	}

	return nil, fmt.Errorf("authentication required")
}

// isPublicOperation checks if the GraphQL operation is public (doesn't require authentication)
func isPublicOperation(fieldCtx *graphql.FieldContext) bool {
	if fieldCtx == nil {
		return false
	}

	publicOperations := map[string]bool{
		// Authentication operations
		"login":                true,
		"register":             true,
		"resetPassword":        true,
		"confirmPasswordReset": true,
		"verifyEmail":          true,
		"resendVerification":   true,
		"refreshToken":         true,

		// Public queries (if any)
		"healthCheck": true,
	}

	return publicOperations[fieldCtx.Field.Name]
}

// extractTokenFromContext extracts the JWT token from the GraphQL context
func extractTokenFromContext(ctx context.Context) string {
	// Try to get from fasthttp context user values (set by Fiber handler)
	// The GraphQL execution context might have the fasthttp request context
	if v := ctx.Value("RequestContext"); v != nil {
		if reqCtx, ok := v.(*fasthttp.RequestCtx); ok {
			if authHeader := reqCtx.UserValue("Authorization"); authHeader != nil {
				if authStr, ok := authHeader.(string); ok {
					tokenParts := strings.Split(authStr, " ")
					if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
						return tokenParts[1]
					}
				}
			}
		}
	}

	// Try to get from HTTP headers via Fiber context
	if fiberCtx, ok := ctx.Value("fiber").(*fiber.Ctx); ok {
		authHeader := fiberCtx.Get("Authorization")
		if authHeader != "" {
			tokenParts := strings.Split(authHeader, " ")
			if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
				return tokenParts[1]
			}
		}
	}

	// Try to get from GraphQL context (for WebSocket connections)
	if headers, ok := ctx.Value("headers").(map[string]string); ok {
		if authHeader, exists := headers["Authorization"]; exists {
			tokenParts := strings.Split(authHeader, " ")
			if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
				return tokenParts[1]
			}
		}
	}

	return ""
}

// GetUserFromContext retrieves the authenticated user from context
func GetUserFromContext(ctx context.Context) (*AuthenticatedUser, bool) {
	user, ok := ctx.Value(UserKey).(*AuthenticatedUser)
	return user, ok
}

// GetSessionFromContext retrieves the session information from context
func GetSessionFromContext(ctx context.Context) (*SessionInfo, bool) {
	session, ok := ctx.Value(SessionKey).(*SessionInfo)
	return session, ok
}

// RequireAuth is a helper function that ensures a user is authenticated
func RequireAuth(ctx context.Context) (*AuthenticatedUser, error) {
	user, ok := GetUserFromContext(ctx)
	if !ok || user == nil {
		return nil, fmt.Errorf("authentication required")
	}
	return user, nil
}

// parseUserID converts string user ID to uint for service calls
func parseUserID(userID string) uint {
	id, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		return 0
	}
	return uint(id)
}

// getUserFromHTTPContext extracts authenticated user from HTTP context
func getUserFromHTTPContext(ctx context.Context) *AuthenticatedUser {
	// Try to get the user directly from context using our middleware key
	if user, ok := ctx.Value(UserKey).(*AuthenticatedUser); ok && user != nil {
		return user
	}
	return nil
}

// getSessionFromHTTPContext extracts session info from HTTP context
func getSessionFromHTTPContext(ctx context.Context) *SessionInfo {
	// Try to get the session directly from context using our middleware key
	if session, ok := ctx.Value(SessionKey).(*SessionInfo); ok && session != nil {
		return session
	}
	return nil
}

// RequestID middleware generates a unique request ID for each request
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = fmt.Sprintf("%d", time.Now().UnixNano())
			c.Set("X-Request-ID", requestID)
		}
		c.Locals("requestID", requestID)
		return c.Next()
	}
}
