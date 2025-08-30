package repository

import (
	"context"
	"sigma_finance/internal/domain/model"

	"github.com/uptrace/bun"
)

// IMarketDataCredentialRepository defines persistence operations for user API keys.
type IMarketDataCredentialRepository interface {
    Create(ctx context.Context, cred *model.MarketDataCredential) (*model.MarketDataCredential, error)
    Update(ctx context.Context, cred *model.MarketDataCredential) error
    GetByUserAndProvider(ctx context.Context, userID int, provider string) (*model.MarketDataCredential, error)
    ListByUser(ctx context.Context, userID int) ([]model.MarketDataCredential, error)
    Delete(ctx context.Context, id int) error
}

type marketDataCredentialRepository struct { db *bun.DB }

func NewMarketDataCredentialRepository(db *bun.DB) IMarketDataCredentialRepository { return &marketDataCredentialRepository{db: db} }

func (r *marketDataCredentialRepository) Create(ctx context.Context, cred *model.MarketDataCredential) (*model.MarketDataCredential, error) {
    _, err := r.db.NewInsert().Model(cred).Exec(ctx)
    return cred, err
}

func (r *marketDataCredentialRepository) Update(ctx context.Context, cred *model.MarketDataCredential) error {
    _, err := r.db.NewUpdate().Model(cred).WherePK().Exec(ctx)
    return err
}

func (r *marketDataCredentialRepository) GetByUserAndProvider(ctx context.Context, userID int, provider string) (*model.MarketDataCredential, error) {
    var cred model.MarketDataCredential
    err := r.db.NewSelect().Model(&cred).Where("user_id = ? AND provider = ?", userID, provider).Scan(ctx)
    if err != nil { return nil, err }
    return &cred, nil
}

func (r *marketDataCredentialRepository) ListByUser(ctx context.Context, userID int) ([]model.MarketDataCredential, error) {
    var creds []model.MarketDataCredential
    err := r.db.NewSelect().Model(&creds).Where("user_id = ?", userID).Scan(ctx)
    return creds, err
}

func (r *marketDataCredentialRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().Model(&model.MarketDataCredential{}).Where("id = ?", id).Exec(ctx)
    return err
}
