package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"sigma_finance/internal/infrastructure/trustwallet"
)

// Well-known Solana tokens to eliminate any network dependency for major assets
type KnownSolanaToken struct {
	Symbol   string
	Name     string
	Decimals int
}

var knownSolanaTokens = map[string]KnownSolanaToken{
	// Stablecoins
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {Symbol: "USDC", Name: "USD Coin", Decimals: 6},
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {Symbol: "USDT", Name: "Tether USD", Decimals: 6},
	// Native & Wrapped Coins
	"So11111111111111111111111111111111111111112":  {Symbol: "WSOL", Name: "Wrapped SOL", Decimals: 9},
	"7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": {Symbol: "WETH", Name: "Wrapped Ethereum (Sollet)", Decimals: 8},
	"3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": {Symbol: "WBTC", Name: "Wrapped Bitcoin (Sollet)", Decimals: 8},
	// Liquid Staking
	"J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": {Symbol: "JitoSOL", Name: "Jito Staked SOL", Decimals: 9},
	"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  {Symbol: "mSOL", Name: "Marinade Staked SOL", Decimals: 9},
	"bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":  {Symbol: "bSOL", Name: "BlazeStake Staked SOL", Decimals: 9},
	// Top DeFi & Governance
	"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  {Symbol: "JUP", Name: "Jupiter", Decimals: 6},
	"rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof":  {Symbol: "RENDER", Name: "Render", Decimals: 8},
	"HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": {Symbol: "PYTH", Name: "Pyth Network", Decimals: 6},
	"jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL":  {Symbol: "JTO", Name: "Jito", Decimals: 9},
	"4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": {Symbol: "RAY", Name: "Raydium", Decimals: 6},
	"orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE":  {Symbol: "ORCA", Name: "Orca", Decimals: 6},
	"DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7": {Symbol: "DRIFT", Name: "Drift", Decimals: 6},
	// Top Memecoins & Community
	"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": {Symbol: "BONK", Name: "Bonk", Decimals: 5},
	"EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": {Symbol: "WIF", Name: "dogwifhat", Decimals: 6},
	"2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv": {Symbol: "PENGU", Name: "Pudgy Penguins", Decimals: 6},
	"ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82":  {Symbol: "BOME", Name: "BOOK OF MEME", Decimals: 6},
	"MEFNBXixkEbait3xn9bkm8FsBp2hDRqcP4DmEDhyj53":  {Symbol: "ME", Name: "Magic Eden", Decimals: 6},
}

var (
	twClientOnce sync.Once
	twClient     *trustwallet.Client
	metaCacheMu  sync.RWMutex
	metaCache    = make(map[string]KnownSolanaToken)
)

func getTrustWalletClient() *trustwallet.Client {
	twClientOnce.Do(func() {
		twClient = trustwallet.NewClient()
	})
	return twClient
}

// ResolveSolanaTokenMetadata implements multi-tier metadata resolution for Solana SPL mint addresses
func ResolveSolanaTokenMetadata(ctx context.Context, mint string, httpClient *http.Client) (symbol, name string, decimals int) {
	mint = strings.TrimSpace(mint)
	if mint == "" {
		return "UNKNOWN", "Unknown Token", 9
	}

	// 1. Check in-memory cache
	metaCacheMu.RLock()
	if cached, ok := metaCache[mint]; ok {
		metaCacheMu.RUnlock()
		return cached.Symbol, cached.Name, cached.Decimals
	}
	metaCacheMu.RUnlock()

	// 2. Check well-known Solana tokens map
	if known, ok := knownSolanaTokens[mint]; ok {
		metaCacheMu.Lock()
		metaCache[mint] = known
		metaCacheMu.Unlock()
		return known.Symbol, known.Name, known.Decimals
	}

	// 3. Check TrustWallet 150k+ catalog
	tw := getTrustWalletClient()
	if asset, err := tw.GetAssetByID(ctx, "solana:"+mint); err == nil && asset != nil && asset.Symbol != "" {
		res := KnownSolanaToken{
			Symbol:   asset.Symbol,
			Name:     asset.Name,
			Decimals: 9, // default if not specified
		}
		metaCacheMu.Lock()
		metaCache[mint] = res
		metaCacheMu.Unlock()
		return res.Symbol, res.Name, res.Decimals
	}

	// 4. Query public Jupiter Token API (tokens.jup.ag) with short timeout
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 3 * time.Second}
	}
	jupURL := fmt.Sprintf("https://tokens.jup.ag/token/%s", mint)
	req, err := http.NewRequestWithContext(ctx, "GET", jupURL, nil)
	if err == nil {
		resp, errDo := httpClient.Do(req)
		if errDo == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var jupResp struct {
				Symbol   string `json:"symbol"`
				Name     string `json:"name"`
				Decimals int    `json:"decimals"`
			}
			if errDec := json.NewDecoder(resp.Body).Decode(&jupResp); errDec == nil && jupResp.Symbol != "" {
				res := KnownSolanaToken{
					Symbol:   strings.ToUpper(strings.TrimSpace(jupResp.Symbol)),
					Name:     strings.TrimSpace(jupResp.Name),
					Decimals: jupResp.Decimals,
				}
				metaCacheMu.Lock()
				metaCache[mint] = res
				metaCacheMu.Unlock()
				return res.Symbol, res.Name, res.Decimals
			}
		} else if resp != nil {
			resp.Body.Close()
		}
	}

	// 5. Fallback for unlisted/unverified tokens
	shortMint := mint
	if len(mint) > 8 {
		shortMint = fmt.Sprintf("%s...%s", mint[:4], mint[len(mint)-4:])
	}
	sym := "SPL"
	if len(mint) >= 4 {
		sym = fmt.Sprintf("SPL-%s", mint[:4])
	}
	fallback := KnownSolanaToken{
		Symbol:   sym,
		Name:     fmt.Sprintf("Unknown SPL (%s)", shortMint),
		Decimals: 9,
	}
	return fallback.Symbol, fallback.Name, fallback.Decimals
}
