package grpc

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/handler/grpc/pb"
)

// MarketDataClient is a gRPC client for the yfinance Python sidecar.
// It provides methods to fetch market data including prices, historical
// OHLCV data, and company information.
type MarketDataClient struct {
	host      string
	port      string
	conn      *grpc.ClientConn
	client    pb.MarketDataServiceClient
	mu        sync.Mutex
	connected atomic.Bool
}

// NewMarketDataClient creates a new MarketDataClient that connects to the
// yfinance sidecar via TCP.
//
// The connection is established lazily on the first API call. Unlike the
// previous sync.Once implementation, connection failures are NOT cached —
// each subsequent call will retry the connection, allowing the client to
// recover if the sidecar becomes available later.
func NewMarketDataClient(host, port string) (*MarketDataClient, error) {
	if host == "" {
		return nil, fmt.Errorf("yfinance host cannot be empty")
	}
	if port == "" {
		return nil, fmt.Errorf("yfinance port cannot be empty")
	}

	return &MarketDataClient{
		host: host,
		port: port,
	}, nil
}

// ensureConnected establishes the gRPC connection if not already connected.
// Uses double-checked locking with atomic.Bool for a lock-free fast path
// once the connection is established. If the connection was never made,
// it retries on each call so the client recovers if the sidecar comes up later.
func (m *MarketDataClient) ensureConnected() error {
	if m.connected.Load() {
		return nil // Fast path: already connected, no lock needed
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.connected.Load() {
		return nil // Double-check after acquiring lock
	}

	address := fmt.Sprintf("%s:%s", m.host, m.port)

	conn, err := grpc.NewClient(
		address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return fmt.Errorf("failed to create gRPC client for %s: %w", address, err)
	}

	m.conn = conn
	m.client = pb.NewMarketDataServiceClient(conn)
	m.connected.Store(true)
	return nil
}

// ResetConnection forces a reconnection on the next API call.
// Call this when a health check or API call detects the connection is stale
// or the sidecar is unreachable, so ensureConnected() will retry.
func (m *MarketDataClient) ResetConnection() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.conn != nil {
		m.conn.Close()
	}
	m.conn = nil
	m.client = nil
	m.connected.Store(false)
}

// GetPrice fetches the current price for a given symbol.
//
// Uses a 5 second context timeout for quote requests.
func (m *MarketDataClient) GetPrice(ctx context.Context, symbol string) (*pb.PriceResponse, error) {
	if err := m.ensureConnected(); err != nil {
		return nil, fmt.Errorf("market data client not connected: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req := &pb.PriceRequest{Symbol: symbol}
	resp, err := m.client.GetPrice(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get price for %s: %w", symbol, err)
	}

	return resp, nil
}

// GetHistory fetches historical OHLCV (Open, High, Low, Close, Volume) data
// for a given symbol.
//
// Parameters:
//   - symbol: Ticker symbol (e.g., "AAPL", "BTC-USD")
//   - period: Time period (e.g., "1d", "1mo", "1y")
//   - interval: Data interval (e.g., "1m", "1h", "1d")
//
// Uses a 30 second context timeout for history requests.
func (m *MarketDataClient) GetHistory(ctx context.Context, symbol, period, interval string) (*pb.HistoryResponse, error) {
	if err := m.ensureConnected(); err != nil {
		return nil, fmt.Errorf("market data client not connected: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	req := &pb.HistoryRequest{
		Symbol: symbol,
	}
	resp, err := m.client.GetHistory(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for %s: %w", symbol, err)
	}

	return resp, nil
}

// GetInfo fetches company information for a given symbol.
//
// Uses a 5 second context timeout for info requests.
func (m *MarketDataClient) GetInfo(ctx context.Context, symbol string) (*pb.InfoResponse, error) {
	if err := m.ensureConnected(); err != nil {
		return nil, fmt.Errorf("market data client not connected: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req := &pb.InfoRequest{Symbol: symbol}
	resp, err := m.client.GetInfo(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get info for %s: %w", symbol, err)
	}

	return resp, nil
}

// SearchInstruments fetches normalized instrument candidates for a query.
func (m *MarketDataClient) SearchInstruments(ctx context.Context, query string, assetType string, maxResults int) ([]catalog.DiscoveryInstrument, error) {
	if err := m.ensureConnected(); err != nil {
		return nil, fmt.Errorf("market data client not connected: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	req := &pb.SearchRequest{
		Query:      query,
		AssetType:  assetType,
		MaxResults: int32(maxResults),
	}
	resp, err := m.client.SearchInstruments(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to search instruments for %s: %w", query, err)
	}

	results := make([]catalog.DiscoveryInstrument, 0, len(resp.Results))
	for _, item := range resp.Results {
		instrument := catalog.DiscoveryInstrument{
			Symbol:             item.Symbol,
			Name:               item.Name,
			Exchange:           item.Exchange,
			ExchangeCode:       nullableString(item.ExchangeCode),
			Country:            nullableString(item.Country),
			Currency:           nullableString(item.Currency),
			AssetType:          catalogAssetType(item.AssetType),
			ProviderSource:     item.ProviderSource,
			ProviderExternalID: nullableString(item.ProviderExternalId),
			ISIN:               nullableString(item.Isin),
			FIGI:               nullableString(item.Figi),
			CUSIP:              nullableString(item.Cusip),
		}
		results = append(results, instrument)
	}

	return results, nil
}

// Close gracefully shuts down the gRPC connection.
func (m *MarketDataClient) Close() error {
	if m.conn == nil {
		return nil
	}

	if err := m.conn.Close(); err != nil {
		return fmt.Errorf("failed to close gRPC connection: %w", err)
	}

	return nil
}

func nullableString(value string) *string {
	if value == "" {
		return nil
	}
	trimmed := value
	return &trimmed
}

func catalogAssetType(value string) model.InstrumentAssetType {
	switch value {
	case "ETF":
		return model.InstrumentAssetTypeETF
	case "FUND":
		return model.InstrumentAssetTypeFund
	default:
		return model.InstrumentAssetTypeStock
	}
}
