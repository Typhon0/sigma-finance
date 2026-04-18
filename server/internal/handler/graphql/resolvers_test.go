package graphql

import (
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"testing"
)

// TestHelperFunctions tests the helper functions used by resolvers
func TestHelperFunctions(t *testing.T) {
	t.Run("parseID", func(t *testing.T) {
		// Test valid ID
		id, err := parseID("123")
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
		if id != "123" {
			t.Errorf("Expected 123, got %s", id)
		}



		// Test empty ID
		_, err = parseID("")
		if err == nil {
			t.Error("Expected error for empty ID")
		}
	})

	t.Run("buildUserOrderString", func(t *testing.T) {
		// Test username ASC
		order := buildUserOrderString(gqlModel.UserOrderFieldUsername, gqlModel.SortDirectionAsc)
		expected := "username ASC"
		if order != expected {
			t.Errorf("Expected %s, got %s", expected, order)
		}

		// Test email DESC
		order = buildUserOrderString(gqlModel.UserOrderFieldEmail, gqlModel.SortDirectionDesc)
		expected = "email DESC"
		if order != expected {
			t.Errorf("Expected %s, got %s", expected, order)
		}

		// Test created_at ASC (default)
		order = buildUserOrderString(gqlModel.UserOrderFieldCreatedAt, gqlModel.SortDirectionAsc)
		expected = "created_at ASC"
		if order != expected {
			t.Errorf("Expected %s, got %s", expected, order)
		}
	})

	t.Run("buildPortfolioOrderString", func(t *testing.T) {
		// Test name ASC
		order := buildPortfolioOrderString(gqlModel.PortfolioOrderFieldName, gqlModel.SortDirectionAsc)
		expected := "name ASC"
		if order != expected {
			t.Errorf("Expected %s, got %s", expected, order)
		}

		// Test created_at DESC
		order = buildPortfolioOrderString(gqlModel.PortfolioOrderFieldCreatedAt, gqlModel.SortDirectionDesc)
		expected = "created_at DESC"
		if order != expected {
			t.Errorf("Expected %s, got %s", expected, order)
		}

		// Test updated_at ASC
		order = buildPortfolioOrderString(gqlModel.PortfolioOrderFieldUpdatedAt, gqlModel.SortDirectionAsc)
		expected = "updated_at ASC"
		if order != expected {
			t.Errorf("Expected %s, got %s", expected, order)
		}
	})
}
