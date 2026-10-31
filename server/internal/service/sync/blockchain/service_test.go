package blockchain_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

type mockBlockchainProvider struct {
	balances  []blockchain.RawTokenBalance
	transfers []blockchain.RawTransferMovement
}

func (m *mockBlockchainProvider) ProviderName() string {
	return "MOCK"
}

func (m *mockBlockchainProvider) SupportsNetwork(network model.BlockchainNetwork) bool {
	return true
}

func (m *mockBlockchainProvider) FetchBalances(ctx context.Context, network model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	return m.balances, nil
}

func (m *mockBlockchainProvider) FetchTransfers(ctx context.Context, network model.BlockchainNetwork, address string, cursor string) (*blockchain.TransferPage, error) {
	return &blockchain.TransferPage{
		Movements:   m.transfers,
		NextPageKey: nil,
	}, nil
}

func TestWalletSyncService_UnitClassification(t *testing.T) {
	classifier := blockchain.NewActivityClassifier()
	userAddr := "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

	account := &model.WalletAccount{
		ID:            "wacc-100",
		UserID:        "user-100",
		AddressOrXpub: userAddr,
		Network:       model.BlockchainNetworkEthereum,
	}

	activities := []*model.WalletActivity{
		{
			ID:              "act-swap-in",
			WalletAccountID: "wacc-100",
			TxHash:          "0xswap123456",
			FromAddress:     "0xpool",
			ToAddress:       userAddr,
			FormattedAmount: decimal.NewFromFloat(500.0),
			ExecutedAt:      time.Now().UTC(),
		},
		{
			ID:              "act-swap-out",
			WalletAccountID: "wacc-100",
			TxHash:          "0xswap123456",
			FromAddress:     userAddr,
			ToAddress:       "0xpool",
			FormattedAmount: decimal.NewFromFloat(0.2),
			ExecutedAt:      time.Now().UTC(),
		},
	}

	res, err := classifier.Classify(context.Background(), account, activities, nil)
	assert.NoError(t, err)
	assert.Len(t, res.Transactions, 2)
	assert.Equal(t, model.TransactionTypeSell, res.Transactions[0].Type)
	assert.Equal(t, model.TransactionTypeBuy, res.Transactions[1].Type)
}

func TestSolanaDiscoveredData_SerializationAndPersistence(t *testing.T) {
	// Verifies Solana ATA cache serialization for wallet_accounts.discovered_addresses
	data := blockchain.SolanaDiscoveredData{
		TokenAccounts: map[string]string{
			"ATAPubkey1": "MintUSDC111",
			"ATAPubkey2": "MintSOL222",
		},
	}

	rawBytes, err := json.Marshal(data)
	assert.NoError(t, err)

	rawStr := string(rawBytes)
	assert.Contains(t, rawStr, "ATAPubkey1")
	assert.Contains(t, rawStr, "MintUSDC111")

	var decoded blockchain.SolanaDiscoveredData
	err = json.Unmarshal([]byte(rawStr), &decoded)
	assert.NoError(t, err)
	assert.Len(t, decoded.TokenAccounts, 2)
	assert.Equal(t, "MintUSDC111", decoded.TokenAccounts["ATAPubkey1"])
}

