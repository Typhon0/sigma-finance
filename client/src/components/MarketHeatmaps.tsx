import ReactECharts from "echarts-for-react";
import {
	Activity,
	BarChart3,
	Bitcoin,
	DollarSign,
	Filter,
	TrendingUp,
	Zap,
} from "lucide-react";
import { useState } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface MarketHeatmapsProps {
	onFilterStock?: (filters: any) => void;
	onFilterCrypto?: (filters: any) => void;
}

export function MarketHeatmaps({
	onFilterStock,
	onFilterCrypto,
}: MarketHeatmapsProps) {
	const [timeframe, setTimeframe] = useState("1D");
	const [groupBy, setGroupBy] = useState("sector");
	const [cryptoGroupBy, setCryptoGroupBy] = useState("category");
	const [cryptoMetric, setCryptoMetric] = useState("change");

	// Mock stock data by sector
	const stocksBySector = [
		{
			name: "Apple",
			sector: "Technology",
			marketCap: 3000,
			change: 2.35,
			industry: "Consumer Electronics",
		},
		{
			name: "Microsoft",
			sector: "Technology",
			marketCap: 2820,
			change: 0.87,
			industry: "Software",
		},
		{
			name: "NVIDIA",
			sector: "Technology",
			marketCap: 1220,
			change: 8.37,
			industry: "Semiconductors",
		},
		{
			name: "Alphabet",
			sector: "Communication",
			marketCap: 1760,
			change: 1.31,
			industry: "Internet Services",
		},
		{
			name: "Meta",
			sector: "Communication",
			marketCap: 986,
			change: 5.23,
			industry: "Internet Content",
		},
		{
			name: "Amazon",
			sector: "Consumer Cyclical",
			marketCap: 1840,
			change: 5.93,
			industry: "Internet Retail",
		},
		{
			name: "Tesla",
			sector: "Consumer Cyclical",
			marketCap: 788,
			change: 7.87,
			industry: "Auto Manufacturers",
		},
		{
			name: "Visa",
			sector: "Financial Services",
			marketCap: 545,
			change: 0.84,
			industry: "Credit Services",
		},
		{
			name: "JPMorgan",
			sector: "Financial Services",
			marketCap: 481,
			change: -0.43,
			industry: "Banks",
		},
		{
			name: "Johnson & Johnson",
			sector: "Healthcare",
			marketCap: 380,
			change: 0.29,
			industry: "Drug Manufacturers",
		},
		{
			name: "Walmart",
			sector: "Consumer Defensive",
			marketCap: 449,
			change: -2.42,
			industry: "Discount Stores",
		},
		{
			name: "P&G",
			sector: "Consumer Defensive",
			marketCap: 365,
			change: 0.58,
			industry: "Household Products",
		},
		{
			name: "Exxon",
			sector: "Energy",
			marketCap: 412,
			change: 1.82,
			industry: "Oil & Gas",
		},
		{
			name: "Chevron",
			sector: "Energy",
			marketCap: 287,
			change: -2.94,
			industry: "Oil & Gas",
		},
		{
			name: "Boeing",
			sector: "Industrials",
			marketCap: 121,
			change: -3.21,
			industry: "Aerospace",
		},
		{
			name: "Caterpillar",
			sector: "Industrials",
			marketCap: 158,
			change: 1.15,
			industry: "Farm Equipment",
		},
	];

	// Mock crypto data
	const cryptoData = [
		{
			name: "Bitcoin",
			symbol: "BTC",
			category: "Layer 1",
			marketCap: 846,
			change: 2.5,
			fundingRate: 0.0085,
			volume: 28.5,
		},
		{
			name: "Ethereum",
			symbol: "ETH",
			category: "Layer 1",
			marketCap: 274,
			change: 1.8,
			fundingRate: 0.0072,
			volume: 15.2,
		},
		{
			name: "Solana",
			symbol: "SOL",
			category: "Layer 1",
			marketCap: 41,
			change: -3.2,
			fundingRate: -0.0125,
			volume: 2.8,
		},
		{
			name: "Cardano",
			symbol: "ADA",
			category: "Layer 1",
			marketCap: 20.5,
			change: 4.2,
			fundingRate: 0.0045,
			volume: 0.45,
		},
		{
			name: "Avalanche",
			symbol: "AVAX",
			category: "Layer 1",
			marketCap: 14.2,
			change: 6.1,
			fundingRate: 0.0095,
			volume: 0.78,
		},
		{
			name: "Polygon",
			symbol: "MATIC",
			category: "Layer 2",
			marketCap: 8.3,
			change: 1.2,
			fundingRate: 0.0038,
			volume: 0.32,
		},
		{
			name: "Optimism",
			symbol: "OP",
			category: "Layer 2",
			marketCap: 5.8,
			change: 3.5,
			fundingRate: 0.0052,
			volume: 0.18,
		},
		{
			name: "Polkadot",
			symbol: "DOT",
			category: "Layer 0",
			marketCap: 10.2,
			change: -1.5,
			fundingRate: 0.0052,
			volume: 0.24,
		},
		{
			name: "Cosmos",
			symbol: "ATOM",
			category: "Layer 0",
			marketCap: 4.0,
			change: -2.8,
			fundingRate: 0.0055,
			volume: 0.42,
		},
		{
			name: "Chainlink",
			symbol: "LINK",
			category: "Oracle",
			marketCap: 8.8,
			change: 3.8,
			fundingRate: 0.0068,
			volume: 0.58,
		},
		{
			name: "Uniswap",
			symbol: "UNI",
			category: "DeFi",
			marketCap: 5.1,
			change: 2.1,
			fundingRate: 0.0042,
			volume: 0.18,
		},
		{
			name: "Aave",
			symbol: "AAVE",
			category: "DeFi",
			marketCap: 2.8,
			change: 4.5,
			fundingRate: 0.0058,
			volume: 0.12,
		},
	];

	// Prepare stock treemap data
	const stockTreemapData = stocksBySector.map((stock) => ({
		name: stock.name,
		value: stock.marketCap,
		change: stock.change,
		sector: stock.sector,
		industry: stock.industry,
		itemStyle: {
			color:
				stock.change >= 0
					? `rgba(16, 185, 129, ${0.5 + Math.min(Math.abs(stock.change) * 0.1, 0.5)})`
					: `rgba(239, 68, 68, ${0.5 + Math.min(Math.abs(stock.change) * 0.1, 0.5)})`,
			borderColor: "#fff",
			borderWidth: 2,
		},
	}));

	// Group by sector for stocks
	const stockTreemapBySector = Object.entries(
		stocksBySector.reduce(
			(acc, stock) => {
				if (!acc[stock.sector]) {
					acc[stock.sector] = [];
				}
				acc[stock.sector].push(stock);
				return acc;
			},
			{} as Record<string, typeof stocksBySector>,
		),
	).map(([sector, stocks]) => ({
		name: sector,
		children: stocks.map((stock) => ({
			name: stock.name,
			value: stock.marketCap,
			change: stock.change,
			itemStyle: {
				color:
					stock.change >= 0
						? `rgba(16, 185, 129, ${0.5 + Math.min(Math.abs(stock.change) * 0.08, 0.5)})`
						: `rgba(239, 68, 68, ${0.5 + Math.min(Math.abs(stock.change) * 0.08, 0.5)})`,
			},
		})),
	}));

	// Prepare crypto data based on metric
	const getCryptoValue = (crypto: (typeof cryptoData)[0]) => {
		switch (cryptoMetric) {
			case "change":
				return Math.abs(crypto.change);
			case "funding":
				return Math.abs(crypto.fundingRate * 1000);
			case "volume":
				return crypto.volume;
			default:
				return Math.abs(crypto.change);
		}
	};

	const getCryptoColor = (crypto: (typeof cryptoData)[0]) => {
		let value = 0;
		switch (cryptoMetric) {
			case "change":
				value = crypto.change;
				break;
			case "funding":
				value = crypto.fundingRate * 100;
				break;
			case "volume":
				return `rgba(59, 130, 246, ${0.5 + Math.min(crypto.volume / 30, 0.5)})`;
			default:
				value = crypto.change;
		}

		return value >= 0
			? `rgba(16, 185, 129, ${0.5 + Math.min(Math.abs(value) * 0.1, 0.5)})`
			: `rgba(239, 68, 68, ${0.5 + Math.min(Math.abs(value) * 0.1, 0.5)})`;
	};

	const cryptoTreemapByCategory = Object.entries(
		cryptoData.reduce(
			(acc, crypto) => {
				if (!acc[crypto.category]) {
					acc[crypto.category] = [];
				}
				acc[crypto.category].push(crypto);
				return acc;
			},
			{} as Record<string, typeof cryptoData>,
		),
	).map(([category, cryptos]) => ({
		name: category,
		children: cryptos.map((crypto) => ({
			name: crypto.symbol,
			value: getCryptoValue(crypto),
			change: crypto.change,
			fundingRate: crypto.fundingRate,
			volume: crypto.volume,
			itemStyle: {
				color: getCryptoColor(crypto),
			},
		})),
	}));

	// Stock Treemap Options
	const stockTreemapOption = {
		tooltip: {
			trigger: "item",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				if (params.data.change !== undefined) {
					const sign = params.data.change >= 0 ? "+" : "";
					return `${params.name}<br/>Market Cap: $${params.value}B<br/>Change: ${sign}${params.data.change.toFixed(2)}%`;
				}
				return params.name;
			},
		},
		series: [
			{
				type: "treemap",
				width: "100%",
				height: "100%",
				roam: false,
				breadcrumb: { show: false },
				nodeClick: "link",
				itemStyle: {
					borderColor: "#fff",
					borderWidth: 2,
					gapWidth: 2,
				},
				label: {
					show: true,
					formatter: (params: any) => {
						if (params.data.change !== undefined) {
							const sign = params.data.change >= 0 ? "+" : "";
							return `{name|${params.name}}\n{value|${sign}${params.data.change.toFixed(2)}%}`;
						}
						return params.name;
					},
					rich: {
						name: { fontSize: 14, fontWeight: "bold", lineHeight: 20 },
						value: { fontSize: 12, lineHeight: 18 },
					},
				},
				levels: [
					{
						itemStyle: {
							borderColor: "#fff",
							borderWidth: 4,
							gapWidth: 4,
						},
					},
					{
						colorSaturation: [0.35, 0.5],
						itemStyle: {
							borderColor: "#fff",
							borderWidth: 2,
							gapWidth: 2,
						},
					},
				],
				data: groupBy === "sector" ? stockTreemapBySector : stockTreemapData,
			},
		],
	};

	// Crypto Heatmap Options
	const cryptoTreemapOption = {
		tooltip: {
			trigger: "item",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				if (params.data.change !== undefined) {
					const sign = params.data.change >= 0 ? "+" : "";
					let metricText = "";
					if (cryptoMetric === "change") {
						metricText = `Change: ${sign}${params.data.change.toFixed(2)}%`;
					} else if (cryptoMetric === "funding") {
						metricText = `Funding: ${(params.data.fundingRate * 100).toFixed(3)}%`;
					} else if (cryptoMetric === "volume") {
						metricText = `Volume: $${params.data.volume.toFixed(2)}B`;
					}
					return `${params.name}<br/>${metricText}`;
				}
				return params.name;
			},
		},
		series: [
			{
				type: "treemap",
				width: "100%",
				height: "100%",
				roam: false,
				breadcrumb: { show: false },
				nodeClick: "link",
				itemStyle: {
					borderColor: "#fff",
					borderWidth: 2,
					gapWidth: 2,
				},
				label: {
					show: true,
					formatter: (params: any) => {
						if (params.data.change !== undefined) {
							let valueText = "";
							if (cryptoMetric === "change") {
								const sign = params.data.change >= 0 ? "+" : "";
								valueText = `${sign}${params.data.change.toFixed(2)}%`;
							} else if (cryptoMetric === "funding") {
								valueText = `${(params.data.fundingRate * 100).toFixed(3)}%`;
							} else if (cryptoMetric === "volume") {
								valueText = `$${params.data.volume.toFixed(1)}B`;
							}
							return `{name|${params.name}}\n{value|${valueText}}`;
						}
						return params.name;
					},
					rich: {
						name: { fontSize: 14, fontWeight: "bold", lineHeight: 20 },
						value: { fontSize: 12, lineHeight: 18 },
					},
				},
				levels: [
					{
						itemStyle: {
							borderColor: "#fff",
							borderWidth: 4,
							gapWidth: 4,
						},
					},
					{
						colorSaturation: [0.35, 0.5],
						itemStyle: {
							borderColor: "#fff",
							borderWidth: 2,
							gapWidth: 2,
						},
					},
				],
				data: cryptoTreemapByCategory,
			},
		],
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Market Heatmaps</h1>
					<p className="text-muted-foreground mt-1">
						Visual market performance analysis
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="gap-1">
						<Activity className="h-3 w-3" />
						Live Data
					</Badge>
				</div>
			</div>

			{/* Tabs */}
			<Tabs defaultValue="stocks" className="space-y-6">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="stocks">
						<DollarSign className="h-4 w-4 mr-2" />
						Stocks
					</TabsTrigger>
					<TabsTrigger value="crypto">
						<Bitcoin className="h-4 w-4 mr-2" />
						Crypto
					</TabsTrigger>
				</TabsList>

				{/* Stocks Heatmap */}
				<TabsContent value="stocks" className="space-y-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Stock Market Heatmap
									</CardTitle>
									<CardDescription>
										Visualize stock performance by sector and industry
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Select value={timeframe} onValueChange={setTimeframe}>
										<SelectTrigger className="w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="1D">1 Day</SelectItem>
											<SelectItem value="1W">1 Week</SelectItem>
											<SelectItem value="1M">1 Month</SelectItem>
											<SelectItem value="3M">3 Months</SelectItem>
											<SelectItem value="1Y">1 Year</SelectItem>
										</SelectContent>
									</Select>
									<Select value={groupBy} onValueChange={setGroupBy}>
										<SelectTrigger className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="sector">By Sector</SelectItem>
											<SelectItem value="flat">Flat View</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{/* Legend */}
								<div className="flex items-center justify-center gap-6 text-sm">
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 rounded bg-green-500" />
										<span>Positive Change</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 rounded bg-red-500" />
										<span>Negative Change</span>
									</div>
									<div className="text-muted-foreground">
										Size = Market Capitalization
									</div>
								</div>

								{/* Treemap */}
								<ReactECharts
									option={stockTreemapOption}
									style={{ height: "600px" }}
									opts={{ renderer: "svg" }}
								/>

								{/* Action Button */}
								<div className="flex justify-center pt-4">
									<Button onClick={() => onFilterStock?.({})}>
										<Filter className="h-4 w-4 mr-2" />
										Filter in Stock Screener
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Quick Stats */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Top Gainer</p>
										<p className="text-xl font-mono mt-1">NVDA</p>
										<p className="text-sm text-green-600 font-mono">+8.37%</p>
									</div>
									<TrendingUp className="h-8 w-8 text-green-600" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Top Loser</p>
										<p className="text-xl font-mono mt-1">BA</p>
										<p className="text-sm text-red-600 font-mono">-3.21%</p>
									</div>
									<TrendingUp className="h-8 w-8 text-red-600 rotate-180" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Best Sector</p>
										<p className="text-xl mt-1">Technology</p>
										<p className="text-sm text-green-600 font-mono">+3.86%</p>
									</div>
									<BarChart3 className="h-8 w-8 text-green-600" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">
											Worst Sector
										</p>
										<p className="text-xl mt-1">Energy</p>
										<p className="text-sm text-red-600 font-mono">-0.56%</p>
									</div>
									<BarChart3 className="h-8 w-8 text-red-600" />
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Crypto Heatmap */}
				<TabsContent value="crypto" className="space-y-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Bitcoin className="h-5 w-5" />
										Crypto Market Heatmap
									</CardTitle>
									<CardDescription>
										Visualize crypto performance with multiple metrics
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Select value={timeframe} onValueChange={setTimeframe}>
										<SelectTrigger className="w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="1D">1 Day</SelectItem>
											<SelectItem value="1W">1 Week</SelectItem>
											<SelectItem value="1M">1 Month</SelectItem>
											<SelectItem value="3M">3 Months</SelectItem>
										</SelectContent>
									</Select>
									<Select value={cryptoMetric} onValueChange={setCryptoMetric}>
										<SelectTrigger className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="change">Price Change</SelectItem>
											<SelectItem value="funding">Funding Rate</SelectItem>
											<SelectItem value="volume">Volume</SelectItem>
										</SelectContent>
									</Select>
									<Select
										value={cryptoGroupBy}
										onValueChange={setCryptoGroupBy}
									>
										<SelectTrigger className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="category">By Category</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{/* Legend */}
								<div className="flex items-center justify-center gap-6 text-sm">
									{cryptoMetric === "change" && (
										<>
											<div className="flex items-center gap-2">
												<div className="h-4 w-4 rounded bg-green-500" />
												<span>Price Increase</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="h-4 w-4 rounded bg-red-500" />
												<span>Price Decrease</span>
											</div>
										</>
									)}
									{cryptoMetric === "funding" && (
										<>
											<div className="flex items-center gap-2">
												<div className="h-4 w-4 rounded bg-green-500" />
												<span>Positive Funding</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="h-4 w-4 rounded bg-red-500" />
												<span>Negative Funding</span>
											</div>
										</>
									)}
									{cryptoMetric === "volume" && (
										<div className="flex items-center gap-2">
											<div className="h-4 w-4 rounded bg-blue-500" />
											<span>Higher Volume = Darker Color</span>
										</div>
									)}
								</div>

								{/* Treemap */}
								<ReactECharts
									option={cryptoTreemapOption}
									style={{ height: "600px" }}
									opts={{ renderer: "svg" }}
								/>

								{/* Action Button */}
								<div className="flex justify-center pt-4">
									<Button onClick={() => onFilterCrypto?.({})}>
										<Filter className="h-4 w-4 mr-2" />
										Filter in Crypto Screener
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Quick Stats */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Top Gainer</p>
										<p className="text-xl font-mono mt-1">AVAX</p>
										<p className="text-sm text-green-600 font-mono">+6.1%</p>
									</div>
									<TrendingUp className="h-8 w-8 text-green-600" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Top Loser</p>
										<p className="text-xl font-mono mt-1">SOL</p>
										<p className="text-sm text-red-600 font-mono">-3.2%</p>
									</div>
									<TrendingUp className="h-8 w-8 text-red-600 rotate-180" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">
											Highest Funding
										</p>
										<p className="text-xl font-mono mt-1">AVAX</p>
										<p className="text-sm text-green-600 font-mono">+0.0095%</p>
									</div>
									<Zap className="h-8 w-8 text-green-600" />
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">
											Negative Funding
										</p>
										<p className="text-xl font-mono mt-1">SOL</p>
										<p className="text-sm text-red-600 font-mono">-0.0125%</p>
									</div>
									<Zap className="h-8 w-8 text-red-600" />
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
