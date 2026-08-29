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
import { AssetDetailChart, type AssetDetailChartPoint } from "@/components/charts/AssetDetailChart";
import TradingViewChart from "@/components/charts/TradingViewChart";
import { PageTimeframeSelector, type TimeRange } from "@/components/shared/PageTimeframeSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

interface CryptoDetailProps {
	cryptoId?: string;
	symbol?: string;
	onBack?: () => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onNavigateToScreener?: (filters: any) => void;
}

type Benchmark = "BTC" | "ETH" | "TOTAL";

export function CryptoDetail({ symbol = "BTC", onBack, onNavigateToScreener }: CryptoDetailProps) {
	const [timeRange, setTimeRange] = useState<TimeRange>("7D");
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

	// Generate chart data
	const chartData = useMemo(() => {
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
		const data: AssetDetailChartPoint[] = [];
		let currentPrice = cryptoData.price - Math.random() * 5000;

		for (let i = days; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);

			const open = currentPrice;
			const close = currentPrice + (Math.random() - 0.5) * 2000;
			const high = Math.max(open, close) + Math.random() * 500;
			const low = Math.min(open, close) - Math.random() * 500;
			const volume = Math.floor((Math.random() * 0.5 + 0.75) * cryptoData.volume24h);

			data.push({
				date: date.toISOString().split("T")[0],
				open,
				close,
				low,
				high,
				volume,
			});

			currentPrice = close;
		}

		return data;
	}, [timeRange, cryptoData.price, cryptoData.volume24h]);

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

	const supplyProgress = (cryptoData.circulatingSupply / cryptoData.maxSupply) * 100;

	return (
		<div className="space-y-6">
			{/* Navigation & Header */}
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{onBack && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onBack}
								className="h-8 w-8 p-0 rounded-full border border-border/50"
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<div className="flex items-baseline gap-3">
							<div className="text-2xl">{cryptoData.icon}</div>
							<h1 className="text-2xl font-bold tracking-tight">{cryptoData.symbol}</h1>
							<span className="text-sm text-muted-foreground">{cryptoData.name}</span>
							<Badge variant="outline" className="text-[10px] h-5 border-border/50 font-normal">
								Rank #{cryptoData.marketCapRank}
							</Badge>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<PageTimeframeSelector
							value={timeRange}
							onChange={setTimeRange}
							ranges={["1D", "7D", "1M", "3M", "6M", "1Y", "MAX"]}
							className="mr-2"
						/>
						<div className="h-8 w-px bg-border/50 mx-2 hidden sm:block" />
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs"
							onClick={() => toast.success(`Added ${cryptoData.symbol} to watchlist`)}
						>
							<Star className="h-3.5 w-3.5 mr-2" /> Watch
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs"
							onClick={() => toast.success("Alert created")}
						>
							<Bell className="h-3.5 w-3.5 mr-2" /> Alert
						</Button>
						<div className="h-4 w-px bg-border/50 mx-1" />
						<Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-0">
							<Zap className="h-3.5 w-3.5 mr-2" /> Trade
						</Button>
					</div>
				</div>

				{/* Price Hero */}
				<div className="flex items-end gap-6 pb-4 border-b border-border/40">
					<div className="flex items-baseline gap-4">
						<span className="text-4xl font-mono font-bold tracking-tighter text-foreground">
							{formatCurrency(cryptoData.price)}
						</span>
						<span
							className={cn(
								"text-lg font-mono font-medium flex items-center gap-1",
								cryptoData.change >= 0 ? "text-emerald-500" : "text-rose-500",
							)}
						>
							{cryptoData.change >= 0 ? (
								<TrendingUp className="h-5 w-5" />
							) : (
								<TrendingDown className="h-5 w-5" />
							)}
							{cryptoData.change >= 0 ? "+" : ""}
							{formatCurrency(cryptoData.change)} ({cryptoData.changePercent.toFixed(2)}%)
						</span>
					</div>
					<div className="flex gap-6 text-xs text-muted-foreground pb-1.5 font-mono">
						<div className="flex items-center gap-2">
							<span className="opacity-50">24h Range</span>
							<span className="text-foreground">
								{formatCurrency(cryptoData.low24h)} - {formatCurrency(cryptoData.high24h)}
							</span>
							<div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-foreground/20"
									style={{
										width: `${((cryptoData.price - cryptoData.low24h) / (cryptoData.high24h - cryptoData.low24h)) * 100}%`,
									}}
								/>
							</div>
						</div>
						<div>
							<span className="opacity-50 mr-2">Vol (24h)</span>
							{formatLargeNumber(cryptoData.volume24h)}
						</div>
					</div>
				</div>
			</div>

			{/* Key Metrics Strip */}
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
				<div className="p-3 bg-card/40 border border-border/40 rounded-lg">
					<p className="text-muted-foreground mb-1 uppercase tracking-wider font-bold text-[10px]">
						Market Cap
					</p>
					<p className="font-mono font-medium">{formatLargeNumber(cryptoData.marketCap)}</p>
				</div>
				<div className="p-3 bg-card/40 border border-border/40 rounded-lg">
					<p className="text-muted-foreground mb-1 uppercase tracking-wider font-bold text-[10px]">
						FDV
					</p>
					<p className="font-mono font-medium">{formatLargeNumber(cryptoData.fdv)}</p>
				</div>
				<div className="p-3 bg-card/40 border border-border/40 rounded-lg">
					<p className="text-muted-foreground mb-1 uppercase tracking-wider font-bold text-[10px]">
						Dominance
					</p>
					<p className="font-mono font-medium">{cryptoData.dominance.toFixed(2)}%</p>
				</div>
				<div className="p-3 bg-card/40 border border-border/40 rounded-lg">
					<p className="text-muted-foreground mb-1 uppercase tracking-wider font-bold text-[10px]">
						Circulating Supply
					</p>
					<p className="font-mono font-medium">{formatNumber(cryptoData.circulatingSupply)}</p>
				</div>
				<div className="p-3 bg-card/40 border border-border/40 rounded-lg">
					<p className="text-muted-foreground mb-1 uppercase tracking-wider font-bold text-[10px]">
						ATH
					</p>
					<p className="font-mono font-medium text-emerald-500">{formatCurrency(cryptoData.ath)}</p>
				</div>
				<div className="p-3 bg-card/40 border border-border/40 rounded-lg">
					<p className="text-muted-foreground mb-1 uppercase tracking-wider font-bold text-[10px]">
						ATL
					</p>
					<p className="font-mono font-medium text-rose-500">{formatCurrency(cryptoData.atl)}</p>
				</div>
			</div>

			{/* Main Content - 2 Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Column - Chart & Derivatives */}
				<div className="lg:col-span-2 space-y-6">
					{/* Chart Section */}
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold flex items-center gap-2">
								<BarChart3 className="h-5 w-5 text-primary" />
								Price Chart
							</h3>
							<div className="flex items-center gap-2">
								{/* Benchmark */}
								<Select
									value={benchmark || "none"}
									onValueChange={(value) =>
										setBenchmark(value === "none" ? null : (value as Benchmark))
									}
								>
									<SelectTrigger className="w-32 h-8 text-xs border-border/40 bg-card/40">
										<SelectValue placeholder="Compare" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No Compare</SelectItem>
										<SelectItem value="BTC">vs BTC</SelectItem>
										<SelectItem value="ETH">vs ETH</SelectItem>
										<SelectItem value="TOTAL">vs TOTAL</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="h-[500px]">
							<TradingViewChart
								symbol={cryptoData.symbol}
								assetType="CRYPTO"
								height={500}
								interval={
									(timeRange as string) === "24H" || (timeRange as string) === "1D" ? "60" : "1D"
								}
							/>
						</div>
					</div>

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
													• <strong>Funding Rate</strong>: Cost to hold perps, positive = longs pay
													shorts
												</p>
												<p>
													• <strong>Open Interest</strong>: Total value of open futures/perps
												</p>
												<p>
													• <strong>Long/Short Ratio</strong>: Sentiment gauge from positions
												</p>
											</div>
										</PopoverContent>
									</Popover>
								</div>
								<CardDescription>Perpetual futures and leverage metrics</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{/* Funding Rate */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Zap className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium">Funding Rate</span>
											</div>
											<Badge
												variant={derivativesData.fundingRate >= 0 ? "default" : "destructive"}
												className="font-mono"
											>
												{derivativesData.fundingRate >= 0 ? "+" : ""}
												{(derivativesData.fundingRate * 100).toFixed(4)}%
											</Badge>
										</div>
										<div className="grid grid-cols-2 gap-3 text-sm">
											<div>
												<p className="text-muted-foreground">Interval</p>
												<p className="font-mono">{derivativesData.fundingInterval}</p>
											</div>
											<div>
												<p className="text-muted-foreground">Next Funding</p>
												<p className="font-mono">{derivativesData.nextFunding}</p>
											</div>
										</div>
									</div>

									{/* Open Interest */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Activity className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium">Open Interest</span>
											</div>
											<div className="text-right">
												<p className="font-mono">
													{formatLargeNumber(derivativesData.openInterest)}
												</p>
												<p
													className={`text-xs ${derivativesData.openInterestChange24h >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{derivativesData.openInterestChange24h >= 0 ? "+" : ""}
													{derivativesData.openInterestChange24h.toFixed(2)}% 24h
												</p>
											</div>
										</div>
									</div>

									{/* Long/Short Ratio */}
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<ArrowUpDown className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-medium">Long/Short Ratio</span>
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
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				{/* Right Column - On-chain, Peers, News */}
				<div className="space-y-6">
					{/* Performance */}
					<Card>
						<CardHeader>
							<CardTitle>Returns</CardTitle>
						</CardHeader>
						<CardContent>
							<Tabs defaultValue="absolute">
								<TabsList className="grid w-full grid-cols-3 mb-4">
									<TabsTrigger value="absolute" className="text-xs">
										Abs.
									</TabsTrigger>
									<TabsTrigger value="vsBTC" className="text-xs">
										vs BTC
									</TabsTrigger>
									<TabsTrigger value="vsETH" className="text-xs">
										vs ETH
									</TabsTrigger>
								</TabsList>

								<TabsContent value="absolute" className="space-y-1">
									{performancePeriods.map((period) => (
										<div
											key={period.label}
											className="flex justify-between items-center p-2 rounded hover:bg-muted/50"
										>
											<span className="text-xs text-muted-foreground">{period.label}</span>
											<span
												className={`font-mono text-xs font-medium ${period.value >= 0 ? "text-emerald-500" : "text-rose-500"}`}
											>
												{period.value >= 0 ? "+" : ""}
												{period.value.toFixed(1)}%
											</span>
										</div>
									))}
								</TabsContent>
								{/* (vsBTC and vsETH contents simplified for brevity) */}
							</Tabs>
						</CardContent>
					</Card>

					{/* On-chain Snapshot */}
					{showOnChain && (
						<Card>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="text-base">On-chain</CardTitle>
									<Badge variant="outline" className="text-[10px]">
										{onChainData.coverage}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex justify-between items-center text-xs">
									<span className="text-muted-foreground">Active Addresses</span>
									<span className="font-mono">{formatNumber(onChainData.activeAddresses)}</span>
								</div>
								<div className="flex justify-between items-center text-xs">
									<span className="text-muted-foreground">Net Exchange Flow</span>
									<span
										className={`font-mono ${onChainData.netFlow24h < 0 ? "text-emerald-500" : "text-rose-500"}`}
									>
										{onChainData.netFlow24h} BTC
									</span>
								</div>
								<div className="flex justify-between items-center text-xs">
									<span className="text-muted-foreground">MVRV Ratio</span>
									<span className="font-mono font-medium">{onChainData.mvrv.toFixed(2)}</span>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Peer Cryptocurrencies */}
					<Card>
						<CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
							<CardTitle className="text-base">Similar Assets</CardTitle>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-[10px]"
								onClick={() => onNavigateToScreener?.({ category: cryptoData.category })}
							>
								View All
							</Button>
						</CardHeader>
						<CardContent className="space-y-2">
							{peerCryptos.map((crypto) => (
								<div
									key={crypto.symbol}
									className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/40"
								>
									<div className="flex items-center gap-2">
										<div className="font-bold text-xs">{crypto.symbol}</div>
										<span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
											{crypto.name}
										</span>
									</div>
									<div className="text-right">
										<p className="font-mono text-xs">{formatCurrency(crypto.price)}</p>
										<p
											className={`text-[10px] ${crypto.change >= 0 ? "text-emerald-500" : "text-rose-500"}`}
										>
											{crypto.change >= 0 ? "+" : ""}
											{crypto.change.toFixed(2)}%
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
