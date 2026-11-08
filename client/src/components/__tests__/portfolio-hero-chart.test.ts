import { describe, expect, it } from "vitest";
import { filterByRange, type PerformancePoint } from "../charts/PortfolioHeroChart";
import {
	buildHistoryDate,
	hasSufficientBackendData,
	resolveHybridPerformanceSeries,
} from "../charts/performance-series";

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

	it("computes distinct delta endpoints for 1M vs ALL time ranges", () => {
		const now = new Date();
		const tenYearsAgo = new Date(now.getTime() - 3650 * 24 * 60 * 60 * 1000);
		const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

		const points: PerformancePoint[] = [
			{ date: tenYearsAgo, portfolioValue: 37.85, benchmarkValue: 37.85 },
			{ date: twentyDaysAgo, portfolioValue: 9000, benchmarkValue: 9000 },
			{ date: now, portfolioValue: 9200, benchmarkValue: 9200 },
		];

		const oneMonthPoints = filterByRange(points, "1M");
		const allPoints = filterByRange(points, "ALL");

		// 1M should start around the 1-month window (~9000), not 10 years ago ($37.85)
		expect(oneMonthPoints[0].portfolioValue).toBeGreaterThan(8000);
		const oneMonthDelta =
			oneMonthPoints[oneMonthPoints.length - 1].portfolioValue - oneMonthPoints[0].portfolioValue;
		expect(oneMonthDelta).toBeLessThan(1000);

		// ALL spans the entire history
		expect(allPoints[0].portfolioValue).toBe(37.85);
		const allDelta = allPoints[allPoints.length - 1].portfolioValue - allPoints[0].portfolioValue;
		expect(allDelta).toBeCloseTo(9162.15, 2);
	});
});

describe("performance-series buildHistoryDate", () => {
	it("spreads YTD points from Jan 1 of current year to now", () => {
		const now = new Date("2026-11-02T12:00:00Z");
		const points = 50;

		const firstDate = buildHistoryDate(now, "YTD", points, 0);
		const lastDate = buildHistoryDate(now, "YTD", points, points - 1);

		expect(firstDate.getFullYear()).toBe(2026);
		expect(firstDate.getMonth()).toBe(0); // January
		expect(firstDate.getDate()).toBe(1); // 1st
		expect(lastDate.getTime()).toBe(now.getTime());
	});

	it("spreads 1Y points from one year ago to now", () => {
		const now = new Date("2026-11-02T12:00:00Z");
		const points = 52;

		const firstDate = buildHistoryDate(now, "1Y", points, 0);
		const lastDate = buildHistoryDate(now, "1Y", points, points - 1);

		expect(firstDate.getFullYear()).toBe(2025);
		expect(firstDate.getMonth()).toBe(10); // November
		expect(lastDate.getTime()).toBe(now.getTime());
	});
});

describe("resolveHybridPerformanceSeries timeframe sufficiency", () => {
	it("detects insufficient backend data when backend points only span 1 day for 1M/YTD/1Y/ALL", () => {
		const points: PerformancePoint[] = [
			{
				date: new Date("2026-11-01T00:00:00Z"),
				portfolioValue: 37033.96,
				benchmarkValue: 37033.96,
			},
			{
				date: new Date("2026-11-02T00:00:00Z"),
				portfolioValue: 37033.96,
				benchmarkValue: 37033.96,
			},
		];

		expect(hasSufficientBackendData(points, "1D")).toBe(false);
		expect(hasSufficientBackendData(points, "7D")).toBe(false);
		expect(hasSufficientBackendData(points, "1M")).toBe(false);
		expect(hasSufficientBackendData(points, "3M")).toBe(false);
		expect(hasSufficientBackendData(points, "YTD")).toBe(false);
		expect(hasSufficientBackendData(points, "1Y")).toBe(false);
		expect(hasSufficientBackendData(points, "ALL")).toBe(false);
	});

	it("falls back to synthesized series when backend data is sparse/flat 2-point series for YTD", () => {
		const now = new Date("2026-11-02T12:00:00Z");
		const sparseBackend: PerformancePoint[] = [
			{
				date: new Date("2026-11-01T00:00:00Z"),
				portfolioValue: 37033.96,
				benchmarkValue: 37033.96,
			},
			{
				date: new Date("2026-11-02T00:00:00Z"),
				portfolioValue: 37033.96,
				benchmarkValue: 37033.96,
			},
		];

		const holdings = [
			{ value: 20000, currentPrice: 150, changePercent: 1.5 },
			{ value: 17033.96, currentPrice: 300, changePercent: -0.8 },
		];

		const result = resolveHybridPerformanceSeries({
			backendSeries: sparseBackend,
			holdings,
			totalValue: 37033.96,
			timeRange: "YTD",
			now,
		});

		// Synthesized YTD points count is 50, not 2!
		expect(result.length).toBe(50);
		// Dates must span back to Jan 1, 2026
		expect(result[0].date.getFullYear()).toBe(2026);
		expect(result[0].date.getMonth()).toBe(0);
		// Values must not be a flat line
		const hasVariance = result.some(
			(p) => Math.abs(p.portfolioValue - result[0].portfolioValue) > 0.01,
		);
		expect(hasVariance).toBe(true);
	});

	it("preserves backend series when backend data has sufficient history", () => {
		const now = new Date("2026-11-02T12:00:00Z");
		// 100 daily points spanning ~100 days
		const robustBackend: PerformancePoint[] = Array.from({ length: 100 }, (_, i) => ({
			date: new Date(now.getTime() - (99 - i) * 24 * 60 * 60 * 1000),
			portfolioValue: 30000 + i * 50,
			benchmarkValue: 30000 + i * 40,
		}));

		const result = resolveHybridPerformanceSeries({
			backendSeries: robustBackend,
			holdings: [{ value: 35000, currentPrice: 100, changePercent: 1.0 }],
			totalValue: 35000,
			timeRange: "1M",
			now,
		});

		// Should retain backend points (not synthesized 30 points)
		expect(result.length).toBeGreaterThanOrEqual(100);
		expect(result[0].portfolioValue).toBe(30000);
	});
});
