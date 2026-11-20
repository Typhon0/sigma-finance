package graphql

import (
	"context"

	"sigma_finance/internal/handler/middleware"
)

// requireCaller returns the authenticated user for the current GraphQL request.
func requireCaller(ctx context.Context) (*middleware.AuthenticatedUser, error) {
	return middleware.RequireAuth(ctx)
}

// callerIsAdmin reports whether the authenticated caller holds the ADMIN role.
// Lookups fail closed: any error (including a missing user) is treated as
// "not an admin".
func (r *Resolver) callerIsAdmin(ctx context.Context, callerID string) bool {
	if r == nil || r.UserService == nil || callerID == "" {
		return false
	}
	user, err := r.UserService.GetByID(ctx, callerID)
	if err != nil || user == nil {
		return false
	}
	return user.IsAdmin()
}
