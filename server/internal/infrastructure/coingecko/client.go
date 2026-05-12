package coingecko

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
)

type CoinsListItem struct {
	ID        string            `json:"id"`
	Symbol    string            `json:"symbol"`
	Name      string            `json:"name"`
	Platforms map[string]string `json:"platforms"`
}

type SearchCoinItem struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Symbol        string `json:"symbol"`
	MarketCapRank int    `json:"market_cap_rank"`
	Thumb         string `json:"thumb"`
	Large         string `json:"large"`
}

type CoinMarketItem struct {
	ID            string `json:"id"`
	Symbol        string `json:"symbol"`
	Name          string `json:"name"`
	Image         string `json:"image"`
	MarketCapRank int    `json:"market_cap_rank"`
}

type CatalogClient interface {
	FetchCoinsList(ctx context.Context, status string, includePlatform bool) ([]CoinsListItem, error)
	SearchCoins(ctx context.Context, query string) ([]SearchCoinItem, error)
	FetchMarkets(ctx context.Context, vsCurrency, order string, perPage, page int) ([]CoinMarketItem, error)
}

type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

func NewClient(baseURL, apiKey string) *Client {
	trimmedBaseURL := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmedBaseURL == "" {
		trimmedBaseURL = "https://api.coingecko.com/api/v3"
	}

	return &Client{
		httpClient: &http.Client{Timeout: 20 * time.Second},
		baseURL:    trimmedBaseURL,
		apiKey:     strings.TrimSpace(apiKey),
	}
}

func (c *Client) FetchCoinsList(ctx context.Context, status string, includePlatform bool) ([]CoinsListItem, error) {
	endpoint, err := url.Parse(c.baseURL + "/coins/list")
	if err != nil {
		return nil, err
	}
	params := endpoint.Query()
	if includePlatform {
		params.Set("include_platform", "true")
	}
	if status = strings.TrimSpace(status); status != "" {
		params.Set("status", status)
	}
	endpoint.RawQuery = params.Encode()

	req, err := c.newRequest(ctx, endpoint.String())
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coingecko /coins/list failed with status %d", resp.StatusCode)
	}

	var items []CoinsListItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}
	return items, nil
}

func (c *Client) SearchCoins(ctx context.Context, query string) ([]SearchCoinItem, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return []SearchCoinItem{}, nil
	}

	endpoint, err := url.Parse(c.baseURL + "/search")
	if err != nil {
		return nil, err
	}
	params := endpoint.Query()
	params.Set("query", trimmedQuery)
	endpoint.RawQuery = params.Encode()

	req, err := c.newRequest(ctx, endpoint.String())
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coingecko /search failed with status %d", resp.StatusCode)
	}

	var payload struct {
		Coins []SearchCoinItem `json:"coins"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload.Coins, nil
}

func (c *Client) FetchMarkets(ctx context.Context, vsCurrency, order string, perPage, page int) ([]CoinMarketItem, error) {
	if strings.TrimSpace(vsCurrency) == "" {
		vsCurrency = "usd"
	}
	if strings.TrimSpace(order) == "" {
		order = "market_cap_desc"
	}
	if perPage <= 0 {
		perPage = 250
	}
	if page <= 0 {
		page = 1
	}

	endpoint, err := url.Parse(c.baseURL + "/coins/markets")
	if err != nil {
		return nil, err
	}
	params := endpoint.Query()
	params.Set("vs_currency", vsCurrency)
	params.Set("order", order)
	params.Set("per_page", strconv.Itoa(perPage))
	params.Set("page", strconv.Itoa(page))
	endpoint.RawQuery = params.Encode()

	req, err := c.newRequest(ctx, endpoint.String())
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coingecko /coins/markets failed with status %d", resp.StatusCode)
	}

	var items []CoinMarketItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}
	return items, nil
}

func (c *Client) SearchInstruments(ctx context.Context, query string, assetType string, maxResults int) ([]catalog.DiscoveryInstrument, error) {
	if strings.ToUpper(strings.TrimSpace(assetType)) != string(model.InstrumentAssetTypeCrypto) {
		return nil, fmt.Errorf("coingecko only supports crypto asset searches")
	}
	if maxResults <= 0 {
		maxResults = 10
	}

	coins, err := c.SearchCoins(ctx, query)
	if err != nil {
		return nil, err
	}

	results := make([]catalog.DiscoveryInstrument, 0, min(maxResults, len(coins)))
	for _, coin := range coins {
		symbol := strings.ToUpper(strings.TrimSpace(coin.Symbol))
		name := strings.TrimSpace(coin.Name)
		id := strings.TrimSpace(coin.ID)
		if symbol == "" || name == "" || id == "" {
			continue
		}

		exchangeCode := "coingecko"
		providerSource := "coingecko"
		imageURL := strings.TrimSpace(coin.Large)
		if imageURL == "" {
			imageURL = strings.TrimSpace(coin.Thumb)
		}
		results = append(results, catalog.DiscoveryInstrument{
			Symbol:             symbol,
			Name:               name,
			Exchange:           "CoinGecko",
			ExchangeCode:       &exchangeCode,
			AssetType:          model.InstrumentAssetTypeCrypto,
			ProviderSource:     providerSource,
			ProviderExternalID: &id,
			MarketCapRank:      intPtrIfPositive(coin.MarketCapRank),
			ImageURL:           stringPtrIfNotEmpty(imageURL),
		})
		if len(results) >= maxResults {
			break
		}
	}

	return results, nil
}

func (c *Client) newRequest(ctx context.Context, endpoint string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("accept", "application/json")
	req.Header.Set("user-agent", "sigma-finance/1.0")
	if c.apiKey != "" {
		req.Header.Set("x-cg-demo-api-key", c.apiKey)
	}
	return req, nil
}

func stringPtrIfNotEmpty(v string) *string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(v)
	return &trimmed
}

func intPtrIfPositive(v int) *int {
	if v <= 0 {
		return nil
	}
	value := v
	return &value
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
