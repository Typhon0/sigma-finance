package service

import (
	"context"
	"fmt"
	"math"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/shopspring/decimal"
)

// basisFXStub resolves historical rates from a fixed table and everything else
// from a latest-rate map (value conversion). The stub makes the execution-date
// policy observable: a lot whose day has no row MUST come back unconverted
// even when a fresh latest rate exists.
type basisFXStub struct {
	IFXRateService
	historical map[string]decimal.Decimal // "EUR/USD@2006-01-02"
	latest     map[string]decimal.Decimal // "EUR/USD" latest rate for Convert
}

func (s *basisFXStub) GetHistoricalRate(ctx context.Context, base, quote model.Currency, date time.Time) (*model.FXRate, error) {
	key := fmt.Sprintf("%s/%s@%s", base, quote, date.UTC().Format("2006-01-02"))
	if rate, ok := s.historical[key]; ok {
		return &model.FXRate{
			BaseCurrency:  base,
			QuoteCurrency: quote,
			Rate:          rate,
			AsOf:          date.UTC(),
			Source:        "STUB",
			Granularity:   model.FXRateGranularityDay,
		}, nil
	}
	return nil, ErrFXRateNotFound
}

func (s *basisFXStub) Convert(ctx context.Context, amount model.Money, from, to model.Currency) (*ConversionResult, error) {
	if from == to {
		return &ConversionResult{
			OriginalAmount:  amount,
			ConvertedAmount: amount,
			Rate:            decimal.NewFromInt(1),
			FromCurrency:    from,
			ToCurrency:      to,
			Source:          "IDENTITY",
			AsOf:            time.Now().UTC(),
			Granularity:     model.FXRateGranularityMinute,
		}, nil
	}
	rate, ok := s.latest[fmt.Sprintf("%s/%s", from, to)]
	if !ok {
		return nil, ErrFXRateNotFound
	}
	return &ConversionResult{
		OriginalAmount:  amount,
		ConvertedAmount: convertLotCents(amount, rate),
		Rate:            rate,
		FromCurrency:    from,
		ToCurrency:      to,
		Source:          "STUB",
		AsOf:            time.Now().UTC(),
		Granularity:     model.FXRateGranularityMinute,
	}, nil
}

// basisUoWStub exposes just the two repositories CalculatePositionValue
// touches, keyed by position and asset id. Everything else stays nil on the
// embedded interface; a call to an unimplemented repository would panic, which
// is the loud failure wanted here.
type basisUoWStub struct {
	repository.IUnitOfWork
	transactions map[string][]model.Transaction // by position id
	latestPrice  map[string]decimal.Decimal     // by asset id
}

type basisTransactionRepoStub struct {
	repository.ITransactionRepository
	uow *basisUoWStub
}

func (r *basisTransactionRepoStub) FindByPositionID(ctx context.Context, positionID string) ([]model.Transaction, error) {
	return r.uow.transactions[positionID], nil
}

type basisPriceRepoStub struct {
	repository.IPriceRepository
	uow *basisUoWStub
}

func (r *basisPriceRepoStub) GetLatestPrice(ctx context.Context, assetID string) (*model.AssetPrice, error) {
	price, ok := r.uow.latestPrice[assetID]
	if !ok {
		return nil, fmt.Errorf("no price for asset %s", assetID)
	}
	return &model.AssetPrice{AssetID: assetID, Price: price}, nil
}

func (u *basisUoWStub) Transaction() repository.ITransactionRepository {
	return &basisTransactionRepoStub{uow: u}
}

func (u *basisUoWStub) AssetPrice() repository.IPriceRepository {
	return &basisPriceRepoStub{uow: u}
}

func basisTx(id string, txType model.TransactionType, qty, price string, currency model.Currency, executedAt time.Time) model.Transaction {
	quantity := decimal.RequireFromString(qty)
	unitPrice := decimal.RequireFromString(price)
	return model.Transaction{
		ID:                id,
		UserID:            "user-1",
		Type:              txType,
		Quantity:          &quantity,
		UnitPriceAmount:   &unitPrice,
		UnitPriceCurrency: currency,
		ExecutedAt:        executedAt,
	}
}

func mustDecimal(t *testing.T, value string) decimal.Decimal {
	t.Helper()
	return decimal.RequireFromString(value)
}

// basisPosition is the recurring GOOGL-shaped fixture: quoted in USD, bought
// in EUR through a European broker. The market price lives on the stub, not
// the position.
func basisPosition(id, assetID, qty string) model.Position {
	return model.Position{
		ID:            id,
		AssetID:       assetID,
		Quantity:      decimal.RequireFromString(qty),
		QuoteCurrency: model.CurrencyUSD,
	}
}

func TestResolveCostBasis_ConvertsRemainderAtExecutionDate(t *testing.T) {
	t.Parallel()

	executedAt := time.Date(2026, 4, 20, 15, 4, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {basisTx("t-1", model.TransactionTypeBuy, "6", "163.11", model.CurrencyEUR, executedAt)},
		},
	}
	fx := &basisFXStub{
		historical: map[string]decimal.Decimal{
			"EUR/USD@2026-04-20": decimal.RequireFromString("1.10"),
			// The latest rate differs on purpose: it must not leak into the basis.
		},
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := &portfolioValuationService{uow: uow, fxRateService: fx}
	position := basisPosition("p-1", "a-1", "6")

	basis := svc.resolveCostBasis(context.Background(), position, model.CurrencyUSD)
	if basis == nil {
		t.Fatal("resolveCostBasis() = nil, want a reconstructed basis")
	}
	// 6 × €163.11 = €978.66 → 97,866 native cents.
	if basis.NativeTotal != 97_866 {
		t.Fatalf("NativeTotal = %d, want 97866", basis.NativeTotal)
	}
	// At the execution-date rate 1.10: 97,866 × 1.10 = 107,652.6 → 107,653.
	if basis.DisplayTotal != 107_653 {
		t.Fatalf("DisplayTotal = %d, want 107653", basis.DisplayTotal)
	}
	if basis.Currency != model.CurrencyEUR {
		t.Fatalf("Currency = %q, want EUR", basis.Currency)
	}
	if !basis.Converted {
		t.Fatal("Converted = false with an execution-date rate present, want true")
	}
}

func TestResolveCostBasis_MissingExecutionRateStaysUnconverted(t *testing.T) {
	t.Parallel()

	executedAt := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {basisTx("t-1", model.TransactionTypeBuy, "10", "50", model.CurrencyEUR, executedAt)},
		},
	}
	// Historical coverage starts later than the buy date: no rate for that
	// day. Existing rows must never be promoted into a historical basis.
	fx := &basisFXStub{
		historical: map[string]decimal.Decimal{
			"EUR/USD@2026-05-27": decimal.RequireFromString("1.13"),
		},
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := &portfolioValuationService{uow: uow, fxRateService: fx}
	position := basisPosition("p-1", "a-1", "10")

	basis := svc.resolveCostBasis(context.Background(), position, model.CurrencyUSD)
	if basis == nil {
		t.Fatal("resolveCostBasis() = nil")
	}
	if basis.NativeTotal != 50_000 {
		t.Fatalf("NativeTotal = %d, want 50000", basis.NativeTotal)
	}
	if basis.DisplayTotal != 0 {
		t.Fatalf("DisplayTotal = %d, want 0: no latest-rate fallback is allowed", basis.DisplayTotal)
	}
	if basis.Converted {
		t.Fatal("Converted = true without an execution-date rate, want false")
	}
	if basis.Currency != model.CurrencyEUR {
		t.Fatalf("Currency = %q, want EUR", basis.Currency)
	}
}

func TestResolveCostBasis_MixedCurrenciesStayUnlabeled(t *testing.T) {
	t.Parallel()

	first := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	second := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {
				// Same asset re-bought in USD after a EUR round: the remaining
				// basis spans two currencies.
				basisTx("t-1", model.TransactionTypeBuy, "1", "100", model.CurrencyUSD, first),
				basisTx("t-2", model.TransactionTypeBuy, "1", "100", model.CurrencyEUR, second),
			},
		},
	}
	fx := &basisFXStub{
		historical: map[string]decimal.Decimal{
			"EUR/USD@2026-06-01": decimal.RequireFromString("1.14"),
		},
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := &portfolioValuationService{uow: uow, fxRateService: fx}
	position := basisPosition("p-1", "a-1", "2")

	basis := svc.resolveCostBasis(context.Background(), position, model.CurrencyUSD)
	if basis == nil {
		t.Fatal("resolveCostBasis() = nil")
	}
	// $100 + €100 both count toward the native basis: 10,000 + 10,000 cents.
	if basis.NativeTotal != 20_000 {
		t.Fatalf("NativeTotal = %d, want 20000", basis.NativeTotal)
	}
	if basis.Currency != "" {
		t.Fatalf("Currency = %q, want empty for a mixed-currency basis", basis.Currency)
	}
	if basis.Converted {
		t.Fatal("Converted = true for a mixed-currency basis, want false")
	}
	if basis.DisplayTotal != 0 {
		t.Fatalf("DisplayTotal = %d, want 0 whenever the basis is not fully converted", basis.DisplayTotal)
	}
}

func TestResolveCostBasis_SellKeepsOriginalExecutionDate(t *testing.T) {
	t.Parallel()

	buy := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	sell := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {
				basisTx("t-1", model.TransactionTypeBuy, "10", "50", model.CurrencyEUR, buy),
				basisTx("t-2", model.TransactionTypeSell, "4", "55", model.CurrencyEUR, sell),
			},
		},
	}
	// Only the buy day has a rate. The remaining 6 units still belong to the
	// buy-day lot, so FIFO must carry the ORIGINAL execution date for the
	// reduced remainder instead of the sell date.
	fx := &basisFXStub{
		historical: map[string]decimal.Decimal{
			"EUR/USD@2026-04-20": decimal.RequireFromString("1.10"),
		},
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := &portfolioValuationService{uow: uow, fxRateService: fx}
	position := basisPosition("p-1", "a-1", "6")

	basis := svc.resolveCostBasis(context.Background(), position, model.CurrencyUSD)
	if basis == nil {
		t.Fatal("resolveCostBasis() = nil")
	}
	// 6 × €50 = €300 → 30,000 native cents → × 1.10 = 33,000 display cents.
	if basis.NativeTotal != 30_000 {
		t.Fatalf("NativeTotal = %d, want 30000", basis.NativeTotal)
	}
	if basis.DisplayTotal != 33_000 {
		t.Fatalf("DisplayTotal = %d, want 33000 at the buy-day rate", basis.DisplayTotal)
	}
	if !basis.Converted {
		t.Fatal("Converted = false, want true: the remaining lot kept its buy date")
	}
}

func TestCalculatePositionValue_LegacyBasisWithoutTransactions(t *testing.T) {
	t.Parallel()

	// A manually added holding: no transaction history, only the legacy
	// total. Same-currency basis is "converted" for free; a foreign legacy
	// basis must NOT be converted with today's rate.
	tests := []struct {
		name           string
		quoteCurrency  model.Currency
		totalCostBasis model.Money
		wantConverted  bool
		wantDisplay    model.Money
	}{
		{
			name:           "same-currency legacy basis converts for free",
			quoteCurrency:  model.CurrencyUSD,
			totalCostBasis: 100_000,
			wantConverted:  true,
			wantDisplay:    100_000,
		},
		{
			name:           "foreign legacy basis stays unconverted",
			quoteCurrency:  model.CurrencyEUR,
			totalCostBasis: 100_000,
			wantConverted:  false,
			wantDisplay:    0,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			uow := &basisUoWStub{
				transactions: nil,
				latestPrice:  map[string]decimal.Decimal{"a-1": mustDecimal(t, "200")},
			}
			fx := &basisFXStub{
				latest: map[string]decimal.Decimal{
					"EUR/USD": decimal.RequireFromString("1.1253"),
				},
			}
			svc := NewPortfolioValuationService(uow, fx)
			total := tc.totalCostBasis
			position := model.Position{
				ID:             "p-1",
				AssetID:        "a-1",
				Quantity:       mustDecimal(t, "1"),
				QuoteCurrency:  tc.quoteCurrency,
				TotalCostBasis: &total,
			}

			valuation, err := svc.CalculatePositionValue(context.Background(), position, model.CurrencyUSD)
			if err != nil {
				t.Fatalf("CalculatePositionValue() error = %v", err)
			}
			if valuation.CostBasisConverted != tc.wantConverted {
				t.Fatalf("CostBasisConverted = %v, want %v", valuation.CostBasisConverted, tc.wantConverted)
			}
			if valuation.CostBasisDisplay != tc.wantDisplay {
				t.Fatalf("CostBasisDisplay = %d, want %d", valuation.CostBasisDisplay, tc.wantDisplay)
			}
			if !valuation.HasDisplayValue {
				t.Fatal("HasDisplayValue = false, the value conversion must not fail")
			}
		})
	}
}

func TestCalculatePositionValue_LotsWithoutRatesMustNotFallBackToLegacy(t *testing.T) {
	t.Parallel()

	// The regression the legacy-fallback guard exists for: when the
	// transactions DO reconstruct lots but no execution-date rate exists, the
	// legacy total (recorded in the transaction's own currency) must not take
	// over: for GOOGL it is EUR-denominated while QuoteCurrency is USD, so a
	// naive quote==display fallback would relabel EUR cents as USD.
	executedAt := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {basisTx("t-1", model.TransactionTypeBuy, "6", "163.11", model.CurrencyEUR, executedAt)},
		},
		latestPrice: map[string]decimal.Decimal{"a-1": mustDecimal(t, "180")},
	}
	fx := &basisFXStub{
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := NewPortfolioValuationService(uow, fx)
	position := basisPosition("p-1", "a-1", "6")
	total := model.Money(97_866) // legacy EUR cents
	position.TotalCostBasis = &total

	valuation, err := svc.CalculatePositionValue(context.Background(), position, model.CurrencyUSD)
	if err != nil {
		t.Fatalf("CalculatePositionValue() error = %v", err)
	}
	if valuation.CostBasisConverted {
		t.Fatal("CostBasisConverted = true, an EUR legacy total must not be relabeled converted")
	}
	if valuation.CostBasisDisplay != 0 {
		t.Fatalf("CostBasisDisplay = %d, want 0", valuation.CostBasisDisplay)
	}
	if valuation.CostBasisNative != 97_866 {
		t.Fatalf("CostBasisNative = %d, want the lot total 97866", valuation.CostBasisNative)
	}
	if valuation.CostBasisCurrency != model.CurrencyEUR {
		t.Fatalf("CostBasisCurrency = %q, want the lot currency EUR", valuation.CostBasisCurrency)
	}
}

func TestCalculatePositionValue_ConvertedBasisFeedsFieldForClient(t *testing.T) {
	t.Parallel()

	executedAt := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {basisTx("t-1", model.TransactionTypeBuy, "6", "163.11", model.CurrencyEUR, executedAt)},
		},
		latestPrice: map[string]decimal.Decimal{"a-1": mustDecimal(t, "180")},
	}
	fx := &basisFXStub{
		historical: map[string]decimal.Decimal{
			"EUR/USD@2026-04-20": decimal.RequireFromString("1.10"),
		},
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := NewPortfolioValuationService(uow, fx)
	position := basisPosition("p-1", "a-1", "6")

	valuation, err := svc.CalculatePositionValue(context.Background(), position, model.CurrencyUSD)
	if err != nil {
		t.Fatalf("CalculatePositionValue() error = %v", err)
	}
	if !valuation.CostBasisConverted {
		t.Fatal("CostBasisConverted = false, want true")
	}
	if valuation.CostBasisDisplay != 107_653 {
		t.Fatalf("CostBasisDisplay = %d, want 107653", valuation.CostBasisDisplay)
	}
	// 6 × $180 = $1080 → 108,000 native cents, identity to display.
	if valuation.DisplayValue != 108_000 {
		t.Fatalf("DisplayValue = %d, want 108000", valuation.DisplayValue)
	}
}

func TestCalculatePortfolioValue_CoverageRequiresConvertedBasis(t *testing.T) {
	t.Parallel()

	// p-1: EUR lots with an execution-date rate (converted). p-2: EUR lots
	// without one (unconverted). Coverage must count only p-1, and p-2's
	// missing basis must not creep into the portfolio denominator.
	buy := time.Date(2026, 4, 20, 0, 0, 0, 0, time.UTC)
	uncoveredBuy := time.Date(2026, 4, 25, 0, 0, 0, 0, time.UTC)
	uow := &basisUoWStub{
		transactions: map[string][]model.Transaction{
			"p-1": {basisTx("t-1", model.TransactionTypeBuy, "6", "163.11", model.CurrencyEUR, buy)},
			"p-2": {basisTx("t-2", model.TransactionTypeBuy, "1", "100", model.CurrencyEUR, uncoveredBuy)},
		},
		latestPrice: map[string]decimal.Decimal{
			"a-1": mustDecimal(t, "180"),
			"a-2": mustDecimal(t, "4"),
		},
	}
	fx := &basisFXStub{
		historical: map[string]decimal.Decimal{
			"EUR/USD@2026-04-20": decimal.RequireFromString("1.10"),
		},
		latest: map[string]decimal.Decimal{
			"EUR/USD": decimal.RequireFromString("1.1253"),
		},
	}
	svc := NewPortfolioValuationService(uow, fx)
	positions := []model.Position{
		basisPosition("p-1", "a-1", "6"),
		basisPosition("p-2", "a-2", "1"),
	}

	portfolio, err := svc.CalculatePortfolioValue(context.Background(), positions, model.CurrencyUSD)
	if err != nil {
		t.Fatalf("CalculatePortfolioValue() error = %v", err)
	}
	// Value: 108,000 + 400 = 108,402... rounding: 6*180*100 = 108000, 1*4*100 = 400.
	if valuationByPosition := portfolio.PositionValuations; len(valuationByPosition) != 2 {
		t.Fatalf("len(PositionValuations) = %d, want 2", len(valuationByPosition))
	}
	first := portfolio.PositionValuations[0]
	second := portfolio.PositionValuations[1]
	if first.CostBasisConverted != true {
		t.Fatal("p-1 must be converted")
	}
	if second.CostBasisConverted != false {
		t.Fatal("p-2 must be unconverted")
	}
	if portfolio.TotalDisplayCostBasis != 107_653 {
		t.Fatalf("TotalDisplayCostBasis = %d, want only p-1's converted basis 107653", portfolio.TotalDisplayCostBasis)
	}
	// Coverage: 108000 / 108400 = 0.9963... above the 0.8 threshold, so a
	// percentage exists; it is measured against the covered basis only.
	if portfolio.TotalDisplayGainLossPct.LessThanOrEqual(decimal.Zero) {
		t.Fatalf("TotalDisplayGainLossPct = %s, want a positive covered-basis percentage", portfolio.TotalDisplayGainLossPct.String())
	}
	// gainLoss = 108400 − 107653 = 747 → 747/107653 × 100 = 0.6939...
	want := 0.6939
	if got := portfolio.TotalDisplayGainLossPct.InexactFloat64(); math.Abs(got-want) > 0.001 {
		t.Fatalf("TotalDisplayGainLossPct = %f, want ~%f", got, want)
	}
}

func TestCalculateGainLossPercent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                    string
		totalGainLoss           model.Money
		totalCostBasis          model.Money
		totalDisplayValue       model.Money
		costBasisCoveredDisplay model.Money
		want                    float64
	}{
		{
			name:                    "returns zero with missing cost basis",
			totalGainLoss:           100_00,
			totalCostBasis:          0,
			totalDisplayValue:       500_00,
			costBasisCoveredDisplay: 500_00,
			want:                    0,
		},
		{
			name:                    "returns zero when cost basis coverage is too low",
			totalGainLoss:           10_000_00,
			totalCostBasis:          20_00,
			totalDisplayValue:       29_852_29,
			costBasisCoveredDisplay: 5_000_00,
			want:                    0,
		},
		{
			name:                    "returns percentage when coverage is sufficient",
			totalGainLoss:           1_799_14,
			totalCostBasis:          8_753_15,
			totalDisplayValue:       10_552_29,
			costBasisCoveredDisplay: 10_552_29,
			want:                    20.5542,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := calculateGainLossPercent(tc.totalGainLoss, tc.totalCostBasis, tc.totalDisplayValue, tc.costBasisCoveredDisplay).InexactFloat64()
			if math.Abs(got-tc.want) > 0.001 {
				t.Fatalf("calculateGainLossPercent() = %f, want %f", got, tc.want)
			}
		})
	}
}
