package graphql

import (
	"context"

	"sigma_finance/internal/handler/middleware"
)

// requireCaller returns the authenticated user for the current GraphQL request.
func requireCaller(ctx context.Context) (*middleware.AuthenticatedUser, error) {
	return middleware.RequireAuth(ctx)
}

// requirePortfolioAccess confirms the caller is authenticated and that the
// portfolio belongs to them. Every portfolio-scoped resolver must call this
// before reading or writing anything keyed by a portfolio ID: the @auth
// directive only proves somebody is logged in.
func (r *Resolver) requirePortfolioAccess(ctx context.Context, portfolioID string) error {
	caller, err := requireCaller(ctx)
	if err != nil {
		return err
	}
	return r.PortfolioService.ValidatePortfolioOwnership(ctx, portfolioID, caller.ID)
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
