package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IAccountRepository defines the interface for account-specific repository operations
type IAccountRepository interface {
	IRepository[model.Account]
	GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error)
	GetAccountsByUserID(ctx context.Context, userID string) ([]model.Account, error)
	GetAccountByName(ctx context.Context, portfolioID string, name string) (*model.Account, error)
	GetAccountsByAccountNumber(ctx context.Context, accountNumber string) ([]model.Account, error)
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
	res, err := r.GetDB().NewDelete().Model((*model.Account)(nil)).Where("id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// GetByID overrides the generic GetByID to eagerly load relations with table-aliasing
func (r *AccountRepository) GetByID(ctx context.Context, id string) (*model.Account, error) {
	acc := new(model.Account)
	err := r.GetDB().NewSelect().
		Model(acc).
		Where("a.id = ?", id).
		Relation("Positions").
		Relation("Positions.Asset").
		Relation("SyncConnection").
		Relation("CoOwnerUser").
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return acc, nil
}

// GetAccountsByPortfolioID retrieves all accounts for a specific portfolio with relations
func (r *AccountRepository) GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error) {
	var accounts []model.Account
	err := r.GetDB().NewSelect().
		Model(&accounts).
		Where("a.portfolio_id = ?", portfolioID).
		Relation("Positions").
		Relation("Positions.Asset").
		Relation("SyncConnection").
		Relation("CoOwnerUser").
		Order("a.created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}

// GetAccountsByUserID retrieves all accounts for a user across all portfolios with relations
func (r *AccountRepository) GetAccountsByUserID(ctx context.Context, userID string) ([]model.Account, error) {
	var accounts []model.Account
	err := r.GetDB().NewSelect().
		Model(&accounts).
		Where("a.user_id = ?", userID).
		Relation("Positions").
		Relation("Positions.Asset").
		Relation("SyncConnection").
		Relation("CoOwnerUser").
		Order("a.created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}

// GetAccountByName retrieves an account by name within a portfolio
func (r *AccountRepository) GetAccountByName(ctx context.Context, portfolioID string, name string) (*model.Account, error) {
	acc := new(model.Account)
	err := r.GetDB().NewSelect().
		Model(acc).
		Where("a.portfolio_id = ? AND a.name = ?", portfolioID, name).
		Relation("Positions").
		Relation("Positions.Asset").
		Relation("SyncConnection").
		Relation("CoOwnerUser").
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return acc, nil
}

// GetAccountsByAccountNumber retrieves all accounts with a matching account number / IBAN
func (r *AccountRepository) GetAccountsByAccountNumber(ctx context.Context, accountNumber string) ([]model.Account, error) {
	var accounts []model.Account
	err := r.GetDB().NewSelect().
		Model(&accounts).
		Where("a.account_number = ?", accountNumber).
		Relation("Positions").
		Relation("Positions.Asset").
		Relation("SyncConnection").
		Relation("CoOwnerUser").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
