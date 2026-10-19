package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IAccountRepository defines the interface for account-specific repository operations
type IAccountRepository interface {
	IRepository[model.Account]
	GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error)
	GetAccountsByUserID(ctx context.Context, userID string) ([]model.Account, error)
	GetAccountByName(ctx context.Context, portfolioID string, name string) (*model.Account, error)
}

// AccountRepository wraps the generic repository with account-specific functionality
type AccountRepository struct {
	*Repository[model.Account]
}

// NewAccountRepository creates a new account repository
func NewAccountRepository(db bun.IDB) *AccountRepository {
	return &AccountRepository{
		Repository: NewRepository[model.Account](db),
	}
}

// Delete overrides the generic Delete to use the correct primary key
func (r *AccountRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.NewDelete().Model((*model.Account)(nil)).Where("id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GetAccountsByPortfolioID retrieves all accounts for a specific portfolio
func (r *AccountRepository) GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("portfolio_id = ?", portfolioID).Order("created_at ASC")
	})
}

// GetAccountsByUserID retrieves all accounts for a user across all portfolios
func (r *AccountRepository) GetAccountsByUserID(ctx context.Context, userID string) ([]model.Account, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("user_id = ?", userID).Order("created_at ASC")
	})
}

// GetAccountByName retrieves an account by name within a portfolio
func (r *AccountRepository) GetAccountByName(ctx context.Context, portfolioID string, name string) (*model.Account, error) {
	return r.FindOneBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("portfolio_id = ? AND name = ?", portfolioID, name)
	})
}
