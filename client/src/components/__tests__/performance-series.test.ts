import { describe, expect, it } from "vitest";
import {
	buildMarketSynthesizedSeries,
	computeFallbackSparkline,
	getHistoryPointCount,
	resampleSeries,
	resolveHybridPerformanceSeries,
} from "../charts/performance-series";

describe("performance-series", () => {
	const fixedNow = new Date("2026-10-26T12:00:00Z");

	describe("getHistoryPointCount", () => {
		it("returns correct point count for each time range", () => {
			expect(getHistoryPointCount("1D")).toBe(24);
			expect(getHistoryPointCount("7D")).toBe(7);
			expect(getHistoryPointCount("1M")).toBe(30);
			expect(getHistoryPointCount("3M")).toBe(45);
			expect(getHistoryPointCount("YTD")).toBe(50);
			expect(getHistoryPointCount("1Y")).toBe(52);
			expect(getHistoryPointCount("ALL")).toBe(104);
		});
	});

	describe("resampleSeries", () => {
		it("handles empty and single-element inputs", () => {
			expect(resampleSeries([], 5)).toEqual([1, 1, 1, 1, 1]);
			expect(resampleSeries([42], 3)).toEqual([42, 42, 42]);
		});

		it("resamples correctly to larger target point count", () => {
			const resampled = resampleSeries([10, 20], 3);
			expect(resampled).toHaveLength(3);
			expect(resampled[0]).toBe(10);
			expect(resampled[1]).toBe(15);
			expect(resampled[2]).toBe(20);
		});
	});

	describe("computeFallbackSparkline", () => {
		it("computes realistic 7-point sparkline ending at current price", () => {
			const sparkline = computeFallbackSparkline(100, 5);
			expect(sparkline).toHaveLength(7);
			expect(sparkline[sparkline.length - 1]).toBe(100);
			expect(sparkline[0]).toBeCloseTo(100 / 1.05, 1);
		});

		it("handles zero or invalid prices", () => {
			expect(computeFallbackSparkline(0, 5)).toEqual([0, 0, 0, 0, 0, 0, 0]);
			expect(computeFallbackSparkline(-10, 5)).toEqual([0, 0, 0, 0, 0, 0, 0]);
		});
	});

	describe("buildMarketSynthesizedSeries", () => {
		const sampleHoldings = [
			{
				value: 6000,
				currentPrice: 150,
				changePercent: 3.5,
				sparklineData: [145, 147, 146, 148, 149, 149.5, 150],
			},
			{
				value: 4000,
				currentPrice: 50,
				changePercent: -1.2,
				sparklineData: [51, 50.8, 50.5, 50.2, 50.1, 49.8, 50],
			},
		];

		it("synthesizes accurate curve with points matching timeRange count", () => {
			const series1D = buildMarketSynthesizedSeries({
				holdings: sampleHoldings,
				totalValue: 10000,
				timeRange: "1D",
				now: fixedNow,
			});
			expect(series1D).toHaveLength(24);
			expect(series1D[series1D.length - 1].portfolioValue).toBe(10000);
			expect(series1D[series1D.length - 1].date.getTime()).toBe(fixedNow.getTime());

			const series7D = buildMarketSynthesizedSeries({
				holdings: sampleHoldings,
				totalValue: 10000,
				timeRange: "7D",
				now: fixedNow,
			});
			expect(series7D).toHaveLength(7);
			expect(series7D[series7D.length - 1].portfolioValue).toBe(10000);
		});

		it("handles empty holdings by returning flat series anchored to totalValue", () => {
			const series = buildMarketSynthesizedSeries({
				holdings: [],
				totalValue: 5000,
				timeRange: "7D",
				now: fixedNow,
			});
			expect(series).toHaveLength(7);
			expect(series.every((p) => p.portfolioValue === 5000)).toBe(true);
		});
	});

	describe("resolveHybridPerformanceSeries", () => {
		const backendPoints = [
			{ date: new Date("2026-10-01"), portfolioValue: 9000, benchmarkValue: 9000 },
			{ date: new Date("2026-10-15"), portfolioValue: 9500, benchmarkValue: 9500 },
			{ date: new Date("2026-10-25"), portfolioValue: 9800, benchmarkValue: 9800 },
		];

		const holdings = [
			{
				value: 10000,
				currentPrice: 100,
				changePercent: 2,
				sparklineData: [98, 99, 99.5, 100],
			},
		];

		it("uses backend points for multi-day range when data is sufficient", () => {
			const resolved = resolveHybridPerformanceSeries({
				backendSeries: backendPoints,
				holdings,
				totalValue: 10000,
				timeRange: "1M",
				now: fixedNow,
			});

			// Contains backend points and connects cleanly to now at totalValue
			expect(resolved.length).toBeGreaterThanOrEqual(backendPoints.length);
			expect(resolved[resolved.length - 1].portfolioValue).toBe(10000);
			expect(resolved[resolved.length - 1].date.getTime()).toBe(fixedNow.getTime());
		});

		it("synthesizes market curve for 1D range even if backend has daily points", () => {
			const resolved = resolveHybridPerformanceSeries({
				backendSeries: backendPoints,
				holdings,
				totalValue: 10000,
				timeRange: "1D",
				now: fixedNow,
			});

			// Returns 24-point intraday curve instead of 2 daily points
			expect(resolved).toHaveLength(24);
			expect(resolved[resolved.length - 1].portfolioValue).toBe(10000);
		});

		it("falls back to market curve when backend has < 2 points", () => {
			const singlePoint = [
				{ date: new Date("2026-10-26"), portfolioValue: 10000, benchmarkValue: 10000 },
			];

			const resolved = resolveHybridPerformanceSeries({
				backendSeries: singlePoint,
				holdings,
				totalValue: 10000,
				timeRange: "7D",
				now: fixedNow,
			});

			expect(resolved).toHaveLength(7);
			expect(resolved[resolved.length - 1].portfolioValue).toBe(10000);
		});
	});
});
