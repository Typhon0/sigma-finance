package middleware

import (
	"strings"

	"sigma_finance/internal/service"

	"github.com/gofiber/fiber/v2"
)

// AdminMiddleware returns a Fiber middleware that requires the authenticated
// user to have the ADMIN role. Must be used after AuthMiddleware.
func AdminMiddleware(userService service.IUserService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*AuthenticatedUser)
		if !ok || user == nil || strings.TrimSpace(user.ID) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		// Look up full user to check role (AuthMiddleware only sets ID)
		fullUser, err := userService.GetByID(c.Context(), user.ID)
		if err != nil || fullUser == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		if !fullUser.IsAdmin() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "admin access required",
			})
		}

		return c.Next()
	}
}
