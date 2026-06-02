package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"

	"github.com/stretchr/testify/require"
)

func repoPtrString(value string) *string {
	return &value
}

const (
	repoTestOwnerOne = "11111111-1111-1111-1111-111111111111"
	repoTestOwnerTwo = "22222222-2222-2222-2222-222222222222"
)

func TestInstrumentRepository_ListManual(t *testing.T) {
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

	repo := NewInstrumentRepository(testDB.DB)

	active := &model.Instrument{
		Symbol:           "AAA",
		NormalizedSymbol: "AAA",
		Name:             "Alpha Asset",
		NormalizedName:   "alpha asset",
		Exchange:         "NYSE",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusUnknown,
		ProviderSource:   "manual",
		OwnerUserID:      repoPtrString(repoTestOwnerOne),
		ISIN:             repoPtrString("US0378331005"),
		CUSIP:            repoPtrString("037833100"),
		FIGI:             repoPtrString("BBG000B9Y5X2"),
	}
	archived := &model.Instrument{
		Symbol:           "BBB",
		NormalizedSymbol: "BBB",
		Name:             "Beta Asset",
		NormalizedName:   "beta asset",
		Exchange:         "NYSE",
		AssetType:        model.InstrumentAssetTypeStock,
		Status:           model.InstrumentStatusArchived,
		ProviderSource:   "manual",
		OwnerUserID:      repoPtrString(repoTestOwnerTwo),
	}

	_, err = repo.Create(ctx, active)
	require.NoError(t, err)
	_, err = repo.Create(ctx, archived)
	require.NoError(t, err)

	rows, err := repo.ListManual(ctx, ManualInstrumentFilter{Limit: 10, Offset: 0, OwnerUserID: repoPtrString(repoTestOwnerOne)})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "AAA", rows[0].Symbol)
	require.Equal(t, model.InstrumentStatusUnknown, rows[0].Status)

	rows, err = repo.ListManual(ctx, ManualInstrumentFilter{Limit: 10, Offset: 0, IncludeArchived: true, OwnerUserID: repoPtrString(repoTestOwnerTwo)})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "BBB", rows[0].Symbol)

	searchRows, err := repo.searchExactSymbolInstruments(ctx, "AAA", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, searchRows, 1)
	require.Equal(t, "AAA", searchRows[0].Instrument.Symbol)

	visibleRows := filterVisibleInstrumentSearchRows(searchRows, repoPtrString(repoTestOwnerOne))
	require.Len(t, visibleRows, 1)
	require.Equal(t, "AAA", visibleRows[0].Instrument.Symbol)

	visibleRows = filterVisibleInstrumentSearchRows(searchRows, repoPtrString(repoTestOwnerTwo))
	require.Len(t, visibleRows, 0)

	// Test matching by ISIN
	isinRows, err := repo.searchExactSymbolInstruments(ctx, "US0378331005", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, isinRows, 1)
	require.Equal(t, "AAA", isinRows[0].Instrument.Symbol)

	// Test matching by CUSIP
	cusipRows, err := repo.searchExactSymbolInstruments(ctx, "037833100", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, cusipRows, 1)
	require.Equal(t, "AAA", cusipRows[0].Instrument.Symbol)

	// Test matching by FIGI
	figiRows, err := repo.searchExactSymbolInstruments(ctx, "BBG000B9Y5X2", InstrumentSearchFilter{}, 10)
	require.NoError(t, err)
	require.Len(t, figiRows, 1)
	require.Equal(t, "AAA", figiRows[0].Instrument.Symbol)
}
