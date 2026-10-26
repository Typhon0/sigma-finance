package adapters

import (
	"net/http"
	"strings"
)

// Option defines a functional option for configuring adapters.
type Option func(any)

// KrakenOption defines a functional option for configuring KrakenAdapter.
type KrakenOption = Option

// SnapTradeOption defines a functional option for configuring SnapTradeAdapter.
type SnapTradeOption = Option

// GoCardlessOption defines a functional option for configuring GoCardlessAdapter.
type GoCardlessOption = Option

// WithBaseURL configures a custom base URL on any adapter supporting it.
func WithBaseURL(baseURL string) Option {
	return func(target any) {
		switch t := target.(type) {
		case *KrakenAdapter:
			t.baseURL = strings.TrimRight(baseURL, "/")
		case *SnapTradeAdapter:
			t.baseURL = strings.TrimRight(baseURL, "/")
		case *GoCardlessAdapter:
			t.baseURL = strings.TrimRight(baseURL, "/")
		}
	}
}

// WithSnapTradeBaseURL configures a custom base URL specifically for SnapTradeAdapter.
func WithSnapTradeBaseURL(baseURL string) SnapTradeOption {
	return WithBaseURL(baseURL)
}

// WithKrakenBaseURL configures a custom base URL specifically for KrakenAdapter.
func WithKrakenBaseURL(baseURL string) KrakenOption {
	return WithBaseURL(baseURL)
}

// WithGoCardlessBaseURL configures a custom base URL specifically for GoCardlessAdapter.
func WithGoCardlessBaseURL(baseURL string) GoCardlessOption {
	return WithBaseURL(baseURL)
}

// WithHTTPClient configures a custom http.Client on any adapter supporting it.
func WithHTTPClient(client *http.Client) Option {
	return func(target any) {
		switch t := target.(type) {
		case *KrakenAdapter:
			t.httpClient = client
		case *SnapTradeAdapter:
			t.httpClient = client
		case *GoCardlessAdapter:
			t.httpClient = client
		}
	}
}

// WithSnapTradeHTTPClient configures a custom http.Client specifically for SnapTradeAdapter.
func WithSnapTradeHTTPClient(client *http.Client) SnapTradeOption {
	return WithHTTPClient(client)
}

// WithKrakenHTTPClient configures a custom http.Client specifically for KrakenAdapter.
func WithKrakenHTTPClient(client *http.Client) KrakenOption {
	return WithHTTPClient(client)
}

// WithGoCardlessHTTPClient configures a custom http.Client specifically for GoCardlessAdapter.
func WithGoCardlessHTTPClient(client *http.Client) GoCardlessOption {
	return WithHTTPClient(client)
}
