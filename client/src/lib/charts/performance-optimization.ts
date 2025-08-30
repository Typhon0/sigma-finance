/**
 * Chart performance optimization utilities
 * Handles data sampling, virtualization, and memory management for large datasets
 */

import { type CandlestickData, type LineData, type HistogramData } from 'lightweight-charts';
import { debounce, throttle } from 'lodash-es';

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  maxDataPoints: number;
  sampleThreshold: number;
  enableVirtualization: boolean;
  enableLazyLoading: boolean;
  debounceMs: number;
  throttleMs: number;
  memoryThreshold: number; // MB
  gcInterval: number; // ms
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxDataPoints: 5000,
  sampleThreshold: 10000,
  enableVirtualization: true,
  enableLazyLoading: true,
  debounceMs: 300,
  throttleMs: 100,
  memoryThreshold: 100, // 100MB
  gcInterval: 30000, // 30 seconds
};

/**
 * Data sampling strategies
 */
export type SamplingStrategy = 'uniform' | 'adaptive' | 'importance' | 'lttb';

/**
 * Uniform sampling - evenly spaced data points
 */
export function uniformSample<T extends { time: any }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const sampled: T[] = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }

  // Always include the last data point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }

  return sampled;
}

/**
 * Adaptive sampling - more points in areas of high volatility
 */
export function adaptiveSample<T extends { time: any; close?: number; value?: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  // Calculate volatility for each point
  const volatilities: number[] = [];
  for (let i = 1; i < data.length - 1; i++) {
    const prev = (data[i - 1] as any).close || (data[i - 1] as any).value || 0;
    const curr = (data[i] as any).close || (data[i] as any).value || 0;
    const next = (data[i + 1] as any).close || (data[i + 1] as any).value || 0;
    
    const volatility = Math.abs(curr - prev) + Math.abs(next - curr);
    volatilities.push(volatility);
  }

  // Sort indices by volatility (descending)
  const indices = volatilities
    .map((vol, idx) => ({ vol, idx: idx + 1 }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, maxPoints - 2) // Reserve space for first and last points
    .map(item => item.idx)
    .sort((a, b) => a - b);

  // Always include first and last points
  const sampled = [data[0], ...indices.map(i => data[i]), data[data.length - 1]];
  
  return sampled.filter((item, index, arr) => 
    index === 0 || item !== arr[index - 1]
  );
}

/**
 * Importance sampling - preserve important data points
 */
export function importanceSample<T extends { time: any; high?: number; low?: number; close?: number; value?: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  // Calculate importance scores
  const scores: Array<{ index: number; score: number }> = [];
  
  for (let i = 0; i < data.length; i++) {
    let score = 0;
    const point = data[i] as any;
    
    // Higher score for extreme values
    if (point.high !== undefined && point.low !== undefined) {
      const range = point.high - point.low;
      score += range * 10; // Candlestick range importance
    }
    
    // Higher score for volume spikes
    if (point.volume !== undefined) {
      score += Math.log(point.volume + 1);
    }
    
    // Higher score for price changes
    if (i > 0) {
      const prevPrice = (data[i - 1] as any).close || (data[i - 1] as any).value || 0;
      const currPrice = point.close || point.value || 0;
      score += Math.abs(currPrice - prevPrice) * 100;
    }
    
    scores.push({ index: i, score });
  }

  // Sort by importance and take top points
  const importantIndices = scores
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoints)
    .map(item => item.index)
    .sort((a, b) => a - b);

  return importantIndices.map(i => data[i]);
}

/**
 * Largest Triangle Three Buckets (LTTB) algorithm
 * Excellent for preserving visual characteristics of time series data
 */
export function lttbSample<T extends { time: any; close?: number; value?: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;
  if (maxPoints < 3) return [data[0], data[data.length - 1]];

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (maxPoints - 2);

  // Always include first point
  sampled.push(data[0]);

  let bucketStart = 1;
  for (let i = 1; i < maxPoints - 1; i++) {
    const bucketEnd = Math.floor(bucketStart + bucketSize);
    
    // Calculate average point of next bucket
    let avgX = 0;
    let avgY = 0;
    let avgCount = 0;
    
    const nextBucketStart = Math.floor(bucketEnd);
    const nextBucketEnd = Math.min(Math.floor(nextBucketStart + bucketSize), data.length);
    
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      const point = data[j] as any;
      const value = point.close || point.value || 0;
      avgX += j;
      avgY += value;
      avgCount++;
    }
    
    if (avgCount > 0) {
      avgX /= avgCount;
      avgY /= avgCount;
    }

    // Find point in current bucket with largest triangle area
    let maxArea = -1;
    let maxAreaIndex = bucketStart;
    
    const prevPoint = sampled[sampled.length - 1] as any;
    const prevValue = prevPoint.close || prevPoint.value || 0;
    
    for (let j = bucketStart; j < bucketEnd && j < data.length; j++) {
      const point = data[j] as any;
      const value = point.close || point.value || 0;
      
      // Calculate triangle area
      const area = Math.abs(
        (bucketStart - avgX) * (value - prevValue) -
        (bucketStart - j) * (avgY - prevValue)
      ) * 0.5;
      
      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }
    
    sampled.push(data[maxAreaIndex]);
    bucketStart = bucketEnd;
  }

  // Always include last point
  sampled.push(data[data.length - 1]);
  
  return sampled;
}

/**
 * Smart data sampler that chooses the best strategy
 */
export class DataSampler {
  private config: PerformanceConfig;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  }

  /**
   * Sample data using the most appropriate strategy
   */
  sample<T extends { time: any; close?: number; value?: number; high?: number; low?: number }>(
    data: T[],
    maxPoints?: number,
    strategy?: SamplingStrategy
  ): T[] {
    const targetPoints = maxPoints || this.config.maxDataPoints;
    
    if (data.length <= targetPoints) return data;

    // Auto-select strategy if not specified
    if (!strategy) {
      strategy = this.selectOptimalStrategy(data, targetPoints);
    }

    switch (strategy) {
      case 'uniform':
        return uniformSample(data, targetPoints);
      case 'adaptive':
        return adaptiveSample(data, targetPoints);
      case 'importance':
        return importanceSample(data, targetPoints);
      case 'lttb':
        return lttbSample(data, targetPoints);
      default:
        return uniformSample(data, targetPoints);
    }
  }

  /**
   * Select optimal sampling strategy based on data characteristics
   */
  private selectOptimalStrategy<T extends { time: any; close?: number; value?: number; high?: number; low?: number }>(
    data: T[],
    targetPoints: number
  ): SamplingStrategy {
    const sampleSize = Math.min(1000, data.length);
    const sample = data.slice(0, sampleSize);
    
    // Calculate volatility
    let volatility = 0;
    for (let i = 1; i < sample.length; i++) {
      const prev = (sample[i - 1] as any).close || (sample[i - 1] as any).value || 0;
      const curr = (sample[i] as any).close || (sample[i] as any).value || 0;
      volatility += Math.abs(curr - prev);
    }
    volatility /= sample.length;

    // Check if data has OHLC (candlestick data)
    const hasOHLC = sample.some(point => 
      (point as any).high !== undefined && (point as any).low !== undefined
    );

    // Decision logic
    if (hasOHLC && volatility > 1) {
      return 'importance'; // Good for volatile candlestick data
    } else if (volatility > 0.5) {
      return 'adaptive'; // Good for volatile line data
    } else if (data.length > targetPoints * 10) {
      return 'lttb'; // Good for very large datasets
    } else {
      return 'uniform'; // Default for stable data
    }
  }
}

/**
 * Chart data virtualization for handling very large datasets
 */
export class ChartVirtualizer<T extends { time: any }> {
  private data: T[] = [];
  private viewportStart = 0;
  private viewportEnd = 0;
  private viewportSize = 1000;
  private buffer = 200; // Extra data points to load outside viewport

  constructor(data: T[], viewportSize = 1000) {
    this.data = data;
    this.viewportSize = viewportSize;
  }

  /**
   * Update viewport based on visible time range
   */
  updateViewport(startTime: number, endTime: number): T[] {
    // Find indices for the time range
    const startIndex = this.findTimeIndex(startTime);
    const endIndex = this.findTimeIndex(endTime);

    // Add buffer
    this.viewportStart = Math.max(0, startIndex - this.buffer);
    this.viewportEnd = Math.min(this.data.length, endIndex + this.buffer);

    return this.data.slice(this.viewportStart, this.viewportEnd);
  }

  /**
   * Get current viewport data
   */
  getViewportData(): T[] {
    return this.data.slice(this.viewportStart, this.viewportEnd);
  }

  /**
   * Update underlying data
   */
  updateData(newData: T[]): void {
    this.data = newData;
  }

  /**
   * Find index for a given timestamp
   */
  private findTimeIndex(timestamp: number): number {
    // Binary search for efficiency
    let left = 0;
    let right = this.data.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = new Date(this.data[mid].time).getTime();

      if (midTime === timestamp) {
        return mid;
      } else if (midTime < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return left;
  }
}

/**
 * Memory management utilities
 */
export class ChartMemoryManager {
  private static instance: ChartMemoryManager;
  private memoryUsage = new Map<string, number>();
  private gcTimer: NodeJS.Timeout | null = null;

  static getInstance(): ChartMemoryManager {
    if (!ChartMemoryManager.instance) {
      ChartMemoryManager.instance = new ChartMemoryManager();
    }
    return ChartMemoryManager.instance;
  }

  /**
   * Register chart memory usage
   */
  registerChart(chartId: string, dataSize: number): void {
    this.memoryUsage.set(chartId, dataSize);
    this.startGarbageCollection();
  }

  /**
   * Unregister chart
   */
  unregisterChart(chartId: string): void {
    this.memoryUsage.delete(chartId);
    
    if (this.memoryUsage.size === 0) {
      this.stopGarbageCollection();
    }
  }

  /**
   * Get total memory usage
   */
  getTotalMemoryUsage(): number {
    return Array.from(this.memoryUsage.values()).reduce((sum, size) => sum + size, 0);
  }

  /**
   * Check if memory threshold is exceeded
   */
  isMemoryThresholdExceeded(threshold: number = DEFAULT_PERFORMANCE_CONFIG.memoryThreshold): boolean {
    return this.getTotalMemoryUsage() > threshold * 1024 * 1024; // Convert MB to bytes
  }

  /**
   * Start garbage collection timer
   */
  private startGarbageCollection(): void {
    if (this.gcTimer) return;

    this.gcTimer = setInterval(() => {
      if (this.isMemoryThresholdExceeded()) {
        this.performGarbageCollection();
      }
    }, DEFAULT_PERFORMANCE_CONFIG.gcInterval);
  }

  /**
   * Stop garbage collection timer
   */
  private stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  /**
   * Perform garbage collection
   */
  private performGarbageCollection(): void {
    // Trigger browser garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }

    // Emit event for charts to optimize themselves
    window.dispatchEvent(new CustomEvent('chart-memory-pressure', {
      detail: { memoryUsage: this.getTotalMemoryUsage() }
    }));
  }
}

/**
 * Performance monitoring utilities
 */
export class ChartPerformanceMonitor {
  private metrics = new Map<string, any>();

  /**
   * Start performance measurement
   */
  startMeasurement(name: string): void {
    this.metrics.set(name, {
      startTime: performance.now(),
      startMemory: (performance as any).memory?.usedJSHeapSize || 0,
    });
  }

  /**
   * End performance measurement
   */
  endMeasurement(name: string): { duration: number; memoryDelta: number } | null {
    const metric = this.metrics.get(name);
    if (!metric) return null;

    const endTime = performance.now();
    const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

    const result = {
      duration: endTime - metric.startTime,
      memoryDelta: endMemory - metric.startMemory,
    };

    this.metrics.delete(name);
    return result;
  }

  /**
   * Log performance metrics
   */
  logMetrics(name: string, metrics: { duration: number; memoryDelta: number }): void {
    console.log(`Chart Performance [${name}]:`, {
      duration: `${metrics.duration.toFixed(2)}ms`,
      memoryDelta: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
    });
  }
}

/**
 * Debounced and throttled update utilities
 */
export function createDebouncedUpdate<T extends any[]>(
  fn: (...args: T) => void,
  delay: number = DEFAULT_PERFORMANCE_CONFIG.debounceMs
) {
  return debounce(fn, delay);
}

export function createThrottledUpdate<T extends any[]>(
  fn: (...args: T) => void,
  delay: number = DEFAULT_PERFORMANCE_CONFIG.throttleMs
) {
  return throttle(fn, delay);
}

/**
 * Global performance optimization utilities
 */
export const ChartPerformanceUtils = {
  sampler: new DataSampler(),
  memoryManager: ChartMemoryManager.getInstance(),
  monitor: new ChartPerformanceMonitor(),
  
  // Convenience methods
  sampleData: <T extends { time: any; close?: number; value?: number; high?: number; low?: number }>(
    data: T[],
    maxPoints?: number,
    strategy?: SamplingStrategy
  ) => ChartPerformanceUtils.sampler.sample(data, maxPoints, strategy),
  
  createVirtualizer: <T extends { time: any }>(data: T[], viewportSize?: number) => 
    new ChartVirtualizer(data, viewportSize),
  
  debouncedUpdate: createDebouncedUpdate,
  throttledUpdate: createThrottledUpdate,
};