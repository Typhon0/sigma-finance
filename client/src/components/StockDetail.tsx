import ReactECharts from "echarts-for-react";
import {
	ArrowLeft,
	BarChart3,
	Bell,
	ExternalLink,
	Star,
	TrendingDown,
	TrendingUp,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface StockDetailProps {
	symbol: string;
	onBack?: () => void;
	onNavigateToScreener?: (filters: any) => void;
}

type TimeRange = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "MAX";
type ChartType = "candlestick" | "line" | "area";
type Indicator = "ma" | "rsi" | "macd" | "bollinger";

export function StockDetail({
	symbol,
	onBack,
	onNavigateToScreener: _onNavigateToScreener,
}: StockDetailProps) {
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");
	const [chartType, setChartType] = useState<ChartType>("candlestick");
	const [activeIndicators, setActiveIndicators] = useState<Indicator[]>(["ma"]);

	// Mock stock data
	const stockData = {
		symbol: symbol,
		name: "Apple Inc.",
		exchange: "NASDAQ",
		price: 192.53,
		change: 2.37,
		changePercent: 1.25,
		open: 190.16,
		high: 193.24,
		low: 189.85,
		close: 192.53,
		previousClose: 190.16,
		bid: 192.52,
		ask: 192.54,
		bidSize: 800,
		askSize: 1200,
		dayRange: { low: 189.85, high: 193.24 },
		week52Range: { low: 164.08, high: 199.62 },
		volume: 52340000,
		avgVolume: 58200000,
		marketCap: 3000000000000,
		beta: 1.24,
		pe: 31.2,
		eps: 6.17,
		dividendYield: 0.5,
		targetPrice: 205.0,
		sector: "Technology",
		industry: "Consumer Electronics",
	};

	// Generate candlestick data
	const generateCandlestickData = (): {
		date: string;
		values: number[];
		volume: number;
	}[] => {
		const days =
			timeRange === "1D"
				? 1
				: timeRange === "5D"
					? 5
					: timeRange === "1M"
						? 30
						: timeRange === "3M"
							? 90
							: timeRange === "6M"
								? 180
								: timeRange === "1Y"
									? 365
									: 730;
		const data: { date: string; values: number[]; volume: number }[] = [];
		let currentPrice = stockData.price - Math.random() * 20;

		for (let i = days; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			const open = currentPrice;
			const close = currentPrice + (Math.random() - 0.5) * 5;
			const high = Math.max(open, close) + Math.random() * 2;
			const low = Math.min(open, close) - Math.random() * 2;
			const volume = Math.floor((Math.random() * 0.5 + 0.75) * stockData.avgVolume);

			data.push({
				date: date.toISOString().split("T")[0],
				values: [open, close, low, high],
				volume: volume,
			});
			currentPrice = close;
		}
		return data;
	};

	const candlestickData = useMemo(() => generateCandlestickData(), [generateCandlestickData]);

	const calculateMa = (period: number) => {
		const ma: (number | null)[] = [];
		for (let i = 0; i < candlestickData.length; i++) {
			if (i < period - 1) ma.push(null);
			else {
				let sum = 0;
				for (let j = 0; j < period; j++) sum += candlestickData[i - j].values[1];
				ma.push(sum / period);
			}
		}
		return ma;
	};

	// Chart options
	const mainChartOption = {
		animation: false,
		legend: {
			top: 0,
			left: "left",
			textStyle: { color: "#888", fontSize: 10 },
		},
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "cross" },
			backgroundColor: "rgba(0,0,0,0.8)",
			borderColor: "#333",
			textStyle: { color: "#fff", fontSize: 12, fontFamily: "monospace" },
		},
		grid: [
			{ left: 40, right: 40, top: 30, height: "60%" },
			{ left: 40, right: 40, top: "78%", height: "15%" },
		],
		xAxis: [
			{
				type: "category",
				data: candlestickData.map((d) => d.date),
				boundaryGap: true,
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false },
			},
			{
				type: "category",
				gridIndex: 1,
				data: candlestickData.map((d) => d.date),
				show: false,
			},
		],
		yAxis: [
			{
				scale: true,
				splitLine: { lineStyle: { color: "#333" } },
				axisLabel: {
					formatter: (val: number) => val.toFixed(0),
					color: "#666",
					fontSize: 10,
				},
			},
			{ scale: true, gridIndex: 1, show: false },
		],
		dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 }],
		series: [
			...(chartType === "candlestick"
				? [
						{
							name: stockData.symbol,
							type: "candlestick",
							data: candlestickData.map((d) => d.values),
							itemStyle: {
								color: "#10b981",
								color0: "#ef4444",
								borderColor: "#10b981",
								borderColor0: "#ef4444",
							},
						},
					]
				: [
						{
							name: stockData.symbol,
							type: "line",
							data: candlestickData.map((d) => d.values[1]),
							smooth: true,
							lineStyle: { width: 2, color: "#10b981" },
							areaStyle: {
								color: {
									type: "linear",
									x: 0,
									y: 0,
									x2: 0,
									y2: 1,
									colorStops: [
										{ offset: 0, color: "rgba(16, 185, 129, 0.2)" },
										{ offset: 1, color: "rgba(16, 185, 129, 0)" },
									],
								},
							},
							showSymbol: false,
						},
					]),
			...(activeIndicators.includes("ma")
				? [
						{
							name: "MA20",
							type: "line",
							data: calculateMa(20),
							smooth: true,
							lineStyle: { width: 1, color: "#3b82f6" },
							showSymbol: false,
						},
						{
							name: "MA50",
							type: "line",
							data: calculateMa(50),
							smooth: true,
							lineStyle: { width: 1, color: "#f59e0b" },
							showSymbol: false,
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
						color: i > 0 && d.values[1] > candlestickData[i - 1].values[1] ? "#10b981" : "#ef4444",
					},
				})),
			},
		],
	};

	const { formatCurrency, currencySymbol } = useCurrency();
	const formatLargeNumber = (num: number) =>
		num >= 1e12
			? `${currencySymbol}${(num / 1e12).toFixed(2)}T`
			: num >= 1e9
				? `${currencySymbol}${(num / 1e9).toFixed(2)}B`
				: num >= 1e6
					? `${currencySymbol}${(num / 1e6).toFixed(2)}M`
					: formatCurrency(num);

	return (
		<div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
							<h1 className="text-2xl font-bold tracking-tight">{stockData.symbol}</h1>
							<span className="text-sm text-muted-foreground">{stockData.name}</span>
							<Badge variant="outline" className="text-[10px] h-5 border-border/50 font-normal">
								{stockData.exchange}
							</Badge>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button size="sm" variant="outline" className="h-8 text-xs">
							<Star className="h-3.5 w-3.5 mr-2" /> Watch
						</Button>
						<Button size="sm" variant="outline" className="h-8 text-xs">
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
							{formatCurrency(stockData.price)}
						</span>
						<span
							className={cn(
								"text-lg font-mono font-medium flex items-center gap-1",
								stockData.change >= 0 ? "text-emerald-500" : "text-rose-500",
							)}
						>
							{stockData.change >= 0 ? (
								<TrendingUp className="h-5 w-5" />
							) : (
								<TrendingDown className="h-5 w-5" />
							)}
							{stockData.change >= 0 ? "+" : ""}
							{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
						</span>
					</div>
					<div className="flex gap-6 text-xs text-muted-foreground pb-1.5 font-mono">
						<div>
							<span className="opacity-50 mr-2">O</span>
							{formatCurrency(stockData.open)}
						</div>
						<div>
							<span className="opacity-50 mr-2">H</span>
							{formatCurrency(stockData.high)}
						</div>
						<div>
							<span className="opacity-50 mr-2">L</span>
							{formatCurrency(stockData.low)}
						</div>
						<div>
							<span className="opacity-50 mr-2">Vol</span>
							{(stockData.volume / 1e6).toFixed(2)}M
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				{/* Main Chart Section */}
				<Card className="lg:col-span-2 border-border/40 shadow-none bg-card/40">
					<div className="flex items-center justify-between p-2 border-b border-border/40 bg-muted/5">
						<div className="flex items-center gap-1">
							{(["1D", "1M", "3M", "YTD", "1Y", "MAX"] as const).map((r) => (
								<Button
									key={r}
									variant={timeRange === r ? "secondary" : "ghost"}
									size="sm"
									onClick={() => setTimeRange(r as any)}
									className="h-6 px-2.5 text-[10px] font-medium"
								>
									{r}
								</Button>
							))}
						</div>
						<div className="flex items-center gap-2">
							<Select value={chartType} onValueChange={(v: any) => setChartType(v)}>
								<SelectTrigger className="h-6 w-[100px] text-[10px] border-border/40 bg-transparent">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="candlestick">Candlestick</SelectItem>
									<SelectItem value="line">Line</SelectItem>
								</SelectContent>
							</Select>
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
										<BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-48 p-2" align="end">
									<div className="space-y-2">
										<Label className="text-xs font-medium">Indicators</Label>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="ma"
												checked={activeIndicators.includes("ma")}
												onCheckedChange={() =>
													setActiveIndicators((prev) =>
														prev.includes("ma") ? prev.filter((i) => i !== "ma") : [...prev, "ma"],
													)
												}
											/>
											<Label htmlFor="ma" className="text-xs">
												Moving Averages
											</Label>
										</div>
									</div>
								</PopoverContent>
							</Popover>
						</div>
					</div>
					<CardContent className="p-0 h-[450px]">
						<ReactECharts
							option={mainChartOption}
							style={{ height: "100%", width: "100%" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				{/* Key Stats Sidebar */}
				<div className="space-y-4">
					{/* Fundamentals Card */}
					<Card className="border-border/40 shadow-none bg-card/40">
						<div className="p-3 border-b border-border/40 bg-muted/5">
							<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Fundamentals
							</h3>
						</div>
						<CardContent className="p-0">
							<div className="divide-y divide-border/40">
								{[
									{
										l: "Market Cap",
										v: formatLargeNumber(stockData.marketCap),
									},
									{ l: "P/E Ratio", v: stockData.pe.toFixed(2) },
									{ l: "Beta", v: stockData.beta.toFixed(2) },
									{
										l: "Div Yield",
										v: `${stockData.dividendYield.toFixed(2)}%`,
									},
									{ l: "EPS (TTM)", v: `$${stockData.eps}` },
									{
										l: "Target Price",
										v: formatCurrency(stockData.targetPrice),
									},
									{
										l: "52W High",
										v: formatCurrency(stockData.week52Range.high),
									},
									{
										l: "52W Low",
										v: formatCurrency(stockData.week52Range.low),
									},
								].map((item, i) => (
									<div key={i} className="flex items-center justify-between p-3 text-xs">
										<span className="text-muted-foreground">{item.l}</span>
										<span className="font-mono font-medium">{item.v}</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* About / Profile */}
					<Card className="border-border/40 shadow-none bg-card/40">
						<div className="p-3 border-b border-border/40 bg-muted/5 flex justify-between items-center">
							<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Profile
							</h3>
							<ExternalLink className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" />
						</div>
						<CardContent className="p-3 text-xs text-muted-foreground leading-relaxed">
							<p>{stockData.industry}</p>
							<p className="mt-1">
								Apple Inc. designs, manufactures, and markets smartphones, personal computers,
								tablets, wearables, and accessories worldwide.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
