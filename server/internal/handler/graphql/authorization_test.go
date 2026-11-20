package graphql

import (
	"context"
	"errors"
	"testing"

	"sigma_finance/internal/service"

	"github.com/stretchr/testify/require"
)

type stubOwnershipPortfolioService struct {
	service.IPortfolioService
	ownerID string
}

func (s *stubOwnershipPortfolioService) ValidatePortfolioOwnership(ctx context.Context, portfolioID, userID string) error {
	if userID != s.ownerID {
		return errors.New("forbidden")
	}
	return nil
}

// The @auth directive only proves somebody is logged in. Portfolio-scoped
// resolvers must still reject anonymous callers and callers who do not own the
// portfolio, or every performance endpoint becomes cross-tenant readable.
func TestRequirePortfolioAccess_RejectsAnonymousAndForeignCallers(t *testing.T) {
	resolver := &Resolver{
		PortfolioService: &stubOwnershipPortfolioService{ownerID: "owner-1"},
	}

	require.Error(t, resolver.requirePortfolioAccess(context.Background(), "portfolio-1"), "anonymous caller must be rejected")

	foreignCtx := withAuthUser(context.Background(), "intruder-1", "intruder@example.com")
	require.Error(t, resolver.requirePortfolioAccess(foreignCtx, "portfolio-1"), "a non-owner must be rejected")

	ownerCtx := withAuthUser(context.Background(), "owner-1", "owner@example.com")
	require.NoError(t, resolver.requirePortfolioAccess(ownerCtx, "portfolio-1"))
}
