/**
 * AssetPriceChart component using Lightweight Charts™
 * Provides interactive candlestick and line charts for tradeable assets
 * Optimized for dashboard inline views with real-time updates
 */

import {
	type CandlestickData,
	type CandlestickSeriesOptions,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type LineData,
	type LineSeriesOptions,
} from "lightweight-charts";
import {
	AlertCircle,
	Maximize2,
	Minimize2,
	Minus,
	RefreshCw,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartTheme } from "@/lib/charts/config";
import {
	ChartPerformanceManager,
	ChartResizeObserver,
	getDefaultCandlestickOptions,
	getDefaultChartOptions,
	getDefaultLineOptions,
	TIME_RANGES,
	type TimeRange,
	toChartTime,
	validateCandlestickData,
} from "@/lib/charts/lightweight-charts";
import { cn } from "@/lib/utils";

/**
 * Price data interfaces
 */
export interface PricePoint {
	time: string | number | Date;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

export interface AssetPrice {
	current: number;
	change: number;
	changePercent: number;
	lastUpdate: string;
	isStale?: boolean;
}

/**
 * Chart configuration
 */
export interface AssetPriceChartProps {
	assetId: string;
	symbol?: string;
	name?: string;
	data: PricePoint[];
	currentPrice?: AssetPrice;
	chartType?: "candlestick" | "line";
	timeRange?: TimeRange;
	height?: number;
	compact?: boolean;
	showControls?: boolean;
	showVolume?: boolean;
	showCurrentPrice?: boolean;
	showTimeRangeSelector?: boolean;
	className?: string;
	onTimeRangeChange?: (range: TimeRange) => void;
	onRefresh?: () => void;
	isLoading?: boolean;
	error?: string;
}

/**
 * Real-time price update interface
 */
export interface PriceUpdate {
	assetId: string;
	price: number;
	timestamp: string;
	volume?: number;
}

/**
 * AssetPriceChart component
 */
export function AssetPriceChart({
	assetId,
	symbol,
	name,
	data,
	currentPrice,
	chartType = "candlestick",
	timeRange = "1D",
	height = 300,
	compact = false,
	showControls = true,
	_showVolume = false,
	showCurrentPrice = true,
	showTimeRangeSelector = true,
	className,
	onTimeRangeChange,
	onRefresh,
	isLoading = false,
	error,
}: AssetPriceChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line"> | null>(null);
	const resizeObserverRef = useRef<ChartResizeObserver | null>(null);

	const [isExpanded, setIsExpanded] = useState(false);
	const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

	const { lightweight: theme } = useChartTheme();

	// Memoize chart options for performance
	const chartOptions = useMemo(
		() => ({
			...getDefaultChartOptions(theme),
			width: 0, // Will be set by resize observer
			height: isExpanded ? Math.min(height * 1.5, 600) : height,
			...ChartPerformanceManager.getPerformanceOptimizedOptions(),
		}),
		[theme, height, isExpanded],
	);

	// Memoize series options
	const seriesOptions = useMemo(() => {
		if (chartType === "candlestick") {
			return getDefaultCandlestickOptions(theme);
		}
		return getDefaultLineOptions(theme);
	}, [chartType, theme]);

	// Process and validate chart data
	const processedData = useMemo(() => {
		if (!data || data.length === 0) return [];

		if (chartType === "candlestick") {
			const validatedData = validateCandlestickData(data);
			return ChartPerformanceManager.shouldSampleData(validatedData.length)
				? ChartPerformanceManager.sampleData(validatedData)
				: validatedData;
		} else {
			// Convert to line data
			const lineData: LineData[] = data
				.map((point) => ({
					time: toChartTime(point.time),
					value: point.close,
				}))
				.sort((a, b) => (a.time as number) - (b.time as number));

			return ChartPerformanceManager.shouldSampleData(lineData.length)
				? ChartPerformanceManager.sampleData(lineData)
				: lineData;
		}
	}, [data, chartType]);

	// Initialize chart
	useEffect(() => {
		if (!chartContainerRef.current) return;

		const container = chartContainerRef.current;

		// Create chart instance
		chartRef.current = createChart(container, chartOptions);

		// Create series based on chart type
		if (chartType === "candlestick") {
			seriesRef.current = chartRef.current.addCandlestickSeries(
				seriesOptions as CandlestickSeriesOptions,
			);
		} else {
			seriesRef.current = chartRef.current.addLineSeries(
				seriesOptions as LineSeriesOptions,
			);
		}

		// Set up resize observer
		resizeObserverRef.current = new ChartResizeObserver(
			chartRef.current,
			container,
		);

		// Cleanup function
		return () => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
			}
			if (chartRef.current) {
				chartRef.current.remove();
			}
		};
	}, [chartOptions, seriesOptions, chartType]);

	// Update chart data
	useEffect(() => {
		if (!seriesRef.current || !processedData.length) return;

		try {
			seriesRef.current.setData(processedData as any);

			// Fit content to show all data
			if (chartRef.current) {
				chartRef.current.timeScale().fitContent();
			}

			setLastUpdate(new Date());
		} catch (error) {
			console.error("Error updating chart data:", error);
		}
	}, [processedData]);

	// Handle real-time price updates
	const _handlePriceUpdate = useCallback(
		(update: PriceUpdate) => {
			if (update.assetId !== assetId || !seriesRef.current) return;

			try {
				const timestamp = toChartTime(update.timestamp);

				if (chartType === "candlestick") {
					// For candlestick, we need to update the last candle or add a new one
					// This is a simplified implementation - in practice, you'd need more logic
					// to determine whether to update existing candle or create new one
					const newCandle: CandlestickData = {
						time: timestamp,
						open: update.price,
						high: update.price,
						low: update.price,
						close: update.price,
					};
					seriesRef.current.update(newCandle);
				} else {
					// For line chart, add new data point
					const newPoint: LineData = {
						time: timestamp,
						value: update.price,
					};
					seriesRef.current.update(newPoint);
				}

				setLastUpdate(new Date());
			} catch (error) {
				console.error("Error updating real-time price:", error);
			}
		},
		[assetId, chartType],
	);

	// Handle time range change
	const handleTimeRangeChange = useCallback(
		(newRange: TimeRange) => {
			onTimeRangeChange?.(newRange);
		},
		[onTimeRangeChange],
	);

	// Handle chart expansion
	const handleToggleExpand = useCallback(() => {
		setIsExpanded((prev) => !prev);
	}, []);

	// Handle refresh
	const handleRefresh = useCallback(() => {
		onRefresh?.();
	}, [onRefresh]);

	// Format price change
	const formatPriceChange = useCallback(
		(change: number, changePercent: number) => {
			const isPositive = change > 0;
			const isNegative = change < 0;

			return {
				icon: isPositive ? TrendingUp : isNegative ? TrendingDown : Minus,
				color: isPositive
					? "text-green-600"
					: isNegative
						? "text-red-600"
						: "text-gray-500",
				bgColor: isPositive
					? "bg-green-50"
					: isNegative
						? "bg-red-50"
						: "bg-gray-50",
				text: `${isPositive ? "+" : ""}${change.toFixed(2)} (${isPositive ? "+" : ""}${changePercent.toFixed(2)}%)`,
			};
		},
		[],
	);

	// Render loading state
	if (isLoading) {
		return (
			<Card className={cn("w-full", className)}>
				{!compact && (
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<div>
								<Skeleton className="h-5 w-24 mb-1" />
								<Skeleton className="h-4 w-16" />
							</div>
							<Skeleton className="h-6 w-20" />
						</div>
					</CardHeader>
				)}
				<CardContent className="p-4">
					<Skeleton className={cn("w-full", `h-[${height}px]`)} />
				</CardContent>
			</Card>
		);
	}

	// Render error state
	if (error) {
		return (
			<Card className={cn("w-full", className)}>
				<CardContent className="p-4">
					<div className="flex items-center justify-center h-48 text-center">
						<div>
							<AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
							<p className="text-sm text-gray-600 mb-2">{error}</p>
							{onRefresh && (
								<Button variant="outline" size="sm" onClick={handleRefresh}>
									<RefreshCw className="h-4 w-4 mr-2" />
									Retry
								</Button>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	const priceChangeInfo = currentPrice
		? formatPriceChange(currentPrice.change, currentPrice.changePercent)
		: null;

	return (
		<Card className={cn("w-full", className)}>
			{!compact && (
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-lg font-semibold">
								{name || symbol || `Asset ${assetId}`}
							</CardTitle>
							{symbol && name && (
								<p className="text-sm text-gray-600">{symbol}</p>
							)}
						</div>

						{showCurrentPrice && currentPrice && (
							<div className="text-right">
								<div className="text-lg font-semibold">
									${currentPrice.current.toFixed(2)}
								</div>
								{priceChangeInfo && (
									<Badge
										variant="secondary"
										className={cn(
											priceChangeInfo.bgColor,
											priceChangeInfo.color,
										)}
									>
										<priceChangeInfo.icon className="h-3 w-3 mr-1" />
										{priceChangeInfo.text}
									</Badge>
								)}
								{currentPrice.isStale && (
									<p className="text-xs text-amber-600 mt-1">Stale data</p>
								)}
							</div>
						)}
					</div>
				</CardHeader>
			)}

			<CardContent className="p-4">
				{/* Chart Controls */}
				{showControls && (
					<div className="flex items-center justify-between mb-4">
						{showTimeRangeSelector && (
							<div className="flex items-center gap-1">
								{Object.entries(TIME_RANGES).map(([key, range]) => (
									<Button
										key={key}
										variant={timeRange === key ? "default" : "ghost"}
										size="sm"
										className="h-7 px-2 text-xs"
										onClick={() => handleTimeRangeChange(key as TimeRange)}
									>
										{range.label}
									</Button>
								))}
							</div>
						)}

						<div className="flex items-center gap-2">
							{onRefresh && (
								<Button
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0"
									onClick={handleRefresh}
								>
									<RefreshCw className="h-3 w-3" />
								</Button>
							)}

							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={handleToggleExpand}
							>
								{isExpanded ? (
									<Minimize2 className="h-3 w-3" />
								) : (
									<Maximize2 className="h-3 w-3" />
								)}
							</Button>
						</div>
					</div>
				)}

				{/* Chart Container */}
				<div
					ref={chartContainerRef}
					className={cn(
						"w-full border rounded-md bg-background",
						`h-[${isExpanded ? Math.min(height * 1.5, 600) : height}px]`,
					)}
					style={{
						height: isExpanded ? Math.min(height * 1.5, 600) : height,
					}}
				/>

				{/* Chart Info */}
				{!compact && (
					<div className="flex items-center justify-between mt-2 text-xs text-gray-500">
						<div>
							{processedData.length > 0 && (
								<span>{processedData.length} data points</span>
							)}
							{ChartPerformanceManager.shouldSampleData(data.length) && (
								<span className="ml-2 text-amber-600">
									(Sampled for performance)
								</span>
							)}
						</div>
						<div>Last updated: {lastUpdate.toLocaleTimeString()}</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Compact variant for dashboard inline views
 */
export function CompactAssetPriceChart(
	props: Omit<AssetPriceChartProps, "compact" | "showControls">,
) {
	return (
		<AssetPriceChart
			{...props}
			compact={true}
			showControls={false}
			height={200}
			showTimeRangeSelector={false}
		/>
	);
}

/**
 * Hook for real-time price updates
 */
export function useRealTimePriceUpdates(
	assetIds: string[],
	onPriceUpdate: (update: PriceUpdate) => void,
) {
	useEffect(() => {
		// This would connect to WebSocket or polling mechanism
		// For now, we'll simulate with a placeholder

		const interval = setInterval(() => {
			// Simulate price updates
			assetIds.forEach((assetId) => {
				const mockUpdate: PriceUpdate = {
					assetId,
					price: Math.random() * 100 + 50, // Random price between 50-150
					timestamp: new Date().toISOString(),
					volume: Math.floor(Math.random() * 1000000),
				};
				onPriceUpdate(mockUpdate);
			});
		}, 5000); // Update every 5 seconds

		return () => clearInterval(interval);
	}, [assetIds, onPriceUpdate]);
}

/**
 * Export types for external use
 */
export type { AssetPrice, PricePoint, PriceUpdate };
