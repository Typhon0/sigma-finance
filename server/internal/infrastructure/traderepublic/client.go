package traderepublic

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

var (
	// ErrAccountLocked indicates another synchronization is already running for this account.
	ErrAccountLocked = errors.New("trade republic account is currently being synchronized by another operation")
)

// ClientOption configures optional parameters on Client.
type ClientOption func(*Client)

// WithWSEndpoint sets a custom WebSocket endpoint (useful for tests and mocks).
func WithWSEndpoint(endpoint string) ClientOption {
	return func(c *Client) {
		c.wsEndpoint = endpoint
	}
}

// WithAuthBaseURL sets a custom REST base URL.
func WithAuthBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.authBaseURL = url
	}
}

// WithWAFProvider sets a custom WAF token provider.
func WithWAFProvider(p WAFTokenProvider) ClientOption {
	return func(c *Client) {
		c.wafProvider = p
	}
}

// Client coordinates Trade Republic REST authentication and WebSocket data retrieval.
type Client struct {
	authBaseURL string
	wsEndpoint  string
	cookies     []*http.Cookie
	authClient  *AuthClient
	wafProvider WAFTokenProvider

	// Per-account concurrency locks to avoid close code 3003 collisions
	accountLocks sync.Map
}

// NewClient initializes a Trade Republic API client with session cookies.
func NewClient(cookies []*http.Cookie, opts ...ClientOption) *Client {
	c := &Client{
		authBaseURL: DefaultBaseURL,
		wsEndpoint:  DefaultWSEndpoint,
		cookies:     cookies,
	}
	for _, opt := range opts {
		opt(c)
	}

	c.authClient = NewAuthClient(c.authBaseURL, c.wafProvider, nil)
	return c
}

// Cookies returns the current session cookies.
func (c *Client) Cookies() []*http.Cookie {
	return c.cookies
}

// RefreshSession validates and refreshes session cookies with Trade Republic.
func (c *Client) RefreshSession(ctx context.Context) error {
	newCookies, err := c.authClient.RefreshSession(ctx, c.cookies)
	if err != nil {
		return err
	}
	c.cookies = newCookies
	return nil
}

// WithAccountLock executes an action while holding an exclusive lock for the given Trade Republic account.
func (c *Client) WithAccountLock(accountID string, fn func() error) error {
	lock, _ := c.accountLocks.LoadOrStore(accountID, &sync.Mutex{})
	mu := lock.(*sync.Mutex)

	if !mu.TryLock() {
		return fmt.Errorf("%w: %s", ErrAccountLocked, accountID)
	}
	defer mu.Unlock()

	return fn()
}

// DiscoverAccounts fetches the list of paired securities and cash accounts via WebSocket.
func (c *Client) DiscoverAccounts(ctx context.Context) (*AccountPairsResponse, error) {
	if c.authClient != nil {
		_ = c.RefreshSession(ctx)
	}
	ws := NewWSClient(c.wsEndpoint, c.cookies)
	if err := ws.Connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Trade Republic: %w", err)
	}
	defer ws.Close()

	var resp AccountPairsResponse
	subPayload := map[string]string{"type": "accountPairs"}
	if err := ws.FetchOne(ctx, subPayload, &resp); err != nil {
		return nil, fmt.Errorf("failed to fetch account pairs: %w", err)
	}

	return &resp, nil
}

// FetchCashBalances retrieves cash balances for accounts.
func (c *Client) FetchCashBalances(ctx context.Context, targetCashAccountID string) ([]CashItem, bool, error) {
	if c.authClient != nil {
		_ = c.RefreshSession(ctx)
	}
	ws := NewWSClient(c.wsEndpoint, c.cookies)
	if err := ws.Connect(ctx); err != nil {
		return nil, false, fmt.Errorf("failed to connect to Trade Republic: %w", err)
	}
	defer ws.Close()

	var rawItems []CashItem
	subPayload := map[string]string{"type": "cash"}
	if err := ws.FetchOne(ctx, subPayload, &rawItems); err != nil {
		return nil, false, fmt.Errorf("failed to fetch cash balances: %w", err)
	}

	if targetCashAccountID == "" {
		return rawItems, true, nil
	}

	// Filter for requested cash account ID if specified
	var filtered []CashItem
	for _, item := range rawItems {
		if item.AccountNumber == targetCashAccountID {
			filtered = append(filtered, item)
		}
	}

	// If filtered is empty but raw items exist, retain all to avoid dropping cash
	if len(filtered) == 0 && len(rawItems) > 0 {
		return rawItems, true, nil
	}

	return filtered, true, nil
}

// FetchHoldings retrieves positions for a specific securities account.
func (c *Client) FetchHoldings(ctx context.Context, secAccountNo string) ([]PortfolioPositionItem, bool, error) {
	if c.authClient != nil {
		_ = c.RefreshSession(ctx)
	}
	ws := NewWSClient(c.wsEndpoint, c.cookies)
	if err := ws.Connect(ctx); err != nil {
		return nil, false, fmt.Errorf("failed to connect to Trade Republic: %w", err)
	}
	defer ws.Close()

	type unifiedResponse struct {
		Categories []CompactPortfolioCategory `json:"categories"`
		Positions  []PortfolioPositionItem    `json:"positions"`
	}

	// 1. Try compactPortfolioByType first (active standard for protocol 31)
	var resp unifiedResponse
	subPayload := map[string]string{
		"type":     "compactPortfolioByType",
		"secAccNo": secAccountNo,
	}
	err := ws.FetchOne(ctx, subPayload, &resp)
	var positions []PortfolioPositionItem
	if err == nil {
		if len(resp.Categories) > 0 {
			for _, cat := range resp.Categories {
				for _, pos := range cat.Positions {
					if pos.InstrumentID == "" && pos.ISIN != "" {
						pos.InstrumentID = pos.ISIN
					}
					positions = append(positions, pos)
				}
			}
		} else if len(resp.Positions) > 0 {
			for _, pos := range resp.Positions {
				if pos.InstrumentID == "" && pos.ISIN != "" {
					pos.InstrumentID = pos.ISIN
				}
				positions = append(positions, pos)
			}
		}
	}

	if len(positions) == 0 {
		// 2. Fallback to legacy compactPortfolio
		var legacyResp unifiedResponse
		legacyPayload := map[string]string{
			"type":     "compactPortfolio",
			"secAccNo": secAccountNo,
		}
		if err := ws.FetchOne(ctx, legacyPayload, &legacyResp); err != nil {
			return nil, false, fmt.Errorf("failed to fetch compact portfolio: %w", err)
		}
		for _, pos := range legacyResp.Positions {
			if pos.InstrumentID == "" && pos.ISIN != "" {
				pos.InstrumentID = pos.ISIN
			}
			positions = append(positions, pos)
		}
	}

	// Enrich missing names via WebSocket instrument details
	for i := range positions {
		if positions[i].Name == "" && positions[i].InstrumentID != "" {
			var inst InstrumentResponse
			if err := ws.FetchOne(ctx, map[string]string{"type": "instrument", "id": positions[i].InstrumentID}, &inst); err == nil && inst.Name != "" {
				positions[i].Name = inst.Name
			}
		}
	}

	return positions, true, nil
}

// FetchInstrument retrieves metadata for a security or crypto asset by ISIN.
func (c *Client) FetchInstrument(ctx context.Context, isin string) (*InstrumentResponse, error) {
	if isin == "" {
		return nil, errors.New("isin cannot be empty")
	}
	if c.authClient != nil {
		_ = c.RefreshSession(ctx)
	}
	ws := NewWSClient(c.wsEndpoint, c.cookies)
	if err := ws.Connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Trade Republic: %w", err)
	}
	defer ws.Close()

	var resp InstrumentResponse
	subPayload := map[string]string{
		"type": "instrument",
		"id":   isin,
	}
	if err := ws.FetchOne(ctx, subPayload, &resp); err != nil {
		return nil, fmt.Errorf("failed to fetch instrument for %s: %w", isin, err)
	}
	return &resp, nil
}

// FetchTimeline multiplexes both timelineTransactions and timelineActivityLog on the SAME WebSocket connection.
func (c *Client) FetchTimeline(
	ctx context.Context,
	secAccountNo string,
	cursors SyncCursors,
	since *time.Time,
) (items []TimelineItem, nextCursors SyncCursors, isComplete bool, paginationDone bool, err error) {
	if c.authClient != nil {
		_ = c.RefreshSession(ctx)
	}
	ws := NewWSClient(c.wsEndpoint, c.cookies)
	if err := ws.Connect(ctx); err != nil {
		return nil, cursors, false, false, fmt.Errorf("failed to connect to Trade Republic: %w", err)
	}
	defer ws.Close()

	// 1. Subscribe to timelineTransactions on the shared connection
	txReq := map[string]interface{}{
		"type": "timelineTransactions",
	}
	if cursors.TimelineTransactionsCursor != nil && *cursors.TimelineTransactionsCursor != "" {
		txReq["after"] = *cursors.TimelineTransactionsCursor
	}

	txSubID, txFrames, err := ws.Subscribe(ctx, txReq)
	if err != nil {
		return nil, cursors, false, false, fmt.Errorf("failed to subscribe to timelineTransactions: %w", err)
	}
	defer ws.Unsubscribe(txSubID)

	// 2. Subscribe to timelineActivityLog on the SAME connection
	actReq := map[string]interface{}{
		"type": "timelineActivityLog",
	}
	if cursors.TimelineActivityLogCursor != nil && *cursors.TimelineActivityLogCursor != "" {
		actReq["after"] = *cursors.TimelineActivityLogCursor
	}

	actSubID, actFrames, err := ws.Subscribe(ctx, actReq)
	if err != nil {
		return nil, cursors, false, false, fmt.Errorf("failed to subscribe to timelineActivityLog: %w", err)
	}
	defer ws.Unsubscribe(actSubID)

	// Wait for answers on both streams
	var txResp TimelineTransactionsResponse
	var actResp TimelineActivityLogResponse

	gotTx := false
	gotAct := false
	timeout := time.After(25 * time.Second)

	for !gotTx || !gotAct {
		select {
		case <-ctx.Done():
			return nil, cursors, false, false, ctx.Err()
		case <-timeout:
			// If at least one responded, return partial result safely
			if gotTx || gotAct {
				break
			}
			return nil, cursors, false, false, ErrSubscriptionTimeout
		case frame, ok := <-txFrames:
			if !ok {
				gotTx = true
				break
			}
			if frame.Type == FrameAnswer || frame.Type == FrameDelta {
				if err := json.Unmarshal(frame.Payload, &txResp); err == nil {
					gotTx = true
				}
			}
		case frame, ok := <-actFrames:
			if !ok {
				gotAct = true
				break
			}
			if frame.Type == FrameAnswer || frame.Type == FrameDelta {
				if err := json.Unmarshal(frame.Payload, &actResp); err == nil {
					gotAct = true
				}
			}
		}
	}

	// Lossless aggregation: distinguish events across streams using composite stream-scoped keys
	seenKeys := make(map[string]bool)
	var merged []TimelineItem

	// Ingest cash movements from timelineTransactions
	if gotTx {
		for _, item := range txResp.Items {
			item.SourceStream = "timelineTransactions"
			key := "timelineTransactions:" + item.ID
			if item.ID != "" && !seenKeys[key] {
				seenKeys[key] = true
				if item.EventType == "" {
					item.EventType = "TIMELINE_TRANSACTION"
				}
				merged = append(merged, item)
			}
		}
	}

	// Ingest trades, dividends, and corporate actions from timelineActivityLog
	if gotAct {
		for _, item := range actResp.Items {
			item.SourceStream = "timelineActivityLog"
			key := "timelineActivityLog:" + item.ID
			if item.ID != "" && !seenKeys[key] {
				seenKeys[key] = true
				if item.EventType == "" {
					item.EventType = "TIMELINE_ACTIVITY"
				}
				merged = append(merged, item)
			}
		}
	}

	// Update independent cursors transactionally per stream
	nextCursors = cursors
	txDone := true
	actDone := true

	if gotTx {
		if txResp.Cursors != nil && txResp.Cursors.After != nil && *txResp.Cursors.After != "" {
			nextCursors.TimelineTransactionsCursor = txResp.Cursors.After
			txDone = false
		} else {
			emptyStr := ""
			nextCursors.TimelineTransactionsCursor = &emptyStr
			txDone = true
		}
	}

	if gotAct {
		if actResp.Cursors != nil && actResp.Cursors.After != nil && *actResp.Cursors.After != "" {
			nextCursors.TimelineActivityLogCursor = actResp.Cursors.After
			actDone = false
		} else {
			emptyStr := ""
			nextCursors.TimelineActivityLogCursor = &emptyStr
			actDone = true
		}
	}

	// Filter by 'since' timestamp if provided
	if since != nil && !since.IsZero() {
		var filtered []TimelineItem
		for _, item := range merged {
			t, err := parseTimestamp(item.Timestamp)
			if err == nil && t.Before(*since) {
				continue
			}
			filtered = append(filtered, item)
		}
		merged = filtered
	}

	paginationDone = txDone && actDone
	return merged, nextCursors, true, paginationDone, nil
}

// FetchTimelineDetail retrieves deep breakdown for an event.
func (c *Client) FetchTimelineDetail(ctx context.Context, detailID string) (*TimelineDetailV2Response, error) {
	ws := NewWSClient(c.wsEndpoint, c.cookies)
	if err := ws.Connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Trade Republic: %w", err)
	}
	defer ws.Close()

	var resp TimelineDetailV2Response
	subPayload := map[string]string{
		"type": "timelineDetailV2",
		"id":   detailID,
	}
	if err := ws.FetchOne(ctx, subPayload, &resp); err != nil {
		return nil, fmt.Errorf("failed to fetch timeline detail: %w", err)
	}

	return &resp, nil
}

// parseTimestamp converts ISO 8601 or epoch millis strings to time.Time.
func parseTimestamp(ts string) (time.Time, error) {
	if ts == "" {
		return time.Time{}, errors.New("empty timestamp")
	}
	// Try RFC3339 / ISO
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02T15:04:05.999Z07:00", ts); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02T15:04:05", ts)
}
