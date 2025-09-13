/**
 * Chart virtualization utilities for handling large datasets efficiently
 */

import { DataPoint } from './data-sampling';

export interface VirtualChunk {
  id: string;
  startIndex: number;
  endIndex: number;
  data: DataPoint[];
  isLoaded: boolean;
  isLoading: boolean;
  timestamp: number;
}

export interface VirtualizationState {
  chunks: Map<string, VirtualChunk>;
  visibleRange: { start: number; end: number };
  totalDataPoints: number;
  chunkSize: number;
  preloadChunks: number;
}

export interface ViewportInfo {
  startTime: number;
  endTime: number;
  pixelWidth: number;
  dataPointsPerPixel: number;
}

/**
 * ChartVirtualizer manages large datasets by loading only visible portions
 */
export class ChartVirtualizer {
  private state: VirtualizationState;
  private dataLoader: (startIndex: number, endIndex: number) => Promise<DataPoint[]>;
  private loadingPromises = new Map<string, Promise<DataPoint[]>>();
  private observers: Set<(state: VirtualizationState) => void> = new Set();

  constructor(
    totalDataPoints: number,
    chunkSize: number = 1000,
    preloadChunks: number = 2,
    dataLoader: (startIndex: number, endIndex: number) => Promise<DataPoint[]>
  ) {
    this.state = {
      chunks: new Map(),
      visibleRange: { start: 0, end: 0 },
      totalDataPoints,
      chunkSize,
      preloadChunks,
    };
    this.dataLoader = dataLoader;
  }

  /**
   * Update the visible range and trigger loading of necessary chunks
   */
  async updateVisibleRange(viewport: ViewportInfo): Promise<DataPoint[]> {
    const { startIndex, endIndex } = this.calculateDataRange(viewport);
    
    this.state.visibleRange = { start: startIndex, end: endIndex };
    
    // Calculate which chunks are needed
    const neededChunks = this.calculateNeededChunks(startIndex, endIndex);
    
    // Load missing chunks
    await this.loadChunks(neededChunks);
    
    // Get visible data from loaded chunks
    const visibleData = this.getVisibleData(startIndex, endIndex);
    
    // Cleanup old chunks
    this.cleanupOldChunks();
    
    // Notify observers
    this.notifyObservers();
    
    return visibleData;
  }

  /**
   * Calculate data range based on viewport
   */
  private calculateDataRange(viewport: ViewportInfo): { startIndex: number; endIndex: number } {
    // This is a simplified calculation - in reality, you'd need to map
    // time ranges to data indices based on your data structure
    const totalTimeRange = viewport.endTime - viewport.startTime;
    
    if (totalTimeRange <= 0 || this.state.totalDataPoints <= 0) {
      return { startIndex: 0, endIndex: Math.min(100, this.state.totalDataPoints) };
    }
    
    // Calculate approximate indices based on time range
    const timePerDataPoint = totalTimeRange / Math.max(1, this.state.totalDataPoints);
    const viewportDataPoints = Math.ceil(totalTimeRange / timePerDataPoint);
    
    const startIndex = Math.max(0, Math.floor(this.state.totalDataPoints * 0.1)); // Start at 10% of data
    const endIndex = Math.min(
      this.state.totalDataPoints - 1,
      startIndex + Math.max(100, viewportDataPoints)
    );
    
    return { startIndex, endIndex };
  }

  /**
   * Calculate which chunks need to be loaded
   */
  private calculateNeededChunks(startIndex: number, endIndex: number): string[] {
    const chunks: string[] = [];
    
    // Calculate visible chunks
    const startChunk = Math.floor(startIndex / this.state.chunkSize);
    const endChunk = Math.floor(endIndex / this.state.chunkSize);
    
    // Add preload chunks
    const preloadStart = Math.max(0, startChunk - this.state.preloadChunks);
    const preloadEnd = Math.min(
      Math.floor(this.state.totalDataPoints / this.state.chunkSize),
      endChunk + this.state.preloadChunks
    );
    
    for (let i = preloadStart; i <= preloadEnd; i++) {
      chunks.push(this.getChunkId(i));
    }
    
    return chunks;
  }

  /**
   * Load multiple chunks concurrently
   */
  private async loadChunks(chunkIds: string[]): Promise<void> {
    const loadPromises: Promise<void>[] = [];
    
    for (const chunkId of chunkIds) {
      if (!this.state.chunks.has(chunkId)) {
        loadPromises.push(this.loadChunk(chunkId));
      }
    }
    
    await Promise.all(loadPromises);
  }

  /**
   * Load a single chunk
   */
  private async loadChunk(chunkId: string): Promise<void> {
    // Check if already loading
    if (this.loadingPromises.has(chunkId)) {
      await this.loadingPromises.get(chunkId);
      return;
    }

    const chunkIndex = this.getChunkIndex(chunkId);
    const startIndex = chunkIndex * this.state.chunkSize;
    const endIndex = Math.min(startIndex + this.state.chunkSize, this.state.totalDataPoints);

    // Create chunk placeholder
    const chunk: VirtualChunk = {
      id: chunkId,
      startIndex,
      endIndex,
      data: [],
      isLoaded: false,
      isLoading: true,
      timestamp: Date.now(),
    };

    this.state.chunks.set(chunkId, chunk);

    // Start loading
    const loadPromise = this.dataLoader(startIndex, endIndex)
      .then(data => {
        chunk.data = data;
        chunk.isLoaded = true;
        chunk.isLoading = false;
        chunk.timestamp = Date.now();
      })
      .catch(error => {
        console.error(`Failed to load chunk ${chunkId}:`, error);
        chunk.isLoading = false;
        // Keep chunk in map but mark as failed
      });

    this.loadingPromises.set(chunkId, loadPromise);
    
    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(chunkId);
    }
  }

  /**
   * Get visible data from loaded chunks
   */
  private getVisibleData(startIndex: number, endIndex: number): DataPoint[] {
    const data: DataPoint[] = [];
    
    const startChunk = Math.floor(startIndex / this.state.chunkSize);
    const endChunk = Math.floor(endIndex / this.state.chunkSize);
    
    for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex++) {
      const chunkId = this.getChunkId(chunkIndex);
      const chunk = this.state.chunks.get(chunkId);
      
      if (chunk && chunk.isLoaded) {
        // Calculate which portion of the chunk is visible
        const chunkStart = Math.max(startIndex, chunk.startIndex);
        const chunkEnd = Math.min(endIndex, chunk.endIndex - 1);
        
        const relativeStart = chunkStart - chunk.startIndex;
        const relativeEnd = chunkEnd - chunk.startIndex + 1;
        
        data.push(...chunk.data.slice(relativeStart, relativeEnd));
      }
    }
    
    return data;
  }

  /**
   * Cleanup old chunks to prevent memory leaks
   */
  private cleanupOldChunks(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const maxChunks = 50; // Maximum number of chunks to keep
    
    // Remove old chunks
    for (const [chunkId, chunk] of this.state.chunks) {
      if (now - chunk.timestamp > maxAge) {
        this.state.chunks.delete(chunkId);
      }
    }
    
    // If still too many chunks, remove oldest
    if (this.state.chunks.size > maxChunks) {
      const sortedChunks = Array.from(this.state.chunks.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = sortedChunks.slice(0, this.state.chunks.size - maxChunks);
      for (const [chunkId] of toRemove) {
        this.state.chunks.delete(chunkId);
      }
    }
  }

  /**
   * Get chunk ID from chunk index
   */
  private getChunkId(chunkIndex: number): string {
    return `chunk_${chunkIndex}`;
  }

  /**
   * Get chunk index from chunk ID
   */
  private getChunkIndex(chunkId: string): number {
    return parseInt(chunkId.split('_')[1], 10);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(observer: (state: VirtualizationState) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Notify all observers of state changes
   */
  private notifyObservers(): void {
    for (const observer of this.observers) {
      observer(this.state);
    }
  }

  /**
   * Get current state
   */
  getState(): VirtualizationState {
    return { ...this.state };
  }

  /**
   * Preload chunks around a specific time range
   */
  async preloadAroundRange(startTime: number, endTime: number): Promise<void> {
    const viewport: ViewportInfo = {
      startTime,
      endTime,
      pixelWidth: 1000, // Default width
      dataPointsPerPixel: 1,
    };
    
    await this.updateVisibleRange(viewport);
  }

  /**
   * Clear all cached chunks
   */
  clearCache(): void {
    this.state.chunks.clear();
    this.loadingPromises.clear();
    this.notifyObservers();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalChunks: number;
    loadedChunks: number;
    loadingChunks: number;
    memoryUsage: number;
  } {
    let loadedChunks = 0;
    let loadingChunks = 0;
    let memoryUsage = 0;

    for (const chunk of this.state.chunks.values()) {
      if (chunk.isLoaded) {
        loadedChunks++;
        memoryUsage += chunk.data.length * 32; // Rough estimate: 32 bytes per data point
      } else if (chunk.isLoading) {
        loadingChunks++;
      }
    }

    return {
      totalChunks: this.state.chunks.size,
      loadedChunks,
      loadingChunks,
      memoryUsage,
    };
  }
}

/**
 * React hook for chart virtualization
 */
export function useChartVirtualization(
  totalDataPoints: number,
  chunkSize: number,
  dataLoader: (startIndex: number, endIndex: number) => Promise<DataPoint[]>
) {
  const virtualizerRef = React.useRef<ChartVirtualizer | null>(null);
  const [state, setState] = React.useState<VirtualizationState | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const virtualizer = new ChartVirtualizer(
      totalDataPoints,
      chunkSize,
      2, // preloadChunks
      dataLoader
    );

    const unsubscribe = virtualizer.subscribe(setState);
    virtualizerRef.current = virtualizer;

    return () => {
      unsubscribe();
      virtualizer.clearCache();
    };
  }, [totalDataPoints, chunkSize, dataLoader]);

  const updateViewport = React.useCallback(async (viewport: ViewportInfo) => {
    if (!virtualizerRef.current) return [];

    setIsLoading(true);
    try {
      const data = await virtualizerRef.current.updateVisibleRange(viewport);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const preloadRange = React.useCallback(async (startTime: number, endTime: number) => {
    if (!virtualizerRef.current) return;
    
    await virtualizerRef.current.preloadAroundRange(startTime, endTime);
  }, []);

  const clearCache = React.useCallback(() => {
    if (!virtualizerRef.current) return;
    
    virtualizerRef.current.clearCache();
  }, []);

  const getCacheStats = React.useCallback(() => {
    if (!virtualizerRef.current) return null;
    
    return virtualizerRef.current.getCacheStats();
  }, []);

  return {
    state,
    isLoading,
    updateViewport,
    preloadRange,
    clearCache,
    getCacheStats,
  };
}

// Add React import for the hook
import React from 'react';