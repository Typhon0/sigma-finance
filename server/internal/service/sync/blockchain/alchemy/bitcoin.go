package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
	"sigma_finance/internal/service/sync/blockchain/bitcoin"
)

type BitcoinUTXOItem struct {
	TxID          string  `json:"txid"`
	Vout          int     `json:"vout"`
	ValueSat      uint64  `json:"value"`
	Confirmations int     `json:"confirmations"`
	Address       *string `json:"address,omitempty"`
}

// fetchBitcoinBalances fetches Bitcoin holdings via Mempool.space / Blockstream (falling back to Alchemy)
func (c *Client) fetchBitcoinBalances(ctx context.Context, descriptor string) ([]blockchain.RawTokenBalance, error) {
	// Primary: Free Mempool.space default + Blockstream fallback (handles standalone and zpub/xpub)
	btcClient := bitcoin.NewClient()
	bals, err := btcClient.FetchBalances(ctx, descriptor)
	if err == nil && len(bals) > 0 {
		return bals, nil
	}

	if err != nil {
		log.Printf("[WARN] [Alchemy] Mempool/Blockstream balance fetch failed for %s: %v. Attempting Alchemy fallback...", descriptor, err)
	}

	if c.apiKey == "" {
		return nil, fmt.Errorf("bitcoin balance fetch failed: %w", err)
	}

	// Optional Tertiary Fallback: Alchemy UTXO endpoint (if user has paid UTXO add-on)
	url := fmt.Sprintf("https://bitcoin-mainnet.g.alchemy.com/v2/%s/api/v2/utxo/%s", c.apiKey, descriptor)

	if c.cuTracker != nil {
		_, _ = c.cuTracker.RecordConsumption(ctx, 20)
	}

	bodyBytes, getErr := c.doGet(ctx, url)
	if getErr != nil {
		return nil, fmt.Errorf("bitcoin utxo request failed: %w (mempool error: %v)", getErr, err)
	}

	var utxos []BitcoinUTXOItem
	if unmarshalErr := json.Unmarshal(bodyBytes, &utxos); unmarshalErr != nil {
		var wrapped struct {
			UTXOs []BitcoinUTXOItem `json:"utxos"`
		}
		if errWrap := json.Unmarshal(bodyBytes, &wrapped); errWrap == nil {
			utxos = wrapped.UTXOs
		} else {
			return nil, fmt.Errorf("failed to parse bitcoin UTXO response: %w", unmarshalErr)
		}
	}

	var totalSat uint64
	for _, u := range utxos {
		totalSat += u.ValueSat
	}

	return []blockchain.RawTokenBalance{
		{
			Network:      model.BlockchainNetworkBitcoin,
			Address:      descriptor,
			TokenAddress: nil,
			Symbol:       "BTC",
			Name:         "Bitcoin",
			Decimals:     8,
			RawBalance:   strconv.FormatUint(totalSat, 10),
			IsNative:     true,
		},
	}, nil
}

// fetchBitcoinTransfers derives transfer movements from transaction history
func (c *Client) fetchBitcoinTransfers(ctx context.Context, descriptor string, cursor string) (*blockchain.TransferPage, error) {
	// Primary: Free Mempool.space default + Blockstream fallback
	btcClient := bitcoin.NewClient()
	page, err := btcClient.FetchTransfers(ctx, descriptor, cursor)
	if err == nil && page != nil && len(page.Movements) > 0 {
		return page, nil
	}

	if err != nil {
		log.Printf("[WARN] [Alchemy] Mempool/Blockstream transfer fetch failed for %s: %v. Attempting Alchemy fallback...", descriptor, err)
	}

	if c.apiKey == "" {
		if page != nil {
			return page, nil
		}
		return &blockchain.TransferPage{}, nil
	}

	// Optional Tertiary Fallback: Alchemy UTXO endpoint
	url := fmt.Sprintf("https://bitcoin-mainnet.g.alchemy.com/v2/%s/api/v2/utxo/%s", c.apiKey, descriptor)

	if c.cuTracker != nil {
		_, _ = c.cuTracker.RecordConsumption(ctx, 20)
	}

	bodyBytes, getErr := c.doGet(ctx, url)
	if getErr != nil {
		if page != nil {
			return page, nil
		}
		return &blockchain.TransferPage{}, nil
	}

	var utxos []BitcoinUTXOItem
	if unmarshalErr := json.Unmarshal(bodyBytes, &utxos); unmarshalErr != nil {
		var wrapped struct {
			UTXOs []BitcoinUTXOItem `json:"utxos"`
		}
		if errWrap := json.Unmarshal(bodyBytes, &wrapped); errWrap == nil {
			utxos = wrapped.UTXOs
		} else {
			return &blockchain.TransferPage{}, nil
		}
	}

	var movements []blockchain.RawTransferMovement
	for _, u := range utxos {
		meta, _ := json.Marshal(u)
		movements = append(movements, blockchain.RawTransferMovement{
			TxHash:          u.TxID,
			BlockOrSlot:     int64(u.Confirmations),
			ExecutedAt:      time.Now().UTC(),
			FromAddress:     "",
			ToAddress:       descriptor,
			TokenAddress:    nil,
			RawAmount:       strconv.FormatUint(u.ValueSat, 10),
			Decimals:        8,
			FeeAmount:       "0",
			ProviderSource:  "ALCHEMY",
			RawMetadataJSON: meta,
		})
	}

	return &blockchain.TransferPage{
		Movements:   movements,
		NextPageKey: nil,
	}, nil
}
