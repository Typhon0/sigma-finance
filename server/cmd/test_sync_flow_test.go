package main_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	syncservice "sigma_finance/internal/service/sync"
)

const testEncryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func decPtr(d decimal.Decimal) *decimal.Decimal { return &d }
func strPtr(s string) *string                   { return &s }

// mockE2ESyncAdapter implements syncservice.SyncAdapter for end-to-end testing
type mockE2ESyncAdapter struct {
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

func (m *mockE2ESyncAdapter) Provider() string {
	if m.provider == "" {
		return "E2E_MOCK_PROVIDER"
	}
	return m.provider
}

func (m *mockE2ESyncAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	return m.testConnectionErr
}

func (m *mockE2ESyncAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	return m.rawAccounts, nil
}

func (m *mockE2ESyncAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawBalance, error) {
	if m.fetchBalancesErr != nil {
		return nil, m.fetchBalancesErr
	}
	return m.rawBalances, nil
}

func (m *mockE2ESyncAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawHolding, error) {
	if m.fetchHoldingsErr != nil {
		return nil, m.fetchHoldingsErr
	}
	return m.rawHoldings, nil
}

func (m *mockE2ESyncAdapter) FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time) ([]syncservice.RawTransaction, error) {
	if m.fetchTxErr != nil {
		return nil, m.fetchTxErr
	}
	return m.rawTransactions, nil
}

// In-Memory Unit of Work for E2E integration test
type e2eSyncUOW struct {
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

func newE2ESyncUOW() *e2eSyncUOW {
	return &e2eSyncUOW{
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

func (u *e2eSyncUOW) Do(ctx context.Context, fn func(uow repository.IUnitOfWork) error) error {
	return fn(u)
}

func (u *e2eSyncUOW) Sync() repository.ISyncRepository               { return &e2eSyncRepo{u: u} }
func (u *e2eSyncUOW) Account() repository.IAccountRepository         { return &e2eAccountRepo{u: u} }
func (u *e2eSyncUOW) Portfolio() repository.IPortfolioRepository     { return &e2ePortfolioRepo{u: u} }
func (u *e2eSyncUOW) Asset() repository.IAssetRepository             { return &e2eAssetRepo{u: u} }
func (u *e2eSyncUOW) Position() repository.IPositionRepository       { return &e2ePositionRepo{u: u} }
func (u *e2eSyncUOW) TaxLot() repository.ITaxLotRepository           { return &e2eTaxLotRepo{u: u} }
func (u *e2eSyncUOW) Transaction() repository.ITransactionRepository { return &e2eTxRepo{u: u} }
func (u *e2eSyncUOW) AssetPrice() repository.IPriceRepository        { return &e2ePriceRepo{u: u} }
func (u *e2eSyncUOW) Instrument() repository.IInstrumentRepository   { return &e2eInstrumentRepo{u: u} }

type e2eSyncRepo struct {
	repository.ISyncRepository
	u *e2eSyncUOW
}

func (r *e2eSyncRepo) CreateCredential(ctx context.Context, cred *model.SyncCredential) error {
	if cred.ID == "" {
		cred.ID = fmt.Sprintf("cred-%d", time.Now().UnixNano())
	}
	r.u.credentials[cred.ID] = cred
	return nil
}

func (r *e2eSyncRepo) GetCredentialByID(ctx context.Context, id string) (*model.SyncCredential, error) {
	if c, ok := r.u.credentials[id]; ok {
		return c, nil
	}
	return nil, repository.ErrNotFound
}

func (r *e2eSyncRepo) GetCredentialByProvider(ctx context.Context, userID, provider string) (*model.SyncCredential, error) {
	for _, c := range r.u.credentials {
		if c.UserID == userID && c.Provider == provider {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *e2eSyncRepo) ListCredentialsByUser(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
	var res []*model.SyncCredential
	for _, c := range r.u.credentials {
		if c.UserID == userID || (c.IsSystem && c.UserID == "") {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *e2eSyncRepo) UpdateCredential(ctx context.Context, cred *model.SyncCredential) error {
	r.u.credentials[cred.ID] = cred
	return nil
}

func (r *e2eSyncRepo) CreateConnection(ctx context.Context, conn *model.SyncConnection) error {
	if conn.ID == "" {
		conn.ID = fmt.Sprintf("conn-%d", time.Now().UnixNano())
	}
	r.u.connections[conn.ID] = conn
	return nil
}

func (r *e2eSyncRepo) GetConnectionByID(ctx context.Context, id string) (*model.SyncConnection, error) {
	if c, ok := r.u.connections[id]; ok {
		return c, nil
	}
	return nil, repository.ErrNotFound
}

func (r *e2eSyncRepo) GetConnectionByAccountID(ctx context.Context, accountID string) (*model.SyncConnection, error) {
	for _, c := range r.u.connections {
		if c.AccountID != nil && *c.AccountID == accountID {
			return c, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *e2eSyncRepo) ListConnectionsByPortfolio(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	var res []*model.SyncConnection
	for _, c := range r.u.connections {
		if c.PortfolioID == portfolioID {
			res = append(res, c)
		}
	}
	return res, nil
}

func (r *e2eSyncRepo) UpdateConnection(ctx context.Context, conn *model.SyncConnection) error {
	r.u.connections[conn.ID] = conn
	return nil
}

func (r *e2eSyncRepo) CreateSyncRun(ctx context.Context, run *model.SyncRun) error {
	if run.ID == "" {
		run.ID = fmt.Sprintf("run-%d", time.Now().UnixNano())
	}
	r.u.syncRuns[run.ID] = run
	return nil
}

func (r *e2eSyncRepo) UpdateSyncRun(ctx context.Context, run *model.SyncRun) error {
	r.u.syncRuns[run.ID] = run
	return nil
}

func (r *e2eSyncRepo) GetSyncRunByID(ctx context.Context, id string) (*model.SyncRun, error) {
	if run, ok := r.u.syncRuns[id]; ok {
		return run, nil
	}
	return nil, repository.ErrNotFound
}

type e2eAccountRepo struct {
	repository.IAccountRepository
	u *e2eSyncUOW
}

func (r *e2eAccountRepo) Create(ctx context.Context, acc *model.Account) (*model.Account, error) {
	if acc.ID == "" {
		acc.ID = fmt.Sprintf("acc-%d", time.Now().UnixNano())
	}
	r.u.accounts[acc.ID] = acc
	return acc, nil
}

func (r *e2eAccountRepo) GetByID(ctx context.Context, id string) (*model.Account, error) {
	if a, ok := r.u.accounts[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *e2eAccountRepo) Update(ctx context.Context, acc *model.Account) error {
	r.u.accounts[acc.ID] = acc
	return nil
}

type e2ePortfolioRepo struct {
	repository.IPortfolioRepository
	u *e2eSyncUOW
}

func (r *e2ePortfolioRepo) GetByID(ctx context.Context, id string) (*model.Portfolio, error) {
	if p, ok := r.u.portfolios[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

type e2eAssetRepo struct {
	repository.IAssetRepository
	u *e2eSyncUOW
}

func (r *e2eAssetRepo) Create(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	if asset.ID == "" {
		asset.ID = fmt.Sprintf("asset-%d", time.Now().UnixNano())
	}
	r.u.assets[asset.ID] = asset
	return asset, nil
}

func (r *e2eAssetRepo) GetByID(ctx context.Context, id string) (*model.Asset, error) {
	if a, ok := r.u.assets[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

func (r *e2eAssetRepo) GetBySymbol(ctx context.Context, symbol string) (*model.Asset, error) {
	for _, a := range r.u.assets {
		if a.Symbol != nil && *a.Symbol == symbol {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *e2eAssetRepo) GetByInstrumentID(ctx context.Context, instID string) (*model.Asset, error) {
	for _, a := range r.u.assets {
		if a.InstrumentID != nil && *a.InstrumentID == instID {
			return a, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *e2eAssetRepo) UpsertTradeable(ctx context.Context, asset *model.Asset) (*model.Asset, error) {
	if asset.ID == "" {
		asset.ID = fmt.Sprintf("asset-%d", time.Now().UnixNano())
	}
	r.u.assets[asset.ID] = asset
	return asset, nil
}

type e2ePositionRepo struct {
	repository.IPositionRepository
	u *e2eSyncUOW
}

func (r *e2ePositionRepo) Create(ctx context.Context, pos *model.Position) (*model.Position, error) {
	if pos.ID == "" {
		pos.ID = fmt.Sprintf("pos-%d", time.Now().UnixNano())
	}
	r.u.positions[pos.ID] = pos
	return pos, nil
}

func (r *e2ePositionRepo) GetByID(ctx context.Context, id string) (*model.Position, error) {
	if p, ok := r.u.positions[id]; ok {
		return p, nil
	}
	return nil, repository.ErrNotFound
}

func (r *e2ePositionRepo) Update(ctx context.Context, pos *model.Position) error {
	r.u.positions[pos.ID] = pos
	return nil
}

func (r *e2ePositionRepo) GetByAccountAndAsset(ctx context.Context, accountID, assetID string) (*model.Position, error) {
	for _, p := range r.u.positions {
		if p.AccountID == accountID && p.AssetID == assetID {
			return p, nil
		}
	}
	return nil, repository.ErrNotFound
}

func (r *e2ePositionRepo) GetPortfolioPositions(ctx context.Context, portfolioID string) ([]model.Position, error) {
	var res []model.Position
	for _, p := range r.u.positions {
		if p.PortfolioID == portfolioID {
			res = append(res, *p)
		}
	}
	return res, nil
}

type e2eTaxLotRepo struct {
	repository.ITaxLotRepository
	u *e2eSyncUOW
}

func (r *e2eTaxLotRepo) Create(ctx context.Context, lot *model.TaxLot) (*model.TaxLot, error) {
	if lot.ID == "" {
		lot.ID = fmt.Sprintf("lot-%d", time.Now().UnixNano())
	}
	r.u.taxLots[lot.ID] = lot
	return lot, nil
}

func (r *e2eTaxLotRepo) FindByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	var res []*model.TaxLot
	for _, l := range r.u.taxLots {
		if l.PositionID == positionID {
			res = append(res, l)
		}
	}
	return res, nil
}

func (r *e2eTaxLotRepo) FindOpenByPositionID(ctx context.Context, positionID string) ([]*model.TaxLot, error) {
	var res []*model.TaxLot
	for _, l := range r.u.taxLots {
		if l.PositionID == positionID && l.Status != model.TaxLotStatusClosed {
			res = append(res, l)
		}
	}
	return res, nil
}

type e2eTxRepo struct {
	repository.ITransactionRepository
	u *e2eSyncUOW
}

func (r *e2eTxRepo) Create(ctx context.Context, tx *model.Transaction) (*model.Transaction, error) {
	if tx.ID == "" {
		tx.ID = fmt.Sprintf("tx-%d", time.Now().UnixNano())
	}
	r.u.transactions[tx.ID] = tx
	return tx, nil
}

func (r *e2eTxRepo) FindByPositionID(ctx context.Context, positionID string) ([]model.Transaction, error) {
	var res []model.Transaction
	for _, t := range r.u.transactions {
		if t.PositionID != nil && *t.PositionID == positionID {
			res = append(res, *t)
		}
	}
	return res, nil
}

func (r *e2eTxRepo) FindByAccountAndExternalID(ctx context.Context, accountID, externalID string) (*model.Transaction, error) {
	for _, t := range r.u.transactions {
		if t.AccountID != nil && *t.AccountID == accountID && t.ExternalID != nil && *t.ExternalID == externalID {
			return t, nil
		}
	}
	return nil, repository.ErrNotFound
}

type e2ePriceRepo struct {
	repository.IPriceRepository
	u *e2eSyncUOW
}

func (r *e2ePriceRepo) UpsertPrices(ctx context.Context, prices []model.AssetPrice) error {
	for i := range prices {
		r.u.assetPrices[prices[i].AssetID] = &prices[i]
	}
	return nil
}

type e2eInstrumentRepo struct {
	repository.IInstrumentRepository
	u *e2eSyncUOW
}

func (r *e2eInstrumentRepo) GetByGlobalIdentifier(ctx context.Context, field, value string) (*model.Instrument, error) {
	for _, inst := range r.u.instruments {
		if field == "isin" && inst.ISIN != nil && *inst.ISIN == value {
			return inst, nil
		}
	}
	return nil, repository.ErrNotFound
}

// TestFullSyncLifecycle verifies the entire end-to-end sync lifecycle:
// 1. Initializing UoW and SyncService.
// 2. Registering an encrypted credential in the database.
// 3. Creating a connection linked to a test portfolio.
// 4. Auto-provisioning an account via LinkAccount.
// 5. Triggering sync through SyncService with cash balances, holdings, and trades.
// 6. Asserting holdings match snapshot, cash is recorded, transactions are recorded & deduplicated,
//    and residual tax lots are created.
// 7. Asserting audit log in sync_runs is marked COMPLETED.
// 8. Re-running sync to assert idempotency and trade deduplication.
func TestFullSyncLifecycle(t *testing.T) {
	model.SetEncryptionKey(testEncryptionKey)
	ctx := context.Background()

	// 1. Initialize test UoW & services
	uow := newE2ESyncUOW()
	userID := "user-e2e-1"
	portfolioID := "portfolio-e2e-1"

	uow.users[userID] = &model.User{ID: userID, Email: "investor@example.com"}
	uow.portfolios[portfolioID] = &model.Portfolio{
		ID:     portfolioID,
		UserID: userID,
		Name:   "Retirement & Growth",
	}

	// Pre-seed catalog / known assets for AAPL and BTC
	aaplAsset := &model.Asset{
		ID:          "asset-aapl-us",
		Symbol:      strPtr("AAPL"),
		Name:        "Apple Inc.",
		Type:        model.AssetTypeStock,
		IsTradeable: true,
	}
	uow.assets[aaplAsset.ID] = aaplAsset

	btcAsset := &model.Asset{
		ID:          "asset-btc-crypto",
		Symbol:      strPtr("BTC"),
		Name:        "Bitcoin",
		Type:        model.AssetTypeCrypto,
		IsTradeable: true,
	}
	uow.assets[btcAsset.ID] = btcAsset

	syncService := syncservice.NewSyncService(uow, nil)

	// Configure mock adapter
	adapter := &mockE2ESyncAdapter{
		provider: "MOCK_BROKER",
		rawBalances: []syncservice.RawBalance{
			{
				Currency: model.CurrencyEUR,
				Amount:   decimal.NewFromInt(5420), // 5,420 EUR in cash
			},
		},
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID:       "holding-aapl",
				Symbol:           "AAPL",
				Name:             "Apple Inc.",
				AssetType:        model.AssetTypeStock,
				Quantity:         decimal.NewFromInt(10), // Total 10 shares
				CostBasisPerUnit: decPtr(decimal.NewFromInt(150)),
				CurrentPrice:     decPtr(decimal.NewFromInt(185)),
				Currency:         model.CurrencyUSD,
			},
			{
				ExternalID:       "holding-btc",
				Symbol:           "BTC",
				Name:             "Bitcoin",
				AssetType:        model.AssetTypeCrypto,
				Quantity:         decimal.RequireFromString("1.5"), // Total 1.5 BTC
				CostBasisPerUnit: decPtr(decimal.NewFromInt(60000)),
				CurrentPrice:     decPtr(decimal.NewFromInt(65000)),
				Currency:         model.CurrencyUSD,
			},
		},
		rawTransactions: []syncservice.RawTransaction{
			{
				ExternalID:        "tx-aapl-buy-1",
				Type:              model.TransactionTypeBuy,
				Symbol:            "AAPL",
				Quantity:          decPtr(decimal.NewFromInt(4)), // Bought 4 shares historically
				UnitPriceAmount:   decPtr(decimal.NewFromInt(150)),
				UnitPriceCurrency: model.CurrencyUSD,
				Amount:            model.Money(60000), // $600 in cents
				Currency:          model.CurrencyUSD,
				ExecutedAt:        time.Now().Add(-14 * 24 * time.Hour),
				Notes:             "Executed via Mock Broker",
			},
			{
				ExternalID:        "tx-btc-buy-1",
				Type:              model.TransactionTypeBuy,
				Symbol:            "BTC",
				Quantity:          decPtr(decimal.RequireFromString("1.5")), // Bought full 1.5 BTC
				UnitPriceAmount:   decPtr(decimal.NewFromInt(60000)),
				UnitPriceCurrency: model.CurrencyUSD,
				Amount:            model.Money(9000000), // $90,000 in cents
				Currency:          model.CurrencyUSD,
				ExecutedAt:        time.Now().Add(-7 * 24 * time.Hour),
				Notes:             "Crypto purchase via Mock Broker",
			},
		},
	}
	syncService.RegisterAdapter(adapter)

	// 2. Register encrypted credential in DB
	rawCredJSON := `{"apiKey":"broker-live-key-xyz","apiSecret":"super-secret-passphrase"}`
	cred, err := syncService.RegisterCredential(ctx, userID, "MOCK_BROKER", rawCredJSON)
	require.NoError(t, err, "failed to register encrypted credential")
	require.NotNil(t, cred)
	assert.NotEmpty(t, cred.ID)
	assert.Equal(t, model.SyncCredentialStatusActive, cred.Status)
	assert.NotEmpty(t, cred.EncryptedData, "credential payload must be encrypted in DB")

	// Verify encryption in repository
	savedCred, err := uow.Sync().GetCredentialByID(ctx, cred.ID)
	require.NoError(t, err)
	assert.NotEmpty(t, savedCred.EncryptedData)
	decryptedJSON, err := savedCred.Decrypt()
	require.NoError(t, err)
	assert.Equal(t, rawCredJSON, decryptedJSON, "decrypted credential must match original plaintext")

	// 3. Create connection linked to test portfolio
	conn := &model.SyncConnection{
		ID:                    "conn-e2e-1",
		UserID:                userID,
		PortfolioID:           portfolioID,
		CredentialID:          cred.ID,
		Provider:              "MOCK_BROKER",
		ExternalInstitutionID: "inst-mock-broker-001",
		ExternalAccountID:     "ext-acc-broker-999",
		InstitutionName:       "Mock Global Broker",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
	err = uow.Sync().CreateConnection(ctx, conn)
	require.NoError(t, err)

	// 4. Auto-provision an account via LinkAccount
	linkedConn, err := syncService.LinkAccount(ctx, conn.ID, "", true)
	require.NoError(t, err, "failed to link/auto-provision account")
	require.NotNil(t, linkedConn)
	require.NotNil(t, linkedConn.AccountID, "connection must now reference an auto-provisioned account")

	autoAccountID := *linkedConn.AccountID
	createdAcc, err := uow.Account().GetByID(ctx, autoAccountID)
	require.NoError(t, err)
	assert.Equal(t, "Mock Global Broker Account", createdAcc.Name)
	assert.Equal(t, model.AccountTypeBroker, createdAcc.Type)
	assert.Equal(t, model.CurrencyEUR, createdAcc.Currency)
	assert.Equal(t, "MOCK_BROKER", createdAcc.SyncProvider)
	assert.Equal(t, "ext-acc-broker-999", *createdAcc.AccountNumber)

	// 5. Trigger sync through SyncService
	run, err := syncService.TriggerSync(ctx, conn.ID)
	require.NoError(t, err, "TriggerSync failed")
	require.NotNil(t, run)

	// 6. Assert sync audit run is marked COMPLETED
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status, "sync run status must be COMPLETED")
	assert.NotNil(t, run.CompletedAt, "sync run completed timestamp must be set")
	assert.Nil(t, run.ErrorMessage, "no errors expected during sync")
	assert.Greater(t, run.ItemsImported, 0, "items imported must be greater than 0")

	// Connection status updated to SUCCESS
	updatedConn, err := uow.Sync().GetConnectionByID(ctx, conn.ID)
	require.NoError(t, err)
	assert.Equal(t, model.SyncConnectionStatusSuccess, updatedConn.SyncStatus)
	assert.NotNil(t, updatedConn.LastSyncAt)
	assert.Nil(t, updatedConn.LastError)

	// 7. Verify Cash Position / Balance Created
	cashSymbol := fmt.Sprintf("EUR_CASH_%s", autoAccountID)
	cashAsset, err := uow.Asset().GetBySymbol(ctx, cashSymbol)
	require.NoError(t, err, "cash asset must be created")
	assert.Equal(t, model.AssetTypeBankAccount, cashAsset.Type)

	cashPos, err := uow.Position().GetByAccountAndAsset(ctx, autoAccountID, cashAsset.ID)
	require.NoError(t, err, "cash position must be created")
	assert.True(t, cashPos.Quantity.Equal(decimal.NewFromInt(1)))
	require.NotNil(t, cashPos.AverageCostBasis)
	assert.True(t, cashPos.AverageCostBasis.Equal(decimal.NewFromInt(5420)), "cash balance must match 5420 EUR")

	// 8. Verify Holdings Reconciled
	aaplPos, err := uow.Position().GetByAccountAndAsset(ctx, autoAccountID, aaplAsset.ID)
	require.NoError(t, err, "AAPL position must be created")
	assert.True(t, aaplPos.Quantity.Equal(decimal.NewFromInt(10)), "AAPL position quantity must match holding snapshot (10)")
	require.NotNil(t, aaplPos.AverageCostBasis)
	assert.True(t, aaplPos.AverageCostBasis.Equal(decimal.NewFromInt(150)))

	btcPos, err := uow.Position().GetByAccountAndAsset(ctx, autoAccountID, btcAsset.ID)
	require.NoError(t, err, "BTC position must be created")
	assert.True(t, btcPos.Quantity.Equal(decimal.RequireFromString("1.5")), "BTC position quantity must match holding snapshot (1.5)")
	require.NotNil(t, btcPos.AverageCostBasis)
	assert.True(t, btcPos.AverageCostBasis.Equal(decimal.NewFromInt(60000)))

	// Verify cash price recorded in AssetPrice repository
	require.NotNil(t, uow.assetPrices[cashAsset.ID])
	assert.True(t, uow.assetPrices[cashAsset.ID].Price.Equal(decimal.NewFromInt(5420)))

	// 9. Verify Transactions Recorded
	savedAaplTx, err := uow.Transaction().FindByAccountAndExternalID(ctx, autoAccountID, "tx-aapl-buy-1")
	require.NoError(t, err)
	assert.Equal(t, model.TransactionTypeBuy, savedAaplTx.Type)
	assert.True(t, savedAaplTx.Quantity.Equal(decimal.NewFromInt(4)))

	savedBtcTx, err := uow.Transaction().FindByAccountAndExternalID(ctx, autoAccountID, "tx-btc-buy-1")
	require.NoError(t, err)
	assert.Equal(t, model.TransactionTypeBuy, savedBtcTx.Type)
	assert.True(t, savedBtcTx.Quantity.Equal(decimal.RequireFromString("1.5")))

	// 10. Verify Tax Lots
	// For AAPL: 4 shares covered by transaction tax lot, remaining 6 shares covered by baseline opening lot
	aaplLots, err := uow.TaxLot().FindByPositionID(ctx, aaplPos.ID)
	require.NoError(t, err)
	require.Len(t, aaplLots, 2, "AAPL should have 1 transaction tax lot and 1 opening baseline tax lot")

	var aaplTxLot, aaplBaselineLot *model.TaxLot
	for _, lot := range aaplLots {
		if lot.TransactionID != nil {
			aaplTxLot = lot
		} else {
			aaplBaselineLot = lot
		}
	}
	require.NotNil(t, aaplTxLot, "expected transaction-linked tax lot")
	assert.True(t, aaplTxLot.RemainingQuantity.Equal(decimal.NewFromInt(4)))
	assert.True(t, aaplTxLot.CostBasisPerUnit.Equal(decimal.NewFromInt(150)))

	require.NotNil(t, aaplBaselineLot, "expected opening baseline tax lot for residual quantity")
	assert.True(t, aaplBaselineLot.RemainingQuantity.Equal(decimal.NewFromInt(6)), "residual lot should cover 10 - 4 = 6 shares")
	assert.True(t, aaplBaselineLot.CostBasisPerUnit.Equal(decimal.NewFromInt(150)), "earliest cost basis should be used")
	assert.Equal(t, model.TaxLotStatusOpen, aaplBaselineLot.Status)

	// For BTC: exactly 1.5 shares bought, matches 1.5 holding, so no residual baseline lot
	btcLots, err := uow.TaxLot().FindByPositionID(ctx, btcPos.ID)
	require.NoError(t, err)
	require.Len(t, btcLots, 1, "BTC should only have 1 transaction tax lot with zero residual")
	assert.True(t, btcLots[0].RemainingQuantity.Equal(decimal.RequireFromString("1.5")))
	assert.NotNil(t, btcLots[0].TransactionID)

	// 11. Idempotency & Deduplication: Trigger sync a second time
	initialTxCount := len(uow.transactions)
	initialLotCount := len(uow.taxLots)

	secondRun, err := syncService.TriggerSync(ctx, conn.ID)
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, secondRun.Status)

	// Assert transactions were not duplicated
	assert.Equal(t, initialTxCount, len(uow.transactions), "transactions must be deduplicated on subsequent syncs")
	// Assert tax lots were not duplicated
	assert.Equal(t, initialLotCount, len(uow.taxLots), "tax lots must not be duplicated on subsequent syncs")
	// Assert positions remain identical
	recheckedAaplPos, err := uow.Position().GetByAccountAndAsset(ctx, autoAccountID, aaplAsset.ID)
	require.NoError(t, err)
	assert.True(t, recheckedAaplPos.Quantity.Equal(decimal.NewFromInt(10)))
}

// TestSyncLifecycle_LiquidatedPositionsAndPlaceholders tests edge cases:
// 1. Unmatched instruments creating UNMAPPED placeholders.
// 2. Previously active positions becoming zero when omitted from the snapshot.
func TestSyncLifecycle_LiquidatedPositionsAndPlaceholders(t *testing.T) {
	model.SetEncryptionKey(testEncryptionKey)
	ctx := context.Background()

	uow := newE2ESyncUOW()
	userID := "user-edge-1"
	portfolioID := "portfolio-edge-1"
	accountID := "acc-edge-1"

	uow.users[userID] = &model.User{ID: userID}
	uow.portfolios[portfolioID] = &model.Portfolio{ID: portfolioID, UserID: userID}
	uow.accounts[accountID] = &model.Account{
		ID:           accountID,
		UserID:       userID,
		PortfolioID:  portfolioID,
		Name:         "Edge Account",
		Type:         model.AccountTypeBroker,
		Currency:     model.CurrencyEUR,
		SyncProvider: "EDGE_BROKER",
	}

	// Pre-seed an existing holding that will be sold off (omitted in next sync)
	soldAsset := &model.Asset{
		ID:          "asset-tsla",
		Symbol:      strPtr("TSLA"),
		Name:        "Tesla Inc.",
		Type:        model.AssetTypeStock,
		IsTradeable: true,
	}
	uow.assets[soldAsset.ID] = soldAsset
	uow.positions["pos-tsla"] = &model.Position{
		ID:                  "pos-tsla",
		PortfolioID:         portfolioID,
		AccountID:           accountID,
		AssetID:             soldAsset.ID,
		Quantity:            decimal.NewFromInt(20), // Formerly 20 shares
		OwnershipPercentage: decimal.NewFromInt(100),
		QuoteCurrency:       model.CurrencyUSD,
	}

	cred := &model.SyncCredential{
		ID:       "cred-edge-1",
		UserID:   userID,
		Provider: "EDGE_BROKER",
		RawData:  `{"token":"edge-token"}`,
		Status:   model.SyncCredentialStatusActive,
	}
	_ = cred.Encrypt()
	uow.credentials[cred.ID] = cred

	conn := &model.SyncConnection{
		ID:                    "conn-edge-1",
		UserID:                userID,
		PortfolioID:           portfolioID,
		CredentialID:          cred.ID,
		AccountID:             &accountID,
		Provider:              "EDGE_BROKER",
		ExternalInstitutionID: "inst-edge",
		ExternalAccountID:     "ext-acc-edge",
		InstitutionName:       "Edge Broker",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
	uow.connections[conn.ID] = conn

	// Mock adapter returns only a new UNMAPPED crypto token, TSLA is completely omitted (liquidated)
	adapter := &mockE2ESyncAdapter{
		provider: "EDGE_BROKER",
		rawBalances: []syncservice.RawBalance{
			{Currency: model.CurrencyEUR, Amount: decimal.NewFromInt(100)},
		},
		rawHoldings: []syncservice.RawHolding{
			{
				ExternalID: "ext-defi-token",
				Symbol:     "NEW_DEFI_TOKEN",
				Name:       "New DeFi Protocol",
				AssetType:  model.AssetTypeCrypto,
				Quantity:   decimal.NewFromInt(1000),
				Currency:   model.CurrencyUSD,
			},
		},
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, conn.ID)
	require.NoError(t, err)
	assert.Equal(t, model.SyncRunStatusCompleted, run.Status)

	// Verify UNMAPPED placeholder asset created
	unmappedAsset, err := uow.Asset().GetBySymbol(ctx, "NEW_DEFI_TOKEN")
	require.NoError(t, err)
	assert.Equal(t, "NEW_DEFI_TOKEN", *unmappedAsset.Symbol)
	assert.Equal(t, "UNMAPPED", *unmappedAsset.MarketDataSource)

	newPos, err := uow.Position().GetByAccountAndAsset(ctx, accountID, unmappedAsset.ID)
	require.NoError(t, err)
	assert.True(t, newPos.Quantity.Equal(decimal.NewFromInt(1000)))

	// Verify warning recorded in SyncRun for unmapped asset
	require.NotNil(t, run.ErrorMessage)
	assert.Contains(t, *run.ErrorMessage, "NEW_DEFI_TOKEN")

	// Verify liquidated position (TSLA) quantity updated to 0
	tslaPos, err := uow.Position().GetByAccountAndAsset(ctx, accountID, soldAsset.ID)
	require.NoError(t, err)
	assert.True(t, tslaPos.Quantity.IsZero(), "liquidated position quantity must be updated to 0")
}

// TestSyncLifecycle_CredentialAuthenticationFailure tests authentication errors:
// When adapter rejects connection with ErrExpiredCredentials, credential status is set to EXPIRED
// and the sync run and connection are marked FAILED.
func TestSyncLifecycle_CredentialAuthenticationFailure(t *testing.T) {
	model.SetEncryptionKey(testEncryptionKey)
	ctx := context.Background()

	uow := newE2ESyncUOW()
	userID := "user-fail-1"
	portfolioID := "portfolio-fail-1"
	accountID := "acc-fail-1"

	uow.users[userID] = &model.User{ID: userID}
	uow.portfolios[portfolioID] = &model.Portfolio{ID: portfolioID, UserID: userID}
	uow.accounts[accountID] = &model.Account{ID: accountID, UserID: userID, PortfolioID: portfolioID}

	cred := &model.SyncCredential{
		ID:       "cred-fail-1",
		UserID:   userID,
		Provider: "FAIL_BROKER",
		RawData:  `{"token":"expired-token"}`,
		Status:   model.SyncCredentialStatusActive,
	}
	_ = cred.Encrypt()
	uow.credentials[cred.ID] = cred

	conn := &model.SyncConnection{
		ID:                    "conn-fail-1",
		UserID:                userID,
		PortfolioID:           portfolioID,
		CredentialID:          cred.ID,
		AccountID:             &accountID,
		Provider:              "FAIL_BROKER",
		ExternalInstitutionID: "inst-fail",
		ExternalAccountID:     "ext-acc-fail",
		InstitutionName:       "Fail Broker",
		SyncStatus:            model.SyncConnectionStatusIdle,
	}
	uow.connections[conn.ID] = conn

	adapter := &mockE2ESyncAdapter{
		provider:          "FAIL_BROKER",
		testConnectionErr: syncservice.ErrExpiredCredentials,
	}

	service := syncservice.NewSyncService(uow, nil)
	service.RegisterAdapter(adapter)

	run, err := service.TriggerSync(ctx, conn.ID)
	require.Error(t, err)
	assert.ErrorIs(t, err, syncservice.ErrExpiredCredentials)
	require.NotNil(t, run)
	assert.Equal(t, model.SyncRunStatusFailed, run.Status)

	// Credential should be flagged as expired
	updatedCred, _ := uow.Sync().GetCredentialByID(ctx, cred.ID)
	assert.Equal(t, model.SyncCredentialStatusExpired, updatedCred.Status)

	// Connection should be flagged as failed
	updatedConn, _ := uow.Sync().GetConnectionByID(ctx, conn.ID)
	assert.Equal(t, model.SyncConnectionStatusFailed, updatedConn.SyncStatus)
}
