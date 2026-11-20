package model_test

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
)

func TestBlockchainNetwork_IsValid(t *testing.T) {
	validNetworks := []model.BlockchainNetwork{
		model.BlockchainNetworkEthereum,
		model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum,
		model.BlockchainNetworkOptimism,
		model.BlockchainNetworkPolygon,
		model.BlockchainNetworkSolana,
		model.BlockchainNetworkBitcoin,
	}

	for _, net := range validNetworks {
		assert.True(t, net.IsValid(), "expected %s to be valid", net)
	}

	assert.False(t, model.BlockchainNetwork("DOGE").IsValid())
	assert.False(t, model.BlockchainNetwork("").IsValid())
}

func TestWalletAccount_Validate(t *testing.T) {
	tests := []struct {
		name    string
		account model.WalletAccount
		wantErr bool
	}{
		{
			name: "valid EVM address",
			account: model.WalletAccount{
				UserID:        "user-1",
				Network:       model.BlockchainNetworkEthereum,
				AddressOrXpub: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			},
			wantErr: false,
		},
		{
			name: "invalid EVM address (short)",
			account: model.WalletAccount{
				UserID:        "user-1",
				Network:       model.BlockchainNetworkEthereum,
				AddressOrXpub: "0x123",
			},
			wantErr: true,
		},
		{
			name: "valid Solana address",
			account: model.WalletAccount{
				UserID:        "user-1",
				Network:       model.BlockchainNetworkSolana,
				AddressOrXpub: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
			},
			wantErr: false,
		},
		{
			name: "valid Bitcoin Bech32 address",
			account: model.WalletAccount{
				UserID:        "user-1",
				Network:       model.BlockchainNetworkBitcoin,
				AddressOrXpub: "bc1qwfgdjyy95aay2686fn74h6a4nu9eev6np7q4fn204dkj3274frlqrskvx0",
			},
			wantErr: false,
		},
		{
			name: "valid Bitcoin xpub",
			account: model.WalletAccount{
				UserID:        "user-1",
				Network:       model.BlockchainNetworkBitcoin,
				AddressOrXpub: "xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFEh73bCX27DeNVksux55LE29JKBma442fcx138eLurPNgB",
				IsXpub:        true,
			},
			wantErr: false,
		},
		{
			name: "missing user ID",
			account: model.WalletAccount{
				Network:       model.BlockchainNetworkEthereum,
				AddressOrXpub: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			},
			wantErr: true,
		},
		{
			name: "invalid network",
			account: model.WalletAccount{
				UserID:        "user-1",
				Network:       model.BlockchainNetwork("UNKNOWN"),
				AddressOrXpub: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.account.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestWalletBalance_ConversionAndSpam(t *testing.T) {
	bal := model.WalletBalance{
		WalletAccountID:   "wacc-1",
		Symbol:            "USDC",
		Decimals:          6,
		RawBalance:        "1500000000", // 1500 USDC
		FormattedQuantity: decimal.NewFromFloat(1500.0),
		IsSpam:            false,
		IsHidden:          false,
	}

	assert.Equal(t, "1500000000", bal.RawBalance)
	assert.True(t, bal.FormattedQuantity.Equal(decimal.NewFromFloat(1500)))

	// Test 18-decimal wei formatting
	weiBal := model.NewWalletBalanceFromRaw("wacc-1", "ETH", "Ethereum", 18, "5000000000000000000", nil, false)
	assert.Equal(t, "5000000000000000000", weiBal.RawBalance)
	assert.True(t, weiBal.FormattedQuantity.Equal(decimal.NewFromFloat(5.0)))
}

func TestWalletCUTracking_Throttle(t *testing.T) {
	cu := model.WalletCUTracking{
		BillingMonth:         "2026-10",
		ComputeUnitsConsumed: 24000001, // > 24M (80% of 30M)
		IsThrottled:          false,
		UpdatedAt:            time.Now(),
	}

	assert.True(t, cu.ShouldThrottle(30000000, 0.80))
}
