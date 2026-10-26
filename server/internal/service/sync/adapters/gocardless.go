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
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"
)

const (
	defaultGoCardlessBaseURL = "https://bankaccountdata.gocardless.com"
	defaultGoCardlessTimeout = 30 * time.Second
)

type gcCachedToken struct {
	accessToken string
	expiresAt   time.Time
}

// GoCardlessAdapter implements syncservice.SyncAdapter for European Open Banking via GoCardless Bank Account Data API.
type GoCardlessAdapter struct {
	baseURL    string
	httpClient *http.Client
	timeNow    func() time.Time
	tokenCache sync.Map // map[string]*gcCachedToken
}

// NewGoCardlessAdapter creates a new GoCardlessAdapter instance.
func NewGoCardlessAdapter(opts ...GoCardlessOption) *GoCardlessAdapter {
	g := &GoCardlessAdapter{
		baseURL: defaultGoCardlessBaseURL,
		httpClient: &http.Client{
			Timeout: defaultGoCardlessTimeout,
		},
		timeNow: time.Now,
	}
	for _, opt := range opts {
		opt(g)
	}
	return g
}

// Provider returns the provider identifier string.
func (g *GoCardlessAdapter) Provider() string {
	return model.SyncProviderGoCardless
}

type goCardlessCredentials struct {
	SecretID         string   `json:"secretId"`
	SecretIDAlt      string   `json:"secret_id"`
	SecretKey        string   `json:"secretKey"`
	SecretKeyAlt     string   `json:"secret_key"`
	RequisitionID    string   `json:"requisitionId"`
	RequisitionIDAlt string   `json:"requisition_id"`
	AccessToken      string   `json:"accessToken"`
	AccessTokenAlt   string   `json:"access_token"`
	RefreshToken     string   `json:"refreshToken"`
	RefreshTokenAlt  string   `json:"refresh_token"`
	AccountIDs       []string `json:"accounts"`
}

func (g *GoCardlessAdapter) parseCredentials(cred *model.SyncCredential) (*goCardlessCredentials, error) {
	if cred == nil {
		return nil, syncservice.ErrInvalidCredentials
	}

	rawJSON, err := cred.Decrypt()
	if err != nil || strings.TrimSpace(rawJSON) == "" {
		return nil, syncservice.ErrInvalidCredentials
	}

	var parsed goCardlessCredentials
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return nil, fmt.Errorf("%w: failed to parse credential json", syncservice.ErrInvalidCredentials)
	}

	secretID := parsed.SecretID
	if secretID == "" {
		secretID = parsed.SecretIDAlt
	}

	secretKey := parsed.SecretKey
	if secretKey == "" {
		secretKey = parsed.SecretKeyAlt
	}

	reqID := parsed.RequisitionID
	if reqID == "" {
		reqID = parsed.RequisitionIDAlt
	}

	accessToken := parsed.AccessToken
	if accessToken == "" {
		accessToken = parsed.AccessTokenAlt
	}

	refreshToken := parsed.RefreshToken
	if refreshToken == "" {
		refreshToken = parsed.RefreshTokenAlt
	}

	if secretID == "" && accessToken == "" {
		return nil, syncservice.ErrInvalidCredentials
	}

	return &goCardlessCredentials{
		SecretID:      secretID,
		SecretKey:     secretKey,
		RequisitionID: reqID,
		AccessToken:   accessToken,
		RefreshToken:  refreshToken,
		AccountIDs:    parsed.AccountIDs,
	}, nil
}

type gcTokenResponse struct {
	Access         string `json:"access"`
	AccessExpires  int    `json:"access_expires"`
	Refresh        string `json:"refresh"`
	RefreshExpires int    `json:"refresh_expires"`
}

func (g *GoCardlessAdapter) getAccessToken(ctx context.Context, creds *goCardlessCredentials) (string, error) {
	// If secret credentials are empty but an access token is provided, use it
	if creds.SecretID == "" && creds.SecretKey == "" {
		if creds.AccessToken != "" {
			return creds.AccessToken, nil
		}
		return "", syncservice.ErrInvalidCredentials
	}

	// Check token cache for secret ID
	if creds.SecretID != "" {
		if val, ok := g.tokenCache.Load(creds.SecretID); ok {
			cached := val.(*gcCachedToken)
			if g.timeNow().Before(cached.expiresAt) {
				return cached.accessToken, nil
			}
		}
	}

	// If explicit token provided on first call, try it
	if creds.AccessToken != "" {
		return creds.AccessToken, nil
	}

	// Obtain a new token via /api/v2/token/new/
	return g.requestNewToken(ctx, creds)
}

func (g *GoCardlessAdapter) requestNewToken(ctx context.Context, creds *goCardlessCredentials) (string, error) {
	if creds.SecretID == "" || creds.SecretKey == "" {
		return "", syncservice.ErrInvalidCredentials
	}

	payload := map[string]string{
		"secret_id":  creds.SecretID,
		"secret_key": creds.SecretKey,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal token payload: %w", err)
	}

	reqURL := fmt.Sprintf("%s/api/v2/token/new/", g.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("gocardless token request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read token response body: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", syncservice.ErrRateLimited
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", syncservice.ErrInvalidCredentials
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", g.parseAPIError(resp.StatusCode, respBytes)
	}

	var tokResp gcTokenResponse
	if err := json.Unmarshal(respBytes, &tokResp); err != nil {
		return "", fmt.Errorf("failed to parse token response: %w", err)
	}

	if tokResp.Access == "" {
		return "", fmt.Errorf("%w: empty access token in response", syncservice.ErrInvalidCredentials)
	}

	expiresIn := tokResp.AccessExpires
	if expiresIn <= 0 {
		expiresIn = 86400
	}
	cacheExpiry := g.timeNow().Add(time.Duration(expiresIn-60) * time.Second)
	g.tokenCache.Store(creds.SecretID, &gcCachedToken{
		accessToken: tokResp.Access,
		expiresAt:   cacheExpiry,
	})

	return tokResp.Access, nil
}

func (g *GoCardlessAdapter) executeRequest(
	ctx context.Context,
	creds *goCardlessCredentials,
	method string,
	path string,
	queryParams url.Values,
	reqBody any,
) ([]byte, error) {
	token, err := g.getAccessToken(ctx, creds)
	if err != nil {
		return nil, err
	}

	respBytes, statusCode, err := g.doHTTP(ctx, token, method, path, queryParams, reqBody)
	if err != nil {
		return nil, err
	}

	// If 401 Unauthorized and secret credentials exist, invalidate cache and retry once
	if statusCode == http.StatusUnauthorized && creds.SecretID != "" && creds.SecretKey != "" {
		g.tokenCache.Delete(creds.SecretID)
		creds.AccessToken = ""

		freshToken, refreshErr := g.requestNewToken(ctx, creds)
		if refreshErr != nil {
			return nil, refreshErr
		}

		respBytes, statusCode, err = g.doHTTP(ctx, freshToken, method, path, queryParams, reqBody)
		if err != nil {
			return nil, err
		}
	}

	if statusCode == http.StatusTooManyRequests {
		return nil, syncservice.ErrRateLimited
	}
	if statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden {
		return nil, syncservice.ErrInvalidCredentials
	}
	if statusCode < 200 || statusCode >= 300 {
		return nil, g.parseAPIError(statusCode, respBytes)
	}

	return respBytes, nil
}

func (g *GoCardlessAdapter) doHTTP(
	ctx context.Context,
	token string,
	method string,
	path string,
	queryParams url.Values,
	reqBody any,
) ([]byte, int, error) {
	reqURL := fmt.Sprintf("%s%s", g.baseURL, path)
	if len(queryParams) > 0 {
		reqURL += "?" + queryParams.Encode()
	}

	var bodyReader io.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, bodyReader)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create http request: %w", err)
	}

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "application/json")
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("gocardless http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response body: %w", err)
	}

	return respBytes, resp.StatusCode, nil
}

func (g *GoCardlessAdapter) parseAPIError(statusCode int, body []byte) error {
	var errPayload struct {
		Summary    string `json:"summary"`
		Detail     string `json:"detail"`
		StatusCode int    `json:"status_code"`
		Error      string `json:"error"`
		Message    string `json:"message"`
	}
	if err := json.Unmarshal(body, &errPayload); err == nil {
		combined := strings.ToLower(fmt.Sprintf("%s %s %s %s", errPayload.Summary, errPayload.Detail, errPayload.Error, errPayload.Message))
		if strings.Contains(combined, "rate limit") || strings.Contains(combined, "throttled") {
			return syncservice.ErrRateLimited
		}
		if strings.Contains(combined, "unauthorized") || strings.Contains(combined, "invalid") || strings.Contains(combined, "forbidden") || strings.Contains(combined, "token_not_valid") {
			return syncservice.ErrInvalidCredentials
		}
	}
	return fmt.Errorf("gocardless api error (status %d): %s", statusCode, string(body))
}

// TestConnection verifies that the provided credentials can successfully communicate with GoCardless API.
func (g *GoCardlessAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	creds, err := g.parseCredentials(cred)
	if err != nil {
		return err
	}

	if creds.RequisitionID != "" {
		path := fmt.Sprintf("/api/v2/requisitions/%s/", url.PathEscape(creds.RequisitionID))
		_, err := g.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
		return err
	}

	if creds.SecretID != "" && creds.SecretKey != "" {
		_, err := g.requestNewToken(ctx, creds)
		return err
	}

	if creds.AccessToken != "" {
		_, err := g.executeRequest(ctx, creds, http.MethodGet, "/api/v2/requisitions/", nil, nil)
		return err
	}

	return syncservice.ErrInvalidCredentials
}

// CreateRequisition creates a GoCardless requisition link for user bank authentication.
func (g *GoCardlessAdapter) CreateRequisition(
	ctx context.Context,
	cred *model.SyncCredential,
	institutionID string,
	redirectURL string,
) (string, string, error) {
	if strings.TrimSpace(institutionID) == "" {
		return "", "", errors.New("institution ID is required")
	}
	if strings.TrimSpace(redirectURL) == "" {
		return "", "", errors.New("redirect URL is required")
	}

	creds, err := g.parseCredentials(cred)
	if err != nil {
		return "", "", err
	}

	payload := map[string]string{
		"institution_id": institutionID,
		"redirect":       redirectURL,
	}

	respBytes, err := g.executeRequest(ctx, creds, http.MethodPost, "/api/v2/requisitions/", nil, payload)
	if err != nil {
		return "", "", err
	}

	var res struct {
		ID   string `json:"id"`
		Link string `json:"link"`
	}
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return "", "", fmt.Errorf("failed to parse requisition response: %w", err)
	}

	if res.ID == "" {
		return "", "", errors.New("empty requisition id in response")
	}

	return res.ID, res.Link, nil
}

type gcRequisitionResponse struct {
	ID            string   `json:"id"`
	Status        string   `json:"status"`
	InstitutionID string   `json:"institution_id"`
	Accounts      []string `json:"accounts"`
}

type gcAccountResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Product       string `json:"product"`
	InstitutionID string `json:"institution_id"`
	IBAN          string `json:"iban"`
	BBAN          string `json:"bban"`
	Currency      string `json:"currency"`
	OwnerName     string `json:"owner_name"`
	Status        string `json:"status"`
}

// FetchAccounts queries GoCardless for discovered user bank accounts under the requisition.
func (g *GoCardlessAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	creds, err := g.parseCredentials(cred)
	if err != nil {
		return nil, err
	}

	var accountIDs []string
	var defaultInstitution string

	if creds.RequisitionID != "" {
		path := fmt.Sprintf("/api/v2/requisitions/%s/", url.PathEscape(creds.RequisitionID))
		respBytes, err := g.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
		if err != nil {
			return nil, err
		}

		var reqResp gcRequisitionResponse
		if err := json.Unmarshal(respBytes, &reqResp); err != nil {
			return nil, fmt.Errorf("failed to parse requisition: %w", err)
		}
		accountIDs = reqResp.Accounts
		defaultInstitution = reqResp.InstitutionID
	} else if len(creds.AccountIDs) > 0 {
		accountIDs = creds.AccountIDs
	} else {
		return nil, fmt.Errorf("%w: requisition ID or account IDs required", syncservice.ErrInvalidCredentials)
	}

	var rawAccounts []syncservice.RawAccount
	for _, accID := range accountIDs {
		path := fmt.Sprintf("/api/v2/accounts/%s/", url.PathEscape(accID))
		respBytes, err := g.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
		if err != nil {
			return nil, err
		}

		var accResp gcAccountResponse
		if err := json.Unmarshal(respBytes, &accResp); err != nil {
			return nil, fmt.Errorf("failed to parse account %s metadata: %w", accID, err)
		}

		institutionID := accResp.InstitutionID
		if institutionID == "" {
			institutionID = defaultInstitution
		}

		name := accResp.Name
		if name == "" {
			name = accResp.Product
		}
		if name == "" {
			name = accResp.OwnerName
		}
		if name == "" && accResp.IBAN != "" {
			name = fmt.Sprintf("Bank Account (%s)", accResp.IBAN)
		}
		if name == "" {
			name = fmt.Sprintf("%s Account", institutionID)
		}

		curr := strings.ToUpper(strings.TrimSpace(accResp.Currency))
		if curr == "" {
			curr = string(model.CurrencyEUR)
		}

		accountNumber := accResp.IBAN
		if accountNumber == "" {
			accountNumber = accResp.BBAN
		}
		if accountNumber == "" {
			accountNumber = accID
		}

		rawAccounts = append(rawAccounts, syncservice.RawAccount{
			ExternalID:    accID,
			Name:          name,
			Type:          model.AccountTypeBank,
			TaxWrapper:    model.TaxWrapperStandardTaxable,
			Institution:   institutionID,
			AccountNumber: accountNumber,
			Currency:      model.Currency(curr),
		})
	}

	sort.Slice(rawAccounts, func(i, j int) bool {
		return rawAccounts[i].ExternalID < rawAccounts[j].ExternalID
	})

	return rawAccounts, nil
}

type gcBalanceItem struct {
	BalanceAmount struct {
		Amount   any    `json:"amount"`
		Currency string `json:"currency"`
	} `json:"balanceAmount"`
	BalanceType   string `json:"balanceType"`
	ReferenceDate string `json:"referenceDate"`
}

type gcBalancesResponse struct {
	Balances []gcBalanceItem `json:"balances"`
}

// FetchBalances queries /api/v2/accounts/{id}/balances/ and returns cash balances.
func (g *GoCardlessAdapter) FetchBalances(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
) ([]syncservice.RawBalance, error) {
	creds, err := g.parseCredentials(cred)
	if err != nil {
		return nil, err
	}

	if externalAccountID == "" {
		return nil, errors.New("external account ID is required")
	}

	path := fmt.Sprintf("/api/v2/accounts/%s/balances/", url.PathEscape(externalAccountID))
	respBytes, err := g.executeRequest(ctx, creds, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	var balResp gcBalancesResponse
	if err := json.Unmarshal(respBytes, &balResp); err != nil {
		return nil, fmt.Errorf("failed to parse balances response: %w", err)
	}

	type currencyBalances struct {
		booked    *decimal.Decimal
		available *decimal.Decimal
	}
	grouped := make(map[string]*currencyBalances)

	for _, item := range balResp.Balances {
		currCode := strings.ToUpper(strings.TrimSpace(item.BalanceAmount.Currency))
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}

		amt, ok := parseDecimalValue(item.BalanceAmount.Amount)
		if !ok {
			continue
		}

		cb, exists := grouped[currCode]
		if !exists {
			cb = &currencyBalances{}
			grouped[currCode] = cb
		}

		bType := strings.ToLower(strings.TrimSpace(item.BalanceType))
		switch bType {
		case "closingbooked", "booked", "interimbooked", "openingbooked":
			if cb.booked == nil {
				cb.booked = &amt
			}
		case "interimavailable", "closingavailable", "available", "expected":
			if cb.available == nil {
				cb.available = &amt
			}
		default:
			if cb.booked == nil {
				cb.booked = &amt
			}
		}
	}

	var rawBalances []syncservice.RawBalance
	for curr, cb := range grouped {
		var amt decimal.Decimal
		var avail *decimal.Decimal

		if cb.booked != nil {
			amt = *cb.booked
			if cb.available != nil {
				avail = cb.available
			} else {
				avail = cb.booked
			}
		} else if cb.available != nil {
			amt = *cb.available
			avail = cb.available
		} else {
			continue
		}

		rawBalances = append(rawBalances, syncservice.RawBalance{
			Currency:  model.Currency(curr),
			Amount:    amt,
			Available: avail,
		})
	}

	sort.Slice(rawBalances, func(i, j int) bool {
		return rawBalances[i].Currency < rawBalances[j].Currency
	})

	return rawBalances, nil
}

// FetchHoldings returns an empty slice for retail bank accounts as they hold cash rather than securities.
func (g *GoCardlessAdapter) FetchHoldings(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
) ([]syncservice.RawHolding, error) {
	if _, err := g.parseCredentials(cred); err != nil {
		return nil, err
	}
	return []syncservice.RawHolding{}, nil
}

type gcTransactionItem struct {
	TransactionID                         string `json:"transactionId"`
	InternalTransactionID                 string `json:"internalTransactionId"`
	BookingDate                           string `json:"bookingDate"`
	BookingDateTime                       string `json:"bookingDateTime"`
	ValueDate                             string `json:"valueDate"`
	ValueDateTime                         string `json:"valueDateTime"`
	TransactionAmount                     struct {
		Amount   any    `json:"amount"`
		Currency string `json:"currency"`
	} `json:"transactionAmount"`
	RemittanceInformationUnstructured      string   `json:"remittanceInformationUnstructured"`
	RemittanceInformationUnstructuredArray []string `json:"remittanceInformationUnstructuredArray"`
	DebtorName                            string   `json:"debtorName"`
	CreditorName                          string   `json:"creditorName"`
	ProprietaryBankTransactionCode        string   `json:"proprietaryBankTransactionCode"`
}

type gcTransactionsResponse struct {
	Transactions struct {
		Booked  []gcTransactionItem `json:"booked"`
		Pending []gcTransactionItem `json:"pending"`
	} `json:"transactions"`
}

// FetchTransactions queries /api/v2/accounts/{id}/transactions/ and returns normalized transactions.
func (g *GoCardlessAdapter) FetchTransactions(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
	since *time.Time,
) ([]syncservice.RawTransaction, error) {
	creds, err := g.parseCredentials(cred)
	if err != nil {
		return nil, err
	}

	if externalAccountID == "" {
		return nil, errors.New("external account ID is required")
	}

	queryParams := url.Values{}
	if since != nil {
		queryParams.Set("date_from", since.Format("2006-01-02"))
	}

	path := fmt.Sprintf("/api/v2/accounts/%s/transactions/", url.PathEscape(externalAccountID))
	respBytes, err := g.executeRequest(ctx, creds, http.MethodGet, path, queryParams, nil)
	if err != nil {
		return nil, err
	}

	var txResp gcTransactionsResponse
	if err := json.Unmarshal(respBytes, &txResp); err != nil {
		return nil, fmt.Errorf("failed to parse transactions response: %w", err)
	}

	var rawTxs []syncservice.RawTransaction
	for _, item := range txResp.Transactions.Booked {
		amtVal, ok := parseDecimalValue(item.TransactionAmount.Amount)
		if !ok || amtVal.IsZero() {
			continue
		}

		extID := item.InternalTransactionID
		if extID == "" {
			extID = item.TransactionID
		}

		currCode := strings.ToUpper(strings.TrimSpace(item.TransactionAmount.Currency))
		if currCode == "" {
			currCode = string(model.CurrencyEUR)
		}
		curr := model.Currency(currCode)

		notes := item.RemittanceInformationUnstructured
		if notes == "" && len(item.RemittanceInformationUnstructuredArray) > 0 {
			notes = strings.Join(item.RemittanceInformationUnstructuredArray, " ")
		}
		if notes == "" {
			if item.CreditorName != "" {
				notes = item.CreditorName
			} else if item.DebtorName != "" {
				notes = item.DebtorName
			} else if item.ProprietaryBankTransactionCode != "" {
				notes = item.ProprietaryBankTransactionCode
			}
		}

		execDate := parseGCTime(item.BookingDateTime)
		if execDate.IsZero() {
			execDate = parseGCTime(item.BookingDate)
		}
		if execDate.IsZero() {
			execDate = parseGCTime(item.ValueDateTime)
		}
		if execDate.IsZero() {
			execDate = parseGCTime(item.ValueDate)
		}
		if execDate.IsZero() {
			execDate = g.timeNow()
		}

		var txType model.TransactionType
		var cents model.Money

		if amtVal.IsPositive() {
			txType = model.TransactionTypeDeposit
			cents = model.Money(amtVal.Mul(decimal.NewFromInt(100)).IntPart())
			if cents <= 0 {
				cents = 1
			}
		} else {
			txType = model.TransactionTypeWithdrawal
			cents = -model.Money(amtVal.Abs().Mul(decimal.NewFromInt(100)).IntPart())
			if cents >= 0 {
				cents = -1
			}
		}

		rawTxs = append(rawTxs, syncservice.RawTransaction{
			ExternalID: extID,
			Type:       txType,
			Name:       notes,
			Amount:     cents,
			Currency:   curr,
			ExecutedAt: execDate,
			Notes:      notes,
		})
	}

	sort.Slice(rawTxs, func(i, j int) bool {
		if rawTxs[i].ExecutedAt.Equal(rawTxs[j].ExecutedAt) {
			return rawTxs[i].ExternalID < rawTxs[j].ExternalID
		}
		return rawTxs[i].ExecutedAt.Before(rawTxs[j].ExecutedAt)
	})

	return rawTxs, nil
}

func parseGCTime(timeStr string) time.Time {
	timeStr = strings.TrimSpace(timeStr)
	if timeStr == "" {
		return time.Time{}
	}
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02",
	}
	for _, layout := range formats {
		if t, err := time.Parse(layout, timeStr); err == nil {
			return t.UTC()
		}
	}
	return time.Time{}
}
