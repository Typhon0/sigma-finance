package providers

import (
	"net/http"
	"testing"
	"time"
)

func TestParseRetryAfter(t *testing.T) {
	max := 5 * time.Minute

	t.Run("nil response returns default", func(t *testing.T) {
		got := ParseRetryAfter(nil, max, max)
		if got != max {
			t.Errorf("expected %v, got %v", max, got)
		}
	})

	t.Run("missing header returns default", func(t *testing.T) {
		resp := &http.Response{Header: http.Header{}}
		got := ParseRetryAfter(resp, max, max)
		if got != max {
			t.Errorf("expected %v, got %v", max, got)
		}
	})

	t.Run("delta-seconds format", func(t *testing.T) {
		resp := &http.Response{Header: http.Header{"Retry-After": []string{"60"}}}
		got := ParseRetryAfter(resp, max, max)
		if got != 60*time.Second {
			t.Errorf("expected 60s, got %v", got)
		}
	})

	t.Run("delta-seconds zero returns default", func(t *testing.T) {
		resp := &http.Response{Header: http.Header{"Retry-After": []string{"0"}}}
		got := ParseRetryAfter(resp, max, max)
		if got != max {
			t.Errorf("expected max %v, got %v", max, got)
		}
	})

	t.Run("delta-seconds negative returns default", func(t *testing.T) {
		resp := &http.Response{Header: http.Header{"Retry-After": []string{"-5"}}}
		got := ParseRetryAfter(resp, max, max)
		if got != max {
			t.Errorf("expected max %v, got %v", max, got)
		}
	})

	t.Run("delta-seconds exceeds max", func(t *testing.T) {
		resp := &http.Response{Header: http.Header{"Retry-After": []string{"600"}}}
		got := ParseRetryAfter(resp, max, max)
		if got != max {
			t.Errorf("expected max %v, got %v", max, got)
		}
	})

	t.Run("RFC1123 date format", func(t *testing.T) {
		future := time.Now().Add(30 * time.Second).UTC().Format(time.RFC1123)
		resp := &http.Response{Header: http.Header{"Retry-After": []string{future}}}
		got := ParseRetryAfter(resp, max, max)
		if got < 29*time.Second || got > 31*time.Second {
			t.Errorf("expected ~30s, got %v", got)
		}
	})

	t.Run("RFC850 date format", func(t *testing.T) {
		future := time.Now().Add(30 * time.Second).UTC().Format(time.RFC850)
		resp := &http.Response{Header: http.Header{"Retry-After": []string{future}}}
		got := ParseRetryAfter(resp, max, max)
		if got < 29*time.Second || got > 31*time.Second {
			t.Errorf("expected ~30s, got %v", got)
		}
	})

	t.Run("past date returns default", func(t *testing.T) {
		past := time.Now().Add(-5 * time.Minute).UTC().Format(time.RFC1123)
		resp := &http.Response{Header: http.Header{"Retry-After": []string{past}}}
		got := ParseRetryAfter(resp, max, max)
		if got != max {
			t.Errorf("expected max %v, got %v", max, got)
		}
	})

	t.Run("garbage header returns default", func(t *testing.T) {
		resp := &http.Response{Header: http.Header{"Retry-After": []string{"not-a-number"}}}
		got := ParseRetryAfter(resp, max, max)
		if got != max {
			t.Errorf("expected max %v, got %v", max, got)
		}
	})
}

func TestEnterCooldown(t *testing.T) {
	t.Run("normal duration", func(t *testing.T) {
		m := NewCooldownMixin(5 * time.Minute)
		m.EnterCooldown(30 * time.Second)
		if !m.IsInCooldown() {
			t.Error("expected to be in cooldown after entering")
		}
	})

	t.Run("zero duration defaults to max", func(t *testing.T) {
		m := NewCooldownMixin(5 * time.Minute)
		m.EnterCooldown(0)
		if !m.IsInCooldown() {
			t.Error("expected to be in cooldown after entering with zero")
		}
	})

	t.Run("excessive duration clamped to max", func(t *testing.T) {
		m := NewCooldownMixin(5 * time.Minute)
		m.EnterCooldown(10 * time.Minute)
		if !m.IsInCooldown() {
			t.Error("expected to be in cooldown after entering with excessive duration")
		}
	})

	t.Run("IsInCooldown respects expiry", func(t *testing.T) {
		m := NewCooldownMixin(5 * time.Minute)
		if m.IsInCooldown() {
			t.Error("should not be in cooldown initially")
		}
		m.EnterCooldown(30 * time.Second)
		if !m.IsInCooldown() {
			t.Error("should be in cooldown after entering")
		}
	})

	t.Run("CooldownError returns correct error", func(t *testing.T) {
		m := NewCooldownMixin(5 * time.Minute)
		err := m.CooldownError("TEST", "Test Provider")
		if err.Code != "RATE_LIMITED" {
			t.Errorf("expected code RATE_LIMITED, got %s", err.Code)
		}
		if !err.Retryable {
			t.Error("expected error to be retryable")
		}
		if !err.Fallback {
			t.Error("expected fallback to be true")
		}
		if err.HTTPCode != 429 {
			t.Errorf("expected HTTP 429, got %d", err.HTTPCode)
		}
	})
}
