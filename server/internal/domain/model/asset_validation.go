package model

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/shopspring/decimal"
)

// AssetValidationRules contains business rules for asset validation
type AssetValidationRules struct{}

// NewAssetValidationRules creates a new instance of asset validation rules
func NewAssetValidationRules() *AssetValidationRules {
	return &AssetValidationRules{}
}

// ValidateAssetForType validates asset data based on its type
func (avr *AssetValidationRules) ValidateAssetForType(asset *Asset) error {
	if asset == nil {
		return errors.New("asset cannot be nil")
	}

	switch asset.Type {
	case AssetTypeStock:
		return avr.validateStockAsset(asset)
	case AssetTypeCrypto:
		return avr.validateCryptoAsset(asset)
	case AssetTypeBankAccount:
		return avr.validateBankAccountAsset(asset)
	case AssetTypeRealEstate:
		return avr.validateRealEstateAsset(asset)
	case AssetTypeLifeInsurance:
		return avr.validateLifeInsuranceAsset(asset)
	case AssetTypeWatch:
		return avr.validateWatchAsset(asset)
	case AssetTypeLoan:
		return avr.validateLoanAsset(asset)
	case AssetTypeOtherValuable:
		return avr.validateOtherValuableAsset(asset)
	default:
		return fmt.Errorf("unsupported asset type: %s", asset.Type)
	}
}

// validateStockAsset validates stock-specific business rules
func (avr *AssetValidationRules) validateStockAsset(asset *Asset) error {
	// Stock must have a symbol
	if asset.Symbol == nil || *asset.Symbol == "" {
		return errors.New("stock assets must have a symbol")
	}

	// Validate symbol format (1-5 uppercase letters)
	symbol := strings.TrimSpace(strings.ToUpper(*asset.Symbol))
	if matched, _ := regexp.MatchString(`^[A-Z]{1,5}$`, symbol); !matched {
		return errors.New("stock symbol must be 1-5 uppercase letters")
	}

	// Update the symbol to ensure it's uppercase and set tradeable
	asset.Symbol = &symbol
	asset.IsTradeable = true

	return nil
}

// validateCryptoAsset validates cryptocurrency-specific business rules
func (avr *AssetValidationRules) validateCryptoAsset(asset *Asset) error {
	// Crypto must have a symbol
	if asset.Symbol == nil || *asset.Symbol == "" {
		return errors.New("cryptocurrency assets must have a symbol")
	}

	// Validate symbol format (2-10 uppercase letters and numbers)
	symbol := strings.TrimSpace(strings.ToUpper(*asset.Symbol))
	if matched, _ := regexp.MatchString(`^[A-Z0-9]{2,10}$`, symbol); !matched {
		return errors.New("crypto symbol must be 2-10 uppercase letters and numbers")
	}

	// Update the symbol to ensure it's uppercase and set tradeable
	asset.Symbol = &symbol
	asset.IsTradeable = true

	return nil
}

// validateBankAccountAsset validates bank account-specific business rules
func (avr *AssetValidationRules) validateBankAccountAsset(asset *Asset) error {
	// Clear symbol and market data source, set not tradeable
	asset.Symbol = nil
	asset.MarketDataSource = nil
	asset.IsTradeable = false

	return nil
}

// validateRealEstateAsset validates real estate-specific business rules
func (avr *AssetValidationRules) validateRealEstateAsset(asset *Asset) error {
	// Clear symbol and market data source, set not tradeable
	asset.Symbol = nil
	asset.MarketDataSource = nil
	asset.IsTradeable = false

	return nil
}

// validateLifeInsuranceAsset validates life insurance-specific business rules
func (avr *AssetValidationRules) validateLifeInsuranceAsset(asset *Asset) error {
	// Clear symbol and market data source, set not tradeable
	asset.Symbol = nil
	asset.MarketDataSource = nil
	asset.IsTradeable = false

	return nil
}

// validateWatchAsset validates watch-specific business rules
func (avr *AssetValidationRules) validateWatchAsset(asset *Asset) error {
	// Clear symbol and market data source, set not tradeable
	asset.Symbol = nil
	asset.MarketDataSource = nil
	asset.IsTradeable = false

	return nil
}

// validateLoanAsset validates loan-specific business rules
func (avr *AssetValidationRules) validateLoanAsset(asset *Asset) error {
	// Clear symbol and market data source, set not tradeable
	asset.Symbol = nil
	asset.MarketDataSource = nil
	asset.IsTradeable = false

	return nil
}

// validateOtherValuableAsset validates other valuable-specific business rules
func (avr *AssetValidationRules) validateOtherValuableAsset(asset *Asset) error {
	// Clear symbol and market data source, set not tradeable
	asset.Symbol = nil
	asset.MarketDataSource = nil
	asset.IsTradeable = false

	return nil
}

// PositionValidationRules contains business rules for position validation
type PositionValidationRules struct{}

// NewPositionValidationRules creates a new instance of position validation rules
func NewPositionValidationRules() *PositionValidationRules {
	return &PositionValidationRules{}
}

// ValidateOwnershipPercentages validates that ownership percentages for shared assets don't exceed 100%
func (pvr *PositionValidationRules) ValidateOwnershipPercentages(positions []*Position) error {
	if len(positions) == 0 {
		return nil
	}

	// Group positions by asset
	assetPositions := make(map[string][]*Position)
	for _, pos := range positions {
		assetID := pos.AssetID
		assetPositions[assetID] = append(assetPositions[assetID], pos)
	}

	// Check each asset's total ownership
	for assetID, assetPos := range assetPositions {
		totalOwnership := decimal.Zero
		for _, pos := range assetPos {
			totalOwnership = totalOwnership.Add(pos.OwnershipPercentage)
		}

		if totalOwnership.GreaterThan(decimal.NewFromInt(100)) {
			return fmt.Errorf("total ownership percentage for asset %s exceeds 100%% (current: %s%%)",
				assetID, totalOwnership.String())
		}
	}

	return nil
}

// ValidatePositionQuantity validates position quantity based on asset type
func (pvr *PositionValidationRules) ValidatePositionQuantity(position *Position, asset *Asset) error {
	if position == nil || asset == nil {
		return errors.New("position and asset cannot be nil")
	}

	switch asset.Type {
	case AssetTypeStock, AssetTypeCrypto:
		// Tradeable assets can have fractional quantities
		if position.Quantity.IsNegative() {
			return errors.New("quantity cannot be negative for tradeable assets")
		}
	case AssetTypeBankAccount:
		// Bank accounts typically don't use quantity, but if they do, it should be 1
		if !position.Quantity.IsZero() && !position.Quantity.Equal(decimal.NewFromInt(1)) {
			return errors.New("bank account quantity should be 0 or 1")
		}
	case AssetTypeRealEstate, AssetTypeLifeInsurance, AssetTypeWatch, AssetTypeLoan, AssetTypeOtherValuable:
		// Non-tradeable assets typically have quantity of 1 or use ownership percentage
		if position.Quantity.IsNegative() {
			return errors.New("quantity cannot be negative")
		}
		// Allow fractional quantities for partial ownership scenarios
	}

	return nil
}

// TransactionValidationRules contains business rules for transaction validation
type TransactionValidationRules struct{}

// NewTransactionValidationRules creates a new instance of transaction validation rules
func NewTransactionValidationRules() *TransactionValidationRules {
	return &TransactionValidationRules{}
}

// ValidateTransactionForAssetType validates transaction based on asset type
func (tvr *TransactionValidationRules) ValidateTransactionForAssetType(transaction *Transaction, asset *Asset) error {
	if transaction == nil || asset == nil {
		return errors.New("transaction and asset cannot be nil")
	}

	switch asset.Type {
	case AssetTypeStock, AssetTypeCrypto:
		return tvr.validateTradeableAssetTransaction(transaction, asset)
	case AssetTypeBankAccount:
		return tvr.validateBankAccountTransaction(transaction, asset)
	case AssetTypeRealEstate, AssetTypeLifeInsurance, AssetTypeWatch, AssetTypeLoan, AssetTypeOtherValuable:
		return tvr.validateNonTradeableAssetTransaction(transaction, asset)
	default:
		return fmt.Errorf("unsupported asset type for transaction: %s", asset.Type)
	}
}

// validateTradeableAssetTransaction validates transactions for tradeable assets
func (tvr *TransactionValidationRules) validateTradeableAssetTransaction(transaction *Transaction, asset *Asset) error {
	switch transaction.Type {
	case TransactionTypeBuy, TransactionTypeSell:
		// Buy/sell transactions must have quantity and price
		if transaction.Quantity == nil || transaction.Quantity.IsZero() {
			return fmt.Errorf("quantity is required for %s transactions", transaction.Type)
		}
		if transaction.PricePerUnit == nil || transaction.PricePerUnit.IsZero() {
			return fmt.Errorf("price per unit is required for %s transactions", transaction.Type)
		}
	case TransactionTypeDividend, TransactionTypeInterest:
		// Dividend/interest transactions should not have quantity or price
		if transaction.Quantity != nil && !transaction.Quantity.IsZero() {
			return fmt.Errorf("quantity should not be specified for %s transactions", transaction.Type)
		}
		if transaction.PricePerUnit != nil && !transaction.PricePerUnit.IsZero() {
			return fmt.Errorf("price per unit should not be specified for %s transactions", transaction.Type)
		}
	case TransactionTypeFee:
		// Fee transactions are allowed for tradeable assets
	default:
		return fmt.Errorf("transaction type %s is not valid for tradeable assets", transaction.Type)
	}

	return nil
}

// validateBankAccountTransaction validates transactions for bank accounts
func (tvr *TransactionValidationRules) validateBankAccountTransaction(transaction *Transaction, asset *Asset) error {
	switch transaction.Type {
	case TransactionTypeDeposit, TransactionTypeWithdrawal, TransactionTypeInterest, TransactionTypeFee:
		// These are valid for bank accounts
		// Should not have quantity or price
		if transaction.Quantity != nil && !transaction.Quantity.IsZero() {
			return fmt.Errorf("quantity should not be specified for bank account %s transactions", transaction.Type)
		}
		if transaction.PricePerUnit != nil && !transaction.PricePerUnit.IsZero() {
			return fmt.Errorf("price per unit should not be specified for bank account %s transactions", transaction.Type)
		}
	case TransactionTypeTransferIn, TransactionTypeTransferOut:
		// Transfers between accounts are allowed
	case TransactionTypeAdjustment:
		// Adjustments are allowed for correcting balances
	default:
		return fmt.Errorf("transaction type %s is not valid for bank accounts", transaction.Type)
	}

	return nil
}

// validateNonTradeableAssetTransaction validates transactions for non-tradeable assets
func (tvr *TransactionValidationRules) validateNonTradeableAssetTransaction(transaction *Transaction, asset *Asset) error {
	switch transaction.Type {
	case TransactionTypeBuy, TransactionTypeSell:
		// Buy/sell for non-tradeable assets (like real estate purchases)
		// May or may not have quantity, but should have amount
		if transaction.PricePerUnit != nil && transaction.Quantity != nil {
			// If both are specified, validate consistency
			expectedAmount := transaction.Quantity.Mul(*transaction.PricePerUnit).Mul(decimal.NewFromInt(100))
			actualAmount := decimal.NewFromInt(int64(transaction.Amount.Abs()))
			tolerance := decimal.NewFromInt(100) // 1 dollar tolerance
			if expectedAmount.Sub(actualAmount).Abs().GreaterThan(tolerance) {
				return errors.New("amount does not match quantity * price for non-tradeable asset")
			}
		}
	case TransactionTypeAdjustment:
		// Adjustments are allowed for correcting valuations
	case TransactionTypeFee:
		// Fees are allowed (maintenance, insurance, etc.)
	default:
		return fmt.Errorf("transaction type %s is not valid for %s assets", transaction.Type, asset.Type)
	}

	return nil
}

// ValidateInsufficientQuantity validates that a sell transaction doesn't exceed available quantity
func (tvr *TransactionValidationRules) ValidateInsufficientQuantity(transaction *Transaction, currentQuantity decimal.Decimal) error {
	if transaction.Type != TransactionTypeSell {
		return nil // Only validate for sell transactions
	}

	if transaction.Quantity == nil {
		return errors.New("sell transaction must have quantity")
	}

	if transaction.Quantity.GreaterThan(currentQuantity) {
		return fmt.Errorf("insufficient quantity: trying to sell %s but only %s available",
			transaction.Quantity.String(), currentQuantity.String())
	}

	return nil
}
