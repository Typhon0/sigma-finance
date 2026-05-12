package graphql

import (
	"context"
	"testing"

	"sigma_finance/internal/handler/middleware"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

func TestRequireCatalogAdmin_Unauthenticated(t *testing.T) {
	_, err := requireCatalogAdmin(context.Background(), nil)
	if err == nil {
		t.Fatal("expected authentication error")
	}

	gqlErr, ok := err.(*gqlerror.Error)
	if !ok {
		t.Fatalf("expected gqlerror.Error, got %T", err)
	}

	if gqlErr.Extensions["code"] != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED code, got %v", gqlErr.Extensions["code"])
	}
}

func TestRequireCatalogAdmin_AllowsAdminRoleFromContext(t *testing.T) {
	ctx := context.WithValue(context.Background(), middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    "user-1",
		Email: "admin@example.com",
		Role:  "ADMIN",
	})

	user, err := requireCatalogAdmin(ctx, nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if user == nil || user.Role != "ADMIN" {
		t.Fatalf("expected admin user, got %#v", user)
	}
}

func TestRequireCatalogAdmin_RejectsNonAdminRole(t *testing.T) {
	ctx := context.WithValue(context.Background(), middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    "user-2",
		Email: "user@example.com",
		Role:  "USER",
	})

	_, err := requireCatalogAdmin(ctx, nil)
	if err == nil {
		t.Fatal("expected forbidden error")
	}

	gqlErr, ok := err.(*gqlerror.Error)
	if !ok {
		t.Fatalf("expected gqlerror.Error, got %T", err)
	}

	if gqlErr.Extensions["code"] != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN code, got %v", gqlErr.Extensions["code"])
	}
}
