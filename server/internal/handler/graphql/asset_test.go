package graphql

import (
	"encoding/json"
	"sigma_finance/internal/domain/model"
	"testing"
)

func TestMapStockToGQL(t *testing.T) {
	// Test data
	stockMetadata := model.StockMetadata{
		Exchange: "NASDAQ",
	}
	metadataBytes, _ := json.Marshal(stockMetadata)

	symbol := "AAPL"
	asset := model.Asset{
		ID:       "1",
		Name:     "Apple Inc.",
		Symbol:   &symbol,
		Type:     model.AssetTypeStock,
		Metadata: metadataBytes,
	}

	tags := []model.Tag{
		{ID: "1", Name: "tech"},
		{ID: "2", Name: "growth"},
	}

	// Test conversion
	result := mapStockToGQL(asset, nil, tags, nil, nil, nil)

	// Verify results
	if result.ID != "1" {
		t.Errorf("Expected ID '1', got '%s'", result.ID)
	}
	if result.Name != "Apple Inc." {
		t.Errorf("Expected Name 'Apple Inc.', got '%s'", result.Name)
	}
	if result.Ticker != "AAPL" {
		t.Errorf("Expected Ticker 'AAPL', got '%s'", result.Ticker)
	}
	if len(result.Tags) != 2 {
		t.Errorf("Expected 2 tags, got %d", len(result.Tags))
	}
	if result.AssetType.Name != "Stock" {
		t.Errorf("Expected AssetType.Name 'Stock', got '%s'", result.AssetType.Name)
	}
}

func TestMapCryptoToGQL(t *testing.T) {
	// Test data
	cryptoMetadata := model.CryptoMetadata{
		Blockchain:    "ethereum",
		WalletAddress: "0x123",
	}
	metadataBytes, _ := json.Marshal(cryptoMetadata)

	asset := model.Asset{
		ID:       "2",
		Name:     "Bitcoin",
		Type:     model.AssetTypeCrypto,
		Metadata: metadataBytes,
	}

	tags := []model.Tag{
		{ID: "3", Name: "crypto"},
	}

	// Test conversion
	result := mapCryptoToGQL(asset, nil, tags, nil, nil, nil)

	// Verify results
	if result.ID != "2" {
		t.Errorf("Expected ID '2', got '%s'", result.ID)
	}
	if result.Name != "Bitcoin" {
		t.Errorf("Expected Name 'Bitcoin', got '%s'", result.Name)
	}
	if *result.WalletAddress != "0x123" {
		t.Errorf("Expected WalletAddress '0x123', got '%s'", *result.WalletAddress)
	}
	if len(result.Tags) != 1 {
		t.Errorf("Expected 1 tag, got %d", len(result.Tags))
	}
	if result.AssetType.Name != "Crypto" {
		t.Errorf("Expected AssetType.Name 'Crypto', got '%s'", result.AssetType.Name)
	}
}

func TestParseID(t *testing.T) {
	// Test valid ID
	result, err := parseID("123")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result != "123" {
		t.Errorf("Expected ID '123', got %s", result)
	}
}
