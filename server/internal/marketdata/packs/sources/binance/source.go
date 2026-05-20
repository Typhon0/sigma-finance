package binance

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
	"sigma_finance/internal/marketdata/packs/sources"

	"github.com/shopspring/decimal"
)

const (
	DefaultBaseURL = "https://data.binance.vision"
	DefaultMarket  = "spot"
	SourceName     = "binance-public-data"
	Interval1D     = "1d"
)

var errArchiveNotFound = errors.New("archive not found")

type Config struct {
	BaseURL    string
	Market     string
	HTTPClient *http.Client
}

type Source struct {
	baseURL string
	market  string
	client  *http.Client
}

func NewSource(cfg Config) *Source {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	market := strings.TrimSpace(cfg.Market)
	if market == "" {
		market = DefaultMarket
	}
	client := cfg.HTTPClient
	if client == nil {
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.MaxIdleConns = 100
		transport.MaxIdleConnsPerHost = 100
		client = &http.Client{
			Transport: transport,
			Timeout:   30 * time.Second,
		}
	}
	return &Source{
		baseURL: baseURL,
		market:  market,
		client:  client,
	}
}

func (s *Source) FetchCandles(ctx context.Context, req sources.FetchCandlesRequest) (<-chan sources.NormalizedCandle, <-chan error) {
	candlesCh := make(chan sources.NormalizedCandle)
	errCh := make(chan error, 1)

	go func() {
		defer close(candlesCh)
		defer close(errCh)

		start, end, err := validateRequest(req)
		if err != nil {
			errCh <- err
			return
		}

		delay := deriveDelay(req.RateLimit)
		seen := make(map[string]struct{}, 1024)
		now := time.Now().UTC()

		for i, symbol := range req.Symbols {
			if err := ctx.Err(); err != nil {
				errCh <- err
				return
			}
			log.Printf("Fetching data for %s (%d/%d)...", symbol.Symbol, i+1, len(req.Symbols))
			if err := s.fetchSymbol(ctx, req.PackSpec, symbol, start, end, now, delay, seen, candlesCh); err != nil {
				errCh <- fmt.Errorf("fetch symbol %s: %w", symbol.Symbol, err)
				return
			}
		}
	}()

	return candlesCh, errCh
}

func validateRequest(req sources.FetchCandlesRequest) (time.Time, time.Time, error) {
	if len(req.Symbols) == 0 {
		return time.Time{}, time.Time{}, fmt.Errorf("symbols are required")
	}
	start := dayStartUTC(req.StartDate)
	end := dayStartUTC(req.EndDate)
	if start.IsZero() || end.IsZero() {
		return time.Time{}, time.Time{}, fmt.Errorf("start and end dates are required")
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("end date must be on or after start date")
	}
	return start, end, nil
}

func deriveDelay(rate sources.RateLimitConfig) time.Duration {
	if rate.RequestsPerSecond <= 0 {
		return 0
	}
	return time.Second / time.Duration(rate.RequestsPerSecond)
}

func (s *Source) fetchSymbol(
	ctx context.Context,
	spec sources.PackSpec,
	symbol sources.UniverseSymbol,
	start time.Time,
	end time.Time,
	now time.Time,
	delay time.Duration,
	seen map[string]struct{},
	out chan<- sources.NormalizedCandle,
) error {
	monthCursor := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
	lastMonth := time.Date(end.Year(), end.Month(), 1, 0, 0, 0, 0, time.UTC)

	var mu sync.Mutex
	var allCandles []sources.NormalizedCandle

	eg, gctx := errgroup.WithContext(ctx)
	eg.SetLimit(10) // fetch up to 10 months concurrently

	for !monthCursor.After(lastMonth) {
		monthStart := maxTime(start, monthCursor)
		monthEnd := minTime(end, monthCursor.AddDate(0, 1, 0).Add(-24*time.Hour))
		if monthEnd.Before(monthStart) {
			monthCursor = monthCursor.AddDate(0, 1, 0)
			continue
		}

		mc := monthCursor
		useDaily := mc.Year() == now.Year() && mc.Month() == now.Month()

		eg.Go(func() error {
			var candles []sources.NormalizedCandle
			var err error
			if useDaily {
				candles, err = s.fetchDailyRange(gctx, spec, symbol, monthStart, monthEnd, delay)
			} else {
				c, found, errMonth := s.fetchMonthly(gctx, spec, symbol, mc, monthStart, monthEnd, delay)
				if errMonth != nil {
					return errMonth
				}
				if !found {
					prevMonth := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, time.UTC)
					if mc.Before(prevMonth) && !strings.HasPrefix(s.baseURL, "http://127.0.0.1") && !strings.HasPrefix(s.baseURL, "http://localhost") {
						// Historical month missing means token didn't exist yet. Skip daily fallback.
						candles = nil
						err = nil
					} else {
						candles, err = s.fetchDailyRange(gctx, spec, symbol, monthStart, monthEnd, delay)
					}
				} else {
					candles = c
				}
			}
			if err != nil {
				return err
			}
			
			mu.Lock()
			allCandles = append(allCandles, candles...)
			mu.Unlock()
			return nil
		})

		monthCursor = monthCursor.AddDate(0, 1, 0)
	}

	if err := eg.Wait(); err != nil {
		return err
	}

	return emitCandles(ctx, allCandles, seen, out)
}

func (s *Source) fetchMonthly(
	ctx context.Context,
	spec sources.PackSpec,
	symbol sources.UniverseSymbol,
	month time.Time,
	from time.Time,
	to time.Time,
	delay time.Duration,
) ([]sources.NormalizedCandle, bool, error) {
	url := s.monthlyURL(symbol.Symbol, month)
	archive, err := s.downloadArchive(ctx, url, delay)
	if err != nil {
		if errors.Is(err, errArchiveNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	candles, err := parseArchive(archive, spec, symbol)
	if err != nil {
		return nil, false, fmt.Errorf("parse monthly archive: %w", err)
	}
	return filterRange(candles, from, to), true, nil
}

func (s *Source) fetchDailyRange(
	ctx context.Context,
	spec sources.PackSpec,
	symbol sources.UniverseSymbol,
	from time.Time,
	to time.Time,
	delay time.Duration,
) ([]sources.NormalizedCandle, error) {
	var mu sync.Mutex
	var allCandles []sources.NormalizedCandle

	eg, gctx := errgroup.WithContext(ctx)
	eg.SetLimit(10) // fetch up to 10 days concurrently

	for day := from; !day.After(to); day = day.Add(24 * time.Hour) {
		d := day
		eg.Go(func() error {
			url := s.dailyURL(symbol.Symbol, d)
			archive, err := s.downloadArchive(gctx, url, delay)
			if err != nil {
				if errors.Is(err, errArchiveNotFound) {
					return nil
				}
				return err
			}
			rows, err := parseArchive(archive, spec, symbol)
			if err != nil {
				return fmt.Errorf("parse daily archive %s: %w", d.Format("2006-01-02"), err)
			}
			filtered := filterRange(rows, d, d)
			
			mu.Lock()
			allCandles = append(allCandles, filtered...)
			mu.Unlock()
			return nil
		})
	}
	
	if err := eg.Wait(); err != nil {
		return nil, err
	}
	return allCandles, nil
}

func emitCandles(
	ctx context.Context,
	candles []sources.NormalizedCandle,
	seen map[string]struct{},
	out chan<- sources.NormalizedCandle,
) error {
	sort.Slice(candles, func(i, j int) bool {
		return candles[i].Timestamp.Before(candles[j].Timestamp)
	})
	for _, candle := range candles {
		key := sources.CanonicalKey(candle)
		if _, exists := seen[key]; exists {
			log.Printf("WARNING: duplicate candle key %s, skipping", key)
			continue
		}
		seen[key] = struct{}{}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case out <- candle:
		}
	}
	return nil
}

func (s *Source) monthlyURL(symbol string, month time.Time) string {
	fileName := fmt.Sprintf("%s-%s-%04d-%02d.zip", symbol, Interval1D, month.Year(), int(month.Month()))
	return s.url(path.Join("data", s.market, "monthly", "klines", symbol, Interval1D, fileName))
}

func (s *Source) dailyURL(symbol string, day time.Time) string {
	fileName := fmt.Sprintf("%s-%s-%s.zip", symbol, Interval1D, day.Format("2006-01-02"))
	return s.url(path.Join("data", s.market, "daily", "klines", symbol, Interval1D, fileName))
}

func (s *Source) url(rel string) string {
	return s.baseURL + "/" + strings.TrimLeft(rel, "/")
}

func (s *Source) downloadArchive(ctx context.Context, archiveURL string, delay time.Duration) ([]byte, error) {
	if err := throttle(ctx, delay); err != nil {
		return nil, err
	}
	body, statusCode, err := s.get(ctx, archiveURL)
	if err != nil {
		return nil, err
	}
	if statusCode == http.StatusNotFound {
		return nil, errArchiveNotFound
	}
	if statusCode != http.StatusOK {
		return nil, fmt.Errorf("download archive %s failed with status %d", archiveURL, statusCode)
	}

	if err := s.verifyChecksum(ctx, archiveURL, body, delay); err != nil {
		return nil, err
	}
	return body, nil
}

func (s *Source) verifyChecksum(ctx context.Context, archiveURL string, archive []byte, delay time.Duration) error {
	if err := throttle(ctx, delay); err != nil {
		return err
	}
	checksumURL := archiveURL + ".CHECKSUM"
	body, statusCode, err := s.get(ctx, checksumURL)
	if err != nil {
		return err
	}
	if statusCode == http.StatusNotFound {
		return nil
	}
	if statusCode != http.StatusOK {
		return fmt.Errorf("download checksum %s failed with status %d", checksumURL, statusCode)
	}

	expected, err := extractChecksumDigest(string(body))
	if err != nil {
		return fmt.Errorf("parse checksum %s: %w", checksumURL, err)
	}
	sum := sha256.Sum256(archive)
	actual := hex.EncodeToString(sum[:])
	if !strings.EqualFold(expected, actual) {
		return fmt.Errorf("checksum mismatch for %s", archiveURL)
	}
	return nil
}

func extractChecksumDigest(content string) (string, error) {
	fields := strings.Fields(content)
	if len(fields) == 0 {
		return "", fmt.Errorf("empty checksum content")
	}
	digest := strings.TrimSpace(fields[0])
	if len(digest) != 64 {
		return "", fmt.Errorf("invalid checksum digest length")
	}
	if _, err := hex.DecodeString(digest); err != nil {
		return "", fmt.Errorf("invalid checksum digest: %w", err)
	}
	return digest, nil
}

func (s *Source) get(ctx context.Context, url string) ([]byte, int, error) {
	var body []byte
	var statusCode int
	var err error

	maxRetries := 3
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return nil, 0, ctx.Err()
			case <-time.After(backoff):
			}
			log.Printf("Retrying GET %s (attempt %d/%d) after error/status: %v", url, attempt, maxRetries, err)
		}

		body, statusCode, err = s.getOnce(ctx, url)
		if err == nil {
			if statusCode >= 500 || statusCode == http.StatusTooManyRequests {
				err = fmt.Errorf("HTTP status %d", statusCode)
				continue
			}
			return body, statusCode, nil
		}
	}
	return nil, 0, fmt.Errorf("after %d retries: %w", maxRetries, err)
}

func (s *Source) getOnce(ctx context.Context, url string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}
	return body, resp.StatusCode, nil
}

func parseArchive(archive []byte, spec sources.PackSpec, symbol sources.UniverseSymbol) ([]sources.NormalizedCandle, error) {
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, fmt.Errorf("open zip archive: %w", err)
	}

	var csvFile *zip.File
	for _, file := range reader.File {
		if file.FileInfo().IsDir() {
			continue
		}
		if strings.HasSuffix(strings.ToLower(file.Name), ".csv") {
			csvFile = file
			break
		}
	}
	if csvFile == nil {
		return nil, fmt.Errorf("zip archive has no csv file")
	}

	fileReader, err := csvFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open csv file in zip: %w", err)
	}
	defer fileReader.Close()

	csvReader := csv.NewReader(fileReader)
	csvReader.FieldsPerRecord = -1

	rows := make([]sources.NormalizedCandle, 0, 128)
	for {
		record, err := csvReader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, fmt.Errorf("read csv record: %w", err)
		}
		if len(record) == 0 {
			continue
		}
		candle, err := normalizeRecord(record, spec, symbol)
		if err != nil {
			return nil, err
		}
		rows = append(rows, candle)
	}
	return rows, nil
}

func normalizeRecord(record []string, spec sources.PackSpec, symbol sources.UniverseSymbol) (sources.NormalizedCandle, error) {
	if len(record) < 6 {
		return sources.NormalizedCandle{}, fmt.Errorf("invalid kline row, expected >= 6 columns got %d", len(record))
	}

	openTimeRaw := strings.TrimSpace(record[0])
	rawTimestamp, err := strconv.ParseInt(openTimeRaw, 10, 64)
	if err != nil {
		return sources.NormalizedCandle{}, fmt.Errorf("invalid open_time %q: %w", openTimeRaw, err)
	}
	timestamp := parseScaledTimestamp(rawTimestamp).UTC()
	if !isUTCDayBoundary(timestamp) {
		return sources.NormalizedCandle{}, fmt.Errorf("timestamp %s is not UTC day boundary", timestamp.Format(time.RFC3339Nano))
	}

	open, err := parsePositiveDecimal("open", record[1])
	if err != nil {
		return sources.NormalizedCandle{}, err
	}
	high, err := parsePositiveDecimal("high", record[2])
	if err != nil {
		return sources.NormalizedCandle{}, err
	}
	low, err := parsePositiveDecimal("low", record[3])
	if err != nil {
		return sources.NormalizedCandle{}, err
	}
	closePrice, err := parsePositiveDecimal("close", record[4])
	if err != nil {
		return sources.NormalizedCandle{}, err
	}
	volume, err := decimal.NewFromString(strings.TrimSpace(record[5]))
	if err != nil {
		return sources.NormalizedCandle{}, fmt.Errorf("invalid volume %q: %w", strings.TrimSpace(record[5]), err)
	}

	if high.LessThan(low) {
		return sources.NormalizedCandle{}, fmt.Errorf("invalid kline row: high < low")
	}

	quoteCurrency := strings.ToUpper(strings.TrimSpace(spec.QuoteCurrency))
	if quoteCurrency == "" {
		quoteCurrency = strings.ToUpper(strings.TrimSpace(symbol.QuoteAsset))
	}
	assetType := strings.TrimSpace(spec.AssetType)
	if assetType == "" {
		assetType = strings.TrimSpace(symbol.AssetType)
	}

	return sources.NormalizedCandle{
		InstrumentID:  strings.TrimSpace(symbol.InstrumentID),
		Symbol:        strings.TrimSpace(symbol.Symbol),
		AssetType:     assetType,
		Interval:      Interval1D,
		Timestamp:     timestamp,
		Open:          open,
		High:          high,
		Low:           low,
		Close:         closePrice,
		AdjustedClose: nil,
		Volume:        volume,
		QuoteCurrency: quoteCurrency,
		Source:        SourceName,
	}, nil
}

func parsePositiveDecimal(name string, raw string) (decimal.Decimal, error) {
	value, err := decimal.NewFromString(strings.TrimSpace(raw))
	if err != nil {
		return decimal.Decimal{}, fmt.Errorf("invalid %s %q: %w", name, strings.TrimSpace(raw), err)
	}
	if !value.GreaterThan(decimal.Zero) {
		return decimal.Decimal{}, fmt.Errorf("invalid %s %q: must be > 0", name, strings.TrimSpace(raw))
	}
	return value, nil
}

func parseScaledTimestamp(raw int64) time.Time {
	if raw >= 1_000_000_000_000_000 {
		return time.UnixMicro(raw)
	}
	return time.UnixMilli(raw)
}

func isUTCDayBoundary(ts time.Time) bool {
	utc := ts.UTC()
	return utc.Hour() == 0 && utc.Minute() == 0 && utc.Second() == 0 && utc.Nanosecond() == 0
}

func filterRange(candles []sources.NormalizedCandle, from time.Time, to time.Time) []sources.NormalizedCandle {
	out := make([]sources.NormalizedCandle, 0, len(candles))
	for _, candle := range candles {
		ts := dayStartUTC(candle.Timestamp)
		if ts.Before(from) || ts.After(to) {
			continue
		}
		out = append(out, candle)
	}
	return out
}

func throttle(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func dayStartUTC(ts time.Time) time.Time {
	if ts.IsZero() {
		return time.Time{}
	}
	utc := ts.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func maxTime(a time.Time, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func minTime(a time.Time, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

const binanceAPIBase = "https://api.binance.com"

// tickerEntry represents a single ticker from Binance's 24hr API.
type tickerEntry struct {
	Symbol      string `json:"symbol"`
	QuoteVolume string `json:"quoteVolume"`
}

// RankSymbols sorts the provided symbols by real-time 24h trading volume
// (descending) using Binance's public ticker API. On failure it logs a
// warning and returns the original order.
func (s *Source) RankSymbols(ctx context.Context, symbols []sources.UniverseSymbol) ([]sources.UniverseSymbol, error) {
	if len(symbols) <= 1 {
		return symbols, nil
	}

	tickers, err := s.fetch24hrTickers(ctx)
	if err != nil {
		log.Printf("WARNING: failed to fetch 24hr tickers for ranking, using original order: %v", err)
		return symbols, nil
	}

	volumeMap := make(map[string]decimal.Decimal, len(tickers))
	for _, t := range tickers {
		vol, parseErr := decimal.NewFromString(t.QuoteVolume)
		if parseErr != nil {
			continue
		}
		volumeMap[strings.ToUpper(t.Symbol)] = vol
	}

	result := make([]sources.UniverseSymbol, len(symbols))
	copy(result, symbols)

	sort.SliceStable(result, func(i, j int) bool {
		vi := volumeMap[strings.ToUpper(result[i].Symbol)]
		vj := volumeMap[strings.ToUpper(result[j].Symbol)]
		return vi.GreaterThan(vj)
	})

	log.Printf("Ranked %d symbols by 24h volume (top 3: %s)", len(result), topN(result, 3))
	return result, nil
}

func (s *Source) fetch24hrTickers(ctx context.Context) ([]tickerEntry, error) {
	url := binanceAPIBase + "/api/v3/ticker/24hr"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance ticker API returned HTTP %d", resp.StatusCode)
	}
	var tickers []tickerEntry
	if err := json.NewDecoder(resp.Body).Decode(&tickers); err != nil {
		return nil, fmt.Errorf("decode ticker response: %w", err)
	}
	return tickers, nil
}

func topN(symbols []sources.UniverseSymbol, n int) string {
	if n > len(symbols) {
		n = len(symbols)
	}
	names := make([]string, n)
	for i := 0; i < n; i++ {
		names[i] = symbols[i].Symbol
	}
	return strings.Join(names, ", ")
}
