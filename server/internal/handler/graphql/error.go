package graphql

import (
	"context"
	"errors"

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
			// Return the original GraphQL error
			return gqlErr
		}

		// For other errors, create a new GraphQL error
		return &gqlerror.Error{
			Message: "An unexpected error occurred",
			Path:    graphql.GetPath(ctx),
		}
	}
}
