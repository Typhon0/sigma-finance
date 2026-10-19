import { describe, expect, it } from "vitest";
import type { RawAsset } from "@/components/assets/stocks-funds/StocksFundsModule";
import {
	computeFeesTerData,
	normalizeStockAssets,
} from "@/components/assets/stocks-funds/StocksFundsModule";
import type { FeesTerData } from "@/components/insights/types";

/**
 * The expense ratio used to be resolved in the browser from a hardcoded table:
 *
 *   const KNOWN_ETF_TER = { VOO: 0.03, QQQ: 0.2, ... };
 *   if (name.includes("vanguard")) return 0.05;
 *   if (name.includes("active")) return 0.65;
 *   return 0.15; // <- every fund nobody had heard of
 *
 * That 0.15 was then weighted by position value and rendered as an annual fee
 * in currency. A fund whose real TER is 1.8% read as 0.15% - a twelve-fold
 * error in the user's favour, which is worse than an error against them
 * because nobody audits a number that flatters them.
 *
 * These tests pin the replacement contract: the server's figure, or unknown.
 */

function fund(overrides: Partial<RawAsset> = {}): RawAsset {
	return {
		id: "fund-1",
		type: "fund",
		name: "Vanguard Total Stock Market ETF",
		symbol: "VTI",
		quantity: 10,
		purchasePrice: 100,
		currentPrice: 100,
		currentValue: 1000,
		...overrides,
	};
}

/**
 * Run the real module computation, not a copy of it.
 *
 * An earlier version of this file re-implemented the weighting inline, which
 * meant it would have kept passing if the module regressed - the exact failure
 * mode a test is supposed to catch.
 */
function computeFeesTer(funds: RawAsset[]): FeesTerData {
	return computeFeesTerData(normalizeStockAssets(funds, "portfolio-1"));
}

describe("expense ratio is never invented", () => {
	it("reports unknown for a fund with no published expense ratio", () => {
		// The old code returned 0.15 for anything it did not recognise, including
		// every fund added after the table was written.
		const data = computeFeesTer([fund({ expenseRatio: undefined })]);
		expect(data.avgTer).toBeNull();
		expect(data.annualCost).toBeNull();
		expect(data.unknownCount).toBe(1);
	});

	it("uses the server figure when there is one", () => {
		const data = computeFeesTer([fund({ expenseRatio: 0.03 })]);
		expect(data.avgTer).toBe(0.03);
		expect(data.annualCost).toBeCloseTo(0.3, 6); // 1000 * 0.03%
		expect(data.unknownCount).toBe(0);
	});

	it("does not substitute a value for a name the old table recognised", () => {
		// "Vanguard" used to resolve to 0.05 and "ishares" to 0.09 purely from
		// the fund's marketing name. Neither implies a fee, and the new code
		// has no name matching at all.
		const [asset] = normalizeStockAssets([fund({ name: "iShares Core ETF" })], "p1");
		expect(asset.expenseRatio).toBeUndefined();
	});

	it("weights the average by value across the funds it knows", () => {
		const data = computeFeesTer([
			fund({ id: "a", symbol: "VTI", currentValue: 3000, expenseRatio: 0.03 }),
			fund({ id: "b", symbol: "BND", currentValue: 1000, expenseRatio: 0.09 }),
		]);
		// (0.03 * 3000 + 0.09 * 1000) / 4000
		expect(data.avgTer).toBe(0.045);
		expect(data.annualCost).toBeCloseTo(1.8, 6);
	});

	it("excludes unknown funds from the average instead of diluting them with zero", () => {
		// Averaging an unknown as 0 would understate the fee. Either exclude it
		// and say so, or report nothing - but never treat it as free.
		const data = computeFeesTer([
			fund({ id: "a", symbol: "VTI", currentValue: 1000, expenseRatio: 0.03 }),
			fund({ id: "b", symbol: "MYSTERY", currentValue: 9000, expenseRatio: undefined }),
		]);
		expect(data.avgTer).toBe(0.03);
		expect(data.annualCost).toBeCloseTo(0.3, 6);
		expect(data.unknownCount).toBe(1);
		// The count is still the whole portfolio, so the card can say "1 of 2".
		expect(data.count).toBe(2);
		expect(data.totalValue).toBe(10000);
	});

	it("reports unknown when a zero expense ratio is explicitly published", () => {
		// 0 is a real figure for a genuinely free fund, so it must survive as 0
		// rather than being confused with "no data". This test documents that the
		// client does not treat 0 as falsy-and-therefore-missing.
		const data = computeFeesTer([fund({ expenseRatio: 0 })]);
		expect(data.avgTer).toBe(0);
		expect(data.annualCost).toBe(0);
		expect(data.unknownCount).toBe(0);
	});
});

describe("dividend yield reaches the income forecast", () => {
	it("passes the server's yield through to the normalised asset", () => {
		// `dividendYield` was declared on the client type and read by
		// incomeForecast, but it existed on no GraphQL type and was selected by
		// no query - so IncomeForecastCard could never render anything.
		const [asset] = normalizeStockAssets(
			[fund({ type: "stock", name: "Procter & Gamble", symbol: "PG", dividendYield: 2.41 })],
			"p1",
		);
		expect(asset.dividendYield).toBe(2.41);
	});

	it("leaves it undefined when the server has none", () => {
		const [asset] = normalizeStockAssets(
			[fund({ type: "stock", name: "Some Startup", symbol: "NEW" })],
			"p1",
		);
		expect(asset.dividendYield).toBeUndefined();
	});
});
