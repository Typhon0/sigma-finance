package adapters

import (
	"context"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/krakenfx/api-go/v2/pkg/spot"
)

const (
	// krakenAssetDictionaryTTL bounds how stale the cached Kraken asset list may be.
	krakenAssetDictionaryTTL = 12 * time.Hour
	// krakenAssetDictionaryRetryDelay spaces out failed refreshes: the deterministic
	// mapping keeps working while Kraken's asset list is unreachable.
	krakenAssetDictionaryRetryDelay = 5 * time.Minute
	// krakenAssetTickerMaxLen guards against asset names that are not tickers at all
	// (Kraken lists a few as "G/USD", "BTC.M" style display names).
	krakenAssetTickerMaxLen = 10
)

// krakenAssetDictionary resolves Kraken ledger and balance asset codes into the
// tickers the rest of the app trades in, using Kraken's own public asset list as the
// source of truth (the official SDK's Normalizer). Kraken lists new assets and renames
// old ones without warning, so a hand-maintained switch goes stale; the deterministic
// NormalizeKrakenAsset mapping stays the offline fallback for every code the dictionary
// cannot place, including Kraken Earn variants ("ETH2.S", "SOL03.S") that the public
// asset list does not describe.
type krakenAssetDictionary struct {
	baseURL string
	client  *http.Client
	ttl     time.Duration
	retry   time.Duration

	mu         sync.Mutex
	normalizer *spot.Normalizer
	loadedAt   time.Time
	retryAt    time.Time
}

func newKrakenAssetDictionary(baseURL string, client *http.Client, ttl, retry time.Duration) *krakenAssetDictionary {
	return &krakenAssetDictionary{baseURL: baseURL, client: client, ttl: ttl, retry: retry}
}

// assetSymbol resolves a Kraken asset code to the app's ticker, preferring Kraken's
// live asset list and falling back to the deterministic mapping.
func (k *KrakenAdapter) assetSymbol(ctx context.Context, code string) (string, bool) {
	if k.assetNames == nil {
		return NormalizeKrakenAsset(code)
	}
	return k.assetNames.Resolve(ctx, code)
}

// Resolve returns the ticker and whether it is a government currency for a Kraken
// asset code such as "XXBT", "ETH2.S" or "USDT".
func (d *krakenAssetDictionary) Resolve(ctx context.Context, code string) (string, bool) {
	staticSymbol, isFiat := NormalizeKrakenAsset(code)
	if !strings.EqualFold(staticSymbol, strings.TrimSpace(code)) {
		// The deterministic mapping recognised a legacy prefix or an Earn suffix;
		// Kraken's asset list describes neither, so its answer is no better here.
		return staticSymbol, isFiat
	}

	name, ok := d.lookupName(ctx, staticSymbol)
	if !ok || !isPlausibleKrakenTicker(name) {
		return staticSymbol, isFiat
	}

	return name, isFiatCurrency(name)
}

func (d *krakenAssetDictionary) lookupName(ctx context.Context, code string) (string, bool) {
	normalizer, ok := d.assets(ctx)
	if !ok {
		return "", false
	}
	return normalizer.Name(code), true
}

// assets returns the cached Kraken asset list, refreshing it when stale. A failed
// refresh is logged and retried after a short delay, leaving callers on the static
// mapping in the meantime. The lock is held across the refresh so one sync issues one
// refresh; the adapter is a singleton created at startup.
func (d *krakenAssetDictionary) assets(ctx context.Context) (*spot.Normalizer, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()

	fresh := d.normalizer != nil && time.Since(d.loadedAt) < d.ttl
	if fresh || time.Now().Before(d.retryAt) {
		return d.normalizer, d.normalizer != nil
	}

	rest := spot.NewREST()
	rest.BaseURL = d.baseURL
	rest.Executor = func(req *http.Request) (*http.Response, error) {
		return d.client.Do(req.WithContext(ctx))
	}

	normalizer := spot.NewNormalizer()
	if err := normalizer.Use(rest); err != nil {
		log.Printf("[WARN] [KrakenAdapter] could not load Kraken's asset list, keeping the built-in symbol mapping: %v", err)
		d.retryAt = time.Now().Add(d.retry)
		return d.normalizer, d.normalizer != nil
	}

	d.normalizer = normalizer
	d.loadedAt = time.Now()
	return d.normalizer, true
}

// isPlausibleKrakenTicker reports whether a name from Kraken's asset list can be used
// as an asset ticker. Names such as "G/USD" or "BTC.M" describe the asset but are not
// tickers, and downstream price lookups would fail on them.
func isPlausibleKrakenTicker(name string) bool {
	if name == "" || len(name) > krakenAssetTickerMaxLen {
		return false
	}
	for _, r := range name {
		if (r < 'A' || r > 'Z') && (r < '0' || r > '9') {
			return false
		}
	}
	return true
}
