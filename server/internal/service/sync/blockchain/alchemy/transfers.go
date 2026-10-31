package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
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

// fetchEVMTransfers queries alchemy_getAssetTransfers for an EVM chain
func (c *Client) fetchEVMTransfers(ctx context.Context, net model.BlockchainNetwork, address string, pageKey string) (*blockchain.TransferPage, error) {
	subdomain, err := NetworkToAlchemySubdomain(net)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://%s.g.alchemy.com/v2/%s", subdomain, c.apiKey)

	categories := []string{"external", "internal", "erc20"}
	if net == model.BlockchainNetworkArbitrum || net == model.BlockchainNetworkOptimism {
		categories = []string{"external", "erc20"}
	}

	params := AssetTransfersParams{
		FromBlock:        "0x0",
		ToAddress:        address,
		Category:         categories,
		ExcludeZeroValue: true,
		WithMetadata:     true,
		MaxCount:         "0x64", // 100 items per page
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
		return nil, err
	}

	// Record CU consumption (~150 CUs for getAssetTransfers)
	if c.cuTracker != nil {
		_, _ = c.cuTracker.RecordConsumption(ctx, 150)
	}

	bodyBytes, err := c.doPost(ctx, url, jsonBytes)
	if err != nil {
		return nil, err
	}

	var rpcResp JsonRpcResponse
	if err := json.Unmarshal(bodyBytes, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON-RPC transfers response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("alchemy transfers JSON-RPC error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	if rpcResp.Result == nil {
		return &blockchain.TransferPage{}, nil
	}

	var movements []blockchain.RawTransferMovement
	for _, tx := range rpcResp.Result.Transfers {
		blockNum, _ := strconv.ParseInt(strings.TrimPrefix(tx.BlockNum, "0x"), 16, 64)

		execTime := time.Now().UTC()
		if tx.Metadata.BlockTimestamp != "" {
			if parsedT, errT := time.Parse(time.RFC3339, tx.Metadata.BlockTimestamp); errT == nil {
				execTime = parsedT
			}
		}

		rawAmt := "0"
		if tx.RawContract.Value != nil && *tx.RawContract.Value != "" {
			hexVal := strings.TrimPrefix(*tx.RawContract.Value, "0x")
			bi := new(big.Int)
			bi.SetString(hexVal, 16)
			rawAmt = bi.String()
		} else if tx.Value != nil {
			// Fallback: value * 10^18
			valBig := big.NewFloat(*tx.Value)
			valBig.Mul(valBig, big.NewFloat(1e18))
			bi, _ := valBig.Int(nil)
			if bi != nil {
				rawAmt = bi.String()
			}
		}

		decimals := 18
		if tx.RawContract.Decimal != nil && *tx.RawContract.Decimal != "" {
			hexDec := strings.TrimPrefix(*tx.RawContract.Decimal, "0x")
			dec64, _ := strconv.ParseInt(hexDec, 16, 32)
			if dec64 > 0 {
				decimals = int(dec64)
			}
		}

		mvtIndex := 0
		if strings.Contains(tx.UniqueId, ":log_") {
			parts := strings.Split(tx.UniqueId, ":log_")
			if len(parts) == 2 {
				if idx, err := strconv.Atoi(parts[1]); err == nil {
					mvtIndex = idx
				}
			}
		} else if strings.Contains(tx.UniqueId, ":internal_") {
			parts := strings.Split(tx.UniqueId, ":internal_")
			if len(parts) == 2 {
				if idx, err := strconv.Atoi(parts[1]); err == nil {
					mvtIndex = 1000 + idx
				}
			}
		}

		rawMeta, _ := json.Marshal(tx)

		movements = append(movements, blockchain.RawTransferMovement{
			TxHash:          tx.Hash,
			BlockOrSlot:     blockNum,
			ExecutedAt:      execTime,
			FromAddress:     tx.From,
			ToAddress:       tx.To,
			TokenAddress:    tx.RawContract.Address,
			RawAmount:       rawAmt,
			Decimals:        decimals,
			FeeAmount:       "0",
			MovementIndex:   mvtIndex,
			ProviderSource:  "ALCHEMY",
			RawMetadataJSON: rawMeta,
		})
	}

	return &blockchain.TransferPage{
		Movements:   movements,
		NextPageKey: rpcResp.Result.PageKey,
	}, nil
}
