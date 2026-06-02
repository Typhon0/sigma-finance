package parquet

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	packservice "sigma_finance/internal/service/marketdata/packs"

	pq "github.com/parquet-go/parquet-go"
	pqzstd "github.com/parquet-go/parquet-go/compress/zstd"
	"github.com/shopspring/decimal"
)

const (
	priceScale              int32 = 18
	volumeScale             int32 = 8
	maxPrecision                  = 38
	decimalFixedLengthBytes       = 16
)

type BuildOptions struct {
	RootDir     string
	PartitionBy []string
	Manifest    packservice.Manifest
}

type BuildResult struct {
	PackDir       string
	Manifest      *packservice.Manifest
	ManifestPath  string
	ChecksumsPath string
}

type parquetCandleRow struct {
	InstrumentID  string    `parquet:"instrument_id,uuid"`
	Symbol        string    `parquet:"symbol"`
	AssetType     string    `parquet:"asset_type"`
	Interval      string    `parquet:"interval"`
	Timestamp     time.Time `parquet:"timestamp,timestamp(microsecond)"`
	Open          []byte    `parquet:"open,decimal(18:38)"`
	High          []byte    `parquet:"high,decimal(18:38)"`
	Low           []byte    `parquet:"low,decimal(18:38)"`
	Close         []byte    `parquet:"close,decimal(18:38)"`
	AdjustedClose []byte    `parquet:"adjusted_close,decimal(18:38),optional"`
	Volume        []byte    `parquet:"volume,decimal(8:38)"`
	QuoteCurrency string    `parquet:"quote_currency"`
	Source        string    `parquet:"source"`
}

type coverageKey struct {
	InstrumentID  string
	Interval      string
	QuoteCurrency string
}

type coverageAccumulator struct {
	InstrumentID   string
	Symbol         string
	AssetType      string
	Interval       string
	QuoteCurrency  string
	Source         string
	DerivationType string
	DerivedFrom    map[string]struct{}
	FirstDate      time.Time
	LastDate       time.Time
	RowCount       int64
	FilePaths      map[string]struct{}
}

func BuildUnpackedDirectory(ctx context.Context, candles []sources.NormalizedCandle, options BuildOptions) (*BuildResult, error) {
	rootDir := strings.TrimSpace(options.RootDir)
	if rootDir == "" {
		return nil, fmt.Errorf("root dir is required")
	}
	if strings.TrimSpace(options.Manifest.PackID) == "" {
		return nil, fmt.Errorf("manifest pack_id is required")
	}
	if len(options.PartitionBy) == 0 {
		return nil, fmt.Errorf("partition_by is required")
	}

	packDir := filepath.Join(rootDir, "packs", options.Manifest.PackID)
	if err := os.MkdirAll(packDir, 0o755); err != nil {
		return nil, fmt.Errorf("create pack dir: %w", err)
	}

	sort.Slice(candles, func(i, j int) bool {
		return canonicalLess(candles[i], candles[j])
	})

	partitionIndices := make(map[string][]int, 64)
	coverage := make(map[coverageKey]*coverageAccumulator, 256)
	assetTypes := make(map[string]struct{}, 8)
	quoteCurrencies := make(map[string]struct{}, 8)

	for i, candle := range candles {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Adjacent duplicate checking (avoids storing millions of strings in a separate map)
		if i > 0 {
			prevKey := sources.CanonicalKey(candles[i-1])
			currKey := sources.CanonicalKey(candle)
			if prevKey == currKey {
				return nil, fmt.Errorf("duplicate canonical candle key %s", currKey)
			}
		}

		partitionDir, err := partitionPath(candle, options.PartitionBy)
		if err != nil {
			return nil, err
		}
		relPath := filepath.ToSlash(filepath.Join("data", partitionDir, "part-000.parquet"))
		partitionIndices[relPath] = append(partitionIndices[relPath], i)
		accumulateCoverage(coverage, candle, relPath)
		assetTypes[strings.TrimSpace(candle.AssetType)] = struct{}{}
		quoteCurrencies[strings.ToUpper(strings.TrimSpace(candle.QuoteCurrency))] = struct{}{}
	}

	filePaths := make([]string, 0, len(partitionIndices))
	for relPath := range partitionIndices {
		filePaths = append(filePaths, relPath)
	}
	sort.Strings(filePaths)

	manifest := options.Manifest
	manifest.Files = make([]packservice.ManifestFile, 0, len(filePaths)+1)
	totalRows := int64(0)
	for _, relPath := range filePaths {
		indices := partitionIndices[relPath]
		if len(indices) == 0 {
			continue
		}
		// Convert candles to parquetCandleRows on the fly for only the active partition
		rows := make([]parquetCandleRow, len(indices))
		for k, idx := range indices {
			row, err := toParquetRow(candles[idx])
			if err != nil {
				return nil, err
			}
			rows[k] = row
		}
		if err := writeParquetFile(filepath.Join(packDir, filepath.FromSlash(relPath)), rows); err != nil {
			return nil, err
		}
		sum, err := Sha256FileHex(filepath.Join(packDir, filepath.FromSlash(relPath)))
		if err != nil {
			return nil, err
		}
		manifest.Files = append(manifest.Files, packservice.ManifestFile{
			Path:     relPath,
			Rows:     int64(len(rows)),
			Checksum: sum,
		})
		totalRows += int64(len(rows))
	}

	manifest.RowsCount = totalRows
	manifest.AssetsCount = int64(len(coverage))
	manifest.AssetTypes = keysSorted(assetTypes)
	manifest.QuoteCurrencies = keysSorted(quoteCurrencies)
	manifest.Coverage = coverageManifest(coverage)
	if manifest.GeneratedAt.IsZero() {
		manifest.GeneratedAt = time.Now().UTC()
	}
	if manifest.CreatedAt.IsZero() {
		manifest.CreatedAt = manifest.GeneratedAt
	}
	if manifest.Description == "" {
		manifest.Description = manifest.Name
	}

	manifestPath := filepath.Join(packDir, "manifest.json")
	if err := WriteManifest(manifestPath, &manifest); err != nil {
		return nil, err
	}
	manifestSum, err := Sha256FileHex(manifestPath)
	if err != nil {
		return nil, err
	}

	checksumsPath := filepath.Join(packDir, "checksums.sha256")
	if err := WriteChecksumsFile(checksumsPath, &manifest, manifestSum); err != nil {
		return nil, err
	}

	return &BuildResult{
		PackDir:       packDir,
		Manifest:      &manifest,
		ManifestPath:  manifestPath,
		ChecksumsPath: checksumsPath,
	}, nil
}

func writeParquetFile(path string, rows []parquetCandleRow) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create parquet dir: %w", err)
	}
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create parquet file: %w", err)
	}
	defer file.Close()

	writer := pq.NewGenericWriter[parquetCandleRow](file, pq.Compression(&pqzstd.Codec{}))
	if _, err := writer.Write(rows); err != nil {
		_ = writer.Close()
		return fmt.Errorf("write parquet rows: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close parquet writer: %w", err)
	}
	return nil
}

func toParquetRow(candle sources.NormalizedCandle) (parquetCandleRow, error) {
	open, err := encodeDecimalFixed(candle.Open, priceScale, maxPrecision, decimalFixedLengthBytes)
	if err != nil {
		return parquetCandleRow{}, fmt.Errorf("encode open for %s: %w", candle.Symbol, err)
	}
	high, err := encodeDecimalFixed(candle.High, priceScale, maxPrecision, decimalFixedLengthBytes)
	if err != nil {
		return parquetCandleRow{}, fmt.Errorf("encode high for %s: %w", candle.Symbol, err)
	}
	low, err := encodeDecimalFixed(candle.Low, priceScale, maxPrecision, decimalFixedLengthBytes)
	if err != nil {
		return parquetCandleRow{}, fmt.Errorf("encode low for %s: %w", candle.Symbol, err)
	}
	closeValue, err := encodeDecimalFixed(candle.Close, priceScale, maxPrecision, decimalFixedLengthBytes)
	if err != nil {
		return parquetCandleRow{}, fmt.Errorf("encode close for %s: %w", candle.Symbol, err)
	}
	volume, err := encodeDecimalFixed(candle.Volume, volumeScale, maxPrecision, decimalFixedLengthBytes)
	if err != nil {
		return parquetCandleRow{}, fmt.Errorf("encode volume for %s: %w", candle.Symbol, err)
	}

	var adjusted []byte
	if candle.AdjustedClose != nil {
		value, err := encodeDecimalFixed(*candle.AdjustedClose, priceScale, maxPrecision, decimalFixedLengthBytes)
		if err != nil {
			return parquetCandleRow{}, fmt.Errorf("encode adjusted_close for %s: %w", candle.Symbol, err)
		}
		adjusted = value
	}

	return parquetCandleRow{
		InstrumentID:  strings.TrimSpace(candle.InstrumentID),
		Symbol:        strings.TrimSpace(candle.Symbol),
		AssetType:     strings.TrimSpace(candle.AssetType),
		Interval:      strings.TrimSpace(candle.Interval),
		Timestamp:     candle.Timestamp.UTC(),
		Open:          open,
		High:          high,
		Low:           low,
		Close:         closeValue,
		AdjustedClose: adjusted,
		Volume:        volume,
		QuoteCurrency: strings.ToUpper(strings.TrimSpace(candle.QuoteCurrency)),
		Source:        strings.TrimSpace(candle.Source),
	}, nil
}

func encodeDecimalFixed(value decimal.Decimal, scale int32, precision int, size int) ([]byte, error) {
	scaled := value.Shift(scale)
	if !scaled.IsInteger() {
		return nil, fmt.Errorf("value %s has more than %d fractional digits", value.String(), scale)
	}
	unscaled := scaled.BigInt()
	if digitsCount(unscaled) > precision {
		return nil, fmt.Errorf("value %s exceeds decimal(%d,%d) precision", value.String(), precision, scale)
	}

	bits := uint(size * 8)
	maxPositive := new(big.Int).Lsh(big.NewInt(1), bits-1)
	maxPositive.Sub(maxPositive, big.NewInt(1))
	minNegative := new(big.Int).Lsh(big.NewInt(1), bits-1)
	minNegative.Neg(minNegative)
	if unscaled.Cmp(maxPositive) > 0 || unscaled.Cmp(minNegative) < 0 {
		return nil, fmt.Errorf("value %s out of range for %d-byte two's complement", value.String(), size)
	}

	if unscaled.Sign() >= 0 {
		out := make([]byte, size)
		unscaled.FillBytes(out)
		return out, nil
	}

	modulus := new(big.Int).Lsh(big.NewInt(1), bits)
	twos := new(big.Int).Add(modulus, unscaled)
	if twos.Sign() < 0 {
		return nil, fmt.Errorf("invalid negative value %s", value.String())
	}
	out := make([]byte, size)
	twos.FillBytes(out)
	return out, nil
}

func digitsCount(value *big.Int) int {
	if value.Sign() == 0 {
		return 1
	}
	return len(new(big.Int).Abs(value).String())
}

func partitionPath(candle sources.NormalizedCandle, partitionBy []string) (string, error) {
	parts := make([]string, 0, len(partitionBy))
	for _, raw := range partitionBy {
		key := strings.ToLower(strings.TrimSpace(raw))
		switch key {
		case "asset_type":
			parts = append(parts, "asset_type="+strings.TrimSpace(candle.AssetType))
		case "quote_currency":
			parts = append(parts, "quote_currency="+strings.ToUpper(strings.TrimSpace(candle.QuoteCurrency)))
		case "year":
			parts = append(parts, fmt.Sprintf("year=%04d", candle.Timestamp.UTC().Year()))
		case "interval":
			parts = append(parts, "interval="+strings.TrimSpace(candle.Interval))
		default:
			return "", fmt.Errorf("unsupported partition key %q", raw)
		}
	}
	return filepath.Join(parts...), nil
}

func coverageManifest(raw map[coverageKey]*coverageAccumulator) []packservice.ManifestCoverage {
	out := make([]packservice.ManifestCoverage, 0, len(raw))
	for _, item := range raw {
		paths := make([]string, 0, len(item.FilePaths))
		for filePath := range item.FilePaths {
			paths = append(paths, filePath)
		}
		sort.Strings(paths)
		out = append(out, packservice.ManifestCoverage{
			InstrumentID:   item.InstrumentID,
			Symbol:         item.Symbol,
			AssetType:      item.AssetType,
			Interval:       item.Interval,
			QuoteCurrency:  item.QuoteCurrency,
			Source:         item.Source,
			DerivationType: item.DerivationType,
			DerivedFrom:    sortedKeys(item.DerivedFrom),
			FirstDate:      item.FirstDate.UTC().Format(time.DateOnly),
			LastDate:       item.LastDate.UTC().Format(time.DateOnly),
			RowCount:       item.RowCount,
			FilePaths:      paths,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].InstrumentID != out[j].InstrumentID {
			return out[i].InstrumentID < out[j].InstrumentID
		}
		if out[i].Interval != out[j].Interval {
			return out[i].Interval < out[j].Interval
		}
		return out[i].QuoteCurrency < out[j].QuoteCurrency
	})
	return out
}

func accumulateCoverage(coverage map[coverageKey]*coverageAccumulator, candle sources.NormalizedCandle, filePath string) {
	key := coverageKey{
		InstrumentID:  strings.TrimSpace(candle.InstrumentID),
		Interval:      strings.TrimSpace(candle.Interval),
		QuoteCurrency: strings.ToUpper(strings.TrimSpace(candle.QuoteCurrency)),
	}
	item, exists := coverage[key]
	if !exists {
		item = &coverageAccumulator{
			InstrumentID:   key.InstrumentID,
			Symbol:         strings.TrimSpace(candle.Symbol),
			AssetType:      strings.TrimSpace(candle.AssetType),
			Interval:       key.Interval,
			QuoteCurrency:  key.QuoteCurrency,
			Source:         strings.TrimSpace(candle.Source),
			DerivationType: strings.TrimSpace(candle.DerivationType),
			DerivedFrom:    make(map[string]struct{}, len(candle.DerivedFrom)),
			FirstDate:      candle.Timestamp.UTC(),
			LastDate:       candle.Timestamp.UTC(),
			FilePaths:      map[string]struct{}{filePath: {}},
		}
		for _, dep := range candle.DerivedFrom {
			cleaned := strings.TrimSpace(dep)
			if cleaned != "" {
				item.DerivedFrom[cleaned] = struct{}{}
			}
		}
		coverage[key] = item
	}
	if item.Source == "" {
		item.Source = strings.TrimSpace(candle.Source)
	}
	if item.DerivationType == "" {
		item.DerivationType = strings.TrimSpace(candle.DerivationType)
	}
	for _, dep := range candle.DerivedFrom {
		cleaned := strings.TrimSpace(dep)
		if cleaned != "" {
			item.DerivedFrom[cleaned] = struct{}{}
		}
	}
	if candle.Timestamp.Before(item.FirstDate) {
		item.FirstDate = candle.Timestamp.UTC()
	}
	if candle.Timestamp.After(item.LastDate) {
		item.LastDate = candle.Timestamp.UTC()
	}
	item.RowCount++
	item.FilePaths[filePath] = struct{}{}
}

func WriteManifest(path string, manifest *packservice.Manifest) error {
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create manifest: %w", err)
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(manifest); err != nil {
		return fmt.Errorf("encode manifest: %w", err)
	}
	return nil
}

func WriteChecksumsFile(path string, manifest *packservice.Manifest, manifestChecksum string) error {
	lines := make([]string, 0, len(manifest.Files))
	for _, file := range manifest.Files {
		sum := strings.TrimSpace(strings.TrimPrefix(file.Checksum, "sha256:"))
		lines = append(lines, fmt.Sprintf("%s  %s", sum, file.Path))
	}
	lines = append(lines, fmt.Sprintf("%s  manifest.json", strings.TrimSpace(strings.TrimPrefix(manifestChecksum, "sha256:"))))
	sort.Strings(lines)
	body := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(path, []byte(body), 0o644)
}

func Sha256FileHex(path string) (string, error) {
	body, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:]), nil
}

func keysSorted(input map[string]struct{}) []string {
	out := make([]string, 0, len(input))
	for key := range input {
		if strings.TrimSpace(key) == "" {
			continue
		}
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}

func sortedKeys(input map[string]struct{}) []string {
	if len(input) == 0 {
		return nil
	}
	out := make([]string, 0, len(input))
	for key := range input {
		cleaned := strings.TrimSpace(key)
		if cleaned != "" {
			out = append(out, cleaned)
		}
	}
	sort.Strings(out)
	if len(out) == 0 {
		return nil
	}
	return out
}

func canonicalLess(a, b sources.NormalizedCandle) bool {
	aKey := sources.CanonicalKey(a)
	bKey := sources.CanonicalKey(b)
	if aKey == bKey {
		return strings.TrimSpace(a.Symbol) < strings.TrimSpace(b.Symbol)
	}
	return aKey < bKey
}
