package graphql

import (
	"context"
	"fmt"

	"sigma_finance/internal/handler/middleware"

	"github.com/99designs/gqlgen/graphql"
)

// AuthDirective implements the @auth directive
func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	// Check if user is authenticated
	user, ok := middleware.GetUserFromContext(ctx)
	if !ok || user == nil {
		return nil, fmt.Errorf("authentication required")
	}

	// User is authenticated, proceed with the resolver
	return next(ctx)
}

// RequireEmailVerifiedDirective implements the @requireEmailVerified directive
func RequireEmailVerifiedDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	// Check if user is authenticated
	user, ok := middleware.GetUserFromContext(ctx)
	if !ok || user == nil {
		return nil, fmt.Errorf("authentication required")
	}

	// Check if email is verified
	if !user.EmailVerified {
		return nil, fmt.Errorf("email verification required")
	}

	// User is authenticated and email is verified, proceed with the resolver
	return next(ctx)
}
