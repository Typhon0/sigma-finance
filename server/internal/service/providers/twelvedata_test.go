package providers

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func newTestTwelveDataProvider() *TwelveDataProvider {
	return NewTwelveDataProvider()
}

func TestTwelveData_CooldownMixin_IsInCooldown(t *testing.T) {
	provider := newTestTwelveDataProvider()
	assert.False(t, provider.IsInCooldown())
}

func TestTwelveData_CooldownMixin_EnterCooldown(t *testing.T) {
	provider := newTestTwelveDataProvider()

	provider.EnterCooldown(DefaultRetryAfterMax)
	assert.True(t, provider.IsInCooldown())
}

func TestTwelveData_CooldownMixin_CooldownError(t *testing.T) {
	provider := newTestTwelveDataProvider()

	err := provider.CooldownError(provider.ID(), provider.Name())
	assert.Equal(t, "TWELVEDATA", err.Provider)
	assert.Equal(t, "RATE_LIMITED", err.Code)
	assert.True(t, err.Retryable)
	assert.True(t, err.Fallback)
	assert.Equal(t, 429, err.HTTPCode)
}

func TestTwelveData_EnterCooldown_ZeroDefaultsToMax(t *testing.T) {
	provider := newTestTwelveDataProvider()

	provider.EnterCooldown(0)
	assert.True(t, provider.IsInCooldown())
}

func TestTwelveData_EnterCooldown_ExcessiveClamped(t *testing.T) {
	provider := newTestTwelveDataProvider()

	provider.EnterCooldown(DefaultRetryAfterMax + 10*DefaultRetryAfterMax)
	assert.True(t, provider.IsInCooldown())
}

func TestTwelveData_ReturnsConcreteType(t *testing.T) {
	provider := NewTwelveDataProvider()
	assert.NotNil(t, provider)
	assert.Equal(t, "TWELVEDATA", provider.ID())
	assert.Equal(t, "Twelve Data", provider.Name())
}
