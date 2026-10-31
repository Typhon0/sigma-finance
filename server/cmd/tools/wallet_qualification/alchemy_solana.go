package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
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

type SolanaSignatureItem struct {
	Signature string      `json:"signature"`
	Slot      uint64      `json:"slot"`
	Err       interface{} `json:"err"`
	Memo      *string     `json:"memo"`
	BlockTime *int64      `json:"blockTime"`
}

// BenchmarkSolanaRPC tests Alchemy Solana endpoint for balance and signatures
func BenchmarkSolanaRPC(ctx context.Context, apiKey string, solanaAddress string) (uint64, []SolanaSignatureItem, time.Duration, error) {
	url := fmt.Sprintf("https://solana-mainnet.g.alchemy.com/v2/%s", apiKey)

	start := time.Now()

	// 1. Get Balance
	balReq := SolanaRpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "getBalance",
		Params:  []interface{}{solanaAddress},
	}
	balBytes, _ := json.Marshal(balReq)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(balBytes))
	if err != nil {
		return 0, nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil, time.Since(start), err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return 0, nil, time.Since(start), fmt.Errorf("Solana getBalance HTTP %d: %s", resp.StatusCode, string(body))
	}

	var parsedBal struct {
		Result SolanaBalanceResult `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &parsedBal); err != nil {
		return 0, nil, time.Since(start), err
	}
	if parsedBal.Error != nil {
		return 0, nil, time.Since(start), fmt.Errorf("Solana getBalance RPC error: %s", parsedBal.Error.Message)
	}

	// 2. Get Signatures (History)
	sigReq := SolanaRpcRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "getSignaturesForAddress",
		Params: []interface{}{
			solanaAddress,
			map[string]interface{}{"limit": 10},
		},
	}
	sigBytes, _ := json.Marshal(sigReq)
	req2, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(sigBytes))
	if err != nil {
		return parsedBal.Result.Value, nil, time.Since(start), err
	}
	req2.Header.Set("Content-Type", "application/json")

	resp2, err := http.DefaultClient.Do(req2)
	duration := time.Since(start)
	if err != nil {
		return parsedBal.Result.Value, nil, duration, err
	}
	defer resp2.Body.Close()

	body2, _ := io.ReadAll(resp2.Body)
	if resp2.StatusCode != http.StatusOK {
		return parsedBal.Result.Value, nil, duration, fmt.Errorf("Solana getSignatures HTTP %d: %s", resp2.StatusCode, string(body2))
	}

	var parsedSig struct {
		Result []SolanaSignatureItem `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body2, &parsedSig); err != nil {
		return parsedBal.Result.Value, nil, duration, err
	}
	if parsedSig.Error != nil {
		return parsedBal.Result.Value, nil, duration, fmt.Errorf("Solana getSignatures RPC error: %s", parsedSig.Error.Message)
	}

	return parsedBal.Result.Value, parsedSig.Result, duration, nil
}
