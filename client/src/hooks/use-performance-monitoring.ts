import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Performance monitoring hook for tracking query and mutation performance
 */
export function usePerformanceMonitoring() {
	const [metrics, setMetrics] = useState<{
		queryTimes: Record<string, number[]>;
		mutationTimes: Record<string, number[]>;
		cacheHitRate: number;
		averageQueryTime: number;
		slowQueries: Array<{ name: string; time: number; timestamp: number }>;
	}>({
		queryTimes: {},
		mutationTimes: {},
		cacheHitRate: 0,
		averageQueryTime: 0,
		slowQueries: [],
	});

	const queryStartTimes = useRef<Record<string, number>>({});
	const cacheStats = useRef({ hits: 0, misses: 0 });

	const startQuery = useCallback((queryName: string) => {
		queryStartTimes.current[queryName] = performance.now();
	}, []);

	const endQuery = useCallback((queryName: string, fromCache = false) => {
		const startTime = queryStartTimes.current[queryName];
		if (!startTime) return;

		const duration = performance.now() - startTime;
		delete queryStartTimes.current[queryName];

		// Update cache stats
		if (fromCache) {
			cacheStats.current.hits++;
		} else {
			cacheStats.current.misses++;
		}

		setMetrics((prev) => {
			const newQueryTimes = { ...prev.queryTimes };
			if (!newQueryTimes[queryName]) {
				newQueryTimes[queryName] = [];
			}
			newQueryTimes[queryName].push(duration);

			// Keep only last 100 measurements per query
			if (newQueryTimes[queryName].length > 100) {
				newQueryTimes[queryName] = newQueryTimes[queryName].slice(-100);
			}

			// Calculate average query time
			const allTimes = Object.values(newQueryTimes).flat();
			const averageQueryTime = allTimes.length > 0 
				? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length 
				: 0;

			// Track slow queries (> 2 seconds)
			const slowQueries = [...prev.slowQueries];
			if (duration > 2000) {
				slowQueries.push({
					name: queryName,
					time: duration,
					timestamp: Date.now(),
				});
				// Keep only last 50 slow queries
				if (slowQueries.length > 50) {
					slowQueries.shift();
				}
			}

			// Calculate cache hit rate
			const totalRequests = cacheStats.current.hits + cacheStats.current.misses;
			const cacheHitRate = totalRequests > 0 
				? (cacheStats.current.hits / totalRequests) * 100 
				: 0;

			return {
				...prev,
				queryTimes: newQueryTimes,
				averageQueryTime,
				slowQueries,
				cacheHitRate,
			};
		});
	}, []);

	const startMutation = useCallback((mutationName: string) => {
		queryStartTimes.current[mutationName] = performance.now();
	}, []);

	const endMutation = useCallback((mutationName: string) => {
		const startTime = queryStartTimes.current[mutationName];
		if (!startTime) return;

		const duration = performance.now() - startTime;
		delete queryStartTimes.current[mutationName];

		setMetrics((prev) => {
			const newMutationTimes = { ...prev.mutationTimes };
			if (!newMutationTimes[mutationName]) {
				newMutationTimes[mutationName] = [];
			}
			newMutationTimes[mutationName].push(duration);

			// Keep only last 50 measurements per mutation
			if (newMutationTimes[mutationName].length > 50) {
				newMutationTimes[mutationName] = newMutationTimes[mutationName].slice(-50);
			}

			return {
				...prev,
				mutationTimes: newMutationTimes,
			};
		});
	}, []);

	const getQueryStats = useCallback((queryName: string) => {
		const times = metrics.queryTimes[queryName] || [];
		if (times.length === 0) {
			return { average: 0, min: 0, max: 0, count: 0 };
		}

		const average = times.reduce((sum, time) => sum + time, 0) / times.length;
		const min = Math.min(...times);
		const max = Math.max(...times);

		return { average, min, max, count: times.length };
	}, [metrics.queryTimes]);

	const getMutationStats = useCallback((mutationName: string) => {
		const times = metrics.mutationTimes[mutationName] || [];
		if (times.length === 0) {
			return { average: 0, min: 0, max: 0, count: 0 };
		}

		const average = times.reduce((sum, time) => sum + time, 0) / times.length;
		const min = Math.min(...times);
		const max = Math.max(...times);

		return { average, min, max, count: times.length };
	}, [metrics.mutationTimes]);

	const clearMetrics = useCallback(() => {
		setMetrics({
			queryTimes: {},
			mutationTimes: {},
			cacheHitRate: 0,
			averageQueryTime: 0,
			slowQueries: [],
		});
		cacheStats.current = { hits: 0, misses: 0 };
	}, []);

	// Log performance warnings in development
	useEffect(() => {
		if (import.meta.env.MODE === "development") {
			metrics.slowQueries.forEach((query) => {
				console.warn(
					`Slow query detected: ${query.name} took ${query.time.toFixed(2)}ms`,
				);
			});
		}
	}, [metrics.slowQueries]);

	return {
		metrics,
		startQuery,
		endQuery,
		startMutation,
		endMutation,
		getQueryStats,
		getMutationStats,
		clearMetrics,
	};
}

/**
 * Hook for monitoring component render performance
 */
export function useRenderPerformance(componentName: string) {
	const renderCount = useRef(0);
	const renderTimes = useRef<number[]>([]);
	const lastRenderTime = useRef<number>(0);

	useEffect(() => {
		const startTime = performance.now();
		renderCount.current++;

		return () => {
			const endTime = performance.now();
			const renderTime = endTime - startTime;
			
			renderTimes.current.push(renderTime);
			
			// Keep only last 50 render times
			if (renderTimes.current.length > 50) {
				renderTimes.current.shift();
			}

			lastRenderTime.current = renderTime;

			// Log slow renders in development
			if (import.meta.env.MODE === "development" && renderTime > 16) {
				console.warn(
					`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
				);
			}
		};
	});

	const getStats = useCallback(() => {
		const times = renderTimes.current;
		if (times.length === 0) {
			return {
				count: renderCount.current,
				averageTime: 0,
				lastRenderTime: lastRenderTime.current,
				slowRenders: 0,
			};
		}

		const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
		const slowRenders = times.filter((time) => time > 16).length;

		return {
			count: renderCount.current,
			averageTime,
			lastRenderTime: lastRenderTime.current,
			slowRenders,
		};
	}, []);

	return { getStats };
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitoring() {
	const [memoryInfo, setMemoryInfo] = useState<{
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
		usagePercentage: number;
	} | null>(null);

	const updateMemoryInfo = useCallback(() => {
		if ('memory' in performance) {
			const memory = (performance as any).memory;
			const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
			
			setMemoryInfo({
				usedJSHeapSize: memory.usedJSHeapSize,
				totalJSHeapSize: memory.totalJSHeapSize,
				jsHeapSizeLimit: memory.jsHeapSizeLimit,
				usagePercentage,
			});

			// Warn about high memory usage in development
			if (import.meta.env.MODE === "development" && usagePercentage > 80) {
				console.warn(`High memory usage detected: ${usagePercentage.toFixed(1)}%`);
			}
		}
	}, []);

	useEffect(() => {
		updateMemoryInfo();
		const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds
		return () => clearInterval(interval);
	}, [updateMemoryInfo]);

	return { memoryInfo, updateMemoryInfo };
}