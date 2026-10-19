import { describe, expect, it } from "vitest";
import { type FxValuationLike, indexFxResolutions, resolveFxBasis } from "../fx-valuation";

function valuation(overrides: Partial<FxValuationLike> = {}): FxValuationLike {
	return {
		costBasisCurrency: "USD",
		// The server verdict: every remaining lot was display-currency already
		// or converted at its execution-date rate. Absent is not true, so the
		// default fixture must carry the flag explicitly.
		costBasisConverted: true,
		costBasisDisplay: 1000,
		costBasisNative: 1000,
		hasDisplayValue: true,
		isExcluded: false,
		exclusionReason: null,
		isStale: false,
		quoteCurrency: "USD",
		displayCurrency: "USD",
		fxAsOf: "2026-01-05T00:00:00Z",
		...overrides,
	};
}

describe("resolveFxBasis", () => {
	it("allows a percentage when the basis and the value share the display currency", () => {
		const result = resolveFxBasis(valuation());
		expect(result.basis).toBe("same-currency");
		expect(result.canShowPercentage).toBe(true);
	});

	it("suppresses the percentage when the basis stayed in its own currency", () => {
		// The strict policy has no latest-rate fallback: without the
		// execution-date rate the percentage is unknowable, and the reason
		// must name both currencies rather than claim the server "could not
		// convert" something it can value fine at today's rate.
		const result = resolveFxBasis(
			valuation({ costBasisCurrency: "EUR", quoteCurrency: "EUR", costBasisConverted: false }),
		);
		expect(result.basis).toBe("unconverted-basis");
		expect(result.canShowPercentage).toBe(false);
		expect(result.reason).toContain("EUR");
		expect(result.reason).toContain("USD");
		expect(result.reason).toContain("execution-date");
	});

	it("allows a converted basis with a converted-at-lot-dates verdict", () => {
		// The GOOGL case that used to print "% unavail" although the server
		// had converted the EUR basis: with the converted flag the percentage
		// is valid and the basis type drives the sums-based math.
		const result = resolveFxBasis(
			valuation({ costBasisCurrency: "EUR", quoteCurrency: "USD", costBasisConverted: true }),
		);
		expect(result.basis).toBe("converted-basis");
		expect(result.canShowPercentage).toBe(true);
		expect(result.reason).toContain("execution-date");
	});

	it("suppresses a foreign basis when the converted verdict is missing", () => {
		// Stale cache predating the field, or a server without it: absent is
		// not true. Suppress rather than assert.
		const result = resolveFxBasis(
			valuation({ costBasisCurrency: "EUR", quoteCurrency: "USD", costBasisConverted: undefined }),
		);
		expect(result.basis).toBe("unconverted-basis");
		expect(result.canShowPercentage).toBe(false);
	});

	it("suppresses a same-labeled basis without the converted verdict", () => {
		// A costBasisCurrency that matches the display currency but no
		// converted verdict: we were not told the basis can be expressed in
		// display currency, so no percentage.
		const result = resolveFxBasis(
			valuation({ costBasisCurrency: "USD", costBasisConverted: false }),
		);
		expect(result.basis).toBe("unknown");
		expect(result.canShowPercentage).toBe(false);
	});

	it("treats a missing valuation as unknown, not as same-currency", () => {
		// This is the regression the module exists to prevent. The old code
		// compared `asset.currency === asset.quoteCurrency`, both of which came
		// back undefined, so it produced a confident verdict from no data.
		const result = resolveFxBasis(null);
		expect(result.basis).toBe("unknown");
		expect(result.canShowPercentage).toBe(false);
		expect(result.reason).not.toBe("");
	});

	it("treats an excluded position as unknown even when currencies match", () => {
		const result = resolveFxBasis(
			valuation({ isExcluded: true, exclusionReason: "missing_market_price" }),
		);
		expect(result.basis).toBe("unknown");
		expect(result.canShowPercentage).toBe(false);
		expect(result.reason).toContain("missing market price");
	});

	it("suppresses the percentage when no display value was produced", () => {
		const result = resolveFxBasis(valuation({ hasDisplayValue: false }));
		expect(result.basis).toBe("unknown");
		expect(result.canShowPercentage).toBe(false);
	});

	it("suppresses the percentage when the basis currency is unknown", () => {
		// Same display and quote currency, but the server never reconstructed
		// the lots, so the basis currency is empty. Claiming "same currency"
		// here would be asserting something we were not told.
		const result = resolveFxBasis(valuation({ costBasisCurrency: "" }));
		expect(result.basis).toBe("unknown");
		expect(result.canShowPercentage).toBe(false);
	});

	it("keeps the percentage valid when the rate is stale but was not needed", () => {
		// Stale FX makes an approximation less precise, not wrong. When both
		// sides are already in the display currency no rate was applied at all,
		// so the number stands and the staleness surfaces as a badge.
		const result = resolveFxBasis(valuation({ isStale: true }));
		expect(result.canShowPercentage).toBe(true);
		expect(result.isStale).toBe(true);
	});

	it("keeps the percentage valid for a stale converted basis", () => {
		// Historical lot-date rates are immutable rows; a stale flag on one
		// still makes the basis approximate, not invalid. Badge, not hands.
		const result = resolveFxBasis(
			valuation({ costBasisCurrency: "EUR", quoteCurrency: "USD", isStale: true }),
		);
		expect(result.basis).toBe("converted-basis");
		expect(result.canShowPercentage).toBe(true);
		expect(result.isStale).toBe(true);
	});

	it("normalizes currency case before comparing", () => {
		const result = resolveFxBasis(valuation({ costBasisCurrency: "usd", displayCurrency: "USD" }));
		expect(result.canShowPercentage).toBe(true);
		expect(result.costBasisCurrency).toBe("USD");
	});

	it("normalizes currency case for the converted verdict", () => {
		const result = resolveFxBasis(
			valuation({ costBasisCurrency: "eur", displayCurrency: "USD", quoteCurrency: "USD" }),
		);
		expect(result.basis).toBe("converted-basis");
		expect(result.costBasisCurrency).toBe("EUR");
	});

	it("surfaces the observation date so the UI can explain a stale rate", () => {
		const result = resolveFxBasis(valuation());
		expect(result.fxAsOf).toBe("2026-01-05T00:00:00Z");
	});
});

describe("indexFxResolutions", () => {
	it("returns an empty index for missing or malformed input", () => {
		expect(indexFxResolutions(null).size).toBe(0);
		expect(indexFxResolutions(undefined).size).toBe(0);
		expect(indexFxResolutions([]).size).toBe(0);
	});

	it("keys verdicts by asset id", () => {
		const index = indexFxResolutions([
			{ ...valuation(), assetId: "asset-1" },
			{
				...valuation({ costBasisCurrency: "EUR", quoteCurrency: "EUR", costBasisConverted: false }),
				assetId: "asset-2",
			},
		]);
		expect(index.get("asset-1")?.canShowPercentage).toBe(true);
		expect(index.get("asset-2")?.canShowPercentage).toBe(false);
	});

	it("keeps the conservative verdict when one position of an asset is unconverted", () => {
		// The same asset can sit in two accounts, one bought in EUR and one in
		// USD. The provider aggregates them into a single row, so the row must
		// not claim a percentage it cannot support for all of its lots.
		const index = indexFxResolutions([
			{ ...valuation(), assetId: "asset-1" },
			{
				...valuation({ costBasisCurrency: "EUR", quoteCurrency: "EUR", costBasisConverted: false }),
				assetId: "asset-1",
			},
		]);
		expect(index.get("asset-1")?.canShowPercentage).toBe(false);
		expect(index.get("asset-1")?.basis).toBe("unconverted-basis");
	});

	it("sums the display figures across positions for a converted asset", () => {
		// Two accounts holding GOOGL, both EUR lots converted at their own
		// dates: the module row uses the summed value and basis for the
		// percentage, both straight from the server.
		const index = indexFxResolutions([
			{
				...valuation({
					costBasisCurrency: "EUR",
					quoteCurrency: "USD",
					displayValue: 1080,
					costBasisDisplay: 1000,
				}),
				assetId: "asset-1",
			},
			{
				...valuation({
					costBasisCurrency: "EUR",
					quoteCurrency: "USD",
					displayValue: 540,
					costBasisDisplay: 520,
				}),
				assetId: "asset-1",
			},
		]);
		const resolution = index.get("asset-1");
		expect(resolution?.canShowPercentage).toBe(true);
		expect(resolution?.basis).toBe("converted-basis");
		expect(resolution?.displayValue).toBe(1620);
		expect(resolution?.costBasisDisplay).toBe(1520);
	});

	it("does not publish sums under a suppressed verdict", () => {
		// One unconverted position forces the asset row's verdict down; the
		// sums must not be exposed under a banner that cannot justify them.
		const index = indexFxResolutions([
			{ ...valuation({ displayValue: 1080, costBasisDisplay: 1000 }), assetId: "asset-1" },
			{
				...valuation({ costBasisCurrency: "EUR", quoteCurrency: "EUR", costBasisConverted: false }),
				assetId: "asset-1",
			},
		]);
		const resolution = index.get("asset-1");
		expect(resolution?.canShowPercentage).toBe(false);
		expect(resolution?.displayValue).toBe(null);
		expect(resolution?.costBasisDisplay).toBe(null);
	});

	it("ignores valuations with no asset id", () => {
		const index = indexFxResolutions([{ ...valuation(), assetId: null }]);
		expect(index.size).toBe(0);
	});
});
