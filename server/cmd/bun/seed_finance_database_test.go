package main

import (
	"testing"

	"sigma_finance/internal/domain/model"
)

func TestMapFinanceDatabaseRecordPopulatesRichFields(t *testing.T) {
	file := financeDatabaseSeedFile{
		name:      "equities.csv",
		assetType: model.InstrumentAssetTypeStock,
		sourceKey: "equities",
	}
	headers := []string{
		"symbol",
		"name",
		"summary",
		"currency",
		"sector",
		"industry_group",
		"industry",
		"exchange",
		"market",
		"country",
		"state",
		"city",
		"zipcode",
		"website",
		"market_cap",
		"isin",
		"cusip",
		"figi",
	}
	headerIndex := make(map[string]int, len(headers))
	for idx, header := range headers {
		headerIndex[header] = idx
	}

	record := []string{
		"AAPL",
		"Apple Inc.",
		"Consumer electronics and software",
		"USD",
		"Technology",
		"Consumer Electronics",
		"Consumer Electronics",
		"NASDAQ",
		"NASDAQ",
		"US",
		"CA",
		"Cupertino",
		"95014",
		"https://apple.com",
		"Large Cap",
		"US0378331005",
		"037833100",
		"BBG000B9XRY4",
	}

	instrument, ok, err := mapFinanceDatabaseRecord(file, headerIndex, record)
	if err != nil {
		t.Fatalf("mapFinanceDatabaseRecord returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected record to be imported")
	}
	if instrument.Summary == nil || *instrument.Summary != "Consumer electronics and software" {
		t.Fatalf("expected summary to be populated, got %#v", instrument.Summary)
	}
	if instrument.Sector == nil || *instrument.Sector != "Technology" {
		t.Fatalf("expected sector to be populated, got %#v", instrument.Sector)
	}
	if instrument.IndustryGroup == nil || *instrument.IndustryGroup != "Consumer Electronics" {
		t.Fatalf("expected industry group to be populated, got %#v", instrument.IndustryGroup)
	}
	if instrument.Website == nil || *instrument.Website != "https://apple.com" {
		t.Fatalf("expected website to be populated, got %#v", instrument.Website)
	}
	if instrument.MarketCap == nil || *instrument.MarketCap != "Large Cap" {
		t.Fatalf("expected market cap to be populated, got %#v", instrument.MarketCap)
	}
	if instrument.ProviderExternalID == nil || *instrument.ProviderExternalID == "" {
		t.Fatalf("expected provider external id to be stable")
	}
	if instrument.Metadata == nil {
		t.Fatalf("expected metadata to be populated")
	}

	metadata := instrument.Metadata
	if _, ok := metadata["raw"]; !ok {
		t.Fatalf("expected raw row to be stored in metadata")
	}
	provenance, ok := metadata["provenance"].(map[string]any)
	if !ok {
		t.Fatalf("expected provenance metadata to be present")
	}
	if provenance["sourceFile"] != "equities.csv" {
		t.Fatalf("expected provenance sourceFile, got %#v", provenance["sourceFile"])
	}
}

func TestFinanceDatabaseProviderIDIsStable(t *testing.T) {
	id1 := financeDatabaseProviderID("equities", "AAPL", "XNAS", "NASDAQ")
	id2 := financeDatabaseProviderID(" equities ", " aapl ", " xnas ", " nasdaq ")
	if id1 != id2 {
		t.Fatalf("expected provider id to be stable, got %q and %q", id1, id2)
	}
}
