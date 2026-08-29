import { describe, expect, it } from "vitest";
import { filterByRange, type PerformancePoint } from "../charts/PortfolioHeroChart";

describe("PortfolioHeroChart filterByRange", () => {
	it("returns empty array when data is empty", () => {
		expect(filterByRange([], "1D")).toEqual([]);
		expect(filterByRange([], "ALL")).toEqual([]);
	});

	it("returns all data points when range is ALL", () => {
		const points: PerformancePoint[] = [
			{ date: new Date("2024-01-01"), portfolioValue: 100, benchmarkValue: 100 },
			{ date: new Date("2024-06-01"), portfolioValue: 150, benchmarkValue: 120 },
		];
		expect(filterByRange(points, "ALL")).toEqual(points);
	});

	it("filters points within the 1M window when enough points exist", () => {
		const now = new Date();
		const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
		const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
		const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

		const points: PerformancePoint[] = [
			{ date: sixtyDaysAgo, portfolioValue: 100, benchmarkValue: 100 },
			{ date: twentyDaysAgo, portfolioValue: 120, benchmarkValue: 110 },
			{ date: tenDaysAgo, portfolioValue: 130, benchmarkValue: 115 },
			{ date: now, portfolioValue: 140, benchmarkValue: 120 },
		];

		const result = filterByRange(points, "1M");
		expect(result.length).toBe(3);
		expect(result[0].date.getTime()).toBe(twentyDaysAgo.getTime());
		expect(result[result.length - 1].date.getTime()).toBe(now.getTime());
	});

	it("clamps properly without leaking 1-year-old points on 1D range with sparse data", () => {
		const now = new Date();
		const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

		const points: PerformancePoint[] = [
			{ date: oneYearAgo, portfolioValue: 1000, benchmarkValue: 1000 },
			{ date: now, portfolioValue: 1500, benchmarkValue: 1300 },
		];

		const result = filterByRange(points, "1D");
		expect(result.length).toBe(2);
		// The first point date must be anchored to rangeStart (24h ago), not 1 year ago
		const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
		expect(result[0].date.getTime()).toBeCloseTo(twentyFourHoursAgo, -3); // within 1 second
		expect(result[0].portfolioValue).toBeCloseTo(1498.63, 0);
		expect(result[1].date.getTime()).toBe(now.getTime());
		expect(result[1].portfolioValue).toBe(1500);
	});

	it("creates a steady baseline when all data is older than range", () => {
		const now = new Date();
		const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);

		const points: PerformancePoint[] = [
			{ date: twoYearsAgo, portfolioValue: 500, benchmarkValue: 500 },
		];

		const result = filterByRange(points, "7D");
		expect(result.length).toBe(2);
		const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
		expect(result[0].date.getTime()).toBeCloseTo(sevenDaysAgo, -3);
		expect(result[0].portfolioValue).toBe(500);
		expect(result[1].date.getTime()).toBeCloseTo(now.getTime(), -3);
		expect(result[1].portfolioValue).toBe(500);
	});
});
