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
