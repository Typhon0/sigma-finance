import ReactECharts from "echarts-for-react";
import {
	Activity,
	AlertTriangle,
	ArrowDownToLine,
	ArrowLeft,
	ArrowUpDown,
	ArrowUpFromLine,
	BarChart3,
	Bell,
	CheckCircle2,
	Download,
	ExternalLink,
	Info,
	Search,
	Share2,
	Star,
	Target,
	TrendingDown,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface CryptoDetailProps {
	symbol: string;
	onBack?: () => void;
	onNavigateToScreener?: (filters: any) => void;
}

type TimeRange = "1D" | "7D" | "1M" | "3M" | "6M" | "1Y" | "MAX";
type ChartType = "candlestick" | "line" | "area";
type Indicator = "ma" | "rsi" | "macd" | "bollinger";
type Benchmark = "BTC" | "ETH" | "TOTAL";

export function CryptoDetail({
	symbol,
	onBack,
	onNavigateToScreener,
}: CryptoDetailProps) {
	const [timeRange, setTimeRange] = useState<TimeRange>("7D");
	const [chartType, setChartType] = useState<ChartType>("candlestick");
	const [activeIndicators, setActiveIndicators] = useState<Indicator[]>(["ma"]);
	const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
	const [showDerivatives, _setShowDerivatives] = useState(true);
	const [showOnChain, _setShowOnChain] = useState(true);

	// Mock crypto data - Replace with real API
	const cryptoData = {
		symbol: symbol,
		name: "Bitcoin",
		icon: "₿",
		price: 67234.52,
		change: 1847.23,
		changePercent: 2.82,
		high24h: 68150.0,
		low24h: 65180.0,
		volume24h: 28450000000,
		volumeChange24h: 12.5,
		marketCap: 1320000000000,
		marketCapRank: 1,
		fdv: 1410000000000,
		circulatingSupply: 19620000,
		maxSupply: 21000000,
		totalSupply: 19620000,
		dominance: 54.2,
		bid: 67232.5,
		ask: 67236.5,
		ath: 69000.0,
		athDate: "2021-11-10",
		atl: 67.81,
		atlDate: "2013-07-06",
		category: "Layer 1",
		sector: "Currency",
		tags: ["Proof of Work", "Store of Value", "Payment"],
	};

	// Derivatives data
	const derivativesData = {
		fundingRate: 0.0085,
		fundingInterval: "8h",
		nextFunding: "4h 23m",
		fundingHistory: [
			{ time: "00:00", rate: 0.0092 },
			{ time: "08:00", rate: 0.0087 },
			{ time: "16:00", rate: 0.0085 },
		],
		openInterest: 12500000000,
		openInterestChange24h: 3.2,
		longShortRatio: 1.25,
		topTraderLongRatio: 52.3,
		liquidations24h: {
			longs: 45000000,
			shorts: 32000000,
			total: 77000000,
		},
	};

	// On-chain data
	const onChainData = {
		activeAddresses: 945230,
		activeAddressesChange: 5.3,
		exchangeInflow24h: 12340,
		exchangeOutflow24h: 18920,
		netFlow24h: -6580, // negative = outflow (bullish)
		supplyOnExchanges: 2340000,
		supplyOnExchangesPercent: 11.93,
		supplyInProfit: 87.5,
		mvrv: 2.35,
		realizedCap: 562000000000,
		nvt: 78.5,
		hashRate: 450, // EH/s
		hashRateChange7d: 2.1,
		coverage: "Full", // Full, Partial, Limited
	};

	// Generate candlestick data
	const generateCandlestickData = () => {
		const days =
			timeRange === "1D"
				? 1
				: timeRange === "7D"
					? 7
					: timeRange === "1M"
						? 30
						: timeRange === "3M"
							? 90
							: timeRange === "6M"
								? 180
								: timeRange === "1Y"
									? 365
									: 730;
		const data = [];
		let currentPrice = cryptoData.price - Math.random() * 5000;

		for (let i = days; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);

			const open = currentPrice;
			const close = currentPrice + (Math.random() - 0.5) * 2000;
			const high = Math.max(open, close) + Math.random() * 500;
			const low = Math.min(open, close) - Math.random() * 500;
			const volume = Math.floor(
				(Math.random() * 0.5 + 0.75) * cryptoData.volume24h,
			);

			data.push({
				date: date.toISOString().split("T")[0],
				values: [open, close, low, high],
				volume: volume,
			});

			currentPrice = close;
		}

		return data;
	};

	const candlestickData = useMemo(() => generateCandlestickData(), [timeRange]);

	// Calculate technical indicators
	const calculateMA = (period: number) => {
		const ma = [];
		for (let i = 0; i < candlestickData.length; i++) {
			if (i < period - 1) {
				ma.push(null);
			} else {
				let sum = 0;
				for (let j = 0; j < period; j++) {
					sum += candlestickData[i - j].values[1];
				}
				ma.push(sum / period);
			}
		}
		return ma;
	};

	const calculateRSI = (period: number = 14) => {
		const rsi = [];
		const changes = [];

		for (let i = 1; i < candlestickData.length; i++) {
			changes.push(
				candlestickData[i].values[1] - candlestickData[i - 1].values[1],
			);
		}

		for (let i = 0; i < changes.length; i++) {
			if (i < period) {
				rsi.push(null);
			} else {
				let gains = 0,
					losses = 0;
				for (let j = 0; j < period; j++) {
					if (changes[i - j] > 0) gains += changes[i - j];
					else losses -= changes[i - j];
				}
				const rs = gains / period / (losses / period);
				rsi.push(100 - 100 / (1 + rs));
			}
		}
		return rsi;
	};

	// Main chart options
	const mainChartOption = {
		animation: false,
		legend: {
			top: 10,
			left: "center",
			textStyle: { fontSize: 12 },
		},
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "cross" },
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff" },
			formatter: (params: any) => {
				const data = params[0];
				if (!data) return "";
				const ohlc = candlestickData[data.dataIndex];
				return `
          <div style="font-size: 12px;">
            <strong>${ohlc.date}</strong><br/>
            Open: $${ohlc.values[0].toLocaleString()}<br/>
            High: $${ohlc.values[3].toLocaleString()}<br/>
            Low: $${ohlc.values[2].toLocaleString()}<br/>
            Close: $${ohlc.values[1].toLocaleString()}<br/>
            Volume: $${(ohlc.volume / 1e9).toFixed(2)}B
          </div>
        `;
			},
		},
		grid: [
			{ left: 70, right: 60, top: 80, height: "50%" },
			{ left: 70, right: 60, top: "72%", height: "15%" },
		],
		xAxis: [
			{
				type: "category",
				data: candlestickData.map((d) => d.date),
				boundaryGap: true,
				axisLine: { onZero: false },
				splitLine: { show: false },
			},
			{
				type: "category",
				gridIndex: 1,
				data: candlestickData.map((d) => d.date),
				boundaryGap: true,
				axisLine: { onZero: false },
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
			},
		],
		yAxis: [
			{
				scale: true,
				splitArea: { show: false },
				axisLabel: {
					formatter: (value: number) => `$${(value / 1000).toFixed(0)}k`,
				},
			},
			{
				scale: true,
				gridIndex: 1,
				splitNumber: 2,
				axisLabel: { show: false },
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false },
			},
		],
		dataZoom: [
			{
				type: "inside",
				xAxisIndex: [0, 1],
				start: 0,
				end: 100,
			},
			{
				show: true,
				xAxisIndex: [0, 1],
				type: "slider",
				bottom: 10,
				start: 0,
				end: 100,
				height: 20,
			},
		],
		series: [
			...(chartType === "candlestick"
				? [
						{
							name: cryptoData.symbol,
							type: "candlestick",
							data: candlestickData.map((d) => d.values),
							itemStyle: {
								color: "#26a69a",
								color0: "#ef5350",
								borderColor: "#26a69a",
								borderColor0: "#ef5350",
							},
						},
					]
				: chartType === "line"
					? [
							{
								name: cryptoData.symbol,
								type: "line",
								data: candlestickData.map((d) => d.values[1]),
								smooth: true,
								lineStyle: { width: 2, color: "#26a69a" },
								showSymbol: false,
							},
						]
					: [
							{
								name: cryptoData.symbol,
								type: "line",
								data: candlestickData.map((d) => d.values[1]),
								smooth: true,
								lineStyle: { width: 2, color: "#26a69a" },
								areaStyle: {
									color: {
										type: "linear",
										x: 0,
										y: 0,
										x2: 0,
										y2: 1,
										colorStops: [
											{ offset: 0, color: "rgba(38, 166, 154, 0.3)" },
											{ offset: 1, color: "rgba(38, 166, 154, 0.05)" },
										],
									},
								},
								showSymbol: false,
							},
						]),
			...(activeIndicators.includes("ma")
				? [
						{
							name: "EMA20",
							type: "line",
							data: calculateMA(20),
							smooth: true,
							lineStyle: { opacity: 0.8, width: 1.5, color: "#2196F3" },
							showSymbol: false,
							connectNulls: true,
						},
						{
							name: "SMA50",
							type: "line",
							data: calculateMA(50),
							smooth: true,
							lineStyle: { opacity: 0.8, width: 1.5, color: "#FF9800" },
							showSymbol: false,
							connectNulls: true,
						},
					]
				: []),
			{
				name: "Volume",
				type: "bar",
				xAxisIndex: 1,
				yAxisIndex: 1,
				data: candlestickData.map((d, i) => ({
					value: d.volume,
					itemStyle: {
						color:
							i > 0 && d.values[1] > candlestickData[i - 1].values[1]
								? "#26a69a"
								: "#ef5350",
					},
				})),
			},
		],
	};

	// RSI Chart
	const rsiChartOption = {
		tooltip: {
			trigger: "axis",
			backgroundColor: "rgba(0, 0, 0, 0.8)",
			textStyle: { color: "#fff" },
		},
		grid: { left: 70, right: 60, top: 30, bottom: 30 },
		xAxis: {
			type: "category",
			data: candlestickData.map((d) => d.date),
			show: false,
		},
		yAxis: {
			type: "value",
			min: 0,
			max: 100,
			splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
		},
		series: [
			{
				name: "RSI",
				type: "line",
				data: calculateRSI(),
				smooth: true,
				lineStyle: { color: "#9C27B0", width: 2 },
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(156, 39, 176, 0.3)" },
							{ offset: 1, color: "rgba(156, 39, 176, 0.05)" },
						],
					},
				},
			},
		],
	};

	// Performance periods
	const performancePeriods = [
		{ label: "1W", value: 8.5, vsBTC: 2.1, vsETH: -0.8 },
		{ label: "1M", value: 15.2, vsBTC: 5.3, vsETH: 3.2 },
		{ label: "3M", value: 28.7, vsBTC: 12.1, vsETH: 8.9 },
		{ label: "6M", value: 42.3, vsBTC: 18.5, vsETH: 15.2 },
		{ label: "YTD", value: 78.4, vsBTC: 32.1, vsETH: 28.6 },
		{ label: "1Y", value: 125.8, vsBTC: 45.2, vsETH: 38.9 },
	];

	// Peer cryptocurrencies
	const peerCryptos = [
		{
			symbol: "ETH",
			name: "Ethereum",
			price: 3234.52,
			change: 3.2,
			marketCap: 388000000000,
		},
		{
			symbol: "BNB",
			name: "BNB",
			price: 312.45,
			change: 1.8,
			marketCap: 48000000000,
		},
		{
			symbol: "SOL",
			name: "Solana",
			price: 142.67,
			change: 5.4,
			marketCap: 62000000000,
		},
		{
			symbol: "ADA",
			name: "Cardano",
			price: 0.58,
			change: -1.2,
			marketCap: 20000000000,
		},
	];

	// News items
	const newsItems = [
		{
			id: 1,
			title: "Bitcoin ETF Sees Record $1.2B Inflows in Single Day",
			source: "Bloomberg",
			time: "2h ago",
			tags: ["Institutional", "Positive"],
			sentiment: "positive",
		},
		{
			id: 2,
			title: "Major Exchange Lists BTC Perpetual Futures",
			source: "CoinDesk",
			time: "5h ago",
			tags: ["Listing", "Derivatives"],
			sentiment: "positive",
		},
		{
			id: 3,
			title: "Bitcoin Network Upgrade Scheduled for Q4",
			source: "Bitcoin Magazine",
			time: "1d ago",
			tags: ["Network", "Upgrade"],
			sentiment: "neutral",
		},
		{
			id: 4,
			title: "SEC Delays Decision on Bitcoin Spot ETF Applications",
			source: "Reuters",
			time: "2d ago",
			tags: ["Regulatory", "Negative"],
			sentiment: "negative",
		},
	];

	const toggleIndicator = (indicator: Indicator) => {
		if (activeIndicators.includes(indicator)) {
			setActiveIndicators(activeIndicators.filter((i) => i !== indicator));
		} else {
			setActiveIndicators([...activeIndicators, indicator]);
		}
	};

	const { formatCurrency, currencySymbol } = useCurrency();

	const formatLargeNumber = (num: number) => {
		if (num >= 1e12) return `${currencySymbol}${(num / 1e12).toFixed(2)}T`;
		if (num >= 1e9) return `${currencySymbol}${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `${currencySymbol}${(num / 1e6).toFixed(2)}M`;
		return formatCurrency(num);
	};

	const formatNumber = (num: number) => {
		if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
		if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
		return num.toFixed(0);
	};

	const supplyProgress =
		(cryptoData.circulatingSupply / cryptoData.maxSupply) * 100;

	return (
		<div className="space-y-6">
			{/* Back Button */}
			{onBack && (
				<Button variant="ghost" onClick={onBack} className="mb-4">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Screener
				</Button>
			)}

			{/* Header - Price & Key Stats */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
						{/* Left: Symbol & Price */}
						<div className="space-y-4">
							<div>
								<div className="flex items-center gap-3 mb-2">
									<div className="text-3xl">{cryptoData.icon}</div>
									<h1 className="text-3xl">{cryptoData.symbol}</h1>
									<Badge variant="outline">
										Rank #{cryptoData.marketCapRank}
									</Badge>
									<Badge variant="secondary">{cryptoData.category}</Badge>
								</div>
								<p className="text-muted-foreground">{cryptoData.name}</p>
								<div className="flex flex-wrap gap-1 mt-2">
									{cryptoData.tags.map((tag) => (
										<Badge key={tag} variant="outline" className="text-xs">
											{tag}
										</Badge>
									))}
								</div>
							</div>

							<div className="flex items-baseline gap-4">
								<div className="text-4xl font-mono">
									{formatCurrency(cryptoData.price)}
								</div>
								<div
									className={`flex items-center gap-2 text-xl ${cryptoData.change >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{cryptoData.change >= 0 ? (
										<TrendingUp className="h-5 w-5" />
									) : (
										<TrendingDown className="h-5 w-5" />
									)}
									<span className="font-mono">
										{cryptoData.change >= 0 ? "+" : ""}
										{formatCurrency(cryptoData.change)} (
										{cryptoData.changePercent >= 0 ? "+" : ""}
										{cryptoData.changePercent.toFixed(2)}%)
									</span>
								</div>
							</div>

							{/* 24h Range */}
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">24h Range</span>
									<span className="font-mono">
										{formatCurrency(cryptoData.low24h)} -{" "}
										{formatCurrency(cryptoData.high24h)}
									</span>
								</div>
								<Progress
									value={
										((cryptoData.price - cryptoData.low24h) /
											(cryptoData.high24h - cryptoData.low24h)) *
										100
									}
									className="h-1.5"
								/>
							</div>
						</div>

						{/* Right: Quick Actions */}
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() =>
									toast.success(`Added ${cryptoData.symbol} to watchlist`)
								}
							>
								<Star className="h-4 w-4 mr-2" />
								Add to Watchlist
							</Button>
							<Button
								variant="outline"
								onClick={() => toast.success("Alert created")}
							>
								<Bell className="h-4 w-4 mr-2" />
								Create Alert
							</Button>
							<Button variant="outline">
								<Share2 className="h-4 w-4 mr-2" />
								Share
							</Button>
							<Button variant="outline">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</div>
					</div>

					<Separator className="my-6" />

					{/* Key Metrics Grid */}
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">Market Cap</p>
							<p className="font-mono">
								{formatLargeNumber(cryptoData.marketCap)}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">FDV</p>
							<p className="font-mono">{formatLargeNumber(cryptoData.fdv)}</p>
						</div>
						<div>
							<p className="text-muted-foreground flex items-center gap-1">
								24h Volume
								<span
									className={`text-xs ${cryptoData.volumeChange24h >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{cryptoData.volumeChange24h >= 0 ? "+" : ""}
									{cryptoData.volumeChange24h.toFixed(1)}%
								</span>
							</p>
							<p className="font-mono">
								{formatLargeNumber(cryptoData.volume24h)}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">Dominance</p>
							<p className="font-mono">{cryptoData.dominance.toFixed(2)}%</p>
						</div>
						<div>
							<p className="text-muted-foreground">Circulating Supply</p>
							<p className="font-mono">
								{formatNumber(cryptoData.circulatingSupply)}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">Max Supply</p>
							<p className="font-mono">{formatNumber(cryptoData.maxSupply)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Bid × Ask</p>
							<p className="font-mono text-xs">
								{formatCurrency(cryptoData.bid)} ×{" "}
								{formatCurrency(cryptoData.ask)}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">ATH</p>
							<p className="font-mono text-green-600">
								{formatCurrency(cryptoData.ath)}
							</p>
							<p className="text-xs text-muted-foreground">
								{cryptoData.athDate}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">ATL</p>
							<p className="font-mono text-red-600">
								{formatCurrency(cryptoData.atl)}
							</p>
							<p className="text-xs text-muted-foreground">
								{cryptoData.atlDate}
							</p>
						</div>
						<div className="col-span-3">
							<p className="text-muted-foreground mb-1">Supply Progress</p>
							<div className="flex items-center gap-2">
								<Progress value={supplyProgress} className="flex-1 h-2" />
								<span className="text-xs font-mono">
									{supplyProgress.toFixed(1)}%
								</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Main Content - 2 Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Column - Chart & Derivatives */}
				<div className="lg:col-span-2 space-y-6">
					{/* Chart Card */}
					<Card>
						<CardHeader>
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
								<CardTitle>Price Chart</CardTitle>

								<div className="flex flex-wrap items-center gap-2">
									{/* Timeframe Selector */}
									<div className="flex gap-1">
										{(
											["1D", "7D", "1M", "3M", "6M", "1Y", "MAX"] as TimeRange[]
										).map((range) => (
											<Button
												key={range}
												variant={timeRange === range ? "default" : "outline"}
												size="sm"
												onClick={() => setTimeRange(range)}
												className="h-8 px-3"
											>
												{range}
											</Button>
										))}
									</div>

									{/* Chart Type */}
									<Select
										value={chartType}
										onValueChange={(value: ChartType) => setChartType(value)}
									>
										<SelectTrigger className="w-32 h-8">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="candlestick">Candlestick</SelectItem>
											<SelectItem value="line">Line</SelectItem>
											<SelectItem value="area">Area</SelectItem>
										</SelectContent>
									</Select>

									{/* Benchmark */}
									<Select
										value={benchmark || "none"}
										onValueChange={(value) =>
											setBenchmark(
												value === "none" ? null : (value as Benchmark),
											)
										}
									>
										<SelectTrigger className="w-32 h-8">
											<SelectValue placeholder="Compare" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">No Compare</SelectItem>
											<SelectItem value="BTC">vs BTC</SelectItem>
											<SelectItem value="ETH">vs ETH</SelectItem>
											<SelectItem value="TOTAL">vs TOTAL</SelectItem>
										</SelectContent>
									</Select>

									{/* Indicators */}
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="outline" size="sm" className="h-8">
												<BarChart3 className="h-4 w-4 mr-2" />
												Indicators
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-64">
											<div className="space-y-3">
												<h4 className="font-medium text-sm">
													Technical Indicators
												</h4>
												<Separator />
												<div className="space-y-2">
													<div className="flex items-center space-x-2">
														<Checkbox
															id="ma"
															checked={activeIndicators.includes("ma")}
															onCheckedChange={() => toggleIndicator("ma")}
														/>
														<Label htmlFor="ma" className="text-sm">
															EMA/SMA (20, 50)
														</Label>
													</div>
													<div className="flex items-center space-x-2">
														<Checkbox
															id="rsi"
															checked={activeIndicators.includes("rsi")}
															onCheckedChange={() => toggleIndicator("rsi")}
														/>
														<Label htmlFor="rsi" className="text-sm">
															RSI (14)
														</Label>
													</div>
													<div className="flex items-center space-x-2">
														<Checkbox
															id="macd"
															checked={activeIndicators.includes("macd")}
															onCheckedChange={() => toggleIndicator("macd")}
														/>
														<Label htmlFor="macd" className="text-sm">
															MACD
														</Label>
													</div>
													<div className="flex items-center space-x-2">
														<Checkbox
															id="bollinger"
															checked={activeIndicators.includes("bollinger")}
															onCheckedChange={() =>
																toggleIndicator("bollinger")
															}
														/>
														<Label htmlFor="bollinger" className="text-sm">
															Bollinger Bands
														</Label>
													</div>
												</div>
											</div>
										</PopoverContent>
									</Popover>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<ReactECharts
								option={mainChartOption}
								style={{ height: "500px" }}
								opts={{ renderer: "svg" }}
							/>
						</CardContent>
					</Card>

					{/* RSI Indicator */}
					{activeIndicators.includes("rsi") && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-base">
										Relative Strength Index (RSI)
									</CardTitle>
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="ghost" size="icon" className="h-6 w-6">
												<Info className="h-4 w-4" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-80">
											<div className="space-y-2 text-sm">
												<p className="font-medium">RSI Interpretation:</p>
												<p>• RSI &gt; 70: Overbought (potential sell signal)</p>
												<p>• RSI &lt; 30: Oversold (potential buy signal)</p>
												<p>• RSI 30-70: Neutral range</p>
											</div>
										</PopoverContent>
									</Popover>
								</div>
							</CardHeader>
							<CardContent>
								<ReactECharts
									option={rsiChartOption}
									style={{ height: "150px" }}
									opts={{ renderer: "svg" }}
								/>
							</CardContent>
						</Card>
					)}

					{/* Derivatives Signals */}
					{showDerivatives && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>Derivatives Signals</CardTitle>
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="ghost" size="icon" className="h-6 w-6">
												<Info className="h-4 w-4" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-80">
											<div className="space-y-2 text-sm">
												<p className="font-medium">Derivatives Metrics:</p>
												<p>
													• <strong>Funding Rate</strong>: Cost to hold perps,
													positive = longs pay shorts
												</p>
												<p>
													• <strong>Open Interest</strong>: Total value of open
													futures/perps
												</p>
												<p>
													• <strong>Long/Short Ratio</strong>: Sentiment gauge
													from positions
												</p>
											</div>
										</PopoverContent>
									</Popover>
								</div>
								<CardDescription>
									Perpetual futures and leverage metrics
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{/* Funding Rate */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Zap className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium">
													Funding Rate
												</span>
											</div>
											<Badge
												variant={
													derivativesData.fundingRate >= 0
														? "default"
														: "destructive"
												}
												className="font-mono"
											>
												{derivativesData.fundingRate >= 0 ? "+" : ""}
												{(derivativesData.fundingRate * 100).toFixed(4)}%
											</Badge>
										</div>
										<div className="grid grid-cols-2 gap-3 text-sm">
											<div>
												<p className="text-muted-foreground">Interval</p>
												<p className="font-mono">
													{derivativesData.fundingInterval}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground">Next Funding</p>
												<p className="font-mono">
													{derivativesData.nextFunding}
												</p>
											</div>
										</div>
										{derivativesData.fundingRate > 0.01 && (
											<div className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
												<AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
												<span>
													High positive funding indicates overleveraged longs
												</span>
											</div>
										)}
									</div>

									{/* Open Interest */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Activity className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium">
													Open Interest
												</span>
											</div>
											<div className="text-right">
												<p className="font-mono">
													{formatLargeNumber(derivativesData.openInterest)}
												</p>
												<p
													className={`text-xs ${derivativesData.openInterestChange24h >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{derivativesData.openInterestChange24h >= 0
														? "+"
														: ""}
													{derivativesData.openInterestChange24h.toFixed(2)}%
													24h
												</p>
											</div>
										</div>
									</div>

									{/* Long/Short Ratio */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium">
													Long/Short Ratio
												</span>
											</div>
											<Badge variant="outline" className="font-mono">
												{derivativesData.longShortRatio.toFixed(2)}
											</Badge>
										</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<div className="flex-1 h-2 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
													<div
														className="h-full bg-green-600"
														style={{
															width: `${(derivativesData.longShortRatio / (derivativesData.longShortRatio + 1)) * 100}%`,
														}}
													/>
												</div>
												<span className="text-xs font-mono text-green-600 w-12">
													{(
														(derivativesData.longShortRatio /
															(derivativesData.longShortRatio + 1)) *
														100
													).toFixed(0)}
													%
												</span>
											</div>
											<div className="flex items-center justify-between text-xs text-muted-foreground">
												<span>Longs</span>
												<span>Shorts</span>
											</div>
										</div>
									</div>

									{/* Liquidations 24h */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center gap-2 mb-3">
											<Target className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm font-medium">
												Liquidations (24h)
											</span>
										</div>
										<div className="grid grid-cols-3 gap-3 text-sm">
											<div className="text-center">
												<p className="text-muted-foreground">Longs</p>
												<p className="font-mono text-red-600">
													{formatLargeNumber(
														derivativesData.liquidations24h.longs,
													)}
												</p>
											</div>
											<div className="text-center">
												<p className="text-muted-foreground">Shorts</p>
												<p className="font-mono text-green-600">
													{formatLargeNumber(
														derivativesData.liquidations24h.shorts,
													)}
												</p>
											</div>
											<div className="text-center">
												<p className="text-muted-foreground">Total</p>
												<p className="font-mono">
													{formatLargeNumber(
														derivativesData.liquidations24h.total,
													)}
												</p>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Performance */}
					<Card>
						<CardHeader>
							<CardTitle>Performance</CardTitle>
							<CardDescription>
								Historical returns across different periods
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Tabs defaultValue="absolute">
								<TabsList className="grid w-full grid-cols-3 mb-4">
									<TabsTrigger value="absolute">Absolute</TabsTrigger>
									<TabsTrigger value="vsBTC">vs BTC</TabsTrigger>
									<TabsTrigger value="vsETH">vs ETH</TabsTrigger>
								</TabsList>

								<TabsContent value="absolute">
									<div className="grid grid-cols-3 md:grid-cols-6 gap-3">
										{performancePeriods.map((period) => (
											<div
												key={period.label}
												className="text-center p-3 rounded-lg bg-muted/50"
											>
												<p className="text-xs text-muted-foreground mb-1">
													{period.label}
												</p>
												<p
													className={`font-mono ${period.value >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{period.value >= 0 ? "+" : ""}
													{period.value.toFixed(1)}%
												</p>
											</div>
										))}
									</div>
								</TabsContent>

								<TabsContent value="vsBTC">
									<div className="grid grid-cols-3 md:grid-cols-6 gap-3">
										{performancePeriods.map((period) => (
											<div
												key={period.label}
												className="text-center p-3 rounded-lg bg-muted/50"
											>
												<p className="text-xs text-muted-foreground mb-1">
													{period.label}
												</p>
												<p
													className={`font-mono ${period.vsBTC >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{period.vsBTC >= 0 ? "+" : ""}
													{period.vsBTC.toFixed(1)}%
												</p>
											</div>
										))}
									</div>
								</TabsContent>

								<TabsContent value="vsETH">
									<div className="grid grid-cols-3 md:grid-cols-6 gap-3">
										{performancePeriods.map((period) => (
											<div
												key={period.label}
												className="text-center p-3 rounded-lg bg-muted/50"
											>
												<p className="text-xs text-muted-foreground mb-1">
													{period.label}
												</p>
												<p
													className={`font-mono ${period.vsETH >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{period.vsETH >= 0 ? "+" : ""}
													{period.vsETH.toFixed(1)}%
												</p>
											</div>
										))}
									</div>
								</TabsContent>
							</Tabs>
						</CardContent>
					</Card>
				</div>

				{/* Right Column - On-chain, Peers, News */}
				<div className="space-y-6">
					{/* On-chain Snapshot */}
					{showOnChain && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-base">On-chain Snapshot</CardTitle>
									<Badge variant="outline">{onChainData.coverage}</Badge>
								</div>
								<CardDescription>
									Network activity and holder behavior
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Active Addresses */}
								<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
									<div className="flex items-center gap-2">
										<Users className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm">Active Addresses</span>
									</div>
									<div className="text-right">
										<p className="font-mono">
											{formatNumber(onChainData.activeAddresses)}
										</p>
										<p
											className={`text-xs ${onChainData.activeAddressesChange >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{onChainData.activeAddressesChange >= 0 ? "+" : ""}
											{onChainData.activeAddressesChange.toFixed(1)}%
										</p>
									</div>
								</div>

								{/* Exchange Flows */}
								<div className="p-3 rounded-lg bg-muted/50 space-y-3">
									<div className="flex items-center gap-2">
										<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm font-medium">
											Exchange Flows (24h)
										</span>
									</div>
									<div className="grid grid-cols-2 gap-3 text-sm">
										<div>
											<div className="flex items-center gap-1 text-muted-foreground mb-1">
												<ArrowDownToLine className="h-3 w-3" />
												<span>Inflow</span>
											</div>
											<p className="font-mono text-red-600">
												{formatNumber(onChainData.exchangeInflow24h)} BTC
											</p>
										</div>
										<div>
											<div className="flex items-center gap-1 text-muted-foreground mb-1">
												<ArrowUpFromLine className="h-3 w-3" />
												<span>Outflow</span>
											</div>
											<p className="font-mono text-green-600">
												{formatNumber(onChainData.exchangeOutflow24h)} BTC
											</p>
										</div>
									</div>
									<div className="pt-2 border-t border-border">
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												Net Flow
											</span>
											<div className="flex items-center gap-1">
												{onChainData.netFlow24h < 0 ? (
													<>
														<CheckCircle2 className="h-3 w-3 text-green-600" />
														<span className="text-xs font-mono text-green-600">
															{onChainData.netFlow24h} BTC (Bullish)
														</span>
													</>
												) : (
													<>
														<AlertTriangle className="h-3 w-3 text-red-600" />
														<span className="text-xs font-mono text-red-600">
															+{onChainData.netFlow24h} BTC (Bearish)
														</span>
													</>
												)}
											</div>
										</div>
									</div>
								</div>

								{/* Supply Metrics */}
								<div className="space-y-3">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											Supply on Exchanges
										</span>
										<span className="font-mono">
											{onChainData.supplyOnExchangesPercent.toFixed(2)}%
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											Supply in Profit
										</span>
										<span className="font-mono text-green-600">
											{onChainData.supplyInProfit.toFixed(1)}%
										</span>
									</div>
									<Separator />
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">MVRV Ratio</span>
										<Badge
											variant={
												onChainData.mvrv > 3
													? "destructive"
													: onChainData.mvrv < 1
														? "default"
														: "secondary"
											}
										>
											{onChainData.mvrv.toFixed(2)}
										</Badge>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Realized Cap</span>
										<span className="font-mono">
											{formatLargeNumber(onChainData.realizedCap)}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">NVT Ratio</span>
										<span className="font-mono">
											{onChainData.nvt.toFixed(1)}
										</span>
									</div>
								</div>

								{/* Hash Rate (for PoW) */}
								{cryptoData.tags.includes("Proof of Work") && (
									<div className="p-3 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Activity className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm">Hash Rate</span>
											</div>
											<div className="text-right">
												<p className="font-mono">{onChainData.hashRate} EH/s</p>
												<p
													className={`text-xs ${onChainData.hashRateChange7d >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{onChainData.hashRateChange7d >= 0 ? "+" : ""}
													{onChainData.hashRateChange7d.toFixed(1)}% 7d
												</p>
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Peer Cryptocurrencies */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Similar Assets</CardTitle>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										onNavigateToScreener?.({ category: cryptoData.category })
									}
								>
									<Search className="h-4 w-4 mr-2" />
									View All
								</Button>
							</div>
							<CardDescription>
								Other {cryptoData.category} cryptocurrencies
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{peerCryptos.map((crypto) => (
									<div
										key={crypto.symbol}
										className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
									>
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-1">
												<span className="font-medium">{crypto.symbol}</span>
												<span className="text-xs text-muted-foreground">
													{crypto.name}
												</span>
											</div>
											<p className="text-xs text-muted-foreground">
												{formatLargeNumber(crypto.marketCap)}
											</p>
										</div>
										<div className="text-right">
											<p className="font-mono">
												{formatCurrency(crypto.price)}
											</p>
											<p
												className={`text-xs ${crypto.change >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												{crypto.change >= 0 ? "+" : ""}
												{crypto.change.toFixed(2)}%
											</p>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* News Card */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Latest News</CardTitle>
							<CardDescription>Real-time updates and events</CardDescription>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[400px] pr-4">
								<div className="space-y-4">
									{newsItems.map((news) => (
										<div
											key={news.id}
											className="space-y-2 pb-4 border-b last:border-0"
										>
											<div className="flex items-start gap-2">
												<div
													className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${news.sentiment === "positive" ? "bg-green-600" : news.sentiment === "negative" ? "bg-red-600" : "bg-gray-400"}`}
												/>
												<div className="flex-1 min-w-0">
													<h4 className="text-sm font-medium leading-tight mb-1">
														{news.title}
													</h4>
													<div className="flex items-center gap-2 text-xs text-muted-foreground">
														<span>{news.source}</span>
														<span>•</span>
														<span>{news.time}</span>
													</div>
													<div className="flex flex-wrap gap-1 mt-2">
														{news.tags.map((tag) => (
															<Badge
																key={tag}
																variant="secondary"
																className="text-xs"
															>
																{tag}
															</Badge>
														))}
													</div>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 flex-shrink-0"
												>
													<ExternalLink className="h-3 w-3" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
