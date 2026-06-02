package graphql

import (
	"context"
	"errors"
	"log"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/gofiber/fiber/v2"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// ErrorHandler is a custom error handler for the GraphQL server.
func ErrorHandler(c *fiber.Ctx, err error) error {
	// Default error response
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"errors": []fiber.Map{
			{"message": err.Error()},
		},
	})
}

// NewErrorPresenter creates a new GraphQL error presenter.
func NewErrorPresenter() graphql.ErrorPresenterFunc {
	return func(ctx context.Context, err error) *gqlerror.Error {
		// Check for a specific custom error type if needed
		var gqlErr *gqlerror.Error
		if errors.As(err, &gqlErr) {
			// Check if message indicates authentication required
			msg := strings.ToLower(gqlErr.Message)
			if strings.Contains(msg, "authentication required") || strings.Contains(msg, "unauthorized") {
				if gqlErr.Extensions == nil {
					gqlErr.Extensions = make(map[string]interface{})
				}
				gqlErr.Extensions["code"] = "UNAUTHENTICATED"
			}
			return gqlErr
		}

		// Check if the unwrapped raw error message contains authentication required or unauthorized
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "authentication required") || strings.Contains(msg, "unauthorized") {
			return &gqlerror.Error{
				Message:    err.Error(),
				Path:       graphql.GetPath(ctx),
				Extensions: map[string]interface{}{"code": "UNAUTHENTICATED"},
			}
		}

		// For other errors, log it and create a new GraphQL error
		log.Printf("[GraphQL Error] Unexpected error: %v (path: %v)", err, graphql.GetPath(ctx))
		return &gqlerror.Error{
			Message: "internal system error",
			Path:    graphql.GetPath(ctx),
		}
	}
}
