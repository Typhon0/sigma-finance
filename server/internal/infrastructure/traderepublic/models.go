package traderepublic

import (
	"encoding/json"
	"net/http"

	"github.com/shopspring/decimal"
)

// LoginRequest defines the payload for POST /api/v2/auth/web/login
type LoginRequest struct {
	PhoneNumber string `json:"phoneNumber"`
	PIN         string `json:"pin"`
}

// LoginResponse represents the initial response from POST /api/v2/auth/web/login
type LoginResponse struct {
	ProcessID string `json:"processId"`
	Countdown int    `json:"countdown"` // seconds remaining for approval
}

// LoginProcessStatus represents the status of a v2 login process
type LoginProcessStatus string

const (
	ProcessStatusWaitingForConfirmation LoginProcessStatus = "WAITING_FOR_CONFIRMATION"
	ProcessStatusPending                LoginProcessStatus = "PENDING"
	ProcessStatusApproved               LoginProcessStatus = "APPROVED"
	ProcessStatusCompleted              LoginProcessStatus = "COMPLETED"
	ProcessStatusRejected               LoginProcessStatus = "REJECTED"
	ProcessStatusExpired                LoginProcessStatus = "EXPIRED"
)

// LoginProcessResponse represents the polled status of the login process
type LoginProcessResponse struct {
	Status    LoginProcessStatus `json:"status"`
	ProcessID string             `json:"processId,omitempty"`
	Error     string             `json:"error,omitempty"`
}

// SavedCookie preserves full cookie attributes for encrypted session serialization.
type SavedCookie struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Path     string `json:"path,omitempty"`
	Domain   string `json:"domain,omitempty"`
	Expires  int64  `json:"expires,omitempty"` // Unix timestamp
	Secure   bool   `json:"secure,omitempty"`
	HttpOnly bool   `json:"http_only,omitempty"`
	SameSite int    `json:"same_site,omitempty"`
}

// AuthSessionContext stores encrypted temporary context needed to resume polling.
// Strictly ephemeral; never contains the user's PIN.
type AuthSessionContext struct {
	ProcessID string        `json:"process_id"`
	Countdown int           `json:"countdown"`
	DeviceID  string        `json:"device_id"`
	WAFToken  string        `json:"waf_token,omitempty"`
	Cookies   []SavedCookie `json:"cookies,omitempty"`
	CreatedAt int64         `json:"created_at"` // Unix timestamp
}

// SessionCookies holds the minimum verified session material required for Trade Republic API
type SessionCookies struct {
	JSessionID string `json:"jsessionid"`
	TRRefresh  string `json:"tr_refresh"`
	TRDevice   string `json:"tr_device"`
}

// IsValid checks if all required cookies are present
func (sc *SessionCookies) IsValid() bool {
	return sc != nil && sc.JSessionID != "" && sc.TRRefresh != "" && sc.TRDevice != ""
}

// ToCookies converts SessionCookies into standard http.Cookie objects
func (sc *SessionCookies) ToCookies() []*http.Cookie {
	if sc == nil {
		return nil
	}
	var cookies []*http.Cookie
	if sc.JSessionID != "" {
		cookies = append(cookies, &http.Cookie{Name: "JSESSIONID", Value: sc.JSessionID})
	}
	if sc.TRRefresh != "" {
		cookies = append(cookies, &http.Cookie{Name: "tr_refresh", Value: sc.TRRefresh})
	}
	if sc.TRDevice != "" {
		cookies = append(cookies, &http.Cookie{Name: "tr_device", Value: sc.TRDevice})
	}
	return cookies
}

// AccountPairsResponse is returned for subscription {"type": "accountPairs"}
type AccountPairsResponse struct {
	AuthAccountID string             `json:"authAccountId"`
	Accounts      []AccountPairItem  `json:"accounts"`
}

// AccountPairItem represents a pair of securities and cash account IDs
type AccountPairItem struct {
	SecuritiesAccountNumber string `json:"securitiesAccountNumber"`
	CashAccountNumber       string `json:"cashAccountNumber"`
	ProductType             string `json:"productType"` // e.g. "DEFAULT", "TAX_WRAPPER"
	Currency                string `json:"currency"`
	AccountAccessType       string `json:"accountAccessType"` // e.g. "OWNER"
	Jurisdiction            string `json:"jurisdiction,omitempty"`
}

// CashResponse is returned for subscription {"type": "cash"}
type CashItem struct {
	AccountNumber string          `json:"accountNumber"`
	CurrencyID    string          `json:"currencyId"`
	Amount        decimal.Decimal `json:"amount"`
	Available     *decimal.Decimal `json:"available,omitempty"`
}

// CompactPortfolioResponse is returned for {"type": "compactPortfolio", "secAccNo": "..."}
type CompactPortfolioResponse struct {
	Positions []PortfolioPositionItem `json:"positions"`
}

// CompactPortfolioCategory represents a group of positions in compactPortfolioByType
type CompactPortfolioCategory struct {
	CategoryType string                  `json:"categoryType"` // e.g. "stocksAndETFs", "derivatives", "crypto"
	Positions    []PortfolioPositionItem `json:"positions"`
}

// CompactPortfolioByTypeResponse is returned for {"type": "compactPortfolioByType", "secAccNo": "..."}
type CompactPortfolioByTypeResponse struct {
	Categories []CompactPortfolioCategory `json:"categories"`
}

// PortfolioPositionItem represents an asset holding
type PortfolioPositionItem struct {
	ISIN         string           `json:"isin,omitempty"`
	InstrumentID string           `json:"instrumentId"` // Usually ISIN
	Name         string           `json:"name,omitempty"`
	Status       string           `json:"status,omitempty"`
	NetSize      decimal.Decimal  `json:"netSize"`
	VirtualSize  *decimal.Decimal `json:"virtualSize,omitempty"`
	AverageBuyIn *decimal.Decimal `json:"averageBuyIn,omitempty"`
}

// InstrumentResponse is returned for {"type": "instrument", "id": "..."}
type InstrumentResponse struct {
	ISIN       string `json:"isin"`
	Name       string `json:"name"`
	ShortName  string `json:"shortName"`
	TypeID     string `json:"typeId"` // "stock", "etf", "crypto", "fund", "bond"
	ExchangeID string `json:"exchangeId,omitempty"`
}

// TickerResponse is returned for {"type": "ticker", "id": "<ISIN>.LSX"}
type TickerResponse struct {
	Bid  *PriceItem `json:"bid,omitempty"`
	Ask  *PriceItem `json:"ask,omitempty"`
	Last *PriceItem `json:"last,omitempty"`
}

// PriceItem represents a quote price with timestamp
type PriceItem struct {
	Price decimal.Decimal `json:"price"`
	Time  int64           `json:"time"`
}

// TimelineTransactionsResponse is returned for {"type": "timelineTransactions", "after": ...}
type TimelineTransactionsResponse struct {
	Items   []TimelineItem   `json:"items"`
	Cursors *TimelineCursors `json:"cursors,omitempty"`
}

// TimelineActivityLogResponse is returned for {"type": "timelineActivityLog", "after": ...}
type TimelineActivityLogResponse struct {
	Items   []TimelineItem   `json:"items"`
	Cursors *TimelineCursors `json:"cursors,omitempty"`
}

// TimelineCursors contains cursor pagination data
type TimelineCursors struct {
	After  *string `json:"after,omitempty"`
	Before *string `json:"before,omitempty"`
}

// TimelineItem represents a chronological financial or activity event
type TimelineItem struct {
	ID           string          `json:"id"`
	SourceStream string          `json:"sourceStream,omitempty"`
	Timestamp    string          `json:"timestamp"` // ISO 8601 or epoch millis
	Title     string          `json:"title"`
	Subtitle  string          `json:"subtitle,omitempty"`
	EventType string          `json:"eventType,omitempty"` // e.g. "TRADING_BUY", "BANK_TRANSACTION_DEPOSIT", "SSP_EXECUTION"
	Status    string          `json:"status,omitempty"`    // e.g. "EXECUTED", "SETTLED", "PENDING", "CANCELED"
	Amount    *AmountItem     `json:"amount,omitempty"`
	SubAmount *AmountItem     `json:"subAmount,omitempty"`
	Icon      string          `json:"icon,omitempty"`
	Action    *TimelineAction `json:"action,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
}

// AmountItem represents a monetary amount in an event
type AmountItem struct {
	Value    decimal.Decimal `json:"value"`
	Currency string          `json:"currency"`
}

// TimelineAction represents the detail action (e.g. timelineDetailV2)
type TimelineAction struct {
	Type    string `json:"type"`    // e.g. "timelineDetailV2"
	Payload string `json:"payload"` // ID to query detail
}

// TimelineDetailV2Response is returned for {"type": "timelineDetailV2", "id": "..."}
type TimelineDetailV2Response struct {
	ID       string                 `json:"id"`
	Sections []TimelineDetailSection `json:"sections"`
}

// TimelineDetailSection represents a section in timeline details
type TimelineDetailSection struct {
	Type     string                   `json:"type"` // "title", "table", "documents", "text"
	Title    string                   `json:"title,omitempty"`
	Elements []TimelineDetailElement `json:"elements,omitempty"`
}

// TimelineDetailElement represents key-value or item in a detail section
type TimelineDetailElement struct {
	Type  string `json:"type"`
	Title string `json:"title,omitempty"`
	Value string `json:"value,omitempty"`
}

// SyncCursors contains stream-specific independent pagination cursors
type SyncCursors struct {
	TimelineTransactionsCursor *string `json:"timeline_transactions_cursor,omitempty"`
	TimelineActivityLogCursor   *string `json:"timeline_activity_log_cursor,omitempty"`
}
