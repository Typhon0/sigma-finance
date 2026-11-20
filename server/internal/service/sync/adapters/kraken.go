package adapters

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"

	"github.com/krakenfx/api-go/v2/pkg/spot"
	"github.com/shopspring/decimal"
)

const (
	defaultKrakenBaseURL = "https://api.kraken.com"
	defaultKrakenTimeout = 30 * time.Second
	// Kraken Spot expects POST parameters to be form-encoded ("nonce=...&start=...");
	// the SDK defaults to a JSON body, so every private call states the media type
	// the API documents and that its signature is computed against.
	krakenFormContentType = "application/x-www-form-urlencoded"
)

// KrakenAdapter implements syncservice.SyncAdapter for Kraken crypto exchange.
//
// Transport, request signing, nonce generation and the API error envelope come from
// Kraken's official Go SDK (github.com/krakenfx/api-go/v2); the ledger-to-transaction
// mapping is ours, because /0/private/Ledgers and /0/private/OpenPositions are not
// among the endpoints the SDK wraps yet.
type KrakenAdapter struct {
	baseURL    string
	httpClient *http.Client
	// nonce generates the strictly increasing request nonce Kraken requires. It is
	// shared across calls so two requests in the same nanosecond still differ.
	nonce func() string
	// assetNames resolves ledger asset codes through Kraken's own asset list, so
	// newly listed or renamed assets resolve without a code change here.
	assetNames *krakenAssetDictionary
}

// NewKrakenAdapter creates a new KrakenAdapter instance.
func NewKrakenAdapter(opts ...KrakenOption) *KrakenAdapter {
	k := &KrakenAdapter{
		baseURL: defaultKrakenBaseURL,
		httpClient: &http.Client{
			Timeout: defaultKrakenTimeout,
		},
	}
	for _, opt := range opts {
		opt(k)
	}

	k.nonce = newKrakenNonce()

	k.assetNames = newKrakenAssetDictionary(k.baseURL, k.httpClient, krakenAssetDictionaryTTL, krakenAssetDictionaryRetryDelay)
	return k
}

// Provider returns the provider identifier string.
func (k *KrakenAdapter) Provider() string {
	return model.SyncProviderKraken
}

type krakenCredentials struct {
	APIKey    string `json:"apiKey"`
	APIKeyAlt string `json:"api_key"`
	Secret    string `json:"apiSecret"`
	SecretAlt string `json:"api_secret"`
}

// newKrakenNonce returns a strict, 64-bit nonce generator — the value Kraken compares
// against the last nonce used with the API key.
//
// The SDK's epoch counter builds its nonce as timestamp plus a three digit counter, so
// at nanosecond precision it exceeds what Kraken accepts as an integer (EAPI:Bad
// request), while its second/millisecond presets are smaller than the nanosecond nonces
// this adapter sent before the SDK migration and are rejected as EAPI:Invalid nonce.
// The plain nanosecond timestamp is what has always worked here; the guard keeps it
// strictly increasing even for two requests inside the same nanosecond.
func newKrakenNonce() func() string {
	var mu sync.Mutex
	var last int64

	return func() string {
		mu.Lock()
		defer mu.Unlock()

		now := time.Now().UnixNano()
		if now <= last {
			now = last + 1
		}
		last = now

		return strconv.FormatInt(now, 10)
	}
}

func parseKrakenCredentials(cred *model.SyncCredential) (string, string, error) {
	if cred == nil {
		return "", "", syncservice.ErrInvalidCredentials
	}

	rawJSON, err := cred.Decrypt()
	if err != nil {
		return "", "", fmt.Errorf("%w: %v", syncservice.ErrInvalidCredentials, err)
	}

	var parsed krakenCredentials
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return "", "", fmt.Errorf("%w: failed to parse credential json", syncservice.ErrInvalidCredentials)
	}

	apiKey := parsed.APIKey
	if apiKey == "" {
		apiKey = parsed.APIKeyAlt
	}

	secret := parsed.Secret
	if secret == "" {
		secret = parsed.SecretAlt
	}

	if apiKey == "" || secret == "" {
		return "", "", syncservice.ErrInvalidCredentials
	}

	// The SDK decodes the secret while signing; validating it here keeps a malformed
	// secret reported as a credential problem instead of an opaque signing failure.
	if _, err := base64.StdEncoding.DecodeString(secret); err != nil {
		return "", "", fmt.Errorf("%w: invalid base64 secret", syncservice.ErrInvalidCredentials)
	}

	return apiKey, secret, nil
}

// NormalizeKrakenAsset normalizes legacy Kraken symbol codes to ISO/standard tickers.
// Returns the normalized ticker string and whether the asset represents a fiat currency.
func NormalizeKrakenAsset(code string) (string, bool) {
	c := strings.ToUpper(strings.TrimSpace(code))

	// Strip Kraken staking/earn/bonded/parachain suffixes (e.g. "ETH.S", "DOT.S", "XBT.M", "SUI.B", "DOT.P")
	if idx := strings.Index(c, "."); idx != -1 {
		c = c[:idx]
	}

	// Known legacy mappings & staking variants
	switch c {
	case "XXBT", "XBT":
		return "BTC", false
	case "XETH", "ETH2":
		return "ETH", false
	case "ADA2":
		return "ADA", false
	case "XXRP":
		return "XRP", false
	case "XXLM":
		return "XLM", false
	case "XLTC":
		return "LTC", false
	case "XZEC":
		return "ZEC", false
	case "XXMR":
		return "XMR", false
	case "XMLN":
		return "MLN", false
	case "XREP":
		return "REP", false
	case "XXDG":
		return "DOGE", false
	case "ZEUR":
		return "EUR", true
	case "ZUSD":
		return "USD", true
	case "ZGBP":
		return "GBP", true
	case "ZJPY":
		return "JPY", true
	case "ZCAD":
		return "CAD", true
	case "ZAUD":
		return "AUD", true
	case "ZCHF":
		return "CHF", true
	}

	// Kraken numbered staking allocations (e.g. SOL01, SOL02, SOL03, ADA01, DOT01, etc.)
	if len(c) >= 5 && c[len(c)-2] >= '0' && c[len(c)-2] <= '9' && c[len(c)-1] >= '0' && c[len(c)-1] <= '9' {
		c = c[:len(c)-2]
	}

	// Kraken 4-character prefix normalization:
	// Z + 3-character fiat code
	if len(c) == 4 && c[0] == 'Z' {
		sub := c[1:]
		if isFiatCurrency(sub) {
			return sub, true
		}
	}

	// X + 3-character crypto code
	if len(c) == 4 && c[0] == 'X' {
		return c[1:], false
	}

	isFiat := isFiatCurrency(c)
	return c, isFiat
}

func isFiatCurrency(c string) bool {
	switch c {
	case "EUR", "USD", "GBP", "JPY", "CAD", "AUD", "CHF":
		return true
	default:
		return false
	}
}

// spotREST builds an SDK client bound to this request's context, credentials and
// base URL. The SDK derives the nonce, signs the request
// (base64(hmac_sha512(path + sha256(nonce + postdata), base64_decode(secret)))) and
// submits it through the injected HTTP client, so timeouts and test transports stay ours.
func (k *KrakenAdapter) spotREST(ctx context.Context, cred *model.SyncCredential) (*spot.REST, error) {
	apiKey, secret, err := parseKrakenCredentials(cred)
	if err != nil {
		return nil, err
	}

	rest := spot.NewREST()
	rest.PublicKey = apiKey
	rest.PrivateKey = secret
	rest.BaseURL = k.baseURL
	if k.nonce != nil {
		rest.Nonce = k.nonce
	}
	rest.Executor = func(req *http.Request) (*http.Response, error) {
		return k.httpClient.Do(req.WithContext(ctx))
	}

	return rest, nil
}

// krakenCall submits an authenticated Spot request through the official SDK and
// returns its `result` payload decoded into T. Transport and API failures are mapped
// onto the sentinel errors the sync service reacts to (rate limit, invalid credentials).
func krakenCall[T any](k *KrakenAdapter, ctx context.Context, cred *model.SyncCredential, apiPath string, params map[string]any) (T, error) {
	var result T

	rest, err := k.spotREST(ctx, cred)
	if err != nil {
		return result, err
	}

	if params == nil {
		params = map[string]any{}
	}

	resp, callErr := spot.Call[T](rest, spot.RequestOptions{
		Auth:        true,
		Method:      http.MethodPost,
		Path:        apiPath,
		Body:        params,
		ContentType: krakenFormContentType,
	})

	if resp == nil {
		// No HTTP response at all: a transport failure or an SDK signing error.
		return result, fmt.Errorf("kraken http request failed: %w", callErr)
	}
	if resp.Http != nil && resp.Http.Response != nil {
		if statusErr := krakenStatusError(resp.Http.StatusCode); statusErr != nil {
			return result, statusErr
		}
	}
	if len(resp.Error) > 0 {
		return result, krakenAPIError(resp.Error)
	}
	if callErr != nil {
		return result, fmt.Errorf("failed to parse kraken response: %w", callErr)
	}

	return resp.Result, nil
}

// TestConnection verifies that the provided credentials can successfully communicate with Kraken.
func (k *KrakenAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	_, err := krakenCall[map[string]string](k, ctx, cred, "/0/private/Balance", nil)
	return err
}

// FetchAccounts returns the single unified Kraken Spot exchange account.
func (k *KrakenAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	if err := k.TestConnection(ctx, cred); err != nil {
		return nil, err
	}

	extID := "kraken-spot"
	apiKey, _, err := parseKrakenCredentials(cred)
	if err == nil && apiKey != "" {
		h := sha256.Sum256([]byte(apiKey))
		extID = fmt.Sprintf("kraken-spot-%x", h[:6])
	}

	return []syncservice.RawAccount{
		{
			ExternalID:    extID,
			Name:          "Kraken Spot",
			Type:          model.AccountTypeCryptoExchange,
			TaxWrapper:    model.TaxWrapperCryptoVault,
			Institution:   "Kraken",
			AccountNumber: extID,
			Currency:      model.CurrencyEUR,
		},
	}, nil
}

// FetchBalances queries /0/private/Balance and extracts all fiat cash balances.
func (k *KrakenAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.BalancesSnapshot, error) {
	// Kraken reports balances as decimal strings; they stay strings until
	// shopspring/decimal parses them so no precision is lost on the way in.
	balancesByAsset, err := krakenCall[map[string]string](k, ctx, cred, "/0/private/Balance", nil)
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}

	var balances []syncservice.RawBalance
	for rawAsset, amountStr := range balancesByAsset {
		amt, parseErr := decimal.NewFromString(amountStr)
		if parseErr != nil {
			continue
		}

		symbol, isFiat := k.assetSymbol(ctx, rawAsset)
		if !isFiat {
			continue
		}

		avail := amt
		balances = append(balances, syncservice.RawBalance{
			Currency:  model.Currency(symbol),
			Amount:    amt,
			Available: &avail,
		})
	}

	// Sort for deterministic results
	sort.Slice(balances, func(i, j int) bool {
		return balances[i].Currency < balances[j].Currency
	})

	return syncservice.BalancesSnapshot{
		Balances:   balances,
		IsComplete: true,
		AsOf:       time.Now(),
	}, nil
}

type krakenOpenPositionRecord struct {
	OrderTxID string  `json:"ordertxid"`
	PosStatus string  `json:"posstatus"`
	Pair      string  `json:"pair"`
	Time      float64 `json:"time"`
	Type      string  `json:"type"`
	Cost      string  `json:"cost"`
	Fee       string  `json:"fee"`
	Vol       string  `json:"vol"`
	VolClosed string  `json:"vol_closed"`
	Value     string  `json:"value"`
}

// FetchHoldings queries /0/private/Balance and /0/private/OpenPositions to extract non-fiat crypto positions.
func (k *KrakenAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.HoldingsSnapshot, error) {
	balancesByAsset, err := krakenCall[map[string]string](k, ctx, cred, "/0/private/Balance", nil)
	if err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}

	// Try querying /0/private/OpenPositions to enrich cost basis for margin/spot positions
	openPositions := k.fetchOpenPositionsSilently(ctx, cred)

	aggregated := make(map[string]*syncservice.RawHolding)
	for rawAsset, amountStr := range balancesByAsset {
		amt, parseErr := decimal.NewFromString(amountStr)
		if parseErr != nil {
			continue
		}

		symbol, isFiat := k.assetSymbol(ctx, rawAsset)
		if isFiat {
			continue
		}

		if amt.IsZero() || amt.IsNegative() {
			continue
		}

		if existing, ok := aggregated[symbol]; ok {
			existing.Quantity = existing.Quantity.Add(amt)
		} else {
			aggregated[symbol] = &syncservice.RawHolding{
				ExternalID: fmt.Sprintf("kraken-%s", symbol),
				Symbol:     symbol,
				Name:       symbol,
				AssetType:  model.AssetTypeCrypto,
				Quantity:   amt,
				Currency:   model.CurrencyUSD,
			}
		}
	}

	var holdings []syncservice.RawHolding
	for symbol, holding := range aggregated {
		// Enrich cost basis if matching open positions are recorded
		if pos, ok := openPositions[symbol]; ok {
			vol, _ := decimal.NewFromString(pos.Vol)
			cost, _ := decimal.NewFromString(pos.Cost)
			if vol.IsPositive() && cost.IsPositive() {
				costBasisPerUnit := cost.Div(vol)
				holding.CostBasisPerUnit = &costBasisPerUnit
				totalCost := costBasisPerUnit.Mul(holding.Quantity)
				cents := model.Money(totalCost.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				holding.TotalCostBasis = &cents
			}
		}
		holdings = append(holdings, *holding)
	}

	// Sort for deterministic results
	sort.Slice(holdings, func(i, j int) bool {
		return holdings[i].Symbol < holdings[j].Symbol
	})

	return syncservice.HoldingsSnapshot{
		Holdings:       holdings,
		IsComplete:     true,
		AsOf:           time.Now(),
		PaginationDone: true,
	}, nil
}

// ExtractBaseAssetFromPair strips known quote suffixes (ordered from longest to shortest)
// and normalizes the resulting base currency symbol (e.g. "SOLUSD" -> "SOL", "XXBTZUSD" -> "BTC").
func ExtractBaseAssetFromPair(pair string) string {
	p := strings.ToUpper(strings.TrimSpace(pair))
	quoteSuffixes := []string{
		"ZUSD", "ZEUR", "ZGBP", "ZJPY", "ZCAD", "ZAUD", "ZCHF", "USDT", "USDC",
		"USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "XBT", "BTC", "ETH",
	}

	for _, suffix := range quoteSuffixes {
		if strings.HasSuffix(p, suffix) && len(p) > len(suffix) {
			base := p[:len(p)-len(suffix)]
			sym, _ := NormalizeKrakenAsset(base)
			return sym
		}
	}

	// Fallback if no known quote matched: if length >= 4, strip 4
	if len(p) >= 4 {
		sym, _ := NormalizeKrakenAsset(p[:len(p)-4])
		return sym
	}
	sym, _ := NormalizeKrakenAsset(p)
	return sym
}

func (k *KrakenAdapter) fetchOpenPositionsSilently(ctx context.Context, cred *model.SyncCredential) map[string]krakenOpenPositionRecord {
	out := make(map[string]krakenOpenPositionRecord)
	positions, err := krakenCall[map[string]krakenOpenPositionRecord](k, ctx, cred, "/0/private/OpenPositions", nil)
	if err != nil {
		return out
	}

	keys := make([]string, 0, len(positions))
	for assetID := range positions {
		keys = append(keys, assetID)
	}
	sort.Strings(keys)

	for _, assetID := range keys {
		pos := positions[assetID]
		sym := ExtractBaseAssetFromPair(pos.Pair)
		out[sym] = pos
	}

	return out
}

type krakenLedgerRecord struct {
	RefID   string  `json:"refid"`
	Time    float64 `json:"time"`
	Type    string  `json:"type"`
	Subtype string  `json:"subtype"`
	AClass  string  `json:"aclass"`
	Asset   string  `json:"asset"`
	Amount  string  `json:"amount"`
	Fee     string  `json:"fee"`
	Balance string  `json:"balance"`
}

type krakenLedgersResult struct {
	Count  int                           `json:"count"`
	Ledger map[string]krakenLedgerRecord `json:"ledger"`
	Cursor krakenLedgerCursor            `json:"cursor"`
}

// krakenLedgerCursor carries the pagination token of /0/private/Ledgers.
// Kraken documents it as {"next": "..."} and has also returned it as a bare
// string, so both shapes decode; an unrecognised shape ends pagination instead
// of failing the sync.
type krakenLedgerCursor struct {
	Next string
}

func (c *krakenLedgerCursor) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		return nil
	}

	var raw string
	if err := json.Unmarshal(data, &raw); err == nil {
		c.Next = strings.TrimSpace(raw)
		return nil
	}

	var obj struct {
		Next    string `json:"next"`
		HasMore *bool  `json:"has_more"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		log.Printf("[WARN] [KrakenAdapter] unrecognised ledger cursor payload %q: %v", trimmed, err)
		return nil
	}
	if obj.HasMore != nil && !*obj.HasMore {
		return nil
	}
	c.Next = strings.TrimSpace(obj.Next)
	return nil
}

type parsedTradeLeg struct {
	id       string
	execTime time.Time
	symbol   string
	isFiat   bool
	// isQuote marks the leg that prices the trade: a government currency or a
	// USD-pegged stablecoin. Kraken lists stablecoin-quoted trades (XBT/USDT) as two
	// non-fiat legs, which used to fall through to the barter branch.
	isQuote  bool
	amt      decimal.Decimal
	feeCents model.Money
}

// krakenUSDStablecoins are the tokens Kraken quotes trades in that are redeemable
// one-for-one against the dollar, so their leg prices the trade at dollar parity.
var krakenUSDStablecoins = map[string]bool{
	"USDT": true, "USDC": true, "USDP": true, "GUSD": true, "DAI": true,
	"TUSD": true, "USDD": true, "PYUSD": true, "FDUSD": true, "USDE": true,
	"USDG": true, "USDS": true,
}

// isUSDStablecoin reports whether a ticker names a USD-pegged stablecoin.
func isUSDStablecoin(symbol string) bool {
	return krakenUSDStablecoins[strings.ToUpper(strings.TrimSpace(symbol))]
}

// krakenPriceCurrency resolves the currency a trade is priced in. Stablecoin legs are
// recorded as USD (parity), while anything else keeps its own ticker: the app's money
// model only understands USD/EUR/GBP, and mislabelling an exotic quote as USD would
// corrupt the numbers that feed portfolio valuation.
func krakenPriceCurrency(symbol string) (model.Currency, bool) {
	if isUSDStablecoin(symbol) {
		return model.CurrencyUSD, true
	}
	currency := model.Currency(strings.ToUpper(strings.TrimSpace(symbol)))
	return currency, currency.IsValid()
}

// Kraken returns /0/private/Ledgers 50 entries at a time, newest first, and only
// hands out older entries through cursor pagination. A single unpaged call
// therefore imports roughly the last few weeks of a busy account: buy dates
// older than that never reach the ledger, so positions get placeholder tax lots
// dated "today" and any history chart starts at the sync date.
const (
	// Hard stop for a cursor that never terminates (50 entries x 200 pages).
	krakenLedgersMaxPages = 200
	// Kraken meters private endpoints with a counter capped at 20 that decays by
	// 0.5/s; Ledgers costs 4 per call while Balance/OpenPositions already spent
	// about 3 in this run. Without pacing, a long backfill trips ErrRateLimited
	// mid-pagination and the sync fails with the older history still missing.
	krakenPrivateCounterLimit       = 20.0
	krakenPrivateCounterDecayPerSec = 0.5
	krakenLedgersCallCost           = 4.0
	krakenCallsBeforeLedgers        = 3.0
)

// krakenLedgerPageWait returns how long to wait before the next Ledgers call so
// the private counter stays under its cap.
func krakenLedgerPageWait(counter float64) time.Duration {
	if counter+krakenLedgersCallCost <= krakenPrivateCounterLimit {
		return 0
	}
	deficit := counter + krakenLedgersCallCost - krakenPrivateCounterLimit
	seconds := deficit / krakenPrivateCounterDecayPerSec
	return time.Duration(seconds*float64(time.Second)) + time.Second
}

// FetchTransactions queries /0/private/Ledgers and converts records into syncservice.RawTransaction items.
// It pages through the whole ledger (or everything after `since`), because the
// oldest entries are the ones that carry the buy dates.
func (k *KrakenAdapter) FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time, cursors syncservice.StreamCursors) (syncservice.TransactionsSnapshot, error) {
	ledger := make(map[string]krakenLedgerRecord)
	lastLedgerCount := 0
	cursor := ""
	counter := krakenCallsBeforeLedgers

	for page := 0; page < krakenLedgersMaxPages; page++ {
		if wait := krakenLedgerPageWait(counter); wait > 0 {
			select {
			case <-ctx.Done():
				return syncservice.TransactionsSnapshot{}, ctx.Err()
			case <-time.After(wait):
			}
			counter = krakenPrivateCounterLimit - krakenLedgersCallCost
		}
		counter += krakenLedgersCallCost
		if counter > krakenPrivateCounterLimit {
			counter = krakenPrivateCounterLimit
		}

		params := map[string]any{"with_cursor": "true"}
		if since != nil {
			params["start"] = strconv.FormatInt(since.Unix(), 10)
		}
		if cursor != "" {
			params["cursor"] = cursor
		}

		result, err := krakenCall[krakenLedgersResult](k, ctx, cred, "/0/private/Ledgers", params)
		if err != nil {
			return syncservice.TransactionsSnapshot{}, err
		}

		for id, record := range result.Ledger {
			ledger[id] = record
		}
		lastLedgerCount = result.Count

		next := strings.TrimSpace(result.Cursor.Next)
		if next == "" || next == cursor {
			cursor = ""
			break
		}
		cursor = next
	}

	if cursor != "" {
		log.Printf("[WARN] [KrakenAdapter] ledger pagination stopped after %d pages; older entries were not fetched", krakenLedgersMaxPages)
	}
	// Kraken reports count as null while cursor pagination is honoured; a count
	// larger than what we collected means the server ignored with_cursor and the
	// response was truncated to one page.
	if ledgerCount := lastLedgerCount; ledgerCount > 0 && ledgerCount > len(ledger) {
		log.Printf("[WARN] [KrakenAdapter] imported %d of %d ledger entries: Kraken did not hand out a pagination cursor", len(ledger), ledgerCount)
	}

	// Sort ledger keys to guarantee deterministic order
	keys := make([]string, 0, len(ledger))
	for k := range ledger {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var txs []syncservice.RawTransaction
	tradeGroups := make(map[string][]parsedTradeLeg)
	var tradeRefOrder []string

	for _, id := range keys {
		entry := ledger[id]
		amt, parseErr := decimal.NewFromString(entry.Amount)
		if parseErr != nil {
			continue
		}

		fee, _ := decimal.NewFromString(entry.Fee)
		symbol, isFiat := k.assetSymbol(ctx, entry.Asset)

		sec := int64(entry.Time)
		nsec := int64((entry.Time - float64(sec)) * 1e9)
		execTime := time.Unix(sec, nsec)

		feeCents := model.Money(fee.Abs().Mul(decimal.NewFromInt(100)).Round(0).IntPart())
		feeCurrency := model.CurrencyUSD
		if isFiat {
			feeCurrency = model.Currency(symbol)
		}

		switch strings.ToLower(entry.Type) {
		case "deposit":
			amtAbs := amt.Abs()
			amtCents := model.Money(amtAbs.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
			if amtCents <= 0 {
				amtCents = 1
			}
			curr := model.CurrencyUSD
			var qty *decimal.Decimal
			if isFiat {
				curr = model.Currency(symbol)
			} else {
				qty = &amtAbs
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   id,
				Type:         model.TransactionTypeDeposit,
				Symbol:       symbol,
				Name:         symbol,
				Amount:       amtCents,
				Quantity:     qty,
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: feeCurrency,
				ExecutedAt:   execTime,
				Notes:        fmt.Sprintf("Kraken deposit %s %s", amtAbs.String(), symbol),
			})

		case "withdrawal":
			amtAbs := amt.Abs()
			amtCents := -model.Money(amtAbs.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
			if amtCents >= 0 {
				amtCents = -1
			}
			curr := model.CurrencyUSD
			var qty *decimal.Decimal
			if isFiat {
				curr = model.Currency(symbol)
			} else {
				qty = &amtAbs
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   id,
				Type:         model.TransactionTypeWithdrawal,
				Symbol:       symbol,
				Name:         symbol,
				Amount:       amtCents,
				Quantity:     qty,
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: feeCurrency,
				ExecutedAt:   execTime,
				Notes:        fmt.Sprintf("Kraken withdrawal %s %s", amtAbs.String(), symbol),
			})

		case "staking", "dividend":
			amtAbs := amt.Abs()
			amtCents := model.Money(amtAbs.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
			if amtCents <= 0 {
				amtCents = 1
			}
			curr := model.CurrencyUSD
			if isFiat {
				curr = model.Currency(symbol)
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   id,
				Type:         model.TransactionTypeDividend,
				Symbol:       symbol,
				Name:         symbol,
				Amount:       amtCents,
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: feeCurrency,
				ExecutedAt:   execTime,
				Notes:        fmt.Sprintf("Kraken staking reward %s %s", amtAbs.String(), symbol),
			})

		case "trade":
			refID := strings.TrimSpace(entry.RefID)
			if refID == "" {
				refID = fmt.Sprintf("standalone_%s", id)
			}
			if _, exists := tradeGroups[refID]; !exists {
				tradeRefOrder = append(tradeRefOrder, refID)
			}
			tradeGroups[refID] = append(tradeGroups[refID], parsedTradeLeg{
				id:       id,
				execTime: execTime,
				symbol:   symbol,
				isFiat:   isFiat,
				isQuote:  isFiat || isUSDStablecoin(symbol),
				amt:      amt,
				feeCents: feeCents,
			})

		default:
			// Transfers, fees, rollovers, adjustments
			amtAbs := amt.Abs()
			if amt.IsNegative() {
				amtCents := -model.Money(amtAbs.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				if amtCents >= 0 {
					amtCents = -1
				}
				txs = append(txs, syncservice.RawTransaction{
					ExternalID:   id,
					Type:         model.TransactionTypeFee,
					Symbol:       symbol,
					Name:         symbol,
					Amount:       amtCents,
					Currency:     model.CurrencyUSD,
					FeesAmount:   feeCents,
					FeesCurrency: feeCurrency,
					ExecutedAt:   execTime,
					Notes:        fmt.Sprintf("Kraken fee/adjustment %s %s", amtAbs.String(), symbol),
				})
			} else {
				amtCents := model.Money(amtAbs.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				if amtCents <= 0 {
					amtCents = 1
				}
				txs = append(txs, syncservice.RawTransaction{
					ExternalID:   id,
					Type:         model.TransactionTypeAdjustment,
					Symbol:       symbol,
					Name:         symbol,
					Amount:       amtCents,
					Currency:     model.CurrencyUSD,
					FeesAmount:   feeCents,
					FeesCurrency: feeCurrency,
					ExecutedAt:   execTime,
					Notes:        fmt.Sprintf("Kraken adjustment %s %s", amtAbs.String(), symbol),
				})
			}
		}
	}

	// Process trade groups paired by refid:
	// A Kraken trade consists of double-entry ledger records (e.g. crypto leg +0.05 BTC and
	// a counter leg -2500 EUR, or -2500 USDT on a stablecoin pair).
	// We generate a single transaction for the crypto asset and extract execution price &
	// monetary amount from the counter leg. We never emit BUY/SELL transactions for fiat
	// currencies or for stablecoins, which move between a crypto and a cash balance.
	for _, refID := range tradeRefOrder {
		legs := tradeGroups[refID]

		var cryptoLegs []parsedTradeLeg
		var quoteLegs []parsedTradeLeg

		for _, l := range legs {
			if l.isQuote {
				quoteLegs = append(quoteLegs, l)
			} else {
				cryptoLegs = append(cryptoLegs, l)
			}
		}

		// Case A: Crypto leg priced by a counter leg (fiat or USD stablecoin)
		if len(cryptoLegs) > 0 && len(quoteLegs) > 0 {
			totalQuoteAmount := decimal.Zero
			totalQuoteFees := model.Money(0)
			quoteCurrency := model.CurrencyUSD
			quoteSupported := true

			for _, ql := range quoteLegs {
				totalQuoteAmount = totalQuoteAmount.Add(ql.amt.Abs())
				totalQuoteFees += ql.feeCents
				quoteCurrency, quoteSupported = krakenPriceCurrency(ql.symbol)
			}
			if !quoteSupported {
				log.Printf("[WARN] [KrakenAdapter] trade priced in %s; portfolio valuation only handles USD, EUR and GBP", quoteCurrency)
			}

			for _, cl := range cryptoLegs {
				cryptoQty := cl.amt.Abs()
				if cryptoQty.IsZero() {
					continue
				}

				unitPrice := totalQuoteAmount.Div(cryptoQty)
				totalFees := cl.feeCents + totalQuoteFees
				quoteCents := model.Money(totalQuoteAmount.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				if quoteCents <= 0 {
					quoteCents = 1
				}

				var txType model.TransactionType
				var amtCents model.Money
				if cl.amt.IsPositive() {
					txType = model.TransactionTypeBuy
					amtCents = quoteCents
				} else {
					txType = model.TransactionTypeSell
					amtCents = -quoteCents
				}

				txs = append(txs, syncservice.RawTransaction{
					ExternalID:        cl.id,
					Type:              txType,
					Symbol:            cl.symbol,
					Name:              cl.symbol,
					Quantity:          &cryptoQty,
					UnitPriceAmount:   &unitPrice,
					UnitPriceCurrency: quoteCurrency,
					Amount:            amtCents,
					Currency:          quoteCurrency,
					FeesAmount:        totalFees,
					FeesCurrency:      quoteCurrency,
					ExecutedAt:        cl.execTime,
					Notes:             fmt.Sprintf("Kraken trade %s %s %s @ %s %s", txType, cryptoQty.String(), cl.symbol, unitPrice.String(), quoteCurrency),
				})
			}
		} else if len(cryptoLegs) >= 2 && len(quoteLegs) == 0 {
			// Case B: barter trade with neither a fiat nor a stablecoin leg (e.g. bought ETH with BTC).
			// The sold asset prices the buy and is recorded as-is: the app cannot convert it, so
			// flagging it beats silently pricing the trade as dollars.
			var boughtLeg, soldLeg *parsedTradeLeg
			for i := range cryptoLegs {
				if cryptoLegs[i].amt.IsPositive() {
					boughtLeg = &cryptoLegs[i]
				} else if cryptoLegs[i].amt.IsNegative() {
					soldLeg = &cryptoLegs[i]
				}
			}

			if boughtLeg != nil && soldLeg != nil {
				buyQty := boughtLeg.amt.Abs()
				sellQty := soldLeg.amt.Abs()
				unitPrice := sellQty.Div(buyQty)
				cents := model.Money(sellQty.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				if cents <= 0 {
					cents = 1
				}

				priceCurrency, supported := krakenPriceCurrency(soldLeg.symbol)
				if !supported {
					log.Printf("[WARN] [KrakenAdapter] barter trade %s for %s is priced in %s, which portfolio valuation does not handle", boughtLeg.symbol, soldLeg.symbol, priceCurrency)
				}

				txs = append(txs, syncservice.RawTransaction{
					ExternalID:        boughtLeg.id,
					Type:              model.TransactionTypeBuy,
					Symbol:            boughtLeg.symbol,
					Name:              boughtLeg.symbol,
					Quantity:          &buyQty,
					UnitPriceAmount:   &unitPrice,
					UnitPriceCurrency: priceCurrency,
					Amount:            cents,
					Currency:          priceCurrency,
					FeesAmount:        boughtLeg.feeCents + soldLeg.feeCents,
					FeesCurrency:      model.CurrencyUSD,
					ExecutedAt:        boughtLeg.execTime,
					Notes:             fmt.Sprintf("Kraken crypto trade BUY %s for %s", boughtLeg.symbol, soldLeg.symbol),
				})
			}
		}
		// Case C & D:
		// - If legs are fiat-only, omit: never emit BUY/SELL for fiat currencies.
		// - If orphan crypto trade leg with no counter leg, skip: do not corrupt trade history with $1 placeholder.
	}

	// Sort transactions deterministically by ExecutedAt then ExternalID
	sort.Slice(txs, func(i, j int) bool {
		if txs[i].ExecutedAt.Equal(txs[j].ExecutedAt) {
			return txs[i].ExternalID < txs[j].ExternalID
		}
		return txs[i].ExecutedAt.Before(txs[j].ExecutedAt)
	})

	return syncservice.TransactionsSnapshot{
		Transactions:   txs,
		IsComplete:     true,
		PaginationDone: true,
	}, nil
}

// krakenStatusError maps the HTTP statuses Kraken uses for throttling and
// authentication failures, before the response body is inspected.
func krakenStatusError(status int) error {
	switch status {
	case http.StatusTooManyRequests:
		return syncservice.ErrRateLimited
	case http.StatusUnauthorized, http.StatusForbidden:
		return syncservice.ErrInvalidCredentials
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("kraken http error (status %d)", status)
	}
	return nil
}

// krakenAPIError converts the SDK's decoded `error` array into the sentinel errors
// the sync service reacts to.
func krakenAPIError(errList []any) error {
	parts := make([]string, 0, len(errList))
	for _, entry := range errList {
		parts = append(parts, fmt.Sprint(entry))
	}
	return krakenErrorText(strings.Join(parts, "; "))
}

func krakenErrorText(fullErr string) error {
	lower := strings.ToLower(fullErr)

	if strings.Contains(lower, "rate limit") {
		return syncservice.ErrRateLimited
	}
	if strings.Contains(lower, "invalid key") ||
		strings.Contains(lower, "invalid signature") ||
		strings.Contains(lower, "permission denied") {
		return syncservice.ErrInvalidCredentials
	}

	return errors.New("kraken api error: " + fullErr)
}
