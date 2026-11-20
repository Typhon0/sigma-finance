package sync_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
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

func (m *MockSyncAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.BalancesSnapshot, error) {
	if m.fetchBalancesErr != nil {
		return syncservice.BalancesSnapshot{}, m.fetchBalancesErr
	}
	return syncservice.BalancesSnapshot{
		Balances:   m.rawBalances,
		IsComplete: true,
		AsOf:       time.Now(),
	}, nil
}

func (m *MockSyncAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.HoldingsSnapshot, error) {
	if m.fetchHoldingsErr != nil {
		return syncservice.HoldingsSnapshot{}, m.fetchHoldingsErr
	}
	return syncservice.HoldingsSnapshot{
		Holdings:       m.rawHoldings,
		IsComplete:     true,
		PaginationDone: true,
		AsOf:           time.Now(),
	}, nil
}

func (m *MockSyncAdapter) FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time, cursors syncservice.StreamCursors) (syncservice.TransactionsSnapshot, error) {
	if m.fetchTxErr != nil {
		return syncservice.TransactionsSnapshot{}, m.fetchTxErr
	}
	return syncservice.TransactionsSnapshot{
		Transactions:   m.rawTransactions,
		IsComplete:     true,
		PaginationDone: true,
	}, nil
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

func TestSyncService_PlaceholderTaxLotDisappearsWhenHistoryExplainsTheHolding(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	btcAsset := &model.Asset{ID: "asset-btc", Symbol: strPtr("BTC"), Name: "Bitcoin", Type: model.AssetTypeCrypto, IsTradeable: true}
	uow.assets[btcAsset.ID] = btcAsset

	holding := decimal.RequireFromString("0.08330202")
	pos := &model.Position{
		ID:                  "pos-btc",
		PortfolioID:         "portfolio-1",
		AccountID:           "acc-1",
		AssetID:             btcAsset.ID,
		Quantity:            holding,
		OwnershipPercentage: decimal.NewFromInt(100),
		QuoteCurrency:       model.CurrencyEUR,
	}
	uow.positions[pos.ID] = pos

	// What a truncated ledger import left behind: no transactions at all, and a
	// placeholder lot covering the whole holding, dated at the sync.
	uow.taxLots["lot-btc-placeholder"] = &model.TaxLot{
		ID:                "lot-btc-placeholder",
		PortfolioID:       "portfolio-1",
		PositionID:        pos.ID,
		AssetID:           btcAsset.ID,
		AcquiredAt:        time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC),
		InitialQuantity:   holding,
		RemainingQuantity: holding,
		CostBasisPerUnit:  decimal.Zero,
		TotalCostBasis:    0,
		Currency:          model.CurrencyEUR,
		Status:            model.TaxLotStatusOpen,
	}

	boughtAt := time.Date(2024, 11, 5, 9, 30, 0, 0, time.UTC)
	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{ExternalID: "ext-btc", Symbol: "BTC", Name: "Bitcoin", AssetType: model.AssetTypeCrypto, Quantity: holding, Currency: model.CurrencyEUR},
		},
		rawTransactions: []syncservice.RawTransaction{
			{
				ExternalID:        "kraken-buy-btc",
				Type:              model.TransactionTypeBuy,
				Symbol:            "BTC",
				Name:              "BTC",
				Quantity:          &holding,
				UnitPriceAmount:   decPtr(decimal.NewFromInt(80000)),
				UnitPriceCurrency: model.CurrencyEUR,
				Amount:            model.Money(6664162),
				Currency:          model.CurrencyEUR,
				ExecutedAt:        boughtAt,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	require.Equal(t, model.SyncRunStatusCompleted, run.Status)

	lots, err := uow.TaxLot().FindByPositionID(ctx, pos.ID)
	require.NoError(t, err)
	require.Len(t, lots, 1, "the imported buy must replace the placeholder lot, not stack on top of it")

	assert.NotNil(t, lots[0].TransactionID)
	assert.True(t, boughtAt.Equal(lots[0].AcquiredAt), "the lot must carry the Kraken buy date, got %s", lots[0].AcquiredAt)
	assert.True(t, holding.Equal(lots[0].RemainingQuantity))
}

func TestSyncService_PlaceholderTaxLotTracksTheUnexplainedQuantity(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	btcAsset := &model.Asset{ID: "asset-btc", Symbol: strPtr("BTC"), Name: "Bitcoin", Type: model.AssetTypeCrypto, IsTradeable: true}
	uow.assets[btcAsset.ID] = btcAsset

	pos := &model.Position{
		ID:                  "pos-btc",
		PortfolioID:         "portfolio-1",
		AccountID:           "acc-1",
		AssetID:             btcAsset.ID,
		Quantity:            decimal.NewFromInt(1),
		OwnershipPercentage: decimal.NewFromInt(100),
		QuoteCurrency:       model.CurrencyEUR,
	}
	uow.positions[pos.ID] = pos

	boughtAt := time.Date(2024, 3, 4, 10, 0, 0, 0, time.UTC)

	// 0.4 BTC are explained by an imported buy with its own lot.
	uow.transactions["tx-btc-buy"] = &model.Transaction{
		ID:                "tx-btc-buy",
		UserID:            "user-1",
		AccountID:         strPtr("acc-1"),
		PositionID:        strPtr(pos.ID),
		Type:              model.TransactionTypeBuy,
		Amount:            model.Money(1200000),
		Quantity:          decPtr(decimal.RequireFromString("0.4")),
		UnitPriceAmount:   decPtr(decimal.NewFromInt(30000)),
		UnitPriceCurrency: model.CurrencyEUR,
		ExternalID:        strPtr("kraken-buy-btc"),
		ExecutedAt:        boughtAt,
	}
	uow.taxLots["lot-btc-buy"] = &model.TaxLot{
		ID:                "lot-btc-buy",
		PortfolioID:       "portfolio-1",
		PositionID:        pos.ID,
		AssetID:           btcAsset.ID,
		TransactionID:     strPtr("tx-btc-buy"),
		AcquiredAt:        boughtAt,
		InitialQuantity:   decimal.RequireFromString("0.4"),
		RemainingQuantity: decimal.RequireFromString("0.4"),
		CostBasisPerUnit:  decimal.NewFromInt(30000),
		TotalCostBasis:    model.Money(1200000),
		Currency:          model.CurrencyEUR,
		Status:            model.TaxLotStatusOpen,
	}

	// The remaining 0.6 are unexplained, so the placeholder survives but must
	// shrink to that residual and stop claiming the sync date.
	uow.taxLots["lot-btc-placeholder"] = &model.TaxLot{
		ID:                "lot-btc-placeholder",
		PortfolioID:       "portfolio-1",
		PositionID:        pos.ID,
		AssetID:           btcAsset.ID,
		AcquiredAt:        time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC),
		InitialQuantity:   decimal.NewFromInt(1),
		RemainingQuantity: decimal.NewFromInt(1),
		CostBasisPerUnit:  decimal.Zero,
		TotalCostBasis:    0,
		Currency:          model.CurrencyEUR,
		Status:            model.TaxLotStatusOpen,
	}

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawHoldings: []syncservice.RawHolding{
			{ExternalID: "ext-btc", Symbol: "BTC", Name: "Bitcoin", AssetType: model.AssetTypeCrypto, Quantity: decimal.NewFromInt(1), Currency: model.CurrencyEUR},
		},
		rawTransactions: []syncservice.RawTransaction{
			{
				ExternalID:        "kraken-buy-btc",
				Type:              model.TransactionTypeBuy,
				Symbol:            "BTC",
				Name:              "BTC",
				Quantity:          decPtr(decimal.RequireFromString("0.4")),
				UnitPriceAmount:   decPtr(decimal.NewFromInt(30000)),
				UnitPriceCurrency: model.CurrencyEUR,
				Amount:            model.Money(1200000),
				Currency:          model.CurrencyEUR,
				ExecutedAt:        boughtAt,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	_, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)

	lots, err := uow.TaxLot().FindByPositionID(ctx, pos.ID)
	require.NoError(t, err)
	require.Len(t, lots, 2)

	var baseline *model.TaxLot
	for _, lot := range lots {
		if lot.TransactionID == nil {
			baseline = lot
		}
	}
	require.NotNil(t, baseline)
	assert.Equal(t, "lot-btc-placeholder", baseline.ID, "the existing placeholder must be updated, not duplicated")
	assert.True(t, baseline.RemainingQuantity.Equal(decimal.RequireFromString("0.6")), "expected 0.6 unexplained, got %s", baseline.RemainingQuantity.String())
	assert.True(t, boughtAt.Equal(baseline.AcquiredAt), "the placeholder must borrow the earliest buy date, got %s", baseline.AcquiredAt)

	// Repeating the sync must not stack another placeholder on top.
	_, err = service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	lots, err = uow.TaxLot().FindByPositionID(ctx, pos.ID)
	require.NoError(t, err)
	require.Len(t, lots, 2)
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

func TestSyncService_RegisterCredential_PortfolioScoped(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.portfolios["portfolio-1"] = &model.Portfolio{ID: "portfolio-1", UserID: "user-1", Name: "Loic"}
	uow.portfolios["portfolio-2"] = &model.Portfolio{ID: "portfolio-2", UserID: "user-1", Name: "Emma"}

	service := syncservice.NewSyncService(uow, nil)

	p1 := "portfolio-1"
	p2 := "portfolio-2"

	// Register credential for portfolio-1
	cred1, err := service.RegisterCredential(ctx, "user-1", "KRAKEN", `{"apiKey":"k1","apiSecret":"s1"}`, &p1)
	require.NoError(t, err)
	require.NotNil(t, cred1)
	require.NotNil(t, cred1.PortfolioID)
	assert.Equal(t, "portfolio-1", *cred1.PortfolioID)

	// Register different credential for portfolio-2
	cred2, err := service.RegisterCredential(ctx, "user-1", "KRAKEN", `{"apiKey":"k2","apiSecret":"s2"}`, &p2)
	require.NoError(t, err)
	require.NotNil(t, cred2)
	require.NotNil(t, cred2.PortfolioID)
	assert.Equal(t, "portfolio-2", *cred2.PortfolioID)

	// They must have distinct IDs and not overwrite each other
	assert.NotEqual(t, cred1.ID, cred2.ID)
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

func TestSyncService_DiscoverAndCreateConnections(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawAccounts: []syncservice.RawAccount{
			{
				ExternalID:    "ext-acc-broker-1",
				Name:          "Primary Brokerage",
				Type:          model.AccountTypeBroker,
				Institution:   "Test Broker",
				AccountNumber: "12345678",
				Currency:      model.CurrencyEUR,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	conns, err := service.DiscoverAndCreateConnections(ctx, "user-1", "portfolio-1", "TEST_PROVIDER")
	require.NoError(t, err)
	require.Len(t, conns, 1)

	conn := conns[0]
	assert.Equal(t, "user-1", conn.UserID)
	assert.Equal(t, "portfolio-1", conn.PortfolioID)
	assert.Equal(t, "TEST_PROVIDER", conn.Provider)
	assert.Equal(t, "ext-acc-broker-1", conn.ExternalAccountID)
	require.NotNil(t, conn.AccountID, "should have auto-provisioned and linked account")

	acc, err := uow.Account().GetByID(ctx, *conn.AccountID)
	require.NoError(t, err)
	assert.Equal(t, "Primary Brokerage", acc.Name)
	assert.Equal(t, model.AccountTypeBroker, acc.Type)
}

func TestSyncService_CompleteAggregatorAuth_PortfolioID(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawAccounts: []syncservice.RawAccount{
			{
				ExternalID:  "ext-acc-99",
				Name:        "Aggregator Discovered Account",
				Type:        model.AccountTypeBroker,
				Institution: "Test Broker",
				Currency:    model.CurrencyEUR,
			},
		},
		rawBalances: []syncservice.RawBalance{
			{
				Currency: model.CurrencyEUR,
				Amount:   decimal.NewFromInt(500),
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	// CompleteAggregatorAuth with portfolio ID "portfolio-1"
	conns, err := service.CompleteAggregatorAuth(ctx, "user-1", "portfolio-1", "cred-1")
	require.NoError(t, err)
	require.NotEmpty(t, conns)

	var discoveredConn *model.SyncConnection
	for _, c := range conns {
		if c.ExternalAccountID == "ext-acc-99" {
			discoveredConn = c
			break
		}
	}
	require.NotNil(t, discoveredConn)
	assert.Equal(t, model.SyncConnectionStatusSuccess, discoveredConn.SyncStatus)
}

func TestSyncService_TriggerSync_ConcurrencyProtection(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	// Set connection to SYNCING recently
	conn, err := uow.Sync().GetConnectionByID(ctx, "conn-1")
	require.NoError(t, err)
	conn.SyncStatus = model.SyncConnectionStatusSyncing
	conn.UpdatedAt = time.Now().Add(-1 * time.Minute)
	_ = uow.Sync().UpdateConnection(ctx, conn)

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(&MockSyncAdapter{provider: "TEST_PROVIDER"})

	run, err := service.TriggerSync(ctx, "conn-1")
	require.Error(t, err)
	assert.Nil(t, run)
	assert.Contains(t, err.Error(), "sync is already in progress")
}

func TestSyncService_MultiCurrencyCashLiquidation(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	service := syncservice.NewSyncService(uow, nil)

	// First sync with EUR and USD cash
	adapter1 := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawBalances: []syncservice.RawBalance{
			{Currency: model.CurrencyEUR, Amount: decimal.NewFromInt(100)},
			{Currency: model.CurrencyUSD, Amount: decimal.NewFromInt(200)},
		},
	}
	service.RegisterAdapter(adapter1)

	run1, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run1.Status)

	positions1, err := uow.Position().GetPortfolioPositions(ctx, "portfolio-1")
	require.NoError(t, err)
	require.Len(t, positions1, 2)
	for _, p := range positions1 {
		assert.True(t, p.Quantity.Equal(decimal.NewFromInt(1)))
		assert.NotNil(t, p.AverageCostBasis)
	}

	// Second sync with EUR only (USD liquidated)
	adapter2 := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawBalances: []syncservice.RawBalance{
			{Currency: model.CurrencyEUR, Amount: decimal.NewFromInt(150)},
		},
	}
	service.RegisterAdapter(adapter2)

	run2, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run2.Status)

	positions2, err := uow.Position().GetPortfolioPositions(ctx, "portfolio-1")
	require.NoError(t, err)
	require.Len(t, positions2, 2)

	for _, p := range positions2 {
		if p.QuoteCurrency == model.CurrencyUSD {
			assert.True(t, p.Quantity.IsZero(), "USD cash position should be liquidated to 0")
			assert.Nil(t, p.AverageCostBasis)
			assert.Nil(t, p.TotalCostBasis)
		} else if p.QuoteCurrency == model.CurrencyEUR {
			assert.True(t, p.Quantity.Equal(decimal.NewFromInt(1)))
			require.NotNil(t, p.AverageCostBasis)
			assert.True(t, p.AverageCostBasis.Equal(decimal.NewFromInt(150)))
		}
	}
}

func TestSyncService_NegativeCashBalanceOverdraft(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	service := syncservice.NewSyncService(uow, nil)
	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawBalances: []syncservice.RawBalance{
			{Currency: model.CurrencyEUR, Amount: decimal.NewFromInt(-75)},
		},
	}
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	positions, err := uow.Position().GetPortfolioPositions(ctx, "portfolio-1")
	require.NoError(t, err)
	require.Len(t, positions, 1)

	pos := positions[0]
	assert.True(t, pos.Quantity.Equal(decimal.NewFromInt(1)))
	require.NotNil(t, pos.AverageCostBasis)
	assert.True(t, pos.AverageCostBasis.IsZero(), "overdraft AverageCostBasis must be clamped to 0")
	require.NotNil(t, pos.TotalCostBasis)
	assert.Equal(t, model.Money(0), *pos.TotalCostBasis, "overdraft TotalCostBasis must be clamped to 0")
	require.NoError(t, pos.Validate(), "Position.Validate() must pass for clamped overdraft")
}

func TestSyncService_ReconcileBalances_ZeroAndNegative(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	service := syncservice.NewSyncService(uow, nil)
	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawBalances: []syncservice.RawBalance{
			{Currency: model.CurrencyEUR, Amount: decimal.NewFromInt(100)}, // Positive balance -> price upserted
			{Currency: model.CurrencyUSD, Amount: decimal.Zero},            // Zero balance -> no price upsert
			{Currency: model.CurrencyGBP, Amount: decimal.NewFromInt(-25)}, // Negative balance -> no price upsert
		},
	}
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Check EUR (positive balance): price upserted
	eurAssetSymbol := "EUR_CASH_acc-1"
	eurAssets, err := uow.Asset().FindWithFilters(ctx, repository.AssetFilter{Symbol: &eurAssetSymbol})
	require.NoError(t, err)
	require.Len(t, eurAssets, 1)
	assert.NotNil(t, uow.assetPrices[eurAssets[0].ID])
	assert.True(t, uow.assetPrices[eurAssets[0].ID].Price.Equal(decimal.NewFromInt(100)))

	// Check USD (zero balance): position created with qty=0, but NO price upsert
	usdAssetSymbol := "USD_CASH_acc-1"
	usdAssets, err := uow.Asset().FindWithFilters(ctx, repository.AssetFilter{Symbol: &usdAssetSymbol})
	require.NoError(t, err)
	require.Len(t, usdAssets, 1)
	assert.Nil(t, uow.assetPrices[usdAssets[0].ID], "Zero balance cash asset must not have price in asset_prices")
	usdPos, err := uow.Position().GetByAccountAndAsset(ctx, "acc-1", usdAssets[0].ID)
	require.NoError(t, err)
	require.NotNil(t, usdPos)
	assert.True(t, usdPos.Quantity.IsZero())

	// Check GBP (negative balance): position created with clamped cost basis, but NO price upsert
	gbpAssetSymbol := "GBP_CASH_acc-1"
	gbpAssets, err := uow.Asset().FindWithFilters(ctx, repository.AssetFilter{Symbol: &gbpAssetSymbol})
	require.NoError(t, err)
	require.Len(t, gbpAssets, 1)
	assert.Nil(t, uow.assetPrices[gbpAssets[0].ID], "Negative balance cash asset must not have price in asset_prices")
	gbpPos, err := uow.Position().GetByAccountAndAsset(ctx, "acc-1", gbpAssets[0].ID)
	require.NoError(t, err)
	require.NotNil(t, gbpPos)
	assert.True(t, gbpPos.Quantity.Equal(decimal.NewFromInt(1)))
	assert.True(t, gbpPos.AverageCostBasis.IsZero())
}

func TestSyncService_ReconcileTransactions_ISINFallback(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	// Seed Instrument and Asset
	inst := &model.Instrument{
		ID:               "inst-vwce",
		NormalizedSymbol: "VWCE",
		NormalizedName:   "Vanguard FTSE All-World",
		ISIN:             strPtr("IE00BK5BQT80"),
	}
	uow.instruments[inst.ID] = inst

	asset := &model.Asset{
		ID:           "asset-vwce",
		InstrumentID: strPtr("inst-vwce"),
		Symbol:       strPtr("VWCE"),
		Name:         "Vanguard FTSE All-World",
		Type:         model.AssetTypeFund,
		IsTradeable:  true,
	}
	uow.assets[asset.ID] = asset

	pos := &model.Position{
		ID:                  "pos-vwce",
		PortfolioID:         "portfolio-1",
		AccountID:           "acc-1",
		AssetID:             asset.ID,
		Quantity:            decimal.NewFromInt(5),
		OwnershipPercentage: decimal.NewFromInt(100),
	}
	uow.positions[pos.ID] = pos

	service := syncservice.NewSyncService(uow, nil)
	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawTransactions: []syncservice.RawTransaction{
			{
				ExternalID: "tx-isin-1",
				Type:       model.TransactionTypeBuy,
				Symbol:     "", // Empty symbol!
				ISIN:       "IE00BK5BQT80",
				Quantity:   decPtr(decimal.NewFromInt(2)),
				Amount:     model.Money(20000),
				ExecutedAt: time.Now(),
			},
		},
	}
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	tx, err := uow.Transaction().FindByAccountAndExternalID(ctx, "acc-1", "tx-isin-1")
	require.NoError(t, err)
	require.NotNil(t, tx)
	require.NotNil(t, tx.PositionID)
	assert.Equal(t, pos.ID, *tx.PositionID)
}

func TestSyncService_ReconcileTransactions_ZeroAmountSkipped(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "TEST_PROVIDER")

	service := syncservice.NewSyncService(uow, nil)
	adapter := &MockSyncAdapter{
		provider: "TEST_PROVIDER",
		rawTransactions: []syncservice.RawTransaction{
			{
				ExternalID: "tx-zero-1",
				Type:       model.TransactionTypeDeposit,
				Amount:     model.Money(0), // Zero-amount pre-authorization!
				ExecutedAt: time.Now(),
			},
			{
				ExternalID: "tx-valid-1",
				Type:       model.TransactionTypeDeposit,
				Amount:     model.Money(5000), // €50.00
				ExecutedAt: time.Now(),
			},
		},
	}
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// tx-zero-1 must be skipped and not inserted into transactions repository
	zeroTx, err := uow.Transaction().FindByAccountAndExternalID(ctx, "acc-1", "tx-zero-1")
	assert.ErrorIs(t, err, repository.ErrNotFound)
	assert.Nil(t, zeroTx)

	// tx-valid-1 must be inserted
	validTx, err := uow.Transaction().FindByAccountAndExternalID(ctx, "acc-1", "tx-valid-1")
	require.NoError(t, err)
	require.NotNil(t, validTx)
	assert.Equal(t, model.Money(5000), validTx.Amount)
}

func TestSyncService_DiscoverAndCreateConnections_DuplicateNameSuffixing(t *testing.T) {
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-main", "cred-snaptrade", "conn-main", "SNAPTRADE")

	service := syncservice.NewSyncService(uow, nil)
	adapter := &MockSyncAdapter{
		provider: "SNAPTRADE",
		rawAccounts: []syncservice.RawAccount{
			{
				ExternalID:  "tr-cto-1111",
				Name:        "Trade Republic",
				Type:        model.AccountTypeBroker,
				Currency:    model.CurrencyEUR,
				Institution: "Trade Republic",
			},
			{
				ExternalID:  "tr-pea-2222",
				Name:        "Trade Republic",
				Type:        model.AccountTypeBroker,
				Currency:    model.CurrencyEUR,
				Institution: "Trade Republic",
			},
		},
	}
	service.RegisterAdapter(adapter)

	conns, err := service.DiscoverAndCreateConnections(ctx, "user-1", "portfolio-1", "SNAPTRADE")
	require.NoError(t, err)
	require.Len(t, conns, 2)

	acc1, err := uow.Account().GetByID(ctx, *conns[0].AccountID)
	require.NoError(t, err)
	acc2, err := uow.Account().GetByID(ctx, *conns[1].AccountID)
	require.NoError(t, err)

	assert.Equal(t, "Trade Republic", acc1.Name)
	assert.Equal(t, "Trade Republic (2222)", acc2.Name)
}

func TestSyncService_Reconciliation_MultiAccountQuantityAggregation(t *testing.T) {
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-snaptrade", "conn-1", "SNAPTRADE")

	// Create second account and connection in same portfolio
	acc2 := &model.Account{
		ID:           "acc-2",
		UserID:       "user-1",
		PortfolioID:  "portfolio-1",
		Name:         "Trade Republic (2222)",
		Type:         model.AccountTypeBroker,
		Currency:     model.CurrencyEUR,
		SyncProvider: "SNAPTRADE",
	}
	_, _ = uow.Account().Create(ctx, acc2)

	conn2 := &model.SyncConnection{
		ID:                "conn-2",
		UserID:            "user-1",
		PortfolioID:       "portfolio-1",
		CredentialID:      "cred-snaptrade",
		AccountID:         strPtr("acc-2"),
		Provider:          "SNAPTRADE",
		ExternalAccountID: "tr-pea-2222",
		InstitutionName:   "Trade Republic",
		SyncStatus:        model.SyncConnectionStatusIdle,
	}
	_ = uow.Sync().CreateConnection(ctx, conn2)

	// Single shared Asset (e.g. Apple)
	aaplAsset := &model.Asset{
		ID:     "asset-aapl",
		Type:   model.AssetTypeStock,
		Name:   "Apple Inc.",
		Symbol: strPtr("AAPL"),
	}
	uow.assets[aaplAsset.ID] = aaplAsset

	service := syncservice.NewSyncService(uow, nil)

	// Sync conn-1 with 10 AAPL
	adapter1 := &MockSyncAdapter{
		provider: "SNAPTRADE",
		rawHoldings: []syncservice.RawHolding{
			{
				Symbol:           "AAPL",
				Quantity:         decimal.NewFromInt(10),
				CostBasisPerUnit: decPtr(decimal.NewFromInt(150)),
				Currency:         model.CurrencyUSD,
			},
		},
	}
	service.RegisterAdapter(adapter1)
	run1, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run1.Status)

	pa1, err := uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, "portfolio-1", aaplAsset.ID)
	require.NoError(t, err)
	assert.Equal(t, float64(10), pa1.Quantity)

	// Sync conn-2 with 5 AAPL
	adapter2 := &MockSyncAdapter{
		provider: "SNAPTRADE",
		rawHoldings: []syncservice.RawHolding{
			{
				Symbol:           "AAPL",
				Quantity:         decimal.NewFromInt(5),
				CostBasisPerUnit: decPtr(decimal.NewFromInt(180)),
				Currency:         model.CurrencyUSD,
			},
		},
	}
	service.RegisterAdapter(adapter2)
	run2, err := service.TriggerSync(ctx, "conn-2")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run2.Status)

	// Check that portfolio_asset now has 10 + 5 = 15 total quantity!
	pa2, err := uow.PortfolioAsset().FindByPortfolioAndAsset(ctx, "portfolio-1", aaplAsset.ID)
	require.NoError(t, err)
	assert.Equal(t, float64(15), pa2.Quantity)
	// Weighted average price: (10*150 + 5*180) / 15 = (1500 + 900) / 15 = 2400 / 15 = 160
	assert.Equal(t, float64(160), pa2.AveragePurchasePrice)
}

func TestSyncService_CryptoInstrumentMatchingDoesNotMatchStock(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "KRAKEN")

	// Stock instrument named FLR exists in catalog
	stockInst := &model.Instrument{
		ID:               "inst-flr-stock",
		NormalizedSymbol: "FLR",
		NormalizedName:   "Fluor Corporation",
		AssetType:        model.InstrumentAssetTypeStock,
		ProviderSource:   "financedatabase",
	}
	uow.instruments[stockInst.ID] = stockInst

	// Adapter returns crypto holding for FLR
	adapter := &MockSyncAdapter{
		provider: "KRAKEN",
		rawHoldings: []syncservice.RawHolding{
			{
				Symbol:    "FLR",
				AssetType: model.AssetTypeCrypto,
				Quantity:  decimal.NewFromFloat(182.60),
				Currency:  model.CurrencyUSD,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Verify the created position's asset is CRYPTO and NOT linked to the stock instrument
	positions, err := uow.Position().GetPortfolioPositions(ctx, "portfolio-1")
	require.NoError(t, err)
	require.Len(t, positions, 1)

	asset := positions[0].Asset
	if asset == nil {
		asset, err = uow.Asset().GetByID(ctx, positions[0].AssetID)
		require.NoError(t, err)
	}

	assert.Equal(t, model.AssetTypeCrypto, asset.Type, "crypto holding must NOT be assigned AssetTypeStock")
	assert.NotEqual(t, "inst-flr-stock", asset.InstrumentID, "crypto holding must NOT be linked to stock instrument")
}

func TestSyncService_RepeatedCashSyncDoesNotDuplicateCashAsset(t *testing.T) {
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	ctx := context.Background()
	uow := newSyncTestUOW()
	uow.seedBaseEntities("user-1", "portfolio-1", "acc-1", "cred-1", "conn-1", "KRAKEN")

	adapter := &MockSyncAdapter{
		provider: "KRAKEN",
		rawBalances: []syncservice.RawBalance{
			{
				Currency: model.CurrencyEUR,
				Amount:   decimal.NewFromFloat(150.00),
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	// First sync
	run1, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run1.Status)

	// Second sync
	run2, err := service.TriggerSync(ctx, "conn-1")
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run2.Status)

	// Check total assets created
	symbol := "EUR_CASH_acc-1"
	cashAssets, err := uow.Asset().FindWithFilters(ctx, repository.AssetFilter{Symbol: &symbol})
	require.NoError(t, err)
	assert.Len(t, cashAssets, 1, "repeated cash sync must reuse existing cash asset, not create duplicates")
}

// Helpers and in-memory Unit of Work for testing

func decPtr(d decimal.Decimal) *decimal.Decimal { return &d }
func strPtr(s string) *string                   { return &s }

type syncTestUOW struct {
	repository.IUnitOfWork
	idSeq int
	// mu guards the maps below: TriggerSync fans out into goroutines that
	// outlive the test that started them.
	mu                 sync.Mutex
	users              map[string]*model.User
	portfolios         map[string]*model.Portfolio
	accounts           map[string]*model.Account
	assets             map[string]*model.Asset
	positions          map[string]*model.Position
	taxLots            map[string]*model.TaxLot
	taxLotDispositions map[string]*model.TaxLotDisposition
	transactions       map[string]*model.Transaction
	credentials        map[string]*model.SyncCredential
	connections        map[string]*model.SyncConnection
	syncRuns           map[string]*model.SyncRun
	assetPrices        map[string]*model.AssetPrice
	instruments        map[string]*model.Instrument
	portfolioAssets    map[string]*model.PortfolioAsset
}

func newSyncTestUOW() *syncTestUOW {
	return &syncTestUOW{
		users:              make(map[string]*model.User),
		portfolios:         make(map[string]*model.Portfolio),
		accounts:           make(map[string]*model.Account),
		assets:             make(map[string]*model.Asset),
		positions:          make(map[string]*model.Position),
		taxLots:            make(map[string]*model.TaxLot),
		taxLotDispositions: make(map[string]*model.TaxLotDisposition),
		transactions:       make(map[string]*model.Transaction),
		credentials:        make(map[string]*model.SyncCredential),
		connections:        make(map[string]*model.SyncConnection),
		syncRuns:           make(map[string]*model.SyncRun),
		assetPrices:        make(map[string]*model.AssetPrice),
		instruments:        make(map[string]*model.Instrument),
		portfolioAssets:    make(map[string]*model.PortfolioAsset),
	}
}

// syncTestUserRepo backs the user lookups the sale path performs (tax
// jurisdiction) without reaching the nil embedded interface.
type syncTestUserRepo struct {
	repository.IUserRepository
	uow *syncTestUOW
}

func (r *syncTestUserRepo) GetByID(ctx context.Context, id string) (*model.User, error) {
	r.uow.mu.Lock()
	defer r.uow.mu.Unlock()
	if user, ok := r.uow.users[id]; ok {
		return user, nil
	}
	return nil, repository.ErrNotFound
}

func (u *syncTestUOW) User() repository.IUserRepository {
	return &syncTestUserRepo{uow: u}
}

func (u *syncTestUOW) Do(ctx context.Context, fn func(uow repository.IUnitOfWork) error) error {
	return fn(u)
}

// nextID returns a unique fake id. Callers already hold u.mu. A timestamp is
// not enough: two accounts created in the same microsecond used to collide and
// silently overwrite each other.
func (u *syncTestUOW) nextID(prefix string) string {
	u.idSeq++
	return fmt.Sprintf("%s-%d", prefix, u.idSeq)
}

func (u *syncTestUOW) seedBaseEntities(userID, portfolioID, accountID, credID, connID, provider string) {
	u.mu.Lock()
	defer u.mu.Unlock()
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
func (u *syncTestUOW) Sync() repository.ISyncRepository       { return &syncTestSyncRepo{u: u} }
func (u *syncTestUOW) Account() repository.IAccountRepository { return &syncTestAccountRepo{u: u} }
func (u *syncTestUOW) Portfolio() repository.IPortfolioRepository {
	return &syncTestPortfolioRepo{u: u}
}
func (u *syncTestUOW) Asset() repository.IAssetRepository       { return &syncTestAssetRepo{u: u} }
func (u *syncTestUOW) Position() repository.IPositionRepository { return &syncTestPositionRepo{u: u} }
func (u *syncTestUOW) TaxLot() repository.ITaxLotRepository     { return &syncTestTaxLotRepo{u: u} }
func (u *syncTestUOW) TaxLotDisposition() repository.ITaxLotDispositionRepository {
	return &syncTestTaxLotDispositionRepo{u: u}
}
func (u *syncTestUOW) Transaction() repository.ITransactionRepository { return &syncTestTxRepo{u: u} }
func (u *syncTestUOW) AssetPrice() repository.IPriceRepository        { return &syncTestPriceRepo{u: u} }
func (u *syncTestUOW) Instrument() repository.IInstrumentRepository {
	return &syncTestInstrumentRepo{u: u}
}
func (u *syncTestUOW) PortfolioAsset() repository.IPortfolioAssetRepository {
	return &syncTestPortfolioAssetRepo{u: u}
}

type syncTestPortfolioAssetRepo struct {
	repository.IPortfolioAssetRepository
	u *syncTestUOW
}

func (r *syncTestPortfolioAssetRepo) FindByPortfolioAndAsset(ctx context.Context, portfolioID, assetID string) (*model.PortfolioAsset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	key := portfolioID + ":" + assetID
	if pa, ok := r.u.portfolioAssets[key]; ok {
		return pa, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestPortfolioAssetRepo) Create(ctx context.Context, pa *model.PortfolioAsset) (*model.PortfolioAsset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	key := pa.PortfolioID + ":" + pa.AssetID
	r.u.portfolioAssets[key] = pa
	return pa, nil
}

func (r *syncTestPortfolioAssetRepo) Update(ctx context.Context, pa *model.PortfolioAsset) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	key := pa.PortfolioID + ":" + pa.AssetID
	r.u.portfolioAssets[key] = pa
	return nil
}

type syncTestInstrumentRepo struct {
	repository.IInstrumentRepository
	u *syncTestUOW
}

func (r *syncTestInstrumentRepo) GetByGlobalIdentifier(ctx context.Context, field, value string) (*model.Instrument, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, inst := range r.u.instruments {
		if field == "isin" && inst.ISIN != nil && *inst.ISIN == value {
			return inst, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestInstrumentRepo) ResolveByGlobalIdentifier(ctx context.Context, field, value string, preferredCurrency model.Currency) (*model.Instrument, error) {
	return r.GetByGlobalIdentifier(ctx, field, value)
}

type syncTestSyncRepo struct {
	repository.ISyncRepository
	u *syncTestUOW
}

func (r *syncTestSyncRepo) CreateCredential(ctx context.Context, cred *model.SyncCredential) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if cred.ID == "" {
		cred.ID = r.u.nextID("cred")
	}
	r.u.credentials[cred.ID] = cred
	return nil
}

func (r *syncTestSyncRepo) GetCredentialByID(ctx context.Context, id string) (*model.SyncCredential, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if c, ok := r.u.credentials[id]; ok {
		return c, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) GetCredentialByProvider(ctx context.Context, userID string, provider string) (*model.SyncCredential, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, c := range r.u.credentials {
		if (c.UserID == userID || (c.IsSystem && c.UserID == "")) && c.Provider == provider {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) GetCredentialByPortfolioAndProvider(ctx context.Context, userID string, portfolioID string, provider string) (*model.SyncCredential, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, c := range r.u.credentials {
		if c.UserID == userID && c.PortfolioID != nil && *c.PortfolioID == portfolioID && c.Provider == provider {
			return c, nil
		}
	}
	for _, c := range r.u.credentials {
		if (c.UserID == userID || (c.IsSystem && c.UserID == "")) && c.Provider == provider {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) ListConnectionsByCredentialID(ctx context.Context, credentialID string) ([]*model.SyncConnection, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []*model.SyncConnection
	for _, c := range r.u.connections {
		if c.CredentialID == credentialID {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *syncTestSyncRepo) UpdateCredential(ctx context.Context, cred *model.SyncCredential) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	r.u.credentials[cred.ID] = cred
	return nil
}

func (r *syncTestSyncRepo) DeleteCredential(ctx context.Context, id string) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	delete(r.u.credentials, id)
	return nil
}

func (r *syncTestSyncRepo) CreateConnection(ctx context.Context, conn *model.SyncConnection) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if conn.ID == "" {
		conn.ID = r.u.nextID("conn")
	}
	r.u.connections[conn.ID] = conn
	return nil
}

func (r *syncTestSyncRepo) GetConnectionByID(ctx context.Context, id string) (*model.SyncConnection, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if c, ok := r.u.connections[id]; ok {
		return c, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) GetConnectionByAccountID(ctx context.Context, accountID string) (*model.SyncConnection, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, c := range r.u.connections {
		if c.AccountID != nil && *c.AccountID == accountID {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestSyncRepo) ListCredentialsByUser(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []*model.SyncCredential
	for _, c := range r.u.credentials {
		if c.UserID == userID || (c.IsSystem && c.UserID == "") {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *syncTestSyncRepo) ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []*model.SyncConnection
	for _, c := range r.u.connections {
		if c.PortfolioID == portfolioID {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *syncTestSyncRepo) UpdateConnection(ctx context.Context, conn *model.SyncConnection) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	r.u.connections[conn.ID] = conn
	return nil
}

func (r *syncTestSyncRepo) DeleteConnection(ctx context.Context, id string) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	delete(r.u.connections, id)
	return nil
}

func (r *syncTestSyncRepo) CreateSyncRun(ctx context.Context, run *model.SyncRun) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if run.ID == "" {
		run.ID = r.u.nextID("run")
	}
	r.u.syncRuns[run.ID] = run
	return nil
}

func (r *syncTestSyncRepo) UpdateSyncRun(ctx context.Context, run *model.SyncRun) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	r.u.syncRuns[run.ID] = run
	return nil
}

func (r *syncTestSyncRepo) GetSyncRunByID(ctx context.Context, id string) (*model.SyncRun, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
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
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if acc.ID == "" {
		acc.ID = r.u.nextID("acc")
	}
	r.u.accounts[acc.ID] = acc
	return acc, nil
}

func (r *syncTestAccountRepo) GetByID(ctx context.Context, id string) (*model.Account, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if a, ok := r.u.accounts[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAccountRepo) Update(ctx context.Context, acc *model.Account) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	r.u.accounts[acc.ID] = acc
	return nil
}

func (r *syncTestAccountRepo) GetAccountsByPortfolioID(ctx context.Context, portfolioID string) ([]model.Account, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []model.Account
	for _, a := range r.u.accounts {
		if a.PortfolioID == portfolioID {
			res = append(res, *a)
		}
	}
	return res, nil
}

func (r *syncTestAccountRepo) GetAccountsByAccountNumber(ctx context.Context, accountNumber string) ([]model.Account, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []model.Account
	for _, a := range r.u.accounts {
		if a.AccountNumber != nil && *a.AccountNumber == accountNumber {
			res = append(res, *a)
		}
	}
	return res, nil
}

type syncTestPortfolioRepo struct {
	repository.IPortfolioRepository
	u *syncTestUOW
}

func (r *syncTestPortfolioRepo) GetByID(ctx context.Context, id string) (*model.Portfolio, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
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
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if asset.ID == "" {
		asset.ID = r.u.nextID("asset")
	}
	r.u.assets[asset.ID] = asset
	return asset, nil
}

func (r *syncTestAssetRepo) GetByID(ctx context.Context, id string) (*model.Asset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if a, ok := r.u.assets[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAssetRepo) GetBySymbol(ctx context.Context, symbol string) (*model.Asset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, a := range r.u.assets {
		if a.Symbol != nil && *a.Symbol == symbol {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAssetRepo) GetByInstrumentID(ctx context.Context, instID string) (*model.Asset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, a := range r.u.assets {
		if a.InstrumentID != nil && *a.InstrumentID == instID {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestAssetRepo) UpsertTradeable(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if asset.ID == "" {
		asset.ID = r.u.nextID("asset")
	}
	r.u.assets[asset.ID] = asset
	return asset, nil
}

func (r *syncTestAssetRepo) FindWithFilters(ctx context.Context, filter repository.AssetFilter) ([]model.Asset, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var result []model.Asset
	for _, a := range r.u.assets {
		if filter.Symbol != nil && (a.Symbol == nil || *a.Symbol != *filter.Symbol) {
			continue
		}
		if filter.AssetType != nil && a.Type != *filter.AssetType {
			continue
		}
		if filter.IsTradeable != nil && a.IsTradeable != *filter.IsTradeable {
			continue
		}
		result = append(result, *a)
	}
	return result, nil
}

type syncTestPositionRepo struct {
	repository.IPositionRepository
	u *syncTestUOW
}

func (r *syncTestPositionRepo) Create(ctx context.Context, pos *model.Position) (*model.Position, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if pos.ID == "" {
		pos.ID = r.u.nextID("pos")
	}
	r.u.positions[pos.ID] = pos
	return pos, nil
}

func (r *syncTestPositionRepo) GetByID(ctx context.Context, id string) (*model.Position, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if p, ok := r.u.positions[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestPositionRepo) Update(ctx context.Context, pos *model.Position) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	r.u.positions[pos.ID] = pos
	return nil
}

func (r *syncTestPositionRepo) GetByAccountAndAsset(ctx context.Context, accountID, assetID string) (*model.Position, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for _, p := range r.u.positions {
		if p.AccountID == accountID && p.AssetID == assetID {
			return p, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *syncTestPositionRepo) GetPortfolioPositions(ctx context.Context, portfolioID string) ([]model.Position, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []model.Position
	for _, p := range r.u.positions {
		if p.PortfolioID == portfolioID {
			cp := *p
			if asset, ok := r.u.assets[p.AssetID]; ok {
				cp.Asset = asset
			}
			res = append(res, cp)
		}
	}
	return res, nil
}

type syncTestTaxLotRepo struct {
	repository.ITaxLotRepository
	u *syncTestUOW
}

func (r *syncTestTaxLotRepo) Create(ctx context.Context, lot *model.TaxLot) (*model.TaxLot, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if lot.ID == "" {
		lot.ID = r.u.nextID("lot")
	}
	r.u.taxLots[lot.ID] = lot
	return lot, nil
}

func (r *syncTestTaxLotRepo) FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []*model.TaxLot
	for _, l := range r.u.taxLots {
		if l.PositionID == positionID {
			res = append(res, l)
		}
	}
	return res, nil
}

func (r *syncTestTaxLotRepo) FindOpenByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []*model.TaxLot
	for _, l := range r.u.taxLots {
		if l.PositionID == positionID && l.Status != model.TaxLotStatusClosed {
			res = append(res, l)
		}
	}
	return res, nil
}

func (r *syncTestTaxLotRepo) Update(ctx context.Context, lot *model.TaxLot) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	r.u.taxLots[lot.ID] = lot
	return nil
}

func (r *syncTestTaxLotRepo) Delete(ctx context.Context, id string) error {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	delete(r.u.taxLots, id)
	return nil
}

type syncTestTaxLotDispositionRepo struct {
	repository.ITaxLotDispositionRepository
	u *syncTestUOW
}

func (r *syncTestTaxLotDispositionRepo) FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLotDisposition, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []*model.TaxLotDisposition
	for _, d := range r.u.taxLotDispositions {
		if d.PositionID == positionID {
			res = append(res, d)
		}
	}
	return res, nil
}

type syncTestTxRepo struct {
	repository.ITransactionRepository
	u *syncTestUOW
}

func (r *syncTestTxRepo) Create(ctx context.Context, tx *model.Transaction) (*model.Transaction, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	if tx.Amount == 0 {
		return nil, errors.New("pq: new row for relation \"transactions\" violates check constraint \"valid_amount\"")
	}
	if tx.ID == "" {
		tx.ID = r.u.nextID("tx")
	}
	r.u.transactions[tx.ID] = tx
	return tx, nil
}

func (r *syncTestTxRepo) FindByPositionID(ctx context.Context, positionID string) ([]model.Transaction, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	var res []model.Transaction
	for _, t := range r.u.transactions {
		if t.PositionID != nil && *t.PositionID == positionID {
			res = append(res, *t)
		}
	}
	return res, nil
}

func (r *syncTestTxRepo) FindByAccountAndExternalID(ctx context.Context, accountID, externalID string) (*model.Transaction, error) {
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
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
	r.u.mu.Lock()
	defer r.u.mu.Unlock()
	for i := range prices {
		if !prices[i].Price.IsPositive() {
			return errors.New("pq: new row for relation \"asset_prices\" violates check constraint \"valid_price\"")
		}
		r.u.assetPrices[prices[i].AssetID] = &prices[i]
	}
	return nil
}
