package repository

import (
	"context"
	"database/sql"
	"errors"
	"sigma_finance/internal/domain/model"
	"strings"
	"time"

	"github.com/uptrace/bun"
)

type IInstrumentProviderMappingRepository interface {
	IRepository[model.InstrumentProviderMapping]
	Upsert(ctx context.Context, mapping *model.InstrumentProviderMapping) (*model.InstrumentProviderMapping, error)
	GetByInstrumentAndProvider(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error)
	GetVerifiedByInstrumentAndProvider(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error)
	ListByInstrument(ctx context.Context, instrumentID string) ([]model.InstrumentProviderMapping, error)
	Invalidate(ctx context.Context, instrumentID string, provider string, reason string) error
}

type InstrumentProviderMappingRepository struct {
	*Repository[model.InstrumentProviderMapping]
}

func NewInstrumentProviderMappingRepository(db bun.IDB) *InstrumentProviderMappingRepository {
	return &InstrumentProviderMappingRepository{Repository: NewRepository[model.InstrumentProviderMapping](db)}
}

func (r *InstrumentProviderMappingRepository) Upsert(ctx context.Context, mapping *model.InstrumentProviderMapping) (*model.InstrumentProviderMapping, error) {
	now := time.Now()
	if mapping.CreatedAt.IsZero() {
		mapping.CreatedAt = now
	}
	mapping.UpdatedAt = now

	if strings.TrimSpace(mapping.ProviderAssetID) == "" {
		if mapping.ProviderSymbol != nil {
			mapping.ProviderAssetID = strings.TrimSpace(*mapping.ProviderSymbol)
		}
	}

	_, err := r.db.NewInsert().
		Model(mapping).
		ModelTableExpr("sigma_finance.instrument_provider_mappings AS mappings").
		On("CONFLICT (instrument_id, provider, provider_asset_id) DO UPDATE").
		Set("provider_symbol = COALESCE(EXCLUDED.provider_symbol, mappings.provider_symbol)").
		Set("provider_market = COALESCE(EXCLUDED.provider_market, mappings.provider_market)").
		Set("quote_currency = COALESCE(EXCLUDED.quote_currency, mappings.quote_currency)").
		Set("mapping_status = EXCLUDED.mapping_status").
		Set("last_verified_at = COALESCE(EXCLUDED.last_verified_at, mappings.last_verified_at)").
		Set("last_error_text = EXCLUDED.last_error_text").
		Set("updated_at = EXCLUDED.updated_at").
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}

	return mapping, nil
}

func (r *InstrumentProviderMappingRepository) GetByInstrumentAndProvider(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
	var mapping model.InstrumentProviderMapping
	err := r.db.NewSelect().
		Model(&mapping).
		Where("instrument_id = ?", instrumentID).
		Where("provider = ?", strings.ToUpper(strings.TrimSpace(provider))).
		Order("updated_at DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &mapping, nil
}

func (r *InstrumentProviderMappingRepository) GetVerifiedByInstrumentAndProvider(ctx context.Context, instrumentID string, provider string) (*model.InstrumentProviderMapping, error) {
	var mapping model.InstrumentProviderMapping
	err := r.db.NewSelect().
		Model(&mapping).
		Where("instrument_id = ?", instrumentID).
		Where("provider = ?", strings.ToUpper(strings.TrimSpace(provider))).
		Where("mapping_status = ?", model.InstrumentProviderMappingStatusVerified).
		Order("updated_at DESC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &mapping, nil
}

func (r *InstrumentProviderMappingRepository) ListByInstrument(ctx context.Context, instrumentID string) ([]model.InstrumentProviderMapping, error) {
	var mappings []model.InstrumentProviderMapping
	err := r.db.NewSelect().
		Model(&mappings).
		Where("instrument_id = ?", instrumentID).
		Order("provider ASC", "updated_at DESC").
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []model.InstrumentProviderMapping{}, nil
		}
		return nil, err
	}
	return mappings, nil
}

func (r *InstrumentProviderMappingRepository) Invalidate(ctx context.Context, instrumentID string, provider string, reason string) error {
	_, err := r.db.NewUpdate().
		Model((*model.InstrumentProviderMapping)(nil)).
		Set("mapping_status = ?", model.InstrumentProviderMappingStatusInvalid).
		Set("last_error_text = ?", strings.TrimSpace(reason)).
		Set("updated_at = ?", time.Now()).
		Where("instrument_id = ?", instrumentID).
		Where("provider = ?", strings.ToUpper(strings.TrimSpace(provider))).
		Exec(ctx)
	return err
}
