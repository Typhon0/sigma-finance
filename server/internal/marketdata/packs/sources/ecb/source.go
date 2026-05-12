package ecb

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"

	"github.com/shopspring/decimal"
)

const (
	SourceName          = "ecb-statistics"
	DerivedSourceName   = "ecb-statistics-derived"
	DefaultBaseURL      = "https://data-api.ecb.europa.eu"
	Interval1D          = "1d"
	defaultAssetTypeFX  = "FX"
	csvFormatParamValue = "csvdata"
)

type Config struct {
	BaseURL    string
	HTTPClient *http.Client
}

type Source struct {
	baseURL string
	client  *http.Client
}

type fxPair struct {
	InstrumentID string
	Symbol       string
	Base         string
	Quote        string
	AssetType    string
}

type dailyRates map[time.Time]map[string]decimal.Decimal

func NewSource(cfg Config) *Source {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	client := cfg.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	return &Source{
		baseURL: baseURL,
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

		pairs, err := parsePairs(req.PackSpec, req.Symbols)
		if err != nil {
			errCh <- err
			return
		}
		currencies := requiredCurrencies(pairs)
		rawRates, err := s.fetchRates(ctx, currencies, start, end)
		if err != nil {
			errCh <- err
			return
		}

		seen := make(map[string]struct{}, len(pairs)*64)
		dates := sortedDates(rawRates)
		for _, day := range dates {
			if day.Before(start) || day.After(end) {
				continue
			}
			ratesForDay := rawRates[day]
			for _, pair := range pairs {
				candle, ok, buildErr := buildCandle(req.PackSpec, pair, day, ratesForDay)
				if buildErr != nil {
					errCh <- buildErr
					return
				}
				if !ok {
					continue
				}
				key := sources.CanonicalKey(candle)
				if _, exists := seen[key]; exists {
					errCh <- fmt.Errorf("duplicate candle key %s", key)
					return
				}
				seen[key] = struct{}{}
				select {
				case <-ctx.Done():
					errCh <- ctx.Err()
					return
				case candlesCh <- candle:
				}
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

func parsePairs(spec sources.PackSpec, symbols []sources.UniverseSymbol) ([]fxPair, error) {
	pairs := make([]fxPair, 0, len(symbols))
	defaultAssetType := strings.ToUpper(strings.TrimSpace(spec.AssetType))
	if defaultAssetType == "" {
		defaultAssetType = defaultAssetTypeFX
	}
	for i, symbol := range symbols {
		instrumentID := strings.TrimSpace(symbol.InstrumentID)
		if instrumentID == "" {
			return nil, fmt.Errorf("symbol %d missing instrument_id", i)
		}
		pairSymbol := strings.ToUpper(strings.TrimSpace(symbol.Symbol))
		if pairSymbol == "" {
			return nil, fmt.Errorf("symbol %d missing symbol", i)
		}
		base := strings.ToUpper(strings.TrimSpace(symbol.BaseAsset))
		quote := strings.ToUpper(strings.TrimSpace(symbol.QuoteAsset))
		if base == "" || quote == "" {
			if len(pairSymbol) != 6 {
				return nil, fmt.Errorf("symbol %s requires base_asset and quote_asset", pairSymbol)
			}
			base = pairSymbol[:3]
			quote = pairSymbol[3:]
		}
		if base == quote {
			return nil, fmt.Errorf("invalid FX symbol %s: base and quote are identical", pairSymbol)
		}
		assetType := strings.ToUpper(strings.TrimSpace(symbol.AssetType))
		if assetType == "" {
			assetType = defaultAssetType
		}
		pairs = append(pairs, fxPair{
			InstrumentID: instrumentID,
			Symbol:       pairSymbol,
			Base:         base,
			Quote:        quote,
			AssetType:    assetType,
		})
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].Symbol < pairs[j].Symbol })
	return pairs, nil
}

func requiredCurrencies(pairs []fxPair) []string {
	set := make(map[string]struct{}, 8)
	for _, pair := range pairs {
		if pair.Base != "EUR" {
			set[pair.Base] = struct{}{}
		}
		if pair.Quote != "EUR" {
			set[pair.Quote] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for currency := range set {
		out = append(out, currency)
	}
	sort.Strings(out)
	return out
}

func (s *Source) fetchRates(ctx context.Context, currencies []string, start, end time.Time) (dailyRates, error) {
	if len(currencies) == 0 {
		return nil, fmt.Errorf("at least one non-EUR currency is required")
	}
	series := strings.Join(currencies, "+")
	rel := path.Join("service", "data", "EXR", "D."+series+".EUR.SP00.A")
	endpoint, err := url.Parse(s.baseURL + "/" + strings.TrimLeft(rel, "/"))
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("startPeriod", start.Format(time.DateOnly))
	query.Set("endPeriod", end.Format(time.DateOnly))
	query.Set("format", csvFormatParamValue)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ecb returned HTTP %d", resp.StatusCode)
	}
	return parseECBCSV(resp.Body)
}

func parseECBCSV(reader io.Reader) (dailyRates, error) {
	csvReader := csv.NewReader(reader)
	csvReader.FieldsPerRecord = -1
	header, err := csvReader.Read()
	if err != nil {
		return nil, err
	}
	index := make(map[string]int, len(header))
	for i, name := range header {
		index[strings.ToUpper(strings.TrimSpace(name))] = i
	}
	timeIdx, ok := index["TIME_PERIOD"]
	if !ok {
		return nil, fmt.Errorf("TIME_PERIOD column is required")
	}
	valueIdx, ok := index["OBS_VALUE"]
	if !ok {
		return nil, fmt.Errorf("OBS_VALUE column is required")
	}
	currencyIdx, ok := index["CURRENCY"]
	if !ok {
		return nil, fmt.Errorf("CURRENCY column is required")
	}
	denomIdx, ok := index["CURRENCY_DENOM"]
	if !ok {
		return nil, fmt.Errorf("CURRENCY_DENOM column is required")
	}

	out := make(dailyRates, 512)
	for {
		record, err := csvReader.Read()
		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
		if len(record) == 0 {
			continue
		}
		if timeIdx >= len(record) || valueIdx >= len(record) || currencyIdx >= len(record) || denomIdx >= len(record) {
			continue
		}
		denom := strings.ToUpper(strings.TrimSpace(record[denomIdx]))
		if denom != "EUR" {
			continue
		}
		currency := strings.ToUpper(strings.TrimSpace(record[currencyIdx]))
		if currency == "" {
			continue
		}
		day, err := time.Parse(time.DateOnly, strings.TrimSpace(record[timeIdx]))
		if err != nil {
			return nil, fmt.Errorf("invalid TIME_PERIOD %q: %w", strings.TrimSpace(record[timeIdx]), err)
		}
		value, err := decimal.NewFromString(strings.TrimSpace(record[valueIdx]))
		if err != nil {
			return nil, fmt.Errorf("invalid OBS_VALUE %q: %w", strings.TrimSpace(record[valueIdx]), err)
		}
		if !value.GreaterThan(decimal.Zero) {
			return nil, fmt.Errorf("invalid OBS_VALUE %q: must be > 0", strings.TrimSpace(record[valueIdx]))
		}
		day = dayStartUTC(day)
		if out[day] == nil {
			out[day] = make(map[string]decimal.Decimal, 8)
		}
		out[day][currency] = value
	}
	return out, nil
}

func buildCandle(spec sources.PackSpec, pair fxPair, day time.Time, raw map[string]decimal.Decimal) (sources.NormalizedCandle, bool, error) {
	rate, source, derivationType, derivedFrom, ok, err := deriveRate(pair, raw)
	if err != nil || !ok {
		return sources.NormalizedCandle{}, ok, err
	}
	if !rate.GreaterThan(decimal.Zero) {
		return sources.NormalizedCandle{}, false, fmt.Errorf("derived rate must be > 0 for %s", pair.Symbol)
	}
	if !isUTCDayBoundary(day) {
		return sources.NormalizedCandle{}, false, fmt.Errorf("timestamp %s is not UTC day boundary", day.Format(time.RFC3339Nano))
	}
	assetType := strings.ToUpper(strings.TrimSpace(pair.AssetType))
	if assetType == "" {
		assetType = strings.ToUpper(strings.TrimSpace(spec.AssetType))
		if assetType == "" {
			assetType = defaultAssetTypeFX
		}
	}
	return sources.NormalizedCandle{
		InstrumentID:   pair.InstrumentID,
		Symbol:         pair.Symbol,
		AssetType:      assetType,
		Interval:       Interval1D,
		Timestamp:      day,
		Open:           rate,
		High:           rate,
		Low:            rate,
		Close:          rate,
		AdjustedClose:  nil,
		Volume:         decimal.Zero,
		QuoteCurrency:  pair.Quote,
		Source:         source,
		DerivationType: derivationType,
		DerivedFrom:    derivedFrom,
	}, true, nil
}

func deriveRate(pair fxPair, raw map[string]decimal.Decimal) (decimal.Decimal, string, string, []string, bool, error) {
	if pair.Base == "EUR" {
		value, ok := raw[pair.Quote]
		if !ok {
			return decimal.Zero, "", "", nil, false, nil
		}
		return value, SourceName, "raw", nil, true, nil
	}
	baseRaw, ok := raw[pair.Base]
	if !ok {
		return decimal.Zero, "", "", nil, false, nil
	}
	if pair.Quote == "EUR" {
		if !baseRaw.GreaterThan(decimal.Zero) {
			return decimal.Zero, "", "", nil, false, fmt.Errorf("raw rate EUR%s must be > 0", pair.Base)
		}
		return decimal.NewFromInt(1).Div(baseRaw), DerivedSourceName, "inverse", []string{"EUR" + pair.Base}, true, nil
	}
	quoteRaw, ok := raw[pair.Quote]
	if !ok {
		return decimal.Zero, "", "", nil, false, nil
	}
	if !baseRaw.GreaterThan(decimal.Zero) || !quoteRaw.GreaterThan(decimal.Zero) {
		return decimal.Zero, "", "", nil, false, fmt.Errorf("raw cross rates must be > 0 for %s", pair.Symbol)
	}
	return quoteRaw.Div(baseRaw), DerivedSourceName, "cross", []string{"EUR" + pair.Base, "EUR" + pair.Quote}, true, nil
}

func sortedDates(rates dailyRates) []time.Time {
	out := make([]time.Time, 0, len(rates))
	for day := range rates {
		out = append(out, day)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Before(out[j]) })
	return out
}

func dayStartUTC(ts time.Time) time.Time {
	if ts.IsZero() {
		return time.Time{}
	}
	utc := ts.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func isUTCDayBoundary(ts time.Time) bool {
	utc := ts.UTC()
	return utc.Hour() == 0 && utc.Minute() == 0 && utc.Second() == 0 && utc.Nanosecond() == 0
}
