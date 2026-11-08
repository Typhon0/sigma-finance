package graphql

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
	"sigma_finance/internal/service/crypto"
	"sigma_finance/internal/service/sync/blockchain"
	"sigma_finance/internal/service/sync/blockchain/alchemy"
	"sigma_finance/internal/service/sync/blockchain/evm"
	"sigma_finance/internal/service/sync/blockchain/registry"
)

func (r *Resolver) getDB() *bun.DB {
	if uow, ok := r.UOW.(*repository.UnitOfWork); ok {
		return uow.GetDB()
	}
	return nil
}

func (r *Resolver) getBlockchainProvider(ctx context.Context, userID string) blockchain.BlockchainProvider {
	db := r.getDB()
	var netConfigs []model.BlockchainNetworkConfig
	if db != nil {
		_ = db.NewSelect().Model(&netConfigs).Scan(ctx)
	}
	customEndpoints := make(map[model.BlockchainNetwork]string)
	for _, c := range netConfigs {
		if c.RPCURL != "" {
			customEndpoints[c.Network] = c.RPCURL
		}
	}
	apiKey, _, _ := resolveAlchemyKey(ctx, db, userID)
	return registry.NewAdapterRegistry(apiKey, "", customEndpoints)
}

// CreateWalletDevice creates a parent container for multi-chain hardware/software wallets
func (r *mutationResolver) CreateWalletDevice(ctx context.Context, input gqlModel.CreateWalletDeviceInput) (*gqlModel.WalletDevice, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	devType := model.WalletDeviceType(input.DeviceType.String())
	device := &model.WalletDevice{
		UserID:     userID,
		Name:       input.Name,
		DeviceType: devType,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}

	_, err = db.NewInsert().Model(device).Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create wallet device: %w", err)
	}

	return &gqlModel.WalletDevice{
		ID:         device.ID,
		Name:       device.Name,
		DeviceType: input.DeviceType,
		Accounts:   []*gqlModel.WalletAccount{},
		CreatedAt:  device.CreatedAt,
		UpdatedAt:  device.UpdatedAt,
	}, nil
}

// UpdateWalletDevice modifies a registered wallet device container
func (r *mutationResolver) UpdateWalletDevice(ctx context.Context, id string, name string, deviceType gqlModel.WalletDeviceType) (*gqlModel.WalletDevice, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return nil, errors.New("device name cannot be empty")
	}

	devType := model.WalletDeviceType(deviceType.String())
	var device model.WalletDevice
	err = db.NewSelect().
		Model(&device).
		Where("id = ? AND user_id = ?", id, userID).
		Scan(ctx)
	if err != nil {
		return nil, errors.New("wallet device not found")
	}

	device.Name = trimmedName
	device.DeviceType = devType
	device.UpdatedAt = time.Now().UTC()

	_, err = db.NewUpdate().
		Model(&device).
		Column("name", "device_type", "updated_at").
		Where("id = ? AND user_id = ?", id, userID).
		Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update wallet device: %w", err)
	}

	return &gqlModel.WalletDevice{
		ID:         device.ID,
		Name:       device.Name,
		DeviceType: deviceType,
		Accounts:   []*gqlModel.WalletAccount{},
		CreatedAt:  device.CreatedAt,
		UpdatedAt:  device.UpdatedAt,
	}, nil
}

// RemoveWalletDevice deletes a device container and unlinks any attached accounts
func (r *mutationResolver) RemoveWalletDevice(ctx context.Context, id string) (bool, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, err
	}

	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	// 1. Unlink attached accounts
	_, err = db.NewUpdate().
		Model((*model.WalletAccount)(nil)).
		Set("device_id = NULL").
		Where("device_id = ? AND user_id = ?", id, userID).
		Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to unlink accounts from device: %w", err)
	}

	// 2. Delete the device
	res, err := db.NewDelete().
		Model((*model.WalletDevice)(nil)).
		Where("id = ? AND user_id = ?", id, userID).
		Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to delete wallet device: %w", err)
	}

	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// AssignWalletDevice links or unlinks a wallet account to a hardware/software device
func (r *mutationResolver) AssignWalletDevice(ctx context.Context, walletAccountID string, deviceID *string) (bool, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, err
	}

	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	// If deviceID provided, verify device ownership
	if deviceID != nil && *deviceID != "" {
		count, err := db.NewSelect().
			Model((*model.WalletDevice)(nil)).
			Where("id = ? AND user_id = ?", *deviceID, userID).
			Count(ctx)
		if err != nil || count == 0 {
			return false, errors.New("target wallet device not found")
		}
	}

	upd := db.NewUpdate().
		Model((*model.WalletAccount)(nil)).
		Where("id = ? AND user_id = ?", walletAccountID, userID)

	if deviceID != nil && *deviceID != "" {
		upd = upd.Set("device_id = ?", *deviceID)
	} else {
		upd = upd.Set("device_id = NULL")
	}

	res, err := upd.Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to update wallet account device: %w", err)
	}

	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

func maskAPIKey(key string) string {
	trimmed := strings.TrimSpace(key)
	if len(trimmed) == 0 {
		return ""
	}
	if len(trimmed) <= 8 {
		return "••••••••"
	}
	if strings.HasPrefix(trimmed, "alch_") && len(trimmed) > 12 {
		return trimmed[:8] + "••••••••" + trimmed[len(trimmed)-4:]
	}
	return trimmed[:4] + "••••••••" + trimmed[len(trimmed)-4:]
}

func resolveAlchemyKey(ctx context.Context, db *bun.DB, userID string) (key string, source string, masked string) {
	if db != nil {
		var cred model.SyncCredential
		q := db.NewSelect().
			Model(&cred).
			Where("provider = 'ALCHEMY'")

		if userID != "" {
			q = q.Where("user_id = ? OR is_system = true", userID)
		} else {
			q = q.Where("is_system = true")
		}

		err := q.Order("updated_at DESC").Limit(1).Scan(ctx)
		if err == nil {
			raw, err := cred.Decrypt()
			if err == nil && raw != "" {
				var payload struct {
					APIKey string `json:"apiKey"`
				}
				if json.Unmarshal([]byte(raw), &payload) == nil && strings.TrimSpace(payload.APIKey) != "" {
					k := strings.TrimSpace(payload.APIKey)
					return k, "DATABASE", maskAPIKey(k)
				}
			}
		}
	}

	envKey := strings.TrimSpace(os.Getenv("ALCHEMY_API_KEY"))
	if envKey != "" {
		return envKey, "ENV", maskAPIKey(envKey)
	}

	return "", "NONE", ""
}

// AddWalletAccount registers a blockchain address or xpub and auto-provisions a portfolio Account
func (r *mutationResolver) AddWalletAccount(ctx context.Context, input gqlModel.AddWalletAccountInput) (*gqlModel.WalletAccount, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	// 1. Verify portfolio ownership
	portfolio, err := r.PortfolioService.GetByID(ctx, input.PortfolioID)
	if err != nil || portfolio == nil {
		return nil, errors.New("portfolio not found or access denied")
	}

	net := model.BlockchainNetwork(input.Network.String())
	isXpub := false
	if input.IsXpub != nil {
		isXpub = *input.IsXpub
	}

	wacc := &model.WalletAccount{
		UserID:        userID,
		DeviceID:      input.DeviceID,
		Network:       net,
		AddressOrXpub: input.AddressOrXpub,
		IsXpub:        isXpub,
		Label:         input.Label,
		IsActive:      true,
		HistoryStatus: model.WalletHistoryStatusPending,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	if err := wacc.Validate(); err != nil {
		return nil, err
	}

	// 2. Auto-provision an Account (Type: CRYPTO_WALLET) under target Portfolio
	accName := fmt.Sprintf("%s Wallet", net)
	if input.Label != nil && *input.Label != "" {
		accName = *input.Label
	}

	currencyUSD := string(model.CurrencyUSD)
	syncProv := "ALCHEMY"
	createdAcc, err := r.AccountService.CreateAccount(ctx, userID, service.CreateAccountInput{
		PortfolioID:   input.PortfolioID,
		Name:          accName,
		Type:          model.AccountTypeCryptoWallet,
		TaxWrapper:    portfolio.TaxWrapper,
		AccountNumber: &input.AddressOrXpub,
		Currency:      &currencyUSD,
		SyncProvider:  &syncProv,
	})
	if err == nil && createdAcc != nil {
		wacc.AccountID = &createdAcc.ID
	}

	// 3. Persist WalletAccount
	_, err = db.NewInsert().Model(wacc).Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to save wallet account: %w", err)
	}

	// 4. Asynchronously kick off initial sync via multi-provider registry
	go func(accID string) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		provider := r.getBlockchainProvider(bgCtx, userID)
		svc := blockchain.NewWalletSyncService(db, r.UOW, provider)
		if syncErr := svc.SyncWalletAccount(bgCtx, accID); syncErr != nil {
			log.Printf("[WARN] [WalletResolver] Background initial sync error for %s: %v", accID, syncErr)
		}
	}(wacc.ID)

	return &gqlModel.WalletAccount{
		ID:                  wacc.ID,
		PortfolioID:         &input.PortfolioID,
		Network:             input.Network,
		AddressOrXpub:       wacc.AddressOrXpub,
		IsXpub:              wacc.IsXpub,
		Label:               wacc.Label,
		IsActive:            wacc.IsActive,
		HistoryStatus:       string(wacc.HistoryStatus),
		CapabilityLevel:     wacc.CapabilityLevel,
		DiscoveredAddresses: wacc.DiscoveredAddresses,
		Balances:            []*gqlModel.WalletBalance{},
		CreatedAt:           wacc.CreatedAt,
		UpdatedAt:           wacc.UpdatedAt,
	}, nil
}

// RemoveWalletAccount deletes a wallet account
func (r *mutationResolver) RemoveWalletAccount(ctx context.Context, id string) (bool, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, err
	}

	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	res, err := db.NewDelete().
		Model((*model.WalletAccount)(nil)).
		Where("id = ? AND user_id = ?", id, userID).
		Exec(ctx)
	if err != nil {
		return false, err
	}

	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// TriggerWalletSync triggers an immediate sync for a wallet account
func (r *mutationResolver) TriggerWalletSync(ctx context.Context, id string) (bool, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, err
	}

	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	var wacc model.WalletAccount
	err = db.NewSelect().
		Model(&wacc).
		Where("id = ? AND user_id = ?", id, userID).
		Scan(ctx)
	if err != nil {
		return false, errors.New("wallet account not found")
	}

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		provider := r.getBlockchainProvider(bgCtx, userID)
		svc := blockchain.NewWalletSyncService(db, r.UOW, provider)
		_ = svc.SyncWalletAccount(bgCtx, wacc.ID)
	}()

	return true, nil
}

// ToggleSpamToken hides or unhides a token from the main wallet balance view
func (r *mutationResolver) ToggleSpamToken(ctx context.Context, balanceID string, isHidden bool) (bool, error) {
	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	_, err := db.NewUpdate().
		Model((*model.WalletBalance)(nil)).
		Set("is_hidden = ?", isHidden).
		Where("id = ?", balanceID).
		Exec(ctx)
	return err == nil, err
}

// RefreshWalletBalancePrice forces a live price check and persists the new price
func (r *mutationResolver) RefreshWalletBalancePrice(ctx context.Context, balanceID string) (*gqlModel.WalletBalance, error) {
	_, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	pricingSvc := crypto.NewPricingService(db)
	bal, err := pricingSvc.RefreshSingleBalance(ctx, balanceID)
	if err != nil {
		return nil, err
	}

	return mapWalletBalanceToGQL(bal), nil
}

// SetWalletBalanceCostBasis updates the manual cost basis for a wallet balance
func (r *mutationResolver) SetWalletBalanceCostBasis(ctx context.Context, balanceID string, costBasisPerUnit float64, currency *string) (bool, error) {
	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	curr := "USD"
	if currency != nil && *currency != "" {
		curr = *currency
	}

	dec := decimal.NewFromFloat(costBasisPerUnit)
	now := time.Now().UTC()

	_, err := db.NewUpdate().
		Model((*model.WalletBalance)(nil)).
		Set("cost_basis_per_unit = ?", dec).
		Set("cost_basis_currency = ?", curr).
		Set("cost_basis_type = ?", "MANUAL").
		Set("last_updated_at = ?", now).
		Where("id = ?", balanceID).
		Exec(ctx)
	return err == nil, err
}

// ResetWalletBalanceCostBasis restores auto-calculated basis if present
func (r *mutationResolver) ResetWalletBalanceCostBasis(ctx context.Context, balanceID string) (bool, error) {
	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	var bal model.WalletBalance
	err := db.NewSelect().
		Model(&bal).
		Where("id = ?", balanceID).
		Scan(ctx)
	if err != nil {
		return false, err
	}

	basisType := "UNRECORDED"
	if bal.AutoEstimatedBasis != nil && bal.AutoEstimatedBasis.IsPositive() {
		basisType = "HISTORICAL_FMV"
	}

	now := time.Now().UTC()
	_, err = db.NewUpdate().
		Model((*model.WalletBalance)(nil)).
		Set("cost_basis_per_unit = auto_estimated_basis").
		Set("cost_basis_type = ?", basisType).
		Set("last_updated_at = ?", now).
		Where("id = ?", balanceID).
		Exec(ctx)
	return err == nil, err
}

// ResolveWalletReview approves or dismisses a staged DeFi activity
func (r *mutationResolver) ResolveWalletReview(ctx context.Context, reviewID string, action string, customType *string) (bool, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, err
	}

	db := r.getDB()
	if db == nil {
		return false, errors.New("database connection unavailable")
	}

	status := model.WalletReviewStatusApproved
	if strings.EqualFold(action, "DISMISS") {
		status = model.WalletReviewStatusDismissed
	}

	_, err = db.NewUpdate().
		Model((*model.WalletActivityReview)(nil)).
		Set("review_status = ?", status).
		Set("updated_at = NOW()").
		Where("id = ? AND user_id = ?", reviewID, userID).
		Exec(ctx)

	return err == nil, err
}

// ConfigureAlchemyKey updates the instance Alchemy API key
func (r *mutationResolver) ConfigureAlchemyKey(ctx context.Context, apiKey string) (bool, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return false, err
	}

	trimmed := strings.TrimSpace(apiKey)
	if trimmed == "" {
		return false, errors.New("API key cannot be empty")
	}

	// Set in process environment
	os.Setenv("ALCHEMY_API_KEY", trimmed)

	// Persist encrypted in sync_credentials if SyncService is available
	if r.SyncService != nil {
		rawJSON := fmt.Sprintf(`{"apiKey": "%s"}`, trimmed)
		_, _ = r.SyncService.RegisterCredential(ctx, userID, "ALCHEMY", rawJSON)
	}

	return true, nil
}

// WalletDevices returns all multi-chain devices for the current user
func (r *queryResolver) WalletDevices(ctx context.Context) ([]*gqlModel.WalletDevice, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var devices []model.WalletDevice
	err = db.NewSelect().
		Model(&devices).
		Where("wd.user_id = ?", userID).
		Relation("Accounts.Balances").
		Relation("Accounts.Account").
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	var result []*gqlModel.WalletDevice
	for _, d := range devices {
		devType := gqlModel.WalletDeviceType(d.DeviceType)
		var accs []*gqlModel.WalletAccount
		for _, a := range d.Accounts {
			accs = append(accs, mapWalletAccountToGQL(a))
		}
		result = append(result, &gqlModel.WalletDevice{
			ID:         d.ID,
			Name:       d.Name,
			DeviceType: devType,
			Accounts:   accs,
			CreatedAt:  d.CreatedAt,
			UpdatedAt:  d.UpdatedAt,
		})
	}
	return result, nil
}

// WalletAccounts returns wallet accounts for the user, optionally filtered by portfolio
func (r *queryResolver) WalletAccounts(ctx context.Context, portfolioID *string) ([]*gqlModel.WalletAccount, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var accounts []model.WalletAccount
	q := db.NewSelect().
		Model(&accounts).
		Where("wacc.user_id = ?", userID).
		Relation("Balances").
		Relation("Account").
		Relation("Device")

	if portfolioID != nil && *portfolioID != "" {
		q = q.Where("account.portfolio_id = ?", *portfolioID)
	}

	err = q.Scan(ctx)
	if err != nil {
		return nil, err
	}

	var result []*gqlModel.WalletAccount
	for _, a := range accounts {
		result = append(result, mapWalletAccountToGQL(&a))
	}
	return result, nil
}

// WalletCUUsage returns monthly Compute Units consumption stats
func (r *queryResolver) WalletCUUsage(ctx context.Context) (*gqlModel.WalletCUUsage, error) {
	db := r.getDB()
	var userID string
	if uid, err := getUserIDFromContext(ctx); err == nil {
		userID = uid
	}
	_, source, masked := resolveAlchemyKey(ctx, db, userID)
	hasKey := source != "NONE"

	tracker := alchemy.NewCUTracker(db)
	month, consumed, maxUnits, throttled := tracker.GetStatus()

	return &gqlModel.WalletCUUsage{
		BillingMonth:  month,
		ConsumedUnits: int32(consumed),
		MaxQuota:      int32(maxUnits),
		IsThrottled:   throttled,
		HasKey:        hasKey,
		KeySource:     &source,
		MaskedKey:     &masked,
	}, nil
}

// PendingWalletReviews returns staged transactions awaiting confirmation
func (r *queryResolver) PendingWalletReviews(ctx context.Context, portfolioID string) ([]*gqlModel.WalletActivityReview, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}

	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var reviews []model.WalletActivityReview
	err = db.NewSelect().
		Model(&reviews).
		Where("war.user_id = ? AND war.review_status = 'PENDING'", userID).
		Relation("Activity").
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	var result []*gqlModel.WalletActivityReview
	for _, rev := range reviews {
		result = append(result, &gqlModel.WalletActivityReview{
			ID:               rev.ID,
			WalletActivityID: rev.WalletActivityID,
			ReviewStatus:     string(rev.ReviewStatus),
			SuggestedType:    string(rev.SuggestedType),
			Notes:            rev.Notes,
			CreatedAt:        rev.CreatedAt,
		})
	}
	return result, nil
}

func mapWalletBalanceToGQL(b *model.WalletBalance) *gqlModel.WalletBalance {
	flt, _ := b.FormattedQuantity.Float64()

	var costBasisPerUnit *float64
	if b.CostBasisPerUnit != nil {
		f, _ := b.CostBasisPerUnit.Float64()
		costBasisPerUnit = &f
	}

	var autoEstimatedBasis *float64
	if b.AutoEstimatedBasis != nil {
		f, _ := b.AutoEstimatedBasis.Float64()
		autoEstimatedBasis = &f
	}

	var basisType *string
	if b.CostBasisType != "" {
		bt := string(b.CostBasisType)
		basisType = &bt
	}

	var basisCurrency *string
	if b.CostBasisCurrency != "" {
		bc := b.CostBasisCurrency
		basisCurrency = &bc
	}

	var currentPrice *float64
	var currentValue *float64
	var dayChange24h *float64
	isPriceResolved := false

	if b.CurrentPrice != nil && b.CurrentPrice.IsPositive() {
		p, _ := b.CurrentPrice.Float64()
		currentPrice = &p
		isPriceResolved = true
		val := flt * p
		currentValue = &val
	}

	if b.DayChange24h != nil {
		dc, _ := b.DayChange24h.Float64()
		dayChange24h = &dc
	}

	return &gqlModel.WalletBalance{
		ID:                 b.ID,
		Symbol:             b.Symbol,
		Name:               &b.Name,
		Decimals:           int32(b.Decimals),
		RawBalance:         b.RawBalance,
		FormattedQuantity:  flt,
		TokenAddress:       b.TokenAddress,
		IsSpam:             b.IsSpam,
		IsHidden:           b.IsHidden,
		IsStale:            b.IsStale,
		CostBasisPerUnit:   costBasisPerUnit,
		CostBasisCurrency:  basisCurrency,
		CostBasisType:      basisType,
		AutoEstimatedBasis: autoEstimatedBasis,
		AcquiredAt:         b.AcquiredAt,
		LastUpdatedAt:      b.LastUpdatedAt,
		CurrentPrice:       currentPrice,
		CurrentValue:       currentValue,
		DayChange24h:       dayChange24h,
		PriceUpdatedAt:     b.PriceUpdatedAt,
		PriceSource:        b.PriceSource,
		IsPriceResolved:    isPriceResolved,
	}
}

func mapWalletAccountToGQL(a *model.WalletAccount) *gqlModel.WalletAccount {
	var balances []*gqlModel.WalletBalance
	for _, b := range a.Balances {
		balances = append(balances, mapWalletBalanceToGQL(b))
	}

	var portfolioID *string
	if a.Account != nil && a.Account.PortfolioID != "" {
		portfolioID = &a.Account.PortfolioID
	}

	var device *gqlModel.WalletDevice
	if a.Device != nil {
		device = &gqlModel.WalletDevice{
			ID:         a.Device.ID,
			Name:       a.Device.Name,
			DeviceType: gqlModel.WalletDeviceType(a.Device.DeviceType),
			CreatedAt:  a.Device.CreatedAt,
			UpdatedAt:  a.Device.UpdatedAt,
		}
	}

	capLevel := a.CapabilityLevel
	if capLevel == "" {
		capLevel = model.WalletCapabilityBalanceOnly
	}

	return &gqlModel.WalletAccount{
		ID:                  a.ID,
		PortfolioID:         portfolioID,
		DeviceID:            a.DeviceID,
		Device:              device,
		Network:             gqlModel.BlockchainNetwork(a.Network),
		AddressOrXpub:       a.AddressOrXpub,
		IsXpub:              a.IsXpub,
		Label:               a.Label,
		IsActive:            a.IsActive,
		LastSyncAt:          a.LastSyncAt,
		HistoryStatus:       string(a.HistoryStatus),
		CapabilityLevel:     capLevel,
		DiscoveredAddresses: a.DiscoveredAddresses,
		LastSyncError:       a.LastSyncError,
		Balances:            balances,
		CreatedAt:           a.CreatedAt,
		UpdatedAt:           a.UpdatedAt,
	}
}

// AddMultiNetworkWallet creates accounts for multiple EVM networks simultaneously
func (r *mutationResolver) AddMultiNetworkWallet(ctx context.Context, input gqlModel.AddMultiNetworkWalletInput) ([]*gqlModel.WalletAccount, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var deviceID *string
	if input.DeviceName != nil && strings.TrimSpace(*input.DeviceName) != "" {
		devType := model.WalletDeviceTypeSoftware
		if input.DeviceType != nil {
			devType = model.WalletDeviceType(*input.DeviceType)
		}
		device := &model.WalletDevice{
			UserID:     userID,
			Name:       strings.TrimSpace(*input.DeviceName),
			DeviceType: devType,
		}
		if _, errDev := db.NewInsert().Model(device).Exec(ctx); errDev == nil {
			deviceID = &device.ID
		}
	}

	var createdAccounts []*gqlModel.WalletAccount
	for _, netGQL := range input.Networks {
		accInput := gqlModel.AddWalletAccountInput{
			PortfolioID:   input.PortfolioID,
			Network:       netGQL,
			AddressOrXpub: strings.TrimSpace(input.Address),
			Label:         input.Label,
			DeviceID:      deviceID,
		}
		wacc, errAdd := r.AddWalletAccount(ctx, accInput)
		if errAdd == nil && wacc != nil {
			createdAccounts = append(createdAccounts, wacc)
		}
	}

	return createdAccounts, nil
}

// AddMultiChainWallet creates a WalletDevice container and provisions accounts for EVM, Solana, and Bitcoin simultaneously
func (r *mutationResolver) AddMultiChainWallet(ctx context.Context, input gqlModel.AddMultiChainWalletInput) (*gqlModel.WalletDevice, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	// 1. Verify target portfolio exists and user has access
	portfolio, err := r.PortfolioService.GetByID(ctx, input.PortfolioID)
	if err != nil || portfolio == nil {
		return nil, errors.New("portfolio not found or access denied")
	}

	deref := func(s *string) string {
		if s == nil {
			return ""
		}
		return *s
	}

	evmAddr := strings.TrimSpace(deref(input.EvmAddress))
	solanaAddr := strings.TrimSpace(deref(input.SolanaAddress))
	btcAddr := strings.TrimSpace(deref(input.BitcoinAddressOrXpub))

	if evmAddr == "" && solanaAddr == "" && btcAddr == "" {
		return nil, errors.New("at least one blockchain address must be provided")
	}

	// 2. Create the parent WalletDevice
	devName := strings.TrimSpace(input.Name)
	if devName == "" {
		devName = "Multi-Chain Wallet"
	}
	devType := model.WalletDeviceType(input.DeviceType.String())
	device := &model.WalletDevice{
		UserID:     userID,
		Name:       devName,
		DeviceType: devType,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if _, errDev := db.NewInsert().Model(device).Exec(ctx); errDev != nil {
		return nil, fmt.Errorf("failed to create wallet device: %w", errDev)
	}

	var createdAccounts []*gqlModel.WalletAccount

	// 3. Provision EVM accounts if EVM address is provided
	if evmAddr != "" {
		networks := input.EvmNetworks
		if len(networks) == 0 {
			networks = []gqlModel.BlockchainNetwork{
				gqlModel.BlockchainNetworkEthereum,
				gqlModel.BlockchainNetworkBase,
				gqlModel.BlockchainNetworkArbitrum,
				gqlModel.BlockchainNetworkOptimism,
				gqlModel.BlockchainNetworkPolygon,
			}
		}
		for _, netGQL := range networks {
			label := fmt.Sprintf("%s (%s)", devName, netGQL)
			accInput := gqlModel.AddWalletAccountInput{
				PortfolioID:   input.PortfolioID,
				Network:       netGQL,
				AddressOrXpub: evmAddr,
				Label:         &label,
				DeviceID:      &device.ID,
			}
			wacc, errAdd := r.AddWalletAccount(ctx, accInput)
			if errAdd == nil && wacc != nil {
				createdAccounts = append(createdAccounts, wacc)
			}
		}
	}

	// 4. Provision Solana account if address provided
	if solanaAddr != "" {
		label := fmt.Sprintf("%s (Solana)", devName)
		accInput := gqlModel.AddWalletAccountInput{
			PortfolioID:   input.PortfolioID,
			Network:       gqlModel.BlockchainNetworkSolana,
			AddressOrXpub: solanaAddr,
			Label:         &label,
			DeviceID:      &device.ID,
		}
		wacc, errAdd := r.AddWalletAccount(ctx, accInput)
		if errAdd == nil && wacc != nil {
			createdAccounts = append(createdAccounts, wacc)
		}
	}

	// 5. Provision Bitcoin account if address/xpub provided
	if btcAddr != "" {
		isXpub := strings.HasPrefix(btcAddr, "xpub") || strings.HasPrefix(btcAddr, "ypub") || strings.HasPrefix(btcAddr, "zpub")
		label := fmt.Sprintf("%s (Bitcoin)", devName)
		accInput := gqlModel.AddWalletAccountInput{
			PortfolioID:   input.PortfolioID,
			Network:       gqlModel.BlockchainNetworkBitcoin,
			AddressOrXpub: btcAddr,
			IsXpub:        &isXpub,
			Label:         &label,
			DeviceID:      &device.ID,
		}
		wacc, errAdd := r.AddWalletAccount(ctx, accInput)
		if errAdd == nil && wacc != nil {
			createdAccounts = append(createdAccounts, wacc)
		}
	}

	return &gqlModel.WalletDevice{
		ID:         device.ID,
		Name:       device.Name,
		DeviceType: input.DeviceType,
		Accounts:   createdAccounts,
		CreatedAt:  device.CreatedAt,
		UpdatedAt:  device.UpdatedAt,
	}, nil
}

// AddCustomToken introspects an ERC-20 contract and appends it to wallet balances
func (r *mutationResolver) AddCustomToken(ctx context.Context, input gqlModel.AddCustomTokenInput) (*gqlModel.WalletBalance, error) {
	userID, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var wacc model.WalletAccount
	err = db.NewSelect().Model(&wacc).Where("id = ? AND user_id = ?", input.WalletAccountID, userID).Scan(ctx)
	if err != nil {
		return nil, errors.New("wallet account not found")
	}

	provider := r.getBlockchainProvider(ctx, userID)
	reg, ok := provider.(*registry.AdapterRegistry)
	if !ok {
		return nil, errors.New("adapter registry unavailable")
	}

	tokenInfo, errIntro := reg.EVMAdapter().IntrospectERC20(ctx, wacc.Network, input.TokenAddress)
	if errIntro != nil {
		return nil, fmt.Errorf("failed to introspect ERC-20 token: %w", errIntro)
	}

	tokAddr := strings.ToLower(input.TokenAddress)
	balRecord := model.NewWalletBalanceFromRaw(wacc.ID, tokenInfo.Symbol, tokenInfo.Name, tokenInfo.Decimals, "0", &tokAddr, false)

	_, err = db.NewInsert().
		Model(balRecord).
		On("CONFLICT (wallet_account_id, COALESCE(token_address, 'NATIVE')) DO UPDATE").
		Set("symbol = EXCLUDED.symbol").
		Set("name = EXCLUDED.name").
		Set("decimals = EXCLUDED.decimals").
		Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to save custom token balance: %w", err)
	}

	pricingSvc := crypto.NewPricingService(db)
	_ = pricingSvc.RefreshBalances(ctx, []*model.WalletBalance{balRecord})

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		svc := blockchain.NewWalletSyncService(db, r.UOW, provider)
		_ = svc.SyncWalletAccount(bgCtx, wacc.ID)
	}()

	return mapWalletBalanceToGQL(balRecord), nil
}

// BlockchainNetworkConfigs queries all network RPC and explorer configurations
func (r *queryResolver) BlockchainNetworkConfigs(ctx context.Context) ([]*gqlModel.BlockchainNetworkConfig, error) {
	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}
	var configs []model.BlockchainNetworkConfig
	err := db.NewSelect().Model(&configs).Order("network ASC").Scan(ctx)
	if err != nil {
		return nil, err
	}
	var gqlConfigs []*gqlModel.BlockchainNetworkConfig
	for _, c := range configs {
		gqlConfigs = append(gqlConfigs, &gqlModel.BlockchainNetworkConfig{
			Network:        gqlModel.BlockchainNetwork(c.Network),
			RPCURL:         c.RPCURL,
			ExplorerAPIURL: c.ExplorerAPIURL,
			Source:         c.Source,
			UpdatedAt:      c.UpdatedAt,
		})
	}
	return gqlConfigs, nil
}

// UpdateBlockchainNetworkConfig saves custom RPC/explorer endpoint to database
func (r *mutationResolver) UpdateBlockchainNetworkConfig(ctx context.Context, input gqlModel.UpdateBlockchainNetworkConfigInput) (*gqlModel.BlockchainNetworkConfig, error) {
	_, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	cfg := &model.BlockchainNetworkConfig{
		Network:        model.BlockchainNetwork(input.Network),
		RPCURL:         input.RPCURL,
		ExplorerAPIURL: input.ExplorerAPIURL,
		Source:         "DATABASE",
		UpdatedAt:      time.Now().UTC(),
	}

	_, err = db.NewInsert().
		Model(cfg).
		On("CONFLICT (network) DO UPDATE").
		Set("rpc_url = EXCLUDED.rpc_url").
		Set("explorer_api_url = EXCLUDED.explorer_api_url").
		Set("source = EXCLUDED.source").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)
	if err != nil {
		return nil, err
	}

	return &gqlModel.BlockchainNetworkConfig{
		Network:        input.Network,
		RPCURL:         cfg.RPCURL,
		ExplorerAPIURL: cfg.ExplorerAPIURL,
		Source:         cfg.Source,
		UpdatedAt:      cfg.UpdatedAt,
	}, nil
}

// ResetBlockchainNetworkConfig resets network config to default endpoints
func (r *mutationResolver) ResetBlockchainNetworkConfig(ctx context.Context, network gqlModel.BlockchainNetwork) (*gqlModel.BlockchainNetworkConfig, error) {
	_, err := getUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	db := r.getDB()
	if db == nil {
		return nil, errors.New("database connection unavailable")
	}

	defaultURL := evm.DefaultRPCEndpoints[model.BlockchainNetwork(network)]
	if defaultURL == "" {
		if network == gqlModel.BlockchainNetworkSolana {
			defaultURL = "https://api.mainnet-beta.solana.com"
		} else if network == gqlModel.BlockchainNetworkBitcoin {
			defaultURL = "https://mempool.space/api"
		}
	}

	cfg := &model.BlockchainNetworkConfig{
		Network:   model.BlockchainNetwork(network),
		RPCURL:    defaultURL,
		Source:    "DEFAULT",
		UpdatedAt: time.Now().UTC(),
	}

	_, err = db.NewUpdate().
		Model(cfg).
		Column("rpc_url", "source", "updated_at").
		Where("network = ?", string(network)).
		Exec(ctx)
	if err != nil {
		return nil, err
	}

	return &gqlModel.BlockchainNetworkConfig{
		Network:   network,
		RPCURL:    cfg.RPCURL,
		Source:    cfg.Source,
		UpdatedAt: cfg.UpdatedAt,
	}, nil
}
