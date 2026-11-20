package enablebanking

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateTestRSAKey(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	der := x509.MarshalPKCS1PrivateKey(key)
	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: der,
	})
	return key, string(pemBytes)
}

func TestGenerateJWT(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id-12345"
	fixedTime := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)

	tokenStr, err := GenerateJWT(appID, pemStr, 1*time.Hour, fixedTime)
	require.NoError(t, err)
	assert.NotEmpty(t, tokenStr)

	// Verify token structure with parser pegged to fixedTime
	parsedToken, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		assert.Equal(t, jwt.SigningMethodRS256, token.Method)
		assert.Equal(t, appID, token.Header["kid"])
		assert.Equal(t, "JWT", token.Header["typ"])
		key, err := ParseRSAPrivateKey([]byte(pemStr))
		return &key.PublicKey, err
	}, jwt.WithTimeFunc(func() time.Time { return fixedTime }))
	require.NoError(t, err)
	assert.True(t, parsedToken.Valid)

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	require.True(t, ok)
	assert.Equal(t, defaultIssuer, claims["iss"])
	assert.Equal(t, defaultAudience, claims["aud"])
	assert.Equal(t, float64(fixedTime.Unix()), claims["iat"])
	assert.Equal(t, float64(fixedTime.Add(1*time.Hour).Unix()), claims["exp"])
}

func TestClient_GetASPSPs(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "/aspsps", r.URL.Path)
		assert.Equal(t, "FR", r.URL.Query().Get("country"))
		assert.True(t, len(r.Header.Get("Authorization")) > 0)

		resp := ASPSPsResponse{
			ASPSPs: []ASPSP{
				{
					Name:     "BNP Paribas",
					Title:    "BNP Paribas France",
					Country:  "FR",
					PsuTypes: []string{"personal", "business"},
				},
				{
					Name:     "Crédit Agricole",
					Title:    "Crédit Agricole",
					Country:  "FR",
					PsuTypes: []string{"personal"},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	client := NewClient(appID, pemStr, WithBaseURL(mockServer.URL))
	aspsps, err := client.GetASPSPs(context.Background(), "FR")
	require.NoError(t, err)
	assert.Len(t, aspsps, 2)
	assert.Equal(t, "BNP Paribas", aspsps[0].Name)
	assert.Equal(t, "Crédit Agricole", aspsps[1].Name)
}

func TestClient_StartAuthorization(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/auth", r.URL.Path)

		var req StartAuthRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)
		assert.Equal(t, "Spuerkeess", req.ASPSP.Name)
		assert.Equal(t, "LU", req.ASPSP.Country)
		assert.Equal(t, "https://sigma.example.com/sync/callback", req.RedirectURL)
		assert.Equal(t, "test-state-123", req.State)

		resp := StartAuthResponse{
			URL: "https://auth.enablebanking.com/redirect/mock-url",
			ID:  "auth-proc-999",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	client := NewClient(appID, pemStr, WithBaseURL(mockServer.URL))
	res, err := client.StartAuthorization(context.Background(), StartAuthRequest{
		ASPSP:       ASPSPTarget{Name: "Spuerkeess", Country: "LU"},
		RedirectURL: "https://sigma.example.com/sync/callback",
		State:       "test-state-123",
		PsuType:     "personal",
	})
	require.NoError(t, err)
	assert.Equal(t, "https://auth.enablebanking.com/redirect/mock-url", res.URL)
	assert.Equal(t, "auth-proc-999", res.ID)
}

func TestClient_AuthorizeSession_And_Polling(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id"

	attempts := 0
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/sessions" {
			resp := SessionResponse{
				SessionID: "sess-uuid-123",
				Accounts:  []string{}, // Initially empty (bank delay)
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		if r.Method == http.MethodGet && r.URL.Path == "/sessions/sess-uuid-123" {
			attempts++
			w.Header().Set("Content-Type", "application/json")
			if attempts < 2 {
				_ = json.NewEncoder(w).Encode(SessionResponse{
					SessionID: "sess-uuid-123",
					Accounts:  []string{},
				})
			} else {
				_ = json.NewEncoder(w).Encode(SessionResponse{
					SessionID: "sess-uuid-123",
					Accounts:  []string{"acc-uid-1"},
				})
			}
			return
		}

		if r.Method == http.MethodGet && r.URL.Path == "/accounts/acc-uid-1/details" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(AccountDetailsResponse{
				AccountID: AccountIdentification{
					IBAN: "LU120000000012345678",
				},
				Name:     "Compte Courant",
				Currency: "EUR",
			})
			return
		}

		http.NotFound(w, r)
	}))
	defer mockServer.Close()

	client := NewClient(appID, pemStr, WithBaseURL(mockServer.URL))
	authRes, err := client.AuthorizeSession(context.Background(), "mock-auth-code")
	require.NoError(t, err)
	assert.Equal(t, "sess-uuid-123", authRes.SessionID)
	assert.Empty(t, authRes.Accounts)

	// Poll session until accounts are ready
	pollRes, err := client.PollSessionUntilReady(context.Background(), authRes.SessionID, 3, 10*time.Millisecond)
	require.NoError(t, err)
	assert.Len(t, pollRes.Accounts, 1)
	assert.Equal(t, "acc-uid-1", pollRes.Accounts[0])

	details, err := client.GetAccountDetails(context.Background(), pollRes.Accounts[0])
	require.NoError(t, err)
	assert.Equal(t, "LU120000000012345678", details.AccountID.IBAN)
}

func TestClient_GetBalances(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/accounts/acc-uid-1/balances", r.URL.Path)
		resp := BalancesResponse{
			Balances: []BalanceItem{
				{
					BalanceType: "CLBD",
					BalanceAmount: BalanceAmount{
						Amount:   "3500.50",
						Currency: "EUR",
					},
				},
				{
					BalanceType: "CLAV",
					BalanceAmount: BalanceAmount{
						Amount:   "3480.00",
						Currency: "EUR",
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	client := NewClient(appID, pemStr, WithBaseURL(mockServer.URL))
	bals, err := client.GetBalances(context.Background(), "acc-uid-1")
	require.NoError(t, err)
	assert.Len(t, bals, 2)
	assert.Equal(t, "CLBD", bals[0].BalanceType)
	assert.Equal(t, "3500.50", bals[0].BalanceAmount.Amount)
}

func TestClient_GetTransactions(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/accounts/acc-uid-1/transactions", r.URL.Path)
		assert.Equal(t, "2026-10-01", r.URL.Query().Get("date_from"))
		assert.Equal(t, "BOOK", r.URL.Query().Get("transaction_status"))

		resp := TransactionsResponse{
			Transactions: []TransactionItem{
				{
					TransactionID:        "tx-001",
					EntryReference:       "ref-001",
					CreditDebitIndicator: "DBIT",
					TransactionAmount: TransactionAmount{
						Amount:   "-45.00",
						Currency: "EUR",
					},
					BookingDate: "2026-10-15",
					RemittanceInfo: []string{
						"SUPERMARCHE MATCH",
					},
				},
			},
			ContinuationKey: "next-page-key",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	client := NewClient(appID, pemStr, WithBaseURL(mockServer.URL))
	txResp, err := client.GetTransactions(context.Background(), "acc-uid-1", "2026-10-01", "")
	require.NoError(t, err)
	assert.Len(t, txResp.Transactions, 1)
	assert.Equal(t, "tx-001", txResp.Transactions[0].TransactionID)
	assert.Equal(t, "-45.00", txResp.Transactions[0].TransactionAmount.Amount)
	assert.Equal(t, "next-page-key", txResp.ContinuationKey)
}

func TestGenerateRSAKeyPair(t *testing.T) {
	privPEM, certPEM, err := GenerateRSAKeyPair()
	require.NoError(t, err)
	assert.NotEmpty(t, privPEM)
	assert.NotEmpty(t, certPEM)
	assert.Contains(t, privPEM, "-----BEGIN PRIVATE KEY-----")
	assert.Contains(t, certPEM, "-----BEGIN CERTIFICATE-----")

	// Verify the private key can be parsed and sign a JWT
	parsedKey, err := ParseRSAPrivateKey([]byte(privPEM))
	require.NoError(t, err)
	assert.NotNil(t, parsedKey)

	jwtToken, err := GenerateJWT("app-123", privPEM, time.Hour, time.Now())
	require.NoError(t, err)
	assert.NotEmpty(t, jwtToken)
}

func TestSessionResponse_PolymorphicAccounts(t *testing.T) {
	// 1. Raw string UUIDs (GET /sessions response from official documentation)
	stringAccountsJSON := []byte(`{
		"session_id": "sess-uuid-string-format",
		"status": "AUTHORIZED",
		"accounts": [
			"497f6eca-6276-4993-bfeb-53cbbbba6f08",
			"8f5e1234-5678-4abc-9def-0123456789ab"
		]
	}`)

	var sess1 SessionResponse
	err := json.Unmarshal(stringAccountsJSON, &sess1)
	require.NoError(t, err)
	assert.Equal(t, "sess-uuid-string-format", sess1.SessionID)
	assert.Equal(t, []string{"497f6eca-6276-4993-bfeb-53cbbbba6f08", "8f5e1234-5678-4abc-9def-0123456789ab"}, sess1.AccountIDs())
	assert.Len(t, sess1.AccountsInfo, 2)
	assert.Equal(t, "497f6eca-6276-4993-bfeb-53cbbbba6f08", sess1.AccountsInfo[0].UID)

	// 2. Rich object accounts (POST /sessions response from official documentation)
	objectAccountsJSON := []byte(`{
		"session_id": "sess-uuid-object-format",
		"status": "AUTHORIZED",
		"accounts": [
			{
				"uid": "07cc67f4-45d6-494b-adac-09b5cbc7e2b5",
				"account_id": {
					"iban": "FR7628233000013875633684034",
					"bban": "28233000013875633684034"
				},
				"name": "Revolut France EUR",
				"currency": "EUR",
				"product": "Standard"
			}
		]
	}`)

	var sess2 SessionResponse
	err = json.Unmarshal(objectAccountsJSON, &sess2)
	require.NoError(t, err)
	assert.Equal(t, "sess-uuid-object-format", sess2.SessionID)
	assert.Equal(t, []string{"07cc67f4-45d6-494b-adac-09b5cbc7e2b5"}, sess2.AccountIDs())
	require.Len(t, sess2.AccountsInfo, 1)
	assert.Equal(t, "FR7628233000013875633684034", sess2.AccountsInfo[0].AccountID.IBAN)
	assert.Equal(t, "Revolut France EUR", sess2.AccountsInfo[0].Name)
	assert.Equal(t, "EUR", sess2.AccountsInfo[0].Currency)

	// 3. Realistic Revolut payload with 2 IBANs and 2 OTHI accounts (Vaults / Pockets)
	revolutMixedPayload := []byte(`{
		"session_id": "sess-revolut-mixed",
		"status": "AUTHORIZED",
		"accounts": [
			{
				"uid": "uid-revolut-iban-1",
				"account_id": {
					"iban": "FR7628233000013875633684034"
				},
				"name": "Revolut Main",
				"currency": "EUR"
			},
			{
				"uid": "uid-revolut-iban-2",
				"account_id": {
					"iban": "FR7628233000016845580735417"
				},
				"name": "Revolut Secondary",
				"currency": "EUR"
			},
			{
				"uid": "uid-revolut-othi-1",
				"account_id": {
					"other": {
						"identification": "7e162e70-d8c1-489c-9615-7e6f2c998b72",
						"scheme_name": "OTHI"
					}
				},
				"name": "Revolut Pocket Vacation",
				"currency": "EUR"
			},
			{
				"uid": "uid-revolut-othi-2",
				"account_id": {
					"other": {
						"identification": "95d78b53-7ef0-e212-00c0-5eaac3b9c2fb",
						"scheme_name": "OTHI"
					}
				},
				"name": "Revolut Vault Savings",
				"currency": "EUR"
			}
		]
	}`)

	var sess3 SessionResponse
	err = json.Unmarshal(revolutMixedPayload, &sess3)
	require.NoError(t, err)
	assert.Equal(t, "sess-revolut-mixed", sess3.SessionID)
	assert.Equal(t, []string{
		"uid-revolut-iban-1",
		"uid-revolut-iban-2",
		"uid-revolut-othi-1",
		"uid-revolut-othi-2",
	}, sess3.AccountIDs())
	require.Len(t, sess3.AccountsInfo, 4)
	assert.Equal(t, "FR7628233000013875633684034", sess3.AccountsInfo[0].AccountID.IBAN)
	assert.Equal(t, "FR7628233000016845580735417", sess3.AccountsInfo[1].AccountID.IBAN)
	assert.Equal(t, "7e162e70-d8c1-489c-9615-7e6f2c998b72", sess3.AccountsInfo[2].AccountID.Other)
	assert.Equal(t, "95d78b53-7ef0-e212-00c0-5eaac3b9c2fb", sess3.AccountsInfo[3].AccountID.Other)
}

func TestClient_APIError_StructuredParsing(t *testing.T) {
	_, pemStr := generateTestRSAKey(t)
	appID := "test-app-id"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code":    422,
			"error":   "ALREADY_AUTHORIZED",
			"message": "Session is already authorized",
		})
	}))
	defer mockServer.Close()

	client := NewClient(appID, pemStr, WithBaseURL(mockServer.URL))
	_, err := client.AuthorizeSession(context.Background(), "mock-expired-code")
	require.Error(t, err)

	var apiErr *APIError
	ok := errors.As(err, &apiErr)
	require.True(t, ok)
	assert.Equal(t, 422, apiErr.StatusCode)
	assert.Equal(t, "ALREADY_AUTHORIZED", apiErr.ErrorCode)
	assert.Equal(t, "Session is already authorized", apiErr.Message)
	assert.Contains(t, err.Error(), "ALREADY_AUTHORIZED")
}
