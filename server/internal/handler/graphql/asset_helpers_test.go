package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/uptrace/bun"
)

// ---------------------------------------------------------------------------
// Stub implementations for service & repository interfaces
// ---------------------------------------------------------------------------

// stubPortfolioService implements service.IPortfolioService for tests.
// Only GetPortfolioAssets is functional; all other methods panic.
type stubPortfolioService struct {
	assets []model.PortfolioAsset
	err    error
}

func (s *stubPortfolioService) GetPortfolioAssets(_ context.Context, _ string) ([]model.PortfolioAsset, error) {
	return s.assets, s.err
}
func (s *stubPortfolioService) GetByID(_ context.Context, _ string) (*model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) FindAll(_ context.Context, _ ...repository.QueryOption) ([]model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) CreatePortfolio(_ context.Context, _ service.CreatePortfolioInput) (*model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) UpdatePortfolio(_ context.Context, _ string, _ service.UpdatePortfolioInput) (*model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) DeletePortfolio(_ context.Context, _ string) error {
	panic("not implemented")
}
func (s *stubPortfolioService) AddAssetToPortfolio(_ context.Context, _, _ string, _, _ float64) (*model.PortfolioAsset, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) UpdateAssetInPortfolio(_ context.Context, _, _ string, _, _ float64) (*model.PortfolioAsset, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) RemoveAssetFromPortfolio(_ context.Context, _, _ string) error {
	panic("not implemented")
}
func (s *stubPortfolioService) TagPortfolio(_ context.Context, _, _ string) error {
	panic("not implemented")
}
func (s *stubPortfolioService) UntagPortfolio(_ context.Context, _, _ string) error {
	panic("not implemented")
}
func (s *stubPortfolioService) ValidatePortfolioOwnership(_ context.Context, _, _ string) error {
	panic("not implemented")
}
func (s *stubPortfolioService) DuplicatePortfolio(_ context.Context, _ service.DuplicatePortfolioInput) (*model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) ReorderPortfolios(_ context.Context, _ string, _ []service.PortfolioOrderInput) ([]model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) GetPortfoliosByUser(_ context.Context, _ string, _ string) ([]model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) GetPortfolioAnalytics(_ context.Context, _ string, _ model.Currency) (*service.PortfolioValuation, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) GetPortfolioHistory(_ context.Context, _ string, _ string) (service.PortfolioHistory, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) GetAssetAllocation(_ context.Context, _ string) ([]service.AssetAllocation, error) {
	panic("not implemented")
}
func (s *stubPortfolioService) GetPerformanceVsBenchmark(_ context.Context, _, _ string) (service.PerformanceBenchmark, error) {
	panic("not implemented")
}

// unimplementedAssetService provides panic stubs for all IAssetService methods.
// Embed this in test stubs to avoid repeating 9 panic methods.
type unimplementedAssetService struct{}

func (unimplementedAssetService) CreateAsset(_ context.Context, _ service.CreateAssetRequest) (*model.Asset, error) {
	panic("not implemented")
}
func (unimplementedAssetService) UpdateAsset(_ context.Context, _ string, _ service.UpdateAssetRequest) (*model.Asset, error) {
	panic("not implemented")
}
func (unimplementedAssetService) DeleteAsset(_ context.Context, _ string) error {
	panic("not implemented")
}
func (unimplementedAssetService) ListAssets(_ context.Context, _ service.AssetFilter) ([]*model.Asset, error) {
	panic("not implemented")
}
func (unimplementedAssetService) SearchAssets(_ context.Context, _ string, _ int) ([]*model.Asset, error) {
	panic("not implemented")
}
func (unimplementedAssetService) GetAssetsByType(_ context.Context, _ model.AssetType) ([]*model.Asset, error) {
	panic("not implemented")
}
func (unimplementedAssetService) GetTradeableAssets(_ context.Context) ([]*model.Asset, error) {
	panic("not implemented")
}
func (unimplementedAssetService) ValidateAssetData(_ context.Context, _ model.AssetType, _ map[string]interface{}) error {
	panic("not implemented")
}
func (unimplementedAssetService) ValidateSymbol(_ context.Context, _ string, _ model.AssetType) error {
	panic("not implemented")
}

// stubAssetService implements service.IAssetService for tests.
type stubAssetService struct {
	unimplementedAssetService
	asset *model.Asset
	err   error
}

func (s *stubAssetService) GetAsset(_ context.Context, _ string) (*model.Asset, error) {
	return s.asset, s.err
}

// perIDAssetService implements service.IAssetService for tests.
// It returns different results based on the asset ID passed to GetAsset.
type perIDAssetService struct {
	unimplementedAssetService
	assets map[string]*model.Asset
	errors map[string]error
}

func (s *perIDAssetService) GetAsset(_ context.Context, id string) (*model.Asset, error) {
	if err, ok := s.errors[id]; ok {
		return nil, err
	}
	if a, ok := s.assets[id]; ok {
		return a, nil
	}
	return nil, repository.ErrNotFound
}

// stubTagService implements service.ITagService for tests.
type stubTagService struct {
	tags []model.Tag
	err  error
}

func (s *stubTagService) GetAssetTags(_ context.Context, _ string) ([]model.Tag, error) {
	return s.tags, s.err
}
func (s *stubTagService) GetByID(_ context.Context, _ string) (*model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) FindAll(_ context.Context, _ ...repository.QueryOption) ([]model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) FindByName(_ context.Context, _ string) (*model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) CreateTag(_ context.Context, _ service.CreateTagInput) (*model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) UpdateTag(_ context.Context, _ string, _ service.UpdateTagInput) (*model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) DeleteTag(_ context.Context, _ string) error       { panic("not implemented") }
func (s *stubTagService) TagAsset(_ context.Context, _, _ string) error     { panic("not implemented") }
func (s *stubTagService) UntagAsset(_ context.Context, _, _ string) error   { panic("not implemented") }
func (s *stubTagService) TagPortfolio(_ context.Context, _, _ string) error { panic("not implemented") }
func (s *stubTagService) UntagPortfolio(_ context.Context, _, _ string) error {
	panic("not implemented")
}
func (s *stubTagService) GetPortfolioTags(_ context.Context, _ string) ([]model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) GetTaggedAssets(_ context.Context, _ string) ([]model.Asset, error) {
	panic("not implemented")
}
func (s *stubTagService) GetTaggedPortfolios(_ context.Context, _ string) ([]model.Portfolio, error) {
	panic("not implemented")
}
func (s *stubTagService) GetTagUsageStatistics(_ context.Context, _ string) (service.TagUsageStats, error) {
	panic("not implemented")
}
func (s *stubTagService) FindOrCreateTag(_ context.Context, _ string) (*model.Tag, error) {
	panic("not implemented")
}
func (s *stubTagService) BulkTagAssets(_ context.Context, _ []string, _ string) error {
	panic("not implemented")
}
func (s *stubTagService) BulkTagPortfolios(_ context.Context, _ []string, _ string) error {
	panic("not implemented")
}
func (s *stubTagService) GetAssetsByTag(_ context.Context, _ string) ([]model.Asset, error) {
	panic("not implemented")
}

// stubPriceRepo implements repository.IPriceRepository for tests.
// Only GetLatestPrice and GetPriceStatistics are functional.
type stubPriceRepo struct {
	latestPrice *model.AssetPrice
	priceErr    error
	statistics  *repository.PriceStatistics
	statsErr    error
}

func (s *stubPriceRepo) GetLatestPrice(_ context.Context, _ string) (*model.AssetPrice, error) {
	return s.latestPrice, s.priceErr
}
func (s *stubPriceRepo) GetPriceStatistics(_ context.Context, _ string) (*repository.PriceStatistics, error) {
	return s.statistics, s.statsErr
}
func (s *stubPriceRepo) Create(_ context.Context, _ *model.AssetPrice) (*model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) Update(_ context.Context, _ *model.AssetPrice) error {
	panic("not implemented")
}
func (s *stubPriceRepo) Delete(_ context.Context, _ string) error { panic("not implemented") }
func (s *stubPriceRepo) GetByID(_ context.Context, _ string) (*model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) FindOneBy(_ context.Context, _ ...repository.QueryOption) (*model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) FindAllBy(_ context.Context, _ ...repository.QueryOption) ([]model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) Count(_ context.Context, _ ...repository.QueryOption) (int, error) {
	return 0, fmt.Errorf("not implemented")
}
func (s *stubPriceRepo) GetDB() bun.IDB { panic("not implemented") }
func (s *stubPriceRepo) GetLatestPrices(_ context.Context, _ []string) ([]model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetPriceHistory(_ context.Context, _ string, _ repository.TimeRange) ([]model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) FindWithFilters(_ context.Context, _ repository.PriceFilter) ([]model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetPricesByTimeRange(_ context.Context, _ []string, _ repository.TimeRange) ([]model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetOHLCData(_ context.Context, _ string, _ repository.TimeRange, _ string) ([]repository.PriceAggregation, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetStaleAssets(_ context.Context, _ time.Duration) ([]string, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetAssetsRequiringUpdate(_ context.Context, _ []string) ([]string, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetPriceChanges(_ context.Context, _ []string, _ repository.TimeRange) (map[string]decimal.Decimal, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) UpsertPrices(_ context.Context, _ []model.AssetPrice) error {
	panic("not implemented")
}
func (s *stubPriceRepo) DeleteOldPrices(_ context.Context, _ string, _ time.Time) error {
	panic("not implemented")
}
func (s *stubPriceRepo) GetSampledPriceData(_ context.Context, _ string, _ repository.TimeRange, _ int) ([]model.AssetPrice, error) {
	panic("not implemented")
}
func (s *stubPriceRepo) GetVolumeWeightedAveragePrice(_ context.Context, _ string, _ repository.TimeRange) (*decimal.Decimal, error) {
	panic("not implemented")
}

// stubStockRepo implements repository.IStockRepository for tests.
type stubStockRepo struct {
	stock *model.Stock
	err   error
}

func (s *stubStockRepo) GetByID(_ context.Context, _ string) (*model.Stock, error) {
	return s.stock, s.err
}
func (s *stubStockRepo) Create(_ context.Context, _ *model.Stock) (*model.Stock, error) {
	panic("not implemented")
}
func (s *stubStockRepo) Update(_ context.Context, _ *model.Stock) error { panic("not implemented") }
func (s *stubStockRepo) Delete(_ context.Context, _ string) error       { panic("not implemented") }
func (s *stubStockRepo) GetDB() bun.IDB                                 { panic("not implemented") }
func (s *stubStockRepo) FindOneBy(_ context.Context, _ ...repository.QueryOption) (*model.Stock, error) {
	panic("not implemented")
}
func (s *stubStockRepo) FindAllBy(_ context.Context, _ ...repository.QueryOption) ([]model.Stock, error) {
	panic("not implemented")
}
func (s *stubStockRepo) Count(_ context.Context, _ ...repository.QueryOption) (int, error) {
	return 0, fmt.Errorf("not implemented")
}

// stubCryptoRepo implements repository.ICryptoRepository for tests.
type stubCryptoRepo struct {
	crypto *model.Crypto
	err    error
}

func (s *stubCryptoRepo) GetByID(_ context.Context, _ string) (*model.Crypto, error) {
	return s.crypto, s.err
}
func (s *stubCryptoRepo) Create(_ context.Context, _ *model.Crypto) (*model.Crypto, error) {
	panic("not implemented")
}
func (s *stubCryptoRepo) Update(_ context.Context, _ *model.Crypto) error { panic("not implemented") }
func (s *stubCryptoRepo) Delete(_ context.Context, _ string) error        { panic("not implemented") }
func (s *stubCryptoRepo) GetDB() bun.IDB                                  { panic("not implemented") }
func (s *stubCryptoRepo) FindOneBy(_ context.Context, _ ...repository.QueryOption) (*model.Crypto, error) {
	panic("not implemented")
}
func (s *stubCryptoRepo) FindAllBy(_ context.Context, _ ...repository.QueryOption) ([]model.Crypto, error) {
	panic("not implemented")
}
func (s *stubCryptoRepo) Count(_ context.Context, _ ...repository.QueryOption) (int, error) {
	return 0, fmt.Errorf("not implemented")
}

// stubFundRepo implements repository.IFundRepository for tests.
type stubFundRepo struct {
	fund *model.Fund
	err  error
}

func (s *stubFundRepo) GetByID(_ context.Context, _ string) (*model.Fund, error) {
	return s.fund, s.err
}
func (s *stubFundRepo) Create(_ context.Context, _ *model.Fund) (*model.Fund, error) {
	panic("not implemented")
}
func (s *stubFundRepo) Update(_ context.Context, _ *model.Fund) error { panic("not implemented") }
func (s *stubFundRepo) Delete(_ context.Context, _ string) error      { panic("not implemented") }
func (s *stubFundRepo) GetDB() bun.IDB                                { panic("not implemented") }
func (s *stubFundRepo) FindOneBy(_ context.Context, _ ...repository.QueryOption) (*model.Fund, error) {
	panic("not implemented")
}
func (s *stubFundRepo) FindAllBy(_ context.Context, _ ...repository.QueryOption) ([]model.Fund, error) {
	panic("not implemented")
}
func (s *stubFundRepo) Count(_ context.Context, _ ...repository.QueryOption) (int, error) {
	return 0, fmt.Errorf("not implemented")
}

// stubUOW implements repository.IUnitOfWork for tests.
// Only the methods needed by getAssetWithDetails are functional;
// all others panic so that unexpected calls are caught immediately.
type stubUOW struct {
	priceRepo  repository.IPriceRepository
	stockRepo  repository.IStockRepository
	cryptoRepo repository.ICryptoRepository
	fundRepo   repository.IFundRepository
}

func (u *stubUOW) AssetPrice() repository.IPriceRepository {
	if u.priceRepo != nil {
		return u.priceRepo
	}
	return &stubPriceRepo{}
}
func (u *stubUOW) Stock() repository.IStockRepository {
	if u.stockRepo != nil {
		return u.stockRepo
	}
	return &stubStockRepo{}
}
func (u *stubUOW) Crypto() repository.ICryptoRepository {
	if u.cryptoRepo != nil {
		return u.cryptoRepo
	}
	return &stubCryptoRepo{}
}
func (u *stubUOW) Fund() repository.IFundRepository {
	if u.fundRepo != nil {
		return u.fundRepo
	}
	return &stubFundRepo{}
}
func (u *stubUOW) Do(_ context.Context, _ func(repository.IUnitOfWork) error) error {
	panic("not implemented")
}
func (u *stubUOW) User() repository.IUserRepository                     { panic("not implemented") }
func (u *stubUOW) Portfolio() repository.IPortfolioRepository           { panic("not implemented") }
func (u *stubUOW) Asset() repository.IAssetRepository                   { panic("not implemented") }
func (u *stubUOW) Position() repository.IPositionRepository             { panic("not implemented") }
func (u *stubUOW) Transaction() repository.ITransactionRepository       { panic("not implemented") }
func (u *stubUOW) Watchlist() repository.IWatchlistRepository           { panic("not implemented") }
func (u *stubUOW) WatchlistAsset() repository.IWatchlistAssetRepository { panic("not implemented") }
func (u *stubUOW) Tag() repository.ITagRepository                       { panic("not implemented") }
func (u *stubUOW) PortfolioAsset() repository.IPortfolioAssetRepository { panic("not implemented") }
func (u *stubUOW) AssetType() repository.IAssetTypeRepository           { panic("not implemented") }
func (u *stubUOW) PortfolioTag() repository.IPortfolioTagRepository     { panic("not implemented") }
func (u *stubUOW) AssetTag() repository.IAssetTagRepository             { panic("not implemented") }
func (u *stubUOW) Instrument() repository.IInstrumentRepository         { panic("not implemented") }
func (u *stubUOW) InstrumentProviderMapping() repository.IInstrumentProviderMappingRepository {
	panic("not implemented")
}
func (u *stubUOW) InstrumentAlias() repository.IInstrumentAliasRepository { panic("not implemented") }
func (u *stubUOW) InstrumentSyncState() repository.IInstrumentSyncStateRepository {
	panic("not implemented")
}
func (u *stubUOW) DiscoveryLog() repository.IDiscoveryLogRepository { panic("not implemented") }
func (u *stubUOW) CatalogSyncRun() repository.ICatalogSyncRunRepository {
	panic("not implemented")
}
func (u *stubUOW) FinanceDatabaseSyncSetting() repository.IFinanceDatabaseSyncSettingRepository {
	panic("not implemented")
}
func (u *stubUOW) FinanceDatabaseSyncHistory() repository.IFinanceDatabaseSyncHistoryRepository {
	panic("not implemented")
}
func (u *stubUOW) MarketDataCredential() repository.IMarketDataCredentialRepository {
	panic("not implemented")
}
func (u *stubUOW) Session() repository.ISessionRepository    { panic("not implemented") }
func (u *stubUOW) AuthEvent() repository.AuthEventRepository { panic("not implemented") }
func (u *stubUOW) PasswordResetToken() repository.IPasswordResetTokenRepository {
	panic("not implemented")
}
func (u *stubUOW) EmailVerificationToken() repository.IEmailVerificationTokenRepository {
	panic("not implemented")
}
func (u *stubUOW) Performance() repository.IPerformanceRepository { panic("not implemented") }
func (u *stubUOW) Alert() repository.IAlertRepository             { panic("not implemented") }
func (u *stubUOW) NotificationPreferences() repository.INotificationPreferencesRepository {
	panic("not implemented")
}
func (u *stubUOW) NotificationLog() repository.INotificationLogRepository   { panic("not implemented") }
func (u *stubUOW) PushSubscription() repository.IPushSubscriptionRepository { panic("not implemented") }
func (u *stubUOW) ProviderRoutingConfig() repository.IProviderRoutingConfigRepository {
	panic("not implemented")
}
func (u *stubUOW) FXRate() repository.IFXRateRepository { panic("not implemented") }

// ---------------------------------------------------------------------------
// Helper: build a Resolver wired to the given stubs
// ---------------------------------------------------------------------------

func newTestResolver(
	ps service.IPortfolioService,
	as service.IAssetService,
	ts service.ITagService,
	uow repository.IUnitOfWork,
) *Resolver {
	return &Resolver{
		PortfolioService: ps,
		AssetService:     as,
		TagService:       ts,
		UOW:              uow,
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestBuildPortfolioAssets_EmptyPortfolio(t *testing.T) {
	r := newTestResolver(
		&stubPortfolioService{assets: nil, err: nil},
		&stubAssetService{},
		&stubTagService{},
		&stubUOW{},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Nil(t, result)
}

func TestBuildPortfolioAssets_GetPortfolioAssetsError(t *testing.T) {
	r := newTestResolver(
		&stubPortfolioService{assets: nil, err: fmt.Errorf("db error")},
		&stubAssetService{},
		&stubTagService{},
		&stubUOW{},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Nil(t, result)
}

func TestBuildPortfolioAssets_AssetNotFound_SkipsGracefully(t *testing.T) {
	// Portfolio has one asset, but AssetService returns ErrNotFound for it.
	// buildPortfolioAssets should skip it and return an empty slice (not nil,
	// because append was called with 0 successful items → nil slice).
	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "asset-missing", Quantity: 10, AveragePurchasePrice: 100},
			},
		},
		&stubAssetService{asset: nil, err: repository.ErrNotFound},
		&stubTagService{},
		&stubUOW{},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Nil(t, result, "should return nil when all assets are skipped")
}

func TestBuildPortfolioAssets_UnsupportedAssetType_SkipsGracefully(t *testing.T) {
	// Portfolio has an asset of unsupported type (OTHER_VALUABLE).
	// getAssetWithDetails returns (nil, nil) for unsupported types.
	otherType := model.AssetTypeOtherValuable
	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "asset-unsupported", Quantity: 1, AveragePurchasePrice: 500},
			},
		},
		&stubAssetService{
			asset: &model.Asset{
				ID:   "asset-unsupported",
				Name: "Collectible",
				Type: otherType,
			},
		},
		&stubTagService{tags: nil, err: nil},
		&stubUOW{},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Nil(t, result, "unsupported asset type should be skipped")
}

func TestBuildPortfolioAssets_BankAccountAsset_ResolvedSuccessfully(t *testing.T) {
	// BANK_ACCOUNT assets are mapped via mapBankAccountToGQL which does not
	// need any UOW sub-repo, making them the simplest type to test.
	bankMetadata := model.BankAccountMetadata{
		AccountType:   "savings",
		Institution:   "Test Bank",
		AccountNumber: "****1234",
		Currency:      "USD",
	}
	metadataBytes, _ := json.Marshal(bankMetadata)

	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{
					AssetID:              "bank-1",
					Quantity:             1,
					AveragePurchasePrice: 4500,
				},
			},
		},
		&stubAssetService{
			asset: &model.Asset{
				ID:          "bank-1",
				Name:        "My Savings",
				Type:        model.AssetTypeBankAccount,
				Metadata:    metadataBytes,
				IsTradeable: false,
			},
		},
		&stubTagService{tags: []model.Tag{{ID: "t1", Name: "cash"}}, err: nil},
		&stubUOW{
			priceRepo: &stubPriceRepo{
				latestPrice: &model.AssetPrice{
					AssetID: "bank-1",
					Price:   decimal.NewFromFloat(5000),
				},
				priceErr:   nil,
				statistics: nil,
				statsErr:   fmt.Errorf("no stats"),
			},
		},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Len(t, result, 1)

	pa := result[0]
	assert.NotNil(t, pa.Asset, "Asset must not be nil (would violate GraphQL non-null)")
	assert.Equal(t, 1.0, pa.Quantity)
	assert.Equal(t, 4500.0, *pa.AveragePurchasePrice)
	assert.NotNil(t, pa.CurrentValue, "CurrentValue should be set from latest price")
	assert.Equal(t, 5000.0, *pa.CurrentValue, "CurrentValue = quantity * currentPrice = 1 * 5000")
}

func TestBuildPortfolioAssets_MultipleResolvableAssets(t *testing.T) {
	// Portfolio has 2 BANK_ACCOUNT assets that both resolve successfully.
	bankMetadata := model.BankAccountMetadata{
		AccountType:   "checking",
		Institution:   "Test Bank",
		AccountNumber: "****5678",
		Currency:      "USD",
	}
	metadataBytes, _ := json.Marshal(bankMetadata)

	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "bank-ok", Quantity: 2, AveragePurchasePrice: 1000},
				{AssetID: "bank-ok", Quantity: 3, AveragePurchasePrice: 2000},
			},
		},
		&stubAssetService{
			asset: &model.Asset{
				ID:       "bank-ok",
				Name:     "Checking",
				Type:     model.AssetTypeBankAccount,
				Metadata: metadataBytes,
			},
		},
		&stubTagService{tags: nil, err: nil},
		&stubUOW{
			priceRepo: &stubPriceRepo{
				latestPrice: &model.AssetPrice{
					Price: decimal.NewFromFloat(1500),
				},
				statistics: nil,
				statsErr:   fmt.Errorf("no stats"),
			},
		},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Len(t, result, 2)

	// First asset: quantity=2, price=1500 → CurrentValue = 3000
	assert.Equal(t, 2.0, result[0].Quantity)
	assert.Equal(t, 3000.0, *result[0].CurrentValue)

	// Second asset: quantity=3, price=1500 → CurrentValue = 4500
	assert.Equal(t, 3.0, result[1].Quantity)
	assert.Equal(t, 4500.0, *result[1].CurrentValue)
}

func TestBuildPortfolioAssets_MixedAssets_SkipsUnresolvable(t *testing.T) {
	// Portfolio has 2 assets: one BANK_ACCOUNT that resolves and one that
	// is not found. Only the resolvable one should appear in the result.
	bankMetadata := model.BankAccountMetadata{
		AccountType:   "savings",
		Institution:   "Test Bank",
		AccountNumber: "****5678",
		Currency:      "USD",
	}
	metadataBytes, _ := json.Marshal(bankMetadata)

	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "bank-ok", Quantity: 1, AveragePurchasePrice: 5000},
				{AssetID: "bank-missing", Quantity: 2, AveragePurchasePrice: 1000},
			},
		},
		&perIDAssetService{
			assets: map[string]*model.Asset{
				"bank-ok": {
					ID:       "bank-ok",
					Name:     "Savings",
					Type:     model.AssetTypeBankAccount,
					Metadata: metadataBytes,
				},
			},
			errors: map[string]error{
				"bank-missing": repository.ErrNotFound,
			},
		},
		&stubTagService{tags: nil, err: nil},
		&stubUOW{
			priceRepo: &stubPriceRepo{
				latestPrice: &model.AssetPrice{
					Price: decimal.NewFromFloat(5000),
				},
				statistics: nil,
				statsErr:   fmt.Errorf("no stats"),
			},
		},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Len(t, result, 1, "only the resolvable asset should be returned")
	assert.NotNil(t, result[0].Asset, "Asset must not be nil")
	assert.Equal(t, 1.0, result[0].Quantity)
	assert.Equal(t, 5000.0, *result[0].CurrentValue)
}

func TestBuildPortfolioAssets_NoLatestPrice_NilCurrentValue(t *testing.T) {
	// When there's no latest price, CurrentValue should be nil.
	bankMetadata := model.BankAccountMetadata{
		AccountType:   "savings",
		Institution:   "Test Bank",
		AccountNumber: "****9999",
		Currency:      "USD",
	}
	metadataBytes, _ := json.Marshal(bankMetadata)

	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "bank-np", Quantity: 5, AveragePurchasePrice: 500},
			},
		},
		&stubAssetService{
			asset: &model.Asset{
				ID:       "bank-np",
				Name:     "No Price Account",
				Type:     model.AssetTypeBankAccount,
				Metadata: metadataBytes,
			},
		},
		&stubTagService{tags: nil, err: nil},
		&stubUOW{
			priceRepo: &stubPriceRepo{
				latestPrice: nil,
				priceErr:    fmt.Errorf("no price"),
				statistics:  nil,
				statsErr:    fmt.Errorf("no stats"),
			},
		},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Len(t, result, 1)
	assert.Nil(t, result[0].CurrentValue, "CurrentValue should be nil when no price is available")
	assert.Equal(t, 500.0, *result[0].AveragePurchasePrice)
}

func TestBuildPortfolioAssets_TagServiceError_StillResolves(t *testing.T) {
	// Tag lookup is non-fatal — a tag service error should not prevent
	// the asset from being resolved.
	bankMetadata := model.BankAccountMetadata{
		AccountType:   "savings",
		Institution:   "Test Bank",
		AccountNumber: "****tag",
		Currency:      "USD",
	}
	metadataBytes, _ := json.Marshal(bankMetadata)

	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "bank-tag", Quantity: 1, AveragePurchasePrice: 1000},
			},
		},
		&stubAssetService{
			asset: &model.Asset{
				ID:       "bank-tag",
				Name:     "Tag Error Account",
				Type:     model.AssetTypeBankAccount,
				Metadata: metadataBytes,
			},
		},
		&stubTagService{tags: nil, err: fmt.Errorf("tag db connection refused")},
		&stubUOW{
			priceRepo: &stubPriceRepo{
				latestPrice: &model.AssetPrice{
					Price: decimal.NewFromFloat(2000),
				},
				statistics: nil,
				statsErr:   fmt.Errorf("no stats"),
			},
		},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Len(t, result, 1, "asset should still resolve despite tag service error")
	assert.NotNil(t, result[0].Asset, "Asset must not be nil")
}

func TestBuildPortfolioAssets_StockAsset_ResolvedSuccessfully(t *testing.T) {
	// STOCK assets need UOW.Stock() and are tradeable (need price statistics).
	symbol := "AAPL"
	stockMetadata := model.StockMetadata{Exchange: "NASDAQ"}
	metadataBytes, _ := json.Marshal(stockMetadata)

	change := 2.5
	changePercent := 1.2

	r := newTestResolver(
		&stubPortfolioService{
			assets: []model.PortfolioAsset{
				{AssetID: "stock-1", Quantity: 10, AveragePurchasePrice: 150},
			},
		},
		&stubAssetService{
			asset: &model.Asset{
				ID:          "stock-1",
				Name:        "Apple Inc.",
				Symbol:      &symbol,
				Type:        model.AssetTypeStock,
				Metadata:    metadataBytes,
				IsTradeable: true,
			},
		},
		&stubTagService{tags: nil, err: nil},
		&stubUOW{
			priceRepo: &stubPriceRepo{
				latestPrice: &model.AssetPrice{
					Price: decimal.NewFromFloat(175),
				},
				priceErr: nil,
				statistics: &repository.PriceStatistics{
					Change:        decimal.NewFromFloat(change),
					ChangePercent: decimal.NewFromFloat(changePercent),
				},
				statsErr: nil,
			},
			stockRepo: &stubStockRepo{
				stock: &model.Stock{AssetID: "stock-1"},
				err:   nil,
			},
		},
	)

	result := r.buildPortfolioAssets(context.Background(), "portfolio-1")
	assert.Len(t, result, 1)

	pa := result[0]
	assert.NotNil(t, pa.Asset)
	assert.Equal(t, 10.0, pa.Quantity)
	assert.Equal(t, 150.0, *pa.AveragePurchasePrice)
	assert.Equal(t, 1750.0, *pa.CurrentValue, "CurrentValue = 10 * 175 = 1750")
}
