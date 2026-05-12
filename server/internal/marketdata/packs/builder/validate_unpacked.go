package builder

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"sigma_finance/internal/marketdata/packs/sources"
	packservice "sigma_finance/internal/service/marketdata/packs"

	"github.com/parquet-go/parquet-go"
)

type UnpackedValidationSummary struct {
	RowsCount   int64
	AssetsCount int64
	FilesCount  int
}

type validationCoverage struct {
	FirstDate time.Time
	LastDate  time.Time
	RowCount  int64
}

type packCandleParquetRow struct {
	InstrumentID  string    `parquet:"instrument_id,uuid"`
	Symbol        string    `parquet:"symbol"`
	AssetType     string    `parquet:"asset_type"`
	Interval      string    `parquet:"interval"`
	Timestamp     time.Time `parquet:"timestamp,timestamp(microsecond)"`
	Open          []byte    `parquet:"open"`
	High          []byte    `parquet:"high"`
	Low           []byte    `parquet:"low"`
	Close         []byte    `parquet:"close"`
	AdjustedClose []byte    `parquet:"adjusted_close,optional"`
	Volume        []byte    `parquet:"volume"`
	QuoteCurrency string    `parquet:"quote_currency"`
	Source        string    `parquet:"source"`
}

func ValidateUnpackedPack(path string) (*UnpackedValidationSummary, error) {
	root := filepath.Clean(strings.TrimSpace(path))
	if root == "" {
		return nil, fmt.Errorf("path is required")
	}
	info, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("path must be a directory")
	}

	checksumsPath := filepath.Join(root, "checksums.sha256")
	if _, err := os.Stat(checksumsPath); err != nil {
		return nil, fmt.Errorf("checksums.sha256 is required")
	}

	manifest, err := packservice.LoadManifest(root)
	if err != nil {
		return nil, err
	}
	if err := packservice.ValidateManifest(manifest, "0.0.0"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(manifest.DataLicense) == "" {
		return nil, fmt.Errorf("manifest data_license is required")
	}
	if strings.TrimSpace(manifest.LicenseURL) == "" {
		return nil, fmt.Errorf("manifest license_url is required")
	}
	if err := packservice.ValidatePackChecksums(root, manifest); err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, manifest.RowsCount)
	coverageActual := make(map[string]validationCoverage, len(manifest.Coverage))
	coverageBySymbol := make(map[string]validationCoverage, len(manifest.Coverage))
	totalRows := int64(0)

	for _, fileMeta := range manifest.Files {
		if !strings.HasSuffix(strings.ToLower(fileMeta.Path), ".parquet") {
			return nil, fmt.Errorf("manifest file path must be parquet: %s", fileMeta.Path)
		}
		fullPath := filepath.Join(root, filepath.FromSlash(filepath.Clean(fileMeta.Path)))
		if err := validateParquetSchema(fullPath); err != nil {
			return nil, err
		}
		rows, err := parquet.ReadFile[packCandleParquetRow](fullPath)
		if err != nil {
			return nil, fmt.Errorf("read parquet %s: %w", fileMeta.Path, err)
		}
		if fileMeta.Rows != int64(len(rows)) {
			return nil, fmt.Errorf("manifest row count mismatch for %s", fileMeta.Path)
		}
		totalRows += int64(len(rows))
		for _, row := range rows {
			key := sources.CanonicalKey(sources.NormalizedCandle{
				InstrumentID:  row.InstrumentID,
				Interval:      row.Interval,
				Timestamp:     row.Timestamp,
				QuoteCurrency: row.QuoteCurrency,
			})
			if _, exists := seen[key]; exists {
				return nil, fmt.Errorf("duplicate canonical candle key %s", key)
			}
			seen[key] = struct{}{}

			coverageKey := fmt.Sprintf("%s|%s|%s", row.InstrumentID, row.Interval, strings.ToUpper(row.QuoteCurrency))
			symbolKey := fmt.Sprintf("%s|%s|%s", row.Symbol, row.Interval, strings.ToUpper(row.QuoteCurrency))
			current, exists := coverageActual[coverageKey]
			if !exists {
				current = validationCoverage{FirstDate: row.Timestamp.UTC(), LastDate: row.Timestamp.UTC(), RowCount: 0}
			}
			if row.Timestamp.Before(current.FirstDate) {
				current.FirstDate = row.Timestamp.UTC()
			}
			if row.Timestamp.After(current.LastDate) {
				current.LastDate = row.Timestamp.UTC()
			}
			current.RowCount++
			coverageActual[coverageKey] = current
			coverageBySymbol[symbolKey] = current
		}
	}

	if totalRows != manifest.RowsCount {
		return nil, fmt.Errorf("manifest rows_count mismatch")
	}
	if int64(len(manifest.Coverage)) != manifest.AssetsCount {
		return nil, fmt.Errorf("manifest assets_count mismatch")
	}

	for _, cov := range manifest.Coverage {
		key := fmt.Sprintf("%s|%s|%s", cov.InstrumentID, cov.Interval, strings.ToUpper(cov.QuoteCurrency))
		actual, exists := coverageActual[key]
		if !exists {
			symbolKey := fmt.Sprintf("%s|%s|%s", cov.Symbol, cov.Interval, strings.ToUpper(cov.QuoteCurrency))
			actual, exists = coverageBySymbol[symbolKey]
		}
		if !exists {
			return nil, fmt.Errorf("coverage missing for %s", key)
		}
		if actual.RowCount != cov.RowCount {
			return nil, fmt.Errorf("coverage row_count mismatch for %s", key)
		}
		if actual.FirstDate.UTC().Format(time.DateOnly) != cov.FirstDate {
			return nil, fmt.Errorf("coverage first_date mismatch for %s", key)
		}
		if actual.LastDate.UTC().Format(time.DateOnly) != cov.LastDate {
			return nil, fmt.Errorf("coverage last_date mismatch for %s", key)
		}
	}

	return &UnpackedValidationSummary{
		RowsCount:   totalRows,
		AssetsCount: manifest.AssetsCount,
		FilesCount:  len(manifest.Files),
	}, nil
}

func validateParquetSchema(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		return err
	}
	parquetFile, err := parquet.OpenFile(file, stat.Size())
	if err != nil {
		return err
	}
	root := parquetFile.Root()
	if err := assertDecimalColumn(root, "open", 18); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	if err := assertDecimalColumn(root, "high", 18); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	if err := assertDecimalColumn(root, "low", 18); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	if err := assertDecimalColumn(root, "close", 18); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	if err := assertDecimalColumn(root, "volume", 8); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	if column := root.Column("adjusted_close"); column != nil {
		if err := assertDecimalType(column, 18); err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
	}
	return nil
}

func assertDecimalColumn(root *parquet.Column, name string, scale int32) error {
	column := root.Column(name)
	if column == nil {
		return fmt.Errorf("missing column %s", name)
	}
	return assertDecimalType(column, scale)
}

func assertDecimalType(column *parquet.Column, scale int32) error {
	typ := column.Type()
	if typ == nil {
		return fmt.Errorf("column %s type is nil", column.Name())
	}
	if typ.Kind() == parquet.Float || typ.Kind() == parquet.Double {
		return fmt.Errorf("column %s uses float type", column.Name())
	}
	logicalType := typ.LogicalType()
	if logicalType == nil || logicalType.Decimal == nil {
		return fmt.Errorf("column %s missing decimal logical type", column.Name())
	}
	if logicalType.Decimal.Precision != 38 || logicalType.Decimal.Scale != scale {
		return fmt.Errorf("column %s has unexpected decimal(%d,%d)", column.Name(), logicalType.Decimal.Precision, logicalType.Decimal.Scale)
	}
	return nil
}
