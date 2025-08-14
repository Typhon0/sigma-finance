package middleware

// import (
// 	"fmt"
// 	"os"
// 	"strings"
// 	"time"

// 	"sigma_finance/internal/service"

// 	"github.com/gofiber/fiber/v2"
// )

// func AuthMiddleware(userService *service.UserService) fiber.Handler {
// 	return func(c *fiber.Ctx) error {
// 		// Skip auth for health check and GraphQL playground in development
// 		path := c.Path()
// 		if path == "/health" || (path == "/playground" && os.Getenv("ENVIRONMENT") != "production") {
// 			return c.Next()
// 		}

// 		// Get token from header
// 		authHeader := c.Get("Authorization")
// 		if authHeader == "" {
// 			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
// 				"error": "Authorization header required",
// 			})
// 		}

// 		// Extract token (assuming "Bearer <token>")
// 		tokenParts := strings.Split(authHeader, " ")
// 		if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
// 			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
// 				"error": "Invalid authorization header format",
// 			})
// 		}

// 		token := tokenParts[1]

// 		// Validate token and get user
// 		user, err := userService.AuthenticateByToken(c.Context(), token)
// 		if err != nil {
// 			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
// 				"error": "Invalid token",
// 			})
// 		}

// 		// Add user to context
// 		c.Locals("user", user)
// 		return c.Next()
// 	}
// }

// func RequestID() fiber.Handler {
// 	return func(c *fiber.Ctx) error {
// 		requestID := c.Get("X-Request-ID")
// 		if requestID == "" {
// 			requestID = fmt.Sprintf("%d", time.Now().UnixNano())
// 			c.Set("X-Request-ID", requestID)
// 		}
// 		c.Locals("requestID", requestID)
// 		return c.Next()
// 	}
// }
