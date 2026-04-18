/**
 * Chart configuration utilities and theme management
 * Centralized configuration for both Lightweight Charts™ and Apache ECharts
 */

import { useTheme } from "next-themes";
import { useMemo } from "react";
import { getEChartsTheme } from "./echarts";
import { getChartTheme as getLightweightTheme } from "./lightweight-charts";

/**
 * Chart library types
 */
export type ChartLibrary = "lightweight" | "echarts";

/**
 * Chart type definitions
 */
export type ChartType =
	| "candlestick"
	| "line"
	| "area"
	| "pie"
	| "donut"
	| "bar"
	| "column"
	| "treemap"
	| "histogram";

/**
 * Time range options for charts
 */
export const CHART_TIME_RANGES = {
	"1H": { label: "1H", hours: 1 },
	"4H": { label: "4H", hours: 4 },
	"1D": { label: "1D", days: 1 },
	"1W": { label: "1W", days: 7 },
	"1M": { label: "1M", days: 30 },
	"3M": { label: "3M", days: 90 },
	"6M": { label: "6M", days: 180 },
	"1Y": { label: "1Y", days: 365 },
	ALL: { label: "ALL", days: null },
} as const;

export type ChartTimeRange = keyof typeof CHART_TIME_RANGES;

/**
 * Chart size presets
 */
export const CHART_SIZES = {
	small: { width: 300, height: 200 },
	medium: { width: 500, height: 300 },
	large: { width: 800, height: 400 },
	xlarge: { width: 1200, height: 600 },
} as const;

export type ChartSize = keyof typeof CHART_SIZES;

/**
 * Chart configuration interface
 */
export interface ChartConfig {
	library: ChartLibrary;
	type: ChartType;
	size: ChartSize | { width: number; height: number };
	timeRange?: ChartTimeRange;
	responsive?: boolean;
	showLegend?: boolean;
	showTooltip?: boolean;
	showGrid?: boolean;
	showAxis?: boolean;
	animation?: boolean;
	theme?: "light" | "dark" | "auto";
}

/**
 * Default chart configurations by type
 */
export const DEFAULT_CHART_CONFIGS: Record<ChartType, Partial<ChartConfig>> = {
	candlestick: {
		library: "lightweight",
		size: "large",
		responsive: true,
		showGrid: true,
		showAxis: true,
		animation: false,
	},
	line: {
		library: "echarts",
		size: "medium",
		responsive: true,
		showLegend: true,
		showTooltip: true,
		showGrid: true,
		showAxis: true,
		animation: true,
	},
	area: {
		library: "echarts",
		size: "medium",
		responsive: true,
		showLegend: true,
		showTooltip: true,
		showGrid: true,
		showAxis: true,
		animation: true,
	},
	pie: {
		library: "echarts",
		size: "medium",
		responsive: true,
		showLegend: true,
		showTooltip: true,
		showGrid: false,
		showAxis: false,
		animation: true,
	},
	donut: {
		library: "echarts",
		size: "medium",
		responsive: true,
		showLegend: true,
		showTooltip: true,
		showGrid: false,
		showAxis: false,
		animation: true,
	},
	bar: {
		library: "echarts",
		size: "medium",
		responsive: true,
		showLegend: false,
		showTooltip: true,
		showGrid: true,
		showAxis: true,
		animation: true,
	},
	column: {
		library: "echarts",
		size: "medium",
		responsive: true,
		showLegend: false,
		showTooltip: true,
		showGrid: true,
		showAxis: true,
		animation: true,
	},
	treemap: {
		library: "echarts",
		size: "large",
		responsive: true,
		showLegend: false,
		showTooltip: true,
		showGrid: false,
		showAxis: false,
		animation: true,
	},
	histogram: {
		library: "lightweight",
		size: "medium",
		responsive: true,
		showGrid: true,
		showAxis: true,
		animation: false,
	},
};

/**
 * Chart theme hook
 */
export function useChartTheme() {
	const { theme, systemTheme } = useTheme();

	const isDark = useMemo(() => {
		if (theme === "system") {
			return systemTheme === "dark";
		}
		return theme === "dark";
	}, [theme, systemTheme]);

	const lightweightTheme = useMemo(() => getLightweightTheme(isDark), [isDark]);
	const echartsTheme = useMemo(() => getEChartsTheme(isDark), [isDark]);

	return {
		isDark,
		lightweight: lightweightTheme,
		echarts: echartsTheme,
	};
}

/**
 * Chart configuration builder
 */
export class ChartConfigBuilder {
	private config: Partial<ChartConfig> = {};

	constructor(type: ChartType) {
		this.config = { ...DEFAULT_CHART_CONFIGS[type], type };
	}

	library(library: ChartLibrary): this {
		this.config.library = library;
		return this;
	}

	size(size: ChartSize | { width: number; height: number }): this {
		this.config.size = size;
		return this;
	}

	timeRange(range: ChartTimeRange): this {
		this.config.timeRange = range;
		return this;
	}

	responsive(responsive: boolean = true): this {
		this.config.responsive = responsive;
		return this;
	}

	legend(show: boolean = true): this {
		this.config.showLegend = show;
		return this;
	}

	tooltip(show: boolean = true): this {
		this.config.showTooltip = show;
		return this;
	}

	grid(show: boolean = true): this {
		this.config.showGrid = show;
		return this;
	}

	axis(show: boolean = true): this {
		this.config.showAxis = show;
		return this;
	}

	animation(enable: boolean = true): this {
		this.config.animation = enable;
		return this;
	}

	theme(theme: "light" | "dark" | "auto" = "auto"): this {
		this.config.theme = theme;
		return this;
	}

	build(): ChartConfig {
		return this.config as ChartConfig;
	}
}

/**
 * Create chart configuration
 */
export function createChartConfig(type: ChartType): ChartConfigBuilder {
	return new ChartConfigBuilder(type);
}

/**
 * Chart performance settings
 */
export interface ChartPerformanceSettings {
	maxDataPoints: number;
	enableSampling: boolean;
	enableVirtualization: boolean;
	enableLazyLoading: boolean;
	debounceMs: number;
	throttleMs: number;
}

/**
 * Default performance settings
 */
export const DEFAULT_PERFORMANCE_SETTINGS: ChartPerformanceSettings = {
	maxDataPoints: 5000,
	enableSampling: true,
	enableVirtualization: true,
	enableLazyLoading: true,
	debounceMs: 300,
	throttleMs: 100,
};

/**
 * Performance settings by chart type
 */
export const CHART_PERFORMANCE_SETTINGS: Record<
	ChartType,
	Partial<ChartPerformanceSettings>
> = {
	candlestick: {
		maxDataPoints: 10000,
		enableSampling: true,
		enableVirtualization: false,
		debounceMs: 100,
	},
	line: {
		maxDataPoints: 5000,
		enableSampling: true,
		enableVirtualization: true,
	},
	area: {
		maxDataPoints: 5000,
		enableSampling: true,
		enableVirtualization: true,
	},
	pie: {
		maxDataPoints: 100,
		enableSampling: false,
		enableVirtualization: false,
	},
	donut: {
		maxDataPoints: 100,
		enableSampling: false,
		enableVirtualization: false,
	},
	bar: {
		maxDataPoints: 1000,
		enableSampling: true,
		enableVirtualization: true,
	},
	column: {
		maxDataPoints: 1000,
		enableSampling: true,
		enableVirtualization: true,
	},
	treemap: {
		maxDataPoints: 500,
		enableSampling: false,
		enableVirtualization: false,
	},
	histogram: {
		maxDataPoints: 5000,
		enableSampling: true,
		enableVirtualization: false,
	},
};

/**
 * Get performance settings for chart type
 */
export function getPerformanceSettings(
	type: ChartType,
): ChartPerformanceSettings {
	return {
		...DEFAULT_PERFORMANCE_SETTINGS,
		...CHART_PERFORMANCE_SETTINGS[type],
	};
}

/**
 * Chart responsive breakpoints
 */
export const CHART_BREAKPOINTS = {
	xs: 0,
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	"2xl": 1536,
} as const;

/**
 * Responsive chart size calculator
 */
export function getResponsiveChartSize(
	containerWidth: number,
	aspectRatio: number = 16 / 9,
): { width: number; height: number } {
	const width = Math.min(containerWidth, 1200); // Max width
	const height = Math.max(width / aspectRatio, 200); // Min height

	return { width, height };
}

/**
 * Chart accessibility settings
 */
export interface ChartAccessibilitySettings {
	enableKeyboardNavigation: boolean;
	enableScreenReader: boolean;
	enableHighContrast: boolean;
	enableReducedMotion: boolean;
	ariaLabel?: string;
	ariaDescription?: string;
}

/**
 * Default accessibility settings
 */
export const DEFAULT_ACCESSIBILITY_SETTINGS: ChartAccessibilitySettings = {
	enableKeyboardNavigation: true,
	enableScreenReader: true,
	enableHighContrast: false,
	enableReducedMotion: false,
};

/**
 * Chart export settings
 */
export interface ChartExportSettings {
	formats: Array<"png" | "jpg" | "svg" | "pdf">;
	quality: number;
	backgroundColor: string;
	pixelRatio: number;
}

/**
 * Default export settings
 */
export const DEFAULT_EXPORT_SETTINGS: ChartExportSettings = {
	formats: ["png", "svg"],
	quality: 1,
	backgroundColor: "transparent",
	pixelRatio: 2,
};

/**
 * Chart validation utilities
 */
export class ChartValidator {
	/**
	 * Validate chart configuration
	 */
	static validateConfig(config: ChartConfig): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!config.type) {
			errors.push("Chart type is required");
		}

		if (!config.library) {
			errors.push("Chart library is required");
		}

		if (
			config.library === "lightweight" &&
			!["candlestick", "line", "area", "histogram"].includes(config.type)
		) {
			errors.push(
				`Chart type '${config.type}' is not supported by Lightweight Charts`,
			);
		}

		if (config.size && typeof config.size === "object") {
			if (config.size.width <= 0 || config.size.height <= 0) {
				errors.push("Chart dimensions must be positive numbers");
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Validate chart data
	 */
	static validateData(
		data: any[],
		type: ChartType,
	): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!Array.isArray(data)) {
			errors.push("Chart data must be an array");
			return { valid: false, errors };
		}

		if (data.length === 0) {
			errors.push("Chart data cannot be empty");
			return { valid: false, errors };
		}

		// Type-specific validation
		switch (type) {
			case "candlestick":
				data.forEach((item, index) => {
					if (
						!item.time ||
						!item.open ||
						!item.high ||
						!item.low ||
						!item.close
					) {
						errors.push(
							`Candlestick data item ${index} is missing required fields (time, open, high, low, close)`,
						);
					}
					if (
						item.high < Math.max(item.open, item.close) ||
						item.low > Math.min(item.open, item.close)
					) {
						errors.push(
							`Candlestick data item ${index} has invalid price relationships`,
						);
					}
				});
				break;

			case "line":
			case "area":
				data.forEach((item, index) => {
					if (typeof item.value !== "number") {
						errors.push(
							`Line/Area data item ${index} must have a numeric value`,
						);
					}
				});
				break;

			case "pie":
			case "donut":
				data.forEach((item, index) => {
					if (!item.name || typeof item.value !== "number" || item.value < 0) {
						errors.push(
							`Pie/Donut data item ${index} must have a name and positive numeric value`,
						);
					}
				});
				break;
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}
