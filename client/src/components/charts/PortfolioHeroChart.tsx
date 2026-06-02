import ReactECharts from "echarts-for-react";
import { Activity, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

import { useCurrency } from "@/hooks/use-currency";
import { useMarketData } from "@/hooks/useMarketData";
import { getChartThemeColors } from "@/lib/chart-colors";
import { useChartTheme } from "@/lib/charts/config";

export type TimeRange = "1D" | "7D" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export type BenchmarkMode = "none" | "sp500" | "nasdaq" | "btc";

export interface PerformancePoint {
	date: Date;
	portfolioValue: number;
	benchmarkValue: number;
}

export interface PortfolioHeroChartProps {
	data: PerformancePoint[];
	totalEquity: number;
	formatCurrency: (value: number) => string;
	timeRange: TimeRange;
	loading?: boolean;
	error?: string;
	benchmarkMode?: BenchmarkMode;
}

export function filterByRange(data: PerformancePoint[], range: TimeRange): PerformancePoint[] {
	if (data.length === 0) return [];
	if (range === "ALL") return data;

	const now = new Date();
	let rangeStart = new Date(data[0].date);

	switch (range) {
		case "1D":
			rangeStart = new Date(now);
			rangeStart.setDate(now.getDate() - 1);
			break;
		case "7D":
			rangeStart = new Date(now);
			rangeStart.setDate(now.getDate() - 7);
			break;
		case "1M":
			rangeStart = new Date(now);
			rangeStart.setMonth(now.getMonth() - 1);
			break;
		case "3M":
			rangeStart = new Date(now);
			rangeStart.setMonth(now.getMonth() - 3);
			break;
		case "YTD":
			rangeStart = new Date(now.getFullYear(), 0, 1);
			break;
		case "1Y":
			rangeStart = new Date(now);
			rangeStart.setFullYear(now.getFullYear() - 1);
			break;
	}

	const filtered = data.filter((point) => point.date >= rangeStart);
	if (filtered.length >= 2) return filtered;

	if (range === "1D") {
		return data.slice(-Math.min(12, data.length));
	}

	return data.slice(-Math.min(30, data.length));
}

export function buildBenchmarkSeries(data: PerformancePoint[], mode: BenchmarkMode): number[] {
	if (mode === "none") return [];
	if (data.length === 0) return [];

	const first = data[0]?.portfolioValue || 0;
	const last = data[data.length - 1]?.portfolioValue || first;
	if (first <= 0) return data.map((point) => point.benchmarkValue);

	const portfolioReturn = (last - first) / first;
	const benchmarkMultiplier = mode === "sp500" ? 0.78 : mode === "nasdaq" ? 1.08 : 2.45;
	const benchmarkReturn = portfolioReturn * benchmarkMultiplier;

	// biome-ignore lint/correctness/noUnusedFunctionParameters: unavoidable
	return data.map((point, index) => {
		const progress = data.length > 1 ? index / (data.length - 1) : 1;
		return first * (1 + benchmarkReturn * progress);
	});
}

export function PortfolioHeroChart({
	data,
	// biome-ignore lint/correctness/noUnusedFunctionParameters: required by props
	totalEquity,
	formatCurrency,
	timeRange,
	loading = false,
	error,
	benchmarkMode = "none",
}: PortfolioHeroChartProps) {
	const { echarts: echartsTheme } = useChartTheme();
	const { currency } = useCurrency();
	const themeColors = getChartThemeColors();
	const filteredData = useMemo(() => filterByRange(data, timeRange), [data, timeRange]);
	const axisDateFormat = useMemo(() => {
		if (timeRange === "ALL" || filteredData.length > 365) return "year";
		if (timeRange === "1Y" || filteredData.length > 90) return "month";
		if (timeRange === "1D") return "hour";
		return "day";
	}, [filteredData.length, timeRange]);
	const benchmarkName =
		benchmarkMode === "sp500"
			? "S&P 500"
			: benchmarkMode === "nasdaq"
				? "NASDAQ 100"
				: benchmarkMode === "btc"
					? "Bitcoin (BTC)"
					: "Benchmark";
	const benchmarkInstrumentId = useMemo(() => {
		if (benchmarkMode === "sp500") return "09e5fd78-d152-40af-a326-e220f1662a09";
		if (benchmarkMode === "nasdaq") return "01cfacbf-0e5f-4702-b128-062b45ecf73a";
		if (benchmarkMode === "btc") return "245a988b-8073-44a1-bb7e-5ecde9c1dad8";
		return undefined;
	}, [benchmarkMode]);

	const benchmarkFromDate = useMemo(() => {
		if (filteredData.length === 0) return new Date();
		// Subtract 5 days to handle weekend gaps or holidays at the start of the range
		return new Date(filteredData[0].date.getTime() - 5 * 24 * 60 * 60 * 1000);
	}, [filteredData]);

	const benchmarkToDate = useMemo(() => {
		if (filteredData.length === 0) return new Date();
		return filteredData[filteredData.length - 1].date;
	}, [filteredData]);

	const { data: marketCandles } = useMarketData({
		instrumentId: benchmarkInstrumentId,
		interval: "1D",
		from: benchmarkFromDate,
		to: benchmarkToDate,
	});

	const benchmarkData = useMemo(() => {
		if (
			benchmarkMode === "none" ||
			filteredData.length === 0 ||
			!marketCandles ||
			marketCandles.length === 0
		) {
			return [];
		}

		// Sort candles by timestamp
		const sortedCandles = [...marketCandles]
			.map((c) => ({
				date: new Date(c.timestamp),
				close: c.close,
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime());

		if (sortedCandles.length === 0) return [];

		// Align to portfolio snapshots by selecting the closest candle on or before the portfolio date
		const alignedCloses: number[] = [];
		for (const point of filteredData) {
			const targetTime = point.date.getTime();
			let bestClose = sortedCandles[0].close;
			let closestDiff = Number.MAX_VALUE;

			for (const candle of sortedCandles) {
				const candleTime = candle.date.getTime();
				const diff = targetTime - candleTime;

				if (diff >= 0) {
					if (diff < closestDiff) {
						closestDiff = diff;
						bestClose = candle.close;
					}
				} else {
					break; // Candles are sorted, no need to keep checking future candles
				}
			}
			alignedCloses.push(bestClose);
		}

		// Normalize benchmark value relative to the first non-zero portfolio value
		const firstNonZeroIndex = filteredData.findIndex((p) => p.portfolioValue > 0);
		const baseIndex = firstNonZeroIndex >= 0 ? firstNonZeroIndex : 0;
		const basePortfolioValue = filteredData[baseIndex]?.portfolioValue || 0;
		const baseBenchmarkClose = alignedCloses[baseIndex] || 1;

		return alignedCloses.map((close, i) => {
			if (baseBenchmarkClose === 0) return 0;
			if (i < baseIndex) return filteredData[i].portfolioValue;
			return basePortfolioValue * (close / baseBenchmarkClose);
		});
	}, [benchmarkMode, filteredData, marketCandles]);

	const isUp = useMemo(() => {
		return filteredData.length >= 2
			? filteredData[filteredData.length - 1].portfolioValue >= filteredData[0].portfolioValue
			: true;
	}, [filteredData]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
	const chartOption = useMemo(() => {
		const portfolioSeries = filteredData.map((point) => [
			point.date.getTime(),
			point.portfolioValue,
		]);
		const benchmarkSeries = filteredData.map((point, index) => [
			point.date.getTime(),
			benchmarkData[index] ?? null,
		]);

		const primaryColor = isUp ? "#10b981" : "#ef4444";
		const primaryColorRgb = isUp ? "16, 185, 129" : "239, 68, 68";

		return {
			animation: true,
			animationDuration: 500,
			animationEasing: "cubicOut",
			backgroundColor: "transparent",
			tooltip: {
				trigger: "axis",
				backgroundColor: "rgba(17, 24, 39, 0.65)", // Dark translucent
				borderColor: "rgba(255, 255, 255, 0.15)",
				borderWidth: 1,
				borderRadius: 16,
				padding: 0,
				textStyle: { color: "#fff", fontSize: 13, fontFamily: "inherit" },
				extraCssText:
					"backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); overflow: hidden;",
				// biome-ignore lint/suspicious/noExplicitAny: echarts injects any
				formatter: (params: any) => {
					if (!params?.length) return "";
					const date = new Date(params[0].value[0]);
					const formattedDate =
						date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
						(axisDateFormat === "hour"
							? ` ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
							: "");

					let html = `<div style="padding: 12px 16px; min-width: 180px;">`;
					html += `<div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 12px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">${formattedDate}</div>`;

					// biome-ignore lint/suspicious/noExplicitAny: echarts injects any
					params.forEach((param: any) => {
						const color = param.color;
						const val = param.value[1];
						const formattedVal = formatCurrency(val);
						const isPortfolio = param.seriesName === "Portfolio";

						html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
						html += `<div style="display: flex; align-items: center; gap: 8px;">`;
						html += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; box-shadow: 0 0 8px ${color}80;"></span>`;
						html += `<span style="font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.8);">${param.seriesName}</span>`;
						html += `</div>`;
						html += `<span style="font-size: 13px; font-weight: ${isPortfolio ? "600" : "500"}; color: #fff; font-variant-numeric: tabular-nums;">${formattedVal}</span>`;
						html += `</div>`;
					});

					html += `</div>`;
					return html;
				},
				axisPointer: {
					type: "line",
					lineStyle: { color: themeColors.mutedForeground, width: 1, type: "dashed", opacity: 0.4 },
				},
			},
			grid: {
				left: 10,
				right: 60,
				top: 10,
				bottom: 40,
				containLabel: false,
			},
			dataZoom: [
				{
					type: "inside",
					start: 0,
					end: 100,
				},
			],
			xAxis: {
				type: "time",
				boundaryGap: false,
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: {
					color: themeColors.mutedForeground,
					fontSize: 10,
					hideOverlap: true,
					margin: 12,
					formatter: (value: number) => {
						const date = new Date(value);
						if (axisDateFormat === "year") {
							return date.toLocaleDateString("en-US", { year: "2-digit" });
						}
						if (axisDateFormat === "month") {
							return date.toLocaleDateString("en-US", {
								month: "short",
								year: "2-digit",
							});
						}
						if (axisDateFormat === "hour") {
							return date.toLocaleTimeString("en-US", {
								hour: "numeric",
								minute: "2-digit",
							});
						}
						return date.toLocaleDateString("en-US", {
							month: "numeric",
							day: "numeric",
						});
					},
				},
			},
			yAxis: {
				type: "value",
				scale: true,
				position: "right",
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: {
					show: true,
					lineStyle: {
						color: "rgba(255, 255, 255, 0.025)",
						type: "dashed",
					},
				},
				axisLabel: {
					color: themeColors.mutedForeground,
					fontSize: 10,
					inside: false,
					margin: 8,
					formatter: (value: number) =>
						new Intl.NumberFormat("en-US", {
							style: "currency",
							currency,
							notation: "compact",
							maximumFractionDigits: 1,
						}).format(value),
				},
			},
			series: [
				{
					name: "Portfolio",
					type: "line",
					smooth: 0.15,
					showSymbol: false,
					lineStyle: {
						color: primaryColor,
						width: 1.8,
						shadowBlur: 6,
						shadowColor: `rgba(${primaryColorRgb}, 0.25)`,
					},
					sampling: "lttb",
					areaStyle: {
						color: {
							type: "linear",
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: `rgba(${primaryColorRgb}, 0.08)` },
								{ offset: 1, color: `rgba(${primaryColorRgb}, 0.0)` },
							],
						},
					},
					data: portfolioSeries,
				},
				...(benchmarkMode !== "none" && benchmarkData.length > 0
					? [
							{
								name: benchmarkName,
								type: "line",
								smooth: 0.15,
								showSymbol: false,
								sampling: "lttb",
								lineStyle: {
									color:
										benchmarkMode === "sp500"
											? "#a78bfa"
											: benchmarkMode === "nasdaq"
												? "#3b82f6"
												: "#f7931a", // btc gets orange
									width: 1.2,
									type: "dashed",
									opacity: 0.5,
								},
								data: benchmarkSeries,
							},
						]
					: []),
			],
		};
	}, [
		axisDateFormat,
		benchmarkData,
		benchmarkMode,
		benchmarkName,
		filteredData,
		formatCurrency,
		echartsTheme,
		themeColors,
		currency,
		isUp,
	]);

	if (error) {
		return (
			<Card className="relative overflow-hidden border-border/60 bg-transparent shadow-none h-full w-full min-h-[300px]">
				<CardContent className="flex h-full items-center justify-center p-4">
					<div className="text-center space-y-2">
						<AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
						<p className="text-sm text-muted-foreground">{error}</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (loading) {
		return (
			<Card className="relative overflow-hidden border-border/60 bg-transparent shadow-none h-full w-full min-h-[300px]">
				<CardContent className="flex h-full items-center justify-center p-4">
					<div className="flex flex-col items-center gap-3">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
						<p className="text-xs text-muted-foreground">Loading chart data…</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (data.length === 0) {
		return (
			<Card className="relative overflow-hidden border-border/60 bg-transparent shadow-none h-full w-full min-h-[300px]">
				<CardContent className="flex h-full items-center justify-center p-4">
					<div className="text-center space-y-2">
						<Activity className="mx-auto h-8 w-8 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">No performance data yet</p>
						<p className="text-xs text-muted-foreground">
							Add positions to build your performance chart.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="w-full h-full relative">
			<ReactECharts
				option={chartOption}
				notMerge={true}
				lazyUpdate={true}
				style={{ height: "100%", width: "100%" }}
				opts={{ renderer: "canvas" }}
			/>
		</div>
	);
}
