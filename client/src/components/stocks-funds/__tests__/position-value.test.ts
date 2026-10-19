import { describe, expect, it } from "vitest";
import { resolvePositionValue, sumPositionValues } from "../position-value";

describe("resolvePositionValue", () => {
	it("prefers a positive server value", () => {
		const result = resolvePositionValue(1750, 175, 10);
		expect(result.value).toBe(1750);
		expect(result.isServerValued).toBe(true);
		expect(result.isDerived).toBe(false);
		expect(result.isUnpriced).toBe(false);
	});

	it("derives from unit price when the server sends currentValue: 0", () => {
		// This is the regression: a freshly added position whose price fetch has
		// not landed reads 0. The header used to render $0 while the table
		// rendered the real value, because each had its own fallback rule.
		const result = resolvePositionValue(0, 50, 10);
		expect(result.value).toBe(500);
		expect(result.isServerValued).toBe(false);
		expect(result.isDerived).toBe(true);
	});

	it("derives when currentValue is missing entirely", () => {
		expect(resolvePositionValue(undefined, 50, 10).value).toBe(500);
		expect(resolvePositionValue(null, 50, 10).value).toBe(500);
	});

	it("derives when currentValue is negative", () => {
		expect(resolvePositionValue(-100, 50, 10).value).toBe(500);
	});

	it("reports unpriced when neither total nor price is usable", () => {
		for (const [value, price, qty] of [
			[0, 0, 10],
			[undefined, undefined, undefined],
			[0, 50, 0],
		] as const) {
			const result = resolvePositionValue(value, price, qty);
			expect(result.value).toBe(0);
			expect(result.isUnpriced).toBe(true);
		}
	});

	it("derives from price when the server total is NaN but a price exists", () => {
		const result = resolvePositionValue(Number.NaN, 50, 10);
		expect(result.value).toBe(500);
		expect(result.isDerived).toBe(true);
		expect(result.isUnpriced).toBe(false);
	});

	it("never returns NaN or Infinity", () => {
		const result = resolvePositionValue(Number.POSITIVE_INFINITY, Number.NaN, Number.NaN);
		expect(Number.isFinite(result.value)).toBe(true);
		expect(result.value).toBe(0);
	});

	it("does not treat a zero-quantity position as a real holding", () => {
		const result = resolvePositionValue(500, 50, 0);
		expect(result.value).toBe(500);
		expect(result.isServerValued).toBe(true);
	});
});

describe("sumPositionValues", () => {
	it("matches a per-position sum for mixed server and derived values", () => {
		const positions = [
			{ currentValue: 1750, currentPrice: 175, quantity: 10 },
			{ currentValue: 0, currentPrice: 50, quantity: 10 },
			{ currentValue: 1650, currentPrice: 330, quantity: 5 },
		];
		const expected = positions.reduce(
			(sum, p) => sum + resolvePositionValue(p.currentValue, p.currentPrice, p.quantity).value,
			0,
		);
		expect(sumPositionValues(positions)).toBe(expected);
		expect(sumPositionValues(positions)).toBe(3900);
	});

	it("returns 0 for an empty portfolio rather than NaN", () => {
		expect(sumPositionValues([])).toBe(0);
	});
});
