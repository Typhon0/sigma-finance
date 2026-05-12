package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// TransactionType represents the type of transaction
type TransactionType string

const (
	TransactionTypeBuy         TransactionType = "BUY"
	TransactionTypeSell        TransactionType = "SELL"
	TransactionTypeDeposit     TransactionType = "DEPOSIT"
	TransactionTypeWithdrawal  TransactionType = "WITHDRAWAL"
	TransactionTypeTransferIn  TransactionType = "TRANSFER_IN"
	TransactionTypeTransferOut TransactionType = "TRANSFER_OUT"
	TransactionTypeDividend    TransactionType = "DIVIDEND"
	TransactionTypeInterest    TransactionType = "INTEREST"
	TransactionTypeFee         TransactionType = "FEE"
	TransactionTypeAdjustment  TransactionType = "ADJUSTMENT"
)

// IsValid checks if the transaction type is valid
func (tt TransactionType) IsValid() bool {
	switch tt {
	case TransactionTypeBuy, TransactionTypeSell, TransactionTypeDeposit, TransactionTypeWithdrawal,
		TransactionTypeTransferIn, TransactionTypeTransferOut, TransactionTypeDividend,
		TransactionTypeInterest, TransactionTypeFee, TransactionTypeAdjustment:
		return true
	}
	return false
}

// RequiresQuantity returns true if the transaction type requires a quantity
func (tt TransactionType) RequiresQuantity() bool {
	return tt == TransactionTypeBuy || tt == TransactionTypeSell
}

// RequiresPrice returns true if the transaction type requires a price per unit
func (tt TransactionType) RequiresPrice() bool {
	return tt == TransactionTypeBuy || tt == TransactionTypeSell
}

// IsPositiveAmount returns true if the transaction type typically has a positive amount
func (tt TransactionType) IsPositiveAmount() bool {
	switch tt {
	case TransactionTypeBuy, TransactionTypeDeposit, TransactionTypeTransferIn,
		TransactionTypeDividend, TransactionTypeInterest:
		return true
	case TransactionTypeSell, TransactionTypeWithdrawal, TransactionTypeTransferOut, TransactionTypeFee:
		return false
	case TransactionTypeAdjustment:
		return true // Can be either positive or negative
	}
	return true
}

// Transaction represents a financial transaction
type Transaction struct {
	bun.BaseModel `bun:"table:sigma_finance.transactions,alias:transactions"`

	ID                string           `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID            string           `bun:"user_id,notnull"`
	PositionID        *string          `bun:"position_id"` // Optional for some transaction types
	Type              TransactionType  `bun:"type,notnull"`
	Amount            Money            `bun:"amount,notnull"`                       // Amount in cents
	Quantity          *decimal.Decimal `bun:"quantity,type:decimal(20,8)"`          // For quantity-based transactions
	UnitPriceAmount   *decimal.Decimal `bun:"unit_price_amount,type:decimal(20,8)"` // Price per unit at execution time
	UnitPriceCurrency Currency         `bun:"unit_price_currency,type:varchar(3),default:USD"`
	FeesAmount        Money            `bun:"fees_amount,default:0"` // Transaction fees in cents
	FeesCurrency      Currency         `bun:"fees_currency,type:varchar(3),default:USD"`
	Notes             *string          `bun:"notes"`
	ExecutedAt        time.Time        `bun:"executed_at,notnull"`
	CreatedAt         time.Time        `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User     *User     `bun:"rel:belongs-to,join:user_id=id"`
	Position *Position `bun:"rel:belongs-to,join:position_id=id"`
}

// RealizedGains represents realized gains/losses from transactions
type RealizedGains struct {
	UserID           string    `json:"user_id"`
	TotalRealized    Money     `json:"total_realized"`
	ShortTermGains   Money     `json:"short_term_gains"`
	LongTermGains    Money     `json:"long_term_gains"`
	TransactionCount int       `json:"transaction_count"`
	StartDate        time.Time `json:"start_date"`
	EndDate          time.Time `json:"end_date"`
}

// TransactionSummary represents a summary of transactions for reporting
type TransactionSummary struct {
	TransactionType TransactionType `json:"transaction_type"`
	Count           int             `json:"count"`
	TotalAmount     Money           `json:"total_amount"`
	TotalQuantity   decimal.Decimal `json:"total_quantity"`
	AveragePrice    decimal.Decimal `json:"average_price"`
}

// Validation methods

// Validate performs comprehensive validation of the transaction
func (t *Transaction) Validate() error {
	if t.UserID == "" {
		return errors.New("user ID is required")
	}

	if !t.Type.IsValid() {
		return fmt.Errorf("invalid transaction type: %s", t.Type)
	}

	if t.Amount == 0 {
		return errors.New("transaction amount cannot be zero")
	}

	// Validate amount sign based on transaction type
	if err := t.validateAmountSign(); err != nil {
		return err
	}

	// Validate quantity requirements
	if err := t.validateQuantity(); err != nil {
		return err
	}

	// Validate price requirements
	if err := t.validatePrice(); err != nil {
		return err
	}

	// Validate position requirements
	if err := t.validatePosition(); err != nil {
		return err
	}

	// Validate fees
	if t.FeesAmount < 0 {
		return errors.New("transaction fee cannot be negative")
	}

	// Validate execution time
	if t.ExecutedAt.IsZero() {
		return errors.New("executed_at is required")
	}

	// Don't allow future dates beyond tomorrow (to account for timezone differences)
	tomorrow := time.Now().AddDate(0, 0, 1)
	if t.ExecutedAt.After(tomorrow) {
		return errors.New("transaction date cannot be in the future")
	}

	return nil
}

// validateAmountSign validates the amount sign based on transaction type
func (t *Transaction) validateAmountSign() error {
	switch t.Type {
	case TransactionTypeSell, TransactionTypeWithdrawal, TransactionTypeTransferOut, TransactionTypeFee:
		if t.Amount > 0 {
			return fmt.Errorf("transaction type %s should have negative amount", t.Type)
		}
	case TransactionTypeBuy, TransactionTypeDeposit, TransactionTypeTransferIn,
		TransactionTypeDividend, TransactionTypeInterest:
		if t.Amount < 0 {
			return fmt.Errorf("transaction type %s should have positive amount", t.Type)
		}
	case TransactionTypeAdjustment:
		// Adjustments can be positive or negative
	}
	return nil
}

// validateQuantity validates quantity requirements
func (t *Transaction) validateQuantity() error {
	if t.Type.RequiresQuantity() {
		if t.Quantity == nil {
			return fmt.Errorf("quantity is required for transaction type %s", t.Type)
		}
		if t.Quantity.IsNegative() || t.Quantity.IsZero() {
			return errors.New("quantity must be positive")
		}
	} else {
		// For non-quantity transactions, quantity should be nil or zero
		if t.Quantity != nil && !t.Quantity.IsZero() {
			return fmt.Errorf("quantity should not be specified for transaction type %s", t.Type)
		}
	}
	return nil
}

// validatePrice validates price requirements
func (t *Transaction) validatePrice() error {
	if t.Type.RequiresPrice() {
		if t.UnitPriceAmount == nil {
			return fmt.Errorf("price per unit is required for transaction type %s", t.Type)
		}
		if t.UnitPriceAmount.IsNegative() || t.UnitPriceAmount.IsZero() {
			return errors.New("price per unit must be positive")
		}

		// Validate that amount matches quantity * price (within reasonable tolerance for rounding)
		if t.Quantity != nil {
			expectedAmount := t.Quantity.Mul(*t.UnitPriceAmount).Mul(decimal.NewFromInt(100)) // Convert to cents
			actualAmount := decimal.NewFromInt(int64(t.Amount.Abs()))

			// Allow for small rounding differences (at least 1 cent total, or 1 cent per unit for large quantities)
			tolerance := decimal.Max(decimal.NewFromFloat(1.0), t.Quantity.Abs().Mul(decimal.NewFromInt(1)))
			if expectedAmount.Sub(actualAmount).Abs().GreaterThan(tolerance) {
				return fmt.Errorf("amount (%d cents) does not match quantity (%s) * price (%s)",
					t.Amount, t.Quantity.String(), t.UnitPriceAmount.String())
			}
		}
	} else {
		// For non-price transactions, price should be nil
		if t.UnitPriceAmount != nil && !t.UnitPriceAmount.IsZero() {
			return fmt.Errorf("price per unit should not be specified for transaction type %s", t.Type)
		}
	}
	return nil
}

// validatePosition validates position requirements
func (t *Transaction) validatePosition() error {
	positionRequiredTypes := map[TransactionType]bool{
		TransactionTypeBuy:  true,
		TransactionTypeSell: true,
	}

	if positionRequiredTypes[t.Type] {
		if t.PositionID == nil {
			return fmt.Errorf("position ID is required for transaction type %s", t.Type)
		}
	}

	return nil
}

// Business logic methods

// GetSignedQuantity returns the quantity with appropriate sign based on transaction type
func (t *Transaction) GetSignedQuantity() decimal.Decimal {
	if t.Quantity == nil {
		return decimal.Zero
	}

	switch t.Type {
	case TransactionTypeSell, TransactionTypeTransferOut:
		return t.Quantity.Neg()
	default:
		return *t.Quantity
	}
}

// GetSignedAmount returns the amount with appropriate sign
func (t *Transaction) GetSignedAmount() Money {
	return t.Amount
}

// IsCapitalGainsTransaction returns true if this transaction affects capital gains
func (t *Transaction) IsCapitalGainsTransaction() bool {
	return t.Type == TransactionTypeSell
}

// IsCashFlowTransaction returns true if this transaction affects cash flow
func (t *Transaction) IsCashFlowTransaction() bool {
	switch t.Type {
	case TransactionTypeDeposit, TransactionTypeWithdrawal,
		TransactionTypeTransferIn, TransactionTypeTransferOut,
		TransactionTypeDividend, TransactionTypeInterest, TransactionTypeFee:
		return true
	}
	return false
}

// CalculateNetAmount returns the net amount including fees
func (t *Transaction) CalculateNetAmount() Money {
	switch t.Type {
	case TransactionTypeBuy, TransactionTypeDeposit, TransactionTypeTransferIn:
		return t.Amount - t.FeesAmount // Reduce positive amounts by fees
	case TransactionTypeSell, TransactionTypeWithdrawal, TransactionTypeTransferOut:
		return t.Amount - t.FeesAmount // Fees reduce the net proceeds
	default:
		return t.Amount
	}
}

// GetTaxLotInfo returns information for tax lot tracking
func (t *Transaction) GetTaxLotInfo() *TaxLotInfo {
	if !t.Type.RequiresQuantity() || t.Quantity == nil || t.UnitPriceAmount == nil {
		return nil
	}

	return &TaxLotInfo{
		TransactionID:   t.ID,
		ExecutedAt:      t.ExecutedAt,
		Quantity:        *t.Quantity,
		UnitPriceAmount: *t.UnitPriceAmount,
		TransactionType: t.Type,
	}
}

// TaxLotInfo represents information for tax lot tracking
type TaxLotInfo struct {
	TransactionID   string          `json:"transaction_id"`
	ExecutedAt      time.Time       `json:"executed_at"`
	Quantity        decimal.Decimal `json:"quantity"`
	UnitPriceAmount decimal.Decimal `json:"unit_price_amount"`
	TransactionType TransactionType `json:"transaction_type"`
}

// Implement Entity interface
func (t Transaction) GetID() string           { return t.ID }
func (t *Transaction) SetID(id string)        { t.ID = id }
func (t Transaction) GetCreatedAt() time.Time { return t.CreatedAt }
func (t *Transaction) SetCreatedAt(time.Time) {} // No UpdatedAt field
func (t Transaction) GetUpdatedAt() time.Time { return time.Time{} }
func (t *Transaction) SetUpdatedAt(time.Time) {} // No UpdatedAt field
