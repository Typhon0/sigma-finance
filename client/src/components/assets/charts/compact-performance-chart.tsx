import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createEChartsConfig } from "@/lib/charts/echarts";
import { formatCurrency, formatPercentage } from "@/lib/utils";

interface PerformanceDataPoint {
	date: string;
	value: number;
}

interface CompactPerformanceChartProps {
	data: PerformanceDataPoint[];
	title?: string;
	currentValue?: number;
	previousValue?: number;
	height?: number;
	showGrid?: boolean;
	className?: string;
}

export function CompactPerformanceChart({
	data,
	title = "Performance",
	currentValue,
	previousValue,
	height = 120,
	_showGrid = false,
	className,
}: CompactPerformanceChartProps) {
	const chartConfig = useMemo(() => {
		if (!data || data.length === 0) return null;

		return createEChartsConfig({
			type: "line",
			data: data.map((point) => ({
				name: point.date,
				value: point.value,
			})),
			options: {
				grid: {
					left: 10,
					right: 10,
					top: 10,
					bottom: 20,
					containLabel: false,
				},
				xAxis: {
					type: "category",
					show: false,
					data: data.map((point) => point.date),
				},
				yAxis: {
					type: "value",
					show: false,
					scale: true,
				},
				series: [
					{
						type: "line",
						smooth: true,
						symbol: "none",
						lineStyle: {
							width: 2,
						},
						areaStyle: {
							opacity: 0.1,
						},
						data: data.map((point) => point.value),
					},
				],
				tooltip: {
					trigger: "axis",
					formatter: (params: any) => {
						const point = params[0];
						return `
              <div class="text-sm">
                <div class="font-medium">${point.name}</div>
                <div class="text-blue-600">${formatCurrency(point.value)}</div>
              </div>
            `;
					},
				},
			},
		});
	}, [data]);

	// Calculate performance metrics
	const performanceMetrics = useMemo(() => {
		if (!currentValue || !previousValue || previousValue === 0) {
			return null;
		}

		const change = currentValue - previousValue;
		const changePercent = (change / previousValue) * 100;

		return {
			change,
			changePercent,
			isPositive: change >= 0,
			isNeutral: change === 0,
		};
	}, [currentValue, previousValue]);

	const getPerformanceIcon = () => {
		if (!performanceMetrics) return Minus;
		if (performanceMetrics.isNeutral) return Minus;
		return performanceMetrics.isPositive ? TrendingUp : TrendingDown;
	};

	const getPerformanceColor = () => {
		if (!performanceMetrics) return "text-gray-600";
		if (performanceMetrics.isNeutral) return "text-gray-600";
		return performanceMetrics.isPositive ? "text-green-600" : "text-red-600";
	};

	const PerformanceIcon = getPerformanceIcon();
	const performanceColor = getPerformanceColor();

	if (!chartConfig) {
		return (
			<Card className={className}>
				<CardContent className="p-4">
					<div className="flex items-center justify-center h-24 text-muted-foreground">
						No data available
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium">{title}</CardTitle>
					{performanceMetrics && (
						<Badge
							variant="outline"
							className={`gap-1 ${performanceColor} border-current`}
						>
							<PerformanceIcon className="h-3 w-3" />
							{formatPercentage(performanceMetrics.changePercent)}
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="p-4 pt-0">
				<div className="space-y-2">
					{currentValue && (
						<div className="flex items-center justify-between">
							<span className="text-lg font-semibold">
								{formatCurrency(currentValue)}
							</span>
							{performanceMetrics && (
								<span className={`text-sm ${performanceColor}`}>
									{performanceMetrics.change >= 0 ? "+" : ""}
									{formatCurrency(performanceMetrics.change)}
								</span>
							)}
						</div>
					)}

					<div style={{ height: `${height}px` }} className="w-full">
						{/* Chart would be rendered here using ECharts */}
						<div className="w-full h-full bg-gradient-to-r from-blue-50 to-blue-100 rounded flex items-center justify-center text-xs text-muted-foreground">
							Chart: {data.length} data points
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
