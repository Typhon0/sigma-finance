package adapters

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"
)

func makeTestExampleCredential(apiKey, secret, accountID string) *model.SyncCredential {
	payload, _ := json.Marshal(map[string]string{
		"apiKey":    apiKey,
		"apiSecret": secret,
		"accountId": accountID,
	})
	cred := &model.SyncCredential{
		UserID:   "test-user-id",
		Provider: SyncProviderExample,
		RawData:  string(payload),
		Status:   model.SyncCredentialStatusActive,
	}
	_ = cred.Encrypt()
	return cred
}

func TestExampleAdapter_Provider(t *testing.T) {
	adapter := NewExampleAdapter()
	assert.Equal(t, SyncProviderExample, adapter.Provider())
}

func TestExampleAdapter_Options(t *testing.T) {
	customClient := &http.Client{Timeout: 5 * time.Second}
	adapter := NewExampleAdapter(
		WithExampleBaseURL("https://custom.example.com/"),
		WithExampleHTTPClient(customClient),
	)

	assert.Equal(t, "https://custom.example.com", adapter.baseURL)
	assert.Equal(t, customClient, adapter.httpClient)

	// Test generic WithBaseURL and WithHTTPClient
	adapterGeneric := NewExampleAdapter(
		WithBaseURL("https://generic.example.com/"),
		WithHTTPClient(customClient),
	)
	assert.Equal(t, "https://generic.example.com", adapterGeneric.baseURL)
	assert.Equal(t, customClient, adapterGeneric.httpClient)
}

func TestExampleAdapter_TestConnection_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/ping", r.URL.Path)
		assert.Equal(t, "my-api-key", r.Header.Get("X-API-Key"))
		assert.Equal(t, "my-secret", r.Header.Get("X-API-Secret"))

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status": "ok"}`))
	}))
	defer server.Close()

	adapter := NewExampleAdapter(WithBaseURL(server.URL), WithHTTPClient(server.Client()))
	cred := makeTestExampleCredential("my-api-key", "my-secret", "")

	err := adapter.TestConnection(context.Background(), cred)
	assert.NoError(t, err)
}

func TestExampleAdapter_TestConnection_Errors(t *testing.T) {
	tests := []struct {
		name        string
		statusCode  int
		body        string
		expectedErr error
	}{
		{
			name:        "401 Unauthorized",
			statusCode:  http.StatusUnauthorized,
			body:        `{"error": "Unauthorized"}`,
			expectedErr: syncservice.ErrInvalidCredentials,
		},
		{
			name:        "403 Forbidden",
			statusCode:  http.StatusForbidden,
			body:        `{"error": "Forbidden"}`,
			expectedErr: syncservice.ErrInvalidCredentials,
		},
		{
			name:        "429 Too Many Requests",
			statusCode:  http.StatusTooManyRequests,
			body:        `{"error": "Too Many Requests"}`,
			expectedErr: syncservice.ErrRateLimited,
		},
		{
			name:        "500 Internal Error with throttled message",
			statusCode:  http.StatusInternalServerError,
			body:        `{"code": "RATE_LIMIT_EXCEEDED", "message": "API throttled"}`,
			expectedErr: syncservice.ErrRateLimited,
		},
		{
			name:        "400 Bad Request with invalid key message",
			statusCode:  http.StatusBadRequest,
			body:        `{"code": "AUTH_ERROR", "message": "invalid key supplied"}`,
			expectedErr: syncservice.ErrInvalidCredentials,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()

			adapter := NewExampleAdapter(WithBaseURL(server.URL), WithHTTPClient(server.Client()))
			cred := makeTestExampleCredential("bad-key", "bad-secret", "")

			err := adapter.TestConnection(context.Background(), cred)
			assert.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestExampleAdapter_TestConnection_InvalidCredentialFormat(t *testing.T) {
	adapter := NewExampleAdapter()

	// Nil credential
	err := adapter.TestConnection(context.Background(), nil)
	assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)

	// Credential with missing secret
	cred := makeTestExampleCredential("key-only", "", "")
	err = adapter.TestConnection(context.Background(), cred)
	assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
}

func TestExampleAdapter_FetchAccounts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/accounts", r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"accounts": [
				{
					"id": "acc-101",
					"name": "General Brokerage",
					"type": "broker",
					"tax_category": "standard",
					"institution": "Example Securities Japan",
					"account_number": "1234-5678",
					"currency": "JPY"
				},
				{
					"id": "acc-102",
					"name": "Growth NISA",
					"type": "broker",
					"tax_category": "nisa",
					"institution": "Example Securities Japan",
					"account_number": "1234-9999",
					"currency": "JPY"
				},
				{
					"id": "acc-103",
					"name": "Global Checking",
					"type": "bank",
					"tax_category": "standard",
					"institution": "Example Bank",
					"account_number": "9876-0001",
					"currency": "USD"
				}
			]
		}`))
	}))
	defer server.Close()

	adapter := NewExampleAdapter(WithBaseURL(server.URL), WithHTTPClient(server.Client()))
	cred := makeTestExampleCredential("key", "secret", "")

	accounts, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)
	require.Len(t, accounts, 3)

	assert.Equal(t, "acc-101", accounts[0].ExternalID)
	assert.Equal(t, "General Brokerage", accounts[0].Name)
	assert.Equal(t, model.AccountTypeBroker, accounts[0].Type)
	assert.Equal(t, model.TaxWrapperStandardTaxable, accounts[0].TaxWrapper)
	assert.Equal(t, model.Currency("JPY"), accounts[0].Currency)

	assert.Equal(t, "acc-102", accounts[1].ExternalID)
	assert.Equal(t, model.TaxWrapperRetirementSheltered, accounts[1].TaxWrapper) // NISA mapped to retirement sheltered

	assert.Equal(t, "acc-103", accounts[2].ExternalID)
	assert.Equal(t, model.AccountTypeBank, accounts[2].Type)
	assert.Equal(t, model.CurrencyUSD, accounts[2].Currency)
}

func TestExampleAdapter_FetchBalances(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/accounts/acc-101/balances", r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"balances": [
				{
					"currency": "JPY",
					"amount": "250000.00",
					"available": "200000.00"
				},
				{
					"currency": "USD",
					"amount": "1450.50",
					"available": "1450.50"
				}
			]
		}`))
	}))
	defer server.Close()

	adapter := NewExampleAdapter(WithBaseURL(server.URL), WithHTTPClient(server.Client()))
	cred := makeTestExampleCredential("key", "secret", "")

	balances, err := adapter.FetchBalances(context.Background(), cred, "acc-101")
	require.NoError(t, err)
	require.Len(t, balances, 2)

	assert.Equal(t, model.Currency("JPY"), balances[0].Currency)
	assert.True(t, balances[0].Amount.Equal(decimal.RequireFromString("250000.00")))
	require.NotNil(t, balances[0].Available)
	assert.True(t, balances[0].Available.Equal(decimal.RequireFromString("200000.00")))

	assert.Equal(t, model.CurrencyUSD, balances[1].Currency)
	assert.True(t, balances[1].Amount.Equal(decimal.RequireFromString("1450.50")))
}

func TestExampleAdapter_FetchHoldings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/accounts/acc-101/holdings", r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"holdings": [
				{
					"id": "h-7203",
					"symbol": "7203",
					"name": "Toyota Motor Corp",
					"isin": "JP3633400001",
					"asset_type": "stock",
					"quantity": "100",
					"cost_basis_unit": "2500.00",
					"total_cost": "250000.00",
					"current_price": "2750.00",
					"currency": "JPY"
				},
				{
					"id": "h-aapl",
					"symbol": "AAPL",
					"name": "Apple Inc.",
					"isin": "US0378331005",
					"asset_type": "equity",
					"quantity": "15.5",
					"cost_basis_unit": "175.20",
					"total_cost": "2715.60",
					"current_price": "182.50",
					"currency": "USD"
				}
			]
		}`))
	}))
	defer server.Close()

	adapter := NewExampleAdapter(WithBaseURL(server.URL), WithHTTPClient(server.Client()))
	cred := makeTestExampleCredential("key", "secret", "")

	holdings, err := adapter.FetchHoldings(context.Background(), cred, "acc-101")
	require.NoError(t, err)
	require.Len(t, holdings, 2)

	// Toyota position
	assert.Equal(t, "h-7203", holdings[0].ExternalID)
	assert.Equal(t, "7203", holdings[0].Symbol)
	assert.Equal(t, "Toyota Motor Corp", holdings[0].Name)
	assert.Equal(t, "JP3633400001", holdings[0].ISIN)
	assert.Equal(t, model.AssetTypeStock, holdings[0].AssetType)
	assert.True(t, holdings[0].Quantity.Equal(decimal.NewFromInt(100)))
	require.NotNil(t, holdings[0].CostBasisPerUnit)
	assert.True(t, holdings[0].CostBasisPerUnit.Equal(decimal.RequireFromString("2500.00")))
	require.NotNil(t, holdings[0].TotalCostBasis)
	// 250000.00 * 100 = 25000000 cents
	assert.Equal(t, model.Money(25000000), *holdings[0].TotalCostBasis)
	assert.Equal(t, model.Currency("JPY"), holdings[0].Currency)

	// AAPL fractional position
	assert.Equal(t, "AAPL", holdings[1].Symbol)
	assert.True(t, holdings[1].Quantity.Equal(decimal.RequireFromString("15.5")))
	require.NotNil(t, holdings[1].TotalCostBasis)
	assert.Equal(t, model.Money(271560), *holdings[1].TotalCostBasis)
	assert.Equal(t, model.CurrencyUSD, holdings[1].Currency)
}

func TestExampleAdapter_FetchTransactions(t *testing.T) {
	sinceTime := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/accounts/acc-101/transactions", r.URL.Path)
		assert.Equal(t, sinceTime.Format(time.RFC3339), r.URL.Query().Get("since"))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"transactions": [
				{
					"id": "tx-202",
					"type": "SELL",
					"symbol": "7203",
					"name": "Toyota Motor Corp",
					"quantity": "50",
					"unit_price": "2800.00",
					"amount": "140000.00",
					"currency": "JPY",
					"fees": "500.00",
					"executed_at": "2026-10-15T09:30:00Z",
					"notes": "Market sell order"
				},
				{
					"id": "tx-201",
					"type": "BUY",
					"symbol": "7203",
					"name": "Toyota Motor Corp",
					"isin": "JP3633400001",
					"quantity": "100",
					"unit_price": "2500.00",
					"amount": "250000.00",
					"currency": "JPY",
					"fees": "1000.00",
					"executed_at": "2026-10-05T09:00:00Z",
					"notes": "Limit buy order"
				}
			]
		}`))
	}))
	defer server.Close()

	adapter := NewExampleAdapter(WithBaseURL(server.URL), WithHTTPClient(server.Client()))
	cred := makeTestExampleCredential("key", "secret", "")

	txs, err := adapter.FetchTransactions(context.Background(), cred, "acc-101", &sinceTime)
	require.NoError(t, err)
	require.Len(t, txs, 2)

	// Chronological sorting check: tx-201 (Oct 5) must precede tx-202 (Oct 15)
	assert.Equal(t, "tx-201", txs[0].ExternalID)
	assert.Equal(t, model.TransactionTypeBuy, txs[0].Type)
	assert.Equal(t, "7203", txs[0].Symbol)
	assert.Equal(t, "JP3633400001", txs[0].ISIN)
	require.NotNil(t, txs[0].Quantity)
	assert.True(t, txs[0].Quantity.Equal(decimal.NewFromInt(100)))
	assert.Equal(t, model.Money(25000000), txs[0].Amount)
	assert.Equal(t, model.Money(100000), txs[0].FeesAmount)
	assert.Equal(t, model.Currency("JPY"), txs[0].Currency)

	assert.Equal(t, "tx-202", txs[1].ExternalID)
	assert.Equal(t, model.TransactionTypeSell, txs[1].Type)
}

func TestExampleAdapter_NormalizeCurrency(t *testing.T) {
	tests := []struct {
		input    string
		expected model.Currency
	}{
		{"USD", model.CurrencyUSD},
		{"$", model.CurrencyUSD},
		{"EUR", model.CurrencyEUR},
		{"€", model.CurrencyEUR},
		{"GBP", model.CurrencyGBP},
		{"£", model.CurrencyGBP},
		{"JPY", model.Currency("JPY")},
		{"¥", model.Currency("JPY")},
		{"CNY", model.Currency("CNY")},
		{"RMB", model.Currency("CNY")},
		{"HKD", model.Currency("HKD")},
		{"CAD", model.Currency("CAD")},
		{"AUD", model.Currency("AUD")},
		{"CHF", model.Currency("CHF")},
		{"UNKNOWN", model.CurrencyUSD},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.expected, NormalizeCurrency(tt.input))
		})
	}
}

func TestExampleAdapter_NormalizeTypes(t *testing.T) {
	// Asset types
	assert.Equal(t, model.AssetTypeCrypto, NormalizeAssetType("crypto_token"))
	assert.Equal(t, model.AssetTypeFund, NormalizeAssetType("mutual_fund"))
	assert.Equal(t, model.AssetTypeBankAccount, NormalizeAssetType("cash_deposit"))
	assert.Equal(t, model.AssetTypeStock, NormalizeAssetType("common_stock"))

	// Account types
	assert.Equal(t, model.AccountTypeCryptoExchange, NormalizeAccountType("crypto_wallet"))
	assert.Equal(t, model.AccountTypeBank, NormalizeAccountType("checking_account"))
	assert.Equal(t, model.AccountTypeBroker, NormalizeAccountType("margin_broker"))

	// Tax wrappers
	assert.Equal(t, model.TaxWrapperPEA, NormalizeTaxWrapper("french_pea"))
	assert.Equal(t, model.TaxWrapperRetirementSheltered, NormalizeTaxWrapper("japan_nisa"))
	assert.Equal(t, model.TaxWrapperRetirementSheltered, NormalizeTaxWrapper("uk_isa"))
	assert.Equal(t, model.TaxWrapperCryptoVault, NormalizeTaxWrapper("cold_vault"))
	assert.Equal(t, model.TaxWrapperStandardTaxable, NormalizeTaxWrapper("taxable_individual"))

	// Transaction types
	assert.Equal(t, model.TransactionTypeBuy, NormalizeTransactionType("PURCHASE"))
	assert.Equal(t, model.TransactionTypeSell, NormalizeTransactionType("DISPOSAL"))
	assert.Equal(t, model.TransactionTypeDeposit, NormalizeTransactionType("CASH_IN"))
	assert.Equal(t, model.TransactionTypeWithdrawal, NormalizeTransactionType("CASH_OUT"))
	assert.Equal(t, model.TransactionTypeDividend, NormalizeTransactionType("DIV"))
	assert.Equal(t, model.TransactionTypeFee, NormalizeTransactionType("COMMISSION"))
}
