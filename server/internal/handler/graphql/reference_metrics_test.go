package graphql

import (
	"encoding/json"
	"sigma_finance/internal/domain/model"
	"testing"

	"github.com/shopspring/decimal"
)

func decimalPtr(v string) *decimal.Decimal {
	d, err := decimal.NewFromString(v)
	if err != nil {
		panic(err)
	}
	return &d
}

func floatPtr(v float64) *float64 { return &v }

func metadataJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal metadata: %v", err)
	}
	return encoded
}

func TestResolveReferenceMetrics_InstrumentIsAuthoritative(t *testing.T) {
	// Two users holding the same ETF must see the same expense ratio. The
	// instrument describes the security, not the user's copy of it, so the
	// instrument column wins over the per-asset metadata blob.
	instrument := &model.Instrument{ExpenseRatio: decimalPtr("0.03")}
	asset := model.Asset{
		Metadata: metadataJSON(t, model.FundMetadata{FundType: "etf", ExpenseRatio: floatPtr(0.65)}),
	}

	got := resolveReferenceMetrics(asset, instrument)

	if got.ExpenseRatio == nil {
		t.Fatal("expected an expense ratio")
	}
	if *got.ExpenseRatio != 0.03 {
		t.Errorf("expense ratio = %v, want 0.03 (the instrument, not the asset metadata)", *got.ExpenseRatio)
	}
}

func TestResolveReferenceMetrics_FallsBackToAssetMetadata(t *testing.T) {
	// A holding created before the instrument was linked still has figures in
	// its metadata blob. Losing them on upgrade would be a silent regression.
	asset := model.Asset{
		Metadata: metadataJSON(t, model.StockMetadata{
			Exchange:      "NASDAQ",
			PERatio:       floatPtr(28.5),
			DividendYield: floatPtr(1.85),
		}),
	}

	got := resolveReferenceMetrics(asset, nil)

	if got.PERatio == nil || *got.PERatio != 28.5 {
		t.Errorf("pe ratio = %v, want 28.5", got.PERatio)
	}
	if got.DividendYield == nil || *got.DividendYield != 1.85 {
		t.Errorf("dividend yield = %v, want 1.85", got.DividendYield)
	}
}

func TestResolveReferenceMetrics_UnknownStaysUnknown(t *testing.T) {
	// The regression this whole file exists to prevent. The client used to
	// resolve the expense ratio from a hardcoded symbol table
	// (VOO -> 0.03) with a 0.15 fallback, then weight it by position value and
	// render it as an annual fee in currency. A fund whose real TER is 1.8%
	// read as 0.15%: a twelve-fold error in the user's favour, which is worse
	// than an error against them because nobody audits it.
	tests := []struct {
		name       string
		asset      model.Asset
		instrument *model.Instrument
	}{
		{
			name:  "no metadata and no instrument",
			asset: model.Asset{},
		},
		{
			name:       "instrument exists but carries no metrics",
			asset:      model.Asset{},
			instrument: &model.Instrument{Symbol: "VOO"},
		},
		{
			name: "metadata present but empty of metrics",
			asset: model.Asset{
				Metadata: metadataJSON(t, model.FundMetadata{FundType: "etf"}),
			},
		},
		{
			name: "instrument column is null",
			asset: model.Asset{
				Metadata: metadataJSON(t, model.FundMetadata{FundType: "etf"}),
			},
			instrument: &model.Instrument{Symbol: "VOO", ExpenseRatio: nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveReferenceMetrics(tt.asset, tt.instrument)
			if got.ExpenseRatio != nil {
				t.Errorf("expense ratio = %v, want nil (unknown must not be filled in)", *got.ExpenseRatio)
			}
		})
	}
}

func TestResolveReferenceMetrics_RejectsImplausibleValues(t *testing.T) {
	// A yield of 150% or a negative expense ratio is a provider bug, not a
	// fact. Asset.ValidateMetadata rejects some of these on write, but the
	// blob can be written by paths that skip validation.
	tests := []struct {
		name   string
		metric func(ReferenceMetrics) *float64
	}{
		{"dividend yield above 100", func(m ReferenceMetrics) *float64 { return m.DividendYield }},
		{"negative expense ratio", func(m ReferenceMetrics) *float64 { return m.ExpenseRatio }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			asset := model.Asset{
				Metadata: metadataJSON(t, map[string]any{
					"fund_type":      "etf",
					"expense_ratio":  -1.0,
					"dividend_yield": 150.0,
				}),
			}
			if got := tt.metric(resolveReferenceMetrics(asset, nil)); got != nil {
				t.Errorf("got %v, want nil", *got)
			}
		})
	}
}

func TestResolveReferenceMetrics_NullColumnsAreNotZero(t *testing.T) {
	// A NULL column and a 0.000000 column are different claims. Only the
	// former means "unknown".
	unknown := resolveReferenceMetrics(model.Asset{}, &model.Instrument{})
	if unknown.ExpenseRatio != nil {
		t.Errorf("NULL expense ratio became %v, want nil", *unknown.ExpenseRatio)
	}

	zero := resolveReferenceMetrics(model.Asset{}, &model.Instrument{ExpenseRatio: decimalPtr("0")})
	if zero.ExpenseRatio == nil {
		t.Fatal("an explicit 0 expense ratio must be reported as 0, not as unknown")
	}
	if *zero.ExpenseRatio != 0 {
		t.Errorf("expense ratio = %v, want 0", *zero.ExpenseRatio)
	}
}

func TestResolveReferenceMetrics_InvalidMetadataDoesNotPanic(t *testing.T) {
	// The blob is jsonb that predates the current structs and is written by
	// several code paths. A malformed one must degrade to "unknown", not panic
	// in the middle of rendering a portfolio.
	asset := model.Asset{Metadata: json.RawMessage(`{"expense_ratio": "not a number"}`)}

	got := resolveReferenceMetrics(asset, nil)

	if got.ExpenseRatio != nil {
		t.Errorf("expense ratio = %v, want nil", *got.ExpenseRatio)
	}
}

func TestInstrumentFor(t *testing.T) {
	instrumentID := "inst-1"
	instruments := map[string]model.Instrument{
		"inst-1": {ID: "inst-1", Symbol: "VOO"},
	}

	if got := instrumentFor(model.Asset{InstrumentID: &instrumentID}, instruments); got == nil {
		t.Error("expected the instrument to resolve")
	}
	// A manual holding has no instrument. That is the normal path for a
	// hand-entered asset and must not be an error.
	if got := instrumentFor(model.Asset{}, instruments); got != nil {
		t.Error("expected nil for an asset with no instrument id")
	}
	empty := ""
	if got := instrumentFor(model.Asset{InstrumentID: &empty}, instruments); got != nil {
		t.Error("expected nil for an empty instrument id")
	}
	// The batch loader may have missed this one (deleted instrument, race).
	missing := "inst-gone"
	if got := instrumentFor(model.Asset{InstrumentID: &missing}, instruments); got != nil {
		t.Error("expected nil for an instrument id absent from the batch")
	}
}
