/**
 * Compact AssetPriceChart variants optimized for dashboard inline views
 * Provides space-efficient chart components for portfolio detail sections
 */

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { CompactStaleIndicator } from "@/components/dashboard/stale-data-indicator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	type AssetPrice,
	AssetPriceChart,
	type AssetPriceChartProps,
	type PricePoint,
} from "./asset-price-chart";
import { DashboardChartContainer } from "./responsive-chart-container";

/**
 * Compact chart configuration
 */
export interface CompactChartProps
	extends Omit<AssetPriceChartProps, "height" | "compact" | "showControls"> {
	variant?: "mini" | "small" | "medium";
	showHeader?: boolean;
	showPrice?: boolean;
	showChange?: boolean;
	interactive?: boolean;
	/** ISO timestamp of when the price was recorded */
	priceTimestamp?: string | Date | null;
}

/**
 * Chart size configurations
 */
const CHART_SIZES = {
	mini: { height: 80, showTimeRange: false, showCurrentPrice: false },
	small: { height: 120, showTimeRange: false, showCurrentPrice: true },
	medium: { height: 200, showTimeRange: true, showCurrentPrice: true },
} as const;

/**
 * Mini price chart - ultra compact for card headers
 */
export function MiniAssetPriceChart({
	assetId,
	symbol,
	data,
	currentPrice,
	chartType = "line",
	className,
	...props
}: CompactChartProps) {
	const config = CHART_SIZES.mini;

	if (!data || data.length === 0) {
		return (
			<div className={cn("w-full", className)}>
				<Skeleton className="h-20 w-full rounded" />
			</div>
		);
	}

	return (
		<div className={cn("w-full", className)}>
			<AssetPriceChart
				{...props}
				assetId={assetId}
				symbol={symbol}
				data={data}
				currentPrice={currentPrice}
				chartType={chartType}
				height={config.height}
				compact={true}
				showControls={false}
				showCurrentPrice={config.showCurrentPrice}
				showTimeRangeSelector={config.showTimeRange}
				className="border-0 shadow-none"
			/>
		</div>
	);
}

/**
 * Small price chart - compact for dashboard cards
 */
export function SmallAssetPriceChart({
	assetId,
	symbol,
	name,
	data,
	currentPrice,
	chartType = "line",
	showHeader = true,
	showPrice = true,
	showChange = true,
	priceTimestamp,
	className,
	...props
}: CompactChartProps) {
	const config = CHART_SIZES.small;

	const priceChangeInfo = useMemo(() => {
		if (!currentPrice || !showChange) return null;

		const isPositive = currentPrice.change > 0;
		const isNegative = currentPrice.change < 0;

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
			text: `${isPositive ? "+" : ""}${currentPrice.changePercent.toFixed(2)}%`,
		};
	}, [currentPrice, showChange]);

	if (!data || data.length === 0) {
		return (
			<Card className={cn("w-full", className)}>
				{showHeader && (
					<div className="p-3 pb-0">
						<div className="flex items-center justify-between">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-5 w-12" />
						</div>
					</div>
				)}
				<CardContent className="p-3">
					<Skeleton className="h-28 w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={cn("w-full", className)}>
			{showHeader && (
				<div className="p-3 pb-0">
					<div className="flex items-center justify-between">
						<div className="min-w-0 flex-1">
							<h4 className="text-sm font-medium truncate">
								{name || symbol || `Asset ${assetId}`}
							</h4>
							{symbol && name && (
								<p className="text-xs text-muted-foreground">{symbol}</p>
							)}
						</div>

						{showPrice && currentPrice && (
							<div className="text-right ml-2">
								<div className="flex items-center justify-end gap-1">
									<span className="text-sm font-semibold">
										${currentPrice.current.toFixed(2)}
									</span>
									<CompactStaleIndicator lastUpdated={priceTimestamp} />
								</div>
								{priceChangeInfo && (
									<Badge
										variant="secondary"
										className={cn(
											"text-xs h-5",
											priceChangeInfo.bgColor,
											priceChangeInfo.color,
										)}
									>
										<priceChangeInfo.icon className="h-2.5 w-2.5 mr-1" />
										{priceChangeInfo.text}
									</Badge>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			<CardContent className="p-3 pt-2">
				<AssetPriceChart
					{...props}
					assetId={assetId}
					symbol={symbol}
					name={name}
					data={data}
					currentPrice={currentPrice}
					chartType={chartType}
					height={config.height}
					compact={true}
					showControls={false}
					showCurrentPrice={false} // Already shown in header
					showTimeRangeSelector={config.showTimeRange}
					className="border-0 shadow-none"
				/>
			</CardContent>
		</Card>
	);
}

/**
 * Medium price chart - for inline portfolio detail views
 */
export function MediumAssetPriceChart({
	assetId,
	symbol,
	name,
	data,
	currentPrice,
	chartType = "candlestick",
	showHeader = true,
	interactive = true,
	className,
	...props
}: CompactChartProps) {
	const config = CHART_SIZES.medium;

	return (
		<DashboardChartContainer className={cn("w-full", className)}>
			<AssetPriceChart
				{...props}
				assetId={assetId}
				symbol={symbol}
				name={name}
				data={data}
				currentPrice={currentPrice}
				chartType={chartType}
				height={config.height}
				compact={!showHeader}
				showControls={interactive}
				showCurrentPrice={config.showCurrentPrice}
				showTimeRangeSelector={config.showTimeRange}
			/>
		</DashboardChartContainer>
	);
}

/**
 * Asset price sparkline - minimal chart for tables and lists
 */
export function AssetPriceSparkline({
	data,
	currentPrice,
	className,
	width = 100,
	height = 30,
}: {
	data: PricePoint[];
	currentPrice?: AssetPrice;
	className?: string;
	width?: number;
	height?: number;
}) {
	const pathData = useMemo(() => {
		if (!data || data.length < 2) return "";

		const prices = data.map((d) => d.close);
		const minPrice = Math.min(...prices);
		const maxPrice = Math.max(...prices);
		const priceRange = maxPrice - minPrice || 1;

		const points = data.map((point, index) => {
			const x = (index / (data.length - 1)) * width;
			const y = height - ((point.close - minPrice) / priceRange) * height;
			return `${x},${y}`;
		});

		return `M ${points.join(" L ")}`;
	}, [data, width, height]);

	const isPositive = currentPrice && currentPrice.change > 0;
	const strokeColor = isPositive
		? "#22c55e"
		: currentPrice?.change < 0
			? "#ef4444"
			: "#6b7280";

	if (!data || data.length < 2) {
		return (
			<div
				className={cn(
					"flex items-center justify-center bg-gray-100 rounded",
					className,
				)}
				style={{ width, height }}
			>
				<Minus className="h-3 w-3 text-gray-400" />
			</div>
		);
	}

	return (
		<svg
			width={width}
			height={height}
			className={cn("overflow-visible", className)}
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label="Price sparkline"
		>
			<title>Price sparkline</title>
			<path
				d={pathData}
				fill="none"
				stroke={strokeColor}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{/* Current price indicator */}
			{currentPrice && (
				<circle
					cx={width}
					cy={
						height -
						((data[data.length - 1].close -
							Math.min(...data.map((d) => d.close))) /
							(Math.max(...data.map((d) => d.close)) -
								Math.min(...data.map((d) => d.close)) || 1)) *
							height
					}
					r="2"
					fill={strokeColor}
				/>
			)}
		</svg>
	);
}

/**
 * Multi-asset price comparison chart - compact version
 */
export function CompactMultiAssetChart({
	assets,
	_height = 200,
	className,
}: {
	assets: Array<{
		assetId: string;
		symbol: string;
		name?: string;
		data: PricePoint[];
		color?: string;
	}>;
	height?: number;
	className?: string;
}) {
	// This would use a line chart to show multiple assets
	// For now, we'll show a placeholder
	return (
		<Card className={cn("w-full", className)}>
			<CardContent className="p-4">
				<div className="flex items-center justify-center h-48 text-center">
					<div>
						<p className="text-sm text-muted-foreground mb-2">
							Multi-asset comparison
						</p>
						<p className="text-xs text-muted-foreground">
							{assets.length} assets
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Asset price grid - multiple compact charts in a grid layout
 */
export function AssetPriceGrid({
	assets,
	variant = "small",
	columns = 2,
	className,
}: {
	assets: Array<{
		assetId: string;
		symbol: string;
		name?: string;
		data: PricePoint[];
		currentPrice?: AssetPrice;
		priceTimestamp?: string | Date | null;
	}>;
	variant?: "mini" | "small";
	columns?: number;
	className?: string;
}) {
	const ChartComponent =
		variant === "mini" ? MiniAssetPriceChart : SmallAssetPriceChart;

	return (
		<div
			className={cn(
				"grid gap-4",
				columns === 1 && "grid-cols-1",
				columns === 2 && "grid-cols-1 md:grid-cols-2",
				columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
				columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
				className,
			)}
		>
			{assets.map((asset) => (
				<ChartComponent
					key={asset.assetId}
					assetId={asset.assetId}
					symbol={asset.symbol}
					name={asset.name}
					data={asset.data}
					currentPrice={asset.currentPrice}
					priceTimestamp={asset.priceTimestamp}
				/>
			))}
		</div>
	);
}

/**
 * Loading states for compact charts
 */
export function CompactChartSkeleton({
	variant = "small",
	showHeader = true,
	className,
}: {
	variant?: "mini" | "small" | "medium";
	showHeader?: boolean;
	className?: string;
}) {
	const height = CHART_SIZES[variant].height;

	if (variant === "mini") {
		return (
			<div className={cn("w-full", className)}>
				<Skeleton className={`h-[${height}px] w-full rounded`} />
			</div>
		);
	}

	return (
		<Card className={cn("w-full", className)}>
			{showHeader && (
				<div className="p-3 pb-0">
					<div className="flex items-center justify-between">
						<div>
							<Skeleton className="h-4 w-20 mb-1" />
							<Skeleton className="h-3 w-12" />
						</div>
						<div className="text-right">
							<Skeleton className="h-4 w-16 mb-1" />
							<Skeleton className="h-5 w-12" />
						</div>
					</div>
				</div>
			)}
			<CardContent className="p-3 pt-2">
				<Skeleton className={`h-[${height}px] w-full`} />
			</CardContent>
		</Card>
	);
}

/**
 * Export all compact chart components
 */
export {
	MiniAssetPriceChart as CompactAssetPriceChart, // Alias for backward compatibility
};
