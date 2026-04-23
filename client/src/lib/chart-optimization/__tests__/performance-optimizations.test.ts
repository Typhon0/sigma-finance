/**
 * Tests for performance optimization utilities
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	averageSampling,
	DataSampler,
	lttbSampling,
	minMaxSampling,
	uniformSampling,
} from "../data-sampling";
import { ChartVirtualizer } from "../virtualization";

// Mock data generator
function generateMockData(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		timestamp: Date.now() - (count - i) * 60000, // 1 minute intervals
		value: 100 + Math.sin(i / 10) * 20 + Math.random() * 10,
		volume: Math.random() * 1000000,
	}));
}

describe("Data Sampling", () => {
	let mockData: ReturnType<typeof generateMockData>;

	beforeEach(() => {
		mockData = generateMockData(10000);
	});

	describe("LTTB Sampling", () => {
		it("should reduce data points to target count", () => {
			const targetPoints = 1000;
			const sampled = lttbSampling(mockData, targetPoints);

			expect(sampled).toHaveLength(targetPoints);
		});

		it("should preserve first and last points", () => {
			const sampled = lttbSampling(mockData, 100);

			expect(sampled[0]).toEqual(mockData[0]);
			expect(sampled[sampled.length - 1]).toEqual(mockData[mockData.length - 1]);
		});

		it("should handle edge cases", () => {
			expect(lttbSampling([], 100)).toEqual([]);
			expect(lttbSampling(mockData.slice(0, 50), 100)).toEqual(mockData.slice(0, 50));
			expect(lttbSampling(mockData, 2)).toHaveLength(2);
		});
	});

	describe("Average Sampling", () => {
		it("should create averaged data points", () => {
			const sampled = averageSampling(mockData, 100);

			expect(sampled).toHaveLength(100);
			expect(sampled[0].value).toBeTypeOf("number");
		});

		it("should preserve volume data when present", () => {
			const sampled = averageSampling(mockData, 100);

			expect(sampled[0].volume).toBeDefined();
			expect(sampled[0].volume).toBeTypeOf("number");
		});
	});

	describe("Min-Max Sampling", () => {
		it("should preserve extremes in each bucket", () => {
			const sampled = minMaxSampling(mockData, 200);

			expect(sampled.length).toBeLessThanOrEqual(200);

			// Check that we have both high and low values
			const values = sampled.map((d) => d.value);
			const originalValues = mockData.map((d) => d.value);

			expect(Math.max(...values)).toBeCloseTo(Math.max(...originalValues), 1);
			expect(Math.min(...values)).toBeCloseTo(Math.min(...originalValues), 1);
		});
	});

	describe("Uniform Sampling", () => {
		it("should take evenly spaced points", () => {
			const sampled = uniformSampling(mockData, 100);

			expect(sampled).toHaveLength(100);

			// Check that timestamps are evenly distributed
			const timeSpan = sampled[sampled.length - 1].timestamp - sampled[0].timestamp;
			const expectedInterval = timeSpan / (sampled.length - 1);

			for (let i = 1; i < sampled.length - 1; i++) {
				const actualInterval = sampled[i].timestamp - sampled[i - 1].timestamp;
				expect(Math.abs(actualInterval - expectedInterval)).toBeLessThan(expectedInterval * 0.2);
			}
		});
	});

	describe("DataSampler", () => {
		let sampler: DataSampler;

		beforeEach(() => {
			sampler = new DataSampler({
				maxPoints: 1000,
				algorithm: "lttb",
			});
		});

		it("should cache sampling results", () => {
			const data = mockData.slice(0, 5000);

			const result1 = sampler.sample(data);
			const result2 = sampler.sample(data);

			expect(result1).toBe(result2); // Should be same reference due to caching
		});

		it("should handle different algorithms", () => {
			const data = mockData.slice(0, 2000);

			const lttbResult = sampler.sample(data, { algorithm: "lttb" });
			const avgResult = sampler.sample(data, { algorithm: "average" });

			expect(lttbResult).toHaveLength(1000);
			expect(avgResult).toHaveLength(1000);
			expect(lttbResult).not.toEqual(avgResult);
		});

		it("should provide cache statistics", () => {
			const stats = sampler.getCacheStats();

			expect(stats).toHaveProperty("size");
			expect(stats).toHaveProperty("maxSize");
			expect(stats).toHaveProperty("hitRate");
		});
	});
});

describe("Chart Virtualization", () => {
	let virtualizer: ChartVirtualizer;
	let mockDataLoader: vi.MockedFunction<(start: number, end: number) => Promise<any[]>>;

	beforeEach(() => {
		mockDataLoader = vi.fn().mockImplementation(async (start: number, end: number) => {
			return generateMockData(end - start);
		});

		virtualizer = new ChartVirtualizer(
			10000, // total data points
			1000, // chunk size
			2, // preload chunks
			mockDataLoader,
		);
	});

	it("should load visible data chunks", async () => {
		const viewport = {
			startTime: Date.now() - 60 * 60 * 1000, // 1 hour ago
			endTime: Date.now(),
			pixelWidth: 800,
			dataPointsPerPixel: 1,
		};

		const data = await virtualizer.updateVisibleRange(viewport);

		expect(data).toBeDefined();
		expect(Array.isArray(data)).toBe(true);
		expect(mockDataLoader).toHaveBeenCalled();
	});

	it("should preload adjacent chunks", async () => {
		const viewport = {
			startTime: Date.now() - 30 * 60 * 1000, // 30 minutes ago
			endTime: Date.now(),
			pixelWidth: 800,
			dataPointsPerPixel: 1,
		};

		await virtualizer.updateVisibleRange(viewport);

		// Should have called loader multiple times for preloading
		expect(mockDataLoader.mock.calls.length).toBeGreaterThan(1);
	});

	it("should provide cache statistics", () => {
		const stats = virtualizer.getCacheStats();

		expect(stats).toHaveProperty("totalChunks");
		expect(stats).toHaveProperty("loadedChunks");
		expect(stats).toHaveProperty("loadingChunks");
		expect(stats).toHaveProperty("memoryUsage");
	});

	it("should handle cache cleanup", () => {
		virtualizer.clearCache();

		const stats = virtualizer.getCacheStats();
		expect(stats.totalChunks).toBe(0);
	});
});

describe("Performance Benchmarks", () => {
	it("should sample large datasets efficiently", () => {
		const largeDataset = generateMockData(100000);

		const startTime = performance.now();
		const sampled = lttbSampling(largeDataset, 1000);
		const endTime = performance.now();

		const processingTime = endTime - startTime;

		expect(sampled).toHaveLength(1000);
		expect(processingTime).toBeLessThan(100); // Should complete in under 100ms
	});

	it("should handle multiple sampling operations efficiently", () => {
		const dataset = generateMockData(50000);
		const sampler = new DataSampler({
			maxPoints: 1000,
			algorithm: "lttb",
		});

		const startTime = performance.now();

		// Perform multiple sampling operations
		for (let i = 0; i < 10; i++) {
			sampler.sample(dataset);
		}

		const endTime = performance.now();
		const totalTime = endTime - startTime;

		// Should benefit from caching after first operation
		expect(totalTime).toBeLessThan(200);
	});

	it("should virtualize large datasets without memory issues", async () => {
		const mockLoader = vi.fn().mockImplementation(async (start: number, end: number) => {
			return generateMockData(Math.min(end - start, 1000));
		});

		const virtualizer = new ChartVirtualizer(1000000, 1000, 2, mockLoader);

		// Simulate multiple viewport updates
		for (let i = 0; i < 10; i++) {
			const viewport = {
				startTime: Date.now() - (i + 1) * 60 * 60 * 1000,
				endTime: Date.now() - i * 60 * 60 * 1000,
				pixelWidth: 800,
				dataPointsPerPixel: 1,
			};

			await virtualizer.updateVisibleRange(viewport);
		}

		const stats = virtualizer.getCacheStats();

		// Should not load excessive chunks
		expect(stats.totalChunks).toBeLessThan(50);
		expect(stats.memoryUsage).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
	});
});
