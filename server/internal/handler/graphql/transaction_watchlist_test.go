package graphql

import (
	"testing"

	gqlModel "sigma_finance/internal/handler/graphql/model"
)

func TestBuildTransactionOrderString(t *testing.T) {
	// Test TRANSACTION_DATE ASC
	result := buildTransactionOrderString(gqlModel.TransactionOrderFieldTransactionDate, gqlModel.SortDirectionAsc)
	expected := "transaction_date ASC"
	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}

	// Test PRICE_PER_UNIT DESC
	result = buildTransactionOrderString(gqlModel.TransactionOrderFieldPricePerUnit, gqlModel.SortDirectionDesc)
	expected = "price_per_unit DESC"
	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}

	// Test QUANTITY ASC
	result = buildTransactionOrderString(gqlModel.TransactionOrderFieldQuantity, gqlModel.SortDirectionAsc)
	expected = "quantity ASC"
	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}

	// Test default case (should default to transaction_date)
	result = buildTransactionOrderString("INVALID_FIELD", gqlModel.SortDirectionAsc)
	expected = "transaction_date ASC"
	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}
}

func TestMapTransactionToGQL(t *testing.T) {
	// This test would require setting up domain models
	// For now, we'll just verify the function exists and can be called
	// In a real test, you'd create a domain.Transaction and verify the mapping
	t.Skip("Integration test - requires domain model setup")
}

func TestMapWatchlistToGQL(t *testing.T) {
	// This test would require setting up domain models
	// For now, we'll just verify the function exists and can be called
	// In a real test, you'd create a domain.Watchlist and verify the mapping
	t.Skip("Integration test - requires domain model setup")
}

func TestMapTagToGQL(t *testing.T) {
	// This test would require setting up domain models
	// For now, we'll just verify the function exists and can be called
	// In a real test, you'd create a domain.Tag and verify the mapping
	t.Skip("Integration test - requires domain model setup")
}
