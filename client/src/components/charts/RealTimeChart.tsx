import {
	type CandlestickData,
	createChart,
	type IChartApi,
	type ISeriesApi,
	type LineData,
} from "lightweight-charts";
import { Minus, TrendingDown, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealTimeDashboard } from "@/contexts/RealTimeDashboardContext";
import { useCurrency } from "@/hooks/use-currency";
import { useResponsiveDashboard } from "@/hooks/use-responsive-dashboard";
import { cn } from "@/lib/utils";

interface RealTimeChartProps {
	assetId: string;
	symbol: string;
	chartType?: "line" | "candlestick";
	height?: number;
	showVolume?: boolean;
	className?: string;
}

export function RealTimeChart({
	assetId,
	symbol,
	chartType = "line",
	height = 300,
	showVolume = false,
	className = "",
}: RealTimeChartProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Line" | "Candlestick"> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

	const { state, actions } = useRealTimeDashboard();
	const [responsiveState] = useResponsiveDashboard();
	const [lastPrice, setLastPrice] = useState<number | null>(null);
	const [priceDirection, setPriceDirection] = useState<
		"up" | "down" | "neutral"
	>("neutral");

	// Initialize chart
	useEffect(() => {
		if (!chartContainerRef.current) return;

		const chart = createChart(chartContainerRef.current, {
			width: chartContainerRef.current.clientWidth,
			height,
			layout: {
				background: { color: "transparent" },
				textColor: "#333",
				fontSize: responsiveState.isMobile ? 10 : 12,
			},
			grid: {
				vertLines: { color: "#f0f0f0" },
				horzLines: { color: "#f0f0f0" },
			},
			crosshair: {
				mode: responsiveState.isMobile ? 0 : 1, // Disable crosshair on mobile for better touch interaction
			},
			rightPriceScale: {
				borderColor: "#cccccc",
				scaleMargins: {
					top: 0.1,
					bottom: 0.1,
				},
				// Adjust price scale width for mobile
				width: responsiveState.isMobile ? 50 : 60,
			},
			timeScale: {
				borderColor: "#cccccc",
				timeVisible: true,
				secondsVisible: false,
				// Better touch interaction on mobile
				rightOffset: responsiveState.isMobile ? 5 : 12,
				barSpacing: responsiveState.isMobile ? 3 : 6,
			},
			// Handle touch events better on mobile
			handleScroll: {
				mouseWheel: !responsiveState.isMobile,
				pressedMouseMove: true,
				horzTouchDrag: responsiveState.isMobile,
				vertTouchDrag: responsiveState.isMobile,
			},
			handleScale: {
				axisPressedMouseMove: true,
				mouseWheel: !responsiveState.isMobile,
				pinch: responsiveState.isMobile,
			},
		});

		chartRef.current = chart;

		// Create price series
		if (chartType === "line") {
			seriesRef.current = chart.addLineSeries({
				color: "#2563eb",
				lineWidth: 2,
				priceFormat: {
					type: "price",
					precision: 2,
					minMove: 0.01,
				},
			});
		} else {
			seriesRef.current = chart.addCandlestickSeries({
				upColor: "#22c55e",
				downColor: "#ef4444",
				borderDownColor: "#ef4444",
				borderUpColor: "#22c55e",
				wickDownColor: "#ef4444",
				wickUpColor: "#22c55e",
			});
		}

		// Create volume series if requested
		if (showVolume) {
			volumeSeriesRef.current = chart.addHistogramSeries({
				color: "#26a69a",
				priceFormat: {
					type: "volume",
				},
				priceScaleId: "",
				scaleMargins: {
					top: 0.8,
					bottom: 0,
				},
			});
		}

		// Handle resize
		const handleResize = () => {
			if (chartContainerRef.current && chartRef.current) {
				chartRef.current.applyOptions({
					width: chartContainerRef.current.clientWidth,
				});
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			if (chartRef.current) {
				chartRef.current.remove();
			}
		};
	}, [chartType, height, showVolume]);

	// Update chart with real-time data
	useEffect(() => {
		const priceData = actions.getAssetPrice(assetId);

		if (priceData && seriesRef.current) {
			const currentTime = Math.floor(priceData.timestamp / 1000);

			// Determine price direction
			if (lastPrice !== null) {
				if (priceData.price > lastPrice) {
					setPriceDirection("up");
				} else if (priceData.price < lastPrice) {
					setPriceDirection("down");
				} else {
					setPriceDirection("neutral");
				}
			}

			setLastPrice(priceData.price);

			if (chartType === "line") {
				const lineData: LineData = {
					time: currentTime,
					value: priceData.price,
				};
				(seriesRef.current as ISeriesApi<"Line">).update(lineData);
			} else {
				// For candlestick, we'd need OHLC data
				// This is a simplified example using current price as all OHLC values
				const candlestickData: CandlestickData = {
					time: currentTime,
					open: priceData.price,
					high: priceData.price,
					low: priceData.price,
					close: priceData.price,
				};
				(seriesRef.current as ISeriesApi<"Candlestick">).update(
					candlestickData,
				);
			}

			// Auto-scroll to latest data
			chartRef.current?.timeScale().scrollToRealTime();
		}
	}, [state.assetPrices, assetId, chartType, lastPrice, actions]);

	const currentPrice = actions.getAssetPrice(assetId);
	const isConnected = state.isConnected;

	const { formatCurrency: formatPrice } = useCurrency();

	const formatChange = (change: number, changePercent: number) => {
		const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
		const percentStr =
			changePercent >= 0
				? `+${changePercent.toFixed(2)}%`
				: `${changePercent.toFixed(2)}%`;
		return `${changeStr} (${percentStr})`;
	};

	const getTrendIcon = () => {
		switch (priceDirection) {
			case "up":
				return <TrendingUp className="h-4 w-4 text-green-500" />;
			case "down":
				return <TrendingDown className="h-4 w-4 text-red-500" />;
			default:
				return <Minus className="h-4 w-4 text-gray-500" />;
		}
	};

	const getChangeColor = (change: number) => {
		if (change > 0) return "text-green-600";
		if (change < 0) return "text-red-600";
		return "text-gray-600";
	};

	return (
		<Card className={cn(className, "relative")}>
			<CardHeader
				className={cn(
					"pb-2",
					// Smaller padding on mobile
					responsiveState.isMobile && "p-4 pb-2",
				)}
			>
				<div
					className={cn(
						"flex items-center justify-between",
						// Stack on mobile for better layout
						responsiveState.isMobile && "flex-col gap-2 items-start",
					)}
				>
					<div className="flex items-center gap-2">
						<CardTitle
							className={cn(responsiveState.isMobile ? "text-base" : "text-lg")}
						>
							{symbol}
						</CardTitle>
						{getTrendIcon()}
					</div>
					<Badge
						variant={isConnected ? "default" : "destructive"}
						className={cn(responsiveState.isMobile && "self-end")}
					>
						{isConnected ? (
							<>
								<Wifi className="h-3 w-3 mr-1" />
								Live
							</>
						) : (
							<>
								<WifiOff className="h-3 w-3 mr-1" />
								Offline
							</>
						)}
					</Badge>
				</div>

				{currentPrice && (
					<div
						className={cn(
							"flex items-center gap-2 sm:gap-4",
							// Stack on very small screens
							responsiveState.screenSize === "xs" &&
								"flex-col items-start gap-1",
						)}
					>
						<span
							className={cn(
								"font-bold",
								responsiveState.isMobile ? "text-xl" : "text-2xl",
							)}
						>
							{formatPrice(currentPrice.price)}
						</span>
						<span
							className={cn(
								"text-sm font-medium",
								getChangeColor(currentPrice.change),
							)}
						>
							{formatChange(currentPrice.change, currentPrice.changePercent)}
						</span>
					</div>
				)}
			</CardHeader>

			<CardContent
				className={cn(
					"p-0 relative",
					// Add touch-action for better mobile interaction
					responsiveState.isMobile && "touch-pan-x touch-pan-y",
				)}
			>
				<div
					ref={chartContainerRef}
					className="w-full"
					style={{ height: `${height}px` }}
				/>

				{!isConnected && (
					<div className="absolute inset-0 bg-gray-50/80 flex items-center justify-center">
						<div className="text-center">
							<WifiOff
								className={cn(
									"text-gray-400 mx-auto mb-2",
									responsiveState.isMobile ? "h-6 w-6" : "h-8 w-8",
								)}
							/>
							<p
								className={cn(
									"text-gray-600",
									responsiveState.isMobile ? "text-xs" : "text-sm",
								)}
							>
								Connection lost
							</p>
							<p className="text-xs text-gray-500">
								{responsiveState.isMobile
									? "Last known data"
									: "Showing last known data"}
							</p>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
