import {
	type CandlestickData,
	CandlestickSeries,
	ColorType,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type Time,
} from "lightweight-charts";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useMarketData } from "@/hooks/useMarketData";

interface LightweightChartProps {
	symbol: string;
	assetType: string;
	height?: number;
	theme?: "light" | "dark";
	interval?: string;
	autoRefresh?: boolean;
}

const LightweightChart: React.FC<LightweightChartProps> = ({
	symbol,
	assetType,
	height = 400,
	theme = "light",
	interval = "1D",
	autoRefresh,
}) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);

	const resolvedAutoRefresh = autoRefresh ?? assetType === "CRYPTO";

	const { data, loading, error, currentPrice } = useMarketData({
		symbol,
		assetType,
		interval,
		autoRefresh: resolvedAutoRefresh,
		refreshInterval: 30000,
	});

	// Initialize chart
	useEffect(() => {
		if (!chartContainerRef.current || isInitialized) return;

		const isDaily =
			interval === "1D" || interval === "1W" || interval === "1M" || interval === "daily";

		const chart = createChart(chartContainerRef.current, {
			width: chartContainerRef.current.clientWidth,
			height,
			layout: {
				background: {
					type: ColorType.Solid,
					color: theme === "dark" ? "#1a1a1a" : "#ffffff",
				},
				textColor: theme === "dark" ? "#ffffff" : "#333333",
			},
			grid: {
				vertLines: { color: theme === "dark" ? "#2a2a2a" : "#e1e1e1" },
				horzLines: { color: theme === "dark" ? "#2a2a2a" : "#e1e1e1" },
			},
			crosshair: {
				mode: 1, // Normal crosshair mode
			},
			rightPriceScale: {
				borderColor: theme === "dark" ? "#485158" : "#cccccc",
			},
			timeScale: {
				borderColor: theme === "dark" ? "#485158" : "#cccccc",
				timeVisible: !isDaily,
				secondsVisible: false,
			},
		});

		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: "#26a69a",
			downColor: "#ef5350",
			borderVisible: false,
			wickUpColor: "#26a69a",
			wickDownColor: "#ef5350",
		});

		chartRef.current = chart;
		candlestickSeriesRef.current = candlestickSeries;
		setIsInitialized(true);

		// Handle resize
		let resizeObserver: ResizeObserver | null = null;
		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver((entries) => {
				if (!entries || entries.length === 0) return;
				const entry = entries[0];
				const width =
					entry.contentRect.width ||
					(chartContainerRef.current ? chartContainerRef.current.clientWidth : 0);
				if (width > 0 && chart) {
					chart.applyOptions({
						width,
					});
				}
			});
			resizeObserver.observe(chartContainerRef.current);
		}

		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			if (chart) {
				chart.remove();
			}
			chartRef.current = null;
			candlestickSeriesRef.current = null;
			setIsInitialized(false);
		};
	}, [height, theme, interval]);

	// Update chart data
	useEffect(() => {
		if (!candlestickSeriesRef.current || !data.length) return;

		const isDaily =
			interval === "1D" || interval === "1W" || interval === "1M" || interval === "daily";

		// Sort by timestamp first to ensure proper order
		const sortedData = [...data].sort(
			(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

		const chartData = sortedData
			.map((candle) => {
				const date = new Date(candle.timestamp);
				const timeMs = date.getTime();
				if (Number.isNaN(timeMs)) return null;

				const time = isDaily
					? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
					: Math.floor(timeMs / 1000);

				return {
					time: time as Time,
					open: candle.open,
					high: candle.high,
					low: candle.low,
					close: candle.close,
				};
			})
			.filter((item): item is CandlestickData => item !== null);

		// Deduplicate data points by time
		const uniqueChartData: CandlestickData[] = [];
		const seenTimes = new Set<string | number>();
		for (const point of chartData) {
			if (!seenTimes.has(point.time as string | number)) {
				seenTimes.add(point.time as string | number);
				uniqueChartData.push(point);
			}
		}

		candlestickSeriesRef.current.setData(uniqueChartData);

		// Fit content to show all data
		if (chartRef.current) {
			chartRef.current.timeScale().fitContent();
		}
	}, [data, interval, isInitialized]);

	// Update timescale options when interval changes
	useEffect(() => {
		if (!chartRef.current) return;
		const isDaily =
			interval === "1D" || interval === "1W" || interval === "1M" || interval === "daily";
		chartRef.current.applyOptions({
			timeScale: {
				timeVisible: !isDaily,
			},
		});
	}, [interval]);

	// Update theme
	useEffect(() => {
		if (!chartRef.current) return;

		chartRef.current.applyOptions({
			layout: {
				background: {
					type: ColorType.Solid,
					color: theme === "dark" ? "#1a1a1a" : "#ffffff",
				},
				textColor: theme === "dark" ? "#ffffff" : "#333333",
			},
			grid: {
				vertLines: { color: theme === "dark" ? "#2a2a2a" : "#e1e1e1" },
				horzLines: { color: theme === "dark" ? "#2a2a2a" : "#e1e1e1" },
			},
			rightPriceScale: {
				borderColor: theme === "dark" ? "#485158" : "#cccccc",
			},
			timeScale: {
				borderColor: theme === "dark" ? "#485158" : "#cccccc",
			},
		});
	}, [theme]);

	return (
		<div className="relative animate-in fade-in duration-300" style={{ height }}>
			{loading && (
				<div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-[1px] z-30">
					<div className="text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2" />
						<p className="text-xs text-muted-foreground">Loading chart data...</p>
					</div>
				</div>
			)}

			{error && (
				<div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-[1px] z-30">
					<div className="text-center text-red-500 p-4">
						<div className="text-red-500 mb-2">
							<svg
								className="w-8 h-8 mx-auto"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								role="img"
								aria-label="Error icon"
							>
								<title>Error</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
						</div>
						<p className="text-xs">{error}</p>
					</div>
				</div>
			)}

			{/* Current price indicator */}
			{currentPrice && !loading && (
				<div className="absolute top-2 left-2 z-10 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm border border-border/40">
					<div className="text-sm font-medium text-foreground">
						${currentPrice.toLocaleString()}
					</div>
					<div className="text-[10px] text-muted-foreground">Current Price</div>
				</div>
			)}

			{/* Asset type indicator */}
			<div className="absolute top-2 right-2 z-10">
				<span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
					{assetType}
				</span>
			</div>

			{/* Chart container */}
			<div ref={chartContainerRef} className="w-full h-full" style={{ height }} />
		</div>
	);
};

export default LightweightChart;
