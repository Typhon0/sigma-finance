package adapters

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure/enablebanking"
)

func generateTestRSAKeyPEM(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	der := x509.MarshalPKCS1PrivateKey(key)
	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: der,
	})
	return string(pemBytes)
}

func makeTestCredential(t *testing.T, pemStr string, sessionID string) *model.SyncCredential {
	t.Helper()
	model.SetEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	creds := EnableBankingCredentials{
		ApplicationID: "app-uuid-test",
		PrivateKey:    pemStr,
		SessionID:     sessionID,
		RedirectURL:   "https://sigma.example.com/sync/callback",
	}
	bytes, err := json.Marshal(creds)
	require.NoError(t, err)

	cred := &model.SyncCredential{
		UserID:   "user-1",
		Provider: model.SyncProviderEnableBanking,
		RawData:  string(bytes),
		Status:   model.SyncCredentialStatusActive,
	}
	err = cred.Encrypt()
	require.NoError(t, err)
	return cred
}

func TestEnableBankingAdapter_Provider(t *testing.T) {
	adapter := NewEnableBankingAdapter()
	assert.Equal(t, model.SyncProviderEnableBanking, adapter.Provider())
}

func TestEnableBankingAdapter_FetchAccounts(t *testing.T) {
	pemStr := generateTestRSAKeyPEM(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/sessions/sess-123" {
			resp := enablebanking.SessionResponse{
				SessionID: "sess-123",
				ASPSP: &enablebanking.ASPSPTarget{
					Name:    "Spuerkeess",
					Country: "LU",
				},
				Accounts: []string{"acc-1", "acc-2"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		if r.URL.Path == "/accounts/acc-1/details" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(enablebanking.AccountDetailsResponse{
				AccountID: enablebanking.AccountIdentification{
					IBAN: "LU120000000012345678",
				},
				Currency: "EUR",
				Name:     "Compte Courant",
			})
			return
		}

		if r.URL.Path == "/accounts/acc-2/details" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(enablebanking.AccountDetailsResponse{
				AccountID: enablebanking.AccountIdentification{
					IBAN: "LU980000000087654321",
				},
				Currency: "EUR",
				Name:     "Livret Épargne",
			})
			return
		}

		http.NotFound(w, r)
	}))
	defer server.Close()

	adapter := NewEnableBankingAdapter(
		WithEnableBankingClientFactory(func(appID, privateKey string) *enablebanking.Client {
			return enablebanking.NewClient(appID, privateKey, enablebanking.WithBaseURL(server.URL))
		}),
	)

	cred := makeTestCredential(t, pemStr, "sess-123")
	accounts, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)
	assert.Len(t, accounts, 2)

	assert.Equal(t, "acc-1", accounts[0].ExternalID)
	assert.Equal(t, "Compte Courant", accounts[0].Name)
	assert.Equal(t, "Spuerkeess", accounts[0].Institution)
	assert.Equal(t, "LU120000000012345678", accounts[0].AccountNumber)
	assert.Equal(t, model.AccountTypeBank, accounts[0].Type)

	assert.Equal(t, "acc-2", accounts[1].ExternalID)
	assert.Equal(t, "Livret Épargne", accounts[1].Name)
}

func TestEnableBankingAdapter_FetchBalances_Priority(t *testing.T) {
	pemStr := generateTestRSAKeyPEM(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/accounts/acc-1/balances", r.URL.Path)
		// Return both CLBD (Closing Booked) and ITBD (Interim Booked), as well as CLAV and ITAV
		resp := enablebanking.BalancesResponse{
			Balances: []enablebanking.BalanceItem{
				{
					BalanceType: "ITBD",
					BalanceAmount: enablebanking.BalanceAmount{
						Amount:   "9999.00",
						Currency: "EUR",
					},
				},
				{
					BalanceType: "CLBD", // Should take priority over ITBD
					BalanceAmount: enablebanking.BalanceAmount{
						Amount:   "5432.10",
						Currency: "EUR",
					},
				},
				{
					BalanceType: "CLAV",
					BalanceAmount: enablebanking.BalanceAmount{
						Amount:   "5400.00",
						Currency: "EUR",
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	adapter := NewEnableBankingAdapter(
		WithEnableBankingClientFactory(func(appID, privateKey string) *enablebanking.Client {
			return enablebanking.NewClient(appID, privateKey, enablebanking.WithBaseURL(server.URL))
		}),
	)

	cred := makeTestCredential(t, pemStr, "sess-123")
	snapshot, err := adapter.FetchBalances(context.Background(), cred, "acc-1")
	require.NoError(t, err)
	assert.True(t, snapshot.IsComplete)
	require.Len(t, snapshot.Balances, 1)

	bal := snapshot.Balances[0]
	assert.Equal(t, model.CurrencyEUR, bal.Currency)
	assert.True(t, bal.Amount.Equal(decimal.NewFromFloat(5432.10)))
	require.NotNil(t, bal.Available)
	assert.True(t, bal.Available.Equal(decimal.NewFromFloat(5400.00)))
}

func TestEnableBankingAdapter_FetchHoldings(t *testing.T) {
	pemStr := generateTestRSAKeyPEM(t)
	adapter := NewEnableBankingAdapter()
	cred := makeTestCredential(t, pemStr, "sess-123")

	snapshot, err := adapter.FetchHoldings(context.Background(), cred, "acc-1")
	require.NoError(t, err)
	assert.Empty(t, snapshot.Holdings)
	assert.True(t, snapshot.IsComplete)
	assert.True(t, snapshot.PaginationDone)
}

func TestEnableBankingAdapter_FetchTransactions_DeduplicationAndFallback(t *testing.T) {
	pemStr := generateTestRSAKeyPEM(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/accounts/acc-1/transactions", r.URL.Path)
		resp := enablebanking.TransactionsResponse{
			Transactions: []enablebanking.TransactionItem{
				{
					TransactionID:        "tx-with-id",
					Status:               "BOOKED",
					CreditDebitIndicator: "DBIT",
					TransactionAmount: enablebanking.TransactionAmount{
						Amount:   "-50.25",
						Currency: "EUR",
					},
					BookingDate: "2026-10-20",
					RemittanceInfo: []string{
						"RESTAURANT PARIS",
					},
				},
				{
					// Transaction without explicit transaction_id: should trigger SHA256 composite fallback key
					Status:               "BOOKED",
					CreditDebitIndicator: "CRDT",
					TransactionAmount: enablebanking.TransactionAmount{
						Amount:   "1200.00",
						Currency: "EUR",
					},
					BookingDate: "2026-10-22",
					RemittanceInfo: []string{
						"VIREMENT SALAIRE",
					},
				},
				{
					// PENDING transaction: should be filtered out
					TransactionID:        "tx-pending",
					Status:               "PDNG",
					CreditDebitIndicator: "DBIT",
					TransactionAmount: enablebanking.TransactionAmount{
						Amount:   "-15.00",
						Currency: "EUR",
					},
					BookingDate: "2026-10-23",
				},
				{
					// ZERO-AMOUNT transaction (e.g. PayPal / Amazon €0.00 card pre-auth): should be filtered out
					TransactionID:        "tx-zero-amount",
					Status:               "BOOKED",
					CreditDebitIndicator: "CRDT",
					TransactionAmount: enablebanking.TransactionAmount{
						Amount:   "0.00",
						Currency: "EUR",
					},
					BookingDate: "2026-10-24",
					RemittanceInfo: []string{
						"PAYPAL PREAUTH VERIFICATION",
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	fixedTime := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)
	adapter := NewEnableBankingAdapter(
		WithEnableBankingClientFactory(func(appID, privateKey string) *enablebanking.Client {
			return enablebanking.NewClient(appID, privateKey, enablebanking.WithBaseURL(server.URL))
		}),
	)
	adapter.timeNow = func() time.Time { return fixedTime }

	cred := makeTestCredential(t, pemStr, "sess-123")
	snapshot, err := adapter.FetchTransactions(context.Background(), cred, "acc-1", nil, nil)
	require.NoError(t, err)
	assert.True(t, snapshot.IsComplete)
	assert.True(t, snapshot.PaginationDone)

	// Pending transaction must be excluded; exactly 2 booked transactions returned
	require.Len(t, snapshot.Transactions, 2)

	// 1st tx (Debit)
	assert.Equal(t, "tx-with-id", snapshot.Transactions[0].ExternalID)
	assert.Equal(t, model.TransactionTypeWithdrawal, snapshot.Transactions[0].Type)
	assert.Equal(t, model.Money(5025), snapshot.Transactions[0].Amount)
	assert.Equal(t, model.CurrencyEUR, snapshot.Transactions[0].Currency)
	assert.Contains(t, snapshot.Transactions[0].Notes, "RESTAURANT PARIS")

	// 2nd tx (Credit with SHA256 fallback ID starting with "eb_")
	assert.True(t, len(snapshot.Transactions[1].ExternalID) > 3)
	assert.Equal(t, "eb_", snapshot.Transactions[1].ExternalID[:3])
	assert.Equal(t, model.TransactionTypeDeposit, snapshot.Transactions[1].Type)
	assert.Equal(t, model.Money(120000), snapshot.Transactions[1].Amount)
}
