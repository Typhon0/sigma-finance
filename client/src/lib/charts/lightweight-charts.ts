/**
 * Lightweight Charts™ configuration and utilities
 * Provides TypeScript definitions and configuration for candlestick charts
 */

import {
	type AreaData,
	type AreaSeriesOptions,
	type CandlestickData,
	type CandlestickSeriesOptions,
	type ChartOptions,
	ColorType,
	CrosshairMode,
	createChart,
	type DeepPartial,
	type HistogramData,
	type HistogramSeriesOptions,
	type IChartApi,
	type ISeriesApi,
	type LineData,
	type LineSeriesOptions,
	LineStyle,
	PriceScaleMode,
	type Time,
	type UTCTimestamp,
} from "lightweight-charts";

// Re-export types for easier imports
export type {
	AreaData,
	AreaSeriesOptions,
	CandlestickData,
	CandlestickSeriesOptions,
	ChartOptions,
	DeepPartial,
	HistogramData,
	HistogramSeriesOptions,
	IChartApi,
	ISeriesApi,
	LineData,
	LineSeriesOptions,
	Time,
	UTCTimestamp,
};

export { ColorType, CrosshairMode, createChart, LineStyle, PriceScaleMode };

/**
 * Chart theme configuration
 */
export interface ChartTheme {
	background: string;
	textColor: string;
	gridColor: string;
	crosshairColor: string;
	upColor: string;
	downColor: string;
	borderUpColor: string;
	borderDownColor: string;
	wickUpColor: string;
	wickDownColor: string;
}

/**
 * Light theme configuration
 */
export const LIGHT_THEME: ChartTheme = {
	background: "transparent",
	textColor: "#374151",
	gridColor: "#f3f4f6",
	crosshairColor: "#9ca3af",
	upColor: "#22c55e",
	downColor: "#ef4444",
	borderUpColor: "#22c55e",
	borderDownColor: "#ef4444",
	wickUpColor: "#22c55e",
	wickDownColor: "#ef4444",
};

/**
 * Dark theme configuration
 */
export const DARK_THEME: ChartTheme = {
	background: "transparent",
	textColor: "#d1d5db",
	gridColor: "#374151",
	crosshairColor: "#6b7280",
	upColor: "#22c55e",
	downColor: "#ef4444",
	borderUpColor: "#22c55e",
	borderDownColor: "#ef4444",
	wickUpColor: "#22c55e",
	wickDownColor: "#ef4444",
};

/**
 * Get chart theme based on current theme
 */
export function getChartTheme(isDark: boolean = false): ChartTheme {
	return isDark ? DARK_THEME : LIGHT_THEME;
}

/**
 * Default chart options
 */
export function getDefaultChartOptions(theme: ChartTheme): DeepPartial<ChartOptions> {
	return {
		layout: {
			background: {
				type: ColorType.Solid,
				color: theme.background,
			},
			textColor: theme.textColor,
		},
		grid: {
			vertLines: {
				color: theme.gridColor,
				style: LineStyle.Solid,
			},
			horzLines: {
				color: theme.gridColor,
				style: LineStyle.Solid,
			},
		},
		crosshair: {
			mode: CrosshairMode.Normal,
			vertLine: {
				color: theme.crosshairColor,
				width: 1,
				style: LineStyle.Dashed,
			},
			horzLine: {
				color: theme.crosshairColor,
				width: 1,
				style: LineStyle.Dashed,
			},
		},
		rightPriceScale: {
			borderColor: theme.gridColor,
			mode: PriceScaleMode.Normal,
		},
		timeScale: {
			borderColor: theme.gridColor,
			timeVisible: true,
			secondsVisible: false,
		},
		handleScroll: {
			mouseWheel: true,
			pressedMouseMove: true,
			horzTouchDrag: true,
			vertTouchDrag: true,
		},
		handleScale: {
			axisPressedMouseMove: true,
			mouseWheel: true,
			pinch: true,
		},
	};
}

/**
 * Default candlestick series options
 */
export function getDefaultCandlestickOptions(
	theme: ChartTheme,
): DeepPartial<CandlestickSeriesOptions> {
	return {
		upColor: theme.upColor,
		downColor: theme.downColor,
		borderUpColor: theme.borderUpColor,
		borderDownColor: theme.borderDownColor,
		wickUpColor: theme.wickUpColor,
		wickDownColor: theme.wickDownColor,
		priceFormat: {
			type: "price",
			precision: 2,
			minMove: 0.01,
		},
	};
}

/**
 * Default line series options
 */
export function getDefaultLineOptions(
	theme: ChartTheme,
	color?: string,
): DeepPartial<LineSeriesOptions> {
	return {
		color: color || theme.upColor,
		lineWidth: 2,
		priceFormat: {
			type: "price",
			precision: 2,
			minMove: 0.01,
		},
	};
}

/**
 * Default area series options
 */
export function getDefaultAreaOptions(
	theme: ChartTheme,
	color?: string,
): DeepPartial<AreaSeriesOptions> {
	const baseColor = color || theme.upColor;
	return {
		topColor: `${baseColor}80`, // 50% opacity
		bottomColor: `${baseColor}10`, // 6% opacity
		lineColor: baseColor,
		lineWidth: 2,
		priceFormat: {
			type: "price",
			precision: 2,
			minMove: 0.01,
		},
	};
}

/**
 * Default volume histogram options
 */
export function getDefaultVolumeOptions(theme: ChartTheme): DeepPartial<HistogramSeriesOptions> {
	return {
		color: theme.textColor,
		priceFormat: {
			type: "volume",
		},
		priceScaleId: "volume",
	};
}

/**
 * Time range presets for chart navigation
 */
export const TIME_RANGES = {
	"1D": { label: "1D", days: 1 },
	"1W": { label: "1W", days: 7 },
	"1M": { label: "1M", days: 30 },
	"3M": { label: "3M", days: 90 },
	"6M": { label: "6M", days: 180 },
	"1Y": { label: "1Y", days: 365 },
	ALL: { label: "ALL", days: null },
} as const;

export type TimeRange = keyof typeof TIME_RANGES;

/**
 * Convert timestamp to Lightweight Charts time format
 */
export function toChartTime(timestamp: string | number | Date): UTCTimestamp {
	const date = new Date(timestamp);
	return Math.floor(date.getTime() / 1000) as UTCTimestamp;
}

/**
 * Format price for display
 */
export function formatPrice(price: number, precision: number = 2): string {
	return price.toFixed(precision);
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
	if (volume >= 1e9) {
		return `${(volume / 1e9).toFixed(1)}B`;
	}
	if (volume >= 1e6) {
		return `${(volume / 1e6).toFixed(1)}M`;
	}
	if (volume >= 1e3) {
		return `${(volume / 1e3).toFixed(1)}K`;
	}
	return volume.toString();
}

/**
 * Chart data validation utilities
 */
// biome-ignore lint/suspicious/noExplicitAny: unavoidable
export function validateCandlestickData(data: any[]): CandlestickData[] {
	return data
		.filter(
			(item) =>
				item &&
				typeof item.time !== "undefined" &&
				typeof item.open === "number" &&
				typeof item.high === "number" &&
				typeof item.low === "number" &&
				typeof item.close === "number" &&
				item.high >= Math.max(item.open, item.close) &&
				item.low <= Math.min(item.open, item.close),
		)
		.map((item) => ({
			time: toChartTime(item.time),
			open: item.open,
			high: item.high,
			low: item.low,
			close: item.close,
		}))
		.sort((a, b) => (a.time as number) - (b.time as number));
}

/**
 * Chart performance optimization utilities
 */
export class ChartPerformanceManager {
	private static readonly MAX_DATA_POINTS = 5000;
	private static readonly SAMPLE_THRESHOLD = 10000;

	/**
	 * Sample data for performance when dataset is too large
	 */
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	static sampleData<T extends { time: any }>(
		data: T[],
		maxPoints: number = ChartPerformanceManager.MAX_DATA_POINTS,
	): T[] {
		if (data.length <= maxPoints) {
			return data;
		}

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
	 * Check if data should be sampled
	 */
	static shouldSampleData(dataLength: number): boolean {
		return dataLength > ChartPerformanceManager.SAMPLE_THRESHOLD;
	}

	/**
	 * Optimize chart options for performance
	 */
	static getPerformanceOptimizedOptions(): DeepPartial<ChartOptions> {
		return {
			handleScroll: {
				mouseWheel: true,
				pressedMouseMove: true,
				horzTouchDrag: true,
				vertTouchDrag: false, // Disable vertical touch drag for better performance
			},
			handleScale: {
				axisPressedMouseMove: true,
				mouseWheel: true,
				pinch: true,
			},
			crosshair: {
				mode: CrosshairMode.Normal,
			},
		};
	}
}

/**
 * Chart resize observer utility
 */
export class ChartResizeObserver {
	private observer: ResizeObserver | null = null;
	private chart: IChartApi | null = null;

	constructor(chart: IChartApi, container: HTMLElement) {
		this.chart = chart;

		if (typeof ResizeObserver !== "undefined") {
			this.observer = new ResizeObserver(() => {
				if (this.chart && container) {
					this.chart.applyOptions({
						width: container.clientWidth,
						height: container.clientHeight,
					});
				}
			});

			this.observer.observe(container);
		}
	}

	disconnect(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		this.chart = null;
	}
}
