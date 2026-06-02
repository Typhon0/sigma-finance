package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sigma_finance/internal/domain/model"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
)

const tiingoMaxCooldown = 5 * time.Minute

// TiingoProvider implements Provider for Tiingo REST API.
// Tiingo is the primary provider for US equities, ETFs, and mutual funds.
// It offers 500 requests/hour on the free tier and excellent dividend/split
// adjustment following CRSP standards.
type TiingoProvider struct {
	client  *http.Client
	baseURL string
	cb      *gobreaker.CircuitBreaker
	limiter *rate.Limiter
	CooldownMixin
}

// NewTiingoProvider creates a new Tiingo provider with circuit breaker and rate limiter.
func NewTiingoProvider() Provider {
	cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "tiingo",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.TotalFailures >= 5 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("Tiingo circuit breaker: %s -> %s", from, to)
		},
	})

	// 500 req/hour ≈ 8.3 req/min, use 8 req/min with burst of 3
	limiter := rate.NewLimiter(rate.Limit(8)/60, 3)

	return &TiingoProvider{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		baseURL:       "https://api.tiingo.com",
		cb:            cb,
		limiter:       limiter,
		CooldownMixin: NewCooldownMixin(tiingoMaxCooldown),
	}
}

func (t *TiingoProvider) ID() string { return "TIINGO" }

func (t *TiingoProvider) Name() string { return "Tiingo" }

func (t *TiingoProvider) Type() ProviderType { return ProviderTypeStock }

func (t *TiingoProvider) Capabilities() ProviderCapabilities {
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
		MaxHistoryDays:   365 * 10, // Tiingo has ~10 years of history
		SupportsRealtime: true,
		RequiresAPIKey:   true,
		RateLimit: RateLimit{
			RequestsPerMinute: 8, // 500/hour conservative
			RequestsPerDay:    12000,
			BurstLimit:        3,
		},
		AssetTypes: []string{"STOCK", "ETF", "FUND", "CRYPTO", "FOREX"},
	}
}

// MapSymbol converts internal symbol format to Tiingo format.
// Tiingo uses standard ticker symbols for US equities (e.g., "AAPL").
// For crypto, it uses "btcusd" format.
// For forex, it uses "eurusd" format.
func (t *TiingoProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(strings.TrimSpace(internalSymbol))

	switch assetType {
	case "STOCK", "ETF", "FUND":
		// Remove exchange suffixes (e.g., "AAPL:US" -> "AAPL")
		if strings.Contains(symbol, ":") {
			parts := strings.Split(symbol, ":")
			symbol = parts[0]
		}
		return symbol, nil
	case "CRYPTO":
		// Tiingo uses lowercase for crypto pairs: "btcusd"
		return strings.ToLower(strings.ReplaceAll(symbol, "/", "")), nil
	case "FOREX":
		// Tiingo uses lowercase for forex: "eurusd"
		return strings.ToLower(strings.ReplaceAll(symbol, "/", "")), nil
	default:
		return symbol, nil
	}
}

// NormalizeSymbol converts Tiingo symbol format back to internal format.
func (t *TiingoProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(providerSymbol)
	switch assetType {
	case "CRYPTO":
		// Convert "btcusd" back to "BTC/USD"
		if len(symbol) > 3 {
			base := symbol[:len(symbol)-3]
			quote := symbol[len(symbol)-3:]
			return base + "/" + quote, nil
		}
		return symbol, nil
	case "FOREX":
		// Convert "eurusd" back to "EUR/USD"
		if len(symbol) == 6 {
			base := symbol[:3]
			quote := symbol[3:]
			return base + "/" + quote, nil
		}
		return symbol, nil
	default:
		return symbol, nil
	}
}

// tiingoEODResponse represents Tiingo EOD (end-of-day) price response.
type tiingoEODResponse []struct {
	Date   string  `json:"date"`
	Close  float64 `json:"close"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Open   float64 `json:"open"`
	Volume int64   `json:"volume"`
	// AdjClose includes dividend reinvestment and split adjustment
	AdjClose    float64 `json:"adjClose"`
	AdjHigh     float64 `json:"adjHigh"`
	AdjLow      float64 `json:"adjLow"`
	AdjOpen     float64 `json:"adjOpen"`
	AdjVolume   int64   `json:"adjVolume"`
	DivCash     float64 `json:"divCash"`
	SplitFactor float64 `json:"splitFactor"`
}

// tiingoIntradayResponse represents Tiingo intraday (IEX) price response.
type tiingoIntradayResponse []struct {
	Date   string  `json:"date"`
	Close  float64 `json:"close"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Open   float64 `json:"open"`
	Volume int64   `json:"volume"`
	// For intraday, we also get timestamp
	Timestamp string `json:"timestamp"`
}

// tiingoCryptoResponse represents Tiingo crypto price response.
type tiingoCryptoResponse []struct {
	Ticker struct {
		Ticker        string `json:"ticker"`
		BaseCurrency  string `json:"baseCurrency"`
		QuoteCurrency string `json:"quoteCurrency"`
	} `json:"ticker"`
	PriceData []struct {
		Date   string  `json:"date"`
		Close  float64 `json:"close"`
		High   float64 `json:"high"`
		Low    float64 `json:"low"`
		Open   float64 `json:"open"`
		Volume float64 `json:"volume"`
	} `json:"priceData"`
}

// tiingoForexResponse represents Tiingo forex price response.
type tiingoForexResponse struct {
	Tickers []struct {
		Ticker        string  `json:"ticker"`
		QuoteCurrency string  `json:"quoteCurrency"`
		BaseCurrency  string  `json:"baseCurrency"`
		BidPrice      float64 `json:"bidPrice"`
		AskPrice      float64 `json:"askPrice"`
		MidPrice      float64 `json:"midPrice"`
		OpenPrice     float64 `json:"openPrice"`
		HighPrice     float64 `json:"highPrice"`
		LowPrice      float64 `json:"lowPrice"`
		Timestamp     string  `json:"timestamp"`
	} `json:"tickers"`
}

// tiingoErrorResponse represents Tiingo error response.
type tiingoErrorResponse struct {
	Detail string `json:"detail"`
	Error  string `json:"error"`
}



func (t *TiingoProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("tiingo requires API key")
	}

	if t.IsInCooldown() {
		return nil, t.CooldownError(t.ID(), t.Name())
	}

	// Rate limit check
	if err := t.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("tiingo rate limit exceeded: %w", err)
	}

	// Execute with circuit breaker
	result, err := t.cb.Execute(func() (interface{}, error) {
		return t.doGetCandles(ctx, req)
	})
	if err != nil {
		return nil, fmt.Errorf("tiingo provider error: %w", err)
	}
	return result.(*CandleResponse), nil
}

func (t *TiingoProvider) doGetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	symbol, err := t.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	// Route to correct Tiingo endpoint based on asset type
	switch req.AssetType {
	case "STOCK", "ETF", "FUND":
		return t.getStockCandles(ctx, symbol, req)
	case "CRYPTO":
		return t.getCryptoCandles(ctx, symbol, req)
	case "FOREX":
		return t.getForexCandles(ctx, symbol, req)
	default:
		return t.getStockCandles(ctx, symbol, req)
	}
}

func (t *TiingoProvider) getStockCandles(ctx context.Context, symbol string, req CandleRequest) (*CandleResponse, error) {
	// For intraday data, use the IEX endpoint; for daily, use EOD
	if req.Interval == model.Interval1d {
		return t.getEODCandles(ctx, symbol, req)
	}
	return t.getIntradayCandles(ctx, symbol, req)
}

func (t *TiingoProvider) getEODCandles(ctx context.Context, symbol string, req CandleRequest) (*CandleResponse, error) {
	url := fmt.Sprintf("%s/tiingo/daily/%s/prices", t.baseURL, symbol)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("token", req.APIKey)
	if !req.From.IsZero() {
		q.Set("startDate", req.From.Format("2006-01-02"))
	}
	if !req.To.IsZero() {
		q.Set("endDate", req.To.Format("2006-01-02"))
	}
	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Handle 404 - ticker not found on Tiingo (important for fallback)
	if resp.StatusCode == http.StatusNotFound {
		return nil, &ProviderError{
			Provider: t.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("ticker %s not found on Tiingo (likely international stock)", symbol),
			HTTPCode: resp.StatusCode,
			Fallback: true, // Signal that fallback should be attempted
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, tiingoMaxCooldown, tiingoMaxCooldown)
		t.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          t.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Tiingo rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tiingo API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response tiingoEODResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("tiingo decode error: %w", err)
	}

	if len(response) == 0 {
		return &CandleResponse{
			Candles:   []model.Candle{},
			Source:    t.ID(),
			Timestamp: time.Now(),
			HasMore:   false,
		}, nil
	}

	candles := make([]model.Candle, 0, len(response))
	for _, item := range response {
		timestamp, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			continue
		}

		// Use adjusted prices for accurate performance calculation
		close := item.AdjClose
		high := item.AdjHigh
		low := item.AdjLow
		open := item.AdjOpen
		volume := item.AdjVolume

		if close == 0 {
			close = item.Close
			high = item.High
			low = item.Low
			open = item.Open
			volume = item.Volume
		}

		// Filter by time range
		if !req.From.IsZero() && timestamp.Before(req.From) {
			continue
		}
		if !req.To.IsZero() && timestamp.After(req.To) {
			continue
		}

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      decimal.NewFromFloat(open),
			High:      decimal.NewFromFloat(high),
			Low:       decimal.NewFromFloat(low),
			Close:     decimal.NewFromFloat(close),
			Volume:    decimal.NewFromInt(volume),
			Timestamp: timestamp,
			Source:    t.ID(),
		})
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    t.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (t *TiingoProvider) getIntradayCandles(ctx context.Context, symbol string, req CandleRequest) (*CandleResponse, error) {
	url := fmt.Sprintf("%s/iex/%s/prices", t.baseURL, symbol)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("token", req.APIKey)
	q.Set("resampleFreq", t.mapInterval(req.Interval))
	if !req.From.IsZero() {
		q.Set("startDate", req.From.Format("2006-01-02"))
	}
	if !req.To.IsZero() {
		q.Set("endDate", req.To.Format("2006-01-02"))
	}
	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, &ProviderError{
			Provider: t.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("ticker %s not found on Tiingo", symbol),
			HTTPCode: resp.StatusCode,
			Fallback: true,
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, tiingoMaxCooldown, tiingoMaxCooldown)
		t.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          t.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Tiingo rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tiingo intraday API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response tiingoIntradayResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("tiingo intraday decode error: %w", err)
	}

	candles := make([]model.Candle, 0, len(response))
	for _, item := range response {
		// Try RFC3339 format first, then date-only
		var timestamp time.Time
		var parseErr error
		if item.Timestamp != "" {
			timestamp, parseErr = time.Parse(time.RFC3339, item.Timestamp)
			if parseErr != nil {
				timestamp, parseErr = time.Parse("2006-01-02 15:04:05", item.Timestamp)
			}
		}
		if timestamp.IsZero() {
			timestamp, parseErr = time.Parse("2006-01-02", item.Date)
			if parseErr != nil {
				continue
			}
		}

		if !req.From.IsZero() && timestamp.Before(req.From) {
			continue
		}
		if !req.To.IsZero() && timestamp.After(req.To) {
			continue
		}

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      decimal.NewFromFloat(item.Open),
			High:      decimal.NewFromFloat(item.High),
			Low:       decimal.NewFromFloat(item.Low),
			Close:     decimal.NewFromFloat(item.Close),
			Volume:    decimal.NewFromInt(item.Volume),
			Timestamp: timestamp,
			Source:    t.ID(),
		})
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    t.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (t *TiingoProvider) getCryptoCandles(ctx context.Context, symbol string, req CandleRequest) (*CandleResponse, error) {
	url := fmt.Sprintf("%s/tiingo/crypto/prices", t.baseURL)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("tickers", symbol)
	q.Set("token", req.APIKey)

	if !req.From.IsZero() {
		q.Set("startDate", req.From.Format("2006-01-02"))
	}
	if !req.To.IsZero() {
		q.Set("endDate", req.To.Format("2006-01-02"))
	}
	q.Set("resampleFreq", t.mapCryptoInterval(req.Interval))

	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, &ProviderError{
			Provider: t.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("crypto ticker %s not found on Tiingo", symbol),
			HTTPCode: resp.StatusCode,
			Fallback: true,
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, tiingoMaxCooldown, tiingoMaxCooldown)
		t.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          t.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Tiingo rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tiingo crypto API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response tiingoCryptoResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("tiingo crypto decode error: %w", err)
	}

	candles := make([]model.Candle, 0)
	for _, ticker := range response {
		for _, priceData := range ticker.PriceData {
			timestamp, err := time.Parse(time.RFC3339, priceData.Date)
			if err != nil {
				timestamp, err = time.Parse("2006-01-02", priceData.Date)
				if err != nil {
					continue
				}
			}

			if !req.From.IsZero() && timestamp.Before(req.From) {
				continue
			}
			if !req.To.IsZero() && timestamp.After(req.To) {
				continue
			}

			candles = append(candles, model.Candle{
				Symbol:    req.Symbol,
				AssetType: req.AssetType,
				Interval:  req.Interval,
				Open:      decimal.NewFromFloat(priceData.Open),
				High:      decimal.NewFromFloat(priceData.High),
				Low:       decimal.NewFromFloat(priceData.Low),
				Close:     decimal.NewFromFloat(priceData.Close),
				Volume:    decimal.NewFromFloat(priceData.Volume),
				Timestamp: timestamp,
				Source:    t.ID(),
			})
		}
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    t.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (t *TiingoProvider) getForexCandles(ctx context.Context, symbol string, req CandleRequest) (*CandleResponse, error) {
	url := fmt.Sprintf("%s/tiingo/fx/%s/prices", t.baseURL, symbol)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("token", req.APIKey)

	if !req.From.IsZero() {
		q.Set("startDate", req.From.Format("2006-01-02"))
	}
	if !req.To.IsZero() {
		q.Set("endDate", req.To.Format("2006-01-02"))
	}
	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, &ProviderError{
			Provider: t.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("forex pair %s not found on Tiingo", symbol),
			HTTPCode: resp.StatusCode,
			Fallback: true,
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, tiingoMaxCooldown, tiingoMaxCooldown)
		t.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          t.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Tiingo rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tiingo forex API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	// Tiingo forex returns an array of price objects
	var response []struct {
		Date  string  `json:"date"`
		Open  float64 `json:"open"`
		High  float64 `json:"high"`
		Low   float64 `json:"low"`
		Close float64 `json:"close"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("tiingo forex decode error: %w", err)
	}

	candles := make([]model.Candle, 0, len(response))
	for _, item := range response {
		timestamp, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			continue
		}

		if !req.From.IsZero() && timestamp.Before(req.From) {
			continue
		}
		if !req.To.IsZero() && timestamp.After(req.To) {
			continue
		}

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      decimal.NewFromFloat(item.Open),
			High:      decimal.NewFromFloat(item.High),
			Low:       decimal.NewFromFloat(item.Low),
			Close:     decimal.NewFromFloat(item.Close),
			Volume:    decimal.Zero, // Forex typically doesn't have volume
			Timestamp: timestamp,
			Source:    t.ID(),
		})
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    t.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (t *TiingoProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	url := fmt.Sprintf("%s/tiingo/daily/AAPL/prices", t.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	q := req.URL.Query()
	q.Set("token", apiKey)
	q.Set("startDate", time.Now().AddDate(0, 0, -1).Format("2006-01-02"))
	q.Set("endDate", time.Now().Format("2006-01-02"))
	req.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid Tiingo API key")
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Tiingo API key validation failed with status: %d", resp.StatusCode)
	}

	return nil
}

func (t *TiingoProvider) IsHealthy(ctx context.Context) bool {
	// Health check without requiring API key (just test connectivity)
	url := fmt.Sprintf("%s/tiingo/daily/AAPL/prices", t.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	// Use a 5-second timeout for health checks
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := t.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// 401/403 means the API is reachable, just needs auth
	return resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden
}

// mapInterval converts internal interval to Tiingo IEX intraday format.
func (t *TiingoProvider) mapInterval(interval model.CandleInterval) string {
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
		return "1hr"
	case model.Interval4h:
		return "4hr"
	case model.Interval1d:
		return "1day"
	default:
		return ""
	}
}

// mapCryptoInterval converts internal interval to Tiingo crypto resample format.
func (t *TiingoProvider) mapCryptoInterval(interval model.CandleInterval) string {
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
		return "1hr"
	case model.Interval4h:
		return "4hr"
	case model.Interval1d:
		return "1day"
	default:
		return "1day"
	}
}

// IsTickerNotFound checks if an error is a "ticker not found" error from Tiingo.
// This is used by the routing manager to trigger fallback to Alpha Vantage for international stocks.
func (t *TiingoProvider) IsTickerNotFound(err error) bool {
	var providerErr *ProviderError
	if err != nil && err.Error() != "" {
		// Check if the error message indicates a 404
		return strings.Contains(err.Error(), "TICKER_NOT_FOUND") || strings.Contains(err.Error(), "not found on Tiingo")
	}
	return providerErr != nil && providerErr.Code == "TICKER_NOT_FOUND"
}

// parseFloat safely parses a string to float64.
func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func (t *TiingoProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	return nil, fmt.Errorf("technical indicators not supported by Tiingo provider, use Alpha Vantage")
}

// GetQuote returns a quote for the given symbol using Tiingo's IEX endpoint.
// Falls back to EOD endpoint if IEX fails.
func (t *TiingoProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if req.APIKey == "" {
		return nil, &ProviderError{
			Provider:  t.ID(),
			Code:      "MISSING_API_KEY",
			Message:   "Tiingo requires an API key",
			Retryable: false,
			Fallback:  false,
		}
	}

	if t.IsInCooldown() {
		return nil, t.CooldownError(t.ID(), t.Name())
	}

	if err := t.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("tiingo rate limit exceeded: %w", err)
	}

	symbol, err := t.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	resp, err := t.doGetIEXQuote(ctx, symbol, req.APIKey)
	if err != nil {
		if	t.IsInCooldown() {
			return nil, err
		}
		return t.doGetEODQuote(ctx, symbol, req)
	}

	return resp, nil
}

// doGetIEXQuote fetches quote from Tiingo IEX endpoint
func (t *TiingoProvider) doGetIEXQuote(ctx context.Context, symbol, apiKey string) (*QuoteResponse, error) {
	url := fmt.Sprintf("%s/iex/%s", t.baseURL, symbol)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("token", apiKey)
	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, &ProviderError{
			Provider:  t.ID(),
			Code:      "TICKER_NOT_FOUND",
			Message:   fmt.Sprintf("ticker %s not found on Tiingo IEX", symbol),
			HTTPCode:  resp.StatusCode,
			Retryable: false,
			Fallback:  true,
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, tiingoMaxCooldown, tiingoMaxCooldown)
		t.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          t.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Tiingo rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tiingo IEX API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response tiingoIntradayResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("tiingo IEX decode error: %w", err)
	}

	if len(response) == 0 {
		return nil, &ProviderError{
			Provider:  t.ID(),
			Code:      "TICKER_NOT_FOUND",
			Message:   fmt.Sprintf("no quote data for ticker %s", symbol),
			Retryable: false,
			Fallback:  true,
		}
	}

	// Use the most recent quote
	item := response[len(response)-1]
	lastPrice := decimal.NewFromFloat(item.Close)

	var timestamp time.Time
	if item.Timestamp != "" {
		timestamp, _ = time.Parse(time.RFC3339, item.Timestamp)
		if timestamp.IsZero() {
			timestamp, _ = time.Parse("2006-01-02 15:04:05", item.Timestamp)
		}
	}
	if timestamp.IsZero() {
		timestamp, _ = time.Parse("2006-01-02", item.Date)
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	return &QuoteResponse{
		Symbol:    symbol,
		Bid:       lastPrice,
		Ask:       lastPrice,
		Last:      lastPrice,
		Volume:    item.Volume,
		Timestamp: timestamp,
		Source:    t.ID(),
	}, nil
}

// doGetEODQuote fetches quote from Tiingo EOD endpoint (fallback)
func (t *TiingoProvider) doGetEODQuote(ctx context.Context, symbol string, req QuoteRequest) (*QuoteResponse, error) {
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	today := time.Now().Format("2006-01-02")

	url := fmt.Sprintf("%s/tiingo/daily/%s/prices", t.baseURL, symbol)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("token", req.APIKey)
	q.Set("startDate", yesterday)
	q.Set("endDate", today)
	httpReq.URL.RawQuery = q.Encode()

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, &ProviderError{
			Provider:  t.ID(),
			Code:      "TICKER_NOT_FOUND",
			Message:   fmt.Sprintf("ticker %s not found on Tiingo", symbol),
			HTTPCode:  resp.StatusCode,
			Retryable: false,
			Fallback:  true,
		}
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		cooldownDuration := ParseRetryAfter(resp, tiingoMaxCooldown, tiingoMaxCooldown)
		t.EnterCooldown(cooldownDuration)
		return nil, &ProviderError{
			Provider:          t.ID(),
			Code:              "RATE_LIMITED",
			Message:           "Tiingo rate limit exceeded",
			HTTPCode:          resp.StatusCode,
			Retryable:         true,
			Fallback:          true,
			RetryAfterSeconds: int(cooldownDuration.Seconds()),
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tiingo EOD API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response tiingoEODResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("tiingo EOD decode error: %w", err)
	}

	if len(response) == 0 {
		return nil, &ProviderError{
			Provider:  t.ID(),
			Code:      "TICKER_NOT_FOUND",
			Message:   fmt.Sprintf("no EOD data for ticker %s", symbol),
			Retryable: false,
			Fallback:  true,
		}
	}

	// Use the most recent EOD data
	item := response[len(response)-1]
	close := item.AdjClose
	if close == 0 {
		close = item.Close
	}
	lastPrice := decimal.NewFromFloat(close)

	var timestamp time.Time
	if item.Date != "" {
		timestamp, _ = time.Parse("2006-01-02", item.Date)
	}
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	return &QuoteResponse{
		Symbol:    symbol,
		Bid:       lastPrice,
		Ask:       lastPrice,
		Last:      lastPrice,
		Volume:    item.Volume,
		Timestamp: timestamp,
		Source:    t.ID(),
	}, nil
}
