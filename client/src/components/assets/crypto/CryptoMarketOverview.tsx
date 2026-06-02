import ReactECharts from "echarts-for-react";
import {
	Activity,
	ArrowRight,
	ArrowUpDown,
	BarChart3,
	ChevronRight,
	Droplets,
	Eye,
	Flame,
	Layers,
	Lock,
	Network,
	TrendingDown,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";

interface CryptoMarketOverviewProps {
	onNavigateToCryptoScreener: (preset?: string) => void;
	onNavigateToHeatmap: (type?: string) => void;
	onSelectCrypto?: (symbol: string) => void;
}

export function CryptoMarketOverview({
	onNavigateToCryptoScreener,
	onNavigateToHeatmap,
	onSelectCrypto,
}: CryptoMarketOverviewProps) {
	const [activeTab, setActiveTab] = useState("gainers");

	// Currency hook — must be called before any chart options that use currencySymbol
	const { formatCurrency, currencySymbol } = useCurrency();

	// Detect dark mode for gauge colors
	const isDarkMode = document.documentElement.classList.contains("dark");

	// Mock global crypto market data
	const globalMarket = {
		totalMarketCap: 2450000000000,
		totalMarketCapChange24h: 2.35,
		totalVolume24h: 125000000000,
		totalVolumeChange24h: 8.2,
		btcDominance: 54.2,
		ethDominance: 16.8,
		defiMarketCap: 85000000000,
		stablecoinMarketCap: 142500000000,
		activeCryptos: 12845,
	};

	// Fear & Greed Index
	const fearGreedIndex = {
		value: 68,
		label: "Greed",
		lastUpdate: "2h ago",
	};

	// Fear & Greed Gauge Chart (CoinMarketCap style)
	const fearGreedGaugeOption = {
		series: [
			{
				type: "gauge",
				startAngle: 180,
				endAngle: 0,
				min: 0,
				max: 100,
				radius: "100%",
				center: ["50%", "80%"],
				axisLine: {
					lineStyle: {
						width: 24,
						color: [
							[0.25, "#EA3943"],
							[0.5, "#F6A623"],
							[0.75, "#F3D42F"],
							[0.9, "#93D900"],
							[1, "#16C784"],
						],
					},
				},
				pointer: {
					show: true,
					length: "60%",
					width: 6,
					itemStyle: {
						color: isDarkMode ? "#e5e7eb" : "#333",
						shadowColor: "rgba(0, 0, 0, 0.4)",
						shadowBlur: 10,
						shadowOffsetY: 2,
					},
				},
				axisTick: {
					show: false,
				},
				splitLine: {
					show: false,
				},
				axisLabel: {
					show: false,
				},
				anchor: {
					show: false,
				},
				detail: {
					valueAnimation: true,
					formatter: "{value}",
					color: isDarkMode ? "#e5e7eb" : "#333",
					fontSize: 28,
					fontWeight: "bold",
					offsetCenter: [0, "-20%"],
				},
				data: [
					{
						value: fearGreedIndex.value,
						name: fearGreedIndex.label,
						title: {
							offsetCenter: [0, "20%"],
							fontSize: 14,
							fontWeight: 600,
							color: "#888",
						},
					},
				],
			},
		],
	};

	// Sector performance
	const sectorPerformance = [
		{
			name: "Layer 1",
			marketCap: 1024000000000,
			change24h: 2.15,
			change7d: 8.5,
			count: 48,
			icon: Layers,
		},
		{
			name: "Layer 2",
			marketCap: 92000000000,
			change24h: 1.85,
			change7d: 12.3,
			count: 32,
			icon: Network,
		},
		{
			name: "DeFi",
			marketCap: 85000000000,
			change24h: 3.42,
			change7d: 6.8,
			count: 124,
			icon: Droplets,
		},
		{
			name: "NFT & Gaming",
			marketCap: 83000000000,
			change24h: -1.5,
			change7d: -3.2,
			count: 228,
			icon: Activity,
		},
		{
			name: "Stablecoins",
			marketCap: 142500000000,
			change24h: 0.1,
			change7d: 0.3,
			count: 45,
			icon: Lock,
		},
		{
			name: "Meme",
			marketCap: 48000000000,
			change24h: 5.8,
			change7d: 22.5,
			count: 342,
			icon: Flame,
		},
	];

	// Top cryptocurrencies
	const topCryptos = [
		{
			symbol: "BTC",
			name: "Bitcoin",
			icon: "₿",
			price: 67234.52,
			change24h: 2.5,
			change7d: 8.2,
			marketCap: 1320000000000,
			volume24h: 28500000000,
			dominance: 54.2,
		},
		{
			symbol: "ETH",
			name: "Ethereum",
			icon: "Ξ",
			price: 3234.18,
			change24h: 1.8,
			change7d: 6.5,
			marketCap: 388000000000,
			volume24h: 15200000000,
			dominance: 15.9,
		},
		{
			symbol: "BNB",
			name: "BNB",
			icon: "Ⓑ",
			price: 312.45,
			change24h: -1.2,
			change7d: 2.3,
			marketCap: 48000000000,
			volume24h: 1800000000,
			dominance: 2.0,
		},
		{
			symbol: "SOL",
			name: "Solana",
			icon: "◎",
			price: 142.67,
			change24h: 5.4,
			change7d: 18.2,
			marketCap: 62000000000,
			volume24h: 2800000000,
			dominance: 2.5,
		},
	];

	// Top gainers
	const topGainers = [
		{
			symbol: "AVAX",
			name: "Avalanche",
			price: 38.5,
			change: 12.5,
			volume: 780000000,
			marketCap: 14200000000,
			category: "Layer 1",
		},
		{
			symbol: "MATIC",
			name: "Polygon",
			price: 0.89,
			change: 8.3,
			volume: 320000000,
			marketCap: 8300000000,
			category: "Layer 2",
		},
		{
			symbol: "LINK",
			name: "Chainlink",
			price: 15.42,
			change: 7.8,
			volume: 580000000,
			marketCap: 8800000000,
			category: "Oracle",
		},
		{
			symbol: "UNI",
			name: "Uniswap",
			price: 6.82,
			change: 6.1,
			volume: 180000000,
			marketCap: 5100000000,
			category: "DeFi",
		},
		{
			symbol: "AAVE",
			name: "Aave",
			price: 98.45,
			change: 5.9,
			volume: 125000000,
			marketCap: 1400000000,
			category: "DeFi",
		},
	];

	// Top losers
	const topLosers = [
		{
			symbol: "ATOM",
			name: "Cosmos",
			price: 10.25,
			change: -4.8,
			volume: 420000000,
			marketCap: 4000000000,
			category: "Layer 0",
		},
		{
			symbol: "SAND",
			name: "The Sandbox",
			price: 0.52,
			change: -4.2,
			volume: 85000000,
			marketCap: 950000000,
			category: "Metaverse",
		},
		{
			symbol: "MANA",
			name: "Decentraland",
			price: 0.48,
			change: -3.9,
			volume: 65000000,
			marketCap: 890000000,
			category: "Metaverse",
		},
		{
			symbol: "AXS",
			name: "Axie Infinity",
			price: 8.92,
			change: -3.5,
			volume: 142000000,
			marketCap: 1200000000,
			category: "Gaming",
		},
		{
			symbol: "FTM",
			name: "Fantom",
			price: 0.45,
			change: -3.2,
			volume: 95000000,
			marketCap: 1260000000,
			category: "Layer 1",
		},
	];

	// Most active by volume
	const mostActive = [
		{
			symbol: "BTC",
			name: "Bitcoin",
			price: 67234.52,
			change: 2.5,
			volume: 28500000000,
			marketCap: 1320000000000,
		},
		{
			symbol: "ETH",
			name: "Ethereum",
			price: 3234.18,
			change: 1.8,
			volume: 15200000000,
			marketCap: 388000000000,
		},
		{
			symbol: "SOL",
			name: "Solana",
			price: 142.67,
			change: 5.4,
			volume: 2800000000,
			marketCap: 62000000000,
		},
		{
			symbol: "AVAX",
			name: "Avalanche",
			price: 38.5,
			change: 12.5,
			volume: 780000000,
			marketCap: 14200000000,
		},
		{
			symbol: "DOGE",
			name: "Dogecoin",
			price: 0.082,
			change: 1.5,
			volume: 650000000,
			marketCap: 11800000000,
		},
	];

	// Derivatives overview
	const derivativesOverview = {
		totalOpenInterest: 45200000000,
		oiChange24h: 3.2,
		avgFundingRate: 0.0085,
		totalLiquidations24h: 285000000,
		longLiquidations: 158000000,
		shortLiquidations: 127000000,
		longShortRatio: 1.28,
	};

	// Top derivatives
	const topDerivatives = [
		{
			symbol: "BTC",
			funding: 0.0085,
			openInterest: 15200000000,
			oiChange: 3.2,
			liquidations: 125000000,
			longShortRatio: 1.25,
		},
		{
			symbol: "ETH",
			funding: 0.0072,
			openInterest: 8500000000,
			oiChange: 2.1,
			liquidations: 85000000,
			longShortRatio: 1.18,
		},
		{
			symbol: "SOL",
			funding: -0.0125,
			openInterest: 1200000000,
			oiChange: 8.5,
			liquidations: 42000000,
			longShortRatio: 0.85,
		},
		{
			symbol: "AVAX",
			funding: 0.0095,
			openInterest: 580000000,
			oiChange: 12.5,
			liquidations: 15000000,
			longShortRatio: 1.45,
		},
	];

	// On-chain aggregated metrics
	const onChainMetrics = {
		totalActiveAddresses: 12450000,
		activeAddressesChange: 5.3,
		totalTransactions24h: 8500000,
		transactionsChange: 3.2,
		avgGasPrice: 25.5, // Gwei for Ethereum
		gasChange: -12.5,
		avgBlockTime: 12.5, // seconds
		networkUtilization: 68,
	};

	// Network statistics
	const networkStats = [
		{
			network: "Bitcoin",
			hashRate: 450,
			hashRateUnit: "EH/s",
			hashRateChange: 2.1,
			activeNodes: 16850,
		},
		{
			network: "Ethereum",
			validators: 985000,
			validatorsChange: 3.5,
			stakingRatio: 24.5,
		},
		{ network: "Solana", tps: 3250, tpsChange: 8.2, activeValidators: 1950 },
	];

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const [hoveredMarketData, _setHoveredMarketData] = React.useState<any>(null);

	const marketCapData = [
		{ value: 1320, name: "Bitcoin", itemStyle: { color: "#F7931A" } },
		{ value: 388, name: "Ethereum", itemStyle: { color: "#627EEA" } },
		{ value: 85, name: "DeFi", itemStyle: { color: "#26a69a" } },
		{ value: 143, name: "Stablecoins", itemStyle: { color: "#22C55E" } },
		{ value: 92, name: "Layer 2", itemStyle: { color: "#8B5CF6" } },
		{ value: 422, name: "Others", itemStyle: { color: "#94A3B8" } },
	];

	const totalMarketCap = marketCapData.reduce((sum, item) => sum + item.value, 0);

	// Market cap distribution chart
	const marketCapDistribution = {
		tooltip: {
			show: false,
		},
		legend: {
			show: false,
		},
		graphic: {
			type: "group",
			left: "center",
			top: "center",
			children: [
				{
					type: "text",
					z: 100,
					left: "center",
					top: "middle",
					style: {
						text: hoveredMarketData ? hoveredMarketData.name : `${totalMarketCap}B`,
						textAlign: "center",
						fill: document.documentElement.classList.contains("dark") ? "#fafafa" : "#0a0a0a",
						fontSize: hoveredMarketData ? 18 : 28,
						fontWeight: "600",
						lineHeight: 1.2,
					},
				},
				{
					type: "text",
					z: 100,
					left: "center",
					top: "middle",
					style: {
						text: hoveredMarketData ? `${hoveredMarketData.value}B` : "Total",
						textAlign: "center",
						fill: document.documentElement.classList.contains("dark") ? "#a3a3a3" : "#737373",
						fontSize: hoveredMarketData ? 16 : 13,
						fontWeight: hoveredMarketData ? "500" : "400",
						y: hoveredMarketData ? 26 : 38,
					},
				},
				{
					type: "text",
					z: 100,
					left: "center",
					top: "middle",
					style: {
						text: hoveredMarketData ? `${hoveredMarketData.percent.toFixed(1)}%` : "",
						textAlign: "center",
						fill: document.documentElement.classList.contains("dark") ? "#737373" : "#a3a3a3",
						fontSize: 13,
						fontWeight: "400",
						y: 48,
					},
				},
			],
		},
		series: [
			{
				type: "pie",
				radius: ["60%", "85%"],
				avoidLabelOverlap: false,
				itemStyle: {
					borderRadius: 4,
					borderColor: document.documentElement.classList.contains("dark") ? "#0a0a0a" : "#fafafa",
					borderWidth: 3,
				},
				label: {
					show: false,
				},
				emphasis: {
					scale: false,
					itemStyle: {
						shadowBlur: 0,
					},
				},
				data: marketCapData,
			},
		],
	};

	// Volume trend chart (24h, 7 intervals)
	const volumeTrendData = {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "shadow" },
		},
		grid: { left: 60, right: 30, top: 30, bottom: 30 },
		xAxis: {
			type: "category",
			data: ["4h ago", "8h ago", "12h ago", "16h ago", "20h ago", "24h ago", "Now"],
		},
		yAxis: {
			type: "value",
			axisLabel: {
				formatter: (value: number) => `${currencySymbol}${(value / 1e9).toFixed(0)}B`,
			},
		},
		series: [
			{
				name: "Volume",
				type: "bar",
				data: [
					118000000000, 122000000000, 115000000000, 128000000000, 120000000000, 125000000000,
					125000000000,
				],
				itemStyle: {
					color: "#26a69a",
					borderRadius: [4, 4, 0, 0],
				},
			},
		],
	};

	const formatLargeNumber = (num: number) => {
		if (num >= 1e12) return `${currencySymbol}${(num / 1e12).toFixed(2)}T`;
		if (num >= 1e9) return `${currencySymbol}${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `${currencySymbol}${(num / 1e6).toFixed(2)}M`;
		return formatCurrency(num);
	};

	const formatCompact = (num: number) => {
		if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
		if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
		return num.toFixed(0);
	};

	return (
		<div className="space-y-6">
			{/* Global Market Stats */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="overflow-hidden">
					<CardHeader className="pb-2 pt-4">
						<CardDescription className="text-xs truncate">Total Market Cap</CardDescription>
						<CardTitle className="text-xl font-mono truncate">
							{formatLargeNumber(globalMarket.totalMarketCap)}
						</CardTitle>
					</CardHeader>
					<CardContent className="pb-4">
						<div
							className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${globalMarket.totalMarketCapChange24h >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{globalMarket.totalMarketCapChange24h >= 0 ? (
								<TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
							) : (
								<TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
							)}
							<span className="font-mono truncate">
								{globalMarket.totalMarketCapChange24h >= 0 ? "+" : ""}
								{globalMarket.totalMarketCapChange24h.toFixed(2)}% 24h
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2 pt-4">
						<CardDescription className="text-xs">24h Volume</CardDescription>
						<CardTitle className="text-xl font-mono">
							{formatLargeNumber(globalMarket.totalVolume24h)}
						</CardTitle>
					</CardHeader>
					<CardContent className="pb-4">
						<div
							className={`flex items-center gap-1.5 text-xs ${globalMarket.totalVolumeChange24h >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{globalMarket.totalVolumeChange24h >= 0 ? (
								<TrendingUp className="h-3.5 w-3.5" />
							) : (
								<TrendingDown className="h-3.5 w-3.5" />
							)}
							<span className="font-mono">
								{globalMarket.totalVolumeChange24h >= 0 ? "+" : ""}
								{globalMarket.totalVolumeChange24h.toFixed(2)}%
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2 pt-4">
						<CardDescription className="text-xs">BTC Dominance</CardDescription>
						<CardTitle className="text-xl font-mono">
							{globalMarket.btcDominance.toFixed(2)}%
						</CardTitle>
					</CardHeader>
					<CardContent className="pb-4">
						<div className="space-y-1.5">
							<Progress value={globalMarket.btcDominance} className="h-1.5" />
							<p className="text-xs text-muted-foreground">
								ETH: {globalMarket.ethDominance.toFixed(2)}%
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-1 pt-3">
						<CardDescription className="text-xs">Fear & Greed Index</CardDescription>
					</CardHeader>
					<CardContent className="pb-2 pt-0">
						<ReactECharts
							option={fearGreedGaugeOption}
							style={{ height: "110px" }}
							opts={{ renderer: "svg" }}
						/>
						<div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 -mt-3">
							<span>Fear</span>
							<span>Neutral</span>
							<span>Greed</span>
						</div>
						<p className="text-[10px] text-muted-foreground text-center mt-1">
							{fearGreedIndex.lastUpdate}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Market Cap Distribution & Volume Trend */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Market Cap Distribution</CardTitle>
						<CardDescription>Total crypto market capitalization breakdown</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={marketCapDistribution}
							style={{ height: "300px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>24h Volume Trend</CardTitle>
						<CardDescription>Trading volume evolution over 24 hours</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={volumeTrendData}
							style={{ height: "300px" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>
			</div>

			{/* Sector Performance */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Sector Performance</CardTitle>
							<CardDescription>Performance by cryptocurrency category</CardDescription>
						</div>
						<Button variant="outline" onClick={() => onNavigateToHeatmap?.("sectors")}>
							<BarChart3 className="h-4 w-4 mr-2" />
							View Heatmap
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{sectorPerformance.map((sector) => (
							// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
							// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
							<div
								key={sector.name}
								className="p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
								onClick={() =>
									onNavigateToCryptoScreener?.(sector.name.toLowerCase().replace(" ", "-"))
								}
							>
								<div className="flex items-start justify-between mb-3">
									<div className="flex items-center gap-2">
										<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
											<sector.icon className="h-4 w-4 text-primary" />
										</div>
										<div>
											<h4 className="font-medium">{sector.name}</h4>
											<p className="text-xs text-muted-foreground">{sector.count} assets</p>
										</div>
									</div>
								</div>
								<div className="space-y-2">
									<div className="flex items-baseline justify-between">
										<span className="text-xs text-muted-foreground">Market Cap</span>
										<span className="font-mono text-sm">{formatLargeNumber(sector.marketCap)}</span>
									</div>
									<div className="flex items-baseline justify-between">
										<span className="text-xs text-muted-foreground">24h</span>
										<span
											className={`font-mono text-sm ${sector.change24h >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{sector.change24h >= 0 ? "+" : ""}
											{sector.change24h.toFixed(2)}%
										</span>
									</div>
									<div className="flex items-baseline justify-between">
										<span className="text-xs text-muted-foreground">7d</span>
										<span
											className={`font-mono text-sm ${sector.change7d >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{sector.change7d >= 0 ? "+" : ""}
											{sector.change7d.toFixed(2)}%
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Top Cryptocurrencies */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Top Cryptocurrencies</CardTitle>
						<Button variant="outline" onClick={() => onNavigateToCryptoScreener?.("top-100")}>
							View All <ChevronRight className="h-4 w-4 ml-2" />
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{topCryptos.map((crypto) => (
							// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
							// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
							<div
								key={crypto.symbol}
								className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
								onClick={() => onSelectCrypto?.(crypto.symbol)}
							>
								<div className="flex items-center gap-4 flex-1">
									<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
										<span className="text-xl">{crypto.icon}</span>
									</div>
									<div>
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium">{crypto.symbol}</span>
											<span className="text-sm text-muted-foreground">{crypto.name}</span>
										</div>
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											<span>Rank #{topCryptos.indexOf(crypto) + 1}</span>
											<span>•</span>
											<span>Dom: {crypto.dominance.toFixed(2)}%</span>
										</div>
									</div>
								</div>
								<div className="text-right">
									<div className="font-mono mb-1">{formatCurrency(crypto.price)}</div>
									<div
										className={`text-sm font-mono ${crypto.change24h >= 0 ? "text-green-600" : "text-red-600"}`}
									>
										{crypto.change24h >= 0 ? "+" : ""}
										{crypto.change24h.toFixed(2)}%
									</div>
								</div>
								<div className="text-right ml-6">
									<div className="text-sm text-muted-foreground mb-1">Market Cap</div>
									<div className="font-mono text-sm">{formatLargeNumber(crypto.marketCap)}</div>
								</div>
								<div className="text-right ml-6">
									<div className="text-sm text-muted-foreground mb-1">Volume 24h</div>
									<div className="font-mono text-sm">{formatLargeNumber(crypto.volume24h)}</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Gainers, Losers, Active */}
			<Card>
				<CardHeader>
					<CardTitle>Market Movers</CardTitle>
					<CardDescription>Top trending cryptocurrencies by performance and volume</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="gainers">
								<TrendingUp className="h-4 w-4 mr-2" />
								Top Gainers
							</TabsTrigger>
							<TabsTrigger value="losers">
								<TrendingDown className="h-4 w-4 mr-2" />
								Top Losers
							</TabsTrigger>
							<TabsTrigger value="active">
								<Activity className="h-4 w-4 mr-2" />
								Most Active
							</TabsTrigger>
						</TabsList>

						<TabsContent value="gainers" className="space-y-4 mt-4">
							<div className="space-y-2">
								{topGainers.map((crypto) => (
									// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
									// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
									<div
										key={crypto.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSelectCrypto?.(crypto.symbol)}
									>
										<div className="flex items-center gap-3 flex-1">
											<div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
												<TrendingUp className="h-5 w-5 text-green-600" />
											</div>
											<div>
												<div className="flex items-center gap-2">
													<span className="font-mono">{crypto.symbol}</span>
													<Badge variant="secondary" className="text-xs">
														{crypto.category}
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">{crypto.name}</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono">{formatCurrency(crypto.price)}</div>
											<div className="text-sm text-green-600 font-mono">
												+{crypto.change.toFixed(2)}%
											</div>
										</div>
										<div className="text-right ml-4">
											<p className="text-xs text-muted-foreground">Volume</p>
											<p className="text-sm font-mono">{formatLargeNumber(crypto.volume)}</p>
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
								onClick={() => onNavigateToCryptoScreener?.("trending")}
							>
								View All Gainers <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</TabsContent>

						<TabsContent value="losers" className="space-y-4 mt-4">
							<div className="space-y-2">
								{topLosers.map((crypto) => (
									// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
									// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
									<div
										key={crypto.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSelectCrypto?.(crypto.symbol)}
									>
										<div className="flex items-center gap-3 flex-1">
											<div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
												<TrendingDown className="h-5 w-5 text-red-600" />
											</div>
											<div>
												<div className="flex items-center gap-2">
													<span className="font-mono">{crypto.symbol}</span>
													<Badge variant="secondary" className="text-xs">
														{crypto.category}
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">{crypto.name}</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono">{formatCurrency(crypto.price)}</div>
											<div className="text-sm text-red-600 font-mono">
												{crypto.change.toFixed(2)}%
											</div>
										</div>
										<div className="text-right ml-4">
											<p className="text-xs text-muted-foreground">Volume</p>
											<p className="text-sm font-mono">{formatLargeNumber(crypto.volume)}</p>
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
								onClick={() => onNavigateToCryptoScreener?.()}
							>
								View All Losers <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</TabsContent>

						<TabsContent value="active" className="space-y-4 mt-4">
							<div className="space-y-2">
								{mostActive.map((crypto) => (
									// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
									// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
									<div
										key={crypto.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => onSelectCrypto?.(crypto.symbol)}
									>
										<div className="flex items-center gap-3 flex-1">
											<div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
												<Activity className="h-5 w-5 text-blue-600" />
											</div>
											<div>
												<span className="font-mono">{crypto.symbol}</span>
												<p className="text-xs text-muted-foreground">{crypto.name}</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono">{formatCurrency(crypto.price)}</div>
											<div
												className={`text-sm font-mono ${crypto.change >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												{crypto.change >= 0 ? "+" : ""}
												{crypto.change.toFixed(2)}%
											</div>
										</div>
										<div className="text-right ml-4">
											<p className="text-xs text-muted-foreground">Volume 24h</p>
											<p className="text-sm font-mono">{formatLargeNumber(crypto.volume)}</p>
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
								onClick={() => onNavigateToCryptoScreener?.("highVolume")}
							>
								View All Active <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Derivatives Overview & On-chain Metrics */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Derivatives Overview */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<Zap className="h-5 w-5" />
									Derivatives Overview
								</CardTitle>
								<CardDescription>Futures and perpetuals market metrics</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => onNavigateToCryptoScreener?.("derivatives")}
							>
								<BarChart3 className="h-4 w-4 mr-2" />
								Details
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Total OI */}
						<div className="p-3 rounded-lg bg-muted/50">
							<div className="flex items-center justify-between mb-2">
								<span className="text-sm text-muted-foreground">Total Open Interest</span>
								<Badge variant={derivativesOverview.oiChange24h >= 0 ? "default" : "destructive"}>
									{derivativesOverview.oiChange24h >= 0 ? "+" : ""}
									{derivativesOverview.oiChange24h.toFixed(2)}% 24h
								</Badge>
							</div>
							<p className="text-2xl font-mono">
								{formatLargeNumber(derivativesOverview.totalOpenInterest)}
							</p>
						</div>

						{/* Avg Funding & Liquidations */}
						<div className="grid grid-cols-2 gap-3">
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground mb-1">Avg Funding Rate</p>
								<p
									className={`text-lg font-mono ${derivativesOverview.avgFundingRate >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{derivativesOverview.avgFundingRate >= 0 ? "+" : ""}
									{(derivativesOverview.avgFundingRate * 100).toFixed(4)}%
								</p>
							</div>
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground mb-1">Long/Short Ratio</p>
								<p className="text-lg font-mono">{derivativesOverview.longShortRatio.toFixed(2)}</p>
							</div>
						</div>

						{/* Liquidations */}
						<div className="p-3 rounded-lg bg-muted/50 space-y-2">
							<p className="text-sm font-medium">Liquidations (24h)</p>
							<div className="grid grid-cols-3 gap-2 text-xs">
								<div>
									<p className="text-muted-foreground">Longs</p>
									<p className="font-mono text-red-600">
										{formatLargeNumber(derivativesOverview.longLiquidations)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Shorts</p>
									<p className="font-mono text-green-600">
										{formatLargeNumber(derivativesOverview.shortLiquidations)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Total</p>
									<p className="font-mono">
										{formatLargeNumber(derivativesOverview.totalLiquidations24h)}
									</p>
								</div>
							</div>
						</div>

						{/* Top derivatives */}
						<Separator />
						<div className="space-y-2">
							<p className="text-sm font-medium">Top Perpetuals</p>
							{topDerivatives.slice(0, 3).map((deriv) => (
								<div key={deriv.symbol} className="flex items-center justify-between text-sm">
									<span className="font-mono">{deriv.symbol}</span>
									<Badge
										variant={deriv.funding >= 0 ? "default" : "destructive"}
										className="font-mono text-xs"
									>
										{deriv.funding >= 0 ? "+" : ""}
										{(deriv.funding * 100).toFixed(4)}%
									</Badge>
									<span className="text-xs text-muted-foreground">
										{formatLargeNumber(deriv.openInterest)}
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* On-chain Aggregated Metrics */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<Network className="h-5 w-5" />
									On-chain Metrics
								</CardTitle>
								<CardDescription>Aggregated blockchain network activity</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => onNavigateToCryptoScreener?.("onchain")}
							>
								<BarChart3 className="h-4 w-4 mr-2" />
								Details
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Active Addresses */}
						<div className="p-3 rounded-lg bg-muted/50">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<Users className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm text-muted-foreground">Active Addresses</span>
								</div>
								<span
									className={`text-xs ${onChainMetrics.activeAddressesChange >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{onChainMetrics.activeAddressesChange >= 0 ? "+" : ""}
									{onChainMetrics.activeAddressesChange.toFixed(2)}%
								</span>
							</div>
							<p className="text-lg font-mono">
								{formatCompact(onChainMetrics.totalActiveAddresses)}
							</p>
						</div>

						{/* Transactions */}
						<div className="p-3 rounded-lg bg-muted/50">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm text-muted-foreground">Transactions (24h)</span>
								</div>
								<span
									className={`text-xs ${onChainMetrics.transactionsChange >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{onChainMetrics.transactionsChange >= 0 ? "+" : ""}
									{onChainMetrics.transactionsChange.toFixed(2)}%
								</span>
							</div>
							<p className="text-lg font-mono">
								{formatCompact(onChainMetrics.totalTransactions24h)}
							</p>
						</div>

						{/* Gas & Network */}
						<div className="grid grid-cols-2 gap-3">
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
									<Zap className="h-3 w-3" />
									Avg Gas (ETH)
								</p>
								<p className="font-mono">{onChainMetrics.avgGasPrice.toFixed(1)} Gwei</p>
								<p
									className={`text-xs ${onChainMetrics.gasChange >= 0 ? "text-red-600" : "text-green-600"}`}
								>
									{onChainMetrics.gasChange >= 0 ? "+" : ""}
									{onChainMetrics.gasChange.toFixed(1)}%
								</p>
							</div>
							<div className="p-3 rounded-lg bg-muted/50">
								<p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
									<Activity className="h-3 w-3" />
									Network Usage
								</p>
								<p className="font-mono">{onChainMetrics.networkUtilization}%</p>
								<Progress value={onChainMetrics.networkUtilization} className="h-1 mt-1" />
							</div>
						</div>

						{/* Network Stats */}
						<Separator />
						<div className="space-y-2">
							<p className="text-sm font-medium">Network Statistics</p>
							{networkStats.map((network) => (
								<div
									key={network.network}
									className="flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50"
								>
									<span className="font-medium">{network.network}</span>
									{network.hashRate && (
										<div className="flex items-center gap-2">
											<span className="text-muted-foreground">Hash Rate:</span>
											<span className="font-mono">
												{network.hashRate} {network.hashRateUnit}
											</span>
											<Badge variant="outline" className="text-xs">
												{network.hashRateChange >= 0 ? "+" : ""}
												{network.hashRateChange.toFixed(1)}%
											</Badge>
										</div>
									)}
									{network.validators && (
										<div className="flex items-center gap-2">
											<span className="text-muted-foreground">Validators:</span>
											<span className="font-mono">{formatCompact(network.validators)}</span>
										</div>
									)}
									{network.tps && (
										<div className="flex items-center gap-2">
											<span className="text-muted-foreground">TPS:</span>
											<span className="font-mono">{formatCompact(network.tps)}</span>
										</div>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
