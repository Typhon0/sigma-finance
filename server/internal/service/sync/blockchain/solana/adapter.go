package solana

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

const (
	DefaultSolanaRPCEndpoint = "https://api.mainnet-beta.solana.com"
	SPLTokenProgramID        = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
	Token2022ProgramID       = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
)

type SolanaAdapter struct {
	endpoint       string
	httpClient     *http.Client
	rateLimiter    *rate.Limiter
	circuitBreaker *gobreaker.CircuitBreaker
	heliusAPIKey   string
	knownATAsMu    sync.RWMutex
	knownATAs      map[string]map[string]string // walletAddress -> (ataPubkey -> mint)
}

func NewSolanaAdapter(endpoint string, heliusAPIKey string) *SolanaAdapter {
	if endpoint == "" {
		endpoint = DefaultSolanaRPCEndpoint
	}
	if heliusAPIKey != "" {
		endpoint = fmt.Sprintf("https://mainnet.helius-rpc.com/?api-key=%s", heliusAPIKey)
	}

	return &SolanaAdapter{
		endpoint:       endpoint,
		httpClient:     &http.Client{Timeout: 15 * time.Second},
		rateLimiter:    rate.NewLimiter(rate.Limit(3), 3), // 3 rps polite rate limit
		circuitBreaker: gobreaker.NewCircuitBreaker(gobreaker.Settings{Name: "Solana-RPC"}),
		heliusAPIKey:   heliusAPIKey,
		knownATAs:      make(map[string]map[string]string),
	}
}

// RegisterKnownTokenAccount records an ATA pubkey to wallet owner and mint mapping
func (a *SolanaAdapter) RegisterKnownTokenAccount(walletAddress, ataPubkey, mint string) {
	if walletAddress == "" || ataPubkey == "" {
		return
	}
	a.knownATAsMu.Lock()
	defer a.knownATAsMu.Unlock()
	if a.knownATAs[walletAddress] == nil {
		a.knownATAs[walletAddress] = make(map[string]string)
	}
	a.knownATAs[walletAddress][ataPubkey] = mint
}

func (a *SolanaAdapter) isKnownATA(walletAddress, ataPubkey string) bool {
	a.knownATAsMu.RLock()
	defer a.knownATAsMu.RUnlock()
	if m, ok := a.knownATAs[walletAddress]; ok {
		_, found := m[ataPubkey]
		return found
	}
	return false
}

// GetKnownTokenAccounts returns a copy of known ATAs for a wallet
func (a *SolanaAdapter) GetKnownTokenAccounts(walletAddress string) map[string]string {
	a.knownATAsMu.RLock()
	defer a.knownATAsMu.RUnlock()
	res := make(map[string]string)
	if m, ok := a.knownATAs[walletAddress]; ok {
		for k, v := range m {
			res[k] = v
		}
	}
	return res
}

// LoadKnownTokenAccounts loads known ATAs into memory cache
func (a *SolanaAdapter) LoadKnownTokenAccounts(walletAddress string, ataMap map[string]string) {
	if walletAddress == "" || len(ataMap) == 0 {
		return
	}
	a.knownATAsMu.Lock()
	defer a.knownATAsMu.Unlock()
	if a.knownATAs[walletAddress] == nil {
		a.knownATAs[walletAddress] = make(map[string]string)
	}
	for k, v := range ataMap {
		a.knownATAs[walletAddress][k] = v
	}
}

func (a *SolanaAdapter) ProviderName() string {
	return "SOLANA_RPC"
}

func (a *SolanaAdapter) SupportsNetwork(net model.BlockchainNetwork) bool {
	return net == model.BlockchainNetworkSolana
}

func (a *SolanaAdapter) GetCapability(net model.BlockchainNetwork) model.WalletCapabilityLevel {
	if a.heliusAPIKey != "" {
		return model.WalletCapabilityEnhancedHistory
	}
	return model.WalletCapabilityActivityIndexed
}

type rpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type solanaBalanceResult struct {
	Value uint64 `json:"value"`
}

type solanaTokenAccountItem struct {
	Pubkey  string `json:"pubkey"`
	Account struct {
		Data struct {
			Parsed struct {
				Info struct {
					Mint        string `json:"mint"`
					TokenAmount struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					} `json:"tokenAmount"`
				} `json:"info"`
			} `json:"parsed"`
		} `json:"data"`
	} `json:"account"`
}

type solanaSignatureItem struct {
	Signature string `json:"signature"`
	Slot      uint64 `json:"slot"`
	BlockTime *int64 `json:"blockTime"`
}

type solanaTransactionResult struct {
	BlockTime *int64 `json:"blockTime"`
	Slot      uint64 `json:"slot"`
	Meta      struct {
		Fee          uint64  `json:"fee"`
		PreBalances  []int64 `json:"preBalances"`
		PostBalances []int64 `json:"postBalances"`
		LoadedAddresses struct {
			Writable []string `json:"writable"`
			Readonly []string `json:"readonly"`
		} `json:"loadedAddresses"`
		PreTokenBalances []struct {
			AccountIndex int    `json:"accountIndex"`
			Mint         string `json:"mint"`
			Owner        string `json:"owner"`
			UITokenAmount struct {
				Amount   string `json:"amount"`
				Decimals int    `json:"decimals"`
			} `json:"uiTokenAmount"`
		} `json:"preTokenBalances"`
		PostTokenBalances []struct {
			AccountIndex int    `json:"accountIndex"`
			Mint         string `json:"mint"`
			Owner        string `json:"owner"`
			UITokenAmount struct {
				Amount   string `json:"amount"`
				Decimals int    `json:"decimals"`
			} `json:"uiTokenAmount"`
		} `json:"postTokenBalances"`
	} `json:"meta"`
	Transaction struct {
		Signatures []string `json:"signatures"`
		Message    struct {
			AccountKeys []interface{} `json:"accountKeys"`
		} `json:"message"`
	} `json:"transaction"`
}

// FetchBalances fetches native SOL and SPL + Token-2022 balances
func (a *SolanaAdapter) FetchBalances(ctx context.Context, net model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	if net != model.BlockchainNetworkSolana {
		return nil, fmt.Errorf("network %s not supported by SolanaAdapter", net)
	}

	var results []blockchain.RawTokenBalance

	// 1. Native SOL Balance
	balReq := rpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "getBalance",
		Params:  []interface{}{address},
	}
	balResBytes, errBal := a.doRPCPost(ctx, balReq)
	if errBal == nil {
		var parsedBal solanaBalanceResult
		if errUnmarshal := json.Unmarshal(balResBytes, &parsedBal); errUnmarshal == nil {
			results = append(results, blockchain.RawTokenBalance{
				Network:      model.BlockchainNetworkSolana,
				Address:      address,
				TokenAddress: nil,
				Symbol:       "SOL",
				Name:         "Solana",
				Decimals:     9,
				RawBalance:   strconv.FormatUint(parsedBal.Value, 10),
				IsNative:     true,
			})
		}
	} else {
		log.Printf("[WARN] [SolanaAdapter] getBalance failed: %v", errBal)
	}

	// 2. Query both SPL Token and Token-2022 programs
	tokenPrograms := []string{SPLTokenProgramID, Token2022ProgramID}
	for _, progID := range tokenPrograms {
		tokReq := rpcRequest{
			JSONRPC: "2.0",
			ID:      2,
			Method:  "getTokenAccountsByOwner",
			Params: []interface{}{
				address,
				map[string]interface{}{"programId": progID},
				map[string]interface{}{"encoding": "jsonParsed"},
			},
		}
		tokResBytes, errTok := a.doRPCPost(ctx, tokReq)
		if errTok != nil {
			continue
		}

		var parsedTok struct {
			Value []solanaTokenAccountItem `json:"value"`
		}
		if errUnmarshal := json.Unmarshal(tokResBytes, &parsedTok); errUnmarshal == nil {
			for _, item := range parsedTok.Value {
				info := item.Account.Data.Parsed.Info
				mint := info.Mint
				amt := info.TokenAmount.Amount
				if amt == "" || amt == "0" {
					continue
				}

				sym, name, dec := ResolveSolanaTokenMetadata(ctx, mint, a.httpClient)
				decimals := info.TokenAmount.Decimals
				if decimals <= 0 && dec > 0 {
					decimals = dec
				}

				a.RegisterKnownTokenAccount(address, item.Pubkey, mint)

				results = append(results, blockchain.RawTokenBalance{
					Network:      model.BlockchainNetworkSolana,
					Address:      address,
					TokenAddress: &mint,
					Symbol:       sym,
					Name:         name,
					Decimals:     decimals,
					RawBalance:   amt,
					IsNative:     false,
				})
			}
		}
	}

	if errBal != nil && len(results) == 0 {
		return nil, fmt.Errorf("solana rpc failed to fetch balances: %w", errBal)
	}

	return results, nil
}

// FetchTransfers retrieves historical transaction signatures and details with rate limiting
func (a *SolanaAdapter) FetchTransfers(ctx context.Context, net model.BlockchainNetwork, address string, cursor string) (*blockchain.TransferPage, error) {
	if net != model.BlockchainNetworkSolana {
		return nil, fmt.Errorf("network %s not supported by SolanaAdapter", net)
	}

	sigParams := map[string]interface{}{"limit": 25}
	if cursor != "" {
		sigParams["before"] = cursor
	}

	sigReq := rpcRequest{
		JSONRPC: "2.0",
		ID:      10,
		Method:  "getSignaturesForAddress",
		Params:  []interface{}{address, sigParams},
	}

	sigResBytes, err := a.doRPCPost(ctx, sigReq)
	if err != nil {
		return &blockchain.TransferPage{}, nil // fail gracefully without blocking sync
	}

	var sigs []solanaSignatureItem
	if err := json.Unmarshal(sigResBytes, &sigs); err != nil || len(sigs) == 0 {
		return &blockchain.TransferPage{}, nil
	}

	var movements []blockchain.RawTransferMovement
	var nextCursor *string

	for i, sigItem := range sigs {
		if i == len(sigs)-1 {
			nextCursor = &sigItem.Signature
		}

		txReq := rpcRequest{
			JSONRPC: "2.0",
			ID:      20 + i,
			Method:  "getTransaction",
			Params: []interface{}{
				sigItem.Signature,
				map[string]interface{}{
					"encoding":                       "jsonParsed",
					"maxSupportedTransactionVersion": 0,
				},
			},
		}

		txResBytes, errTx := a.doRPCPost(ctx, txReq)
		if errTx != nil {
			continue
		}

		var txResult solanaTransactionResult
		if err := json.Unmarshal(txResBytes, &txResult); err != nil {
			continue
		}

		execTime := time.Now().UTC()
		if txResult.BlockTime != nil {
			execTime = time.Unix(*txResult.BlockTime, 0).UTC()
		}

		feeStr := strconv.FormatUint(txResult.Meta.Fee, 10)
		rawMeta, _ := json.Marshal(txResult)

		// Reconstruct full account keys (static + Address Lookup Table loadedAddresses)
		allAccountKeys := make([]string, 0, len(txResult.Transaction.Message.AccountKeys)+len(txResult.Meta.LoadedAddresses.Writable)+len(txResult.Meta.LoadedAddresses.Readonly))
		for _, keyObj := range txResult.Transaction.Message.AccountKeys {
			switch v := keyObj.(type) {
			case string:
				allAccountKeys = append(allAccountKeys, v)
			case map[string]interface{}:
				if pk, ok := v["pubkey"].(string); ok {
					allAccountKeys = append(allAccountKeys, pk)
				}
			}
		}
		allAccountKeys = append(allAccountKeys, txResult.Meta.LoadedAddresses.Writable...)
		allAccountKeys = append(allAccountKeys, txResult.Meta.LoadedAddresses.Readonly...)

		// 1. Detect Native SOL delta for the wallet
		accIdx := -1
		for idx, keyStr := range allAccountKeys {
			if keyStr == address {
				accIdx = idx
				break
			}
		}

		hasNativeDelta := false
		if accIdx >= 0 && accIdx < len(txResult.Meta.PreBalances) && accIdx < len(txResult.Meta.PostBalances) {
			pre := txResult.Meta.PreBalances[accIdx]
			post := txResult.Meta.PostBalances[accIdx]
			isFeePayer := accIdx == 0

			if isFeePayer {
				// Wallet is fee payer: pre-post already includes meta.Fee
				if pre > post {
					grossOutflow := uint64(pre - post)
					fee := txResult.Meta.Fee
					var transferAmt uint64
					if grossOutflow >= fee {
						transferAmt = grossOutflow - fee
					}

					hasNativeDelta = true
					if transferAmt > 0 {
						movements = append(movements, blockchain.RawTransferMovement{
							TxHash:          sigItem.Signature,
							BlockOrSlot:     int64(txResult.Slot),
							ExecutedAt:      execTime,
							FromAddress:     address,
							ToAddress:       "",
							TokenAddress:    nil,
							RawAmount:       strconv.FormatUint(transferAmt, 10),
							Decimals:        9,
							FeeAmount:       feeStr,
							MovementIndex:   0,
							ProviderSource:  "SOLANA_RPC",
							RawMetadataJSON: rawMeta,
						})
					} else {
						// Fee-only interaction (no native transfer, just fee spent)
						movements = append(movements, blockchain.RawTransferMovement{
							TxHash:          sigItem.Signature,
							BlockOrSlot:     int64(txResult.Slot),
							ExecutedAt:      execTime,
							FromAddress:     address,
							ToAddress:       address,
							TokenAddress:    nil,
							RawAmount:       "0",
							Decimals:        9,
							FeeAmount:       feeStr,
							MovementIndex:   0,
							ProviderSource:  "SOLANA_RPC",
							RawMetadataJSON: rawMeta,
						})
					}
				} else if post > pre {
					// Incoming payment to fee payer
					hasNativeDelta = true
					netInflow := uint64(post - pre)
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     "",
						ToAddress:       address,
						TokenAddress:    nil,
						RawAmount:       strconv.FormatUint(netInflow, 10),
						Decimals:        9,
						FeeAmount:       feeStr,
						MovementIndex:   0,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: rawMeta,
					})
				}
			} else {
				// Wallet is recipient or third-party (fee was paid by accountKeys[0])
				delta := post - pre
				if delta != 0 {
					hasNativeDelta = true
					rawAmt := strconv.FormatInt(delta, 10)
					fromAddr := address
					toAddr := ""
					if delta > 0 {
						fromAddr = ""
						toAddr = address
					} else {
						rawAmt = strconv.FormatInt(-delta, 10)
					}
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     fromAddr,
						ToAddress:       toAddr,
						TokenAddress:    nil,
						RawAmount:       rawAmt,
						Decimals:        9,
						FeeAmount:       "0", // fee paid by sender/fee payer
						MovementIndex:   0,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: rawMeta,
					})
				}
			}
		}

		// 2. Detect SPL Token deltas for the wallet
		preTokenMap := make(map[int]string)
		for _, preTok := range txResult.Meta.PreTokenBalances {
			var ataPubkey string
			if preTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[preTok.AccountIndex]
			}
			isOwner := preTok.Owner == address || (preTok.Owner == "" && ataPubkey != "" && a.isKnownATA(address, ataPubkey))
			if isOwner {
				if ataPubkey != "" && preTok.Mint != "" {
					a.RegisterKnownTokenAccount(address, ataPubkey, preTok.Mint)
				}
				preTokenMap[preTok.AccountIndex] = preTok.UITokenAmount.Amount
			}
		}

		hasTokenDelta := false
		for _, postTok := range txResult.Meta.PostTokenBalances {
			var ataPubkey string
			if postTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[postTok.AccountIndex]
			}
			isOwner := postTok.Owner == address || (postTok.Owner == "" && ataPubkey != "" && a.isKnownATA(address, ataPubkey))
			if !isOwner {
				continue
			}
			if ataPubkey != "" && postTok.Mint != "" {
				a.RegisterKnownTokenAccount(address, ataPubkey, postTok.Mint)
			}

			preAmtStr := preTokenMap[postTok.AccountIndex]
			postAmtStr := postTok.UITokenAmount.Amount

			preBig, _ := new(big.Int).SetString(preAmtStr, 10)
			if preBig == nil {
				preBig = big.NewInt(0)
			}
			postBig, _ := new(big.Int).SetString(postAmtStr, 10)
			if postBig == nil {
				postBig = big.NewInt(0)
			}

			diff := new(big.Int).Sub(postBig, preBig)
			if diff.Sign() != 0 {
				hasTokenDelta = true
				absDiff := new(big.Int).Abs(diff)
				mint := postTok.Mint
				fromAddr := address
				toAddr := ""
				if diff.Sign() > 0 {
					fromAddr = ""
					toAddr = address
				}

				movements = append(movements, blockchain.RawTransferMovement{
					TxHash:          sigItem.Signature,
					BlockOrSlot:     int64(txResult.Slot),
					ExecutedAt:      execTime,
					FromAddress:     fromAddr,
					ToAddress:       toAddr,
					TokenAddress:    &mint,
					RawAmount:       absDiff.String(),
					Decimals:        postTok.UITokenAmount.Decimals,
					FeeAmount:       "0",
					MovementIndex:   100 + postTok.AccountIndex, // Deterministic index for SPL token account
					ProviderSource:  "SOLANA_RPC",
					RawMetadataJSON: rawMeta,
				})
			}
		}

		// Handle closed token accounts (in PreTokenBalances but omitted from PostTokenBalances)
		for _, preTok := range txResult.Meta.PreTokenBalances {
			var ataPubkey string
			if preTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[preTok.AccountIndex]
			}
			isOwner := preTok.Owner == address || (preTok.Owner == "" && ataPubkey != "" && a.isKnownATA(address, ataPubkey))
			if !isOwner {
				continue
			}

			foundInPost := false
			for _, postTok := range txResult.Meta.PostTokenBalances {
				if postTok.AccountIndex == preTok.AccountIndex {
					foundInPost = true
					break
				}
			}

			if !foundInPost {
				preBig, _ := new(big.Int).SetString(preTok.UITokenAmount.Amount, 10)
				if preBig != nil && preBig.Sign() > 0 {
					hasTokenDelta = true
					mint := preTok.Mint
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     address,
						ToAddress:       "",
						TokenAddress:    &mint,
						RawAmount:       preBig.String(),
						Decimals:        preTok.UITokenAmount.Decimals,
						FeeAmount:       "0",
						MovementIndex:   100 + preTok.AccountIndex,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: rawMeta,
					})
				}
			}
		}

		// Fallback for interactions where fees were paid without balance deltas
		if !hasNativeDelta && !hasTokenDelta && feeStr != "0" && accIdx == 0 {
			movements = append(movements, blockchain.RawTransferMovement{
				TxHash:          sigItem.Signature,
				BlockOrSlot:     int64(txResult.Slot),
				ExecutedAt:      execTime,
				FromAddress:     address,
				ToAddress:       address,
				TokenAddress:    nil,
				RawAmount:       "0",
				Decimals:        9,
				FeeAmount:       feeStr,
				MovementIndex:   0,
				ProviderSource:  "SOLANA_RPC",
				RawMetadataJSON: rawMeta,
			})
		}
	}

	return &blockchain.TransferPage{
		Movements:   movements,
		NextPageKey: nextCursor,
	}, nil
}

func (a *SolanaAdapter) doRPCPost(ctx context.Context, req rpcRequest) (json.RawMessage, error) {
	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	maxRetries := 2
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt*500) * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		if errWait := a.rateLimiter.Wait(ctx); errWait != nil {
			return nil, errWait
		}

		httpReq, errHttp := http.NewRequestWithContext(ctx, "POST", a.endpoint, bytes.NewReader(payloadBytes))
		if errHttp != nil {
			return nil, errHttp
		}
		httpReq.Header.Set("Content-Type", "application/json")

		httpResp, errDo := a.httpClient.Do(httpReq)
		if errDo != nil {
			lastErr = errDo
			continue
		}

		bodyBytes, errRead := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if errRead != nil {
			lastErr = errRead
			continue
		}

		if httpResp.StatusCode == http.StatusTooManyRequests || httpResp.StatusCode == http.StatusServiceUnavailable {
			lastErr = fmt.Errorf("solana rpc rate limited HTTP %d", httpResp.StatusCode)
			continue
		}

		if httpResp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("solana rpc returned HTTP %d: %s", httpResp.StatusCode, string(bodyBytes))
		}

		var rpcResp struct {
			JSONRPC string          `json:"jsonrpc"`
			ID      int             `json:"id"`
			Result  json.RawMessage `json:"result"`
			Error   *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}

		if errUnmarshal := json.Unmarshal(bodyBytes, &rpcResp); errUnmarshal != nil {
			return nil, fmt.Errorf("failed to parse Solana JSON-RPC response: %w", errUnmarshal)
		}

		if rpcResp.Error != nil {
			return nil, fmt.Errorf("Solana JSON-RPC error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
		}

		return rpcResp.Result, nil
	}

	return nil, fmt.Errorf("solana rpc failed after %d retries: %w", maxRetries, lastErr)
}
