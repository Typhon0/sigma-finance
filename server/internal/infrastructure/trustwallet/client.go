package trustwallet

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"sigma_finance/internal/service/catalog"
	"sort"
	"strings"
	"sync"
)

//go:embed catalog.json
var bundledCatalogJSON []byte

type bundledRecord struct {
	ExternalID    string            `json:"externalId"`
	Symbol        string            `json:"symbol"`
	Name          string            `json:"name"`
	MarketCapRank *int              `json:"marketCapRank,omitempty"`
	ImageURL      *string           `json:"imageUrl,omitempty"`
	Platforms     map[string]string `json:"platforms,omitempty"`
	Status        string            `json:"status,omitempty"`
}

type Client struct {
	once    sync.Once
	loadErr error
	records []catalog.CatalogAsset
	byID    map[string]catalog.CatalogAsset
}

func NewClient() *Client {
	return &Client{}
}

func (c *Client) ListAssets(_ context.Context, listingStatus string, start int, limit int) ([]catalog.CatalogAsset, error) {
	if err := c.ensureLoaded(); err != nil {
		return nil, err
	}

	if start <= 0 {
		start = 1
	}
	if limit <= 0 {
		limit = 5000
	}

	statusFilter := strings.ToLower(strings.TrimSpace(listingStatus))
	if statusFilter == "" {
		statusFilter = "active"
	}

	if statusFilter != "active" && statusFilter != "all" {
		return []catalog.CatalogAsset{}, nil
	}
	if statusFilter == "all" {
		result := make([]catalog.CatalogAsset, len(c.records))
		copy(result, c.records)
		return result, nil
	}

	filtered := make([]catalog.CatalogAsset, 0, len(c.records))
	for _, item := range c.records {
		filtered = append(filtered, item)
	}

	startIdx := start - 1
	if startIdx >= len(filtered) {
		return []catalog.CatalogAsset{}, nil
	}
	endIdx := startIdx + limit
	if endIdx > len(filtered) {
		endIdx = len(filtered)
	}

	result := make([]catalog.CatalogAsset, endIdx-startIdx)
	copy(result, filtered[startIdx:endIdx])
	return result, nil
}

func (c *Client) GetAssetByID(_ context.Context, externalID string) (*catalog.CatalogAsset, error) {
	if err := c.ensureLoaded(); err != nil {
		return nil, err
	}
	key := strings.TrimSpace(externalID)
	if key == "" {
		return nil, nil
	}
	row, ok := c.byID[key]
	if !ok {
		return nil, nil
	}
	copyRow := row
	return &copyRow, nil
}

func (c *Client) ensureLoaded() error {
	c.once.Do(func() {
		var payload []bundledRecord
		if err := json.Unmarshal(bundledCatalogJSON, &payload); err != nil {
			c.loadErr = fmt.Errorf("failed to parse bundled trustwallet catalog: %w", err)
			return
		}

		records := make([]catalog.CatalogAsset, 0, len(payload))
		byID := make(map[string]catalog.CatalogAsset, len(payload))
		for _, row := range payload {
			externalID := strings.TrimSpace(row.ExternalID)
			symbol := strings.ToUpper(strings.TrimSpace(row.Symbol))
			name := strings.TrimSpace(row.Name)
			status := strings.ToLower(strings.TrimSpace(row.Status))
			if status == "" {
				status = "active"
			}

			if externalID == "" || symbol == "" || name == "" || status != "active" {
				continue
			}

			asset := catalog.CatalogAsset{
				ExternalID:    externalID,
				Symbol:        symbol,
				Name:          name,
				MarketCapRank: row.MarketCapRank,
				ImageURL:      row.ImageURL,
				Platforms:     normalizePlatforms(row.Platforms),
			}
			records = append(records, asset)
			byID[externalID] = asset
		}

		sort.Slice(records, func(i, j int) bool {
			return records[i].ExternalID < records[j].ExternalID
		})
		c.records = records
		c.byID = byID
	})

	return c.loadErr
}

func normalizePlatforms(platforms map[string]string) map[string]string {
	if len(platforms) == 0 {
		return nil
	}

	normalized := make(map[string]string, len(platforms))
	for chain, contract := range platforms {
		chainName := strings.ToLower(strings.TrimSpace(chain))
		address := strings.TrimSpace(contract)
		if chainName == "" || address == "" {
			continue
		}
		normalized[chainName] = address
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}
