package solana

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
)

func TestSolanaAdapterCapabilities(t *testing.T) {
	adapter := NewSolanaAdapter("", "")
	assert.Equal(t, "SOLANA_RPC", adapter.ProviderName())
	assert.True(t, adapter.SupportsNetwork(model.BlockchainNetworkSolana))
	assert.False(t, adapter.SupportsNetwork(model.BlockchainNetworkEthereum))
	assert.Equal(t, model.WalletCapabilityActivityIndexed, adapter.GetCapability(model.BlockchainNetworkSolana))

	adapterHelius := NewSolanaAdapter("", "helius-key-123")
	assert.Equal(t, model.WalletCapabilityEnhancedHistory, adapterHelius.GetCapability(model.BlockchainNetworkSolana))
}

func TestSolanaVersionedTransactionV0(t *testing.T) {
	targetAddress := "So11111111111111111111111111111111111111112"
	tokenMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{
				{Signature: "sig-v0-tx-123", Slot: 1000},
			}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result":  json.RawMessage(resBytes),
			})
			return
		}

		if req.Method == "getTransaction" {
			// Construct Version 0 transaction with Address Lookup Table loadedAddresses
			var txRes solanaTransactionResult
			txRes.Slot = 1000
			txRes.Meta.Fee = 5000 // 5000 lamports fee
			// Fee payer is targetAddress (account 0)
			// PreBalance: 1,000,000, PostBalance: 895,000 -> Outflow = 105,000 lamports
			// Transfer = Outflow - Fee = 105,000 - 5,000 = 100,000 lamports
			txRes.Meta.PreBalances = []int64{1000000, 500000}
			txRes.Meta.PostBalances = []int64{895000, 600000}

			// Token accounts loaded via Address Lookup Table
			txRes.Meta.LoadedAddresses.Writable = []string{"TokenAccountALT1"}
			txRes.Meta.LoadedAddresses.Readonly = []string{"ReadonlyALT2"}

			// Account 2 is TokenAccountALT1
			txRes.Meta.PreTokenBalances = []struct {
				AccountIndex int    `json:"accountIndex"`
				Mint         string `json:"mint"`
				Owner        string `json:"owner"`
				UITokenAmount struct {
					Amount   string `json:"amount"`
					Decimals int    `json:"decimals"`
				} `json:"uiTokenAmount"`
			}{
				{
					AccountIndex: 2,
					Mint:         tokenMint,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "1000000", Decimals: 6},
				},
			}

			txRes.Meta.PostTokenBalances = []struct {
				AccountIndex int    `json:"accountIndex"`
				Mint         string `json:"mint"`
				Owner        string `json:"owner"`
				UITokenAmount struct {
					Amount   string `json:"amount"`
					Decimals int    `json:"decimals"`
				} `json:"uiTokenAmount"`
			}{
				{
					AccountIndex: 2,
					Mint:         tokenMint,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "2500000", Decimals: 6}, // +1.5 USDC
				},
			}

			txRes.Transaction.Signatures = []string{"sig-v0-tx-123"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				"RecipientAddressStatic",
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result":  json.RawMessage(resBytes),
			})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Should have 2 movements: 1 native SOL outflow (100,000 lamports, fee 5,000) and 1 SPL Token inflow (1,500,000 units)
	require.Len(t, page.Movements, 2)

	nativeMvt := page.Movements[0]
	assert.Equal(t, "sig-v0-tx-123", nativeMvt.TxHash)
	assert.Nil(t, nativeMvt.TokenAddress)
	assert.Equal(t, "100000", nativeMvt.RawAmount) // correctly deducted fee from gross outflow!
	assert.Equal(t, "5000", nativeMvt.FeeAmount)
	assert.Equal(t, 0, nativeMvt.MovementIndex)

	tokenMvt := page.Movements[1]
	assert.Equal(t, "sig-v0-tx-123", tokenMvt.TxHash)
	require.NotNil(t, tokenMvt.TokenAddress)
	assert.Equal(t, tokenMint, *tokenMvt.TokenAddress)
	assert.Equal(t, "1500000", tokenMvt.RawAmount) // delta: 2.5m - 1.0m
	assert.Equal(t, 6, tokenMvt.Decimals)
	assert.Equal(t, 102, tokenMvt.MovementIndex) // 100 + accountIndex (2)
}

func TestSolanaAdapter_ClosedTokenAccountWithOmittedOwner(t *testing.T) {
	targetAddress := "WalletPubkey111"
	tokenMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
	ataAddress := "ATAPubkey222"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{
				{Signature: "sig-closed-token-tx-456", Slot: 1001},
			}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result":  json.RawMessage(resBytes),
			})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 1001
			txRes.Meta.Fee = 5000
			txRes.Meta.PreBalances = []int64{1000000, 0, 2039280}
			// When closing an ATA, rent exempt lamports (2039280) are reimbursed to fee payer
			txRes.Meta.PostBalances = []int64{3034280, 0, 0}

			// PreTokenBalances has the closed account, but Owner is omitted ("") by RPC
			// AccountIndex 2 corresponds to ataAddress in AccountKeys
			txRes.Meta.PreTokenBalances = []struct {
				AccountIndex int    `json:"accountIndex"`
				Mint         string `json:"mint"`
				Owner        string `json:"owner"`
				UITokenAmount struct {
					Amount   string `json:"amount"`
					Decimals int    `json:"decimals"`
				} `json:"uiTokenAmount"`
			}{
				{
					AccountIndex: 2,
					Mint:         tokenMint,
					Owner:        "", // RPC omitted owner!
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "50000000", Decimals: 6}, // 50 USDC closed/burnt
				},
			}

			// PostTokenBalances is empty because account was closed!
			txRes.Meta.PostTokenBalances = nil

			txRes.Transaction.Signatures = []string{"sig-closed-token-tx-456"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				"TokenProgram111111111111111111111111111111",
				ataAddress, // AccountIndex 2 is the ATA, not the targetAddress
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result":  json.RawMessage(resBytes),
			})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	// Explicitly register known ATA for this wallet
	adapter.RegisterKnownTokenAccount(targetAddress, ataAddress, tokenMint)

	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// We must find the closed token transfer movement for USDC!
	var foundTokenMvt *model.WalletActivity
	var foundTokenRaw string
	for _, mvt := range page.Movements {
		if mvt.TokenAddress != nil && *mvt.TokenAddress == tokenMint {
			foundTokenRaw = mvt.RawAmount
			break
		}
	}

	assert.Equal(t, "50000000", foundTokenRaw, "Should identify closed token account disposal movement using registered ATA mapping even when Owner is omitted")
	_ = foundTokenMvt
}

func TestSolanaAdapter_FeePayerReceivingNativeSOL(t *testing.T) {
	targetAddress := "FeePayerWallet111"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{
				{Signature: "sig-fee-payer-rx-789", Slot: 1002},
			}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result":  json.RawMessage(resBytes),
			})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 1002
			txRes.Meta.Fee = 5000 // 5,000 lamports fee paid by account 0
			// PreBalance: 1,000,000, PostBalance: 2,000,000
			// Net balance delta = +1,000,000
			// Actual external payment received = delta + fee = 1,000,000 + 5,000 = 1,005,000
			txRes.Meta.PreBalances = []int64{1000000, 5000000}
			txRes.Meta.PostBalances = []int64{2000000, 3995000}

			txRes.Transaction.Signatures = []string{"sig-fee-payer-rx-789"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				"SenderAddress222",
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req.ID,
				"result":  json.RawMessage(resBytes),
			})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	require.Len(t, page.Movements, 1)
	mvt := page.Movements[0]
	assert.Equal(t, "sig-fee-payer-rx-789", mvt.TxHash)
	assert.Nil(t, mvt.TokenAddress)
	assert.Equal(t, targetAddress, mvt.ToAddress)
	assert.Equal(t, "5000", mvt.FeeAmount)
	// Must be 1005000 (delta + fee), not 1000000
	assert.Equal(t, "1005000", mvt.RawAmount, "Incoming payment to fee payer must be netDelta + fee")
}



