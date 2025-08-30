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
)

// CryptoCompareProvider implements Provider for CryptoCompare API
type CryptoCompareProvider struct {
	client  *http.Client
	baseURL string
}

// NewCryptoCompareProvider creates a new CryptoCompare provider
func NewCryptoCompareProvider() Provider {
	return &CryptoCompareProvider{
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: "https://min-api.cryptocompare.com/data",
	}
}

func (c *CryptoCompareProvider) ID() string {
	return "CRYPTOCOMPARE"
}

func (c *CryptoCompareProvider) Name() string {
	return "CryptoCompare"
}

func (c *CryptoCompareProvider) Type() ProviderType {
	return ProviderTypeCrypto
}

func (c *CryptoCompareProvider) Capabilities() ProviderCapabilities {
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
		MaxHistoryDays:   7,     // Free tier: 7 days full resolution
		SupportsRealtime: false, // Aggregated data, not real-time
		RequiresAPIKey:   true,
		RateLimit: RateLimit{
			RequestsPerMinute: 100,    // Generous for free tier
			RequestsPerDay:    100000, // 100k calls/month
			BurstLimit:        10,
		},
		AssetTypes: []string{"CRYPTO"},
	}
}

func (c *CryptoCompareProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	if assetType != "CRYPTO" {
		return "", fmt.Errorf("cryptocompare only supports crypto assets")
	}

	// Convert "BTC/USDT" to "BTC" and "USDT"
	parts := strings.Split(strings.ToUpper(internalSymbol), "/")
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid crypto symbol format: %s", internalSymbol)
	}

	return parts[0], nil // Return base currency
}

func (c *CryptoCompareProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	// CryptoCompare uses base currency symbols, need to reconstruct pair
	// This is simplified - in production you'd need proper pair mapping
	return strings.ToUpper(providerSymbol) + "/USDT", nil
}

func (c *CryptoCompareProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("cryptocompare requires API key")
	}

	symbol, err := c.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	// Extract quote currency from symbol
	parts := strings.Split(req.Symbol, "/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid symbol format for cryptocompare: %s", req.Symbol)
	}
	quoteCurrency := parts[1]

	endpoint, limit := c.getEndpointAndLimit(req.Interval, req.Limit)
	if endpoint == "" {
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}

	url := fmt.Sprintf("%s/%s", c.baseURL, endpoint)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("fsym", symbol)
	q.Set("tsym", quoteCurrency)
	q.Set("limit", strconv.Itoa(limit))
	q.Set("api_key", req.APIKey)

	if !req.To.IsZero() {
		q.Set("toTs", strconv.FormatInt(req.To.Unix(), 10))
	}

	httpReq.URL.RawQuery = q.Encode()

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cryptocompare API error: %d", resp.StatusCode)
	}

	var response struct {
		Response   string `json:"Response"`
		Message    string `json:"Message"`
		HasWarning bool   `json:"HasWarning"`
		Data       struct {
			Data []struct {
				Time       int64   `json:"time"`
				Close      float64 `json:"close"`
				High       float64 `json:"high"`
				Low        float64 `json:"low"`
				Open       float64 `json:"open"`
				VolumeFrom float64 `json:"volumefrom"`
				VolumeTo   float64 `json:"volumeto"`
			} `json:"Data"`
		} `json:"Data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if response.Response == "Error" {
		return nil, fmt.Errorf("cryptocompare API error: %s", response.Message)
	}

	candles := make([]model.Candle, 0, len(response.Data.Data))

	for _, item := range response.Data.Data {
		timestamp := time.Unix(item.Time, 0)

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
			Open:      model.FromFloat(item.Open),
			High:      model.FromFloat(item.High),
			Low:       model.FromFloat(item.Low),
			Close:     model.FromFloat(item.Close),
			Volume:    item.VolumeFrom, // Use base currency volume
			Timestamp: timestamp,
			Source:    c.ID(),
		}

		candles = append(candles, candle)
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    c.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (c *CryptoCompareProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Test the API key with a simple request
	url := fmt.Sprintf("%s/price", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	q := req.URL.Query()
	q.Set("fsym", "BTC")
	q.Set("tsyms", "USD")
	q.Set("api_key", apiKey)
	req.URL.RawQuery = q.Encode()

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid API key")
	}

	return nil
}

func (c *CryptoCompareProvider) IsHealthy(ctx context.Context) bool {
	// Simple health check
	url := fmt.Sprintf("%s/price", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	q := req.URL.Query()
	q.Set("fsym", "BTC")
	q.Set("tsyms", "USD")
	req.URL.RawQuery = q.Encode()

	resp, err := c.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusUnauthorized
}

// getEndpointAndLimit returns the appropriate endpoint and limit for the interval
func (c *CryptoCompareProvider) getEndpointAndLimit(interval model.CandleInterval, requestedLimit int) (string, int) {
	switch interval {
	case model.Interval1m:
		return "v2/histominute", min(requestedLimit, 2000)
	case model.Interval5m, model.Interval15m, model.Interval30m:
		return "v2/histominute", min(requestedLimit, 2000)
	case model.Interval1h, model.Interval4h:
		return "v2/histohour", min(requestedLimit, 2000)
	case model.Interval1d:
		return "v2/histoday", min(requestedLimit, 2000)
	default:
		return "", 0
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
