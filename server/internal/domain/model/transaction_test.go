package model

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

func TestTransactionType_IsValid(t *testing.T) {
	tests := []struct {
		transactionType TransactionType
		expected        bool
	}{
		{TransactionTypeBuy, true},
		{TransactionTypeSell, true},
		{TransactionTypeDeposit, true},
		{TransactionTypeWithdrawal, true},
		{TransactionTypeTransferIn, true},
		{TransactionTypeTransferOut, true},
		{TransactionTypeDividend, true},
		{TransactionTypeInterest, true},
		{TransactionTypeFee, true},
		{TransactionTypeAdjustment, true},
		{TransactionType("INVALID"), false},
		{TransactionType(""), false},
	}

	for _, tt := range tests {
		t.Run(string(tt.transactionType), func(t *testing.T) {
			if got := tt.transactionType.IsValid(); got != tt.expected {
				t.Errorf("TransactionType.IsValid() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestTransactionType_RequiresQuantity(t *testing.T) {
	tests := []struct {
		transactionType TransactionType
		expected        bool
	}{
		{TransactionTypeBuy, true},
		{TransactionTypeSell, true},
		{TransactionTypeDeposit, false},
		{TransactionTypeWithdrawal, false},
		{TransactionTypeDividend, false},
		{TransactionTypeInterest, false},
		{TransactionTypeFee, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.transactionType), func(t *testing.T) {
			if got := tt.transactionType.RequiresQuantity(); got != tt.expected {
				t.Errorf("TransactionType.RequiresQuantity() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestTransaction_Validate(t *testing.T) {
	userID := uuid.New().String()
	positionID := uuid.New().String()
	now := time.Now()

	tests := []struct {
		name        string
		transaction *Transaction
		wantErr     bool
		errMsg      string
	}{
		{
			name: "valid buy transaction",
			transaction: &Transaction{
				ID:              uuid.New().String(),
				UserID:          userID,
				PositionID:      &positionID,
				Type:            TransactionTypeBuy,
				Amount:          Money(5000), // 100 * $0.50 = $50.00 = 5000 cents
				Quantity:        decimalPtr(decimal.NewFromFloat(100.0)),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(0.50)),
				FeesAmount:      Money(0),
				ExecutedAt:      now,
				CreatedAt:       now,
			},
			wantErr: false,
		},
		{
			name: "valid sell transaction",
			transaction: &Transaction{
				ID:              uuid.New().String(),
				UserID:          userID,
				PositionID:      &positionID,
				Type:            TransactionTypeSell,
				Amount:          Money(-3000), // 50 * $0.60 = $30.00 = 3000 cents (negative for sale)
				Quantity:        decimalPtr(decimal.NewFromFloat(50.0)),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(0.60)),
				FeesAmount:      Money(0),
				ExecutedAt:      now,
				CreatedAt:       now,
			},
			wantErr: false,
		},
		{
			name: "valid deposit transaction",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				UserID:     userID,
				Type:       TransactionTypeDeposit,
				Amount:     Money(10000), // $100.00
				FeesAmount: Money(0),
				ExecutedAt: now,
				CreatedAt:  now,
			},
			wantErr: false,
		},
		{
			name: "invalid transaction - missing user ID",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				Type:       TransactionTypeBuy,
				Amount:     Money(5000),
				ExecutedAt: now,
				CreatedAt:  now,
			},
			wantErr: true,
			errMsg:  "user ID is required",
		},
		{
			name: "invalid transaction - invalid type",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				UserID:     userID,
				Type:       TransactionType("INVALID"),
				Amount:     Money(5000),
				ExecutedAt: now,
				CreatedAt:  now,
			},
			wantErr: true,
			errMsg:  "invalid transaction type: INVALID",
		},
		{
			name: "invalid transaction - zero amount",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				UserID:     userID,
				Type:       TransactionTypeBuy,
				Amount:     Money(0),
				ExecutedAt: now,
				CreatedAt:  now,
			},
			wantErr: true,
			errMsg:  "transaction amount cannot be zero",
		},
		{
			name: "invalid buy - missing quantity",
			transaction: &Transaction{
				ID:              uuid.New().String(),
				UserID:          userID,
				PositionID:      &positionID,
				Type:            TransactionTypeBuy,
				Amount:          Money(5000),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(50.0)),
				ExecutedAt:      now,
				CreatedAt:       now,
			},
			wantErr: true,
			errMsg:  "quantity is required for transaction type BUY",
		},
		{
			name: "invalid buy - missing price",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				UserID:     userID,
				PositionID: &positionID,
				Type:       TransactionTypeBuy,
				Amount:     Money(5000),
				Quantity:   decimalPtr(decimal.NewFromFloat(100.0)),
				ExecutedAt: now,
				CreatedAt:  now,
			},
			wantErr: true,
			errMsg:  "price per unit is required for transaction type BUY",
		},
		{
			name: "invalid buy - wrong amount sign",
			transaction: &Transaction{
				ID:              uuid.New().String(),
				UserID:          userID,
				PositionID:      &positionID,
				Type:            TransactionTypeBuy,
				Amount:          Money(-5000), // Should be positive for buy
				Quantity:        decimalPtr(decimal.NewFromFloat(100.0)),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(50.0)),
				ExecutedAt:      now,
				CreatedAt:       now,
			},
			wantErr: true,
			errMsg:  "transaction type BUY should have positive amount",
		},
		{
			name: "invalid sell - wrong amount sign",
			transaction: &Transaction{
				ID:              uuid.New().String(),
				UserID:          userID,
				PositionID:      &positionID,
				Type:            TransactionTypeSell,
				Amount:          Money(3000), // Should be negative for sell
				Quantity:        decimalPtr(decimal.NewFromFloat(50.0)),
				UnitPriceAmount: decimalPtr(decimal.NewFromFloat(60.0)),
				ExecutedAt:      now,
				CreatedAt:       now,
			},
			wantErr: true,
			errMsg:  "transaction type SELL should have negative amount",
		},
		{
			name: "invalid - negative fee",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				UserID:     userID,
				Type:       TransactionTypeDeposit,
				Amount:     Money(10000),
				FeesAmount: Money(-100), // Negative fee
				ExecutedAt: now,
				CreatedAt:  now,
			},
			wantErr: true,
			errMsg:  "transaction fee cannot be negative",
		},
		{
			name: "invalid - future date",
			transaction: &Transaction{
				ID:         uuid.New().String(),
				UserID:     userID,
				Type:       TransactionTypeDeposit,
				Amount:     Money(10000),
				FeesAmount: Money(0),
				ExecutedAt: now.AddDate(0, 0, 2), // 2 days in future
				CreatedAt:  now,
			},
			wantErr: true,
			errMsg:  "transaction date cannot be in the future",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.transaction.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Transaction.Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err.Error() != tt.errMsg {
				t.Errorf("Transaction.Validate() error = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestTransaction_GetSignedQuantity(t *testing.T) {
	tests := []struct {
		name        string
		transaction *Transaction
		expected    decimal.Decimal
	}{
		{
			name: "buy transaction",
			transaction: &Transaction{
				Type:     TransactionTypeBuy,
				Quantity: decimalPtr(decimal.NewFromFloat(100.0)),
			},
			expected: decimal.NewFromFloat(100.0),
		},
		{
			name: "sell transaction",
			transaction: &Transaction{
				Type:     TransactionTypeSell,
				Quantity: decimalPtr(decimal.NewFromFloat(50.0)),
			},
			expected: decimal.NewFromFloat(-50.0),
		},
		{
			name: "deposit transaction (no quantity)",
			transaction: &Transaction{
				Type: TransactionTypeDeposit,
			},
			expected: decimal.Zero,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.transaction.GetSignedQuantity()
			if !result.Equal(tt.expected) {
				t.Errorf("GetSignedQuantity() = %s, want %s", result.String(), tt.expected.String())
			}
		})
	}
}

func TestTransaction_CalculateNetAmount(t *testing.T) {
	tests := []struct {
		name        string
		transaction *Transaction
		expected    Money
	}{
		{
			name: "buy with fee",
			transaction: &Transaction{
				Type:       TransactionTypeBuy,
				Amount:     Money(5000),
				FeesAmount: Money(50),
			},
			expected: Money(4950), // 5000 - 50
		},
		{
			name: "sell with fee",
			transaction: &Transaction{
				Type:       TransactionTypeSell,
				Amount:     Money(-3000),
				FeesAmount: Money(50),
			},
			expected: Money(-3050), // -3000 - 50
		},
		{
			name: "dividend (no fee adjustment)",
			transaction: &Transaction{
				Type:       TransactionTypeDividend,
				Amount:     Money(200),
				FeesAmount: Money(0),
			},
			expected: Money(200),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.transaction.CalculateNetAmount()
			if result != tt.expected {
				t.Errorf("CalculateNetAmount() = %d, want %d", result, tt.expected)
			}
		})
	}
}

func TestTransaction_IsCapitalGainsTransaction(t *testing.T) {
	tests := []struct {
		transactionType TransactionType
		expected        bool
	}{
		{TransactionTypeBuy, false},
		{TransactionTypeSell, true},
		{TransactionTypeDeposit, false},
		{TransactionTypeDividend, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.transactionType), func(t *testing.T) {
			transaction := &Transaction{Type: tt.transactionType}
			if got := transaction.IsCapitalGainsTransaction(); got != tt.expected {
				t.Errorf("IsCapitalGainsTransaction() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestTransaction_IsCashFlowTransaction(t *testing.T) {
	tests := []struct {
		transactionType TransactionType
		expected        bool
	}{
		{TransactionTypeBuy, false},
		{TransactionTypeSell, false},
		{TransactionTypeDeposit, true},
		{TransactionTypeWithdrawal, true},
		{TransactionTypeDividend, true},
		{TransactionTypeInterest, true},
		{TransactionTypeFee, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.transactionType), func(t *testing.T) {
			transaction := &Transaction{Type: tt.transactionType}
			if got := transaction.IsCashFlowTransaction(); got != tt.expected {
				t.Errorf("IsCashFlowTransaction() = %v, want %v", got, tt.expected)
			}
		})
	}
}
