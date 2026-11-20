package solana

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
	twClientOnce        sync.Once
	twClient            *trustwallet.Client
	dynamicTokenCache   = make(map[string]KnownSolanaToken)
	dynamicTokenCacheMu sync.RWMutex
)

func getTrustWalletClient() *trustwallet.Client {
	twClientOnce.Do(func() {
		twClient = trustwallet.NewClient()
	})
	return twClient
}

// ResolveSolanaTokenMetadata resolves mint address using verified table -> TrustWallet catalog -> Jupiter API
func ResolveSolanaTokenMetadata(ctx context.Context, mint string, client *http.Client) (string, string, int) {
	mint = strings.TrimSpace(mint)
	if mint == "" {
		return "UNKNOWN", "Unknown Token", 9
	}

	// Tier 1: Built-in verified tokens
	if tok, ok := knownSolanaTokens[mint]; ok {
		return tok.Symbol, tok.Name, tok.Decimals
	}

	// Dynamic Cache Check
	dynamicTokenCacheMu.RLock()
	if cached, ok := dynamicTokenCache[mint]; ok {
		dynamicTokenCacheMu.RUnlock()
		return cached.Symbol, cached.Name, cached.Decimals
	}
	dynamicTokenCacheMu.RUnlock()

	// Tier 2: TrustWallet Asset Catalog
	tw := getTrustWalletClient()
	if asset, err := tw.GetAssetByID(ctx, "solana:"+mint); err == nil && asset != nil && asset.Symbol != "" {
		res := KnownSolanaToken{
			Symbol:   asset.Symbol,
			Name:     asset.Name,
			Decimals: 9,
		}
		dynamicTokenCacheMu.Lock()
		dynamicTokenCache[mint] = res
		dynamicTokenCacheMu.Unlock()
		return res.Symbol, res.Name, res.Decimals
	}

	// Tier 3: Jupiter Token API
	if client != nil {
		jupTok, err := queryJupiterTokenAPI(ctx, mint, client)
		if err == nil && jupTok != nil {
			dynamicTokenCacheMu.Lock()
			dynamicTokenCache[mint] = *jupTok
			dynamicTokenCacheMu.Unlock()
			return jupTok.Symbol, jupTok.Name, jupTok.Decimals
		}
	}

	// Graceful Fallback
	shortMint := mint
	if len(shortMint) > 8 {
		shortMint = fmt.Sprintf("%s...%s", shortMint[:4], shortMint[len(shortMint)-4:])
	}
	return "SPL", fmt.Sprintf("Unknown Token (%s)", shortMint), 9
}

func queryJupiterTokenAPI(ctx context.Context, mint string, client *http.Client) (*KnownSolanaToken, error) {
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Second}
	}
	url := fmt.Sprintf("https://tokens.jup.ag/token/%s", mint)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jupiter token API HTTP %d", resp.StatusCode)
	}

	var data struct {
		Symbol   string `json:"symbol"`
		Name     string `json:"name"`
		Decimals int    `json:"decimals"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	if strings.TrimSpace(data.Symbol) == "" {
		return nil, fmt.Errorf("empty symbol from jupiter")
	}

	return &KnownSolanaToken{
		Symbol:   data.Symbol,
		Name:     data.Name,
		Decimals: data.Decimals,
	}, nil
}
