package traderepublic

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	// ErrSessionExpired indicates the Trade Republic session has expired or been revoked.
	ErrSessionExpired = errors.New("trade republic session expired or invalid (HTTP 401)")

	// ErrAuthenticationRejected indicates the user rejected the push notification or login failed.
	ErrAuthenticationRejected = errors.New("trade republic login was rejected")

	// ErrAuthenticationExpired indicates the mobile confirmation countdown expired.
	ErrAuthenticationExpired = errors.New("trade republic mobile confirmation window expired")

	// ErrMissingRequiredCookies indicates the response did not contain the expected session cookies.
	ErrMissingRequiredCookies = errors.New("missing required session cookies (jsessionid, tr_refresh, tr_device)")
)

const (
	DefaultBaseURL    = "https://api.traderepublic.com"
	WebOrigin         = "https://app.traderepublic.com"
	ChromeUA          = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
	DefaultPlatformID = "web"
	DefaultAppVersion = "2.2644.24"
	PlatformID        = "web"
	AppVersion        = "2.2644.24"
	DeviceInfo        = "chrome - 131.0.0"
	DummySignature    = "DummyZetaSignatureToPassSignatureHeaderRequirement"
)

var (
	cachedAppVersion    string
	cachedAppVersionExp time.Time
	cachedAppVersionMu  sync.RWMutex
)

// InvalidateVersionCache forces the next call to re-resolve the Trade Republic app version.
func InvalidateVersionCache() {
	cachedAppVersionMu.Lock()
	defer cachedAppVersionMu.Unlock()
	cachedAppVersion = ""
	cachedAppVersionExp = time.Time{}
}

// SetCachedAppVersion allows manually setting or mocking the cached version.
func SetCachedAppVersion(version string, ttl time.Duration) {
	cachedAppVersionMu.Lock()
	defer cachedAppVersionMu.Unlock()
	cachedAppVersion = version
	cachedAppVersionExp = time.Now().Add(ttl)
}

// ScrapeTradeRepublicWebVersion extracts the active release build version from app.traderepublic.com.
func ScrapeTradeRepublicWebVersion(ctx context.Context, httpClient *http.Client) (string, error) {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 3 * time.Second}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, WebOrigin, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", ChromeUA)

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch trade republic web app html: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read web app html: %w", err)
	}
	html := string(bodyBytes)

	// Locate analytics bundle: /assets/analytics-*.js
	reAnalytics := regexp.MustCompile(`/assets/analytics-[a-zA-Z0-9_\.-]+\.js`)
	match := reAnalytics.FindString(html)
	if match == "" {
		return "", errors.New("analytics bundle not found in html")
	}

	analyticsURL := WebOrigin + match
	reqJS, err := http.NewRequestWithContext(ctx, http.MethodGet, analyticsURL, nil)
	if err != nil {
		return "", err
	}
	reqJS.Header.Set("User-Agent", ChromeUA)

	respJS, err := httpClient.Do(reqJS)
	if err != nil {
		return "", fmt.Errorf("failed to fetch analytics bundle: %w", err)
	}
	defer respJS.Body.Close()

	jsBytes, err := io.ReadAll(respJS.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read analytics bundle: %w", err)
	}
	js := string(jsBytes)

	// Match sH=`2.2644.24` or sH="2.2644.24"
	reVersion := regexp.MustCompile("sH\\s*=\\s*[`\"']([0-9]+\\.[0-9]+\\.[0-9]+)[`\"']")
	versionMatch := reVersion.FindStringSubmatch(js)
	if len(versionMatch) > 1 && versionMatch[1] != "" {
		return versionMatch[1], nil
	}

	// Fallback match general version pattern [D$.AppVersion]: sH
	reFallback := regexp.MustCompile("[`\"']([0-9]+\\.[0-9]{4}\\.[0-9]+)[`\"']")
	fallbackMatch := reFallback.FindStringSubmatch(js)
	if len(fallbackMatch) > 1 && fallbackMatch[1] != "" {
		return fallbackMatch[1], nil
	}

	return "", errors.New("version string not found in analytics bundle")
}

// ResolveAppVersion resolves the app version by checking env var, memory cache, or live scraping with fallback.
func (a *AuthClient) ResolveAppVersion(ctx context.Context) string {
	if env := os.Getenv("TR_APP_VERSION"); env != "" {
		return env
	}

	cachedAppVersionMu.RLock()
	if cachedAppVersion != "" && time.Now().Before(cachedAppVersionExp) {
		v := cachedAppVersion
		cachedAppVersionMu.RUnlock()
		return v
	}
	cachedAppVersionMu.RUnlock()

	// Try scraping with short timeout
	scrapeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	v, err := ScrapeTradeRepublicWebVersion(scrapeCtx, a.httpClient)
	if err == nil && v != "" {
		cachedAppVersionMu.Lock()
		cachedAppVersion = v
		cachedAppVersionExp = time.Now().Add(1 * time.Hour)
		cachedAppVersionMu.Unlock()
		log.Printf("[INFO] [traderepublic.auth] Dynamically resolved Trade Republic app version: %s", v)
		return v
	}

	log.Printf("[INFO] [traderepublic.auth] Falling back to DefaultAppVersion (%s): %v", DefaultAppVersion, err)
	return DefaultAppVersion
}

// DeviceInfoPayload describes the client environment expected by Trade Republic's v2 endpoints.
type DeviceInfoPayload struct {
	Browser            string   `json:"browser"`
	BrowserVersion     string   `json:"browserVersion"`
	OS                 string   `json:"os"`
	OSVersion          string   `json:"osVersion"`
	Screen             string   `json:"screen"`
	Timezone           string   `json:"timezone"`
	TimezoneOffset     int      `json:"timezoneOffset"`
	PreferredLanguages []string `json:"preferredLanguages"`
	NumberOfCores      int      `json:"numberOfCores"`
	StableDeviceID     string   `json:"stableDeviceId"`
}

// GenerateDeviceInfo builds the base64-encoded JSON device metadata required by Trade Republic v2 endpoints.
func GenerateDeviceInfo(deviceID string) string {
	dev := DeviceInfoPayload{
		Browser:            "Chrome",
		BrowserVersion:     "131.0.0.0",
		OS:                 "Linux",
		OSVersion:          "x86_64",
		Screen:             "1920x1080x24",
		Timezone:           "Europe/Paris",
		TimezoneOffset:     -60,
		PreferredLanguages: []string{"en-US", "en"},
		NumberOfCores:      8,
		StableDeviceID:     deviceID,
	}
	b, _ := json.Marshal(dev)
	return base64.StdEncoding.EncodeToString(b)
}

// AuthClient coordinates REST authentication for Trade Republic v2 flow.
type AuthClient struct {
	baseURL     string
	httpClient  *http.Client
	wafProvider WAFTokenProvider
}

// NewAuthClient creates a new AuthClient instance.
func NewAuthClient(baseURL string, wafProvider WAFTokenProvider, httpClient *http.Client) *AuthClient {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	if wafProvider == nil {
		wafProvider = NewAutomatedWAFTokenProvider()
	}
	if httpClient == nil {
		jar, _ := cookiejar.New(nil)
		httpClient = &http.Client{
			Timeout: 20 * time.Second,
			Jar:     jar,
		}
	}
	return &AuthClient{
		baseURL:     strings.TrimRight(baseURL, "/"),
		httpClient:  httpClient,
		wafProvider: wafProvider,
	}
}

// GenerateDeviceID produces a stable random device identifier string.
func GenerateDeviceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// InitiateLogin starts the v2 push-notification login flow.
// The user's PIN is used solely for the request payload and is immediately discarded from memory.
func (a *AuthClient) InitiateLogin(ctx context.Context, phoneNumber string, pin string) (*LoginResponse, error) {
	resp, _, err := a.InitiateLoginWithDevice(ctx, phoneNumber, pin, GenerateDeviceID())
	return resp, err
}

// InitiateLoginWithDevice starts the v2 flow with a specific or generated device ID, returning temporary context.
func (a *AuthClient) InitiateLoginWithDevice(ctx context.Context, phoneNumber string, pin string, deviceID string) (*LoginResponse, *AuthSessionContext, error) {
	return a.initiateLoginWithDeviceInternal(ctx, phoneNumber, pin, deviceID, true)
}

func (a *AuthClient) initiateLoginWithDeviceInternal(ctx context.Context, phoneNumber string, pin string, deviceID string, allowRetry bool) (*LoginResponse, *AuthSessionContext, error) {
	if deviceID == "" {
		deviceID = GenerateDeviceID()
	}

	endpoint := fmt.Sprintf("%s/api/v2/auth/web/login", a.baseURL)

	reqPayload := LoginRequest{
		PhoneNumber: phoneNumber,
		PIN:         pin,
	}

	bodyBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to marshal login payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create login request: %w", err)
	}

	// Acquire AWS WAF token
	var wafToken string
	if a.wafProvider != nil {
		if token, wafErr := a.wafProvider.GetWAFToken(ctx); wafErr == nil && token != "" {
			wafToken = token
		}
	}

	a.setStandardHeaders(req, deviceID, wafToken)
	req.Header.Set("Content-Type", "application/json")

	log.Printf("[INFO] [traderepublic.auth] Initiating login request to %s (deviceID=%s)", endpoint, deviceID)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		log.Printf("[ERROR] [traderepublic.auth] Login request network failure: %v", err)
		return nil, nil, fmt.Errorf("login request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read login response: %w", err)
	}

	log.Printf("[INFO] [traderepublic.auth] Login endpoint response status=%d", resp.StatusCode)

	if resp.StatusCode == http.StatusUpgradeRequired || resp.StatusCode == 426 {
		if allowRetry {
			log.Printf("[INFO] [traderepublic.auth] Received HTTP %d. Invalidate version cache and retry...", resp.StatusCode)
			InvalidateVersionCache()
			return a.initiateLoginWithDeviceInternal(ctx, phoneNumber, pin, deviceID, false)
		}
		return nil, nil, errors.New("Trade Republic returned CLIENT_VERSION_OUTDATED (426)")
	}
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusMethodNotAllowed {
		return nil, nil, fmt.Errorf("Trade Republic rejected request (HTTP %d, possible WAF challenge): %s", resp.StatusCode, string(respBody))
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		log.Printf("[ERROR] [traderepublic.auth] Login endpoint error status=%d body=%s", resp.StatusCode, string(respBody))
		var errResp struct {
			Errors []struct {
				ErrorCode    string         `json:"errorCode"`
				ErrorMessage *string        `json:"errorMessage"`
				Meta         map[string]any `json:"meta"`
			} `json:"errors"`
		}
		if jsonErr := json.Unmarshal(respBody, &errResp); jsonErr == nil && len(errResp.Errors) > 0 {
			firstErr := errResp.Errors[0]
			if allowRetry && (firstErr.ErrorCode == "CLIENT_VERSION_OUTDATED" || firstErr.ErrorCode == "MOBILE_APP_VERSION_NOT_SUPPORTED") {
				log.Printf("[INFO] [traderepublic.auth] Received %s. Invalidate version cache and retry...", firstErr.ErrorCode)
				InvalidateVersionCache()
				return a.initiateLoginWithDeviceInternal(ctx, phoneNumber, pin, deviceID, false)
			}
			switch firstErr.ErrorCode {
			case "AUTHENTICATION_ERROR":
				return nil, nil, errors.New("Trade Republic authentication failed: Invalid phone number or PIN")
			case "NUMBER_INVALID":
				return nil, nil, errors.New("Trade Republic authentication failed: Invalid phone number format. Please ensure international format with country code (e.g. +33... or +49...)")
			case "TOO_MANY_REQUESTS":
				return nil, nil, errors.New("Trade Republic rate limit exceeded. Please try again later.")
			case "CLIENT_VERSION_OUTDATED":
				return nil, nil, errors.New("Trade Republic client version is outdated")
			case "MOBILE_APP_VERSION_NOT_SUPPORTED":
				return nil, nil, errors.New("Trade Republic mobile app on your phone is outdated: please update the Trade Republic app in the App Store (iOS) or Google Play Store (Android) on your mobile device to approve the login push notification")
			default:
				if firstErr.ErrorMessage != nil && *firstErr.ErrorMessage != "" {
					return nil, nil, fmt.Errorf("Trade Republic error (%s): %s", firstErr.ErrorCode, *firstErr.ErrorMessage)
				}
				return nil, nil, fmt.Errorf("Trade Republic error: %s", firstErr.ErrorCode)
			}
		}
		return nil, nil, fmt.Errorf("Trade Republic login initiation returned unexpected status %d: %s", resp.StatusCode, string(respBody))
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal login response: %w", err)
	}

	if loginResp.ProcessID == "" {
		return nil, nil, fmt.Errorf("Trade Republic did not return a valid process ID: %s", string(respBody))
	}

	if loginResp.Countdown <= 0 {
		loginResp.Countdown = 90
	}

	harvestedCookies := a.extractCookies(resp)
	savedCookies := CookiesToSaved(harvestedCookies)

	authCtx := &AuthSessionContext{
		ProcessID: loginResp.ProcessID,
		Countdown: loginResp.Countdown,
		DeviceID:  deviceID,
		WAFToken:  wafToken,
		Cookies:   savedCookies,
		CreatedAt: time.Now().Unix(),
	}

	return &loginResp, authCtx, nil
}

// PollProcess checks the confirmation status of a v2 login process.
func (a *AuthClient) PollProcess(ctx context.Context, processID string) (*LoginProcessResponse, []*http.Cookie, error) {
	authCtx := &AuthSessionContext{
		ProcessID: processID,
		DeviceID:  GenerateDeviceID(),
	}
	return a.PollProcessWithContext(ctx, authCtx)
}

// PollProcessWithContext checks the confirmation status with full temporary device and WAF context.
// When approved, it harvests and returns the resulting session cookies preserving all attributes.
func (a *AuthClient) PollProcessWithContext(ctx context.Context, authCtx *AuthSessionContext) (*LoginProcessResponse, []*http.Cookie, error) {
	if authCtx == nil || authCtx.ProcessID == "" {
		return nil, nil, errors.New("invalid auth session context")
	}

	endpoint := fmt.Sprintf("%s/api/v2/auth/web/login/processes/%s", a.baseURL, url.PathEscape(authCtx.ProcessID))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create process poll request: %w", err)
	}

	a.setStandardHeaders(req, authCtx.DeviceID, authCtx.WAFToken)

	// Add saved cookies
	if len(authCtx.Cookies) > 0 {
		for _, sc := range authCtx.Cookies {
			req.AddCookie(SavedToCookie(sc))
		}
	}

	log.Printf("[INFO] [traderepublic.auth] Polling process status for processID=%s", authCtx.ProcessID)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		log.Printf("[ERROR] [traderepublic.auth] Process poll request failed: %v", err)
		return nil, nil, fmt.Errorf("process poll request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read process poll response: %w", err)
	}

	log.Printf("[INFO] [traderepublic.auth] Process poll response status=%d", resp.StatusCode)

	if resp.StatusCode == http.StatusNotFound {
		return &LoginProcessResponse{Status: ProcessStatusExpired}, nil, ErrAuthenticationExpired
	}
	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("process poll returned HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var pollResp LoginProcessResponse
	if err := json.Unmarshal(respBody, &pollResp); err != nil {
		return nil, nil, fmt.Errorf("failed to decode process poll response: %w", err)
	}

	log.Printf("[INFO] [traderepublic.auth] Process poll status=%s for processID=%s", pollResp.Status, authCtx.ProcessID)

	normalizedStatus := strings.ToUpper(strings.TrimSpace(string(pollResp.Status)))
	switch normalizedStatus {
	case string(ProcessStatusApproved), string(ProcessStatusCompleted), "CONFIRMED", "SUCCESS":
		// Extract cookies from response and client jar
		cookies := a.extractCookies(resp)
		if len(authCtx.Cookies) > 0 {
			cookies = mergeCookies(SavedToCookies(authCtx.Cookies), cookies)
		}

		// Ensure tr_device exists if deviceID was established
		hasTRDevice := false
		for _, c := range cookies {
			if strings.EqualFold(c.Name, "tr_device") && c.Value != "" {
				hasTRDevice = true
				break
			}
		}
		if !hasTRDevice && authCtx.DeviceID != "" {
			cookies = append(cookies, &http.Cookie{
				Name:  "tr_device",
				Value: authCtx.DeviceID,
				Path:  "/",
			})
		}

		if !ValidateSessionCookies(cookies) {
			log.Printf("[WARN] [traderepublic.auth] Status=%s but missing required cookies. Cookies count=%d", pollResp.Status, len(cookies))
			for _, c := range cookies {
				log.Printf("[DEBUG] [traderepublic.auth] Cookie name=%s len=%d", c.Name, len(c.Value))
			}
			return &pollResp, cookies, ErrMissingRequiredCookies
		}
		return &pollResp, cookies, nil
	case string(ProcessStatusRejected), "CANCELLED", "DECLINED":
		return &pollResp, nil, ErrAuthenticationRejected
	case string(ProcessStatusExpired), "TIMEOUT":
		return &pollResp, nil, ErrAuthenticationExpired
	default:
		// Process is still pending approval
		return &pollResp, nil, nil
	}
}

// RefreshSession verifies the current session cookies with Trade Republic.
func (a *AuthClient) RefreshSession(ctx context.Context, cookies []*http.Cookie) ([]*http.Cookie, error) {
	endpoint := fmt.Sprintf("%s/api/v1/auth/web/session", a.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create session refresh request: %w", err)
	}

	a.setStandardHeaders(req, "", "")
	for _, c := range cookies {
		if c != nil {
			req.AddCookie(c)
		}
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("session refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, ErrSessionExpired
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("session refresh returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	// Harvest any updated cookies
	newCookies := a.extractCookies(resp)
	if len(newCookies) == 0 {
		return cookies, nil
	}
	return mergeCookies(cookies, newCookies), nil
}

// setStandardHeaders configures the required v2 browser-like HTTP headers expected by Trade Republic.
func (a *AuthClient) setStandardHeaders(req *http.Request, deviceID string, wafToken string) {
	req.Header.Set("User-Agent", ChromeUA)
	req.Header.Set("Origin", WebOrigin)
	req.Header.Set("Referer", WebOrigin+"/")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Sec-Fetch-Site", "same-site")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Dest", "empty")

	platform := os.Getenv("TR_PLATFORM")
	if platform == "" {
		platform = DefaultPlatformID
	}
	appVersion := a.ResolveAppVersion(req.Context())

	// Required v2 headers aligned with live app.traderepublic.com client
	req.Header.Set("X-Tr-Platform", platform)
	req.Header.Set("X-TR-Platform", platform)
	req.Header.Set("X-TR-App-Version", appVersion)
	req.Header.Set("X-TR-Signature", DummySignature)
	req.Header.Set("X-TR-Timestamp", strconv.FormatInt(time.Now().UnixMilli(), 10))
	req.Header.Set("X-TR-Device-Info", GenerateDeviceInfo(deviceID))
	if deviceID != "" {
		req.Header.Set("X-TR-Device-ID", deviceID)
	}

	// WAF token header and cookie
	if wafToken != "" {
		req.Header.Set("x-aws-waf-token", wafToken)
		req.AddCookie(&http.Cookie{Name: "aws-waf-token", Value: wafToken})
	}
}

// extractCookies collects cookies from response Set-Cookie headers and client jar.
func (a *AuthClient) extractCookies(resp *http.Response) []*http.Cookie {
	var collected []*http.Cookie
	if resp != nil {
		collected = append(collected, resp.Cookies()...)
	}
	if a.httpClient.Jar != nil {
		u, _ := url.Parse(a.baseURL)
		jarCookies := a.httpClient.Jar.Cookies(u)
		collected = mergeCookies(collected, jarCookies)
	}
	return collected
}

// ValidateSessionCookies checks whether the cookie collection contains the required authentication material.
func ValidateSessionCookies(cookies []*http.Cookie) bool {
	sc := ParseSessionCookies(cookies)
	return sc.IsValid()
}

// ParseSessionCookies extracts the required Trade Republic cookies from a slice.
func ParseSessionCookies(cookies []*http.Cookie) *SessionCookies {
	sc := &SessionCookies{}
	for _, c := range cookies {
		if c == nil {
			continue
		}
		name := strings.ToLower(c.Name)
		switch name {
		case "jsessionid":
			sc.JSessionID = c.Value
		case "tr_refresh":
			sc.TRRefresh = c.Value
		case "tr_device":
			sc.TRDevice = c.Value
		}
	}
	return sc
}

// CookieToSaved converts an http.Cookie to a serializable SavedCookie with attributes.
func CookieToSaved(c *http.Cookie) SavedCookie {
	if c == nil {
		return SavedCookie{}
	}
	var exp int64
	if !c.Expires.IsZero() {
		exp = c.Expires.Unix()
	}
	return SavedCookie{
		Name:     c.Name,
		Value:    c.Value,
		Path:     c.Path,
		Domain:   c.Domain,
		Expires:  exp,
		Secure:   c.Secure,
		HttpOnly: c.HttpOnly,
		SameSite: int(c.SameSite),
	}
}

// SavedToCookie restores a SavedCookie to a standard http.Cookie with preserved attributes.
func SavedToCookie(s SavedCookie) *http.Cookie {
	var exp time.Time
	if s.Expires > 0 {
		exp = time.Unix(s.Expires, 0)
	}
	return &http.Cookie{
		Name:     s.Name,
		Value:    s.Value,
		Path:     s.Path,
		Domain:   s.Domain,
		Expires:  exp,
		Secure:   s.Secure,
		HttpOnly: s.HttpOnly,
		SameSite: http.SameSite(s.SameSite),
	}
}

// CookiesToSaved transforms a slice of http.Cookie to SavedCookie.
func CookiesToSaved(cookies []*http.Cookie) []SavedCookie {
	var saved []SavedCookie
	for _, c := range cookies {
		if c != nil {
			saved = append(saved, CookieToSaved(c))
		}
	}
	return saved
}

// SavedToCookies transforms a slice of SavedCookie back to http.Cookie.
func SavedToCookies(saved []SavedCookie) []*http.Cookie {
	var cookies []*http.Cookie
	for _, s := range saved {
		cookies = append(cookies, SavedToCookie(s))
	}
	return cookies
}

// mergeCookies combines two slices of cookies, with updates overriding earlier values.
func mergeCookies(original []*http.Cookie, updates []*http.Cookie) []*http.Cookie {
	cookieMap := make(map[string]*http.Cookie)
	for _, c := range original {
		if c != nil {
			cookieMap[c.Name] = c
		}
	}
	for _, c := range updates {
		if c != nil {
			cookieMap[c.Name] = c
		}
	}

	result := make([]*http.Cookie, 0, len(cookieMap))
	for _, c := range cookieMap {
		result = append(result, c)
	}
	return result
}
