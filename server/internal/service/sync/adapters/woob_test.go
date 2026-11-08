package adapters_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/adapters"
)

func makeTestWoobCredential(institution, login, password, sessionID string) *model.SyncCredential {
	payload := adapters.WoobCredentials{
		Institution: institution,
		Login:       login,
		Password:    password,
		SessionID:   sessionID,
	}
	b, _ := json.Marshal(payload)
	return &model.SyncCredential{
		ID:       "cred-woob-1",
		UserID:   "user-1",
		Provider: model.SyncProviderWoob,
		RawData:  string(b),
		Status:   model.SyncCredentialStatusActive,
	}
}

func TestWoobAdapter_Provider(t *testing.T) {
	adapter := adapters.NewWoobAdapter("http://localhost:50055", nil)
	assert.Equal(t, model.SyncProviderWoob, adapter.Provider())
}

func TestWoobAdapter_FetchAccounts_And_Holdings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/v1/auth/login":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"session_id": "test-session-123",
				"status":     "SUCCESS",
			})
		case "/api/v1/accounts":
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{
					"external_id":    "FORT-PEA-001",
					"name":           "Fortuneo PEA Titres",
					"type":           "market",
					"currency":       "EUR",
					"balance":        15420.20,
					"account_number": "14518292670868525304001",
				},
				{
					"external_id":    "CE-LOAN-001",
					"name":           "Crédit Immobilier Résidence",
					"type":           "loan",
					"currency":       "EUR",
					"balance":        -182450.20,
					"account_number": "15135005000420049294901",
				},
				{
					"external_id":    "BOURSO-AV-001",
					"name":           "BoursoBank Assurance-Vie",
					"type":           "life_insurance",
					"currency":       "EUR",
					"balance":        25402.00,
					"account_number": "00012345682",
				},
			})
		case "/api/v1/investments":
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{
					"isin":       "FR0010756098",
					"name":       "AMUNDI MSCI WORLD UCITS ETF - EUR (CW8)",
					"quantity":   25.0,
					"unit_value": 540.20,
					"valuation":  13505.00,
					"diff":       1250.00,
				},
			})
		case "/api/v1/transactions":
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{
					"external_id": "TX-1",
					"name":        "Achat CW8",
					"amount":      -540.20,
					"currency":    "EUR",
					"date":        "2026-11-04",
					"raw":         "ACHAT CW8",
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewWoobAdapter(server.URL, server.Client())
	cred := makeTestWoobCredential("fortuneo", "testuser", "secret", "test-session-123")

	t.Run("FetchAccounts", func(t *testing.T) {
		accounts, err := adapter.FetchAccounts(context.Background(), cred)
		require.NoError(t, err)
		require.Len(t, accounts, 3)

		pea := accounts[0]
		assert.Equal(t, "FORT-PEA-001", pea.ExternalID)
		assert.Equal(t, model.AccountTypeBroker, pea.Type)
		assert.Equal(t, model.TaxWrapperPEA, pea.TaxWrapper)
		assert.Equal(t, "Fortuneo", pea.Institution)

		loan := accounts[1]
		assert.Equal(t, "CE-LOAN-001", loan.ExternalID)
		assert.Equal(t, model.AccountTypeBank, loan.Type)

		av := accounts[2]
		assert.Equal(t, "BOURSO-AV-001", av.ExternalID)
		assert.Equal(t, model.AccountTypeBroker, av.Type)
		assert.Equal(t, model.TaxWrapperRetirementSheltered, av.TaxWrapper)
	})

	t.Run("FetchHoldings", func(t *testing.T) {
		holdingsSnap, err := adapter.FetchHoldings(context.Background(), cred, "FORT-PEA-001")
		require.NoError(t, err)
		require.Len(t, holdingsSnap.Holdings, 1)

		h := holdingsSnap.Holdings[0]
		assert.Equal(t, "FR0010756098", h.ISIN)
		assert.Equal(t, decimal.NewFromFloat(25.0), h.Quantity)
		assert.Equal(t, decimal.NewFromFloat(540.20), *h.CurrentPrice)
	})

	t.Run("FetchBalances", func(t *testing.T) {
		balSnap, err := adapter.FetchBalances(context.Background(), cred, "FORT-PEA-001")
		require.NoError(t, err)
		require.Len(t, balSnap.Balances, 1)
		assert.Equal(t, decimal.NewFromFloat(15420.20), balSnap.Balances[0].Amount)
	})

	t.Run("FetchTransactions", func(t *testing.T) {
		txSnap, err := adapter.FetchTransactions(context.Background(), cred, "FORT-PEA-001", nil, nil)
		require.NoError(t, err)
		require.Len(t, txSnap.Transactions, 1)
		assert.Equal(t, model.Money(-54020), txSnap.Transactions[0].Amount)
	})
}
