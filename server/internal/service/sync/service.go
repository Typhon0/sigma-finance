package sync

import (
	"context"
	"errors"
	"fmt"
	"strings"
	stdsync "sync"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"
)

// AggregatorAuthSession holds session information for external aggregator authentication.
type AggregatorAuthSession struct {
	Link         string
	SessionToken string
	Provider     string
}

// ISyncService defines the central coordination and execution interface for account sync.
type ISyncService interface {
	RegisterAdapter(adapter SyncAdapter)
	TriggerSync(ctx context.Context, connectionID string) (*model.SyncRun, error)
	TriggerAccountSync(ctx context.Context, accountID string) (*model.SyncRun, error)
	RegisterCredential(ctx context.Context, userID string, provider string, rawJSON string) (*model.SyncCredential, error)
	LinkAccount(ctx context.Context, connectionID string, accountID string, autoCreate bool) (*model.SyncConnection, error)
	GetConnection(ctx context.Context, connectionID string) (*model.SyncConnection, error)
	ListConnections(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error)
	ListCredentials(ctx context.Context, userID string) ([]*model.SyncCredential, error)
	GetAdapter(provider string) (SyncAdapter, bool)
	GenerateAggregatorLink(ctx context.Context, userID string, provider string, redirectURL string) (*AggregatorAuthSession, error)
	CompleteAggregatorAuth(ctx context.Context, userID string, connectionID string, sessionToken string) ([]*model.SyncConnection, error)
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
func (s *SyncService) RegisterCredential(ctx context.Context, userID string, provider string, rawJSON string) (*model.SyncCredential, error) {
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

	cred := &model.SyncCredential{
		UserID:   userID,
		Provider: provider,
		RawData:  rawJSON,
		Status:   model.SyncCredentialStatusActive,
	}

	if err := cred.Validate(); err != nil {
		return nil, fmt.Errorf("credential validation failed: %w", err)
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
			} else if conn.Provider == model.SyncProviderGoCardless {
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
			if acc.UserID != conn.UserID || acc.PortfolioID != conn.PortfolioID {
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

	balances, err := adapter.FetchBalances(ctx, cred, conn.ExternalAccountID)
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

	holdings, err := adapter.FetchHoldings(ctx, cred, conn.ExternalAccountID)
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

	txs, err := adapter.FetchTransactions(ctx, cred, conn.ExternalAccountID, conn.LastSyncAt)
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
		balImported, balUpdated, err := ReconcileBalances(ctx, uow, conn, account, balances)
		if err != nil {
			return err
		}
		totalImported += balImported
		totalUpdated += balUpdated

		// Reconcile holdings
		hImported, hUpdated, warnings, activeAssetIDs, err := ReconcileHoldings(ctx, uow, s.instrumentService, conn, account, holdings)
		if err != nil {
			return err
		}
		totalImported += hImported
		totalUpdated += hUpdated
		allWarnings = append(allWarnings, warnings...)

		// Reconcile transactions
		txImported, txUpdated, err := ReconcileTransactions(ctx, uow, conn, txs)
		if err != nil {
			return err
		}
		totalImported += txImported
		totalUpdated += txUpdated

		// Reconcile residual tax lots (unallocated holding quantities)
		if err := ReconcileResidualTaxLots(ctx, uow, conn, holdings); err != nil {
			return err
		}

		// Reconcile liquidated positions (absent from holdings snapshot)
		liquidated, err := ReconcileLiquidatedPositions(ctx, uow, conn, activeAssetIDs)
		if err != nil {
			return err
		}
		totalUpdated += liquidated

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

	// Check if connectionID is a portfolio ID
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
