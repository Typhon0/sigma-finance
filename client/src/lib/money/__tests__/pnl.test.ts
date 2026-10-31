import { describe, expect, it } from "vitest";
import { computePortfolioPnl, computePositionPnl, MIN_COST_COVERAGE } from "@/lib/money/pnl";

describe("computePositionPnl", () => {
	it("computes the gain and return for a priced position", () => {
		const result = computePositionPnl(1500, 1000);
		expect(result.hasCostBasis).toBe(true);
		expect(result.pnl).toBe(500);
		expect(result.pnlPercent).toBe(50);
	});

	it("reports a loss as a negative gain", () => {
		const result = computePositionPnl(800, 1000);
		expect(result.pnl).toBe(-200);
		expect(result.pnlPercent).toBe(-20);
	});

	it("treats a zero cost basis as unknown, not as free money", () => {
		// The bug this module exists to prevent: value - 0 would report the
		// entire holding as profit.
		const result = computePositionPnl(4500, 0);
		expect(result.hasCostBasis).toBe(false);
		expect(result.pnl).toBeNull();
		expect(result.pnlPercent).toBeNull();
		expect(result.value).toBe(4500);
	});

	it("treats non-finite and negative inputs as unknown", () => {
		for (const cost of [Number.NaN, Number.POSITIVE_INFINITY, -100]) {
			const result = computePositionPnl(1000, cost);
			expect(result.hasCostBasis).toBe(false);
			expect(result.pnl).toBeNull();
		}
	});

	it("keeps a total loss measurable when the basis is known", () => {
		const result = computePositionPnl(0, 1000);
		expect(result.hasCostBasis).toBe(true);
		expect(result.pnl).toBe(-1000);
		expect(result.pnlPercent).toBe(-100);
	});

	it("sanitizes a non-finite value rather than returning NaN", () => {
		const result = computePositionPnl(Number.NaN, 1000);
		expect(result.value).toBe(0);
		expect(result.pnl).toBe(-1000);
	});
});

describe("computePortfolioPnl", () => {
	it("sums a fully priced portfolio", () => {
		const result = computePortfolioPnl([
			{ value: 1500, cost: 1000 },
			{ value: 500, cost: 600 },
		]);
		expect(result.totalValue).toBe(2000);
		expect(result.coveredCost).toBe(1600);
		expect(result.pnl).toBe(400);
		expect(result.isReliable).toBe(true);
		expect(result.coverageRatio).toBe(1);
		expect(result.missingCostBasisCount).toBe(0);
	});

	it("excludes an unpriced holding from the gain instead of inflating it", () => {
		// The regression: 2000 of value against 1000 of known cost looked like a
		// +1000 gain. The unpriced 1000 must not become profit.
		const result = computePortfolioPnl([
			{ value: 1000, cost: 1000 },
			{ value: 1000, cost: 0 },
		]);
		expect(result.totalValue).toBe(2000);
		expect(result.coveredValue).toBe(1000);
		expect(result.coveredCost).toBe(1000);
		expect(result.missingCostBasisCount).toBe(1);
		// Half the portfolio is unpriced, so no headline figure is defensible.
		expect(result.pnl).toBeNull();
		expect(result.isReliable).toBe(false);
	});

	it("withholds the total just below the coverage threshold", () => {
		const result = computePortfolioPnl([
			{ value: 940, cost: 900 },
			{ value: 60, cost: 0 },
		]);
		expect(result.coverageRatio).toBeCloseTo(0.94, 5);
		expect(result.coverageRatio).toBeLessThan(MIN_COST_COVERAGE);
		expect(result.pnl).toBeNull();
		expect(result.pnlPercent).toBeNull();
	});

	it("states the total once coverage clears the threshold", () => {
		const result = computePortfolioPnl([
			{ value: 960, cost: 900 },
			{ value: 40, cost: 0 },
		]);
		expect(result.coverageRatio).toBeCloseTo(0.96, 5);
		expect(result.isReliable).toBe(true);
		expect(result.pnl).toBe(60);
	});

	it("honours a caller-supplied coverage threshold", () => {
		const positions = [
			{ value: 500, cost: 400 },
			{ value: 500, cost: 0 },
		];
		expect(computePortfolioPnl(positions).isReliable).toBe(false);
		expect(computePortfolioPnl(positions, { minCoverage: 0.5 }).isReliable).toBe(true);
	});

	it("counts a known-basis total loss as covered", () => {
		const result = computePortfolioPnl([
			{ value: 1000, cost: 1000 },
			{ value: 0, cost: 500 },
		]);
		expect(result.coveredCost).toBe(1500);
		expect(result.coverageRatio).toBe(1);
		expect(result.pnl).toBe(-500);
		expect(result.missingCostBasisCount).toBe(0);
	});

	it("returns an unknowable result for an empty portfolio", () => {
		const result = computePortfolioPnl([]);
		expect(result.totalValue).toBe(0);
		expect(result.coverageRatio).toBe(0);
		expect(result.isReliable).toBe(false);
		expect(result.pnl).toBeNull();
	});

	it("ignores positions carrying neither value nor cost", () => {
		const result = computePortfolioPnl([
			{ value: 1000, cost: 800 },
			{ value: 0, cost: 0 },
		]);
		expect(result.coverageRatio).toBe(1);
		expect(result.pnl).toBe(200);
	});

	it("never returns NaN for partially loaded data", () => {
		const result = computePortfolioPnl([
			{ value: Number.NaN, cost: 100 },
			{ value: 200, cost: Number.POSITIVE_INFINITY },
			{ value: 300, cost: 250 },
		]);
		expect(Number.isFinite(result.totalValue)).toBe(true);
		expect(result.pnlPercent === null || Number.isFinite(result.pnlPercent)).toBe(true);
	});
});
