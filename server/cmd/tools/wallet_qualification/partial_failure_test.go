package main

import (
	"encoding/json"
	"testing"
)

func TestPartialFailureParsing(t *testing.T) {
	// Sample mock payload from Alchemy Multichain Portfolio API with a partial failure on solana-mainnet
	mockPayload := []byte(`{
		"data": {
			"tokens": [
				{
					"network": "eth-mainnet",
					"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					"tokenAddress": null,
					"tokenBalance": "0x000000000000000000000000000000000000000000000000502f14b6df19176f"
				},
				{
					"network": "base-mainnet",
					"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					"tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					"tokenBalance": "0x0000000000000000000000000000000000000000000000000000000005f5e100"
				}
			],
			"pageKey": "test-cursor-key"
		},
		"error": {
			"message": "Failed to fetch tokens on certain networks",
			"partialErrors": [
				{
					"network": "solana-mainnet",
					"message": "RPC timeout"
				}
			]
		}
	}`)

	var resp PortfolioBalanceResponse
	err := json.Unmarshal(mockPayload, &resp)
	if err != nil {
		t.Fatalf("failed to unmarshal mock payload: %v", err)
	}

	if len(resp.Data.Tokens) != 2 {
		t.Errorf("expected 2 successful data items, got %d", len(resp.Data.Tokens))
	}

	if resp.Error == nil || len(resp.Error.PartialErrors) != 1 {
		t.Fatalf("expected 1 network error in partialErrors, got %+v", resp.Error)
	}

	if resp.Error.PartialErrors[0].Network != "solana-mainnet" {
		t.Errorf("expected solana-mainnet error, got %s", resp.Error.PartialErrors[0].Network)
	}

	// Verify ETH balance
	ethItem := resp.Data.Tokens[0]
	if ethItem.Network != "eth-mainnet" || ethItem.TokenBalance != "0x000000000000000000000000000000000000000000000000502f14b6df19176f" {
		t.Errorf("unexpected ETH item: %+v", ethItem)
	}

	// Verify Base USDC balance
	baseItem := resp.Data.Tokens[1]
	if baseItem.Network != "base-mainnet" || baseItem.TokenBalance != "0x0000000000000000000000000000000000000000000000000000000005f5e100" {
		t.Errorf("unexpected Base item: %+v", baseItem)
	}
}
