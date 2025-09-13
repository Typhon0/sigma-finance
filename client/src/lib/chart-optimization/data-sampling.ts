/**
 * Chart data sampling and optimization utilities for large datasets
 */

export interface DataPoint {
  timestamp: number;
  value: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface SamplingOptions {
  maxPoints: number;
  algorithm: 'lttb' | 'average' | 'min-max' | 'uniform';
  preserveExtremes?: boolean;
  timeWindow?: number; // milliseconds
}

export interface VirtualizationConfig {
  chunkSize: number;
  preloadChunks: number;
  enableCompression: boolean;
  compressionThreshold: number;
}

/**
 * Largest Triangle Three Buckets (LTTB) algorithm for downsampling time series data
 * Preserves the visual characteristics of the data while reducing points
 */
export function lttbSampling(data: DataPoint[], targetPoints: number): DataPoint[] {
  if (data.length <= targetPoints) {
    return data;
  }

  if (targetPoints < 3) {
    return data.slice(0, targetPoints);
  }

  const sampled: DataPoint[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  // Always include first point
  sampled.push(data[0]);

  let bucketIndex = 0;
  for (let i = 1; i < targetPoints - 1; i++) {
    const bucketStart = Math.floor(bucketIndex * bucketSize) + 1;
    const bucketEnd = Math.floor((bucketIndex + 1) * bucketSize) + 1;
    const nextBucketStart = Math.floor((bucketIndex + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.floor((bucketIndex + 2) * bucketSize) + 1;

    // Calculate average point of next bucket for triangle area calculation
    let avgTimestamp = 0;
    let avgValue = 0;
    let avgCount = 0;

    for (let j = nextBucketStart; j < Math.min(nextBucketEnd, data.length); j++) {
      avgTimestamp += data[j].timestamp;
      avgValue += data[j].value;
      avgCount++;
    }

    if (avgCount > 0) {
      avgTimestamp /= avgCount;
      avgValue /= avgCount;
    }

    // Find point in current bucket with largest triangle area
    let maxArea = -1;
    let selectedPoint = data[bucketStart];

    const prevPoint = sampled[sampled.length - 1];

    for (let j = bucketStart; j < Math.min(bucketEnd, data.length); j++) {
      const area = Math.abs(
        (prevPoint.timestamp - avgTimestamp) * (data[j].value - prevPoint.value) -
        (prevPoint.timestamp - data[j].timestamp) * (avgValue - prevPoint.value)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        selectedPoint = data[j];
      }
    }

    sampled.push(selectedPoint);
    bucketIndex++;
  }

  // Always include last point
  sampled.push(data[data.length - 1]);

  return sampled;
}

/**
 * Average-based sampling - groups data points and takes averages
 */
export function averageSampling(data: DataPoint[], targetPoints: number): DataPoint[] {
  if (data.length <= targetPoints) {
    return data;
  }

  const sampled: DataPoint[] = [];
  const bucketSize = data.length / targetPoints;

  for (let i = 0; i < targetPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    
    let sumTimestamp = 0;
    let sumValue = 0;
    let sumVolume = 0;
    let count = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;

    for (let j = start; j < Math.min(end, data.length); j++) {
      sumTimestamp += data[j].timestamp;
      sumValue += data[j].value;
      if (data[j].volume !== undefined) {
        sumVolume += data[j].volume;
      }
      minValue = Math.min(minValue, data[j].value);
      maxValue = Math.max(maxValue, data[j].value);
      count++;
    }

    if (count > 0) {
      const avgPoint: DataPoint = {
        timestamp: Math.floor(sumTimestamp / count),
        value: sumValue / count,
      };

      if (data[0].volume !== undefined) {
        avgPoint.volume = sumVolume / count;
      }

      // For OHLC data, preserve min/max as low/high
      if (data[0].open !== undefined) {
        avgPoint.open = data[start].value;
        avgPoint.close = data[Math.min(end - 1, data.length - 1)].value;
        avgPoint.high = maxValue;
        avgPoint.low = minValue;
      }

      sampled.push(avgPoint);
    }
  }

  return sampled;
}

/**
 * Min-Max sampling - preserves extremes in each bucket
 */
export function minMaxSampling(data: DataPoint[], targetPoints: number): DataPoint[] {
  if (data.length <= targetPoints) {
    return data;
  }

  const sampled: DataPoint[] = [];
  const bucketSize = data.length / (targetPoints / 2); // Each bucket contributes 2 points (min and max)

  for (let i = 0; i < targetPoints / 2; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    
    let minPoint = data[start];
    let maxPoint = data[start];

    for (let j = start; j < Math.min(end, data.length); j++) {
      if (data[j].value < minPoint.value) {
        minPoint = data[j];
      }
      if (data[j].value > maxPoint.value) {
        maxPoint = data[j];
      }
    }

    // Add points in chronological order
    if (minPoint.timestamp <= maxPoint.timestamp) {
      sampled.push(minPoint);
      if (minPoint !== maxPoint) {
        sampled.push(maxPoint);
      }
    } else {
      sampled.push(maxPoint);
      if (minPoint !== maxPoint) {
        sampled.push(minPoint);
      }
    }
  }

  return sampled.slice(0, targetPoints);
}

/**
 * Uniform sampling - takes every nth point
 */
export function uniformSampling(data: DataPoint[], targetPoints: number): DataPoint[] {
  if (data.length <= targetPoints) {
    return data;
  }

  const sampled: DataPoint[] = [];
  const step = data.length / targetPoints;

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.floor(i * step);
    sampled.push(data[index]);
  }

  return sampled;
}

/**
 * Smart sampling that chooses the best algorithm based on data characteristics
 */
export function smartSampling(data: DataPoint[], options: SamplingOptions): DataPoint[] {
  if (data.length <= options.maxPoints) {
    return data;
  }

  // Analyze data characteristics
  const volatility = calculateVolatility(data);
  const trendStrength = calculateTrendStrength(data);

  // Choose algorithm based on data characteristics
  let algorithm = options.algorithm;
  
  if (algorithm === 'lttb' && volatility > 0.1) {
    // High volatility data benefits from LTTB
    return lttbSampling(data, options.maxPoints);
  } else if (algorithm === 'min-max' && volatility > 0.05) {
    // Moderate volatility benefits from min-max
    return minMaxSampling(data, options.maxPoints);
  } else if (algorithm === 'average' && trendStrength > 0.7) {
    // Strong trending data can use averaging
    return averageSampling(data, options.maxPoints);
  } else {
    // Default to LTTB for best visual preservation
    return lttbSampling(data, options.maxPoints);
  }
}

/**
 * Calculate data volatility (standard deviation / mean)
 */
function calculateVolatility(data: DataPoint[]): number {
  if (data.length < 2) return 0;

  const values = data.map(d => d.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return mean !== 0 ? stdDev / Math.abs(mean) : 0;
}

/**
 * Calculate trend strength using linear regression R²
 */
function calculateTrendStrength(data: DataPoint[]): number {
  if (data.length < 3) return 0;

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (let i = 0; i < n; i++) {
    const x = i; // Use index as x for simplicity
    const y = data[i].value;
    
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

  if (denominator === 0) return 0;

  const r = numerator / denominator;
  return r * r; // R²
}

/**
 * Compress data points using simple run-length encoding for repeated values
 */
export function compressData(data: DataPoint[], threshold: number = 0.001): DataPoint[] {
  if (data.length < 2) return data;

  const compressed: DataPoint[] = [data[0]];
  let lastValue = data[0].value;

  for (let i = 1; i < data.length; i++) {
    const currentValue = data[i].value;
    const change = Math.abs(currentValue - lastValue) / Math.abs(lastValue);

    // Only keep points that represent significant changes
    if (change > threshold || i === data.length - 1) {
      compressed.push(data[i]);
      lastValue = currentValue;
    }
  }

  return compressed;
}

/**
 * Create a data sampler with caching for repeated operations
 */
export class DataSampler {
  private cache = new Map<string, DataPoint[]>();
  private maxCacheSize = 100;

  constructor(private defaultOptions: SamplingOptions) {}

  sample(data: DataPoint[], options?: Partial<SamplingOptions>): DataPoint[] {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.getCacheKey(data, opts);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Sample data
    let sampled: DataPoint[];
    switch (opts.algorithm) {
      case 'lttb':
        sampled = lttbSampling(data, opts.maxPoints);
        break;
      case 'average':
        sampled = averageSampling(data, opts.maxPoints);
        break;
      case 'min-max':
        sampled = minMaxSampling(data, opts.maxPoints);
        break;
      case 'uniform':
        sampled = uniformSampling(data, opts.maxPoints);
        break;
      default:
        sampled = smartSampling(data, opts);
    }

    // Cache result
    this.cacheResult(cacheKey, sampled);

    return sampled;
  }

  private getCacheKey(data: DataPoint[], options: SamplingOptions): string {
    const dataHash = this.hashData(data);
    return `${dataHash}-${options.maxPoints}-${options.algorithm}`;
  }

  private hashData(data: DataPoint[]): string {
    // Simple hash based on data length and first/last values
    if (data.length === 0) return '0';
    
    const first = data[0];
    const last = data[data.length - 1];
    return `${data.length}-${first.timestamp}-${first.value}-${last.timestamp}-${last.value}`;
  }

  private cacheResult(key: string, data: DataPoint[]): void {
    // Implement LRU cache eviction
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, data);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }
}