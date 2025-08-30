package graphql

import (
	"context"
	"fmt"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"strconv"
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
func parsePortfolioID(id string) (uint, error) {
    if id == "" { return 0, fmt.Errorf("empty id") }
    v, err := strconv.ParseUint(id,10,32); if err != nil || v == 0 { return 0, fmt.Errorf("invalid portfolio id") }
    return uint(v), nil
}
func (r *mutationResolver) validatePortfolioOwnership(ctx context.Context, portfolioID uint, userID string) error {
    p, err := r.PortfolioService.GetByID(ctx, portfolioID); if err != nil { return err }
    if p.UserID != userID { return fmt.Errorf("unauthorized: access denied to portfolio") }
    return nil
}
func handlePortfolioServiceError(err error) error { return err }
func buildPortfolioOrderClause(order gqlModel.PortfolioOrder) string { return "created_at DESC" }
