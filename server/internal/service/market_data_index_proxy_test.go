package service

import (
	"context"
	"testing"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
)

// stubBenchmarkProxyRepo implements the small benchmarkProxyRepo subset
// that resolveBenchmarkProxyInstrument depends on.  Full IInstrumentRepository
// would require stubbing dozens of methods; this minimal interface is
// sufficient for the proxy path.
type stubBenchmarkProxyRepo struct {
	searchFn     func(ctx context.Context, query string, filter repository.InstrumentSearchFilter) ([]repository.InstrumentSearchRow, error)
	getByIDFn    func(ctx context.Context, id string) (*model.Instrument, error)
	searchCalls  int
	getByIDCalls int
}

func (s *stubBenchmarkProxyRepo) Search(ctx context.Context, query string, filter repository.InstrumentSearchFilter) ([]repository.InstrumentSearchRow, error) {
	s.searchCalls++
	if s.searchFn == nil {
		return nil, repository.ErrNotFound
	}
	return s.searchFn(ctx, query, filter)
}

func (s *stubBenchmarkProxyRepo) GetByID(ctx context.Context, id string) (*model.Instrument, error) {
	s.getByIDCalls++
	if s.getByIDFn == nil {
		return nil, repository.ErrNotFound
	}
	return s.getByIDFn(ctx, id)
}

func TestRewriteCandlesToInstrument_SwapsIdentityOnCopy(t *testing.T) {
	proxyID := "spy-instr-uuid"
	originalID := "spx-instr-uuid"
	eur := "EUR"
	originalCaches := []model.Candle{
		{InstrumentID: &proxyID, Symbol: "SPY", AssetType: string(model.InstrumentAssetTypeETF), QuoteCurrency: "USD"},
		{InstrumentID: &proxyID, Symbol: "SPY", AssetType: string(model.InstrumentAssetTypeETF), QuoteCurrency: "USD"},
	}
	original := &model.Instrument{
		ID:            originalID,
		Symbol:        "^SPX",
		AssetType:     model.InstrumentAssetTypeIndex,
		QuoteCurrency: &eur,
	}

	rewritten := rewriteCandlesToInstrument(originalCaches, original)
	if len(rewritten) != len(originalCaches) {
		t.Fatalf("expected %d candles, got %d", len(originalCaches), len(rewritten))
	}

	for i, c := range rewritten {
		if c.InstrumentID == nil || *c.InstrumentID != originalID {
			t.Errorf("candle[%d] InstrumentID: expected %s, got %v", i, originalID, c.InstrumentID)
		}
		if c.Symbol != "^SPX" {
			t.Errorf("candle[%d] Symbol: expected ^SPX, got %s", i, c.Symbol)
		}
		if c.AssetType != string(model.InstrumentAssetTypeIndex) {
			t.Errorf("candle[%d] AssetType: expected INDEX, got %s", i, c.AssetType)
		}
		if c.QuoteCurrency != "EUR" {
			t.Errorf("candle[%d] QuoteCurrency: expected EUR (re-written from ^SPX QuoteCurrency), got %s", i, c.QuoteCurrency)
		}
	}

	// Proxy cache slice must NOT be mutated - we deep-copied.
	for i, c := range originalCaches {
		if c.InstrumentID == nil || *c.InstrumentID != proxyID {
			t.Errorf("original candle[%d] InstrumentID was mutated: expected %s, got %v", i, proxyID, c.InstrumentID)
		}
		if c.Symbol != "SPY" {
			t.Errorf("original candle[%d] Symbol was mutated: expected SPY, got %s", i, c.Symbol)
		}
		if c.QuoteCurrency != "USD" {
			t.Errorf("original candle[%d] QuoteCurrency was mutated: expected USD, got %s", i, c.QuoteCurrency)
		}
	}
}

func TestRewriteCandlesToInstrument_FallsBackToCurrencyField(t *testing.T) {
	// When QuoteCurrency is nil but Currency is set, the rewrite should
	// fall through to Currency (mirrors the firstNonEmpty chain used by
	// the production fetchCandlesByInstrument path).
	gbp := "GBP"
	candles := []model.Candle{{Symbol: "VUKE.L", QuoteCurrency: "GBp"}}
	original := &model.Instrument{
		Symbol:    "^FTSE",
		AssetType: model.InstrumentAssetTypeIndex,
		Currency:  &gbp,
	}
	out := rewriteCandlesToInstrument(candles, original)
	if out[0].QuoteCurrency != "GBP" {
		t.Errorf("expected GBP fallback chain, got %s", out[0].QuoteCurrency)
	}
}

func TestRewriteCandlesToInstrument_NilSafe(t *testing.T) {
	if got := rewriteCandlesToInstrument(nil, &model.Instrument{}); got != nil {
		t.Errorf("expected nil for empty candles, got %#v", got)
	}
	empty := []model.Candle{}
	if got := rewriteCandlesToInstrument(empty, &model.Instrument{}); len(got) != 0 {
		t.Errorf("expected empty slice to round-trip, got %#v", got)
	}
	candle := model.Candle{InstrumentID: nil, Symbol: "X"}
	if got := rewriteCandlesToInstrument([]model.Candle{candle}, nil); len(got) != 1 {
		t.Error("expected nil original instrument to return slice unchanged")
	}
}

func TestResolveBenchmarkProxyInstrument_ReturnsETFForMajorIndex(t *testing.T) {
	spyInstr := &model.Instrument{
		ID:        "spy-instr-uuid",
		Symbol:    "SPY",
		AssetType: model.InstrumentAssetTypeETF,
	}
	repo := &stubBenchmarkProxyRepo{
		searchFn: func(ctx context.Context, query string, filter repository.InstrumentSearchFilter) ([]repository.InstrumentSearchRow, error) {
			if query == "SPY" && len(filter.AssetTypes) == 1 && filter.AssetTypes[0] == model.InstrumentAssetTypeETF {
				return []repository.InstrumentSearchRow{
					{Instrument: *spyInstr, Score: 1000},
				}, nil
			}
			return nil, repository.ErrNotFound
		},
		getByIDFn: func(ctx context.Context, id string) (*model.Instrument, error) {
			if id == "spy-instr-uuid" {
				return spyInstr, nil
			}
			return nil, repository.ErrNotFound
		},
	}
	spxInstr := &model.Instrument{
		ID:        "spx-instr-uuid",
		Symbol:    "^SPX",
		AssetType: model.InstrumentAssetTypeIndex,
	}

	result := resolveBenchmarkProxyInstrument(context.Background(), spxInstr, repo)
	if result == nil {
		t.Fatal("expected ETF proxy for ^SPX, got nil")
	}
	if result.ID != "spy-instr-uuid" {
		t.Fatalf("expected SPY ID, got %s", result.ID)
	}
	if result.AssetType != model.InstrumentAssetTypeETF {
		t.Fatalf("expected ETF asset type, got %s", result.AssetType)
	}
	if repo.searchCalls != 1 {
		t.Errorf("expected 1 search call, got %d", repo.searchCalls)
	}
	if repo.getByIDCalls != 1 {
		t.Errorf("expected 1 GetByID call, got %d", repo.getByIDCalls)
	}
}

func TestResolveBenchmarkProxyInstrument_NilForNonIndexAssetType(t *testing.T) {
	// Every non-INDEX asset type must short-circuit, including ETF (which
	// would otherwise cause infinite recursion).
	cases := []model.InstrumentAssetType{
		model.InstrumentAssetTypeStock,
		model.InstrumentAssetTypeETF,
		model.InstrumentAssetTypeCrypto,
		model.InstrumentAssetTypeFund,
		model.InstrumentAssetTypeCurrency,
	}
	for _, at := range cases {
		instr := &model.Instrument{Symbol: "^SPX", AssetType: at}
		if got := resolveBenchmarkProxyInstrument(context.Background(), instr, &stubBenchmarkProxyRepo{}); got != nil {
			t.Errorf("expected nil for asset_type=%s (bounds recursion guard), got %v", at, got)
		}
	}
}

func TestResolveBenchmarkProxyInstrument_NilForUnmappedSymbol(t *testing.T) {
	at := model.InstrumentAssetTypeIndex
	instr := &model.Instrument{Symbol: "^DJIA-FOO", AssetType: at}
	if got := resolveBenchmarkProxyInstrument(context.Background(), instr, &stubBenchmarkProxyRepo{}); got != nil {
		t.Fatalf("expected nil for unknown proxy symbol, got %v", got)
	}
}

func TestResolveBenchmarkProxyInstrument_NilWhenProxyNotInDB(t *testing.T) {
	instr := &model.Instrument{Symbol: "^HSI", AssetType: model.InstrumentAssetTypeIndex}
	repo := &stubBenchmarkProxyRepo{
		searchFn: func(ctx context.Context, query string, filter repository.InstrumentSearchFilter) ([]repository.InstrumentSearchRow, error) {
			return []repository.InstrumentSearchRow{}, nil
		},
	}
	if got := resolveBenchmarkProxyInstrument(context.Background(), instr, repo); got != nil {
		t.Fatalf("expected nil when proxy symbol returns no rows, got %v", got)
	}
}

func TestResolveBenchmarkProxyInstrument_NilForNilInstrument(t *testing.T) {
	if got := resolveBenchmarkProxyInstrument(context.Background(), nil, &stubBenchmarkProxyRepo{}); got != nil {
		t.Fatalf("expected nil for nil instrument, got %v", got)
	}
}

func TestResolveBenchmarkProxyInstrument_ResolvesNDXToQQQ(t *testing.T) {
	// Smoke-check that the static map wires the right proxy for a known
	// index beyond ^SPX.
	qqqInstr := &model.Instrument{
		ID:        "qqq-instr-uuid",
		Symbol:    "QQQ",
		AssetType: model.InstrumentAssetTypeETF,
	}
	repo := &stubBenchmarkProxyRepo{
		searchFn: func(ctx context.Context, query string, filter repository.InstrumentSearchFilter) ([]repository.InstrumentSearchRow, error) {
			if query == "QQQ" {
				return []repository.InstrumentSearchRow{{Instrument: *qqqInstr, Score: 1000}}, nil
			}
			return nil, repository.ErrNotFound
		},
		getByIDFn: func(ctx context.Context, id string) (*model.Instrument, error) {
			if id == "qqq-instr-uuid" {
				return qqqInstr, nil
			}
			return nil, repository.ErrNotFound
		},
	}
	ndxInstr := &model.Instrument{
		ID:        "ndx-instr-uuid",
		Symbol:    "^NDX",
		AssetType: model.InstrumentAssetTypeIndex,
	}
	result := resolveBenchmarkProxyInstrument(context.Background(), ndxInstr, repo)
	if result == nil || result.Symbol != "QQQ" {
		t.Fatalf("expected QQQ proxy for ^NDX, got %v", result)
	}
}
