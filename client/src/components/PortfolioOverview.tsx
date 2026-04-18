import ReactECharts from "echarts-for-react";
import { BarChart3, PieChart } from "lucide-react";
import { useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { PieChartWithCenter } from "./PieChartWithCenter";
import { TrendArrowDown, TrendArrowUp } from "./TrendArrows";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const assetTypeMap = {
	all: null,
	stocks: ["stock", "fund"],
	crypto: ["crypto"],
	savings: ["bank", "savings"],
	"real-estate": ["real_estate"],
	loans: ["loan"],
	other: ["watch", "insurance", "other"],
};

export function PortfolioOverview({ assetTypeFilter = "all" }) {
	const {
		assets,
		transactions,
		_watchlist,
		_getPortfolioValue,
		getPortfolioGainLoss,
		portfolios,
		currentPortfolio,
	} = usePortfolio();

	const [timeRange, setTimeRange] = useState("1Y");

	// Utility functions
	const getAssetTypeLabel = (type) => {
		const labels = {
			stock: "Stocks",
			fund: "Funds",
			crypto: "Crypto",
			bank: "Cash",
			savings: "Savings",
			real_estate: "Real Estate",
			insurance: "Insurance",
			watch: "Watches",
			loan: "Loans",
			other: "Other",
		};
		return labels[type] || type;
	};

	const formatCurrency = (amount) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const _getFilterLabel = () => {
		const labels = {
			all: "All Assets",
			stocks: "Stocks & Funds",
			crypto: "Cryptocurrency",
			savings: "Savings & Cash",
			"real-estate": "Real Estate",
			loans: "Loans",
			other: "Other Assets",
		};
		return labels[assetTypeFilter] || "All Assets";
	};

	// Filter assets by type
	const filteredAssets =
		assetTypeFilter === "all"
			? assets
			: assets.filter((asset) => {
					const allowedTypes = assetTypeMap[assetTypeFilter] || [];
					return allowedTypes.includes(asset.type);
				});

	// Calculate portfolio value with filtered assets
	const portfolioValue = filteredAssets.reduce(
		(total, asset) => total + (asset.currentValue || 0),
		0,
	);

	const { gain, gainPercent, totalPurchase } = getPortfolioGainLoss();

	// Calculate asset allocation with filtered assets
	const assetAllocation = filteredAssets.reduce((acc, asset) => {
		const value = asset.currentValue || 0;
		acc[asset.type] = (acc[asset.type] || 0) + value;
		return acc;
	}, {});

	// Group assets by category for breakdown table
	const assetsByCategory = {
		"Stocks & Funds": filteredAssets.filter(
			(a) => a.type === "stock" || a.type === "fund",
		),
		Cryptocurrency: filteredAssets.filter((a) => a.type === "crypto"),
		"Savings & Cash": filteredAssets.filter(
			(a) => a.type === "bank" || a.type === "savings",
		),
		"Real Estate": filteredAssets.filter((a) => a.type === "real_estate"),
		Loans: filteredAssets.filter((a) => a.type === "loan"),
		Other: filteredAssets.filter(
			(a) => a.type === "watch" || a.type === "insurance" || a.type === "other",
		),
	};

	const categoryBreakdown = Object.entries(assetsByCategory)
		.map(([category, categoryAssets]) => {
			const totalValue = categoryAssets.reduce(
				(sum, asset) => sum + (asset.currentValue || 0),
				0,
			);

			const totalCost = categoryAssets.reduce((sum, asset) => {
				return (
					sum +
					(asset.purchasePrice
						? (asset.quantity || 1) * asset.purchasePrice
						: totalValue)
				);
			}, 0);

			const pl = totalValue - totalCost;
			const plPercent = totalCost > 0 ? (pl / totalCost) * 100 : 0;

			return {
				category,
				count: categoryAssets.length,
				value: totalValue,
				cost: totalCost,
				pl,
				plPercent,
				allocation:
					portfolioValue > 0 ? (totalValue / portfolioValue) * 100 : 0,
			};
		})
		.filter((cat) => cat.count > 0)
		.sort((a, b) => b.value - a.value);

	// Use real performance history from selectedPortfolio
	const { selectedPortfolio } = usePortfolio();
	const performanceHistory =
		selectedPortfolio?.analytics?.performanceHistory ?? [];

	const historicalData =
		performanceHistory.length > 0
			? performanceHistory.map((p: any) => ({
					date: new Date(p.date).toISOString().split("T")[0],
					value: p.value,
				}))
			: [
					{
						date: new Date().toISOString().split("T")[0],
						value: portfolioValue,
					},
				];

	// Prepare data for pie chart
	const pieChartData = Object.entries(assetAllocation)
		.map(([type, value]) => ({
			name: getAssetTypeLabel(type),
			value,
		}))
		.filter((item) => item.value > 0);

	// Recent transactions (last 5)
	const recentTransactions = transactions
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 5);

	const _currentPortfolioName =
		portfolios.find((p) => p.id === currentPortfolio)?.name || "Portfolio";

	// Line chart configuration
	const lineChartOption = {
		tooltip: {
			trigger: "axis",
			formatter: (params) => {
				const data = params[0];
				return `${data.name}<br/>${data.seriesName}: ${formatCurrency(data.value)}`;
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			top: "10%",
			containLabel: true,
		},
		xAxis: {
			type: "category",
			data: historicalData.map((d) => d.date),
			boundaryGap: false,
			axisLine: {
				lineStyle: {
					color: "hsl(var(--muted-foreground))",
				},
			},
			axisLabel: {
				formatter: (value) => {
					const date = new Date(value);
					return `${date.getMonth() + 1}/${date.getDate()}`;
				},
			},
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value) => {
					if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
					if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
					return `$${value}`;
				},
			},
			axisLine: {
				lineStyle: {
					color: "hsl(var(--muted-foreground))",
				},
			},
			splitLine: {
				lineStyle: {
					color: "hsl(var(--border))",
				},
			},
		},
		series: [
			{
				name: "Portfolio Value",
				type: "line",
				smooth: true,
				data: historicalData.map((d) => d.value),
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{
								offset: 0,
								color:
									gain >= 0
										? "rgba(16, 185, 129, 0.3)"
										: "rgba(239, 68, 68, 0.3)",
							},
							{
								offset: 1,
								color:
									gain >= 0
										? "rgba(16, 185, 129, 0.05)"
										: "rgba(239, 68, 68, 0.05)",
							},
						],
					},
				},
				lineStyle: {
					color: gain >= 0 ? "#10b981" : "#ef4444",
					width: 2,
				},
				itemStyle: {
					color: gain >= 0 ? "#10b981" : "#ef4444",
				},
			},
		],
	};

	// Performance bar chart data
	const performanceChartOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: {
				type: "shadow",
			},
			formatter: (params) => {
				const data = params[0];
				return `${data.name}<br/>${data.seriesName}: ${data.value.toFixed(2)}%`;
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			top: "10%",
			containLabel: true,
		},
		xAxis: {
			type: "category",
			data: categoryBreakdown.map((cat) => cat.category),
			axisLine: {
				lineStyle: {
					color: "hsl(var(--muted-foreground))",
				},
			},
			axisLabel: {
				rotate: 45,
				fontSize: 10,
			},
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: "{value}%",
			},
			axisLine: {
				lineStyle: {
					color: "hsl(var(--muted-foreground))",
				},
			},
			splitLine: {
				lineStyle: {
					color: "hsl(var(--border))",
				},
			},
		},
		series: [
			{
				name: "Return",
				type: "bar",
				data: categoryBreakdown.map((cat) => ({
					value: cat.plPercent,
					itemStyle: {
						color: cat.pl >= 0 ? "#10b981" : "#ef4444",
					},
				})),
				barWidth: "60%",
			},
		],
	};

	return (
		<div className="space-y-4">
			{/* Clean Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<p className="text-sm text-muted-foreground mb-2">
						Value of Portfolio
					</p>
					<h1 className="text-5xl font-mono font-semibold mb-2">
						{formatCurrency(portfolioValue)}
					</h1>
					<div
						className={`flex items-center gap-1.5 text-xl font-mono font-semibold ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
					>
						{gain >= 0 ? (
							<TrendArrowUp className="flex-shrink-0" />
						) : (
							<TrendArrowDown className="flex-shrink-0" />
						)}
						<span>
							{formatCurrency(gain)} ({gainPercent.toFixed(2)}%)
						</span>
					</div>
				</div>
			</div>

			{/* Hero Chart - Value Over Time */}
			<Card className="mb-4">
				<CardContent className="p-6">
					<div className="flex items-center justify-end gap-1 mb-4">
						{["1M", "3M", "6M", "1Y"].map((range) => (
							<Button
								key={range}
								variant={timeRange === range ? "default" : "ghost"}
								size="sm"
								onClick={() => setTimeRange(range)}
								className="h-7 px-3 text-xs"
							>
								{range}
							</Button>
						))}
					</div>
					<ReactECharts
						option={lineChartOption}
						style={{ height: "380px" }}
						opts={{ renderer: "svg" }}
					/>
				</CardContent>
			</Card>

			{/* Key Metrics - 3 Clean Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm text-muted-foreground">Total Return</p>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 rounded-full"
							>
								{" "}
								<svg
									className="h-4 w-4 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									role="img"
									aria-label="Total return info"
								>
									<title>Total return info</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</Button>
						</div>
						<p
							className={`text-2xl font-mono font-semibold ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{formatCurrency(gain)}
						</p>
						<p
							className={`text-sm mt-1 ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{gain >= 0 ? "+" : ""}
							{gainPercent.toFixed(2)}%
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm text-muted-foreground">Total Cost</p>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 rounded-full"
							>
								<svg
									className="h-4 w-4 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									role="img"
									aria-label="Total cost info"
								>
									<title>Total cost info</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</Button>
						</div>
						<p className="text-2xl font-mono font-semibold">
							{formatCurrency(totalPurchase)}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm text-muted-foreground">Available Assets</p>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 rounded-full"
							>
								<svg
									className="h-4 w-4 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									role="img"
									aria-label="Available assets info"
								>
									<title>Available assets info</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</Button>
						</div>
						<p className="text-2xl font-mono font-semibold">
							{filteredAssets.length.toLocaleString()}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Additional Analytics */}
			<Card>
				<CardHeader className="px-4 pt-3 pb-2">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Additional Analytics</CardTitle>
							<CardDescription>
								Allocation and performance breakdown
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-4 pb-3">
					<Tabs defaultValue="allocation" className="w-full">
						<TabsList className="grid w-full max-w-md grid-cols-2">
							<TabsTrigger value="allocation" className="gap-2">
								<PieChart className="h-4 w-4" />
								Allocation
							</TabsTrigger>
							<TabsTrigger value="performance" className="gap-2">
								<BarChart3 className="h-4 w-4" />
								Performance
							</TabsTrigger>
						</TabsList>

						<TabsContent value="allocation" className="mt-4">
							<PieChartWithCenter
								data={pieChartData}
								centerLabel="Total"
								formatValue={formatCurrency}
								height="280px"
							/>
						</TabsContent>

						<TabsContent value="performance" className="mt-4">
							<ReactECharts
								option={performanceChartOption}
								style={{ height: "280px" }}
								opts={{ renderer: "svg" }}
							/>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Asset Breakdown Table & Recent Activity */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				{/* Asset Breakdown by Category */}
				<Card className="lg:col-span-2">
					<CardHeader className="px-4 pt-3 pb-2">
						<CardTitle>Asset Breakdown</CardTitle>
						<CardDescription>
							Portfolio distribution by category
						</CardDescription>
					</CardHeader>
					<CardContent className="px-4 pb-3">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Category</TableHead>
									<TableHead className="text-right">Assets</TableHead>
									<TableHead className="text-right">Value</TableHead>
									<TableHead className="text-right">Allocation</TableHead>
									<TableHead className="text-right">P&L</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{categoryBreakdown.map((cat) => (
									<TableRow key={cat.category}>
										<TableCell className="font-medium">
											{cat.category}
										</TableCell>
										<TableCell className="text-right">
											<Badge variant="secondary">{cat.count}</Badge>
										</TableCell>
										<TableCell className="text-right font-mono">
											{formatCurrency(cat.value)}
										</TableCell>
										<TableCell className="text-right">
											<Badge variant="outline">
												{cat.allocation.toFixed(1)}%
											</Badge>
										</TableCell>
										<TableCell
											className={`text-right font-mono ${cat.pl >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{cat.pl >= 0 ? "+" : ""}
											{formatCurrency(cat.pl)}
											<div className="text-xs">
												({cat.pl >= 0 ? "+" : ""}
												{cat.plPercent.toFixed(2)}%)
											</div>
										</TableCell>
									</TableRow>
								))}
								{categoryBreakdown.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={5}
											className="text-center text-muted-foreground py-8"
										>
											No assets found
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Recent Activity */}
				<Card>
					<CardHeader className="px-4 pt-3 pb-2">
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>Latest transactions</CardDescription>
					</CardHeader>
					<CardContent className="px-4 pb-3">
						<div className="space-y-3">
							{recentTransactions.length > 0 ? (
								recentTransactions.map((transaction) => {
									const asset = filteredAssets.find(
										(a) => a.id === transaction.assetId,
									);
									return (
										<div
											key={transaction.id}
											className="flex items-start justify-between pb-3 border-b last:border-0"
										>
											<div className="space-y-1 flex-1">
												<p className="text-sm font-medium line-clamp-1">
													{asset?.name || asset?.symbol || "Unknown"}
												</p>
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="text-xs">
														{transaction.type}
													</Badge>
													<span className="text-xs text-muted-foreground">
														{new Date(transaction.date).toLocaleDateString()}
													</span>
												</div>
											</div>
											<div className="text-right">
												<div className="text-sm font-mono font-medium">
													{formatCurrency(transaction.total)}
												</div>
											</div>
										</div>
									);
								})
							) : (
								<div className="text-center text-muted-foreground py-8">
									<p className="text-sm">No recent transactions</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
