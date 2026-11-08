package traderepublic

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

var (
	// ErrWAFChromiumNotFound indicates headless Chromium is missing from the environment.
	ErrWAFChromiumNotFound = errors.New("AWS WAF token acquisition requires Chromium in the runtime environment (e.g. 'apk add chromium' in Alpine Docker). Alternatively set TRADE_REPUBLIC_WAF_TOKEN")

	// ErrWAFChallengeFailed indicates the AWS WAF script evaluation did not return a valid token.
	ErrWAFChallengeFailed = errors.New("AWS WAF challenge failed to yield a valid aws-waf-token")

	// ErrWAFTokenTimeout indicates token acquisition exceeded the allowed context timeout.
	ErrWAFTokenTimeout = errors.New("timeout while acquiring AWS WAF token")
)

const (
	// DefaultWAFTTL is the duration an AWS WAF token is considered fresh (~4 hours nominal lifetime).
	DefaultWAFTTL = 3*time.Hour + 30*time.Minute

	// TradeRepublicAppURL is the endpoint hosting the client-side AWS WAF challenge script.
	TradeRepublicAppURL = "https://app.traderepublic.com"
)

// WAFTokenProvider defines the contract for acquiring valid AWS WAF tokens.
type WAFTokenProvider interface {
	GetWAFToken(ctx context.Context) (string, error)
}

// AutomatedWAFTokenProvider acquires and caches AWS WAF tokens using headless browser execution.
//
// Runtime dependencies:
// - Requires a Chromium binary in PATH ('chromium', 'chromium-browser', or 'google-chrome').
// - In Alpine Linux Docker images, install via: `apk add --no-cache chromium`.
// - In Debian/Ubuntu images, install via: `apt-get install -y chromium` or `playwright install chromium`.
//
// Token caching & expiration:
// - Tokens are cached in-memory for 3.5 hours to avoid unnecessary browser launches.
// - Refresh happens automatically once expired.
// - Can be overridden in CI / development environments via the TRADE_REPUBLIC_WAF_TOKEN env variable.
type AutomatedWAFTokenProvider struct {
	mu          sync.RWMutex
	cachedToken string
	expiresAt   time.Time
	customURL   string
}

// NewAutomatedWAFTokenProvider creates a new provider instance.
func NewAutomatedWAFTokenProvider() *AutomatedWAFTokenProvider {
	return &AutomatedWAFTokenProvider{
		customURL: TradeRepublicAppURL,
	}
}

// GetWAFToken retrieves a fresh or cached AWS WAF token.
func (p *AutomatedWAFTokenProvider) GetWAFToken(ctx context.Context) (string, error) {
	// 1. Check for manual environment override (useful for testing or restricted environments)
	if envToken := strings.TrimSpace(os.Getenv("TRADE_REPUBLIC_WAF_TOKEN")); envToken != "" {
		return envToken, nil
	}

	// 2. Check cached token under read lock
	p.mu.RLock()
	if p.cachedToken != "" && time.Now().Before(p.expiresAt) {
		token := p.cachedToken
		p.mu.RUnlock()
		return token, nil
	}
	p.mu.RUnlock()

	// 3. Acquire write lock to refresh token
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check under write lock
	if p.cachedToken != "" && time.Now().Before(p.expiresAt) {
		return p.cachedToken, nil
	}

	token, err := p.acquireToken(ctx)
	if err != nil {
		return "", err
	}

	p.cachedToken = token
	p.expiresAt = time.Now().Add(DefaultWAFTTL)
	return token, nil
}

// acquireToken detects installed Chromium binaries and executes the token acquisition process.
func (p *AutomatedWAFTokenProvider) acquireToken(ctx context.Context) (string, error) {
	binaryPath := findChromiumBinary()
	if binaryPath == "" {
		return "", ErrWAFChromiumNotFound
	}

	// Execute Chromium in headless mode to navigate and extract cookies
	acquireCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Script that loads the page and extracts document.cookie
	// Using --dump-dom with script injection or headless print
	cmd := exec.CommandContext(acquireCtx, binaryPath,
		"--headless",
		"--disable-gpu",
		"--no-sandbox",
		"--disable-dev-shm-usage",
		"--disable-software-rasterizer",
		"--dump-dom",
		p.customURL,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		if acquireCtx.Err() != nil {
			return "", ErrWAFTokenTimeout
		}
		log.Printf("[DEBUG] [TradeRepublic WAF] Headless invocation output: %s", string(output))
		return "", fmt.Errorf("%w: %v", ErrWAFChallengeFailed, err)
	}

	// Search output for aws-waf-token
	outStr := string(output)
	token := extractWAFTokenFromString(outStr)
	if token == "" {
		return "", fmt.Errorf("%w: token not found in DOM or cookies", ErrWAFChallengeFailed)
	}

	return token, nil
}

// findChromiumBinary looks for known browser executable names in PATH.
func findChromiumBinary() string {
	candidates := []string{
		"chromium",
		"chromium-browser",
		"google-chrome",
		"google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	}

	for _, name := range candidates {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	return ""
}

// extractWAFTokenFromString parses a string for an aws-waf-token value.
func extractWAFTokenFromString(content string) string {
	// Look for pattern "aws-waf-token="
	idx := strings.Index(content, "aws-waf-token=")
	if idx == -1 {
		idx = strings.Index(content, "aws-waf-token%3D")
	}
	if idx == -1 {
		return ""
	}

	start := idx + len("aws-waf-token=")
	remaining := content[start:]
	end := strings.IndexAny(remaining, ";\"'& \t\r\n<>")
	if end == -1 {
		return strings.TrimSpace(remaining)
	}
	return strings.TrimSpace(remaining[:end])
}

// MockWAFTokenProvider is a test helper that returns a deterministic static token.
type MockWAFTokenProvider struct {
	Token string
	Err   error
}

func (m *MockWAFTokenProvider) GetWAFToken(ctx context.Context) (string, error) {
	if m.Err != nil {
		return "", m.Err
	}
	if m.Token != "" {
		return m.Token, nil
	}
	return "mock-aws-waf-token-verified-2026", nil
}

