package providers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestBinanceProvider() *BinanceProvider {
	return NewBinanceProvider()
}

func TestBinance_InvalidSymbolReturnsTickerNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"code":-1121,"msg":"Invalid symbol."}`))
	}))
	defer server.Close()

	provider := NewBinanceProvider()
	provider.baseURL = server.URL

	// 1. GetQuote
	_, err := provider.GetQuote(context.Background(), QuoteRequest{
		Symbol:    "SGB",
		AssetType: "CRYPTO",
	})
	require.Error(t, err)
	pe, ok := err.(*ProviderError)
	require.True(t, ok, "expected *ProviderError, got %T", err)
	assert.Equal(t, "TICKER_NOT_FOUND", pe.Code)
	assert.False(t, pe.Retryable)
	assert.True(t, pe.Fallback)
	assert.True(t, IsTickerNotFound(err))

	// 2. GetCandles
	_, err = provider.GetCandles(context.Background(), CandleRequest{
		Symbol:    "SGB",
		AssetType: "CRYPTO",
		Interval:  "1m",
	})
	require.Error(t, err)
	peCandles, ok := err.(*ProviderError)
	require.True(t, ok, "expected *ProviderError for GetCandles, got %T", err)
	assert.Equal(t, "TICKER_NOT_FOUND", peCandles.Code)
	assert.False(t, peCandles.Retryable)
	assert.True(t, peCandles.Fallback)
	assert.True(t, IsTickerNotFound(err))
}

func TestBinance_CooldownMixin_IsInCooldown(t *testing.T) {
	provider := newTestBinanceProvider()
	assert.False(t, provider.IsInCooldown())
}

func TestBinance_CooldownMixin_EnterCooldown(t *testing.T) {
	provider := newTestBinanceProvider()

	provider.EnterCooldown(DefaultRetryAfterMax)
	assert.True(t, provider.IsInCooldown())
}

func TestBinance_CooldownMixin_CooldownError(t *testing.T) {
	provider := newTestBinanceProvider()

	err := provider.CooldownError(provider.ID(), provider.Name())
	assert.Equal(t, "BINANCE", err.Provider)
	assert.Equal(t, "RATE_LIMITED", err.Code)
	assert.True(t, err.Retryable)
	assert.True(t, err.Fallback)
	assert.Equal(t, 429, err.HTTPCode)
}

func TestBinance_EnterCooldown_ZeroDefaultsToMax(t *testing.T) {
	provider := newTestBinanceProvider()

	provider.EnterCooldown(0)
	assert.True(t, provider.IsInCooldown())
}

func TestBinance_EnterCooldown_ExcessiveClamped(t *testing.T) {
	provider := newTestBinanceProvider()

	provider.EnterCooldown(DefaultRetryAfterMax + 10*DefaultRetryAfterMax)
	assert.True(t, provider.IsInCooldown())
}

func TestBinance_ReturnsConcreteType(t *testing.T) {
	provider := NewBinanceProvider()
	assert.NotNil(t, provider)
	assert.Equal(t, "BINANCE", provider.ID())
	assert.Equal(t, "Binance Spot", provider.Name())
}
