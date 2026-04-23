import type { EChartsCoreOption } from "echarts";
import ReactECharts from "echarts-for-react";
import {
	Activity,
	AlertTriangle,
	CheckCircle,
	Clock,
	Database,
	Globe,
	Monitor,
	RefreshCw,
	Smartphone,
	Tablet,
	TrendingDown,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	usePerformanceMetrics,
	useRealTimePerformanceMonitoring,
	useSystemHealth,
	useUserEngagementMetrics,
} from "@/hooks/use-performance-monitoring";

interface PerformanceDashboardProps {
	className?: string;
}

export function PerformanceDashboard({ className }: PerformanceDashboardProps) {
	const [timeRange, setTimeRange] = useState("24h");
	const {
		metrics,
		loading: metricsLoading,
		refetch: refetchMetrics,
	} = usePerformanceMetrics(timeRange);
	const { health, loading: healthLoading } = useSystemHealth();
	const { engagement, loading: engagementLoading } = useUserEngagementMetrics(timeRange);
	const { realtimeMetrics: _realtimeMetrics } = useRealTimePerformanceMonitoring();

	const isLoading = metricsLoading || healthLoading || engagementLoading;

	// Status color mapping
	const getStatusColor = (status: string) => {
		switch (status) {
			case "healthy":
				return "text-green-600";
			case "degraded":
				return "text-yellow-600";
			case "unhealthy":
				return "text-red-600";
			default:
				return "text-gray-600";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "healthy":
				return <CheckCircle className="h-4 w-4 text-green-600" />;
			case "degraded":
				return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
			case "unhealthy":
				return <AlertTriangle className="h-4 w-4 text-red-600" />;
			default:
				return <Activity className="h-4 w-4 text-gray-600" />;
		}
	};

	// Format duration in milliseconds to readable format
	const formatDuration = (ms: number) => {
		if (ms < 1000) return `${ms.toFixed(0)}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	};

	// Format percentage
	const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

	// Generate chart data for performance trends
	const performanceChartData = useMemo(() => {
		if (!metrics) return [];

		const hours = Array.from({ length: 24 }, (_, i) => {
			const hour = new Date();
			hour.setHours(hour.getHours() - (23 - i));
			return hour.getHours();
		});

		return hours.map((hour) => ({
			hour: `${hour}:00`,
			stateTransitions: Math.random() * 100 + 50, // Mock data - replace with real data
			dataLoads: Math.random() * 200 + 100,
			errors: Math.random() * 10,
		}));
	}, [metrics]);

	// Device breakdown chart data
	const deviceChartData = useMemo(() => {
		if (!engagement?.deviceBreakdown) return [];

		return Object.entries(engagement.deviceBreakdown).map(([device, count]) => ({
			name: device,
			value: count,
			color: device === "desktop" ? "#8884d8" : device === "mobile" ? "#82ca9d" : "#ffc658",
		}));
	}, [engagement]);
	const stateTransitionsOption = useMemo<EChartsCoreOption>(() => {
		return {
			grid: { left: 32, right: 16, top: 20, bottom: 24, containLabel: true },
			xAxis: {
				type: "category",
				data: performanceChartData.map((item) => item.hour),
				axisTick: { show: false },
			},
			yAxis: { type: "value" },
			tooltip: { trigger: "axis" },
			series: [
				{
					type: "line",
					smooth: true,
					showSymbol: false,
					lineStyle: { color: "#8884d8", width: 2 },
					data: performanceChartData.map((item) => item.stateTransitions),
				},
			],
		};
	}, [performanceChartData]);
	const dataLoadsOption = useMemo<EChartsCoreOption>(() => {
		return {
			grid: { left: 32, right: 16, top: 20, bottom: 24, containLabel: true },
			xAxis: {
				type: "category",
				data: performanceChartData.map((item) => item.hour),
				axisTick: { show: false },
			},
			yAxis: { type: "value" },
			tooltip: { trigger: "axis" },
			series: [
				{
					type: "line",
					smooth: true,
					showSymbol: false,
					lineStyle: { color: "#82ca9d", width: 2 },
					data: performanceChartData.map((item) => item.dataLoads),
				},
			],
		};
	}, [performanceChartData]);
	const errorsOption = useMemo<EChartsCoreOption>(() => {
		return {
			grid: { left: 32, right: 16, top: 20, bottom: 24, containLabel: true },
			xAxis: {
				type: "category",
				data: performanceChartData.map((item) => item.hour),
				axisTick: { show: false },
			},
			yAxis: { type: "value" },
			tooltip: { trigger: "axis" },
			series: [
				{
					type: "line",
					smooth: true,
					showSymbol: false,
					lineStyle: { color: "#ef4444", width: 2 },
					data: performanceChartData.map((item) => item.errors),
				},
			],
		};
	}, [performanceChartData]);
	const deviceBreakdownOption = useMemo<EChartsCoreOption>(() => {
		return {
			tooltip: {
				trigger: "item",
				formatter: (params) => {
					if (typeof params !== "object" || params === null || !("value" in params)) {
						return "";
					}
					const value = typeof params.value === "number" ? params.value : Number(params.value ?? 0);
					return `${params.name}: ${value}`;
				},
			},
			series: [
				{
					type: "pie",
					radius: ["40%", "70%"],
					center: ["50%", "50%"],
					padAngle: 2,
					data: deviceChartData.map((device) => ({
						name: device.name,
						value: device.value,
						itemStyle: { color: device.color },
					})),
				},
			],
		};
	}, [deviceChartData]);

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
					<p className="text-muted-foreground">
						Monitor system performance, user engagement, and application health
					</p>
				</div>
				<div className="flex items-center gap-4">
					<Select value={timeRange} onValueChange={setTimeRange}>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1h">Last Hour</SelectItem>
							<SelectItem value="24h">Last 24h</SelectItem>
							<SelectItem value="7d">Last 7 days</SelectItem>
							<SelectItem value="30d">Last 30 days</SelectItem>
						</SelectContent>
					</Select>
					<Button variant="outline" size="sm" onClick={() => refetchMetrics()} disabled={isLoading}>
						<RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</div>
			</div>

			{/* System Health Overview */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">System Status</CardTitle>
						{health && getStatusIcon(health.status)}
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{health ? (
								<span className={getStatusColor(health.status)}>
									{health.status.charAt(0).toUpperCase() + health.status.slice(1)}
								</span>
							) : (
								"Loading..."
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							{health?.recentErrors ? `${health.recentErrors} recent errors` : "No recent errors"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{metrics?.dataLoadTimes?.average
								? formatDuration(metrics.dataLoadTimes.average * 1000)
								: "--"}
						</div>
						<p className="text-xs text-muted-foreground">
							P95:{" "}
							{metrics?.dataLoadTimes?.p95
								? formatDuration(metrics.dataLoadTimes.p95 * 1000)
								: "--"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active Users</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{engagement?.activeUsers || "--"}</div>
						<p className="text-xs text-muted-foreground">
							Total: {engagement?.totalUsers || "--"} users
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Error Rate</CardTitle>
						<AlertTriangle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{metrics?.errorRates?.lastHour ? `${metrics.errorRates.lastHour.toFixed(1)}%` : "0%"}
						</div>
						<p className="text-xs text-muted-foreground">
							Last hour: {metrics?.errorRates?.lastHour || 0} errors
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Real-time Alerts */}
			{health && health.recentErrors > 5 && (
				<Alert>
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>High Error Rate Detected</AlertTitle>
					<AlertDescription>
						System is experiencing {health.recentErrors} errors in the last 5 minutes. Performance
						may be degraded.
					</AlertDescription>
				</Alert>
			)}

			{/* Main Content Tabs */}
			<Tabs defaultValue="performance" className="space-y-4">
				<TabsList>
					<TabsTrigger value="performance">Performance</TabsTrigger>
					<TabsTrigger value="engagement">User Engagement</TabsTrigger>
					<TabsTrigger value="errors">Error Analysis</TabsTrigger>
					<TabsTrigger value="market-data">Market Data</TabsTrigger>
				</TabsList>

				{/* Performance Tab */}
				<TabsContent value="performance" className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Dashboard State Transitions</CardTitle>
								<CardDescription>
									Performance of dashboard view transitions over time
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid gap-4 mb-4">
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">Average Duration</span>
										<span className="font-medium">
											{metrics?.dashboardStateTransitions?.average
												? formatDuration(metrics.dashboardStateTransitions.average * 1000)
												: "--"}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">P95 Duration</span>
										<span className="font-medium">
											{metrics?.dashboardStateTransitions?.p95
												? formatDuration(metrics.dashboardStateTransitions.p95 * 1000)
												: "--"}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">Total Transitions</span>
										<span className="font-medium">
											{metrics?.dashboardStateTransitions?.total || "--"}
										</span>
									</div>
								</div>
								<ReactECharts
									option={stateTransitionsOption}
									notMerge={true}
									lazyUpdate={true}
									style={{ width: "100%", height: 200 }}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Data Loading Performance</CardTitle>
								<CardDescription>Dashboard data loading times and success rates</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid gap-4 mb-4">
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">Average Load Time</span>
										<span className="font-medium">
											{metrics?.dataLoadTimes?.average
												? formatDuration(metrics.dataLoadTimes.average * 1000)
												: "--"}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">Success Rate</span>
										<span className="font-medium text-green-600">
											{metrics?.dataLoadTimes ? "98.5%" : "--"}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">Total Requests</span>
										<span className="font-medium">{metrics?.dataLoadTimes?.total || "--"}</span>
									</div>
								</div>
								<ReactECharts
									option={dataLoadsOption}
									notMerge={true}
									lazyUpdate={true}
									style={{ width: "100%", height: 200 }}
								/>
							</CardContent>
						</Card>
					</div>

					{/* Performance Breakdown */}
					<Card>
						<CardHeader>
							<CardTitle>Performance Breakdown by Component</CardTitle>
							<CardDescription>
								Detailed performance metrics for different dashboard components
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{metrics?.dashboardStateTransitions?.breakdown &&
									Object.entries(metrics.dashboardStateTransitions.breakdown).map(
										([component, value]) => (
											<div key={component} className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Badge variant="outline">{component}</Badge>
												</div>
												<div className="flex items-center gap-4">
													<Progress value={Math.min((value / 1000) * 100, 100)} className="w-24" />
													<span className="text-sm font-medium w-16 text-right">
														{formatDuration(value)}
													</span>
												</div>
											</div>
										),
									)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* User Engagement Tab */}
				<TabsContent value="engagement" className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Top Features</CardTitle>
								<CardDescription>Most used dashboard features and user engagement</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{engagement?.topFeatures?.map((feature, index) => (
										<div key={feature.feature} className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">#{index + 1}</span>
												<span className="text-sm">{feature.feature}</span>
											</div>
											<div className="flex items-center gap-4">
												<span className="text-sm text-muted-foreground">
													{feature.usageCount} uses
												</span>
												<span className="text-sm text-muted-foreground">
													{feature.uniqueUsers} users
												</span>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Device Breakdown</CardTitle>
								<CardDescription>User distribution across different device types</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-center mb-4">
									<ReactECharts
										option={deviceBreakdownOption}
										notMerge={true}
										lazyUpdate={true}
										style={{ width: "100%", height: 200 }}
									/>
								</div>
								<div className="space-y-2">
									{deviceChartData.map((device) => (
										<div key={device.name} className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												{device.name === "desktop" && <Monitor className="h-4 w-4" />}
												{device.name === "mobile" && <Smartphone className="h-4 w-4" />}
												{device.name === "tablet" && <Tablet className="h-4 w-4" />}
												<span className="text-sm capitalize">{device.name}</span>
											</div>
											<span className="text-sm font-medium">{device.value}</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Navigation Patterns */}
					<Card>
						<CardHeader>
							<CardTitle>Navigation Patterns</CardTitle>
							<CardDescription>Common user navigation flows and conversion rates</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{engagement?.navigationPatterns?.map((pattern, index) => (
									<div
										key={index}
										className="flex items-center justify-between p-4 border rounded-lg"
									>
										<div className="flex-1">
											<div className="font-medium">{pattern.pattern}</div>
											<div className="text-sm text-muted-foreground">
												{pattern.count} users • Avg: {formatDuration(pattern.avgDuration * 1000)}
											</div>
										</div>
										<div className="flex items-center gap-2">
											<Badge variant={pattern.conversion > 0.8 ? "default" : "secondary"}>
												{formatPercentage(pattern.conversion)} conversion
											</Badge>
											{pattern.conversion > 0.8 ? (
												<TrendingUp className="h-4 w-4 text-green-600" />
											) : (
												<TrendingDown className="h-4 w-4 text-yellow-600" />
											)}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Error Analysis Tab */}
				<TabsContent value="errors" className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>Error Trends</CardTitle>
								<CardDescription>Error occurrence patterns over time</CardDescription>
							</CardHeader>
							<CardContent>
								<ReactECharts
									option={errorsOption}
									notMerge={true}
									lazyUpdate={true}
									style={{ width: "100%", height: 300 }}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Errors by Component</CardTitle>
								<CardDescription>
									Distribution of errors across dashboard components
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{engagement?.errorsByComponent &&
										Object.entries(engagement.errorsByComponent).map(([component, count]) => (
											<div key={component} className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Badge variant="destructive">{component}</Badge>
												</div>
												<div className="flex items-center gap-4">
													<Progress
														value={Math.min(
															(count / Math.max(...Object.values(engagement.errorsByComponent))) *
																100,
															100,
														)}
														className="w-24"
													/>
													<span className="text-sm font-medium w-12 text-right">{count}</span>
												</div>
											</div>
										))}
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Market Data Tab */}
				<TabsContent value="market-data" className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-3">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Update Frequency</CardTitle>
								<Zap className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{metrics?.marketDataUpdates?.lastHour || "--"}
								</div>
								<p className="text-xs text-muted-foreground">Updates in last hour</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Data Quality</CardTitle>
								<Database className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-green-600">99.2%</div>
								<p className="text-xs text-muted-foreground">Success rate</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Latency</CardTitle>
								<Globe className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{metrics?.marketDataUpdates?.average
										? formatDuration(metrics.marketDataUpdates.average * 1000)
										: "--"}
								</div>
								<p className="text-xs text-muted-foreground">Average response time</p>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Market Data Sources</CardTitle>
							<CardDescription>
								Performance and reliability of different market data providers
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{["Alpha Vantage", "Yahoo Finance", "CoinGecko"].map((source) => (
									<div
										key={source}
										className="flex items-center justify-between p-4 border rounded-lg"
									>
										<div className="flex items-center gap-4">
											<Badge variant="outline">{source}</Badge>
											<div className="text-sm text-muted-foreground">
												Last update: 2 minutes ago
											</div>
										</div>
										<div className="flex items-center gap-4">
											<span className="text-sm">99.5% uptime</span>
											<Badge variant="default">Active</Badge>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
