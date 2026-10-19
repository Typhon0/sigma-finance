package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
	"sigma_finance/internal/domain/model"
)

type packCandleParquetRow struct {
	Symbol        string    `parquet:"symbol"`
	Timestamp     time.Time `parquet:"timestamp,timestamp(microsecond)"`
	Close         []byte    `parquet:"close"`
	QuoteCurrency string    `parquet:"quote_currency"`
	Source        string    `parquet:"source"`
}

func decimalFromParquetBytes(raw []byte, scale int32) decimal.Decimal {
	if len(raw) == 0 {
		return decimal.Zero
	}
	if len(raw) == 16 && raw[15] == 0 && raw[0] != 0 {
		reversed := make([]byte, len(raw))
		for i := range raw {
			reversed[len(raw)-1-i] = raw[i]
		}
		i := new(big.Int).SetBytes(reversed)
		return decimal.NewFromBigInt(i, -scale)
	}

	i := new(big.Int).SetBytes(raw)
	if raw[0]&0x80 != 0 {
		max := new(big.Int).Lsh(big.NewInt(1), uint(len(raw))*8)
		i.Sub(i, max)
	}
	return decimal.NewFromBigInt(i, -scale)
}

// ensureFXRatesTable creates the FX rates table when older environments are missing it.
// This keeps runtime conversion functional even if a historical migration state is inconsistent.
func ensureFXRatesTable(ctx context.Context, db bun.IDB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS sigma_finance.fx_rates (
			id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
			base_currency VARCHAR(3) NOT NULL,
			quote_currency VARCHAR(3) NOT NULL,
			rate DECIMAL(20, 10) NOT NULL,
			as_of TIMESTAMP NOT NULL,
			source VARCHAR(50) NOT NULL,
			granularity VARCHAR(20) NOT NULL,
			is_stale BOOLEAN DEFAULT FALSE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			UNIQUE (base_currency, quote_currency, as_of, granularity)
		);

		CREATE INDEX IF NOT EXISTS idx_fx_rates_currencies
			ON sigma_finance.fx_rates(base_currency, quote_currency);
		CREATE INDEX IF NOT EXISTS idx_fx_rates_as_of
			ON sigma_finance.fx_rates(as_of);
		CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_as_of
			ON sigma_finance.fx_rates(base_currency, quote_currency, as_of DESC);
		CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_granularity_as_of
			ON sigma_finance.fx_rates(base_currency, quote_currency, granularity, as_of DESC);
	`)
	if err != nil {
		return fmt.Errorf("ensure fx_rates table: %w", err)
	}
	return nil
}

// autoSeedFXFromPackOrProvider checks if historical daily rates prior to 2026 exist.
// If not, it attempts to load them from a local market data pack (offline, zero network calls).
// If no local pack is found, it performs a single batch range query from Frankfurter (10 years in 1 call).
func autoSeedFXFromPackOrProvider(ctx context.Context, db bun.IDB, packStoragePath string) error {
	var count int
	err := db.NewSelect().
		TableExpr("sigma_finance.fx_rates").
		Where("granularity = ?", model.FXRateGranularityDay).
		Where("as_of < ?", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)).
		Limit(1).
		Scan(ctx, &count)
	if err == nil && count > 0 {
		log.Printf("[INFO] [FXBootstrap] Historical daily FX rates already present in DB (found rows < 2026)")
		return nil
	}

	// Try local pack first (zero network calls, zero rate-limit usage)
	seeded, err := seedFromLocalPack(ctx, db, packStoragePath)
	if err == nil && seeded > 0 {
		log.Printf("[INFO] [FXBootstrap] Auto-seeded %d historical daily FX rates from local pack", seeded)
		return nil
	}
	if err != nil {
		log.Printf("[WARN] [FXBootstrap] Local pack seeding skipped or failed: %v", err)
	}

	// Fallback: single batch range query to Frankfurter (Cloudflare mirror of ECB, 1 request for 10 years)
	log.Printf("[INFO] [FXBootstrap] Falling back to Frankfurter single-batch fetch for 2017 to today...")
	seededOnline, err := seedFromFrankfurterBatch(ctx, db, time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC), time.Now().UTC())
	if err != nil {
		log.Printf("[ERROR] [FXBootstrap] Failed to seed from Frankfurter: %v", err)
		return err
	}
	log.Printf("[INFO] [FXBootstrap] Auto-seeded %d historical daily FX rates from Frankfurter API", seededOnline)
	return nil
}

func seedFromLocalPack(ctx context.Context, db bun.IDB, packStoragePath string) (int, error) {
	candidates := []string{
		packStoragePath,
		"data/market-data/packs",
		"/data/market-data/packs",
		filepath.Join("..", "data", "market-data", "packs"),
		filepath.Join("..", "..", "data", "market-data", "packs"),
	}

	var foundPackDir string
	for _, root := range candidates {
		if root == "" {
			continue
		}
		matches, err := filepath.Glob(filepath.Join(root, "fx-ecb-core-daily*"))
		if err == nil && len(matches) > 0 {
			for _, m := range matches {
				fi, err := os.Stat(m)
				if err == nil && fi.IsDir() {
					foundPackDir = m
					break
				}
			}
		}
		if foundPackDir != "" {
			break
		}
	}

	if foundPackDir == "" {
		return 0, fmt.Errorf("no fx-ecb-core-daily pack directory found in candidates")
	}

	dataDir := filepath.Join(foundPackDir, "data", "asset_type=FX")
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		// Try data dir directly
		dataDir = filepath.Join(foundPackDir, "data")
	}

	var parquetFiles []string
	err := filepath.WalkDir(dataDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(d.Name(), ".parquet") {
			parquetFiles = append(parquetFiles, path)
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("scan parquet files in %s: %w", dataDir, err)
	}

	if len(parquetFiles) == 0 {
		return 0, fmt.Errorf("no parquet files found in %s", dataDir)
	}

	log.Printf("[INFO] [FXBootstrap] Ingesting %d parquet files from %s...", len(parquetFiles), foundPackDir)

	totalInserted := 0
	var batch []*model.FXRate
	const chunkSize = 1000

	flushBatch := func() error {
		if len(batch) == 0 {
			return nil
		}
		res, err := db.NewInsert().
			Model(&batch).
			On("CONFLICT (base_currency, quote_currency, as_of, granularity) DO NOTHING").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("insert batch: %w", err)
		}
		if rows, err := res.RowsAffected(); err == nil {
			totalInserted += int(rows)
		}
		batch = batch[:0]
		return nil
	}

	for _, file := range parquetFiles {
		rows, err := parquet.ReadFile[packCandleParquetRow](file)
		if err != nil {
			log.Printf("[WARN] [FXBootstrap] Failed reading parquet file %s: %v", file, err)
			continue
		}

		for _, row := range rows {
			symbol := strings.ToUpper(strings.TrimSpace(row.Symbol))
			var base, quote model.Currency
			if len(symbol) == 6 {
				base = model.Currency(symbol[:3])
				quote = model.Currency(symbol[3:])
			} else if row.QuoteCurrency != "" && strings.HasSuffix(symbol, row.QuoteCurrency) {
				quote = model.Currency(row.QuoteCurrency)
				base = model.Currency(strings.TrimSuffix(symbol, row.QuoteCurrency))
			} else {
				continue
			}

			if !base.IsValid() || !quote.IsValid() {
				continue
			}

			closePrice := decimalFromParquetBytes(row.Close, 18)
			if !closePrice.IsPositive() {
				continue
			}

			// Validate realistic FX bounds for major pairs to protect against corrupted pack data
			if (base == model.CurrencyEUR && quote == model.CurrencyUSD) || (base == model.CurrencyUSD && quote == model.CurrencyEUR) {
				if closePrice.GreaterThan(decimal.NewFromFloat(2.5)) || closePrice.LessThan(decimal.NewFromFloat(0.4)) {
					return 0, fmt.Errorf("local pack has invalid EUR/USD rate: %s", closePrice.String())
				}
			}

			source := row.Source
			if source == "" {
				source = "ecb-statistics"
			}

			batch = append(batch, &model.FXRate{
				BaseCurrency:  base,
				QuoteCurrency: quote,
				Rate:          closePrice,
				AsOf:          row.Timestamp.UTC(),
				Source:        source,
				Granularity:   model.FXRateGranularityDay,
				IsStale:       false,
			})

			if len(batch) >= chunkSize {
				if err := flushBatch(); err != nil {
					return totalInserted, err
				}
			}
		}
	}

	if err := flushBatch(); err != nil {
		return totalInserted, err
	}

	if totalInserted == 0 {
		return 0, fmt.Errorf("no valid rows extracted from pack")
	}

	return totalInserted, nil
}

func seedFromFrankfurterBatch(ctx context.Context, db bun.IDB, from, to time.Time) (int, error) {
	bases := []struct {
		from string
		to   string
	}{
		{from: "EUR", to: "USD,GBP,CHF,JPY"},
		{from: "USD", to: "EUR,GBP,CHF,JPY"},
	}

	totalInserted := 0
	client := &http.Client{Timeout: 60 * time.Second}

	for _, b := range bases {
		url := fmt.Sprintf("https://api.frankfurter.dev/v1/%s..%s?from=%s&to=%s",
			from.Format("2006-01-02"), to.Format("2006-01-02"), b.from, b.to)

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return totalInserted, err
		}

		resp, err := client.Do(req)
		if err != nil {
			return totalInserted, err
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return totalInserted, fmt.Errorf("frankfurter returned HTTP %d for base %s", resp.StatusCode, b.from)
		}

		var data struct {
			Base  string                         `json:"base"`
			Rates map[string]map[string]float64 `json:"rates"`
		}
		decodeErr := json.NewDecoder(resp.Body).Decode(&data)
		resp.Body.Close()
		if decodeErr != nil {
			return totalInserted, decodeErr
		}

		var rates []*model.FXRate
		baseCurr := model.Currency(data.Base)
		for dateStr, rateMap := range data.Rates {
			asOf, err := time.Parse("2006-01-02", dateStr)
			if err != nil {
				continue
			}
			utcAsOf := asOf.UTC()
			for quoteStr, val := range rateMap {
				if val <= 0 {
					continue
				}
				quoteCurr := model.Currency(quoteStr)
				if !quoteCurr.IsValid() {
					continue
				}
				dRate := decimal.NewFromFloat(val)
				rates = append(rates, &model.FXRate{
					BaseCurrency:  baseCurr,
					QuoteCurrency: quoteCurr,
					Rate:          dRate,
					AsOf:          utcAsOf,
					Source:        "frankfurter",
					Granularity:   model.FXRateGranularityDay,
					IsStale:       false,
				})
				rates = append(rates, &model.FXRate{
					BaseCurrency:  quoteCurr,
					QuoteCurrency: baseCurr,
					Rate:          decimal.NewFromInt(1).Div(dRate),
					AsOf:          utcAsOf,
					Source:        "frankfurter(inverse)",
					Granularity:   model.FXRateGranularityDay,
					IsStale:       false,
				})
			}
		}

		const chunkSize = 1000
		for i := 0; i < len(rates); i += chunkSize {
			end := i + chunkSize
			if end > len(rates) {
				end = len(rates)
			}
			chunk := rates[i:end]
			res, err := db.NewInsert().
				Model(&chunk).
				On("CONFLICT (base_currency, quote_currency, as_of, granularity) DO NOTHING").
				Exec(ctx)
			if err != nil {
				return totalInserted, err
			}
			if rows, err := res.RowsAffected(); err == nil {
				totalInserted += int(rows)
			}
		}
	}

	return totalInserted, nil
}
