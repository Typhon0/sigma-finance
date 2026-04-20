package graphql

import (
	"fmt"
	gqlModel "sigma_finance/internal/handler/graphql/model"
)

// parseID converts a GraphQL string ID to its internal representation (string)
func parseID(id string) (string, error) {
	if len(id) == 0 {
		return "", fmt.Errorf("empty ID")
	}
	return id, nil
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
	case gqlModel.TransactionOrderFieldExecutedAt:
		column = "executed_at"
	case gqlModel.TransactionOrderFieldUnitPriceAmount:
		column = "unit_price_amount"
	case gqlModel.TransactionOrderFieldQuantity:
		column = "quantity"
	default:
		column = "executed_at"
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

// getFloat64 dereferences a float64 pointer or returns 0.0
func getFloat64(f *float64) float64 {
	if f == nil {
		return 0.0
	}
	return *f
}

// getStr dereferences a string pointer or returns empty string
func getStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// int32Ptr returns a pointer to the given int32
func int32Ptr(i int32) *int32 {
	return &i
}

// intToInt32 converts *int to *int32
func intToInt32(i *int) *int32 {
	if i == nil {
		return nil
	}
	v := int32(*i)
	return &v
}

// int32ToInt converts *int32 to *int
func int32ToInt(i *int32) *int {
	if i == nil {
		return nil
	}
	v := int(*i)
	return &v
}
