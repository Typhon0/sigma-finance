package grpc

import (
	"context"
	"os"
	pb "sigma_finance/internal/handler/grpc/pb"
	"testing"
	"time"

	grpcconn "google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These integration tests require a running yfinance-service.
// Set YFINANCE_HOST and YFINANCE_PORT env vars (defaults: localhost:50051).
// If the service is not available, tests are skipped.

func testHostPort(t *testing.T) (string, string) {
	t.Helper()
	host := os.Getenv("YFINANCE_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("YFINANCE_PORT")
	if port == "" {
		port = "50051"
	}
	return host, port
}

func skipIfNoService(t *testing.T, host, port string) {
	t.Helper()
	conn, err := dialWithTimeout(host+":"+port, 3*time.Second)
	if err != nil {
		t.Skipf("yfinance-service not available at %s:%s: %v", host, port, err)
	}
	conn.Close()
}

func dialWithTimeout(target string, timeout time.Duration) (*grpcconn.ClientConn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return grpcconn.DialContext(ctx, target, grpcconn.WithTransportCredentials(insecure.NewCredentials()), grpcconn.WithBlock())
}

func TestMarketDataClient_GetPrice_Integration(t *testing.T) {
	host, port := testHostPort(t)
	skipIfNoService(t, host, port)

	client, err := NewMarketDataClient(host, port)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	resp, err := client.GetPrice(ctx, "AAPL")
	require.NoError(t, err)

	assert.Equal(t, "AAPL", resp.Symbol)
	assert.True(t, resp.Last > 0, "last price should be positive")
	assert.True(t, resp.Bid > 0, "bid should be positive")
	assert.True(t, resp.Ask > 0, "ask should be positive")
	assert.True(t, resp.Timestamp > 0, "timestamp should be set")
	assert.Equal(t, "yfinance", resp.Source)

	// Price sanity: AAPL should be in the range $50–$500 (5000–50000 cents)
	assert.True(t, resp.Last > 5000 && resp.Last < 500000,
		"AAPL last price %d cents seems unreasonable", resp.Last)
}

func TestMarketDataClient_GetHistory_Integration(t *testing.T) {
	host, port := testHostPort(t)
	skipIfNoService(t, host, port)

	client, err := NewMarketDataClient(host, port)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	from := time.Now().AddDate(0, -1, 0).UnixMilli()
	to := time.Now().UnixMilli()
	resp, err := client.GetHistory(ctx, "AAPL", pb.AssetType_ASSET_TYPE_STOCK, pb.Interval_INTERVAL_1D, from, to, 100)
	require.NoError(t, err)

	assert.True(t, len(resp.Bars) > 0, "should return at least one bar")
	assert.Equal(t, "yfinance", resp.Source)

	// Validate OHLCV consistency on first bar
	bar := resp.Bars[0]
	assert.True(t, bar.Open > 0, "open should be positive")
	assert.True(t, bar.Close > 0, "close should be positive")
	assert.True(t, bar.Low <= bar.Open, "low should be <= open")
	assert.True(t, bar.High >= bar.Open, "high should be >= open")
	assert.True(t, bar.Low <= bar.Close, "low should be <= close")
	assert.True(t, bar.High >= bar.Close, "high should be >= close")
}

func TestMarketDataClient_GetInfo_Integration(t *testing.T) {
	host, port := testHostPort(t)
	skipIfNoService(t, host, port)

	client, err := NewMarketDataClient(host, port)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	resp, err := client.GetInfo(ctx, "AAPL")
	require.NoError(t, err)

	assert.Equal(t, "yfinance", resp.Source)

	company := resp.GetCompany()
	require.NotNil(t, company, "expected company info for AAPL")
	assert.Equal(t, "AAPL", company.Symbol)
	assert.NotEmpty(t, company.Name, "company name should not be empty")
	assert.NotEmpty(t, company.Sector, "sector should not be empty")
}

func TestMarketDataClient_ConnectionFailure(t *testing.T) {
	// Connecting to a non-existent service should fail on first API call
	client, err := NewMarketDataClient("localhost", "59999")
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = client.GetPrice(ctx, "AAPL")
	assert.Error(t, err, "should fail when service is not available")
}

func TestMarketDataClient_InvalidHost(t *testing.T) {
	_, err := NewMarketDataClient("", "50051")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "host cannot be empty")
}

func TestMarketDataClient_InvalidPort(t *testing.T) {
	_, err := NewMarketDataClient("localhost", "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "port cannot be empty")
}

func TestMarketDataClient_UnknownSymbol_Integration(t *testing.T) {
	host, port := testHostPort(t)
	skipIfNoService(t, host, port)

	client, err := NewMarketDataClient(host, port)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Use a symbol that is very unlikely to be a valid ticker
	_, err = client.GetPrice(ctx, "ZZZZZNOTREAL")
	require.Error(t, err, "unknown symbol should return an error")

	// Verify the gRPC status code is NOT_FOUND
	st, ok := status.FromError(err)
	require.True(t, ok, "should be a gRPC status error")
	assert.Equal(t, codes.NotFound, st.Code(), "unknown symbol should return NOT_FOUND")
}

func TestMarketDataClient_Close(t *testing.T) {
	client, err := NewMarketDataClient("localhost", "50051")
	require.NoError(t, err)

	// Close without connecting should not error
	err = client.Close()
	assert.NoError(t, err)
}
