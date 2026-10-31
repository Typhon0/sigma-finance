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

type AddressNetwork struct {
	Address  string   `json:"address"`
	Networks []string `json:"networks"`
}

type PortfolioBalanceRequest struct {
	Addresses            []AddressNetwork `json:"addresses"`
	IncludeNativeTokens  bool             `json:"includeNativeTokens"`
	IncludeErc20Tokens   bool             `json:"includeErc20Tokens"`
	IncludeBlockMetadata bool             `json:"includeBlockMetadata"`
}

type TokenBalanceItem struct {
	Network      string  `json:"network"`
	Address      string  `json:"address"`
	TokenAddress *string `json:"tokenAddress,omitempty"`
	TokenBalance string  `json:"tokenBalance"` // Hex string e.g. "0x000000000000000000000000000000000000000000000000502f14b6df19176f"
	Symbol       *string `json:"symbol,omitempty"`
	Name         *string `json:"name,omitempty"`
	Decimals     *int    `json:"decimals,omitempty"`
	IsNative     bool    `json:"isNative,omitempty"`
}

type PortfolioBalanceResponse struct {
	Data struct {
		Tokens  []TokenBalanceItem `json:"tokens"`
		PageKey *string            `json:"pageKey,omitempty"`
	} `json:"data"`
	Error *struct {
		Message       string `json:"message"`
		PartialErrors []struct {
			Network string `json:"network"`
			Message string `json:"message"`
		} `json:"partialErrors,omitempty"`
	} `json:"error,omitempty"`
}

// BenchmarkPortfolioAPI tests the Multichain Portfolio API for EVM addresses
func BenchmarkPortfolioAPI(ctx context.Context, apiKey string, evmAddress string) (*PortfolioBalanceResponse, time.Duration, error) {
	url := fmt.Sprintf("https://api.g.alchemy.com/data/v1/%s/assets/tokens/balances/by-address", apiKey)

	reqBody := PortfolioBalanceRequest{
		Addresses: []AddressNetwork{
			{
				Address: evmAddress,
				Networks: []string{
					"eth-mainnet",
					"base-mainnet",
					"arb-mainnet",
					"opt-mainnet",
					"matic-mainnet",
				},
			},
		},
		IncludeNativeTokens: true,
		IncludeErc20Tokens:  true,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal request: %w", err)
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	duration := time.Since(start)
	if err != nil {
		return nil, duration, fmt.Errorf("portfolio API request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, duration, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, duration, fmt.Errorf("portfolio API HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var parsed PortfolioBalanceResponse
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return nil, duration, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return &parsed, duration, nil
}
