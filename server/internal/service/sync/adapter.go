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
	ExternalID    string
	Name          string
	Type          model.AccountType
	TaxWrapper    model.TaxWrapperType
	Institution   string
	AccountNumber string
	Currency      model.Currency
}

// RawBalance represents cash balance in an external account.
type RawBalance struct {
	Currency  model.Currency
	Amount    decimal.Decimal
	Available *decimal.Decimal
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

// RawTransaction represents an external trade, cash flow, dividend, or fee record.
type RawTransaction struct {
	ExternalID        string
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
}

// SyncAdapter defines the provider contract for external account synchronization.
type SyncAdapter interface {
	Provider() string
	TestConnection(ctx context.Context, cred *model.SyncCredential) error
	FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]RawAccount, error)
	FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]RawBalance, error)
	FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]RawHolding, error)
	FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time) ([]RawTransaction, error)
}
