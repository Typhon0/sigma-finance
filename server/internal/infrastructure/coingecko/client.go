package coingecko

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"sigma_finance/internal/domain/catalog"
	"sigma_finance/internal/domain/model"
)

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
		httpClient: &http.Client{Timeout: 15 * time.Second},
		baseURL:    trimmedBaseURL,
		apiKey:     strings.TrimSpace(apiKey),
	}
}

func (c *Client) SearchInstruments(ctx context.Context, query string, assetType string, maxResults int) ([]catalog.DiscoveryInstrument, error) {
	if strings.ToUpper(strings.TrimSpace(assetType)) != string(model.InstrumentAssetTypeCrypto) {
		return nil, fmt.Errorf("coingecko only supports crypto asset searches")
	}

	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return nil, fmt.Errorf("query is required")
	}
	if maxResults <= 0 {
		maxResults = 10
	}

	endpoint, err := url.Parse(c.baseURL + "/search")
	if err != nil {
		return nil, err
	}
	params := endpoint.Query()
	params.Set("query", trimmedQuery)
	endpoint.RawQuery = params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("accept", "application/json")
	req.Header.Set("user-agent", "sigma-finance/1.0")
	if c.apiKey != "" {
		req.Header.Set("x-cg-demo-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("coingecko search failed with status %d", resp.StatusCode)
	}

	var payload struct {
		Coins []struct {
			ID     string `json:"id"`
			Name   string `json:"name"`
			Symbol string `json:"symbol"`
		} `json:"coins"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	results := make([]catalog.DiscoveryInstrument, 0, maxResults)
	seen := make(map[string]struct{}, maxResults)
	for _, coin := range payload.Coins {
		symbol := strings.ToUpper(strings.TrimSpace(coin.Symbol))
		name := strings.TrimSpace(coin.Name)
		id := strings.TrimSpace(coin.ID)
		if symbol == "" || name == "" || id == "" {
			continue
		}

		resultSymbol := symbol + "/USDT"
		key := strings.ToUpper(resultSymbol)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		exchange := "CoinGecko"
		exchangeCode := "coingecko"
		currency := "USD"
		results = append(results, catalog.DiscoveryInstrument{
			Symbol:             resultSymbol,
			Name:               name,
			Exchange:           exchange,
			ExchangeCode:       &exchangeCode,
			Currency:           &currency,
			AssetType:          model.InstrumentAssetTypeCrypto,
			ProviderSource:     "coingecko",
			ProviderExternalID: &id,
		})

		if len(results) >= maxResults {
			break
		}
	}

	return results, nil
}
