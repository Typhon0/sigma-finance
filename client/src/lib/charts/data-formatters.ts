/**
 * Chart data formatting utilities
 * Provides data transformation and formatting for both Lightweight Charts™ and Apache ECharts
 */

import { format, subDays, subMonths, subYears } from "date-fns";
import type { ChartTimeRange } from "./config";
import type {
	AreaData,
	CandlestickData,
	HistogramData,
	LineData,
	UTCTimestamp,
} from "./lightweight-charts";

/**
 * Raw market data interfaces
 */
export interface RawPriceData {
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

export interface RawPerformanceData {
	date: string;
	value: number;
	portfolioId?: string;
	assetId?: string;
}

export interface RawAllocationData {
	name: string;
	value: number;
	percentage: number;
	assetType: string;
	color?: string;
}

export interface RawTransactionData {
	id: string;
	date: string;
	type: string;
	amount: number;
	quantity?: number;
	price?: number;
	assetName: string;
	portfolioName: string;
}

/**
 * Lightweight Charts data formatters
 */
export class LightweightChartsFormatter {
	/**
	 * Convert raw price data to candlestick format
	 */
	static toCandlestickData(data: RawPriceData[]): CandlestickData[] {
		return data
			.filter((item) => item?.timestamp && typeof item.open === "number")
			.map((item) => ({
				time: LightweightChartsFormatter.toChartTime(item.timestamp),
				open: item.open,
				high: item.high,
				low: item.low,
				close: item.close,
			}))
			.sort((a, b) => (a.time as number) - (b.time as number));
	}

	/**
	 * Convert performance data to line format
	 */
	static toLineData(data: RawPerformanceData[]): LineData[] {
		return data
			.filter((item) => item?.date && typeof item.value === "number")
			.map((item) => ({
				time: LightweightChartsFormatter.toChartTime(item.date),
				value: item.value,
			}))
			.sort((a, b) => (a.time as number) - (b.time as number));
	}

	/**
	 * Convert performance data to area format
	 */
	static toAreaData(data: RawPerformanceData[]): AreaData[] {
		return data
			.filter((item) => item?.date && typeof item.value === "number")
			.map((item) => ({
				time: LightweightChartsFormatter.toChartTime(item.date),
				value: item.value,
			}))
			.sort((a, b) => (a.time as number) - (b.time as number));
	}

	/**
	 * Convert volume data to histogram format
	 */
	static toHistogramData(data: RawPriceData[]): HistogramData[] {
		return data
			.filter((item) => item?.timestamp && typeof item.volume === "number")
			.map((item) => ({
				time: LightweightChartsFormatter.toChartTime(item.timestamp),
				value: item.volume!,
				color: item.close >= item.open ? "#22c55e" : "#ef4444", // Green for up, red for down
			}))
			.sort((a, b) => (a.time as number) - (b.time as number));
	}

	/**
	 * Convert timestamp to Lightweight Charts time format
	 */
	private static toChartTime(timestamp: string | number | Date): UTCTimestamp {
		const date = new Date(timestamp);
		return Math.floor(date.getTime() / 1000) as UTCTimestamp;
	}
}

/**
 * ECharts data formatters
 */
export class EChartsFormatter {
	/**
	 * Format performance data for line charts
	 */
	static formatPerformanceData(data: RawPerformanceData[]): {
		dates: string[];
		values: number[];
		formattedData: Array<{ date: string; value: number; label?: string }>;
	} {
		const sortedData = data
			.filter((item) => item?.date && typeof item.value === "number")
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		return {
			dates: sortedData.map((item) =>
				EChartsFormatter.formatDateForAxis(item.date),
			),
			values: sortedData.map((item) => item.value),
			formattedData: sortedData.map((item) => ({
				date: EChartsFormatter.formatDateForAxis(item.date),
				value: item.value,
				label: EChartsFormatter.formatCurrency(item.value),
			})),
		};
	}

	/**
	 * Format allocation data for pie charts
	 */
	static formatAllocationData(data: RawAllocationData[]): Array<{
		name: string;
		value: number;
		percentage: number;
		assetType?: string;
		itemStyle?: { color: string };
	}> {
		return data
			.filter(
				(item) =>
					item?.name && typeof item.value === "number" && item.value > 0,
			)
			.map((item) => ({
				name: item.name,
				value: item.value,
				percentage: item.percentage,
				assetType: item.assetType,
				itemStyle: item.color ? { color: item.color } : undefined,
			}))
			.sort((a, b) => b.value - a.value);
	}

	/**
	 * Format multi-portfolio comparison data
	 */
	static formatComparisonData(
		portfolios: Array<{ name: string; data: RawPerformanceData[] }>,
	): Array<{
		name: string;
		data: Array<{ date: string; value: number }>;
	}> {
		return portfolios.map((portfolio) => ({
			name: portfolio.name,
			data: portfolio.data
				.filter((item) => item?.date && typeof item.value === "number")
				.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
				.map((item) => ({
					date: EChartsFormatter.formatDateForAxis(item.date),
					value: item.value,
				})),
		}));
	}

	/**
	 * Format transaction data for bar charts
	 */
	static formatTransactionData(data: RawTransactionData[]): Array<{
		name: string;
		value: number;
		type: string;
		date: string;
	}> {
		return data
			.filter((item) => item?.date && typeof item.amount === "number")
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
			.map((item) => ({
				name: `${item.assetName} (${item.type})`,
				value: Math.abs(item.amount),
				type: item.type,
				date: EChartsFormatter.formatDateForAxis(item.date),
			}));
	}

	/**
	 * Format date for chart axis
	 */
	private static formatDateForAxis(date: string | Date): string {
		const d = new Date(date);
		return format(d, "MMM dd");
	}

	/**
	 * Format currency values
	 */
	private static formatCurrency(
		value: number,
		currency: string = "USD",
	): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value);
	}
}

/**
 * Data aggregation utilities
 */
export class DataAggregator {
	/**
	 * Aggregate data by time period
	 */
	static aggregateByPeriod(
		data: RawPerformanceData[],
		period: "hour" | "day" | "week" | "month",
	): RawPerformanceData[] {
		const grouped = new Map<string, RawPerformanceData[]>();

		data.forEach((item) => {
			const date = new Date(item.date);
			let key: string;

			switch (period) {
				case "hour":
					key = format(date, "yyyy-MM-dd HH:00");
					break;
				case "day":
					key = format(date, "yyyy-MM-dd");
					break;
				case "week": {
					const weekStart = new Date(date);
					weekStart.setDate(date.getDate() - date.getDay());
					key = format(weekStart, "yyyy-MM-dd");
					break;
				}
				case "month":
					key = format(date, "yyyy-MM");
					break;
				default:
					key = format(date, "yyyy-MM-dd");
			}

			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)?.push(item);
		});

		return Array.from(grouped.entries()).map(([key, items]) => ({
			date: key,
			value: items[items.length - 1].value, // Use last value in period
			portfolioId: items[0].portfolioId,
			assetId: items[0].assetId,
		}));
	}

	/**
	 * Calculate moving average
	 */
	static calculateMovingAverage(
		data: RawPerformanceData[],
		window: number,
	): RawPerformanceData[] {
		if (data.length < window) return data;

		const result: RawPerformanceData[] = [];

		for (let i = window - 1; i < data.length; i++) {
			const slice = data.slice(i - window + 1, i + 1);
			const average = slice.reduce((sum, item) => sum + item.value, 0) / window;

			result.push({
				...data[i],
				value: average,
			});
		}

		return result;
	}

	/**
	 * Calculate percentage change
	 */
	static calculatePercentageChange(
		data: RawPerformanceData[],
	): RawPerformanceData[] {
		if (data.length < 2) return data;

		const result: RawPerformanceData[] = [data[0]];

		for (let i = 1; i < data.length; i++) {
			const current = data[i];
			const previous = data[i - 1];
			const change = ((current.value - previous.value) / previous.value) * 100;

			result.push({
				...current,
				value: change,
			});
		}

		return result;
	}

	/**
	 * Resample data to reduce points
	 */
	static resampleData<T extends { date: string }>(
		data: T[],
		maxPoints: number,
	): T[] {
		if (data.length <= maxPoints) return data;

		const step = Math.ceil(data.length / maxPoints);
		const resampled: T[] = [];

		for (let i = 0; i < data.length; i += step) {
			resampled.push(data[i]);
		}

		// Always include the last point
		if (resampled[resampled.length - 1] !== data[data.length - 1]) {
			resampled.push(data[data.length - 1]);
		}

		return resampled;
	}
}

/**
 * Time range utilities
 */
export class TimeRangeUtils {
	/**
	 * Filter data by time range
	 */
	static filterByTimeRange<T extends { date: string }>(
		data: T[],
		range: ChartTimeRange,
	): T[] {
		if (range === "ALL") return data;

		const now = new Date();
		let startDate: Date;

		switch (range) {
			case "1H":
				startDate = new Date(now.getTime() - 60 * 60 * 1000);
				break;
			case "4H":
				startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
				break;
			case "1D":
				startDate = subDays(now, 1);
				break;
			case "1W":
				startDate = subDays(now, 7);
				break;
			case "1M":
				startDate = subMonths(now, 1);
				break;
			case "3M":
				startDate = subMonths(now, 3);
				break;
			case "6M":
				startDate = subMonths(now, 6);
				break;
			case "1Y":
				startDate = subYears(now, 1);
				break;
			default:
				return data;
		}

		return data.filter((item) => new Date(item.date) >= startDate);
	}

	/**
	 * Get appropriate data aggregation period for time range
	 */
	static getAggregationPeriod(
		range: ChartTimeRange,
	): "hour" | "day" | "week" | "month" {
		switch (range) {
			case "1H":
			case "4H":
				return "hour";
			case "1D":
			case "1W":
				return "day";
			case "1M":
			case "3M":
				return "week";
			case "6M":
			case "1Y":
			case "ALL":
				return "month";
			default:
				return "day";
		}
	}

	/**
	 * Generate date labels for time range
	 */
	static generateDateLabels(
		range: ChartTimeRange,
		count: number = 10,
	): string[] {
		const now = new Date();
		const labels: string[] = [];

		let interval: number;
		let formatStr: string;

		switch (range) {
			case "1H":
				interval = 6 * 60 * 1000; // 6 minutes
				formatStr = "HH:mm";
				break;
			case "4H":
				interval = 24 * 60 * 1000; // 24 minutes
				formatStr = "HH:mm";
				break;
			case "1D":
				interval = 2.4 * 60 * 60 * 1000; // 2.4 hours
				formatStr = "HH:mm";
				break;
			case "1W":
				interval = 24 * 60 * 60 * 1000; // 1 day
				formatStr = "MMM dd";
				break;
			case "1M":
				interval = 3 * 24 * 60 * 60 * 1000; // 3 days
				formatStr = "MMM dd";
				break;
			case "3M":
				interval = 9 * 24 * 60 * 60 * 1000; // 9 days
				formatStr = "MMM dd";
				break;
			case "6M":
				interval = 18 * 24 * 60 * 60 * 1000; // 18 days
				formatStr = "MMM dd";
				break;
			case "1Y":
				interval = 36.5 * 24 * 60 * 60 * 1000; // ~1 month
				formatStr = "MMM yyyy";
				break;
			default:
				interval = 24 * 60 * 60 * 1000; // 1 day
				formatStr = "MMM dd";
		}

		for (let i = 0; i < count; i++) {
			const date = new Date(now.getTime() - (count - 1 - i) * interval);
			labels.push(format(date, formatStr));
		}

		return labels;
	}
}

/**
 * Data validation utilities
 */
export class DataValidator {
	/**
	 * Validate price data
	 */
	static validatePriceData(data: any[]): {
		valid: boolean;
		errors: string[];
		cleanData: RawPriceData[];
	} {
		const errors: string[] = [];
		const cleanData: RawPriceData[] = [];

		data.forEach((item, index) => {
			if (!item) {
				errors.push(`Item ${index} is null or undefined`);
				return;
			}

			if (!item.timestamp) {
				errors.push(`Item ${index} missing timestamp`);
				return;
			}

			if (
				typeof item.open !== "number" ||
				typeof item.high !== "number" ||
				typeof item.low !== "number" ||
				typeof item.close !== "number"
			) {
				errors.push(`Item ${index} has invalid price data`);
				return;
			}

			if (
				item.high < Math.max(item.open, item.close) ||
				item.low > Math.min(item.open, item.close)
			) {
				errors.push(
					`Item ${index} has invalid price relationships (high/low vs open/close)`,
				);
				return;
			}

			cleanData.push({
				timestamp: item.timestamp,
				open: item.open,
				high: item.high,
				low: item.low,
				close: item.close,
				volume: typeof item.volume === "number" ? item.volume : undefined,
			});
		});

		return {
			valid: errors.length === 0,
			errors,
			cleanData,
		};
	}

	/**
	 * Validate performance data
	 */
	static validatePerformanceData(data: any[]): {
		valid: boolean;
		errors: string[];
		cleanData: RawPerformanceData[];
	} {
		const errors: string[] = [];
		const cleanData: RawPerformanceData[] = [];

		data.forEach((item, index) => {
			if (!item) {
				errors.push(`Item ${index} is null or undefined`);
				return;
			}

			if (!item.date) {
				errors.push(`Item ${index} missing date`);
				return;
			}

			if (typeof item.value !== "number") {
				errors.push(`Item ${index} has invalid value (must be number)`);
				return;
			}

			cleanData.push({
				date: item.date,
				value: item.value,
				portfolioId: item.portfolioId,
				assetId: item.assetId,
			});
		});

		return {
			valid: errors.length === 0,
			errors,
			cleanData,
		};
	}

	/**
	 * Validate allocation data
	 */
	static validateAllocationData(data: any[]): {
		valid: boolean;
		errors: string[];
		cleanData: RawAllocationData[];
	} {
		const errors: string[] = [];
		const cleanData: RawAllocationData[] = [];

		data.forEach((item, index) => {
			if (!item) {
				errors.push(`Item ${index} is null or undefined`);
				return;
			}

			if (!item.name) {
				errors.push(`Item ${index} missing name`);
				return;
			}

			if (typeof item.value !== "number" || item.value < 0) {
				errors.push(
					`Item ${index} has invalid value (must be positive number)`,
				);
				return;
			}

			cleanData.push({
				name: item.name,
				value: item.value,
				percentage: typeof item.percentage === "number" ? item.percentage : 0,
				assetType: item.assetType || "OTHER",
				color: item.color,
			});
		});

		return {
			valid: errors.length === 0,
			errors,
			cleanData,
		};
	}
}
