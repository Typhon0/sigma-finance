package providers

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func newTestFXProvider() *FXProvider {
	return &FXProvider{
		client:        &http.Client{Timeout: 30 * time.Second},
		tdBaseURL:     "https://api.twelvedata.com",
		fkBaseURL:     "https://api.frankfurter.dev",
		CooldownMixin: NewCooldownMixin(DefaultRetryAfterMax),
	}
}

func TestFXProvider_NewFXProvider_EmbedsCooldownMixin(t *testing.T) {
	p := NewFXProvider()
	assert.NotNil(t, p)
	assert.False(t, p.IsInCooldown())
}

func TestFXProvider_EnterCooldown_ThenIsInCooldown(t *testing.T) {
	p := newTestFXProvider()
	assert.False(t, p.IsInCooldown())

	p.EnterCooldown(1 * time.Minute)
	assert.True(t, p.IsInCooldown())
}

func TestFXProvider_CooldownError(t *testing.T) {
	p := newTestFXProvider()
	p.EnterCooldown(1 * time.Minute)

	err := p.CooldownError(p.ID(), p.Name())
	assert.NotNil(t, err)
	assert.Equal(t, "RATE_LIMITED", err.Code)
	assert.True(t, err.Retryable)
}

func TestFXProvider_EnterCooldown_ZeroDefaultsToMax(t *testing.T) {
	p := newTestFXProvider()

	p.EnterCooldown(0)
	assert.True(t, p.IsInCooldown())
}

func TestFXProvider_EnterCooldown_ExcessiveClamped(t *testing.T) {
	p := newTestFXProvider()

	p.EnterCooldown(DefaultRetryAfterMax + 10*DefaultRetryAfterMax)
	assert.True(t, p.IsInCooldown())
}

func TestFXProvider_ReturnsConcreteType(t *testing.T) {
	p := NewFXProvider()
	_, ok := interface{}(p).(Provider)
	assert.True(t, ok, "*FXProvider should satisfy the Provider interface")
}
