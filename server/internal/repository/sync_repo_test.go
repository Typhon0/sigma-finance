package repository_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/testutil"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	_ = godotenv.Load("../../.env", "../.env", ".env")
	if os.Getenv("TEST_DB_HOST") == "" && os.Getenv("DB_HOST") != "" {
		os.Setenv("TEST_DB_HOST", os.Getenv("DB_HOST"))
	}
	if os.Getenv("TEST_DB_PASSWORD") == "" && os.Getenv("DB_PASSWORD") != "" {
		os.Setenv("TEST_DB_PASSWORD", os.Getenv("DB_PASSWORD"))
	}
	if os.Getenv("TEST_DB_USER") == "" && os.Getenv("DB_USER") != "" {
		os.Setenv("TEST_DB_USER", os.Getenv("DB_USER"))
	}
	if os.Getenv("TEST_DB_PORT") == "" && os.Getenv("DB_PORT") != "" {
		os.Setenv("TEST_DB_PORT", os.Getenv("DB_PORT"))
	}
}

func setupSyncTestContext(t *testing.T) (*testutil.TestDB, repository.IUnitOfWork, *model.User, *model.Portfolio) {
	t.Helper()
	testDB := testutil.NewTestDB(t)
	ctx := context.Background()
	testDB.CleanupTables(ctx)

	// Clean up sync tables explicitly
	_, _ = testDB.DB.NewRaw("TRUNCATE TABLE sigma_finance.sync_runs, sigma_finance.sync_connections, sigma_finance.sync_credentials CASCADE").Exec(ctx)

	uow := repository.NewUnitOfWork(testDB.DB)

	user, err := uow.User().Create(ctx, &model.User{
		ID:            uuid.NewString(),
		Email:         "synctest_" + uuid.NewString()[:8] + "@example.com",
		Name:          "Sync Test User",
		EmailVerified: true,
	})
	require.NoError(t, err)

	portfolio, err := uow.Portfolio().Create(ctx, &model.Portfolio{
		ID:     uuid.NewString(),
		UserID: user.ID,
		Name:   "Sync Test Portfolio",
	})
	require.NoError(t, err)

	return testDB, uow, user, portfolio
}

func TestSyncRepository_CreateAndGetCredential(t *testing.T) {
	testDB, uow, user, _ := setupSyncTestContext(t)
	defer testDB.Close()

	ctx := context.Background()
	syncRepo := uow.Sync()
	require.NotNil(t, syncRepo, "uow.Sync() should return a valid ISyncRepository")

	cred := &model.SyncCredential{
		UserID:        user.ID,
		Provider:      model.SyncProviderKraken,
		EncryptedData: "base64-encrypted-api-key-data",
		Status:        model.SyncCredentialStatusActive,
	}

	err := syncRepo.CreateCredential(ctx, cred)
	require.NoError(t, err)
	assert.NotEmpty(t, cred.ID, "credential ID should be generated")

	// Get by ID
	fetched, err := syncRepo.GetCredentialByID(ctx, cred.ID)
	require.NoError(t, err)
	require.NotNil(t, fetched)
	assert.Equal(t, cred.ID, fetched.ID)
	assert.Equal(t, user.ID, fetched.UserID)
	assert.Equal(t, model.SyncProviderKraken, fetched.Provider)
	assert.Equal(t, "base64-encrypted-api-key-data", fetched.EncryptedData)
	assert.Equal(t, model.SyncCredentialStatusActive, fetched.Status)

	// Get by Provider
	byProvider, err := syncRepo.GetCredentialByProvider(ctx, user.ID, model.SyncProviderKraken)
	require.NoError(t, err)
	require.NotNil(t, byProvider)
	assert.Equal(t, cred.ID, byProvider.ID)

	// Non-existent ID returns ErrNotFound
	_, err = syncRepo.GetCredentialByID(ctx, uuid.NewString())
	assert.Error(t, err)
	assert.True(t, errors.Is(err, repository.ErrNotFound), "expected ErrNotFound for missing credential ID")

	// Non-existent provider for user returns ErrNotFound
	_, err = syncRepo.GetCredentialByProvider(ctx, user.ID, "NONEXISTENT_PROVIDER")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, repository.ErrNotFound), "expected ErrNotFound for missing provider")
}

func TestSyncRepository_SystemCredential(t *testing.T) {
	testDB, uow, user, _ := setupSyncTestContext(t)
	defer testDB.Close()

	ctx := context.Background()
	syncRepo := uow.Sync()

	systemCred := &model.SyncCredential{
		IsSystem:      true,
		Provider:      model.SyncProviderSnapTrade,
		EncryptedData: "system-wide-snaptrade-client-secret",
		Status:        model.SyncCredentialStatusActive,
	}

	err := syncRepo.CreateCredential(ctx, systemCred)
	require.NoError(t, err)
	assert.NotEmpty(t, systemCred.ID)

	// Retrieve with empty userID
	fetched, err := syncRepo.GetCredentialByProvider(ctx, "", model.SyncProviderSnapTrade)
	require.NoError(t, err)
	require.NotNil(t, fetched)
	assert.Equal(t, systemCred.ID, fetched.ID)
	assert.True(t, fetched.IsSystem)

	// Fallback to system credential when user has no custom credential
	fallback, err := syncRepo.GetCredentialByProvider(ctx, user.ID, model.SyncProviderSnapTrade)
	require.NoError(t, err)
	require.NotNil(t, fallback)
	assert.Equal(t, systemCred.ID, fallback.ID)
	assert.True(t, fallback.IsSystem)
}

func TestSyncRepository_ConnectionLifecycle(t *testing.T) {
	testDB, uow, user, portfolio := setupSyncTestContext(t)
	defer testDB.Close()

	ctx := context.Background()
	syncRepo := uow.Sync()

	cred := &model.SyncCredential{
		UserID:        user.ID,
		Provider:      model.SyncProviderKraken,
		EncryptedData: "encrypted-test-data",
		Status:        model.SyncCredentialStatusActive,
	}
	require.NoError(t, syncRepo.CreateCredential(ctx, cred))

	conn := &model.SyncConnection{
		UserID:                user.ID,
		PortfolioID:           portfolio.ID,
		CredentialID:          cred.ID,
		Provider:              model.SyncProviderKraken,
		ExternalInstitutionID: "kraken-inst-01",
		ExternalAccountID:     "kraken-acc-9988",
		InstitutionName:       "Kraken Exchange",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}

	// Create connection
	err := syncRepo.CreateConnection(ctx, conn)
	require.NoError(t, err)
	assert.NotEmpty(t, conn.ID)

	// Get by ID
	fetched, err := syncRepo.GetConnectionByID(ctx, conn.ID)
	require.NoError(t, err)
	require.NotNil(t, fetched)
	assert.Equal(t, conn.ID, fetched.ID)
	assert.Equal(t, "Kraken Exchange", fetched.InstitutionName)
	assert.Equal(t, model.SyncConnectionStatusIdle, fetched.SyncStatus)
	assert.NotNil(t, fetched.Credential, "Credential relation should be populated")
	assert.Equal(t, cred.ID, fetched.Credential.ID)

	// List connections by portfolio
	conns, err := syncRepo.ListConnectionsByPortfolio(ctx, portfolio.ID)
	require.NoError(t, err)
	require.Len(t, conns, 1)
	assert.Equal(t, conn.ID, conns[0].ID)

	// Update connection
	now := time.Now().Truncate(time.Second)
	errMsg := "rate limit reached"
	conn.SyncStatus = model.SyncConnectionStatusFailed
	conn.LastSyncAt = &now
	conn.LastError = &errMsg

	err = syncRepo.UpdateConnection(ctx, conn)
	require.NoError(t, err)

	updated, err := syncRepo.GetConnectionByID(ctx, conn.ID)
	require.NoError(t, err)
	assert.Equal(t, model.SyncConnectionStatusFailed, updated.SyncStatus)
	assert.NotNil(t, updated.LastError)
	assert.Equal(t, "rate limit reached", *updated.LastError)

	// Non-existent connection lookup returns ErrNotFound
	_, err = syncRepo.GetConnectionByID(ctx, uuid.NewString())
	assert.ErrorIs(t, err, repository.ErrNotFound)

	// Update non-existent connection returns ErrNotFound
	fakeConn := &model.SyncConnection{
		ID:                    uuid.NewString(),
		UserID:                user.ID,
		PortfolioID:           portfolio.ID,
		CredentialID:          cred.ID,
		Provider:              model.SyncProviderKraken,
		ExternalInstitutionID: "inst",
		ExternalAccountID:     "acc",
		InstitutionName:       "Inst",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
	err = syncRepo.UpdateConnection(ctx, fakeConn)
	assert.ErrorIs(t, err, repository.ErrNotFound)

	// Empty list for non-existent portfolio
	emptyList, err := syncRepo.ListConnectionsByPortfolio(ctx, uuid.NewString())
	require.NoError(t, err)
	assert.Empty(t, emptyList)
}

func TestSyncRepository_SyncRunLifecycle(t *testing.T) {
	testDB, uow, user, portfolio := setupSyncTestContext(t)
	defer testDB.Close()

	ctx := context.Background()
	syncRepo := uow.Sync()

	cred := &model.SyncCredential{
		UserID:        user.ID,
		Provider:      model.SyncProviderKraken,
		EncryptedData: "encrypted-test-data",
	}
	require.NoError(t, syncRepo.CreateCredential(ctx, cred))

	conn := &model.SyncConnection{
		UserID:                user.ID,
		PortfolioID:           portfolio.ID,
		CredentialID:          cred.ID,
		Provider:              model.SyncProviderKraken,
		ExternalInstitutionID: "kraken-inst-01",
		ExternalAccountID:     "kraken-acc-1122",
		InstitutionName:       "Kraken",
		SyncStatus:            model.SyncConnectionStatusSyncing,
	}
	require.NoError(t, syncRepo.CreateConnection(ctx, conn))

	run := &model.SyncRun{
		ConnectionID:  conn.ID,
		Status:        model.SyncRunStatusInProgress,
		ItemsImported: 0,
		ItemsUpdated:  0,
	}

	// Create SyncRun
	err := syncRepo.CreateSyncRun(ctx, run)
	require.NoError(t, err)
	assert.NotEmpty(t, run.ID)
	assert.Equal(t, model.SyncRunStatusInProgress, run.Status)

	// Update SyncRun
	completedAt := time.Now().Truncate(time.Second)
	run.Status = model.SyncRunStatusCompleted
	run.ItemsImported = 14
	run.ItemsUpdated = 3
	run.CompletedAt = &completedAt

	err = syncRepo.UpdateSyncRun(ctx, run)
	require.NoError(t, err)

	// Fetch run by ID
	fetched, err := syncRepo.GetSyncRunByID(ctx, run.ID)
	require.NoError(t, err)
	require.NotNil(t, fetched)
	assert.Equal(t, model.SyncRunStatusCompleted, fetched.Status)
	assert.Equal(t, 14, fetched.ItemsImported)
	assert.Equal(t, 3, fetched.ItemsUpdated)
	assert.NotNil(t, fetched.CompletedAt)

	// Non-existent run lookup returns ErrNotFound
	_, err = syncRepo.GetSyncRunByID(ctx, uuid.NewString())
	assert.ErrorIs(t, err, repository.ErrNotFound)

	// Update non-existent run returns ErrNotFound
	fakeRun := &model.SyncRun{
		ID:           uuid.NewString(),
		ConnectionID: conn.ID,
		Status:       model.SyncRunStatusCompleted,
	}
	err = syncRepo.UpdateSyncRun(ctx, fakeRun)
	assert.ErrorIs(t, err, repository.ErrNotFound)
}

func TestSyncRepository_UnitOfWorkTransactionRollback(t *testing.T) {
	testDB, uow, user, _ := setupSyncTestContext(t)
	defer testDB.Close()

	ctx := context.Background()

	credID := uuid.NewString()
	testErr := errors.New("simulated transaction failure")

	err := uow.Do(ctx, func(txUow repository.IUnitOfWork) error {
		cred := &model.SyncCredential{
			ID:            credID,
			UserID:        user.ID,
			Provider:      model.SyncProviderKraken,
			EncryptedData: "tx-test-encrypted",
			Status:        model.SyncCredentialStatusActive,
		}
		if err := txUow.Sync().CreateCredential(ctx, cred); err != nil {
			return err
		}
		return testErr
	})

	assert.ErrorIs(t, err, testErr)

	// Credential should NOT exist due to rollback
	_, getErr := uow.Sync().GetCredentialByID(ctx, credID)
	assert.Error(t, getErr)
	assert.True(t, errors.Is(getErr, repository.ErrNotFound), "credential should have rolled back")
}

func TestSyncRepository_InterfaceCompliance(t *testing.T) {
	var _ repository.ISyncRepository = (*repository.SyncRepository)(nil)
}
