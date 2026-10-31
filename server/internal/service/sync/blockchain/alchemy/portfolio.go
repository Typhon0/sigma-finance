package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

// NetworkSubdomain maps a domain model BlockchainNetwork to Alchemy network identifier
func NetworkToAlchemySubdomain(net model.BlockchainNetwork) (string, error) {
	switch net {
	case model.BlockchainNetworkEthereum:
		return "eth-mainnet", nil
	case model.BlockchainNetworkBase:
		return "base-mainnet", nil
	case model.BlockchainNetworkArbitrum:
		return "arb-mainnet", nil
	case model.BlockchainNetworkOptimism:
		return "opt-mainnet", nil
	case model.BlockchainNetworkPolygon:
		return "polygon-mainnet", nil
	case model.BlockchainNetworkSolana:
		return "solana-mainnet", nil
	default:
		return "", fmt.Errorf("unsupported alchemy network: %s", net)
	}
}

// Portfolio API Request and Response types
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
	TokenBalance string  `json:"tokenBalance"` // Hex or decimal string
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

// fetchEVMBalances calls the Multichain Portfolio API
func (c *Client) fetchEVMBalances(ctx context.Context, net model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	alchemyNet, err := NetworkToAlchemySubdomain(net)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://api.g.alchemy.com/data/v1/%s/assets/tokens/balances/by-address", c.apiKey)

	reqBody := PortfolioBalanceRequest{
		Addresses: []AddressNetwork{
			{
				Address:  address,
				Networks: []string{alchemyNet},
			},
		},
		IncludeNativeTokens: true,
		IncludeErc20Tokens:  true,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal portfolio balance request: %w", err)
	}

	// Record CU consumption (~20 CUs for portfolio request)
	if c.cuTracker != nil {
		_, _ = c.cuTracker.RecordConsumption(ctx, 20)
	}

	bodyBytes, err := c.doPost(ctx, url, jsonBytes)
	if err != nil {
		return nil, err
	}

	var parsed PortfolioBalanceResponse
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return nil, fmt.Errorf("failed to decode portfolio balance response: %w", err)
	}

	// Check if the requested network had a partial error
	if parsed.Error != nil {
		for _, pe := range parsed.Error.PartialErrors {
			if strings.EqualFold(pe.Network, alchemyNet) {
				return nil, fmt.Errorf("alchemy partial error on %s: %s", alchemyNet, pe.Message)
			}
		}
	}

	var results []blockchain.RawTokenBalance
	for _, tok := range parsed.Data.Tokens {
		// Convert hex balance (e.g. 0x000...502f14) to decimal base-10 string
		rawStr := tok.TokenBalance
		if strings.HasPrefix(rawStr, "0x") || strings.HasPrefix(rawStr, "0X") {
			bi := new(big.Int)
			bi.SetString(rawStr[2:], 16)
			rawStr = bi.String()
		}

		decimals := 18
		if tok.Decimals != nil && *tok.Decimals > 0 {
			decimals = *tok.Decimals
		}

		sym := "ETH"
		if net == model.BlockchainNetworkPolygon {
			sym = "POL"
		}
		if tok.Symbol != nil && *tok.Symbol != "" {
			sym = *tok.Symbol
		}

		name := sym
		if tok.Name != nil && *tok.Name != "" {
			name = *tok.Name
		}

		isNative := tok.TokenAddress == nil || *tok.TokenAddress == ""

		results = append(results, blockchain.RawTokenBalance{
			Network:      net,
			Address:      address,
			TokenAddress: tok.TokenAddress,
			Symbol:       sym,
			Name:         name,
			Decimals:     decimals,
			RawBalance:   rawStr,
			IsNative:     isNative,
		})
	}

	return results, nil
}
