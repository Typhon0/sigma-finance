package service

import (
	"strings"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
)

func TestRuntimeMarketDataCacheKeyIncludesRoutingDimensions(t *testing.T) {
	svc := &marketDataService{}
	provider := "binance"
	from := time.Date(2026, 4, 20, 10, 3, 7, 0, time.UTC)
	to := time.Date(2026, 4, 20, 10, 59, 55, 0, time.UTC)

	key := svc.runtimeMarketDataCacheKey(
		"user-123",
		"instr-456",
		&provider,
		"candles",
		model.Interval5m,
		from,
		to,
		100,
	)

	expectedParts := []string{
		"user:user-123",
		"instrument:instr-456",
		"provider:BINANCE",
		"type:CANDLES",
		"interval:5M",
		"limit:100",
	}

	for _, part := range expectedParts {
		if !strings.Contains(key, part) {
			t.Fatalf("expected cache key to include %q, got %q", part, key)
		}
	}
}

func TestNormalizeCandleWindowForCacheTruncatesToIntervalBucket(t *testing.T) {
	from := time.Date(2026, 4, 20, 10, 4, 59, 0, time.UTC)
	to := time.Date(2026, 4, 20, 10, 14, 58, 0, time.UTC)

	normalizedFrom, normalizedTo := normalizeCandleWindowForCache(model.Interval5m, from, to)

	if normalizedFrom != time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC) {
		t.Fatalf("unexpected normalized from: %s", normalizedFrom)
	}
	if normalizedTo != time.Date(2026, 4, 20, 10, 10, 0, 0, time.UTC) {
		t.Fatalf("unexpected normalized to: %s", normalizedTo)
	}
}

func TestInvalidateRuntimeMarketDataCacheForUser(t *testing.T) {
	svc := &marketDataService{runtimeCache: make(map[string]*instrumentCandlesCacheEntry)}
	from := time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 20, 11, 0, 0, 0, time.UTC)

	userAInstrument1Key := svc.runtimeMarketDataCacheKey("user-a", "inst-1", nil, "candles", model.Interval1m, from, to, 100)
	userAInstrument2Key := svc.runtimeMarketDataCacheKey("user-a", "inst-2", nil, "candles", model.Interval1m, from, to, 100)
	userBInstrument1Key := svc.runtimeMarketDataCacheKey("user-b", "inst-1", nil, "candles", model.Interval1m, from, to, 100)

	result := &InstrumentCandlesResult{Candles: []model.Candle{{Symbol: "BTC"}}}
	svc.setRuntimeCandlesCache(userAInstrument1Key, result, time.Minute)
	svc.setRuntimeCandlesCache(userAInstrument2Key, result, time.Minute)
	svc.setRuntimeCandlesCache(userBInstrument1Key, result, time.Minute)

	removed := svc.InvalidateRuntimeMarketDataCacheForUser("user-a", RuntimeCacheInvalidationReasonCredential)
	if removed != 2 {
		t.Fatalf("expected 2 entries removed for user-a, got %d", removed)
	}

	if got := svc.getRuntimeCandlesCache(userAInstrument1Key); got != nil {
		t.Fatal("expected user-a instrument-1 cache entry to be removed")
	}
	if got := svc.getRuntimeCandlesCache(userAInstrument2Key); got != nil {
		t.Fatal("expected user-a instrument-2 cache entry to be removed")
	}
	if got := svc.getRuntimeCandlesCache(userBInstrument1Key); got == nil {
		t.Fatal("expected user-b cache entry to remain")
	}
}

func TestInvalidateRuntimeMarketDataCacheForInstrument(t *testing.T) {
	svc := &marketDataService{runtimeCache: make(map[string]*instrumentCandlesCacheEntry)}
	from := time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 20, 11, 0, 0, 0, time.UTC)

	inst1UserAKey := svc.runtimeMarketDataCacheKey("user-a", "inst-1", nil, "candles", model.Interval1m, from, to, 100)
	inst1UserBKey := svc.runtimeMarketDataCacheKey("user-b", "inst-1", nil, "candles", model.Interval1m, from, to, 100)
	inst2UserAKey := svc.runtimeMarketDataCacheKey("user-a", "inst-2", nil, "candles", model.Interval1m, from, to, 100)

	result := &InstrumentCandlesResult{Candles: []model.Candle{{Symbol: "ETH"}}}
	svc.setRuntimeCandlesCache(inst1UserAKey, result, time.Minute)
	svc.setRuntimeCandlesCache(inst1UserBKey, result, time.Minute)
	svc.setRuntimeCandlesCache(inst2UserAKey, result, time.Minute)

	removed := svc.InvalidateRuntimeMarketDataCacheForInstrument("inst-1", RuntimeCacheInvalidationReasonMapping)
	if removed != 2 {
		t.Fatalf("expected 2 entries removed for inst-1, got %d", removed)
	}

	if got := svc.getRuntimeCandlesCache(inst1UserAKey); got != nil {
		t.Fatal("expected inst-1 user-a cache entry to be removed")
	}
	if got := svc.getRuntimeCandlesCache(inst1UserBKey); got != nil {
		t.Fatal("expected inst-1 user-b cache entry to be removed")
	}
	if got := svc.getRuntimeCandlesCache(inst2UserAKey); got == nil {
		t.Fatal("expected inst-2 cache entry to remain")
	}
}

func TestRuntimeCacheInvalidationStatsByReason(t *testing.T) {
	svc := &marketDataService{runtimeCache: make(map[string]*instrumentCandlesCacheEntry)}
	from := time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 20, 11, 0, 0, 0, time.UTC)

	keyCredential := svc.runtimeMarketDataCacheKey("user-a", "inst-1", nil, "candles", model.Interval1m, from, to, 100)
	keyMapping := svc.runtimeMarketDataCacheKey("user-b", "inst-2", nil, "candles", model.Interval1m, from, to, 100)
	result := &InstrumentCandlesResult{Candles: []model.Candle{{Symbol: "BTC"}}}
	svc.setRuntimeCandlesCache(keyCredential, result, time.Minute)
	svc.setRuntimeCandlesCache(keyMapping, result, time.Minute)

	svc.InvalidateRuntimeMarketDataCacheForUser("user-a", RuntimeCacheInvalidationReasonCredential)
	svc.InvalidateRuntimeMarketDataCacheForInstrument("inst-2", RuntimeCacheInvalidationReasonMapping)

	stats := svc.GetRuntimeMarketDataInvalidationStats()
	if stats.TotalEvents != 2 {
		t.Fatalf("expected total events to be 2, got %d", stats.TotalEvents)
	}
	if stats.TotalEntriesRemoved != 2 {
		t.Fatalf("expected total removed to be 2, got %d", stats.TotalEntriesRemoved)
	}
	if stats.CredentialEvents != 1 {
		t.Fatalf("expected credential events to be 1, got %d", stats.CredentialEvents)
	}
	if stats.MappingEvents != 1 {
		t.Fatalf("expected mapping events to be 1, got %d", stats.MappingEvents)
	}
	if stats.OtherEvents != 0 {
		t.Fatalf("expected other events to be 0, got %d", stats.OtherEvents)
	}
}
