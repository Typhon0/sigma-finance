package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"strconv"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

type SolanaRpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type SolanaBalanceResult struct {
	Context struct {
		Slot uint64 `json:"slot"`
	} `json:"context"`
	Value uint64 `json:"value"` // lamports
}

type SolanaTokenAccountItem struct {
	Pubkey  string `json:"pubkey"`
	Account struct {
		Data struct {
			Parsed struct {
				Info struct {
					Mint        string `json:"mint"`
					TokenAmount struct {
						Amount         string  `json:"amount"` // raw amount string
						Decimals       int     `json:"decimals"`
						UIAmountString *string `json:"uiAmountString"`
					} `json:"tokenAmount"`
				} `json:"info"`
			} `json:"parsed"`
		} `json:"data"`
	} `json:"account"`
}

type SolanaSignatureItem struct {
	Signature string      `json:"signature"`
	Slot      uint64      `json:"slot"`
	Err       interface{} `json:"err"`
	Memo      *string     `json:"memo"`
	BlockTime *int64      `json:"blockTime"`
}

type SolanaTransactionResponseItem struct {
	ID     int                      `json:"id"`
	Result *SolanaTransactionResult `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type SolanaTransactionResult struct {
	BlockTime *int64 `json:"blockTime"`
	Slot      uint64 `json:"slot"`
	Meta      struct {
		Err              interface{} `json:"err"`
		Fee              uint64      `json:"fee"`
		PreBalances      []int64     `json:"preBalances"`
		PostBalances     []int64     `json:"postBalances"`
		PreTokenBalances []struct {
			AccountIndex  int    `json:"accountIndex"`
			Mint          string `json:"mint"`
			Owner         string `json:"owner"`
			UITokenAmount struct {
				Amount   string `json:"amount"`
				Decimals int    `json:"decimals"`
			} `json:"uiTokenAmount"`
		} `json:"preTokenBalances"`
		PostTokenBalances []struct {
			AccountIndex  int    `json:"accountIndex"`
			Mint          string `json:"mint"`
			Owner         string `json:"owner"`
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

// fetchSolanaBalances fetches native SOL and SPL token balances
func (c *Client) fetchSolanaBalances(ctx context.Context, address string) ([]blockchain.RawTokenBalance, error) {
	url := fmt.Sprintf("https://solana-mainnet.g.alchemy.com/v2/%s", c.apiKey)
	if c.apiKey == "" {
		url = "https://api.mainnet-beta.solana.com"
	}

	// Record CU consumption
	if c.apiKey != "" && c.cuTracker != nil {
		_, _ = c.cuTracker.RecordConsumption(ctx, 40)
	}

	var results []blockchain.RawTokenBalance

	// 1. Native SOL Balance
	balReq := SolanaRpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "getBalance",
		Params:  []interface{}{address},
	}
	balBytes, _ := json.Marshal(balReq)
	balResBytes, err := c.doPost(ctx, url, balBytes)
	if err != nil && url != "https://api.mainnet-beta.solana.com" {
		log.Printf("[WARN] [Alchemy] Solana getBalance failed from %s: %v. Falling back to public cluster...", url, err)
		url = "https://api.mainnet-beta.solana.com"
		balResBytes, err = c.doPost(ctx, url, balBytes)
	}
	if err == nil {
		var parsedBal struct {
			Result SolanaBalanceResult `json:"result"`
			Error  *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if errUnmarshal := json.Unmarshal(balResBytes, &parsedBal); errUnmarshal == nil && parsedBal.Error == nil {
			results = append(results, blockchain.RawTokenBalance{
				Network:      model.BlockchainNetworkSolana,
				Address:      address,
				TokenAddress: nil,
				Symbol:       "SOL",
				Name:         "Solana",
				Decimals:     9,
				RawBalance:   strconv.FormatUint(parsedBal.Result.Value, 10),
				IsNative:     true,
			})
		}
	}

	// 2. SPL Token Accounts
	splReq := SolanaRpcRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "getTokenAccountsByOwner",
		Params: []interface{}{
			address,
			map[string]interface{}{
				"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
			},
			map[string]interface{}{
				"encoding": "jsonParsed",
			},
		},
	}
	splBytes, _ := json.Marshal(splReq)
	splResBytes, err := c.doPost(ctx, url, splBytes)
	if err != nil && url != "https://api.mainnet-beta.solana.com" {
		log.Printf("[WARN] [Alchemy] Solana getTokenAccountsByOwner failed from %s: %v. Falling back to public cluster...", url, err)
		url = "https://api.mainnet-beta.solana.com"
		splResBytes, err = c.doPost(ctx, url, splBytes)
	}
	if err == nil {
		var parsedSPL struct {
			Result struct {
				Value []SolanaTokenAccountItem `json:"value"`
			} `json:"result"`
			Error *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if errUnmarshal := json.Unmarshal(splResBytes, &parsedSPL); errUnmarshal == nil && parsedSPL.Error == nil {
			for _, item := range parsedSPL.Result.Value {
				info := item.Account.Data.Parsed.Info
				mint := info.Mint
				amt := info.TokenAmount.Amount
				if amt == "" || amt == "0" {
					continue
				}

				sym, name, dec := ResolveSolanaTokenMetadata(ctx, mint, c.httpClient)
				decimals := info.TokenAmount.Decimals
				if decimals <= 0 && dec > 0 {
					decimals = dec
				}

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

	return results, nil
}

// fetchSolanaTransfers queries signatures and transactions for Solana
func (c *Client) fetchSolanaTransfers(ctx context.Context, address string, cursor string) (*blockchain.TransferPage, error) {
	url := fmt.Sprintf("https://solana-mainnet.g.alchemy.com/v2/%s", c.apiKey)
	if c.apiKey == "" {
		url = "https://api.mainnet-beta.solana.com"
	}

	limit := 50
	paramsMap := map[string]interface{}{
		"limit": limit,
	}
	if cursor != "" {
		paramsMap["before"] = cursor
	}

	sigReq := SolanaRpcRequest{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "getSignaturesForAddress",
		Params: []interface{}{
			address,
			paramsMap,
		},
	}
	sigBytes, _ := json.Marshal(sigReq)

	if c.apiKey != "" && c.cuTracker != nil {
		_, _ = c.cuTracker.RecordConsumption(ctx, 30)
	}

	resBytes, err := c.doPost(ctx, url, sigBytes)
	if err != nil && url != "https://api.mainnet-beta.solana.com" {
		log.Printf("[WARN] [Alchemy] Solana getSignaturesForAddress failed from %s: %v. Falling back to public cluster...", url, err)
		url = "https://api.mainnet-beta.solana.com"
		resBytes, err = c.doPost(ctx, url, sigBytes)
	}
	if err != nil {
		return nil, err
	}

	var parsed struct {
		Result []SolanaSignatureItem `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(resBytes, &parsed); err != nil {
		return nil, err
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("solana signatures error: %s", parsed.Error.Message)
	}

	var movements []blockchain.RawTransferMovement
	var lastSig *string

	if len(parsed.Result) == 0 {
		return &blockchain.TransferPage{
			Movements:   movements,
			NextPageKey: nil,
		}, nil
	}

	lastSigStr := parsed.Result[len(parsed.Result)-1].Signature
	lastSig = &lastSigStr

	// Fetch transaction details in batches of 20
	chunkSize := 20
	for i := 0; i < len(parsed.Result); i += chunkSize {
		end := i + chunkSize
		if end > len(parsed.Result) {
			end = len(parsed.Result)
		}
		chunk := parsed.Result[i:end]

		var batch []SolanaRpcRequest
		for idx, sigItem := range chunk {
			batch = append(batch, SolanaRpcRequest{
				JSONRPC: "2.0",
				ID:      idx + 1,
				Method:  "getTransaction",
				Params: []interface{}{
					sigItem.Signature,
					map[string]interface{}{
						"encoding":                       "jsonParsed",
						"maxSupportedTransactionVersion": 0,
					},
				},
			})
		}

		batchBytes, _ := json.Marshal(batch)
		if c.apiKey != "" && c.cuTracker != nil {
			_, _ = c.cuTracker.RecordConsumption(ctx, int64(25*len(batch)))
		}

		resBatchBytes, errBatch := c.doPost(ctx, url, batchBytes)
		if errBatch != nil && url != "https://api.mainnet-beta.solana.com" {
			log.Printf("[WARN] [Alchemy] Solana batch getTransaction failed from %s: %v. Falling back to public cluster...", url, errBatch)
			url = "https://api.mainnet-beta.solana.com"
			resBatchBytes, errBatch = c.doPost(ctx, url, batchBytes)
		}
		if errBatch != nil {
			log.Printf("[WARN] [Alchemy.fetchSolanaTransfers] Batch getTransaction failed: %v", errBatch)
			continue
		}

		var batchRes []SolanaTransactionResponseItem
		if errUnmarshal := json.Unmarshal(resBatchBytes, &batchRes); errUnmarshal != nil {
			log.Printf("[WARN] [Alchemy.fetchSolanaTransfers] Failed to parse batch response: %v", errUnmarshal)
			continue
		}

		resMap := make(map[int]*SolanaTransactionResult)
		for _, bItem := range batchRes {
			if bItem.Error == nil && bItem.Result != nil {
				resMap[bItem.ID] = bItem.Result
			}
		}

		for idx, sigItem := range chunk {
			reqID := idx + 1
			txResult, ok := resMap[reqID]
			metaBytes, _ := json.Marshal(sigItem)

			t := time.Now().UTC()
			if sigItem.BlockTime != nil {
				t = time.Unix(*sigItem.BlockTime, 0).UTC()
			} else if txResult != nil && txResult.BlockTime != nil {
				t = time.Unix(*txResult.BlockTime, 0).UTC()
			}

			if !ok || txResult == nil {
				movements = append(movements, blockchain.RawTransferMovement{
					TxHash:          sigItem.Signature,
					BlockOrSlot:     int64(sigItem.Slot),
					ExecutedAt:      t,
					FromAddress:     "",
					ToAddress:       address,
					TokenAddress:    nil,
					RawAmount:       "0",
					Decimals:        9,
					FeeAmount:       "5000",
					ProviderSource:  "ALCHEMY",
					RawMetadataJSON: metaBytes,
				})
				continue
			}

			txMovements := parseSolanaTransactionMovements(address, sigItem.Signature, int64(sigItem.Slot), t, txResult, metaBytes)
			if len(txMovements) == 0 {
				feeStr := strconv.FormatUint(txResult.Meta.Fee, 10)
				if feeStr == "0" {
					feeStr = "5000"
				}
				movements = append(movements, blockchain.RawTransferMovement{
					TxHash:          sigItem.Signature,
					BlockOrSlot:     int64(sigItem.Slot),
					ExecutedAt:      t,
					FromAddress:     address,
					ToAddress:       address,
					TokenAddress:    nil,
					RawAmount:       "0",
					Decimals:        9,
					FeeAmount:       feeStr,
					ProviderSource:  "ALCHEMY",
					RawMetadataJSON: metaBytes,
				})
			} else {
				movements = append(movements, txMovements...)
			}
		}
	}

	return &blockchain.TransferPage{
		Movements:   movements,
		NextPageKey: lastSig,
	}, nil
}

func parseSolanaTransactionMovements(
	address string,
	sig string,
	slot int64,
	executedAt time.Time,
	tx *SolanaTransactionResult,
	metaBytes []byte,
) []blockchain.RawTransferMovement {
	var results []blockchain.RawTransferMovement
	feeStr := strconv.FormatUint(tx.Meta.Fee, 10)
	if feeStr == "0" {
		feeStr = "5000"
	}

	// 1. Native SOL delta for the wallet address
	userAccountIndex := -1
	for idx, keyObj := range tx.Transaction.Message.AccountKeys {
		var keyStr string
		switch k := keyObj.(type) {
		case string:
			keyStr = k
		case map[string]interface{}:
			if pk, ok := k["pubkey"].(string); ok {
				keyStr = pk
			}
		}
		if keyStr == address {
			userAccountIndex = idx
			break
		}
	}

	if userAccountIndex >= 0 &&
		userAccountIndex < len(tx.Meta.PreBalances) &&
		userAccountIndex < len(tx.Meta.PostBalances) {
		preBal := tx.Meta.PreBalances[userAccountIndex]
		postBal := tx.Meta.PostBalances[userAccountIndex]
		delta := postBal - preBal

		if delta > 0 {
			results = append(results, blockchain.RawTransferMovement{
				TxHash:          sig,
				BlockOrSlot:     slot,
				ExecutedAt:      executedAt,
				FromAddress:     "",
				ToAddress:       address,
				TokenAddress:    nil,
				RawAmount:       strconv.FormatInt(delta, 10),
				Decimals:        9,
				FeeAmount:       feeStr,
				ProviderSource:  "ALCHEMY",
				RawMetadataJSON: metaBytes,
			})
		} else if delta < 0 {
			outLamports := -delta
			if userAccountIndex == 0 && outLamports > int64(tx.Meta.Fee) {
				outLamports -= int64(tx.Meta.Fee)
			}
			if outLamports > 0 {
				results = append(results, blockchain.RawTransferMovement{
					TxHash:          sig,
					BlockOrSlot:     slot,
					ExecutedAt:      executedAt,
					FromAddress:     address,
					ToAddress:       "",
					TokenAddress:    nil,
					RawAmount:       strconv.FormatInt(outLamports, 10),
					Decimals:        9,
					FeeAmount:       feeStr,
					ProviderSource:  "ALCHEMY",
					RawMetadataJSON: metaBytes,
				})
			}
		}
	}

	// 2. SPL Token Deltas for the wallet address
	preTokens := make(map[string]struct {
		amount   *big.Int
		decimals int
	})
	for _, tb := range tx.Meta.PreTokenBalances {
		if tb.Owner == address {
			amt, ok := new(big.Int).SetString(tb.UITokenAmount.Amount, 10)
			if ok && amt != nil {
				preTokens[tb.Mint] = struct {
					amount   *big.Int
					decimals int
				}{amt, tb.UITokenAmount.Decimals}
			}
		}
	}

	postTokens := make(map[string]struct {
		amount   *big.Int
		decimals int
	})
	for _, tb := range tx.Meta.PostTokenBalances {
		if tb.Owner == address {
			amt, ok := new(big.Int).SetString(tb.UITokenAmount.Amount, 10)
			if ok && amt != nil {
				postTokens[tb.Mint] = struct {
					amount   *big.Int
					decimals int
				}{amt, tb.UITokenAmount.Decimals}
			}
		}
	}

	allMints := make(map[string]bool)
	for m := range preTokens {
		allMints[m] = true
	}
	for m := range postTokens {
		allMints[m] = true
	}

	for mint := range allMints {
		pre := big.NewInt(0)
		dec := 9
		if p, ok := preTokens[mint]; ok {
			pre = p.amount
			dec = p.decimals
		}
		post := big.NewInt(0)
		if p, ok := postTokens[mint]; ok {
			post = p.amount
			dec = p.decimals
		}

		diff := new(big.Int).Sub(post, pre)
		mintCopy := mint
		if diff.Sign() > 0 {
			results = append(results, blockchain.RawTransferMovement{
				TxHash:          sig,
				BlockOrSlot:     slot,
				ExecutedAt:      executedAt,
				FromAddress:     "",
				ToAddress:       address,
				TokenAddress:    &mintCopy,
				RawAmount:       diff.String(),
				Decimals:        dec,
				FeeAmount:       "0",
				ProviderSource:  "ALCHEMY",
				RawMetadataJSON: metaBytes,
			})
		} else if diff.Sign() < 0 {
			absDiff := new(big.Int).Neg(diff)
			results = append(results, blockchain.RawTransferMovement{
				TxHash:          sig,
				BlockOrSlot:     slot,
				ExecutedAt:      executedAt,
				FromAddress:     address,
				ToAddress:       "",
				TokenAddress:    &mintCopy,
				RawAmount:       absDiff.String(),
				Decimals:        dec,
				FeeAmount:       "0",
				ProviderSource:  "ALCHEMY",
				RawMetadataJSON: metaBytes,
			})
		}
	}

	return results
}
