package sync

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	stdsync "sync"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure/enablebanking"
	"sigma_finance/internal/infrastructure/traderepublic"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

// AggregatorAuthSession holds session information for external aggregator authentication.
type AggregatorAuthSession struct {
	Link         string
	SessionToken string
	Provider     string
}

// EnableBankingAuthSession holds temporary authorization session details for Enable Banking.
type EnableBankingAuthSession struct {
	AuthSessionID string
	AuthURL       string
	State         string
	ExpiresAt     time.Time
}

// EnableBankingKeyPair holds a generated RSA private key and self-signed certificate.
type EnableBankingKeyPair struct {
	PrivateKey string
	PublicKey  string
}

// ISyncService defines the central coordination and execution interface for account sync.
type ISyncService interface {
	RegisterAdapter(adapter SyncAdapter)
	TriggerSync(ctx context.Context, connectionID string) (*model.SyncRun, error)
	TriggerAccountSync(ctx context.Context, accountID string) (*model.SyncRun, error)
	RegisterCredential(ctx context.Context, userID string, provider string, rawJSON string, portfolioID ...*string) (*model.SyncCredential, error)
	LinkAccount(ctx context.Context, connectionID string, accountID string, autoCreate bool) (*model.SyncConnection, error)
	GetConnection(ctx context.Context, connectionID string) (*model.SyncConnection, error)
	ListConnections(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error)
	ListCredentials(ctx context.Context, userID string) ([]*model.SyncCredential, error)
	GetAdapter(provider string) (SyncAdapter, bool)
	GenerateAggregatorLink(ctx context.Context, userID string, provider string, redirectURL string) (*AggregatorAuthSession, error)
	CompleteAggregatorAuth(ctx context.Context, userID string, connectionID string, sessionToken string) ([]*model.SyncConnection, error)
	DiscoverAndCreateConnections(ctx context.Context, userID string, portfolioID string, provider string) ([]*model.SyncConnection, error)
	InitiateTradeRepublicAuth(ctx context.Context, userID string, portfolioID string, phoneNumber string, pin string) (*model.SyncAuthSession, error)
	PollTradeRepublicAuth(ctx context.Context, userID string, authSessionID string) (*model.SyncAuthSession, []*model.SyncConnection, error)
	InitiateWoobAuth(ctx context.Context, userID string, portfolioID string, institution string, login string, password string, region string) (*model.SyncAuthSession, error)
	PollWoobAuth(ctx context.Context, userID string, authSessionID string, otpCode string) (*model.SyncAuthSession, []*model.SyncConnection, error)
	ListEnableBankingInstitutions(ctx context.Context, userID string, country string) ([]enablebanking.ASPSP, error)
	InitiateEnableBankingAuth(ctx context.Context, userID string, portfolioID string, aspspName string, aspspCountry string, redirectURL string) (*EnableBankingAuthSession, error)
	CompleteEnableBankingAuth(ctx context.Context, userID string, portfolioID string, code string, state string) ([]*model.SyncConnection, error)
}

// SyncService implements ISyncService
type SyncService struct {
	uow               repository.IUnitOfWork
	instrumentService service.InstrumentService
	adaptersMu        stdsync.RWMutex
	adapters          map[string]SyncAdapter
}

// NewSyncService creates a new SyncService
func NewSyncService(uow repository.IUnitOfWork, instrumentService service.InstrumentService) *SyncService {
	return &SyncService{
		uow:               uow,
		instrumentService: instrumentService,
		adapters:          make(map[string]SyncAdapter),
	}
}

// RegisterAdapter adds a provider adapter to the sync engine registry.
func (s *SyncService) RegisterAdapter(adapter SyncAdapter) {
	s.adaptersMu.Lock()
	defer s.adaptersMu.Unlock()
	s.adapters[adapter.Provider()] = adapter
}

// GetAdapter retrieves an adapter by provider key.
func (s *SyncService) GetAdapter(provider string) (SyncAdapter, bool) {
	s.adaptersMu.RLock()
	defer s.adaptersMu.RUnlock()
	a, ok := s.adapters[provider]
	return a, ok
}

// RegisterCredential encrypts and stores external API credentials.
func (s *SyncService) RegisterCredential(ctx context.Context, userID string, provider string, rawJSON string, portfolioID ...*string) (*model.SyncCredential, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	provider = strings.ToUpper(strings.TrimSpace(provider))
	if provider == "" {
		return nil, errors.New("provider is required")
	}
	if strings.TrimSpace(rawJSON) == "" {
		return nil, errors.New("credential JSON is required")
	}

	var pID *string
	if len(portfolioID) > 0 && portfolioID[0] != nil && strings.TrimSpace(*portfolioID[0]) != "" {
		cleaned := strings.TrimSpace(*portfolioID[0])
		pID = &cleaned
	}

	cred := &model.SyncCredential{
		UserID:      userID,
		PortfolioID: pID,
		Provider:    provider,
		RawData:     rawJSON,
		Status:      model.SyncCredentialStatusActive,
	}

	if err := cred.Validate(); err != nil {
		return nil, fmt.Errorf("credential validation failed: %w", err)
	}

	// Check if a credential already exists for this user/portfolio/provider (upsert)
	var existing *model.SyncCredential
	var getErr error
	if pID != nil {
		existing, getErr = s.uow.Sync().GetCredentialByPortfolioAndProvider(ctx, userID, *pID, provider)
		if existing != nil && (existing.PortfolioID == nil || *existing.PortfolioID != *pID) {
			existing = nil
			getErr = repository.ErrNotFound
		}
	} else {
		existing, getErr = s.uow.Sync().GetCredentialByProvider(ctx, userID, provider)
		if existing != nil && existing.PortfolioID != nil {
			existing = nil
			getErr = repository.ErrNotFound
		}
	}

	if getErr == nil && existing != nil {
		existing.RawData = rawJSON
		if err := existing.Encrypt(); err != nil {
			return nil, fmt.Errorf("failed to encrypt credential: %w", err)
		}
		existing.Status = model.SyncCredentialStatusActive
		existing.UpdatedAt = time.Now()
		if err := s.uow.Sync().UpdateCredential(ctx, existing); err != nil {
			return nil, fmt.Errorf("failed to update credential: %w", err)
		}
		return existing, nil
	}

	if err := cred.Encrypt(); err != nil {
		return nil, fmt.Errorf("failed to encrypt credential: %w", err)
	}

	if err := s.uow.Sync().CreateCredential(ctx, cred); err != nil {
		return nil, fmt.Errorf("failed to persist credential: %w", err)
	}

	return cred, nil
}

// LinkAccount attaches an existing Account to a SyncConnection, or automatically provisions one.
func (s *SyncService) LinkAccount(ctx context.Context, connectionID string, accountID string, autoCreate bool) (*model.SyncConnection, error) {
	conn, err := s.uow.Sync().GetConnectionByID(ctx, connectionID)
	if err != nil {
		return nil, ErrConnectionNotFound
	}

	err = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		if autoCreate || accountID == "" {
			accountName := fmt.Sprintf("%s Account", conn.InstitutionName)
			accountType := model.AccountTypeBroker
			if conn.Provider == model.SyncProviderKraken {
				accountType = model.AccountTypeCryptoExchange
			} else if conn.Provider == model.SyncProviderGoCardless || conn.Provider == model.SyncProviderEnableBanking {
				accountType = model.AccountTypeBank
			}

			acc := &model.Account{
				UserID:        conn.UserID,
				PortfolioID:   conn.PortfolioID,
				Name:          accountName,
				Type:          accountType,
				TaxWrapper:    model.TaxWrapperStandardTaxable,
				Institution:   &conn.InstitutionName,
				AccountNumber: &conn.ExternalAccountID,
				Currency:      model.CurrencyEUR,
				SyncProvider:  conn.Provider,
				ExternalID:    &conn.ExternalAccountID,
			}

			createdAcc, createErr := uow.Account().Create(ctx, acc)
			if createErr != nil {
				return fmt.Errorf("failed to auto-create account: %w", createErr)
			}
			conn.AccountID = &createdAcc.ID
		} else {
			acc, getErr := uow.Account().GetByID(ctx, accountID)
			if getErr != nil {
				return ErrAccountNotFound
			}
			callerUser, _ := uow.User().GetByID(ctx, conn.UserID)
			isAdmin := callerUser != nil && callerUser.IsAdmin()
			if acc.PortfolioID != conn.PortfolioID || (acc.UserID != conn.UserID && !isAdmin) {
				return errors.New("unauthorized account linkage: account belongs to different user or portfolio")
			}
			acc.SyncProvider = conn.Provider
			acc.ExternalID = &conn.ExternalAccountID
			if updateErr := uow.Account().Update(ctx, acc); updateErr != nil {
				return fmt.Errorf("failed to update account linkage: %w", updateErr)
			}
			conn.AccountID = &acc.ID
		}

		if err := uow.Sync().UpdateConnection(ctx, conn); err != nil {
			return fmt.Errorf("failed to update connection: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Trigger immediate initial synchronization in background for the newly linked account
	if conn.AccountID != nil && *conn.AccountID != "" {
		go func(connID string) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			if _, err := s.TriggerSync(bgCtx, connID); err != nil {
				log.Printf("[ERROR] [SyncService] LinkAccount: initial sync failed for conn %s: %v", connID, err)
			}
		}(conn.ID)
	}

	return conn, nil
}

// GetConnection retrieves a sync connection by ID.
func (s *SyncService) GetConnection(ctx context.Context, connectionID string) (*model.SyncConnection, error) {
	return s.uow.Sync().GetConnectionByID(ctx, connectionID)
}

// ListConnections lists all sync connections for a portfolio.
func (s *SyncService) ListConnections(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	return s.uow.Sync().ListConnectionsByPortfolio(ctx, portfolioID)
}

// TriggerSync executes the complete synchronization and reconciliation pipeline for a connection.
func (s *SyncService) TriggerSync(ctx context.Context, connectionID string) (*model.SyncRun, error) {
	conn, err := s.uow.Sync().GetConnectionByID(ctx, connectionID)
	if err != nil {
		return nil, ErrConnectionNotFound
	}

	if conn.SyncStatus == model.SyncConnectionStatusSyncing && time.Since(conn.UpdatedAt) < 5*time.Minute {
		return nil, errors.New("sync is already in progress for this connection")
	}

	adapter, ok := s.GetAdapter(conn.Provider)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrAdapterNotFound, conn.Provider)
	}

	cred, err := s.uow.Sync().GetCredentialByID(ctx, conn.CredentialID)
	if err != nil {
		return nil, ErrCredentialNotFound
	}

	if _, err := cred.Decrypt(); err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	// 1. Initialize audit SyncRun
	run := &model.SyncRun{
		ConnectionID: conn.ID,
		Status:       model.SyncRunStatusInProgress,
		StartedAt:    time.Now(),
	}
	if err := s.uow.Sync().CreateSyncRun(ctx, run); err != nil {
		return nil, fmt.Errorf("failed to record sync run: %w", err)
	}

	// Mark connection status as SYNCING
	conn.SyncStatus = model.SyncConnectionStatusSyncing
	_ = s.uow.Sync().UpdateConnection(ctx, conn)

	// 2. Test connection with credentials
	if testErr := adapter.TestConnection(ctx, cred); testErr != nil {
		now := time.Now()
		errMsg := testErr.Error()

		if errors.Is(testErr, ErrExpiredCredentials) {
			cred.Status = model.SyncCredentialStatusExpired
			_ = s.uow.Sync().UpdateCredential(ctx, cred)
		} else if errors.Is(testErr, ErrInvalidCredentials) {
			cred.Status = model.SyncCredentialStatusInvalid
			_ = s.uow.Sync().UpdateCredential(ctx, cred)
		}

		run.Status = model.SyncRunStatusFailed
		run.ErrorMessage = &errMsg
		run.CompletedAt = &now
		_ = s.uow.Sync().UpdateSyncRun(ctx, run)

		conn.SyncStatus = model.SyncConnectionStatusFailed
		conn.LastError = &errMsg
		_ = s.uow.Sync().UpdateConnection(ctx, conn)

		return run, testErr
	}

	// Persist refreshed credential tokens (e.g. newly refreshed Trade Republic JWT session)
	_ = s.uow.Sync().UpdateCredential(ctx, cred)

	// 3. Network calls outside DB transaction
	if conn.AccountID == nil {
		now := time.Now()
		errMsg := ErrAccountNotFound.Error()
		run.Status = model.SyncRunStatusFailed
		run.ErrorMessage = &errMsg
		run.CompletedAt = &now
		_ = s.uow.Sync().UpdateSyncRun(ctx, run)

		conn.SyncStatus = model.SyncConnectionStatusFailed
		conn.LastError = &errMsg
		_ = s.uow.Sync().UpdateConnection(ctx, conn)

		return run, ErrAccountNotFound
	}

	balanceAccountID := conn.ExternalAccountID
	if conn.CashAccountID != nil && *conn.CashAccountID != "" && conn.Provider == model.SyncProviderTradeRepublic {
		balanceAccountID = *conn.CashAccountID
	}

	balancesSnapshot, err := adapter.FetchBalances(ctx, cred, balanceAccountID)
	if err != nil {
		now := time.Now()
		errMsg := fmt.Sprintf("failed to fetch balances: %v", err)
		run.Status = model.SyncRunStatusFailed
		run.ErrorMessage = &errMsg
		run.CompletedAt = &now
		_ = s.uow.Sync().UpdateSyncRun(ctx, run)

		conn.SyncStatus = model.SyncConnectionStatusFailed
		conn.LastError = &errMsg
		_ = s.uow.Sync().UpdateConnection(ctx, conn)

		return run, err
	}

	holdingsSnapshot, err := adapter.FetchHoldings(ctx, cred, conn.ExternalAccountID)
	if err != nil {
		now := time.Now()
		errMsg := fmt.Sprintf("failed to fetch holdings: %v", err)
		run.Status = model.SyncRunStatusFailed
		run.ErrorMessage = &errMsg
		run.CompletedAt = &now
		_ = s.uow.Sync().UpdateSyncRun(ctx, run)

		conn.SyncStatus = model.SyncConnectionStatusFailed
		conn.LastError = &errMsg
		_ = s.uow.Sync().UpdateConnection(ctx, conn)

		return run, err
	}

	var streamCursors StreamCursors
	providerMeta := conn.GetProviderMetadata()
	if providerMeta.TimelineTransactionCursor != "" || providerMeta.TimelineActivityCursor != "" {
		streamCursors = StreamCursors{
			"timeline_transactions_cursor": providerMeta.TimelineTransactionCursor,
			"timeline_activity_log_cursor": providerMeta.TimelineActivityCursor,
		}
	} else if len(conn.Metadata) > 0 {
		var metaMap map[string]string
		if err := json.Unmarshal(conn.Metadata, &metaMap); err == nil {
			streamCursors = metaMap
		}
	}

	txsSnapshot, err := adapter.FetchTransactions(ctx, cred, conn.ExternalAccountID, conn.LastSyncAt, streamCursors)
	if err != nil {
		now := time.Now()
		errMsg := fmt.Sprintf("failed to fetch transactions: %v", err)
		run.Status = model.SyncRunStatusFailed
		run.ErrorMessage = &errMsg
		run.CompletedAt = &now
		_ = s.uow.Sync().UpdateSyncRun(ctx, run)

		conn.SyncStatus = model.SyncConnectionStatusFailed
		conn.LastError = &errMsg
		_ = s.uow.Sync().UpdateConnection(ctx, conn)

		return run, err
	}

	// 4. Reconcile in atomic database transaction
	totalImported := 0
	totalUpdated := 0
	var allWarnings []string

	err = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		account, err := uow.Account().GetByID(ctx, *conn.AccountID)
		if err != nil {
			return ErrAccountNotFound
		}

		// Reconcile cash balances
		balImported, balUpdated, err := ReconcileBalances(ctx, uow, conn, account, balancesSnapshot)
		if err != nil {
			return err
		}
		totalImported += balImported
		totalUpdated += balUpdated

		// Reconcile holdings
		hImported, hUpdated, warnings, activeAssetIDs, err := ReconcileHoldings(ctx, uow, s.instrumentService, conn, account, holdingsSnapshot.Holdings)
		if err != nil {
			return err
		}
		totalImported += hImported
		totalUpdated += hUpdated
		allWarnings = append(allWarnings, warnings...)

		// Reconcile transactions
		txImported, txUpdated, err := ReconcileTransactions(ctx, uow, conn, txsSnapshot.Transactions)
		if err != nil {
			return err
		}
		totalImported += txImported
		totalUpdated += txUpdated

		// Reconcile residual tax lots (unallocated holding quantities)
		if err := ReconcileResidualTaxLots(ctx, uow, conn, holdingsSnapshot.Holdings); err != nil {
			return err
		}

		// Reconcile liquidated positions strictly when snapshot is complete AND pagination is finished
		if holdingsSnapshot.IsComplete && holdingsSnapshot.PaginationDone {
			liquidated, err := ReconcileLiquidatedPositions(ctx, uow, conn, activeAssetIDs)
			if err != nil {
				return err
			}
			totalUpdated += liquidated
		}

		// Persist unrecognized/raw events for review and audit
		for _, rawEv := range txsSnapshot.UnrecognizedEvents {
			if rawEv != nil {
				rawEv.ConnectionID = conn.ID
				if rawEv.Provider == "" {
					rawEv.Provider = conn.Provider
				}
				_ = uow.Sync().CreateRawEvent(ctx, rawEv)
			}
		}

		// Transactionally update stream cursors in connection provider_metadata
		if len(txsSnapshot.StreamCursors) > 0 {
			meta := conn.GetProviderMetadata()
			if txCur, ok := txsSnapshot.StreamCursors["timeline_transactions_cursor"]; ok && txCur != "" {
				meta.TimelineTransactionCursor = txCur
			}
			if actCur, ok := txsSnapshot.StreamCursors["timeline_activity_log_cursor"]; ok && actCur != "" {
				meta.TimelineActivityCursor = actCur
			}
			if err := conn.SetProviderMetadata(meta); err == nil {
				_ = uow.Sync().UpdateConnection(ctx, conn)
			}
		}

		return nil
	})

	now := time.Now()
	if err != nil {
		errMsg := err.Error()
		run.Status = model.SyncRunStatusFailed
		run.ErrorMessage = &errMsg
		run.CompletedAt = &now
		_ = s.uow.Sync().UpdateSyncRun(ctx, run)

		conn.SyncStatus = model.SyncConnectionStatusFailed
		conn.LastError = &errMsg
		_ = s.uow.Sync().UpdateConnection(ctx, conn)

		return run, err
	}

	// Successful run
	run.Status = model.SyncRunStatusCompleted
	run.ItemsImported = totalImported
	run.ItemsUpdated = totalUpdated
	run.CompletedAt = &now

	if len(allWarnings) > 0 {
		warningSummary := strings.Join(allWarnings, "; ")
		run.ErrorMessage = &warningSummary
	}

	_ = s.uow.Sync().UpdateSyncRun(ctx, run)

	conn.SyncStatus = model.SyncConnectionStatusSuccess
	conn.LastSyncAt = &now
	conn.LastError = nil
	_ = s.uow.Sync().UpdateConnection(ctx, conn)

	// Linked Sync: asynchronously trigger sync for any other connections sharing the same credential
	if peers, pErr := s.uow.Sync().ListConnectionsByCredentialID(ctx, conn.CredentialID); pErr == nil {
		for _, peer := range peers {
			if peer.ID != conn.ID && peer.SyncStatus != model.SyncConnectionStatusSyncing {
				peerID := peer.ID
				go func(id string) {
					bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
					defer cancel()
					_, _ = s.TriggerSync(bgCtx, id)
				}(peerID)
			}
		}
	}

	return run, nil
}

// TriggerAccountSync finds the active sync connection associated with accountID (or connectionID) and initiates sync.
func (s *SyncService) TriggerAccountSync(ctx context.Context, accountID string) (*model.SyncRun, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, errors.New("account ID is required")
	}

	conn, err := s.uow.Sync().GetConnectionByAccountID(ctx, accountID)
	if err != nil || conn == nil {
		conn, err = s.uow.Sync().GetConnectionByID(ctx, accountID)
		if err != nil || conn == nil {
			return nil, ErrConnectionNotFound
		}
	}

	return s.TriggerSync(ctx, conn.ID)
}

// ListCredentials retrieves all sync credentials for a user.
func (s *SyncService) ListCredentials(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	return s.uow.Sync().ListCredentialsByUser(ctx, userID)
}

// GenerateAggregatorLink constructs an external authentication portal or requisition link for an aggregator.
func (s *SyncService) GenerateAggregatorLink(ctx context.Context, userID string, provider string, redirectURL string) (*AggregatorAuthSession, error) {
	if strings.TrimSpace(provider) == "" {
		return nil, errors.New("provider is required")
	}

	normProvider := strings.ToUpper(strings.TrimSpace(provider))
	adapter, ok := s.GetAdapter(normProvider)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrAdapterNotFound, provider)
	}

	cred, err := s.uow.Sync().GetCredentialByProvider(ctx, userID, normProvider)
	if err != nil {
		return nil, fmt.Errorf("credential not found for provider %s: %w", normProvider, err)
	}

	switch normProvider {
	case model.SyncProviderSnapTrade:
		type snapTradePortal interface {
			GeneratePortalLink(ctx context.Context, cred *model.SyncCredential, redirectURL string) (string, error)
		}
		if portalAdapter, ok := adapter.(snapTradePortal); ok {
			link, err := portalAdapter.GeneratePortalLink(ctx, cred, redirectURL)
			if err != nil {
				return nil, fmt.Errorf("failed to generate SnapTrade portal link: %w", err)
			}
			return &AggregatorAuthSession{
				Link:         link,
				SessionToken: cred.ID,
				Provider:     normProvider,
			}, nil
		}
	case model.SyncProviderGoCardless:
		type goCardlessRequisition interface {
			CreateRequisition(ctx context.Context, cred *model.SyncCredential, institutionID string, redirectURL string) (string, string, error)
		}
		if requisitionAdapter, ok := adapter.(goCardlessRequisition); ok {
			reqID, link, err := requisitionAdapter.CreateRequisition(ctx, cred, "SANDBOXFINANCE_SAPI0000", redirectURL)
			if err != nil {
				return nil, fmt.Errorf("failed to create GoCardless requisition: %w", err)
			}
			return &AggregatorAuthSession{
				Link:         link,
				SessionToken: reqID,
				Provider:     normProvider,
			}, nil
		}
	}

	type genericLinkGenerator interface {
		GeneratePortalLink(ctx context.Context, cred *model.SyncCredential, redirectURL string) (string, error)
	}
	if genAdapter, ok := adapter.(genericLinkGenerator); ok {
		link, err := genAdapter.GeneratePortalLink(ctx, cred, redirectURL)
		if err != nil {
			return nil, err
		}
		return &AggregatorAuthSession{
			Link:         link,
			SessionToken: cred.ID,
			Provider:     normProvider,
		}, nil
	}

	return nil, fmt.Errorf("provider %s does not support aggregator link generation", normProvider)
}

// CompleteAggregatorAuth completes external authentication callback and discovers accounts.
func (s *SyncService) CompleteAggregatorAuth(ctx context.Context, userID string, connectionID string, sessionToken string) ([]*model.SyncConnection, error) {
	if strings.TrimSpace(connectionID) == "" {
		return nil, errors.New("connection ID is required")
	}

	// Try getting connection by ID
	conn, err := s.uow.Sync().GetConnectionByID(ctx, connectionID)
	if err == nil && conn != nil {
		if conn.UserID != userID {
			return nil, errors.New("unauthorized: connection belongs to another user")
		}

		// Trigger sync only if the connection is already linked to an account
		if conn.AccountID != nil && *conn.AccountID != "" {
			_, _ = s.TriggerSync(ctx, conn.ID)
		}

		// Refetch updated connection
		refetched, fetchErr := s.uow.Sync().GetConnectionByID(ctx, conn.ID)
		if fetchErr == nil {
			return []*model.SyncConnection{refetched}, nil
		}
		return []*model.SyncConnection{conn}, nil
	}

	// Handle case where connectionID is a portfolio ID:
	// Identify provider from sessionToken or user's active credentials
	var targetProvider string
	if sessionToken != "" {
		if cred, err := s.uow.Sync().GetCredentialByID(ctx, sessionToken); err == nil && cred != nil && cred.UserID == userID {
			targetProvider = cred.Provider
		}
	}

	if targetProvider == "" {
		userCreds, _ := s.uow.Sync().ListCredentialsByUser(ctx, userID)
		for _, cred := range userCreds {
			if cred.Status == model.SyncCredentialStatusActive {
				targetProvider = cred.Provider
				break
			}
		}
	}

	if targetProvider == model.SyncProviderGoCardless && sessionToken != "" {
		if cred, err := s.uow.Sync().GetCredentialByProvider(ctx, userID, targetProvider); err == nil && cred != nil {
			rawJSON, decErr := cred.Decrypt()
			if decErr == nil {
				var credMap map[string]any
				if err := json.Unmarshal([]byte(rawJSON), &credMap); err == nil {
					if _, hasReq := credMap["requisition_id"]; !hasReq {
						credMap["requisition_id"] = sessionToken
						updatedJSON, _ := json.Marshal(credMap)
						cred.RawData = string(updatedJSON)
						_ = cred.Encrypt()
						_ = s.uow.Sync().UpdateCredential(ctx, cred)
					}
				}
			}
		}
	}

	if targetProvider != "" {
		conns, discErr := s.DiscoverAndCreateConnections(ctx, userID, connectionID, targetProvider)
		if discErr == nil && len(conns) > 0 {
			var results []*model.SyncConnection
			for _, c := range conns {
				if c.AccountID != nil && *c.AccountID != "" {
					_, _ = s.TriggerSync(ctx, c.ID)
				}
				if refetched, err := s.uow.Sync().GetConnectionByID(ctx, c.ID); err == nil {
					results = append(results, refetched)
				} else {
					results = append(results, c)
				}
			}
			return results, nil
		}
	}

	// Fallback: Check if connectionID is a portfolio ID with existing connections
	conns, listErr := s.uow.Sync().ListConnectionsByPortfolio(ctx, connectionID)
	if listErr == nil && len(conns) > 0 {
		var results []*model.SyncConnection
		for _, c := range conns {
			if c.UserID == userID {
				if c.AccountID != nil && *c.AccountID != "" {
					_, _ = s.TriggerSync(ctx, c.ID)
				}
				if updated, err := s.uow.Sync().GetConnectionByID(ctx, c.ID); err == nil {
					results = append(results, updated)
				} else {
					results = append(results, c)
				}
			}
		}
		return results, nil
	}

	return nil, ErrConnectionNotFound
}

// DiscoverAndCreateConnections discovers external institution accounts for the active credential and provisions connections & accounts.
func (s *SyncService) DiscoverAndCreateConnections(ctx context.Context, userID string, portfolioID string, provider string) ([]*model.SyncConnection, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	if strings.TrimSpace(portfolioID) == "" {
		return nil, errors.New("portfolio ID is required")
	}
	normProvider := strings.ToUpper(strings.TrimSpace(provider))
	if normProvider == "" {
		return nil, errors.New("provider is required")
	}

	pf, pfErr := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if pfErr != nil {
		return nil, fmt.Errorf("failed to verify portfolio: %w", pfErr)
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if pf.UserID != userID && !isAdmin {
		return nil, errors.New("unauthorized: portfolio belongs to another user")
	}
	resourceOwnerID := pf.UserID

	adapter, ok := s.GetAdapter(normProvider)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrAdapterNotFound, normProvider)
	}

	cred, err := s.uow.Sync().GetCredentialByPortfolioAndProvider(ctx, userID, portfolioID, normProvider)
	if err != nil {
		cred, err = s.uow.Sync().GetCredentialByProvider(ctx, userID, normProvider)
	}
	if err != nil {
		return nil, fmt.Errorf("active credential not found for provider %s: %w", normProvider, err)
	}
	if cred.Status != model.SyncCredentialStatusActive {
		return nil, fmt.Errorf("credential is not active (status: %s)", cred.Status)
	}

	if _, err := cred.Decrypt(); err != nil {
		return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	rawAccounts, err := adapter.FetchAccounts(ctx, cred)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch accounts from provider %s: %w", normProvider, err)
	}

	var resultConnections []*model.SyncConnection

	err = s.uow.Do(ctx, func(uow repository.IUnitOfWork) error {
		existingConns, err := uow.Sync().ListConnectionsByPortfolio(ctx, portfolioID)
		if err != nil {
			return fmt.Errorf("failed to list connections for portfolio: %w", err)
		}

		existingByExtAccID := make(map[string]*model.SyncConnection)
		for _, c := range existingConns {
			if c.Provider == normProvider {
				existingByExtAccID[c.ExternalAccountID] = c
			}
		}

		existingAccounts, _ := uow.Account().GetAccountsByPortfolioID(ctx, portfolioID)
		usedAccountNames := make(map[string]bool)
		for _, a := range existingAccounts {
			usedAccountNames[a.Name] = true
		}

		for _, rawAcc := range rawAccounts {
			conn, exists := existingByExtAccID[rawAcc.ExternalID]
			if !exists {
				institutionName := rawAcc.Institution
				if institutionName == "" {
					institutionName = normProvider
				}
				var cashAccID *string
				if rawAcc.CashAccountNumber != "" {
					cashAccID = &rawAcc.CashAccountNumber
				}
				conn = &model.SyncConnection{
					UserID:                resourceOwnerID,
					PortfolioID:           portfolioID,
					CredentialID:          cred.ID,
					Provider:              normProvider,
					ExternalInstitutionID: institutionName,
					ExternalAccountID:     rawAcc.ExternalID,
					CashAccountID:         cashAccID,
					InstitutionName:       institutionName,
					SyncStatus:            model.SyncConnectionStatusIdle,
				}
				meta := model.ProviderMetadata{
					Version:       1,
					CashAccountID: rawAcc.CashAccountNumber,
				}
				_ = conn.SetProviderMetadata(meta)
				if err := uow.Sync().CreateConnection(ctx, conn); err != nil {
					return fmt.Errorf("failed to create connection for account %s: %w", rawAcc.ExternalID, err)
				}
			}

			if conn.AccountID == nil || *conn.AccountID == "" {
				baseName := rawAcc.Name
				if baseName == "" {
					baseName = fmt.Sprintf("%s Account", conn.InstitutionName)
				}
				accountName := baseName
				if usedAccountNames[accountName] {
					suffix := rawAcc.ExternalID
					if len(suffix) > 4 {
						suffix = suffix[len(suffix)-4:]
					}
					if suffix != "" {
						accountName = fmt.Sprintf("%s (%s)", baseName, suffix)
					}
					if usedAccountNames[accountName] {
						accountName = fmt.Sprintf("%s (%s)", baseName, rawAcc.ExternalID)
					}
				}
				usedAccountNames[accountName] = true

				accountType := rawAcc.Type
				if accountType == "" {
					accountType = model.AccountTypeBroker
					if normProvider == model.SyncProviderKraken {
						accountType = model.AccountTypeCryptoExchange
					} else if normProvider == model.SyncProviderGoCardless {
						accountType = model.AccountTypeBank
					}
				}
				taxWrapper := rawAcc.TaxWrapper
				if taxWrapper == "" {
					taxWrapper = model.TaxWrapperStandardTaxable
				}
				currency := rawAcc.Currency
				if currency == "" {
					currency = model.CurrencyEUR
				}
				extAccID := rawAcc.ExternalID
				acc := &model.Account{
					UserID:        resourceOwnerID,
					PortfolioID:   portfolioID,
					Name:          accountName,
					Type:          accountType,
					TaxWrapper:    taxWrapper,
					Institution:   &conn.InstitutionName,
					AccountNumber: &extAccID,
					Currency:      currency,
					SyncProvider:  normProvider,
					ExternalID:    &extAccID,
				}
				createdAcc, createErr := uow.Account().Create(ctx, acc)
				if createErr != nil {
					return fmt.Errorf("failed to auto-create account for connection %s: %w", conn.ID, createErr)
				}
				conn.AccountID = &createdAcc.ID
				if err := uow.Sync().UpdateConnection(ctx, conn); err != nil {
					return fmt.Errorf("failed to update connection with account ID: %w", err)
				}
			}

			resultConnections = append(resultConnections, conn)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Trigger initial background sync for all newly discovered/provisioned connections
	for _, c := range resultConnections {
		if c.AccountID != nil && *c.AccountID != "" {
			go func(connID string) {
				bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				defer cancel()
				if _, err := s.TriggerSync(bgCtx, connID); err != nil {
					log.Printf("[ERROR] [SyncService] DiscoverAndCreateConnections: initial sync failed for conn %s: %v", connID, err)
				}
			}(c.ID)
		}
	}

	return resultConnections, nil
}

// InitiateTradeRepublicAuth starts the v2 push-notification login process and returns an internal authorization session.
func (s *SyncService) InitiateTradeRepublicAuth(ctx context.Context, userID string, portfolioID string, phoneNumber string, pin string) (*model.SyncAuthSession, error) {
	log.Printf("[INFO] [SyncService] InitiateTradeRepublicAuth: starting for user=%s, portfolio=%s", userID, portfolioID)
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	if strings.TrimSpace(portfolioID) == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if strings.TrimSpace(phoneNumber) == "" {
		return nil, errors.New("phone number is required")
	}
	if strings.TrimSpace(pin) == "" {
		return nil, errors.New("pin is required")
	}

	// Verify portfolio ownership
	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		log.Printf("[ERROR] [SyncService] InitiateTradeRepublicAuth: portfolio verification failed for %s: %v", portfolioID, err)
		return nil, fmt.Errorf("failed to verify portfolio: %w", err)
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if portfolio.UserID != userID && !isAdmin {
		log.Printf("[ERROR] [SyncService] InitiateTradeRepublicAuth: portfolio %s belongs to user %s, not %s", portfolioID, portfolio.UserID, userID)
		return nil, errors.New("unauthorized: portfolio belongs to another user")
	}

	// Call Trade Republic v2 login endpoint with stable device ID
	authClient := traderepublic.NewAuthClient("", nil, nil)
	loginResp, authCtx, err := authClient.InitiateLoginWithDevice(ctx, phoneNumber, pin, "")
	if err != nil {
		log.Printf("[ERROR] [SyncService] InitiateTradeRepublicAuth: upstream login failed: %v", err)
		return nil, fmt.Errorf("failed to initiate Trade Republic login: %w", err)
	}

	// Create and persist authorization session with encrypted provider context
	countdown := loginResp.Countdown
	if countdown <= 0 {
		countdown = 90
	}

	authCtxJSON, err := json.Marshal(authCtx)
	if err != nil {
		log.Printf("[ERROR] [SyncService] InitiateTradeRepublicAuth: serialize auth context failed: %v", err)
		return nil, fmt.Errorf("failed to serialize auth context: %w", err)
	}

	session := &model.SyncAuthSession{
		UserID:         userID,
		PortfolioID:    portfolioID,
		Provider:       model.SyncProviderTradeRepublic,
		Status:         model.SyncAuthSessionStatusWaitingForConfirmation,
		RawProcessInfo: string(authCtxJSON),
		ExpiresAt:      time.Now().Add(time.Duration(countdown) * time.Second),
	}

	if err := session.Encrypt(); err != nil {
		log.Printf("[ERROR] [SyncService] InitiateTradeRepublicAuth: encrypt session failed: %v", err)
		return nil, fmt.Errorf("failed to encrypt session process info: %w", err)
	}

	if err := s.uow.Sync().CreateAuthSession(ctx, session); err != nil {
		log.Printf("[ERROR] [SyncService] InitiateTradeRepublicAuth: persist session failed: %v", err)
		return nil, fmt.Errorf("failed to persist authorization session: %w", err)
	}

	log.Printf("[INFO] [SyncService] InitiateTradeRepublicAuth: session created id=%s processID=%s countdown=%d expiresAt=%s",
		session.ID, loginResp.ProcessID, countdown, session.ExpiresAt.Format(time.RFC3339))
	return session, nil
}

// PollTradeRepublicAuth checks the mobile app confirmation status and completes account discovery upon approval.
func (s *SyncService) PollTradeRepublicAuth(ctx context.Context, userID string, authSessionID string) (*model.SyncAuthSession, []*model.SyncConnection, error) {
	log.Printf("[INFO] [SyncService] PollTradeRepublicAuth: sessionID=%s user=%s", authSessionID, userID)
	session, err := s.uow.Sync().GetAuthSessionByID(ctx, authSessionID)
	if err != nil {
		log.Printf("[WARN] [SyncService] PollTradeRepublicAuth: session not found id=%s: %v", authSessionID, err)
		return nil, nil, fmt.Errorf("authorization session not found: %w", err)
	}

	if session.UserID != userID {
		log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: unauthorized access to session %s by user %s", authSessionID, userID)
		return nil, nil, errors.New("unauthorized: session belongs to another user")
	}

	// If already completed or rejected, return current state
	if session.Status == model.SyncAuthSessionStatusCompleted || session.Status == model.SyncAuthSessionStatusRejected {
		return session, nil, nil
	}

	// Check expiration
	if time.Now().After(session.ExpiresAt) {
		log.Printf("[INFO] [SyncService] PollTradeRepublicAuth: session expired id=%s", authSessionID)
		session.Status = model.SyncAuthSessionStatusExpired
		_ = s.uow.Sync().UpdateAuthSession(ctx, session)
		return session, nil, nil
	}

	rawInfo, err := session.Decrypt()
	if err != nil {
		log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: failed to decrypt session %s: %v", authSessionID, err)
		return nil, nil, fmt.Errorf("failed to decrypt authorization process ID: %w", err)
	}

	var authCtx traderepublic.AuthSessionContext
	if err := json.Unmarshal([]byte(rawInfo), &authCtx); err != nil || authCtx.ProcessID == "" {
		authCtx = traderepublic.AuthSessionContext{
			ProcessID: rawInfo,
			DeviceID:  traderepublic.GenerateDeviceID(),
		}
	}

	authClient := traderepublic.NewAuthClient("", nil, nil)
	pollResp, cookies, err := authClient.PollProcessWithContext(ctx, &authCtx)
	if err != nil {
		if errors.Is(err, traderepublic.ErrAuthenticationExpired) {
			log.Printf("[INFO] [SyncService] PollTradeRepublicAuth: mobile confirmation expired for session=%s", authSessionID)
			session.Status = model.SyncAuthSessionStatusExpired
			_ = s.uow.Sync().UpdateAuthSession(ctx, session)
			return session, nil, nil
		}
		if errors.Is(err, traderepublic.ErrAuthenticationRejected) {
			log.Printf("[INFO] [SyncService] PollTradeRepublicAuth: login rejected for session=%s", authSessionID)
			session.Status = model.SyncAuthSessionStatusRejected
			_ = s.uow.Sync().UpdateAuthSession(ctx, session)
			return session, nil, nil
		}
		log.Printf("[WARN] [SyncService] PollTradeRepublicAuth: poll error for session=%s: %v", authSessionID, err)
		return nil, nil, err
	}

	isApproved := pollResp.Status == traderepublic.ProcessStatusApproved ||
		pollResp.Status == traderepublic.ProcessStatusCompleted ||
		strings.EqualFold(string(pollResp.Status), "COMPLETED") ||
		strings.EqualFold(string(pollResp.Status), "APPROVED") ||
		strings.EqualFold(string(pollResp.Status), "CONFIRMED") ||
		strings.EqualFold(string(pollResp.Status), "SUCCESS")

	if isApproved {
		log.Printf("[INFO] [SyncService] PollTradeRepublicAuth: login approved (status=%s) for session=%s, registering credential and discovering accounts", pollResp.Status, authSessionID)
		// Session approved! Convert cookies to encrypted SyncCredential preserving full cookie attributes
		if !traderepublic.ValidateSessionCookies(cookies) {
			log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: incomplete cookies returned for session=%s", authSessionID)
			return nil, nil, errors.New("Trade Republic approval returned incomplete session cookies")
		}

		savedCookies := traderepublic.CookiesToSaved(cookies)
		cookiesJSON, err := json.Marshal(savedCookies)
		if err != nil {
			log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: cookie encoding failed: %v", err)
			return nil, nil, fmt.Errorf("failed to encode session cookies: %w", err)
		}

		// Register credentials
		_, err = s.RegisterCredential(ctx, userID, model.SyncProviderTradeRepublic, string(cookiesJSON))
		if err != nil {
			log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: RegisterCredential failed: %v", err)
			return nil, nil, fmt.Errorf("failed to register Trade Republic credential: %w", err)
		}

		// Discover and provision accounts under the target portfolio
		conns, err := s.DiscoverAndCreateConnections(ctx, userID, session.PortfolioID, model.SyncProviderTradeRepublic)
		if err != nil {
			log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: DiscoverAndCreateConnections failed: %v", err)
			return nil, nil, fmt.Errorf("failed to discover Trade Republic accounts: %w", err)
		}

		session.Status = model.SyncAuthSessionStatusCompleted
		_ = s.uow.Sync().UpdateAuthSession(ctx, session)
		log.Printf("[INFO] [SyncService] PollTradeRepublicAuth: completed successfully for session=%s conns=%d", authSessionID, len(conns))

		// Automatically trigger initial background synchronization for newly discovered accounts
		for _, c := range conns {
			if c.AccountID != nil {
				go func(connID string) {
					bgCtx := context.Background()
					if _, err := s.TriggerSync(bgCtx, connID); err != nil {
						log.Printf("[ERROR] [SyncService] PollTradeRepublicAuth: initial sync failed for conn %s: %v", connID, err)
					}
				}(c.ID)
			}
		}

		return session, conns, nil
	}

	// Still waiting for confirmation
	return session, nil, nil
}

// getEnableBankingClient extracts configured credentials (or env vars) and initializes an enablebanking.Client.
func (s *SyncService) getEnableBankingClient(ctx context.Context, userID string) (*enablebanking.Client, *model.SyncCredential, error) {
	var appID, privKey string
	var cred *model.SyncCredential

	if userID != "" {
		existingCred, err := s.uow.Sync().GetCredentialByProvider(ctx, userID, model.SyncProviderEnableBanking)
		if err == nil && existingCred != nil {
			cred = existingCred
			rawJSON, err := existingCred.Decrypt()
			if err == nil {
				var credMap map[string]string
				if json.Unmarshal([]byte(rawJSON), &credMap) == nil {
					appID = credMap["application_id"]
					if appID == "" {
						appID = credMap["applicationId"]
					}
					privKey = credMap["private_key"]
					if privKey == "" {
						privKey = credMap["privateKey"]
					}
				}
			}
		}
	}

	if appID == "" {
		appID = strings.TrimSpace(os.Getenv("ENABLEBANKING_APPLICATION_ID"))
		if appID == "" {
			appID = strings.TrimSpace(os.Getenv("ENABLE_BANKING_APPLICATION_ID"))
		}
	}
	if privKey == "" {
		privKey = strings.TrimSpace(os.Getenv("ENABLEBANKING_PRIVATE_KEY"))
		if privKey == "" {
			privKey = strings.TrimSpace(os.Getenv("ENABLE_BANKING_PRIVATE_KEY"))
		}
		if privKey == "" {
			path := strings.TrimSpace(os.Getenv("ENABLEBANKING_PRIVATE_KEY_PATH"))
			if path == "" {
				path = strings.TrimSpace(os.Getenv("ENABLE_BANKING_PRIVATE_KEY_PATH"))
			}
			if path != "" {
				if b, err := os.ReadFile(path); err == nil {
					privKey = string(b)
				}
			}
		}
	}

	if appID == "" || privKey == "" {
		return nil, nil, errors.New("Enable Banking credentials not configured (application ID and RSA private key required)")
	}

	return enablebanking.NewClient(appID, privKey), cred, nil
}

// ListEnableBankingInstitutions returns available institutions for a country.
func (s *SyncService) ListEnableBankingInstitutions(ctx context.Context, userID string, country string) ([]enablebanking.ASPSP, error) {
	client, _, err := s.getEnableBankingClient(ctx, userID)
	if err != nil {
		return nil, err
	}
	return client.GetASPSPs(ctx, country)
}

// InitiateEnableBankingAuth initiates authorization and returns the bank redirect URL.
func (s *SyncService) InitiateEnableBankingAuth(
	ctx context.Context,
	userID string,
	portfolioID string,
	aspspName string,
	aspspCountry string,
	redirectURL string,
) (*EnableBankingAuthSession, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	if strings.TrimSpace(portfolioID) == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if strings.TrimSpace(aspspName) == "" {
		return nil, errors.New("ASPSP name is required")
	}
	if strings.TrimSpace(aspspCountry) == "" {
		return nil, errors.New("ASPSP country is required")
	}
	if strings.TrimSpace(redirectURL) == "" {
		return nil, errors.New("redirect URL is required")
	}

	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify portfolio: %w", err)
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if portfolio.UserID != userID && !isAdmin {
		return nil, errors.New("unauthorized: portfolio belongs to another user")
	}

	client, _, err := s.getEnableBankingClient(ctx, userID)
	if err != nil {
		return nil, err
	}

	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return nil, fmt.Errorf("failed to generate secure state: %w", err)
	}
	state := hex.EncodeToString(stateBytes)

	// Validate/adjust redirect URL against registered application redirect URLs
	if appInfo, appErr := client.GetApplication(ctx); appErr == nil && appInfo != nil {
		allowed := appInfo.RedirectURLs
		if len(allowed) == 0 {
			allowed = appInfo.RedirectURIs
		}
		if len(allowed) > 0 {
			matched := false
			for _, u := range allowed {
				if strings.TrimRight(u, "/") == strings.TrimRight(redirectURL, "/") {
					matched = true
					break
				}
			}
			if !matched {
				log.Printf("[WARN] [SyncService] requested redirect URL %q is not in Enable Banking allowed redirect URLs %v. Auto-selecting registered redirect URL: %q", redirectURL, allowed, allowed[0])
				redirectURL = allowed[0]
			}
		}
	}

	validUntil := time.Now().AddDate(0, 3, 0) // 90 days validity
	authReq := enablebanking.StartAuthRequest{
		Access: enablebanking.StartAuthAccess{
			ValidUntil: &validUntil,
		},
		ASPSP: enablebanking.ASPSPTarget{
			Name:    aspspName,
			Country: aspspCountry,
		},
		State:       state,
		RedirectURL: redirectURL,
		PsuType:     "personal",
	}

	startRes, err := client.StartAuthorization(ctx, authReq)
	if err != nil {
		log.Printf("[ERROR] [SyncService] InitiateEnableBankingAuth failed: aspsp=%s country=%s redirectURL=%s err=%v", aspspName, aspspCountry, redirectURL, err)
		return nil, fmt.Errorf("failed to initiate Enable Banking authorization: %w", err)
	}

	sessionID := startRes.ID
	if sessionID == "" && startRes.AuthorizationID != "" {
		sessionID = startRes.AuthorizationID
	}
	if sessionID == "" && startRes.URL != "" {
		if u, parseErr := url.Parse(startRes.URL); parseErr == nil {
			if sid := u.Query().Get("sessionid"); sid != "" {
				sessionID = sid
			}
		}
	}

	type authProcessInfo struct {
		State        string `json:"state"`
		ASPSPName    string `json:"aspsp_name"`
		ASPSPCountry string `json:"aspsp_country"`
		RedirectURL  string `json:"redirect_url"`
		AuthID       string `json:"auth_id,omitempty"`
		SessionID    string `json:"session_id,omitempty"`
	}

	infoJSON, _ := json.Marshal(authProcessInfo{
		State:        state,
		ASPSPName:    aspspName,
		ASPSPCountry: aspspCountry,
		RedirectURL:  redirectURL,
		AuthID:       startRes.ID,
		SessionID:    sessionID,
	})

	session := &model.SyncAuthSession{
		UserID:         userID,
		PortfolioID:    portfolioID,
		Provider:       model.SyncProviderEnableBanking,
		Status:         model.SyncAuthSessionStatusWaitingForConfirmation,
		RawProcessInfo: string(infoJSON),
		ExpiresAt:      time.Now().Add(30 * time.Minute),
	}

	if err := session.Encrypt(); err != nil {
		return nil, fmt.Errorf("failed to encrypt auth session: %w", err)
	}

	if err := s.uow.Sync().CreateAuthSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to persist auth session: %w", err)
	}

	return &EnableBankingAuthSession{
		AuthSessionID: session.ID,
		AuthURL:       startRes.URL,
		State:         state,
		ExpiresAt:     session.ExpiresAt,
	}, nil
}

// CompleteEnableBankingAuth completes code exchange, persists credentials, discovers accounts, and triggers initial sync.
func (s *SyncService) CompleteEnableBankingAuth(
	ctx context.Context,
	userID string,
	portfolioID string,
	code string,
	state string,
) ([]*model.SyncConnection, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	if strings.TrimSpace(portfolioID) == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if strings.TrimSpace(code) == "" {
		return nil, errors.New("authorization code is required")
	}
	if strings.TrimSpace(state) == "" {
		return nil, errors.New("state parameter is required")
	}

	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify portfolio: %w", err)
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if portfolio.UserID != userID && !isAdmin {
		return nil, errors.New("unauthorized: portfolio belongs to another user")
	}

	// Verify state against active pending auth sessions
	sessions, err := s.uow.Sync().ListActiveAuthSessionsByProvider(ctx, userID, model.SyncProviderEnableBanking)
	if err != nil {
		return nil, fmt.Errorf("failed to check auth sessions: %w", err)
	}

	var matchedSession *model.SyncAuthSession
	type authProcessInfo struct {
		State        string `json:"state"`
		ASPSPName    string `json:"aspsp_name"`
		ASPSPCountry string `json:"aspsp_country"`
		RedirectURL  string `json:"redirect_url"`
		AuthID       string `json:"auth_id,omitempty"`
		SessionID    string `json:"session_id,omitempty"`
	}
	var matchedProcessInfo authProcessInfo

	for _, sess := range sessions {
		rawInfo, decErr := sess.Decrypt()
		if decErr != nil {
			continue
		}
		var info authProcessInfo
		if json.Unmarshal([]byte(rawInfo), &info) == nil && info.State == state {
			matchedSession = sess
			matchedProcessInfo = info
			break
		}
	}

	if matchedSession == nil {
		return nil, errors.New("invalid or expired OAuth state parameter (CSRF validation failed)")
	}

	client, existingCred, err := s.getEnableBankingClient(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Exchange code for session
	sessResp, err := client.AuthorizeSession(ctx, code)
	if err != nil {
		log.Printf("[WARN] [SyncService] AuthorizeSession returned err=%v. Checking if ALREADY_AUTHORIZED with sessionID=%s", err, matchedProcessInfo.SessionID)
		if strings.Contains(err.Error(), "ALREADY_AUTHORIZED") && matchedProcessInfo.SessionID != "" {
			sessResp, err = client.GetSession(ctx, matchedProcessInfo.SessionID)
		}
		if err != nil {
			log.Printf("[ERROR] [SyncService] CompleteEnableBankingAuth failed to authorize session: %v", err)
			return nil, fmt.Errorf("failed to authorize session with Enable Banking: %w", err)
		}
	}

	// Persist session ID in user's Enable Banking SyncCredential immediately so subsequent calls or refreshes work
	credData := map[string]string{
		"session_id": sessResp.SessionID,
	}

	if existingCred != nil {
		rawJSON, decErr := existingCred.Decrypt()
		if decErr == nil {
			_ = json.Unmarshal([]byte(rawJSON), &credData)
		}
		credData["session_id"] = sessResp.SessionID
		updatedJSON, _ := json.Marshal(credData)
		existingCred.RawData = string(updatedJSON)
		if err := existingCred.Encrypt(); err != nil {
			return nil, fmt.Errorf("failed to encrypt updated credential: %w", err)
		}
		existingCred.Status = model.SyncCredentialStatusActive
		existingCred.UpdatedAt = time.Now()
		if err := s.uow.Sync().UpdateCredential(ctx, existingCred); err != nil {
			return nil, fmt.Errorf("failed to persist updated credential: %w", err)
		}
	} else {
		appID := strings.TrimSpace(os.Getenv("ENABLEBANKING_APPLICATION_ID"))
		privKey := strings.TrimSpace(os.Getenv("ENABLEBANKING_PRIVATE_KEY"))
		if privKey == "" {
			if path := strings.TrimSpace(os.Getenv("ENABLEBANKING_PRIVATE_KEY_PATH")); path != "" {
				if b, readErr := os.ReadFile(path); readErr == nil {
					privKey = string(b)
				}
			}
		}
		credData["application_id"] = appID
		credData["private_key"] = privKey
		credJSON, _ := json.Marshal(credData)

		newCred := &model.SyncCredential{
			UserID:   userID,
			Provider: model.SyncProviderEnableBanking,
			RawData:  string(credJSON),
			Status:   model.SyncCredentialStatusActive,
		}
		if err := newCred.Encrypt(); err != nil {
			return nil, fmt.Errorf("failed to encrypt new credential: %w", err)
		}
		if err := s.uow.Sync().CreateCredential(ctx, newCred); err != nil {
			return nil, fmt.Errorf("failed to persist credential: %w", err)
		}
	}

	// Mark auth session as completed
	matchedSession.Status = model.SyncAuthSessionStatusCompleted
	_ = s.uow.Sync().UpdateAuthSession(ctx, matchedSession)

	accountIDs := sessResp.AccountIDs()
	if len(accountIDs) == 0 {
		// Bounded polling for delayed account availability
		polled, pollErr := client.PollSessionUntilReady(ctx, sessResp.SessionID, 3, 1500*time.Millisecond)
		if pollErr == nil && len(polled.AccountIDs()) > 0 {
			sessResp = polled
			accountIDs = polled.AccountIDs()
		} else {
			log.Printf("[WARN] [SyncService] CompleteEnableBankingAuth: session %s returned 0 accounts (Restricted Production whitelisting required)", sessResp.SessionID)
			return nil, errors.New("Enable Banking connected successfully, but returned 0 accounts. In Restricted Production mode, please ensure your Revolut account is whitelisted in Enable Banking Control Panel ('Activate by linking accounts').")
		}
	}

	// Discover and auto-provision connections & accounts in the target portfolio
	conns, err := s.DiscoverAndCreateConnections(ctx, userID, portfolioID, model.SyncProviderEnableBanking)
	if err != nil {
		return nil, fmt.Errorf("failed to discover Enable Banking accounts: %w", err)
	}

	// Trigger initial background sync for each newly discovered connection
	for _, c := range conns {
		if c.AccountID != nil {
			go func(connID string) {
				bgCtx := context.Background()
				if _, err := s.TriggerSync(bgCtx, connID); err != nil {
					log.Printf("[ERROR] [SyncService] CompleteEnableBankingAuth: initial sync failed for conn %s: %v", connID, err)
				}
			}(c.ID)
		}
	}

	return conns, nil
}

// InitiateWoobAuth starts an authentication session with the woob-service sidecar for Fortuneo or Caisse d'Épargne.
func (s *SyncService) InitiateWoobAuth(ctx context.Context, userID, portfolioID, institution, login, password, region string) (*model.SyncAuthSession, error) {
	log.Printf("[INFO] [SyncService] InitiateWoobAuth: starting for user=%s, portfolio=%s, institution=%s", userID, portfolioID, institution)
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}
	if strings.TrimSpace(portfolioID) == "" {
		return nil, errors.New("portfolio ID is required")
	}
	if strings.TrimSpace(institution) == "" {
		return nil, errors.New("institution is required")
	}
	if strings.TrimSpace(login) == "" {
		return nil, errors.New("login is required")
	}
	if strings.TrimSpace(password) == "" {
		return nil, errors.New("password is required")
	}

	// Verify portfolio ownership
	portfolio, err := s.uow.Portfolio().GetByID(ctx, portfolioID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify portfolio: %w", err)
	}
	callerUser, _ := s.uow.User().GetByID(ctx, userID)
	isAdmin := callerUser != nil && callerUser.IsAdmin()
	if portfolio.UserID != userID && !isAdmin {
		return nil, errors.New("unauthorized: portfolio belongs to another user")
	}

	baseURL := strings.TrimSpace(os.Getenv("WOOB_SERVICE_URL"))
	if baseURL == "" {
		baseURL = "http://localhost:50055"
	}

	loginPayload := map[string]interface{}{
		"institution": institution,
		"login":       login,
		"password":    password,
		"region":      region,
	}
	reqBody, _ := json.Marshal(loginPayload)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/api/v1/auth/login", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach woob-service at %s: %w", baseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		var errObj struct {
			Detail string `json:"detail"`
		}
		if jsonErr := json.Unmarshal(respBytes, &errObj); jsonErr == nil && strings.TrimSpace(errObj.Detail) != "" {
			return nil, errors.New(errObj.Detail)
		}
		return nil, fmt.Errorf("woob login failed (%d): %s", resp.StatusCode, string(respBytes))
	}

	var loginResp struct {
		SessionID        string  `json:"session_id"`
		Status           string  `json:"status"`
		CountdownSeconds int     `json:"countdown_seconds"`
		ChallengeMessage *string `json:"challenge_message"`
		ExpiresAt        int64   `json:"expires_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		return nil, fmt.Errorf("failed to decode woob login response: %w", err)
	}

	status := model.SyncAuthSessionStatusWaitingForConfirmation
	if loginResp.Status == "SUCCESS" {
		status = model.SyncAuthSessionStatusCompleted
	} else if loginResp.Status == "WAITING_FOR_CODE" {
		status = "WAITING_FOR_CODE"
	}

	processInfo := map[string]interface{}{
		"session_id":        loginResp.SessionID,
		"institution":       institution,
		"login":             login,
		"password":          password,
		"region":            region,
		"challenge_message": loginResp.ChallengeMessage,
	}
	processInfoBytes, _ := json.Marshal(processInfo)

	countdown := loginResp.CountdownSeconds
	if countdown <= 0 {
		countdown = 120
	}

	session := &model.SyncAuthSession{
		UserID:         userID,
		PortfolioID:    portfolioID,
		Provider:       model.SyncProviderWoob,
		Status:         status,
		RawProcessInfo: string(processInfoBytes),
		ExpiresAt:      time.Now().Add(time.Duration(countdown) * time.Second),
	}

	if err := session.Encrypt(); err != nil {
		return nil, fmt.Errorf("failed to encrypt session: %w", err)
	}

	if err := s.uow.Sync().CreateAuthSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to persist auth session: %w", err)
	}

	// If already completed (e.g. mock mode or no 2FA challenge), register credential right away
	if status == model.SyncAuthSessionStatusCompleted {
		credPayload := map[string]string{
			"institution": institution,
			"login":       login,
			"password":    password,
			"region":      region,
			"session_id":  loginResp.SessionID,
		}
		credBytes, _ := json.Marshal(credPayload)
		if _, err := s.RegisterCredential(ctx, userID, model.SyncProviderWoob, string(credBytes)); err != nil {
			return nil, fmt.Errorf("failed to register woob credential: %w", err)
		}
		if _, err := s.DiscoverAndCreateConnections(ctx, userID, portfolioID, model.SyncProviderWoob); err != nil {
			log.Printf("[ERROR] [SyncService] InitiateWoobAuth: DiscoverAndCreateConnections failed: %v", err)
			return nil, fmt.Errorf("authentication succeeded but failed to discover accounts: %w", err)
		}
	}

	return session, nil
}

// PollWoobAuth checks confirmation or submits 2FA OTP code.
func (s *SyncService) PollWoobAuth(ctx context.Context, userID, authSessionID, otpCode string) (*model.SyncAuthSession, []*model.SyncConnection, error) {
	session, err := s.uow.Sync().GetAuthSessionByID(ctx, authSessionID)
	if err != nil {
		return nil, nil, fmt.Errorf("session not found: %w", err)
	}
	if session.UserID != userID {
		return nil, nil, errors.New("unauthorized: session belongs to another user")
	}

	if session.Status == model.SyncAuthSessionStatusCompleted {
		allConns, err := s.uow.Sync().ListConnectionsByPortfolio(ctx, session.PortfolioID)
		if err != nil {
			return session, nil, err
		}
		rawInfo, _ := session.Decrypt()
		var processInfo struct {
			Institution string `json:"institution"`
		}
		_ = json.Unmarshal([]byte(rawInfo), &processInfo)

		var woobConns []*model.SyncConnection
		for _, c := range allConns {
			if c.Provider == model.SyncProviderWoob {
				if processInfo.Institution != "" {
					instClean := strings.ToLower(strings.ReplaceAll(processInfo.Institution, "_", ""))
					connClean := strings.ToLower(strings.ReplaceAll(c.InstitutionName, " ", ""))
					if !strings.Contains(connClean, instClean) && !strings.Contains(instClean, connClean) {
						continue
					}
				}
				woobConns = append(woobConns, c)
			}
		}
		return session, woobConns, nil
	}

	if time.Now().After(session.ExpiresAt) {
		session.Status = model.SyncAuthSessionStatusExpired
		_ = s.uow.Sync().UpdateAuthSession(ctx, session)
		return session, nil, nil
	}

	rawInfo, err := session.Decrypt()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decrypt session: %w", err)
	}

	var processInfo struct {
		SessionID   string `json:"session_id"`
		Institution string `json:"institution"`
		Login       string `json:"login"`
		Password    string `json:"password"`
		Region      string `json:"region"`
	}
	if err := json.Unmarshal([]byte(rawInfo), &processInfo); err != nil {
		return nil, nil, fmt.Errorf("corrupt session process info: %w", err)
	}

	baseURL := strings.TrimSpace(os.Getenv("WOOB_SERVICE_URL"))
	if baseURL == "" {
		baseURL = "http://localhost:50055"
	}

	pollPayload := map[string]string{
		"session_id": processInfo.SessionID,
		"otp_code":   otpCode,
	}
	body, _ := json.Marshal(pollPayload)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/api/v1/auth/poll", bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, nil, fmt.Errorf("woob poll failed: %w", err)
	}
	defer resp.Body.Close()

	var pollResp struct {
		Status  string  `json:"status"`
		Message *string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&pollResp); err != nil {
		return nil, nil, err
	}

	if pollResp.Status == "SUCCESS" {
		credPayload := map[string]string{
			"institution": processInfo.Institution,
			"login":       processInfo.Login,
			"password":    processInfo.Password,
			"region":      processInfo.Region,
			"session_id":  processInfo.SessionID,
		}
		credBytes, _ := json.Marshal(credPayload)
		if _, err := s.RegisterCredential(ctx, userID, model.SyncProviderWoob, string(credBytes)); err != nil {
			return nil, nil, fmt.Errorf("failed to register woob credential: %w", err)
		}

		conns, err := s.DiscoverAndCreateConnections(ctx, userID, session.PortfolioID, model.SyncProviderWoob)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to discover woob accounts: %w", err)
		}

		session.Status = model.SyncAuthSessionStatusCompleted
		_ = s.uow.Sync().UpdateAuthSession(ctx, session)

		var matchedConns []*model.SyncConnection
		for _, c := range conns {
			if c.Provider == model.SyncProviderWoob {
				if processInfo.Institution != "" {
					instClean := strings.ToLower(strings.ReplaceAll(processInfo.Institution, "_", ""))
					connClean := strings.ToLower(strings.ReplaceAll(c.InstitutionName, " ", ""))
					if !strings.Contains(connClean, instClean) && !strings.Contains(instClean, connClean) {
						continue
					}
				}
				matchedConns = append(matchedConns, c)
			}
		}

		for _, c := range matchedConns {
			if c.AccountID != nil {
				go func(connID string) {
					bgCtx := context.Background()
					_, _ = s.TriggerSync(bgCtx, connID)
				}(c.ID)
			}
		}

		return session, matchedConns, nil
	} else if pollResp.Status == "EXPIRED" {
		session.Status = model.SyncAuthSessionStatusExpired
		_ = s.uow.Sync().UpdateAuthSession(ctx, session)
		return session, nil, nil
	} else if pollResp.Status == "REJECTED" {
		session.Status = model.SyncAuthSessionStatusRejected
		_ = s.uow.Sync().UpdateAuthSession(ctx, session)
		return session, nil, nil
	}

	// Still waiting
	return session, nil, nil
}
