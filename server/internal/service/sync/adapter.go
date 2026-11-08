package sync

import (
	"context"
	"errors"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
)

var (
	// ErrInvalidCredentials indicates external authentication failed (e.g. HTTP 401/403).
	ErrInvalidCredentials = errors.New("invalid external credentials")

	// ErrExpiredCredentials indicates the token or session expired and must be refreshed or re-authenticated.
	ErrExpiredCredentials = errors.New("external credentials expired")

	// ErrRateLimited indicates the external provider throttled requests (HTTP 429).
	ErrRateLimited = errors.New("external rate limit reached")

	// ErrAdapterNotFound indicates no adapter is registered for the requested provider.
	ErrAdapterNotFound = errors.New("sync adapter not found")

	// ErrConnectionNotFound indicates the sync connection does not exist.
	ErrConnectionNotFound = errors.New("sync connection not found")

	// ErrCredentialNotFound indicates the sync credential does not exist.
	ErrCredentialNotFound = errors.New("sync credential not found")

	// ErrAccountNotFound indicates the associated account does not exist.
	ErrAccountNotFound = errors.New("account not found")
)

// RawAccount represents an external institution account discovered via an adapter.
type RawAccount struct {
	ExternalID        string
	Name              string
	Type              model.AccountType
	TaxWrapper        model.TaxWrapperType
	Institution       string
	AccountNumber     string
	CashAccountNumber string
	Currency          model.Currency
}

// RawBalance represents cash balance in an external account.
type RawBalance struct {
	Currency  model.Currency
	Amount    decimal.Decimal
	Available *decimal.Decimal
}

// BalancesSnapshot represents an authoritative or partial snapshot of cash balances.
type BalancesSnapshot struct {
	Balances   []RawBalance
	IsComplete bool
	AsOf       time.Time
	Warnings   []string
}

// RawHolding represents a security or crypto asset position held in an external account.
type RawHolding struct {
	ExternalID       string
	Symbol           string
	Name             string
	ISIN             string
	AssetType        model.AssetType
	Quantity         decimal.Decimal
	CostBasisPerUnit *decimal.Decimal
	TotalCostBasis   *model.Money
	CurrentPrice     *decimal.Decimal
	Currency         model.Currency
}

// HoldingsSnapshot represents an authoritative or partial snapshot of portfolio holdings.
type HoldingsSnapshot struct {
	Holdings       []RawHolding
	IsComplete     bool
	AsOf           time.Time
	Warnings       []string
	PaginationDone bool
}

// RawTransaction represents an external trade, cash flow, dividend, or fee record.
type RawTransaction struct {
	ExternalID        string
	SourceStream      string
	OriginalID        string
	Status            string
	Type              model.TransactionType
	Symbol            string
	Name              string
	ISIN              string
	Quantity          *decimal.Decimal
	UnitPriceAmount   *decimal.Decimal
	UnitPriceCurrency model.Currency
	Amount            model.Money
	Currency          model.Currency
	FeesAmount        model.Money
	FeesCurrency      model.Currency
	ExecutedAt        time.Time
	Notes             string
	RawPayload        []byte
}

// StreamCursors maps stream identifiers (e.g. timeline topic names) to pagination cursors.
type StreamCursors map[string]string

// TransactionsSnapshot represents an authoritative or partial batch of transactions.
type TransactionsSnapshot struct {
	Transactions       []RawTransaction
	UnrecognizedEvents []*model.SyncRawEvent
	NextCursor         *string
	StreamCursors      StreamCursors
	IsComplete         bool
	PaginationDone     bool
}

// SyncAdapter defines the provider contract for external account synchronization.
type SyncAdapter interface {
	Provider() string
	TestConnection(ctx context.Context, cred *model.SyncCredential) error
	FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]RawAccount, error)
	FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (BalancesSnapshot, error)
	FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (HoldingsSnapshot, error)
	FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time, cursors StreamCursors) (TransactionsSnapshot, error)
}
