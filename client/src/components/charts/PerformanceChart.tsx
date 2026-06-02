import type { EChartsCoreOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	createPerformanceLineChart,
	EChartsDataFormatter,
	EChartsPerformanceManager,
} from "@/lib/charts/echarts";
import { cn } from "@/lib/utils";

export interface PerformanceDataPoint {
	date: string;
	value: number;
	label?: string;
}

export interface PerformanceChartProps {
	data: PerformanceDataPoint[];
	title?: string;
	chartType?: "line" | "area";
	timeRange?: string;
	height?: number;
	className?: string;
	showHeader?: boolean;
	showExport?: boolean;
	showFullscreen?: boolean;
	compact?: boolean;
	color?: string;
	yAxisFormatter?: (value: number) => string;
	onTimeRangeChange?: (range: string) => void;
	onExport?: (format: "png" | "svg") => void;
	loading?: boolean;
	error?: string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
	data,
	title = "Performance",
	chartType = "area",
	timeRange,
	height = 300,
	className,
	showHeader = true,
	showExport = true,
	showFullscreen = true,
	compact = false,
	color,
	yAxisFormatter = EChartsDataFormatter.formatCurrency,
	onTimeRangeChange,
	onExport,
	loading = false,
	error,
}) => {
	const chartRef = useRef<ReactECharts>(null);
	const [isFullscreen, setIsFullscreen] = React.useState(false);

	// Optimize data for performance
	const optimizedData = useMemo(() => {
		if (!data || data.length === 0) return [];
		return EChartsPerformanceManager.sampleData(data);
	}, [data]);

	// Create chart configuration
	const chartOption = useMemo((): EChartsCoreOption => {
		if (!optimizedData || optimizedData.length === 0) {
			return {};
		}

		const baseConfig = createPerformanceLineChart(optimizedData, {
			title: showHeader ? undefined : title,
			yAxisFormatter,
			color,
			smooth: chartType === "area",
		});

		// Add performance optimizations for large datasets
		if (optimizedData.length > 500) {
			Object.assign(baseConfig, EChartsPerformanceManager.getPerformanceOptions());
		}

		// Apply timeRange formatting to xAxis if timeRange is provided
		if (
			timeRange &&
			typeof baseConfig.xAxis === "object" &&
			baseConfig.xAxis &&
			!Array.isArray(baseConfig.xAxis)
		) {
			const xAxis = baseConfig.xAxis as any;
			const isShortTimeframe = ["24h", "24H", "1d", "1D"].includes(timeRange);

			xAxis.axisLabel = {
				...(xAxis.axisLabel || {}),
				formatter: (value: string) => {
					try {
						const date = new Date(value);
						if (isNaN(date.getTime())) return value;

						if (isShortTimeframe) {
							return date.toLocaleTimeString("en-US", {
								hour: "numeric",
								minute: "2-digit",
							});
						}

						// Default to local date string for longer timeframes
						return date.toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						});
					} catch (e) {
						return value;
					}
				},
			};
		}

		// Compact mode adjustments
		if (compact) {
			const grid = typeof baseConfig.grid === "object" && baseConfig.grid ? baseConfig.grid : {};
			const xAxis =
				typeof baseConfig.xAxis === "object" && baseConfig.xAxis && !Array.isArray(baseConfig.xAxis)
					? (baseConfig.xAxis as Record<string, unknown>)
					: {};
			const yAxis =
				typeof baseConfig.yAxis === "object" && baseConfig.yAxis && !Array.isArray(baseConfig.yAxis)
					? (baseConfig.yAxis as Record<string, unknown>)
					: {};
			return {
				...baseConfig,
				grid: {
					...grid,
					left: "5%",
					right: "5%",
					top: "10%",
					bottom: "15%",
				},
				xAxis: {
					...xAxis,
					axisLabel: {
						...((xAxis.axisLabel as Record<string, unknown>) || {}),
						fontSize: 10,
					},
				},
				yAxis: {
					...yAxis,
					axisLabel: {
						...((yAxis.axisLabel as Record<string, unknown>) || {}),
						fontSize: 10,
					},
				},
			} as EChartsCoreOption;
		}

		return baseConfig;
	}, [optimizedData, title, showHeader, yAxisFormatter, color, chartType, compact]);

	// Handle export functionality
	const handleExport = (format: "png" | "svg") => {
		if (chartRef.current) {
			const chartInstance = chartRef.current.getEchartsInstance();
			const dataUrl = chartInstance.getDataURL({
				type: format,
				pixelRatio: 2,
				backgroundColor: "#fff",
			});

			// Create download link
			const link = document.createElement("a");
			link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-chart.${format}`;
			link.href = dataUrl;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}

		onExport?.(format);
	};

	// Handle fullscreen toggle
	const toggleFullscreen = () => {
		setIsFullscreen(!isFullscreen);
	};

	// Resize chart when fullscreen changes
	useEffect(() => {
		if (chartRef.current) {
			const chartInstance = chartRef.current.getEchartsInstance();
			setTimeout(() => chartInstance.resize(), 100);
		}
	}, []);

	// Loading state
	if (loading) {
		return (
			<Card className={cn("w-full", className)}>
				{showHeader && (
					<CardHeader className="pb-3">
						<CardTitle className="text-lg font-semibold">{title}</CardTitle>
					</CardHeader>
				)}
				<CardContent>
					<div
						className="flex items-center justify-center bg-muted/50 rounded-lg"
						style={{ height }}
					>
						<div className="text-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
							<p className="text-sm text-muted-foreground">Loading chart data...</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={cn("w-full", className)}>
				{showHeader && (
					<CardHeader className="pb-3">
						<CardTitle className="text-lg font-semibold">{title}</CardTitle>
					</CardHeader>
				)}
				<CardContent>
					<div
						className="flex items-center justify-center bg-destructive/10 rounded-lg"
						style={{ height }}
					>
						<div className="text-center text-destructive">
							<p className="font-medium">Failed to load chart</p>
							<p className="text-sm">{error}</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	// No data state
	if (!optimizedData || optimizedData.length === 0) {
		return (
			<Card className={cn("w-full", className)}>
				{showHeader && (
					<CardHeader className="pb-3">
						<CardTitle className="text-lg font-semibold">{title}</CardTitle>
					</CardHeader>
				)}
				<CardContent>
					<div
						className="flex items-center justify-center bg-muted/50 rounded-lg"
						style={{ height }}
					>
						<div className="text-center text-muted-foreground">
							<p className="font-medium">No data available</p>
							<p className="text-sm">Performance data will appear here when available</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	const chartContent = (
		<ReactECharts
			ref={chartRef}
			option={chartOption}
			style={{
				height: isFullscreen ? "80vh" : height,
				width: "100%",
			}}
			opts={{
				renderer: "canvas",
			}}
		/>
	);

	if (!showHeader) {
		return <div className={cn("w-full", className)}>{chartContent}</div>;
	}

	return (
		<Card className={cn("w-full", isFullscreen && "fixed inset-4 z-50 bg-background", className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold">{title}</CardTitle>
					<div className="flex items-center gap-2">
						{/* Time range selector */}
						{onTimeRangeChange && (
							<div className="flex items-center gap-1">
								{["1D", "1W", "1M", "3M", "1Y", "ALL"].map((range) => (
									<Button
										key={range}
										variant={timeRange === range ? "default" : "ghost"}
										size="sm"
										className="h-7 px-2 text-xs"
										onClick={() => onTimeRangeChange(range)}
									>
										{range}
									</Button>
								))}
							</div>
						)}

						{/* Export button */}
						{showExport && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={() => handleExport("png")}
								title="Export chart"
							>
								<Download className="h-3 w-3" />
							</Button>
						)}

						{/* Fullscreen toggle */}
						{showFullscreen && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={toggleFullscreen}
								title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
							>
								{isFullscreen ? (
									<Minimize2 className="h-3 w-3" />
								) : (
									<Maximize2 className="h-3 w-3" />
								)}
							</Button>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="p-0">{chartContent}</CardContent>
		</Card>
	);
};

export default PerformanceChart;
