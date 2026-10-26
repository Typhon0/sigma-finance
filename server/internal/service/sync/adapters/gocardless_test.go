package adapters_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
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
	testGCSecretID       = "test-secret-id-12345"
	testGCSecretKey      = "test-secret-key-67890"
	testGCRequisitionID  = "req-uuid-revolut-999"
	testGCAccessToken    = "mock-access-token-jwt"
	testGCRefreshToken   = "mock-refresh-token-jwt"
	testGCAccountID1     = "acc-uuid-revolut-001"
	testGCAccountID2     = "acc-uuid-fortuneo-002"
)

func makeTestGCCredential(secretID, secretKey, requisitionID, accessToken string) *model.SyncCredential {
	payload := map[string]string{}
	if secretID != "" {
		payload["secretId"] = secretID
	}
	if secretKey != "" {
		payload["secretKey"] = secretKey
	}
	if requisitionID != "" {
		payload["requisitionId"] = requisitionID
	}
	if accessToken != "" {
		payload["accessToken"] = accessToken
	}
	raw, _ := json.Marshal(payload)
	return &model.SyncCredential{
		ID:       "cred-gc-123",
		UserID:   "user-gc-456",
		Provider: model.SyncProviderGoCardless,
		RawData:  string(raw),
		Status:   model.SyncCredentialStatusActive,
	}
}

func TestGoCardlessAdapter_FetchBankBalancesAndTransactions(t *testing.T) {
	var tokenCalls int32
	var balanceCalls int32
	var txCalls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v2/token/new/":
			atomic.AddInt32(&tokenCalls, 1)
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["secret_id"] != testGCSecretID || body["secret_key"] != testGCSecretKey {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"summary":"Authentication failed","detail":"Invalid secret credentials"}`))
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"access": "` + testGCAccessToken + `",
				"access_expires": 86400,
				"refresh": "` + testGCRefreshToken + `",
				"refresh_expires": 2592000
			}`))

		case r.Method == http.MethodGet && r.URL.Path == "/api/v2/accounts/"+testGCAccountID1+"/balances/":
			atomic.AddInt32(&balanceCalls, 1)
			auth := r.Header.Get("Authorization")
			if auth != "Bearer "+testGCAccessToken {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// Mock balances: closingBooked and interimAvailable
			_, _ = w.Write([]byte(`{
				"balances": [
					{
						"balanceAmount": {
							"amount": "3450.75",
							"currency": "EUR"
						},
						"balanceType": "closingBooked",
						"referenceDate": "2026-10-25"
					},
					{
						"balanceAmount": {
							"amount": "3200.00",
							"currency": "EUR"
						},
						"balanceType": "interimAvailable",
						"referenceDate": "2026-10-25"
					}
				]
			}`))

		case r.Method == http.MethodGet && r.URL.Path == "/api/v2/accounts/"+testGCAccountID1+"/transactions/":
			atomic.AddInt32(&txCalls, 1)
			auth := r.Header.Get("Authorization")
			if auth != "Bearer "+testGCAccessToken {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// Mock transactions: salary deposit and grocery withdrawal
			_, _ = w.Write([]byte(`{
				"transactions": {
					"booked": [
						{
							"transactionId": "TX-REV-1002",
							"internalTransactionId": "INT-REV-1002",
							"bookingDate": "2026-10-22",
							"bookingDateTime": "2026-10-22T10:15:30Z",
							"transactionAmount": {
								"amount": "-45.50",
								"currency": "EUR"
							},
							"remittanceInformationUnstructured": "Supermarket Carrefour Paris",
							"creditorName": "Carrefour"
						},
						{
							"transactionId": "TX-REV-1001",
							"internalTransactionId": "INT-REV-1001",
							"bookingDate": "2026-10-20",
							"bookingDateTime": "2026-10-20T08:00:00Z",
							"transactionAmount": {
								"amount": "2800.00",
								"currency": "EUR"
							},
							"remittanceInformationUnstructured": "Virement Salaire Octobre 2026",
							"debtorName": "Acme SAS"
						}
					],
					"pending": []
				}
			}`))

		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewGoCardlessAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	assert.Equal(t, "GOCARDLESS", adapter.Provider())

	cred := makeTestGCCredential(testGCSecretID, testGCSecretKey, testGCRequisitionID, "")

	// 1. Fetch Balances
	balances, err := adapter.FetchBalances(context.Background(), cred, testGCAccountID1)
	require.NoError(t, err)
	require.Len(t, balances, 1)

	assert.Equal(t, model.Currency("EUR"), balances[0].Currency)
	assert.True(t, balances[0].Amount.Equal(decimal.NewFromFloat(3450.75)))
	require.NotNil(t, balances[0].Available)
	assert.True(t, balances[0].Available.Equal(decimal.NewFromFloat(3200.00)))

	// 2. Fetch Transactions
	since := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	txs, err := adapter.FetchTransactions(context.Background(), cred, testGCAccountID1, &since)
	require.NoError(t, err)
	require.Len(t, txs, 2)

	// Check deterministic sort by ExecutedAt ascending:
	// First transaction: 2026-10-20 (Deposit +2800.00 EUR -> +280000 cents)
	assert.Equal(t, "INT-REV-1001", txs[0].ExternalID)
	assert.Equal(t, model.TransactionTypeDeposit, txs[0].Type)
	assert.Equal(t, model.Money(280000), txs[0].Amount)
	assert.Equal(t, model.Currency("EUR"), txs[0].Currency)
	assert.Equal(t, "Virement Salaire Octobre 2026", txs[0].Notes)

	// Second transaction: 2026-10-22 (Withdrawal -45.50 EUR -> -4550 cents)
	assert.Equal(t, "INT-REV-1002", txs[1].ExternalID)
	assert.Equal(t, model.TransactionTypeWithdrawal, txs[1].Type)
	assert.Equal(t, model.Money(-4550), txs[1].Amount)
	assert.Equal(t, model.Currency("EUR"), txs[1].Currency)
	assert.Equal(t, "Supermarket Carrefour Paris", txs[1].Notes)

	assert.GreaterOrEqual(t, atomic.LoadInt32(&tokenCalls), int32(1))
	assert.Equal(t, int32(1), atomic.LoadInt32(&balanceCalls))
	assert.Equal(t, int32(1), atomic.LoadInt32(&txCalls))
}

func TestGoCardlessAdapter_FetchAccounts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v2/token/new/":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access":"` + testGCAccessToken + `","access_expires":86400}`))

		case r.Method == http.MethodGet && r.URL.Path == "/api/v2/requisitions/"+testGCRequisitionID+"/":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"id": "` + testGCRequisitionID + `",
				"status": "LN",
				"institution_id": "REVOLUT_REVOGB21",
				"accounts": [
					"` + testGCAccountID1 + `",
					"` + testGCAccountID2 + `"
				]
			}`))

		case r.Method == http.MethodGet && r.URL.Path == "/api/v2/accounts/"+testGCAccountID1+"/":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"id": "` + testGCAccountID1 + `",
				"name": "Revolut Standard Current",
				"institution_id": "REVOLUT_REVOGB21",
				"iban": "FR7630006000011234567890189",
				"currency": "EUR"
			}`))

		case r.Method == http.MethodGet && r.URL.Path == "/api/v2/accounts/"+testGCAccountID2+"/":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"id": "` + testGCAccountID2 + `",
				"name": "Fortuneo Compte Courant",
				"institution_id": "FORTUNEO_FRFT0000",
				"iban": "FR7611808000019876543210922",
				"currency": "EUR"
			}`))

		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewGoCardlessAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	cred := makeTestGCCredential(testGCSecretID, testGCSecretKey, testGCRequisitionID, "")
	accounts, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)
	require.Len(t, accounts, 2)

	// Since accounts are sorted by ExternalID ascending ("acc-uuid-fortuneo-002" < "acc-uuid-revolut-001"):
	accFortuneo := accounts[0]
	assert.Equal(t, testGCAccountID2, accFortuneo.ExternalID)
	assert.Equal(t, "Fortuneo Compte Courant", accFortuneo.Name)
	assert.Equal(t, model.AccountTypeBank, accFortuneo.Type)
	assert.Equal(t, model.TaxWrapperStandardTaxable, accFortuneo.TaxWrapper)
	assert.Equal(t, "FORTUNEO_FRFT0000", accFortuneo.Institution)
	assert.Equal(t, "FR7611808000019876543210922", accFortuneo.AccountNumber)
	assert.Equal(t, model.Currency("EUR"), accFortuneo.Currency)

	accRevolut := accounts[1]
	assert.Equal(t, testGCAccountID1, accRevolut.ExternalID)
	assert.Equal(t, "Revolut Standard Current", accRevolut.Name)
	assert.Equal(t, model.AccountTypeBank, accRevolut.Type)
	assert.Equal(t, model.TaxWrapperStandardTaxable, accRevolut.TaxWrapper)
	assert.Equal(t, "REVOLUT_REVOGB21", accRevolut.Institution)
	assert.Equal(t, "FR7630006000011234567890189", accRevolut.AccountNumber)
	assert.Equal(t, model.Currency("EUR"), accRevolut.Currency)
}

func TestGoCardlessAdapter_CreateRequisition(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v2/token/new/":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access":"` + testGCAccessToken + `","access_expires":86400}`))

		case r.Method == http.MethodPost && r.URL.Path == "/api/v2/requisitions/":
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			assert.Equal(t, "REVOLUT_REVOGB21", body["institution_id"])
			assert.Equal(t, "https://app.sigmafinance.com/sync/callback", body["redirect"])

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{
				"id": "new-req-uuid-456",
				"status": "CR",
				"institution_id": "REVOLUT_REVOGB21",
				"link": "https://bankaccountdata.gocardless.com/overview/new-req-uuid-456"
			}`))

		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewGoCardlessAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	cred := makeTestGCCredential(testGCSecretID, testGCSecretKey, "", "")
	reqID, link, err := adapter.CreateRequisition(context.Background(), cred, "REVOLUT_REVOGB21", "https://app.sigmafinance.com/sync/callback")
	require.NoError(t, err)
	assert.Equal(t, "new-req-uuid-456", reqID)
	assert.Equal(t, "https://bankaccountdata.gocardless.com/overview/new-req-uuid-456", link)
}

func TestGoCardlessAdapter_TestConnection_SuccessAndErrors(t *testing.T) {
	t.Run("Success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case r.URL.Path == "/api/v2/token/new/":
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"access":"token","access_expires":86400}`))
			case strings.HasPrefix(r.URL.Path, "/api/v2/requisitions/"):
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"id":"req-123","status":"LN","accounts":["acc-1"]}`))
			default:
				http.NotFound(w, r)
			}
		}))
		defer server.Close()

		adapter := adapters.NewGoCardlessAdapter(
			adapters.WithBaseURL(server.URL),
			adapters.WithHTTPClient(server.Client()),
		)

		cred := makeTestGCCredential("sid", "skey", "req-123", "")
		err := adapter.TestConnection(context.Background(), cred)
		assert.NoError(t, err)
	})

	t.Run("HTTP_401_Unauthorized", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"detail":"Invalid credentials"}`))
		}))
		defer server.Close()

		adapter := adapters.NewGoCardlessAdapter(
			adapters.WithBaseURL(server.URL),
			adapters.WithHTTPClient(server.Client()),
		)

		cred := makeTestGCCredential("bad-id", "bad-key", "", "")
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("HTTP_429_Too_Many_Requests", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"detail":"Request was throttled"}`))
		}))
		defer server.Close()

		adapter := adapters.NewGoCardlessAdapter(
			adapters.WithBaseURL(server.URL),
			adapters.WithHTTPClient(server.Client()),
		)

		cred := makeTestGCCredential("sid", "skey", "", "")
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrRateLimited)
	})
}

func TestGoCardlessAdapter_FetchHoldings_ReturnsEmpty(t *testing.T) {
	adapter := adapters.NewGoCardlessAdapter()
	cred := makeTestGCCredential("sid", "skey", "", "")

	holdings, err := adapter.FetchHoldings(context.Background(), cred, testGCAccountID1)
	require.NoError(t, err)
	assert.Empty(t, holdings)
}

func TestGoCardlessAdapter_CredentialParsing(t *testing.T) {
	t.Run("nil credential", func(t *testing.T) {
		adapter := adapters.NewGoCardlessAdapter()
		err := adapter.TestConnection(context.Background(), nil)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("empty raw data", func(t *testing.T) {
		adapter := adapters.NewGoCardlessAdapter()
		cred := &model.SyncCredential{RawData: ""}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("snake_case fields", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access":"snake-token","access_expires":86400}`))
		}))
		defer server.Close()

		adapter := adapters.NewGoCardlessAdapter(
			adapters.WithBaseURL(server.URL),
			adapters.WithHTTPClient(server.Client()),
		)

		cred := &model.SyncCredential{
			RawData: `{"secret_id":"my-id","secret_key":"my-key"}`,
		}
		err := adapter.TestConnection(context.Background(), cred)
		assert.NoError(t, err)
	})
}

func TestGoCardlessAdapter_TokenRefreshOn401(t *testing.T) {
	var requestCount int32
	var tokenCalls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v2/token/new/":
			atomic.AddInt32(&tokenCalls, 1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access":"fresh-token","access_expires":86400}`))

		case r.Method == http.MethodGet && r.URL.Path == "/api/v2/accounts/"+testGCAccountID1+"/balances/":
			count := atomic.AddInt32(&requestCount, 1)
			auth := r.Header.Get("Authorization")
			if count == 1 {
				// Initial call with stale token fails
				assert.Equal(t, "Bearer stale-token", auth)
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"detail":"Given token not valid for any token type"}`))
				return
			}

			// Retry with fresh token succeeds
			assert.Equal(t, "Bearer fresh-token", auth)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"balances": [
					{
						"balanceAmount": {"amount": "100.00", "currency": "EUR"},
						"balanceType": "closingBooked"
					}
				]
			}`))

		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewGoCardlessAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	// Pre-populate with stale token
	cred := makeTestGCCredential(testGCSecretID, testGCSecretKey, "", "stale-token")

	balances, err := adapter.FetchBalances(context.Background(), cred, testGCAccountID1)
	require.NoError(t, err)
	require.Len(t, balances, 1)
	assert.True(t, balances[0].Amount.Equal(decimal.NewFromFloat(100.00)))

	assert.Equal(t, int32(2), atomic.LoadInt32(&requestCount))
	assert.Equal(t, int32(1), atomic.LoadInt32(&tokenCalls))
}

func TestGoCardlessAdapter_FetchTransactions_DateFallbackAndSorting(t *testing.T) {
	mockNow := time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/api/v2/token/new/":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access":"token","access_expires":86400}`))

		case r.URL.Path == "/api/v2/accounts/"+testGCAccountID1+"/transactions/":
			w.Header().Set("Content-Type", "application/json")
			// Return two transactions with identical timestamp to verify tie-breaking on ExternalID ascending
			_, _ = w.Write([]byte(`{
				"transactions": {
					"booked": [
						{
							"transactionId": "TX-B",
							"transactionAmount": {"amount": "10.00", "currency": "EUR"},
							"remittanceInformationUnstructured": "Transfer B"
						},
						{
							"transactionId": "TX-A",
							"transactionAmount": {"amount": "20.00", "currency": "EUR"},
							"remittanceInformationUnstructured": "Transfer A"
						}
					]
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewGoCardlessAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
		adapters.WithTimeFunc(func() time.Time { return mockNow }),
	)

	cred := makeTestGCCredential("sid", "skey", "", "")
	txs, err := adapter.FetchTransactions(context.Background(), cred, testGCAccountID1, nil)
	require.NoError(t, err)
	require.Len(t, txs, 2)

	// Since both fell back to mockNow, TX-A must come before TX-B due to tie breaker
	assert.Equal(t, "TX-A", txs[0].ExternalID)
	assert.Equal(t, mockNow, txs[0].ExecutedAt)
	assert.Equal(t, model.TransactionTypeDeposit, txs[0].Type)
	assert.Equal(t, model.Money(2000), txs[0].Amount)

	assert.Equal(t, "TX-B", txs[1].ExternalID)
	assert.Equal(t, mockNow, txs[1].ExecutedAt)
	assert.Equal(t, model.TransactionTypeDeposit, txs[1].Type)
	assert.Equal(t, model.Money(1000), txs[1].Amount)
}
