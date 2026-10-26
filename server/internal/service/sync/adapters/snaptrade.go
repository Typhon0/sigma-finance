package adapters

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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
	defaultSnapTradeBaseURL = "https://api.snaptrade.com"
	defaultSnapTradeTimeout = 30 * time.Second
)

// SnapTradeAdapter implements syncservice.SyncAdapter for SnapTrade brokerage aggregator.
type SnapTradeAdapter struct {
	baseURL    string
	httpClient *http.Client
	timeNow    func() time.Time
}

// WithTimeFunc configures a custom time provider for deterministic testing.
func WithTimeFunc(fn func() time.Time) Option {
	return func(target any) {
		switch s := target.(type) {
		case *SnapTradeAdapter:
			s.timeNow = fn
		case *GoCardlessAdapter:
			s.timeNow = fn
		}
	}
}

// NewSnapTradeAdapter creates a new SnapTradeAdapter instance.
func NewSnapTradeAdapter(opts ...SnapTradeOption) *SnapTradeAdapter {
	s := &SnapTradeAdapter{
		baseURL: defaultSnapTradeBaseURL,
		httpClient: &http.Client{
			Timeout: defaultSnapTradeTimeout,
		},
		timeNow: time.Now,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Provider returns the provider identifier string.
func (s *SnapTradeAdapter) Provider() string {
	return model.SyncProviderSnapTrade
}

type snapTradeCredentials struct {
	ClientID       string `json:"clientId"`
	ClientIDAlt    string `json:"client_id"`
	ConsumerKey    string `json:"consumerKey"`
	ConsumerKeyAlt string `json:"consumer_key"`
	UserID         string `json:"userId"`
	UserIDAlt      string `json:"user_id"`
	UserSecret     string `json:"userSecret"`
	UserSecretAlt  string `json:"user_secret"`
}

func parseSnapTradeCredentials(cred *model.SyncCredential, requireUser bool) (*snapTradeCredentials, error) {
	if cred == nil {
		return nil, syncservice.ErrInvalidCredentials
	}

	rawJSON, err := cred.Decrypt()
	if err != nil || strings.TrimSpace(rawJSON) == "" {
		return nil, syncservice.ErrInvalidCredentials
	}

	var parsed snapTradeCredentials
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return nil, fmt.Errorf("%w: failed to parse credential json", syncservice.ErrInvalidCredentials)
	}

	clientID := parsed.ClientID
	if clientID == "" {
		clientID = parsed.ClientIDAlt
	}

	consumerKey := parsed.ConsumerKey
	if consumerKey == "" {
		consumerKey = parsed.ConsumerKeyAlt
	}

	userID := parsed.UserID
	if userID == "" {
		userID = parsed.UserIDAlt
	}

	userSecret := parsed.UserSecret
	if userSecret == "" {
		userSecret = parsed.UserSecretAlt
	}

	if clientID == "" || consumerKey == "" {
		return nil, syncservice.ErrInvalidCredentials
	}

	if requireUser && (userID == "" || userSecret == "") {
		return nil, syncservice.ErrInvalidCredentials
	}

	return &snapTradeCredentials{
		ClientID:    clientID,
		ConsumerKey: consumerKey,
		UserID:      userID,
		UserSecret:  userSecret,
	}, nil
}

// computeSnapTradeSignature calculates the canonical HMAC-SHA256 request signature.
// Payload canonical structure: {"content": <content>, "path": <path>, "query": <query>}
func computeSnapTradeSignature(path string, query string, bodyBytes []byte, consumerKey string) (string, error) {
	var content any
	if len(bodyBytes) > 0 {
		trimmed := bytes.TrimSpace(bodyBytes)
		if len(trimmed) > 0 && string(trimmed) != "{}" && string(trimmed) != "null" {
			var decoded any
			if err := json.Unmarshal(bodyBytes, &decoded); err == nil {
				content = decoded
			} else {
				content = string(bodyBytes)
			}
		}
	}

	sigObject := struct {
		Content any    `json:"content"`
		Path    string `json:"path"`
		Query   string `json:"query"`
	}{
		Content: content,
		Path:    path,
		Query:   query,
	}

	sigJSON, err := json.Marshal(sigObject)
	if err != nil {
		return "", fmt.Errorf("failed to marshal signature payload: %w", err)
	}

	mac := hmac.New(sha256.New, []byte(consumerKey))
	mac.Write(sigJSON)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
}

func (s *SnapTradeAdapter) executeRequest(
	ctx context.Context,
	creds *snapTradeCredentials,
	method string,
	path string,
	queryParams url.Values,
	bodyObj any,
) ([]byte, error) {
	if queryParams == nil {
		queryParams = url.Values{}
	}

	queryParams.Set("clientId", creds.ClientID)
	queryParams.Set("timestamp", strconv.FormatInt(s.timeNow().Unix(), 10))

	if creds.UserID != "" && creds.UserSecret != "" {
		queryParams.Set("userId", creds.UserID)
		queryParams.Set("userSecret", creds.UserSecret)
	}

	rawQuery := queryParams.Encode()
	reqURL := s.baseURL + path
	if rawQuery != "" {
		reqURL += "?" + rawQuery
	}

	var bodyBytes []byte
	if bodyObj != nil {
		var err error
		bodyBytes, err = json.Marshal(bodyObj)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
	}

	signature, err := computeSnapTradeSignature(path, rawQuery, bodyBytes, creds.ConsumerKey)
	if err != nil {
		return nil, fmt.Errorf("failed to compute request signature: %w", err)
	}

	var bodyReader io.Reader
	if len(bodyBytes) > 0 {
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Signature", signature)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("snaptrade http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
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
		// Attempt to inspect JSON error body
		var errPayload struct {
			StatusCode int    `json:"statusCode"`
			Code       string `json:"code"`
			Message    string `json:"message"`
			Detail     string `json:"detail"`
		}
		if jsonErr := json.Unmarshal(respBody, &errPayload); jsonErr == nil {
			msgLower := strings.ToLower(errPayload.Message + " " + errPayload.Detail)
			if strings.Contains(msgLower, "unauthorized") || strings.Contains(msgLower, "invalid") {
				return nil, syncservice.ErrInvalidCredentials
			}
			if strings.Contains(msgLower, "rate limit") {
				return nil, syncservice.ErrRateLimited
			}
		}
		return nil, fmt.Errorf("snaptrade api error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// TestConnection verifies that the provided credentials can successfully communicate with SnapTrade.
func (s *SnapTradeAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	creds, err := parseSnapTradeCredentials(cred, true)
	if err != nil {
		return err
	}

	_, err = s.executeRequest(ctx, creds, http.MethodGet, "/api/v1/accounts", nil, nil)
	return err
}

// RegisterUser registers an end user in SnapTrade and returns their userId and userSecret.
func (s *SnapTradeAdapter) RegisterUser(ctx context.Context, cred *model.SyncCredential, snapTradeUserID string) (string, string, error) {
	creds, err := parseSnapTradeCredentials(cred, false)
	if err != nil {
		return "", "", err
	}

	targetUserID := snapTradeUserID
	if targetUserID == "" {
		targetUserID = cred.UserID
	}
	if targetUserID == "" {
		return "", "", fmt.Errorf("%w: user ID is required for registration", syncservice.ErrInvalidCredentials)
	}

	body := map[string]string{
		"userId": targetUserID,
	}

	respBytes, err := s.executeRequest(ctx, creds, http.MethodPost, "/api/v1/snapTrade/registerUser", nil, body)
	if err != nil {
		return "", "", err
	}

	var res struct {
		UserID     string `json:"userId"`
		UserSecret string `json:"userSecret"`
	}
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return "", "", fmt.Errorf("failed to parse registerUser response: %w", err)
	}

	return res.UserID, res.UserSecret, nil
}

// GeneratePortalLink creates a Connection Portal session redirect URL for connecting brokerages.
func (s *SnapTradeAdapter) GeneratePortalLink(ctx context.Context, cred *model.SyncCredential, redirectURL string) (string, error) {
	creds, err := parseSnapTradeCredentials(cred, true)
	if err != nil {
		return "", err
	}

	var body any
	if redirectURL != "" {
		body = map[string]string{
			"customRedirect": redirectURL,
		}
	}

	respBytes, err := s.executeRequest(ctx, creds, http.MethodPost, "/api/v1/snapTrade/login", nil, body)
	if err != nil {
		return "", err
	}

	var res struct {
		LoginRedirectURL string `json:"loginRedirectUrl"`
		RedirectURI      string `json:"redirectURI"`
	}
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return "", fmt.Errorf("failed to parse login response: %w", err)
	}

	link := res.LoginRedirectURL
	if link == "" {
		link = res.RedirectURI
	}
	if link == "" {
		return "", errorsNewPortalLinkEmpty()
	}

	return link, nil
}

func errorsNewPortalLinkEmpty() error {
	return fmt.Errorf("portal link not returned by snaptrade")
}

// SnapTradeAccount represents an account returned by SnapTrade.
type snapTradeAccount struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Number          string `json:"number"`
	InstitutionName string `json:"institution_name"`
	Balance         struct {
		Cash     any `json:"cash"`
		Currency struct {
			Code string `json:"code"`
		} `json:"currency"`
	} `json:"balance"`
}

// FetchAccounts queries /api/v1/accounts and returns discovered brokerage accounts.
func (s *SnapTradeAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	creds, err := parseSnapTradeCredentials(cred, true)
	if err != nil {
		return nil, err
	}

	respBytes, err := s.executeRequest(ctx, creds, http.MethodGet, "/api/v1/accounts", nil, nil)
	if err != nil {
		return nil, err
	}

	var accounts []snapTradeAccount
	if err := json.Unmarshal(respBytes, &accounts); err != nil {
		return nil, fmt.Errorf("failed to parse accounts response: %w", err)
	}

	var rawAccounts []syncservice.RawAccount
	for _, acc := range accounts {
		name := acc.Name
		if name == "" {
			name = acc.InstitutionName
		}
		if name == "" {
			name = "SnapTrade Account"
		}

		institution := acc.InstitutionName
		if institution == "" {
			institution = "SnapTrade"
		}

		accountNumber := acc.Number
		if accountNumber == "" {
			accountNumber = acc.ID
		}

		currCode := strings.ToUpper(strings.TrimSpace(acc.Balance.Currency.Code))
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}

		rawAccounts = append(rawAccounts, syncservice.RawAccount{
			ExternalID:    acc.ID,
			Name:          name,
			Type:          model.AccountTypeBroker,
			TaxWrapper:    model.TaxWrapperStandardTaxable,
			Institution:   institution,
			AccountNumber: accountNumber,
			Currency:      model.Currency(currCode),
		})
	}

	return rawAccounts, nil
}

type snapTradeBalance struct {
	Currency struct {
		Code string `json:"code"`
	} `json:"currency"`
	Cash        any `json:"cash"`
	BuyingPower any `json:"buying_power"`
}

// FetchBalances queries /api/v1/accounts/{accountId}/balances and extracts cash balances.
func (s *SnapTradeAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawBalance, error) {
	creds, err := parseSnapTradeCredentials(cred, true)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/api/v1/accounts/%s/balances", url.PathEscape(externalAccountID))
	respBytes, err := s.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	var balances []snapTradeBalance
	if err := json.Unmarshal(respBytes, &balances); err != nil {
		return nil, fmt.Errorf("failed to parse balances response: %w", err)
	}

	var rawBalances []syncservice.RawBalance
	for _, b := range balances {
		currCode := strings.ToUpper(strings.TrimSpace(b.Currency.Code))
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}

		cashAmt, _ := parseDecimalValue(b.Cash)
		var availAmt *decimal.Decimal
		if bp, ok := parseDecimalValue(b.BuyingPower); ok {
			availAmt = &bp
		} else {
			availAmt = &cashAmt
		}

		rawBalances = append(rawBalances, syncservice.RawBalance{
			Currency:  model.Currency(currCode),
			Amount:    cashAmt,
			Available: availAmt,
		})
	}

	sort.Slice(rawBalances, func(i, j int) bool {
		return rawBalances[i].Currency < rawBalances[j].Currency
	})

	return rawBalances, nil
}

type snapTradePositionSymbol struct {
	ID           string `json:"id"`
	Symbol       string `json:"symbol"`
	RawSymbol    string `json:"raw_symbol"`
	Description  string `json:"description"`
	ISIN         string `json:"isin"`
	ISINAlt      string `json:"ISIN"`
	Currency     struct {
		Code string `json:"code"`
	} `json:"currency"`
	SecurityType struct {
		Code string `json:"code"`
		Name string `json:"name"`
	} `json:"security_type"`
	Type struct {
		Code        string `json:"code"`
		Description string `json:"description"`
	} `json:"type"`
	UniversalSymbol *snapTradePositionSymbol `json:"universal_symbol"`
}

type snapTradePosition struct {
	Symbol               *snapTradePositionSymbol `json:"symbol"`
	Units                any                      `json:"units"`
	Price                any                      `json:"price"`
	AveragePurchasePrice any                      `json:"average_purchase_price"`
	OpenPnL              any                      `json:"open_pnl"`
	ISIN                 string                   `json:"isin"`
	ISINAlt              string                   `json:"ISIN"`
}

// FetchHoldings queries /api/v1/accounts/{accountId}/holdings and returns normalized security positions.
func (s *SnapTradeAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) ([]syncservice.RawHolding, error) {
	creds, err := parseSnapTradeCredentials(cred, true)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/api/v1/accounts/%s/holdings", url.PathEscape(externalAccountID))
	respBytes, err := s.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	positions, err := parseHoldingsPositions(respBytes)
	if err != nil {
		return nil, err
	}

	var holdings []syncservice.RawHolding
	for _, pos := range positions {
		if pos.Symbol == nil {
			continue
		}

		sym := pos.Symbol
		ticker := sym.Symbol
		if ticker == "" {
			ticker = sym.RawSymbol
		}
		if ticker == "" && sym.UniversalSymbol != nil {
			ticker = sym.UniversalSymbol.Symbol
		}
		if ticker == "" {
			continue
		}

		name := sym.Description
		if name == "" && sym.UniversalSymbol != nil {
			name = sym.UniversalSymbol.Description
		}
		if name == "" {
			name = ticker
		}

		isin := extractISIN(pos)

		assetType := resolveAssetType(sym)

		qty, _ := parseDecimalValue(pos.Units)
		if qty.IsZero() || qty.IsNegative() {
			continue
		}

		holding := syncservice.RawHolding{
			ExternalID: fmt.Sprintf("%s:%s", externalAccountID, ticker),
			Symbol:     ticker,
			Name:       name,
			ISIN:       isin,
			AssetType:  assetType,
			Quantity:   qty,
		}

		// Currency resolution
		currCode := strings.ToUpper(strings.TrimSpace(sym.Currency.Code))
		if currCode == "" && sym.UniversalSymbol != nil {
			currCode = strings.ToUpper(strings.TrimSpace(sym.UniversalSymbol.Currency.Code))
		}
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}
		holding.Currency = model.Currency(currCode)

		// Price
		if price, ok := parseDecimalValue(pos.Price); ok && price.IsPositive() {
			holding.CurrentPrice = &price
		}

		// Cost basis
		if costBasis, ok := parseDecimalValue(pos.AveragePurchasePrice); ok && costBasis.IsPositive() {
			holding.CostBasisPerUnit = &costBasis
			totalCost := costBasis.Mul(qty)
			cents := model.Money(totalCost.Mul(decimal.NewFromInt(100)).IntPart())
			holding.TotalCostBasis = &cents
		}

		holdings = append(holdings, holding)
	}

	sort.Slice(holdings, func(i, j int) bool {
		return holdings[i].Symbol < holdings[j].Symbol
	})

	return holdings, nil
}

func parseHoldingsPositions(respBytes []byte) ([]snapTradePosition, error) {
	// Pattern 1: Envelope with "positions" array
	var envelope struct {
		Positions []snapTradePosition `json:"positions"`
		Holdings  []snapTradePosition `json:"holdings"`
	}
	if err := json.Unmarshal(respBytes, &envelope); err == nil {
		if len(envelope.Positions) > 0 {
			return envelope.Positions, nil
		}
		if len(envelope.Holdings) > 0 {
			return envelope.Holdings, nil
		}
	}

	// Pattern 2: Direct array of positions
	var directPositions []snapTradePosition
	if err := json.Unmarshal(respBytes, &directPositions); err == nil {
		return directPositions, nil
	}

	return nil, fmt.Errorf("failed to parse positions from holdings response")
}

func extractISIN(pos snapTradePosition) string {
	if pos.ISIN != "" {
		return pos.ISIN
	}
	if pos.ISINAlt != "" {
		return pos.ISINAlt
	}
	if pos.Symbol != nil {
		if pos.Symbol.ISIN != "" {
			return pos.Symbol.ISIN
		}
		if pos.Symbol.ISINAlt != "" {
			return pos.Symbol.ISINAlt
		}
		if pos.Symbol.UniversalSymbol != nil {
			if pos.Symbol.UniversalSymbol.ISIN != "" {
				return pos.Symbol.UniversalSymbol.ISIN
			}
			if pos.Symbol.UniversalSymbol.ISINAlt != "" {
				return pos.Symbol.UniversalSymbol.ISINAlt
			}
		}
	}
	return ""
}

func resolveAssetType(sym *snapTradePositionSymbol) model.AssetType {
	typeStr := strings.ToUpper(sym.SecurityType.Code + " " + sym.SecurityType.Name + " " + sym.Type.Code + " " + sym.Type.Description)
	if sym.UniversalSymbol != nil {
		typeStr += " " + strings.ToUpper(sym.UniversalSymbol.SecurityType.Code + " " + sym.UniversalSymbol.SecurityType.Name)
	}

	if strings.Contains(typeStr, "CRYPTO") {
		return model.AssetTypeCrypto
	}
	if strings.Contains(typeStr, "ETF") || strings.Contains(typeStr, "FUND") {
		return model.AssetTypeFund
	}
	return model.AssetTypeStock
}

type snapTradeActivity struct {
	ID             string `json:"id"`
	Type           string `json:"type"`
	Amount         any    `json:"amount"`
	Price          any    `json:"price"`
	Quantity       any    `json:"quantity"`
	Fee            any    `json:"fee"`
	TradeDate      string `json:"trade_date"`
	SettlementDate string `json:"settlement_date"`
	Description    string `json:"description"`
	Currency       struct {
		Code string `json:"code"`
	} `json:"currency"`
	Symbol *snapTradePositionSymbol `json:"symbol"`
}

// FetchTransactions queries /api/v1/accounts/{accountId}/activities and converts activity items to RawTransactions.
func (s *SnapTradeAdapter) FetchTransactions(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
	since *time.Time,
) ([]syncservice.RawTransaction, error) {
	creds, err := parseSnapTradeCredentials(cred, true)
	if err != nil {
		return nil, err
	}

	params := url.Values{}
	if since != nil {
		params.Set("startDate", since.Format("2006-01-02"))
	}

	path := fmt.Sprintf("/api/v1/accounts/%s/activities", url.PathEscape(externalAccountID))
	respBytes, err := s.executeRequest(ctx, creds, http.MethodGet, path, params, nil)
	if err != nil {
		return nil, err
	}

	activities, err := parseActivities(respBytes)
	if err != nil {
		return nil, err
	}

	var txs []syncservice.RawTransaction
	for _, act := range activities {
		actTypeUpper := strings.ToUpper(strings.TrimSpace(act.Type))
		currCode := strings.ToUpper(strings.TrimSpace(act.Currency.Code))
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}
		curr := model.Currency(currCode)

		var symbol, name, isin string
		if act.Symbol != nil {
			symbol = act.Symbol.Symbol
			if symbol == "" {
				symbol = act.Symbol.RawSymbol
			}
			name = act.Symbol.Description
			if name == "" {
				name = symbol
			}
			isin = extractISIN(snapTradePosition{Symbol: act.Symbol})
		}

		execDate := parseSnapTradeTime(act.TradeDate)
		if execDate.IsZero() {
			execDate = parseSnapTradeTime(act.SettlementDate)
		}
		if execDate.IsZero() {
			execDate = s.timeNow()
		}

		feeAmt, _ := parseDecimalValue(act.Fee)
		feeCents := model.Money(feeAmt.Abs().Mul(decimal.NewFromInt(100)).IntPart())

		qtyVal, hasQty := parseDecimalValue(act.Quantity)
		priceVal, hasPrice := parseDecimalValue(act.Price)
		amtVal, hasAmt := parseDecimalValue(act.Amount)

		switch actTypeUpper {
		case "BUY":
			txQty := qtyVal.Abs()
			txPrice := priceVal.Abs()
			var totalCents model.Money
			if hasPrice && hasQty && txPrice.IsPositive() && txQty.IsPositive() {
				totalCents = model.Money(txQty.Mul(txPrice).Mul(decimal.NewFromInt(100)).IntPart())
			} else if hasAmt {
				totalCents = model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			}
			if totalCents <= 0 {
				totalCents = 1
			}

			tx := syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeBuy,
				Symbol:       symbol,
				Name:         name,
				ISIN:         isin,
				Amount:       totalCents, // Positive for BUY
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			}
			if hasQty && txQty.IsPositive() {
				tx.Quantity = &txQty
			}
			if hasPrice && txPrice.IsPositive() {
				tx.UnitPriceAmount = &txPrice
				tx.UnitPriceCurrency = curr
			}
			txs = append(txs, tx)

		case "SELL":
			txQty := qtyVal.Abs()
			txPrice := priceVal.Abs()
			var totalCents model.Money
			if hasPrice && hasQty && txPrice.IsPositive() && txQty.IsPositive() {
				totalCents = -model.Money(txQty.Mul(txPrice).Mul(decimal.NewFromInt(100)).IntPart())
			} else if hasAmt {
				totalCents = -model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			}
			if totalCents >= 0 {
				totalCents = -1
			}

			tx := syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeSell,
				Symbol:       symbol,
				Name:         name,
				ISIN:         isin,
				Amount:       totalCents, // Negative for SELL
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			}
			if hasQty && txQty.IsPositive() {
				tx.Quantity = &txQty
			}
			if hasPrice && txPrice.IsPositive() {
				tx.UnitPriceAmount = &txPrice
				tx.UnitPriceCurrency = curr
			}
			txs = append(txs, tx)

		case "DIVIDEND", "STOCK_DIVIDEND", "SUBSTITUTE_DIVIDEND":
			cents := model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			if cents <= 0 {
				cents = 1
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeDividend,
				Symbol:       symbol,
				Name:         name,
				ISIN:         isin,
				Amount:       cents, // Positive for DIVIDEND
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			})

		case "DEPOSIT", "CONTRIBUTION":
			cents := model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			if cents <= 0 {
				cents = 1
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeDeposit,
				Amount:       cents, // Positive for DEPOSIT
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			})

		case "WITHDRAWAL", "DISTRIBUTION":
			cents := -model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			if cents >= 0 {
				cents = -1
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeWithdrawal,
				Amount:       cents, // Negative for WITHDRAWAL
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			})

		case "FEE":
			cents := -model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			if cents >= 0 {
				cents = -1
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeFee,
				Amount:       cents, // Negative for FEE
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			})

		case "INTEREST":
			cents := model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			if cents <= 0 {
				cents = 1
			}
			txs = append(txs, syncservice.RawTransaction{
				ExternalID:   act.ID,
				Type:         model.TransactionTypeInterest,
				Amount:       cents, // Positive for INTEREST
				Currency:     curr,
				FeesAmount:   feeCents,
				FeesCurrency: curr,
				ExecutedAt:   execDate,
				Notes:        act.Description,
			})
		}
	}

	sort.Slice(txs, func(i, j int) bool {
		if txs[i].ExecutedAt.Equal(txs[j].ExecutedAt) {
			return txs[i].ExternalID < txs[j].ExternalID
		}
		return txs[i].ExecutedAt.Before(txs[j].ExecutedAt)
	})

	return txs, nil
}

func parseActivities(respBytes []byte) ([]snapTradeActivity, error) {
	var direct []snapTradeActivity
	if err := json.Unmarshal(respBytes, &direct); err == nil {
		return direct, nil
	}

	var envelope struct {
		Data       []snapTradeActivity `json:"data"`
		Activities []snapTradeActivity `json:"activities"`
	}
	if err := json.Unmarshal(respBytes, &envelope); err == nil {
		if len(envelope.Data) > 0 {
			return envelope.Data, nil
		}
		if len(envelope.Activities) > 0 {
			return envelope.Activities, nil
		}
	}

	return nil, fmt.Errorf("failed to parse activities response")
}

func parseDecimalValue(v any) (decimal.Decimal, bool) {
	if v == nil {
		return decimal.Zero, false
	}
	switch val := v.(type) {
	case float64:
		return decimal.NewFromFloat(val), true
	case float32:
		return decimal.NewFromFloat(float64(val)), true
	case int:
		return decimal.NewFromInt(int64(val)), true
	case int64:
		return decimal.NewFromInt(val), true
	case string:
		d, err := decimal.NewFromString(strings.TrimSpace(val))
		if err == nil {
			return d, true
		}
	case json.Number:
		d, err := decimal.NewFromString(val.String())
		if err == nil {
			return d, true
		}
	}
	return decimal.Zero, false
}

func parseSnapTradeTime(timeStr string) time.Time {
	timeStr = strings.TrimSpace(timeStr)
	if timeStr == "" {
		return time.Time{}
	}
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, timeStr); err == nil {
			return t
		}
	}
	return time.Time{}
}
