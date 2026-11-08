package traderepublic

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuth_InitiateLoginV2(t *testing.T) {
	mockWAF := &MockWAFTokenProvider{Token: "test-waf-clearance-token"}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v2/auth/web/login", r.URL.Path)
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "test-waf-clearance-token", r.Header.Get("X-aws-waf-token"))
		assert.Equal(t, WebOrigin, r.Header.Get("Origin"))
		assert.Equal(t, ChromeUA, r.Header.Get("User-Agent"))
		assert.Equal(t, "web", r.Header.Get("X-Tr-Platform"))
		assert.Equal(t, "web", r.Header.Get("X-TR-Platform"))
		assert.Equal(t, "2.2644.24", r.Header.Get("X-TR-App-Version"))
		assert.Equal(t, DummySignature, r.Header.Get("X-TR-Signature"))
		assert.NotEmpty(t, r.Header.Get("X-TR-Timestamp"))
		assert.NotEmpty(t, r.Header.Get("X-TR-Device-Info"))

		var body LoginRequest
		err := json.NewDecoder(r.Body).Decode(&body)
		assert.NoError(t, err)
		assert.Equal(t, "+491701234567", body.PhoneNumber)
		assert.Equal(t, "1234", body.PIN)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(LoginResponse{
			ProcessID: "proc-uuid-98765",
			Countdown: 90,
		})
	}))
	defer server.Close()

	client := NewAuthClient(server.URL, mockWAF, nil)
	ctx := context.Background()

	resp, err := client.InitiateLogin(ctx, "+491701234567", "1234")
	require.NoError(t, err)
	assert.Equal(t, "proc-uuid-98765", resp.ProcessID)
	assert.Equal(t, 90, resp.Countdown)

	// Invariant check: verify that AuthClient does not store PIN anywhere
	val := reflect.ValueOf(client).Elem()
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		if field.Kind() == reflect.String {
			assert.NotContains(t, field.String(), "1234", "PIN must never be persisted in client struct fields")
		}
	}
}

func TestAuth_InitiateLogin_ErrorParsing(t *testing.T) {
	tests := []struct {
		name          string
		statusCode    int
		respBody      string
		expectedError string
	}{
		{
			name:          "Authentication error",
			statusCode:    http.StatusUnauthorized,
			respBody:      `{"errors":[{"errorCode":"AUTHENTICATION_ERROR","errorMessage":"Unauthorized","meta":null}]}`,
			expectedError: "Trade Republic authentication failed: Invalid phone number or PIN",
		},
		{
			name:          "Invalid phone number",
			statusCode:    http.StatusBadRequest,
			respBody:      `{"errors":[{"errorCode":"NUMBER_INVALID","errorMessage":"phoneNumber","meta":null}]}`,
			expectedError: "Trade Republic authentication failed: Invalid phone number format",
		},
		{
			name:          "Rate limit exceeded",
			statusCode:    http.StatusTooManyRequests,
			respBody:      `{"errors":[{"errorCode":"TOO_MANY_REQUESTS","errorMessage":null,"meta":{"nextAttemptInSeconds":60}}]}`,
			expectedError: "Trade Republic rate limit exceeded. Please try again later.",
		},
		{
			name:          "Outdated client version",
			statusCode:    http.StatusUpgradeRequired,
			respBody:      `{"errors":[{"errorCode":"CLIENT_VERSION_OUTDATED","errorMessage":null}]}`,
			expectedError: "Trade Republic returned CLIENT_VERSION_OUTDATED (426)",
		},
		{
			name:          "Mobile app version not supported",
			statusCode:    http.StatusUnprocessableEntity,
			respBody:      `{"errors":[{"errorCode":"MOBILE_APP_VERSION_NOT_SUPPORTED","errorMessage":null}]}`,
			expectedError: "Trade Republic mobile app on your phone is outdated",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.statusCode)
				_, _ = w.Write([]byte(tc.respBody))
			}))
			defer server.Close()

			client := NewAuthClient(server.URL, nil, nil)
			_, err := client.InitiateLogin(context.Background(), "+33612345678", "1234")
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.expectedError)
		})
	}
}

func TestAuth_PollProcess_StateTransitions(t *testing.T) {
	statusToReturn := ProcessStatusWaitingForConfirmation

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v2/auth/web/login/processes/proc-123", r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		if statusToReturn == ProcessStatusApproved || statusToReturn == ProcessStatusCompleted {
			http.SetCookie(w, &http.Cookie{Name: "JSESSIONID", Value: "sess-abc-123"})
			http.SetCookie(w, &http.Cookie{Name: "tr_refresh", Value: "refresh-xyz-456"})
			http.SetCookie(w, &http.Cookie{Name: "tr_device", Value: "dev-789"})
		}
		_ = json.NewEncoder(w).Encode(LoginProcessResponse{
			Status: statusToReturn,
		})
	}))
	defer server.Close()

	client := NewAuthClient(server.URL, &MockWAFTokenProvider{}, nil)
	ctx := context.Background()

	// 1. Pending / Waiting for confirmation
	statusToReturn = ProcessStatusWaitingForConfirmation
	poll1, cookies1, err1 := client.PollProcess(ctx, "proc-123")
	require.NoError(t, err1)
	assert.Equal(t, ProcessStatusWaitingForConfirmation, poll1.Status)
	assert.Nil(t, cookies1)

	// 2. Approved -> Returns session cookies
	statusToReturn = ProcessStatusApproved
	poll2, cookies2, err2 := client.PollProcess(ctx, "proc-123")
	require.NoError(t, err2)
	assert.Equal(t, ProcessStatusApproved, poll2.Status)
	require.NotEmpty(t, cookies2)

	sessionCookies := ParseSessionCookies(cookies2)
	assert.True(t, sessionCookies.IsValid())
	assert.Equal(t, "sess-abc-123", sessionCookies.JSessionID)
	assert.Equal(t, "refresh-xyz-456", sessionCookies.TRRefresh)
	assert.Equal(t, "dev-789", sessionCookies.TRDevice)

	// 2b. Completed (live Trade Republic API status on approval) -> Returns session cookies
	statusToReturn = ProcessStatusCompleted
	poll2b, cookies2b, err2b := client.PollProcess(ctx, "proc-123")
	require.NoError(t, err2b)
	assert.Equal(t, ProcessStatusCompleted, poll2b.Status)
	require.NotEmpty(t, cookies2b)

	sessionCookies2b := ParseSessionCookies(cookies2b)
	assert.True(t, sessionCookies2b.IsValid())
	assert.Equal(t, "sess-abc-123", sessionCookies2b.JSessionID)

	// 3. Rejected
	statusToReturn = ProcessStatusRejected
	_, _, err3 := client.PollProcess(ctx, "proc-123")
	assert.ErrorIs(t, err3, ErrAuthenticationRejected)

	// 4. Expired
	statusToReturn = ProcessStatusExpired
	_, _, err4 := client.PollProcess(ctx, "proc-123")
	assert.ErrorIs(t, err4, ErrAuthenticationExpired)
}

func TestAuth_RefreshSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/auth/web/session", r.URL.Path)
		c, err := r.Cookie("JSESSIONID")
		if err != nil || c.Value != "valid-session" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		// Return refreshed cookie
		http.SetCookie(w, &http.Cookie{Name: "JSESSIONID", Value: "refreshed-session"})
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewAuthClient(server.URL, &MockWAFTokenProvider{}, nil)
	ctx := context.Background()

	// Valid session
	initialCookies := []*http.Cookie{{Name: "JSESSIONID", Value: "valid-session"}}
	refreshed, err := client.RefreshSession(ctx, initialCookies)
	require.NoError(t, err)
	parsed := ParseSessionCookies(refreshed)
	assert.Equal(t, "refreshed-session", parsed.JSessionID)

	// Expired session
	invalidCookies := []*http.Cookie{{Name: "JSESSIONID", Value: "expired-token"}}
	_, err = client.RefreshSession(ctx, invalidCookies)
	assert.ErrorIs(t, err, ErrSessionExpired)
}

func TestAuth_VersionResolver(t *testing.T) {
	// 1. Manually cached version takes priority
	SetCachedAppVersion("2.9999.99", 10*time.Minute)
	client := NewAuthClient("", nil, nil)
	assert.Equal(t, "2.9999.99", client.ResolveAppVersion(context.Background()))

	// 2. Invalidate cache falls back to DefaultAppVersion when network fails
	InvalidateVersionCache()
	// Using a dummy client that fails network immediately
	dummyClient := &http.Client{
		Transport: &roundTripFunc{fn: func(req *http.Request) (*http.Response, error) {
			return nil, assert.AnError
		}},
	}
	clientNoNet := NewAuthClient("", nil, dummyClient)
	assert.Equal(t, DefaultAppVersion, clientNoNet.ResolveAppVersion(context.Background()))
}

func TestAuth_InitiateLogin_AutoRetryOnOutdatedVersion(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.Header().Set("Content-Type", "application/json")
		if attempts == 1 {
			w.WriteHeader(http.StatusUnprocessableEntity)
			_, _ = w.Write([]byte(`{"errors":[{"errorCode":"MOBILE_APP_VERSION_NOT_SUPPORTED","errorMessage":null}]}`))
			return
		}

		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(LoginResponse{
			ProcessID: "proc-recovered-after-retry",
			Countdown: 90,
		})
	}))
	defer server.Close()

	client := NewAuthClient(server.URL, nil, nil)
	resp, err := client.InitiateLogin(context.Background(), "+491701234567", "1234")
	require.NoError(t, err)
	assert.Equal(t, "proc-recovered-after-retry", resp.ProcessID)
	assert.Equal(t, 2, attempts, "expected auto-retry on MOBILE_APP_VERSION_NOT_SUPPORTED")
}

type roundTripFunc struct {
	fn func(req *http.Request) (*http.Response, error)
}

func (f *roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f.fn(req)
}
