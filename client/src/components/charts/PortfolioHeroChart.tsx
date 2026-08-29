import ReactECharts from "echarts-for-react";
import { Activity, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { BenchmarkMetricsBar } from "@/components/charts/BenchmarkMetricsBar";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";
import { type BenchmarkMode, useBenchmarkInstrumentId } from "@/hooks/useBenchmarkInstrumentId";
import { useMarketData } from "@/hooks/useMarketData";
import { getChartThemeColors } from "@/lib/chart-colors";
import { useChartTheme } from "@/lib/charts/config";

export type TimeRange = "1D" | "7D" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export type { BenchmarkMode } from "@/hooks/useBenchmarkInstrumentId";
// Re-export BenchmarkMode for backward compatibility

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
	/** The current portfolio ID, required for benchmark comparison metrics. */
	portfolioID?: string;
}

function interpolatePoint(
	p1: PerformancePoint,
	p2: PerformancePoint,
	targetDate: Date,
): PerformancePoint {
	const t1 = p1.date.getTime();
	const t2 = p2.date.getTime();
	if (t2 <= t1) {
		return {
			date: targetDate,
			portfolioValue: p2.portfolioValue,
			benchmarkValue: p2.benchmarkValue,
		};
	}
	const ratio = Math.max(0, Math.min(1, (targetDate.getTime() - t1) / (t2 - t1)));
	return {
		date: targetDate,
		portfolioValue: Number(
			(p1.portfolioValue + (p2.portfolioValue - p1.portfolioValue) * ratio).toFixed(2),
		),
		benchmarkValue: Number(
			(p1.benchmarkValue + (p2.benchmarkValue - p1.benchmarkValue) * ratio).toFixed(2),
		),
	};
}

export function filterByRange(data: PerformancePoint[], range: TimeRange): PerformancePoint[] {
	if (data.length === 0) return [];
	if (range === "ALL") return data;

	const now = new Date();
	let rangeStart = new Date(data[0].date);

	switch (range) {
		case "1D":
			rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			break;
		case "7D":
			rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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

	// If fewer than 2 points fall in range, interpolate a clean start anchor at rangeStart
	const latestPoint = data[data.length - 1];
	const priorPoints = data.filter((point) => point.date < rangeStart);
	const prevPoint = priorPoints.length > 0 ? priorPoints[priorPoints.length - 1] : data[0];
	const nextPoint = filtered.length > 0 ? filtered[0] : latestPoint;

	const anchorPoint = interpolatePoint(prevPoint, nextPoint, rangeStart);

	if (filtered.length === 1) {
		return [anchorPoint, filtered[0]];
	}

	// 0 points in range (all data is older or future)
	return [
		anchorPoint,
		{
			date: now,
			portfolioValue: latestPoint.portfolioValue,
			benchmarkValue: latestPoint.benchmarkValue,
		},
	];
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
	portfolioID,
}: PortfolioHeroChartProps) {
	const { echarts: echartsTheme } = useChartTheme();
	const { currency } = useCurrency();
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
	const { id: benchmarkInstrumentId, loading: instrumentLoading } =
		useBenchmarkInstrumentId(benchmarkMode);

	const marketDataInterval = useMemo(() => {
		if (timeRange === "1D" || timeRange === "7D") return "15m";
		return "1D";
	}, [timeRange]);

	// Dynamic candle limit so all timeframes and asset classes (including 24/7 crypto)
	// fetch sufficient candles without cutting off prematurely.
	const candleLimit = useMemo(() => {
		if (filteredData.length < 2) return 100;
		const spanDays = Math.max(
			1,
			Math.ceil(
				(filteredData[filteredData.length - 1].date.getTime() - filteredData[0].date.getTime()) /
					(1000 * 60 * 60 * 24),
			),
		);
		if (marketDataInterval === "15m") {
			return Math.max(100, spanDays * 96 + 50);
		}
		// Crypto trades 365 days/year (stocks ~252 days/year).
		// Use spanDays + 30 buffer so crypto never exhausts its candle budget mid-range.
		return Math.max(100, spanDays + 30);
	}, [filteredData, marketDataInterval]);

	const benchmarkFromDate = useMemo(() => {
		if (filteredData.length === 0) return undefined;
		// Subtract 5 days to handle weekend gaps or holidays at the start of the range
		return new Date(filteredData[0].date.getTime() - 5 * 24 * 60 * 60 * 1000);
	}, [filteredData]);

	const benchmarkToDate = useMemo(() => {
		if (filteredData.length === 0) return undefined;
		return filteredData[filteredData.length - 1].date;
	}, [filteredData]);

	const canFetchBenchmark = benchmarkInstrumentId && filteredData.length > 0;

	const { data: marketCandles, loading: benchmarkLoading } = useMarketData({
		instrumentId: canFetchBenchmark ? benchmarkInstrumentId : undefined,
		interval: marketDataInterval,
		from: benchmarkFromDate,
		to: benchmarkToDate,
		limit: candleLimit,
		chartOnly: true,
	});

	// -----------------------------------------------------------------------
	// Compute benchmark data from REAL candle data only.
	// No synthetic fallback — if real data is insufficient, show an error.
	// -----------------------------------------------------------------------
	const benchmarkData = useMemo(() => {
		if (benchmarkMode === "none" || filteredData.length === 0) {
			return [];
		}

		if (!marketCandles || marketCandles.length === 0) {
			return []; // still loading or query failed — error handled separately
		}

		const sortedCandles = [...marketCandles]
			.map((c) => ({
				date: new Date(c.timestamp),
				close: c.close,
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime());

		if (sortedCandles.length === 0) {
			return [];
		}

		const firstCandleTime = sortedCandles[0].date.getTime();

		// Two-pointer continuous sliding window alignment: O(n+m) instead of O(n*m).
		const alignedCloses: (number | null)[] = [];
		let candleIdx = 0;
		for (const point of filteredData) {
			const targetTime = point.date.getTime();
			if (targetTime <= firstCandleTime) {
				alignedCloses.push(sortedCandles[0].close);
				continue;
			}
			while (
				candleIdx + 1 < sortedCandles.length &&
				sortedCandles[candleIdx + 1].date.getTime() <= targetTime
			) {
				candleIdx++;
			}
			alignedCloses.push(sortedCandles[candleIdx].close);
		}

		// Start-anchor normalization: scale the benchmark so its value
		// matches the portfolio. If the portfolio started near zero (e.g. deposits made later in period),
		// scale against the latest/ending portfolio value to prevent benchmark being pinned to $0.
		let firstRealClose = 0;
		let firstPortfolioValue = 0;
		let lastRealClose = 0;
		for (let i = 0; i < alignedCloses.length; i++) {
			const c = alignedCloses[i];
			if (c !== null && c > 0) {
				if (firstRealClose === 0) {
					firstRealClose = c;
					firstPortfolioValue = filteredData[i]?.portfolioValue ?? 0;
				}
				lastRealClose = c;
			}
		}

		if (firstRealClose <= 0) return [];

		const latestPortfolioValue =
			filteredData[filteredData.length - 1]?.portfolioValue ?? totalEquity;

		const startsNearZero =
			firstPortfolioValue <= 0 ||
			(latestPortfolioValue > 0 && firstPortfolioValue < 0.1 * latestPortfolioValue);

		if (startsNearZero) {
			if (lastRealClose <= 0 || latestPortfolioValue <= 0) return [];
			return alignedCloses.map((close) => {
				if (close === null) return null;
				return latestPortfolioValue * (close / lastRealClose);
			});
		}

		return alignedCloses.map((close) => {
			if (close === null) return null;
			return firstPortfolioValue * (close / firstRealClose);
		});
	}, [benchmarkMode, filteredData, marketCandles, totalEquity]);

	// True when the benchmark instrument could not be found in the database
	// (search queries completed but returned no results).
	const benchmarkInstrumentMissing =
		benchmarkMode !== "none" && !instrumentLoading && !benchmarkInstrumentId;

	// True when a benchmark is selected, we have portfolio data, and the
	// instrument exists, but no real candle data is available to draw the
	// benchmark line (query completed, returned empty).
	// True when benchmarkData is empty OR all values are null (no real candle
	// coverage overlaps the current portfolio range at all).
	const benchmarkDataError =
		benchmarkMode !== "none" &&
		filteredData.length > 0 &&
		!instrumentLoading &&
		!benchmarkLoading &&
		benchmarkInstrumentId != null &&
		(benchmarkData.length === 0 || benchmarkData.every((v) => v === null));

	// Server‑side benchmark comparison metrics (handled by BenchmarkMetricsBar below).
	// Compute date range for the metrics bar.
	const metricsDateStart = useMemo(() => {
		if (filteredData.length === 0) return undefined;
		return filteredData[0].date.toISOString();
	}, [filteredData]);

	const metricsDateEnd = useMemo(() => {
		if (filteredData.length === 0) return undefined;
		return filteredData[filteredData.length - 1].date.toISOString();
	}, [filteredData]);

	// Faded line while real candles are still loading.
	const isBenchmarkLoading =
		benchmarkMode !== "none" &&
		filteredData.length > 0 &&
		benchmarkLoading &&
		benchmarkData.length === 0;

	const isUp = useMemo(() => {
		return filteredData.length >= 2
			? filteredData[filteredData.length - 1].portfolioValue >= filteredData[0].portfolioValue
			: true;
	}, [filteredData]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
	const chartOption = useMemo(() => {
		const themeColors = getChartThemeColors();
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
			animationDuration: 400,
			animationEasing: "cubicOut",
			animationDurationUpdate: 400,
			animationEasingUpdate: "cubicOut",
			animationThreshold: 8000,
			backgroundColor: "transparent",
			tooltip: {
				trigger: "axis",
				backgroundColor: "rgba(17, 24, 39, 0.65)",
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
						const val = param.value?.[1];
						if (val === null || val === undefined || Number.isNaN(val)) return;
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
					id: "portfolio-main-series",
					name: "Portfolio",
					type: "line",
					smooth: 0.25,
					showSymbol: false,
					lineStyle: {
						color: primaryColor,
						width: 1.8,
						shadowBlur: 6,
						shadowColor: `rgba(${primaryColorRgb}, 0.25)`,
					},
					sampling: "lttb",
					animationDurationUpdate: 600,
					animationEasingUpdate: "cubicInOut",
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
								id: "benchmark-comparison-series",
								name: benchmarkName,
								type: "line",
								smooth: 0.25,
								showSymbol: false,
								sampling: "lttb",
								z: 5,
								lineStyle: {
									color:
										benchmarkMode === "sp500"
											? "#a78bfa"
											: benchmarkMode === "nasdaq"
												? "#38bdf8"
												: "#f59e0b", // btc gets amber-orange
									width: 2.2,
									type: "solid",
									shadowBlur: 8,
									shadowColor:
										benchmarkMode === "sp500"
											? "rgba(167, 139, 250, 0.4)"
											: benchmarkMode === "nasdaq"
												? "rgba(56, 189, 248, 0.4)"
												: "rgba(245, 158, 11, 0.4)",
									opacity: isBenchmarkLoading ? 0.4 : 0.95,
								},
								animationDurationUpdate: 600,
								animationEasingUpdate: "cubicInOut",
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
		currency,
		isUp,
		isBenchmarkLoading,
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
		<div className="w-full h-full flex flex-col">
			<div className="relative flex-1 min-h-0">
				<ReactECharts
					option={chartOption}
					notMerge={true}
					lazyUpdate={false}
					style={{ height: "100%", width: "100%" }}
					opts={{ renderer: "canvas" }}
				/>
				{/* Sleek dynamic legend badge when benchmark comparison is active */}
				{benchmarkMode !== "none" && benchmarkData.length > 0 && (
					<div className="absolute top-1 left-2 z-10 flex items-center gap-2.5 rounded-full bg-background/80 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-md border border-border/40 shadow-xs">
						<div className="flex items-center gap-1.5">
							<span
								className={`inline-block h-1.5 w-1.5 rounded-full ${isUp ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"}`}
							/>
							<span className="text-foreground/90">Portfolio</span>
						</div>
						<div className="h-2 w-[1px] bg-border/50" />
						<div className="flex items-center gap-1.5">
							<span
								className="inline-block h-1.5 w-1.5 rounded-full"
								style={{
									backgroundColor:
										benchmarkMode === "sp500"
											? "#a78bfa"
											: benchmarkMode === "nasdaq"
												? "#38bdf8"
												: "#f59e0b",
									boxShadow:
										benchmarkMode === "sp500"
											? "0 0 6px rgba(167, 139, 250, 0.7)"
											: benchmarkMode === "nasdaq"
												? "0 0 6px rgba(56, 189, 248, 0.7)"
												: "0 0 6px rgba(245, 158, 11, 0.7)",
								}}
							/>
							<span className="text-muted-foreground">{benchmarkName}</span>
						</div>
					</div>
				)}
				{/* Benchmark instrument not found in database */}
				{benchmarkInstrumentMissing && (
					<div className="absolute bottom-1 left-3 right-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs z-10">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
						<span className="text-red-600 dark:text-red-400">
							{benchmarkName} instrument not found — import a market data pack that includes this
							benchmark.
						</span>
					</div>
				)}

				{/* Benchmark candle data unavailable for selected time range */}
				{benchmarkDataError && (
					<div className="absolute bottom-1 left-3 right-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs z-10">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
						<span className="text-amber-600 dark:text-amber-400">
							{benchmarkName} data unavailable for this time range — showing portfolio only.
						</span>
					</div>
				)}
			</div>

			{/* Benchmark comparison metrics bar */}
			<BenchmarkMetricsBar
				portfolioID={portfolioID}
				benchmarkMode={benchmarkMode}
				dateStart={metricsDateStart}
				dateEnd={metricsDateEnd}
			/>
		</div>
	);
}
