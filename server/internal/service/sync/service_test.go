package sync_test

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	syncservice "sigma_finance/internal/service/sync"
)

// MockSyncAdapter implements syncservice.SyncAdapter for testing
type MockSyncAdapter struct {
	provider          string
	testConnectionErr error
	rawAccounts       []syncservice.RawAccount
	rawBalances       []syncservice.RawBalance
	rawHoldings       []syncservice.RawHolding
	rawTransactions   []syncservice.RawTransaction
	fetchBalancesErr  error
	fetchHoldingsErr  error
	fetchTxErr        error
}

func (m *MockSyncAdapter) Provider() string {
	if m.provider == "" {
		return "TEST_PROVIDER"
	}
	return m.provider
}

func (m *MockSyncAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	return m.testConnectionErr
}

func (m *MockSyncAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	return m.rawAccounts, nil
}

func (m *MockSyncAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawBalance, error) {
	if m.fetchBalancesErr != nil {
		return nil, m.fetchBalancesErr
	}
	return m.rawBalances, nil
}

func (m *MockSyncAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawHolding, error) {
	if m.fetchHoldingsErr != nil {
		return nil, m.fetchHoldingsErr
	}
	return m.rawHoldings, nil
}

func (m *MockSyncAdapter) FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time) ([]syncservice.RawTransaction, error) {
	if m.fetchTxErr != nil {
		return nil, m.fetchTxErr
	}
	return m.rawTransactions, nil
}

func TestSyncService_ReconciliationSnapshotWithResidualTaxLot(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()

	// Seed user, portfolio, account, asset, credential, connection
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	aaplAsset := &model.Asset{
		ID:          "asset-aapl",
		Symbol:      strPtr("AAPL"),
		Name:        "Apple Inc.",
		Type:        model.AssetTypeStock,
		IsTradeable: true,
	}
	uow.assets[aaplAsset.ID] = aaplAsset

	// Pre-seed 1 historical buy transaction of 2 shares bought at $150
	buyTx := &model.Transaction{
		ID:                "tx-hist-1",
		UserID:            "user-1",
		AccountID:         strPtr("acc-1"),
		PositionID:        strPtr("pos-aapl"),
		Type:              model.TransactionTypeBuy,
		Amount:            model.Money(30000), // $300 in cents
		Quantity:          decPtr(decimal.NewFromInt(2)),
		UnitPriceAmount:   decPtr(decimal.NewFromInt(150)),
		UnitPriceCurrency: model.CurrencyUSD,
		ExecutedAt:        time.Now().Add(-30 * 24 * time.Hour),
	}
	uow.transactions[buyTx.ID] = buyTx

	// Pre-seed position with initial 2 shares
	pos := &model.Position{
		ID:                  "pos-aapl",
		PortfolioID:         "portfolio-1",
		AccountID:           "acc-1",
		AssetID:             aaplAsset.ID,
		Quantity:            decimal.NewFromInt(2),
		OwnershipPercentage: decimal.NewFromInt(100),
		QuoteCurrency:       model.CurrencyUSD,
	}
	uow.positions[pos.ID] = pos

	// Mock adapter returning 10 shares of AAPL
	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID:       "ext-aapl",
				Symbol:           "AAPL",
				Name:             "Apple Inc.",
				AssetType:        model.AssetTypeStock,
				Quantity:         decimal.NewFromInt(10),
				CostBasisPerUnit: decPtr(decimal.NewFromInt(150)),
				Currency:         model.CurrencyUSD,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	require.NotNil(t, run)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Assert Position.Quantity == 10
	reconciledPos, err := uow.Position().GetByAccountAndAsset(ctx, "acc-1", aaplAsset.ID)
	require.NoError(t, err)
	require.NotNil(t, reconciledPos)
	assert.True(t, reconciledPos.Quantity.Equal(decimal.NewFromInt(10)), "expected Position.Quantity == 10, got %s", reconciledPos.Quantity.String())

	// Assert an opening baseline tax lot of 8 shares was created with earliest cost basis ($150)
	lots, err := uow.TaxLot().FindByPositionID(ctx, reconciledPos.ID)
	require.NoError(t, err)
	var baselineLot *model.TaxLot
	for _, lot := range lots {
		if lot.TransactionID == nil {
			baselineLot = lot
			break
		}
	}
	require.NotNil(t, baselineLot, "expected baseline tax lot with TransactionID == nil")
	assert.True(t, baselineLot.RemainingQuantity.Equal(decimal.NewFromInt(8)), "expected baseline tax lot of 8 shares, got %s", baselineLot.RemainingQuantity.String())
	assert.True(t, baselineLot.CostBasisPerUnit.Equal(decimal.NewFromInt(150)), "expected earliest cost basis 150, got %s", baselineLot.CostBasisPerUnit.String())
	assert.Equal(t, model.TaxLotStatusOpen, baselineLot.Status)
}

func TestSyncService_UnmatchedInstrumentCreatesPlaceholder(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID: "ext-unlisted",
				Symbol:     "UNKNOWN_TOKEN",
				Name:       "Unknown Token Protocol",
				AssetType:  model.AssetTypeCrypto,
				Quantity:   decimal.NewFromInt(500),
				Currency:   model.CurrencyUSD,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	require.NotNil(t, run)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Assert placeholder asset UNMAPPED created
	placeholderAsset, err := uow.Asset().GetBySymbol(ctx, "UNKNOWN_TOKEN")
	require.NoError(t, err)
	require.NotNil(t, placeholderAsset)
	assert.Equal(t, "UNKNOWN_TOKEN", *placeholderAsset.Symbol)
	assert.NotNil(t, placeholderAsset.MarketDataSource)
	assert.Equal(t, "UNMAPPED", *placeholderAsset.MarketDataSource)

	// Assert position created
	pos, err := uow.Position().GetByAccountAndAsset(ctx, "acc-1", placeholderAsset.ID)
	require.NoError(t, err)
	require.NotNil(t, pos)
	assert.True(t, pos.Quantity.Equal(decimal.NewFromInt(500)))

	// Assert warning logged / recorded
	assert.NotNil(t, run.ErrorMessage)
	assert.Contains(t, *run.ErrorMessage, "UNKNOWN_TOKEN")
}

func TestSyncService_ZeroBalanceUpdatesQuantityToZero(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	msftAsset := &model.Asset{
		ID:          "asset-msft",
		Symbol:      strPtr("MSFT"),
		Name:        "Microsoft Corp.",
		Type:        model.AssetTypeStock,
		IsTradeable: true,
	}
	uow.assets[msftAsset.ID] = msftAsset

	// Existing position with quantity 5
	existingPos := &model.Position{
		ID:                  "pos-msft",
		PortfolioID:         "portfolio-1",
		AccountID:           "acc-1",
		AssetID:             msftAsset.ID,
		Quantity:            decimal.NewFromInt(5),
		OwnershipPercentage: decimal.NewFromInt(100),
		QuoteCurrency:       model.CurrencyUSD,
	}
	uow.positions[existingPos.ID] = existingPos

	// External holding is absent (0)
	adapter := &MockSyncAdapter{
		provider:    "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{}, // MSFT absent
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	require.NotNil(t, run)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Assert Position.Quantity updated to 0, row not deleted
	pos, err := uow.Position().GetByAccountAndAsset(ctx, "acc-1", msftAsset.ID)
	require.NoError(t, err)
	require.NotNil(t, pos)
	assert.True(t, pos.Quantity.IsZero(), "expected Position.Quantity to be 0, got %s", pos.Quantity.String())
}

func TestSyncService_CashBalanceReconciliation(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawBalances: []syncservice.RawBalance{
			{
				Currency: model.CurrencyEUR,
				Amount:   decimal.NewFromFloat(2500.50),
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	require.NotNil(t, run)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Assert cash asset of AssetTypeBankAccount created
	cashAsset, err := uow.Asset().GetBySymbol(ctx, "EUR_CASH_acc-1")
	require.NoError(t, err)
	require.NotNil(t, cashAsset)
	assert.Equal(t, model.AssetTypeBankAccount, cashAsset.Type)

	// Assert cash position exists with quantity 1 and total cost basis 250050 cents
	pos, err := uow.Position().GetByAccountAndAsset(ctx, "acc-1", cashAsset.ID)
	require.NoError(t, err)
	require.NotNil(t, pos)
	assert.True(t, pos.Quantity.Equal(decimal.NewFromInt(1)))
	require.NotNil(t, pos.TotalCostBasis)
	assert.Equal(t, model.Money(250050), *pos.TotalCostBasis)
}

func TestSyncService_TransactionDeduplication(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	aaplAsset := &model.Asset{
		ID:          "asset-aapl",
		Symbol:      strPtr("AAPL"),
		Name:        "Apple Inc.",
		Type:        model.AssetTypeStock,
		IsTradeable: true,
	}
	uow.assets[aaplAsset.ID] = aaplAsset

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID: "ext-aapl",
				Symbol:     "AAPL",
				Quantity:   decimal.NewFromInt(5),
				Currency:   model.CurrencyUSD,
			},
		},
		rawTransactions: []syncservice.RawTransaction{
			{
				ExternalID:        "ext-tx-100",
				Type:              model.TransactionTypeBuy,
				Symbol:            "AAPL",
				Quantity:          decPtr(decimal.NewFromInt(5)),
				UnitPriceAmount:   decPtr(decimal.NewFromInt(150)),
				UnitPriceCurrency: model.CurrencyUSD,
				Amount:            model.Money(75000),
				Currency:          model.CurrencyUSD,
				ExecutedAt:        time.Now().Add(-10 * 24 * time.Hour),
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	// First sync
	run1, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run1.Status)

	txCount1 := len(uow.transactions)
	assert.Equal(t, 1, txCount1)

	// Second sync with identical transaction
	run2, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run2.Status)

	txCount2 := len(uow.transactions)
	assert.Equal(t, 1, txCount2, "expected transaction deduplication on (account_id, external_id)")
}

func TestSyncService_InvalidCredentialsFailsRun(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	adapter := &MockSyncAdapter{
		provider:          "TEST_PROVIDER",
		testConnectionErr: syncservice.ErrInvalidCredentials,
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.Error(t, err)
	require.NotNil(t, run)
	assert.Equal(t, model.SyncRunStatusFailed, run.Status)

	// Credential marked invalid
	cred, _ := uow.Sync().GetCredentialByID(ctx, "cred-1")
	assert.Equal(t, model.SyncCredentialStatusInvalid, cred.Status)

	// Connection marked failed
	conn, _ := uow.Sync().GetConnectionByID(ctx, "conn-1")
	assert.Equal(t, model.SyncConnectionStatusFailed, conn.SyncStatus)
}

func TestSyncService_RegisterCredentialAndLinkAccount(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.portfolios["portfolio-1"] = &model.Portfolio{ID: "portfolio-1", UserID: "user-1", Name: "Main"}

	service := syncservice.NewSyncService(uow, nil)

	// Test RegisterCredential
	cred, err := service.RegisterCredential(ctx, "user-1", "KRAKEN", `{"apiKey":"k","apiSecret":"s"}`)
	require.NoError(t, err)
	require.NotNil(t, cred)
	assert.NotEmpty(t, cred.EncryptedData)

	// Create connection without account
	conn := &model.SyncConnection{
		ID:                    "conn-new",
		UserID:                "user-1",
		PortfolioID:           "portfolio-1",
		CredentialID:          cred.ID,
		Provider:              "KRAKEN",
		ExternalInstitutionID: "kraken",
		ExternalAccountID:     "ext-acc-1",
		InstitutionName:       "Kraken",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
	err = uow.Sync().CreateConnection(ctx, conn)
	require.NoError(t, err)

	// LinkAccount with autoCreate = true
	linkedConn, err := service.LinkAccount(ctx, conn.ID, "", true)
	require.NoError(t, err)
	require.NotNil(t, linkedConn)
	require.NotNil(t, linkedConn.AccountID)

	acc, err := uow.Account().GetByID(ctx, *linkedConn.AccountID)
	require.NoError(t, err)
	assert.Equal(t, "user-1", acc.UserID)
	assert.Equal(t, "KRAKEN", acc.SyncProvider)
}

func TestSyncService_LinkAccount_TenantIsolation(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()

	// Seed connection for user-1 in portfolio-1
	uow.portfolios["portfolio-1"] = &model.Portfolio{ID: "portfolio-1", UserID: "user-1"}
	conn := &model.SyncConnection{
		ID:                    "conn-1",
		UserID:                "user-1",
		PortfolioID:           "portfolio-1",
		CredentialID:          "cred-1",
		Provider:              "KRAKEN",
		ExternalInstitutionID: "kraken",
		ExternalAccountID:     "ext-acc-1",
		InstitutionName:       "Kraken",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
	_ = uow.Sync().CreateConnection(ctx, conn)

	// Seed account belonging to user-2 in portfolio-2
	alienAccount := &model.Account{
		ID:          "acc-alien",
		UserID:      "user-2",
		PortfolioID: "portfolio-2",
		Name:        "Alien Account",
	}
	_, _ = uow.Account().Create(ctx, alienAccount)

	service := syncservice.NewSyncService(uow, nil)

	// Attempt linking alien account must fail with unauthorized error
	_, err := service.LinkAccount(ctx, conn.ID, "acc-alien", false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unauthorized account linkage")
}

func TestSyncService_ResidualTaxLotCreationIsIdempotent(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	aaplAsset := &model.Asset{
		ID:          "asset-aapl",
		Symbol:      strPtr("AAPL"),
		Name:        "Apple Inc.",
		Type:        model.AssetTypeStock,
		IsTradeable: true,
	}
	uow.assets[aaplAsset.ID] = aaplAsset

	buyTx := &model.Transaction{
		ID:                "tx-hist-1",
		UserID:            "user-1",
		AccountID:         strPtr("acc-1"),
		PositionID:        strPtr("pos-aapl"),
		Type:              model.TransactionTypeBuy,
		Amount:            model.Money(30000),
		Quantity:          decPtr(decimal.NewFromInt(2)),
		UnitPriceAmount:   decPtr(decimal.NewFromInt(150)),
		UnitPriceCurrency: model.CurrencyUSD,
		ExecutedAt:        time.Now().Add(-30 * 24 * time.Hour),
	}
	uow.transactions[buyTx.ID] = buyTx

	pos := &model.Position{
		ID:                  "pos-aapl",
		PortfolioID:         "portfolio-1",
		AccountID:           "acc-1",
		AssetID:             aaplAsset.ID,
		Quantity:            decimal.NewFromInt(2),
		OwnershipPercentage: decimal.NewFromInt(100),
		QuoteCurrency:       model.CurrencyUSD,
	}
	uow.positions[pos.ID] = pos

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID:       "ext-aapl",
				Symbol:           "AAPL",
				Name:             "Apple Inc.",
				AssetType:        model.AssetTypeStock,
				Quantity:         decimal.NewFromInt(10),
				CostBasisPerUnit: decPtr(decimal.NewFromInt(150)),
				Currency:         model.CurrencyUSD,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	// First sync creates 1 baseline tax lot of 8 shares
	run1, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run1.Status)

	lots1, err := uow.TaxLot().FindByPositionID(ctx, pos.ID)
	require.NoError(t, err)
	assert.Len(t, lots1, 1, "expected exactly 1 baseline tax lot after sync 1")
	assert.True(t, lots1[0].RemainingQuantity.Equal(decimal.NewFromInt(8)))

	// Second sync with identical data must NOT create extra tax lots
	run2, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run2.Status)

	lots2, err := uow.TaxLot().FindByPositionID(ctx, pos.ID)
	require.NoError(t, err)
	assert.Len(t, lots2, 1, "expected STILL exactly 1 baseline tax lot after repeat sync (idempotency)")
	assert.True(t, lots2[0].RemainingQuantity.Equal(decimal.NewFromInt(8)))
}

func TestSyncService_CatalogMatchProvisionsRealAsset(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	// Pre-seed an Instrument in the catalog with ISIN
	catalogInst := &model.Instrument{
		ID:               "inst-aapl",
		NormalizedSymbol: "AAPL",
		NormalizedName:   "Apple Inc.",
		AssetType:        model.InstrumentAssetTypeStock,
		ProviderSource:   "EODHD",
		ISIN:             strPtr("US0378331005"),
	}
	uow.instruments[catalogInst.ID] = catalogInst

	// Asset repository initially has NO asset for AAPL
	assert.Empty(t, uow.assets)

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID: "ext-aapl",
				Symbol:     "AAPL",
				ISIN:       "US0378331005",
				Name:       "Apple Inc.",
				Quantity:   decimal.NewFromInt(15),
				Currency:   model.CurrencyUSD,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)
	assert.Nil(t, run.ErrorMessage, "should have no unmapped warnings since instrument was matched")

	// Asset was provisioned as a real tradeable asset linked to catalogInst.ID
	asset, err := uow.Asset().GetByInstrumentID(ctx, "inst-aapl")
	require.NoError(t, err)
	require.NotNil(t, asset)
	assert.Equal(t, "AAPL", *asset.Symbol)
	assert.Equal(t, "EODHD", *asset.MarketDataSource)
	assert.NotEqual(t, "UNMAPPED", *asset.MarketDataSource)
	assert.True(t, asset.IsTradeable)
}

// Helpers and in-memory Unit of Work for testing

func decPtr(d decimal.Decimal) *decimal.Decimal { return &d }
func strPtr(s string) *string                   { return &s }

type syncTestUOW struct {
	repository.IUnitOfWork
	users        map[string]*model.User
	portfolios   map[string]*model.Portfolio
	accounts     map[string]*model.Account
	assets       map[string]*model.Asset
	positions    map[string]*model.Position
	taxLots      map[string]*model.TaxLot
	transactions map[string]*model.Transaction
	credentials  map[string]*model.SyncCredential
	connections  map[string]*model.SyncConnection
	syncRuns     map[string]*model.SyncRun
	assetPrices  map[string]*model.AssetPrice
	instruments  map[string]*model.Instrument
}

func newSyncTestUOW() *syncTestUOW {
	return &syncTestUOW{
		users:        make(map[string]*model.User),
		portfolios:   make(map[string]*model.Portfolio),
		accounts:     make(map[string]*model.Account),
		assets:       make(map[string]*model.Asset),
		positions:    make(map[string]*model.Position),
		taxLots:      make(map[string]*model.TaxLot),
		transactions: make(map[string]*model.Transaction),
		credentials:  make(map[string]*model.SyncCredential),
		connections:  make(map[string]*model.SyncConnection),
		syncRuns:     make(map[string]*model.SyncRun),
		assetPrices:  make(map[string]*model.AssetPrice),
		instruments:  make(map[string]*model.Instrument),
	}
}

func (u *syncTestUOW) Do(ctx context.Context, fn func(uow repository.IUnitOfWork) error) error {
	return fn(u)
}

func (u *syncTestUOW) seedBaseEntities(userID, portfolioID, accountID, credID, connID, provider string) {
	u.users[userID] = &model.User{ID: userID}
	u.portfolios[portfolioID] = &model.Portfolio{ID: portfolioID, UserID: userID, Name: "Main Portfolio"}
	u.accounts[accountID] = &model.Account{
		ID:           accountID,
		UserID:       userID,
		PortfolioID:  portfolioID,
		Name:         "Main Account",
		Type:         model.AccountTypeBroker,
		TaxWrapper:   model.TaxWrapperStandardTaxable,
		Currency:     model.CurrencyEUR,
		SyncProvider: provider,
	}
	cred := &model.SyncCredential{
		ID:       credID,
		UserID:   userID,
		Provider: provider,
		RawData:  `{"apiKey":"test-key","apiSecret":"test-secret"}`,
		Status:   model.SyncCredentialStatusActive,
	}
	_ = cred.Encrypt()
	u.credentials[credID] = cred

	u.connections[connID] = &model.SyncConnection{
		ID:                    connID,
		UserID:                userID,
		PortfolioID:           portfolioID,
		CredentialID:          credID,
		AccountID:             &accountID,
		Provider:              provider,
		ExternalInstitutionID: "inst-1",
		ExternalAccountID:     "ext-acc-1",
		InstitutionName:       "Test Institution",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
}

// Repositories wiring for syncTestUOW
func (u *syncTestUOW) Sync() repository.ISyncRepository               { return &syncTestSyncRepo{u: u} }
func (u *syncTestUOW) Account() repository.IAccountRepository         { return &syncTestAccountRepo{u: u} }
func (u *syncTestUOW) Portfolio() repository.IPortfolioRepository     { return &syncTestPortfolioRepo{u: u} }
func (u *syncTestUOW) Asset() repository.IAssetRepository             { return &syncTestAssetRepo{u: u} }
func (u *syncTestUOW) Position() repository.IPositionRepository       { return &syncTestPositionRepo{u: u} }
func (u *syncTestUOW) TaxLot() repository.ITaxLotRepository           { return &syncTestTaxLotRepo{u: u} }
func (u *syncTestUOW) Transaction() repository.ITransactionRepository { return &syncTestTxRepo{u: u} }
func (u *syncTestUOW) AssetPrice() repository.IPriceRepository        { return &syncTestPriceRepo{u: u} }
func (u *syncTestUOW) Instrument() repository.IInstrumentRepository   { return &syncTestInstrumentRepo{u: u} }

type syncTestInstrumentRepo struct {
	repository.IInstrumentRepository
	u *syncTestUOW
}

func (r *syncTestInstrumentRepo) GetByGlobalIdentifier(ctx context.Context, field, value string) (*model.Instrument, error) {
	for _, inst := range r.u.instruments {
		if field == "isin" && inst.ISIN != nil && *inst.ISIN == value {
			return inst, nil
		}
	}
	return nil, repository.ErrNotFound
}

type syncTestSyncRepo struct {
	repository.ISyncRepository
	u *syncTestUOW
}

func (r *syncTestSyncRepo) CreateCredential(ctx context.Context, cred *model.SyncCredential) error {
	if cred.ID == "" {
		cred.ID = "cred-" + time.Now().Format("150405.000000")
	}
	r.u.credentials[cred.ID] = cred
	return nil
}

func (r *syncTestSyncRepo) GetCredentialByID(ctx context.Context, id string) (*model.SyncCredential, error) {
	if c, ok := r.u.credentials[id]; ok {
		return c, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) UpdateCredential(ctx context.Context, cred *model.SyncCredential) error {
	r.u.credentials[cred.ID] = cred
	return nil
}

func (r *syncTestSyncRepo) CreateConnection(ctx context.Context, conn *model.SyncConnection) error {
	if conn.ID == "" {
		conn.ID = "conn-" + time.Now().Format("150405.000000")
	}
	r.u.connections[conn.ID] = conn
	return nil
}

func (r *syncTestSyncRepo) GetConnectionByID(ctx context.Context, id string) (*model.SyncConnection, error) {
	if c, ok := r.u.connections[id]; ok {
		return c, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) GetConnectionByAccountID(ctx context.Context, accountID string) (*model.SyncConnection, error) {
	for _, c := range r.u.connections {
		if c.AccountID != nil && *c.AccountID == accountID {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) ListCredentialsByUser(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
	var res []*model.SyncCredential
	for _, c := range r.u.credentials {
		if c.UserID == userID || (c.IsSystem && c.UserID == "") {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *syncTestSyncRepo) ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	var res []*model.SyncConnection
	for _, c := range r.u.connections {
		if c.PortfolioID == portfolioID {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *syncTestSyncRepo) UpdateConnection(ctx context.Context, conn *model.SyncConnection) error {
	r.u.connections[conn.ID] = conn
	return nil
}

func (r *syncTestSyncRepo) CreateSyncRun(ctx context.Context, run *model.SyncRun) error {
	if run.ID == "" {
		run.ID = "run-" + time.Now().Format("150405.000000")
	}
	r.u.syncRuns[run.ID] = run
	return nil
}

func (r *syncTestSyncRepo) UpdateSyncRun(ctx context.Context, run *model.SyncRun) error {
	r.u.syncRuns[run.ID] = run
	return nil
}

func (r *syncTestSyncRepo) GetSyncRunByID(ctx context.Context, id string) (*model.SyncRun, error) {
	if run, ok := r.u.syncRuns[id]; ok {
		return run, nil
	}
	return nil, repository.ErrNotFound
}

type syncTestAccountRepo struct {
	repository.IAccountRepository
	u *syncTestUOW
}

func (r *syncTestAccountRepo) Create(ctx context.Context, acc *model.Account) (*model.Account, error) {
	if acc.ID == "" {
		acc.ID = "acc-" + time.Now().Format("150405.000000")
	}
	r.u.accounts[acc.ID] = acc
	return acc, nil
}

func (r *syncTestAccountRepo) GetByID(ctx context.Context, id string) (*model.Account, error) {
	if a, ok := r.u.accounts[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAccountRepo) Update(ctx context.Context, acc *model.Account) error {
	r.u.accounts[acc.ID] = acc
	return nil
}

type syncTestPortfolioRepo struct {
	repository.IPortfolioRepository
	u *syncTestUOW
}

func (r *syncTestPortfolioRepo) GetByID(ctx context.Context, id string) (*model.Portfolio, error) {
	if p, ok := r.u.portfolios[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

type syncTestAssetRepo struct {
	repository.IAssetRepository
	u *syncTestUOW
}

func (r *syncTestAssetRepo) Create(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	if asset.ID == "" {
		asset.ID = "asset-" + time.Now().Format("150405.000000")
	}
	r.u.assets[asset.ID] = asset
	return asset, nil
}

func (r *syncTestAssetRepo) GetByID(ctx context.Context, id string) (*model.Asset, error) {
	if a, ok := r.u.assets[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAssetRepo) GetBySymbol(ctx context.Context, symbol string) (*model.Asset, error) {
	for _, a := range r.u.assets {
		if a.Symbol != nil && *a.Symbol == symbol {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAssetRepo) GetByInstrumentID(ctx context.Context, instID string) (*model.Asset, error) {
	for _, a := range r.u.assets {
		if a.InstrumentID != nil && *a.InstrumentID == instID {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAssetRepo) UpsertTradeable(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	if asset.ID == "" {
		asset.ID = "asset-" + time.Now().Format("150405.000000")
	}
	r.u.assets[asset.ID] = asset
	return asset, nil
}

type syncTestPositionRepo struct {
	repository.IPositionRepository
	u *syncTestUOW
}

func (r *syncTestPositionRepo) Create(ctx context.Context, pos *model.Position) (*model.Position, error) {
	if pos.ID == "" {
		pos.ID = "pos-" + time.Now().Format("150405.000000")
	}
	r.u.positions[pos.ID] = pos
	return pos, nil
}

func (r *syncTestPositionRepo) GetByID(ctx context.Context, id string) (*model.Position, error) {
	if p, ok := r.u.positions[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestPositionRepo) Update(ctx context.Context, pos *model.Position) error {
	r.u.positions[pos.ID] = pos
	return nil
}

func (r *syncTestPositionRepo) GetByAccountAndAsset(ctx context.Context, accountID, assetID string) (*model.Position, error) {
	for _, p := range r.u.positions {
		if p.AccountID == accountID && p.AssetID == assetID {
			return p, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestPositionRepo) GetPortfolioPositions(ctx context.Context, portfolioID string) ([]model.Position, error) {
	var res []model.Position
	for _, p := range r.u.positions {
		if p.PortfolioID == portfolioID {
			res = append(res, *p)
		}
	}
	return res, nil
}

type syncTestTaxLotRepo struct {
	repository.ITaxLotRepository
	u *syncTestUOW
}

func (r *syncTestTaxLotRepo) Create(ctx context.Context, lot *model.TaxLot) (*model.TaxLot, error) {
	if lot.ID == "" {
		lot.ID = "lot-" + time.Now().Format("150405.000000")
	}
	r.u.taxLots[lot.ID] = lot
	return lot, nil
}

func (r *syncTestTaxLotRepo) FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	var res []*model.TaxLot
	for _, l := range r.u.taxLots {
		if l.PositionID == positionID {
			res = append(res, l)
		}
	}
	return res, nil
}

func (r *syncTestTaxLotRepo) FindOpenByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	var res []*model.TaxLot
	for _, l := range r.u.taxLots {
		if l.PositionID == positionID && l.Status != model.TaxLotStatusClosed {
			res = append(res, l)
		}
	}
	return res, nil
}

type syncTestTxRepo struct {
	repository.ITransactionRepository
	u *syncTestUOW
}

func (r *syncTestTxRepo) Create(ctx context.Context, tx *model.Transaction) (*model.Transaction, error) {
	if tx.ID == "" {
		tx.ID = "tx-" + time.Now().Format("150405.000000")
	}
	r.u.transactions[tx.ID] = tx
	return tx, nil
}

func (r *syncTestTxRepo) FindByPositionID(ctx context.Context, positionID string) ([]model.Transaction, error) {
	var res []model.Transaction
	for _, t := range r.u.transactions {
		if t.PositionID != nil && *t.PositionID == positionID {
			res = append(res, *t)
		}
	}
	return res, nil
}

func (r *syncTestTxRepo) FindByAccountAndExternalID(ctx context.Context, accountID, externalID string) (*model.Transaction, error) {
	for _, t := range r.u.transactions {
		if t.AccountID != nil && *t.AccountID == accountID && t.ExternalID != nil && *t.ExternalID == externalID {
			return t, nil
		}
	}
	return nil, repository.ErrNotFound
}

type syncTestPriceRepo struct {
	repository.IPriceRepository
	u *syncTestUOW
}

func (r *syncTestPriceRepo) UpsertPrices(ctx context.Context, prices []model.AssetPrice) error {
	for i := range prices {
		r.u.assetPrices[prices[i].AssetID] = &prices[i]
	}
	return nil
}
