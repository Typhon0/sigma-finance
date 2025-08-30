/**
 * Chart performance optimization utilities
 * Provides lazy loading, virtualization, and performance optimization for charts
 */

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { debounce, throttle } from 'lodash-es';

/**
 * Chart loading states
 */
export interface ChartLoadingState {
  isLoading: boolean;
  isError: boolean;
  error?: Error;
  progress?: number;
}

/**
 * Performance monitoring interface
 */
export interface ChartPerformanceMetrics {
  renderTime: number;
  dataProcessingTime: number;
  memoryUsage?: number;
  frameRate?: number;
  dataPoints: number;
}

/**
 * Lazy loading utilities
 */
export class ChartLazyLoader {
  private static loadedComponents = new Map<string, LazyExoticComponent<any>>();

  /**
   * Create lazy-loaded chart component
   */
  static createLazyChart<T = any>(
    importFn: () => Promise<{ default: ComponentType<T> }>,
    componentName: string
  ): LazyExoticComponent<ComponentType<T>> {
    if (this.loadedComponents.has(componentName)) {
      return this.loadedComponents.get(componentName)!;
    }

    const LazyComponent = lazy(importFn);
    this.loadedComponents.set(componentName, LazyComponent);
    
    return LazyComponent;
  }

  /**
   * Preload chart component
   */
  static async preloadChart(
    importFn: () => Promise<{ default: ComponentType<any> }>,
    componentName: string
  ): Promise<void> {
    if (this.loadedComponents.has(componentName)) {
      return;
    }

    try {
      const module = await importFn();
      const LazyComponent = lazy(() => Promise.resolve(module));
      this.loadedComponents.set(componentName, LazyComponent);
    } catch (error) {
      console.error(`Failed to preload chart component ${componentName}:`, error);
    }
  }

  /**
   * Clear loaded components cache
   */
  static clearCache(): void {
    this.loadedComponents.clear();
  }
}

/**
 * Chart virtualization utilities
 */
export class ChartVirtualizer {
  private static readonly DEFAULT_VIEWPORT_SIZE = 1000;
  private static readonly DEFAULT_BUFFER_SIZE = 200;

  /**
   * Virtualize large datasets
   */
  static virtualizeData<T>(
    data: T[],
    viewportStart: number,
    viewportEnd: number,
    bufferSize: number = this.DEFAULT_BUFFER_SIZE
  ): {
    virtualizedData: T[];
    startIndex: number;
    endIndex: number;
    totalCount: number;
  } {
    const startIndex = Math.max(0, viewportStart - bufferSize);
    const endIndex = Math.min(data.length, viewportEnd + bufferSize);
    
    return {
      virtualizedData: data.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalCount: data.length,
    };
  }

  /**
   * Calculate viewport based on time range
   */
  static calculateViewport(
    totalDataPoints: number,
    visibleTimeRange: { start: Date; end: Date },
    dataTimeRange: { start: Date; end: Date }
  ): { start: number; end: number } {
    const totalTimeSpan = dataTimeRange.end.getTime() - dataTimeRange.start.getTime();
    const visibleTimeSpan = visibleTimeRange.end.getTime() - visibleTimeRange.start.getTime();
    const visibleStartOffset = visibleTimeRange.start.getTime() - dataTimeRange.start.getTime();

    const startRatio = Math.max(0, visibleStartOffset / totalTimeSpan);
    const endRatio = Math.min(1, (visibleStartOffset + visibleTimeSpan) / totalTimeSpan);

    return {
      start: Math.floor(startRatio * totalDataPoints),
      end: Math.ceil(endRatio * totalDataPoints),
    };
  }
}

/**
 * Data sampling utilities for performance
 */
export class DataSampler {
  /**
   * Sample data using different algorithms
   */
  static sampleData<T>(
    data: T[],
    targetSize: number,
    algorithm: 'uniform' | 'adaptive' | 'lttb' = 'uniform'
  ): T[] {
    if (data.length <= targetSize) {
      return data;
    }

    switch (algorithm) {
      case 'uniform':
        return this.uniformSampling(data, targetSize);
      case 'adaptive':
        return this.adaptiveSampling(data, targetSize);
      case 'lttb':
        return this.lttbSampling(data, targetSize);
      default:
        return this.uniformSampling(data, targetSize);
    }
  }

  /**
   * Uniform sampling - evenly spaced points
   */
  private static uniformSampling<T>(data: T[], targetSize: number): T[] {
    const step = data.length / targetSize;
    const sampled: T[] = [];

    for (let i = 0; i < targetSize; i++) {
      const index = Math.floor(i * step);
      sampled.push(data[index]);
    }

    // Always include the last point
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled[sampled.length - 1] = data[data.length - 1];
    }

    return sampled;
  }

  /**
   * Adaptive sampling - more points in areas of high variance
   */
  private static adaptiveSampling<T extends { value?: number }>(data: T[], targetSize: number): T[] {
    if (!data[0]?.value) {
      return this.uniformSampling(data, targetSize);
    }

    // Calculate variance for each segment
    const segmentSize = Math.ceil(data.length / targetSize);
    const segments: Array<{ data: T[]; variance: number; startIndex: number }> = [];

    for (let i = 0; i < data.length; i += segmentSize) {
      const segment = data.slice(i, i + segmentSize);
      const values = segment.map(item => item.value || 0);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

      segments.push({ data: segment, variance, startIndex: i });
    }

    // Allocate points based on variance
    const totalVariance = segments.reduce((sum, seg) => sum + seg.variance, 0);
    const sampled: T[] = [];

    segments.forEach(segment => {
      const pointsForSegment = Math.max(1, Math.floor((segment.variance / totalVariance) * targetSize));
      const segmentSampled = this.uniformSampling(segment.data, pointsForSegment);
      sampled.push(...segmentSampled);
    });

    return sampled.slice(0, targetSize);
  }

  /**
   * Largest Triangle Three Buckets (LTTB) algorithm
   * Preserves visual characteristics of the data
   */
  private static lttbSampling<T extends { value?: number; time?: number }>(data: T[], targetSize: number): T[] {
    if (!data[0]?.value || targetSize >= data.length) {
      return data;
    }

    const sampled: T[] = [];
    const bucketSize = (data.length - 2) / (targetSize - 2);

    // Always include first point
    sampled.push(data[0]);

    let a = 0; // Initially a is the first point in the triangle

    for (let i = 0; i < targetSize - 2; i++) {
      // Calculate point average for next bucket
      const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
      const avgRangeLength = avgRangeEnd - avgRangeStart;

      let avgX = 0;
      let avgY = 0;

      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += j;
        avgY += data[j].value || 0;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;

      // Get the range for this bucket
      const rangeOffs = Math.floor(i * bucketSize) + 1;
      const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

      // Point a
      const pointAX = a;
      const pointAY = data[a].value || 0;

      let maxArea = -1;
      let maxAreaPoint = rangeOffs;

      for (let j = rangeOffs; j < rangeTo; j++) {
        // Calculate triangle area over three buckets
        const area = Math.abs(
          (pointAX - avgX) * ((data[j].value || 0) - pointAY) -
          (pointAX - j) * (avgY - pointAY)
        ) * 0.5;

        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = j;
        }
      }

      sampled.push(data[maxAreaPoint]);
      a = maxAreaPoint; // This a is the next a (chosen point)
    }

    // Always include last point
    sampled.push(data[data.length - 1]);

    return sampled;
  }
}

/**
 * Performance monitoring utilities
 */
export class ChartPerformanceMonitor {
  private static metrics = new Map<string, ChartPerformanceMetrics>();

  /**
   * Start performance measurement
   */
  static startMeasurement(chartId: string): () => ChartPerformanceMetrics {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize;

    return () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize;

      const metrics: ChartPerformanceMetrics = {
        renderTime: endTime - startTime,
        dataProcessingTime: 0, // To be set separately
        memoryUsage: endMemory ? endMemory - startMemory : undefined,
        dataPoints: 0, // To be set separately
      };

      this.metrics.set(chartId, metrics);
      return metrics;
    };
  }

  /**
   * Measure data processing time
   */
  static measureDataProcessing<T>(fn: () => T): { result: T; processingTime: number } {
    const startTime = performance.now();
    const result = fn();
    const processingTime = performance.now() - startTime;

    return { result, processingTime };
  }

  /**
   * Get performance metrics for chart
   */
  static getMetrics(chartId: string): ChartPerformanceMetrics | undefined {
    return this.metrics.get(chartId);
  }

  /**
   * Clear metrics
   */
  static clearMetrics(chartId?: string): void {
    if (chartId) {
      this.metrics.delete(chartId);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Log performance warning if thresholds exceeded
   */
  static checkPerformanceThresholds(chartId: string, thresholds: {
    maxRenderTime?: number;
    maxDataProcessingTime?: number;
    maxMemoryUsage?: number;
  }): void {
    const metrics = this.metrics.get(chartId);
    if (!metrics) return;

    const warnings: string[] = [];

    if (thresholds.maxRenderTime && metrics.renderTime > thresholds.maxRenderTime) {
      warnings.push(`Render time (${metrics.renderTime.toFixed(2)}ms) exceeded threshold (${thresholds.maxRenderTime}ms)`);
    }

    if (thresholds.maxDataProcessingTime && metrics.dataProcessingTime > thresholds.maxDataProcessingTime) {
      warnings.push(`Data processing time (${metrics.dataProcessingTime.toFixed(2)}ms) exceeded threshold (${thresholds.maxDataProcessingTime}ms)`);
    }

    if (thresholds.maxMemoryUsage && metrics.memoryUsage && metrics.memoryUsage > thresholds.maxMemoryUsage) {
      warnings.push(`Memory usage (${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB) exceeded threshold (${(thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB)`);
    }

    if (warnings.length > 0) {
      console.warn(`Chart performance warnings for ${chartId}:`, warnings);
    }
  }
}

/**
 * Debounced and throttled update utilities
 */
export class ChartUpdateManager {
  private static debouncedUpdates = new Map<string, ReturnType<typeof debounce>>();
  private static throttledUpdates = new Map<string, ReturnType<typeof throttle>>();

  /**
   * Create debounced update function
   */
  static createDebouncedUpdate<T extends any[]>(
    key: string,
    updateFn: (...args: T) => void,
    delay: number = 300
  ): (...args: T) => void {
    if (this.debouncedUpdates.has(key)) {
      return this.debouncedUpdates.get(key)!;
    }

    const debouncedFn = debounce(updateFn, delay);
    this.debouncedUpdates.set(key, debouncedFn);
    return debouncedFn;
  }

  /**
   * Create throttled update function
   */
  static createThrottledUpdate<T extends any[]>(
    key: string,
    updateFn: (...args: T) => void,
    delay: number = 100
  ): (...args: T) => void {
    if (this.throttledUpdates.has(key)) {
      return this.throttledUpdates.get(key)!;
    }

    const throttledFn = throttle(updateFn, delay);
    this.throttledUpdates.set(key, throttledFn);
    return throttledFn;
  }

  /**
   * Clear update functions
   */
  static clearUpdates(key?: string): void {
    if (key) {
      const debouncedFn = this.debouncedUpdates.get(key);
      const throttledFn = this.throttledUpdates.get(key);
      
      if (debouncedFn) {
        debouncedFn.cancel();
        this.debouncedUpdates.delete(key);
      }
      
      if (throttledFn) {
        throttledFn.cancel();
        this.throttledUpdates.delete(key);
      }
    } else {
      this.debouncedUpdates.forEach(fn => fn.cancel());
      this.throttledUpdates.forEach(fn => fn.cancel());
      this.debouncedUpdates.clear();
      this.throttledUpdates.clear();
    }
  }
}

/**
 * Memory management utilities
 */
export class ChartMemoryManager {
  private static chartInstances = new Map<string, any>();
  private static cleanupCallbacks = new Map<string, () => void>();

  /**
   * Register chart instance for cleanup
   */
  static registerChart(chartId: string, instance: any, cleanupFn?: () => void): void {
    // Clean up existing instance if any
    this.unregisterChart(chartId);

    this.chartInstances.set(chartId, instance);
    if (cleanupFn) {
      this.cleanupCallbacks.set(chartId, cleanupFn);
    }
  }

  /**
   * Unregister and cleanup chart instance
   */
  static unregisterChart(chartId: string): void {
    const cleanupFn = this.cleanupCallbacks.get(chartId);
    if (cleanupFn) {
      cleanupFn();
      this.cleanupCallbacks.delete(chartId);
    }

    const instance = this.chartInstances.get(chartId);
    if (instance) {
      // Try to dispose if method exists
      if (typeof instance.dispose === 'function') {
        instance.dispose();
      }
      this.chartInstances.delete(chartId);
    }
  }

  /**
   * Cleanup all chart instances
   */
  static cleanupAll(): void {
    this.cleanupCallbacks.forEach(cleanupFn => cleanupFn());
    this.chartInstances.forEach(instance => {
      if (typeof instance.dispose === 'function') {
        instance.dispose();
      }
    });
    
    this.chartInstances.clear();
    this.cleanupCallbacks.clear();
  }

  /**
   * Get memory usage estimate
   */
  static getMemoryUsage(): number | undefined {
    return (performance as any).memory?.usedJSHeapSize;
  }

  /**
   * Force garbage collection (if available)
   */
  static forceGarbageCollection(): void {
    if ((window as any).gc) {
      (window as any).gc();
    }
  }
}

/**
 * Chart loading skeleton component
 */
export interface ChartSkeletonProps {
  width?: number | string;
  height?: number | string;
  type?: 'line' | 'bar' | 'pie' | 'candlestick';
}

/**
 * Intersection Observer for lazy loading
 */
export class ChartIntersectionObserver {
  private static observers = new Map<string, IntersectionObserver>();
  private static callbacks = new Map<string, () => void>();

  /**
   * Observe element for intersection
   */
  static observe(
    element: Element,
    callback: () => void,
    options: IntersectionObserverInit = { threshold: 0.1 }
  ): string {
    const id = Math.random().toString(36).substr(2, 9);
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback();
          this.unobserve(id);
        }
      });
    }, options);

    observer.observe(element);
    this.observers.set(id, observer);
    this.callbacks.set(id, callback);

    return id;
  }

  /**
   * Stop observing element
   */
  static unobserve(id: string): void {
    const observer = this.observers.get(id);
    if (observer) {
      observer.disconnect();
      this.observers.delete(id);
    }
    this.callbacks.delete(id);
  }

  /**
   * Cleanup all observers
   */
  static cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.callbacks.clear();
  }
}

/**
 * Performance optimization recommendations
 */
export class ChartOptimizationRecommendations {
  /**
   * Analyze data and provide optimization recommendations
   */
  static analyzeAndRecommend(data: any[], chartType: string): {
    recommendations: string[];
    optimizedSettings: any;
  } {
    const recommendations: string[] = [];
    const optimizedSettings: any = {};

    // Data size analysis
    if (data.length > 10000) {
      recommendations.push('Consider data sampling or virtualization for large datasets');
      optimizedSettings.enableSampling = true;
      optimizedSettings.maxDataPoints = 5000;
    }

    if (data.length > 50000) {
      recommendations.push('Enable virtualization for very large datasets');
      optimizedSettings.enableVirtualization = true;
    }

    // Chart type specific recommendations
    if (chartType === 'candlestick' && data.length > 5000) {
      recommendations.push('Disable animations for candlestick charts with large datasets');
      optimizedSettings.animation = false;
    }

    if (['pie', 'donut'].includes(chartType) && data.length > 20) {
      recommendations.push('Consider grouping small segments for pie charts');
      optimizedSettings.groupSmallSegments = true;
    }

    // Memory usage recommendations
    const memoryUsage = ChartMemoryManager.getMemoryUsage();
    if (memoryUsage && memoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected, consider reducing data precision');
      optimizedSettings.reducePrecision = true;
    }

    return { recommendations, optimizedSettings };
  }
}