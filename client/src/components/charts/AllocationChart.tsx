import type { EChartsCoreOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { Download, Grid3X3, Maximize2, Minimize2, PieChart } from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssetTypeColor } from "@/lib/chart-colors";
import { createAllocationPieChart, createTreemapChart } from "@/lib/charts/echarts";
import { cn } from "@/lib/utils";

export interface AllocationDataPoint {
	name: string;
	value: number;
	assetType?: string;
	percentage?: number;
	children?: AllocationDataPoint[];
}

export interface AllocationChartProps {
	data: AllocationDataPoint[];
	title?: string;
	chartType?: "pie" | "donut" | "treemap";
	height?: number;
	className?: string;
	showHeader?: boolean;
	showExport?: boolean;
	showFullscreen?: boolean;
	showLabels?: boolean;
	showPercentage?: boolean;
	compact?: boolean;
	interactive?: boolean;
	onSegmentClick?: (data: AllocationDataPoint) => void;
	loading?: boolean;
	error?: string;
}

const AllocationChart: React.FC<AllocationChartProps> = ({
	data,
	title = "Asset Allocation",
	chartType = "donut",
	height = 300,
	className,
	showHeader = true,
	showExport = true,
	showFullscreen = true,
	showLabels: _showLabels = true,
	showPercentage = true,
	compact = false,
	interactive = true,
	onSegmentClick,
	loading = false,
	error,
}) => {
	const chartRef = useRef<ReactECharts>(null);
	const [isFullscreen, setIsFullscreen] = React.useState(false);
	const [currentChartType, setCurrentChartType] = React.useState(chartType);

	// Calculate percentages if not provided
	const processedData = useMemo(() => {
		if (!data || data.length === 0) return [];

		const total = data.reduce((sum, item) => sum + item.value, 0);

		return data.map((item) => ({
			...item,
			percentage: item.percentage ?? (total > 0 ? (item.value / total) * 100 : 0),
		}));
	}, [data]);

	// Create chart configuration
	const chartOption = useMemo((): EChartsCoreOption => {
		if (!processedData || processedData.length === 0) {
			return {};
		}

		let baseConfig: EChartsCoreOption;

		if (currentChartType === "treemap") {
			baseConfig = createTreemapChart(processedData, {
				title: showHeader ? undefined : title,
			});
		} else {
			baseConfig = createAllocationPieChart(processedData, {
				title: showHeader ? undefined : title,
				showPercentage,
				innerRadius: currentChartType === "donut" ? "40%" : undefined,
			});
		}

		// Add click handler for interactivity
		if (interactive && onSegmentClick) {
			baseConfig.series = (baseConfig.series as any[])?.map((series) => ({
				...series,
				emphasis: {
					...series.emphasis,
					focus: "self",
				},
			}));
		}

		// Compact mode adjustments
		if (compact) {
			if (currentChartType === "treemap") {
				return {
					...baseConfig,
					series: (baseConfig.series as any[])?.map((series) => ({
						...series,
						label: {
							...((series.label as object) || {}),
							fontSize: 10,
						},
					})),
				};
			} else {
				return {
					...baseConfig,
					legend: {
						...((baseConfig.legend as object) || {}),
						orient: "horizontal",
						bottom: 0,
						left: "center",
						textStyle: {
							fontSize: 10,
						},
					},
					series: (baseConfig.series as any[])?.map((series) => ({
						...series,
						radius: compact ? "60%" : "70%",
						center: ["50%", "45%"],
						label: {
							...((series.label as object) || {}),
							fontSize: 10,
						},
					})),
				};
			}
		}

		return baseConfig;
	}, [
		processedData,
		currentChartType,
		title,
		showHeader,
		showPercentage,
		compact,
		interactive,
		onSegmentClick,
	]);

	// Handle chart click events
	const handleChartClick = (params: any) => {
		if (interactive && onSegmentClick && params.data) {
			const clickedData = processedData.find((item) => item.name === params.data.name);
			if (clickedData) {
				onSegmentClick(clickedData);
			}
		}
	};

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
	};

	// Handle fullscreen toggle
	const toggleFullscreen = () => {
		setIsFullscreen(!isFullscreen);
	};

	// Handle chart type change
	const handleChartTypeChange = (type: "pie" | "donut" | "treemap") => {
		setCurrentChartType(type);
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
							<p className="text-sm text-muted-foreground">Loading allocation data...</p>
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
	if (!processedData || processedData.length === 0) {
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
							<p className="font-medium">No allocation data</p>
							<p className="text-sm">Asset allocation will appear here when you have positions</p>
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
			onEvents={{
				click: handleChartClick,
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
						{/* Chart type selector */}
						<div className="flex items-center gap-1">
							<Button
								variant={currentChartType === "pie" ? "default" : "ghost"}
								size="sm"
								className="h-7 w-7 p-0"
								onClick={() => handleChartTypeChange("pie")}
								title="Pie chart"
							>
								<PieChart className="h-3 w-3" />
							</Button>
							<Button
								variant={currentChartType === "donut" ? "default" : "ghost"}
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => handleChartTypeChange("donut")}
								title="Donut chart"
							>
								Donut
							</Button>
							<Button
								variant={currentChartType === "treemap" ? "default" : "ghost"}
								size="sm"
								className="h-7 w-7 p-0"
								onClick={() => handleChartTypeChange("treemap")}
								title="Treemap"
							>
								<Grid3X3 className="h-3 w-3" />
							</Button>
						</div>

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
			<CardContent className="p-0">
				{chartContent}

				{/* Allocation summary for compact mode */}
				{compact && processedData.length > 0 && (
					<div className="p-4 border-t">
						<div className="grid grid-cols-2 gap-2 text-xs">
							{processedData.slice(0, 4).map((item, index) => (
								<div key={item.name} className="flex items-center gap-2">
									<div
										className="w-2 h-2 rounded-full flex-shrink-0"
										style={{
											backgroundColor: item.assetType
												? getAssetTypeColor(item.assetType)
												: `hsl(${index * 60}, 70%, 50%)`,
										}}
									/>
									<span className="truncate">{item.name}</span>
									<span className="text-muted-foreground ml-auto">
										{item.percentage?.toFixed(1)}%
									</span>
								</div>
							))}
							{processedData.length > 4 && (
								<div className="text-muted-foreground col-span-2 text-center">
									+{processedData.length - 4} more
								</div>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};

export default AllocationChart;
