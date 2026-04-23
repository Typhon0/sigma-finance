/**
 * Apache ECharts configuration and utilities
 * Provides TypeScript definitions and configuration for analytics charts
 */

import type { ECharts, EChartsCoreOption } from "echarts";
import { getAssetTypeColor, getChartColors, getChartThemeColors } from "../chart-colors";

// Re-export types for easier imports
export type { ECharts, EChartsCoreOption as EChartsOption };

/**
 * Chart theme configuration for ECharts
 */
export interface EChartsTheme {
	backgroundColor: string;
	textColor: string;
	axisLineColor: string;
	splitLineColor: string;
	tooltipBackgroundColor: string;
	tooltipBorderColor: string;
	legendTextColor: string;
	gridBorderColor: string;
}

/**
 * Get ECharts theme based on current theme
 */
export function getEChartsTheme(_isDark: boolean = false): EChartsTheme {
	const colors = getChartThemeColors();

	return {
		backgroundColor: "transparent",
		textColor: colors.foreground,
		axisLineColor: colors.border,
		splitLineColor: colors.border,
		tooltipBackgroundColor: colors.card,
		tooltipBorderColor: colors.border,
		legendTextColor: colors.foreground,
		gridBorderColor: colors.border,
	};
}

/**
 * Default chart configuration
 */
export function getDefaultEChartsConfig(theme: EChartsTheme): Partial<EChartsCoreOption> {
	return {
		backgroundColor: theme.backgroundColor,
		textStyle: {
			color: theme.textColor,
			fontFamily: "Inter, system-ui, sans-serif",
		},
		tooltip: {
			backgroundColor: theme.tooltipBackgroundColor,
			borderColor: theme.tooltipBorderColor,
			borderWidth: 1,
			textStyle: {
				color: theme.textColor,
			},
			trigger: "axis",
			axisPointer: {
				type: "cross",
				crossStyle: {
					color: theme.axisLineColor,
				},
			},
		},
		legend: {
			textStyle: {
				color: theme.legendTextColor,
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			containLabel: true,
			borderColor: theme.gridBorderColor,
		},
		xAxis: {
			type: "category",
			boundaryGap: false,
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
			},
			splitLine: {
				lineStyle: {
					color: theme.splitLineColor,
				},
			},
		},
		yAxis: {
			type: "value",
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
			},
			splitLine: {
				lineStyle: {
					color: theme.splitLineColor,
				},
			},
		},
	};
}

/**
 * Performance line chart configuration
 */
export function createPerformanceLineChart(
	data: Array<{ date: string; value: number; label?: string }>,
	options: {
		title?: string;
		yAxisFormatter?: (value: number) => string;
		color?: string;
		smooth?: boolean;
	} = {},
): EChartsCoreOption {
	const theme = getEChartsTheme();
	const chartColors = getChartColors();
	const color = options.color || chartColors[0];

	return {
		...getDefaultEChartsConfig(theme),
		title: options.title
			? {
					text: options.title,
					textStyle: {
						color: theme.textColor,
						fontSize: 16,
						fontWeight: "normal",
					},
				}
			: undefined,
		xAxis: {
			type: "category",
			data: data.map((item) => item.date),
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
			},
		},
		yAxis: {
			type: "value",
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
				formatter: options.yAxisFormatter || ((value: number) => value.toString()),
			},
			splitLine: {
				lineStyle: {
					color: theme.splitLineColor,
				},
			},
		},
		series: [
			{
				type: "line",
				data: data.map((item) => item.value),
				smooth: options.smooth !== false,
				lineStyle: {
					color: color,
					width: 2,
				},
				itemStyle: {
					color: color,
				},
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{
								offset: 0,
								color: `${color}40`, // 25% opacity
							},
							{
								offset: 1,
								color: `${color}10`, // 6% opacity
							},
						],
					},
				},
			},
		],
	};
}

/**
 * Asset allocation pie chart configuration
 */
export function createAllocationPieChart(
	data: Array<{ name: string; value: number; assetType?: string }>,
	options: {
		title?: string;
		showPercentage?: boolean;
		innerRadius?: string;
	} = {},
): EChartsCoreOption {
	const theme = getEChartsTheme();
	const chartColors = getChartColors();

	const seriesData = data.map((item, index) => ({
		name: item.name,
		value: item.value,
		itemStyle: {
			color: item.assetType
				? getAssetTypeColor(item.assetType)
				: chartColors[index % chartColors.length],
		},
	}));

	return {
		...getDefaultEChartsConfig(theme),
		title: options.title
			? {
					text: options.title,
					textStyle: {
						color: theme.textColor,
						fontSize: 16,
						fontWeight: "normal",
					},
				}
			: undefined,
		tooltip: {
			backgroundColor: theme.tooltipBackgroundColor,
			borderColor: theme.tooltipBorderColor,
			borderWidth: 1,
			textStyle: {
				color: theme.textColor,
			},
			trigger: "item",
			formatter:
				options.showPercentage !== false ? "{a} <br/>{b}: {c} ({d}%)" : "{a} <br/>{b}: {c}",
		},
		legend: {
			orient: "vertical",
			left: "left",
			textStyle: {
				color: theme.legendTextColor,
			},
		},
		series: [
			{
				name: "Allocation",
				type: "pie",
				radius: options.innerRadius ? [options.innerRadius, "70%"] : "70%",
				center: ["50%", "50%"],
				data: seriesData,
				emphasis: {
					itemStyle: {
						shadowBlur: 10,
						shadowOffsetX: 0,
						shadowColor: "rgba(0, 0, 0, 0.5)",
					},
				},
				label: {
					color: theme.textColor,
				},
			},
		],
	};
}

/**
 * Portfolio comparison chart configuration
 */
export function createPortfolioComparisonChart(
	data: Array<{
		name: string;
		data: Array<{ date: string; value: number }>;
	}>,
	options: {
		title?: string;
		yAxisFormatter?: (value: number) => string;
	} = {},
): EChartsCoreOption {
	const theme = getEChartsTheme();
	const chartColors = getChartColors();

	const dates = data[0]?.data.map((item) => item.date) || [];

	return {
		...getDefaultEChartsConfig(theme),
		title: options.title
			? {
					text: options.title,
					textStyle: {
						color: theme.textColor,
						fontSize: 16,
						fontWeight: "normal",
					},
				}
			: undefined,
		xAxis: {
			type: "category",
			data: dates,
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
			},
		},
		yAxis: {
			type: "value",
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
				formatter: options.yAxisFormatter || ((value: number) => value.toString()),
			},
			splitLine: {
				lineStyle: {
					color: theme.splitLineColor,
				},
			},
		},
		series: data.map((portfolio, index) => ({
			name: portfolio.name,
			type: "line",
			data: portfolio.data.map((item) => item.value),
			smooth: true,
			lineStyle: {
				color: chartColors[index % chartColors.length],
				width: 2,
			},
			itemStyle: {
				color: chartColors[index % chartColors.length],
			},
		})),
	};
}

/**
 * Performance metrics bar chart configuration
 */
export function createMetricsBarChart(
	data: Array<{ name: string; value: number; target?: number }>,
	options: {
		title?: string;
		yAxisFormatter?: (value: number) => string;
		horizontal?: boolean;
	} = {},
): EChartsCoreOption {
	const theme = getEChartsTheme();
	const chartColors = getChartColors();

	const seriesData = data.map((item, index) => ({
		name: item.name,
		value: item.value,
		itemStyle: {
			color: chartColors[index % chartColors.length],
		},
	}));

	const config: EChartsCoreOption = {
		...getDefaultEChartsConfig(theme),
		title: options.title
			? {
					text: options.title,
					textStyle: {
						color: theme.textColor,
						fontSize: 16,
						fontWeight: "normal",
					},
				}
			: undefined,
		series: [
			{
				type: "bar",
				data: seriesData,
				barWidth: "60%",
			},
		],
	};

	if (options.horizontal) {
		config.xAxis = {
			type: "value",
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
				formatter: options.yAxisFormatter || ((value: number) => value.toString()),
			},
			splitLine: {
				lineStyle: {
					color: theme.splitLineColor,
				},
			},
		};
		config.yAxis = {
			type: "category",
			data: data.map((item) => item.name),
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
			},
		};
	} else {
		config.xAxis = {
			type: "category",
			data: data.map((item) => item.name),
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
			},
		};
		config.yAxis = {
			type: "value",
			axisLine: {
				lineStyle: {
					color: theme.axisLineColor,
				},
			},
			axisLabel: {
				color: theme.textColor,
				formatter: options.yAxisFormatter || ((value: number) => value.toString()),
			},
			splitLine: {
				lineStyle: {
					color: theme.splitLineColor,
				},
			},
		};
	}

	return config;
}

/**
 * Treemap chart for hierarchical data
 */
export function createTreemapChart(
	data: Array<{
		name: string;
		value: number;
		children?: Array<{ name: string; value: number }>;
	}>,
	options: {
		title?: string;
	} = {},
): EChartsCoreOption {
	const theme = getEChartsTheme();
	const _chartColors = getChartColors();

	return {
		...getDefaultEChartsConfig(theme),
		title: options.title
			? {
					text: options.title,
					textStyle: {
						color: theme.textColor,
						fontSize: 16,
						fontWeight: "normal",
					},
				}
			: undefined,
		series: [
			{
				type: "treemap",
				data: data,
				roam: false,
				nodeClick: false,
				breadcrumb: {
					show: false,
				},
				label: {
					show: true,
					formatter: "{b}",
					color: theme.textColor,
				},
				itemStyle: {
					borderColor: theme.gridBorderColor,
					borderWidth: 2,
				},
				levels: [
					{
						itemStyle: {
							borderColor: theme.gridBorderColor,
							borderWidth: 2,
						},
					},
					{
						colorSaturation: [0.35, 0.5],
						itemStyle: {
							borderWidth: 5,
							gapWidth: 1,
							borderColorSaturation: 0.6,
						},
					},
				],
			},
		],
	};
}

/**
 * Chart performance optimization utilities for ECharts
 */
export class EChartsPerformanceManager {
	private static readonly MAX_DATA_POINTS = 1000;

	/**
	 * Sample data for performance when dataset is too large
	 */
	static sampleData<T>(
		data: T[],
		maxPoints: number = EChartsPerformanceManager.MAX_DATA_POINTS,
	): T[] {
		if (data.length <= maxPoints) {
			return data;
		}

		const step = Math.ceil(data.length / maxPoints);
		const sampled: T[] = [];

		for (let i = 0; i < data.length; i += step) {
			sampled.push(data[i]);
		}

		return sampled;
	}

	/**
	 * Get performance optimized options
	 */
	static getPerformanceOptions(): Partial<EChartsCoreOption> {
		return {
			animation: false, // Disable animations for large datasets
			progressive: 400, // Progressive rendering threshold
			progressiveThreshold: 3000, // Progressive rendering threshold
		};
	}
}

/**
 * Chart data formatting utilities
 */
export class EChartsDataFormatter {
	/**
	 * Format currency values
	 */
	static formatCurrency(value: number, currency: string = "USD"): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value);
	}

	/**
	 * Format percentage values
	 */
	static formatPercentage(value: number, decimals: number = 2): string {
		return `${value.toFixed(decimals)}%`;
	}

	/**
	 * Format large numbers with suffixes
	 */
	static formatLargeNumber(value: number): string {
		if (Math.abs(value) >= 1e9) {
			return `${(value / 1e9).toFixed(1)}B`;
		}
		if (Math.abs(value) >= 1e6) {
			return `${(value / 1e6).toFixed(1)}M`;
		}
		if (Math.abs(value) >= 1e3) {
			return `${(value / 1e3).toFixed(1)}K`;
		}
		return value.toString();
	}

	/**
	 * Format date for chart axes
	 */
	static formatDate(date: string | Date, format: "short" | "medium" | "long" = "short"): string {
		const d = new Date(date);

		switch (format) {
			case "short":
				return d.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				});
			case "medium":
				return d.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
			case "long":
				return d.toLocaleDateString("en-US", {
					weekday: "short",
					month: "short",
					day: "numeric",
					year: "numeric",
				});
			default:
				return d.toLocaleDateString();
		}
	}
}
