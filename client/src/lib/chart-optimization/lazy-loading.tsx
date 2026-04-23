/**
 * Lazy loading utilities for chart libraries and heavy components
 */

import React, { type ComponentType, type LazyExoticComponent, lazy } from "react";

// Chart library lazy imports with error boundaries
export const LazyLightweightCharts = lazy(() =>
	import("lightweight-charts")
		.then((_module) => ({
			default: (props: Record<string, unknown>) => {
				return <div {...props} />;
			},
		}))
		.catch((error) => {
			throw error;
		}),
) as unknown as React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>;

export const LazyECharts = lazy(() =>
	import("echarts-for-react")
		.then((module) => ({
			default: module.default,
		}))
		.catch((error) => {
			throw error;
		}),
);

// Dashboard component lazy imports
// Using safe fallbacks for components that might be in migration
export const LazyAssetAllocationChart = lazy(
	() =>
		import("../../components/AssetDistributionChart") as unknown as Promise<{
			default: React.ComponentType<Record<string, unknown>>;
		}>,
);

export const LazyPerformanceChart = lazy(
	() =>
		import("../../components/Analytics") as unknown as Promise<{
			default: React.ComponentType<Record<string, unknown>>;
		}>,
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
				rootMargin: options.rootMargin ?? "50px",
			},
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
	options: LazyLoadOptions = {},
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
			<div ref={elementRef as React.RefObject<HTMLDivElement | null>} className="min-h-[200px]">
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
				) : options.fallback ? (
					<options.fallback />
				) : (
					<div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
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
	private loadedLibraries = new Map<string, Record<string, unknown>>();
	private loadingPromises = new Map<string, Promise<unknown>>();

	static getInstance(): ChartLibraryLoader {
		if (!ChartLibraryLoader.instance) {
			ChartLibraryLoader.instance = new ChartLibraryLoader();
		}
		return ChartLibraryLoader.instance;
	}

	async loadLightweightCharts(): Promise<unknown> {
		const key = "lightweight-charts";

		if (this.loadedLibraries.has(key)) {
			return this.loadedLibraries.get(key);
		}

		if (this.loadingPromises.has(key)) {
			return this.loadingPromises.get(key);
		}

		const loadPromise = import("lightweight-charts")
			.then((module) => {
				this.loadedLibraries.set(key, module);
				return module;
			})
			.catch((error) => {
				throw error;
			})
			.finally(() => {
				this.loadingPromises.delete(key);
			});

		this.loadingPromises.set(key, loadPromise);
		return loadPromise;
	}

	async loadECharts(): Promise<unknown> {
		const key = "echarts";

		if (this.loadedLibraries.has(key)) {
			return this.loadedLibraries.get(key);
		}

		if (this.loadingPromises.has(key)) {
			return this.loadingPromises.get(key);
		}

		const loadPromise = Promise.all([
			import("echarts").catch(() => ({})),
			import("echarts-for-react"),
		])
			.then(([echarts, echartsForReact]) => {
				const module = { echarts, ReactECharts: echartsForReact.default };
				this.loadedLibraries.set(key, module);
				return module;
			})
			.catch((error) => {
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

	getLibrary(library: string): Record<string, unknown> | undefined {
		return this.loadedLibraries.get(library);
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
export function useChartLibrary(library: "lightweight-charts" | "echarts") {
	const [isLoaded, setIsLoaded] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<Error | null>(null);
	const [libraryModule, setLibraryModule] = React.useState<Record<string, unknown> | null>(null);

	const loader = ChartLibraryLoader.getInstance();

	const loadLibrary = React.useCallback(async () => {
		if (loader.isLoaded(library)) {
			setLibraryModule(loader.getLibrary(library) ?? null);
			setIsLoaded(true);
			return;
		}

		if (loader.isLoading(library)) {
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			let module: Record<string, unknown> | null;
			if (library === "lightweight-charts") {
				module = (await loader.loadLightweightCharts()) as Record<string, unknown>;
			} else {
				module = (await loader.loadECharts()) as Record<string, unknown>;
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
