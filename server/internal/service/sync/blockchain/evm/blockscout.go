package evm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/time/rate"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

// BlockscoutClient handles free keyless historical transfer queries on supported L2 chains
type BlockscoutClient struct {
	httpClient  *http.Client
	rateLimiter *rate.Limiter
}

func NewBlockscoutClient() *BlockscoutClient {
	return &BlockscoutClient{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		rateLimiter: rate.NewLimiter(rate.Every(300*time.Millisecond), 3), // max ~3 req/sec to be polite
	}
}

type blockscoutTxItem struct {
	BlockNumber       string `json:"blockNumber"`
	TimeStamp         string `json:"timeStamp"`
	Hash              string `json:"hash"`
	From              string `json:"from"`
	To                string `json:"to"`
	Value             string `json:"value"`
	GasUsed           string `json:"gasUsed"`
	GasPrice          string `json:"gasPrice"`
	EffectiveGasPrice string `json:"effectiveGasPrice"`
	L1Fee             string `json:"l1Fee"`
	IsError           string `json:"isError"`
	ContractAddress   string `json:"contractAddress"`
	TokenName         string `json:"tokenName"`
	TokenSymbol       string `json:"tokenSymbol"`
	TokenDecimal      string `json:"tokenDecimal"`
	LogIndex          string `json:"logIndex"`
	TraceID           string `json:"traceId"`
	Type              string `json:"type"`
}

func parseBigInt(val string) (*big.Int, bool) {
	clean := strings.TrimSpace(val)
	if strings.HasPrefix(clean, "0x") || strings.HasPrefix(clean, "0X") {
		return new(big.Int).SetString(clean[2:], 16)
	}
	return new(big.Int).SetString(clean, 10)
}

// calculateTotalTxFee calculates execution fee + OP Stack L1 data fee for the sender
func calculateTotalTxFee(tx blockscoutTxItem, userAddress string) string {
	if !strings.EqualFold(tx.From, userAddress) {
		return "0"
	}

	priceStr := tx.EffectiveGasPrice
	if priceStr == "" {
		priceStr = tx.GasPrice
	}

	gasUsed, ok1 := parseBigInt(tx.GasUsed)
	gasPrice, ok2 := parseBigInt(priceStr)
	if !ok1 || !ok2 {
		return "0"
	}

	executionFee := new(big.Int).Mul(gasUsed, gasPrice)

	if tx.L1Fee != "" && tx.L1Fee != "0" {
		if l1Fee, okL1 := parseBigInt(tx.L1Fee); okL1 && l1Fee.Sign() > 0 {
			return new(big.Int).Add(executionFee, l1Fee).String()
		}
	}

	return executionFee.String()
}

type blockscoutResponse struct {
	Status  string             `json:"status"`
	Message string             `json:"message"`
	Result  json.RawMessage    `json:"result"`
}

// GetBlockscoutEndpoint returns the base API endpoint for supported networks
func GetBlockscoutEndpoint(net model.BlockchainNetwork) string {
	switch net {
	case model.BlockchainNetworkBase:
		return "https://base.blockscout.com/api"
	case model.BlockchainNetworkArbitrum:
		return "https://arbitrum.blockscout.com/api"
	case model.BlockchainNetworkOptimism:
		return "https://optimism.blockscout.com/api"
	default:
		return ""
	}
}

// SupportsBlockscout returns true if the network has an open public Blockscout endpoint
func SupportsBlockscout(net model.BlockchainNetwork) bool {
	return GetBlockscoutEndpoint(net) != ""
}

// FetchTransfers retrieves historical native, internal, and ERC-20 token transfers via Blockscout
func (c *BlockscoutClient) FetchTransfers(ctx context.Context, net model.BlockchainNetwork, address string, page int, offset int) ([]blockchain.RawTransferMovement, error) {
	baseURL := GetBlockscoutEndpoint(net)
	if baseURL == "" {
		return nil, fmt.Errorf("network %s does not support Blockscout", net)
	}

	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, err
	}

	if offset <= 0 {
		offset = 50
	}
	if page <= 0 {
		page = 1
	}

	var movements []blockchain.RawTransferMovement
	seenKey := make(map[string]bool)

	appendUnique := func(m blockchain.RawTransferMovement) {
		tokKey := "NATIVE"
		if m.TokenAddress != nil && *m.TokenAddress != "" {
			tokKey = strings.ToLower(*m.TokenAddress)
		}
		dedupKey := fmt.Sprintf("%s:%s:%d", strings.ToLower(m.TxHash), tokKey, m.MovementIndex)
		if !seenKey[dedupKey] {
			seenKey[dedupKey] = true
			movements = append(movements, m)
		}
	}

	// 1. Fetch native transactions (txlist)
	nativeURL := fmt.Sprintf("%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=%d&offset=%d&sort=desc",
		baseURL, address, page, offset)

	nativeTxs, err := c.queryBlockscout(ctx, nativeURL)
	if err == nil {
		for _, tx := range nativeTxs {
			if tx.IsError == "1" {
				continue // Skip reverted transactions
			}
			blockNum, _ := strconv.ParseInt(tx.BlockNumber, 10, 64)
			ts, _ := strconv.ParseInt(tx.TimeStamp, 10, 64)
			execTime := time.Unix(ts, 0).UTC()

			// Calculate gas fee = executionFee + L1 data fee, attributed only to sender
			feeStr := calculateTotalTxFee(tx, address)

			priceStr := tx.EffectiveGasPrice
			if priceStr == "" {
				priceStr = tx.GasPrice
			}
			execFeeStr := "0"
			if gu, okGU := parseBigInt(tx.GasUsed); okGU {
				if gp, okGP := parseBigInt(priceStr); okGP {
					execFeeStr = new(big.Int).Mul(gu, gp).String()
				}
			}

			metaMap := map[string]interface{}{
				"blockNumber":       tx.BlockNumber,
				"timeStamp":         tx.TimeStamp,
				"hash":              tx.Hash,
				"from":              tx.From,
				"to":                tx.To,
				"gasUsed":           tx.GasUsed,
				"gasPrice":          tx.GasPrice,
				"effectiveGasPrice": tx.EffectiveGasPrice,
				"l1Fee":             tx.L1Fee,
				"execution_fee":     execFeeStr,
				"l1_data_fee":       tx.L1Fee,
				"total_fee":         feeStr,
			}
			rawMeta, _ := json.Marshal(metaMap)

			rawAmt := tx.Value
			if rawAmt == "" {
				rawAmt = "0"
			}

			appendUnique(blockchain.RawTransferMovement{
				TxHash:          tx.Hash,
				BlockOrSlot:     blockNum,
				ExecutedAt:      execTime,
				FromAddress:     tx.From,
				ToAddress:       tx.To,
				TokenAddress:    nil, // Native asset
				RawAmount:       rawAmt,
				Decimals:        18,
				FeeAmount:       feeStr,
				MovementIndex:   0, // Deterministic index for root tx
				ProviderSource:  "BLOCKSCOUT",
				RawMetadataJSON: rawMeta,
			})
		}
	}

	// 2. Fetch ERC-20 token transfers (tokentx)
	tokenURL := fmt.Sprintf("%s?module=account&action=tokentx&address=%s&startblock=0&endblock=99999999&page=%d&offset=%d&sort=desc",
		baseURL, address, page, offset)

	tokenTxs, errToken := c.queryBlockscout(ctx, tokenURL)
	if errToken == nil {
		for _, tx := range tokenTxs {
			blockNum, _ := strconv.ParseInt(tx.BlockNumber, 10, 64)
			ts, _ := strconv.ParseInt(tx.TimeStamp, 10, 64)
			execTime := time.Unix(ts, 0).UTC()

			decimals := 18
			if d, errD := strconv.Atoi(tx.TokenDecimal); errD == nil && d > 0 {
				decimals = d
			}

			logIdx := 0
			if parsedIdx, errIdx := strconv.Atoi(tx.LogIndex); errIdx == nil && parsedIdx >= 0 {
				logIdx = parsedIdx
			}

			tokenAddr := strings.ToLower(tx.ContractAddress)
			rawAmt := tx.Value
			if rawAmt == "" {
				rawAmt = "0"
			}

			rawMeta, _ := json.Marshal(tx)

			appendUnique(blockchain.RawTransferMovement{
				TxHash:          tx.Hash,
				BlockOrSlot:     blockNum,
				ExecutedAt:      execTime,
				FromAddress:     tx.From,
				ToAddress:       tx.To,
				TokenAddress:    &tokenAddr,
				RawAmount:       rawAmt,
				Decimals:        decimals,
				FeeAmount:       "0", // Token transfer fee is accounted on the native tx
				MovementIndex:   logIdx, // Deterministic EVM logIndex
				ProviderSource:  "BLOCKSCOUT",
				RawMetadataJSON: rawMeta,
			})
		}
	}

	// 3. Fetch Internal contract transfers (txlistinternal)
	internalURL := fmt.Sprintf("%s?module=account&action=txlistinternal&address=%s&startblock=0&endblock=99999999&page=%d&offset=%d&sort=desc",
		baseURL, address, page, offset)

	internalTxs, errInternal := c.queryBlockscout(ctx, internalURL)
	if errInternal == nil {
		for idx, tx := range internalTxs {
			if tx.IsError == "1" {
				continue
			}
			blockNum, _ := strconv.ParseInt(tx.BlockNumber, 10, 64)
			ts, _ := strconv.ParseInt(tx.TimeStamp, 10, 64)
			execTime := time.Unix(ts, 0).UTC()

			rawAmt := tx.Value
			if rawAmt == "" || rawAmt == "0" {
				continue
			}

			traceIdx := idx + 1
			cleanTrace := strings.ReplaceAll(tx.TraceID, "_", "")
			if t, errT := strconv.Atoi(cleanTrace); errT == nil && t >= 0 {
				traceIdx = t
			}

			rawMeta, _ := json.Marshal(tx)

			appendUnique(blockchain.RawTransferMovement{
				TxHash:          tx.Hash,
				BlockOrSlot:     blockNum,
				ExecutedAt:      execTime,
				FromAddress:     tx.From,
				ToAddress:       tx.To,
				TokenAddress:    nil, // Native asset internal transfer
				RawAmount:       rawAmt,
				Decimals:        18,
				FeeAmount:       "0",
				MovementIndex:   10000 + traceIdx, // Deterministic internal trace index
				ProviderSource:  "BLOCKSCOUT",
				RawMetadataJSON: rawMeta,
			})
		}
	}

	return movements, nil
}

func (c *BlockscoutClient) queryBlockscout(ctx context.Context, url string) ([]blockscoutTxItem, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "SigmaFinance/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed blockscoutResponse
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return nil, err
	}

	if parsed.Status != "1" {
		// "No transactions found" is returned with status "0"
		return nil, nil
	}

	var items []blockscoutTxItem
	if err := json.Unmarshal(parsed.Result, &items); err != nil {
		return nil, err
	}

	return items, nil
}

