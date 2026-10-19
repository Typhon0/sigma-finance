import { describe, expect, it } from "vitest";
import {
	allocateAmount,
	allocatePercentages,
	fromMinorUnits,
	minorUnitScale,
	sumMoney,
	toMinorUnits,
} from "@/lib/money/rounding";

describe("minor units", () => {
	it("round-trips major and minor units", () => {
		expect(toMinorUnits(12.34)).toBe(1234);
		expect(fromMinorUnits(1234)).toBe(12.34);
	});

	it("rounds half up, as finance UIs expect", () => {
		expect(toMinorUnits(0.005)).toBe(1);
		expect(toMinorUnits(1.005)).toBe(101);
		expect(toMinorUnits(2.675)).toBe(268);
	});

	it("treats non-finite input as zero rather than propagating NaN", () => {
		expect(toMinorUnits(Number.NaN)).toBe(0);
		expect(toMinorUnits(Number.POSITIVE_INFINITY)).toBe(0);
		expect(fromMinorUnits(Number.NaN)).toBe(0);
	});

	it("honours the requested precision", () => {
		expect(toMinorUnits(1.2345, 3)).toBe(1235);
		expect(fromMinorUnits(12345, 3)).toBe(12.345);
		expect(minorUnitScale(3)).toBe(1000);
	});

	it("falls back to cents for a nonsensical precision", () => {
		expect(minorUnitScale(-1)).toBe(100);
		expect(minorUnitScale(1.5)).toBe(100);
	});
});

describe("sumMoney", () => {
	it("avoids the float drift that plain summation introduces", () => {
		// 0.1 + 0.2 !== 0.3 in IEEE-754.
		expect(0.1 + 0.2).not.toBe(0.3);
		expect(sumMoney([0.1, 0.2])).toBe(0.3);
	});

	it("matches plain summation for values that happen to be exact", () => {
		expect(sumMoney([10, 20.5, 30.25])).toBe(60.75);
	});

	it("ignores non-finite entries", () => {
		expect(sumMoney([10, Number.NaN, 5])).toBe(15);
	});

	it("returns zero for an empty list", () => {
		expect(sumMoney([])).toBe(0);
	});
});

describe("allocatePercentages", () => {
	it("sums to exactly 100 for an awkward three-way split", () => {
		const result = allocatePercentages([1 / 3, 1 / 3, 1 / 3]);
		expect(result).toEqual([33.34, 33.33, 33.33]);
		expect(result.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 10);
	});

	it("stays within one ulp of the exact value for each entry", () => {
		const values = [0.1, 0.2, 0.35, 0.05, 0.3];
		const total = values.reduce((sum, value) => sum + value, 0);
		const result = allocatePercentages(values);

		result.forEach((percent, index) => {
			const exact = (values[index] / total) * 100;
			expect(Math.abs(percent - exact)).toBeLessThanOrEqual(0.01);
		});
	});

	it("sums to exactly 100 for a six-way split that naive rounding breaks", () => {
		const values = [33333.33, 33333.33, 33333.33, 1, 1, 1];
		const result = allocatePercentages(values);
		const naive = values.map((v) => {
			const total = values.reduce((sum, x) => sum + x, 0);
			return Number(((v / total) * 100).toFixed(2));
		});

		expect(naive.reduce((sum, p) => sum + p, 0)).not.toBe(100);
		expect(result.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 10);
	});

	it("is deterministic for identical inputs", () => {
		const values = [7, 7, 7, 7];
		expect(allocatePercentages(values)).toEqual(allocatePercentages(values));
	});

	it("breaks ties by index so equal inputs get equal shares", () => {
		expect(allocatePercentages([5, 5, 5, 5])).toEqual([25, 25, 25, 25]);
	});

	it("returns zeros when there is nothing to apportion", () => {
		expect(allocatePercentages([])).toEqual([]);
		expect(allocatePercentages([0, 0, 0])).toEqual([0, 0, 0]);
		expect(allocatePercentages([100])).toEqual([100]);
	});

	it("never returns NaN for partially loaded data", () => {
		const result = allocatePercentages([Number.NaN, 50, Number.POSITIVE_INFINITY, 50]);
		expect(result.every((p) => Number.isFinite(p))).toBe(true);
		expect(result.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 10);
	});

	it("respects the requested precision", () => {
		const result = allocatePercentages([1 / 3, 1 / 3, 1 / 3], 0);
		expect(result).toEqual([34, 33, 33]);
		expect(result.reduce((sum, p) => sum + p, 0)).toBe(100);
	});
});

describe("allocateAmount", () => {
	it("splits a total without losing or inventing minor units", () => {
		const parts = allocateAmount([1, 1, 1], 10);
		expect(parts.reduce((sum, p) => sum + p, 0)).toBeCloseTo(10, 10);
	});

	it("splits an indivisible total across more parts than cents", () => {
		const parts = allocateAmount([1, 1, 1], 0.01);
		expect(parts.reduce((sum, p) => sum + p, 0)).toBeCloseTo(0.01, 10);
		// Only one part can hold the single cent.
		expect(parts.filter((p) => p === 0.01)).toHaveLength(1);
	});

	it("returns zeros for a non-positive total", () => {
		expect(allocateAmount([1, 2], 0)).toEqual([0, 0]);
		expect(allocateAmount([1, 2], Number.NaN)).toEqual([0, 0]);
	});

	it("handles an empty input", () => {
		expect(allocateAmount([], 100)).toEqual([]);
	});
});
