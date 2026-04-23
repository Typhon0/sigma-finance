import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	DollarSign,
	Percent,
	Target,
	TrendingUp,
} from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage, getPerformanceColorClass } from "@/lib/utils/formatters";

export interface PerformanceMetric {
	label: string;
	value: number;
	change?: number;
	changePercent?: number;
	format: "currency" | "percentage" | "number";
	icon?: React.ReactNode;
	description?: string;
	benchmark?: number;
	target?: number;
}

export interface PerformanceMetricsProps {
	metrics: PerformanceMetric[];
	timeRange?: string;
	isLoading?: boolean;
	className?: string;
	compact?: boolean;
	showBenchmarks?: boolean;
	onMetricClick?: (metric: PerformanceMetric) => void;
}

const formatMetricValue = (value: number, format: PerformanceMetric["format"]): string => {
	switch (format) {
		case "currency":
			return formatCurrency(value);
		case "percentage":
			return formatPercentage(value);
		case "number":
			return value.toLocaleString();
		default:
			return value.toString();
	}
};

const getMetricIcon = (metric: PerformanceMetric): React.ReactNode => {
	if (metric.icon) return metric.icon;

	switch (metric.format) {
		case "currency":
			return <DollarSign className="h-4 w-4" />;
		case "percentage":
			return <Percent className="h-4 w-4" />;
		default:
			return <TrendingUp className="h-4 w-4" />;
	}
};

const getChangeIndicator = (change?: number, changePercent?: number) => {
	if (change === undefined && changePercent === undefined) return null;

	const displayValue =
		changePercent !== undefined ? formatPercentage(changePercent) : formatCurrency(change!);
	const isPositive = (changePercent !== undefined ? changePercent : change!) > 0;

	return (
		<div
			className={cn(
				"flex items-center gap-1 text-sm",
				getPerformanceColorClass(changePercent !== undefined ? changePercent : change!),
			)}
		>
			{isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
			{displayValue}
		</div>
	);
};

const MetricCard: React.FC<{
	metric: PerformanceMetric;
	compact?: boolean;
	showBenchmark?: boolean;
	onClick?: () => void;
}> = ({ metric, compact = false, showBenchmark = false, onClick }) => {
	const hasTarget = metric.target !== undefined;
	const hasBenchmark = metric.benchmark !== undefined;
	const isClickable = onClick !== undefined;

	const targetDifference = hasTarget ? metric.value - metric.target! : 0;
	const benchmarkDifference = hasBenchmark ? metric.value - metric.benchmark! : 0;

	return (
		<Card
			className={cn(
				"transition-all duration-200",
				isClickable && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
				compact && "p-3",
			)}
			onClick={onClick}
		>
			<CardContent className={cn("p-4", compact && "p-3")}>
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<div className={cn("p-2 rounded-lg bg-muted", compact && "p-1.5")}>
							{getMetricIcon(metric)}
						</div>
						<div>
							<p className={cn("text-sm font-medium text-muted-foreground", compact && "text-xs")}>
								{metric.label}
							</p>
							<p className={cn("text-2xl font-bold", compact && "text-lg")}>
								{formatMetricValue(metric.value, metric.format)}
							</p>
						</div>
					</div>

					<div className="text-right space-y-1">
						{getChangeIndicator(metric.change, metric.changePercent)}

						{/* Target indicator */}
						{hasTarget && (
							<div className="flex items-center gap-1 text-xs">
								<Target className="h-3 w-3 text-muted-foreground" />
								<span
									className={cn(
										"font-medium",
										targetDifference >= 0 ? "text-green-600" : "text-red-600",
									)}
								>
									{targetDifference >= 0 ? "+" : ""}
									{formatMetricValue(targetDifference, metric.format)}
								</span>
							</div>
						)}

						{/* Benchmark indicator */}
						{showBenchmark && hasBenchmark && (
							<div className="flex items-center gap-1 text-xs">
								<Badge
									variant={benchmarkDifference >= 0 ? "default" : "destructive"}
									className="text-xs px-1"
								>
									vs Benchmark: {benchmarkDifference >= 0 ? "+" : ""}
									{formatMetricValue(benchmarkDifference, metric.format)}
								</Badge>
							</div>
						)}
					</div>
				</div>

				{/* Description */}
				{metric.description && !compact && (
					<p className="text-xs text-muted-foreground mt-2">{metric.description}</p>
				)}
			</CardContent>
		</Card>
	);
};

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
	metrics,
	timeRange,
	isLoading = false,
	className,
	compact = false,
	showBenchmarks = false,
	onMetricClick,
}) => {
	if (isLoading) {
		return (
			<div className={cn("space-y-4", className)}>
				{timeRange && (
					<div className="flex items-center justify-between">
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-4 w-24" />
					</div>
				)}
				<div
					className={cn(
						"grid gap-4",
						compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
					)}
				>
					{Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
						<Card key={i}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2">
										<Skeleton className="h-8 w-8 rounded-lg" />
										<div className="space-y-1">
											<Skeleton className="h-4 w-20" />
											<Skeleton className="h-6 w-16" />
										</div>
									</div>
									<Skeleton className="h-4 w-12" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (!metrics || metrics.length === 0) {
		return (
			<div className={cn("space-y-4", className)}>
				<Card>
					<CardContent className="p-8 text-center">
						<AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
						<p className="text-muted-foreground">
							Performance metrics will appear here once you have portfolio data.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{timeRange && (
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">Performance Metrics</h3>
					<Badge variant="outline" className="text-xs">
						{timeRange}
					</Badge>
				</div>
			)}

			<div
				className={cn(
					"grid gap-4",
					compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
				)}
			>
				{metrics.map((metric, index) => (
					<MetricCard
						key={`${metric.label}-${index}`}
						metric={metric}
						compact={compact}
						showBenchmark={showBenchmarks}
						onClick={onMetricClick ? () => onMetricClick(metric) : undefined}
					/>
				))}
			</div>
		</div>
	);
};

export default PerformanceMetrics;
