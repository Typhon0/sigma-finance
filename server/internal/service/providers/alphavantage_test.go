package providers

import (
	"testing"
	"time"
)

func TestAlphaVantageCooldown(t *testing.T) {
	// AlphaVantage embeds CooldownMixin; cooldown behavior is tested via
	// the shared CooldownMixin in tiingo_test.go. These tests verify
	// provider-specific integration: that the constructor initializes
	// the mixin and that cooldown methods work through the embedded struct.

	t.Run("constructor initializes CooldownMixin", func(t *testing.T) {
	provider := NewAlphaVantageProvider().(*AlphaVantageProvider)
	if provider.IsInCooldown() {
			t.Fatal("expected provider not to be in cooldown initially")
		}
	})

	t.Run("EnterCooldown and IsInCooldown work via embedding", func(t *testing.T) {
		provider := NewAlphaVantageProvider().(*AlphaVantageProvider)
		provider.EnterCooldown(30 * time.Second)
		if !provider.IsInCooldown() {
			t.Fatal("expected provider to be in cooldown after EnterCooldown(30s)")
		}
	})

	t.Run("CooldownError has correct provider info", func(t *testing.T) {
		provider := NewAlphaVantageProvider().(*AlphaVantageProvider)
		err := provider.CooldownError(provider.ID(), provider.Name())
		if err.Code != "RATE_LIMITED" {
			t.Errorf("expected code RATE_LIMITED, got %s", err.Code)
		}
		if err.Provider != provider.ID() {
			t.Errorf("expected provider %s, got %s", provider.ID(), err.Provider)
		}
		if !err.Retryable {
			t.Error("expected error to be retryable")
		}
		if !err.Fallback {
			t.Error("expected fallback to be true")
		}
	})
}
