package bitcoin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/base58"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"golang.org/x/time/rate"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

const (
	DefaultMempoolEndpoint     = "https://mempool.space/api"
	DefaultBlockstreamEndpoint = "https://blockstream.info/api"
	DefaultGapLimit            = 20
	DefaultMaxTxsPerAddress    = 50
)

// EsploraAddressStats holds confirmed & mempool balances
type EsploraAddressStats struct {
	Address    string `json:"address"`
	ChainStats struct {
		FundedTxoCount int64  `json:"funded_txo_count"`
		FundedTxoSum   uint64 `json:"funded_txo_sum"`
		SpentTxoCount  int64  `json:"spent_txo_count"`
		SpentTxoSum    uint64 `json:"spent_txo_sum"`
		TxCount        int64  `json:"tx_count"`
	} `json:"chain_stats"`
	MempoolStats struct {
		FundedTxoCount int64  `json:"funded_txo_count"`
		FundedTxoSum   uint64 `json:"funded_txo_sum"`
		SpentTxoCount  int64  `json:"spent_txo_count"`
		SpentTxoSum    uint64 `json:"spent_txo_sum"`
		TxCount        int64  `json:"tx_count"`
	} `json:"mempool_stats"`
}

type EsploraVout struct {
	ScriptpubkeyAddress string `json:"scriptpubkey_address"`
	Value               uint64 `json:"value"`
}

type EsploraVin struct {
	TxID    string       `json:"txid"`
	Vout    int          `json:"vout"`
	Prevout *EsploraVout `json:"prevout"`
}

// EsploraTx holds simplified transaction details
type EsploraTx struct {
	TxID   string `json:"txid"`
	Fee    uint64 `json:"fee"`
	Status struct {
		Confirmed   bool  `json:"confirmed"`
		BlockHeight int64 `json:"block_height"`
		BlockTime   int64 `json:"block_time"`
	} `json:"status"`
	Vin  []EsploraVin  `json:"vin"`
	Vout []EsploraVout `json:"vout"`
}

// Client provides resilient Bitcoin indexing across Mempool.space and Blockstream
type Client struct {
	endpoints         []string
	httpClient        *http.Client
	rateLimiter       *rate.Limiter
	gapLimit          int
	maxTxs            int
	cooldowns         map[string]time.Time
	cooldownMu        sync.RWMutex
	activeAddrCache   map[string][]string
	cacheMu           sync.RWMutex
}

func NewClient(endpoints ...string) *Client {
	if len(endpoints) == 0 {
		endpoints = []string{DefaultMempoolEndpoint, DefaultBlockstreamEndpoint}
	}
	return &Client{
		endpoints: endpoints,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
		rateLimiter:     rate.NewLimiter(rate.Every(150*time.Millisecond), 5), // polite pacing
		gapLimit:        DefaultGapLimit,
		maxTxs:          DefaultMaxTxsPerAddress,
		cooldowns:       make(map[string]time.Time),
		activeAddrCache: make(map[string][]string),
	}
}

func (c *Client) isCoolingDown(base string) bool {
	c.cooldownMu.RLock()
	defer c.cooldownMu.RUnlock()
	until, ok := c.cooldowns[base]
	return ok && time.Now().Before(until)
}

func (c *Client) setCooldown(base string, duration time.Duration) {
	c.cooldownMu.Lock()
	defer c.cooldownMu.Unlock()
	c.cooldowns[base] = time.Now().Add(duration)
}

// doGet performs a request trying available endpoints, respecting cooldowns
func (c *Client) doGet(ctx context.Context, path string) ([]byte, error) {
	var lastErr error

	// First pass: try non-cooling endpoints
	for _, base := range c.endpoints {
		if c.isCoolingDown(base) {
			continue
		}

		body, err := c.execGet(ctx, base, path)
		if err == nil {
			return body, nil
		}
		lastErr = err
	}

	// Second pass: if all in cooldown, try any endpoint
	for _, base := range c.endpoints {
		body, err := c.execGet(ctx, base, path)
		if err == nil {
			return body, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("all bitcoin endpoints failed: %w", lastErr)
}

func (c *Client) execGet(ctx context.Context, base, path string) ([]byte, error) {
	url := fmt.Sprintf("%s%s", strings.TrimRight(base, "/"), path)
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "SigmaFinance/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.setCooldown(base, 30*time.Second)
		log.Printf("[WARN] [BitcoinClient] Endpoint %s failed: %v. Cooldown 30s.", base, err)
		return nil, err
	}

	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return body, nil
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		c.setCooldown(base, 60*time.Second)
		log.Printf("[WARN] [BitcoinClient] Endpoint %s returned 429 Too Many Requests. Cooldown 60s.", base)
	} else if resp.StatusCode >= 500 {
		c.setCooldown(base, 30*time.Second)
	}

	return nil, fmt.Errorf("HTTP %d from %s: %s", resp.StatusCode, base, string(body))
}

// FetchAddressStats gets balance and tx count for a single address
func (c *Client) FetchAddressStats(ctx context.Context, address string) (*EsploraAddressStats, error) {
	body, err := c.doGet(ctx, fmt.Sprintf("/address/%s", address))
	if err != nil {
		return nil, err
	}

	var stats EsploraAddressStats
	if err := json.Unmarshal(body, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse address stats: %w", err)
	}
	return &stats, nil
}

// FetchAddressTransactions gets recent transaction history for an address with Esplora pagination
func (c *Client) FetchAddressTransactions(ctx context.Context, address string) ([]EsploraTx, error) {
	var allTxs []EsploraTx
	seenTxIDs := make(map[string]bool)

	// 1. Fetch unconfirmed mempool transactions (up to 50 unpaginated results)
	mempoolURL := fmt.Sprintf("/address/%s/txs/mempool", address)
	if mBody, mErr := c.doGet(ctx, mempoolURL); mErr == nil {
		var mempoolTxs []EsploraTx
		if errU := json.Unmarshal(mBody, &mempoolTxs); errU == nil && len(mempoolTxs) > 0 {
			if len(mempoolTxs) >= 50 {
				log.Printf("[INFO] [BitcoinClient] Address %s has >= 50 mempool transactions (Esplora mempool limit reached)", address)
			}
			for _, mTx := range mempoolTxs {
				if !seenTxIDs[mTx.TxID] {
					seenTxIDs[mTx.TxID] = true
					allTxs = append(allTxs, mTx)
				}
			}
		}
	}

	lastTxID := ""

	for {
		url := fmt.Sprintf("/address/%s/txs", address)
		if lastTxID != "" {
			url = fmt.Sprintf("/address/%s/txs/chain/%s", address, lastTxID)
		}

		body, err := c.doGet(ctx, url)
		if err != nil {
			if len(allTxs) > 0 {
				break // return accumulated transactions on partial explorer timeout
			}
			return nil, err
		}

		var pageTxs []EsploraTx
		if err := json.Unmarshal(body, &pageTxs); err != nil || len(pageTxs) == 0 {
			break
		}

		for _, pTx := range pageTxs {
			if !seenTxIDs[pTx.TxID] {
				seenTxIDs[pTx.TxID] = true
				allTxs = append(allTxs, pTx)
			}
		}

		// Stop if we reached maxTxs or if the page has fewer than 25 txs (last page)
		if len(allTxs) >= c.maxTxs || len(pageTxs) < 25 {
			break
		}

		lastTxID = pageTxs[len(pageTxs)-1].TxID
	}

	if len(allTxs) > c.maxTxs {
		allTxs = allTxs[:c.maxTxs]
	}
	return allTxs, nil
}

// IsExtendedKey checks if string is a BIP32/44/49/84 extended key
func IsExtendedKey(s string) bool {
	lower := strings.ToLower(strings.TrimSpace(s))
	return strings.HasPrefix(lower, "xpub") ||
		strings.HasPrefix(lower, "ypub") ||
		strings.HasPrefix(lower, "zpub")
}

// NormalizeExtendedKey converts zpub/ypub version bytes to standard xpub for hdkeychain parsing
func NormalizeExtendedKey(keyStr string) (string, string, error) {
	trimmed := strings.TrimSpace(keyStr)
	decoded := base58.Decode(trimmed)
	if len(decoded) < 78+4 {
		return "", "", fmt.Errorf("invalid extended key length: %d", len(decoded))
	}

	keyType := "xpub"
	if strings.HasPrefix(trimmed, "zpub") {
		keyType = "zpub"
	} else if strings.HasPrefix(trimmed, "ypub") {
		keyType = "ypub"
	}

	rawPayload := decoded[:len(decoded)-4] // strip checksum
	rawPayload[0] = 0x04
	rawPayload[1] = 0x88
	rawPayload[2] = 0xb2
	rawPayload[3] = 0x1e

	checksum := chainhash.DoubleHashB(rawPayload)
	fullWithChecksum := append(rawPayload, checksum[:4]...)
	return base58.Encode(fullWithChecksum), keyType, nil
}

// DeriveAddress derives a child address from an hdkeychain key given keyType and index
func DeriveAddress(parent *hdkeychain.ExtendedKey, keyType string, index uint32) (string, error) {
	child, err := parent.Derive(index)
	if err != nil {
		return "", err
	}

	pubKey, err := child.ECPubKey()
	if err != nil {
		return "", err
	}

	compressed := pubKey.SerializeCompressed()
	hash := btcutil.Hash160(compressed)

	switch keyType {
	case "zpub": // BIP-84: Native SegWit P2WPKH (bc1q...)
		addr, err := btcutil.NewAddressWitnessPubKeyHash(hash, &chaincfg.MainNetParams)
		if err != nil {
			return "", err
		}
		return addr.EncodeAddress(), nil

	case "ypub": // BIP-49: Nested SegWit P2SH-P2WPKH (3...)
		witnessAddr, err := btcutil.NewAddressWitnessPubKeyHash(hash, &chaincfg.MainNetParams)
		if err != nil {
			return "", err
		}
		script, err := btcutil.NewAddressScriptHash(witnessAddr.ScriptAddress(), &chaincfg.MainNetParams)
		if err != nil {
			return "", err
		}
		return script.EncodeAddress(), nil

	default: // BIP-44: Legacy P2PKH (1...)
		addr, err := btcutil.NewAddressPubKeyHash(hash, &chaincfg.MainNetParams)
		if err != nil {
			return "", err
		}
		return addr.EncodeAddress(), nil
	}
}

// DiscoveredAddressesData represents persistent HD wallet derivation cache
type DiscoveredAddressesData struct {
	ReceiveIndex uint32   `json:"receive_index"`
	ChangeIndex  uint32   `json:"change_index"`
	Addresses    []string `json:"addresses"`
}

// ScanExtendedKeyPersistent scans using persistent derivation cache, probing forward only from last used index
func (c *Client) ScanExtendedKeyPersistent(ctx context.Context, descriptor string, cachedJSON *string) ([]string, uint64, string, error) {
	xpubNorm, keyType, err := NormalizeExtendedKey(descriptor)
	if err != nil {
		return nil, 0, "", fmt.Errorf("failed to normalize extended key: %w", err)
	}

	masterKey, err := hdkeychain.NewKeyFromString(xpubNorm)
	if err != nil {
		return nil, 0, "", fmt.Errorf("failed to parse extended key: %w", err)
	}

	var data DiscoveredAddressesData
	if cachedJSON != nil && *cachedJSON != "" {
		_ = json.Unmarshal([]byte(*cachedJSON), &data)
	}

	knownAddrSet := make(map[string]bool)
	for _, a := range data.Addresses {
		knownAddrSet[a] = true
	}

	var totalSat uint64

	// 1. Fetch balance for already known active addresses
	for _, addr := range data.Addresses {
		stats, err := c.FetchAddressStats(ctx, addr)
		if err == nil {
			totalSat += (stats.ChainStats.FundedTxoSum - stats.ChainStats.SpentTxoSum) +
				(stats.MempoolStats.FundedTxoSum - stats.MempoolStats.SpentTxoSum)
		}
	}

	// 2. Probe forward for new addresses on receive (0) and change (1) branches
	branches := []struct {
		name      string
		index     uint32
		startIdx  uint32
		updateIdx *uint32
	}{
		{"receive", 0, data.ReceiveIndex, &data.ReceiveIndex},
		{"change", 1, data.ChangeIndex, &data.ChangeIndex},
	}

	for _, br := range branches {
		branchKey, err := masterKey.Derive(br.index)
		if err != nil {
			continue
		}

		consecutiveEmpty := 0
		start := br.startIdx
		if len(data.Addresses) > 0 {
			start++ // probe after highest known index
		}

		for i := start; consecutiveEmpty < c.gapLimit && i < start+100; i++ {
			addr, err := DeriveAddress(branchKey, keyType, i)
			if err != nil {
				consecutiveEmpty++
				continue
			}

			if knownAddrSet[addr] {
				continue
			}

			stats, err := c.FetchAddressStats(ctx, addr)
			if err != nil {
				consecutiveEmpty++
				continue
			}

			if stats.ChainStats.TxCount > 0 || stats.MempoolStats.TxCount > 0 {
				consecutiveEmpty = 0
				data.Addresses = append(data.Addresses, addr)
				knownAddrSet[addr] = true
				*br.updateIdx = i
				sat := (stats.ChainStats.FundedTxoSum - stats.ChainStats.SpentTxoSum) +
					(stats.MempoolStats.FundedTxoSum - stats.MempoolStats.SpentTxoSum)
				totalSat += sat
			} else {
				consecutiveEmpty++
			}
		}
	}

	newBytes, _ := json.Marshal(data)
	return data.Addresses, totalSat, string(newBytes), nil
}

// ScanExtendedKey scans both receive and change branches, returning active addresses and total satoshis
func (c *Client) ScanExtendedKey(ctx context.Context, descriptor string) ([]string, uint64, error) {
	c.cacheMu.RLock()
	cached, found := c.activeAddrCache[descriptor]
	c.cacheMu.RUnlock()

	xpubNorm, keyType, err := NormalizeExtendedKey(descriptor)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to normalize extended key: %w", err)
	}

	masterKey, err := hdkeychain.NewKeyFromString(xpubNorm)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to parse extended key: %w", err)
	}

	// If we already know the active addresses, simply fetch their latest stats!
	if found && len(cached) > 0 {
		var totalSat uint64
		for _, addr := range cached {
			stats, err := c.FetchAddressStats(ctx, addr)
			if err == nil {
				totalSat += (stats.ChainStats.FundedTxoSum - stats.ChainStats.SpentTxoSum) +
					(stats.MempoolStats.FundedTxoSum - stats.MempoolStats.SpentTxoSum)
			}
		}
		return cached, totalSat, nil
	}

	var activeAddrs []string
	var totalSat uint64

	chains := []struct {
		name  string
		index uint32
	}{
		{"receive", 0}, // /0/i
		{"change", 1},  // /1/i
	}

	for _, chain := range chains {
		branch, err := masterKey.Derive(chain.index)
		if err != nil {
			log.Printf("[WARN] [BitcoinClient] Failed to derive branch %s: %v", chain.name, err)
			continue
		}

		consecutiveEmpty := 0
		for i := uint32(0); consecutiveEmpty < c.gapLimit && i < 1000; i++ {
			addr, err := DeriveAddress(branch, keyType, i)
			if err != nil {
				consecutiveEmpty++
				continue
			}

			stats, err := c.FetchAddressStats(ctx, addr)
			if err != nil {
				consecutiveEmpty++
				continue
			}

			if stats.ChainStats.TxCount > 0 || stats.MempoolStats.TxCount > 0 {
				consecutiveEmpty = 0
				activeAddrs = append(activeAddrs, addr)
				sat := (stats.ChainStats.FundedTxoSum - stats.ChainStats.SpentTxoSum) +
					(stats.MempoolStats.FundedTxoSum - stats.MempoolStats.SpentTxoSum)
				totalSat += sat
			} else {
				consecutiveEmpty++
			}
		}
	}

	c.cacheMu.Lock()
	c.activeAddrCache[descriptor] = activeAddrs
	c.cacheMu.Unlock()

	return activeAddrs, totalSat, nil
}

// FetchBalances retrieves total balance for a standalone address or full extended key
func (c *Client) FetchBalances(ctx context.Context, descriptor string) ([]blockchain.RawTokenBalance, error) {
	trimmed := strings.TrimSpace(descriptor)

	if !IsExtendedKey(trimmed) {
		stats, err := c.FetchAddressStats(ctx, trimmed)
		if err != nil {
			return nil, err
		}

		totalSat := (stats.ChainStats.FundedTxoSum - stats.ChainStats.SpentTxoSum) +
			(stats.MempoolStats.FundedTxoSum - stats.MempoolStats.SpentTxoSum)

		return []blockchain.RawTokenBalance{
			{
				Network:      model.BlockchainNetworkBitcoin,
				Address:      trimmed,
				TokenAddress: nil,
				Symbol:       "BTC",
				Name:         "Bitcoin",
				Decimals:     8,
				RawBalance:   strconv.FormatUint(totalSat, 10),
				IsNative:     true,
			},
		}, nil
	}

	_, totalSat, err := c.ScanExtendedKey(ctx, trimmed)
	if err != nil {
		return nil, err
	}

	return []blockchain.RawTokenBalance{
		{
			Network:      model.BlockchainNetworkBitcoin,
			Address:      trimmed,
			TokenAddress: nil,
			Symbol:       "BTC",
			Name:         "Bitcoin",
			Decimals:     8,
			RawBalance:   strconv.FormatUint(totalSat, 10),
			IsNative:     true,
		},
	}, nil
}

// FetchTransfers retrieves historical movements for a standalone address or full extended key
func (c *Client) FetchTransfers(ctx context.Context, descriptor string, cursor string) (*blockchain.TransferPage, error) {
	trimmed := strings.TrimSpace(descriptor)

	var targetAddresses []string

	if !IsExtendedKey(trimmed) {
		targetAddresses = []string{trimmed}
	} else {
		active, _, err := c.ScanExtendedKey(ctx, trimmed)
		if err != nil {
			return nil, err
		}
		targetAddresses = active
	}

	knownAddresses := make(map[string]bool)
	for _, a := range targetAddresses {
		knownAddresses[a] = true
	}

	// 1. Collect all unique transactions across all wallet addresses
	allTxsMap := make(map[string]EsploraTx)
	for _, addr := range targetAddresses {
		txs, err := c.FetchAddressTransactions(ctx, addr)
		if err != nil {
			log.Printf("[WARN] [BitcoinClient] Failed to fetch txs for %s: %v", addr, err)
			continue
		}
		for _, tx := range txs {
			allTxsMap[tx.TxID] = tx
		}
	}

	var allMovements []blockchain.RawTransferMovement

	// 2. Process each unique transaction at the wallet level
	for _, tx := range allTxsMap {
		var walletSpentSat uint64
		var walletReceivedSat uint64
		var totalTxInputSat uint64
		var externalFrom string
		var externalTo string

		for _, vin := range tx.Vin {
			if vin.Prevout != nil {
				totalTxInputSat += vin.Prevout.Value
				if knownAddresses[vin.Prevout.ScriptpubkeyAddress] {
					walletSpentSat += vin.Prevout.Value
				} else if externalFrom == "" {
					externalFrom = vin.Prevout.ScriptpubkeyAddress
				}
			}
		}

		for _, vout := range tx.Vout {
			if knownAddresses[vout.ScriptpubkeyAddress] {
				walletReceivedSat += vout.Value
			} else if externalTo == "" {
				externalTo = vout.ScriptpubkeyAddress
			}
		}

		isCollaborative := totalTxInputSat > walletSpentSat && walletSpentSat > 0

		execTime := time.Now().UTC()
		if tx.Status.BlockTime > 0 {
			execTime = time.Unix(tx.Status.BlockTime, 0).UTC()
		}

		var walletFee uint64
		if walletSpentSat > walletReceivedSat {
			netOutflow := walletSpentSat - walletReceivedSat
			if !isCollaborative {
				// Sole spender: wallet pays 100% of miner fee
				walletFee = tx.Fee
			} else if totalTxInputSat > 0 {
				// Collaborative / CoinJoin / PayJoin: allocate fee proportionally to wallet's input share
				walletFee = (tx.Fee * walletSpentSat) / totalTxInputSat
			}

			externalAmt := uint64(0)
			if netOutflow >= walletFee {
				externalAmt = netOutflow - walletFee
			}

			meta, _ := json.Marshal(map[string]interface{}{
				"txid":               tx.TxID,
				"descriptor":         descriptor,
				"fee":                tx.Fee,
				"wallet_fee":         walletFee,
				"confirmed":          tx.Status.Confirmed,
				"blockHeight":        tx.Status.BlockHeight,
				"spent":              walletSpentSat,
				"received":           walletReceivedSat,
				"total_tx_input_sat": totalTxInputSat,
				"is_collaborative":   isCollaborative,
			})

			// If externalAmt == 0, this was an internal UTXO consolidation or change return
			allMovements = append(allMovements, blockchain.RawTransferMovement{
				TxHash:          tx.TxID,
				BlockOrSlot:     tx.Status.BlockHeight,
				ExecutedAt:      execTime,
				FromAddress:     descriptor,
				ToAddress:       externalTo,
				TokenAddress:    nil,
				RawAmount:       strconv.FormatUint(externalAmt, 10),
				Decimals:        8,
				FeeAmount:       strconv.FormatUint(walletFee, 10),
				MovementIndex:   0, // Exactly 1 deterministic wallet summary movement
				ProviderSource:  "MEMPOOL",
				RawMetadataJSON: meta,
			})
		} else if walletReceivedSat > walletSpentSat {
			netInflow := walletReceivedSat - walletSpentSat
			meta, _ := json.Marshal(map[string]interface{}{
				"txid":               tx.TxID,
				"descriptor":         descriptor,
				"fee":                tx.Fee,
				"wallet_fee":         0,
				"confirmed":          tx.Status.Confirmed,
				"blockHeight":        tx.Status.BlockHeight,
				"spent":              walletSpentSat,
				"received":           walletReceivedSat,
				"total_tx_input_sat": totalTxInputSat,
				"is_collaborative":   isCollaborative,
			})

			allMovements = append(allMovements, blockchain.RawTransferMovement{
				TxHash:          tx.TxID,
				BlockOrSlot:     tx.Status.BlockHeight,
				ExecutedAt:      execTime,
				FromAddress:     externalFrom,
				ToAddress:       descriptor,
				TokenAddress:    nil,
				RawAmount:       strconv.FormatUint(netInflow, 10),
				Decimals:        8,
				FeeAmount:       "0", // Incoming transfer, fee paid by sender
				MovementIndex:   0,
				ProviderSource:  "MEMPOOL",
				RawMetadataJSON: meta,
			})
		}
	}

	return &blockchain.TransferPage{
		Movements:   allMovements,
		NextPageKey: nil,
	}, nil
}
