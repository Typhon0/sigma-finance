package adapters

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"
)

const (
	defaultKrakenBaseURL = "https://api.kraken.com"
	defaultKrakenTimeout = 30 * time.Second
)

// KrakenAdapter implements syncservice.SyncAdapter for Kraken crypto exchange.
type KrakenAdapter struct {
	baseURL    string
	httpClient *http.Client
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

	return apiKey, secret, nil
}

// NormalizeKrakenAsset normalizes legacy Kraken symbol codes to ISO/standard tickers.
// Returns the normalized ticker string and whether the asset represents a fiat currency.
func NormalizeKrakenAsset(code string) (string, bool) {
	c := strings.ToUpper(strings.TrimSpace(code))

	// Strip Kraken staking suffixes (e.g. "ETH.S", "DOT.S", "ADA2.S")
	if idx := strings.Index(c, "."); idx != -1 {
		c = c[:idx]
	}

	// Known legacy mappings
	switch c {
	case "XXBT", "XBT":
		return "BTC", false
	case "XETH":
		return "ETH", false
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

// computeSignature calculates the Kraken HMAC-SHA512 API-Sign header value.
// Formula: base64(hmac_sha512(path + sha256(nonce + postdata), base64_decode(secret)))
func computeSignature(apiPath string, postData string, nonce string, base64Secret string) (string, error) {
	secretBytes, err := base64.StdEncoding.DecodeString(base64Secret)
	if err != nil {
		return "", fmt.Errorf("invalid base64 secret: %w", err)
	}

	sha := sha256.New()
	sha.Write([]byte(nonce + postData))
	shaSum := sha.Sum(nil)

	mac := hmac.New(sha512.New, secretBytes)
	mac.Write(append([]byte(apiPath), shaSum...))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
}

type krakenEnvelope[T any] struct {
	Error  []string `json:"error"`
	Result T        `json:"result"`
}

func (k *KrakenAdapter) postPrivate(ctx context.Context, cred *model.SyncCredential, path string, params url.Values) ([]byte, error) {
	apiKey, secret, err := parseKrakenCredentials(cred)
	if err != nil {
		return nil, err
	}

	if params == nil {
		params = url.Values{}
	}

	nonce := strconv.FormatInt(time.Now().UnixNano(), 10)
	params.Set("nonce", nonce)
	postData := params.Encode()

	signature, err := computeSignature(path, postData, nonce, secret)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", syncservice.ErrInvalidCredentials, err)
	}

	reqURL := k.baseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, strings.NewReader(postData))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("API-Key", apiKey)
	req.Header.Set("API-Sign", signature)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kraken http request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, syncservice.ErrRateLimited
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, syncservice.ErrInvalidCredentials
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("kraken http error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return bodyBytes, nil
}

// TestConnection verifies that the provided credentials can successfully communicate with Kraken.
func (k *KrakenAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	bodyBytes, err := k.postPrivate(ctx, cred, "/0/private/Balance", nil)
	if err != nil {
		return err
	}

	var env krakenEnvelope[map[string]string]
	if err := json.Unmarshal(bodyBytes, &env); err != nil {
		return fmt.Errorf("failed to parse kraken response: %w", err)
	}

	if len(env.Error) > 0 {
		return checkKrakenErrors(env.Error)
	}

	return nil
}

// FetchAccounts returns the single unified Kraken Spot exchange account.
func (k *KrakenAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	if err := k.TestConnection(ctx, cred); err != nil {
		return nil, err
	}

	return []syncservice.RawAccount{
		{
			ExternalID:    "kraken-spot",
			Name:          "Kraken Spot",
			Type:          model.AccountTypeCryptoExchange,
			TaxWrapper:    model.TaxWrapperStandardTaxable,
			Institution:   "Kraken",
			AccountNumber: "Kraken Spot",
			Currency:      model.CurrencyEUR,
		},
	}, nil
}

// FetchBalances queries /0/private/Balance and extracts all fiat cash balances.
func (k *KrakenAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawBalance, error) {
	bodyBytes, err := k.postPrivate(ctx, cred, "/0/private/Balance", nil)
	if err != nil {
		return nil, err
	}

	var env krakenEnvelope[map[string]string]
	if err := json.Unmarshal(bodyBytes, &env); err != nil {
		return nil, fmt.Errorf("failed to parse balance response: %w", err)
	}

	if len(env.Error) > 0 {
		return nil, checkKrakenErrors(env.Error)
	}

	var balances []syncservice.RawBalance
	for rawAsset, amountStr := range env.Result {
		amt, parseErr := decimal.NewFromString(amountStr)
		if parseErr != nil {
			continue
		}

		symbol, isFiat := NormalizeKrakenAsset(rawAsset)
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

	return balances, nil
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
func (k *KrakenAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawHolding, error) {
	bodyBytes, err := k.postPrivate(ctx, cred, "/0/private/Balance", nil)
	if err != nil {
		return nil, err
	}

	var env krakenEnvelope[map[string]string]
	if err := json.Unmarshal(bodyBytes, &env); err != nil {
		return nil, fmt.Errorf("failed to parse balance response: %w", err)
	}

	if len(env.Error) > 0 {
		return nil, checkKrakenErrors(env.Error)
	}

	// Try querying /0/private/OpenPositions to enrich cost basis for margin/spot positions
	openPositions := k.fetchOpenPositionsSilently(ctx, cred)

	var holdings []syncservice.RawHolding
	for rawAsset, amountStr := range env.Result {
		amt, parseErr := decimal.NewFromString(amountStr)
		if parseErr != nil {
			continue
		}

		symbol, isFiat := NormalizeKrakenAsset(rawAsset)
		if isFiat {
			continue
		}

		if amt.IsZero() || amt.IsNegative() {
			continue
		}

		holding := syncservice.RawHolding{
			ExternalID: fmt.Sprintf("kraken-%s", symbol),
			Symbol:     symbol,
			Name:       symbol,
			AssetType:  model.AssetTypeCrypto,
			Quantity:   amt,
			Currency:   model.CurrencyUSD,
		}

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

		holdings = append(holdings, holding)
	}

	// Sort for deterministic results
	sort.Slice(holdings, func(i, j int) bool {
		return holdings[i].Symbol < holdings[j].Symbol
	})

	return holdings, nil
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
	bodyBytes, err := k.postPrivate(ctx, cred, "/0/private/OpenPositions", nil)
	if err != nil {
		return out
	}

	var env krakenEnvelope[map[string]krakenOpenPositionRecord]
	if err := json.Unmarshal(bodyBytes, &env); err != nil {
		return out
	}

	keys := make([]string, 0, len(env.Result))
	for k := range env.Result {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		pos := env.Result[k]
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
}

type parsedTradeLeg struct {
	id       string
	execTime time.Time
	symbol   string
	isFiat   bool
	amt      decimal.Decimal
	feeCents model.Money
}

// FetchTransactions queries /0/private/Ledgers and converts records into syncservice.RawTransaction items.
func (k *KrakenAdapter) FetchTransactions(ctx context.Context, cred *model.SyncCredential, externalAccountID string, since *time.Time) ([]syncservice.RawTransaction, error) {
	params := url.Values{}
	if since != nil {
		params.Set("start", strconv.FormatInt(since.Unix(), 10))
	}

	bodyBytes, err := k.postPrivate(ctx, cred, "/0/private/Ledgers", params)
	if err != nil {
		return nil, err
	}

	var env krakenEnvelope[krakenLedgersResult]
	if err := json.Unmarshal(bodyBytes, &env); err != nil {
		return nil, fmt.Errorf("failed to parse ledgers response: %w", err)
	}

	if len(env.Error) > 0 {
		return nil, checkKrakenErrors(env.Error)
	}

	// Sort ledger keys to guarantee deterministic order
	keys := make([]string, 0, len(env.Result.Ledger))
	for k := range env.Result.Ledger {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var txs []syncservice.RawTransaction
	tradeGroups := make(map[string][]parsedTradeLeg)
	var tradeRefOrder []string

	for _, id := range keys {
		entry := env.Result.Ledger[id]
		amt, parseErr := decimal.NewFromString(entry.Amount)
		if parseErr != nil {
			continue
		}

		fee, _ := decimal.NewFromString(entry.Fee)
		symbol, isFiat := NormalizeKrakenAsset(entry.Asset)

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
			if isFiat {
				curr = model.Currency(symbol)
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   id,
				Type:         model.TransactionTypeDeposit,
				Symbol:       symbol,
				Name:         symbol,
				Amount:       amtCents,
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
			if isFiat {
				curr = model.Currency(symbol)
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   id,
				Type:         model.TransactionTypeWithdrawal,
				Symbol:       symbol,
				Name:         symbol,
				Amount:       amtCents,
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
	// A Kraken trade consists of double-entry ledger records (e.g. crypto leg +0.05 BTC and fiat leg -2500 EUR).
	// We generate a single transaction for the crypto asset and extract execution price & monetary amount
	// from the counter-fiat leg. We never emit BUY/SELL transactions for fiat currencies.
	for _, refID := range tradeRefOrder {
		legs := tradeGroups[refID]

		var cryptoLegs []parsedTradeLeg
		var fiatLegs []parsedTradeLeg

		for _, l := range legs {
			if l.isFiat {
				fiatLegs = append(fiatLegs, l)
			} else {
				cryptoLegs = append(cryptoLegs, l)
			}
		}

		// Case A: Crypto leg paired with counter-fiat leg
		if len(cryptoLegs) > 0 && len(fiatLegs) > 0 {
			totalFiatAmount := decimal.Zero
			totalFiatFees := model.Money(0)
			fiatCurrency := model.CurrencyUSD

			for _, fl := range fiatLegs {
				totalFiatAmount = totalFiatAmount.Add(fl.amt.Abs())
				totalFiatFees += fl.feeCents
				fiatCurrency = model.Currency(fl.symbol)
			}
			if !fiatCurrency.IsValid() {
				fiatCurrency = model.CurrencyUSD
			}

			for _, cl := range cryptoLegs {
				cryptoQty := cl.amt.Abs()
				if cryptoQty.IsZero() {
					continue
				}

				unitPrice := totalFiatAmount.Div(cryptoQty)
				totalFees := cl.feeCents + totalFiatFees
				fiatCents := model.Money(totalFiatAmount.Mul(decimal.NewFromInt(100)).Round(0).IntPart())
				if fiatCents <= 0 {
					fiatCents = 1
				}

				var txType model.TransactionType
				var amtCents model.Money
				if cl.amt.IsPositive() {
					txType = model.TransactionTypeBuy
					amtCents = fiatCents
				} else {
					txType = model.TransactionTypeSell
					amtCents = -fiatCents
				}

				txs = append(txs, syncservice.RawTransaction{
					ExternalID:        cl.id,
					Type:              txType,
					Symbol:            cl.symbol,
					Name:              cl.symbol,
					Quantity:          &cryptoQty,
					UnitPriceAmount:   &unitPrice,
					UnitPriceCurrency: fiatCurrency,
					Amount:            amtCents,
					Currency:          fiatCurrency,
					FeesAmount:        totalFees,
					FeesCurrency:      fiatCurrency,
					ExecutedAt:        cl.execTime,
					Notes:             fmt.Sprintf("Kraken trade %s %s %s @ %s %s", txType, cryptoQty.String(), cl.symbol, unitPrice.String(), fiatCurrency),
				})
			}
		} else if len(cryptoLegs) >= 2 && len(fiatLegs) == 0 {
			// Case B: Crypto-to-crypto trade (e.g. bought ETH with BTC)
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

				txs = append(txs, syncservice.RawTransaction{
					ExternalID:        boughtLeg.id,
					Type:              model.TransactionTypeBuy,
					Symbol:            boughtLeg.symbol,
					Name:              boughtLeg.symbol,
					Quantity:          &buyQty,
					UnitPriceAmount:   &unitPrice,
					UnitPriceCurrency: model.Currency(soldLeg.symbol),
					Amount:            cents,
					Currency:          model.Currency(soldLeg.symbol),
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

	return txs, nil
}

func checkKrakenErrors(errList []string) error {
	fullErr := strings.Join(errList, "; ")
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
