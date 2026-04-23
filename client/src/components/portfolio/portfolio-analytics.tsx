import type * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import {
	Activity,
	AlertTriangle,
	BarChart3,
	LineChart,
	PieChart,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAssetTypeColor, getChartColors } from "@/lib/chart-colors";
import {
	formatCurrency as formatCurrencyUtil,
	formatPercentage,
} from "@/lib/utils/portfolio-calculations";

// Types for portfolio analytics
export interface PortfolioAnalytics {
	portfolioId: string;
	totalValue: number;
	totalCost: number;
	totalGainLoss: number;
	totalGainLossPercent: number;
	assetAllocation: AssetAllocation[];
	riskMetrics: RiskMetrics;
	performanceHistory: PerformancePoint[];
	// Multi-currency fields
	totalNativeValue?: number | null;
	totalDisplayValue?: number | null;
	fxAsOf?: string | null;
	fxSource?: string | null;
	fxGranularity?: string | null;
	isStale?: boolean | null;
	fxState?: string | null;
	excludedPositionCount?: number | null;
	coveredValueRatio?: number | null;
	displayCurrency?: string | null;
	quoteCurrency?: string | null;
	positionValuations?: PositionValuation[] | null;
}

export interface PositionValuation {
	positionId: string;
	assetId: string;
	nativeValue: number;
	displayValue: number;
	fxRate: number;
	fxAsOf: string;
	fxSource?: string | null;
	fxGranularity?: string | null;
	isStale: boolean;
	quoteCurrency: string;
	displayCurrency: string;
}

export interface AssetAllocation {
	assetType: string;
	value: number;
	percentage: number;
	count: number;
}

export interface RiskMetrics {
	volatility: number;
	sharpeRatio: number;
	maxDrawdown: number;
	diversification: number;
}

export interface PerformancePoint {
	date: string;
	value: number;
}

interface PortfolioAnalyticsProps {
	analytics: PortfolioAnalytics | null;
	isLoading?: boolean;
	error?: Error | null;
	className?: string;
}

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

// Helper function to format relative time
function formatRelativeTime(dateString: string | null | undefined): string {
	if (!dateString) return "Unknown";

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins} min ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
	if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	return date.toLocaleDateString();
}

// Helper function to get currency symbol
function getCurrencySymbol(currency: string | null | undefined): string {
	switch (currency?.toUpperCase()) {
		case "USD":
			return "$";
		case "EUR":
			return "€";
		case "GBP":
			return "£";
		default:
			return "$";
	}
}

export function PortfolioAnalytics({
	analytics,
	isLoading = false,
	error = null,
	className,
}: PortfolioAnalyticsProps) {
	const [selectedTimePeriod, setSelectedTimePeriod] = useState<TimePeriod>("1M");
	const [activeTab, setActiveTab] = useState("overview");

	// Bind formatCurrency to the display currency (must be declared before useMemo hooks that reference it)
	const displayCurrency = analytics?.displayCurrency || "USD";
	const formatCurrency = useCallback(
		(value: number) => formatCurrencyUtil(value, displayCurrency),
		[displayCurrency],
	);

	// Filter performance history based on selected time period
	const filteredPerformanceHistory = useMemo(() => {
		if (!analytics?.performanceHistory) return [];

		const now = new Date();
		const startDate = new Date();

		switch (selectedTimePeriod) {
			case "1D":
				startDate.setDate(now.getDate() - 1);
				break;
			case "1W":
				startDate.setDate(now.getDate() - 7);
				break;
			case "1M":
				startDate.setMonth(now.getMonth() - 1);
				break;
			case "3M":
				startDate.setMonth(now.getMonth() - 3);
				break;
			case "6M":
				startDate.setMonth(now.getMonth() - 6);
				break;
			case "1Y":
				startDate.setFullYear(now.getFullYear() - 1);
				break;
			case "ALL":
				return analytics.performanceHistory;
		}

		return analytics.performanceHistory.filter((point) => new Date(point.date) >= startDate);
	}, [analytics?.performanceHistory, selectedTimePeriod]);

	// Asset allocation chart configuration
	const assetAllocationOption = useMemo((): echarts.EChartsCoreOption => {
		if (!analytics?.assetAllocation) return {};

		const data = analytics.assetAllocation.map((allocation) => ({
			name: allocation.assetType
				.replace(/_/g, " ")
				.toLowerCase()
				.replace(/\b\w/g, (l) => l.toUpperCase()),
			value: allocation.value,
			percentage: allocation.percentage,
			itemStyle: {
				color: getAssetTypeColor(allocation.assetType),
			},
		}));

		return {
			tooltip: {
				trigger: "item",
				formatter: (params: any) => {
					if (typeof params === "object" && params !== null && "data" in params) {
						const data = params.data as {
							name: string;
							value: number;
							percentage: number;
						};
						return `
            <div class="font-medium">${data.name}</div>
            <div class="text-sm">
              <div>Value: ${formatCurrency(data.value)}</div>
              <div>Percentage: ${data.percentage.toFixed(1)}%</div>
            </div>
          `;
					}
					return "";
				},
			},
			legend: {
				type: "scroll",
				orient: "horizontal",
				bottom: 0,
				left: "center",
				itemWidth: 12,
				itemHeight: 12,
				textStyle: {
					fontSize: 12,
				},
			},
			series: [
				{
					name: "Asset Allocation",
					type: "pie",
					radius: ["40%", "70%"],
					center: ["50%", "45%"],
					avoidLabelOverlap: false,
					itemStyle: {
						borderRadius: 4,
						borderColor: "#fff",
						borderWidth: 2,
					},
					label: {
						show: false,
					},
					emphasis: {
						label: {
							show: true,
							fontSize: 14,
							fontWeight: "bold",
							formatter: "{b}\n{d}%",
						},
					},
					data,
				},
			],
		};
	}, [analytics?.assetAllocation, formatCurrency]);

	// Performance history chart configuration
	const performanceHistoryOption = useMemo((): echarts.EChartsCoreOption => {
		if (!filteredPerformanceHistory.length) return {};

		const dates = filteredPerformanceHistory.map((point) => point.date);
		const values = filteredPerformanceHistory.map((point) => point.value);

		return {
			tooltip: {
				trigger: "axis",
				formatter: (params: any) => {
					if (
						Array.isArray(params) &&
						params.length > 0 &&
						"axisValue" in params[0] &&
						"value" in params[0]
					) {
						const point = params[0] as { axisValue: string; value: number };
						return `
            <div class="font-medium">${point.axisValue}</div>
            <div class="text-sm">
              <div>Portfolio Value: ${formatCurrency(point.value)}</div>
            </div>
          `;
					}
					return "";
				},
			},
			xAxis: {
				type: "category",
				data: dates,
				axisLabel: {
					formatter: (value: string) => {
						const date = new Date(value);
						return date.toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						});
					},
				},
			},
			yAxis: {
				type: "value",
				axisLabel: {
					formatter: (value: number) => formatCurrency(value),
				},
			},
			series: [
				{
					name: "Portfolio Value",
					type: "line",
					data: values,
					smooth: true,
					lineStyle: {
						width: 3,
						color: analytics && analytics.totalGainLoss >= 0 ? "#22c55e" : "#ef4444",
					},
					areaStyle: {
						opacity: 0.1,
						color: analytics && analytics.totalGainLoss >= 0 ? "#22c55e" : "#ef4444",
					},
				},
			],
		};
	}, [filteredPerformanceHistory, analytics, formatCurrency]);

	// Risk metrics visualization
	const riskMetricsOption = useMemo((): echarts.EChartsCoreOption => {
		if (!analytics?.riskMetrics) return {};

		const metrics = [
			{
				name: "Volatility",
				value: analytics.riskMetrics.volatility * 100,
				max: 50,
			},
			{
				name: "Sharpe Ratio",
				value: analytics.riskMetrics.sharpeRatio,
				max: 3,
			},
			{
				name: "Max Drawdown",
				value: Math.abs(analytics.riskMetrics.maxDrawdown) * 100,
				max: 50,
			},
			{
				name: "Diversification",
				value: analytics.riskMetrics.diversification,
				max: 100,
			},
		];

		return {
			tooltip: {
				trigger: "axis",
				axisPointer: {
					type: "shadow",
				},
			},
			xAxis: {
				type: "category",
				data: metrics.map((m) => m.name),
			},
			yAxis: {
				type: "value",
			},
			series: [
				{
					name: "Risk Metrics",
					type: "bar",
					data: metrics.map((m) => ({
						value: m.value,
						itemStyle: {
							color: getChartColors()[0],
						},
					})),
					barWidth: "60%",
				},
			],
		};
	}, [analytics?.riskMetrics]);

	// Loading state
	if (isLoading) {
		return (
			<div className={className}>
				<Card>
					<CardHeader>
						<CardTitle>Portfolio Analytics</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
								{[1, 2, 3, 4].map((i) => (
									<Skeleton key={i} className="h-20" />
								))}
							</div>
							<Skeleton className="h-[400px]" />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className={className}>
				<Card>
					<CardHeader>
						<CardTitle>Portfolio Analytics</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col items-center justify-center h-[400px] text-center">
							<Activity className="h-12 w-12 text-muted-foreground mb-4" />
							<div className="text-lg font-medium text-destructive mb-2">
								Failed to Load Analytics
							</div>
							<div className="text-sm text-muted-foreground mb-4">
								{error.message || "Unable to calculate portfolio analytics"}
							</div>
							<Button variant="outline" onClick={() => window.location.reload()}>
								Retry
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Empty state
	if (!analytics) {
		return (
			<div className={className}>
				<Card>
					<CardHeader>
						<CardTitle>Portfolio Analytics</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col items-center justify-center h-[400px] text-center">
							<PieChart className="h-12 w-12 text-muted-foreground mb-4" />
							<div className="text-lg font-medium mb-2">No Analytics Available</div>
							<div className="text-sm text-muted-foreground">
								Add some assets to your portfolio to see analytics
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Check if we have multi-currency data
	const hasMultiCurrency =
		analytics.totalNativeValue != null && analytics.totalDisplayValue != null;
	const quoteCurrency = analytics.quoteCurrency || "USD";
	const displaySymbol = getCurrencySymbol(displayCurrency);
	const nativeSymbol = getCurrencySymbol(quoteCurrency);

	const isStale = analytics.isStale || false;
	const fxAsOf = analytics.fxAsOf;
	const fxSource = analytics.fxSource || "UNKNOWN";
	const fxGranularity = analytics.fxGranularity || "UNKNOWN";
	const fxState = analytics.fxState || "UNAVAILABLE";
	const excludedPositionCount = analytics.excludedPositionCount || 0;
	const coveredValueRatio = analytics.coveredValueRatio ?? 0;

	return (
		<div className={className}>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>Portfolio Analytics</span>
						<div className="flex items-center gap-2">
							<Select
								value={selectedTimePeriod}
								onValueChange={(value: TimePeriod) => setSelectedTimePeriod(value)}
							>
								<SelectTrigger className="w-20">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1D">1D</SelectItem>
									<SelectItem value="1W">1W</SelectItem>
									<SelectItem value="1M">1M</SelectItem>
									<SelectItem value="3M">3M</SelectItem>
									<SelectItem value="6M">6M</SelectItem>
									<SelectItem value="1Y">1Y</SelectItem>
									<SelectItem value="ALL">ALL</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{/* Key Metrics Overview */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Total Value</p>
										{hasMultiCurrency ? (
											<div className="space-y-1">
												<p className="text-2xl font-bold">
													{displaySymbol}
													{analytics.totalDisplayValue?.toLocaleString(undefined, {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</p>
												{displayCurrency !== quoteCurrency && (
													<p className="text-sm text-muted-foreground">
														({nativeSymbol}
														{analytics.totalNativeValue?.toLocaleString(undefined, {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														})}{" "}
														{quoteCurrency})
													</p>
												)}
											</div>
										) : (
											<p className="text-2xl font-bold">{formatCurrency(analytics.totalValue)}</p>
										)}
									</div>
									<TrendingUp className="h-8 w-8 text-muted-foreground" />
								</div>
								{/* FX Timestamp and Stale Warning */}
								{hasMultiCurrency ? (
									<div className="mt-2 space-y-1 text-xs text-muted-foreground">
										<div className="flex items-center gap-1">
											{isStale ? (
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger>
															<AlertTriangle className="h-3 w-3 text-amber-500" />
														</TooltipTrigger>
														<TooltipContent>
															<p>FX rate may be stale</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											) : null}
											<span>FX: {fxAsOf ? formatRelativeTime(fxAsOf) : "Unknown"}</span>
										</div>
										<div>
											Source: {fxSource} • Granularity: {fxGranularity}
										</div>
										<div>
											State: {fxState}
											{excludedPositionCount > 0 ? ` • Excluded: ${excludedPositionCount}` : ""}
											{` • Coverage: ${(coveredValueRatio * 100).toFixed(1)}%`}
										</div>
									</div>
								) : null}
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Total Gain/Loss</p>
										<p
											className={`text-2xl font-bold ${analytics.totalGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{formatCurrency(analytics.totalGainLoss)}
										</p>
									</div>
									{analytics.totalGainLoss >= 0 ? (
										<TrendingUp className="h-8 w-8 text-green-600" />
									) : (
										<TrendingDown className="h-8 w-8 text-red-600" />
									)}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Performance</p>
										<p
											className={`text-2xl font-bold ${analytics.totalGainLossPercent >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{formatPercentage(analytics.totalGainLossPercent)}
										</p>
									</div>
									<Badge variant={analytics.totalGainLossPercent >= 0 ? "default" : "destructive"}>
										{analytics.totalGainLossPercent >= 0 ? "Gain" : "Loss"}
									</Badge>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Diversification</p>
										<p className="text-2xl font-bold">
											{analytics.riskMetrics.diversification.toFixed(0)}%
										</p>
									</div>
									<Activity className="h-8 w-8 text-muted-foreground" />
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Analytics Tabs */}
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="overview" className="flex items-center gap-2">
								<PieChart className="h-4 w-4" />
								Allocation
							</TabsTrigger>
							<TabsTrigger value="performance" className="flex items-center gap-2">
								<LineChart className="h-4 w-4" />
								Performance
							</TabsTrigger>
							<TabsTrigger value="risk" className="flex items-center gap-2">
								<BarChart3 className="h-4 w-4" />
								Risk Metrics
							</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-6">
							<div className="space-y-4">
								<h3 className="text-lg font-semibold">Asset Allocation</h3>
								<ReactECharts option={assetAllocationOption} style={{ height: "400px" }} />

								{/* Asset allocation breakdown */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t">
									{analytics.assetAllocation.map((allocation) => (
										<div
											key={allocation.assetType}
											className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
										>
											<div className="flex items-center gap-3">
												<div
													className="w-3 h-3 rounded-full"
													style={{
														backgroundColor: getAssetTypeColor(allocation.assetType),
													}}
												/>
												<div>
													<div className="font-medium text-sm">
														{allocation.assetType
															.replace(/_/g, " ")
															.toLowerCase()
															.replace(/\b\w/g, (l) => l.toUpperCase())}
													</div>
													<div className="text-xs text-muted-foreground">
														{allocation.count} asset
														{allocation.count !== 1 ? "s" : ""}
													</div>
												</div>
											</div>
											<div className="text-right">
												<div className="font-medium text-sm">
													{formatCurrency(allocation.value)}
												</div>
												<div className="text-xs text-muted-foreground">
													{allocation.percentage.toFixed(1)}%
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</TabsContent>

						<TabsContent value="performance" className="mt-6">
							<div className="space-y-4">
								<h3 className="text-lg font-semibold">Performance History</h3>
								<ReactECharts option={performanceHistoryOption} style={{ height: "400px" }} />
							</div>
						</TabsContent>

						<TabsContent value="risk" className="mt-6">
							<div className="space-y-4">
								<h3 className="text-lg font-semibold">Risk Analysis</h3>
								<ReactECharts option={riskMetricsOption} style={{ height: "400px" }} />

								{/* Risk metrics explanation */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm font-medium">Volatility</span>
											<span className="text-sm">
												{(analytics.riskMetrics.volatility * 100).toFixed(1)}%
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm font-medium">Sharpe Ratio</span>
											<span className="text-sm">
												{analytics.riskMetrics.sharpeRatio.toFixed(2)}
											</span>
										</div>
									</div>
									<div className="space-y-3">
										<div className="flex justify-between items-center">
											<span className="text-sm font-medium">Max Drawdown</span>
											<span className="text-sm">
												{(analytics.riskMetrics.maxDrawdown * 100).toFixed(1)}%
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-sm font-medium">Diversification Score</span>
											<span className="text-sm">
												{analytics.riskMetrics.diversification.toFixed(0)}%
											</span>
										</div>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}

export default PortfolioAnalytics;
