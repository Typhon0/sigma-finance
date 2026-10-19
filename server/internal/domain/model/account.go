package model

import (
	"errors"
	"strings"
	"time"

	"github.com/uptrace/bun"
)

// AccountType represents the functional category of an external custodial/legal account
type AccountType string

const (
	AccountTypeBroker         AccountType = "BROKER"
	AccountTypeBank           AccountType = "BANK"
	AccountTypeCryptoExchange AccountType = "CRYPTO_EXCHANGE"
	AccountTypeOther          AccountType = "OTHER"
)

func (at AccountType) IsValid() bool {
	switch at {
	case AccountTypeBroker, AccountTypeBank, AccountTypeCryptoExchange, AccountTypeOther:
		return true
	}
	return false
}

// Account represents a financial account (e.g. Trade Republic CTO, Fortuneo PEA, Binance)
// held under a Portfolio.
type Account struct {
	bun.BaseModel `bun:"table:sigma_finance.accounts,alias:a"`

	ID            string         `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID        string         `bun:"user_id,notnull,type:uuid"`
	PortfolioID   string         `bun:"portfolio_id,notnull,type:uuid"`
	Name          string         `bun:"name,notnull"`
	Type          AccountType    `bun:"type,notnull,default:'BROKER'"`
	TaxWrapper    TaxWrapperType `bun:"tax_wrapper,notnull,default:'STANDARD_TAXABLE'"`
	Institution   *string        `bun:"institution"`
	AccountNumber *string        `bun:"account_number"`
	Currency      Currency       `bun:"currency,type:varchar(3),default:EUR"`
	SyncProvider  string         `bun:"sync_provider,default:MANUAL"`
	ExternalID    *string        `bun:"external_id"`
	CreatedAt     time.Time      `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt     time.Time      `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User      *User       `bun:"rel:belongs-to,join:user_id=id"`
	Portfolio *Portfolio  `bun:"rel:belongs-to,join:portfolio_id=id"`
	Positions []*Position `bun:"rel:has-many,join:id=account_id"`
}

// Implement Entity interface
func (a Account) GetID() string            { return a.ID }
func (a Account) SetID(id string)          { a.ID = id }
func (a Account) GetCreatedAt() time.Time  { return a.CreatedAt }
func (a Account) SetCreatedAt(t time.Time) { a.CreatedAt = t }
func (a Account) GetUpdatedAt() time.Time  { return a.UpdatedAt }
func (a Account) SetUpdatedAt(t time.Time) { a.UpdatedAt = t }

// Validate checks business rules for Account
func (a *Account) Validate() error {
	if strings.TrimSpace(a.Name) == "" {
		return errors.New("account name is required")
	}
	if a.UserID == "" {
		return errors.New("user ID is required")
	}
	if a.PortfolioID == "" {
		return errors.New("portfolio ID is required")
	}
	if !a.Type.IsValid() {
		return errors.New("invalid account type")
	}
	if a.TaxWrapper == "" {
		a.TaxWrapper = TaxWrapperStandardTaxable
	}
	return nil
}
