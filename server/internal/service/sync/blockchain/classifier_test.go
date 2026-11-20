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

func TestActivityClassifier_NativeFeeDecimals_SolanaAndBitcoin(t *testing.T) {
	classifier := NewActivityClassifier()

	// 1. Solana Account: 5000 lamports fee -> 0.000005 SOL (9 decimals)
	solAccount := &model.WalletAccount{
		ID:            "wacc-sol",
		UserID:        "user-1",
		AddressOrXpub: "SolAddr111",
		Network:       model.BlockchainNetworkSolana,
	}
	solActivities := []*model.WalletActivity{
		{
			ID:              "act-sol",
			WalletAccountID: "wacc-sol",
			TxHash:          "soltx1",
			FromAddress:     "SolAddr111",
			ToAddress:       "SolAddr222",
			FormattedAmount: decimal.NewFromFloat(1.0),
			FeeAmount:       "5000", // 5000 lamports
			ExecutedAt:      time.Now().UTC(),
		},
	}
	resSol, err := classifier.Classify(context.Background(), solAccount, solActivities, nil)
	assert.NoError(t, err)
	assert.Len(t, resSol.Transactions, 2)
	solFeeTx := resSol.Transactions[1]
	assert.Equal(t, model.TransactionTypeFee, solFeeTx.Type)
	expectedSolFee := decimal.NewFromFloat(0.000005)
	assert.True(t, expectedSolFee.Equal(*solFeeTx.Quantity), "Solana fee must use 9 decimals: expected %s, got %s", expectedSolFee, solFeeTx.Quantity)

	// 2. Bitcoin Account: 2500 satoshis fee -> 0.000025 BTC (8 decimals)
	btcAccount := &model.WalletAccount{
		ID:            "wacc-btc",
		UserID:        "user-1",
		AddressOrXpub: "bc1qtest",
		Network:       model.BlockchainNetworkBitcoin,
	}
	btcActivities := []*model.WalletActivity{
		{
			ID:              "act-btc",
			WalletAccountID: "wacc-btc",
			TxHash:          "btctx1",
			FromAddress:     "bc1qtest",
			ToAddress:       "bc1qpeer",
			FormattedAmount: decimal.NewFromFloat(0.5),
			FeeAmount:       "2500", // 2500 satoshis
			ExecutedAt:      time.Now().UTC(),
		},
	}
	resBtc, errBtc := classifier.Classify(context.Background(), btcAccount, btcActivities, nil)
	assert.NoError(t, errBtc)
	assert.Len(t, resBtc.Transactions, 2)
	btcFeeTx := resBtc.Transactions[1]
	assert.Equal(t, model.TransactionTypeFee, btcFeeTx.Type)
	expectedBtcFee := decimal.NewFromFloat(0.000025)
	assert.True(t, expectedBtcFee.Equal(*btcFeeTx.Quantity), "Bitcoin fee must use 8 decimals: expected %s, got %s", expectedBtcFee, btcFeeTx.Quantity)
}

func TestActivityClassifier_SolanaRentRecoveryNotClassifiedAsSwap(t *testing.T) {
	classifier := NewActivityClassifier()
	userAddr := "SolAddr111"
	usdcMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

	account := &model.WalletAccount{
		ID:            "wacc-sol-close",
		UserID:        "user-1",
		AddressOrXpub: userAddr,
		Network:       model.BlockchainNetworkSolana,
	}

	txHash := "sol_close_account_tx"
	// 1 Outgoing token disposal (50 USDC) + 1 Incoming native SOL (0.00203928 SOL rent refund)
	rentMeta := []byte(`{"rent_recovery_detected": true, "net_transfer_lamports": 2039280}`)
	tokenCloseMeta := []byte(`{"is_account_closure": true}`)

	activities := []*model.WalletActivity{
		{
			ID:              "act-token-close",
			WalletAccountID: "wacc-sol-close",
			TxHash:          txHash,
			FromAddress:     userAddr,
			ToAddress:       "",
			TokenAddress:    &usdcMint,
			FormattedAmount: decimal.NewFromFloat(50.0),
			RawMetadata:     tokenCloseMeta,
			ExecutedAt:      time.Now().UTC(),
		},
		{
			ID:              "act-rent-refund",
			WalletAccountID: "wacc-sol-close",
			TxHash:          txHash,
			FromAddress:     "",
			ToAddress:       userAddr,
			TokenAddress:    nil, // native SOL
			FormattedAmount: decimal.NewFromFloat(0.00203928),
			RawMetadata:     rentMeta,
			ExecutedAt:      time.Now().UTC(),
		},
	}

	res, err := classifier.Classify(context.Background(), account, activities, nil)
	assert.NoError(t, err)

	// Must NOT be classified as a DEX swap (Buy/Sell)!
	for _, tx := range res.Transactions {
		assert.NotEqual(t, model.TransactionTypeBuy, tx.Type, "Closing an ATA must not generate a BUY swap transaction")
		assert.NotEqual(t, model.TransactionTypeSell, tx.Type, "Closing an ATA must not generate a SELL swap transaction")
	}

	// Should be classified as TRANSFER_OUT (token closure) and TRANSFER_IN (rent refund)
	assert.Len(t, res.Transactions, 2)
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

func TestActivityClassifier_WSOLUnwrapClassification(t *testing.T) {
	classifier := NewActivityClassifier()
	userAddr := "SolanaWallet111"

	account := &model.WalletAccount{
		ID:            "wacc-sol-unwrap",
		UserID:        "user-1",
		AddressOrXpub: userAddr,
		Network:       model.BlockchainNetworkSolana,
	}

	txHash := "solwsolunwraptx"
	wsolMint := "So11111111111111111111111111111111111111112"

	rawWSOLMeta := []byte(`{"mint":"So11111111111111111111111111111111111111112","is_account_closure":true,"is_wsol_unwrap":true,"unwrapped_to_native":true}`)
	rawNativeMeta := []byte(`{"is_wsol_unwrap":true,"rent_recovery_detected":true,"wrapped_sol_unwrapped_lamports":"1000000000","rent_recovered_lamports":"2039280"}`)

	activities := []*model.WalletActivity{
		{
			ID:              "act-wsol-out",
			WalletAccountID: "wacc-sol-unwrap",
			TxHash:          txHash,
			FromAddress:     userAddr,
			ToAddress:       "",
			TokenAddress:    &wsolMint,
			FormattedAmount: decimal.NewFromFloat(1.0), // 1 WSOL out
			FeeAmount:       "5000",                    // 5000 lamports fee
			RawMetadata:     rawWSOLMeta,
			ExecutedAt:      time.Now().UTC(),
		},
		{
			ID:              "act-sol-in",
			WalletAccountID: "wacc-sol-unwrap",
			TxHash:          txHash,
			FromAddress:     "",
			ToAddress:       userAddr,
			TokenAddress:    nil, // Native SOL in
			FormattedAmount: decimal.NewFromFloat(1.00203928),
			FeeAmount:       "0",
			RawMetadata:     rawNativeMeta,
			ExecutedAt:      time.Now().UTC(),
		},
	}

	result, err := classifier.Classify(context.Background(), account, activities, nil)
	assert.NoError(t, err)

	// Must NOT be classified as a DEX swap!
	for _, tx := range result.Transactions {
		assert.NotEqual(t, model.TransactionTypeBuy, tx.Type, "Unwrapping WSOL must not generate a BUY swap transaction")
		assert.NotEqual(t, model.TransactionTypeSell, tx.Type, "Unwrapping WSOL must not generate a SELL swap transaction")
	}

	// Must have: 1 TRANSFER_OUT (WSOL), 1 FEE (gas fee), 1 TRANSFER_IN (native SOL)
	assert.Len(t, result.Transactions, 3)

	var transferOut *model.Transaction
	var transferIn *model.Transaction
	var feeTx *model.Transaction

	for _, tx := range result.Transactions {
		switch tx.Type {
		case model.TransactionTypeTransferOut:
			transferOut = tx
		case model.TransactionTypeTransferIn:
			transferIn = tx
		case model.TransactionTypeFee:
			feeTx = tx
		}
	}

	assert.NotNil(t, transferOut)
	assert.NotNil(t, transferIn)
	assert.NotNil(t, feeTx)

	assert.Contains(t, *transferOut.Notes, "Unwrap WSOL to native SOL")
	assert.Contains(t, *transferIn.Notes, "Unwrapped native SOL from WSOL")
	assert.True(t, decimal.NewFromFloat(0.000005).Equal(*feeTx.Quantity))
}
