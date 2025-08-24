package graphql

import (
	"fmt"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"strconv"
)

// parseID converts a GraphQL string ID to uint
// parseID parses a string ID, accepting both numeric and '1' style IDs.
func parseID(id string) (uint, error) {
	if len(id) == 0 {
		return 0, fmt.Errorf("empty ID")
	}
	// Accept '1' or 'asset-2' style IDs
	for i, c := range id {
		if c >= '0' && c <= '9' {
			parsed, err := strconv.ParseUint(id[i:], 10, 32)
			if err != nil {
				return 0, fmt.Errorf("invalid ID format: %w", err)
			}
			return uint(parsed), nil
		}
	}
	// Fallback: try parsing the whole string
	parsed, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid ID format: %w", err)
	}
	return uint(parsed), nil
}

// buildUserOrderString creates an ORDER BY clause for user queries
func buildUserOrderString(field gqlModel.UserOrderField, direction gqlModel.SortDirection) string {
	var column string
	switch field {
	case gqlModel.UserOrderFieldUsername:
		column = "username"
	case gqlModel.UserOrderFieldEmail:
		column = "email"
	case gqlModel.UserOrderFieldCreatedAt:
		column = "created_at"
	default:
		column = "created_at"
	}

	dir := "ASC"
	if direction == gqlModel.SortDirectionDesc {
		dir = "DESC"
	}

	return fmt.Sprintf("%s %s", column, dir)
}

// buildPortfolioOrderString creates an ORDER BY clause for portfolio queries
func buildPortfolioOrderString(field gqlModel.PortfolioOrderField, direction gqlModel.SortDirection) string {
	var column string
	switch field {
	case gqlModel.PortfolioOrderFieldName:
		column = "name"
	case gqlModel.PortfolioOrderFieldCreatedAt:
		column = "created_at"
	case gqlModel.PortfolioOrderFieldUpdatedAt:
		column = "updated_at"
	default:
		column = "name"
	}

	dir := "ASC"
	if direction == gqlModel.SortDirectionDesc {
		dir = "DESC"
	}

	return fmt.Sprintf("%s %s", column, dir)
}

// buildAssetOrderString builds an ORDER BY string for asset queries
func buildAssetOrderString(field gqlModel.AssetOrderField, direction gqlModel.SortDirection) string {
	var column string
	switch field {
	case gqlModel.AssetOrderFieldName:
		column = "name"
	case gqlModel.AssetOrderFieldCurrentValue:
		column = "current_value"
	case gqlModel.AssetOrderFieldPurchaseDate:
		column = "purchase_date"
	default:
		column = "name"
	}

	dir := "ASC"
	if direction == gqlModel.SortDirectionDesc {
		dir = "DESC"
	}

	return fmt.Sprintf("%s %s", column, dir)
}

// buildTransactionOrderString creates an ORDER BY clause for transaction queries
func buildTransactionOrderString(field gqlModel.TransactionOrderField, direction gqlModel.SortDirection) string {
	var column string
	switch field {
	case gqlModel.TransactionOrderFieldTransactionDate:
		column = "transaction_date"
	case gqlModel.TransactionOrderFieldPricePerUnit:
		column = "price_per_unit"
	case gqlModel.TransactionOrderFieldQuantity:
		column = "quantity"
	default:
		column = "transaction_date"
	}

	dir := "ASC"
	if direction == gqlModel.SortDirectionDesc {
		dir = "DESC"
	}

	return fmt.Sprintf("%s %s", column, dir)
}

// stringPtr returns a pointer to the given string
func stringPtr(s string) *string {
	return &s
}
