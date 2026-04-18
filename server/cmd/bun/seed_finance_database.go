package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/service"

	"github.com/uptrace/bun"
	"github.com/urfave/cli/v2"
)

type financeDatabaseSeedFile struct {
	name      string
	assetType model.InstrumentAssetType
	sourceKey string
	open      func(ctx context.Context, client *http.Client, token string) (io.ReadCloser, error)
}

type financeDatabaseSource interface {
	Files(ctx context.Context, client *http.Client, token string) ([]financeDatabaseSeedFile, error)
}

type localFinanceDatabaseSource struct {
	directory string
}

type githubFinanceDatabaseSource struct {
	owner  string
	repo   string
	branch string
	path   string
}

type githubContentEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"`
	DownloadURL string `json:"download_url"`
}

func newSeedCommand(db *bun.DB) *cli.Command {
	return &cli.Command{
		Name:  "seed_finance_database",
		Usage: "seed instruments from a FinanceDatabase checkout or GitHub folder",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "source",
				Aliases: []string{"s"},
				Usage:   "local FinanceDatabase path or GitHub tree URL pointing to /database",
				Value:   os.Getenv("FINANCE_DATABASE_PATH"),
			},
			&cli.StringFlag{
				Name:  "github-token",
				Usage: "optional GitHub token for higher API limits when syncing from GitHub",
				Value: os.Getenv("GITHUB_TOKEN"),
			},
			&cli.IntFlag{
				Name:  "batch-size",
				Usage: "number of rows to seed per batch",
				Value: 1000,
			},
		},
		Action: func(c *cli.Context) error {
			if err := ensureInstrumentCatalogReady(c.Context, db); err != nil {
				return err
			}

			sourceValue := strings.TrimSpace(c.String("source"))
			if sourceValue == "" {
				return errors.New("finance database source path or GitHub URL is required; set --source or FINANCE_DATABASE_PATH")
			}

			source, err := parseFinanceDatabaseSource(sourceValue)
			if err != nil {
				return err
			}

			httpClient := &http.Client{}
			files, err := source.Files(c.Context, httpClient, c.String("github-token"))
			if err != nil {
				return err
			}

			uow := repository.NewUnitOfWork(db)
			instrumentService := service.NewInstrumentService(uow, nil, nil)
			batchSize := c.Int("batch-size")
			if batchSize <= 0 {
				batchSize = 1000
			}

			total := 0
			for _, file := range files {
				count, err := seedFinanceDatabaseFile(c.Context, instrumentService, file, httpClient, c.String("github-token"), batchSize)
				if err != nil {
					return err
				}
				total += count
				fmt.Printf("seeded %d rows from %s\n", count, file.name)
			}

			fmt.Printf("finance database seed completed: %d instruments processed\n", total)
			return nil
		},
	}
}

func parseFinanceDatabaseSource(source string) (financeDatabaseSource, error) {
	if parsedURL, err := url.Parse(source); err == nil && parsedURL.Scheme != "" && parsedURL.Host != "" {
		return parseFinanceDatabaseURL(parsedURL)
	}

	info, err := os.Stat(source)
	if err != nil {
		return nil, fmt.Errorf("failed to stat source path %q: %w", source, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("source path %q must be a directory", source)
	}

	if _, err := os.Stat(filepath.Join(source, "database")); err == nil {
		return localFinanceDatabaseSource{directory: filepath.Join(source, "database")}, nil
	}

	return localFinanceDatabaseSource{directory: source}, nil
}

func parseFinanceDatabaseURL(parsedURL *url.URL) (financeDatabaseSource, error) {
	host := strings.ToLower(parsedURL.Host)
	if host != "github.com" && host != "www.github.com" {
		return nil, fmt.Errorf("unsupported remote source %q; only GitHub tree URLs are supported", parsedURL.String())
	}

	segments := splitPathSegments(parsedURL.Path)
	if len(segments) < 5 || segments[2] != "tree" {
		return nil, fmt.Errorf("expected a GitHub tree URL like https://github.com/JerBouma/FinanceDatabase/tree/main/database")
	}

	return githubFinanceDatabaseSource{
		owner:  segments[0],
		repo:   segments[1],
		branch: segments[3],
		path:   strings.Join(segments[4:], "/"),
	}, nil
}

func splitPathSegments(pathValue string) []string {
	trimmed := strings.Trim(pathValue, "/")
	if trimmed == "" {
		return nil
	}
	raw := strings.Split(trimmed, "/")
	segments := make([]string, 0, len(raw))
	for _, segment := range raw {
		if strings.TrimSpace(segment) != "" {
			segments = append(segments, segment)
		}
	}
	return segments
}

func (s localFinanceDatabaseSource) Files(ctx context.Context, client *http.Client, token string) ([]financeDatabaseSeedFile, error) {
	_ = ctx
	_ = client
	_ = token

	mappings := []struct {
		filename  string
		assetType model.InstrumentAssetType
		sourceKey string
	}{
		{filename: "equities.csv", assetType: model.InstrumentAssetTypeStock, sourceKey: "equities"},
		{filename: "etfs.csv", assetType: model.InstrumentAssetTypeETF, sourceKey: "etfs"},
		{filename: "funds.csv", assetType: model.InstrumentAssetTypeFund, sourceKey: "funds"},
		{filename: "indices.csv", assetType: model.InstrumentAssetTypeIndex, sourceKey: "indices"},
		{filename: "currencies.csv", assetType: model.InstrumentAssetTypeCurrency, sourceKey: "currencies"},
		{filename: "cryptos.csv", assetType: model.InstrumentAssetTypeCrypto, sourceKey: "cryptos"},
		{filename: "moneymarkets.csv", assetType: model.InstrumentAssetTypeMoneyMarket, sourceKey: "moneymarkets"},
	}

	files := make([]financeDatabaseSeedFile, 0, len(mappings))
	for _, mapping := range mappings {
		fullPath := filepath.Join(s.directory, mapping.filename)
		if _, err := os.Stat(fullPath); err != nil {
			continue
		}
		filename := mapping.filename
		sourceKey := mapping.sourceKey
		files = append(files, financeDatabaseSeedFile{
			name:      filename,
			assetType: mapping.assetType,
			sourceKey: sourceKey,
			open: func(_ context.Context, _ *http.Client, _ string) (io.ReadCloser, error) {
				return os.Open(fullPath)
			},
		})
	}

	if len(files) == 0 {
		return nil, fmt.Errorf("no FinanceDatabase CSV files found in %s", s.directory)
	}

	return files, nil
}

func (s githubFinanceDatabaseSource) Files(ctx context.Context, client *http.Client, token string) ([]financeDatabaseSeedFile, error) {
	listURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s?ref=%s", s.owner, s.repo, strings.TrimPrefix(s.path, "/"), url.QueryEscape(s.branch))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, listURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "sigma-finance-finance-database-seed")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list GitHub contents: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("GitHub contents request failed: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var entries []githubContentEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		return nil, fmt.Errorf("failed to decode GitHub contents response: %w", err)
	}

	assetTypeByName := map[string]model.InstrumentAssetType{
		"equities.csv":     model.InstrumentAssetTypeStock,
		"etfs.csv":         model.InstrumentAssetTypeETF,
		"funds.csv":        model.InstrumentAssetTypeFund,
		"indices.csv":      model.InstrumentAssetTypeIndex,
		"currencies.csv":   model.InstrumentAssetTypeCurrency,
		"cryptos.csv":      model.InstrumentAssetTypeCrypto,
		"moneymarkets.csv": model.InstrumentAssetTypeMoneyMarket,
	}

	files := make([]financeDatabaseSeedFile, 0, len(entries))
	for _, entry := range entries {
		if entry.Type != "file" || !strings.HasSuffix(strings.ToLower(entry.Name), ".csv") {
			continue
		}
		assetType, ok := assetTypeByName[strings.ToLower(entry.Name)]
		if !ok {
			continue
		}
		downloadURL := entry.DownloadURL
		filename := entry.Name
		sourceKey := strings.TrimSuffix(strings.ToLower(entry.Name), ".csv")
		files = append(files, financeDatabaseSeedFile{
			name:      filename,
			assetType: assetType,
			sourceKey: sourceKey,
			open: func(ctx context.Context, client *http.Client, token string) (io.ReadCloser, error) {
				return openRemoteCSV(ctx, client, downloadURL, token)
			},
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].name < files[j].name
	})

	if len(files) == 0 {
		return nil, fmt.Errorf("no CSV files found in GitHub folder %s", s.path)
	}

	return files, nil
}

func openRemoteCSV(ctx context.Context, client *http.Client, downloadURL string, token string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "sigma-finance-finance-database-seed")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download %s: %w", downloadURL, err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		resp.Body.Close()
		return nil, fmt.Errorf("failed to download %s: %s: %s", downloadURL, resp.Status, strings.TrimSpace(string(body)))
	}
	return resp.Body, nil
}

func seedFinanceDatabaseFile(ctx context.Context, instrumentService service.InstrumentService, file financeDatabaseSeedFile, client *http.Client, token string, batchSize int) (int, error) {
	fmt.Printf("seeding %s (%s)\n", file.name, file.assetType)

	reader, err := file.open(ctx, client, token)
	if err != nil {
		return 0, err
	}
	defer reader.Close()

	csvReader := csv.NewReader(reader)
	csvReader.FieldsPerRecord = -1
	csvReader.ReuseRecord = true

	headers, err := csvReader.Read()
	if err != nil {
		return 0, fmt.Errorf("failed to read header from %s: %w", file.name, err)
	}

	headerIndex := make(map[string]int, len(headers))
	for idx, header := range headers {
		headerIndex[strings.ToLower(strings.TrimSpace(header))] = idx
	}

	batch := make([]catalog.SourceInstrument, 0, batchSize)
	total := 0

	for {
		record, err := csvReader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return total, fmt.Errorf("failed to read %s: %w", file.name, err)
		}

		instrument, ok, err := mapFinanceDatabaseRecord(file, headerIndex, record)
		if err != nil {
			return total, err
		}
		if !ok {
			continue
		}

		batch = append(batch, instrument)
		if len(batch) >= batchSize {
			if err := instrumentService.ImportSourceInstruments(ctx, batch); err != nil {
				return total, fmt.Errorf("failed to seed batch from %s: %w", file.name, err)
			}
			total += len(batch)
			fmt.Printf("  imported %d rows from %s (running total: %d)\n", len(batch), file.name, total)
			batch = batch[:0]
		}
	}

	if len(batch) > 0 {
		if err := instrumentService.ImportSourceInstruments(ctx, batch); err != nil {
			return total, fmt.Errorf("failed to seed final batch from %s: %w", file.name, err)
		}
		total += len(batch)
		fmt.Printf("  imported %d rows from %s (running total: %d)\n", len(batch), file.name, total)
	}

	return total, nil
}

func ensureInstrumentCatalogReady(ctx context.Context, db *bun.DB) error {
	if db == nil {
		return errors.New("database connection is not configured")
	}

	var exists bool
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'sigma_finance'
			  AND table_name = 'instruments'
		)
	`
	if err := db.NewRaw(query).Scan(ctx, &exists); err != nil {
		return fmt.Errorf("failed to inspect instrument catalog schema: %w", err)
	}
	if !exists {
		return fmt.Errorf("instrument catalog tables do not exist yet; run `go run ./cmd/bun db migrate` first with a database owner/admin account")
	}
	return nil
}

func mapFinanceDatabaseRecord(file financeDatabaseSeedFile, headerIndex map[string]int, record []string) (catalog.SourceInstrument, bool, error) {
	get := func(name string) string {
		idx, ok := headerIndex[name]
		if !ok || idx < 0 || idx >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[idx])
	}

	symbol := get("symbol")
	name := get("name")
	exchange, exchangeCode := financeDatabaseExchange(file.assetType, get("exchange"), get("market"))
	if symbol == "" || name == "" || exchange == "" {
		return catalog.SourceInstrument{}, false, nil
	}

	importedAt := time.Now().UTC()
	rawRow := map[string]any{}
	for key, idx := range headerIndex {
		if idx >= 0 && idx < len(record) {
			rawRow[key] = strings.TrimSpace(record[idx])
		}
	}

	instrument := catalog.SourceInstrument{
		DiscoveryInstrument: catalog.DiscoveryInstrument{
			Symbol:             symbol,
			Name:               name,
			Exchange:           exchange,
			ExchangeCode:       ptrString(exchangeCode),
			Country:            ptrString(get("country")),
			Currency:           ptrString(financeDatabaseCurrency(file.assetType, get("currency"), get("quote_currency"), get("base_currency"))),
			AssetType:          file.assetType,
			ProviderSource:     "financedatabase",
			ProviderExternalID: ptrString(financeDatabaseProviderID(file.sourceKey, symbol, exchangeCode, exchange)),
		},
		Metadata: map[string]any{
			"raw": rawRow,
			"provenance": map[string]any{
				"sourceFile":    file.name,
				"sourceVersion": "github-main",
				"importedAt":    importedAt,
			},
		},
		SourceFile:    file.name,
		SourceVersion: "github-main",
		ImportedAt:    importedAt,
	}

	if summary := get("summary"); summary != "" {
		instrument.Summary = ptrString(summary)
	}

	if file.assetType == model.InstrumentAssetTypeStock {
		instrument.Sector = ptrString(get("sector"))
		instrument.IndustryGroup = ptrString(get("industry_group"))
		instrument.Industry = ptrString(get("industry"))
		instrument.Website = ptrString(get("website"))
		instrument.MarketCap = ptrString(get("market_cap"))
		instrument.State = ptrString(get("state"))
		instrument.City = ptrString(get("city"))
		instrument.Zipcode = ptrString(get("zipcode"))
		if isin := get("isin"); isin != "" {
			instrument.ISIN = ptrString(isin)
		}
		if figi := get("figi"); figi != "" {
			instrument.FIGI = ptrString(figi)
		}
		if cusip := get("cusip"); cusip != "" {
			instrument.CUSIP = ptrString(cusip)
		}
		if figi := get("composite_figi"); figi != "" && instrument.FIGI == nil {
			instrument.FIGI = ptrString(figi)
		}
	} else if file.assetType == model.InstrumentAssetTypeETF || file.assetType == model.InstrumentAssetTypeFund {
		instrument.CategoryGroup = ptrString(get("category_group"))
		instrument.Category = ptrString(get("category"))
		instrument.Family = ptrString(get("family"))
		instrument.Website = ptrString(get("website"))
		if isin := get("isin"); isin != "" {
			instrument.ISIN = ptrString(isin)
		}
	} else if file.assetType == model.InstrumentAssetTypeIndex {
		instrument.CategoryGroup = ptrString(get("category_group"))
		instrument.Category = ptrString(get("category"))
	} else if file.assetType == model.InstrumentAssetTypeCurrency {
		instrument.BaseCurrency = ptrString(get("base_currency"))
		instrument.QuoteCurrency = ptrString(get("quote_currency"))
	} else if file.assetType == model.InstrumentAssetTypeCrypto {
		instrument.UnderlyingSymbol = ptrString(get("cryptocurrency"))
		instrument.BaseCurrency = ptrString(get("cryptocurrency"))
		instrument.QuoteCurrency = ptrString(get("currency"))
	} else if file.assetType == model.InstrumentAssetTypeMoneyMarket {
		instrument.Family = ptrString(get("family"))
		instrument.Website = ptrString(get("website"))
	}

	if file.assetType != model.InstrumentAssetTypeCurrency && file.assetType != model.InstrumentAssetTypeCrypto {
		if base := get("base_currency"); base != "" {
			instrument.BaseCurrency = ptrString(base)
		}
		if quote := get("quote_currency"); quote != "" {
			instrument.QuoteCurrency = ptrString(quote)
		}
	}

	return instrument, true, nil
}

func financeDatabaseExchange(assetType model.InstrumentAssetType, exchangeCode, market string) (string, string) {
	switch assetType {
	case model.InstrumentAssetTypeStock:
		exchange := strings.TrimSpace(market)
		if exchange == "" {
			exchange = strings.TrimSpace(exchangeCode)
		}
		return exchange, strings.TrimSpace(exchangeCode)
	default:
		exchange := strings.TrimSpace(exchangeCode)
		if exchange == "" {
			exchange = strings.TrimSpace(market)
		}
		if exchange == "" {
			exchange = "UNKNOWN"
		}
		return exchange, strings.TrimSpace(exchangeCode)
	}
}

func financeDatabaseCurrency(assetType model.InstrumentAssetType, currency, quoteCurrency, baseCurrency string) string {
	switch assetType {
	case model.InstrumentAssetTypeCurrency:
		if strings.TrimSpace(quoteCurrency) != "" {
			return strings.TrimSpace(quoteCurrency)
		}
		if strings.TrimSpace(baseCurrency) != "" {
			return strings.TrimSpace(baseCurrency)
		}
	case model.InstrumentAssetTypeCrypto:
		if strings.TrimSpace(currency) != "" {
			return strings.TrimSpace(currency)
		}
		if strings.TrimSpace(quoteCurrency) != "" {
			return strings.TrimSpace(quoteCurrency)
		}
	default:
		if strings.TrimSpace(currency) != "" {
			return strings.TrimSpace(currency)
		}
	}
	return ""
}

func financeDatabaseProviderID(sourceKey, symbol, exchangeCode, exchange string) string {
	keyParts := []string{strings.TrimSpace(sourceKey), strings.TrimSpace(symbol), strings.TrimSpace(exchangeCode), strings.TrimSpace(exchange)}
	cleaned := make([]string, 0, len(keyParts))
	for _, part := range keyParts {
		if part != "" {
			cleaned = append(cleaned, strings.ToUpper(part))
		}
	}
	return strings.Join(cleaned, ":")
}

func ptrString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	return &trimmed
}
