package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// AssetType represents the type of asset
type AssetType string

const (
	AssetTypeStock         AssetType = "STOCK"
	AssetTypeFund          AssetType = "FUND"
	AssetTypeCrypto        AssetType = "CRYPTO"
	AssetTypeBankAccount   AssetType = "BANK_ACCOUNT"
	AssetTypeRealEstate    AssetType = "REAL_ESTATE"
	AssetTypeLifeInsurance AssetType = "LIFE_INSURANCE"
	AssetTypeWatch         AssetType = "WATCH"
	AssetTypeLoan          AssetType = "LOAN"
	AssetTypeOtherValuable AssetType = "OTHER_VALUABLE"
)

// IsValid checks if the asset type is valid
func (at AssetType) IsValid() bool {
	switch at {
	case AssetTypeStock, AssetTypeFund, AssetTypeCrypto, AssetTypeBankAccount,
		AssetTypeRealEstate, AssetTypeLifeInsurance, AssetTypeWatch, AssetTypeLoan, AssetTypeOtherValuable:
		return true
	}
	return false
}

// IsTradeable returns true if the asset type has market data
func (at AssetType) IsTradeable() bool {
	return at == AssetTypeStock || at == AssetTypeFund || at == AssetTypeCrypto
}

// Asset represents a financial asset or valuable item
type Asset struct {
	bun.BaseModel `bun:"table:sigma_finance.assets"`

	ID               string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	InstrumentID     *string         `bun:"instrument_id,type:uuid"`
	Type             AssetType       `bun:"type,notnull"`
	Symbol           *string         `bun:"symbol"` // For tradeable assets
	Name             string          `bun:"name,notnull"`
	Description      *string         `bun:"description"`
	Metadata         json.RawMessage `bun:"metadata,type:jsonb"` // Asset-specific data
	IsTradeable      bool            `bun:"is_tradeable,default:false"`
	MarketDataSource *string         `bun:"market_data_source"`
	CreatedAt        time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt        time.Time       `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

// AssetPrice represents historical price data for an asset
type AssetPrice struct {
	bun.BaseModel `bun:"table:sigma_finance.asset_prices"`

	ID        int64           `bun:"id,pk,autoincrement"`
	AssetID   string          `bun:"asset_id,notnull"`
	Price     decimal.Decimal `bun:"price,type:decimal(20,8),notnull"`
	Volume    *int64          `bun:"volume"`
	MarketCap *int64          `bun:"market_cap"`
	Timestamp time.Time       `bun:"timestamp,notnull"`
	Source    string          `bun:"source,notnull"`

	// Relations
	Asset *Asset `bun:"rel:belongs-to,join:asset_id=id"`
}

// AssetDocument represents a document attached to an asset
type AssetDocument struct {
	DocumentID  int       `bun:"document_id"`
	AssetID     string    `bun:"asset_id"`
	FileName    string    `bun:"file_name"`
	Description string    `bun:"description"`
	StorageKey  string    `bun:"storage_key"`
	ContentType string    `bun:"content_type"`
	Size        int64     `bun:"size"`
	UploadedBy  string    `bun:"uploaded_by"`
	UploadedAt  time.Time `bun:"uploaded_at"`
}

// Asset metadata structures for different asset types

// StockMetadata contains stock-specific information
type StockMetadata struct {
	Exchange      string   `json:"exchange"`
	Sector        string   `json:"sector"`
	Industry      string   `json:"industry"`
	MarketCap     *int64   `json:"market_cap,omitempty"`
	PERatio       *float64 `json:"pe_ratio,omitempty"`
	DividendYield *float64 `json:"dividend_yield,omitempty"`
}

// FundMetadata contains fund-specific information
type FundMetadata struct {
	Exchange string `json:"exchange"`
	Sector   string `json:"sector"`
	Industry string `json:"industry"`
	FundType string `json:"fund_type"` // mutual_fund, etf, index_fund, hedge_fund
}

// CryptoMetadata contains cryptocurrency-specific information
type CryptoMetadata struct {
	Blockchain      string  `json:"blockchain"`
	WalletAddress   string  `json:"wallet_address"`
	ContractAddress *string `json:"contract_address,omitempty"`
	Decimals        int     `json:"decimals"`
	IsStablecoin    bool    `json:"is_stablecoin"`
}

// BankAccountMetadata contains bank account-specific information
type BankAccountMetadata struct {
	AccountType   string   `json:"account_type"` // checking, savings, term_deposit
	Institution   string   `json:"institution"`
	AccountNumber string   `json:"account_number"`
	Currency      string   `json:"currency"`
	InterestRate  *float64 `json:"interest_rate,omitempty"`
}

// RealEstateMetadata contains real estate-specific information
type RealEstateMetadata struct {
	PropertyType string   `json:"property_type"` // residential, commercial, land
	Address      string   `json:"address"`
	City         string   `json:"city"`
	State        string   `json:"state"`
	Country      string   `json:"country"`
	ZipCode      string   `json:"zip_code"`
	SquareFeet   *int     `json:"square_feet,omitempty"`
	YearBuilt    *int     `json:"year_built,omitempty"`
	Bedrooms     *int     `json:"bedrooms,omitempty"`
	Bathrooms    *float64 `json:"bathrooms,omitempty"`
}

// LifeInsuranceMetadata contains life insurance-specific information
type LifeInsuranceMetadata struct {
	PolicyNumber     string     `json:"policy_number"`
	Insurer          string     `json:"insurer"`
	PolicyType       string     `json:"policy_type"`       // term, whole, universal
	CoverageAmount   int64      `json:"coverage_amount"`   // in cents
	PremiumAmount    int64      `json:"premium_amount"`    // in cents
	PremiumFrequency string     `json:"premium_frequency"` // monthly, quarterly, annually
	Beneficiaries    []string   `json:"beneficiaries"`
	MaturityDate     *time.Time `json:"maturity_date,omitempty"`
}

// WatchMetadata contains luxury watch-specific information
type WatchMetadata struct {
	Brand           string   `json:"brand"`
	Model           string   `json:"model"`
	SerialNumber    *string  `json:"serial_number,omitempty"`
	ReferenceNumber *string  `json:"reference_number,omitempty"`
	Condition       string   `json:"condition"` // new, excellent, good, fair, poor
	YearMade        *int     `json:"year_made,omitempty"`
	Material        string   `json:"material"`                   // steel, gold, platinum, etc.
	Movement        string   `json:"movement"`                   // automatic, manual, quartz
	CaseSize        *float64 `json:"case_size,omitempty"`        // in mm
	WaterResistance *int     `json:"water_resistance,omitempty"` // in meters
}

// LoanMetadata contains loan/debt-specific information
type LoanMetadata struct {
	LoanType          string  `json:"loan_type"`                     // amortizing, in_fine, deferred_interest, deferred_total, step
	LoanAmount        int64   `json:"loan_amount"`                   // in cents (original principal)
	RemainingBalance  int64   `json:"remaining_balance"`             // in cents
	InterestRate      float64 `json:"interest_rate"`                 // as percentage (e.g. 3.5)
	DurationMonths    int     `json:"duration_months"`               // total loan duration
	MonthlyPayment    int64   `json:"monthly_payment"`               // in cents
	StartDate         string  `json:"start_date"`                    // ISO date
	EndDate           string  `json:"end_date,omitempty"`            // ISO date
	Lender            string  `json:"lender"`                        // bank/lender name
	LoanNumber        string  `json:"loan_number,omitempty"`         // reference number
	Currency          string  `json:"currency"`                      // EUR, USD, etc.
	DownPayment       int64   `json:"down_payment,omitempty"`        // in cents
	Status            string  `json:"status"`                        // active, paid_off, delinquent
	OwnershipMode     string  `json:"ownership_mode"`                // personal, company
	ApplicationFee    int64   `json:"application_fee,omitempty"`     // in cents
	BrokerFee         int64   `json:"broker_fee,omitempty"`          // in cents
	InsuranceFee      int64   `json:"insurance_fee,omitempty"`       // monthly, in cents
	OtherFees         int64   `json:"other_fees,omitempty"`          // in cents
	EarlyRepaymentFee float64 `json:"early_repayment_fee,omitempty"` // as percentage
	Description       string  `json:"description,omitempty"`         // free-text notes
}

// OtherValuableMetadata contains information for other valuable items
type OtherValuableMetadata struct {
	Category     string   `json:"category"`
	Brand        *string  `json:"brand,omitempty"`
	Model        *string  `json:"model,omitempty"`
	SerialNumber *string  `json:"serial_number,omitempty"`
	Condition    string   `json:"condition"`
	YearMade     *int     `json:"year_made,omitempty"`
	Material     *string  `json:"material,omitempty"`
	Dimensions   *string  `json:"dimensions,omitempty"`
	Weight       *float64 `json:"weight,omitempty"`
	Provenance   *string  `json:"provenance,omitempty"`
}

// Validation methods

// Validate performs comprehensive validation of the asset
func (a *Asset) Validate() error {
	if a.Name == "" {
		return errors.New("asset name is required")
	}

	if !a.Type.IsValid() {
		return fmt.Errorf("invalid asset type: %s", a.Type)
	}

	// Validate symbol for tradeable assets
	if a.Type.IsTradeable() {
		if a.Symbol == nil || *a.Symbol == "" {
			return errors.New("symbol is required for tradeable assets")
		}
		if err := a.validateSymbol(*a.Symbol); err != nil {
			return err
		}
		a.IsTradeable = true
	} else {
		a.IsTradeable = false
		a.Symbol = nil
		a.MarketDataSource = nil
	}

	// Validate metadata based on asset type
	if err := a.validateMetadata(); err != nil {
		return err
	}

	return nil
}

// validateSymbol validates the asset symbol format
func (a *Asset) validateSymbol(symbol string) error {
	symbol = strings.TrimSpace(strings.ToUpper(symbol))

	switch a.Type {
	case AssetTypeStock:
		// Stock symbols: 1-5 characters, letters only
		if matched, _ := regexp.MatchString(`^[A-Z]{1,5}$`, symbol); !matched {
			return errors.New("stock symbol must be 1-5 uppercase letters")
		}
	case AssetTypeFund:
		// Fund symbols: 1-5 characters, letters only (same as stocks)
		if matched, _ := regexp.MatchString(`^[A-Z]{1,5}$`, symbol); !matched {
			return errors.New("fund symbol must be 1-5 uppercase letters")
		}
	case AssetTypeCrypto:
		// Crypto symbols: 2-10 characters, letters and numbers
		if matched, _ := regexp.MatchString(`^[A-Z0-9]{2,10}$`, symbol); !matched {
			return errors.New("crypto symbol must be 2-10 uppercase letters and numbers")
		}
	}

	*a.Symbol = symbol
	return nil
}

// validateMetadata validates asset-specific metadata
func (a *Asset) validateMetadata() error {
	if len(a.Metadata) == 0 {
		return nil // Metadata is optional
	}

	switch a.Type {
	case AssetTypeStock:
		var metadata StockMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid stock metadata: %w", err)
		}
		return a.validateStockMetadata(&metadata)
	case AssetTypeFund:
		var metadata FundMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid fund metadata: %w", err)
		}
		return a.validateFundMetadata(&metadata)
	case AssetTypeCrypto:
		var metadata CryptoMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid crypto metadata: %w", err)
		}
		return a.validateCryptoMetadata(&metadata)
	case AssetTypeBankAccount:
		var metadata BankAccountMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid bank account metadata: %w", err)
		}
		return a.validateBankAccountMetadata(&metadata)
	case AssetTypeRealEstate:
		var metadata RealEstateMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid real estate metadata: %w", err)
		}
		return a.validateRealEstateMetadata(&metadata)
	case AssetTypeLifeInsurance:
		var metadata LifeInsuranceMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid life insurance metadata: %w", err)
		}
		return a.validateLifeInsuranceMetadata(&metadata)
	case AssetTypeWatch:
		var metadata WatchMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid watch metadata: %w", err)
		}
		return a.validateWatchMetadata(&metadata)
	case AssetTypeLoan:
		var metadata LoanMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid loan metadata: %w", err)
		}
		return a.validateLoanMetadata(&metadata)
	case AssetTypeOtherValuable:
		var metadata OtherValuableMetadata
		if err := json.Unmarshal(a.Metadata, &metadata); err != nil {
			return fmt.Errorf("invalid other valuable metadata: %w", err)
		}
		return a.validateOtherValuableMetadata(&metadata)
	}

	return nil
}

// Asset-specific metadata validation methods

func (a *Asset) validateStockMetadata(metadata *StockMetadata) error {
	if metadata.Exchange == "" {
		return errors.New("exchange is required for stock metadata")
	}
	if metadata.PERatio != nil && *metadata.PERatio < 0 {
		return errors.New("PE ratio must be positive")
	}
	if metadata.DividendYield != nil && (*metadata.DividendYield < 0 || *metadata.DividendYield > 100) {
		return errors.New("dividend yield must be between 0 and 100")
	}
	return nil
}

func (a *Asset) validateFundMetadata(metadata *FundMetadata) error {
	validFundTypes := map[string]bool{
		"mutual_fund": true, "etf": true, "index_fund": true, "hedge_fund": true,
	}
	if metadata.FundType == "" {
		return errors.New("fund_type is required for fund metadata")
	}
	if !validFundTypes[metadata.FundType] {
		return errors.New("invalid fund type")
	}
	return nil
}

func (a *Asset) validateCryptoMetadata(metadata *CryptoMetadata) error {
	if metadata.Blockchain == "" {
		return errors.New("blockchain is required for crypto metadata")
	}
	if metadata.WalletAddress == "" {
		return errors.New("wallet address is required for crypto metadata")
	}
	if metadata.Decimals < 0 || metadata.Decimals > 18 {
		return errors.New("decimals must be between 0 and 18")
	}
	// Basic wallet address validation (can be enhanced per blockchain)
	if len(metadata.WalletAddress) < 10 {
		return errors.New("wallet address appears to be invalid")
	}
	return nil
}

func (a *Asset) validateBankAccountMetadata(metadata *BankAccountMetadata) error {
	validAccountTypes := map[string]bool{
		"checking": true, "savings": true, "term_deposit": true,
		"money_market": true, "cd": true,
	}
	if !validAccountTypes[metadata.AccountType] {
		return errors.New("invalid account type")
	}
	if metadata.Institution == "" {
		return errors.New("institution is required for bank account metadata")
	}
	if metadata.AccountNumber == "" {
		return errors.New("account number is required for bank account metadata")
	}
	if metadata.Currency == "" {
		return errors.New("currency is required for bank account metadata")
	}
	if metadata.InterestRate != nil && (*metadata.InterestRate < 0 || *metadata.InterestRate > 100) {
		return errors.New("interest rate must be between 0 and 100")
	}
	return nil
}

func (a *Asset) validateRealEstateMetadata(metadata *RealEstateMetadata) error {
	validPropertyTypes := map[string]bool{
		"residential": true, "commercial": true, "land": true,
		"industrial": true, "mixed_use": true,
	}
	if !validPropertyTypes[metadata.PropertyType] {
		return errors.New("invalid property type")
	}
	if metadata.Address == "" {
		return errors.New("address is required for real estate metadata")
	}
	if metadata.City == "" {
		return errors.New("city is required for real estate metadata")
	}
	if metadata.Country == "" {
		return errors.New("country is required for real estate metadata")
	}
	if metadata.YearBuilt != nil && (*metadata.YearBuilt < 1800 || *metadata.YearBuilt > time.Now().Year()+5) {
		return errors.New("year built must be reasonable")
	}
	return nil
}

func (a *Asset) validateLifeInsuranceMetadata(metadata *LifeInsuranceMetadata) error {
	if metadata.PolicyNumber == "" {
		return errors.New("policy number is required for life insurance metadata")
	}
	if metadata.Insurer == "" {
		return errors.New("insurer is required for life insurance metadata")
	}
	validPolicyTypes := map[string]bool{
		"term": true, "whole": true, "universal": true, "variable": true,
	}
	if !validPolicyTypes[metadata.PolicyType] {
		return errors.New("invalid policy type")
	}
	if metadata.CoverageAmount <= 0 {
		return errors.New("coverage amount must be positive")
	}
	if metadata.PremiumAmount <= 0 {
		return errors.New("premium amount must be positive")
	}
	validFrequencies := map[string]bool{
		"monthly": true, "quarterly": true, "semi_annually": true, "annually": true,
	}
	if !validFrequencies[metadata.PremiumFrequency] {
		return errors.New("invalid premium frequency")
	}
	return nil
}

func (a *Asset) validateWatchMetadata(metadata *WatchMetadata) error {
	if metadata.Brand == "" {
		return errors.New("brand is required for watch metadata")
	}
	if metadata.Model == "" {
		return errors.New("model is required for watch metadata")
	}
	validConditions := map[string]bool{
		"new": true, "excellent": true, "good": true, "fair": true, "poor": true,
	}
	if !validConditions[metadata.Condition] {
		return errors.New("invalid condition")
	}
	validMovements := map[string]bool{
		"automatic": true, "manual": true, "quartz": true, "spring_drive": true,
	}
	if !validMovements[metadata.Movement] {
		return errors.New("invalid movement type")
	}
	if metadata.YearMade != nil && (*metadata.YearMade < 1800 || *metadata.YearMade > time.Now().Year()) {
		return errors.New("year made must be reasonable")
	}
	if metadata.CaseSize != nil && (*metadata.CaseSize < 10 || *metadata.CaseSize > 100) {
		return errors.New("case size must be between 10 and 100 mm")
	}
	return nil
}

func (a *Asset) validateLoanMetadata(metadata *LoanMetadata) error {
	validLoanTypes := map[string]bool{
		"amortizing": true, "in_fine": true, "deferred_interest": true, "deferred_total": true, "step": true,
	}
	if !validLoanTypes[metadata.LoanType] {
		return errors.New("invalid loan type")
	}
	if metadata.LoanAmount <= 0 {
		return errors.New("loan amount must be positive")
	}
	if metadata.InterestRate < 0 || metadata.InterestRate > 100 {
		return errors.New("interest rate must be between 0 and 100")
	}
	if metadata.DurationMonths <= 0 {
		return errors.New("duration months must be positive")
	}
	if metadata.Lender == "" {
		return errors.New("lender is required for loan metadata")
	}
	validCurrencies := map[string]bool{"EUR": true, "USD": true, "GBP": true, "CHF": true}
	if metadata.Currency == "" || !validCurrencies[metadata.Currency] {
		return errors.New("valid currency is required for loan metadata")
	}
	validStatuses := map[string]bool{"active": true, "paid_off": true, "delinquent": true}
	if metadata.Status != "" && !validStatuses[metadata.Status] {
		return errors.New("invalid loan status")
	}
	return nil
}

func (a *Asset) validateOtherValuableMetadata(metadata *OtherValuableMetadata) error {
	if metadata.Category == "" {
		return errors.New("category is required for other valuable metadata")
	}
	validConditions := map[string]bool{
		"new": true, "excellent": true, "good": true, "fair": true, "poor": true,
	}
	if !validConditions[metadata.Condition] {
		return errors.New("invalid condition")
	}
	if metadata.YearMade != nil && (*metadata.YearMade < 1800 || *metadata.YearMade > time.Now().Year()) {
		return errors.New("year made must be reasonable")
	}
	return nil
}

// Implement Entity interface
func (a Asset) GetID() string             { return a.ID }
func (a *Asset) SetID(id string)          { a.ID = id }
func (a Asset) GetCreatedAt() time.Time   { return a.CreatedAt }
func (a *Asset) SetCreatedAt(t time.Time) { a.CreatedAt = t }
func (a Asset) GetUpdatedAt() time.Time   { return a.UpdatedAt }
func (a *Asset) SetUpdatedAt(t time.Time) { a.UpdatedAt = t }
