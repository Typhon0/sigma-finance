package graphql

import (
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
)

func TestMapStockToGQL(t *testing.T) {
	// Test data
	asset := model.Asset{
		ID:            1,
		Name:          "Apple Inc.",
		AssetTypeID:   1,
		CurrentValue:  150.0,
		PurchaseDate:  time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
		PurchasePrice: 120.0,
	}

	stock := model.Stock{
		AssetID:     1,
		Ticker:      "AAPL",
		Quantity:    10.0,
		BuyingPrice: 120.0,
	}

	assetType := model.AssetType{
		ID:   1,
		Name: "STOCK",
	}

	tags := []model.Tag{
		{ID: 1, Name: "tech"},
		{ID: 2, Name: "growth"},
	}

	// Test conversion
	result := mapStockToGQL(asset, stock, &assetType, tags)

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
	if result.Quantity != 10.0 {
		t.Errorf("Expected Quantity 10.0, got %f", result.Quantity)
	}
	if len(result.Tags) != 2 {
		t.Errorf("Expected 2 tags, got %d", len(result.Tags))
	}
	if result.AssetType.Name != "STOCK" {
		t.Errorf("Expected AssetType.Name 'STOCK', got '%s'", result.AssetType.Name)
	}
}

func TestMapCryptoToGQL(t *testing.T) {
	// Test data
	asset := model.Asset{
		ID:            2,
		Name:          "Bitcoin",
		AssetTypeID:   2,
		CurrentValue:  45000.0,
		PurchaseDate:  time.Date(2023, 2, 1, 0, 0, 0, 0, time.UTC),
		PurchasePrice: 40000.0,
	}

	crypto := model.Crypto{
		AssetID:           2,
		WalletAddress:     "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
		BlockchainNetwork: "Bitcoin",
		Quantity:          0.5,
	}

	assetType := model.AssetType{
		ID:   2,
		Name: "CRYPTO",
	}

	tags := []model.Tag{
		{ID: 3, Name: "crypto"},
	}

	// Test conversion
	result := mapCryptoToGQL(asset, crypto, &assetType, tags)

	// Verify results
	if result.ID != "2" {
		t.Errorf("Expected ID '2', got '%s'", result.ID)
	}
	if result.Name != "Bitcoin" {
		t.Errorf("Expected Name 'Bitcoin', got '%s'", result.Name)
	}
	if result.Quantity != 0.5 {
		t.Errorf("Expected Quantity 0.5, got %f", result.Quantity)
	}
	if *result.WalletAddress != "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" {
		t.Errorf("Expected WalletAddress '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', got '%s'", *result.WalletAddress)
	}
	if len(result.Tags) != 1 {
		t.Errorf("Expected 1 tag, got %d", len(result.Tags))
	}
	if result.AssetType.Name != "CRYPTO" {
		t.Errorf("Expected AssetType.Name 'CRYPTO', got '%s'", result.AssetType.Name)
	}
}

func TestParseID(t *testing.T) {
	// Test valid ID
	result, err := parseID("123")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if result != 123 {
		t.Errorf("Expected 123, got %d", result)
	}

	// Test invalid ID
	_, err = parseID("invalid")
	if err == nil {
		t.Error("Expected error for invalid ID, got nil")
	}

	// Test empty ID
	_, err = parseID("")
	if err == nil {
		t.Error("Expected error for empty ID, got nil")
	}
}

func TestBuildAssetOrderString(t *testing.T) {
	// Test NAME ASC
	result := buildAssetOrderString(gqlModel.AssetOrderFieldName, gqlModel.SortDirectionAsc)
	expected := "name ASC"
	if result != expected {
		t.Errorf("Expected '%s', got '%s'", expected, result)
	}

	// Test CURRENT_VALUE DESC
	result = buildAssetOrderString(gqlModel.AssetOrderFieldCurrentValue, gqlModel.SortDirectionDesc)
	expected = "current_value DESC"
	if result != expected {
		t.Errorf("Expected '%s', got '%s'", expected, result)
	}

	// Test PURCHASE_DATE ASC
	result = buildAssetOrderString(gqlModel.AssetOrderFieldPurchaseDate, gqlModel.SortDirectionAsc)
	expected = "purchase_date ASC"
	if result != expected {
		t.Errorf("Expected '%s', got '%s'", expected, result)
	}
}
