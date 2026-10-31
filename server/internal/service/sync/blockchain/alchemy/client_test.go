package alchemy

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
)

type roundTripFunc func(req *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func newTestHTTPClient(fn roundTripFunc) *http.Client {
	return &http.Client{
		Transport: fn,
	}
}

func TestClient_SupportsNetwork(t *testing.T) {
	client := NewClient("test-key")

	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkEthereum))
	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkBase))
	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkArbitrum))
	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkOptimism))
	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkPolygon))
	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkSolana))
	assert.True(t, client.SupportsNetwork(model.BlockchainNetworkBitcoin))

	assert.False(t, client.SupportsNetwork(model.BlockchainNetwork("DOGE")))
}

func TestClient_FetchBalances_EVM(t *testing.T) {
	mockResponseJSON := `{
		"data": {
			"tokens": [
				{
					"network": "eth-mainnet",
					"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					"tokenAddress": null,
					"tokenBalance": "0x000000000000000000000000000000000000000000000000502f14b6df19176f",
					"symbol": "ETH",
					"name": "Ethereum",
					"decimals": 18
				},
				{
					"network": "eth-mainnet",
					"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					"tokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
					"tokenBalance": "0x0000000000000000000000000000000000000000000000000000000005f5e100",
					"symbol": "USDC",
					"name": "USD Coin",
					"decimals": 6
				}
			]
		}
	}`

	httpClient := newTestHTTPClient(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(mockResponseJSON)),
			Header:     make(http.Header),
		}
	})

	tracker := NewCUTracker(nil)
	client := NewClient("test-key", WithHTTPClient(httpClient), WithCUTracker(tracker))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	balances, err := client.FetchBalances(ctx, model.BlockchainNetworkEthereum, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	assert.NoError(t, err)
	assert.Len(t, balances, 2)

	// Check native ETH
	assert.Equal(t, "ETH", balances[0].Symbol)
	assert.True(t, balances[0].IsNative)
	assert.Equal(t, 18, balances[0].Decimals)

	// Check USDC
	assert.Equal(t, "USDC", balances[1].Symbol)
	assert.False(t, balances[1].IsNative)
	assert.Equal(t, 6, balances[1].Decimals)
	assert.Equal(t, "100000000", balances[1].RawBalance) // 0x5f5e100 = 100,000,000 in decimal (100 USDC)

	// Verify CU consumption was recorded
	_, consumed, _, _ := tracker.GetStatus()
	assert.Equal(t, int64(20), consumed)
}

func TestClient_FetchTransfers_ArbitrumExcludesInternal(t *testing.T) {
	var requestedCategories []string

	httpClient := newTestHTTPClient(func(req *http.Request) *http.Response {
		body, _ := io.ReadAll(req.Body)
		var rpcReq JsonRpcRequest
		_ = json.Unmarshal(body, &rpcReq)

		if params, ok := rpcReq.Params.([]interface{}); ok && len(params) > 0 {
			if paramMap, okMap := params[0].(map[string]interface{}); okMap {
				if cats, okCats := paramMap["category"].([]interface{}); okCats {
					for _, c := range cats {
						requestedCategories = append(requestedCategories, c.(string))
					}
				}
			}
		}

		mockResp := `{
			"jsonrpc": "2.0",
			"id": 1,
			"result": {
				"transfers": []
			}
		}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(mockResp)),
			Header:     make(http.Header),
		}
	})

	client := NewClient("test-key", WithHTTPClient(httpClient))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := client.FetchTransfers(ctx, model.BlockchainNetworkArbitrum, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "")
	assert.NoError(t, err)

	// Confirm 'internal' is NOT in the requested categories for Arbitrum
	for _, cat := range requestedCategories {
		assert.NotEqual(t, "internal", cat, "Arbitrum must not query internal transfers")
	}
}

func TestClient_CircuitBreaker(t *testing.T) {
	httpClient := newTestHTTPClient(func(req *http.Request) *http.Response {
		return &http.Response{
			StatusCode: http.StatusInternalServerError,
			Body:       io.NopCloser(strings.NewReader(`{"error": "internal node error"}`)),
			Header:     make(http.Header),
		}
	})

	client := NewClient("test-key", WithHTTPClient(httpClient))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Cause 5 consecutive failures to trip circuit breaker
	for i := 0; i < 5; i++ {
		_, _ = client.FetchBalances(ctx, model.BlockchainNetworkEthereum, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	}

	// 6th call should be immediately blocked by circuit breaker
	_, err := client.FetchBalances(ctx, model.BlockchainNetworkEthereum, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "circuit breaker is open")
}
