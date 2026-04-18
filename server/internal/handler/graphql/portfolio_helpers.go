package graphql

import (
	"context"
	"errors"
	"fmt"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"strings"
)

func validatePortfolioName(name string) error {
    if len(name) < 3 { return fmt.Errorf("name too short") }
    if len(name) > 100 { return fmt.Errorf("name too long") }
    return nil
}
func sanitizePortfolioName(name string) string {
    out := ""
    lastSpace := false
    for _, r := range name {
        if r == ' ' || r == '\t' || r == '\n' || r == '\r' { if !lastSpace { out += " " }; lastSpace = true; continue }
        out += string(r); lastSpace = false
    }
    return strings.TrimSpace(out)
}
func sanitizeDescription(desc string) string {
    if len(desc) > 500 { desc = desc[:500] }
    return strings.TrimSpace(desc)
}
func parsePortfolioID(id string) (string, error) {
    if id == "" { return "", fmt.Errorf("empty id") }
    return id, nil
}
func (r *mutationResolver) validatePortfolioOwnership(ctx context.Context, portfolioID string, userID string) error {
    p, err := r.PortfolioService.GetByID(ctx, portfolioID); if err != nil { return err }
    if p.UserID != userID { return fmt.Errorf("unauthorized: access denied to portfolio") }
    return nil
}
func handlePortfolioServiceError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, service.ErrPortfolioNotFound) || errors.Is(err, repository.ErrNotFound) {
		return fmt.Errorf("portfolio not found")
	}
	if errors.Is(err, service.ErrPortfolioNameExists) {
		return fmt.Errorf("portfolio name already exists")
	}
	if errors.Is(err, service.ErrPortfolioUnauthorized) {
		return fmt.Errorf("unauthorized: access denied to portfolio")
	}
	if errors.Is(err, service.ErrPortfolioInvalidName) {
		return fmt.Errorf("invalid portfolio name")
	}
	if errors.Is(err, service.ErrPortfolioInvalidInput) {
		return fmt.Errorf("invalid input")
	}
	if errors.Is(err, service.ErrPortfolioHasPositions) {
		return fmt.Errorf("cannot delete portfolio: portfolio contains positions")
	}
	return fmt.Errorf("portfolio operation failed: %w", err)
}

func buildPortfolioOrderClause(order gqlModel.PortfolioOrder) string {
	var column string
	switch order.Field {
	case gqlModel.PortfolioOrderFieldName:
		column = "name"
	case gqlModel.PortfolioOrderFieldSortOrder:
		column = "sort_order"
	case gqlModel.PortfolioOrderFieldCreatedAt:
		column = "created_at"
	case gqlModel.PortfolioOrderFieldUpdatedAt:
		column = "updated_at"
	default:
		column = "created_at"
	}

	dir := "ASC"
	if order.Direction == gqlModel.SortDirectionDesc {
		dir = "DESC"
	}

	return fmt.Sprintf("%s %s", column, dir)
}
