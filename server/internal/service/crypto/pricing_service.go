package crypto

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
	"sigma_finance/internal/domain/model"
)

var CryptoTickerAliases = map[string]string{
	"RNDR":  "RENDER",
	"MATIC": "POL",
	"LEND":  "AAVE",
	"MC":    "BEAM",
	"ANT":   "ARAGON",
	"WSOL":  "SOL",
	"WETH":  "ETH",
	"WBTC":  "BTC",
}

var Stablecoins = map[string]bool{
	"USDT":  true,
	"USDC":  true,
	"DAI":   true,
	"BUSD":  true,
	"FDUSD": true,
	"USDE":  true,
	"TUSD":  true,
	"PYUSD": true,
	"EURC":  true,
}

// NormalizeCryptoSymbol maps legacy/wrapped tickers to active trading symbols
func NormalizeCryptoSymbol(symbol string) string {
	clean := strings.ToUpper(strings.TrimSpace(symbol))
	if target, ok := CryptoTickerAliases[clean]; ok {
		return target
	}
	return clean
}

// IsStablecoin checks if symbol is a known pegged stablecoin
func IsStablecoin(symbol string) bool {
	clean := strings.ToUpper(strings.TrimSpace(symbol))
	return Stablecoins[clean]
}

type BinanceQuote struct {
	Symbol             string `json:"symbol"`
	LastPrice          string `json:"lastPrice"`
	PriceChangePercent string `json:"priceChangePercent"`
}

type QuoteResult struct {
	Price        decimal.Decimal
	DayChange24h decimal.Decimal
	Source       string
	Found        bool
}

type PricingService struct {
	db             bun.IDB
	httpClient     *http.Client
	cacheMu        sync.RWMutex
	binanceCache   map[string]BinanceQuote
	binanceCacheAt time.Time
}

func NewPricingService(db bun.IDB) *PricingService {
	return &PricingService{
		db:           db,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		binanceCache: make(map[string]BinanceQuote),
	}
}

// fetchBinanceQuotes loads all 24hr tickers into cache with 60s TTL
func (s *PricingService) fetchBinanceQuotes(ctx context.Context) (map[string]BinanceQuote, error) {
	s.cacheMu.RLock()
	if len(s.binanceCache) > 0 && time.Since(s.binanceCacheAt) < 60*time.Second {
		cached := s.binanceCache
		s.cacheMu.RUnlock()
		return cached, nil
	}
	s.cacheMu.RUnlock()

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.binance.com/api/v3/ticker/24hr", nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance 24hr ticker API returned status %d", resp.StatusCode)
	}

	var rawQuotes []BinanceQuote
	if err := json.NewDecoder(resp.Body).Decode(&rawQuotes); err != nil {
		return nil, err
	}

	quoteMap := make(map[string]BinanceQuote, len(rawQuotes))
	for _, q := range rawQuotes {
		quoteMap[strings.ToUpper(q.Symbol)] = q
	}

	s.cacheMu.Lock()
	s.binanceCache = quoteMap
	s.binanceCacheAt = time.Now()
	s.cacheMu.Unlock()

	return quoteMap, nil
}

// ResolveTokenPrice fetches price across Stablecoin -> Binance CEX -> Jupiter DEX -> DexScreener
func (s *PricingService) ResolveTokenPrice(ctx context.Context, symbol string, tokenAddress *string) QuoteResult {
	normSym := NormalizeCryptoSymbol(symbol)

	// 1. Stablecoin Peg
	if IsStablecoin(normSym) {
		one := decimal.NewFromInt(1)
		return QuoteResult{
			Price:        one,
			DayChange24h: decimal.Zero,
			Source:       "STABLE_PEG",
			Found:        true,
		}
	}

	// 2. Binance 24hr Ticker
	binanceQuotes, err := s.fetchBinanceQuotes(ctx)
	if err == nil && len(binanceQuotes) > 0 {
		candidates := []string{
			normSym + "USDT",
			normSym + "FDUSD",
			normSym + "USDC",
			normSym + "BTC",
		}

		for _, pair := range candidates {
			if q, ok := binanceQuotes[pair]; ok {
				lastP, errP := decimal.NewFromString(q.LastPrice)
				chgP, _ := decimal.NewFromString(q.PriceChangePercent)
				if errP == nil && lastP.IsPositive() {
					return QuoteResult{
						Price:        lastP,
						DayChange24h: chgP,
						Source:       "BINANCE",
						Found:        true,
					}
				}
			}
		}
	}

	// 3. Solana DEX Fallback via Jupiter Public API
	if tokenAddress != nil && *tokenAddress != "" && len(*tokenAddress) >= 32 && len(*tokenAddress) <= 44 && !strings.HasPrefix(*tokenAddress, "0x") {
		jupRes := s.fetchJupiterPrice(ctx, *tokenAddress)
		if jupRes.Found {
			return jupRes
		}
	}

	// 4. EVM DEX Fallback via DexScreener Public API
	if tokenAddress != nil && strings.HasPrefix(strings.ToLower(*tokenAddress), "0x") {
		dexRes := s.fetchDexScreenerPrice(ctx, *tokenAddress)
		if dexRes.Found {
			return dexRes
		}
	}

	return QuoteResult{Found: false}
}

func (s *PricingService) fetchJupiterPrice(ctx context.Context, mint string) QuoteResult {
	url := fmt.Sprintf("https://api.jup.ag/price/v2?ids=%s", mint)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return QuoteResult{Found: false}
	}

	resp, err := s.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return QuoteResult{Found: false}
	}
	defer resp.Body.Close()

	var jupData struct {
		Data map[string]struct {
			Price string `json:"price"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&jupData); err == nil {
		if item, ok := jupData.Data[mint]; ok && item.Price != "" {
			p, errP := decimal.NewFromString(item.Price)
			if errP == nil && p.IsPositive() {
				return QuoteResult{
					Price:        p,
					DayChange24h: decimal.Zero,
					Source:       "JUPITER",
					Found:        true,
				}
			}
		}
	}

	return QuoteResult{Found: false}
}

func (s *PricingService) fetchDexScreenerPrice(ctx context.Context, tokenAddr string) QuoteResult {
	url := fmt.Sprintf("https://api.dexscreener.com/latest/dex/tokens/%s", tokenAddr)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return QuoteResult{Found: false}
	}

	resp, err := s.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return QuoteResult{Found: false}
	}
	defer resp.Body.Close()

	var dexData struct {
		Pairs []struct {
			PriceUsd    string `json:"priceUsd"`
			PriceChange struct {
				H24 float64 `json:"h24"`
			} `json:"priceChange"`
		} `json:"pairs"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&dexData); err == nil && len(dexData.Pairs) > 0 {
		pair := dexData.Pairs[0]
		if pair.PriceUsd != "" {
			p, errP := decimal.NewFromString(pair.PriceUsd)
			if errP == nil && p.IsPositive() {
				chg := decimal.NewFromFloat(pair.PriceChange.H24)
				return QuoteResult{
					Price:        p,
					DayChange24h: chg,
					Source:       "DEXSCREENER",
					Found:        true,
				}
			}
		}
	}

	return QuoteResult{Found: false}
}

// RefreshBalances updates prices and persists them to the database
func (s *PricingService) RefreshBalances(ctx context.Context, balances []*model.WalletBalance) error {
	if len(balances) == 0 {
		return nil
	}

	now := time.Now().UTC()
	for _, b := range balances {
		if b.IsSpam || b.IsHidden {
			continue
		}

		res := s.ResolveTokenPrice(ctx, b.Symbol, b.TokenAddress)
		if res.Found && res.Price.IsPositive() {
			b.CurrentPrice = &res.Price
			b.DayChange24h = &res.DayChange24h
			b.PriceUpdatedAt = &now
			b.PriceSource = &res.Source

			if s.db != nil {
				_, err := s.db.NewUpdate().
					Model((*model.WalletBalance)(nil)).
					Set("current_price = ?", res.Price).
					Set("day_change_24h = ?", res.DayChange24h).
					Set("price_updated_at = ?", now).
					Set("price_source = ?", res.Source).
					Where("id = ?", b.ID).
					Exec(ctx)
				if err != nil {
					log.Printf("[WARN] [PricingService] Failed to persist price for balance %s (%s): %v", b.ID, b.Symbol, err)
				}
			}
		}
	}

	return nil
}

// RefreshAllActiveBalances updates all active wallet balances in the database
func (s *PricingService) RefreshAllActiveBalances(ctx context.Context) error {
	if s.db == nil {
		return nil
	}

	var balances []*model.WalletBalance
	err := s.db.NewSelect().
		Model(&balances).
		Where("is_spam = false AND is_hidden = false").
		Scan(ctx)
	if err != nil {
		return fmt.Errorf("failed to query active balances: %w", err)
	}

	return s.RefreshBalances(ctx, balances)
}

// RefreshSingleBalance updates a single balance by ID
func (s *PricingService) RefreshSingleBalance(ctx context.Context, balanceID string) (*model.WalletBalance, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database unavailable")
	}

	var bal model.WalletBalance
	err := s.db.NewSelect().
		Model(&bal).
		Where("id = ?", balanceID).
		Scan(ctx)
	if err != nil {
		return nil, fmt.Errorf("wallet balance not found: %w", err)
	}

	err = s.RefreshBalances(ctx, []*model.WalletBalance{&bal})
	if err != nil {
		return nil, err
	}

	return &bal, nil
}
