package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sigma_finance/internal/domain/model"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// TwelveDataProvider implements Provider for Twelve Data API
type TwelveDataProvider struct {
	client  *http.Client
	baseURL string
}

// NewTwelveDataProvider creates a new Twelve Data provider
func NewTwelveDataProvider() Provider {
	return &TwelveDataProvider{
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: "https://api.twelvedata.com",
	}
}

func (t *TwelveDataProvider) ID() string {
	return "TWELVEDATA"
}

func (t *TwelveDataProvider) Name() string {
	return "Twelve Data"
}

func (t *TwelveDataProvider) Type() ProviderType {
	return ProviderTypeStock
}

func (t *TwelveDataProvider) Capabilities() ProviderCapabilities {
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
		MaxHistoryDays:   365, // Good historical coverage
		SupportsRealtime: true,
		RequiresAPIKey:   true,
		RateLimit: RateLimit{
			RequestsPerMinute: 8,   // 8 requests per minute (free tier)
			RequestsPerDay:    800, // 800 requests per day
			BurstLimit:        3,
		},
		AssetTypes: []string{"STOCK", "ETF", "INDEX", "FOREX", "CRYPTO"},
	}
}

func (t *TwelveDataProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(strings.TrimSpace(internalSymbol))

	// Handle different asset types
	switch assetType {
	case "STOCK", "ETF":
		// Remove exchange suffixes for US stocks
		if strings.Contains(symbol, ":") {
			parts := strings.Split(symbol, ":")
			if len(parts) == 2 && (parts[1] == "US" || parts[1] == "NASDAQ" || parts[1] == "NYSE") {
				symbol = parts[0]
			}
		}
	case "CRYPTO":
		// Convert "BTC/USDT" to "BTC/USDT" (Twelve Data supports this format)
		symbol = strings.ReplaceAll(symbol, "-", "/")
	case "FOREX":
		// Convert "EUR/USD" format
		symbol = strings.ReplaceAll(symbol, "-", "/")
	}

	return symbol, nil
}

func (t *TwelveDataProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	return strings.ToUpper(providerSymbol), nil
}

func (t *TwelveDataProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("twelve data requires API key")
	}

	symbol, err := t.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	interval := t.mapInterval(req.Interval)
	if interval == "" {
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}

	url := fmt.Sprintf("%s/time_series", t.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("symbol", symbol)
	q.Set("interval", interval)
	q.Set("outputsize", strconv.Itoa(req.Limit))
	q.Set("apikey", req.APIKey)
	q.Set("format", "JSON")

	// Add date range if specified
	if !req.From.IsZero() {
		q.Set("start_date", req.From.Format("2006-01-02"))
	}
	if !req.To.IsZero() {
		q.Set("end_date", req.To.Format("2006-01-02"))
	}

	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("twelve data API error: %d", resp.StatusCode)
	}

	var response struct {
		Meta struct {
			Symbol   string `json:"symbol"`
			Interval string `json:"interval"`
			Type     string `json:"type"`
		} `json:"meta"`
		Values []struct {
			Datetime string `json:"datetime"`
			Open     string `json:"open"`
			High     string `json:"high"`
			Low      string `json:"low"`
			Close    string `json:"close"`
			Volume   string `json:"volume"`
		} `json:"values"`
		Status string `json:"status"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if response.Status == "error" {
		return nil, fmt.Errorf("twelve data API error in response")
	}

	if len(response.Values) == 0 {
		return &CandleResponse{
			Candles:   []model.Candle{},
			Source:    t.ID(),
			Timestamp: time.Now(),
			HasMore:   false,
		}, nil
	}

	candles := make([]model.Candle, 0, len(response.Values))

	for _, value := range response.Values {
		// Parse datetime
		timestamp, err := t.parseDateTime(value.Datetime, req.Interval)
		if err != nil {
			continue
		}

		// Filter by time range if specified
		if !req.From.IsZero() && timestamp.Before(req.From) {
			continue
		}
		if !req.To.IsZero() && timestamp.After(req.To) {
			continue
		}

		open, _ := strconv.ParseFloat(value.Open, 64)
		high, _ := strconv.ParseFloat(value.High, 64)
		low, _ := strconv.ParseFloat(value.Low, 64)
		close, _ := strconv.ParseFloat(value.Close, 64)
		volume, _ := strconv.ParseFloat(value.Volume, 64)

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
			Source:    t.ID(),
		}

		candles = append(candles, candle)
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    t.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (t *TwelveDataProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Test the API key with a simple quote request
	url := fmt.Sprintf("%s/quote", t.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	q := req.URL.Query()
	q.Set("symbol", "AAPL")
	q.Set("apikey", apiKey)
	req.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid API key")
	}

	// Check for API key error in response
	var errorResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	}

	if json.NewDecoder(resp.Body).Decode(&errorResp) == nil {
		if errorResp.Code == 401 || errorResp.Status == "error" {
			return fmt.Errorf("invalid API key: %s", errorResp.Message)
		}
	}

	return nil
}

func (t *TwelveDataProvider) IsHealthy(ctx context.Context) bool {
	// Simple health check
	url := fmt.Sprintf("%s/stocks", t.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusUnauthorized
}

// mapInterval converts internal interval to Twelve Data format
func (t *TwelveDataProvider) mapInterval(interval model.CandleInterval) string {
	switch interval {
	case model.Interval1m:
		return "1min"
	case model.Interval5m:
		return "5min"
	case model.Interval15m:
		return "15min"
	case model.Interval30m:
		return "30min"
	case model.Interval1h:
		return "1h"
	case model.Interval4h:
		return "4h"
	case model.Interval1d:
		return "1day"
	default:
		return ""
	}
}

// parseDateTime parses Twelve Data datetime format
func (t *TwelveDataProvider) parseDateTime(datetime string, interval model.CandleInterval) (time.Time, error) {
	// Twelve Data returns different formats based on interval
	if interval == model.Interval1d {
		// Daily format: "2023-12-01"
		return time.Parse("2006-01-02", datetime)
	} else {
		// Intraday format: "2023-12-01 15:30:00"
		return time.Parse("2006-01-02 15:04:05", datetime)
	}
}

func (t *TwelveDataProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	return nil, fmt.Errorf("technical indicators not supported by Twelve Data provider")
}

func (t *TwelveDataProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("twelve data requires API key")
	}

	symbol, err := t.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/quote", t.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("symbol", symbol)
	q.Set("apikey", req.APIKey)
	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("twelve data API error: %d", resp.StatusCode)
	}

	var response struct {
		Symbol    string `json:"symbol"`
		Close     string `json:"close"`
		High      string `json:"high"`
		Low       string `json:"low"`
		Open      string `json:"open"`
		Volume    string `json:"volume"`
		Timestamp int64  `json:"timestamp"`
		Status    string `json:"status"`
		Message   string `json:"message"`
		Code      int    `json:"code"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if response.Status == "error" {
		return nil, fmt.Errorf("twelve data API error: %s (code: %d)", response.Message, response.Code)
	}

	closePrice, err := decimal.NewFromString(response.Close)
	if err != nil {
		return nil, fmt.Errorf("failed to parse close price: %w", err)
	}

	var volume int64
	if response.Volume != "" {
		volume, _ = strconv.ParseInt(response.Volume, 10, 64)
	}

	var timestamp time.Time
	if response.Timestamp > 0 {
		timestamp = time.Unix(response.Timestamp, 0)
	} else {
		timestamp = time.Now()
	}

	return &QuoteResponse{
		Symbol:    req.Symbol,
		Bid:       closePrice,
		Ask:       closePrice,
		Last:      closePrice,
		Volume:    volume,
		Timestamp: timestamp,
		Source:    t.ID(),
	}, nil
}
