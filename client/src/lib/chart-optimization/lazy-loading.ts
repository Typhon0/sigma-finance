/**
 * Lazy loading utilities for chart libraries and heavy components
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

// Chart library lazy imports with error boundaries
export const LazyLightweightCharts = lazy(() => 
  import('lightweight-charts').then(module => ({
    default: module.createChart
  })).catch(error => {
    console.error('Failed to load Lightweight Charts:', error);
    throw error;
  })
);

export const LazyECharts = lazy(() => 
  import('echarts-for-react').then(module => ({
    default: module.default
  })).catch(error => {
    console.error('Failed to load ECharts:', error);
    throw error;
  })
);

// Dashboard component lazy imports
export const LazyAssetAllocationChart = lazy(() => 
  import('@/components/dashboard/asset-allocation-chart').then(module => ({
    default: module.AssetAllocationChart
  }))
);

export const LazyPerformanceChart = lazy(() => 
  import('@/components/dashboard/performance-chart').then(module => ({
    default: module.PerformanceChart
  }))
);

export const LazyPortfolioComparisonChart = lazy(() => 
  import('@/components/dashboard/portfolio-comparison-chart').then(module => ({
    default: module.PortfolioComparisonChart
  }))
);

export const LazyAssetPriceChart = lazy(() => 
  import('@/components/charts/asset-price-chart').then(module => ({
    default: module.AssetPriceChart
  }))
);

// Heavy data components
export const LazyTransactionHistory = lazy(() => 
  import('@/components/transactions/transaction-history').then(module => ({
    default: module.TransactionHistory
  }))
);

export const LazyAssetDetailView = lazy(() => 
  import('@/components/assets/asset-detail-view').then(module => ({
    default: module.AssetDetailView
  }))
);

/**
 * Intersection Observer based lazy loading for components
 */
export interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  fallback?: ComponentType;
  errorBoundary?: ComponentType<{ error: Error; retry: () => void }>;
}

export function useLazyLoad(options: LazyLoadOptions = {}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const elementRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasLoaded(true);
          
          if (options.triggerOnce !== false) {
            observer.unobserve(element);
          }
        } else if (options.triggerOnce === false) {
          setIsVisible(false);
        }
      },
      {
        threshold: options.threshold ?? 0.1,
        rootMargin: options.rootMargin ?? '50px',
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin, options.triggerOnce]);

  return {
    elementRef,
    isVisible,
    hasLoaded,
    shouldLoad: isVisible || hasLoaded,
  };
}

/**
 * HOC for lazy loading components with intersection observer
 */
export function withLazyLoad<P extends object>(
  Component: LazyExoticComponent<ComponentType<P>>,
  options: LazyLoadOptions = {}
) {
  return function LazyLoadedComponent(props: P) {
    const { elementRef, shouldLoad } = useLazyLoad(options);
    const [error, setError] = React.useState<Error | null>(null);

    const handleRetry = React.useCallback(() => {
      setError(null);
    }, []);

    if (error && options.errorBoundary) {
      const ErrorBoundary = options.errorBoundary;
      return <ErrorBoundary error={error} retry={handleRetry} />;
    }

    return (
      <div ref={elementRef} className="min-h-[200px]">
        {shouldLoad ? (
          <React.Suspense 
            fallback={
              options.fallback ? (
                <options.fallback />
              ) : (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )
            }
          >
            <Component {...props} />
          </React.Suspense>
        ) : (
          options.fallback ? (
            <options.fallback />
          ) : (
            <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
          )
        )}
      </div>
    );
  };
}

/**
 * Chart library loader with caching and error handling
 */
class ChartLibraryLoader {
  private static instance: ChartLibraryLoader;
  private loadedLibraries = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();

  static getInstance(): ChartLibraryLoader {
    if (!ChartLibraryLoader.instance) {
      ChartLibraryLoader.instance = new ChartLibraryLoader();
    }
    return ChartLibraryLoader.instance;
  }

  async loadLightweightCharts(): Promise<any> {
    const key = 'lightweight-charts';
    
    if (this.loadedLibraries.has(key)) {
      return this.loadedLibraries.get(key);
    }

    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    const loadPromise = import('lightweight-charts')
      .then(module => {
        this.loadedLibraries.set(key, module);
        return module;
      })
      .catch(error => {
        console.error('Failed to load Lightweight Charts:', error);
        throw error;
      })
      .finally(() => {
        this.loadingPromises.delete(key);
      });

    this.loadingPromises.set(key, loadPromise);
    return loadPromise;
  }

  async loadECharts(): Promise<any> {
    const key = 'echarts';
    
    if (this.loadedLibraries.has(key)) {
      return this.loadedLibraries.get(key);
    }

    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    const loadPromise = Promise.all([
      import('echarts'),
      import('echarts-for-react')
    ])
      .then(([echarts, echartsForReact]) => {
        const module = { echarts, ReactECharts: echartsForReact.default };
        this.loadedLibraries.set(key, module);
        return module;
      })
      .catch(error => {
        console.error('Failed to load ECharts:', error);
        throw error;
      })
      .finally(() => {
        this.loadingPromises.delete(key);
      });

    this.loadingPromises.set(key, loadPromise);
    return loadPromise;
  }

  isLoaded(library: string): boolean {
    return this.loadedLibraries.has(library);
  }

  isLoading(library: string): boolean {
    return this.loadingPromises.has(library);
  }

  preloadLibraries(): void {
    // Preload commonly used libraries
    this.loadLightweightCharts().catch(() => {});
    this.loadECharts().catch(() => {});
  }

  clearCache(): void {
    this.loadedLibraries.clear();
    this.loadingPromises.clear();
  }
}

/**
 * Hook for loading chart libraries on demand
 */
export function useChartLibrary(library: 'lightweight-charts' | 'echarts') {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [libraryModule, setLibraryModule] = React.useState<any>(null);

  const loader = ChartLibraryLoader.getInstance();

  const loadLibrary = React.useCallback(async () => {
    if (loader.isLoaded(library)) {
      setLibraryModule(loader.loadedLibraries.get(library));
      setIsLoaded(true);
      return;
    }

    if (loader.isLoading(library)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let module;
      if (library === 'lightweight-charts') {
        module = await loader.loadLightweightCharts();
      } else {
        module = await loader.loadECharts();
      }
      
      setLibraryModule(module);
      setIsLoaded(true);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [library, loader]);

  React.useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const retry = React.useCallback(() => {
    setError(null);
    loadLibrary();
  }, [loadLibrary]);

  return {
    isLoaded,
    isLoading,
    error,
    library: libraryModule,
    retry,
  };
}

/**
 * Component for preloading chart libraries
 */
export function ChartLibraryPreloader({ 
  libraries = ['lightweight-charts', 'echarts'] as const,
  onLoad,
}: {
  libraries?: readonly ('lightweight-charts' | 'echarts')[];
  onLoad?: (library: string) => void;
}) {
  React.useEffect(() => {
    const loader = ChartLibraryLoader.getInstance();
    
    libraries.forEach(async (library) => {
      try {
        if (library === 'lightweight-charts') {
          await loader.loadLightweightCharts();
        } else {
          await loader.loadECharts();
        }
        onLoad?.(library);
      } catch (error) {
        console.error(`Failed to preload ${library}:`, error);
      }
    });
  }, [libraries, onLoad]);

  return null;
}

/**
 * Progressive loading for dashboard components
 */
export function useProgressiveLoading(components: string[], delay: number = 100) {
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let currentIndex = 0;

    const loadNext = () => {
      if (currentIndex < components.length) {
        setLoadedComponents(prev => new Set([...prev, components[currentIndex]]));
        currentIndex++;
        timeoutId = setTimeout(loadNext, delay);
      }
    };

    // Start loading after initial render
    timeoutId = setTimeout(loadNext, delay);

    return () => clearTimeout(timeoutId);
  }, [components, delay]);

  return {
    isComponentLoaded: (component: string) => loadedComponents.has(component),
    loadedCount: loadedComponents.size,
    totalCount: components.length,
    isComplete: loadedComponents.size === components.length,
  };
}

// Add React import
import React from 'react';