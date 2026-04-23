import React from "react";
import { cn } from "@/lib/utils";
import AllocationChart, { type AllocationChartProps } from "./AllocationChart";
import PerformanceChart, { type PerformanceChartProps } from "./PerformanceChart";
import PortfolioComparisonChart, {
	type PortfolioComparisonChartProps,
} from "./PortfolioComparisonChart";

/**
 * Compact chart variants optimized for inline portfolio detail views
 * These components are designed for dashboard integration with minimal space usage
 */

interface CompactChartWrapperProps {
	className?: string;
	children: React.ReactNode;
}

const CompactChartWrapper: React.FC<CompactChartWrapperProps> = ({ className, children }) => (
	<div className={cn("w-full", className)}>{children}</div>
);

/**
 * Compact Performance Chart - optimized for dashboard inline views
 */
export interface CompactPerformanceChartProps
	extends Omit<PerformanceChartProps, "height" | "compact" | "showHeader" | "showFullscreen"> {
	height?: number;
	showTitle?: boolean;
}

export const CompactPerformanceChart: React.FC<CompactPerformanceChartProps> = ({
	height = 200,
	showTitle = false,
	className,
	...props
}) => (
	<CompactChartWrapper className={className}>
		<PerformanceChart
			{...props}
			height={height}
			compact={true}
			showHeader={showTitle}
			showFullscreen={false}
			showExport={false}
		/>
	</CompactChartWrapper>
);

/**
 * Compact Allocation Chart - optimized for dashboard inline views
 */
export interface CompactAllocationChartProps
	extends Omit<AllocationChartProps, "height" | "compact" | "showHeader" | "showFullscreen"> {
	height?: number;
	showTitle?: boolean;
}

export const CompactAllocationChart: React.FC<CompactAllocationChartProps> = ({
	height = 200,
	showTitle = false,
	className,
	...props
}) => (
	<CompactChartWrapper className={className}>
		<AllocationChart
			{...props}
			height={height}
			compact={true}
			showHeader={showTitle}
			showFullscreen={false}
			showExport={false}
		/>
	</CompactChartWrapper>
);

/**
 * Compact Portfolio Comparison Chart - optimized for dashboard inline views
 */
export interface CompactPortfolioComparisonChartProps
	extends Omit<
		PortfolioComparisonChartProps,
		"height" | "compact" | "showHeader" | "showFullscreen"
	> {
	height?: number;
	showTitle?: boolean;
}

export const CompactPortfolioComparisonChart: React.FC<CompactPortfolioComparisonChartProps> = ({
	height = 200,
	showTitle = false,
	className,
	...props
}) => (
	<CompactChartWrapper className={className}>
		<PortfolioComparisonChart
			{...props}
			height={height}
			compact={true}
			showHeader={showTitle}
			showFullscreen={false}
			showExport={false}
			showLegend={false}
		/>
	</CompactChartWrapper>
);

/**
 * Mini Performance Sparkline - ultra-compact for cards and summaries
 */
export interface MiniPerformanceSparklineProps {
	data: Array<{ date: string; value: number }>;
	className?: string;
	color?: string;
	height?: number;
	showChange?: boolean;
}

export const MiniPerformanceSparkline: React.FC<MiniPerformanceSparklineProps> = ({
	data,
	className,
	color = "#22c55e",
	height = 60,
	showChange = true,
}) => {
	const change = React.useMemo(() => {
		if (!data || data.length < 2) return 0;
		const first = data[0].value;
		const last = data[data.length - 1].value;
		return ((last - first) / first) * 100;
	}, [data]);

	const isPositive = change >= 0;

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<div className="flex-1">
				<CompactPerformanceChart
					data={data}
					height={height}
					showTitle={false}
					color={color}
					chartType="line"
				/>
			</div>
			{showChange && (
				<div className={cn("text-xs font-medium", isPositive ? "text-green-600" : "text-red-600")}>
					{isPositive ? "+" : ""}
					{change.toFixed(2)}%
				</div>
			)}
		</div>
	);
};

/**
 * Mini Allocation Donut - ultra-compact for cards and summaries
 */
export interface MiniAllocationDonutProps {
	data: Array<{ name: string; value: number; assetType?: string }>;
	className?: string;
	size?: number;
	showLegend?: boolean;
}

export const MiniAllocationDonut: React.FC<MiniAllocationDonutProps> = ({
	data,
	className,
	size = 80,
	showLegend = false,
}) => (
	<div className={cn("flex items-center gap-3", className)}>
		<div style={{ width: size, height: size }}>
			<CompactAllocationChart
				data={data}
				height={size}
				showTitle={false}
				chartType="donut"
				showLabels={false}
			/>
		</div>
		{showLegend && data.length > 0 && (
			<div className="flex-1 space-y-1">
				{data.slice(0, 3).map((item, index) => (
					<div key={item.name} className="flex items-center gap-2 text-xs">
						<div
							className="w-2 h-2 rounded-full flex-shrink-0"
							style={{ backgroundColor: `hsl(${index * 120}, 70%, 50%)` }}
						/>
						<span className="truncate flex-1">{item.name}</span>
						<span className="text-muted-foreground">
							{((item.value / data.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(0)}%
						</span>
					</div>
				))}
				{data.length > 3 && (
					<div className="text-xs text-muted-foreground">+{data.length - 3} more</div>
				)}
			</div>
		)}
	</div>
);

/**
 * Dashboard Chart Grid - layout component for organizing multiple compact charts
 */
export interface DashboardChartGridProps {
	children: React.ReactNode;
	columns?: 1 | 2 | 3 | 4;
	gap?: "sm" | "md" | "lg";
	className?: string;
}

export const DashboardChartGrid: React.FC<DashboardChartGridProps> = ({
	children,
	columns = 2,
	gap = "md",
	className,
}) => {
	const gridCols = {
		1: "grid-cols-1",
		2: "grid-cols-1 lg:grid-cols-2",
		3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
		4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
	};

	const gapSize = {
		sm: "gap-3",
		md: "gap-4",
		lg: "gap-6",
	};

	return <div className={cn("grid", gridCols[columns], gapSize[gap], className)}>{children}</div>;
};

/**
 * Chart Card Wrapper - consistent styling for dashboard charts
 */
export interface ChartCardProps {
	title?: string;
	subtitle?: string;
	children: React.ReactNode;
	className?: string;
	actions?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
	title,
	subtitle,
	children,
	className,
	actions,
}) => (
	<div className={cn("bg-card rounded-lg border p-4", className)}>
		{(title || subtitle || actions) && (
			<div className="flex items-start justify-between mb-4">
				<div>
					{title && <h3 className="font-semibold text-sm text-card-foreground">{title}</h3>}
					{subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
				</div>
				{actions && <div className="flex items-center gap-1">{actions}</div>}
			</div>
		)}
		{children}
	</div>
);

/**
 * Responsive Chart Container - automatically adjusts chart size based on container
 */
export interface ResponsiveChartContainerProps {
	children: React.ReactNode;
	minHeight?: number;
	maxHeight?: number;
	aspectRatio?: number;
	className?: string;
}

export const ResponsiveChartContainer: React.FC<ResponsiveChartContainerProps> = ({
	children,
	minHeight = 200,
	maxHeight = 400,
	aspectRatio = 16 / 9,
	className,
}) => {
	const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
	const containerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				const { width } = containerRef.current.getBoundingClientRect();
				const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, width / aspectRatio));
				setDimensions({ width, height: calculatedHeight });
			}
		};

		updateDimensions();
		window.addEventListener("resize", updateDimensions);
		return () => window.removeEventListener("resize", updateDimensions);
	}, [minHeight, maxHeight, aspectRatio]);

	return (
		<div ref={containerRef} className={cn("w-full", className)}>
			<div style={{ height: dimensions.height }}>{children}</div>
		</div>
	);
};
