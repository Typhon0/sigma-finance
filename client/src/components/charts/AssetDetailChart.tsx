import ReactECharts from "echarts-for-react";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/hooks/use-currency";
import { getChartThemeColors } from "@/lib/chart-colors";
import { useChartTheme } from "@/lib/charts/config";

export type ChartType = "candlestick" | "line" | "area";
export type Indicator = "ma" | "rsi" | "macd" | "bollinger";

export interface AssetDetailChartPoint {
	date: string;
	open?: number;
	close: number;
	low?: number;
	high?: number;
	volume?: number;
}

interface AssetDetailChartProps {
	data: AssetDetailChartPoint[];
	symbol: string;
	title?: string;
	height?: number | string;
	className?: string;
	initialChartType?: ChartType;
	showIndicators?: boolean;
	showTypeSelector?: boolean;
	timeRange?: string;
}

export function AssetDetailChart({
	data,
	symbol,
	height = 450,
	className,
	initialChartType = "candlestick",
	showIndicators = true,
	showTypeSelector = true,
	timeRange,
}: AssetDetailChartProps) {
	const [chartType, setChartType] = useState<ChartType>(initialChartType);
	const [activeIndicators, setActiveIndicators] = useState<Indicator[]>(["ma"]);
	const { echarts: echartsTheme } = useChartTheme();
	const themeColors = getChartThemeColors();
	const { formatCurrency } = useCurrency();

	const hasOHLC = useMemo(
		() => data.some((p) => p.open !== undefined && p.high !== undefined && p.low !== undefined),
		[data],
	);

	// Fallback to line if no OHLC data provided but candlestick requested
	const effectiveChartType = chartType === "candlestick" && !hasOHLC ? "line" : chartType;

	const calculateMa = (period: number) => {
		const ma: (number | null)[] = [];
		for (let i = 0; i < data.length; i++) {
			if (i < period - 1) ma.push(null);
			else {
				let sum = 0;
				for (let j = 0; j < period; j++) sum += data[i - j].close;
				ma.push(sum / period);
			}
		}
		return ma;
	};

	const chartOption = useMemo(() => {
		const dates = data.map((d) => d.date);
		const values = data.map((d) => [
			d.open ?? d.close,
			d.close,
			d.low ?? d.close,
			d.high ?? d.close,
		]);
		const closePrices = data.map((d) => d.close);
		const volumes = data.map((d) => d.volume ?? 0);

		const isShortTimeframe =
			timeRange && ["24h", "24H", "1d", "1D", "2D", "5D", "7D"].includes(timeRange);

		const isUp =
			closePrices.length > 0 ? closePrices[closePrices.length - 1] >= closePrices[0] : true;
		const primaryColor = isUp ? "#10b981" : "#ef4444";
		const primaryColorRgb = isUp ? "16, 185, 129" : "239, 68, 68";

		return {
			animation: true,
			animationDuration: 500,
			animationEasing: "cubicOut",
			backgroundColor: "transparent",
			legend: {
				top: 0,
				left: "left",
				textStyle: { color: themeColors.mutedForeground, fontSize: 10 },
				show: false, // Cleaner look without legend
			},
			tooltip: {
				trigger: "axis",
				axisPointer: {
					type: "line",
					lineStyle: { color: themeColors.mutedForeground, width: 1, type: "dashed", opacity: 0.4 },
				},
				backgroundColor: "rgba(0, 0, 0, 0.85)",
				borderColor: "transparent",
				padding: [8, 12],
				textStyle: { color: "#fff", fontSize: 12, fontWeight: 500, fontFamily: "inherit" },
				valueFormatter: (value: number) => formatCurrency(value),
			},
			grid: [
				{ left: 10, right: 60, top: 20, height: "65%", containLabel: false },
				{ left: 10, right: 60, top: "85%", height: "10%", containLabel: false },
			],
			xAxis: [
				{
					type: "category",
					data: dates,
					boundaryGap: effectiveChartType === "candlestick",
					axisLine: { show: false },
					axisTick: { show: false },
					splitLine: { show: false },
					axisLabel: {
						color: themeColors.mutedForeground,
						fontSize: 10,
						margin: 12,
						formatter: (value: string) => {
							try {
								const date = new Date(value);
								if (isNaN(date.getTime())) return value;

								if (isShortTimeframe) {
									return date.toLocaleTimeString("en-US", {
										hour: "numeric",
										minute: "2-digit",
									});
								}

								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							} catch (e) {
								return value;
							}
						},
					},
				},
				{
					type: "category",
					gridIndex: 1,
					data: dates,
					show: false,
				},
			],
			yAxis: [
				{
					scale: true,
					position: "right",
					splitLine: { show: false },
					axisLabel: {
						formatter: (val: number) => formatCurrency(val),
						color: themeColors.mutedForeground,
						fontSize: 10,
						inside: false,
						margin: 8,
					},
					axisTick: { show: false },
					axisLine: { show: false },
				},
				{ scale: true, gridIndex: 1, show: false },
			],
			dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 }],
			series: [
				...(effectiveChartType === "candlestick"
					? [
							{
								name: symbol,
								type: "candlestick",
								data: values,
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
								name: symbol,
								type: "line",
								data: closePrices,
								smooth: 0.2, // Smoother curve
								lineStyle: { width: 1.5, color: primaryColor },
								areaStyle:
									effectiveChartType === "area"
										? {
												color: {
													type: "linear",
													x: 0,
													y: 0,
													x2: 0,
													y2: 1,
													colorStops: [
														{ offset: 0, color: `rgba(${primaryColorRgb}, 0.25)` },
														{ offset: 1, color: `rgba(${primaryColorRgb}, 0.0)` },
													],
												},
											}
										: undefined,
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
								lineStyle: { width: 1, color: "#3b82f6", opacity: 0.7, type: "dashed" },
								showSymbol: false,
							},
							{
								name: "MA50",
								type: "line",
								data: calculateMa(50),
								smooth: true,
								lineStyle: { width: 1, color: "#f59e0b", opacity: 0.7, type: "dashed" },
								showSymbol: false,
							},
						]
					: []),
				{
					name: "Volume",
					type: "bar",
					xAxisIndex: 1,
					yAxisIndex: 1,
					data: volumes.map((v, i) => ({
						value: v,
						itemStyle: {
							color: i > 0 && closePrices[i] > closePrices[i - 1] ? "#10b981" : "#ef4444",
							opacity: 0.3, // Make volume less prominent
						},
					})),
				},
			],
		};
	}, [
		data,
		symbol,
		effectiveChartType,
		activeIndicators,
		echartsTheme,
		themeColors,
		formatCurrency,
		timeRange,
	]);

	return (
		<Card className={`border-border/40 shadow-none bg-card/40 ${className}`}>
			<div className="flex items-center justify-end p-2 border-b border-border/40 bg-muted/5 gap-2">
				{showTypeSelector && (
					<Select value={chartType} onValueChange={(v: ChartType) => setChartType(v)}>
						<SelectTrigger className="h-7 w-[110px] text-[10px] border-border/40 bg-transparent">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="candlestick">Candlestick</SelectItem>
							<SelectItem value="line">Line</SelectItem>
							<SelectItem value="area">Area</SelectItem>
						</SelectContent>
					</Select>
				)}

				{showIndicators && (
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
									<Label htmlFor="ma" className="text-xs font-normal">
										Moving Averages (20, 50)
									</Label>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				)}
			</div>
			<CardContent className="p-0" style={{ height }}>
				<ReactECharts
					option={chartOption}
					style={{ height: "100%", width: "100%" }}
					opts={{ renderer: "svg" }}
				/>
			</CardContent>
		</Card>
	);
}
