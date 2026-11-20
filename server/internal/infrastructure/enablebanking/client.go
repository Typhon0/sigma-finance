package enablebanking

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	DefaultBaseURL = "https://api.enablebanking.com"
	DefaultTimeout = 30 * time.Second
)

var (
	// ErrUnauthorized indicates invalid JWT or credentials (HTTP 401/403).
	ErrUnauthorized = errors.New("enable banking authentication failed")

	// ErrConsentExpired indicates bank consent expired or was revoked.
	ErrConsentExpired = errors.New("enable banking consent expired or revoked")

	// ErrRateLimited indicates API rate limit reached (HTTP 429).
	ErrRateLimited = errors.New("enable banking rate limit reached")

	// ErrEmptyAccounts indicates the bank session returned no accounts.
	ErrEmptyAccounts = errors.New("enable banking session returned no accounts (verify account is whitelisted in Enable Banking Control Panel)")
)

// ClientOption configures the Enable Banking client.
type ClientOption func(*Client)

// Client handles HTTP interactions with Enable Banking API.
type Client struct {
	baseURL       string
	httpClient    *http.Client
	applicationID string
	privateKeyPEM string
	timeNow       func() time.Time
}

// WithBaseURL overrides the default API base URL.
func WithBaseURL(baseURL string) ClientOption {
	return func(c *Client) {
		if strings.TrimSpace(baseURL) != "" {
			c.baseURL = strings.TrimRight(baseURL, "/")
		}
	}
}

// WithHTTPClient overrides the default http.Client.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *Client) {
		if httpClient != nil {
			c.httpClient = httpClient
		}
	}
}

// WithTimeNow overrides time.Now for deterministic testing.
func WithTimeNow(timeNow func() time.Time) ClientOption {
	return func(c *Client) {
		if timeNow != nil {
			c.timeNow = timeNow
		}
	}
}

// NewClient creates a new Enable Banking API client.
func NewClient(applicationID string, privateKeyPEM string, opts ...ClientOption) *Client {
	c := &Client{
		baseURL: DefaultBaseURL,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
		applicationID: applicationID,
		privateKeyPEM: privateKeyPEM,
		timeNow:       time.Now,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) doRequest(ctx context.Context, method string, path string, queryParams url.Values, reqBody any) ([]byte, error) {
	token, err := GenerateJWT(c.applicationID, c.privateKeyPEM, 1*time.Hour, c.timeNow())
	if err != nil {
		return nil, fmt.Errorf("failed to generate authorization token: %w", err)
	}

	reqURL := fmt.Sprintf("%s%s", c.baseURL, path)
	if len(queryParams) > 0 {
		reqURL += "?" + queryParams.Encode()
	}

	var bodyReader io.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("enable banking http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrRateLimited
	}

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		bodyStr := strings.ToLower(string(respBytes))
		if strings.Contains(bodyStr, "consent") || strings.Contains(bodyStr, "expired") || strings.Contains(bodyStr, "revoked") {
			return nil, ErrConsentExpired
		}
		return nil, ErrUnauthorized
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr APIError
		if err := json.Unmarshal(respBytes, &apiErr); err == nil && (apiErr.Message != "" || apiErr.ErrorCode != "") {
			if apiErr.StatusCode == 0 {
				apiErr.StatusCode = resp.StatusCode
			}
			return nil, &apiErr
		}
		return nil, fmt.Errorf("enable banking api error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	return respBytes, nil
}

// GetASPSPs discovers available financial institutions, optionally filtered by country.
func (c *Client) GetASPSPs(ctx context.Context, country string) ([]ASPSP, error) {
	queryParams := url.Values{}
	if strings.TrimSpace(country) != "" {
		queryParams.Set("country", strings.ToUpper(strings.TrimSpace(country)))
	}

	respBytes, err := c.doRequest(ctx, http.MethodGet, "/aspsps", queryParams, nil)
	if err != nil {
		return nil, err
	}

	var res ASPSPsResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		// Some endpoints return a direct array
		var directList []ASPSP
		if directErr := json.Unmarshal(respBytes, &directList); directErr == nil {
			return directList, nil
		}
		return nil, fmt.Errorf("failed to parse aspsps response: %w", err)
	}

	return res.ASPSPs, nil
}

// GetApplication returns the application metadata associated with the client's JWT key ID.
func (c *Client) GetApplication(ctx context.Context) (*ApplicationResponse, error) {
	respBytes, err := c.doRequest(ctx, http.MethodGet, "/application", nil, nil)
	if err != nil {
		return nil, err
	}

	var res ApplicationResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse application response: %w", err)
	}

	return &res, nil
}

// StartAuthorization initiates the OAuth authorization flow for an ASPSP.
func (c *Client) StartAuthorization(ctx context.Context, req StartAuthRequest) (*StartAuthResponse, error) {
	if strings.TrimSpace(req.ASPSP.Name) == "" {
		return nil, errors.New("ASPSP name is required")
	}
	if strings.TrimSpace(req.RedirectURL) == "" {
		return nil, errors.New("redirect URL is required")
	}
	if strings.TrimSpace(req.State) == "" {
		return nil, errors.New("state is required")
	}

	respBytes, err := c.doRequest(ctx, http.MethodPost, "/auth", nil, req)
	if err != nil {
		return nil, err
	}

	var res StartAuthResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse auth response: %w", err)
	}

	if res.URL == "" {
		return nil, errors.New("empty authorization url in response")
	}

	return &res, nil
}

// AuthorizeSession exchanges an authorization code for a session ID and accessible accounts.
func (c *Client) AuthorizeSession(ctx context.Context, code string) (*SessionResponse, error) {
	if strings.TrimSpace(code) == "" {
		return nil, errors.New("authorization code is required")
	}

	payload := AuthorizeSessionRequest{Code: code}
	respBytes, err := c.doRequest(ctx, http.MethodPost, "/sessions", nil, payload)
	if err != nil {
		return nil, err
	}

	var res SessionResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse session response: %w", err)
	}

	return &res, nil
}

// GetSession retrieves session details and accessible accounts.
func (c *Client) GetSession(ctx context.Context, sessionID string) (*SessionResponse, error) {
	if strings.TrimSpace(sessionID) == "" {
		return nil, errors.New("session ID is required")
	}

	path := fmt.Sprintf("/sessions/%s", url.PathEscape(sessionID))
	respBytes, err := c.doRequest(ctx, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	var res SessionResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse session details: %w", err)
	}

	return &res, nil
}

// PollSessionUntilReady polls GetSession up to maxAttempts with a delay if accounts are empty.
func (c *Client) PollSessionUntilReady(ctx context.Context, sessionID string, maxAttempts int, delay time.Duration) (*SessionResponse, error) {
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	if delay <= 0 {
		delay = 1500 * time.Millisecond
	}

	var lastRes *SessionResponse
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		res, err := c.GetSession(ctx, sessionID)
		if err != nil {
			return nil, err
		}
		lastRes = res
		if len(res.AccountIDs()) > 0 {
			return res, nil
		}

		if attempt < maxAttempts {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}
	}

	if lastRes != nil && len(lastRes.AccountIDs()) == 0 {
		return lastRes, ErrEmptyAccounts
	}

	return lastRes, nil
}

// GetAccountDetails fetches metadata (IBAN, BBAN, name, product, currency) for a specific account.
func (c *Client) GetAccountDetails(ctx context.Context, accountID string) (*AccountDetailsResponse, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, errors.New("account ID is required")
	}

	path := fmt.Sprintf("/accounts/%s/details", url.PathEscape(accountID))
	respBytes, err := c.doRequest(ctx, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	var res AccountDetailsResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse account details: %w", err)
	}

	return &res, nil
}

// GetBalances fetches closing booked and available cash balances for an account.
func (c *Client) GetBalances(ctx context.Context, accountID string) ([]BalanceItem, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, errors.New("account ID is required")
	}

	path := fmt.Sprintf("/accounts/%s/balances", url.PathEscape(accountID))
	respBytes, err := c.doRequest(ctx, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, err
	}

	var res BalancesResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		// Some responses might be a raw array
		var directList []BalanceItem
		if directErr := json.Unmarshal(respBytes, &directList); directErr == nil {
			return directList, nil
		}
		return nil, fmt.Errorf("failed to parse balances response: %w", err)
	}

	return res.Balances, nil
}

// GetTransactions fetches paginated booked transactions for an account.
func (c *Client) GetTransactions(ctx context.Context, accountID string, dateFrom string, continuationKey string) (*TransactionsResponse, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, errors.New("account ID is required")
	}

	queryParams := url.Values{}
	queryParams.Set("transaction_status", "BOOK")
	if strings.TrimSpace(dateFrom) != "" {
		queryParams.Set("date_from", dateFrom)
	}
	if strings.TrimSpace(continuationKey) != "" {
		queryParams.Set("continuation_key", continuationKey)
	}

	path := fmt.Sprintf("/accounts/%s/transactions", url.PathEscape(accountID))
	respBytes, err := c.doRequest(ctx, http.MethodGet, path, queryParams, nil)
	if err != nil {
		return nil, err
	}

	var res TransactionsResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse transactions response: %w", err)
	}

	return &res, nil
}
