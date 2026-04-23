import { BarChart3, Bell, FileText, TrendingUp } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";
import AssetAllocation, {
	type AllocationItem,
	type AllocationRecommendation,
} from "./asset-allocation";
import PerformanceAlerts, { type AlertFormData, type PerformanceAlert } from "./performance-alerts";
import PerformanceComparison, {
	type BenchmarkData,
	type PortfolioPerformanceData,
} from "./performance-comparison";
import PerformanceMetrics, { type PerformanceMetric } from "./performance-metrics";
import PerformanceReports, { type ReportConfig, type ReportData } from "./performance-reports";

export interface PerformanceDashboardData {
	metrics: PerformanceMetric[];
	allocations: AllocationItem[];
	recommendations: AllocationRecommendation[];
	portfolioPerformance: PortfolioPerformanceData[];
	benchmarks: BenchmarkData[];
	alerts: PerformanceAlert[];
	reportData: ReportData;
	totalValue: number;
	totalChange: number;
	totalChangePercent: number;
}

export interface PerformanceDashboardProps {
	data: PerformanceDashboardData;
	portfolios?: Array<{ id: string; name: string }>;
	assets?: Array<{ id: string; name: string; symbol?: string }>;
	timeRange?: string;
	isLoading?: boolean;
	className?: string;
	compact?: boolean;
	defaultTab?: string;
	onTimeRangeChange?: (range: string) => void;
	onMetricClick?: (metric: PerformanceMetric) => void;
	onAssetTypeClick?: (assetType: string) => void;
	onRecommendationAction?: (recommendation: AllocationRecommendation) => void;
	onBenchmarkAdd?: (benchmarkId: string) => void;
	onBenchmarkRemove?: (benchmarkId: string) => void;
	onGenerateReport?: (config: ReportConfig) => Promise<void>;
	onCreateAlert?: (alert: AlertFormData) => Promise<void>;
	onUpdateAlert?: (id: string, alert: Partial<AlertFormData>) => Promise<void>;
	onDeleteAlert?: (id: string) => Promise<void>;
	onToggleAlert?: (id: string, isActive: boolean) => Promise<void>;
}

const timeRanges = [
	{ value: "1D", label: "1 Day" },
	{ value: "1W", label: "1 Week" },
	{ value: "1M", label: "1 Month" },
	{ value: "3M", label: "3 Months" },
	{ value: "6M", label: "6 Months" },
	{ value: "1Y", label: "1 Year" },
	{ value: "ALL", label: "All Time" },
];

const PerformanceOverview: React.FC<{
	totalValue: number;
	totalChange: number;
	totalChangePercent: number;
	timeRange?: string;
	compact?: boolean;
}> = ({ totalValue, totalChange, totalChangePercent, timeRange, compact = false }) => {
	const isPositive = totalChange >= 0;

	return (
		<Card>
			<CardContent className={cn("p-6", compact && "p-4")}>
				<div className="flex items-center justify-between">
					<div>
						<p className={cn("text-sm text-muted-foreground mb-1", compact && "text-xs")}>
							Total Portfolio Value
						</p>
						<p className={cn("text-3xl font-bold", compact && "text-2xl")}>
							{formatCurrency(totalValue)}
						</p>
					</div>
					<div className="text-right">
						<p className={cn("text-sm text-muted-foreground mb-1", compact && "text-xs")}>
							{timeRange ? `${timeRange} Change` : "Total Change"}
						</p>
						<div className="flex items-center gap-2">
							<p
								className={cn(
									"text-xl font-semibold",
									compact && "text-lg",
									isPositive ? "text-green-600" : "text-red-600",
								)}
							>
								{formatCurrency(totalChange)}
							</p>
							<Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
								{formatPercentage(totalChangePercent)}
							</Badge>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const QuickActions: React.FC<{
	onGenerateReport?: () => void;
	onCreateAlert?: () => void;
	onViewAnalytics?: () => void;
	compact?: boolean;
}> = ({ onGenerateReport, onCreateAlert, onViewAnalytics, compact = false }) => {
	const actions = [
		{
			icon: FileText,
			label: "Generate Report",
			onClick: onGenerateReport,
			variant: "default" as const,
		},
		{
			icon: Bell,
			label: "Create Alert",
			onClick: onCreateAlert,
			variant: "outline" as const,
		},
		{
			icon: BarChart3,
			label: "View Analytics",
			onClick: onViewAnalytics,
			variant: "outline" as const,
		},
	];

	return (
		<Card>
			<CardHeader className={cn("pb-3", compact && "pb-2")}>
				<CardTitle className={cn("text-lg", compact && "text-base")}>Quick Actions</CardTitle>
			</CardHeader>
			<CardContent className={cn("space-y-2", compact && "space-y-1")}>
				{actions.map((action, index) => (
					<Button
						key={index}
						variant={action.variant}
						size={compact ? "sm" : "default"}
						onClick={action.onClick}
						className="w-full justify-start"
					>
						<action.icon className="h-4 w-4 mr-2" />
						{action.label}
					</Button>
				))}
			</CardContent>
		</Card>
	);
};

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
	data,
	portfolios = [],
	assets = [],
	timeRange = "1M",
	isLoading = false,
	className,
	compact = false,
	defaultTab = "overview",
	onTimeRangeChange,
	onMetricClick,
	onAssetTypeClick,
	onRecommendationAction,
	onBenchmarkAdd,
	onBenchmarkRemove,
	onGenerateReport,
	onCreateAlert,
	onUpdateAlert,
	onDeleteAlert,
	onToggleAlert,
}) => {
	const [activeTab, setActiveTab] = useState(defaultTab);

	// Calculate summary statistics
	const summaryStats = useMemo(() => {
		if (!data) return null;

		const activeAlerts = data.alerts.filter((a) => a.isActive).length;
		const recentlyTriggered = data.alerts.filter(
			(a) => a.lastTriggered && Date.now() - a.lastTriggered.getTime() < 24 * 60 * 60 * 1000,
		).length;
		const highPriorityRecommendations = data.recommendations.filter(
			(r) => r.priority === "high",
		).length;

		return {
			activeAlerts,
			recentlyTriggered,
			highPriorityRecommendations,
			portfolioCount: data.portfolioPerformance.length,
			assetTypes: data.allocations.length,
		};
	}, [data]);

	if (isLoading) {
		return (
			<div className={cn("space-y-6", className)}>
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-10 w-32" />
				</div>
				<Skeleton className="h-24 w-full" />
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2 space-y-6">
						<Skeleton className="h-80 w-full" />
						<Skeleton className="h-64 w-full" />
					</div>
					<div className="space-y-6">
						<Skeleton className="h-48 w-full" />
						<Skeleton className="h-32 w-full" />
					</div>
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className={cn("text-center py-12", className)}>
				<TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
				<h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
				<p className="text-muted-foreground">
					Performance analytics will appear here once you have portfolio data.
				</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">Performance Analytics</h2>
					<p className="text-muted-foreground">
						Comprehensive analysis of your portfolio performance
					</p>
				</div>
				<div className="flex items-center gap-2">
					{onTimeRangeChange && (
						<Select value={timeRange} onValueChange={onTimeRangeChange}>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{timeRanges.map((range) => (
									<SelectItem key={range.value} value={range.value}>
										{range.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			</div>

			{/* Performance Overview */}
			<PerformanceOverview
				totalValue={data.totalValue}
				totalChange={data.totalChange}
				totalChangePercent={data.totalChangePercent}
				timeRange={timeRange}
				compact={compact}
			/>

			{/* Summary Statistics */}
			{summaryStats && (
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<Card>
						<CardContent className="p-4 text-center">
							<p className="text-2xl font-bold text-blue-600">{summaryStats.portfolioCount}</p>
							<p className="text-xs text-muted-foreground">Portfolios</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4 text-center">
							<p className="text-2xl font-bold text-green-600">{summaryStats.assetTypes}</p>
							<p className="text-xs text-muted-foreground">Asset Types</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4 text-center">
							<p className="text-2xl font-bold text-orange-600">{summaryStats.activeAlerts}</p>
							<p className="text-xs text-muted-foreground">Active Alerts</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4 text-center">
							<p className="text-2xl font-bold text-red-600">{summaryStats.recentlyTriggered}</p>
							<p className="text-xs text-muted-foreground">Recent Triggers</p>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4 text-center">
							<p className="text-2xl font-bold text-purple-600">
								{summaryStats.highPriorityRecommendations}
							</p>
							<p className="text-xs text-muted-foreground">Recommendations</p>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Main Content Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-5">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="allocation">Allocation</TabsTrigger>
					<TabsTrigger value="comparison">Comparison</TabsTrigger>
					<TabsTrigger value="reports">Reports</TabsTrigger>
					<TabsTrigger value="alerts">Alerts</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-3">
						<div className="lg:col-span-2">
							<PerformanceMetrics
								metrics={data.metrics}
								timeRange={timeRange}
								isLoading={false}
								compact={compact}
								showBenchmarks={true}
								onMetricClick={onMetricClick}
							/>
						</div>
						<div>
							<QuickActions
								onGenerateReport={() => setActiveTab("reports")}
								onCreateAlert={() => setActiveTab("alerts")}
								onViewAnalytics={() => setActiveTab("comparison")}
								compact={compact}
							/>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="allocation" className="space-y-6">
					<AssetAllocation
						allocations={data.allocations}
						recommendations={data.recommendations}
						totalValue={data.totalValue}
						timeRange={timeRange}
						isLoading={false}
						compact={compact}
						showRecommendations={true}
						showChart={true}
						onAssetTypeClick={onAssetTypeClick}
						onRecommendationAction={onRecommendationAction}
					/>
				</TabsContent>

				<TabsContent value="comparison" className="space-y-6">
					<PerformanceComparison
						portfolioData={data.portfolioPerformance}
						benchmarks={data.benchmarks}
						timeRange={timeRange}
						isLoading={false}
						compact={compact}
						showChart={true}
						onTimeRangeChange={onTimeRangeChange}
						onBenchmarkAdd={onBenchmarkAdd}
						onBenchmarkRemove={onBenchmarkRemove}
					/>
				</TabsContent>

				<TabsContent value="reports" className="space-y-6">
					<PerformanceReports
						reportData={data.reportData}
						isLoading={false}
						compact={compact}
						onGenerateReport={onGenerateReport}
					/>
				</TabsContent>

				<TabsContent value="alerts" className="space-y-6">
					<PerformanceAlerts
						alerts={data.alerts}
						portfolios={portfolios}
						assets={assets}
						isLoading={false}
						compact={compact}
						onCreateAlert={onCreateAlert}
						onUpdateAlert={onUpdateAlert}
						onDeleteAlert={onDeleteAlert}
						onToggleAlert={onToggleAlert}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
};

export default PerformanceDashboard;
