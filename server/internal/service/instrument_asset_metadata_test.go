package service

import (
	"encoding/json"
	"sigma_finance/internal/domain/model"
	"testing"
)

func TestBuildTradeableAssetMetadataForStock(t *testing.T) {
	sector := "Technology"
	industry := "Consumer Electronics"
	quoteCurrency := "USD"
	instrument := &model.Instrument{
		Exchange:      "NASDAQ",
		Sector:        &sector,
		Industry:      &industry,
		QuoteCurrency: &quoteCurrency,
		AssetType:     model.InstrumentAssetTypeStock,
	}

	payload := buildTradeableAssetMetadata(nil, instrument, model.AssetTypeStock)

	var metadata map[string]any
	if err := json.Unmarshal(payload, &metadata); err != nil {
		t.Fatalf("unmarshal metadata: %v", err)
	}

	if metadata["exchange"] != "NASDAQ" {
		t.Fatalf("expected exchange NASDAQ, got %#v", metadata["exchange"])
	}
	if metadata["sector"] != "Technology" {
		t.Fatalf("expected sector Technology, got %#v", metadata["sector"])
	}
	if metadata["industry"] != "Consumer Electronics" {
		t.Fatalf("expected industry Consumer Electronics, got %#v", metadata["industry"])
	}
	if metadata["currency"] != "USD" {
		t.Fatalf("expected currency USD, got %#v", metadata["currency"])
	}
}

func TestBuildTradeableAssetMetadataPreservesExistingFields(t *testing.T) {
	sector := "Technology"
	industry := "Consumer Electronics"
	instrument := &model.Instrument{
		Exchange:  "NYSE",
		Sector:    &sector,
		Industry:  &industry,
		AssetType: model.InstrumentAssetTypeETF,
	}

	existing := json.RawMessage(`{"currency":"EUR","custom":"keep-me"}`)
	payload := buildTradeableAssetMetadata(existing, instrument, model.AssetTypeFund)

	var metadata map[string]any
	if err := json.Unmarshal(payload, &metadata); err != nil {
		t.Fatalf("unmarshal metadata: %v", err)
	}

	if metadata["currency"] != "EUR" {
		t.Fatalf("expected existing currency EUR to be preserved, got %#v", metadata["currency"])
	}
	if metadata["custom"] != "keep-me" {
		t.Fatalf("expected custom field to be preserved, got %#v", metadata["custom"])
	}
	if metadata["fund_type"] != "etf" {
		t.Fatalf("expected fund_type etf, got %#v", metadata["fund_type"])
	}
	if metadata["exchange"] != "NYSE" {
		t.Fatalf("expected exchange NYSE, got %#v", metadata["exchange"])
	}
}
