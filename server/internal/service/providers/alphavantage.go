package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sigma_finance/internal/domain/model"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
)

type AlphaVantageProvider struct {
	client  *http.Client
	baseURL string
	cb      *gobreaker.CircuitBreaker
	limiter *rate.Limiter
}

func NewAlphaVantageProvider() Provider {
	cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "alphavantage",
		MaxRequests: 3,
		Interval:    12 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.TotalFailures >= 5 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			fmt.Printf("AlphaVantage circuit breaker: %s -> %s\n", from, to)
		},
	})

	limiter := rate.NewLimiter(rate.Limit(4)/60, 2)

	return &AlphaVantageProvider{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		baseURL: "https://www.alphavantage.co/query",
		cb:      cb,
		limiter: limiter,
	}
}

func (a *AlphaVantageProvider) ID() string { return "ALPHAVANTAGE" }

func (a *AlphaVantageProvider) Name() string { return "Alpha Vantage" }

func (a *AlphaVantageProvider) Type() ProviderType { return ProviderTypeStock }

func (a *AlphaVantageProvider) Capabilities() ProviderCapabilities {
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
		MaxHistoryDays:   365 * 5,
		SupportsRealtime: false,
		RequiresAPIKey:   true,
		RateLimit: RateLimit{
			RequestsPerMinute: 5,
			RequestsPerDay:    25,
			BurstLimit:        2,
		},
		AssetTypes: []string{"STOCK", "ETF", "FUND", "FOREX", "CRYPTO"},
	}
}

func (a *AlphaVantageProvider) MapSymbol(internalSymbol, assetType string) (string, error) {
	symbol := strings.ToUpper(strings.TrimSpace(internalSymbol))
	switch assetType {
	case "FOREX":
		parts := strings.Split(symbol, "/")
		if len(parts) == 2 {
			return parts[0] + "_" + parts[1], nil
		}
		return symbol, nil
	default:
		return symbol, nil
	}
}

func (a *AlphaVantageProvider) NormalizeSymbol(providerSymbol, assetType string) (string, error) {
	return strings.ToUpper(providerSymbol), nil
}

func (a *AlphaVantageProvider) GetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("alpha vantage requires API key")
	}

	if err := a.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("alpha vantage rate limit exceeded: %w", err)
	}

	result, err := a.cb.Execute(func() (interface{}, error) {
		return a.doGetCandles(ctx, req)
	})
	if err != nil {
		return nil, fmt.Errorf("alpha vantage provider error: %w", err)
	}
	return result.(*CandleResponse), nil
}

func (a *AlphaVantageProvider) doGetCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	switch req.AssetType {
	case "FOREX":
		return a.getForexCandles(ctx, req)
	case "CRYPTO":
		return a.getCryptoCandles(ctx, req)
	default:
		return a.getStockCandles(ctx, req)
	}
}

func (a *AlphaVantageProvider) getStockCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	function := "TIME_SERIES_DAILY"
	if req.Interval != model.Interval1d {
		function = "TIME_SERIES_INTRADAY"
	}

	url := fmt.Sprintf("%s?function=%s&symbol=%s&apikey=%s&outputsize=compact",
		a.baseURL, function, req.Symbol, req.APIKey)

	if req.Interval != model.Interval1d {
		intv := a.mapInterval(req.Interval)
		url += "&interval=" + intv
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit exceeded",
			HTTPCode:  resp.StatusCode,
			Retryable: true,
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("alpha vantage API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("alpha vantage decode error: %w", err)
	}

	if errMsg, ok := response["Error Message"].(string); ok {
		if strings.Contains(strings.ToLower(errMsg), "premium") || strings.Contains(strings.ToLower(errMsg), "upgrade") {
			return nil, &ProviderError{
				Provider: a.ID(),
				Code:     "TICKER_NOT_FOUND",
				Message:  fmt.Sprintf("ticker %s not found or premium required", req.Symbol),
				HTTPCode: 200,
				Fallback: true,
			}
		}
		return nil, fmt.Errorf("alpha vantage error: %s", errMsg)
	}

	if notes, ok := response["Note"].(string); ok {
		if strings.Contains(notes, "API call frequency") || strings.Contains(notes, "rate limit") {
			return nil, &ProviderError{
				Provider:  a.ID(),
				Code:      "RATE_LIMITED",
				Message:   "Alpha Vantage rate limit message in response",
				HTTPCode:  200,
				Retryable: true,
			}
		}
	}

	var timeSeriesKey string
	var candles []model.Candle

	for key := range response {
		if strings.HasPrefix(key, "Time Series") {
			timeSeriesKey = key
			break
		}
	}

	if timeSeriesKey == "" {
		if _, hasNote := response["Note"]; hasNote {
			return nil, &ProviderError{
				Provider:  a.ID(),
				Code:      "RATE_LIMITED",
				Message:   "Alpha Vantage rate limit message",
				HTTPCode:  200,
				Retryable: true,
			}
		}
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no time series data for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	ts := response[timeSeriesKey].(map[string]interface{})

	for dateStr, value := range ts {
		if len(candles) >= req.Limit {
			break
		}

		timestamp, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			timestamp, err = time.Parse("2006-01-02 15:04:05", dateStr)
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

		v := value.(map[string]interface{})
		open := avParseFloat(v["1. open"])
		high := avParseFloat(v["2. high"])
		low := avParseFloat(v["3. low"])
		close := avParseFloat(v["4. close"])
		volume := avParseFloat(v["5. volume"])

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      model.FromFloat(open),
			High:      model.FromFloat(high),
			Low:       model.FromFloat(low),
			Close:     model.FromFloat(close),
			Volume:    volume,
			Timestamp: timestamp,
			Source:    a.ID(),
		})
	}

	if len(candles) == 0 {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no data found for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    a.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (a *AlphaVantageProvider) getForexCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	parts := strings.Split(req.Symbol, "/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid forex symbol format: %s", req.Symbol)
	}
	fromSymbol := parts[0]
	toSymbol := parts[1]

	function := "FX_DAILY"
	intv := ""
	if req.Interval != model.Interval1d {
		function = "FX_INTRADAY"
		intv = a.mapInterval(req.Interval)
	}

	url := fmt.Sprintf("%s?function=%s&from_symbol=%s&to_symbol=%s&apikey=%s",
		a.baseURL, function, fromSymbol, toSymbol, req.APIKey)
	if intv != "" {
		url += "&interval=" + intv
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage forex rate limit exceeded",
			HTTPCode:  resp.StatusCode,
			Retryable: true,
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alpha vantage forex API error: status %d", resp.StatusCode)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if _, ok := response["Note"]; ok {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit",
			HTTPCode:  200,
			Retryable: true,
		}
	}

	var timeSeriesKey string
	for key := range response {
		if strings.HasPrefix(key, "Time Series FX") || strings.HasPrefix(key, "Time Series") {
			timeSeriesKey = key
			break
		}
	}

	if timeSeriesKey == "" {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no forex data for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	ts := response[timeSeriesKey].(map[string]interface{})
	var candles []model.Candle

	for dateStr, value := range ts {
		if len(candles) >= req.Limit {
			break
		}

		timestamp, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			timestamp, err = time.Parse("2006-01-02 15:04:05", dateStr)
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

		v := value.(map[string]interface{})
		open := avParseFloat(v["1. open"])
		high := avParseFloat(v["2. high"])
		low := avParseFloat(v["3. low"])
		close := avParseFloat(v["4. close"])

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      model.FromFloat(open),
			High:      model.FromFloat(high),
			Low:       model.FromFloat(low),
			Close:     model.FromFloat(close),
			Volume:    0,
			Timestamp: timestamp,
			Source:    a.ID(),
		})
	}

	if len(candles) == 0 {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no forex data found for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    a.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (a *AlphaVantageProvider) getCryptoCandles(ctx context.Context, req CandleRequest) (*CandleResponse, error) {
	function := "DIGITAL_CURRENCY_DAILY"
	if req.Interval != model.Interval1d {
		function = "DIGITAL_CURRENCY_INTRADAY"
	}

	url := fmt.Sprintf("%s?function=%s&symbol=%s&market=USD&apikey=%s",
		a.baseURL, function, req.Symbol, req.APIKey)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage crypto rate limit exceeded",
			HTTPCode:  resp.StatusCode,
			Retryable: true,
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alpha vantage crypto API error: status %d", resp.StatusCode)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if _, ok := response["Note"]; ok {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit",
			HTTPCode:  200,
			Retryable: true,
		}
	}

	var timeSeriesKey string
	for key := range response {
		if strings.HasPrefix(key, "Time Series") {
			timeSeriesKey = key
			break
		}
	}

	if timeSeriesKey == "" {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no crypto data for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	ts := response[timeSeriesKey].(map[string]interface{})
	var candles []model.Candle

	for dateStr, value := range ts {
		if len(candles) >= req.Limit {
			break
		}

		timestamp, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		if !req.From.IsZero() && timestamp.Before(req.From) {
			continue
		}
		if !req.To.IsZero() && timestamp.After(req.To) {
			continue
		}

		v := value.(map[string]interface{})
		open := avParseFloat(v["1a. open (USD)"])
		high := avParseFloat(v["2a. high (USD)"])
		low := avParseFloat(v["3a. low (USD)"])
		close := avParseFloat(v["4a. close (USD)"])
		volume := avParseFloat(v["5. volume"])

		if close == 0 {
			continue
		}

		candles = append(candles, model.Candle{
			Symbol:    req.Symbol,
			AssetType: req.AssetType,
			Interval:  req.Interval,
			Open:      model.FromFloat(open),
			High:      model.FromFloat(high),
			Low:       model.FromFloat(low),
			Close:     model.FromFloat(close),
			Volume:    volume,
			Timestamp: timestamp,
			Source:    a.ID(),
		})
	}

	if len(candles) == 0 {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no crypto data found for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	return &CandleResponse{
		Candles:   candles,
		Source:    a.ID(),
		Timestamp: time.Now(),
		HasMore:   len(candles) == req.Limit,
	}, nil
}

func (a *AlphaVantageProvider) ValidateCredentials(ctx context.Context, apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is required")
	}

	url := fmt.Sprintf("%s?function=GLOBAL_QUOTE&symbol=AAPL&apikey=%s", a.baseURL, apiKey)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid Alpha Vantage API key")
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API key validation failed with status: %d", resp.StatusCode)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return err
	}

	if _, ok := response["Error Message"]; ok {
		return fmt.Errorf("invalid Alpha Vantage API key")
	}

	return nil
}

func (a *AlphaVantageProvider) GetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("alpha vantage requires API key")
	}

	if err := a.limiter.Wait(ctx); err != nil {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit exceeded",
			Retryable: true,
		}
	}

	result, err := a.cb.Execute(func() (interface{}, error) {
		return a.doGetQuote(ctx, req)
	})
	if err != nil {
		return nil, fmt.Errorf("alpha vantage provider error: %w", err)
	}
	return result.(*QuoteResponse), nil
}

func (a *AlphaVantageProvider) doGetQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	symbol, err := a.MapSymbol(req.Symbol, req.AssetType)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s?function=GLOBAL_QUOTE&symbol=%s&apikey=%s", a.baseURL, symbol, req.APIKey)
	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusForbidden {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit exceeded",
			HTTPCode:  resp.StatusCode,
			Retryable: true,
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("alpha vantage API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("alpha vantage decode error: %w", err)
	}

	if errMsg, ok := response["Error Message"].(string); ok {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  errMsg,
			HTTPCode: 200,
			Fallback: true,
		}
	}

	if _, ok := response["Note"].(string); ok {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit",
			HTTPCode:  200,
			Retryable: true,
		}
	}

	globalQuote, ok := response["Global Quote"].(map[string]interface{})
	if !ok {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no quote data for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	priceStr, ok := globalQuote["05. price"].(string)
	if !ok || priceStr == "" {
		return nil, &ProviderError{
			Provider: a.ID(),
			Code:     "TICKER_NOT_FOUND",
			Message:  fmt.Sprintf("no price data for %s", req.Symbol),
			HTTPCode: 200,
			Fallback: true,
		}
	}

	lastPrice, err := decimal.NewFromString(priceStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse price: %w", err)
	}

	volumeStr, ok := globalQuote["06. volume"].(string)
	var volume int64
	if ok && volumeStr != "" {
		volume, _ = strconv.ParseInt(volumeStr, 10, 64)
	}

	var timestamp time.Time
	if latestDay, ok := globalQuote["07. latest trading day"].(string); ok && latestDay != "" {
		timestamp, _ = time.Parse("2006-01-02", latestDay)
	} else {
		timestamp = time.Now()
	}

	return &QuoteResponse{
		Symbol:    req.Symbol,
		Bid:       lastPrice,
		Ask:       lastPrice,
		Last:      lastPrice,
		Volume:    volume,
		Timestamp: timestamp,
		Source:    a.ID(),
	}, nil
}

func (a *AlphaVantageProvider) IsHealthy(ctx context.Context) bool {
	url := fmt.Sprintf("%s?function=GLOBAL_QUOTE&symbol=AAPL&apikey=demo", a.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := a.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden
}

func (a *AlphaVantageProvider) mapInterval(interval model.CandleInterval) string {
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
		return "60min"
	case model.Interval4h:
		return "60min"
	case model.Interval1d:
		return "daily"
	default:
		return "daily"
	}
}

func avParseFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	case int:
		return float64(val)
	case int64:
		return float64(val)
	default:
		return 0
	}
}

func avParseFloatFromMap(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		return avParseFloat(v)
	}
	return 0
}

func avParseFloatPtr(m map[string]interface{}, key string) *float64 {
	if v, ok := m[key]; ok {
		f := avParseFloat(v)
		if f != 0 || v == float64(0) || v == "0" {
			return &f
		}
	}
	return nil
}

func (a *AlphaVantageProvider) GetTechnicalIndicator(ctx context.Context, req TechnicalIndicatorRequest) (*TechnicalIndicatorResponse, error) {
	if req.APIKey == "" {
		return nil, fmt.Errorf("alpha vantage requires API key for technical indicators")
	}

	if err := a.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("alpha vantage rate limit exceeded: %w", err)
	}

	function := a.mapIndicatorFunction(req.Indicator)
	url := fmt.Sprintf("%s?function=%s&symbol=%s&interval=%s&time_period=%d&series_type=%s&apikey=%s",
		a.baseURL, function, req.Symbol, a.mapInterval(req.Interval), req.TimePeriod, req.SeriesType, req.APIKey)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit exceeded",
			HTTPCode:  resp.StatusCode,
			Retryable: true,
		}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("alpha vantage indicator API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	if _, ok := response["Note"]; ok {
		return nil, &ProviderError{
			Provider:  a.ID(),
			Code:      "RATE_LIMITED",
			Message:   "Alpha Vantage rate limit",
			HTTPCode:  200,
			Retryable: true,
		}
	}

	techKey := ""
	for key := range response {
		if strings.HasPrefix(key, "Technical Analysis") || strings.HasPrefix(key, "Meta Data") {
			continue
		}
		if key != "Note" && key != "Error Message" {
			techKey = key
			break
		}
	}

	if techKey == "" {
		return nil, fmt.Errorf("no technical indicator data returned for %s", req.Indicator)
	}

	ts := response[techKey].(map[string]interface{})
	data := make([]TechnicalIndicatorPoint, 0)

	for dateStr, value := range ts {
		timestamp, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			timestamp, err = time.Parse("2006-01-02 15:04:05", dateStr)
			if err != nil {
				continue
			}
		}

		v := value.(map[string]interface{})
		point := TechnicalIndicatorPoint{
			Timestamp: timestamp,
		}

		switch req.Indicator {
		case "SMA", "EMA":
			point.Value = avParseFloat(v[req.Indicator])
		case "RSI":
			point.Value = avParseFloat(v["RSI"])
		case "MACD":
			point.Value = avParseFloat(v["MACD"])
			if sig, ok := v["MACD_Signal"].(string); ok {
				signal := avParseFloat(sig)
				point.Signal = &signal
			}
			if hist, ok := v["MACD_Hist"].(string); ok {
				histogram := avParseFloat(hist)
				point.Histogram = &histogram
			}
		case "BBANDS":
			point.Value = avParseFloat(v["Real Middle Band"])
			if upper, ok := v["Real Upper Band"].(string); ok {
				upperBand := avParseFloat(upper)
				point.UpperBand = &upperBand
			}
			if lower, ok := v["Real Lower Band"].(string); ok {
				lowerBand := avParseFloat(lower)
				point.LowerBand = &lowerBand
			}
		case "STOCH":
			point.Value = avParseFloat(v["SlowK"])
			if slowD, ok := v["SlowD"].(string); ok {
				slowDVal := avParseFloat(slowD)
				point.Signal = &slowDVal
			}
		}

		data = append(data, point)
	}

	return &TechnicalIndicatorResponse{
		Indicator: req.Indicator,
		Symbol:    req.Symbol,
		Data:      data,
		Source:    a.ID(),
		Timestamp: time.Now(),
	}, nil
}

func (a *AlphaVantageProvider) mapIndicatorFunction(indicator string) string {
	switch indicator {
	case "SMA":
		return "SMA"
	case "EMA":
		return "EMA"
	case "RSI":
		return "RSI"
	case "MACD":
		return "MACD"
	case "BBANDS":
		return "BBANDS"
	case "STOCH":
		return "STOCH"
	default:
		return "SMA"
	}
}
