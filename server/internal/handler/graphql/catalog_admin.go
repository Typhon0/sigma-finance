package graphql

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/handler/middleware"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func requireCatalogAdmin(ctx context.Context, resolver *Resolver) (*middleware.AuthenticatedUser, error) {
	user, err := middleware.RequireAuth(ctx)
	if err != nil {
		return nil, &gqlerror.Error{
			Message: "authentication required",
			Path:    graphql.GetPath(ctx),
			Extensions: map[string]any{
				"code": "UNAUTHORIZED",
			},
		}
	}

	if strings.EqualFold(strings.TrimSpace(user.Role), string(model.UserRoleAdmin)) {
		return user, nil
	}

	if resolver != nil && resolver.UserService != nil {
		fullUser, userErr := resolver.UserService.GetByID(ctx, user.ID)
		if userErr == nil && fullUser != nil && fullUser.IsAdmin() {
			user.Role = string(model.UserRoleAdmin)
			return user, nil
		}
	}

	return nil, &gqlerror.Error{
		Message: "admin role required",
		Path:    graphql.GetPath(ctx),
		Extensions: map[string]any{
			"code": "FORBIDDEN",
		},
	}
}
