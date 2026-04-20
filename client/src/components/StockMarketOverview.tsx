import ReactECharts from "echarts-for-react";
import {
	Activity,
	ArrowRight,
	BarChart3,
	Building2,
	DollarSign,
	Eye,
	Flame,
	Globe,
	Percent,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface StockMarketOverviewProps {
	onNavigateToStockScreener: (preset?: string) => void;
	onNavigateToHeatmap: (type?: string) => void;
	onNavigateToCalendar?: () => void;
	onSelectStock?: (symbol: string) => void;
}

export function StockMarketOverview({
	onNavigateToStockScreener,
	onNavigateToHeatmap,
	onNavigateToCalendar,
	onSelectStock,
}: StockMarketOverviewProps) {
	const [activeTab, setActiveTab] = useState("gainers");

	// Mock data for indices
	const indices = [
		{
			name: "S&P 500",
			symbol: "SPX",
			value: 4783.35,
			change: 1.23,
			changePercent: 2.58,
		},
		{
			name: "Dow Jones",
			symbol: "DJI",
			value: 37440.34,
			change: 395.19,
			changePercent: 1.07,
		},
		{
			name: "Nasdaq",
			symbol: "IXIC",
			value: 14963.87,
			change: 255.32,
			changePercent: 1.74,
		},
		{
			name: "Russell 2000",
			symbol: "RUT",
			value: 2027.07,
			change: -12.45,
			changePercent: -0.61,
		},
		{
			name: "CAC 40",
			symbol: "FCHI",
			value: 7543.21,
			change: 45.32,
			changePercent: 0.6,
		},
		{
			name: "DAX",
			symbol: "GDAXI",
			value: 16751.64,
			change: 123.45,
			changePercent: 0.74,
		},
		{
			name: "FTSE 100",
			symbol: "FTSE",
			value: 7845.52,
			change: -15.28,
			changePercent: -0.19,
		},
		{
			name: "Nikkei 225",
			symbol: "N225",
			value: 33464.17,
			change: 234.56,
			changePercent: 0.71,
		},
	];

	// Mock data for sectors
	const sectors = [
		{
			name: "Technology",
			change: 2.34,
			volume: 145.2,
			color: "#3b82f6",
			marketCap: 12500,
		},
		{
			name: "Healthcare",
			change: 1.87,
			volume: 98.5,
			color: "#10b981",
			marketCap: 8200,
		},
		{
			name: "Financials",
			change: -0.45,
			volume: 112.3,
			color: "#ef4444",
			marketCap: 9800,
		},
		{
			name: "Energy",
			change: 3.12,
			volume: 87.4,
			color: "#f59e0b",
			marketCap: 5400,
		},
		{
			name: "Consumer Discretionary",
			change: 0.98,
			volume: 76.8,
			color: "#8b5cf6",
			marketCap: 7100,
		},
		{
			name: "Industrials",
			change: 1.23,
			volume: 65.2,
			color: "#ec4899",
			marketCap: 6200,
		},
		{
			name: "Materials",
			change: -1.15,
			volume: 45.3,
			color: "#6366f1",
			marketCap: 3800,
		},
		{
			name: "Utilities",
			change: 0.42,
			volume: 32.1,
			color: "#14b8a6",
			marketCap: 2900,
		},
	];

	// Mock data for top gainers/losers
	const topGainers = [
		{
			symbol: "NVDA",
			name: "NVIDIA Corp",
			price: 495.22,
			change: 8.34,
			volume: "52.3M",
			sector: "Technology",
			marketCap: "1.22T",
		},
		{
			symbol: "TSLA",
			name: "Tesla Inc",
			price: 248.48,
			change: 7.89,
			volume: "128.5M",
			sector: "Auto",
			marketCap: "788B",
		},
		{
			symbol: "AMD",
			name: "AMD Inc",
			price: 187.44,
			change: 6.72,
			volume: "78.2M",
			sector: "Technology",
			marketCap: "303B",
		},
		{
			symbol: "AMZN",
			name: "Amazon.com",
			price: 178.25,
			change: 5.91,
			volume: "45.8M",
			sector: "Consumer",
			marketCap: "1.84T",
		},
		{
			symbol: "META",
			name: "Meta Platforms",
			price: 389.18,
			change: 5.23,
			volume: "32.1M",
			sector: "Technology",
			marketCap: "986B",
		},
	];

	const topLosers = [
		{
			symbol: "INTC",
			name: "Intel Corp",
			price: 42.33,
			change: -4.52,
			volume: "48.3M",
			sector: "Technology",
			marketCap: "178B",
		},
		{
			symbol: "DIS",
			name: "Walt Disney",
			price: 91.27,
			change: -3.87,
			volume: "22.5M",
			sector: "Entertainment",
			marketCap: "166B",
		},
		{
			symbol: "BA",
			name: "Boeing Co",
			price: 218.54,
			change: -3.21,
			volume: "12.4M",
			sector: "Aerospace",
			marketCap: "121B",
		},
		{
			symbol: "CVX",
			name: "Chevron Corp",
			price: 147.82,
			change: -2.94,
			volume: "18.7M",
			sector: "Energy",
			marketCap: "287B",
		},
		{
			symbol: "WMT",
			name: "Walmart Inc",
			price: 166.53,
			change: -2.45,
			volume: "15.3M",
			sector: "Retail",
			marketCap: "449B",
		},
	];

	// Mock data for most active
	const mostActive = [
		{
			symbol: "AAPL",
			name: "Apple Inc",
			price: 192.53,
			change: 1.23,
			volume: "285.4M",
			marketCap: "3.0T",
		},
		{
			symbol: "TSLA",
			name: "Tesla Inc",
			price: 248.48,
			change: 7.89,
			volume: "128.5M",
			marketCap: "788B",
		},
		{
			symbol: "MSFT",
			name: "Microsoft Corp",
			price: 378.91,
			change: 0.87,
			volume: "98.7M",
			marketCap: "2.82T",
		},
		{
			symbol: "NVDA",
			name: "NVIDIA Corp",
			price: 495.22,
			change: 8.34,
			volume: "52.3M",
			marketCap: "1.22T",
		},
		{
			symbol: "AMZN",
			name: "Amazon.com",
			price: 178.25,
			change: 5.91,
			volume: "45.8M",
			marketCap: "1.84T",
		},
	];

	// Mock upcoming earnings
	const upcomingEarnings = [
		{
			symbol: "AAPL",
			company: "Apple Inc.",
			date: "Oct 11",
			time: "AMC",
			estimate: "$1.39",
		},
		{
			symbol: "MSFT",
			company: "Microsoft Corp",
			date: "Oct 12",
			time: "AMC",
			estimate: "$2.65",
		},
		{
			symbol: "GOOGL",
			company: "Alphabet Inc",
			date: "Oct 12",
			time: "AMC",
			estimate: "$1.45",
		},
		{
			symbol: "TSLA",
			name: "Tesla Inc",
			date: "Oct 13",
			time: "AMC",
			estimate: "$0.73",
		},
	];

	const { formatCurrency } = useCurrency();

	// Sector Performance Chart
	const sectorChartOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			axisPointer: { type: "shadow" },
		},
		grid: { left: 140, right: 20, top: 20, bottom: 40 },
		xAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${value > 0 ? "+" : ""}${value}%`,
			},
		},
		yAxis: {
			type: "category",
			data: sectors.map((s) => s.name),
			axisLabel: { fontSize: 11 },
		},
		series: [
			{
				type: "bar",
				data: sectors.map((s) => ({
					value: s.change,
					itemStyle: {
						color: s.change >= 0 ? "#10b981" : "#ef4444",
					},
				})),
				barWidth: "60%",
			},
		],
	};

	// Mini Sector Heatmap
	const sectorHeatmapOption = {
		tooltip: {
			trigger: "item",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				return `${params.name}<br/>Change: ${params.value.toFixed(2)}%<br/>Volume: $${params.data.volume}B`;
			},
		},
		series: [
			{
				type: "treemap",
				width: "100%",
				height: "100%",
				roam: false,
				breadcrumb: { show: false },
				itemStyle: {
					borderColor: "#fff",
					borderWidth: 2,
					gapWidth: 2,
				},
				label: {
					show: true,
					formatter: (params: any) => {
						const sign = params.value >= 0 ? "+" : "";
						return `{name|${params.name}}\n{value|${sign}${params.value.toFixed(2)}%}`;
					},
					rich: {
						name: { fontSize: 13, fontWeight: "bold", lineHeight: 18 },
						value: { fontSize: 11, lineHeight: 16 },
					},
				},
				data: sectors.map((s) => ({
					name: s.name,
					value: Math.abs(s.change),
					volume: s.volume,
					itemStyle: {
						color:
							s.change >= 0
								? `rgba(16, 185, 129, ${0.4 + Math.abs(s.change) * 0.1})`
								: `rgba(239, 68, 68, ${0.4 + Math.abs(s.change) * 0.1})`,
					},
				})),
			},
		],
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Stock Market Overview</h1>
					<p className="text-muted-foreground mt-1">
						Real-time stock market data and insights
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="gap-1">
						<Activity className="h-3 w-3" />
						Live Data
					</Badge>
					<Badge variant="secondary">{new Date().toLocaleTimeString()}</Badge>
				</div>
			</div>

			{/* Major Indices */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Globe className="h-5 w-5" />
						Global Market Indices
					</CardTitle>
					<CardDescription>
						Major stock market performance worldwide
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
						{indices.map((index) => (
							<Card
								key={index.symbol}
								className="cursor-pointer hover:shadow-md transition-shadow"
							>
								<CardContent className="pt-6">
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												{index.symbol}
											</span>
											{index.change >= 0 ? (
												<TrendArrowUp />
											) : (
												<TrendArrowDown />
											)}
										</div>
										<div className="font-mono text-lg">
											{index.value.toLocaleString()}
										</div>
										<div
											className={`text-xs font-mono ${index.change >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{index.change >= 0 ? "+" : ""}
											{index.change.toFixed(2)} ({index.change >= 0 ? "+" : ""}
											{index.changePercent.toFixed(2)}%)
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card
					className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
					onClick={() => onNavigateToStockScreener("value")}
				>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Value Stocks</p>
								<p className="text-2xl font-mono mt-1">324</p>
							</div>
							<div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
								<DollarSign className="h-6 w-6 text-blue-600" />
							</div>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="w-full mt-4 justify-between"
						>
							Screen Now <ArrowRight className="h-4 w-4" />
						</Button>
					</CardContent>
				</Card>

				<Card
					className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
					onClick={() => onNavigateToStockScreener("growth")}
				>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Growth Stocks</p>
								<p className="text-2xl font-mono mt-1">218</p>
							</div>
							<div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
								<TrendingUp className="h-6 w-6 text-green-600" />
							</div>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="w-full mt-4 justify-between"
						>
							Screen Now <ArrowRight className="h-4 w-4" />
						</Button>
					</CardContent>
				</Card>

				<Card
					className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
					onClick={() => onNavigateToStockScreener("dividend")}
				>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Dividend Stocks</p>
								<p className="text-2xl font-mono mt-1">156</p>
							</div>
							<div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
								<Percent className="h-6 w-6 text-purple-600" />
							</div>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="w-full mt-4 justify-between"
						>
							Screen Now <ArrowRight className="h-4 w-4" />
						</Button>
					</CardContent>
				</Card>

				<Card
					className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
					onClick={() => onNavigateToHeatmap("sectors")}
				>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">View Heatmap</p>
								<p className="text-2xl font-mono mt-1">Live</p>
							</div>
							<div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
								<BarChart3 className="h-6 w-6 text-orange-600" />
							</div>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="w-full mt-4 justify-between"
						>
							View Map <ArrowRight className="h-4 w-4" />
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* Sector Performance & Heatmap */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							Sector Performance
						</CardTitle>
						<CardDescription>Today's sector changes</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={sectorChartOption}
							style={{ height: "350px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<Activity className="h-5 w-5" />
									Sector Heatmap
								</CardTitle>
								<CardDescription>Visual sector performance</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => onNavigateToHeatmap("sectors")}
							>
								Full View
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={sectorHeatmapOption}
							style={{ height: "350px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>
			</div>

			{/* Market Movers */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Flame className="h-5 w-5" />
						Market Movers
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="gainers">Top Gainers</TabsTrigger>
							<TabsTrigger value="losers">Top Losers</TabsTrigger>
							<TabsTrigger value="active">Most Active</TabsTrigger>
						</TabsList>

						<TabsContent value="gainers" className="space-y-4 mt-4">
							<div className="space-y-2">
								{topGainers.map((stock) => (
									<div
										key={stock.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSelectStock?.(stock.symbol)}
									>
										<div className="flex items-center gap-3 flex-1">
											<div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
												<TrendingUp className="h-5 w-5 text-green-600" />
											</div>
											<div>
												<div className="flex items-center gap-2">
													<span className="font-mono">{stock.symbol}</span>
													<Badge variant="secondary" className="text-xs">
														{stock.sector}
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													{stock.name}
												</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono">
												{formatCurrency(stock.price)}
											</div>
											<div className="text-sm text-green-600 font-mono">
												+{stock.change.toFixed(2)}%
											</div>
										</div>
										<div className="text-right ml-4">
											<p className="text-xs text-muted-foreground">Volume</p>
											<p className="text-sm font-mono">{stock.volume}</p>
										</div>
										<Button variant="ghost" size="icon" className="ml-2">
											<Eye className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
							<Button
								variant="outline"
								className="w-full"
								onClick={() => onNavigateToStockScreener("gainers")}
							>
								View All Gainers <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</TabsContent>

						<TabsContent value="losers" className="space-y-4 mt-4">
							<div className="space-y-2">
								{topLosers.map((stock) => (
									<div
										key={stock.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSelectStock?.(stock.symbol)}
									>
										<div className="flex items-center gap-3 flex-1">
											<div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
												<TrendingDown className="h-5 w-5 text-red-600" />
											</div>
											<div>
												<div className="flex items-center gap-2">
													<span className="font-mono">{stock.symbol}</span>
													<Badge variant="secondary" className="text-xs">
														{stock.sector}
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													{stock.name}
												</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono">
												{formatCurrency(stock.price)}
											</div>
											<div className="text-sm text-red-600 font-mono">
												{stock.change.toFixed(2)}%
											</div>
										</div>
										<div className="text-right ml-4">
											<p className="text-xs text-muted-foreground">Volume</p>
											<p className="text-sm font-mono">{stock.volume}</p>
										</div>
										<Button variant="ghost" size="icon" className="ml-2">
											<Eye className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
							<Button
								variant="outline"
								className="w-full"
								onClick={() => onNavigateToStockScreener("losers")}
							>
								View All Losers <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</TabsContent>

						<TabsContent value="active" className="space-y-4 mt-4">
							<div className="space-y-2">
								{mostActive.map((stock) => (
									<div
										key={stock.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSelectStock?.(stock.symbol)}
									>
										<div className="flex items-center gap-3 flex-1">
											<div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
												<Activity className="h-5 w-5 text-blue-600" />
											</div>
											<div>
												<span className="font-mono">{stock.symbol}</span>
												<p className="text-xs text-muted-foreground">
													{stock.name}
												</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono">
												{formatCurrency(stock.price)}
											</div>
											<div
												className={`text-sm font-mono ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												{stock.change >= 0 ? "+" : ""}
												{stock.change.toFixed(2)}%
											</div>
										</div>
										<div className="text-right ml-4">
											<p className="text-xs text-muted-foreground">Volume</p>
											<p className="text-sm font-mono">{stock.volume}</p>
										</div>
										<Button variant="ghost" size="icon" className="ml-2">
											<Eye className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
							<Button
								variant="outline"
								className="w-full"
								onClick={() => onNavigateToStockScreener("active")}
							>
								View All Active <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Upcoming Earnings & Calendar */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-5 w-5" />
								Upcoming Earnings
							</CardTitle>
							<CardDescription>Companies reporting this week</CardDescription>
						</div>
						{onNavigateToCalendar && (
							<Button
								variant="outline"
								size="sm"
								onClick={onNavigateToCalendar}
							>
								View Calendar <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{upcomingEarnings.map((earning) => (
							<div
								key={earning.symbol}
								className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
										<span className="font-mono">
											{earning.symbol.slice(0, 2)}
										</span>
									</div>
									<div>
										<span className="font-mono">{earning.symbol}</span>
										<p className="text-xs text-muted-foreground">
											{earning.company}
										</p>
									</div>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">Date</p>
									<p className="text-sm font-mono">{earning.date}</p>
								</div>
								<div className="text-center">
									<p className="text-xs text-muted-foreground">Time</p>
									<Badge variant="outline">{earning.time}</Badge>
								</div>
								<div className="text-right">
									<p className="text-xs text-muted-foreground">EPS Est.</p>
									<p className="text-sm font-mono">{earning.estimate}</p>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
