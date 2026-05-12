package packs

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"

	pq "github.com/parquet-go/parquet-go"
	pqzstd "github.com/parquet-go/parquet-go/compress/zstd"
	"github.com/shopspring/decimal"
)

const (
	localPriceScale        int32 = 18
	localVolumeScale       int32 = 8
	localMaxPrecision            = 38
	localDecimalFixedBytes       = 16
)

type localBuildWriteOptions struct {
	RootDir     string
	PartitionBy []string
	Manifest    Manifest
}

type localBuildWriteResult struct {
	PackDir       string
	Manifest      *Manifest
	ManifestPath  string
	ChecksumsPath string
}

type localBuildParquetRow struct {
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

type localCoverageKey struct {
	InstrumentID  string
	Interval      string
	QuoteCurrency string
}

type localCoverageAccumulator struct {
	InstrumentID  string
	Symbol        string
	AssetType     string
	Interval      string
	QuoteCurrency string
	Source        string
	FirstDate     time.Time
	LastDate      time.Time
	RowCount      int64
	FilePaths     map[string]struct{}
}

func buildLocalUnpackedDirectory(ctx context.Context, candles []sources.NormalizedCandle, options localBuildWriteOptions) (*localBuildWriteResult, error) {
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
		return nil, err
	}

	sorted := append([]sources.NormalizedCandle(nil), candles...)
	sort.Slice(sorted, func(i, j int) bool { return localCanonicalLess(sorted[i], sorted[j]) })

	partitionRows := make(map[string][]localBuildParquetRow, 64)
	coverage := make(map[localCoverageKey]*localCoverageAccumulator, 256)
	seen := make(map[string]struct{}, len(sorted))
	assetTypes := make(map[string]struct{}, 8)
	quoteCurrencies := make(map[string]struct{}, 8)

	for _, candle := range sorted {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		key := sources.CanonicalKey(candle)
		if _, exists := seen[key]; exists {
			return nil, fmt.Errorf("duplicate canonical candle key %s", key)
		}
		seen[key] = struct{}{}
		row, err := toLocalParquetRow(candle)
		if err != nil {
			return nil, err
		}
		partitionDir, err := localPartitionPath(candle, options.PartitionBy)
		if err != nil {
			return nil, err
		}
		relPath := filepath.ToSlash(filepath.Join("data", partitionDir, "part-000.parquet"))
		partitionRows[relPath] = append(partitionRows[relPath], row)
		accumulateLocalCoverage(coverage, candle, relPath)
		assetTypes[strings.TrimSpace(candle.AssetType)] = struct{}{}
		quoteCurrencies[strings.ToUpper(strings.TrimSpace(candle.QuoteCurrency))] = struct{}{}
	}

	filePaths := make([]string, 0, len(partitionRows))
	for rel := range partitionRows {
		filePaths = append(filePaths, rel)
	}
	sort.Strings(filePaths)

	manifest := options.Manifest
	manifest.Files = make([]ManifestFile, 0, len(filePaths)+1)
	totalRows := int64(0)
	for _, relPath := range filePaths {
		rows := partitionRows[relPath]
		if len(rows) == 0 {
			continue
		}
		fullPath := filepath.Join(packDir, filepath.FromSlash(relPath))
		if err := writeLocalParquetFile(fullPath, rows); err != nil {
			return nil, err
		}
		sum, err := sha256FileHex(fullPath)
		if err != nil {
			return nil, err
		}
		manifest.Files = append(manifest.Files, ManifestFile{
			Path:     relPath,
			Rows:     int64(len(rows)),
			Checksum: sum,
		})
		totalRows += int64(len(rows))
	}

	manifest.RowsCount = totalRows
	manifest.AssetsCount = int64(len(coverage))
	manifest.AssetTypes = localSortedKeys(assetTypes)
	manifest.QuoteCurrencies = localSortedKeys(quoteCurrencies)
	manifest.Coverage = localCoverageManifest(coverage)

	manifestPath := filepath.Join(packDir, "manifest.json")
	if err := writeLocalManifest(manifestPath, &manifest); err != nil {
		return nil, err
	}
	manifestSum, err := sha256FileHex(manifestPath)
	if err != nil {
		return nil, err
	}
	checksumsPath := filepath.Join(packDir, "checksums.sha256")
	if err := writeLocalChecksumsFile(checksumsPath, &manifest, manifestSum); err != nil {
		return nil, err
	}

	return &localBuildWriteResult{
		PackDir:       packDir,
		Manifest:      &manifest,
		ManifestPath:  manifestPath,
		ChecksumsPath: checksumsPath,
	}, nil
}

func writeLocalParquetFile(path string, rows []localBuildParquetRow) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	writer := pq.NewGenericWriter[localBuildParquetRow](file, pq.Compression(&pqzstd.Codec{}))
	if _, err := writer.Write(rows); err != nil {
		_ = writer.Close()
		return err
	}
	return writer.Close()
}

func toLocalParquetRow(candle sources.NormalizedCandle) (localBuildParquetRow, error) {
	open, err := encodeLocalDecimal(candle.Open, localPriceScale, localMaxPrecision, localDecimalFixedBytes)
	if err != nil {
		return localBuildParquetRow{}, err
	}
	high, err := encodeLocalDecimal(candle.High, localPriceScale, localMaxPrecision, localDecimalFixedBytes)
	if err != nil {
		return localBuildParquetRow{}, err
	}
	low, err := encodeLocalDecimal(candle.Low, localPriceScale, localMaxPrecision, localDecimalFixedBytes)
	if err != nil {
		return localBuildParquetRow{}, err
	}
	closeValue, err := encodeLocalDecimal(candle.Close, localPriceScale, localMaxPrecision, localDecimalFixedBytes)
	if err != nil {
		return localBuildParquetRow{}, err
	}
	volume, err := encodeLocalDecimal(candle.Volume, localVolumeScale, localMaxPrecision, localDecimalFixedBytes)
	if err != nil {
		return localBuildParquetRow{}, err
	}
	var adjusted []byte
	if candle.AdjustedClose != nil {
		adjusted, err = encodeLocalDecimal(*candle.AdjustedClose, localPriceScale, localMaxPrecision, localDecimalFixedBytes)
		if err != nil {
			return localBuildParquetRow{}, err
		}
	}
	return localBuildParquetRow{
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

func encodeLocalDecimal(value decimal.Decimal, scale int32, precision int, size int) ([]byte, error) {
	scaled := value.Shift(scale)
	if !scaled.IsInteger() {
		return nil, fmt.Errorf("value %s has too many fractional digits", value.String())
	}
	unscaled := scaled.BigInt()
	if localDigitsCount(unscaled) > precision {
		return nil, fmt.Errorf("value %s exceeds precision", value.String())
	}
	bits := uint(size * 8)
	maxPositive := new(big.Int).Lsh(big.NewInt(1), bits-1)
	maxPositive.Sub(maxPositive, big.NewInt(1))
	minNegative := new(big.Int).Lsh(big.NewInt(1), bits-1)
	minNegative.Neg(minNegative)
	if unscaled.Cmp(maxPositive) > 0 || unscaled.Cmp(minNegative) < 0 {
		return nil, fmt.Errorf("value %s out of range", value.String())
	}
	if unscaled.Sign() >= 0 {
		out := make([]byte, size)
		unscaled.FillBytes(out)
		return out, nil
	}
	modulus := new(big.Int).Lsh(big.NewInt(1), bits)
	twos := new(big.Int).Add(modulus, unscaled)
	out := make([]byte, size)
	twos.FillBytes(out)
	return out, nil
}

func localDigitsCount(value *big.Int) int {
	if value.Sign() == 0 {
		return 1
	}
	return len(new(big.Int).Abs(value).String())
}

func localPartitionPath(candle sources.NormalizedCandle, partitionBy []string) (string, error) {
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
		default:
			return "", fmt.Errorf("unsupported partition key %q", raw)
		}
	}
	return filepath.Join(parts...), nil
}

func accumulateLocalCoverage(coverage map[localCoverageKey]*localCoverageAccumulator, candle sources.NormalizedCandle, relPath string) {
	key := localCoverageKey{
		InstrumentID:  strings.TrimSpace(candle.InstrumentID),
		Interval:      strings.TrimSpace(candle.Interval),
		QuoteCurrency: strings.ToUpper(strings.TrimSpace(candle.QuoteCurrency)),
	}
	entry, exists := coverage[key]
	if !exists {
		entry = &localCoverageAccumulator{
			InstrumentID:  key.InstrumentID,
			Symbol:        strings.TrimSpace(candle.Symbol),
			AssetType:     strings.TrimSpace(candle.AssetType),
			Interval:      key.Interval,
			QuoteCurrency: key.QuoteCurrency,
			Source:        strings.TrimSpace(candle.Source),
			FirstDate:     candle.Timestamp.UTC(),
			LastDate:      candle.Timestamp.UTC(),
			FilePaths:     make(map[string]struct{}, 2),
		}
		coverage[key] = entry
	}
	ts := candle.Timestamp.UTC()
	if ts.Before(entry.FirstDate) {
		entry.FirstDate = ts
	}
	if ts.After(entry.LastDate) {
		entry.LastDate = ts
	}
	entry.RowCount++
	entry.FilePaths[relPath] = struct{}{}
}

func localCoverageManifest(raw map[localCoverageKey]*localCoverageAccumulator) []ManifestCoverage {
	out := make([]ManifestCoverage, 0, len(raw))
	for _, item := range raw {
		paths := make([]string, 0, len(item.FilePaths))
		for filePath := range item.FilePaths {
			paths = append(paths, filePath)
		}
		sort.Strings(paths)
		out = append(out, ManifestCoverage{
			InstrumentID:  item.InstrumentID,
			Symbol:        item.Symbol,
			AssetType:     item.AssetType,
			Interval:      item.Interval,
			QuoteCurrency: item.QuoteCurrency,
			Source:        item.Source,
			FirstDate:     item.FirstDate.UTC().Format(time.DateOnly),
			LastDate:      item.LastDate.UTC().Format(time.DateOnly),
			RowCount:      item.RowCount,
			FilePaths:     paths,
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

func writeLocalManifest(path string, manifest *Manifest) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(manifest)
}

func writeLocalChecksumsFile(path string, manifest *Manifest, manifestChecksum string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	for _, entry := range manifest.Files {
		if _, err := fmt.Fprintf(file, "%s  %s\n", strings.ToLower(strings.TrimSpace(entry.Checksum)), filepath.ToSlash(entry.Path)); err != nil {
			return err
		}
	}
	_, err = fmt.Fprintf(file, "%s  manifest.json\n", strings.ToLower(strings.TrimSpace(manifestChecksum)))
	return err
}

func localCanonicalLess(a, b sources.NormalizedCandle) bool {
	if strings.TrimSpace(a.InstrumentID) != strings.TrimSpace(b.InstrumentID) {
		return strings.TrimSpace(a.InstrumentID) < strings.TrimSpace(b.InstrumentID)
	}
	if strings.TrimSpace(a.Interval) != strings.TrimSpace(b.Interval) {
		return strings.TrimSpace(a.Interval) < strings.TrimSpace(b.Interval)
	}
	if !a.Timestamp.Equal(b.Timestamp) {
		return a.Timestamp.Before(b.Timestamp)
	}
	if strings.ToUpper(strings.TrimSpace(a.QuoteCurrency)) != strings.ToUpper(strings.TrimSpace(b.QuoteCurrency)) {
		return strings.ToUpper(strings.TrimSpace(a.QuoteCurrency)) < strings.ToUpper(strings.TrimSpace(b.QuoteCurrency))
	}
	return strings.TrimSpace(a.Symbol) < strings.TrimSpace(b.Symbol)
}

func localSortedKeys(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for key := range set {
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}
