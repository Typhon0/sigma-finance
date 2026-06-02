package providers

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func newTestBinanceProvider() *BinanceProvider {
	return NewBinanceProvider()
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
