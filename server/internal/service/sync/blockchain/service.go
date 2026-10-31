package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/uptrace/bun"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service/crypto"
)

// IWalletSyncService coordinates blockchain synchronization and activity classification
type IWalletSyncService interface {
	SyncWalletAccount(ctx context.Context, walletAccountID string) error
	SyncAllActiveWallets(ctx context.Context) error
}

// WalletSyncService implements IWalletSyncService
type WalletSyncService struct {
	db         bun.IDB
	uow        repository.IUnitOfWork
	provider   BlockchainProvider
	spamFilter *SpamFilter
	classifier *ActivityClassifier
	pricingSvc *crypto.PricingService
}

// NewWalletSyncService creates a new WalletSyncService
func NewWalletSyncService(
	db bun.IDB,
	uow repository.IUnitOfWork,
	provider BlockchainProvider,
) *WalletSyncService {
	return &WalletSyncService{
		db:         db,
		uow:        uow,
		provider:   provider,
		spamFilter: NewSpamFilter(db),
		classifier: NewActivityClassifier(),
		pricingSvc: crypto.NewPricingService(db),
	}
}

// SyncWalletAccount executes balance fetching and genesis transfer pagination for an account
func (s *WalletSyncService) SyncWalletAccount(ctx context.Context, walletAccountID string) error {
	var account model.WalletAccount
	err := s.db.NewSelect().
		Model(&account).
		Where("id = ?", walletAccountID).
		Scan(ctx)
	if err != nil {
		return fmt.Errorf("wallet account %s not found: %w", walletAccountID, err)
	}

	account.HistoryStatus = model.WalletHistoryStatusInProgress
	account.LastSyncError = nil
	capLevel := model.WalletCapabilityBalanceOnly
	if cr, ok := s.provider.(CapabilityProvider); ok {
		capLevel = cr.GetCapability(account.Network)
	}
	account.CapabilityLevel = capLevel
	_, _ = s.db.NewUpdate().Model(&account).Column("history_status", "capability_level", "last_sync_error").WherePK().Exec(ctx)

	// 1. Fetch Balances (with persistent HD derivation for Bitcoin xpubs and persistent ATAs for Solana)
	if account.Network == model.BlockchainNetworkSolana {
		if tap, ok := s.provider.(PersistentTokenAccountProvider); ok {
			if account.DiscoveredAddresses != nil && *account.DiscoveredAddresses != "" {
				var solData SolanaDiscoveredData
				if errDec := json.Unmarshal([]byte(*account.DiscoveredAddresses), &solData); errDec == nil && len(solData.TokenAccounts) > 0 {
					tap.LoadKnownTokenAccounts(account.AddressOrXpub, solData.TokenAccounts)
				}
			}
		}
	}

	var balances []RawTokenBalance
	if account.Network == model.BlockchainNetworkBitcoin && account.IsXpub {
		if hdProv, ok := s.provider.(PersistentHDProvider); ok {
			_, sat, updatedCache, errBtc := hdProv.ScanExtendedKeyPersistent(ctx, account.AddressOrXpub, account.DiscoveredAddresses)
			if errBtc == nil {
				account.DiscoveredAddresses = &updatedCache
				balances = []RawTokenBalance{
					{
						Network:      model.BlockchainNetworkBitcoin,
						Address:      account.AddressOrXpub,
						TokenAddress: nil,
						Symbol:       "BTC",
						Name:         "Bitcoin",
						Decimals:     8,
						RawBalance:   strconv.FormatUint(sat, 10),
						IsNative:     true,
					},
				}
			} else {
				log.Printf("[WARN] [WalletSyncService] Persistent HD scan failed for %s: %v. Falling back to FetchBalances.", account.AddressOrXpub, errBtc)
			}
		}
	}

	if len(balances) == 0 {
		var err error
		balances, err = s.provider.FetchBalances(ctx, account.Network, account.AddressOrXpub)
		if err != nil {
			var existingCount int
			existingCount, _ = s.db.NewSelect().
				Model((*model.WalletBalance)(nil)).
				Where("wallet_account_id = ?", account.ID).
				Count(ctx)

			account.HistoryStatus = model.WalletHistoryStatusError
			errMsg := fmt.Sprintf("provider unavailable: %v", err)
			account.LastSyncError = &errMsg
			_, _ = s.db.NewUpdate().Model(&account).Column("history_status", "last_sync_error").WherePK().Exec(ctx)

			if existingCount > 0 {
				log.Printf("[WARN] [WalletSyncService] Provider unavailable for wallet %s (%s). Preserved %d existing balance(s) without erasing.",
					account.ID, account.AddressOrXpub, existingCount)
				return fmt.Errorf("provider unavailable: %w (existing balances preserved)", err)
			}
			return fmt.Errorf("failed to fetch balances: %w", err)
		}

		// Persist discovered Solana ATAs
		if account.Network == model.BlockchainNetworkSolana {
			if tap, ok := s.provider.(PersistentTokenAccountProvider); ok {
				knownATAs := tap.GetKnownTokenAccounts(account.AddressOrXpub)
				if len(knownATAs) > 0 {
					solData := SolanaDiscoveredData{TokenAccounts: knownATAs}
					if bts, errEnc := json.Marshal(solData); errEnc == nil {
						strData := string(bts)
						account.DiscoveredAddresses = &strData
						_, _ = s.db.NewUpdate().Model(&account).Column("discovered_addresses").WherePK().Exec(ctx)
					}
				}
			}
		}
	}

	// 2. Ingest Balances with Spam Filter
	activeTokenKeys := make(map[string]bool)
	for _, b := range balances {
		isSpam, instID := s.spamFilter.EvaluateToken(ctx, b)
		balRecord := model.NewWalletBalanceFromRaw(account.ID, b.Symbol, b.Name, b.Decimals, b.RawBalance, b.TokenAddress, isSpam)
		balRecord.InstrumentID = instID

		tokenKey := "NATIVE"
		if b.TokenAddress != nil && *b.TokenAddress != "" {
			tokenKey = strings.ToLower(*b.TokenAddress)
		}
		activeTokenKeys[tokenKey] = true

		_, err := s.db.NewInsert().
			Model(balRecord).
			On("CONFLICT (wallet_account_id, COALESCE(token_address, 'NATIVE')) DO UPDATE").
			Set("raw_balance = EXCLUDED.raw_balance").
			Set("formatted_quantity = EXCLUDED.formatted_quantity").
			Set("symbol = EXCLUDED.symbol").
			Set("name = EXCLUDED.name").
			Set("decimals = EXCLUDED.decimals").
			Set("is_spam = EXCLUDED.is_spam").
			Set("is_hidden = EXCLUDED.is_hidden").
			Set("last_updated_at = EXCLUDED.last_updated_at").
			Exec(ctx)
		if err != nil {
			log.Printf("[WARN] [WalletSyncService] Failed to upsert balance for %s: %v", b.Symbol, err)
		}
	}

	// 2.1 Immediately price active balances
	var accBalances []*model.WalletBalance
	if err := s.db.NewSelect().Model(&accBalances).Where("wallet_account_id = ? AND is_spam = false AND is_hidden = false", account.ID).Scan(ctx); err == nil && len(accBalances) > 0 {
		if errPrice := s.pricingSvc.RefreshBalances(ctx, accBalances); errPrice != nil {
			log.Printf("[WARN] [WalletSyncService] Price refresh failed for account %s: %v", account.ID, errPrice)
		}
	}

	// 3. Genesis Transfer Backfill Loop
	var allMovements []RawTransferMovement
	cursor := ""
	maxPages := 20 // Safeguard: up to 2000 historical transactions per sync run

	for page := 0; page < maxPages; page++ {
		transferPage, err := s.provider.FetchTransfers(ctx, account.Network, account.AddressOrXpub, cursor)
		if err != nil {
			log.Printf("[WARN] [WalletSyncService] Transfer pagination stopped on page %d: %v", page, err)
			break
		}
		if transferPage == nil || len(transferPage.Movements) == 0 {
			break
		}

		allMovements = append(allMovements, transferPage.Movements...)

		if transferPage.NextPageKey == nil || *transferPage.NextPageKey == "" {
			break
		}
		cursor = *transferPage.NextPageKey
	}

	// Update discovered Solana ATAs after transfer discovery
	if account.Network == model.BlockchainNetworkSolana {
		if tap, ok := s.provider.(PersistentTokenAccountProvider); ok {
			knownATAs := tap.GetKnownTokenAccounts(account.AddressOrXpub)
			if len(knownATAs) > 0 {
				solData := SolanaDiscoveredData{TokenAccounts: knownATAs}
				if bts, errEnc := json.Marshal(solData); errEnc == nil {
					strData := string(bts)
					account.DiscoveredAddresses = &strData
					_, _ = s.db.NewUpdate().Model(&account).Column("discovered_addresses").WherePK().Exec(ctx)
				}
			}
		}
	}

	// 4. Ingest Raw Activities with deterministic movement_index
	var ingestedActivities []*model.WalletActivity
	for _, m := range allMovements {
		mvtIndex := m.MovementIndex

		act := &model.WalletActivity{
			WalletAccountID: account.ID,
			TxHash:          m.TxHash,
			BlockOrSlot:     m.BlockOrSlot,
			ExecutedAt:      m.ExecutedAt,
			FromAddress:     m.FromAddress,
			ToAddress:       m.ToAddress,
			TokenAddress:    m.TokenAddress,
			RawAmount:       m.RawAmount,
			Decimals:        m.Decimals,
			FormattedAmount: parseRawAmountToDecimal(m.RawAmount, m.Decimals),
			FeeAmount:       m.FeeAmount,
			MovementIndex:   mvtIndex,
			ProviderSource:  m.ProviderSource,
			RawMetadata:     m.RawMetadataJSON,
			CreatedAt:       time.Now().UTC(),
		}

		_, err := s.db.NewInsert().
			Model(act).
			On("CONFLICT (wallet_account_id, tx_hash, COALESCE(token_address, 'NATIVE'), movement_index) DO UPDATE").
			Set("raw_amount = EXCLUDED.raw_amount").
			Set("formatted_amount = EXCLUDED.formatted_amount").
			Set("decimals = EXCLUDED.decimals").
			Set("from_address = EXCLUDED.from_address").
			Set("to_address = EXCLUDED.to_address").
			Set("fee_amount = EXCLUDED.fee_amount").
			Set("raw_metadata = EXCLUDED.raw_metadata").
			Exec(ctx)
		if err == nil {
			ingestedActivities = append(ingestedActivities, act)
		}
	}

	// 5. Fetch all owned addresses of the user for internal transfer matching
	var userAccounts []model.WalletAccount
	_ = s.db.NewSelect().
		Model(&userAccounts).
		Where("user_id = ?", account.UserID).
		Scan(ctx)

	ownedMap := make(map[string]bool)
	for _, ua := range userAccounts {
		ownedMap[strings.ToLower(ua.AddressOrXpub)] = true
	}

	// 6. Run Activity Classifier
	classification, err := s.classifier.Classify(ctx, &account, ingestedActivities, ownedMap)
	if err == nil && classification != nil {
		// Stage reviews in DB
		for _, rev := range classification.StagedReviews {
			_, _ = s.db.NewInsert().Model(rev).Exec(ctx)
		}

		// Persist classified accounting transactions if linked to an Account
		if account.AccountID != nil && len(classification.Transactions) > 0 && s.uow != nil {
			_ = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
				for _, tx := range classification.Transactions {
					if _, errCreate := uow.Transaction().Create(ctx, tx); errCreate != nil {
						log.Printf("[WARN] [WalletSyncService] Failed to create classified transaction: %v", errCreate)
					}
				}
				return nil
			})
		}
	}

	// 7. Resolve Cost Basis for all wallet balances
	var allAccountActivities []*model.WalletActivity
	_ = s.db.NewSelect().
		Model(&allAccountActivities).
		Where("wallet_account_id = ?", account.ID).
		Order("executed_at ASC").
		Scan(ctx)
	if errBasis := s.ResolveAccountCostBasis(ctx, &account, allAccountActivities); errBasis != nil {
		log.Printf("[WARN] [WalletSyncService] Failed to resolve cost basis for wallet %s: %v", account.ID, errBasis)
	}

	// 8. Update status to SYNCED with capability level and discovered addresses
	now := time.Now().UTC()
	account.LastSyncAt = &now
	account.HistoryStatus = model.WalletHistoryStatusSynced
	account.LastSyncError = nil
	account.CapabilityLevel = capLevel
	_, _ = s.db.NewUpdate().
		Model(&account).
		Column("last_sync_at", "history_status", "last_sync_error", "capability_level", "discovered_addresses").
		WherePK().
		Exec(ctx)

	return nil
}

// SyncAllActiveWallets iterates over all active wallets and synchronizes them
func (s *WalletSyncService) SyncAllActiveWallets(ctx context.Context) error {
	var accounts []model.WalletAccount
	err := s.db.NewSelect().
		Model(&accounts).
		Where("is_active = TRUE").
		Scan(ctx)
	if err != nil {
		return fmt.Errorf("failed to list active wallet accounts: %w", err)
	}

	for _, acc := range accounts {
		if err := s.SyncWalletAccount(ctx, acc.ID); err != nil {
			log.Printf("[ERROR] [WalletSyncService] Failed to sync wallet %s: %v", acc.AddressOrXpub, err)
		}
		time.Sleep(200 * time.Millisecond) // rate limit spacing
	}

	return nil
}
