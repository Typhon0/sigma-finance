/**
 * Single source of truth for "may this position show a percentage return?".
 *
 * ## Why this module exists
 *
 * Two components used to answer that question with a local comparison:
 *
 * ```ts
 * // StocksFundsModule.normalizeStockAssets
 * const isFxConverted = asset.currency === (asset.quoteCurrency ?? "USD");
 * // StocksFundsPositions
 * const isFxConverted = (asset.currency || "USD") === "USD";
 * ```
 *
 * They disagreed, and both were wrong, because `asset.currency` was never
 * populated by any query: the `Asset` GraphQL interface has no `currency`
 * field, and `GET_DASHBOARD_CRITICAL` selects neither `currency` nor
 * `quoteCurrency`. So the module read `undefined === "USD"` -> false and
 * suppressed every percentage return in the header, while the table read
 * `"USD" === "USD"` -> true and printed a percentage computed against an
 * unconverted cost basis. One of the two was a visible lie no matter which
 * portfolio you opened.
 *
 * The fix is not to make the client compare currencies better. The client
 * never had the data to answer the question. The server does: the valuation
 * service tracks `CostBasisCurrency`, `CostBasisConverted`, `HasDisplayValue`
 * and `IsExcluded` per position, and those are published on
 * `PositionValuation`. This module reads them.
 *
 * ## The rule
 *
 * A percentage return needs value and cost basis expressed in the same
 * currency. The strict policy server-side converts each remaining lot of the
 * cost basis at the FX rate that prevailed on the lot's own execution date
 * - there is no latest-rate fallback, because applying today's rate to a
 * historical basis folds currency movement into unrealized P&L. When the
 * conversion could not be completed, the position valuation carries
 * `costBasisConverted: false` and the percentage is genuinely unknowable -
 * so we suppress it rather than print a number that looks authoritative.
 *
 * A stale FX rate does not make the percentage wrong, only approximate, so it
 * produces a badge rather than a suppressed number.
 */

/** The subset of `PositionValuation` this module needs. */
export interface FxValuationLike {
	costBasisCurrency: string;
	/**
	 * Server verdict: every remaining lot was either already in the display
	 * currency or converted at its own execution-date rate. Optional so stale
	 * clients that predate the field still suppress (absent is not true).
	 */
	costBasisConverted?: boolean;
	costBasisDisplay: number;
	costBasisNative: number;
	/**Display-currency value of the position; optional so legacy fixtures and
	 * cached GraphQL responses without the field still type-check. The sums
	 * aggregation skips non-finite values. */
	displayValue?: number | null;
	hasDisplayValue: boolean;
	isExcluded: boolean;
	exclusionReason?: string | null;
	isStale: boolean;
	quoteCurrency: string;
	displayCurrency: string;
	fxAsOf?: string | null;
}

export type FxBasis =
	/** Basis lots are in the display currency already: percentage is valid. */
	| "same-currency"
	/** Basis lots were converted at their execution-date rates: percentage is valid. */
	| "converted-basis"
	/** Basis could not be expressed in the display currency: no percentage. */
	| "unconverted-basis"
	/** No valuation for this position, or it was excluded: we do not know. */
	| "unknown";

export interface FxResolution {
	/** True only when a percentage return may be shown to the user. */
	canShowPercentage: boolean;
	basis: FxBasis;
	/** True when the server flagged the FX rate as stale. Drives the badge. */
	isStale: boolean;
	/** Currency the position's cost basis is denominated in, when known. */
	costBasisCurrency: string | null;
	/** Currency the position is valued in, when known. */
	quoteCurrency: string | null;
	/** When the FX rate was observed, as an ISO string. */
	fxAsOf: string | null;
	/** Why a percentage is unavailable. Suitable as a tooltip. */
	reason: string;
	/**
	 * Display-currency value of the asset, summed over its positions. Set
	 * only when a percentage may be shown, and only then is it safe to run
	 * the converted-basis return math against it.
	 */
	displayValue: number | null;
	/**
	 * Display-currency cost basis of the asset, summed over its positions.
	 * Same publication rule as `displayValue`.
	 */
	costBasisDisplay: number | null;
}

const UNKNOWN_BASIS: Omit<FxResolution, "reason"> = {
	canShowPercentage: false,
	basis: "unknown",
	isStale: false,
	costBasisCurrency: null,
	quoteCurrency: null,
	fxAsOf: null,
	displayValue: null,
	costBasisDisplay: null,
};

const UNKNOWN = UNKNOWN_BASIS;

function normalized(currency: string | null | undefined): string | null {
	const trimmed = currency?.trim();
	return trimmed ? trimmed.toUpperCase() : null;
}

/**
 * Decide whether a position may display a percentage return.
 *
 * Never throws: a missing or malformed valuation yields `basis: "unknown"`,
 * which suppresses the percentage. A user is better served by "% n/a" than by
 * a figure the system cannot stand behind.
 */
export function resolveFxBasis(valuation: FxValuationLike | null | undefined): FxResolution {
	if (!valuation) {
		return {
			...UNKNOWN,
			reason:
				"No FX valuation was returned for this position, so its cost basis cannot be compared to its value.",
		};
	}

	const quoteCurrency = normalized(valuation.quoteCurrency);
	const displayCurrency = normalized(valuation.displayCurrency);
	const costBasisCurrency = normalized(valuation.costBasisCurrency);
	const fxAsOf = valuation.fxAsOf ?? null;
	const isStale = valuation.isStale === true;

	if (valuation.isExcluded) {
		const why = valuation.exclusionReason?.replace(/_/g, " ") ?? "unknown reason";
		return {
			...UNKNOWN,
			isStale,
			costBasisCurrency,
			quoteCurrency,
			fxAsOf,
			reason: `The server could not value this position (${why}), so no return can be computed.`,
		};
	}

	if (!valuation.hasDisplayValue) {
		return {
			...UNKNOWN,
			isStale,
			costBasisCurrency,
			quoteCurrency,
			fxAsOf,
			reason:
				"The server has no display-currency value for this position yet, so no return can be computed.",
		};
	}

	// The cost basis currency is the one that decides. When it is missing
	// entirely the server never reconstructed the lots, so we cannot claim the
	// basis matches even if the position is quoted in the display currency.
	if (!costBasisCurrency) {
		return {
			...UNKNOWN,
			isStale,
			quoteCurrency,
			fxAsOf,
			reason:
				"The cost basis currency for this position is unknown, so its return percentage cannot be derived.",
		};
	}

	// The server's converted verdict decides. Comparing currency labels would
	// re-introduce the old lie: a basis recorded in EUR that WAS converted at
	// its lot dates must not be suppressed, and a same-named label without a
	// conversion verdict must not be trusted. Absent (pre-deploy cache) is
	// treated as not converted: suppress rather than assert.
	if (valuation.costBasisConverted !== true) {
		// Foreign basis without a verdict is a concrete, explainable gap: the
		// execution-date rate is missing. A same-named basis without a verdict
		// is a deeper unknown - we were not told the conversion happened at
		// all - so it keeps the generic "unknown" basis.
		if (costBasisCurrency !== displayCurrency) {
			return {
				...UNKNOWN,
				basis: "unconverted-basis",
				isStale,
				costBasisCurrency,
				quoteCurrency,
				fxAsOf,
				reason: `Cost basis is recorded in ${costBasisCurrency}; the execution-date FX rate needed to express it in ${displayCurrency ?? "the display currency"} is not available, so the return percentage is unavailable.`,
			};
		}
		return {
			...UNKNOWN,
			isStale,
			costBasisCurrency,
			quoteCurrency,
			fxAsOf,
			reason: `The server has not confirmed the ${costBasisCurrency} cost basis can be expressed in ${displayCurrency ?? "the display currency"}, so the return percentage is unavailable.`,
		};
	}

	if (displayCurrency && costBasisCurrency === displayCurrency) {
		return {
			canShowPercentage: true,
			basis: "same-currency",
			isStale,
			costBasisCurrency,
			quoteCurrency,
			fxAsOf,
			displayValue: null,
			costBasisDisplay: null,
			reason: isStale
				? "Cost basis and value are both in the display currency, so the return is valid; the FX rate is stale but was not needed."
				: "Cost basis and value are both in the display currency.",
		};
	}

	return {
		canShowPercentage: true,
		basis: "converted-basis",
		isStale,
		costBasisCurrency,
		quoteCurrency,
		fxAsOf,
		displayValue: null,
		costBasisDisplay: null,
		reason: `Cost basis was converted from ${costBasisCurrency} to ${displayCurrency ?? "the display currency"} at each lot's execution-date rate.`,
	};
}

/**
 * Index FX verdicts by asset id.
 *
 * An asset can hold several positions in one portfolio (one per account), and
 * the server keys valuations by `positionId`. For the percentage decision all
 * positions of the same asset share a cost-basis currency, so keying by
 * `assetId` is sufficient and is what the existing `buildPortfolioAssets`
 * aggregation already assumes. When positions disagree we keep the most
 * conservative answer: any unconverted basis suppresses the percentage.
 *
 * The display figures are aggregated as sums over the asset's positions so a
 * converted-basis percentage can be computed on the merged row: value minus
 * basis in the same currency, both straight from the server. Positions whose
 * valuation did not convert contribute nothing to the sums, but they already
 * forced a suppressed verdict through the conservative replacement, so the
 * sums are only ever exposed under a verdict that justifies them.
 */
export function indexFxResolutions(
	valuations: ReadonlyArray<FxValuationLike & { assetId?: string | null }> | null | undefined,
): Map<string, FxResolution> {
	const index = new Map<string, FxResolution>();
	if (!Array.isArray(valuations)) return index;

	interface Sums {
		displayValue: number;
		costBasisDisplay: number;
	}
	const sumsByAsset = new Map<string, Sums>();

	for (const valuation of valuations) {
		const assetId = valuation?.assetId;
		if (!assetId) continue;
		const resolution = resolveFxBasis(valuation);

		const sums = sumsByAsset.get(assetId) ?? { displayValue: 0, costBasisDisplay: 0 };
		if (Number.isFinite(valuation.displayValue)) {
			sums.displayValue += valuation.displayValue ?? 0;
		}
		if (Number.isFinite(valuation.costBasisDisplay)) {
			sums.costBasisDisplay += valuation.costBasisDisplay ?? 0;
		}
		sumsByAsset.set(assetId, sums);

		const existing = index.get(assetId);
		if (!existing) {
			index.set(assetId, resolution);
		} else if (existing.canShowPercentage && !resolution.canShowPercentage) {
			// The row must not claim a percentage it cannot support for all of
			// its lots: one suppressed position suppresses the asset row.
			index.set(assetId, resolution);
		}
	}

	for (const [assetId, resolution] of index.entries()) {
		if (resolution.canShowPercentage) {
			const sums = sumsByAsset.get(assetId);
			if (sums) {
				resolution.displayValue = sums.displayValue;
				resolution.costBasisDisplay = sums.costBasisDisplay;
			}
		}
	}
	return index;
}
