package adapters_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"
	"sigma_finance/internal/service/sync/adapters"
)

const (
	testSnapTradeClientID    = "snaptrade-client-id-123"
	testSnapTradeConsumerKey = "snaptrade-consumer-key-xyz"
	testSnapTradeUserID      = "snaptrade-user-id-456"
	testSnapTradeUserSecret  = "snaptrade-user-secret-789"
)

func newTestSnapTradeCredential() *model.SyncCredential {
	return &model.SyncCredential{
		UserID:   "user-123",
		Provider: model.SyncProviderSnapTrade,
		RawData: fmt.Sprintf(`{
			"clientId": "%s",
			"consumerKey": "%s",
			"userId": "%s",
			"userSecret": "%s"
		}`, testSnapTradeClientID, testSnapTradeConsumerKey, testSnapTradeUserID, testSnapTradeUserSecret),
		Status: model.SyncCredentialStatusActive,
	}
}

// computeExpectedSnapTradeSignature mirrors SnapTrade canonical HMAC-SHA256 signature calculation.
func computeExpectedSnapTradeSignature(path string, query string, body []byte, consumerKey string) (string, error) {
	var content any
	if len(body) > 0 && string(body) != "{}" && string(body) != "null" {
		var decoded any
		if err := json.Unmarshal(body, &decoded); err == nil {
			content = decoded
		} else {
			content = string(body)
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
		return "", err
	}

	mac := hmac.New(sha256.New, []byte(consumerKey))
	mac.Write(sigJSON)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
}

func TestSnapTradeAdapter_FetchTradeRepublicHoldings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, testSnapTradeClientID, r.URL.Query().Get("clientId"))
		assert.NotEmpty(t, r.URL.Query().Get("timestamp"))
		assert.Equal(t, testSnapTradeUserID, r.URL.Query().Get("userId"))
		assert.Equal(t, testSnapTradeUserSecret, r.URL.Query().Get("userSecret"))
		assert.NotEmpty(t, r.Header.Get("Signature"))

		if r.URL.Path == "/api/v1/accounts/tr-account-1/holdings" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"account": {
					"id": "tr-account-1",
					"name": "Trade Republic Depot",
					"number": "TR-123456",
					"institution_name": "Trade Republic"
				},
				"positions": [
					{
						"symbol": {
							"id": "sym-vuaa",
							"symbol": "VUAA",
							"raw_symbol": "VUAA",
							"description": "Vanguard S&P 500 UCITS ETF (USD) Accumulating",
							"isin": "IE00BFMXXD54",
							"currency": {
								"code": "EUR"
							},
							"security_type": {
								"code": "ETF",
								"name": "Exchange Traded Fund"
							}
						},
						"units": 25.5,
						"price": 85.40,
						"average_purchase_price": 80.00,
						"open_pnl": 137.70
					},
					{
						"symbol": {
							"id": "sym-aapl",
							"symbol": "AAPL",
							"raw_symbol": "AAPL",
							"description": "Apple Inc",
							"isin": "US0378331005",
							"currency": {
								"code": "EUR"
							},
							"security_type": {
								"code": "CS",
								"name": "Common Stock"
							}
						},
						"units": 10.0,
						"price": 175.50,
						"average_purchase_price": 150.00,
						"open_pnl": 255.00
					}
				]
			}`))
			return
		}

		http.NotFound(w, r)
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := newTestSnapTradeCredential()

	holdings, err := adapter.FetchHoldings(context.Background(), cred, "tr-account-1")
	require.NoError(t, err)
	require.Len(t, holdings, 2)

	holdingMap := make(map[string]syncservice.RawHolding)
	for _, h := range holdings {
		holdingMap[h.Symbol] = h
	}

	// Verify VUAA ETF holding
	vuaa, ok := holdingMap["VUAA"]
	require.True(t, ok)
	assert.Equal(t, "VUAA", vuaa.Symbol)
	assert.Equal(t, "IE00BFMXXD54", vuaa.ISIN)
	assert.Equal(t, "Vanguard S&P 500 UCITS ETF (USD) Accumulating", vuaa.Name)
	assert.Equal(t, model.AssetTypeFund, vuaa.AssetType)
	assert.True(t, vuaa.Quantity.Equal(decimal.NewFromFloat(25.5)))
	require.NotNil(t, vuaa.CurrentPrice)
	assert.True(t, vuaa.CurrentPrice.Equal(decimal.NewFromFloat(85.40)))
	require.NotNil(t, vuaa.CostBasisPerUnit)
	assert.True(t, vuaa.CostBasisPerUnit.Equal(decimal.NewFromFloat(80.00)))
	require.NotNil(t, vuaa.TotalCostBasis)
	assert.Equal(t, model.Money(204000), *vuaa.TotalCostBasis) // 25.5 * 80.00 * 100 = 204000 cents
	assert.Equal(t, model.CurrencyEUR, vuaa.Currency)

	// Verify AAPL stock holding
	aapl, ok := holdingMap["AAPL"]
	require.True(t, ok)
	assert.Equal(t, "AAPL", aapl.Symbol)
	assert.Equal(t, "US0378331005", aapl.ISIN)
	assert.Equal(t, "Apple Inc", aapl.Name)
	assert.Equal(t, model.AssetTypeStock, aapl.AssetType)
	assert.True(t, aapl.Quantity.Equal(decimal.NewFromFloat(10.0)))
	require.NotNil(t, aapl.CurrentPrice)
	assert.True(t, aapl.CurrentPrice.Equal(decimal.NewFromFloat(175.50)))
	require.NotNil(t, aapl.CostBasisPerUnit)
	assert.True(t, aapl.CostBasisPerUnit.Equal(decimal.NewFromFloat(150.00)))
	require.NotNil(t, aapl.TotalCostBasis)
	assert.Equal(t, model.Money(150000), *aapl.TotalCostBasis) // 10 * 150 * 100 = 150000 cents
	assert.Equal(t, model.CurrencyEUR, aapl.Currency)
}

func TestSnapTradeAdapter_FetchAccounts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/api/v1/accounts", r.URL.Path)
		assert.Equal(t, testSnapTradeClientID, r.URL.Query().Get("clientId"))
		assert.Equal(t, testSnapTradeUserID, r.URL.Query().Get("userId"))
		assert.Equal(t, testSnapTradeUserSecret, r.URL.Query().Get("userSecret"))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[
			{
				"id": "tr-account-1",
				"name": "Trade Republic Depot",
				"number": "TR-123456",
				"institution_name": "Trade Republic",
				"balance": {
					"cash": 1250.45,
					"currency": {
						"code": "EUR"
					}
				}
			},
			{
				"id": "ibkr-account-2",
				"name": "Interactive Brokers Margin",
				"number": "U9876543",
				"institution_name": "Interactive Brokers",
				"balance": {
					"cash": 5000.00,
					"currency": {
						"code": "USD"
					}
				}
			}
		]`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := newTestSnapTradeCredential()

	accounts, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)
	require.Len(t, accounts, 2)

	assert.Equal(t, "tr-account-1", accounts[0].ExternalID)
	assert.Equal(t, "Trade Republic Depot", accounts[0].Name)
	assert.Equal(t, model.AccountTypeBroker, accounts[0].Type)
	assert.Equal(t, model.TaxWrapperStandardTaxable, accounts[0].TaxWrapper)
	assert.Equal(t, "Trade Republic", accounts[0].Institution)
	assert.Equal(t, "TR-123456", accounts[0].AccountNumber)
	assert.Equal(t, model.CurrencyEUR, accounts[0].Currency)

	assert.Equal(t, "ibkr-account-2", accounts[1].ExternalID)
	assert.Equal(t, "Interactive Brokers Margin", accounts[1].Name)
	assert.Equal(t, model.AccountTypeBroker, accounts[1].Type)
	assert.Equal(t, "Interactive Brokers", accounts[1].Institution)
	assert.Equal(t, "U9876543", accounts[1].AccountNumber)
	assert.Equal(t, model.CurrencyUSD, accounts[1].Currency)
}

func TestSnapTradeAdapter_FetchBalances(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/api/v1/accounts/tr-account-1/balances", r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[
			{
				"currency": {
					"code": "EUR"
				},
				"cash": 2450.75,
				"buying_power": 2450.75
			},
			{
				"currency": {
					"code": "USD"
				},
				"cash": 120.00,
				"buying_power": 120.00
			}
		]`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := newTestSnapTradeCredential()

	balances, err := adapter.FetchBalances(context.Background(), cred, "tr-account-1")
	require.NoError(t, err)
	require.Len(t, balances, 2)

	assert.Equal(t, model.CurrencyEUR, balances[0].Currency)
	assert.True(t, balances[0].Amount.Equal(decimal.NewFromFloat(2450.75)))
	require.NotNil(t, balances[0].Available)
	assert.True(t, balances[0].Available.Equal(decimal.NewFromFloat(2450.75)))

	assert.Equal(t, model.CurrencyUSD, balances[1].Currency)
	assert.True(t, balances[1].Amount.Equal(decimal.NewFromFloat(120.00)))
	require.NotNil(t, balances[1].Available)
	assert.True(t, balances[1].Available.Equal(decimal.NewFromFloat(120.00)))
}

func TestSnapTradeAdapter_FetchTransactions_Activities(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/api/v1/accounts/tr-account-1/activities", r.URL.Path)
		assert.Equal(t, "2024-01-01", r.URL.Query().Get("startDate"))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[
			{
				"id": "act-buy-1",
				"type": "BUY",
				"amount": 2040.00,
				"price": 80.00,
				"quantity": 25.5,
				"fee": 1.00,
				"currency": { "code": "EUR" },
				"symbol": {
					"symbol": "VUAA",
					"description": "Vanguard S&P 500 UCITS ETF",
					"isin": "IE00BFMXXD54"
				},
				"trade_date": "2024-03-01T10:00:00Z"
			},
			{
				"id": "act-sell-1",
				"type": "SELL",
				"amount": 1755.00,
				"price": 175.50,
				"quantity": 10.0,
				"fee": 1.00,
				"currency": { "code": "EUR" },
				"symbol": {
					"symbol": "AAPL",
					"description": "Apple Inc",
					"isin": "US0378331005"
				},
				"trade_date": "2024-03-05T14:30:00Z"
			},
			{
				"id": "act-div-1",
				"type": "DIVIDEND",
				"amount": 42.50,
				"currency": { "code": "EUR" },
				"symbol": {
					"symbol": "AAPL",
					"description": "Apple Inc",
					"isin": "US0378331005"
				},
				"trade_date": "2024-03-10T08:00:00Z"
			},
			{
				"id": "act-dep-1",
				"type": "DEPOSIT",
				"amount": 5000.00,
				"currency": { "code": "EUR" },
				"trade_date": "2024-01-15T09:00:00Z"
			},
			{
				"id": "act-wdr-1",
				"type": "WITHDRAWAL",
				"amount": 500.00,
				"currency": { "code": "EUR" },
				"trade_date": "2024-02-01T11:00:00Z"
			}
		]`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := newTestSnapTradeCredential()
	since := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	txs, err := adapter.FetchTransactions(context.Background(), cred, "tr-account-1", &since)
	require.NoError(t, err)
	require.Len(t, txs, 5)

	// Verify chronological ordering
	for i := 1; i < len(txs); i++ {
		assert.True(t, txs[i-1].ExecutedAt.Before(txs[i].ExecutedAt) || txs[i-1].ExecutedAt.Equal(txs[i].ExecutedAt))
	}

	txMap := make(map[string]syncservice.RawTransaction)
	for _, tx := range txs {
		txMap[tx.ExternalID] = tx
	}

	// Buy transaction
	buy, ok := txMap["act-buy-1"]
	require.True(t, ok)
	assert.Equal(t, model.TransactionTypeBuy, buy.Type)
	assert.Equal(t, "VUAA", buy.Symbol)
	assert.Equal(t, "IE00BFMXXD54", buy.ISIN)
	require.NotNil(t, buy.Quantity)
	assert.True(t, buy.Quantity.Equal(decimal.NewFromFloat(25.5)))
	require.NotNil(t, buy.UnitPriceAmount)
	assert.True(t, buy.UnitPriceAmount.Equal(decimal.NewFromFloat(80.00)))
	assert.Equal(t, model.CurrencyEUR, buy.UnitPriceCurrency)
	assert.Equal(t, model.Money(204000), buy.Amount) // Positive for BUY
	assert.Equal(t, model.CurrencyEUR, buy.Currency)
	assert.Equal(t, model.Money(100), buy.FeesAmount) // 1.00 EUR fee
	assert.Equal(t, model.CurrencyEUR, buy.FeesCurrency)

	// Sell transaction
	sell, ok := txMap["act-sell-1"]
	require.True(t, ok)
	assert.Equal(t, model.TransactionTypeSell, sell.Type)
	assert.Equal(t, "AAPL", sell.Symbol)
	assert.Equal(t, "US0378331005", sell.ISIN)
	require.NotNil(t, sell.Quantity)
	assert.True(t, sell.Quantity.Equal(decimal.NewFromFloat(10.0)))
	assert.Equal(t, -model.Money(175500), sell.Amount) // Negative for SELL per model rules

	// Dividend transaction
	div, ok := txMap["act-div-1"]
	require.True(t, ok)
	assert.Equal(t, model.TransactionTypeDividend, div.Type)
	assert.Equal(t, "AAPL", div.Symbol)
	assert.Equal(t, model.Money(4250), div.Amount) // Positive for DIVIDEND

	// Deposit transaction
	dep, ok := txMap["act-dep-1"]
	require.True(t, ok)
	assert.Equal(t, model.TransactionTypeDeposit, dep.Type)
	assert.Equal(t, model.Money(500000), dep.Amount) // Positive for DEPOSIT

	// Withdrawal transaction
	wdr, ok := txMap["act-wdr-1"]
	require.True(t, ok)
	assert.Equal(t, model.TransactionTypeWithdrawal, wdr.Type)
	assert.Equal(t, -model.Money(50000), wdr.Amount) // Negative for WITHDRAWAL
}

func TestSnapTradeAdapter_GeneratePortalLink(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/api/v1/snapTrade/login", r.URL.Path)
		assert.Equal(t, testSnapTradeClientID, r.URL.Query().Get("clientId"))
		assert.Equal(t, testSnapTradeUserID, r.URL.Query().Get("userId"))
		assert.Equal(t, testSnapTradeUserSecret, r.URL.Query().Get("userSecret"))

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var payload map[string]string
		require.NoError(t, json.Unmarshal(body, &payload))
		assert.Equal(t, "https://app.sigma.finance/sync/callback", payload["customRedirect"])

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"loginRedirectUrl": "https://portal.snaptrade.com/session?token=mock-token-xyz"
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := newTestSnapTradeCredential()

	link, err := adapter.GeneratePortalLink(context.Background(), cred, "https://app.sigma.finance/sync/callback")
	require.NoError(t, err)
	assert.Equal(t, "https://portal.snaptrade.com/session?token=mock-token-xyz", link)
}

func TestSnapTradeAdapter_RegisterUser(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/api/v1/snapTrade/registerUser", r.URL.Path)
		assert.Equal(t, testSnapTradeClientID, r.URL.Query().Get("clientId"))
		assert.NotEmpty(t, r.URL.Query().Get("timestamp"))

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var payload map[string]string
		require.NoError(t, json.Unmarshal(body, &payload))
		assert.Equal(t, "user-registered-999", payload["userId"])

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"userId": "user-registered-999",
			"userSecret": "generated-secret-abc"
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := &model.SyncCredential{
		UserID:   "user-123",
		Provider: model.SyncProviderSnapTrade,
		RawData: fmt.Sprintf(`{
			"clientId": "%s",
			"consumerKey": "%s"
		}`, testSnapTradeClientID, testSnapTradeConsumerKey),
		Status: model.SyncCredentialStatusActive,
	}

	registeredUserID, userSecret, err := adapter.RegisterUser(context.Background(), cred, "user-registered-999")
	require.NoError(t, err)
	assert.Equal(t, "user-registered-999", registeredUserID)
	assert.Equal(t, "generated-secret-abc", userSecret)
}

func TestSnapTradeAdapter_TestConnection_SuccessAndErrors(t *testing.T) {
	tests := []struct {
		name          string
		statusCode    int
		responseBody  string
		expectedError error
	}{
		{
			name:          "Success",
			statusCode:    http.StatusOK,
			responseBody:  `[{"id":"tr-account-1","name":"Trade Republic Depot"}]`,
			expectedError: nil,
		},
		{
			name:          "HTTP 401 Unauthorized",
			statusCode:    http.StatusUnauthorized,
			responseBody:  `{"statusCode": 401, "message": "Invalid consumer key"}`,
			expectedError: syncservice.ErrInvalidCredentials,
		},
		{
			name:          "HTTP 403 Forbidden",
			statusCode:    http.StatusForbidden,
			responseBody:  `{"statusCode": 403, "message": "Forbidden"}`,
			expectedError: syncservice.ErrInvalidCredentials,
		},
		{
			name:          "HTTP 429 Too Many Requests",
			statusCode:    http.StatusTooManyRequests,
			responseBody:  `{"statusCode": 429, "message": "Rate limit exceeded"}`,
			expectedError: syncservice.ErrRateLimited,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte(tt.responseBody))
			}))
			defer server.Close()

			adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
			cred := newTestSnapTradeCredential()

			err := adapter.TestConnection(context.Background(), cred)
			if tt.expectedError != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestSnapTradeAdapter_SignatureCalculation(t *testing.T) {
	var receivedSignature string
	var receivedQuery string
	var receivedPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedSignature = r.Header.Get("Signature")
		receivedPath = r.URL.Path
		receivedQuery = r.URL.RawQuery

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer server.Close()

	fixedTime := time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)
	adapter := adapters.NewSnapTradeAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithTimeFunc(func() time.Time { return fixedTime }),
	)
	cred := newTestSnapTradeCredential()

	_, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)

	expectedSig, err := computeExpectedSnapTradeSignature(receivedPath, receivedQuery, nil, testSnapTradeConsumerKey)
	require.NoError(t, err)
	assert.Equal(t, expectedSig, receivedSignature)
}

func TestSnapTradeAdapter_CredentialParsing(t *testing.T) {
	t.Run("nil credential", func(t *testing.T) {
		adapter := adapters.NewSnapTradeAdapter()
		err := adapter.TestConnection(context.Background(), nil)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("empty raw data", func(t *testing.T) {
		adapter := adapters.NewSnapTradeAdapter()
		cred := &model.SyncCredential{RawData: ""}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("invalid json", func(t *testing.T) {
		adapter := adapters.NewSnapTradeAdapter()
		cred := &model.SyncCredential{RawData: "not-json"}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("missing client ID", func(t *testing.T) {
		adapter := adapters.NewSnapTradeAdapter()
		cred := &model.SyncCredential{
			RawData: fmt.Sprintf(`{"consumerKey":"%s","userId":"%s","userSecret":"%s"}`,
				testSnapTradeConsumerKey, testSnapTradeUserID, testSnapTradeUserSecret),
		}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("snake case support", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "client-snake", r.URL.Query().Get("clientId"))
			assert.Equal(t, "user-snake", r.URL.Query().Get("userId"))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`[]`))
		}))
		defer server.Close()

		adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
		cred := &model.SyncCredential{
			RawData: `{
				"client_id": "client-snake",
				"consumer_key": "consumer-snake",
				"user_id": "user-snake",
				"user_secret": "secret-snake"
			}`,
		}
		err := adapter.TestConnection(context.Background(), cred)
		require.NoError(t, err)
	})
}

func TestSnapTradeAdapter_FetchHoldings_FiltersZeroAndNegativeQuantities(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/accounts/tr-acc-zero-test/holdings", r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"positions": [
				{
					"symbol": {
						"symbol": "VALID",
						"description": "Valid Position"
					},
					"units": 15.0,
					"price": 100.00
				},
				{
					"symbol": {
						"symbol": "ZERO_FLOAT",
						"description": "Zero Units Float"
					},
					"units": 0.0,
					"price": 50.00
				},
				{
					"symbol": {
						"symbol": "ZERO_INT",
						"description": "Zero Units Int"
					},
					"units": 0,
					"price": 20.00
				},
				{
					"symbol": {
						"symbol": "NEGATIVE",
						"description": "Negative Units"
					},
					"units": -3.5,
					"price": 75.00
				}
			]
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(adapters.WithBaseURL(server.URL))
	cred := newTestSnapTradeCredential()

	holdings, err := adapter.FetchHoldings(context.Background(), cred, "tr-acc-zero-test")
	require.NoError(t, err)
	require.Len(t, holdings, 1, "only positive quantity positions should be retained")
	assert.Equal(t, "VALID", holdings[0].Symbol)
	assert.True(t, holdings[0].Quantity.Equal(decimal.NewFromFloat(15.0)))
}

func TestSnapTradeAdapter_FetchTransactions_DateFallbackAndSorting(t *testing.T) {
	fixedNow := time.Date(2026, 10, 25, 23, 0, 0, 0, time.UTC)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// Return transactions out of order, one without any date
		_, _ = w.Write([]byte(`[
			{
				"id": "tx-mar",
				"type": "DIVIDEND",
				"amount": 25.00,
				"trade_date": "2024-03-01T12:00:00Z"
			},
			{
				"id": "tx-feb",
				"type": "DEPOSIT",
				"amount": 100.00,
				"trade_date": "",
				"settlement_date": "2024-02-01T12:00:00Z"
			},
			{
				"id": "tx-nodate",
				"type": "INTEREST",
				"amount": 5.00,
				"trade_date": "",
				"settlement_date": ""
			}
		]`))
	}))
	defer server.Close()

	adapter := adapters.NewSnapTradeAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithTimeFunc(func() time.Time { return fixedNow }),
	)
	cred := newTestSnapTradeCredential()

	txs, err := adapter.FetchTransactions(context.Background(), cred, "acc-1", nil)
	require.NoError(t, err)
	require.Len(t, txs, 3)

	// Verify chronological ascending sorting: Feb 2024, Mar 2024, fallback Now (Oct 2026)
	assert.Equal(t, "tx-feb", txs[0].ExternalID)
	assert.Equal(t, "tx-mar", txs[1].ExternalID)
	assert.Equal(t, "tx-nodate", txs[2].ExternalID)

	// Verify fallback date is fixedNow
	assert.True(t, txs[2].ExecutedAt.Equal(fixedNow))
}
