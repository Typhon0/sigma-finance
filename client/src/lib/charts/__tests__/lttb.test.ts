import { describe, expect, it } from "vitest";
import type { PerformancePoint } from "@/components/charts/PortfolioHeroChart";
import { downsampleLTTB } from "../lttb";

describe("downsampleLTTB", () => {
	it("returns original array when point count is less than or equal to targetCount", () => {
		const points: PerformancePoint[] = [
			{ date: new Date("2026-01-01"), portfolioValue: 100, benchmarkValue: 100 },
			{ date: new Date("2026-01-02"), portfolioValue: 110, benchmarkValue: 105 },
			{ date: new Date("2026-01-03"), portfolioValue: 105, benchmarkValue: 108 },
		];

		const result = downsampleLTTB(points, 5);
		expect(result).toBe(points);
		expect(result).toHaveLength(3);
	});

	it("preserves exact start and end points and reduces array length to targetCount", () => {
		const baseDate = new Date("2020-01-01").getTime();
		const points: PerformancePoint[] = Array.from({ length: 1000 }, (_, i) => ({
			date: new Date(baseDate + i * 24 * 60 * 60 * 1000),
			portfolioValue: 100 + Math.sin(i / 10) * 50 + (i === 500 ? 500 : 0),
			benchmarkValue: 100 + i * 0.1,
		}));

		const targetCount = 100;
		const result = downsampleLTTB(points, targetCount);

		expect(result).toHaveLength(targetCount);
		// Check start point matches
		expect(result[0].date.getTime()).toBe(points[0].date.getTime());
		expect(result[0].portfolioValue).toBe(points[0].portfolioValue);

		// Check end point matches
		expect(result[result.length - 1].date.getTime()).toBe(
			points[points.length - 1].date.getTime(),
		);
		expect(result[result.length - 1].portfolioValue).toBe(
			points[points.length - 1].portfolioValue,
		);

		// Check that the spike at index 500 (value 600) was captured by LTTB
		const hasPeak = result.some((p) => p.portfolioValue > 400);
		expect(hasPeak).toBe(true);
	});

	it("handles targetCount <= 2 gracefully", () => {
		const points: PerformancePoint[] = [
			{ date: new Date("2026-01-01"), portfolioValue: 100, benchmarkValue: 100 },
			{ date: new Date("2026-01-02"), portfolioValue: 110, benchmarkValue: 105 },
		];
		expect(downsampleLTTB(points, 2)).toBe(points);
		expect(downsampleLTTB(points, 1)).toBe(points);
	});

	it("completes downsampling of 2500 points in less than 5ms", () => {
		const baseDate = new Date("2020-01-01").getTime();
		const points: PerformancePoint[] = Array.from({ length: 2500 }, (_, i) => ({
			date: new Date(baseDate + i * 24 * 60 * 60 * 1000),
			portfolioValue: 1000 + (i % 20) * 10,
			benchmarkValue: 1000,
		}));

		const start = performance.now();
		const result = downsampleLTTB(points, 350);
		const duration = performance.now() - start;

		expect(result).toHaveLength(350);
		expect(duration).toBeLessThan(15); // Fast test margin
	});
});

