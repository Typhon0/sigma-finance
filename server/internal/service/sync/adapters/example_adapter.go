package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"
)

// SyncProviderExample is the unique provider identifier for this reference adapter.
// When creating a new regional adapter, define an uppercase provider string such as
// "SBI_SECURITIES", "RAKUTEN_SEC", "FUTU_OPENAPI", "TIGER_BROKERS", "BITFLYER", etc.
const SyncProviderExample = "EXAMPLE"

const (
	defaultExampleBaseURL = "https://api.example-broker.com"
	defaultExampleTimeout = 30 * time.Second
)

// ExampleAdapter serves as the gold-standard, fully compilable reference template
// for open-source community contributors implementing regional financial sync adapters.
//
// Every adapter in SigmaFinance integrates an external broker, exchange, or Open Banking
// API into the unified synchronization pipeline by implementing [syncservice.SyncAdapter].
//
// Key Responsibilities:
//   1. Decrypt & parse credentials stored in [model.SyncCredential]
//   2. Query external REST / JSON / GraphQL endpoints with timeouts & cancellation
//   3. Map vendor-specific responses into canonical DTOs:
//      - [syncservice.RawAccount]
//      - [syncservice.RawBalance]
//      - [syncservice.RawHolding]
//      - [syncservice.RawTransaction]
//   4. Normalize financial precision:
//      - Asset quantities -> [decimal.Decimal]
//      - Monetary values  -> [model.Money] (integer cents / minor units scaled by 100)
//   5. Normalize regional currencies (USD, EUR, GBP, JPY, CNY, HKD)
//   6. Translate vendor errors to sentinel errors ([syncservice.ErrRateLimited], [syncservice.ErrInvalidCredentials])
type ExampleAdapter struct {
	baseURL    string
	httpClient *http.Client
	timeNow    func() time.Time
}

// NewExampleAdapter initializes a new ExampleAdapter configured with functional options.
// Functional options allow callers (and tests) to override the base URL, HTTP client,
// and clock without modifying the adapter's internal state directly.
//
// Example:
//
//	ts := httptest.NewServer(mockHandler)
//	defer ts.Close()
//	adapter := adapters.NewExampleAdapter(
//	    adapters.WithBaseURL(ts.URL),
//	    adapters.WithHTTPClient(ts.Client()),
//	)
func NewExampleAdapter(opts ...Option) *ExampleAdapter {
	a := &ExampleAdapter{
		baseURL: defaultExampleBaseURL,
		httpClient: &http.Client{
			Timeout: defaultExampleTimeout,
		},
		timeNow: time.Now,
	}

	for _, opt := range opts {
		opt(a)
	}

	return a
}

// Provider returns the immutable provider identifier registered with the SyncService.
func (a *ExampleAdapter) Provider() string {
	return SyncProviderExample
}

// ============================================================================
// Credential Handling
// ============================================================================

// exampleCredentials models the JSON payload decrypted from [model.SyncCredential].
// Support both camelCase and snake_case JSON field aliases to maximize compatibility
// with various client UI registration payloads.
type exampleCredentials struct {
	APIKey       string `json:"apiKey"`
	APIKeyAlt    string `json:"api_key"`
	APISecret    string `json:"apiSecret"`
	APISecretAlt string `json:"api_secret"`
	AccountID    string `json:"accountId"`
	AccountIDAlt string `json:"account_id"`
}

// parseExampleCredentials decrypts and parses the encrypted credential string.
//
// Security Requirements:
//   - Credentials are stored encrypted at rest using AES-GCM 256.
//   - Always call cred.Decrypt() to obtain the plaintext JSON payload.
//   - Never log, trace, or leak decrypted credentials or secrets into error messages.
//   - Return [syncservice.ErrInvalidCredentials] on decrypt failure or missing fields.
func parseExampleCredentials(cred *model.SyncCredential) (*exampleCredentials, error) {
	if cred == nil {
		return nil, syncservice.ErrInvalidCredentials
	}

	rawJSON, err := cred.Decrypt()
	if err != nil || strings.TrimSpace(rawJSON) == "" {
		return nil, fmt.Errorf("%w: failed to decrypt credential", syncservice.ErrInvalidCredentials)
	}

	var parsed exampleCredentials
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return nil, fmt.Errorf("%w: invalid credential JSON format", syncservice.ErrInvalidCredentials)
	}

	key := parsed.APIKey
	if key == "" {
		key = parsed.APIKeyAlt
	}

	secret := parsed.APISecret
	if secret == "" {
		secret = parsed.APISecretAlt
	}

	accountID := parsed.AccountID
	if accountID == "" {
		accountID = parsed.AccountIDAlt
	}

	if key == "" || secret == "" {
		return nil, fmt.Errorf("%w: missing required apiKey or apiSecret", syncservice.ErrInvalidCredentials)
	}

	return &exampleCredentials{
		APIKey:    key,
		APISecret: secret,
		AccountID: accountID,
	}, nil
}

// ============================================================================
// SyncAdapter Interface Implementation
// ============================================================================

// TestConnection validates the external credentials by issuing a lightweight
// authentication ping (e.g. GET /v1/ping or GET /v1/user/profile).
//
// Returns:
//   - nil on successful authentication
//   - [syncservice.ErrInvalidCredentials] if HTTP 401/403 or signature invalid
//   - [syncservice.ErrRateLimited] if HTTP 429 or provider rate throttled
func (a *ExampleAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	creds, err := parseExampleCredentials(cred)
	if err != nil {
		return err
	}

	_, statusCode, err := a.executeRequest(ctx, creds, http.MethodGet, "/v1/ping", nil, nil)
	if err != nil {
		return err
	}

	if statusCode == http.StatusOK || statusCode == http.StatusNoContent {
		return nil
	}

	return fmt.Errorf("unexpected connection test status: %d", statusCode)
}

// FetchAccounts discovers all financial sub-accounts accessible under these credentials.
// For multi-account institutions (e.g., standard taxable broker account, NISA account in Japan,
// ISA in UK, cash checking account), each account must be mapped to a [syncservice.RawAccount].
func (a *ExampleAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	creds, err := parseExampleCredentials(cred)
	if err != nil {
		return nil, err
	}

	body, _, err := a.executeRequest(ctx, creds, http.MethodGet, "/v1/accounts", nil, nil)
	if err != nil {
		return nil, err
	}

	type apiAccount struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		Type          string `json:"type"`          // "broker", "checking", "savings", "margin"
		TaxCategory   string `json:"tax_category"`  // "standard", "nisa", "isa", "ira"
		Institution   string `json:"institution"`   // "Example Securities"
		AccountNumber string `json:"account_number"`
		Currency      string `json:"currency"`      // "USD", "JPY", "EUR", "CNY"
	}

	var response struct {
		Accounts []apiAccount `json:"accounts"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse accounts response: %w", err)
	}

	var accounts []syncservice.RawAccount
	for _, acc := range response.Accounts {
		extID := strings.TrimSpace(acc.ID)
		if extID == "" {
			continue
		}

		name := strings.TrimSpace(acc.Name)
		if name == "" {
			name = fmt.Sprintf("Account %s", extID)
		}

		accNumber := strings.TrimSpace(acc.AccountNumber)
		if accNumber == "" {
			accNumber = extID
		}

		institution := strings.TrimSpace(acc.Institution)
		if institution == "" {
			institution = "Example Securities"
		}

		accounts = append(accounts, syncservice.RawAccount{
			ExternalID:    extID,
			Name:          name,
			Type:          NormalizeAccountType(acc.Type),
			TaxWrapper:    NormalizeTaxWrapper(acc.TaxCategory),
			Institution:   institution,
			AccountNumber: accNumber,
			Currency:      NormalizeCurrency(acc.Currency),
		})
	}

	return accounts, nil
}

// FetchBalances queries current cash balances (uninvested cash, settled funds, buying power).
// Reconciled as [model.AssetTypeBankAccount] positions in the reconciliation pipeline.
func (a *ExampleAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawBalance, error) {
	creds, err := parseExampleCredentials(cred)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(externalAccountID) == "" {
		return nil, fmt.Errorf("externalAccountID is required")
	}

	path := fmt.Sprintf("/v1/accounts/%s/balances", url.PathEscape(externalAccountID))
	body, _, err := a.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	type apiBalance struct {
		Currency  string `json:"currency"`
		Amount    string `json:"amount"`
		Available string `json:"available"`
	}

	var response struct {
		Balances []apiBalance `json:"balances"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse balances response: %w", err)
	}

	var balances []syncservice.RawBalance
	for _, b := range response.Balances {
		curr := NormalizeCurrency(b.Currency)

		amt, err := decimal.NewFromString(strings.TrimSpace(b.Amount))
		if err != nil {
			amt = decimal.Zero
		}

		var avail *decimal.Decimal
		if strings.TrimSpace(b.Available) != "" {
			if av, err := decimal.NewFromString(strings.TrimSpace(b.Available)); err == nil {
				avail = &av
			}
		}

		balances = append(balances, syncservice.RawBalance{
			Currency:  curr,
			Amount:    amt,
			Available: avail,
		})
	}

	return balances, nil
}

// FetchHoldings queries security holdings (stocks, ETFs, mutual funds, crypto) in the account.
//
// Precision Guidelines:
//   - Quantity: Use [decimal.Decimal] for exact fractional representation (e.g. 0.00342 BTC or 12.5 shares).
//   - TotalCostBasis: Represent in integer cents as [*model.Money] (scaled by 100 via [model.FromDecimal]).
//     Example: $1,250.75 total cost -> model.Money(125075).
//   - CurrentPrice / CostBasisPerUnit: Use [*decimal.Decimal] for unit prices.
//   - ISIN: Always populate 12-character ISIN (e.g. "US0378331005", "JP3633400001") if provided by provider.
//     The reconciliation engine uses ISIN for authoritative matching in the Instrument Catalog.
func (a *ExampleAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawHolding, error) {
	creds, err := parseExampleCredentials(cred)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(externalAccountID) == "" {
		return nil, fmt.Errorf("externalAccountID is required")
	}

	path := fmt.Sprintf("/v1/accounts/%s/holdings", url.PathEscape(externalAccountID))
	body, _, err := a.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	type apiHolding struct {
		ID            string `json:"id"`
		Symbol        string `json:"symbol"`         // Ticker symbol (e.g. "AAPL", "7203", "BTC")
		Name          string `json:"name"`           // Asset name (e.g. "Apple Inc.", "Toyota Motor Corp")
		ISIN          string `json:"isin"`           // 12-character ISIN (e.g. "US0378331005")
		AssetType     string `json:"asset_type"`     // "stock", "etf", "crypto", "fund"
		Quantity      string `json:"quantity"`       // "100.5"
		CostBasisUnit string `json:"cost_basis_unit"` // Unit cost in quote currency
		TotalCost     string `json:"total_cost"`     // Total cost in quote currency
		CurrentPrice  string `json:"current_price"`  // Latest market price
		Currency      string `json:"currency"`       // Quote currency (e.g. "USD", "JPY")
	}

	var response struct {
		Holdings []apiHolding `json:"holdings"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse holdings response: %w", err)
	}

	var holdings []syncservice.RawHolding
	for _, h := range response.Holdings {
		symbol := strings.ToUpper(strings.TrimSpace(h.Symbol))
		if symbol == "" {
			continue
		}

		qty, err := decimal.NewFromString(strings.TrimSpace(h.Quantity))
		if err != nil || qty.IsZero() {
			continue // Skip unparseable or zero-quantity holdings
		}

		curr := NormalizeCurrency(h.Currency)

		var unitCost *decimal.Decimal
		if strings.TrimSpace(h.CostBasisUnit) != "" {
			if uc, err := decimal.NewFromString(strings.TrimSpace(h.CostBasisUnit)); err == nil {
				unitCost = &uc
			}
		}

		var totalCostBasis *model.Money
		if strings.TrimSpace(h.TotalCost) != "" {
			if tc, err := decimal.NewFromString(strings.TrimSpace(h.TotalCost)); err == nil {
				cents := model.FromDecimal(tc)
				totalCostBasis = &cents
			}
		} else if unitCost != nil {
			// Infer total cost basis = unitCost * quantity
			tc := unitCost.Mul(qty)
			cents := model.FromDecimal(tc)
			totalCostBasis = &cents
		}

		var curPrice *decimal.Decimal
		if strings.TrimSpace(h.CurrentPrice) != "" {
			if cp, err := decimal.NewFromString(strings.TrimSpace(h.CurrentPrice)); err == nil {
				curPrice = &cp
			}
		}

		extID := strings.TrimSpace(h.ID)
		if extID == "" {
			extID = symbol
		}

		holdings = append(holdings, syncservice.RawHolding{
			ExternalID:       extID,
			Symbol:           symbol,
			Name:             strings.TrimSpace(h.Name),
			ISIN:             strings.TrimSpace(h.ISIN),
			AssetType:        NormalizeAssetType(h.AssetType),
			Quantity:         qty,
			CostBasisPerUnit: unitCost,
			TotalCostBasis:   totalCostBasis,
			CurrentPrice:     curPrice,
			Currency:         curr,
		})
	}

	return holdings, nil
}

// FetchTransactions queries executed trades, deposits, withdrawals, dividends, and fees.
// The `since` parameter supports incremental synchronization; when non-nil, fetch records
// executed at or after `since`.
//
// Ingestion & Deduplication:
//   - Always provide a unique [RawTransaction.ExternalID] if available from provider.
//   - Deduplication in the database is enforced atomically via (account_id, external_id).
//   - For BUY trades, the reconciliation engine automatically provisions tax lots.
//   - Amounts and Fees must be stored in [model.Money] integer cents.
func (a *ExampleAdapter) FetchTransactions(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
	since *time.Time,
) ([]syncservice.RawTransaction, error) {
	creds, err := parseExampleCredentials(cred)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(externalAccountID) == "" {
		return nil, fmt.Errorf("externalAccountID is required")
	}

	path := fmt.Sprintf("/v1/accounts/%s/transactions", url.PathEscape(externalAccountID))
	queryParams := url.Values{}
	if since != nil && !since.IsZero() {
		// Pass RFC3339 formatted filter to provider endpoint
		queryParams.Set("since", since.UTC().Format(time.RFC3339))
	}

	body, _, err := a.executeRequest(ctx, creds, http.MethodGet, path, queryParams, nil)
	if err != nil {
		return nil, err
	}

	type apiTransaction struct {
		ID         string `json:"id"`
		Type       string `json:"type"`       // "BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND", "FEE"
		Symbol     string `json:"symbol"`     // "AAPL", "7203"
		Name       string `json:"name"`       // "Apple Inc."
		ISIN       string `json:"isin"`
		Quantity   string `json:"quantity"`   // "10.0"
		UnitPrice  string `json:"unit_price"` // "180.50"
		Amount     string `json:"amount"`     // Total settlement amount "1805.00"
		Currency   string `json:"currency"`   // "USD"
		Fees       string `json:"fees"`       // "1.50"
		ExecutedAt string `json:"executed_at"`// "2026-10-25T14:30:00Z"
		Notes      string `json:"notes"`
	}

	var response struct {
		Transactions []apiTransaction `json:"transactions"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse transactions response: %w", err)
	}

	var rawTransactions []syncservice.RawTransaction
	for _, tx := range response.Transactions {
		extID := strings.TrimSpace(tx.ID)
		if extID == "" {
			continue
		}

		txType := NormalizeTransactionType(tx.Type)
		curr := NormalizeCurrency(tx.Currency)

		// Parse execution date (with fallback to adapter clock if empty or invalid)
		execDate := a.timeNow()
		if strings.TrimSpace(tx.ExecutedAt) != "" {
			if parsedDate, err := time.Parse(time.RFC3339, strings.TrimSpace(tx.ExecutedAt)); err == nil {
				execDate = parsedDate
			} else if parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(tx.ExecutedAt)); err == nil {
				execDate = parsedDate
			}
		}

		// Parse quantity if present
		var qty *decimal.Decimal
		if strings.TrimSpace(tx.Quantity) != "" {
			if q, err := decimal.NewFromString(strings.TrimSpace(tx.Quantity)); err == nil {
				qty = &q
			}
		}

		// Parse unit price
		var unitPrice *decimal.Decimal
		if strings.TrimSpace(tx.UnitPrice) != "" {
			if up, err := decimal.NewFromString(strings.TrimSpace(tx.UnitPrice)); err == nil {
				unitPrice = &up
			}
		}

		// Parse total trade amount in integer cents
		var amountCents model.Money
		if strings.TrimSpace(tx.Amount) != "" {
			if amtDec, err := decimal.NewFromString(strings.TrimSpace(tx.Amount)); err == nil {
				amountCents = model.FromDecimal(amtDec)
			}
		} else if qty != nil && unitPrice != nil {
			amtDec := qty.Mul(*unitPrice)
			amountCents = model.FromDecimal(amtDec)
		}

		// Parse fees in integer cents
		var feesCents model.Money
		if strings.TrimSpace(tx.Fees) != "" {
			if feeDec, err := decimal.NewFromString(strings.TrimSpace(tx.Fees)); err == nil {
				feesCents = model.FromDecimal(feeDec)
			}
		}

		symbol := strings.ToUpper(strings.TrimSpace(tx.Symbol))
		notes := strings.TrimSpace(tx.Notes)
		if notes == "" {
			notes = strings.TrimSpace(tx.Name)
		}

		rawTransactions = append(rawTransactions, syncservice.RawTransaction{
			ExternalID:        extID,
			Type:              txType,
			Symbol:            symbol,
			Name:              strings.TrimSpace(tx.Name),
			ISIN:              strings.TrimSpace(tx.ISIN),
			Quantity:          qty,
			UnitPriceAmount:   unitPrice,
			UnitPriceCurrency: curr,
			Amount:            amountCents,
			Currency:          curr,
			FeesAmount:        feesCents,
			FeesCurrency:      curr,
			ExecutedAt:        execDate,
			Notes:             notes,
		})
	}

	// Sort transactions chronologically ascending
	sort.Slice(rawTransactions, func(i, j int) bool {
		return rawTransactions[i].ExecutedAt.Before(rawTransactions[j].ExecutedAt)
	})

	return rawTransactions, nil
}

// ============================================================================
// Normalization Helpers
// ============================================================================

// NormalizeCurrency maps raw ISO strings, regional currency symbols, and provider aliases
// into a normalized [model.Currency] code.
//
// Core Currencies:
//   - "USD", "EUR", "GBP" are first-class core currencies supported natively in DB.
//
// Regional Currencies:
//   - "JPY", "¥" -> "JPY" (Japan: Tokyo Stock Exchange, bitFlyer, SBI)
//   - "CNY", "RMB", "¥" -> "CNY" (China: Shanghai / Shenzhen Stock Exchanges)
//   - "HKD" -> "HKD" (Hong Kong: HKEX, Futu/Moomoo)
//   - "CAD", "AUD", "CHF" -> Standard ISO codes
//
// If an unmapped or empty string is provided, falls back to [model.CurrencyUSD].
func NormalizeCurrency(raw string) model.Currency {
	c := strings.ToUpper(strings.TrimSpace(raw))

	switch c {
	case "USD", "$", "US_DOLLAR":
		return model.CurrencyUSD
	case "EUR", "€", "EURO":
		return model.CurrencyEUR
	case "GBP", "£", "STERLING":
		return model.CurrencyGBP
	case "JPY", "¥", "YEN":
		return model.Currency("JPY")
	case "CNY", "RMB", "YUAN":
		return model.Currency("CNY")
	case "HKD", "HK$":
		return model.Currency("HKD")
	case "CAD", "C$":
		return model.Currency("CAD")
	case "AUD", "A$":
		return model.Currency("AUD")
	case "CHF":
		return model.Currency("CHF")
	default:
		if len(c) == 3 {
			return model.Currency(c)
		}
		return model.CurrencyUSD
	}
}

// NormalizeAssetType maps provider asset classification strings to [model.AssetType].
func NormalizeAssetType(raw string) model.AssetType {
	clean := strings.ToLower(strings.TrimSpace(raw))

	switch {
	case strings.Contains(clean, "crypto") || clean == "coin" || clean == "token":
		return model.AssetTypeCrypto
	case strings.Contains(clean, "etf") || strings.Contains(clean, "fund") || clean == "mutual_fund":
		return model.AssetTypeFund
	case strings.Contains(clean, "cash") || clean == "bank" || clean == "deposit":
		return model.AssetTypeBankAccount
	default:
		return model.AssetTypeStock
	}
}

// NormalizeAccountType maps vendor account strings to [model.AccountType].
func NormalizeAccountType(raw string) model.AccountType {
	clean := strings.ToLower(strings.TrimSpace(raw))

	switch {
	case strings.Contains(clean, "crypto") || strings.Contains(clean, "wallet") || strings.Contains(clean, "exchange"):
		return model.AccountTypeCryptoExchange
	case strings.Contains(clean, "bank") || strings.Contains(clean, "checking") || strings.Contains(clean, "savings"):
		return model.AccountTypeBank
	default:
		return model.AccountTypeBroker
	}
}

// NormalizeTaxWrapper maps account tax categories to [model.TaxWrapperType].
// Useful for regional tax-advantaged accounts (e.g. Japanese NISA, UK ISA, French PEA, US IRA/401k).
func NormalizeTaxWrapper(raw string) model.TaxWrapperType {
	clean := strings.ToLower(strings.TrimSpace(raw))

	switch {
	case strings.Contains(clean, "pea"):
		return model.TaxWrapperPEA
	case strings.Contains(clean, "nisa") || strings.Contains(clean, "isa") || strings.Contains(clean, "retirement") || strings.Contains(clean, "ira") || strings.Contains(clean, "401k"):
		return model.TaxWrapperRetirementSheltered
	case strings.Contains(clean, "vault") || strings.Contains(clean, "crypto"):
		return model.TaxWrapperCryptoVault
	default:
		return model.TaxWrapperStandardTaxable
	}
}

// NormalizeTransactionType maps vendor transaction actions into [model.TransactionType].
func NormalizeTransactionType(raw string) model.TransactionType {
	clean := strings.ToUpper(strings.TrimSpace(raw))

	switch clean {
	case "BUY", "PURCHASE", "TRADE_BUY":
		return model.TransactionTypeBuy
	case "SELL", "DISPOSAL", "TRADE_SELL":
		return model.TransactionTypeSell
	case "DEPOSIT", "CREDIT", "CASH_IN", "TRANSFER_IN":
		return model.TransactionTypeDeposit
	case "WITHDRAWAL", "DEBIT", "CASH_OUT", "TRANSFER_OUT":
		return model.TransactionTypeWithdrawal
	case "DIVIDEND", "DIV", "INTEREST":
		return model.TransactionTypeDividend
	case "FEE", "COMMISSION", "TAX":
		return model.TransactionTypeFee
	default:
		return model.TransactionTypeBuy
	}
}

// ============================================================================
// Internal HTTP Execution & Error Mapping
// ============================================================================

// executeRequest performs HTTP calls with contextual authentication, body marshaling,
// and vendor error translation to SigmaFinance sentinel errors.
func (a *ExampleAdapter) executeRequest(
	ctx context.Context,
	creds *exampleCredentials,
	method string,
	path string,
	queryParams url.Values,
	reqBody any,
) ([]byte, int, error) {
	reqURL := fmt.Sprintf("%s%s", a.baseURL, path)
	if len(queryParams) > 0 {
		reqURL = fmt.Sprintf("%s?%s", reqURL, queryParams.Encode())
	}

	var bodyReader io.Reader
	if reqBody != nil {
		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, bodyReader)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to construct request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Inject vendor authentication headers (e.g. API keys, HMAC signatures, Bearer tokens)
	if creds != nil && creds.APIKey != "" {
		req.Header.Set("X-API-Key", creds.APIKey)
		req.Header.Set("X-API-Secret", creds.APISecret)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		// Preserve context cancellation / timeouts
		if errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, 0, ctx.Err()
		}
		return nil, 0, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response body: %w", err)
	}

	// 1. Check HTTP status code for rate limiting (HTTP 429)
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, resp.StatusCode, syncservice.ErrRateLimited
	}

	// 2. Check HTTP status code for invalid credentials (HTTP 401 Unauthorized, HTTP 403 Forbidden)
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, resp.StatusCode, syncservice.ErrInvalidCredentials
	}

	// 3. Inspect JSON body for provider-specific error wrappers
	if resp.StatusCode >= 400 {
		return nil, resp.StatusCode, a.parseVendorError(resp.StatusCode, respBytes)
	}

	return respBytes, resp.StatusCode, nil
}

// parseVendorError inspects response bodies for rate limiting and authentication failure signals.
func (a *ExampleAdapter) parseVendorError(statusCode int, body []byte) error {
	var errPayload struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Error   string `json:"error"`
	}

	if err := json.Unmarshal(body, &errPayload); err == nil {
		msgLower := strings.ToLower(fmt.Sprintf("%s %s %s", errPayload.Code, errPayload.Message, errPayload.Error))

		// Catch throttled/rate-limited errors in 200/400 responses
		if strings.Contains(msgLower, "rate limit") || strings.Contains(msgLower, "throttled") || strings.Contains(msgLower, "too many requests") {
			return syncservice.ErrRateLimited
		}

		// Catch invalid credentials
		if strings.Contains(msgLower, "unauthorized") || strings.Contains(msgLower, "invalid key") || strings.Contains(msgLower, "invalid secret") || strings.Contains(msgLower, "invalid signature") {
			return syncservice.ErrInvalidCredentials
		}

		return fmt.Errorf("provider api error (status %d): %s", statusCode, strings.TrimSpace(errPayload.Message+" "+errPayload.Error))
	}

	return fmt.Errorf("provider api error (status %d): %s", statusCode, string(body))
}
