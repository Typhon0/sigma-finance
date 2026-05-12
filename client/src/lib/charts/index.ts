/**
 * Chart libraries configuration and utilities
 * Centralized exports for Lightweight Charts™ and Apache ECharts integration
 */

import React from "react";

// Chart color utilities (re-export from existing file)
export {
	ASSET_TYPE_COLORS,
	getAssetTypeColor,
	getChartColors,
	getChartThemeColors,
	oklchToRgb,
} from "../chart-colors";
// Configuration utilities
export * from "./config";
// Data formatting utilities
export * from "./data-formatters";
// ECharts exports
export * from "./echarts";
// Lightweight Charts exports
export * from "./lightweight-charts";
// Re-export DataSampler type for convenience
export type {
	ChartLoadingState,
	ChartPerformanceMetrics as ChartPerformanceMetricsType,
} from "./performance";
// Performance utilities from performance.ts
export {
	ChartLazyLoader,
	ChartOptimizationRecommendations,
	ChartUpdateManager,
} from "./performance";
// Performance optimization types and classes
export type {
	PerformanceConfig as PerformanceOptimizationOptions,
	SamplingStrategy,
} from "./performance-optimization";
// Performance optimization utilities
export {
	ChartMemoryManager,
	ChartPerformanceMonitor,
	ChartVirtualizer,
	DataSampler,
} from "./performance-optimization";

// Real-time updates
export * from "./real-time-updates";
// Theming utilities
export * from "./theming";

/**
 * Chart library initialization
 */
export class ChartLibraryManager {
	private static initialized = false;
	private static lightweightChartsLoaded = false;
	private static echartsLoaded = false;

	/**
	 * Initialize chart libraries
	 */
	static async initialize(): Promise<void> {
		if (ChartLibraryManager.initialized) return;
		// Preload chart libraries
		await Promise.all([
			ChartLibraryManager.loadLightweightCharts(),
			ChartLibraryManager.loadECharts(),
		]);

		ChartLibraryManager.initialized = true;
	}

	/**
	 * Load Lightweight Charts library
	 */
	private static async loadLightweightCharts(): Promise<void> {
		if (ChartLibraryManager.lightweightChartsLoaded) return;
		await import("lightweight-charts");
		ChartLibraryManager.lightweightChartsLoaded = true;
	}

	/**
	 * Load ECharts library
	 */
	private static async loadECharts(): Promise<void> {
		if (ChartLibraryManager.echartsLoaded) return;
		await import("echarts-for-react");
		ChartLibraryManager.echartsLoaded = true;
	}

	/**
	 * Check if libraries are loaded
	 */
	static isInitialized(): boolean {
		return ChartLibraryManager.initialized;
	}

	/**
	 * Get library status
	 */
	static getStatus(): {
		initialized: boolean;
		lightweightCharts: boolean;
		echarts: boolean;
	} {
		return {
			initialized: ChartLibraryManager.initialized,
			lightweightCharts: ChartLibraryManager.lightweightChartsLoaded,
			echarts: ChartLibraryManager.echartsLoaded,
		};
	}
}

/**
 * Chart library feature detection
 */
export class ChartFeatureDetection {
	/**
	 * Check if WebGL is supported
	 */
	static isWebGLSupported(): boolean {
		try {
			const canvas = document.createElement("canvas");
			return !!(
				window.WebGLRenderingContext &&
				(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
			);
		} catch (_e) {
			return false;
		}
	}

	/**
	 * Check if Canvas is supported
	 */
	static isCanvasSupported(): boolean {
		try {
			const canvas = document.createElement("canvas");
			return !!canvas.getContext?.("2d");
		} catch (_e) {
			return false;
		}
	}

	/**
	 * Check if SVG is supported
	 */
	static isSVGSupported(): boolean {
		return !!document.createElementNS?.("http://www.w3.org/2000/svg", "svg").createSVGRect;
	}

	/**
	 * Check device capabilities
	 */
	static getDeviceCapabilities(): {
		webgl: boolean;
		canvas: boolean;
		svg: boolean;
		touchSupport: boolean;
		highDPI: boolean;
		performanceAPI: boolean;
	} {
		return {
			webgl: ChartFeatureDetection.isWebGLSupported(),
			canvas: ChartFeatureDetection.isCanvasSupported(),
			svg: ChartFeatureDetection.isSVGSupported(),
			touchSupport: "ontouchstart" in window,
			highDPI: window.devicePixelRatio > 1,
			performanceAPI: "performance" in window,
		};
	}

	/**
	 * Get recommended chart library based on capabilities
	 */
	static getRecommendedLibrary(chartType: string): "lightweight" | "echarts" {
		const capabilities = ChartFeatureDetection.getDeviceCapabilities();

		// Lightweight Charts is better for candlestick and real-time data
		if (["candlestick", "line", "area"].includes(chartType) && capabilities.canvas) {
			return "lightweight";
		}

		// ECharts is better for complex visualizations
		return "echarts";
	}
}

/**
 * Chart error handling utilities
 */
export class ChartErrorHandler {
	private static errorCallbacks = new Map<string, (error: Error) => void>();

	/**
	 * Register error callback for chart
	 */
	static registerErrorCallback(chartId: string, callback: (error: Error) => void): void {
		ChartErrorHandler.errorCallbacks.set(chartId, callback);
	}

	/**
	 * Handle chart error
	 */
	static handleError(chartId: string, error: Error): void {
		const callback = ChartErrorHandler.errorCallbacks.get(chartId);
		if (callback) {
			callback(error);
		}

		// Log to analytics or error reporting service
		ChartErrorHandler.logError(chartId, error);
	}

	/**
	 * Log error to external service
	 */
	private static logError(_chartId: string, _error: Error): void {}

	/**
	 * Create error boundary for charts
	 */
	static createErrorBoundary(
		fallbackComponent: React.ComponentType<{ error: Error }>,
	): React.ComponentType<{ children?: React.ReactNode }> {
		return class ChartErrorBoundary extends React.Component<
			{ children?: React.ReactNode },
			{ hasError: boolean; error?: Error }
		> {
			constructor(props: { children?: React.ReactNode }) {
				super(props);
				this.state = { hasError: false };
			}

			static getDerivedStateFromError(error: Error) {
				return { hasError: true, error };
			}

			componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
				ChartErrorHandler.logError("chart-boundary", error);
			}

			render() {
				if (this.state.hasError && this.state.error) {
					return React.createElement(fallbackComponent, {
						error: this.state.error,
					});
				}

				return this.props.children;
			}
		};
	}
}

/**
 * Chart accessibility utilities
 */
export class ChartAccessibility {
	/**
	 * Generate accessible description for chart data
	 */
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	static generateDescription(data: any[], chartType: string): string {
		const dataLength = data.length;

		switch (chartType) {
			case "line":
			case "area": {
				const values = data.map((d) => d.value).filter((v) => typeof v === "number");
				const min = Math.min(...values);
				const max = Math.max(...values);
				const trend = values[values.length - 1] > values[0] ? "increasing" : "decreasing";
				return `Line chart with ${dataLength} data points, ranging from ${min} to ${max}, showing an ${trend} trend.`;
			}

			case "pie":
			case "donut": {
				const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
				const segments = data.length;
				return `Pie chart with ${segments} segments, total value of ${total}.`;
			}

			case "bar":
			case "column": {
				const barValues = data.map((d) => d.value).filter((v) => typeof v === "number");
				const barMax = Math.max(...barValues);
				return `Bar chart with ${dataLength} bars, maximum value of ${barMax}.`;
			}

			case "candlestick":
				return `Candlestick chart with ${dataLength} price points showing market data over time.`;

			default:
				return `Chart with ${dataLength} data points.`;
		}
	}

	/**
	 * Generate keyboard navigation instructions
	 */
	static generateKeyboardInstructions(chartType: string): string {
		const baseInstructions =
			"Use arrow keys to navigate data points, Enter to select, Escape to exit.";

		switch (chartType) {
			case "candlestick":
				return `${baseInstructions} Use + and - to zoom in and out.`;
			case "pie":
			case "donut":
				return `${baseInstructions} Use Tab to cycle through segments.`;
			default:
				return baseInstructions;
		}
	}
}

// Initialize chart libraries on module load
if (typeof window !== "undefined") {
	ChartLibraryManager.initialize().catch((_err: unknown) => {});
}
