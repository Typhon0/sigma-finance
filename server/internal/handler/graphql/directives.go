package graphql

import (
	"context"

	"sigma_finance/internal/handler/middleware"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// AuthDirective implements the @auth directive logic
func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	user := ctx.Value(middleware.UserKey)
	if user == nil {
		return nil, &gqlerror.Error{
			Message: "unauthorized: authentication required",
			Extensions: map[string]interface{}{
				"code": "UNAUTHENTICATED",
			},
		}
	}

	return next(ctx)
}

// RequireEmailVerifiedDirective implements the @requireEmailVerified directive logic
func RequireEmailVerifiedDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	user, ok := ctx.Value(middleware.UserKey).(*middleware.AuthenticatedUser)
	if !ok || user == nil {
		return nil, &gqlerror.Error{
			Message: "unauthorized: authentication required",
			Extensions: map[string]interface{}{
				"code": "UNAUTHENTICATED",
			},
		}
	}

	if !user.EmailVerified {
		return nil, &gqlerror.Error{
			Message: "unauthorized: email verification required",
			Extensions: map[string]interface{}{
				"code": "FORBIDDEN",
			},
		}
	}

	return next(ctx)
}
