package binance

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha1"
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

const CoinMarketCapAPIBase = "https://pro-api.coinmarketcap.com"

type Config struct {
	BaseURL             string
	Market              string
	HTTPClient          *http.Client
	CoinMarketCapAPIKey string
}

type Source struct {
	baseURL    string
	market     string
	client     *http.Client
	cmcAPIKey  string
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
		baseURL:   baseURL,
		market:    market,
		client:    client,
		cmcAPIKey: strings.TrimSpace(cfg.CoinMarketCapAPIKey),
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
		var seenMu sync.Mutex
		now := time.Now().UTC()

		concurrency := 8
		if req.RateLimit.Concurrency > 0 {
			concurrency = req.RateLimit.Concurrency
		}

		eg, gctx := errgroup.WithContext(ctx)
		eg.SetLimit(concurrency)

		for i, symbol := range req.Symbols {
			i := i
			symbol := symbol
			eg.Go(func() error {
				if err := gctx.Err(); err != nil {
					return err
				}
				log.Printf("Fetching data for %s (%d/%d)...", symbol.Symbol, i+1, len(req.Symbols))
				if err := s.fetchSymbol(gctx, req.PackSpec, symbol, start, end, now, delay, seen, &seenMu, candlesCh); err != nil {
					return fmt.Errorf("fetch symbol %s: %w", symbol.Symbol, err)
				}
				return nil
			})
		}

		if err := eg.Wait(); err != nil {
			errCh <- err
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
	seenMu *sync.Mutex,
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

	return emitCandles(ctx, allCandles, seen, seenMu, out)
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
	seenMu *sync.Mutex,
	out chan<- sources.NormalizedCandle,
) error {
	sort.Slice(candles, func(i, j int) bool {
		return candles[i].Timestamp.Before(candles[j].Timestamp)
	})
	for _, candle := range candles {
		key := sources.CanonicalKey(candle)
		
		seenMu.Lock()
		_, exists := seen[key]
		if !exists {
			seen[key] = struct{}{}
		}
		seenMu.Unlock()

		if exists {
			log.Printf("WARNING: duplicate candle key %s, skipping", key)
			continue
		}

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

// cmcListing is a single entry from the CoinMarketCap listings/latest endpoint.
type cmcListing struct {
	Symbol string `json:"symbol"`
}

type cmcListingsResponse struct {
	Data []cmcListing `json:"data"`
}

// DiscoverUniverse fetches the top-N crypto coins by CoinMarketCap market-cap rank,
// verifies each candidate has historical archive data on data.binance.vision, and
// returns exactly `count` symbols. Returns an error if fewer than `count` symbols
// can be verified — no silent short-delivery.
func (s *Source) DiscoverUniverse(ctx context.Context, count int) (*sources.Universe, error) {
	if count <= 0 {
		return nil, fmt.Errorf("invalid count %d for universe discovery", count)
	}

	// Over-fetch from CMC to compensate for coins/tokens without Binance USDT pairs
	// or without archive data on data.binance.vision. The hit rate is typically
	// 20-30% of CMC-listed assets, so fetch 6x and floor at 1000.
	overFetch := count * 6
	if overFetch < 1000 {
		overFetch = 1000
	}

	cmcBase := CoinMarketCapAPIBase
	if strings.HasPrefix(s.baseURL, "http://127.0.0.1") || strings.HasPrefix(s.baseURL, "http://localhost") {
		cmcBase = s.baseURL // test/fixture: CMC endpoint served by local server
	}

	reqURL := fmt.Sprintf("%s/v1/cryptocurrency/listings/latest?limit=%d&sort=market_cap&aux=",
		cmcBase, overFetch)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create CMC request: %w", err)
	}
	if s.cmcAPIKey != "" {
		req.Header.Set("X-CMC_PRO_API_KEY", s.cmcAPIKey)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CMC API request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CMC API returned HTTP %d", resp.StatusCode)
	}

	var cmcResp cmcListingsResponse
	if err := json.NewDecoder(resp.Body).Decode(&cmcResp); err != nil {
		return nil, fmt.Errorf("decode CMC response: %w", err)
	}

	// Build candidate USDT symbols in market-cap order, applying exclusion rules.
	type candidate struct {
		symbol    string
		baseAsset string
	}
	var candidates []candidate
	seen := make(map[string]struct{})
	for _, entry := range cmcResp.Data {
		base := strings.ToUpper(strings.TrimSpace(entry.Symbol))
		if IsExcludedBaseAsset(base) {
			continue
		}
		symbol := base + "USDT"
		if _, ok := seen[symbol]; ok {
			continue
		}
		seen[symbol] = struct{}{}
		candidates = append(candidates, candidate{symbol: symbol, baseAsset: base})
	}

	log.Printf("CMC returned %d coins, %d unique USDT candidates after filtering", len(cmcResp.Data), len(candidates))

	if len(candidates) == 0 {
		return nil, fmt.Errorf("CMC returned no usable USDT candidates")
	}

	// Probe data.binance.vision to verify each candidate has historical archive data.
	// Use a HEAD request on a monthly archive from 2 months ago (reliably available).
	// In local/fixture mode, skip probing and trust the CMC order directly.
	isLocal := strings.HasPrefix(s.baseURL, "http://127.0.0.1") || strings.HasPrefix(s.baseURL, "http://localhost")

	var uniSymbols []sources.UniverseSymbol

	if isLocal {
		for _, c := range candidates {
			uniSymbols = append(uniSymbols, sources.UniverseSymbol{
InstrumentID: instrumentID(c.symbol),
Symbol:       c.symbol,
BaseAsset:    c.baseAsset,
QuoteAsset:   "USDT",
AssetType:    "CRYPTO",
})
			if len(uniSymbols) >= count {
				break
			}
		}
	} else {
		probeMonth := time.Now().UTC().AddDate(0, -2, 0)
		probeMonth = time.Date(probeMonth.Year(), probeMonth.Month(), 1, 0, 0, 0, 0, time.UTC)

		type probeResult struct {
			ok bool
		}
		probeResults := make([]probeResult, len(candidates))
		eg, gctx := errgroup.WithContext(ctx)
		eg.SetLimit(30)

		for i := range candidates {
			i := i
			c := candidates[i]
			eg.Go(func() error {
				probeURL := s.probeArchiveURL(c.symbol, probeMonth)
				preq, reqErr := http.NewRequestWithContext(gctx, http.MethodHead, probeURL, nil)
				if reqErr != nil {
					probeResults[i] = probeResult{ok: false}
					return nil
				}
				presp, doErr := s.client.Do(preq)
				if doErr != nil {
					probeResults[i] = probeResult{ok: false}
					return nil
				}
				presp.Body.Close()
				probeResults[i] = probeResult{ok: presp.StatusCode == http.StatusOK}
				return nil
			})
		}
		if err := eg.Wait(); err != nil {
			return nil, fmt.Errorf("probe archive availability: %w", err)
		}

		var verified int
		for i, c := range candidates {
			if !probeResults[i].ok {
				continue
			}
			verified++
			uniSymbols = append(uniSymbols, sources.UniverseSymbol{
InstrumentID: instrumentID(c.symbol),
Symbol:       c.symbol,
BaseAsset:    c.baseAsset,
QuoteAsset:   "USDT",
AssetType:    "CRYPTO",
})
			if len(uniSymbols) >= count {
				break
			}
		}
		log.Printf("Discovered %d verified symbols via CMC+binance.vision (probed %d candidates, %d had archives, top 3: %s)",
len(uniSymbols), len(candidates), verified, topN(uniSymbols, 3))
	}

	if len(uniSymbols) < count {
		return nil, fmt.Errorf("CMC discovery found only %d verified symbols, need exactly %d; increase over-fetch or check CMC_API_KEY",
len(uniSymbols), count)
	}

	return &sources.Universe{
		Symbols: uniSymbols[:count],
	}, nil
}

// RankSymbols returns symbols in their existing order. CoinMarketCap already
// provides market-cap ranking, so no re-ranking is needed.
func (s *Source) RankSymbols(_ context.Context, symbols []sources.UniverseSymbol) ([]sources.UniverseSymbol, error) {
	return symbols, nil
}

// probeArchiveURL returns the data.binance.vision URL for a monthly kline archive.
// Used for HEAD-request probing to verify a symbol has historical data.
func (s *Source) probeArchiveURL(symbol string, month time.Time) string {
	fileName := fmt.Sprintf("%s-%s-%04d-%02d.zip", symbol, Interval1D, month.Year(), int(month.Month()))
	return s.url(path.Join("data", s.market, "monthly", "klines", symbol, Interval1D, fileName))
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

const InstrumentNamespace = "sigma-finance:binance-spot"

// instrumentID generates a deterministic UUIDv5 from namespace + symbol.
func instrumentID(symbol string) string {
	h := sha1.New()
	h.Write([]byte(InstrumentNamespace))
	h.Write([]byte(symbol))
	sum := h.Sum(nil)

	// Set version 5 (0x50)
	sum[6] = (sum[6] & 0x0f) | 0x50
	// Set variant 1 (RFC 4122, 0x80)
	sum[8] = (sum[8] & 0x3f) | 0x80

	// Format as UUID string: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	dst := make([]byte, 36)
	hex.Encode(dst[0:8], sum[0:4])
	dst[8] = '-'
	hex.Encode(dst[9:13], sum[4:6])
	dst[13] = '-'
	hex.Encode(dst[14:18], sum[6:8])
	dst[18] = '-'
	hex.Encode(dst[19:23], sum[8:10])
	dst[23] = '-'
	hex.Encode(dst[24:36], sum[10:16])

	return string(dst)
}

// IsExcludedBaseAsset returns true for stablecoins, wrapped tokens,
// leveraged tokens, and other assets that should not appear in crypto packs.
func IsExcludedBaseAsset(base string) bool {
	if base == "" {
		return true
	}
	if strings.HasPrefix(base, "1000") || strings.HasPrefix(base, "LD") {
		return true
	}
	if strings.HasSuffix(base, "UP") || strings.HasSuffix(base, "DOWN") || strings.HasSuffix(base, "BULL") || strings.HasSuffix(base, "BEAR") {
		return true
	}
	switch base {
	case "USDT", "USDC", "FDUSD", "BUSD", "TUSD", "USDP", "DAI", "USD1",
		"EUR", "TRY", "BRL", "RUB", "UAH", "GBP", "AUD", "JPY", "BIDR", "IDRT", "NGN", "ZAR", "PLN", "RON", "ARS",
		"WBTC", "WETH", "WBETH", "WBNB":
		return true
	default:
		return false
	}
}
