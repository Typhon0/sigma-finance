package marketparquet

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/parquet-go/parquet-go"
)

func TestReadRowsAndNormalizeFields(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "stock_daily", "2024-01-02.parquet")
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		t.Fatalf("mkdir fixture dir: %v", err)
	}
	rows := []DailyRow{
		{
			Timestamp: time.Date(2024, 1, 2, 16, 0, 0, 0, time.FixedZone("EST", -5*60*60)),
			Symbol:    "AAPL",
			AssetType: "Stock",
			Open:      189.12,
			High:      191.02,
			Low:       188.54,
			Close:     190.85,
			Volume:    1000,
		},
		{
			Timestamp: time.Date(2024, 1, 2, 16, 0, 0, 0, time.FixedZone("EST", -5*60*60)),
			Symbol:    "SPY",
			AssetType: "ETF",
			Open:      0.000023,
			High:      0.000024,
			Low:       0.000021,
			Close:     0.000023,
			Volume:    55,
		},
	}
	if err := writeFixture(filePath, rows); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	readRows, err := ReadRows(filePath)
	if err != nil {
		t.Fatalf("read rows: %v", err)
	}
	if len(readRows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(readRows))
	}
	assetType, ok := NormalizeAssetType(readRows[0].AssetType)
	if !ok || assetType != "STOCK" {
		t.Fatalf("expected STOCK mapping, got %q (ok=%v)", assetType, ok)
	}
	fundType, ok := NormalizeAssetType(readRows[1].AssetType)
	if !ok || fundType != "FUND" {
		t.Fatalf("expected ETF->FUND mapping, got %q (ok=%v)", fundType, ok)
	}
	day := NormalizeUTCDailyTimestamp(readRows[0].Timestamp)
	if day.Format(time.RFC3339) != "2024-01-02T00:00:00Z" {
		t.Fatalf("expected UTC day boundary timestamp, got %s", day.Format(time.RFC3339))
	}
	dec, err := DecimalFromFloat64(readRows[1].Close)
	if err != nil {
		t.Fatalf("decimal conversion failed: %v", err)
	}
	if dec.String() != "0.000023" {
		t.Fatalf("expected tiny decimal precision, got %s", dec.String())
	}
}

func TestDatePayloadParsingAndFiltering(t *testing.T) {
	raw, err := json.Marshal(map[string]any{
		"dates": []string{"2024-01-03", "2024-01-02"},
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	dateStrings, err := parseDateListPayload(raw)
	if err != nil {
		t.Fatalf("parse date payload: %v", err)
	}
	if len(dateStrings) != 2 {
		t.Fatalf("expected 2 date strings, got %d", len(dateStrings))
	}
	dates := []time.Time{
		time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
		time.Date(2024, 1, 3, 0, 0, 0, 0, time.UTC),
	}
	filtered := FilterByDateRange(dates, time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC), time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC))
	if len(filtered) != 1 || filtered[0].Format(time.DateOnly) != "2024-01-02" {
		t.Fatalf("expected filtered single date 2024-01-02, got %v", filtered)
	}
}

func TestDownloadPayloadAndAtomicWrite(t *testing.T) {
	raw, err := json.Marshal(map[string]any{
		"download_url": "https://example.test/file.parquet",
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	url, err := parseDownloadURLPayload(raw)
	if err != nil {
		t.Fatalf("parse download url payload: %v", err)
	}
	if url != "https://example.test/file.parquet" {
		t.Fatalf("unexpected download url %q", url)
	}
	fixturePayload := []byte("PAR1fixture")
	targetPath := filepath.Join(t.TempDir(), "2024-01-02.parquet")
	if err := writeFileAtomically(targetPath, fixturePayload); err != nil {
		t.Fatalf("atomic write failed: %v", err)
	}
	data, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read downloaded file: %v", err)
	}
	if string(data) != string(fixturePayload) {
		t.Fatalf("unexpected downloaded payload")
	}
}

func writeFixture(path string, rows []DailyRow) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	writer := parquet.NewGenericWriter[DailyRow](file)
	if _, err := writer.Write(rows); err != nil {
		_ = writer.Close()
		return err
	}
	return writer.Close()
}
