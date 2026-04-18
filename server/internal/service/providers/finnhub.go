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

// FinnhubProvider implements Provider for Finnhub Stock API
type FinnhubProvider struct {
	client  *http.Client
	baseURL string
}

// NewFinnhubProvider creates a new Finnhub provider
func NewFinnhubProvider() Provider {
	return &FinnhubProvider{
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: "https://finnhub.io/api/v1",
	}
}

func (f *FinnhubProvider) ID() string {
	return "FINNHUB"
}

func (f *FinnhubProvider) Name() string {
	return "Finnhub Stock API"
}

func (f *FinnhubProvider) Type() ProviderType {
	return ProviderTypeStock
}

func (f *FinnhubProvider) Capabilities() ProviderCapabilities {
	return ProviderCapabilities{
		Intervals: []model.CandleInterval{
			model.Interval1m,
			model.Interval5m,
			model.Interval15m,
			model.Interval30m,
			model.Interval1h,
			model.Interval1d,
		},
		MaxHistoryDays:   365 * 2, // 2 years of history
		SupportsRealtime: true,
		RequiresAPIKey:   true,
		RateLimit: RateLimit{
			RequestsPerMinute: 60,    // 60 calls per minute
			RequestsPerDay:    10000, // 10k calls per day (free tier)
			BurstLimit:        5,
		},
		AssetTypes: []string{"STOCK", "ETF", "INDEX"},
	}
}

func (f *FinnhubProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	// Finnhub uses standard ticker symbols (e.g., "AAPL", "MSFT")
	symbol := strings.ToUpper(strings.TrimSpace(internalSymbol))

	// Remove any exchange suffixes for US stocks
	if strings.Contains(symbol, ":") {
		parts := strings.Split(symbol, ":")
		if len(parts) == 2 && (parts[1] == "US" || parts[1] == "NASDAQ" || parts[1] == "NYSE") {
			symbol = parts[0]
		}
	}

	return symbol, nil
}

func (f *FinnhubProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	// Finnhub symbols are already in standard format
	return strings.ToUpper(providerSymbol), nil
}

func (f *FinnhubProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("finnhub requires API key")
	}

	symbol, err := f.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	resolution := f.mapInterval(req.Interval)
	if resolution == "" {
		return nil, fmt.Errorf("unsupported interval: %s", req.Interval)
	}

	url := fmt.Sprintf("%s/stock/candle", f.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("symbol", symbol)
	q.Set("resolution", resolution)
	q.Set("from", strconv.FormatInt(req.From.Unix(), 10))
	q.Set("to", strconv.FormatInt(req.To.Unix(), 10))
	q.Set("token", req.APIKey)

	httpReq.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("finnhub API error: %d", resp.StatusCode)
	}

	var response struct {
		Status string    `json:"s"`
		Time   []int64   `json:"t"`
		Open   []float64 `json:"o"`
		High   []float64 `json:"h"`
		Low    []float64 `json:"l"`
		Close  []float64 `json:"c"`
		Volume []float64 `json:"v"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if response.Status != "ok" {
		return nil, fmt.Errorf("finnhub API returned status: %s", response.Status)
	}

	if len(response.Time) == 0 {
		return &CandleResponse{
			Candles:   []model.Candle{},
			Source:    f.ID(),
			Timestamp: time.Now(),
			HasMore:   false,
		}, nil
	}

	candles := make([]model.Candle, 0, len(response.Time))

	for i, timestamp := range response.Time {
		if i >= req.Limit {
			break
		}

		t := time.Unix(timestamp, 0)

		candle := model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      model.FromFloat(response.Open[i]),
			High:      model.FromFloat(response.High[i]),
			Low:       model.FromFloat(response.Low[i]),
			Close:     model.FromFloat(response.Close[i]),
			Volume:    response.Volume[i],
			Timestamp: t,
			Source:    f.ID(),
		}

		candles = append(candles, candle)
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    f.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (f *FinnhubProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	// Test the API key with a simple quote request
	url := fmt.Sprintf("%s/quote", f.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	q := req.URL.Query()
	q.Set("symbol", "AAPL") // Use AAPL as test symbol
	q.Set("token", apiKey)
	req.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid API key")
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API key validation failed with status: %d", resp.StatusCode)
	}

	return nil
}

func (f *FinnhubProvider) IsHealthy(ctx context.Context) bool {
	// Simple health check without API key
	url := fmt.Sprintf("%s/stock/symbol", f.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	q := req.URL.Query()
	q.Set("exchange", "US")
	req.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// Even without API key, this should return 401, not 500 or connection error
	return resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusOK
}

// mapInterval converts internal interval to Finnhub resolution format
func (f *FinnhubProvider) mapInterval(interval model.CandleInterval) string {
	switch interval {
	case model.Interval1m:
		return "1"
	case model.Interval5m:
		return "5"
	case model.Interval15m:
		return "15"
	case model.Interval30m:
		return "30"
	case model.Interval1h:
		return "60"
	case model.Interval1d:
		return "D"
	default:
		return ""
	}
}

func (f *FinnhubProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	return nil, fmt.Errorf("technical indicators not supported by Finnhub provider")
}

func (f *FinnhubProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if req.APIKey == "" {
		return nil, &ProviderError{
			Provider:  f.ID(),
			Code:      "MISSING_API_KEY",
			Message:   "Finnhub requires an API key",
			Retryable: false,
			Fallback:  false,
		}
	}

	symbol, err := f.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/quote", f.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	q := httpReq.URL.Query()
	q.Set("symbol", symbol)
	q.Set("token", req.APIKey)
	httpReq.URL.RawQuery = q.Encode()

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Handle rate limiting (429 Too Many Requests)
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, &ProviderError{
			Provider:  f.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Finnhub rate limit exceeded",
			HTTPCode:  http.StatusTooManyRequests,
			Retryable: true,
			Fallback:  true,
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &ProviderError{
			Provider:  f.ID(),
			Code:      "API_ERROR",
			Message:   fmt.Sprintf("Finnhub API error: %d", resp.StatusCode),
			HTTPCode:  resp.StatusCode,
			Retryable: resp.StatusCode >= 500,
			Fallback:  true,
		}
	}

	var quote struct {
		C  float64 `json:"c"`
		H  float64 `json:"h"`
		L  float64 `json:"l"`
		O  float64 `json:"o"`
		PC float64 `json:"pc"`
		T  int64   `json:"t"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&quote); err != nil {
		return nil, err
	}

	// If timestamp is 0, the symbol is likely not found
	if quote.T == 0 {
		return nil, &ProviderError{
			Provider:  f.ID(),
			Code:      "TICKER_NOT_FOUND",
			Message:   fmt.Sprintf("Symbol %s not found", symbol),
			Retryable: false,
			Fallback:  true,
		}
	}

	timestamp := time.Unix(quote.T, 0)
	lastPrice := decimal.NewFromFloat(quote.C)

	return &QuoteResponse{
		Symbol:    req.Symbol,
		Bid:       lastPrice,
		Ask:       lastPrice,
		Last:      lastPrice,
		Volume:    0, // Not provided in quote endpoint
		Timestamp: timestamp,
		Source:    f.ID(),
	}, nil
}
