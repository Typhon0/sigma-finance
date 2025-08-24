package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"time"

	"github.com/uptrace/bun"
)

// ITransactionRepository defines the interface for transaction-specific database operations.
// It extends the generic repository with domain-specific methods for complex queries.
type ITransactionRepository interface {
	IRepository[model.Transaction]

	// FindByPortfolioID retrieves all transactions for a specific portfolio
	FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.Transaction, error)

	// FindByAssetID retrieves all transactions for a specific asset
	FindByAssetID(ctx context.Context, assetID int) ([]model.Transaction, error)

	// FindByPortfolioAndAsset retrieves transactions for a specific portfolio and asset combination
	FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) ([]model.Transaction, error)

	// FindByDateRange retrieves transactions within a specific date range
	FindByDateRange(ctx context.Context, from, to time.Time) ([]model.Transaction, error)

	// FindByTransactionType retrieves transactions of a specific type (BUY/SELL)
	FindByTransactionType(ctx context.Context, transactionType string) ([]model.Transaction, error)

	// FindWithFilters retrieves transactions with multiple filter criteria
	FindWithFilters(ctx context.Context, filter TransactionFilter) ([]model.Transaction, error)
}

// TransactionFilter defines the filter criteria for transaction queries
type TransactionFilter struct {
	PortfolioID     *int
	AssetID         *int
	TransactionType *string
	DateFrom        *time.Time
	DateTo          *time.Time
	Limit           *int
	Offset          *int
}

// transactionRepository is the concrete implementation of TransactionRepository
type transactionRepository struct {
	*Repository[model.Transaction]
}

// NewTransactionRepository creates a new transaction repository instance
func NewTransactionRepository(repo *Repository[model.Transaction]) ITransactionRepository {
	return &transactionRepository{
		Repository: repo,
	}
}

// FindByPortfolioID retrieves all transactions for a specific portfolio
func (r *transactionRepository) FindByPortfolioID(ctx context.Context, portfolioID int) ([]model.Transaction, error) {
	return r.FindAllBy(ctx, ByColumn("portfolio_id", portfolioID))
}

// FindByAssetID retrieves all transactions for a specific asset
func (r *transactionRepository) FindByAssetID(ctx context.Context, assetID int) ([]model.Transaction, error) {
	return r.FindAllBy(ctx, ByColumn("asset_id", assetID))
}

// FindByPortfolioAndAsset retrieves transactions for a specific portfolio and asset combination
func (r *transactionRepository) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID int) ([]model.Transaction, error) {
	return r.FindAllBy(ctx,
		ByColumn("portfolio_id", portfolioID),
		ByColumn("asset_id", assetID),
	)
}

// FindByDateRange retrieves transactions within a specific date range
func (r *transactionRepository) FindByDateRange(ctx context.Context, from, to time.Time) ([]model.Transaction, error) {
	return r.FindAllBy(ctx, func(q *bun.SelectQuery) *bun.SelectQuery {
		return q.Where("transaction_date >= ? AND transaction_date <= ?", from, to)
	})
}

// FindByTransactionType retrieves transactions of a specific type (BUY/SELL)
func (r *transactionRepository) FindByTransactionType(ctx context.Context, transactionType string) ([]model.Transaction, error) {
	return r.FindAllBy(ctx, ByColumn("transaction_type", transactionType))
}

// FindWithFilters retrieves transactions with multiple filter criteria
func (r *transactionRepository) FindWithFilters(ctx context.Context, filter TransactionFilter) ([]model.Transaction, error) {
	var options []QueryOption

	if filter.PortfolioID != nil {
		options = append(options, ByColumn("portfolio_id", *filter.PortfolioID))
	}

	if filter.AssetID != nil {
		options = append(options, ByColumn("asset_id", *filter.AssetID))
	}

	if filter.TransactionType != nil {
		options = append(options, ByColumn("transaction_type", *filter.TransactionType))
	}

	if filter.DateFrom != nil && filter.DateTo != nil {
		options = append(options, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("transaction_date >= ? AND transaction_date <= ?", *filter.DateFrom, *filter.DateTo)
		})
	} else if filter.DateFrom != nil {
		options = append(options, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("transaction_date >= ?", *filter.DateFrom)
		})
	} else if filter.DateTo != nil {
		options = append(options, func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("transaction_date <= ?", *filter.DateTo)
		})
	}

	if filter.Limit != nil {
		options = append(options, WithLimit(*filter.Limit))
	}

	if filter.Offset != nil {
		options = append(options, WithOffset(*filter.Offset))
	}

	// Default ordering by transaction date descending
	options = append(options, WithOrder("transaction_date DESC"))

	return r.FindAllBy(ctx, options...)
}
