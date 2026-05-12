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
}

// NewBinanceProvider creates a new Binance provider
func NewBinanceProvider() Provider {
	return &BinanceProvider{
		client:    &http.Client{Timeout: 30 * time.Second},
		baseURL:   "https://api.binance.com",
		wsBaseURL: "wss://stream.binance.com:9443",
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
	log.Printf("[Binance.GetCandles] symbol=%s assetType=%s interval=%s from=%v to=%v limit=%d",
		req.Symbol, req.AssetType, req.Interval, req.From, req.To, req.Limit)

	symbol, err := b.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		log.Printf("[Binance.GetCandles] MapSymbol error: %v", err)
		return nil, err
	}
	log.Printf("[Binance.GetCandles] mapped symbol=%s", symbol)

	interval := b.mapInterval(req.Interval)
	if interval == "" {
		log.Printf("[Binance.GetCandles] unsupported interval: %s", req.Interval)
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}
	log.Printf("[Binance.GetCandles] mapped interval=%s", interval)

	url := fmt.Sprintf("%s/api/v3/klines", b.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		log.Printf("[Binance.GetCandles] NewRequest error: %v", err)
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("symbol", symbol)
	q.Set("interval", interval)
	q.Set("limit", strconv.Itoa(req.Limit))

	if !req.From.IsZero() {
		q.Set("startTime", strconv.FormatInt(req.From.UnixMilli(), 10))
	}
	if !req.To.IsZero() {
		q.Set("endTime", strconv.FormatInt(req.To.UnixMilli(), 10))
	}

	httpReq.URL.RawQuery = q.Encode()
	log.Printf("[Binance.GetCandles] URL=%s", httpReq.URL.String())

	resp, err := b.client.Do(httpReq)
	if err != nil {
		log.Printf("[Binance.GetCandles] HTTP error: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	log.Printf("[Binance.GetCandles] response status=%d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Binance.GetCandles] binance API error: %d", resp.StatusCode)
		return nil, fmt.Errorf("binance API error: %d", resp.StatusCode)
	}

	var rawKlines [][]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawKlines); err != nil {
		log.Printf("[Binance.GetCandles] decode error: %v", err)
		return nil, err
	}

	log.Printf("[Binance.GetCandles] received %d klines from Binance", len(rawKlines))

	candles := make([]model.Candle, 0, len(rawKlines))

	for _, kline := range rawKlines {
		if len(kline) < 12 {
			continue
		}

		timestamp := time.UnixMilli(int64(kline[0].(float64)))
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
	log.Printf("[Binance.GetQuote] symbol=%s assetType=%s", req.Symbol, req.AssetType)

	symbol, err := b.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		log.Printf("[Binance.GetQuote] MapSymbol error: %v", err)
		return nil, err
	}
	log.Printf("[Binance.GetQuote] mapped symbol=%s", symbol)

	url := fmt.Sprintf("%s/api/v3/ticker/24hr?symbol=%s", b.baseURL, symbol)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		log.Printf("[Binance.GetQuote] NewRequest error: %v", err)
		return nil, err
	}

	resp, err := b.client.Do(httpReq)
	if err != nil {
		log.Printf("[Binance.GetQuote] HTTP error: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	log.Printf("[Binance.GetQuote] response status=%d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Binance.GetQuote] Binance API error: %d", resp.StatusCode)
		return nil, fmt.Errorf("binance API error: %d", resp.StatusCode)
	}

	var ticker binance24hrTicker
	if err := json.NewDecoder(resp.Body).Decode(&ticker); err != nil {
		log.Printf("[Binance.GetQuote] decode error: %v", err)
		return nil, err
	}

	lastPrice, err := decimal.NewFromString(ticker.LastPrice)
	if err != nil {
		log.Printf("[Binance.GetQuote] parse lastPrice error: %v", err)
		lastPrice = decimal.Zero
	}

	bidPrice, err := decimal.NewFromString(ticker.BidPrice)
	if err != nil {
		log.Printf("[Binance.GetQuote] parse bidPrice error: %v", err)
		bidPrice = decimal.Zero
	}

	askPrice, err := decimal.NewFromString(ticker.AskPrice)
	if err != nil {
		log.Printf("[Binance.GetQuote] parse askPrice error: %v", err)
		askPrice = decimal.Zero
	}

	volume, err := strconv.ParseInt(ticker.Volume, 10, 64)
	if err != nil {
		log.Printf("[Binance.GetQuote] parse volume error: %v", err)
		volume = 0
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
