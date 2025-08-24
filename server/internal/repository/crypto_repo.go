package repository

import (
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// ICryptoRepository defines the interface for crypto-specific repository operations
type ICryptoRepository interface {
	IRepository[model.Crypto]
}

// CryptoRepository wraps the generic repository with crypto-specific functionality
type CryptoRepository struct {
	*Repository[model.Crypto]
}

// NewCryptoRepository creates a new crypto repository
func NewCryptoRepository(db bun.IDB) *CryptoRepository {
	return &CryptoRepository{
		Repository: NewRepository[model.Crypto](db),
	}
}
