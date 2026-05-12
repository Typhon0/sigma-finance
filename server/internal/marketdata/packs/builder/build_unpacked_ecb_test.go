package builder

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	licensegate "sigma_finance/internal/marketdata/packs/license"
	"sigma_finance/internal/marketdata/packs/sources"
)

func TestBuildUnpackedPackECBWithDerivedMetadata(t *testing.T) {
	csvBody := strings.Join([]string{
		"TIME_PERIOD,CURRENCY,CURRENCY_DENOM,OBS_VALUE",
		"2026-05-09,USD,EUR,1.1200",
		"2026-05-09,GBP,EUR,0.8500",
		"2026-05-10,USD,EUR,1.1155",
		"2026-05-10,GBP,EUR,0.8607",
		"",
	}, "\n")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(csvBody))
	}))
	defer server.Close()

	plan := &BuildPlan{
		Spec: &PackSpec{
			PackID:         "fx-ecb-core-daily",
			Name:           "FX ECB Core Daily",
			Version:        "2026.05.11",
			FormatVersion:  1,
			Distribution:   "public",
			AssetType:      "FX",
			Interval:       "1d",
			QuoteCurrency:  "EUR",
			SourceProvider: "ecb-statistics",
			History: HistorySpec{
				Start: "2026-05-09",
				End:   "2026-05-10",
			},
			Output: OutputConfig{
				Compression: "zstd",
				PartitionBy: []string{"asset_type", "quote_currency", "year"},
			},
		},
		Universe: &sources.Universe{
			Symbols: []sources.UniverseSymbol{
				{InstrumentID: "00000000-0000-0000-0000-000000000001", Symbol: "EURUSD", BaseAsset: "EUR", QuoteAsset: "USD", AssetType: "FX"},
				{InstrumentID: "00000000-0000-0000-0000-000000000002", Symbol: "USDEUR", BaseAsset: "USD", QuoteAsset: "EUR", AssetType: "FX"},
				{InstrumentID: "00000000-0000-0000-0000-000000000003", Symbol: "USDGBP", BaseAsset: "USD", QuoteAsset: "GBP", AssetType: "FX"},
			},
		},
		LicensePolicy: &licensegate.Policy{
			ProviderID:            "ecb-statistics",
			Name:                  "ECB Statistics Data Portal",
			SourceURL:             "https://data.ecb.europa.eu/",
			LicenseName:           "ECB statistics reuse policy",
			RedistributionAllowed: true,
			CommercialUseAllowed:  true,
			AttributionRequired:   true,
			TermsCheckedAt:        "2026-05-11",
		},
		OutputDir: t.TempDir(),
	}

	result, err := BuildUnpackedPack(context.Background(), plan, BuildUnpackedOptions{
		SourceBaseURL: server.URL,
		AllSymbols:    true,
	})
	if err != nil {
		t.Fatalf("build ecb pack: %v", err)
	}
	if result.RowsCount != 6 {
		t.Fatalf("expected 6 rows, got %d", result.RowsCount)
	}
	if _, err := ValidateUnpackedPack(result.PackDir); err != nil {
		t.Fatalf("validate unpacked ecb pack: %v", err)
	}

	coverage := result.Manifest.Coverage
	if len(coverage) != 3 {
		t.Fatalf("expected 3 coverage entries, got %d", len(coverage))
	}
	var rawFound bool
	var inverseFound bool
	var crossFound bool
	for _, cov := range coverage {
		switch cov.Symbol {
		case "EURUSD":
			rawFound = cov.Source == "ecb-statistics" && cov.DerivationType == "raw" && len(cov.DerivedFrom) == 0
		case "USDEUR":
			inverseFound = cov.Source == "ecb-statistics-derived" && cov.DerivationType == "inverse" && strings.Join(cov.DerivedFrom, ",") == "EURUSD"
		case "USDGBP":
			crossFound = cov.Source == "ecb-statistics-derived" && cov.DerivationType == "cross" && strings.Join(cov.DerivedFrom, ",") == "EURGBP,EURUSD"
		}
	}
	if !rawFound || !inverseFound || !crossFound {
		t.Fatalf("coverage derivation metadata missing or incorrect: %+v", coverage)
	}
}
