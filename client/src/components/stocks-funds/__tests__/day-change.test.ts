import { describe, expect, it } from "vitest";
import { computeDayChangeAmount, previousCloseFromDayChange } from "../day-change";

describe("computeDayChangeAmount", () => {
	it("derives the delta from the previous close, not the current value", () => {
		// $110 position up 10% means the previous close was $100, so the
		// position moved $10. The old `value * rate` returned $11.
		expect(computeDayChangeAmount(110, 10)).toBeCloseTo(10, 6);
	});

	it("is negative on a down day", () => {
		// $90 position down 10% means the previous close was $100.
		expect(computeDayChangeAmount(90, -10)).toBeCloseTo(-10, 6);
	});

	it("returns 0 for a flat day", () => {
		expect(computeDayChangeAmount(500, 0)).toBe(0);
	});

	it("handles a total loss without dividing by zero", () => {
		expect(computeDayChangeAmount(0, -100)).toBe(0);
		expect(computeDayChangeAmount(500, -100)).toBe(0);
	});

	it("understates nothing: gains and losses are symmetric", () => {
		// Up 50% from 100 to 150, then down 33.33% from 150 to 100.
		expect(computeDayChangeAmount(150, 50)).toBeCloseTo(50, 6);
		expect(computeDayChangeAmount(100, -100 / 3)).toBeCloseTo(-50, 6);
	});

	it("returns 0 for non-finite inputs", () => {
		expect(computeDayChangeAmount(Number.NaN, 5)).toBe(0);
		expect(computeDayChangeAmount(100, Number.NaN)).toBe(0);
		expect(computeDayChangeAmount(Number.POSITIVE_INFINITY, 5)).toBe(0);
	});
});

describe("previousCloseFromDayChange", () => {
	it("back-solves the previous close from a current price", () => {
		expect(previousCloseFromDayChange(110, 10)).toBeCloseTo(100, 6);
		expect(previousCloseFromDayChange(90, -10)).toBeCloseTo(100, 6);
	});

	it("returns the current price when the rate is unusable", () => {
		expect(previousCloseFromDayChange(75, -100)).toBe(75);
		expect(previousCloseFromDayChange(75, Number.NaN)).toBe(75);
	});

	it("round-trips with computeDayChangeAmount", () => {
		const close = 137.42;
		const rate = 2.5;
		const current = close * (1 + rate / 100);
		const prev = previousCloseFromDayChange(current, rate);
		expect(prev).toBeCloseTo(close, 6);
		expect(computeDayChangeAmount(current, rate)).toBeCloseTo(close * (rate / 100), 6);
	});
});
