package graphql

import (
	"context"
	"fmt"

	"sigma_finance/internal/handler/middleware"

	"github.com/99designs/gqlgen/graphql"
)

// AuthDirective implements the @auth directive logic
func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	user := ctx.Value(middleware.UserKey)
	if user == nil {
		return nil, fmt.Errorf("unauthorized: authentication required")
	}

	return next(ctx)
}

// RequireEmailVerifiedDirective implements the @requireEmailVerified directive logic
func RequireEmailVerifiedDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	user, ok := ctx.Value(middleware.UserKey).(*middleware.AuthenticatedUser)
	if !ok || user == nil {
		return nil, fmt.Errorf("unauthorized: authentication required")
	}

	if !user.EmailVerified {
		return nil, fmt.Errorf("unauthorized: email verification required")
	}

	return next(ctx)
}
