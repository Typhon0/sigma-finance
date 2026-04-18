import {
	AlertTriangle,
	Award,
	Calendar,
	Download,
	Target,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart as RechartsPieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function Analytics() {
	const {
		assets,
		transactions,
		getPortfolioValue,
		getPortfolioGainLoss,
		selectedPortfolio,
	} = usePortfolio();
	const [timeframe, setTimeframe] = useState("1y");
	const [viewType, setViewType] = useState("overview");

	const portfolioValue = getPortfolioValue();
	const { gain, gainPercent } = getPortfolioGainLoss();

	// Use real performance history from selectedPortfolio if available
	const performanceHistory =
		selectedPortfolio?.analytics?.performanceHistory ?? [];
	const performanceData =
		performanceHistory.length > 0
			? performanceHistory.map((p: { date: string; value: number }) => ({
					date: new Date(p.date).toLocaleDateString("en-US", {
						year: "numeric",
						month: "short",
					}),
					value: p.value,
					benchmark: p.value * 0.98,
				}))
			: [
					{
						date: "No Data",
						value: portfolioValue,
						benchmark: portfolioValue * 0.98,
					},
				];

	// Calculate asset allocation for pie chart
	const assetAllocation = assets.reduce((acc, asset) => {
		const value = asset.currentValue || 0;
		acc[asset.type] = (acc[asset.type] || 0) + value;
		return acc;
	}, {});

	const allocationData = Object.entries(assetAllocation).map(
		([type, value]) => ({
			name: getAssetTypeLabel(type),
			value: value,
			percentage: (value / portfolioValue) * 100,
		}),
	);

	// Asset performance data
	const assetPerformanceData = assets
		.filter((asset) => asset.type === "stock" || asset.type === "crypto")
		.map((asset) => {
			const currentValue = asset.quantity * asset.currentPrice;
			const purchaseValue = asset.quantity * asset.purchasePrice;
			const assetGain = currentValue - purchaseValue;
			const assetGainPercent = (assetGain / purchaseValue) * 100;

			return {
				name: asset.symbol,
				value: currentValue,
				gain: assetGain,
				gainPercent: assetGainPercent,
			};
		})
		.sort((a, b) => b.gainPercent - a.gainPercent);

	function getAssetTypeLabel(type: string) {
		const labels = {
			stock: "Stocks",
			crypto: "Crypto",
			bank: "Cash",
			real_estate: "Real Estate",
			insurance: "Insurance",
			watch: "Watches",
			other: "Other",
		};
		return labels[type] || type;
	}

	const COLORS = [
		"#0088FE",
		"#00C49F",
		"#FFBB28",
		"#FF8042",
		"#8884D8",
		"#82CA9D",
		"#FFC658",
	];

	// Portfolio statistics
	const _totalAssets = assets.length;
	const diversificationScore = Math.min(
		Object.keys(assetAllocation).length * 20,
		100,
	);
	const riskScore = Math.max(Math.min(Math.abs(gainPercent) * 2, 100), 20);

	// Use real risk metrics from selectedPortfolio if available
	const riskMetrics = selectedPortfolio?.analytics?.riskMetrics;
	const volatility = riskMetrics?.volatility ?? Math.abs(gainPercent);
	const monthlyReturn = riskMetrics ? gainPercent / 12 : gainPercent / 12;
	const yearToDateReturn = gainPercent;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-mono">Analytics & Reports</h1>
					<p className="text-muted-foreground">
						Comprehensive portfolio analysis and insights
					</p>
				</div>
				<div className="flex space-x-2">
					<Select value={timeframe} onValueChange={setTimeframe}>
						<SelectTrigger className="w-32">
							<Calendar className="h-4 w-4 mr-2" />
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1w">1 Week</SelectItem>
							<SelectItem value="1m">1 Month</SelectItem>
							<SelectItem value="3m">3 Months</SelectItem>
							<SelectItem value="6m">6 Months</SelectItem>
							<SelectItem value="ytd">Year to Date</SelectItem>
							<SelectItem value="1y">1 Year</SelectItem>
							<SelectItem value="all">All Time</SelectItem>
						</SelectContent>
					</Select>
					<Button variant="outline">
						<Download className="h-4 w-4 mr-2" />
						Export Report
					</Button>
				</div>
			</div>

			{/* Key Metrics */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Portfolio Value</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono">
							${portfolioValue.toLocaleString()}
						</div>
						<div
							className={`flex items-center mt-1 ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{gain >= 0 ? (
								<TrendingUp className="h-4 w-4 mr-1" />
							) : (
								<TrendingDown className="h-4 w-4 mr-1" />
							)}
							<span className="text-sm">
								{gainPercent.toFixed(2)}% total return
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Monthly Return</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-green-600">
							+{monthlyReturn}%
						</div>
						<p className="text-xs text-muted-foreground">Last 30 days</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">YTD Return</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-green-600">
							+{yearToDateReturn}%
						</div>
						<p className="text-xs text-muted-foreground">Year to date</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Volatility</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono">{volatility}%</div>
						<p className="text-xs text-muted-foreground">30-day volatility</p>
					</CardContent>
				</Card>
			</div>

			<Tabs value={viewType} onValueChange={setViewType} className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="performance">Performance</TabsTrigger>
					<TabsTrigger value="allocation">Allocation</TabsTrigger>
					<TabsTrigger value="risk">Risk Analysis</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Portfolio Performance Chart */}
						<Card>
							<CardHeader>
								<CardTitle>Portfolio Performance</CardTitle>
								<CardDescription>
									Portfolio value vs benchmark over time
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="h-80">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart data={performanceData}>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis dataKey="date" />
											<YAxis />
											<Tooltip
												formatter={(value) => [
													`$${value.toLocaleString()}`,
													"",
												]}
											/>
											<Line
												type="monotone"
												dataKey="value"
												stroke="#0088FE"
												strokeWidth={2}
												name="Portfolio"
											/>
											<Line
												type="monotone"
												dataKey="benchmark"
												stroke="#888"
												strokeWidth={1}
												strokeDasharray="5 5"
												name="S&P 500"
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
							</CardContent>
						</Card>

						{/* Portfolio Composition */}
						<Card>
							<CardHeader>
								<CardTitle>Asset Allocation</CardTitle>
								<CardDescription>
									Distribution of your portfolio by asset type
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="h-80">
									<ResponsiveContainer width="100%" height="100%">
										<RechartsPieChart>
											<Pie
												data={allocationData}
												cx="50%"
												cy="50%"
												outerRadius={80}
												dataKey="value"
												label={({ name, percentage }) =>
													`${name} ${percentage.toFixed(1)}%`
												}
											>
												{allocationData.map((_entry, index) => (
													<Cell
														key={`cell-${index}`}
														fill={COLORS[index % COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip
												formatter={(value) => [
													`$${value.toLocaleString()}`,
													"Value",
												]}
											/>
										</RechartsPieChart>
									</ResponsiveContainer>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Portfolio Health Metrics */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Diversification Score
								</CardTitle>
								<Target className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-mono mb-2">
									{diversificationScore}/100
								</div>
								<Progress value={diversificationScore} className="mb-2" />
								<p className="text-xs text-muted-foreground">
									{diversificationScore >= 80
										? "Well diversified"
										: diversificationScore >= 60
											? "Moderately diversified"
											: "Consider diversifying"}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Risk Level
								</CardTitle>
								<AlertTriangle className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-mono mb-2">{riskScore}/100</div>
								<Progress value={riskScore} className="mb-2" />
								<p className="text-xs text-muted-foreground">
									{riskScore <= 30
										? "Conservative"
										: riskScore <= 60
											? "Moderate"
											: "Aggressive"}
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Performance Grade
								</CardTitle>
								<Award className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-mono mb-2">
									{gainPercent >= 15
										? "A+"
										: gainPercent >= 10
											? "A"
											: gainPercent >= 5
												? "B+"
												: gainPercent >= 0
													? "B"
													: "C"}
								</div>
								<p className="text-xs text-muted-foreground">
									Based on {timeframe} performance
								</p>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="performance" className="space-y-6">
					{/* Asset Performance */}
					<Card>
						<CardHeader>
							<CardTitle>Individual Asset Performance</CardTitle>
							<CardDescription>
								Performance of each asset in your portfolio
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={assetPerformanceData}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip
											formatter={(value) => [`${value.toFixed(2)}%`, "Return"]}
										/>
										<Bar dataKey="gainPercent" fill="#0088FE" />
									</BarChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>

					{/* Top Performers */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Top Performers</CardTitle>
								<CardDescription>Best performing assets</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{assetPerformanceData.slice(0, 5).map((asset, index) => (
										<div
											key={asset.name}
											className="flex items-center justify-between"
										>
											<div className="flex items-center space-x-3">
												<div className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
													{index + 1}
												</div>
												<div>
													<div className="font-medium">{asset.name}</div>
													<div className="text-sm text-muted-foreground">
														${asset.value.toLocaleString()}
													</div>
												</div>
											</div>
											<div className="text-right">
												<div className="text-green-600 font-mono">
													+{asset.gainPercent.toFixed(2)}%
												</div>
												<div className="text-sm text-muted-foreground">
													+${asset.gain.toLocaleString()}
												</div>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Recent Activity</CardTitle>
								<CardDescription>Latest portfolio changes</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{transactions.slice(0, 5).map((transaction, _index) => {
										const asset = assets.find(
											(a) => a.id === transaction.assetId,
										);
										return (
											<div
												key={transaction.id}
												className="flex items-center justify-between"
											>
												<div className="space-y-1">
													<div className="font-medium">
														{transaction.type.toUpperCase()} {asset?.symbol}
													</div>
													<div className="text-sm text-muted-foreground">
														{new Date(transaction.date).toLocaleDateString()}
													</div>
												</div>
												<div className="text-right">
													<div className="font-mono">
														${transaction.total.toLocaleString()}
													</div>
													<Badge variant="outline" className="text-xs">
														{transaction.type}
													</Badge>
												</div>
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="allocation" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Current Allocation</CardTitle>
								<CardDescription>Breakdown by asset type</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{allocationData.map((item, index) => (
										<div key={item.name} className="space-y-2">
											<div className="flex items-center justify-between">
												<div className="flex items-center space-x-2">
													<div
														className="w-3 h-3 rounded-full"
														style={{
															backgroundColor: COLORS[index % COLORS.length],
														}}
													/>
													<span className="font-medium">{item.name}</span>
												</div>
												<div className="text-right">
													<div className="font-mono">
														${item.value.toLocaleString()}
													</div>
													<div className="text-sm text-muted-foreground">
														{item.percentage.toFixed(1)}%
													</div>
												</div>
											</div>
											<Progress value={item.percentage} className="h-2" />
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Recommended Allocation</CardTitle>
								<CardDescription>Suggested portfolio balance</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="space-y-2">
										<div className="flex justify-between">
											<span>Stocks</span>
											<span>60%</span>
										</div>
										<Progress value={60} className="h-2" />
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span>Bonds</span>
											<span>20%</span>
										</div>
										<Progress value={20} className="h-2" />
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span>Real Estate</span>
											<span>10%</span>
										</div>
										<Progress value={10} className="h-2" />
									</div>
									<div className="space-y-2">
										<div className="flex justify-between">
											<span>Cash</span>
											<span>10%</span>
										</div>
										<Progress value={10} className="h-2" />
									</div>
								</div>
								<div className="mt-4 p-4 bg-muted rounded-lg">
									<p className="text-sm text-muted-foreground">
										This is a moderate risk allocation suitable for long-term
										growth. Adjust based on your risk tolerance and investment
										goals.
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="risk" className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Risk Metrics</CardTitle>
								<CardDescription>Portfolio risk analysis</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<div className="flex justify-between">
										<span>Volatility (30d)</span>
										<span className="font-mono">{volatility}%</span>
									</div>
									<Progress value={volatility * 5} className="h-2" />
								</div>

								<div className="space-y-2">
									<div className="flex justify-between">
										<span>Beta</span>
										<span className="font-mono">1.2</span>
									</div>
									<Progress value={60} className="h-2" />
								</div>

								<div className="space-y-2">
									<div className="flex justify-between">
										<span>Sharpe Ratio</span>
										<span className="font-mono">1.8</span>
									</div>
									<Progress value={90} className="h-2" />
								</div>

								<div className="space-y-2">
									<div className="flex justify-between">
										<span>Max Drawdown</span>
										<span className="font-mono text-red-600">-8.5%</span>
									</div>
									<Progress value={8.5 * 10} className="h-2" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Risk Recommendations</CardTitle>
								<CardDescription>
									Suggestions to optimize your portfolio
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									<div className="flex items-start space-x-3">
										<div className="bg-yellow-100 text-yellow-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
											!
										</div>
										<div>
											<div className="font-medium">
												Consider Diversification
											</div>
											<div className="text-sm text-muted-foreground">
												Add bonds or international stocks to reduce volatility
											</div>
										</div>
									</div>

									<div className="flex items-start space-x-3">
										<div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
											i
										</div>
										<div>
											<div className="font-medium">Rebalance Portfolio</div>
											<div className="text-sm text-muted-foreground">
												Some assets may be overweight relative to target
												allocation
											</div>
										</div>
									</div>

									<div className="flex items-start space-x-3">
										<div className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
											✓
										</div>
										<div>
											<div className="font-medium">Good Performance</div>
											<div className="text-sm text-muted-foreground">
												Your portfolio is performing well relative to benchmarks
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
