import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/utils";

interface PriceDataPoint {
	timestamp: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

interface CompactPriceChartProps {
	data: PriceDataPoint[];
	symbol?: string;
	currentPrice?: number;
	previousClose?: number;
	height?: number;
	showVolume?: boolean;
	className?: string;
}

export function CompactPriceChart({
	data,
	symbol,
	currentPrice,
	previousClose,
	height = 120,
	_showVolume = false,
	className,
}: CompactPriceChartProps) {
	// Calculate price change metrics
	const priceMetrics = useMemo(() => {
		if (!currentPrice || !previousClose || previousClose === 0) {
			return null;
		}

		const change = currentPrice - previousClose;
		const changePercent = (change / previousClose) * 100;

		return {
			change,
			changePercent,
			isPositive: change >= 0,
			isNeutral: change === 0,
		};
	}, [currentPrice, previousClose]);

	// Calculate price range from data
	const priceRange = useMemo(() => {
		if (!data || data.length === 0) return null;

		const prices = data.flatMap((d) => [d.high, d.low]);
		return {
			min: Math.min(...prices),
			max: Math.max(...prices),
			range: Math.max(...prices) - Math.min(...prices),
		};
	}, [data]);

	// Create simplified candlestick visualization
	const candlesticks = useMemo(() => {
		if (!data || data.length === 0 || !priceRange) return [];

		return data.map((candle, index) => {
			const bodyTop = Math.max(candle.open, candle.close);
			const bodyBottom = Math.min(candle.open, candle.close);
			const isGreen = candle.close >= candle.open;

			// Normalize positions to chart height
			const normalizePrice = (price: number) =>
				((priceRange.max - price) / priceRange.range) * height;

			return {
				index,
				x: (index / (data.length - 1)) * 100, // Percentage position
				wickTop: normalizePrice(candle.high),
				bodyTop: normalizePrice(bodyTop),
				bodyBottom: normalizePrice(bodyBottom),
				wickBottom: normalizePrice(candle.low),
				isGreen,
				candle,
			};
		});
	}, [data, priceRange, height]);

	const getPerformanceIcon = () => {
		if (!priceMetrics) return Minus;
		if (priceMetrics.isNeutral) return Minus;
		return priceMetrics.isPositive ? TrendingUp : TrendingDown;
	};

	const getPerformanceColor = () => {
		if (!priceMetrics) return "text-gray-600";
		if (priceMetrics.isNeutral) return "text-gray-600";
		return priceMetrics.isPositive ? "text-green-600" : "text-red-600";
	};

	const PerformanceIcon = getPerformanceIcon();
	const performanceColor = getPerformanceColor();

	if (!data || data.length === 0) {
		return (
			<Card className={className}>
				<CardContent className="p-4">
					<div className="flex items-center justify-center h-24 text-muted-foreground">
						No price data available
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium">
						{symbol ? `${symbol} Price` : "Price Chart"}
					</CardTitle>
					{priceMetrics && (
						<Badge
							variant="outline"
							className={`gap-1 ${performanceColor} border-current`}
						>
							<PerformanceIcon className="h-3 w-3" />
							{formatPercentage(priceMetrics.changePercent)}
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="p-4 pt-0">
				<div className="space-y-2">
					{currentPrice && (
						<div className="flex items-center justify-between">
							<span className="text-lg font-semibold">
								{formatCurrency(currentPrice)}
							</span>
							{priceMetrics && (
								<span className={`text-sm ${performanceColor}`}>
									{priceMetrics.change >= 0 ? "+" : ""}
									{formatCurrency(priceMetrics.change)}
								</span>
							)}
						</div>
					)}

					{/* Simplified Candlestick Chart */}
					<div
						className="relative w-full bg-gray-50 rounded"
						style={{ height: `${height}px` }}
					>
						<svg width="100%" height="100%" className="overflow-visible">
							<title>Chart</title>
							{candlesticks.map((stick) => (
								<g key={stick.index}>
									{/* Wick */}
									<line
										x1={`${stick.x}%`}
										y1={stick.wickTop}
										x2={`${stick.x}%`}
										y2={stick.wickBottom}
										stroke={stick.isGreen ? "#10b981" : "#ef4444"}
										strokeWidth="1"
									/>
									{/* Body */}
									<rect
										x={`${stick.x - 1}%`}
										y={stick.bodyTop}
										width="2%"
										height={Math.max(1, stick.bodyBottom - stick.bodyTop)}
										fill={stick.isGreen ? "#10b981" : "#ef4444"}
										opacity={stick.isGreen ? 0.8 : 1}
									/>
								</g>
							))}
						</svg>

						{/* Price range labels */}
						<div className="absolute top-1 left-2 text-xs text-muted-foreground">
							{priceRange && formatCurrency(priceRange.max)}
						</div>
						<div className="absolute bottom-1 left-2 text-xs text-muted-foreground">
							{priceRange && formatCurrency(priceRange.min)}
						</div>
					</div>

					{/* Summary Stats */}
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>{data.length} periods</span>
						{priceRange && (
							<span>Range: {formatCurrency(priceRange.range)}</span>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
