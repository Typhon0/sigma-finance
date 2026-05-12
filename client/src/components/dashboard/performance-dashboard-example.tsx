import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssetAllocation from "./asset-allocation";
import PerformanceComparison from "./performance-comparison";
import PerformanceDashboard, { type PerformanceDashboardData } from "./performance-dashboard";
import PerformanceMetrics from "./performance-metrics";

// Mock data for demonstration
const mockPerformanceData: PerformanceDashboardData = {
	metrics: [
		{
			label: "Total Return",
			value: 15.2,
			change: 2.1,
			changePercent: 1.8,
			format: "percentage",
			description: "Time-weighted return over selected period",
			benchmark: 12.5,
			target: 18.0,
		},
		{
			label: "Portfolio Value",
			value: 125000,
			change: 3250,
			changePercent: 2.67,
			format: "currency",
			description: "Total market value of all positions",
		},
		{
			label: "Sharpe Ratio",
			value: 1.45,
			change: 0.12,
			format: "number",
			description: "Risk-adjusted return measure",
			benchmark: 1.2,
			target: 1.5,
		},
		{
			label: "Volatility",
			value: 18.5,
			change: -1.2,
			changePercent: -6.1,
			format: "percentage",
			description: "Portfolio volatility (standard deviation)",
			target: 15.0,
		},
		{
			label: "Max Drawdown",
			value: -8.2,
			change: 1.5,
			changePercent: -15.4,
			format: "percentage",
			description: "Maximum peak-to-trough decline",
			target: -10.0,
		},
		{
			label: "Alpha",
			value: 2.8,
			change: 0.5,
			changePercent: 21.7,
			format: "percentage",
			description: "Excess return vs benchmark",
			benchmark: 0.0,
			target: 3.0,
		},
	],
	allocations: [
		{
			assetType: "STOCK",
			name: "Stocks",
			value: 75000,
			percentage: 60.0,
			targetPercentage: 65.0,
			count: 12,
			color: "#10b981",
		},
		{
			assetType: "CRYPTO",
			name: "Cryptocurrency",
			value: 25000,
			percentage: 20.0,
			targetPercentage: 15.0,
			count: 5,
			color: "#f59e0b",
		},
		{
			assetType: "REAL_ESTATE",
			name: "Real Estate",
			value: 15000,
			percentage: 12.0,
			targetPercentage: 10.0,
			count: 2,
			color: "#8b5cf6",
		},
		{
			assetType: "BANK_ACCOUNT",
			name: "Cash & Equivalents",
			value: 10000,
			percentage: 8.0,
			targetPercentage: 10.0,
			count: 3,
			color: "#3b82f6",
		},
	],
	recommendations: [
		{
			type: "overweight",
			assetType: "CRYPTO",
			currentPercentage: 20.0,
			targetPercentage: 15.0,
			suggestedAction:
				"Consider reducing cryptocurrency allocation by 5% to meet target allocation",
			priority: "medium",
			impact: 1.2,
		},
		{
			type: "underweight",
			assetType: "STOCK",
			currentPercentage: 60.0,
			targetPercentage: 65.0,
			suggestedAction: "Increase stock allocation by 5% to optimize portfolio balance",
			priority: "low",
			impact: 0.8,
		},
	],
	portfolioPerformance: [
		{
			id: "portfolio-1",
			name: "Growth Portfolio",
			value: 75000,
			change: 2250,
			changePercent: 3.1,
			data: [
				{ date: "2024-01-01", value: 72750 },
				{ date: "2024-01-15", value: 74100 },
				{ date: "2024-01-30", value: 75000 },
			],
			color: "#10b981",
		},
		{
			id: "portfolio-2",
			name: "Conservative Portfolio",
			value: 50000,
			change: 1000,
			changePercent: 2.0,
			data: [
				{ date: "2024-01-01", value: 49000 },
				{ date: "2024-01-15", value: 49500 },
				{ date: "2024-01-30", value: 50000 },
			],
			color: "#3b82f6",
		},
	],
	benchmarks: [
		{
			id: "sp500",
			name: "S&P 500",
			symbol: "SPY",
			value: 4500,
			change: 45.2,
			changePercent: 1.02,
			data: [
				{ date: "2024-01-01", value: 4454.8 },
				{ date: "2024-01-15", value: 4477.5 },
				{ date: "2024-01-30", value: 4500 },
			],
			color: "#ef4444",
		},
	],
	alerts: [
		{
			id: "alert-1",
			name: "Portfolio Value Alert",
			type: "portfolio_value",
			condition: "below",
			threshold: 120000,
			isActive: true,
			frequency: "immediate",
			createdAt: new Date("2024-01-01"),
			description: "Alert when portfolio drops below $120k",
			notificationMethods: ["email", "push"],
		},
		{
			id: "alert-2",
			name: "Crypto Allocation Alert",
			type: "allocation",
			condition: "above",
			threshold: 25,
			targetAsset: "crypto-allocation",
			isActive: true,
			frequency: "daily",
			createdAt: new Date("2024-01-15"),
			lastTriggered: new Date("2024-01-29"),
			description: "Alert when crypto allocation exceeds 25%",
			notificationMethods: ["email"],
		},
	],
	reportData: {
		portfolioSummary: {
			totalValue: 125000,
			totalChange: 3250,
			totalChangePercent: 2.67,
			assetCount: 22,
		},
		performance: {
			timeWeightedReturn: 15.2,
			sharpeRatio: 1.45,
			volatility: 18.5,
			maxDrawdown: -8.2,
		},
		allocation: [
			{ assetType: "STOCK", value: 75000, percentage: 60.0 },
			{ assetType: "CRYPTO", value: 25000, percentage: 20.0 },
			{ assetType: "REAL_ESTATE", value: 15000, percentage: 12.0 },
			{ assetType: "BANK_ACCOUNT", value: 10000, percentage: 8.0 },
		],
		topPerformers: [
			{ name: "AAPL", change: 250, changePercent: 5.2 },
			{ name: "BTC", change: 1200, changePercent: 4.8 },
			{ name: "TSLA", change: 180, changePercent: 3.9 },
		],
		transactions: [
			{ date: "2024-01-29", type: "BUY", asset: "AAPL", amount: 5000 },
			{ date: "2024-01-28", type: "SELL", asset: "MSFT", amount: -2500 },
			{ date: "2024-01-27", type: "BUY", asset: "BTC", amount: 3000 },
		],
	},
	totalValue: 125000,
	totalChange: 3250,
	totalChangePercent: 2.67,
};

const mockPortfolios = [
	{ id: "portfolio-1", name: "Growth Portfolio" },
	{ id: "portfolio-2", name: "Conservative Portfolio" },
	{ id: "portfolio-3", name: "Retirement Portfolio" },
];

const mockAssets = [
	{ id: "asset-1", name: "Apple Inc.", symbol: "AAPL" },
	{ id: "asset-2", name: "Microsoft Corp.", symbol: "MSFT" },
	{ id: "asset-3", name: "Bitcoin", symbol: "BTC" },
	{ id: "asset-4", name: "Ethereum", symbol: "ETH" },
];

export const PerformanceDashboardExample: React.FC = () => {
	const [timeRange, setTimeRange] = useState("1M");
	const [selectedView, setSelectedView] = useState<"full" | "compact" | "individual">("full");

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleMetricClick = (_metric: any) => {};

	const handleAssetTypeClick = (_assetType: string) => {};

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleRecommendationAction = (_recommendation: any) => {};

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleGenerateReport = async (_config: any) => {
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 2000));
	};

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleCreateAlert = async (_alert: any) => {
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));
	};

	return (
		<div className="space-y-8 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Performance Dashboard Example</h1>
					<p className="text-muted-foreground">
						Comprehensive performance analytics and metrics for portfolio management
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant={selectedView === "full" ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedView("full")}
					>
						Full Dashboard
					</Button>
					<Button
						variant={selectedView === "compact" ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedView("compact")}
					>
						Compact View
					</Button>
					<Button
						variant={selectedView === "individual" ? "default" : "outline"}
						size="sm"
						onClick={() => setSelectedView("individual")}
					>
						Individual Components
					</Button>
				</div>
			</div>

			{selectedView === "full" && (
				<PerformanceDashboard
					data={mockPerformanceData}
					portfolios={mockPortfolios}
					assets={mockAssets}
					timeRange={timeRange}
					onTimeRangeChange={setTimeRange}
					onMetricClick={handleMetricClick}
					onAssetTypeClick={handleAssetTypeClick}
					onRecommendationAction={handleRecommendationAction}
					onGenerateReport={handleGenerateReport}
					onCreateAlert={handleCreateAlert}
				/>
			)}

			{selectedView === "compact" && (
				<PerformanceDashboard
					data={mockPerformanceData}
					portfolios={mockPortfolios}
					assets={mockAssets}
					timeRange={timeRange}
					compact={true}
					onTimeRangeChange={setTimeRange}
					onMetricClick={handleMetricClick}
					onAssetTypeClick={handleAssetTypeClick}
					onRecommendationAction={handleRecommendationAction}
					onGenerateReport={handleGenerateReport}
					onCreateAlert={handleCreateAlert}
				/>
			)}

			{selectedView === "individual" && (
				<Tabs defaultValue="metrics" className="w-full">
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="metrics">Metrics</TabsTrigger>
						<TabsTrigger value="allocation">Allocation</TabsTrigger>
						<TabsTrigger value="comparison">Comparison</TabsTrigger>
						<TabsTrigger value="reports">Reports</TabsTrigger>
						<TabsTrigger value="alerts">Alerts</TabsTrigger>
					</TabsList>

					<TabsContent value="metrics" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Performance Metrics Component</CardTitle>
							</CardHeader>
							<CardContent>
								<PerformanceMetrics
									metrics={mockPerformanceData.metrics}
									timeRange={timeRange}
									showBenchmarks={true}
									onMetricClick={handleMetricClick}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="allocation" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Asset Allocation Component</CardTitle>
							</CardHeader>
							<CardContent>
								<AssetAllocation
									allocations={mockPerformanceData.allocations}
									recommendations={mockPerformanceData.recommendations}
									totalValue={mockPerformanceData.totalValue}
									timeRange={timeRange}
									showRecommendations={true}
									showChart={true}
									onAssetTypeClick={handleAssetTypeClick}
									onRecommendationAction={handleRecommendationAction}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="comparison" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Performance Comparison Component</CardTitle>
							</CardHeader>
							<CardContent>
								<PerformanceComparison
									portfolioData={mockPerformanceData.portfolioPerformance}
									benchmarks={mockPerformanceData.benchmarks}
									timeRange={timeRange}
									showChart={true}
									onTimeRangeChange={setTimeRange}
								/>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="reports" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Performance Reports Component</CardTitle>
							</CardHeader>
							<CardContent>
								{/* Reports component would go here */}
								<div className="text-center py-8 text-muted-foreground">
									Performance Reports component - see full dashboard for implementation
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="alerts" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Performance Alerts Component</CardTitle>
							</CardHeader>
							<CardContent>
								{/* Alerts component would go here */}
								<div className="text-center py-8 text-muted-foreground">
									Performance Alerts component - see full dashboard for implementation
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			)}

			{/* Usage Examples */}
			<Card>
				<CardHeader>
					<CardTitle>Usage Examples</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<h4 className="font-semibold mb-2">Key Features</h4>
							<ul className="text-sm space-y-1 text-muted-foreground">
								<li>• Comprehensive performance metrics with benchmarking</li>
								<li>• Interactive asset allocation with recommendations</li>
								<li>• Multi-portfolio performance comparison</li>
								<li>• Customizable report generation and export</li>
								<li>• Real-time performance alerts and notifications</li>
								<li>• Dashboard-optimized compact views</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold mb-2">Integration Points</h4>
							<ul className="text-sm space-y-1 text-muted-foreground">
								<li>• Portfolio management system</li>
								<li>• Real-time market data feeds</li>
								<li>• Notification services (email, push, SMS)</li>
								<li>• Report generation and export APIs</li>
								<li>• Alert management system</li>
								<li>• User preference storage</li>
							</ul>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default PerformanceDashboardExample;
