package service

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/stretchr/testify/require"
)

func servicePtrString(value string) *string {
	return &value
}

const (
	serviceTestOwnerOne = "11111111-1111-1111-1111-111111111111"
	serviceTestOwnerTwo = "22222222-2222-2222-2222-222222222222"
)

func TestInstrumentService_ArchiveAndRestoreManualInstrument(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	_, err := testDB.DB.ExecContext(ctx, `
		DROP TABLE IF EXISTS sigma_finance.instrument_aliases CASCADE;
		DROP TABLE IF EXISTS sigma_finance.instrument_sync_state CASCADE;
		DROP TABLE IF EXISTS sigma_finance.instruments CASCADE;
		CREATE TABLE IF NOT EXISTS sigma_finance.instruments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			symbol VARCHAR(50) NOT NULL,
			normalized_symbol VARCHAR(50) NOT NULL,
			name VARCHAR(255) NOT NULL,
			normalized_name VARCHAR(255) NOT NULL,
			exchange VARCHAR(100) NOT NULL,
			exchange_code VARCHAR(50),
			country VARCHAR(100),
			currency VARCHAR(20),
			summary TEXT,
			sector VARCHAR(255),
			industry_group VARCHAR(255),
			industry VARCHAR(255),
			category_group VARCHAR(255),
			category VARCHAR(255),
			family VARCHAR(255),
			website VARCHAR(255),
			market_cap VARCHAR(50),
			state VARCHAR(100),
			city VARCHAR(100),
			zipcode VARCHAR(50),
			base_currency VARCHAR(20),
			quote_currency VARCHAR(20),
			underlying_symbol VARCHAR(50),
			asset_type VARCHAR(20) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
			provider_source VARCHAR(100) NOT NULL,
			provider_external_id VARCHAR(255),
			external_source VARCHAR(64),
			external_id VARCHAR(255),
			platforms_json JSONB,
			primary_contract_address VARCHAR(255),
			instrument_status VARCHAR(50),
			market_cap_rank INTEGER,
			image_url TEXT,
			metadata_updated_at TIMESTAMP WITH TIME ZONE,
			owner_user_id UUID,
			isin VARCHAR(32),
			figi VARCHAR(32),
			cusip VARCHAR(32),
			search_vector tsvector,
			metadata JSONB,
			first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			last_verified_at TIMESTAMP WITH TIME ZONE,
			last_used_at TIMESTAMP WITH TIME ZONE,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
		CREATE UNIQUE INDEX IF NOT EXISTS instruments_symbol_exchange_type_unique
			ON sigma_finance.instruments(normalized_symbol, exchange, asset_type);
		CREATE INDEX IF NOT EXISTS instruments_manual_owner_user_idx
			ON sigma_finance.instruments(owner_user_id)
			WHERE provider_source = 'manual';
		CREATE TABLE IF NOT EXISTS sigma_finance.instrument_aliases (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			instrument_id UUID NOT NULL,
			alias_text VARCHAR(255) NOT NULL,
			normalized_alias_text VARCHAR(255) NOT NULL,
			alias_type VARCHAR(20) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
		CREATE UNIQUE INDEX IF NOT EXISTS instrument_aliases_unique
			ON sigma_finance.instrument_aliases(instrument_id, normalized_alias_text, alias_type);
		CREATE TABLE IF NOT EXISTS sigma_finance.instrument_sync_state (
			instrument_id UUID PRIMARY KEY,
			last_sync_attempt TIMESTAMP WITH TIME ZONE,
			last_sync_success TIMESTAMP WITH TIME ZONE,
			sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
			last_sync_source VARCHAR(100),
			sync_error_message TEXT,
			stale BOOLEAN NOT NULL DEFAULT false,
			verification_confidence INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
		DELETE FROM sigma_finance.instrument_aliases;
		DELETE FROM sigma_finance.instrument_sync_state;
		DELETE FROM sigma_finance.instruments;
	`)
	require.NoError(t, err)

	uow := repository.NewUnitOfWork(testDB.DB)
	instrumentRepo := uow.Instrument()
	created, err := instrumentRepo.Create(ctx, &model.Instrument{
		Symbol:           "MAN",
		NormalizedSymbol: "MAN",
		Name:             "Manual Asset",
		NormalizedName:   "manual asset",
		Exchange:         "OTC",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusUnknown,
		ProviderSource:   "manual",
		OwnerUserID:      servicePtrString(serviceTestOwnerOne),
	})
	require.NoError(t, err)

	service := NewInstrumentService(uow, nil, nil)

	archived, err := service.ArchiveManualInstrument(ctx, created.ID, servicePtrString(serviceTestOwnerOne))
	require.NoError(t, err)
	require.Equal(t, model.InstrumentStatusArchived, archived.Instrument.Status)
	require.NotNil(t, archived.SyncState)
	require.True(t, archived.SyncState.Stale)
	require.Equal(t, 0, archived.SyncState.VerificationConfidence)

	restored, err := service.RestoreManualInstrument(ctx, created.ID, servicePtrString(serviceTestOwnerOne))
	require.NoError(t, err)
	require.Equal(t, model.InstrumentStatusUnknown, restored.Instrument.Status)
	require.NotNil(t, restored.SyncState)
	require.True(t, restored.SyncState.Stale)
	require.Equal(t, 0, restored.SyncState.VerificationConfidence)
}

func TestInstrumentService_UpdateManualInstrumentClaimsOwner(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	_, err := testDB.DB.ExecContext(ctx, `
		DROP TABLE IF EXISTS sigma_finance.instrument_aliases CASCADE;
		DROP TABLE IF EXISTS sigma_finance.instrument_sync_state CASCADE;
		DROP TABLE IF EXISTS sigma_finance.instruments CASCADE;
		CREATE TABLE IF NOT EXISTS sigma_finance.instruments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			symbol VARCHAR(50) NOT NULL,
			normalized_symbol VARCHAR(50) NOT NULL,
			name VARCHAR(255) NOT NULL,
			normalized_name VARCHAR(255) NOT NULL,
			exchange VARCHAR(100) NOT NULL,
			exchange_code VARCHAR(50),
			country VARCHAR(100),
			currency VARCHAR(20),
			summary TEXT,
			sector VARCHAR(255),
			industry_group VARCHAR(255),
			industry VARCHAR(255),
			category_group VARCHAR(255),
			category VARCHAR(255),
			family VARCHAR(255),
			website VARCHAR(255),
			market_cap VARCHAR(50),
			state VARCHAR(100),
			city VARCHAR(100),
			zipcode VARCHAR(50),
			base_currency VARCHAR(20),
			quote_currency VARCHAR(20),
			underlying_symbol VARCHAR(50),
			asset_type VARCHAR(20) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
			provider_source VARCHAR(100) NOT NULL,
			provider_external_id VARCHAR(255),
			external_source VARCHAR(64),
			external_id VARCHAR(255),
			platforms_json JSONB,
			primary_contract_address VARCHAR(255),
			instrument_status VARCHAR(50),
			market_cap_rank INTEGER,
			image_url TEXT,
			metadata_updated_at TIMESTAMP WITH TIME ZONE,
			owner_user_id UUID,
			isin VARCHAR(32),
			figi VARCHAR(32),
			cusip VARCHAR(32),
			search_vector tsvector,
			metadata JSONB,
			first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			last_verified_at TIMESTAMP WITH TIME ZONE,
			last_used_at TIMESTAMP WITH TIME ZONE,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
		CREATE UNIQUE INDEX IF NOT EXISTS instruments_symbol_exchange_type_unique
			ON sigma_finance.instruments(normalized_symbol, exchange, asset_type);
		CREATE INDEX IF NOT EXISTS instruments_manual_owner_user_idx
			ON sigma_finance.instruments(owner_user_id)
			WHERE provider_source = 'manual';
		CREATE TABLE IF NOT EXISTS sigma_finance.instrument_aliases (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			instrument_id UUID NOT NULL,
			alias_text VARCHAR(255) NOT NULL,
			normalized_alias_text VARCHAR(255) NOT NULL,
			alias_type VARCHAR(20) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
		CREATE UNIQUE INDEX IF NOT EXISTS instrument_aliases_unique
			ON sigma_finance.instrument_aliases(instrument_id, normalized_alias_text, alias_type);
		CREATE TABLE IF NOT EXISTS sigma_finance.instrument_sync_state (
			instrument_id UUID PRIMARY KEY,
			last_sync_attempt TIMESTAMP WITH TIME ZONE,
			last_sync_success TIMESTAMP WITH TIME ZONE,
			sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
			last_sync_source VARCHAR(100),
			sync_error_message TEXT,
			stale BOOLEAN NOT NULL DEFAULT false,
			verification_confidence INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);
		DELETE FROM sigma_finance.instrument_aliases;
		DELETE FROM sigma_finance.instrument_sync_state;
		DELETE FROM sigma_finance.instruments;
	`)
	require.NoError(t, err)

	uow := repository.NewUnitOfWork(testDB.DB)
	instrumentRepo := uow.Instrument()
	created, err := instrumentRepo.Create(ctx, &model.Instrument{
		Symbol:           "LEG",
		NormalizedSymbol: "LEG",
		Name:             "Legacy Manual",
		NormalizedName:   "legacy manual",
		Exchange:         "OTC",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusUnknown,
		ProviderSource:   "manual",
	})
	require.NoError(t, err)
	require.Nil(t, created.OwnerUserID)

	service := NewInstrumentService(uow, nil, nil)
	updated, err := service.UpdateManualInstrument(ctx, created.ID, UpdateManualInstrumentInput{
		Symbol:       "LEG",
		Name:         "Legacy Manual",
		Exchange:     "OTC",
		AssetType:    model.InstrumentAssetTypeStock,
		ExchangeCode: nil,
	}, servicePtrString(serviceTestOwnerOne))
	require.NoError(t, err)
	require.NotNil(t, updated.Instrument.OwnerUserID)
	require.Equal(t, serviceTestOwnerOne, *updated.Instrument.OwnerUserID)
}
