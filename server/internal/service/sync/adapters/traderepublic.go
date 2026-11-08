package adapters

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure/traderepublic"
	syncservice "sigma_finance/internal/service/sync"
)

var isinRegex = regexp.MustCompile(`\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b`)

// TradeRepublicOption configures optional parameters on TradeRepublicAdapter.
type TradeRepublicOption func(*TradeRepublicAdapter)

// WithTradeRepublicBaseURL overrides the default REST URL (for testing).
func WithTradeRepublicBaseURL(url string) TradeRepublicOption {
	return func(a *TradeRepublicAdapter) {
		a.authBaseURL = url
	}
}

// WithTradeRepublicWSEndpoint overrides the default WebSocket endpoint (for testing).
func WithTradeRepublicWSEndpoint(endpoint string) TradeRepublicOption {
	return func(a *TradeRepublicAdapter) {
		a.wsEndpoint = endpoint
	}
}

// WithTradeRepublicWAFProvider overrides the WAF token provider.
func WithTradeRepublicWAFProvider(p traderepublic.WAFTokenProvider) TradeRepublicOption {
	return func(a *TradeRepublicAdapter) {
		a.wafProvider = p
	}
}

// TradeRepublicAdapter implements syncservice.SyncAdapter for Trade Republic.
type TradeRepublicAdapter struct {
	authBaseURL string
	wsEndpoint  string
	wafProvider traderepublic.WAFTokenProvider
	client      *traderepublic.Client
}

// NewTradeRepublicAdapter creates a new TradeRepublicAdapter instance.
func NewTradeRepublicAdapter(opts ...TradeRepublicOption) *TradeRepublicAdapter {
	a := &TradeRepublicAdapter{
		authBaseURL: traderepublic.DefaultBaseURL,
		wsEndpoint:  traderepublic.DefaultWSEndpoint,
	}
	for _, opt := range opts {
		opt(a)
	}
	return a
}

// Provider returns the provider identifier string.
func (a *TradeRepublicAdapter) Provider() string {
	return model.SyncProviderTradeRepublic
}

// parseCredentials extracts session cookies from decrypted credential secret data.
func (a *TradeRepublicAdapter) parseCredentials(cred *model.SyncCredential) ([]*http.Cookie, error) {
	if cred == nil {
		return nil, syncservice.ErrInvalidCredentials
	}

	secretData := cred.RawData
	if secretData == "" {
		decrypted, err := cred.Decrypt()
		if err != nil {
			return nil, fmt.Errorf("%w: failed to decrypt credential: %v", syncservice.ErrInvalidCredentials, err)
		}
		secretData = decrypted
	}

	if strings.TrimSpace(secretData) == "" {
		return nil, fmt.Errorf("%w: empty secret data", syncservice.ErrInvalidCredentials)
	}

	// 1. Try JSON unmarshaling as SessionCookies
	var sc traderepublic.SessionCookies
	if err := json.Unmarshal([]byte(secretData), &sc); err == nil && sc.IsValid() {
		return sc.ToCookies(), nil
	}

	// 2. Try JSON unmarshaling as SavedCookies slice
	var savedCookies []traderepublic.SavedCookie
	if err := json.Unmarshal([]byte(secretData), &savedCookies); err == nil && len(savedCookies) > 0 {
		cookies := traderepublic.SavedToCookies(savedCookies)
		if traderepublic.ValidateSessionCookies(cookies) {
			return cookies, nil
		}
	}

	// 3. Try parsing as raw HTTP cookie header (e.g. JSESSIONID=...; tr_refresh=...; tr_device=...)
	header := http.Header{}
	header.Add("Cookie", secretData)
	req := &http.Request{Header: header}
	parsedCookies := req.Cookies()
	scParsed := traderepublic.ParseSessionCookies(parsedCookies)
	if scParsed.IsValid() {
		return scParsed.ToCookies(), nil
	}

	return nil, fmt.Errorf("%w: missing required Trade Republic session cookies (JSESSIONID, tr_refresh, tr_device)", syncservice.ErrInvalidCredentials)
}

// buildClient creates an infrastructure client configured with session cookies.
func (a *TradeRepublicAdapter) buildClient(cookies []*http.Cookie) *traderepublic.Client {
	var opts []traderepublic.ClientOption
	if a.authBaseURL != "" {
		opts = append(opts, traderepublic.WithAuthBaseURL(a.authBaseURL))
	}
	if a.wsEndpoint != "" {
		opts = append(opts, traderepublic.WithWSEndpoint(a.wsEndpoint))
	}
	if a.wafProvider != nil {
		opts = append(opts, traderepublic.WithWAFProvider(a.wafProvider))
	}
	return traderepublic.NewClient(cookies, opts...)
}

// updateCredWithRefreshedCookies updates the credential's RawData and re-encrypts if cookies were refreshed
func updateCredWithRefreshedCookies(cred *model.SyncCredential, cookies []*http.Cookie) {
	if cred == nil || len(cookies) == 0 {
		return
	}
	if refreshedJSON, err := json.Marshal(traderepublic.CookiesToSaved(cookies)); err == nil {
		cred.RawData = string(refreshedJSON)
		_ = cred.Encrypt()
	}
}

// TestConnection verifies that the Trade Republic session is still valid.
func (a *TradeRepublicAdapter) TestConnection(ctx context.Context, cred *model.SyncCredential) error {
	cookies, err := a.parseCredentials(cred)
	if err != nil {
		return err
	}

	client := a.buildClient(cookies)
	if err := client.RefreshSession(ctx); err != nil {
		if errors.Is(err, traderepublic.ErrSessionExpired) {
			return syncservice.ErrExpiredCredentials
		}
		return fmt.Errorf("session validation failed: %w", err)
	}

	updateCredWithRefreshedCookies(cred, client.Cookies())
	return nil
}

// FetchAccounts discovers all paired securities and cash accounts for the user with jurisdiction checks.
func (a *TradeRepublicAdapter) FetchAccounts(ctx context.Context, cred *model.SyncCredential) ([]syncservice.RawAccount, error) {
	cookies, err := a.parseCredentials(cred)
	if err != nil {
		return nil, err
	}

	client := a.buildClient(cookies)
	resp, err := client.DiscoverAccounts(ctx)
	if err != nil {
		if errors.Is(err, traderepublic.ErrSessionExpired) {
			return nil, syncservice.ErrExpiredCredentials
		}
		return nil, fmt.Errorf("failed to discover Trade Republic accounts: %w", err)
	}

	var rawAccounts []syncservice.RawAccount
	for _, acc := range resp.Accounts {
		currency := model.Currency(strings.ToUpper(strings.TrimSpace(acc.Currency)))
		if !currency.IsValid() {
			currency = model.CurrencyEUR
		}

		taxWrapper := model.TaxWrapperStandardTaxable
		accName := "Trade Republic Account"
		isFrenchJurisdiction := strings.EqualFold(strings.TrimSpace(acc.Jurisdiction), "FR")

		switch acc.ProductType {
		case "DEFAULT":
			accName = "Trade Republic CTO"
			taxWrapper = model.TaxWrapperStandardTaxable
		case "TAX_WRAPPER":
			if isFrenchJurisdiction {
				accName = "Trade Republic PEA"
				taxWrapper = model.TaxWrapperPEA
			} else {
				if acc.Jurisdiction != "" {
					accName = fmt.Sprintf("Trade Republic Tax Wrapper (%s)", acc.Jurisdiction)
				} else {
					accName = "Trade Republic Tax Wrapper"
				}
				taxWrapper = model.TaxWrapperStandardTaxable
			}
		default:
			if acc.ProductType != "" {
				accName = fmt.Sprintf("Trade Republic (%s)", acc.ProductType)
			}
			taxWrapper = model.TaxWrapperStandardTaxable
		}

		rawAccounts = append(rawAccounts, syncservice.RawAccount{
			ExternalID:        acc.SecuritiesAccountNumber,
			AccountNumber:     acc.SecuritiesAccountNumber,
			CashAccountNumber: acc.CashAccountNumber,
			Name:              accName,
			Type:              model.AccountTypeBroker,
			TaxWrapper:        taxWrapper,
			Institution:       "Trade Republic",
			Currency:          currency,
		})
	}

	return rawAccounts, nil
}

// FetchBalances retrieves cash balances for the paired cash account.
func (a *TradeRepublicAdapter) FetchBalances(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.BalancesSnapshot, error) {
	cookies, err := a.parseCredentials(cred)
	if err != nil {
		return syncservice.BalancesSnapshot{}, err
	}

	client := a.buildClient(cookies)
	var cashItems []traderepublic.CashItem
	var isComplete bool

	err = client.WithAccountLock(externalAccountID, func() error {
		var fetchErr error
		cashItems, isComplete, fetchErr = client.FetchCashBalances(ctx, externalAccountID)
		return fetchErr
	})
	if err != nil {
		if errors.Is(err, traderepublic.ErrSessionExpired) {
			return syncservice.BalancesSnapshot{}, syncservice.ErrExpiredCredentials
		}
		return syncservice.BalancesSnapshot{}, fmt.Errorf("failed to fetch cash balances: %w", err)
	}

	var balances []syncservice.RawBalance
	for _, item := range cashItems {
		curr := model.Currency(strings.ToUpper(strings.TrimSpace(item.CurrencyID)))
		if !curr.IsValid() {
			curr = model.CurrencyEUR
		}

		avail := item.Available
		if avail == nil {
			amt := item.Amount
			avail = &amt
		}

		balances = append(balances, syncservice.RawBalance{
			Currency:  curr,
			Amount:    item.Amount,
			Available: avail,
		})
	}

	return syncservice.BalancesSnapshot{
		Balances:   balances,
		IsComplete: isComplete,
		AsOf:       time.Now(),
	}, nil
}

// FetchHoldings retrieves investment positions for the securities account.
func (a *TradeRepublicAdapter) FetchHoldings(ctx context.Context, cred *model.SyncCredential, externalAccountID string) (syncservice.HoldingsSnapshot, error) {
	cookies, err := a.parseCredentials(cred)
	if err != nil {
		return syncservice.HoldingsSnapshot{}, err
	}

	client := a.buildClient(cookies)
	var positions []traderepublic.PortfolioPositionItem
	var isComplete bool

	err = client.WithAccountLock(externalAccountID, func() error {
		var fetchErr error
		positions, isComplete, fetchErr = client.FetchHoldings(ctx, externalAccountID)
		return fetchErr
	})
	if err != nil {
		if errors.Is(err, traderepublic.ErrSessionExpired) {
			return syncservice.HoldingsSnapshot{}, syncservice.ErrExpiredCredentials
		}
		return syncservice.HoldingsSnapshot{}, fmt.Errorf("failed to fetch holdings: %w", err)
	}

	var holdings []syncservice.RawHolding
	for _, pos := range positions {
		// Filter out zero or negative holding quantities
		if pos.NetSize.LessThanOrEqual(decimal.Zero) {
			continue
		}

		isin := strings.TrimSpace(pos.InstrumentID)
		name := strings.TrimSpace(pos.Name)
		if name == "" {
			name = isin
		}

		var totalCost *model.Money
		if pos.AverageBuyIn != nil {
			cost := model.FromDecimal(pos.NetSize.Mul(*pos.AverageBuyIn))
			totalCost = &cost
		}

		holdings = append(holdings, syncservice.RawHolding{
			ExternalID:       isin,
			Symbol:           isin,
			Name:             name,
			ISIN:             isin,
			AssetType:        model.AssetTypeStock,
			Quantity:         pos.NetSize,
			CostBasisPerUnit: pos.AverageBuyIn,
			TotalCostBasis:   totalCost,
			Currency:         model.CurrencyEUR,
		})
	}

	return syncservice.HoldingsSnapshot{
		Holdings:       holdings,
		IsComplete:     isComplete,
		PaginationDone: true,
		AsOf:           time.Now(),
	}, nil
}

// FetchTransactions retrieves historical movements multiplexing timelineTransactions and timelineActivityLog.
// Events are mapped accurately by source stream:
// - timelineTransactions: transfers, card transactions, deposits, interest, tax refunds
// - timelineActivityLog: trade invoices, executed orders, dividends, corporate actions
// Documents, notifications, and unexecuted/pending events are preserved in UnrecognizedEvents for audit.
func (a *TradeRepublicAdapter) FetchTransactions(
	ctx context.Context,
	cred *model.SyncCredential,
	externalAccountID string,
	since *time.Time,
	cursors syncservice.StreamCursors,
) (syncservice.TransactionsSnapshot, error) {
	cookies, err := a.parseCredentials(cred)
	if err != nil {
		return syncservice.TransactionsSnapshot{}, err
	}

	client := a.buildClient(cookies)

	trCursors := traderepublic.SyncCursors{}
	if c, ok := cursors["timeline_transactions_cursor"]; ok && c != "" {
		cur := c
		trCursors.TimelineTransactionsCursor = &cur
	}
	if c, ok := cursors["timeline_activity_log_cursor"]; ok && c != "" {
		cur := c
		trCursors.TimelineActivityLogCursor = &cur
	}

	var items []traderepublic.TimelineItem
	var nextCursors traderepublic.SyncCursors
	var isComplete, paginationDone bool

	err = client.WithAccountLock(externalAccountID, func() error {
		var fetchErr error
		items, nextCursors, isComplete, paginationDone, fetchErr = client.FetchTimeline(ctx, externalAccountID, trCursors, since)
		return fetchErr
	})
	if err != nil {
		if errors.Is(err, traderepublic.ErrSessionExpired) {
			return syncservice.TransactionsSnapshot{}, syncservice.ErrExpiredCredentials
		}
		return syncservice.TransactionsSnapshot{}, fmt.Errorf("failed to fetch timeline: %w", err)
	}

	var rawTxs []syncservice.RawTransaction
	var unrecognizedEvents []*model.SyncRawEvent

	for _, item := range items {
		rawBytes, _ := json.Marshal(item)
		status := strings.ToUpper(strings.TrimSpace(item.Status))

		execTime, err := parseTimelineTimestamp(item.Timestamp)
		if err != nil {
			execTime = time.Now()
		}

		// Stream-scoped unique key: prevents collisions across streams
		streamID := item.SourceStream
		if streamID == "" {
			streamID = "unknown"
		}
		scopedKey := fmt.Sprintf("tr:%s:%s", streamID, item.ID)

		// Distinct lifecycle handling: only EXECUTED and SETTLED become definitive financial transactions
		isSettled := status == "EXECUTED" || status == "SETTLED" || status == ""
		if !isSettled {
			// Pending, cancelled, rejected, failed: preserve for review, do not record in financial ledger
			unrecognizedEvents = append(unrecognizedEvents, &model.SyncRawEvent{
				Provider:        model.SyncProviderTradeRepublic,
				SourceStream:    streamID,
				ExternalEventID: item.ID,
				EventType:       item.EventType,
				Status:          status,
				RawPayload:      rawBytes,
				OccurredAt:      &execTime,
			})
			continue
		}

		amtItem := item.Amount
		if amtItem == nil {
			amtItem = item.SubAmount
		}
		if amtItem == nil {
			// Informational event, document, or non-financial order lifecycle: record in raw events
			unrecognizedEvents = append(unrecognizedEvents, &model.SyncRawEvent{
				Provider:        model.SyncProviderTradeRepublic,
				SourceStream:    streamID,
				ExternalEventID: item.ID,
				EventType:       item.EventType,
				Status:          status,
				RawPayload:      rawBytes,
				OccurredAt:      &execTime,
			})
			continue
		}

		// Classify transaction based strictly on source stream and event type
		txType, ok := classifyTimelineEvent(streamID, item.EventType, item.Title, amtItem.Value)
		if !ok {
			// Unrecognized financial event type: preserve in raw events rather than fabricating a transaction
			unrecognizedEvents = append(unrecognizedEvents, &model.SyncRawEvent{
				Provider:        model.SyncProviderTradeRepublic,
				SourceStream:    streamID,
				ExternalEventID: item.ID,
				EventType:       item.EventType,
				Status:          status,
				RawPayload:      rawBytes,
				OccurredAt:      &execTime,
			})
			continue
		}

		currency := model.Currency(strings.ToUpper(strings.TrimSpace(amtItem.Currency)))
		if !currency.IsValid() {
			currency = model.CurrencyEUR
		}

		isin := extractTradeRepublicISIN(item.Icon, item.Data, item.Subtitle, item.Title)
		symbol := isin
		if symbol == "" {
			symbol = item.Title
		}

		absAmt := amtItem.Value.Abs()
		moneyAmt := model.FromDecimal(absAmt)
		if txType == model.TransactionTypeWithdrawal {
			moneyAmt = model.FromDecimal(absAmt.Neg())
		}

		notes := fmt.Sprintf("EventID: %s, Stream: %s, EventType: %s, Status: %s, Title: %s", item.ID, streamID, item.EventType, item.Status, item.Title)

		rawTxs = append(rawTxs, syncservice.RawTransaction{
			ExternalID:        scopedKey,
			SourceStream:      streamID,
			OriginalID:        item.ID,
			Status:            status,
			Type:              txType,
			Symbol:            symbol,
			Name:              item.Title,
			ISIN:              isin,
			Amount:            moneyAmt,
			Currency:          currency,
			UnitPriceCurrency: currency,
			FeesCurrency:      currency,
			ExecutedAt:        execTime,
			Notes:             notes,
			RawPayload:        rawBytes,
		})
	}

	newStreamCursors := syncservice.StreamCursors{}
	if nextCursors.TimelineTransactionsCursor != nil && *nextCursors.TimelineTransactionsCursor != "" {
		newStreamCursors["timeline_transactions_cursor"] = *nextCursors.TimelineTransactionsCursor
	}
	if nextCursors.TimelineActivityLogCursor != nil && *nextCursors.TimelineActivityLogCursor != "" {
		newStreamCursors["timeline_activity_log_cursor"] = *nextCursors.TimelineActivityLogCursor
	}

	return syncservice.TransactionsSnapshot{
		Transactions:       rawTxs,
		UnrecognizedEvents: unrecognizedEvents,
		StreamCursors:      newStreamCursors,
		IsComplete:         isComplete,
		PaginationDone:     paginationDone,
	}, nil
}

// classifyTimelineEvent maps event types to domain transaction types according to stream roles:
// - timelineTransactions: transfers, card transactions, deposits, interest, tax refunds
// - timelineActivityLog: trade invoices, executed orders, dividends, corporate actions
func classifyTimelineEvent(stream string, eventType, title string, amountVal decimal.Decimal) (model.TransactionType, bool) {
	evUpper := strings.ToUpper(strings.TrimSpace(eventType))
	titleUpper := strings.ToUpper(strings.TrimSpace(title))

	if stream == "timelineTransactions" || stream == "" {
		switch evUpper {
		case "INCOMING_TRANSFER", "INCOMING_TRANSFER_DELEGATION", "PAYMENT_INBOUND", "PAYMENT_INBOUND_SEPA_DIRECT_DEBIT", "CARD_REFUND", "card_refund":
			return model.TransactionTypeDeposit, true
		case "CARD_TRANSACTION", "card_successful_transaction", "OUTGOING_TRANSFER", "OUTGOING_TRANSFER_DELEGATION", "PAYMENT_OUTBOUND":
			return model.TransactionTypeWithdrawal, true
		case "INTEREST_PAYOUT", "INTEREST_PAYOUT_CREATED":
			return model.TransactionTypeInterest, true
		case "TAX_REFUND", "ssp_tax_correction_invoice":
			return model.TransactionTypeDeposit, true
		}

		if strings.Contains(titleUpper, "INTEREST") || strings.Contains(titleUpper, "ZINSEN") || strings.Contains(titleUpper, "INTÉRÊT") {
			return model.TransactionTypeInterest, true
		}
		if strings.Contains(titleUpper, "TAX REFUND") || strings.Contains(titleUpper, "STEUERERSTATTUNG") {
			return model.TransactionTypeDeposit, true
		}
	}

	if stream == "timelineActivityLog" || stream == "" {
		switch evUpper {
		case "TRADE_INVOICE", "ORDER_EXECUTED":
			// Amount is negative when purchasing an asset; positive when selling
			if amountVal.IsNegative() {
				return model.TransactionTypeBuy, true
			}
			return model.TransactionTypeSell, true
		case "DIVIDEND", "CREDIT", "ssp_corporate_action_invoice_cash":
			return model.TransactionTypeDividend, true
		}

		if strings.Contains(evUpper, "DIVIDEND") || strings.Contains(titleUpper, "DIVIDEND") || strings.Contains(titleUpper, "DIVIDENDE") {
			return model.TransactionTypeDividend, true
		}
		if strings.Contains(evUpper, "BUY") || strings.Contains(titleUpper, "BUY") || strings.Contains(titleUpper, "KAUF") || strings.Contains(titleUpper, "ACHAT") {
			return model.TransactionTypeBuy, true
		}
		if strings.Contains(evUpper, "SELL") || strings.Contains(titleUpper, "SELL") || strings.Contains(titleUpper, "VERKAUF") || strings.Contains(titleUpper, "VENTE") {
			return model.TransactionTypeSell, true
		}
	}

	// Fallback to checking title or prefix if eventType is general
	switch {
	case strings.Contains(evUpper, "INTEREST"):
		return model.TransactionTypeInterest, true
	case strings.Contains(evUpper, "FEE") || strings.Contains(titleUpper, "FEE"):
		return model.TransactionTypeFee, true
	case strings.HasPrefix(evUpper, "TRADING_") || strings.HasPrefix(evUpper, "SSP_"):
		if amountVal.IsNegative() {
			return model.TransactionTypeBuy, true
		}
		return model.TransactionTypeSell, true
	case strings.HasPrefix(evUpper, "BANK_TRANSACTION_") || strings.HasPrefix(evUpper, "CARD_"):
		if amountVal.IsNegative() {
			return model.TransactionTypeWithdrawal, true
		}
		return model.TransactionTypeDeposit, true
	}

	return "", false
}

// extractTradeRepublicISIN attempts to find an ISIN identifier from icon, data payload, subtitle, or title.
func extractTradeRepublicISIN(icon string, data json.RawMessage, subtitle, title string) string {
	// 1. Icon format: "logos/<ISIN>/v2"
	if strings.HasPrefix(icon, "logos/") {
		parts := strings.Split(icon, "/")
		if len(parts) >= 2 && isinRegex.MatchString(parts[1]) {
			return parts[1]
		}
	}

	// 2. Data payload
	if len(data) > 0 {
		var payload struct {
			ISIN string `json:"isin"`
		}
		if err := json.Unmarshal(data, &payload); err == nil && payload.ISIN != "" {
			return payload.ISIN
		}
	}

	// 3. Subtitle / Title regex
	if match := isinRegex.FindString(subtitle); match != "" {
		return match
	}
	if match := isinRegex.FindString(title); match != "" {
		return match
	}

	return ""
}

// parseTimelineTimestamp converts timestamp strings into time.Time.
func parseTimelineTimestamp(ts string) (time.Time, error) {
	if ts == "" {
		return time.Time{}, errors.New("empty timestamp")
	}
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02T15:04:05.999Z07:00", ts); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02T15:04:05", ts)
}
