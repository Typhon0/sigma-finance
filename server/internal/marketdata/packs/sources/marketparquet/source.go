package marketparquet

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/shopspring/decimal"
)

const (
	AssetTimeframeStockDaily = "stock_daily"
	AssetTimeframeETFDaily   = "etf_daily"
)

type DailyRow struct {
	Timestamp time.Time `parquet:"timestamp,timestamp(microsecond)"`
	Symbol    string    `parquet:"symbol"`
	AssetType string    `parquet:"asset_type"`
	Open      float64   `parquet:"open"`
	High      float64   `parquet:"high"`
	Low       float64   `parquet:"low"`
	Close     float64   `parquet:"close"`
	Volume    float64   `parquet:"volume"`
}

type APIClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewAPIClient(baseURL string, apiKey string) *APIClient {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		trimmed = "https://www.marketparquet.com"
	}
	return &APIClient{
		baseURL: trimmed,
		apiKey:  strings.TrimSpace(apiKey),
		client:  &http.Client{Timeout: 60 * time.Second},
	}
}

func ReadRows(path string) ([]DailyRow, error) {
	rows, err := parquet.ReadFile[DailyRow](path)
	if err != nil {
		return nil, fmt.Errorf("read parquet %s: %w", path, err)
	}
	return rows, nil
}

func ValidateParquet(path string) error {
	_, err := ReadRows(path)
	return err
}

func (c *APIClient) ListDates(ctx context.Context, assetTimeframe string) ([]time.Time, error) {
	url := fmt.Sprintf("%s/api/v1/dates/%s", c.baseURL, strings.TrimSpace(assetTimeframe))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("marketparquet dates request failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	dateStrings, err := parseDateListPayload(raw)
	if err != nil {
		return nil, err
	}
	dates := make([]time.Time, 0, len(dateStrings))
	for _, rawDate := range dateStrings {
		value := strings.TrimSpace(rawDate)
		if value == "" {
			continue
		}
		parsed, err := time.Parse(time.DateOnly, value)
		if err != nil {
			continue
		}
		dates = append(dates, parsed.UTC())
	}
	sort.Slice(dates, func(i, j int) bool { return dates[i].Before(dates[j]) })
	return dates, nil
}

func (c *APIClient) DownloadDateFile(ctx context.Context, assetTimeframe string, date time.Time, targetPath string) error {
	if strings.TrimSpace(targetPath) == "" {
		return fmt.Errorf("target path is required")
	}
	dateKey := date.UTC().Format(time.DateOnly)
	endpoint := fmt.Sprintf("%s/api/v1/download/%s/%s", c.baseURL, strings.TrimSpace(assetTimeframe), dateKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	c.applyAuth(req)
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("marketparquet download request failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if strings.Contains(contentType, "application/json") {
		downloadURL, parseErr := parseDownloadURLPayload(body)
		if parseErr != nil {
			return parseErr
		}
		return c.downloadDirect(ctx, downloadURL, targetPath)
	}
	return writeFileAtomically(targetPath, body)
}

func (c *APIClient) downloadDirect(ctx context.Context, url string, targetPath string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSpace(url), nil)
	if err != nil {
		return err
	}
	c.applyAuth(req)
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("marketparquet direct download failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return writeFileAtomically(targetPath, payload)
}

func (c *APIClient) applyAuth(req *http.Request) {
	if strings.TrimSpace(c.apiKey) == "" {
		return
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("X-API-Key", c.apiKey)
}

func FilterByDateRange(dates []time.Time, from time.Time, to time.Time) []time.Time {
	start := dayStartUTC(from)
	end := dayStartUTC(to)
	if end.Before(start) {
		return []time.Time{}
	}
	out := make([]time.Time, 0, len(dates))
	seen := make(map[string]struct{}, len(dates))
	for _, d := range dates {
		day := dayStartUTC(d)
		if day.Before(start) || day.After(end) {
			continue
		}
		key := day.Format(time.DateOnly)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, day)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Before(out[j]) })
	return out
}

func NormalizeAssetType(value string) (string, bool) {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	switch normalized {
	case "STOCK":
		return "STOCK", true
	case "ETF":
		return "FUND", true
	default:
		return "", false
	}
}

func NormalizeUTCDailyTimestamp(sourceTS time.Time) time.Time {
	if sourceTS.IsZero() {
		return sourceTS
	}
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		loc = time.FixedZone("EST", -5*60*60)
	}
	inNY := sourceTS.In(loc)
	return time.Date(inNY.Year(), inNY.Month(), inNY.Day(), 0, 0, 0, 0, time.UTC)
}

func DecimalFromFloat64(value float64) (decimal.Decimal, error) {
	if !isFinite(value) {
		return decimal.Zero, fmt.Errorf("non-finite float64 value")
	}
	text := strconv.FormatFloat(value, 'g', -1, 64)
	out, err := decimal.NewFromString(text)
	if err != nil {
		return decimal.Zero, fmt.Errorf("parse decimal %q: %w", text, err)
	}
	return out, nil
}

func dayStartUTC(value time.Time) time.Time {
	if value.IsZero() {
		return value
	}
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func isFinite(value float64) bool {
	return value <= 1.7976931348623157e+308 && value >= -1.7976931348623157e+308
}

func writeFileAtomically(path string, payload []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), "marketparquet-*.parquet")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}
	if _, err := tmp.Write(payload); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Close(); err != nil {
		cleanup()
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		cleanup()
		return err
	}
	return nil
}

func parseDateListPayload(raw []byte) ([]string, error) {
	var asArray []string
	if err := json.Unmarshal(raw, &asArray); err == nil {
		return asArray, nil
	}
	var asObject map[string]json.RawMessage
	if err := json.Unmarshal(raw, &asObject); err != nil {
		return nil, fmt.Errorf("decode date payload: %w", err)
	}
	for _, key := range []string{"dates", "data"} {
		value, ok := asObject[key]
		if !ok {
			continue
		}
		if err := json.Unmarshal(value, &asArray); err == nil {
			return asArray, nil
		}
	}
	return nil, fmt.Errorf("marketparquet date payload missing date list")
}

func parseDownloadURLPayload(raw []byte) (string, error) {
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", fmt.Errorf("decode download payload: %w", err)
	}
	for _, key := range []string{"download_url", "url"} {
		if value, ok := payload[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value), nil
		}
	}
	return "", fmt.Errorf("marketparquet download payload missing download url")
}
