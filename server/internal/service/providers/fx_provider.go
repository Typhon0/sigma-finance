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

// FXProvider implements Provider interface for FX rate fetching.
// It uses Twelve Data FOREX (with API key) as primary and Frankfurter (free) as fallback.
type FXProvider struct {
	client    *http.Client
	tdBaseURL string
	fkBaseURL string
	CooldownMixin
}

// NewFXProvider creates a new FX provider
func NewFXProvider() *FXProvider {
	return &FXProvider{
		client:        &http.Client{Timeout: 30 * time.Second},
		tdBaseURL:     "https://api.twelvedata.com",
		fkBaseURL:     "https://api.frankfurter.dev",
		CooldownMixin: NewCooldownMixin(DefaultRetryAfterMax),
	}
}

func (f *FXProvider) ID() string {
	return "FX_PROVIDER"
}

func (f *FXProvider) Name() string {
	return "FX Rate Provider"
}

func (f *FXProvider) Type() ProviderType {
	return ProviderTypeForex
}

func (f *FXProvider) Capabilities() ProviderCapabilities {
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
		MaxHistoryDays:   365,
		SupportsRealtime: false,
		RequiresAPIKey:   false, // Frankfurter is free, Twelve Data is optional
		RateLimit: RateLimit{
			RequestsPerMinute: 60,
			RequestsPerDay:    10000,
			BurstLimit:        10,
		},
		AssetTypes: []string{"FOREX"},
	}
}

// MapSymbol converts internal "EUR/USD" format to provider-specific format
func (f *FXProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(strings.TrimSpace(internalSymbol))

	if assetType != "FOREX" {
		return "", fmt.Errorf("MapSymbol only supports FOREX asset type, got %s", assetType)
	}

	// Internal format is "EUR/USD", Twelve Data uses "EUR/USD" directly
	return symbol, nil
}

// NormalizeSymbol converts provider symbol back to internal format
func (f *FXProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	return strings.ToUpper(providerSymbol), nil
}

// GetCandles fetches historical FX rates for charting
func (f *FXProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if f.IsInCooldown() {
		return nil, f.CooldownError(f.ID(), f.Name())
	}

	if req.APIKey != "" {
		return f.getTwelveDataCandles(ctx, req)
	}
	return f.getFrankfurterCandles(ctx, req)
}

// getTwelveDataCandles fetches FX candles from Twelve Data API
func (f *FXProvider) getTwelveDataCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	symbol, err := f.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	interval := f.mapInterval(req.Interval)
	if interval == "" {
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}

	url := fmt.Sprintf("%s/time_series", f.tdBaseURL)
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

	if !req.From.IsZero() {
		q.Set("start_date", req.From.Format("2006-01-02"))
	}
	if !req.To.IsZero() {
		q.Set("end_date", req.To.Format("2006-01-02"))
	}

	httpReq.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, DefaultRetryAfterMax, DefaultRetryAfterMax)
		f.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          f.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Twelve Data rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

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
		Status  string `json:"status"`
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if response.Status == "error" {
		// Text-based rate limit detection (Twelve Data returns code 429 in body)
		if response.Code == 429 {
			f.EnterCooldown(DefaultRetryAfterMax)
			return nil, &ProviderError{
				Provider:          f.ID(),
				Code:              "RATE_LIMITED",
				Message:           fmt.Sprintf("Twelve Data rate limit exceeded: %s", response.Message),
				HTTPCode:          429,
				Retryable:         true,
				Fallback:          true,
				RetryAfterSeconds: int(DefaultRetryAfterMax.Seconds()),
			}
		}
		return nil, fmt.Errorf("twelve data API error: %s (code: %d)", response.Message, response.Code)
	}

	if len(response.Values) == 0 {
		return &CandleResponse{
			Candles:   []model.Candle{},
			Source:    f.ID(),
			Timestamp: time.Now(),
			HasMore:   false,
		}, nil
	}

	candles := make([]model.Candle, 0, len(response.Values))

	for _, value := range response.Values {
		timestamp, err := f.parseDateTime(value.Datetime, req.Interval)
		if err != nil {
			continue
		}

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

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      decimal.NewFromFloat(open),
			High:      decimal.NewFromFloat(high),
			Low:       decimal.NewFromFloat(low),
			Close:     decimal.NewFromFloat(close),
			Volume:    decimal.NewFromFloat(volume),
			Timestamp: timestamp,
			Source:    f.ID(),
		})
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    f.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

// getFrankfurterCandles fetches FX candles from Frankfurter API (free, daily only)
func (f *FXProvider) getFrankfurterCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	parts := strings.Split(req.Symbol, "/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid forex symbol format: %s, expected BASE/QUOTE", req.Symbol)
	}
	fromCurrency := parts[0]
	toCurrency := parts[1]

	// Frankfurter only supports daily data, return error for intraday requests
	if req.Interval != model.Interval1d {
		return nil, &ProviderError{
			Provider:  f.ID(),
			Code:      "GRANULARITY_NOT_SUPPORTED",
			Message:   fmt.Sprintf("Frankfurter only supports daily granularity, got %s", req.Interval),
			HTTPCode:  200,
			Retryable: false,
			Fallback:  false,
		}
	}

	url := fmt.Sprintf("%s/v1/%s/%s?start_date=%s&end_date=%s",
		f.fkBaseURL, fromCurrency, toCurrency,
		req.From.Format("2006-01-02"), req.To.Format("2006-01-02"))

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, DefaultRetryAfterMax, DefaultRetryAfterMax)
		f.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          f.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Frankfurter rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("frankfurter API error: %d", resp.StatusCode)
	}

	var response struct {
		Base      string                         `json:"base"`
		StartDate string                         `json:"start_date"`
		EndDate   string                         `json:"end_date"`
		Rates     map[string]map[string]float64 `json:"rates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	candles := make([]model.Candle, 0, len(response.Rates))

	for dateStr, rateMap := range response.Rates {
		timestamp, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		rateVal, ok := rateMap[toCurrency]
		if !ok {
			continue
		}

		closePrice := decimal.NewFromFloat(rateVal)

		// Frankfurter only provides close rate, use same for open/high/low
		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  model.Interval1d,
			Open:      closePrice,
			High:      closePrice,
			Low:       closePrice,
			Close:     closePrice,
			Volume:    decimal.Zero,
			Timestamp: timestamp,
			Source:    f.ID(),
		})
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    f.ID(),
		Timestamp: time.Now(),
		HasMore:   false,
	}, nil
}

// GetQuote fetches the latest FX rate for a single pair
func (f *FXProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if f.IsInCooldown() {
		return nil, f.CooldownError(f.ID(), f.Name())
	}

	if req.APIKey != "" {
		return f.getTwelveDataQuote(ctx, req)
	}
	return f.getFrankfurterQuote(ctx, req)
}

// getTwelveDataQuote fetches a quote from Twelve Data
func (f *FXProvider) getTwelveDataQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	symbol, err := f.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/quote", f.tdBaseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("symbol", symbol)
	q.Set("apikey", req.APIKey)
	httpReq.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, DefaultRetryAfterMax, DefaultRetryAfterMax)
		f.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          f.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Twelve Data rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

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
		// Text-based rate limit detection (Twelve Data returns code 429 in body)
		if response.Code == 429 {
			f.EnterCooldown(DefaultRetryAfterMax)
			return nil, &ProviderError{
				Provider:          f.ID(),
				Code:              "RATE_LIMITED",
				Message:           fmt.Sprintf("Twelve Data rate limit exceeded: %s", response.Message),
				HTTPCode:          429,
				Retryable:         true,
				Fallback:          true,
				RetryAfterSeconds: int(DefaultRetryAfterMax.Seconds()),
			}
		}
		return nil, fmt.Errorf("twelve data API error: %s (code: %d)", response.Message, response.Code)
	}

	closePrice, err := decimal.NewFromString(response.Close)
	if err != nil {
		return nil, fmt.Errorf("failed to parse close price: %w", err)
	}

	var volume int64
	if response.Volume != "" {
		fvol, _ := strconv.ParseFloat(response.Volume, 64)
		volume = int64(fvol)
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
		Source:    f.ID(),
	}, nil
}

// getFrankfurterQuote fetches a quote from Frankfurter (latest rate)
func (f *FXProvider) getFrankfurterQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	parts := strings.Split(req.Symbol, "/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid forex symbol format: %s, expected BASE/QUOTE", req.Symbol)
	}
	fromCurrency := parts[0]
	toCurrency := parts[1]

	url := fmt.Sprintf("%s/v1/latest?from=%s&to=%s", f.fkBaseURL, fromCurrency, toCurrency)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, DefaultRetryAfterMax, DefaultRetryAfterMax)
		f.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          f.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Frankfurter rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("frankfurter API error: %d", resp.StatusCode)
	}

	var response struct {
		Base  string             `json:"base"`
		Date  string             `json:"date"`
		Rates map[string]float64 `json:"rates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	rateVal, ok := response.Rates[toCurrency]
	if !ok {
		return nil, &ProviderError{
			Provider: f.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no rate found for %s/%s", fromCurrency, toCurrency),
			HTTPCode: 200,
			Fallback: false,
		}
	}

	lastPrice := decimal.NewFromFloat(rateVal)

	timestamp := time.Now()
	if response.Date != "" {
		if parsed, err := time.Parse("2006-01-02", response.Date); err == nil {
			timestamp = parsed
		}
	}

	return &QuoteResponse{
		Symbol:    req.Symbol,
		Bid:       lastPrice,
		Ask:       lastPrice,
		Last:      lastPrice,
		Volume:    0,
		Timestamp: timestamp,
		Source:    f.ID(),
	}, nil
}

// ValidateCredentials validates Twelve Data API key (Frankfurter has no key)
func (f *FXProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	// Frankfurter requires no API key, always valid
	if apiKey == "" {
		return nil
	}

	// Validate Twelve Data API key
	url := fmt.Sprintf("%s/quote", f.tdBaseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	q := req.URL.Query()
	q.Set("symbol", "EUR/USD")
	q.Set("apikey", apiKey)
	req.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid Twelve Data API key")
	}

	// 429 = rate limited; the key itself is valid.
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API key validation failed with status: %d", resp.StatusCode)
	}

	var errorResp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	}

	if json.NewDecoder(resp.Body).Decode(&errorResp) == nil {
		if errorResp.Code == 401 || errorResp.Status == "error" {
			return fmt.Errorf("invalid Twelve Data API key: %s", errorResp.Message)
		}
	}

	return nil
}

// IsHealthy checks if the provider is reachable
func (f *FXProvider) IsHealthy(ctx context.Context) bool {
	// Check Frankfurter (free, no key required)
	url := fmt.Sprintf("%s/v1/latest?from=EUR&to=USD", f.fkBaseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := f.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// mapInterval converts internal interval to Twelve Data format
func (f *FXProvider) mapInterval(interval model.CandleInterval) string {
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
func (f *FXProvider) parseDateTime(datetime string, interval model.CandleInterval) (time.Time, error) {
	if interval == model.Interval1d {
		return time.Parse("2006-01-02", datetime)
	}
	return time.Parse("2006-01-02 15:04:05", datetime)
}

// GetTechnicalIndicator returns nil - FX technical indicators not supported
func (f *FXProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	if f.IsInCooldown() {
		return nil, f.CooldownError(f.ID(), f.Name())
	}
	return nil, fmt.Errorf("technical indicators not supported for FX")
}
