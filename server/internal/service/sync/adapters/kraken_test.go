package adapters_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"sigma_finance/internal/domain/model"
	syncservice "sigma_finance/internal/service/sync"
	"sigma_finance/internal/service/sync/adapters"
)

// Helper to compute expected Kraken HMAC-SHA512 signature for verification
func computeKrakenSignature(apiPath string, postData string, nonce string, base64Secret string) (string, error) {
	secretBytes, err := base64.StdEncoding.DecodeString(base64Secret)
	if err != nil {
		return "", err
	}

	sha := sha256.New()
	sha.Write([]byte(nonce + postData))
	shaSum := sha.Sum(nil)

	mac := hmac.New(sha512.New, secretBytes)
	mac.Write(append([]byte(apiPath), shaSum...))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
}

const (
	testAPIKey    = "test-kraken-api-key"
	testAPISecret = "kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSUXNsu3eow76sz84Q18fWxnyRzBHCd3pd5nE9qa99HAZtuZuj6F1huXg=="
)

func newTestCredential() *model.SyncCredential {
	return &model.SyncCredential{
		UserID:   "user-123",
		Provider: model.SyncProviderKraken,
		RawData:  fmt.Sprintf(`{"apiKey":"%s","apiSecret":"%s"}`, testAPIKey, testAPISecret),
		Status:   model.SyncCredentialStatusActive,
	}
}

// krakenAssetListUnavailable answers Kraken's public asset endpoints with a 404 and
// reports whether it handled the request. The adapter loads Kraken's asset list to
// resolve codes its built-in mapping does not recognise; when that load fails it falls
// back to the built-in mapping, which is what these request-asserting handlers expect.
func krakenAssetListUnavailable(w http.ResponseWriter, r *http.Request) bool {
	if strings.HasPrefix(r.URL.Path, "/0/public/") {
		http.NotFound(w, r)
		return true
	}
	return false
}

func TestKrakenAdapter_FetchBalancesAndHoldings(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if krakenAssetListUnavailable(w, r) {
			return
		}

		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, testAPIKey, r.Header.Get("API-Key"))

		bodyBytes, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		bodyStr := string(bodyBytes)
		values, err := url.ParseQuery(bodyStr)
		assert.NoError(t, err)
		nonce := values.Get("nonce")
		assert.NotEmpty(t, nonce)

		expectedSign, err := computeKrakenSignature(r.URL.Path, bodyStr, nonce, testAPISecret)
		assert.NoError(t, err)
		assert.Equal(t, expectedSign, r.Header.Get("API-Sign"))

		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/0/private/Balance":
			_, _ = w.Write([]byte(`{
				"error": [],
				"result": {
					"ZEUR": "1000.5000",
					"ZUSD": "250.0000",
					"XXBT": "1.23456789",
					"XETH": "10.00000000",
					"SOL": "50.00000000"
				}
			}`))
		case "/0/private/OpenPositions":
			_, _ = w.Write([]byte(`{
				"error": [],
				"result": {
					"POS-1": {
						"ordertxid": "O123",
						"posstatus": "open",
						"pair": "XXBTZUSD",
						"time": 1600000000.0,
						"type": "buy",
						"cost": "50000.00",
						"fee": "10.00",
						"vol": "1.00000000",
						"value": "55000.00"
					},
					"POS-2": {
						"ordertxid": "O124",
						"posstatus": "open",
						"pair": "SOLUSD",
						"time": 1600000000.0,
						"type": "buy",
						"cost": "4000.00",
						"fee": "5.00",
						"vol": "40.00000000",
						"value": "4500.00"
					}
				}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	assert.Equal(t, "KRAKEN", adapter.Provider())

	cred := newTestCredential()

	// 1. FetchBalances: should only return fiat cash balances (EUR, USD)
	balancesSnapshot, err := adapter.FetchBalances(context.Background(), cred, "kraken-spot")
	require.NoError(t, err)
	assert.True(t, balancesSnapshot.IsComplete)
	balances := balancesSnapshot.Balances
	require.Len(t, balances, 2)

	balMap := make(map[model.Currency]decimal.Decimal)
	for _, b := range balances {
		balMap[b.Currency] = b.Amount
		require.NotNil(t, b.Available)
		assert.True(t, b.Amount.Equal(*b.Available))
	}
	assert.True(t, decimal.RequireFromString("1000.50").Equal(balMap[model.CurrencyEUR]))
	assert.True(t, decimal.RequireFromString("250.00").Equal(balMap[model.CurrencyUSD]))

	// 2. FetchHoldings: should return non-fiat crypto assets (BTC, ETH, SOL)
	holdingsSnapshot, err := adapter.FetchHoldings(context.Background(), cred, "kraken-spot")
	require.NoError(t, err)
	assert.True(t, holdingsSnapshot.IsComplete)
	holdings := holdingsSnapshot.Holdings
	require.Len(t, holdings, 3)

	holdingMap := make(map[string]syncservice.RawHolding)
	for _, h := range holdings {
		holdingMap[h.Symbol] = h
		assert.Equal(t, model.AssetTypeCrypto, h.AssetType)
		assert.NotEmpty(t, h.ExternalID)
	}
	assert.True(t, decimal.RequireFromString("1.23456789").Equal(holdingMap["BTC"].Quantity))
	assert.True(t, decimal.RequireFromString("10.0").Equal(holdingMap["ETH"].Quantity))
	assert.True(t, decimal.RequireFromString("50.0").Equal(holdingMap["SOL"].Quantity))

	// Verify proportional cost basis scaling on BTC (holding qty 1.23456789 vs margin vol 1.0)
	btcHolding := holdingMap["BTC"]
	require.NotNil(t, btcHolding.CostBasisPerUnit)
	assert.True(t, decimal.RequireFromString("50000.00").Equal(*btcHolding.CostBasisPerUnit))
	require.NotNil(t, btcHolding.TotalCostBasis)
	// 50000.00 * 1.23456789 = 61728.3945 -> 6172839 cents
	assert.Equal(t, model.Money(6172839), *btcHolding.TotalCostBasis)

	// Verify modern 3-char quote pair "SOLUSD" -> "SOL" cost basis enrichment
	solHolding := holdingMap["SOL"]
	require.NotNil(t, solHolding.CostBasisPerUnit)
	assert.True(t, decimal.RequireFromString("100.00").Equal(*solHolding.CostBasisPerUnit))
	require.NotNil(t, solHolding.TotalCostBasis)
	// 100.00 * 50.0 = 5000.00 -> 500000 cents
	assert.Equal(t, model.Money(500000), *solHolding.TotalCostBasis)
}

func TestKrakenAdapter_FetchAccounts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error": [], "result": {"ZEUR": "100.00"}}`))
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	cred := newTestCredential()
	accounts, err := adapter.FetchAccounts(context.Background(), cred)
	require.NoError(t, err)
	require.Len(t, accounts, 1)

	acc := accounts[0]
	assert.Equal(t, "kraken-spot", acc.ExternalID)
	assert.Equal(t, "Kraken Spot", acc.Name)
	assert.Equal(t, model.AccountTypeCryptoExchange, acc.Type)
	assert.Equal(t, "Kraken", acc.Institution)
}

func TestKrakenAdapter_TestConnection_SuccessAndErrors(t *testing.T) {
	tests := []struct {
		name        string
		statusCode  int
		response    string
		expectedErr error
	}{
		{
			name:        "Success",
			statusCode:  http.StatusOK,
			response:    `{"error": [], "result": {}}`,
			expectedErr: nil,
		},
		{
			name:        "HTTP 401 Unauthorized",
			statusCode:  http.StatusUnauthorized,
			response:    `{"error": ["EAPI:Invalid key"]}`,
			expectedErr: syncservice.ErrInvalidCredentials,
		},
		{
			name:        "HTTP 429 Too Many Requests",
			statusCode:  http.StatusTooManyRequests,
			response:    `{"error": ["EAPI:Rate limit exceeded"]}`,
			expectedErr: syncservice.ErrRateLimited,
		},
		{
			name:        "Kraken Error Array Invalid Signature",
			statusCode:  http.StatusOK,
			response:    `{"error": ["EAPI:Invalid signature"], "result": {}}`,
			expectedErr: syncservice.ErrInvalidCredentials,
		},
		{
			name:        "Kraken Error Array Rate Limit",
			statusCode:  http.StatusOK,
			response:    `{"error": ["EAPI:Rate limit exceeded"], "result": {}}`,
			expectedErr: syncservice.ErrRateLimited,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.statusCode)
				_, _ = w.Write([]byte(tc.response))
			}))
			defer server.Close()

			adapter := adapters.NewKrakenAdapter(
				adapters.WithBaseURL(server.URL),
				adapters.WithHTTPClient(server.Client()),
			)

			cred := newTestCredential()
			err := adapter.TestConnection(context.Background(), cred)
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tc.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestKrakenAdapter_FetchTransactions_Ledgers(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/0/private/Ledgers", r.URL.Path)
		assert.Equal(t, "POST", r.Method)

		bodyBytes, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		values, err := url.ParseQuery(string(bodyBytes))
		assert.NoError(t, err)
		if start := values.Get("start"); start != "" {
			assert.Equal(t, "1600000000", start)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"error": [],
			"result": {
				"count": 4,
				"ledger": {
					"L-DEP-1": {
						"refid": "REF-1",
						"time": 1600000100.0,
						"type": "deposit",
						"subtype": "",
						"aclass": "currency",
						"asset": "ZEUR",
						"amount": "500.0000",
						"fee": "0.0000",
						"balance": "500.0000"
					},
					"L-WITH-1": {
						"refid": "REF-2",
						"time": 1600000200.0,
						"type": "withdrawal",
						"subtype": "",
						"aclass": "currency",
						"asset": "ZUSD",
						"amount": "-100.0000",
						"fee": "5.0000",
						"balance": "400.0000"
					},
					"L-STAKE-1": {
						"refid": "REF-3",
						"time": 1600000300.0,
						"type": "staking",
						"subtype": "",
						"aclass": "currency",
						"asset": "XETH",
						"amount": "0.02500000",
						"fee": "0.0000",
						"balance": "1.02500000"
					},
					"L-TRADE-1": {
						"refid": "REF-4",
						"time": 1600000400.0,
						"type": "trade",
						"subtype": "",
						"aclass": "currency",
						"asset": "XXBT",
						"amount": "0.05000000",
						"fee": "0.00010000",
						"balance": "0.05000000"
					},
					"L-TRADE-1-FIAT": {
						"refid": "REF-4",
						"time": 1600000400.0,
						"type": "trade",
						"subtype": "",
						"aclass": "currency",
						"asset": "ZEUR",
						"amount": "-2500.0000",
						"fee": "0.0000",
						"balance": "2500.0000"
					}
				}
			}
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	cred := newTestCredential()
	since := time.Unix(1600000000, 0)
	txsSnapshot, err := adapter.FetchTransactions(context.Background(), cred, "kraken-spot", &since, nil)
	require.NoError(t, err)
	assert.True(t, txsSnapshot.IsComplete)
	txs := txsSnapshot.Transactions
	// Emits exactly 4 transactions: deposit, withdrawal, staking, and paired trade BUY BTC.
	// L-TRADE-1-FIAT must NOT produce a phantom SELL EUR transaction!
	require.Len(t, txs, 4)

	txMap := make(map[string]syncservice.RawTransaction)
	for _, tx := range txs {
		txMap[tx.ExternalID] = tx
	}

	// Deposit
	dep := txMap["L-DEP-1"]
	assert.Equal(t, model.TransactionTypeDeposit, dep.Type)
	assert.Equal(t, "EUR", dep.Symbol)
	assert.Equal(t, model.Money(50000), dep.Amount)
	assert.Equal(t, model.CurrencyEUR, dep.Currency)
	assert.Nil(t, dep.Quantity)

	// Withdrawal
	with := txMap["L-WITH-1"]
	assert.Equal(t, model.TransactionTypeWithdrawal, with.Type)
	assert.Equal(t, "USD", with.Symbol)
	assert.Equal(t, model.Money(-10000), with.Amount)
	assert.Equal(t, model.CurrencyUSD, with.Currency)
	assert.Equal(t, model.Money(500), with.FeesAmount)

	// Staking Reward
	stake := txMap["L-STAKE-1"]
	assert.Equal(t, model.TransactionTypeDividend, stake.Type)
	assert.Equal(t, "ETH", stake.Symbol)
	assert.True(t, stake.Amount.IsPositive())

	// Paired Trade: BUY 0.05 BTC for 2500 EUR -> price 50,000 EUR
	trade := txMap["L-TRADE-1"]
	assert.Equal(t, model.TransactionTypeBuy, trade.Type)
	assert.Equal(t, "BTC", trade.Symbol)
	require.NotNil(t, trade.Quantity)
	assert.True(t, decimal.RequireFromString("0.05").Equal(*trade.Quantity))
	require.NotNil(t, trade.UnitPriceAmount)
	assert.True(t, decimal.RequireFromString("50000").Equal(*trade.UnitPriceAmount))
	assert.Equal(t, model.CurrencyEUR, trade.UnitPriceCurrency)
	assert.Equal(t, model.Money(250000), trade.Amount)
	assert.Equal(t, model.CurrencyEUR, trade.Currency)

	// Ensure no phantom fiat trade was emitted
	_, fiatTradeExists := txMap["L-TRADE-1-FIAT"]
	assert.False(t, fiatTradeExists, "fiat leg must not produce a phantom trade transaction")

	// Also test with since == nil
	txsNoSinceSnapshot, err := adapter.FetchTransactions(context.Background(), cred, "kraken-spot", nil, nil)
	require.NoError(t, err)
	assert.Len(t, txsNoSinceSnapshot.Transactions, 4)
}

func TestKrakenAdapter_Ledgers_PagesThroughCursor(t *testing.T) {
	// Kraken returns 50 ledger entries per page, newest first, and only exposes
	// older entries through cursor.next. Truncating that walk drops the buy dates
	// of anything bought longer ago than the newest page, which is what left
	// imported positions with a placeholder acquisition date.
	var requestedCursors []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/0/private/Ledgers", r.URL.Path)

		bodyBytes, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		values, err := url.ParseQuery(string(bodyBytes))
		assert.NoError(t, err)
		assert.Equal(t, "true", values.Get("with_cursor"))

		cursor := values.Get("cursor")
		requestedCursors = append(requestedCursors, cursor)

		w.Header().Set("Content-Type", "application/json")
		switch cursor {
		case "":
			_, _ = w.Write([]byte(`{
				"error": [],
				"result": {
					"count": null,
					"ledger": {
						"L-RECENT-CRYPTO": {
							"refid": "REF-RECENT",
							"time": 1770000000.0,
							"type": "trade",
							"asset": "XXBT",
							"amount": "0.01000000",
							"fee": "0.00001000"
						},
						"L-RECENT-FIAT": {
							"refid": "REF-RECENT",
							"time": 1770000000.0,
							"type": "trade",
							"asset": "ZEUR",
							"amount": "-500.0000",
							"fee": "0.0000"
						}
					},
					"cursor": {"next": "CURSOR-PAGE-2"}
				}
			}`))
		case "CURSOR-PAGE-2":
			_, _ = w.Write([]byte(`{
				"error": [],
				"result": {
					"count": null,
					"ledger": {
						"L-OLD-CRYPTO": {
							"refid": "REF-OLD",
							"time": 1700000000.0,
							"type": "trade",
							"asset": "XXBT",
							"amount": "0.05000000",
							"fee": "0.00005000"
						},
						"L-OLD-FIAT": {
							"refid": "REF-OLD",
							"time": 1700000000.0,
							"type": "trade",
							"asset": "ZEUR",
							"amount": "-1000.0000",
							"fee": "0.0000"
						}
					}
				}
			}`))
		default:
			t.Errorf("unexpected ledger cursor %q", cursor)
			http.Error(w, "unexpected cursor", http.StatusBadRequest)
		}
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	txsSnapshot, err := adapter.FetchTransactions(context.Background(), newTestCredential(), "kraken-spot", nil, nil)
	require.NoError(t, err)
	assert.Equal(t, []string{"", "CURSOR-PAGE-2"}, requestedCursors, "older pages must be fetched until Kraken stops handing out a cursor")

	txs := txsSnapshot.Transactions
	byID := make(map[string]syncservice.RawTransaction, len(txs))
	for _, tx := range txs {
		byID[tx.ExternalID] = tx
	}
	require.Len(t, txs, 2)

	oldBuy, ok := byID["L-OLD-CRYPTO"]
	require.True(t, ok, "an older ledger page must reach the transaction stream")
	assert.Equal(t, model.TransactionTypeBuy, oldBuy.Type)
	assert.True(t, time.Unix(1700000000, 0).Equal(oldBuy.ExecutedAt), "the old buy must keep its real execution date")

	assert.True(t, time.Unix(1770000000, 0).Equal(txs[len(txs)-1].ExecutedAt), "transactions still sort oldest to newest")
}

func TestKrakenAdapter_TradeLedgerPairing_BuySellAndOrphan(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if krakenAssetListUnavailable(w, r) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"error": [],
			"result": {
				"count": 5,
				"ledger": {
					"L-BUY-CRYPTO": {
						"refid": "REF-BUY",
						"time": 1610000100.0,
						"type": "trade",
						"asset": "XXBT",
						"amount": "0.10000000",
						"fee": "0.00010000"
					},
					"L-BUY-FIAT": {
						"refid": "REF-BUY",
						"time": 1610000100.0,
						"type": "trade",
						"asset": "ZUSD",
						"amount": "-3500.0000",
						"fee": "1.5000"
					},
					"L-SELL-CRYPTO": {
						"refid": "REF-SELL",
						"time": 1610000200.0,
						"type": "trade",
						"asset": "XETH",
						"amount": "-2.00000000",
						"fee": "0.00200000"
					},
					"L-SELL-FIAT": {
						"refid": "REF-SELL",
						"time": 1610000200.0,
						"type": "trade",
						"asset": "ZEUR",
						"amount": "4000.0000",
						"fee": "0.0000"
					},
					"L-ORPHAN-CRYPTO": {
						"refid": "REF-ORPHAN-1",
						"time": 1610000300.0,
						"type": "trade",
						"asset": "SOL",
						"amount": "10.00000000",
						"fee": "0.01000000"
					},
					"L-ORPHAN-FIAT": {
						"refid": "REF-ORPHAN-2",
						"time": 1610000400.0,
						"type": "trade",
						"asset": "ZUSD",
						"amount": "-500.0000",
						"fee": "0.0000"
					}
				}
			}
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	cred := newTestCredential()
	txsSnapshot, err := adapter.FetchTransactions(context.Background(), cred, "kraken-spot", nil, nil)
	require.NoError(t, err)
	txs := txsSnapshot.Transactions

	// Expected: Exactly 2 valid paired trades (BUY BTC, SELL ETH).
	// L-BUY-FIAT and L-SELL-FIAT are paired and not emitted as fiat trades.
	// L-ORPHAN-CRYPTO has no pricing counter-leg and is skipped without $1 corruption.
	// L-ORPHAN-FIAT is a fiat-only trade and is skipped without emitting phantom fiat BUY/SELL.
	require.Len(t, txs, 2)

	buyTx := txs[0]
	assert.Equal(t, "L-BUY-CRYPTO", buyTx.ExternalID)
	assert.Equal(t, model.TransactionTypeBuy, buyTx.Type)
	assert.Equal(t, "BTC", buyTx.Symbol)
	require.NotNil(t, buyTx.Quantity)
	assert.True(t, decimal.RequireFromString("0.1").Equal(*buyTx.Quantity))
	require.NotNil(t, buyTx.UnitPriceAmount)
	// Price = 3500 / 0.1 = 35000 USD
	assert.True(t, decimal.RequireFromString("35000").Equal(*buyTx.UnitPriceAmount))
	assert.Equal(t, model.CurrencyUSD, buyTx.UnitPriceCurrency)
	assert.Equal(t, model.Money(350000), buyTx.Amount)
	assert.Equal(t, model.CurrencyUSD, buyTx.Currency)

	sellTx := txs[1]
	assert.Equal(t, "L-SELL-CRYPTO", sellTx.ExternalID)
	assert.Equal(t, model.TransactionTypeSell, sellTx.Type)
	assert.Equal(t, "ETH", sellTx.Symbol)
	require.NotNil(t, sellTx.Quantity)
	assert.True(t, decimal.RequireFromString("2.0").Equal(*sellTx.Quantity))
	require.NotNil(t, sellTx.UnitPriceAmount)
	// Price = 4000 / 2.0 = 2000 EUR
	assert.True(t, decimal.RequireFromString("2000").Equal(*sellTx.UnitPriceAmount))
	assert.Equal(t, model.CurrencyEUR, sellTx.UnitPriceCurrency)
	assert.Equal(t, model.Money(-400000), sellTx.Amount)
	assert.Equal(t, model.CurrencyEUR, sellTx.Currency)
}

func TestKrakenAdapter_ExtractBaseAssetFromPair_ModernAndLegacy(t *testing.T) {
	tests := []struct {
		pair         string
		expectedBase string
	}{
		{"XXBTZUSD", "BTC"},
		{"XETHZEUR", "ETH"},
		{"XXRPZGBP", "XRP"},
		{"XLTCZJPY", "LTC"},
		{"SOLUSD", "SOL"},
		{"SOLEUR", "SOL"},
		{"DOTEUR", "DOT"},
		{"DOTUSD", "DOT"},
		{"ADAUSD", "ADA"},
		{"ADAUSDT", "ADA"},
		{"BTCUSDC", "BTC"},
		{"AVAXUSD", "AVAX"},
		{"LINKUSD", "LINK"},
		{"MATICUSD", "MATIC"},
	}

	for _, tc := range tests {
		base := adapters.ExtractBaseAssetFromPair(tc.pair)
		assert.Equal(t, tc.expectedBase, base, "mismatch for pair %s", tc.pair)
	}
}

func TestKrakenAdapter_RateLimiting_AllEndpoints(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error": ["EAPI:Rate limit exceeded"]}`))
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)
	cred := newTestCredential()

	_, err := adapter.FetchBalances(context.Background(), cred, "kraken-spot")
	assert.ErrorIs(t, err, syncservice.ErrRateLimited)

	_, err = adapter.FetchHoldings(context.Background(), cred, "kraken-spot")
	assert.ErrorIs(t, err, syncservice.ErrRateLimited)

	_, err = adapter.FetchTransactions(context.Background(), cred, "kraken-spot", nil, nil)
	assert.ErrorIs(t, err, syncservice.ErrRateLimited)
}

func TestKrakenAdapter_CredentialParsing(t *testing.T) {
	t.Run("nil credential", func(t *testing.T) {
		adapter := adapters.NewKrakenAdapter()
		err := adapter.TestConnection(context.Background(), nil)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("empty raw data", func(t *testing.T) {
		adapter := adapters.NewKrakenAdapter()
		cred := &model.SyncCredential{RawData: ""}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("invalid json", func(t *testing.T) {
		adapter := adapters.NewKrakenAdapter()
		cred := &model.SyncCredential{RawData: "not json"}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("missing api secret", func(t *testing.T) {
		adapter := adapters.NewKrakenAdapter()
		cred := &model.SyncCredential{RawData: `{"apiKey":"key-only"}`}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("invalid base64 secret", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		adapter := adapters.NewKrakenAdapter(adapters.WithBaseURL(server.URL))
		cred := &model.SyncCredential{RawData: `{"apiKey":"key","apiSecret":"not-base-64!!!"}`}
		err := adapter.TestConnection(context.Background(), cred)
		assert.ErrorIs(t, err, syncservice.ErrInvalidCredentials)
	})

	t.Run("snake_case keys support", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "key-snake", r.Header.Get("API-Key"))
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"error": [], "result": {}}`))
		}))
		defer server.Close()

		adapter := adapters.NewKrakenAdapter(
			adapters.WithBaseURL(server.URL),
			adapters.WithHTTPClient(server.Client()),
		)
		cred := &model.SyncCredential{RawData: fmt.Sprintf(`{"api_key":"key-snake","api_secret":"%s"}`, testAPISecret)}
		err := adapter.TestConnection(context.Background(), cred)
		assert.NoError(t, err)
	})
}

func TestKrakenAdapter_AssetNormalization(t *testing.T) {
	tests := []struct {
		input          string
		expectedSymbol string
		expectedFiat   bool
	}{
		{"XXBT", "BTC", false},
		{"XBT", "BTC", false},
		{"XETH", "ETH", false},
		{"XXRP", "XRP", false},
		{"XXLM", "XLM", false},
		{"XLTC", "LTC", false},
		{"ZEUR", "EUR", true},
		{"ZUSD", "USD", true},
		{"ZGBP", "GBP", true},
		{"ZJPY", "JPY", true},
		{"ZCAD", "CAD", true},
		{"SOL", "SOL", false},
		{"SOL03.S", "SOL", false},
		{"SOL03", "SOL", false},
		{"ETH2.S", "ETH", false},
		{"ETH2", "ETH", false},
		{"ADA2", "ADA", false},
		{"ADA02", "ADA", false},
		{"XBT.M", "BTC", false},
		{"SUI.B", "SUI", false},
		{"DOT.P", "DOT", false},
		{"DOT", "DOT", false},
		{"USDT", "USDT", false},
		{"EUR", "EUR", true},
		{"USD", "USD", true},
	}

	for _, tc := range tests {
		sym, isFiat := adapters.NormalizeKrakenAsset(tc.input)
		assert.Equal(t, tc.expectedSymbol, sym, "symbol mismatch for %s", tc.input)
		assert.Equal(t, tc.expectedFiat, isFiat, "isFiat mismatch for %s", tc.input)
	}
}

func TestKrakenAdapter_FetchHoldings_AggregatesStakedAndSpotBalances(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/0/private/Balance":
			_, _ = w.Write([]byte(`{
				"error": [],
				"result": {
					"XXBT": "0.01041399",
					"XBT.M": "0.07288802",
					"ETH2.S": "0.39949460",
					"SOL03.S": "17.95214990",
					"ZEUR": "100.00"
				}
			}`))
		case "/0/private/OpenPositions":
			_, _ = w.Write([]byte(`{
				"error": [],
				"result": {}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(adapters.WithKrakenBaseURL(server.URL))
	cred := newTestCredential()

	holdingsSnapshot, err := adapter.FetchHoldings(context.Background(), cred, "ext-1")
	require.NoError(t, err)
	holdings := holdingsSnapshot.Holdings

	// Should have 3 aggregated holdings: BTC, ETH, SOL
	require.Len(t, holdings, 3)

	assert.Equal(t, "BTC", holdings[0].Symbol)
	// 0.01041399 + 0.07288802 = 0.08330201
	expectedBTC, _ := decimal.NewFromString("0.08330201")
	assert.True(t, holdings[0].Quantity.Equal(expectedBTC), "expected %s, got %s", expectedBTC, holdings[0].Quantity)

	assert.Equal(t, "ETH", holdings[1].Symbol)
	expectedETH, _ := decimal.NewFromString("0.39949460")
	assert.True(t, holdings[1].Quantity.Equal(expectedETH))

	assert.Equal(t, "SOL", holdings[2].Symbol)
	expectedSOL, _ := decimal.NewFromString("17.95214990")
	assert.True(t, holdings[2].Quantity.Equal(expectedSOL))
}

func TestKrakenAdapter_StablecoinQuotedTradePricesInDollars(t *testing.T) {
	// Kraken writes a stablecoin-quoted trade as two non-fiat ledger legs
	// (BTC +0.01000000 / USDT -350.00000000). The USDT leg has to price the trade:
	// left unclassified it fell into the barter branch, which stored "USDT" as the
	// transaction currency — wider than the old column allowed, and outside the
	// currencies portfolio valuation understands.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if krakenAssetListUnavailable(w, r) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"error": [],
			"result": {
				"count": 2,
				"ledger": {
					"L-BUY-CRYPTO": {
						"refid": "REF-USDT",
						"time": 1760000000.0,
						"type": "trade",
						"asset": "XXBT",
						"amount": "0.01000000",
						"fee": "0.00001000"
					},
					"L-BUY-STABLE": {
						"refid": "REF-USDT",
						"time": 1760000000.0,
						"type": "trade",
						"asset": "USDT",
						"amount": "-350.00000000",
						"fee": "0.00000000"
					}
				}
			}
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	txsSnapshot, err := adapter.FetchTransactions(context.Background(), newTestCredential(), "kraken-spot", nil, nil)
	require.NoError(t, err)
	txs := txsSnapshot.Transactions
	require.Len(t, txs, 1, "the stablecoin leg must not produce a phantom transaction")

	buy := txs[0]
	assert.Equal(t, "L-BUY-CRYPTO", buy.ExternalID)
	assert.Equal(t, model.TransactionTypeBuy, buy.Type)
	assert.Equal(t, "BTC", buy.Symbol)
	require.NotNil(t, buy.Quantity)
	assert.True(t, decimal.RequireFromString("0.01").Equal(*buy.Quantity))
	require.NotNil(t, buy.UnitPriceAmount)
	assert.True(t, decimal.RequireFromString("35000").Equal(*buy.UnitPriceAmount))
	assert.Equal(t, model.CurrencyUSD, buy.UnitPriceCurrency)
	assert.Equal(t, model.Money(35000), buy.Amount)
	assert.Equal(t, model.CurrencyUSD, buy.Currency)
	assert.True(t, buy.UnitPriceCurrency.IsValid(), "the price currency must stay inside the currencies valuation understands")
}

func TestKrakenAdapter_ExoticFiatQuoteKeepsItsOwnCurrency(t *testing.T) {
	// JPY sits outside the app's money model (USD/EUR/GBP). Reporting it as USD would
	// invent a dollar price for a yen trade, so the leg keeps its own currency and
	// valuation skips the trade instead of valuing it wrongly.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if krakenAssetListUnavailable(w, r) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"error": [],
			"result": {
				"count": 2,
				"ledger": {
					"L-BUY-CRYPTO": {
						"refid": "REF-JPY",
						"time": 1760000000.0,
						"type": "trade",
						"asset": "XXBT",
						"amount": "0.00500000",
						"fee": "0.00000500"
					},
					"L-BUY-FIAT": {
						"refid": "REF-JPY",
						"time": 1760000000.0,
						"type": "trade",
						"asset": "ZJPY",
						"amount": "-750000.0000",
						"fee": "0.0000"
					}
				}
			}
		}`))
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	txsSnapshot, err := adapter.FetchTransactions(context.Background(), newTestCredential(), "kraken-spot", nil, nil)
	require.NoError(t, err)
	txs := txsSnapshot.Transactions
	require.Len(t, txs, 1)

	buy := txs[0]
	assert.Equal(t, model.Currency("JPY"), buy.UnitPriceCurrency)
	assert.Equal(t, model.Money(75000000), buy.Amount)
	assert.True(t, buy.UnitPriceCurrency.IsValid())
}

func TestKrakenAdapter_AssetDictionaryResolvesRenamedAssets(t *testing.T) {
	// Kraken's own asset list is the source of truth for codes the built-in mapping does
	// not recognise, so renamed listings (MATIC -> POL) keep resolving without a code
	// change here. Names that are not tickers, such as the pair name "G/USD", must be
	// rejected in favour of the built-in mapping.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/0/public/Assets" && r.URL.Query().Get("assetVersion") == "1":
			_, _ = w.Write([]byte(`{"error": [], "result": {
				"POL": {"aclass": "currency", "altname": "POL", "decimals": 8},
				"G": {"aclass": "currency", "altname": "G", "decimals": 8},
				"USD": {"aclass": "currency", "altname": "USD", "decimals": 8}
			}}`))
		case r.URL.Path == "/0/public/Assets":
			_, _ = w.Write([]byte(`{"error": [], "result": {
				"MATIC": {"aclass": "currency", "altname": "POL", "decimals": 8},
				"GUSD": {"aclass": "currency", "altname": "GUSD", "decimals": 8}
			}}`))
		case r.URL.Path == "/0/public/AssetPairs":
			_, _ = w.Write([]byte(`{"error": [], "result": {
				"GUSD": {"wsname": "G/USD", "base": "G", "quote": "USD"}
			}}`))
		case r.URL.Path == "/0/private/Balance":
			_, _ = w.Write([]byte(`{"error": [], "result": {"MATIC": "10.00000000", "GUSD": "5.00000000"}}`))
		case r.URL.Path == "/0/private/OpenPositions":
			_, _ = w.Write([]byte(`{"error": [], "result": {}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := adapters.NewKrakenAdapter(
		adapters.WithBaseURL(server.URL),
		adapters.WithHTTPClient(server.Client()),
	)

	holdingsSnapshot, err := adapter.FetchHoldings(context.Background(), newTestCredential(), "kraken-spot")
	require.NoError(t, err)
	holdings := holdingsSnapshot.Holdings
	require.Len(t, holdings, 2)

	bySymbol := make(map[string]syncservice.RawHolding, len(holdings))
	for _, holding := range holdings {
		bySymbol[holding.Symbol] = holding
	}

	renamed, ok := bySymbol["POL"]
	require.True(t, ok, "Kraken's asset list should resolve MATIC to its current ticker, got %v", bySymbol)
	assert.True(t, decimal.RequireFromString("10").Equal(renamed.Quantity))

	_, ok = bySymbol["GUSD"]
	assert.True(t, ok, "a pair name such as G/USD is not a ticker; the built-in mapping must win")
}
