package model

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

func TestAssetValidationRules_ValidateAssetForType(t *testing.T) {
	rules := NewAssetValidationRules()

	tests := []struct {
		name    string
		asset   *Asset
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid stock asset",
			asset: &Asset{
				ID:          uuid.New().String(),
				Type:        AssetTypeStock,
				Symbol:      stringPtr("AAPL"),
				Name:        "Apple Inc.",
				IsTradeable: false, // Will be set to true by validation
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
			wantErr: false,
		},
		{
			name: "valid crypto asset",
			asset: &Asset{
				ID:          uuid.New().String(),
				Type:        AssetTypeCrypto,
				Symbol:      stringPtr("BTC"),
				Name:        "Bitcoin",
				IsTradeable: false, // Will be set to true by validation
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
			wantErr: false,
		},
		{
			name: "valid bank account asset",
			asset: &Asset{
				ID:          uuid.New().String(),
				Type:        AssetTypeBankAccount,
				Name:        "Chase Checking",
				Symbol:      stringPtr("CHASE"), // Will be cleared by validation
				IsTradeable: true,               // Will be set to false by validation
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
			wantErr: false,
		},
		{
			name: "invalid stock - missing symbol",
			asset: &Asset{
				ID:        uuid.New().String(),
				Type:      AssetTypeStock,
				Name:      "Apple Inc.",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: true,
			errMsg:  "stock assets must have a symbol",
		},
		{
			name: "invalid crypto - missing symbol",
			asset: &Asset{
				ID:        uuid.New().String(),
				Type:      AssetTypeCrypto,
				Name:      "Bitcoin",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			wantErr: true,
			errMsg:  "cryptocurrency assets must have a symbol",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rules.ValidateAssetForType(tt.asset)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAssetForType() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("ValidateAssetForType() error = %v, want %v", err.Error(), tt.errMsg)
			}

			// Check that validation sets correct properties
			if !tt.wantErr {
				switch tt.asset.Type {
				case AssetTypeStock, AssetTypeCrypto:
					if !tt.asset.IsTradeable {
						t.Errorf("Expected tradeable asset to have IsTradeable=true")
					}
					if tt.asset.Symbol == nil {
						t.Errorf("Expected tradeable asset to have symbol")
					}
				case AssetTypeBankAccount, AssetTypeRealEstate, AssetTypeLifeInsurance, AssetTypeWatch, AssetTypeOtherValuable:
					if tt.asset.IsTradeable {
						t.Errorf("Expected non-tradeable asset to have IsTradeable=false")
					}
					if tt.asset.Symbol != nil {
						t.Errorf("Expected non-tradeable asset to have nil symbol")
					}
				}
			}
		})
	}
}

func TestPositionValidationRules_ValidateOwnershipPercentages(t *testing.T) {
	rules := NewPositionValidationRules()
	assetID := uuid.New().String()

	tests := []struct {
		name      string
		positions []*Position
		wantErr   bool
		errMsg    string
	}{
		{
			name: "valid single position",
			positions: []*Position{
				{
					ID:                  uuid.New().String(),
					PortfolioID:         uuid.New().String(),
					AssetID:             assetID,
					Quantity:            decimal.NewFromFloat(100.0),
					OwnershipPercentage: decimal.NewFromFloat(100.0),
				},
			},
			wantErr: false,
		},
		{
			name: "valid multiple positions under 100%",
			positions: []*Position{
				{
					ID:                  uuid.New().String(),
					PortfolioID:         uuid.New().String(),
					AssetID:             assetID,
					Quantity:            decimal.NewFromFloat(50.0),
					OwnershipPercentage: decimal.NewFromFloat(60.0),
				},
				{
					ID:                  uuid.New().String(),
					PortfolioID:         uuid.New().String(),
					AssetID:             assetID,
					Quantity:            decimal.NewFromFloat(30.0),
					OwnershipPercentage: decimal.NewFromFloat(40.0),
				},
			},
			wantErr: false,
		},
		{
			name: "invalid - ownership exceeds 100%",
			positions: []*Position{
				{
					ID:                  uuid.New().String(),
					PortfolioID:         uuid.New().String(),
					AssetID:             assetID,
					Quantity:            decimal.NewFromFloat(50.0),
					OwnershipPercentage: decimal.NewFromFloat(70.0),
				},
				{
					ID:                  uuid.New().String(),
					PortfolioID:         uuid.New().String(),
					AssetID:             assetID,
					Quantity:            decimal.NewFromFloat(30.0),
					OwnershipPercentage: decimal.NewFromFloat(50.0),
				},
			},
			wantErr: true,
			errMsg:  "total ownership percentage for asset " + assetID + " exceeds 100% (current: 120%)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rules.ValidateOwnershipPercentages(tt.positions)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateOwnershipPercentages() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("ValidateOwnershipPercentages() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestPositionValidationRules_ValidatePositionQuantity(t *testing.T) {
	rules := NewPositionValidationRules()

	tests := []struct {
		name     string
		position *Position
		asset    *Asset
		wantErr  bool
		errMsg   string
	}{
		{
			name: "valid stock position",
			position: &Position{
				Quantity: decimal.NewFromFloat(100.5),
			},
			asset: &Asset{
				Type: AssetTypeStock,
			},
			wantErr: false,
		},
		{
			name: "valid bank account position",
			position: &Position{
				Quantity: decimal.NewFromFloat(1.0),
			},
			asset: &Asset{
				Type: AssetTypeBankAccount,
			},
			wantErr: false,
		},
		{
			name: "invalid - negative quantity",
			position: &Position{
				Quantity: decimal.NewFromFloat(-10.0),
			},
			asset: &Asset{
				Type: AssetTypeStock,
			},
			wantErr: true,
			errMsg:  "quantity cannot be negative for tradeable assets",
		},
		{
			name: "invalid bank account - wrong quantity",
			position: &Position{
				Quantity: decimal.NewFromFloat(5.0),
			},
			asset: &Asset{
				Type: AssetTypeBankAccount,
			},
			wantErr: true,
			errMsg:  "bank account quantity should be 0 or 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rules.ValidatePositionQuantity(tt.position, tt.asset)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePositionQuantity() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("ValidatePositionQuantity() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestTransactionValidationRules_ValidateTransactionForAssetType(t *testing.T) {
	rules := NewTransactionValidationRules()

	tests := []struct {
		name        string
		transaction *Transaction
		asset       *Asset
		wantErr     bool
		errMsg      string
	}{
		{
			name: "valid stock buy transaction",
			transaction: &Transaction{
				Type:            TransactionTypeBuy,
				Quantity:        decimalPtr(decimal.NewFromFloat(100.0)),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(0.50)),
			},
			asset: &Asset{
				Type: AssetTypeStock,
			},
			wantErr: false,
		},
		{
			name: "valid bank deposit transaction",
			transaction: &Transaction{
				Type: TransactionTypeDeposit,
			},
			asset: &Asset{
				Type: AssetTypeBankAccount,
			},
			wantErr: false,
		},
		{
			name: "invalid - stock buy without quantity",
			transaction: &Transaction{
				Type:            TransactionTypeBuy,
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(0.50)),
			},
			asset: &Asset{
				Type: AssetTypeStock,
			},
			wantErr: true,
			errMsg:  "quantity is required for BUY transactions",
		},
		{
			name: "invalid - bank account buy transaction",
			transaction: &Transaction{
				Type:            TransactionTypeBuy,
				Quantity:        decimalPtr(decimal.NewFromFloat(100.0)),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(0.50)),
			},
			asset: &Asset{
				Type: AssetTypeBankAccount,
			},
			wantErr: true,
			errMsg:  "transaction type BUY is not valid for bank accounts",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rules.ValidateTransactionForAssetType(tt.transaction, tt.asset)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateTransactionForAssetType() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("ValidateTransactionForAssetType() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestTransactionValidationRules_ValidateInsufficientQuantity(t *testing.T) {
	rules := NewTransactionValidationRules()

	tests := []struct {
		name            string
		transaction     *Transaction
		currentQuantity decimal.Decimal
		wantErr         bool
		errMsg          string
	}{
		{
			name: "valid sell - sufficient quantity",
			transaction: &Transaction{
				Type:     TransactionTypeSell,
				Quantity: decimalPtr(decimal.NewFromFloat(50.0)),
			},
			currentQuantity: decimal.NewFromFloat(100.0),
			wantErr:         false,
		},
		{
			name: "invalid sell - insufficient quantity",
			transaction: &Transaction{
				Type:     TransactionTypeSell,
				Quantity: decimalPtr(decimal.NewFromFloat(150.0)),
			},
			currentQuantity: decimal.NewFromFloat(100.0),
			wantErr:         true,
			errMsg:          "insufficient quantity: trying to sell 150 but only 100 available",
		},
		{
			name: "non-sell transaction - no validation",
			transaction: &Transaction{
				Type:     TransactionTypeBuy,
				Quantity: decimalPtr(decimal.NewFromFloat(150.0)),
			},
			currentQuantity: decimal.NewFromFloat(100.0),
			wantErr:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := rules.ValidateInsufficientQuantity(tt.transaction, tt.currentQuantity)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateInsufficientQuantity() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("ValidateInsufficientQuantity() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}
