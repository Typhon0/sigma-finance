package blockchain

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
)

func TestActivityClassifier_SwapDetection(t *testing.T) {
	classifier := NewActivityClassifier()
	userAddr := "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

	account := &model.WalletAccount{
		ID:            "wacc-1",
		UserID:        "user-1",
		AddressOrXpub: userAddr,
		Network:       model.BlockchainNetworkEthereum,
	}

	// 1 Outgoing token (WETH) and 1 Incoming token (USDC) with same TxHash
	txHash := "0xabc123456789"
	wethAddr := "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
	usdcAddr := "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

	activities := []*model.WalletActivity{
		{
			ID:              "act-1",
			WalletAccountID: "wacc-1",
			TxHash:          txHash,
			FromAddress:     userAddr,
			ToAddress:       "0xUniswapPool",
			TokenAddress:    &wethAddr,
			FormattedAmount: decimal.NewFromFloat(1.0), // 1 WETH out
			ExecutedAt:      time.Now().UTC(),
		},
		{
			ID:              "act-2",
			WalletAccountID: "wacc-1",
			TxHash:          txHash,
			FromAddress:     "0xUniswapPool",
			ToAddress:       userAddr,
			TokenAddress:    &usdcAddr,
			FormattedAmount: decimal.NewFromFloat(3200.0), // 3200 USDC in
			ExecutedAt:      time.Now().UTC(),
		},
	}

	result, err := classifier.Classify(context.Background(), account, activities, nil)
	assert.NoError(t, err)

	assert.Len(t, result.Transactions, 2, "expected 1 SELL and 1 BUY transaction")
	assert.Equal(t, model.TransactionTypeSell, result.Transactions[0].Type)
	assert.True(t, result.Transactions[0].Quantity.Equal(decimal.NewFromFloat(1.0)))

	assert.Equal(t, model.TransactionTypeBuy, result.Transactions[1].Type)
	assert.True(t, result.Transactions[1].Quantity.Equal(decimal.NewFromFloat(3200.0)))
}

func TestActivityClassifier_InternalTransfer(t *testing.T) {
	classifier := NewActivityClassifier()
	wallet1 := "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
	wallet2 := "0x1111111111111111111111111111111111111111"

	account := &model.WalletAccount{
		ID:            "wacc-1",
		UserID:        "user-1",
		AddressOrXpub: wallet1,
		Network:       model.BlockchainNetworkEthereum,
	}

	ownedAddresses := map[string]bool{
		wallet2: true,
	}

	activities := []*model.WalletActivity{
		{
			ID:              "act-1",
			WalletAccountID: "wacc-1",
			TxHash:          "0xtx1",
			FromAddress:     wallet1,
			ToAddress:       wallet2, // destination is owned!
			FormattedAmount: decimal.NewFromFloat(5.0),
			FeeAmount:       "2100000000000000", // 0.0021 ETH gas
			ExecutedAt:      time.Now().UTC(),
		},
	}

	result, err := classifier.Classify(context.Background(), account, activities, ownedAddresses)
	assert.NoError(t, err)

	assert.Len(t, result.Transactions, 2, "expected 1 TRANSFER_OUT and 1 FEE disposal")
	assert.Equal(t, model.TransactionTypeTransferOut, result.Transactions[0].Type)
	assert.Contains(t, *result.Transactions[0].Notes, "Internal transfer to owned wallet")

	assert.Equal(t, model.TransactionTypeFee, result.Transactions[1].Type)
}

func TestActivityClassifier_ComplexDeFiToReviewQueue(t *testing.T) {
	classifier := NewActivityClassifier()
	userAddr := "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

	account := &model.WalletAccount{
		ID:            "wacc-1",
		UserID:        "user-1",
		AddressOrXpub: userAddr,
		Network:       model.BlockchainNetworkEthereum,
	}

	// 3 movements in 1 transaction (e.g. multi-hop swap or LP deposit)
	txHash := "0xcomplex"
	activities := []*model.WalletActivity{
		{ID: "act-1", WalletAccountID: "wacc-1", TxHash: txHash, FromAddress: userAddr, ToAddress: "0xpool1"},
		{ID: "act-2", WalletAccountID: "wacc-1", TxHash: txHash, FromAddress: "0xpool1", ToAddress: "0xpool2"},
		{ID: "act-3", WalletAccountID: "wacc-1", TxHash: txHash, FromAddress: "0xpool2", ToAddress: userAddr},
	}

	result, err := classifier.Classify(context.Background(), account, activities, nil)
	assert.NoError(t, err)

	assert.Len(t, result.Transactions, 0, "complex DeFi should not be auto-created as standard trades")
	assert.Len(t, result.StagedReviews, 3, "expected movements to be staged for user review")
	assert.Equal(t, model.WalletReviewStatusPending, result.StagedReviews[0].ReviewStatus)
}
