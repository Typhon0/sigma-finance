package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type BitcoinUTXOItem struct {
	TxID          string  `json:"txid"`
	Vout          int     `json:"vout"`
	ValueSat      uint64  `json:"value"`
	Confirmations int     `json:"confirmations"`
	Address       *string `json:"address,omitempty"`
}

type BitcoinUTXOResponse struct {
	UTXOs []BitcoinUTXOItem `json:"utxos,omitempty"`
	Error string            `json:"error,omitempty"`
}

// BenchmarkBitcoinAPI tests Alchemy Bitcoin REST API for UTXO endpoint
func BenchmarkBitcoinAPI(ctx context.Context, apiKey string, descriptor string) ([]BitcoinUTXOItem, time.Duration, error) {
	start := time.Now()

	// Alchemy Bitcoin UTXO endpoint: GET https://bitcoin-mainnet.g.alchemy.com/v2/{apiKey}/api/v2/utxo/{descriptor}
	url := fmt.Sprintf("https://bitcoin-mainnet.g.alchemy.com/v2/%s/api/v2/utxo/%s", apiKey, descriptor)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, 0, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, time.Since(start), fmt.Errorf("bitcoin UTXO request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	duration := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		return nil, duration, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	// Response can be a JSON array of UTXOs or an object with { "utxos": [...] }
	var utxoList []BitcoinUTXOItem
	if err := json.Unmarshal(body, &utxoList); err != nil {
		var wrapped struct {
			UTXOs []BitcoinUTXOItem `json:"utxos"`
		}
		if errWrap := json.Unmarshal(body, &wrapped); errWrap == nil {
			return wrapped.UTXOs, duration, nil
		}
		return nil, duration, fmt.Errorf("failed to unmarshal UTXO response: %w (body: %s)", err, string(body))
	}

	return utxoList, duration, nil
}
