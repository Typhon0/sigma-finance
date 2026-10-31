package solana

import (
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
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

func TestSolanaAdapter_ClosedWSOLAccountWithNonZeroBalance(t *testing.T) {
	targetAddress := "WSOLWalletOwner111"
	wsolMint := WSOLMintSPL
	ataAddress := "WSOLAccountPubkey222"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{{Signature: "sig-wsol-unwrap-001", Slot: 2001}}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 2001
			txRes.Meta.Fee = 5000
			// PreBalance: 10,000,000 lamports
			// Closed WSOL had 1,000,000,000 lamports (1 SOL) + rent deposit 2,039,280 lamports
			// PostBalance: 10,000,000 + 1,000,000,000 + 2,039,280 - 5,000 = 1,012,034,280 lamports
			txRes.Meta.PreBalances = []int64{10000000, 0, 1002039280}
			txRes.Meta.PostBalances = []int64{1012034280, 0, 0}

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
					Mint:         wsolMint,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "1000000000", Decimals: 9}, // 1 WSOL
				},
			}
			txRes.Meta.PostTokenBalances = nil // closed

			txRes.Transaction.Signatures = []string{"sig-wsol-unwrap-001"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				SPLTokenProgramID,
				ataAddress,
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Should have 2 movements: 1 native SOL inflow with unwrap breakdown, and 1 token closure movement
	require.Len(t, page.Movements, 2)

	var nativeMvt *blockchain.RawTransferMovement
	var tokenMvt *blockchain.RawTransferMovement
	for i := range page.Movements {
		m := &page.Movements[i]
		if m.TokenAddress == nil {
			nativeMvt = m
		} else if *m.TokenAddress == wsolMint {
			tokenMvt = m
		}
	}

	require.NotNil(t, nativeMvt, "Must emit native movement")
	require.NotNil(t, tokenMvt, "Must emit token movement for closed WSOL")

	// Verify native movement has WSOL unwrap metadata
	var nativeMeta map[string]interface{}
	err = json.Unmarshal(nativeMvt.RawMetadataJSON, &nativeMeta)
	require.NoError(t, err)

	assert.Equal(t, true, nativeMeta["is_wsol_unwrap"])
	assert.Equal(t, "1000000000", nativeMeta["wrapped_sol_unwrapped_lamports"])
	assert.Equal(t, "2039280", nativeMeta["rent_recovered_lamports"])
	assert.Equal(t, true, nativeMeta["rent_recovery_detected"])
	assert.Equal(t, "1002039280", nativeMvt.RawAmount) // netTransfer = delta + fee = 1002034280 + 5000
	assert.Equal(t, "5000", nativeMvt.FeeAmount)

	// Verify token movement for closed WSOL has unwrap metadata
	var tokenMeta map[string]interface{}
	err = json.Unmarshal(tokenMvt.RawMetadataJSON, &tokenMeta)
	require.NoError(t, err)
	assert.Equal(t, true, tokenMeta["is_wsol_unwrap"])
	assert.Equal(t, true, tokenMeta["unwrapped_to_native"])
	assert.Equal(t, "1000000000", tokenMvt.RawAmount)
}

func TestSolanaAdapter_ClosedWSOLAccount_Token2022(t *testing.T) {
	targetAddress := "WSOLToken2022Owner"
	wsolMint := WSOLMintToken2022
	ataAddress := "WSOL2022AccountPubkey"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{{Signature: "sig-wsol2022-unwrap", Slot: 2002}}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 2002
			txRes.Meta.Fee = 5000
			// PreBalance: 5,000,000 lamports
			// Closed Token-2022 WSOL had 500,000,000 lamports (0.5 SOL) + rent deposit 2,039,280 lamports
			// PostBalance: 5,000,000 + 500,000,000 + 2,039,280 - 5,000 = 507,034,280 lamports
			txRes.Meta.PreBalances = []int64{5000000, 0, 502039280}
			txRes.Meta.PostBalances = []int64{507034280, 0, 0}

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
					Mint:         wsolMint,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "500000000", Decimals: 9}, // 0.5 WSOL
				},
			}
			txRes.Meta.PostTokenBalances = nil

			txRes.Transaction.Signatures = []string{"sig-wsol2022-unwrap"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				Token2022ProgramID,
				ataAddress,
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	var nativeMvt *blockchain.RawTransferMovement
	for i := range page.Movements {
		if page.Movements[i].TokenAddress == nil {
			nativeMvt = &page.Movements[i]
			break
		}
	}
	require.NotNil(t, nativeMvt)

	var nativeMeta map[string]interface{}
	err = json.Unmarshal(nativeMvt.RawMetadataJSON, &nativeMeta)
	require.NoError(t, err)

	assert.Equal(t, true, nativeMeta["is_wsol_unwrap"])
	assert.Equal(t, "500000000", nativeMeta["wrapped_sol_unwrapped_lamports"])
	assert.Equal(t, "2039280", nativeMeta["rent_recovered_lamports"])
}

func TestSolanaAdapter_DiscoversClosedTokenAccountFromHistoricalInstruction(t *testing.T) {
	targetAddress := "NewWalletOwnerNeverSeenBefore"
	tokenMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
	closedATAPubkey := "ATACreatedAndClosedInPast123"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{{Signature: "sig-historical-genesis-001", Slot: 3001}}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 3001
			txRes.Meta.Fee = 5000
			txRes.Meta.PreBalances = []int64{10000000, 2039280}
			txRes.Meta.PostBalances = []int64{12034280, 0}

			// PreTokenBalances with Owner omitted by RPC!
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
					AccountIndex: 1,
					Mint:         tokenMint,
					Owner:        "", // RPC omitted owner!
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "75000000", Decimals: 6}, // 75 USDC
				},
			}
			txRes.Meta.PostTokenBalances = nil

			// Parsed closeAccount instruction in outer instructions
			rawInstr, _ := json.Marshal(map[string]interface{}{
				"program":   "spl-token",
				"programId": SPLTokenProgramID,
				"parsed": map[string]interface{}{
					"type": "closeAccount",
					"info": map[string]interface{}{
						"account":     closedATAPubkey,
						"destination": targetAddress,
						"owner":       targetAddress,
						"mint":        tokenMint,
					},
				},
			})
			txRes.Transaction.Message.Instructions = []json.RawMessage{rawInstr}

			txRes.Transaction.Signatures = []string{"sig-historical-genesis-001"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				closedATAPubkey,
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}
	}))
	defer server.Close()

	// New adapter: knownTokenAccounts is completely EMPTY (first import)
	adapter := NewSolanaAdapter(server.URL, "")
	assert.Empty(t, adapter.GetKnownTokenAccounts(targetAddress))

	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Verify that the token account was discovered from the closeAccount instruction!
	known := adapter.GetKnownTokenAccounts(targetAddress)
	assert.Equal(t, tokenMint, known[closedATAPubkey], "Should have discovered closed ATA from instruction")

	// Verify that the token disposal movement was emitted!
	var foundTokenMvt *blockchain.RawTransferMovement
	for i := range page.Movements {
		if page.Movements[i].TokenAddress != nil && *page.Movements[i].TokenAddress == tokenMint {
			foundTokenMvt = &page.Movements[i]
			break
		}
	}
	require.NotNil(t, foundTokenMvt, "Must emit token movement for the discovered historical ATA")
	assert.Equal(t, "75000000", foundTokenMvt.RawAmount)
}

func TestSolanaAdapter_FeePayerSendingNativeSOL(t *testing.T) {
	targetAddress := "SenderWalletFeePayer123"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{{Signature: "sig-send-native-sol-01", Slot: 4001}}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 4001
			txRes.Meta.Fee = 5000
			// Wallet sends 500,000,000 lamports (0.5 SOL), pays 5,000 lamports fee
			// Pre = 1,000,000,000 lamports (1 SOL)
			// Post = 499,995,000 lamports
			txRes.Meta.PreBalances = []int64{1000000000, 200000000}
			txRes.Meta.PostBalances = []int64{499995000, 700000000}

			txRes.Transaction.Signatures = []string{"sig-send-native-sol-01"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				"RecipientAddress456",
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
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
	assert.Equal(t, targetAddress, mvt.FromAddress)
	assert.Empty(t, mvt.ToAddress)
	assert.Nil(t, mvt.TokenAddress)
	assert.Equal(t, "500000000", mvt.RawAmount, "Signed math netTransfer must cleanly isolate 0.5 SOL sent")
	assert.Equal(t, "5000", mvt.FeeAmount, "Fee must be 5000 lamports")
}

func TestSolanaAdapter_FailedTransactionFeeOnly(t *testing.T) {
	targetAddress := "FeePayerFailedTxWallet"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{{Signature: "sig-failed-tx-001", Slot: 5001}}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 5001
			txRes.Meta.Err = map[string]interface{}{"InstructionError": []interface{}{0, "Custom"}}
			txRes.Meta.Fee = 5000
			// Transaction failed! Balances only reflect fee deduction on fee payer
			txRes.Meta.PreBalances = []int64{1000000000, 200000000}
			txRes.Meta.PostBalances = []int64{999995000, 200000000}

			txRes.Transaction.Signatures = []string{"sig-failed-tx-001"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				"RecipientAddress456",
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Should emit exactly 1 fee-only movement with is_failed_tx: true
	require.Len(t, page.Movements, 1)
	mvt := page.Movements[0]
	assert.Equal(t, targetAddress, mvt.FromAddress)
	assert.Equal(t, targetAddress, mvt.ToAddress)
	assert.Equal(t, "0", mvt.RawAmount, "RawAmount must be 0 for failed tx")
	assert.Equal(t, "5000", mvt.FeeAmount, "Fee must be charged")

	var meta map[string]interface{}
	err = json.Unmarshal(mvt.RawMetadataJSON, &meta)
	require.NoError(t, err)
	assert.Equal(t, true, meta["is_failed_tx"])
}

func TestSolanaAdapter_ConcurrentKnownTokenAccounts(t *testing.T) {
	adapter := NewSolanaAdapter("", "")
	wallet := "ConcurrencyTestWallet"

	var wg sync.WaitGroup
	workers := 50

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			ata := "ATA_" + strconv.Itoa(idx)
			mint := "Mint_" + strconv.Itoa(idx)

			adapter.RegisterKnownTokenAccount(wallet, ata, mint)
			_ = adapter.isKnownTokenAccount(wallet, ata)
			_ = adapter.GetKnownTokenAccounts(wallet)
			adapter.LoadKnownTokenAccounts(wallet, map[string]string{ata: mint})
		}(i)
	}

	wg.Wait()
	known := adapter.GetKnownTokenAccounts(wallet)
	assert.NotEmpty(t, known)
}

func TestSolanaAdapter_WSOLDirectLamportsWithoutSyncNative(t *testing.T) {
	targetAddress := "WSOLDirectDepositOwner"
	wsolMint := WSOLMintSPL
	ataAddress := "WSOLDirectDepositAccount"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req rpcRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if req.Method == "getSignaturesForAddress" {
			sigs := []solanaSignatureItem{{Signature: "sig-wsol-direct-deposit", Slot: 6001}}
			resBytes, _ := json.Marshal(sigs)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}

		if req.Method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Slot = 6001
			txRes.Meta.Fee = 5000
			// Token account pre-balance had 1,002,039,280 lamports (1 SOL + rent),
			// but UITokenAmount.Amount was "0" because SyncNative was never called!
			// Post balance of wallet increases by 1 SOL + rent - fee
			txRes.Meta.PreBalances = []int64{10000000, 0, 1002039280}
			txRes.Meta.PostBalances = []int64{1012034280, 0, 0}

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
					Mint:         wsolMint,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "0", Decimals: 9}, // SyncNative was omitted!
				},
			}
			txRes.Meta.PostTokenBalances = nil

			txRes.Transaction.Signatures = []string{"sig-wsol-direct-deposit"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				SPLTokenProgramID,
				ataAddress,
			}

			resBytes, _ := json.Marshal(txRes)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": req.ID, "result": json.RawMessage(resBytes)})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Must detect unwrap of 1,000,000,000 lamports despite token amount being "0" in RPC
	var nativeMvt *blockchain.RawTransferMovement
	for i := range page.Movements {
		if page.Movements[i].TokenAddress == nil {
			nativeMvt = &page.Movements[i]
			break
		}
	}
	require.NotNil(t, nativeMvt)

	var nativeMeta map[string]interface{}
	err = json.Unmarshal(nativeMvt.RawMetadataJSON, &nativeMeta)
	require.NoError(t, err)

	assert.Equal(t, true, nativeMeta["is_wsol_unwrap"])
	assert.Equal(t, "1000000000", nativeMeta["wrapped_sol_unwrapped_lamports"])
	assert.Equal(t, "2039280", nativeMeta["rent_recovered_lamports"])
}

func TestSolanaAdapter_DynamicRentExemptToken2022Extensions(t *testing.T) {
	// Standard SPL token account size = 165 bytes
	// Original (Pre-SIMD-0437): (128 + 165) * 6960 = 2,039,280 lamports
	assert.Equal(t, int64(2039280), CalculateSolanaRentForRate(165, 6960))
	assert.Equal(t, int64(2039280), CalculateSolanaRentForEpoch(165, 1020)) // Epoch 1020

	// Step 1: (128 + 165) * 6333 = 1,855,569 lamports
	assert.Equal(t, int64(1855569), CalculateSolanaRentForRate(165, 6333))
	assert.Equal(t, int64(1855569), CalculateSolanaRentForEpoch(165, 1030)) // Epoch 1030

	// Step 2 (Current Mainnet): (128 + 165) * 5080 = 1,488,440 lamports
	assert.Equal(t, int64(1488440), CalculateSolanaRentForRate(165, 5080))
	assert.Equal(t, int64(1488440), CalculateSolanaRentForEpoch(165, 1035)) // Epoch 1035
	assert.Equal(t, int64(1488440), CalculateSolanaRentExemptLamports(165))

	// Token-2022 with extensions (230 bytes)
	// Original: (128 + 230) * 6960 = 358 * 6960 = 2,491,680 lamports
	assert.Equal(t, int64(2491680), CalculateSolanaRentForRate(230, 6960))
	// Step 1: (128 + 230) * 6333 = 358 * 6333 = 2,267,214 lamports
	assert.Equal(t, int64(2267214), CalculateSolanaRentForRate(230, 6333))
	// Step 2: (128 + 230) * 5080 = 358 * 5080 = 1,818,640 lamports
	assert.Equal(t, int64(1818640), CalculateSolanaRentForRate(230, 5080))
	assert.Equal(t, int64(1818640), CalculateSolanaRentExemptLamports(230))
}

func TestSolanaAdapter_SIMD0437_ReducedRentRegression(t *testing.T) {
	// Epoch slots: 432,000 slots per epoch
	// Epoch 1020: slot 440,640,000 (Step 0: Pre-SIMD, rate = 6,960)
	// Epoch 1030: slot 444,960,000 (Step 1: rate = 6,333)
	// Epoch 1035: slot 447,120,000 (Step 2: rate = 5,080)
	slotPreStep1 := uint64(1020 * 432000)
	slotStep1 := uint64(1030 * 432000)
	slotStep2 := uint64(1035 * 432000)

	// 1. Account created before Step 1 (epoch < 1028):
	// Must use original rate of 6,960 lamports/byte -> 2,039,280 lamports
	rent1, amb1 := ResolveSolanaWSOLRentReserve(165, slotPreStep1, nil, 3039280, big.NewInt(1000000))
	assert.Equal(t, int64(2039280), rent1, "Pre-Step 1 account must resolve to original 2,039,280 lamports reserve")
	assert.False(t, amb1)

	// 2. Account created between Step 1 and Step 2 (epoch 1028..1032):
	// Uses Step 1 rate of 6,333 lamports/byte -> 1,855,569 lamports
	rent2, amb2 := ResolveSolanaWSOLRentReserve(165, slotStep1, nil, 2855569, big.NewInt(1000000))
	assert.Equal(t, int64(1855569), rent2, "Step 1 account must resolve to 1,855,569 lamports reserve")
	assert.False(t, amb2)

	// 3. Account created after Step 2 (epoch >= 1033):
	// Uses Step 2 rate of 5,080 lamports/byte -> 1,488,440 lamports
	rent3, amb3 := ResolveSolanaWSOLRentReserve(165, slotStep2, nil, 2488440, big.NewInt(1000000))
	assert.Equal(t, int64(1488440), rent3, "Step 2 account must resolve to 1,488,440 lamports reserve")
	assert.False(t, amb3)

	// 4. Account created before Step 2 (e.g. Step 0 original with 2,039,280) but closed after Step 2 (epoch 1035):
	// Must PRESERVE historical reserve (2,039,280), NOT overwrite with Step 2 rate (1,488,440)!
	rent4a, amb4a := ResolveSolanaWSOLRentReserve(165, slotStep2, nil, 3039280, big.NewInt(1000000))
	assert.Equal(t, int64(2039280), rent4a, "Step 0 account closed in Step 2 must preserve historical 2,039,280 reserve")
	assert.False(t, amb4a)

	// Account created in Step 1 (1,855,569) but closed after Step 2 (epoch 1035):
	rent4b, amb4b := ResolveSolanaWSOLRentReserve(165, slotStep2, nil, 2855569, big.NewInt(1000000))
	assert.Equal(t, int64(1855569), rent4b, "Step 1 account closed in Step 2 must preserve historical 1,855,569 reserve")
	assert.False(t, amb4b)

	// 5. Token-2022 with variable account sizes:
	// 230 bytes: Step 0=2,491,680; Step 1=2,267,214; Step 2=1,818,640
	rent5_230, amb5_230 := ResolveSolanaWSOLRentReserve(230, slotStep2, nil, 2818640, big.NewInt(1000000))
	assert.Equal(t, int64(1818640), rent5_230, "Token-2022 230-byte Step 2 must be 1,818,640 lamports")
	assert.False(t, amb5_230)

	// 300 bytes: Step 0=(128+300)*6960=2,978,880; Step 1=(128+300)*6333=2,710,524; Step 2=(128+300)*5080=2,174,240
	rent5_300, amb5_300 := ResolveSolanaWSOLRentReserve(300, slotStep2, nil, 3174240, big.NewInt(1000000))
	assert.Equal(t, int64(2174240), rent5_300, "Token-2022 300-byte Step 2 must be 2,174,240 lamports")
	assert.False(t, amb5_300)

	// 6. Ambiguous historical funding:
	// Account in Step 2 era has arbitrary lamports not aligning with any candidate reserve:
	_, amb6 := ResolveSolanaWSOLRentReserve(165, slotStep2, nil, 9876543, big.NewInt(1000000))
	assert.True(t, amb6, "Ambiguous lamport split must set isAmbiguous = true to trigger wsol_breakdown_incomplete")
}

func TestSolanaAdapter_CloseAccountDestinationThirdPartyNotCredited(t *testing.T) {
	// Scenario: Wallet owns a token account, but CloseAccount directs returned lamports to an external address (third-party)
	targetAddress := "WalletUser111"
	thirdPartyDest := "ExternalVault999"
	closedATAPubkey := "ATAToClose111"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		method, _ := req["method"].(string)

		if method == "getSignaturesForAddress" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": []map[string]interface{}{
					{"signature": "sig-close-third-party-888", "slot": 250000000, "blockTime": 1720000000},
				},
			})
			return
		}

		if method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Transaction.Signatures = []string{"sig-close-third-party-888"}
			// Account keys: [0]=WalletUser111, [1]=ExternalVault999, [2]=ATAToClose111
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				thirdPartyDest,
				closedATAPubkey,
			}
			// CloseAccount instruction sending lamports to thirdPartyDest!
			closeInstr := map[string]interface{}{
				"program":   "spl-token",
				"programId": SPLTokenProgramID,
				"parsed": map[string]interface{}{
					"type": "closeAccount",
					"info": map[string]interface{}{
						"account":     closedATAPubkey,
						"destination": thirdPartyDest,
						"owner":       targetAddress,
					},
				},
			}
			closeRaw, _ := json.Marshal(closeInstr)
			txRes.Transaction.Message.Instructions = []json.RawMessage{closeRaw}

			// PreTokenBalances has the closed account, PostTokenBalances is empty
			txRes.Meta.PreTokenBalances = []struct {
				AccountIndex  int    `json:"accountIndex"`
				Mint          string `json:"mint"`
				Owner         string `json:"owner"`
				UITokenAmount struct {
					Amount   string `json:"amount"`
					Decimals int    `json:"decimals"`
				} `json:"uiTokenAmount"`
			}{
				{
					AccountIndex: 2,
					Mint:         WSOLMintSPL,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "500000000", Decimals: 9},
				},
			}
			txRes.Meta.PostTokenBalances = nil
			txRes.Meta.PreBalances = []int64{10000000, 0, 502039280}
			// Wallet balance only reduced by transaction fee; external vault got the 502,039,280 lamports
			txRes.Meta.PostBalances = []int64{9995000, 502039280, 0}
			txRes.Meta.Fee = 5000

			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result":  txRes,
			})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Since returned lamports went to thirdPartyDest, native movement for WalletUser111 must NOT claim rent recovery or unwrap
	for _, m := range page.Movements {
		if m.TokenAddress == nil {
			var meta map[string]interface{}
			err = json.Unmarshal(m.RawMetadataJSON, &meta)
			require.NoError(t, err)
			assert.False(t, meta["is_wsol_unwrap"] == true, "User must not be credited with unwrap when destination was external third party")
		} else {
			var meta map[string]interface{}
			err = json.Unmarshal(m.RawMetadataJSON, &meta)
			require.NoError(t, err)
			assert.Equal(t, false, meta["destination_is_user"])
			assert.Equal(t, thirdPartyDest, meta["close_destination"])
		}
	}
}

func TestSolanaAdapter_IntraTxSolTransfersMarkedIncomplete(t *testing.T) {
	// Scenario: Prior transfer instruction shifts lamports before CloseAccount
	targetAddress := "WalletUser111"
	closedATAPubkey := "ATAToClose111"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		method, _ := req["method"].(string)

		if method == "getSignaturesForAddress" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": []map[string]interface{}{
					{"signature": "sig-prior-shift-777", "slot": 260000000, "blockTime": 1730000000},
				},
			})
			return
		}

		if method == "getTransaction" {
			var txRes solanaTransactionResult
			txRes.Transaction.Signatures = []string{"sig-prior-shift-777"}
			txRes.Transaction.Message.AccountKeys = []interface{}{
				targetAddress,
				closedATAPubkey,
			}

			// 1. Transfer instruction shifting lamports into ATA earlier in transaction
			priorTransfer := map[string]interface{}{
				"program": "system",
				"parsed": map[string]interface{}{
					"type": "transfer",
					"info": map[string]interface{}{
						"source":      targetAddress,
						"destination": closedATAPubkey,
						"lamports":    100000000,
					},
				},
			}
			priorRaw, _ := json.Marshal(priorTransfer)

			// 2. CloseAccount instruction
			closeInstr := map[string]interface{}{
				"program":   "spl-token",
				"programId": SPLTokenProgramID,
				"parsed": map[string]interface{}{
					"type": "closeAccount",
					"info": map[string]interface{}{
						"account":     closedATAPubkey,
						"destination": targetAddress,
						"owner":       targetAddress,
					},
				},
			}
			closeRaw, _ := json.Marshal(closeInstr)
			txRes.Transaction.Message.Instructions = []json.RawMessage{priorRaw, closeRaw}

			txRes.Meta.PreTokenBalances = []struct {
				AccountIndex  int    `json:"accountIndex"`
				Mint          string `json:"mint"`
				Owner         string `json:"owner"`
				UITokenAmount struct {
					Amount   string `json:"amount"`
					Decimals int    `json:"decimals"`
				} `json:"uiTokenAmount"`
			}{
				{
					AccountIndex: 1,
					Mint:         WSOLMintSPL,
					Owner:        targetAddress,
					UITokenAmount: struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					}{Amount: "300000000", Decimals: 9},
				},
			}
			txRes.Meta.PostTokenBalances = nil
			txRes.Meta.PreBalances = []int64{10000000, 302039280}
			txRes.Meta.PostBalances = []int64{312034280, 0}
			txRes.Meta.Fee = 5000

			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result":  txRes,
			})
			return
		}
	}))
	defer server.Close()

	adapter := NewSolanaAdapter(server.URL, "")
	page, err := adapter.FetchTransfers(context.Background(), model.BlockchainNetworkSolana, targetAddress, "")
	require.NoError(t, err)
	require.NotNil(t, page)

	// Since intra-tx transfer occurred prior to closure, exact breakdown must be marked incomplete
	foundIncomplete := false
	for _, m := range page.Movements {
		var meta map[string]interface{}
		err = json.Unmarshal(m.RawMetadataJSON, &meta)
		require.NoError(t, err)
		if meta["wsol_breakdown_incomplete"] == true {
			foundIncomplete = true
			break
		}
	}
	assert.True(t, foundIncomplete, "Movement must be marked with wsol_breakdown_incomplete: true")
}




