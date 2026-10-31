package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type JsonRpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type AssetTransfersParams struct {
	FromBlock        string   `json:"fromBlock,omitempty"`
	ToBlock          string   `json:"toBlock,omitempty"`
	FromAddress      string   `json:"fromAddress,omitempty"`
	ToAddress        string   `json:"toAddress,omitempty"`
	Category         []string `json:"category"`
	ExcludeZeroValue bool     `json:"excludeZeroValue"`
	WithMetadata     bool     `json:"withMetadata"`
	MaxCount         string   `json:"maxCount,omitempty"`
	PageKey          string   `json:"pageKey,omitempty"`
}

type RawTransferItem struct {
	BlockNum        string   `json:"blockNum"`
	UniqueId        string   `json:"uniqueId"`
	Hash            string   `json:"hash"`
	From            string   `json:"from"`
	To              string   `json:"to"`
	Value           *float64 `json:"value"`
	RawContract     struct {
		Value   *string `json:"value"`
		Address *string `json:"address"`
		Decimal *string `json:"decimal"`
	} `json:"rawContract"`
	Asset           *string `json:"asset"`
	Category        string  `json:"category"`
	Metadata        struct {
		BlockTimestamp string `json:"blockTimestamp"`
	} `json:"metadata"`
}

type AssetTransfersResult struct {
	Transfers []RawTransferItem `json:"transfers"`
	PageKey   *string           `json:"pageKey,omitempty"`
}

type JsonRpcResponse struct {
	JSONRPC string                `json:"jsonrpc"`
	ID      int                   `json:"id"`
	Result  *AssetTransfersResult `json:"result,omitempty"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// BenchmarkTransfersAPI queries alchemy_getAssetTransfers on a given EVM network
func BenchmarkTransfersAPI(ctx context.Context, apiKey string, networkSubdomain string, address string, pageKey string) (*AssetTransfersResult, time.Duration, error) {
	url := fmt.Sprintf("https://%s.g.alchemy.com/v2/%s", networkSubdomain, apiKey)

	categories := []string{"external", "internal", "erc20"}
	// Arbitrum and Optimism do not index the 'internal' category in Transfers API
	if strings.Contains(networkSubdomain, "arb") || strings.Contains(networkSubdomain, "opt") {
		categories = []string{"external", "erc20"}
	}

	params := AssetTransfersParams{
		FromBlock:        "0x0",
		ToAddress:        address,
		Category:         categories,
		ExcludeZeroValue: true,
		WithMetadata:     true,
		MaxCount:         "0x19", // 25 transfers
		PageKey:          pageKey,
	}

	rpcReq := JsonRpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "alchemy_getAssetTransfers",
		Params:  []AssetTransfersParams{params},
	}

	jsonBytes, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, 0, err
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	duration := time.Since(start)
	if err != nil {
		return nil, duration, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, duration, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, duration, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var rpcResp JsonRpcResponse
	if err := json.Unmarshal(bodyBytes, &rpcResp); err != nil {
		return nil, duration, fmt.Errorf("failed to unmarshal JSON-RPC: %w (body: %s)", err, string(bodyBytes))
	}

	if rpcResp.Error != nil {
		return nil, duration, fmt.Errorf("JSON-RPC error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, duration, nil
}
