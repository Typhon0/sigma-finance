import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AllocationDataPoint, PerformanceDataPoint } from "./index";
import {
	ChartCard,
	CompactAllocationChart,
	CompactPerformanceChart,
	DashboardChartGrid,
	MiniAllocationDonut,
	MiniPerformanceSparkline,
} from "./index";

/**
 * Example of how to integrate Apache ECharts components into a dashboard
 * This shows the dashboard-centric approach for inline portfolio viewing
 */

interface DashboardIntegrationExampleProps {
	portfolioId?: string;
	portfolioName?: string;
}

// Mock data - in real implementation, this would come from GraphQL queries
const mockPortfolioPerformance: PerformanceDataPoint[] = [
	{ date: "2024-01-01", value: 100000 },
	{ date: "2024-01-02", value: 102000 },
	{ date: "2024-01-03", value: 101500 },
	{ date: "2024-01-04", value: 103000 },
	{ date: "2024-01-05", value: 104500 },
	{ date: "2024-01-06", value: 103800 },
	{ date: "2024-01-07", value: 105200 },
];

const mockAllocation: AllocationDataPoint[] = [
	{
		name: "Technology Stocks",
		value: 45000,
		assetType: "STOCK",
		percentage: 42.9,
	},
	{
		name: "Cryptocurrency",
		value: 25000,
		assetType: "CRYPTO",
		percentage: 23.8,
	},
	{
		name: "Real Estate",
		value: 20000,
		assetType: "REAL_ESTATE",
		percentage: 19.0,
	},
	{
		name: "Cash & Equivalents",
		value: 15000,
		assetType: "BANK_ACCOUNT",
		percentage: 14.3,
	},
];

const mockTopHoldings: AllocationDataPoint[] = [
	{ name: "AAPL", value: 15000 },
	{ name: "BTC", value: 12000 },
	{ name: "GOOGL", value: 10000 },
	{ name: "ETH", value: 8000 },
	{ name: "MSFT", value: 7500 },
];

const DashboardIntegrationExample: React.FC<
	DashboardIntegrationExampleProps
> = ({ _portfolioId = "portfolio-1", portfolioName = "Growth Portfolio" }) => {
	const [timeRange, setTimeRange] = React.useState("1W");

	return (
		<div className="space-y-6">
			{/* Portfolio Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold">{portfolioName}</h2>
					<p className="text-muted-foreground">
						Portfolio performance and allocation
					</p>
				</div>
				<div className="text-right">
					<div className="text-2xl font-bold text-green-600">$105,200</div>
					<div className="text-sm text-muted-foreground">Total Value</div>
				</div>
			</div>

			{/* Key Metrics Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Return</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">+5.2%</div>
						<MiniPerformanceSparkline
							data={mockPortfolioPerformance.slice(-7)}
							height={30}
							color="#22c55e"
							showChange={false}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Today's Change
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">+$1,400</div>
						<div className="text-sm text-muted-foreground">+1.35%</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Asset Count</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">12</div>
						<div className="text-sm text-muted-foreground">4 asset types</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Top Allocation
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<MiniAllocationDonut
								data={mockAllocation.slice(0, 3)}
								size={40}
								showLegend={false}
							/>
							<div>
								<div className="text-sm font-medium">Technology</div>
								<div className="text-xs text-muted-foreground">42.9%</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Charts */}
			<DashboardChartGrid columns={2} gap="lg">
				<ChartCard
					title="Performance Overview"
					subtitle="Portfolio value over time"
					actions={
						<div className="flex gap-1">
							{["1D", "1W", "1M", "3M"].map((range) => (
								<button
									type="button"
									key={range}
									onClick={() => setTimeRange(range)}
									className={`px-2 py-1 text-xs rounded ${
										timeRange === range
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground hover:bg-muted/80"
									}`}
								>
									{range}
								</button>
							))}
						</div>
					}
				>
					<CompactPerformanceChart
						data={mockPortfolioPerformance}
						chartType="area"
						height={250}
						color="#22c55e"
					/>
				</ChartCard>

				<ChartCard
					title="Asset Allocation"
					subtitle="Current portfolio distribution"
				>
					<CompactAllocationChart
						data={mockAllocation}
						chartType="donut"
						height={250}
						onSegmentClick={(data) => {
							console.log("Navigate to asset type:", data.assetType);
						}}
					/>
				</ChartCard>
			</DashboardChartGrid>

			{/* Secondary Charts */}
			<DashboardChartGrid columns={3} gap="md">
				<ChartCard title="Top Holdings" subtitle="By value">
					<div className="space-y-3">
						{mockTopHoldings.slice(0, 5).map((holding, index) => (
							<div
								key={holding.name}
								className="flex items-center justify-between"
							>
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
										{index + 1}
									</div>
									<div>
										<div className="font-medium text-sm">{holding.name}</div>
										<div className="text-xs text-muted-foreground">
											{((holding.value / 105200) * 100).toFixed(1)}%
										</div>
									</div>
								</div>
								<div className="text-right">
									<div className="font-medium text-sm">
										${holding.value.toLocaleString()}
									</div>
								</div>
							</div>
						))}
					</div>
				</ChartCard>

				<ChartCard title="Recent Activity" subtitle="Last 7 days">
					<div className="space-y-3">
						<div className="flex items-center justify-between py-2">
							<div>
								<div className="font-medium text-sm">Bought AAPL</div>
								<div className="text-xs text-muted-foreground">2 days ago</div>
							</div>
							<div className="text-green-600 text-sm">+$2,500</div>
						</div>
						<div className="flex items-center justify-between py-2">
							<div>
								<div className="font-medium text-sm">Sold BTC</div>
								<div className="text-xs text-muted-foreground">3 days ago</div>
							</div>
							<div className="text-red-600 text-sm">-$1,200</div>
						</div>
						<div className="flex items-center justify-between py-2">
							<div>
								<div className="font-medium text-sm">Dividend MSFT</div>
								<div className="text-xs text-muted-foreground">5 days ago</div>
							</div>
							<div className="text-green-600 text-sm">+$85</div>
						</div>
					</div>
				</ChartCard>

				<ChartCard title="Performance Metrics" subtitle="Key indicators">
					<div className="space-y-4">
						<div>
							<div className="flex justify-between items-center mb-1">
								<span className="text-sm text-muted-foreground">
									Sharpe Ratio
								</span>
								<span className="text-sm font-medium">1.24</span>
							</div>
							<div className="w-full bg-muted rounded-full h-2">
								<div
									className="bg-green-500 h-2 rounded-full"
									style={{ width: "62%" }}
								/>
							</div>
						</div>

						<div>
							<div className="flex justify-between items-center mb-1">
								<span className="text-sm text-muted-foreground">
									Volatility
								</span>
								<span className="text-sm font-medium">18.5%</span>
							</div>
							<div className="w-full bg-muted rounded-full h-2">
								<div
									className="bg-yellow-500 h-2 rounded-full"
									style={{ width: "37%" }}
								/>
							</div>
						</div>

						<div>
							<div className="flex justify-between items-center mb-1">
								<span className="text-sm text-muted-foreground">
									Max Drawdown
								</span>
								<span className="text-sm font-medium">-8.2%</span>
							</div>
							<div className="w-full bg-muted rounded-full h-2">
								<div
									className="bg-red-500 h-2 rounded-full"
									style={{ width: "18%" }}
								/>
							</div>
						</div>
					</div>
				</ChartCard>
			</DashboardChartGrid>

			{/* Action Buttons */}
			<div className="flex gap-3">
				<button
					type="button"
					className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
				>
					Add Asset
				</button>
				<button
					type="button"
					className="px-4 py-2 border border-border rounded-md hover:bg-muted"
				>
					Record Transaction
				</button>
				<button
					type="button"
					className="px-4 py-2 border border-border rounded-md hover:bg-muted"
				>
					Export Data
				</button>
				<button
					type="button"
					className="px-4 py-2 border border-border rounded-md hover:bg-muted"
				>
					Portfolio Settings
				</button>
			</div>
		</div>
	);
};

export default DashboardIntegrationExample;
