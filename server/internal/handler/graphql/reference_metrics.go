package graphql

import (
	"encoding/json"
	"sigma_finance/internal/domain/model"

	"github.com/shopspring/decimal"
)

// ReferenceMetrics are the instrument-level facts a holding inherits from the
// instrument it tracks: what it costs to own, and what it pays out.
//
// Every field is a percentage (0.03 means 3%) and every field is a pointer so
// that "the provider has not told us" survives to the client. That distinction
// is the whole point of this file.
//
// The client used to resolve the expense ratio from a hardcoded symbol table:
//
//	var KNOWN_ETF_TER = map[string]float64{"VOO": 0.03, "QQQ": 0.2, ...}
//
// with a name-substring fallback ("vanguard" -> 0.05, "active" -> 0.65) and a
// final guess of 0.15 for anything unrecognised. Those numbers were then
// weighted by position value and rendered as an annual fee in currency, so a
// user budgeting from the Fees card was budgeting from a guess. A fund whose
// real TER is 1.8% read as 0.15% - a twelve-fold error in the user's favour,
// which is worse than an error against them because nobody audits it.
//
// A missing value must therefore stay missing. Substituting a plausible
// average is how the number got invented in the first place.
type ReferenceMetrics struct {
	// Annual total expense ratio, as a percentage.
	ExpenseRatio *float64
	// Annual dividend yield, as a percentage.
	DividendYield *float64
	// Price/earnings ratio. Not a percentage.
	PERatio *float64
}

// decimalPercentToFloat converts a nullable DECIMAL column to a nullable
// float, rejecting values that cannot be a real percentage.
//
// Note on Float64's second return value: it reports whether the value is
// *exactly* representable as a binary float, which is false for essentially
// every decimal. Treating it as an error condition silently discarded every
// real expense ratio (0.03 included) and turned the whole feature into a
// permanent null. The column is DECIMAL(8,6), so the conversion is exact
// enough for a percentage the user reads to two decimals.
func decimalPercentToFloat(value *decimal.Decimal) *float64 {
	if value == nil {
		return nil
	}
	float, _ := value.Float64()
	if float < 0 {
		return nil
	}
	return &float
}

// resolveReferenceMetrics merges the canonical instrument record with the
// per-asset metadata blob.
//
// The instrument is authoritative: TER and yield describe the security, not
// the user's copy of it, so two users holding the same ETF must see the same
// number. The asset metadata is a fallback for holdings created before the
// instrument was linked, or by a provider that only ever wrote the blob.
//
// `instrument` may be nil - a manual holding has no instrument - in which case
// only the metadata path is available, and only if it actually holds the
// field.
func resolveReferenceMetrics(asset model.Asset, instrument *model.Instrument) ReferenceMetrics {
	metrics := ReferenceMetrics{}

	if instrument != nil {
		metrics.ExpenseRatio = decimalPercentToFloat(instrument.ExpenseRatio)
		metrics.DividendYield = decimalPercentToFloat(instrument.DividendYield)
	}

	if len(asset.Metadata) == 0 {
		return metrics
	}

	// StockMetadata carries pe_ratio and dividend_yield; FundMetadata carries
	// neither today. Decoding both against the same blob is safe because the
	// keys are disjoint, and it keeps the fallback in one place.
	var stockMetadata model.StockMetadata
	if err := json.Unmarshal(asset.Metadata, &stockMetadata); err == nil {
		if metrics.DividendYield == nil {
			metrics.DividendYield = sanitizedFloat(stockMetadata.DividendYield)
		}
		if metrics.PERatio == nil {
			metrics.PERatio = sanitizedFloat(stockMetadata.PERatio)
		}
	}

	var fundMetadata model.FundMetadata
	if err := json.Unmarshal(asset.Metadata, &fundMetadata); err == nil {
		if metrics.ExpenseRatio == nil {
			metrics.ExpenseRatio = sanitizedFloat(fundMetadata.ExpenseRatio)
		}
		if metrics.DividendYield == nil {
			metrics.DividendYield = sanitizedFloat(fundMetadata.DividendYield)
		}
	}

	return metrics
}

// instrumentFor looks up the instrument an asset tracks, if the batch loader
// resolved one. Returns nil for manual holdings, which is the signal that only
// the asset metadata blob is available.
func instrumentFor(asset model.Asset, instruments map[string]model.Instrument) *model.Instrument {
	if asset.InstrumentID == nil || *asset.InstrumentID == "" {
		return nil
	}
	instrument, ok := instruments[*asset.InstrumentID]
	if !ok {
		return nil
	}
	return &instrument
}

// sanitizedFloat drops values that are not usable as a displayed metric.
func sanitizedFloat(value *float64) *float64 {
	if value == nil {
		return nil
	}
	// Asset.ValidateMetadata already rejects a dividend yield above 100%, but
	// the blob can be written by paths that skip validation, and a yield of
	// 150% or a negative P/E would be displayed as fact.
	if *value < 0 || *value > 100 {
		return nil
	}
	return value
}
