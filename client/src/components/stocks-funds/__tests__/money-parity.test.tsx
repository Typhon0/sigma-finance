import { describe, expect, it } from "vitest";
import type { RawAsset } from "@/components/assets/stocks-funds/StocksFundsModule";
import { normalizeStockAssets } from "@/components/assets/stocks-funds/StocksFundsModule";
import { resolveFxBasis } from "../fx-valuation";
import { resolvePositionValue, sumPositionValues } from "../position-value";

/**
 * The module header, the distribution donut, every weight percentage, and the
 * holdings table footer each render a portfolio total. They previously derived
 * it independently, and disagreed whenever a position had `currentValue: 0`
 * (a real state: the position exists but its price fetch has not landed).
 *
 * The module fell back to price x qty only for null/undefined/NaN, so it
 * rendered $0. The table fell back for any non-positive value and rendered the
 * real amount. Same portfolio, two different numbers on one screen.
 *
 * These tests pin the invariant: one resolver, one basis.
 */
function moduleTotal(assets: RawAsset[]): number {
	return normalizeStockAssets(assets, "portfolio-1").reduce(
		(sum, asset) => sum + asset.totalValue,
		0,
	);
}

function tableTotal(assets: RawAsset[]): number {
	return sumPositionValues(assets.filter((a) => a.type === "stock" || a.type === "fund"));
}

const DIVERGENCE_FIXTURE: RawAsset[] = [
	{
		id: "a-1",
		type: "stock",
		name: "Apple Inc.",
		symbol: "AAPL",
		quantity: 10,
		purchasePrice: 150,
		currentPrice: 175,
		currentValue: 1750,
		currency: "USD",
	},
	{
		id: "a-2",
		type: "stock",
		name: "Just Added",
		symbol: "NEWCO",
		// Price fetch has not landed. This is the case that used to diverge.
		quantity: 10,
		purchasePrice: 40,
		currentPrice: 50,
		currentValue: 0,
		currency: "USD",
	},
];

describe("module and table agree on portfolio value", () => {
	it("matches for the currentValue: 0 fixture that used to diverge", () => {
		expect(moduleTotal(DIVERGENCE_FIXTURE)).toBe(2250);
		expect(tableTotal(DIVERGENCE_FIXTURE)).toBe(2250);
		expect(moduleTotal(DIVERGENCE_FIXTURE)).toBe(tableTotal(DIVERGENCE_FIXTURE));
	});

	it.each([
		["missing currentValue", { currentPrice: 50, quantity: 10 }],
		["null currentValue", { currentPrice: 50, quantity: 10, currentValue: null }],
		["negative currentValue", { currentPrice: 50, quantity: 10, currentValue: -20 }],
		["zero quantity", { currentPrice: 50, quantity: 0, currentValue: 0 }],
		["zero price", { currentPrice: 0, quantity: 10, currentValue: 0 }],
	])("matches when the position has %s", (_label, override) => {
		const assets: RawAsset[] = [
			{
				id: "base",
				type: "stock",
				name: "Base",
				symbol: "BASE",
				quantity: 2,
				currentPrice: 100,
				currentValue: 200,
				currency: "USD",
			},
			{ id: "edge", type: "stock", name: "Edge", symbol: "EDGE", ...override } as RawAsset,
		];
		expect(moduleTotal(assets)).toBe(tableTotal(assets));
	});

	it("matches across mixed asset types and currencies", () => {
		const assets: RawAsset[] = [
			{
				id: "1",
				type: "stock",
				name: "A",
				symbol: "A",
				quantity: 3,
				currentPrice: 10,
				currentValue: 30,
				currency: "USD",
			},
			{
				id: "2",
				type: "fund",
				name: "B",
				symbol: "B",
				quantity: 1,
				currentPrice: 90,
				currentValue: 0,
				currency: "USD",
			},
			{
				id: "3",
				type: "stock",
				name: "C",
				symbol: "C",
				quantity: 5,
				currentPrice: 20,
				currentValue: 100,
				currency: "EUR",
			},
			// Excluded: not a stock or fund.
			{
				id: "4",
				type: "crypto",
				name: "D",
				symbol: "D",
				quantity: 9,
				currentPrice: 7,
				currentValue: 63,
				currency: "USD",
			},
		];
		expect(moduleTotal(assets)).toBe(220);
		expect(tableTotal(assets)).toBe(220);
	});

	it("keeps weights summing to 100% on the module's own basis", () => {
		const normalized = normalizeStockAssets(DIVERGENCE_FIXTURE, "portfolio-1");
		const total = normalized.reduce((sum, a) => sum + a.totalValue, 0);
		const weightSum = normalized.reduce((sum, a) => sum + a.portfolioWeight, 0);
		expect(weightSum).toBeCloseTo(100, 1);
		expect(total).toBe(2250);
	});
});

describe("FX positions report native cost basis", () => {
	// The client no longer decides whether a percentage is computable by
	// comparing `asset.currency` to `asset.quoteCurrency`: `currency` was never
	// selected by any query, so that comparison was always false in the module
	// and always true in the table. The verdict now comes from the server's
	// PositionValuation. These fixtures are shaped like what it returns.
	const euroValuation = {
		costBasisCurrency: "EUR",
		costBasisDisplay: 1000,
		costBasisNative: 1000,
		hasDisplayValue: true,
		isExcluded: false,
		isStale: false,
		quoteCurrency: "EUR",
		displayCurrency: "USD",
		fxAsOf: "2026-01-05T00:00:00Z",
	};

	const EUR_POSITION: RawAsset = {
		id: "eur-1",
		type: "stock",
		name: "ASML Holding",
		symbol: "ASML",
		quantity: 10,
		// Bought at EUR 100 when EUR/USD was 1.05; now EUR 120 at 1.09.
		purchasePrice: 100,
		currentPrice: 120,
		// Server converts the value into portfolio currency: 120 * 1.09 * 10.
		currentValue: 1308,
		currency: "EUR",
		quoteCurrency: "USD",
		fx: resolveFxBasis(euroValuation),
	};

	it("does not apply today's FX rate to a historical cost basis", () => {
		const [asset] = normalizeStockAssets([EUR_POSITION], "portfolio-1");
		// The old fxMultiplier (1308 / 1200) would have produced 109.
		expect(asset.avgCost).toBe(100);
		expect(asset.totalValue).toBe(1308);
	});

	it("suppresses the percentage when the server could not convert the basis", () => {
		const [asset] = normalizeStockAssets([EUR_POSITION], "portfolio-1");
		expect(asset.fx.basis).toBe("unconverted-basis");
		expect(asset.fx.canShowPercentage).toBe(false);
		expect(asset.totalReturnPercentage).toBe(0);
	});

	it("shows the percentage when the server converted the basis", () => {
		const [asset] = normalizeStockAssets(
			[
				{
					...EUR_POSITION,
					fx: resolveFxBasis({
						...euroValuation,
						costBasisConverted: true,
						costBasisCurrency: "USD",
						costBasisDisplay: 1050,
					}),
				},
			],
			"portfolio-1",
		);
		expect(asset.fx.canShowPercentage).toBe(true);
		expect(asset.totalReturnPercentage).not.toBe(0);
	});

	it("does not infer a verdict from currencies when the server sent none", () => {
		// No PositionValuation at all: the honest answer is "unknown", not
		// "same currency because nothing contradicted it".
		const [asset] = normalizeStockAssets(
			[{ ...EUR_POSITION, fx: undefined, currency: "USD", quoteCurrency: "USD" }],
			"portfolio-1",
		);
		expect(asset.fx.basis).toBe("unknown");
		expect(asset.fx.canShowPercentage).toBe(false);
		expect(asset.totalReturnPercentage).toBe(0);
	});
});

describe("resolvePositionValue is the shared basis", () => {
	it("backs the module total", () => {
		const perPosition = DIVERGENCE_FIXTURE.reduce(
			(sum, a) => sum + resolvePositionValue(a.currentValue, a.currentPrice, a.quantity).value,
			0,
		);
		expect(moduleTotal(DIVERGENCE_FIXTURE)).toBe(perPosition);
	});
});

describe("weights are apportioned, not independently rounded", () => {
	// A three-way split of equal value is the canonical case where naive
	// `(value / total) * 100` rounding lands on 33.33 + 33.33 + 33.33 = 99.99,
	// so the weight column visibly disagrees with the 100% the donut implies.
	const THREE_WAY: RawAsset[] = [
		{
			id: "w-1",
			type: "stock",
			name: "One",
			symbol: "ONE",
			quantity: 1,
			currentValue: 1000,
			currency: "USD",
		},
		{
			id: "w-2",
			type: "stock",
			name: "Two",
			symbol: "TWO",
			quantity: 1,
			currentValue: 1000,
			currency: "USD",
		},
		{
			id: "w-3",
			type: "fund",
			name: "Three",
			symbol: "THR",
			quantity: 1,
			currentValue: 1000,
			currency: "USD",
		},
	];

	it("sums to exactly 100", () => {
		const weights = normalizeStockAssets(THREE_WAY, "portfolio-1").map(
			(a) => a.portfolioWeight ?? 0,
		);
		expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(100, 10);
	});

	it("stays within a hundredth of the exact share", () => {
		const weights = normalizeStockAssets(THREE_WAY, "portfolio-1").map(
			(a) => a.portfolioWeight ?? 0,
		);
		for (const weight of weights) {
			expect(Math.abs(weight - 100 / 3)).toBeLessThanOrEqual(0.01);
		}
	});

	it("sums to exactly 100 for a deliberately awkward split", () => {
		const awkward: RawAsset[] = [
			{
				id: "x-1",
				type: "stock",
				name: "Big",
				symbol: "BIG",
				quantity: 1,
				currentValue: 33333.33,
				currency: "USD",
			},
			{
				id: "x-2",
				type: "stock",
				name: "Mid",
				symbol: "MID",
				quantity: 1,
				currentValue: 33333.33,
				currency: "USD",
			},
			{
				id: "x-3",
				type: "fund",
				name: "Small",
				symbol: "SML",
				quantity: 1,
				currentValue: 1,
				currency: "USD",
			},
		];
		const weights = normalizeStockAssets(awkward, "portfolio-1").map((a) => a.portfolioWeight ?? 0);
		expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(100, 10);
	});

	it("yields all-zero weights rather than NaN for an empty portfolio", () => {
		const weights = normalizeStockAssets([], "portfolio-1").map((a) => a.portfolioWeight ?? 0);
		expect(weights).toEqual([]);
	});
});
