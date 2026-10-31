package alchemy

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

// Client implements blockchain.BlockchainProvider for Alchemy
type Client struct {
	apiKey         string
	httpClient     *http.Client
	rateLimiter    *rate.Limiter
	circuitBreaker *gobreaker.CircuitBreaker
	cuTracker      *CUTracker
}

// ClientOption configures a Client
type ClientOption func(*Client)

// WithCUTracker attaches a Compute Unit tracker
func WithCUTracker(tracker *CUTracker) ClientOption {
	return func(c *Client) {
		c.cuTracker = tracker
	}
}

// WithHTTPClient overrides the default HTTP client
func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = client
	}
}

// NewClient creates a new unified Alchemy provider client
func NewClient(apiKey string, opts ...ClientOption) *Client {
	c := &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		// Token bucket rate limiter: 25 requests per second (Alchemy free tier ceiling)
		rateLimiter: rate.NewLimiter(rate.Limit(25), 25),
		circuitBreaker: gobreaker.NewCircuitBreaker(gobreaker.Settings{
			Name:        "AlchemyProvider",
			MaxRequests: 5,
			Interval:    60 * time.Second,
			Timeout:     30 * time.Second,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= 5
			},
		}),
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// ProviderName returns the identifier for Alchemy
func (c *Client) ProviderName() string {
	return "ALCHEMY"
}

// SupportsNetwork checks if the network is covered by the Alchemy client
func (c *Client) SupportsNetwork(network model.BlockchainNetwork) bool {
	switch network {
	case model.BlockchainNetworkEthereum,
		model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum,
		model.BlockchainNetworkOptimism,
		model.BlockchainNetworkPolygon,
		model.BlockchainNetworkSolana,
		model.BlockchainNetworkBitcoin:
		return true
	default:
		return false
	}
}

// FetchBalances retrieves exact token and coin holdings
func (c *Client) FetchBalances(ctx context.Context, network model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	if !c.SupportsNetwork(network) {
		return nil, fmt.Errorf("network %s is not supported by Alchemy provider", network)
	}

	switch network {
	case model.BlockchainNetworkSolana:
		return c.fetchSolanaBalances(ctx, address)
	case model.BlockchainNetworkBitcoin:
		return c.fetchBitcoinBalances(ctx, address)
	default:
		// EVM networks
		return c.fetchEVMBalances(ctx, network, address)
	}
}

// FetchTransfers retrieves historical transfers with cursor pagination
func (c *Client) FetchTransfers(ctx context.Context, network model.BlockchainNetwork, address string, cursor string) (*blockchain.TransferPage, error) {
	if !c.SupportsNetwork(network) {
		return nil, fmt.Errorf("network %s is not supported by Alchemy provider", network)
	}

	switch network {
	case model.BlockchainNetworkSolana:
		return c.fetchSolanaTransfers(ctx, address, cursor)
	case model.BlockchainNetworkBitcoin:
		return c.fetchBitcoinTransfers(ctx, address, cursor)
	default:
		// EVM networks
		return c.fetchEVMTransfers(ctx, network, address, cursor)
	}
}

// doPost performs an HTTP POST guarded by the 25 rps rate limiter and circuit breaker
func (c *Client) doPost(ctx context.Context, url string, payload []byte) ([]byte, error) {
	// Rate limit check
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limiter error: %w", err)
	}

	result, err := c.circuitBreaker.Execute(func() (interface{}, error) {
		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, errors.New("alchemy rate limit (HTTP 429) reached")
		}
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("alchemy server error HTTP %d: %s", resp.StatusCode, string(body))
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("alchemy request failed HTTP %d: %s", resp.StatusCode, string(body))
		}

		return body, nil
	})

	if err != nil {
		return nil, err
	}
	return result.([]byte), nil
}

// doGet performs an HTTP GET guarded by the 25 rps rate limiter and circuit breaker
func (c *Client) doGet(ctx context.Context, url string) ([]byte, error) {
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limiter error: %w", err)
	}

	result, err := c.circuitBreaker.Execute(func() (interface{}, error) {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, err
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, errors.New("alchemy rate limit (HTTP 429) reached")
		}
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("alchemy server error HTTP %d: %s", resp.StatusCode, string(body))
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("alchemy request failed HTTP %d: %s", resp.StatusCode, string(body))
		}

		return body, nil
	})

	if err != nil {
		return nil, err
	}
	return result.([]byte), nil
}
