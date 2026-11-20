package adapters_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure/traderepublic"
	syncservice "sigma_finance/internal/service/sync"
	"sigma_finance/internal/service/sync/adapters"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func makeTestTRCredential(jsessionid, trRefresh, trDevice string) *model.SyncCredential {
	sc := traderepublic.SessionCookies{
		JSessionID: jsessionid,
		TRRefresh:  trRefresh,
		TRDevice:   trDevice,
	}
	b, _ := json.Marshal(sc)
	return &model.SyncCredential{
		ID:       "cred-tr-1",
		UserID:   "user-1",
		Provider: model.SyncProviderTradeRepublic,
		RawData:  string(b),
		Status:   model.SyncCredentialStatusActive,
	}
}

func TestTradeRepublicAdapter_Provider(t *testing.T) {
	adapter := adapters.NewTradeRepublicAdapter()
	assert.Equal(t, model.SyncProviderTradeRepublic, adapter.Provider())
}

func TestTradeRepublicAdapter_CredentialParsing(t *testing.T) {
	adapter := adapters.NewTradeRepublicAdapter()

	t.Run("nil credential", func(t *testing.T) {
		err := adapter.TestConnection(context.Background(), nil)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("empty secret", func(t *testing.T) {
		cred := &model.SyncCredential{
			ID:      "cred-empty",
			RawData: "",
		}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("invalid cookies format", func(t *testing.T) {
		cred := &model.SyncCredential{
			ID:      "cred-invalid",
			RawData: "not-json-and-not-cookies",
		}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("incomplete json session cookies", func(t *testing.T) {
		cred := &model.SyncCredential{
			ID:      "cred-incomplete",
			RawData: `{"jsessionid": "only-one"}`,
		}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})
}

func TestTradeRepublicAdapter_TestConnection_SuccessAndExpired(t *testing.T) {
	var sessionCalls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&sessionCalls, 1)
		cookie, err := r.Cookie("JSESSIONID")
		if err != nil || cookie.Value == "expired" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	adapter := adapters.NewTradeRepublicAdapter(
		adapters.WithTradeRepublicBaseURL(server.URL),
	)

	t.Run("successful session check", func(t *testing.T) {
		cred := makeTestTRCredential("valid-jsessionid", "valid-refresh", "valid-device")
		err := adapter.TestConnection(context.Background(), cred)
		require.NoError(t, err)
	})

	t.Run("expired session returns ErrExpiredCredentials", func(t *testing.T) {
		cred := makeTestTRCredential("expired", "valid-refresh", "valid-device")
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrExpiredCredentials)
	})
}

func TestTradeRepublicAdapter_FetchAccounts_CTOAndPEA(t *testing.T) {
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()

		// Read connect frame: "connect 31 {clientInfo}"
		_, msg, err := conn.ReadMessage()
		require.NoError(t, err)
		assert.True(t, strings.HasPrefix(string(msg), "connect 31 "))
		err = conn.WriteMessage(websocket.TextMessage, []byte("connected"))
		require.NoError(t, err)

		// Read sub frame
		_, subMsg, err := conn.ReadMessage()
		require.NoError(t, err)
		subStr := string(subMsg)
		assert.True(t, strings.HasPrefix(subStr, "sub 1"))

		// Reply with accountPairs payload including French PEA and German wrapper
		replyPayload := `{
			"authAccountId": "main-user-1",
			"accounts": [
				{
					"securitiesAccountNumber": "SEC-CTO-100",
					"cashAccountNumber": "CASH-CTO-100",
					"productType": "DEFAULT",
					"currency": "EUR",
					"accountAccessType": "OWNER"
				},
				{
					"securitiesAccountNumber": "SEC-PEA-200",
					"cashAccountNumber": "CASH-PEA-200",
					"productType": "TAX_WRAPPER",
					"currency": "EUR",
					"accountAccessType": "OWNER",
					"jurisdiction": "FR"
				},
				{
					"securitiesAccountNumber": "SEC-DE-300",
					"cashAccountNumber": "CASH-DE-300",
					"productType": "TAX_WRAPPER",
					"currency": "EUR",
					"accountAccessType": "OWNER",
					"jurisdiction": "DE"
				}
			]
		}`
		err = conn.WriteMessage(websocket.TextMessage, []byte("A 1 "+replyPayload))
		require.NoError(t, err)
	}))
	defer wsServer.Close()

	wsURL := "ws" + strings.TrimPrefix(wsServer.URL, "http")
	adapter := adapters.NewTradeRepublicAdapter(
		adapters.WithTradeRepublicWSEndpoint(wsURL),
	)

	cred := makeTestTRCredential("session-1", "refresh-1", "device-1")
	accounts, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)
	require.Len(t, accounts, 3)

	// Account 0: CTO
	cto := accounts[0]
	assert.Equal(t, "SEC-CTO-100", cto.ExternalID)
	assert.Equal(t, "SEC-CTO-100", cto.AccountNumber)
	assert.Equal(t, "CASH-CTO-100", cto.CashAccountNumber)
	assert.Equal(t, "Trade Republic CTO", cto.Name)
	assert.Equal(t, model.AccountTypeBroker, cto.Type)
	assert.Equal(t, model.TaxWrapperStandardTaxable, cto.TaxWrapper)
	assert.Equal(t, model.CurrencyEUR, cto.Currency)

	// Account 1: French PEA
	pea := accounts[1]
	assert.Equal(t, "SEC-PEA-200", pea.ExternalID)
	assert.Equal(t, "SEC-PEA-200", pea.AccountNumber)
	assert.Equal(t, "CASH-PEA-200", pea.CashAccountNumber)
	assert.Equal(t, "Trade Republic PEA", pea.Name)
	assert.Equal(t, model.AccountTypeBroker, pea.Type)
	assert.Equal(t, model.TaxWrapperPEA, pea.TaxWrapper, "FR jurisdiction must map to PEA")
	assert.Equal(t, model.CurrencyEUR, pea.Currency)

	// Account 2: German tax wrapper (must not be assumed as PEA)
	deAcc := accounts[2]
	assert.Equal(t, "SEC-DE-300", deAcc.ExternalID)
	assert.Equal(t, "Trade Republic Tax Wrapper (DE)", deAcc.Name)
	assert.Equal(t, model.TaxWrapperStandardTaxable, deAcc.TaxWrapper, "Non-FR jurisdiction must NOT be assumed as PEA")
}

func TestTradeRepublicAdapter_FetchBalances_Cash(t *testing.T) {
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31 {clientInfo}
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		_, _, _ = conn.ReadMessage() // sub 1 {"type":"cash"}
		cashReply := `[
			{
				"accountNumber": "CASH-CTO-100",
				"currencyId": "EUR",
				"amount": 1250.75,
				"available": 1200.00
			},
			{
				"accountNumber": "CASH-PEA-200",
				"currencyId": "EUR",
				"amount": 5400.25,
				"available": 5400.25
			}
		]`
		_ = conn.WriteMessage(websocket.TextMessage, []byte("A 1 "+cashReply))
	}))
	defer wsServer.Close()

	wsURL := "ws" + strings.TrimPrefix(wsServer.URL, "http")
	adapter := adapters.NewTradeRepublicAdapter(
		adapters.WithTradeRepublicWSEndpoint(wsURL),
	)

	cred := makeTestTRCredential("session-1", "refresh-1", "device-1")

	// Target CASH-CTO-100
	snap, err := adapter.FetchBalances(context.Background(), cred, "CASH-CTO-100")
	require.NoError(t, err)
	assert.True(t, snap.IsComplete)
	require.Len(t, snap.Balances, 1)

	b := snap.Balances[0]
	assert.Equal(t, model.CurrencyEUR, b.Currency)
	assert.True(t, b.Amount.Equal(decimal.NewFromFloat(1250.75)))
	require.NotNil(t, b.Available)
	assert.True(t, b.Available.Equal(decimal.NewFromFloat(1200.00)))
}

func TestTradeRepublicAdapter_FetchHoldings_Positions(t *testing.T) {
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31 {clientInfo}
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		_, _, _ = conn.ReadMessage() // sub 1 {"type":"compactPortfolio","secAccNo":"SEC-CTO-100"}
		holdingsReply := `{
			"positions": [
				{
					"instrumentId": "US0378331005",
					"netSize": 15.5,
					"averageBuyIn": 140.25
				},
				{
					"instrumentId": "DE0007100000",
					"netSize": 0,
					"averageBuyIn": 50.00
				}
			]
		}`
		_ = conn.WriteMessage(websocket.TextMessage, []byte("A 1 "+holdingsReply))
	}))
	defer wsServer.Close()

	wsURL := "ws" + strings.TrimPrefix(wsServer.URL, "http")
	adapter := adapters.NewTradeRepublicAdapter(
		adapters.WithTradeRepublicWSEndpoint(wsURL),
	)

	cred := makeTestTRCredential("session-1", "refresh-1", "device-1")
	snap, err := adapter.FetchHoldings(context.Background(), cred, "SEC-CTO-100")
	require.NoError(t, err)
	assert.True(t, snap.IsComplete)
	assert.True(t, snap.PaginationDone)

	// Zero-quantity position DE0007100000 filtered out
	require.Len(t, snap.Holdings, 1)
	h := snap.Holdings[0]
	assert.Equal(t, "US0378331005", h.ISIN)
	assert.Equal(t, "US0378331005", h.Symbol)
	assert.True(t, h.Quantity.Equal(decimal.NewFromFloat(15.5)))
	require.NotNil(t, h.CostBasisPerUnit)
	assert.True(t, h.CostBasisPerUnit.Equal(decimal.NewFromFloat(140.25)))
	require.NotNil(t, h.TotalCostBasis)
	// 15.5 * 140.25 EUR = 2173.875 EUR = 217387.5 cents, rounded to the
	// nearest cent (model.FromDecimal), not truncated.
	assert.Equal(t, model.Money(217388), *h.TotalCostBasis)
}

func TestTradeRepublicAdapter_FetchTransactions_DualTimelineAndEventClassification(t *testing.T) {
	wsServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()

		_, _, _ = conn.ReadMessage() // connect 31 {clientInfo}
		_ = conn.WriteMessage(websocket.TextMessage, []byte("connected"))

		// Read both subscriptions
		_, subMsg1, _ := conn.ReadMessage()
		_, _, _ = conn.ReadMessage()

		sub1Str := string(subMsg1)

		sendReply := func(subID string, payload string) {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("A "+subID+" "+payload))
		}

		// timelineTransactions: cash movements, transfers, card purchases, interest
		txReply := `{
			"items": [
				{
					"id": "tr-tx-dep-1",
					"timestamp": "2026-10-01T09:00:00Z",
					"title": "Deposit",
					"eventType": "INCOMING_TRANSFER",
					"status": "SETTLED",
					"amount": {"value": 2000.00, "currency": "EUR"}
				},
				{
					"id": "tr-tx-card-1",
					"timestamp": "2026-10-05T14:30:00Z",
					"title": "Aldi Supermarket",
					"eventType": "CARD_TRANSACTION",
					"status": "EXECUTED",
					"amount": {"value": -35.50, "currency": "EUR"}
				},
				{
					"id": "tr-tx-int-1",
					"timestamp": "2026-10-31T23:59:00Z",
					"title": "Cash Interest",
					"eventType": "INTEREST_PAYOUT",
					"status": "SETTLED",
					"amount": {"value": 15.20, "currency": "EUR"}
				},
				{
					"id": "tr-tx-pending-1",
					"timestamp": "2026-10-20T12:00:00Z",
					"title": "SEPA Transfer Pending",
					"eventType": "OUTGOING_TRANSFER",
					"status": "PENDING",
					"amount": {"value": -500.00, "currency": "EUR"}
				}
			],
			"cursors": {"after": "tx-cursor-next-100"}
		}`

		// timelineActivityLog: trade invoices, executed orders, dividends, corporate actions
		actReply := `{
			"items": [
				{
					"id": "tr-act-buy-1",
					"timestamp": "2026-10-15T10:00:00Z",
					"title": "Buy Apple Inc.",
					"icon": "logos/US0378331005/v2",
					"eventType": "TRADE_INVOICE",
					"status": "EXECUTED",
					"amount": {"value": -1500.50, "currency": "EUR"}
				},
				{
					"id": "tr-act-div-1",
					"timestamp": "2026-10-18T08:00:00Z",
					"title": "TotalEnergies Dividend",
					"icon": "logos/FR0000120271/v2",
					"eventType": "DIVIDEND",
					"status": "SETTLED",
					"amount": {"value": 45.20, "currency": "EUR"}
				},
				{
					"id": "tr-act-doc-1",
					"timestamp": "2026-10-19T09:00:00Z",
					"title": "Quarterly Statement PDF",
					"eventType": "DOCUMENT_AVAILABLE",
					"status": "EXECUTED"
				}
			],
			"cursors": {"after": "act-cursor-next-200"}
		}`

		if strings.Contains(sub1Str, "timelineTransactions") {
			sendReply("1", txReply)
			sendReply("2", actReply)
		} else {
			sendReply("1", actReply)
			sendReply("2", txReply)
		}
	}))
	defer wsServer.Close()

	wsURL := "ws" + strings.TrimPrefix(wsServer.URL, "http")
	adapter := adapters.NewTradeRepublicAdapter(
		adapters.WithTradeRepublicWSEndpoint(wsURL),
	)

	cred := makeTestTRCredential("session-1", "refresh-1", "device-1")
	initialCursors := syncservice.StreamCursors{
		"timeline_transactions_cursor": "init-tx-cursor",
		"timeline_activity_log_cursor": "init-act-cursor",
	}

	snapshot, err := adapter.FetchTransactions(context.Background(), cred, "SEC-CTO-100", nil, initialCursors)
	require.NoError(t, err)
	assert.True(t, snapshot.IsComplete)
	assert.False(t, snapshot.PaginationDone)

	// Financial transactions: Deposit, Card Withdrawal, Interest, Buy, Dividend = 5 definitive transactions
	require.Len(t, snapshot.Transactions, 5)

	// Non-financial (doc) and Pending events recorded in UnrecognizedEvents = 2 raw events
	require.Len(t, snapshot.UnrecognizedEvents, 2)

	// Stream cursors preserved independently
	assert.Equal(t, "tx-cursor-next-100", snapshot.StreamCursors["timeline_transactions_cursor"])
	assert.Equal(t, "act-cursor-next-200", snapshot.StreamCursors["timeline_activity_log_cursor"])

	txMap := make(map[string]syncservice.RawTransaction)
	for _, tx := range snapshot.Transactions {
		txMap[tx.OriginalID] = tx
	}

	// 1. Inbound Deposit (timelineTransactions)
	dep := txMap["tr-tx-dep-1"]
	assert.Equal(t, model.TransactionTypeDeposit, dep.Type)
	assert.Equal(t, model.Money(200000), dep.Amount)
	assert.Equal(t, "tr:timelineTransactions:tr-tx-dep-1", dep.ExternalID)

	// 2. Card Withdrawal (timelineTransactions)
	card := txMap["tr-tx-card-1"]
	assert.Equal(t, model.TransactionTypeWithdrawal, card.Type)
	assert.Equal(t, model.Money(-3550), card.Amount)

	// 3. Cash Interest (timelineTransactions)
	interest := txMap["tr-tx-int-1"]
	assert.Equal(t, model.TransactionTypeInterest, interest.Type)
	assert.Equal(t, model.Money(1520), interest.Amount)

	// 4. Buy Order Executed (timelineActivityLog)
	buy := txMap["tr-act-buy-1"]
	assert.Equal(t, model.TransactionTypeBuy, buy.Type)
	assert.Equal(t, "US0378331005", buy.ISIN)
	assert.Equal(t, model.Money(150050), buy.Amount)
	assert.Equal(t, "tr:timelineActivityLog:tr-act-buy-1", buy.ExternalID)

	// 5. Dividend (timelineActivityLog)
	div := txMap["tr-act-div-1"]
	assert.Equal(t, model.TransactionTypeDividend, div.Type)
	assert.Equal(t, "FR0000120271", div.ISIN)
	assert.Equal(t, model.Money(4520), div.Amount)
}
