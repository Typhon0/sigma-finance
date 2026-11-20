package traderepublic

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_DiscoverAccounts_AccountPairs(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		_, msg, _ := conn.ReadMessage() // sub 1 {"type":"accountPairs"}
		assert.Contains(t, string(msg), "accountPairs")

		responsePayload := `1 A {
			"authAccountId": "usr-uuid-111",
			"accounts": [
				{
					"securitiesAccountNumber": "SEC-CTO-001",
					"cashAccountNumber": "CASH-CTO-001",
					"productType": "DEFAULT",
					"currency": "EUR",
					"accountAccessType": "OWNER"
				},
				{
					"securitiesAccountNumber": "SEC-PEA-002",
					"cashAccountNumber": "CASH-PEA-002",
					"productType": "TAX_WRAPPER",
					"jurisdiction": "FR",
					"currency": "EUR",
					"accountAccessType": "OWNER"
				}
			]
		}`
		_ = conn.WriteMessage(websocket.TextMessage, []byte(responsePayload))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client := NewClient(nil, WithWSEndpoint(wsURL))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	accountsResp, err := client.DiscoverAccounts(ctx)
	require.NoError(t, err)
	require.NotNil(t, accountsResp)
	assert.Equal(t, "usr-uuid-111", accountsResp.AuthAccountID)
	require.Len(t, accountsResp.Accounts, 2)

	// Check CTO
	assert.Equal(t, "SEC-CTO-001", accountsResp.Accounts[0].SecuritiesAccountNumber)
	assert.Equal(t, "CASH-CTO-001", accountsResp.Accounts[0].CashAccountNumber)
	assert.Equal(t, "DEFAULT", accountsResp.Accounts[0].ProductType)

	// Check PEA
	assert.Equal(t, "SEC-PEA-002", accountsResp.Accounts[1].SecuritiesAccountNumber)
	assert.Equal(t, "CASH-PEA-002", accountsResp.Accounts[1].CashAccountNumber)
	assert.Equal(t, "TAX_WRAPPER", accountsResp.Accounts[1].ProductType)
	assert.Equal(t, "FR", accountsResp.Accounts[1].Jurisdiction)
}

func TestClient_FetchCashBalances_PairedAccount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		_, _, _ = conn.ReadMessage() // sub 1 {"type":"cash"}

		responsePayload := `1 A [
			{
				"accountNumber": "CASH-CTO-001",
				"currencyId": "EUR",
				"amount": 2540.75,
				"available": 2500.00
			},
			{
				"accountNumber": "CASH-PEA-002",
				"currencyId": "EUR",
				"amount": 10500.20,
				"available": 10500.20
			}
		]`
		_ = conn.WriteMessage(websocket.TextMessage, []byte(responsePayload))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client := NewClient(nil, WithWSEndpoint(wsURL))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Fetch specific cash account
	balances, isComplete, err := client.FetchCashBalances(ctx, "CASH-PEA-002")
	require.NoError(t, err)
	assert.True(t, isComplete)
	require.Len(t, balances, 1)
	assert.Equal(t, "CASH-PEA-002", balances[0].AccountNumber)
	assert.Equal(t, "EUR", balances[0].CurrencyID)
	assert.True(t, balances[0].Amount.Equal(decimal.NewFromFloat(10500.20)))
}

func TestClient_FetchHoldings_CompactPortfolio(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		_, msg, _ := conn.ReadMessage() // sub 1 compactPortfolio
		assert.Contains(t, string(msg), "compactPortfolio")
		assert.Contains(t, string(msg), "SEC-CTO-001")

		responsePayload := `1 A {
			"positions": [
				{
					"instrumentId": "DE0007164600",
					"netSize": 25.0,
					"averageBuyIn": 142.50
				},
				{
					"instrumentId": "IE00B4L5Y983",
					"netSize": 100.5,
					"averageBuyIn": 88.20
				}
			]
		}`
		_ = conn.WriteMessage(websocket.TextMessage, []byte(responsePayload))
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client := NewClient(nil, WithWSEndpoint(wsURL))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	positions, isComplete, err := client.FetchHoldings(ctx, "SEC-CTO-001")
	require.NoError(t, err)
	assert.True(t, isComplete)
	require.Len(t, positions, 2)
	assert.Equal(t, "DE0007164600", positions[0].InstrumentID)
	assert.True(t, positions[0].NetSize.Equal(decimal.NewFromFloat(25.0)))
	assert.True(t, positions[0].AverageBuyIn.Equal(decimal.NewFromFloat(142.50)))
}

func TestClient_FetchTimeline_DualStreamsOnSameConnection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		// Expect both subscriptions on this single connection
		subCount := 0
		for subCount < 2 {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			text := string(msg)
			if strings.Contains(text, "timelineTransactions") {
				subCount++
				// Send transactions answer
				txAns := `1 A {
					"items": [
						{
							"id": "tx-1001",
							"timestamp": "2026-03-15T10:30:00Z",
							"title": "Buy SAP SE",
							"eventType": "TRADING_BUY",
							"status": "SETTLED",
							"amount": {"value": -1425.00, "currency": "EUR"}
						}
					],
					"cursors": {"after": "tx-cursor-page-2"}
				}`
				_ = conn.WriteMessage(websocket.TextMessage, []byte(txAns))
			} else if strings.Contains(text, "timelineActivityLog") {
				subCount++
				// Send activity log answer (contains one shared tx and one unique activity)
				actAns := `2 A {
					"items": [
						{
							"id": "tx-1001",
							"timestamp": "2026-03-15T10:30:00Z",
							"title": "Buy SAP SE",
							"eventType": "TRADING_BUY",
							"status": "SETTLED"
						},
						{
							"id": "act-2002",
							"timestamp": "2026-03-15T10:31:00Z",
							"title": "Quarterly Statement Available",
							"eventType": "DOCUMENT_AVAILABLE",
							"status": "SETTLED"
						}
					],
					"cursors": {"after": "act-cursor-page-2"}
				}`
				_ = conn.WriteMessage(websocket.TextMessage, []byte(actAns))
			}
		}
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client := NewClient(nil, WithWSEndpoint(wsURL))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	initialCursors := SyncCursors{}
	items, nextCursors, isComplete, paginationDone, err := client.FetchTimeline(ctx, "SEC-CTO-001", initialCursors, nil)
	require.NoError(t, err)
	assert.True(t, isComplete)
	assert.False(t, paginationDone, "cursors indicate more pages exist")

	// Lossless event capture: both stream items preserved with distinct source streams
	require.Len(t, items, 3)
	assert.Equal(t, "tx-1001", items[0].ID)
	assert.Equal(t, "timelineTransactions", items[0].SourceStream)
	assert.Equal(t, "tx-1001", items[1].ID)
	assert.Equal(t, "timelineActivityLog", items[1].SourceStream)
	assert.Equal(t, "act-2002", items[2].ID)
	assert.Equal(t, "timelineActivityLog", items[2].SourceStream)

	// Stream-specific cursors updated independently
	require.NotNil(t, nextCursors.TimelineTransactionsCursor)
	assert.Equal(t, "tx-cursor-page-2", *nextCursors.TimelineTransactionsCursor)
	require.NotNil(t, nextCursors.TimelineActivityLogCursor)
	assert.Equal(t, "act-cursor-page-2", *nextCursors.TimelineActivityLogCursor)
}

func TestClient_PerAccountSyncLock(t *testing.T) {
	client := NewClient(nil)
	accountID := "SEC-CTO-001"

	var wg sync.WaitGroup
	started := make(chan struct{})
	held := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()
		_ = client.WithAccountLock(accountID, func() error {
			close(started)
			<-held
			return nil
		})
	}()

	<-started

	// Second concurrent attempt for the same account must be rejected with ErrAccountLocked
	err := client.WithAccountLock(accountID, func() error {
		return nil
	})
	assert.ErrorIs(t, err, ErrAccountLocked)

	// A different account can lock concurrently without conflict
	diffErr := client.WithAccountLock("SEC-PEA-002", func() error {
		return nil
	})
	assert.NoError(t, diffErr)

	close(held)
	wg.Wait()
}
