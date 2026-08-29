package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sigma_finance/internal/domain/model"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// BinanceProvider implements Provider for Binance Spot API
type BinanceProvider struct {
	client    *http.Client
	baseURL   string
	wsBaseURL string
	CooldownMixin
}

// NewBinanceProvider creates a new Binance provider
func NewBinanceProvider() *BinanceProvider {
	return &BinanceProvider{
		client:        &http.Client{Timeout: 30 * time.Second},
		baseURL:       "https://api.binance.com",
		wsBaseURL:     "wss://stream.binance.com:9443",
		CooldownMixin: NewCooldownMixin(DefaultRetryAfterMax),
	}
}

func (b *BinanceProvider) ID() string {
	return "BINANCE"
}

func (b *BinanceProvider) Name() string {
	return "Binance Spot"
}

func (b *BinanceProvider) Type() ProviderType {
	return ProviderTypeCrypto
}

func (b *BinanceProvider) Capabilities() ProviderCapabilities {
	return ProviderCapabilities{
		Intervals: []model.CandleInterval{
			model.Interval1m,
			model.Interval5m,
			model.Interval15m,
			model.Interval30m,
			model.Interval1h,
			model.Interval4h,
			model.Interval1d,
		},
		MaxHistoryDays:   1000, // Binance has extensive history
		SupportsRealtime: true,
		RequiresAPIKey:   false, // Public endpoints
		RateLimit: RateLimit{
			RequestsPerMinute: 1200, // 1200 requests per minute
			RequestsPerDay:    -1,   // No daily limit
			BurstLimit:        10,
		},
		AssetTypes: []string{"CRYPTO"},
	}
}

func (b *BinanceProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	if assetType != "CRYPTO" {
		return "", fmt.Errorf("binance only supports crypto assets")
	}

	// Convert internal format (e.g., "BTC/USDT") to Binance format ("BTCUSDT")
	symbol := strings.ReplaceAll(strings.ToUpper(internalSymbol), "/", "")
	symbol = strings.ReplaceAll(symbol, "-", "")

	return symbol, nil
}

func (b *BinanceProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	// Convert Binance format back to internal format
	// This is simplified - in production you'd need a proper symbol mapping table
	symbol := strings.ToUpper(providerSymbol)

	// Common pairs
	if strings.HasSuffix(symbol, "USDT") {
		base := strings.TrimSuffix(symbol, "USDT")
		return base + "/USDT", nil
	}
	if strings.HasSuffix(symbol, "BTC") {
		base := strings.TrimSuffix(symbol, "BTC")
		return base + "/BTC", nil
	}
	if strings.HasSuffix(symbol, "ETH") {
		base := strings.TrimSuffix(symbol, "ETH")
		return base + "/ETH", nil
	}

	return symbol, nil
}

func (b *BinanceProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if b.IsInCooldown() {
		return nil, b.CooldownError(b.ID(), b.Name())
	}

	log.Printf("[Binance.GetCandles] symbol=%s assetType=%s interval=%s from=%v to=%v limit=%d",
		req.Symbol, req.AssetType, req.Interval, req.From, req.To, req.Limit)

	symbol, err := b.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetCandles] MapSymbol error: %v", err)
		return nil, err
	}
	log.Printf("[INFO] [Binance.GetCandles] mapped symbol=%s", symbol)
	interval := b.mapInterval(req.Interval)
	if interval == "" {
		log.Printf("[ERROR] [Binance.GetCandles] unsupported interval: %s", req.Interval)
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}
	log.Printf("[INFO] [Binance.GetCandles] mapped interval=%s", interval)
	url := fmt.Sprintf("%s/api/v3/klines", b.baseURL)
	maxLimit := req.Limit
	if maxLimit <= 0 {
		maxLimit = 5000
	}

	var candles []model.Candle
	currentFrom := req.From

	for len(candles) < maxLimit {
		batchLimit := maxLimit - len(candles)
		if batchLimit > 1000 {
			batchLimit = 1000
		}

		httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			log.Printf("[ERROR] [Binance.GetCandles] NewRequest error: %v", err)
			if len(candles) > 0 {
				break
			}
			return nil, err
		}

		q := httpReq.URL.Query()
		q.Set("symbol", symbol)
		q.Set("interval", interval)
		q.Set("limit", strconv.Itoa(batchLimit))

		if !currentFrom.IsZero() {
			q.Set("startTime", strconv.FormatInt(currentFrom.UnixMilli(), 10))
		}
		if !req.To.IsZero() {
			q.Set("endTime", strconv.FormatInt(req.To.UnixMilli(), 10))
		}

		httpReq.URL.RawQuery = q.Encode()
		resp, err := b.client.Do(httpReq)
		if err != nil {
			log.Printf("[ERROR] [Binance.GetCandles] HTTP error: %v", err)
			if len(candles) > 0 {
				break
			}
			return nil, err
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			cooldownDuration := ParseRetryAfter(resp, DefaultRetryAfterMax, DefaultRetryAfterMax)
			b.EnterCooldown(cooldownDuration)
			if len(candles) > 0 {
				break
			}
			return nil, &ProviderError{
				Provider:          b.ID(),
				Code:              "RATE_LIMITED",
				Message:           "Binance rate limit exceeded",
				HTTPCode:          resp.StatusCode,
				Retryable:         true,
				Fallback:          true,
				RetryAfterSeconds: int(cooldownDuration.Seconds()),
			}
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			log.Printf("[ERROR] [Binance.GetCandles] binance API error: %d", resp.StatusCode)
			if len(candles) > 0 {
				break
			}
			return nil, fmt.Errorf("binance API error: %d", resp.StatusCode)
		}

		var rawKlines [][]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&rawKlines); err != nil {
			resp.Body.Close()
			log.Printf("[ERROR] [Binance.GetCandles] decode error: %v", err)
			if len(candles) > 0 {
				break
			}
			return nil, err
		}
		resp.Body.Close()

		if len(rawKlines) == 0 {
			break
		}

		var lastTime time.Time
		for _, kline := range rawKlines {
			if len(kline) < 12 {
				continue
			}

			timestamp := time.UnixMilli(int64(kline[0].(float64)))
			lastTime = timestamp
			open := b.parseFloat(kline[1])
			high := b.parseFloat(kline[2])
			low := b.parseFloat(kline[3])
			close := b.parseFloat(kline[4])
			volume := b.parseFloat(kline[5])

			// Filter by time range if specified
			if !req.From.IsZero() && timestamp.Before(req.From) {
				continue
			}
			if !req.To.IsZero() && timestamp.After(req.To) {
				continue
			}

			candle := model.Candle{
				Symbol:    req.Symbol,
				AssetType: req.AssetType,
				Interval:  req.Interval,
				Open:      decimal.NewFromFloat(open),
				High:      decimal.NewFromFloat(high),
				Low:       decimal.NewFromFloat(low),
				Close:     decimal.NewFromFloat(close),
				Volume:    decimal.NewFromFloat(volume),
				Timestamp: timestamp,
				Source:    b.ID(),
			}

			candles = append(candles, candle)
		}

		if len(rawKlines) < batchLimit || lastTime.IsZero() || (!req.To.IsZero() && !lastTime.Before(req.To)) {
			break
		}
		currentFrom = lastTime.Add(time.Millisecond)
	}

	log.Printf("[INFO] [Binance.GetCandles] returning total %d klines from Binance", len(candles))

	return &CandleResponse{
		Candles:   candles,
		Source:    b.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (b *BinanceProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	// Binance public endpoints don't require API key validation
	return nil
}

func (b *BinanceProvider) IsHealthy(ctx context.Context) bool {
	// Simple health check - ping the server time endpoint
	url := fmt.Sprintf("%s/api/v3/time", b.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// mapInterval converts internal interval to Binance format
func (b *BinanceProvider) mapInterval(interval model.CandleInterval) string {
	switch interval {
	case model.Interval1m:
		return "1m"
	case model.Interval5m:
		return "5m"
	case model.Interval15m:
		return "15m"
	case model.Interval30m:
		return "30m"
	case model.Interval1h:
		return "1h"
	case model.Interval4h:
		return "4h"
	case model.Interval1d:
		return "1d"
	default:
		return ""
	}
}

// parseFloat safely parses interface{} to float64
func (b *BinanceProvider) parseFloat(v interface{}) float64 {
	switch val := v.(type) {
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	default:
		return 0
	}
}

func (b *BinanceProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	if b.IsInCooldown() {
		return nil, b.CooldownError(b.ID(), b.Name())
	}
	return nil, fmt.Errorf("technical indicators not supported by Binance provider")
}

type binance24hrTicker struct {
	Symbol             string `json:"symbol"`
	PriceChange        string `json:"priceChange"`
	PriceChangePercent string `json:"priceChangePercent"`
	WeightedAvgPrice   string `json:"weightedAvgPrice"`
	PrevClosePrice     string `json:"prevClosePrice"`
	LastPrice          string `json:"lastPrice"`
	LastQty            string `json:"lastQty"`
	BidPrice           string `json:"bidPrice"`
	AskPrice           string `json:"askPrice"`
	OpenPrice          string `json:"openPrice"`
	HighPrice          string `json:"highPrice"`
	LowPrice           string `json:"lowPrice"`
	Volume             string `json:"volume"`
	QuoteVolume        string `json:"quoteVolume"`
	OpenTime           int64  `json:"openTime"`
	CloseTime          int64  `json:"closeTime"`
	FirstId            int64  `json:"firstId"`
	LastId             int64  `json:"lastId"`
	Count              int64  `json:"count"`
}

func (b *BinanceProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if b.IsInCooldown() {
		return nil, b.CooldownError(b.ID(), b.Name())
	}

	log.Printf("[INFO] [Binance.GetQuote] symbol=%s assetType=%s", req.Symbol, req.AssetType)
	symbol, err := b.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] MapSymbol error: %v", err)
		return nil, err
	}
	log.Printf("[INFO] [Binance.GetQuote] mapped symbol=%s", symbol)
	url := fmt.Sprintf("%s/api/v3/ticker/24hr?symbol=%s", b.baseURL, symbol)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] NewRequest error: %v", err)
		return nil, err
	}

	resp, err := b.client.Do(httpReq)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] HTTP error: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	log.Printf("[INFO] [Binance.GetQuote] response status=%d", resp.StatusCode)
	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, DefaultRetryAfterMax, DefaultRetryAfterMax)
		b.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          b.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Binance rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[ERROR] [Binance.GetQuote] Binance API error: %d", resp.StatusCode)
		return nil, fmt.Errorf("binance API error: %d", resp.StatusCode)
	}

	var ticker binance24hrTicker
	if err := json.NewDecoder(resp.Body).Decode(&ticker); err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] decode error: %v", err)
		return nil, err
	}

	lastPrice, err := decimal.NewFromString(ticker.LastPrice)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] parse lastPrice error: %v", err)
		lastPrice = decimal.Zero
	}

	bidPrice, err := decimal.NewFromString(ticker.BidPrice)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] parse bidPrice error: %v", err)
		bidPrice = decimal.Zero
	}

	askPrice, err := decimal.NewFromString(ticker.AskPrice)
	if err != nil {
		log.Printf("[ERROR] [Binance.GetQuote] parse askPrice error: %v", err)
		askPrice = decimal.Zero
	}

	var volume int64
	if ticker.Volume != "" {
		fvol, err := strconv.ParseFloat(ticker.Volume, 64)
		if err != nil {
			log.Printf("[ERROR] [Binance.GetQuote] parse volume error: %v", err)
		} else {
			volume = int64(fvol)
		}
	}

	log.Printf("[Binance.GetQuote] quote: last=%s bid=%s ask=%s volume=%d",
		ticker.LastPrice, ticker.BidPrice, ticker.AskPrice, volume)

	return &QuoteResponse{
		Symbol:    req.Symbol,
		Bid:       bidPrice,
		Ask:       askPrice,
		Last:      lastPrice,
		Volume:    volume,
		Timestamp: time.Now(),
		Source:    b.ID(),
	}, nil
}
