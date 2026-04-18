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

		// Get token from header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Authorization header required",
			})
		}

		// Extract token (assuming "Bearer <token>")
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authorization header format",
			})
		}

		token := tokenParts[1]

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
	// Try to extract the authorization header at the operation level
	// This might have better access to the HTTP request
	fmt.Printf("DEBUG: InterceptOperation called\n")

	// Check if we can access the HTTP request through the operation context
	if opCtx := graphql.GetOperationContext(ctx); opCtx != nil {
		fmt.Printf("DEBUG: Found operation context in operation interceptor\n")
		// The operation context might have access to HTTP headers
	}

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

	fmt.Printf("DEBUG: InterceptField called for: %s\n", fieldCtx.Field.Name)

	// Only check authentication for root-level operations (Query/Mutation fields)
	// Skip authentication for nested fields in responses
	if fieldCtx != nil && fieldCtx.Parent != nil && fieldCtx.Parent.Parent != nil {
		// This is a nested field, skip auth check
		fmt.Printf("DEBUG: Skipping nested field: %s\n", fieldCtx.Field.Name)
		return next(ctx)
	}

	// Skip authentication for public operations (like login, register)
	if isPublicOperation(fieldCtx) {
		fmt.Printf("DEBUG: Skipping public operation: %s\n", fieldCtx.Field.Name)
		return next(ctx)
	}

	fmt.Printf("DEBUG: Checking auth for operation: %s\n", fieldCtx.Field.Name)

	// Check if user was already authenticated at the HTTP level
	if user := getUserFromHTTPContext(ctx); user != nil {
		fmt.Printf("DEBUG: Found authenticated user from HTTP context: %s\n", user.Email)

		// Add user to GraphQL context
		userCtx := context.WithValue(ctx, UserKey, user)
		if session := getSessionFromHTTPContext(ctx); session != nil {
			userCtx = context.WithValue(userCtx, SessionKey, session)
		}

		return next(userCtx)
	}

	fmt.Printf("DEBUG: No authenticated user found for operation: %s\n", fieldCtx.Field.Name)
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
	// The GraphQL context should contain the HTTP request context
	// Let's try to access it through the standard GraphQL way

	// Check if we can get the operation context from GraphQL
	// graphql.GetOperationContext panics if not in a GraphQL context, so we recover
	func() {
		defer func() { recover() }()
		if opCtx := graphql.GetOperationContext(ctx); opCtx != nil {
			// Try to get the Authorization header from the HTTP request
			if req := opCtx.RawQuery; req != "" {
				fmt.Printf("DEBUG: Found GraphQL operation context\n")
			}
		}
	}()

	// Try to get from fasthttp context user values (set by Fiber handler)
	// The GraphQL execution context might have the fasthttp request context
	if v := ctx.Value("RequestContext"); v != nil {
		if reqCtx, ok := v.(*fasthttp.RequestCtx); ok {
			if authHeader := reqCtx.UserValue("Authorization"); authHeader != nil {
				if authStr, ok := authHeader.(string); ok {
					fmt.Printf("DEBUG: Auth header from fasthttp user values: '%s'\n", authStr)
					tokenParts := strings.Split(authStr, " ")
					if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
						fmt.Printf("DEBUG: Extracted token: '%s...'\n", tokenParts[1][:min(10, len(tokenParts[1]))])
						return tokenParts[1]
					}
				}
			}
		}
	}

	// Try to get from HTTP headers via Fiber context
	if fiberCtx, ok := ctx.Value("fiber").(*fiber.Ctx); ok {
		authHeader := fiberCtx.Get("Authorization")
		fmt.Printf("DEBUG: Auth header from Fiber: '%s'\n", authHeader)
		if authHeader != "" {
			tokenParts := strings.Split(authHeader, " ")
			if len(tokenParts) == 2 && strings.ToLower(tokenParts[0]) == "bearer" {
				fmt.Printf("DEBUG: Extracted token: '%s...'\n", tokenParts[1][:min(10, len(tokenParts[1]))])
				return tokenParts[1]
			}
		}
	} else {
		fmt.Printf("DEBUG: Failed to get Fiber context from GraphQL context\n")
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

	fmt.Printf("DEBUG: No token found in context\n")
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
	fmt.Printf("DEBUG: getUserFromHTTPContext called\n")

	// Try to get the user directly from context using our middleware key
	if user, ok := ctx.Value(UserKey).(*AuthenticatedUser); ok && user != nil {
		fmt.Printf("DEBUG: Found authenticated user in context: %s\n", user.Email)
		return user
	}

	fmt.Printf("DEBUG: No authenticated user found in context\n")
	return nil
}

// getSessionFromHTTPContext extracts session info from HTTP context
func getSessionFromHTTPContext(ctx context.Context) *SessionInfo {
	// Try to get the session directly from context using our middleware key
	if session, ok := ctx.Value(SessionKey).(*SessionInfo); ok && session != nil {
		fmt.Printf("DEBUG: Found session in context: %s\n", session.ID)
		return session
	}

	fmt.Printf("DEBUG: No session found in context\n")
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
