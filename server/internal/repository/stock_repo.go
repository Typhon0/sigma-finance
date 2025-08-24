package repository

import (
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IStockRepository defines the interface for stock-specific repository operations
type IStockRepository interface {
	IRepository[model.Stock]
}

// StockRepository wraps the generic repository with stock-specific functionality
type StockRepository struct {
	*Repository[model.Stock]
}

// NewStockRepository creates a new stock repository
func NewStockRepository(db bun.IDB) *StockRepository {
	return &StockRepository{
		Repository: NewRepository[model.Stock](db),
	}
}
