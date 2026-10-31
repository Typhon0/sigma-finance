import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { memo, useMemo, useState, useTransition } from "react";
import {
	type BenchmarkMode,
	filterByRange,
	type PerformancePoint,
	PortfolioHeroChart as PortfolioHeroChartCanvas,
	type TimeRange,
} from "@/components/charts/PortfolioHeroChart";
import {
	type CurveHoldingInput,
	resolveHybridPerformanceSeries,
} from "@/components/charts/performance-series";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const TIME_RANGES: readonly TimeRange[] = [
	"1D",
	"7D",
	"1M",
	"3M",
	"YTD",
	"1Y",
	"ALL",
] as const;

function toFiniteNumber(value: unknown, fallback = 0): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

/** Session-scoped latch so the dev tripwire below cannot spam the console. */
let warnedPerformanceMismatch = false;

export function buildPerformanceSeries(
	history: Array<{ date: string | Date; value: number }>,
	fallbackValue: number,
): PerformancePoint[] {
	if (history.length === 0) {
		const fallbackDate = new Date();
		return [
			{
				date: fallbackDate,
				portfolioValue: fallbackValue,
				benchmarkValue: fallbackValue,
			},
		];
	}

	const points = history
		.map((point) => ({
			date: point.date instanceof Date ? point.date : new Date(point.date),
			portfolioValue: toFiniteNumber(point.value, fallbackValue),
		}))
		.filter((point) => !Number.isNaN(point.date.getTime()))
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	if (points.length === 0) {
		const fallbackDate = new Date();
		return [
			{
				date: fallbackDate,
				portfolioValue: fallbackValue,
				benchmarkValue: fallbackValue,
			},
		];
	}

	if (import.meta.env.DEV && import.meta.env.MODE !== "test" && fallbackValue > 0) {
		const tail = points[points.length - 1]?.portfolioValue ?? 0;
		const ratio = tail / fallbackValue;
		if ((ratio > 2.5 || ratio < 0.4) && !warnedPerformanceMismatch) {
			warnedPerformanceMismatch = true;
			// biome-ignore lint/suspicious/noConsole: dev-only tripwire for the axis/headline mismatch bug
			console.warn(
				`[AssetHeroChart] performance tail ${tail.toFixed(2)} vs live total ${fallbackValue.toFixed(2)} (x${ratio.toFixed(2)}) — check units/scope`,
			);
		}
	}

	return points.map((point) => ({
		date: point.date,
		portfolioValue: point.portfolioValue,
		benchmarkValue: point.portfolioValue,
	}));
}

export function SignedDelta({
	value,
	percent,
	label,
	title,
	formatCurrency,
}: {
	value: number;
	percent: number | null;
	label: string;
	title: string;
	formatCurrency: (value: number) => string;
}) {
	const isPositive = value > 0;
	const isZero = value === 0;
	const formattedDelta = `${isPositive ? "+" : isZero ? "" : "-"}${formatCurrency(Math.abs(value))}`;
	const formattedPercent =
		percent !== null
			? ` (${isPositive ? "+" : isZero ? "" : "-"}${Math.abs(percent).toFixed(2)}%)`
			: "";

	const colorClass = isPositive ? "text-gain" : isZero ? "text-muted-foreground" : "text-loss";

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-sm font-semibold cursor-help",
				colorClass,
			)}
			title={title}
		>
			<span className="font-mono tabular-nums">
				{formattedDelta}
				{formattedPercent}
			</span>
			<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
		</span>
	);
}

export interface AssetHeroChartProps {
	title?: string;
	titleTooltip?: string;
	data: PerformancePoint[];
	/** Optional holdings list with sparklines/dayChanges to synthesize dynamic curves when backend history is sparse or for 1D */
	holdings?: CurveHoldingInput[];
	totalEquity: number;
	totalGain?: number;
	totalGainPercent?: number;
	formatCurrency: (value: number) => string;
	timeRange: TimeRange;
	onTimeRangeChange: (range: TimeRange) => void;
	portfolioID?: string;
	loading?: boolean;
	error?: string;
	defaultBenchmark?: BenchmarkMode;
	benchmarkMode?: BenchmarkMode;
	onBenchmarkModeChange?: (mode: BenchmarkMode) => void;
	layoutId?: string;
	className?: string;
}

export const AssetHeroChart = memo(function AssetHeroChart({
	title = "Portfolio Value",
	titleTooltip,
	data,
	holdings,
	totalEquity,
	totalGain,
	totalGainPercent,
	formatCurrency,
	timeRange,
	onTimeRangeChange,
	portfolioID,
	loading = false,
	error,
	defaultBenchmark = "sp500",
	benchmarkMode: benchmarkModeProp,
	onBenchmarkModeChange,
	layoutId = "heroRangePillActive",
	className,
}: AssetHeroChartProps) {
	const shouldReduceMotion = useReducedMotion();
	const [, startTransition] = useTransition();
	const [internalBenchmarkMode, setInternalBenchmarkMode] =
		useState<BenchmarkMode>(defaultBenchmark);
	const benchmarkMode = benchmarkModeProp ?? internalBenchmarkMode;

	const handleBenchmarkChange = (mode: BenchmarkMode) => {
		if (onBenchmarkModeChange) {
			onBenchmarkModeChange(mode);
		} else {
			setInternalBenchmarkMode(mode);
		}
	};

	const handleTimeRangeChange = (range: TimeRange) => {
		startTransition(() => {
			onTimeRangeChange(range);
		});
	};

	const benchmarkName =
		benchmarkMode === "sp500"
			? "S&P 500"
			: benchmarkMode === "nasdaq"
				? "NASDAQ 100"
				: benchmarkMode === "btc"
					? "Bitcoin"
					: "Benchmark";

	const chartData = useMemo(
		() =>
			resolveHybridPerformanceSeries({
				backendSeries: data,
				holdings,
				totalValue: totalEquity,
				timeRange,
			}),
		[data, holdings, totalEquity, timeRange],
	);

	const rangeData = useMemo(() => filterByRange(chartData, timeRange), [chartData, timeRange]);

	// The header displays the single performance delta for the active timeframe:
	// 1D when 1D is selected, range delta when a multi-day range is selected, or
	// all-time performance when ALL is active.
	const activeDelta = useMemo(() => {
		if (timeRange === "ALL" && totalGain !== undefined && totalGainPercent !== undefined) {
			return {
				value: totalGain,
				percent: totalGainPercent,
				label: "All-Time",
				title: "Unrealized gain/loss based on current holdings vs cost basis",
			};
		}

		if (chartData.length < 2) {
			return null;
		}

		if (timeRange === "1D") {
			const latestPoint = chartData[chartData.length - 1];
			const cutoff = latestPoint.date.getTime() - 24 * 60 * 60 * 1000;
			let priorPoint: PerformancePoint | null = null;
			for (const point of chartData) {
				if (point.date.getTime() <= cutoff) priorPoint = point;
				else break;
			}

			// When weekend or market closure causes identical consecutive prices (latest === priorPoint),
			// look back to the most recent trading session with a price movement for a meaningful 1D delta.
			if (priorPoint && latestPoint.portfolioValue === priorPoint.portfolioValue) {
				for (let i = chartData.length - 2; i >= 0; i--) {
					if (chartData[i].portfolioValue !== latestPoint.portfolioValue) {
						priorPoint = chartData[i];
						break;
					}
				}
			}

			if (priorPoint) {
				const dayDelta = latestPoint.portfolioValue - priorPoint.portfolioValue;
				return {
					value: dayDelta,
					percent:
						priorPoint.portfolioValue > 0 ? (dayDelta / priorPoint.portfolioValue) * 100 : null,
					label: "1D",
					title: "Change over the last trading session",
				};
			}
		}

		// Calculate delta across the active time range (e.g. 7D, 1M, 3M, YTD, 1Y, ALL)
		const latestPoint = chartData[chartData.length - 1];
		const rangeStartPoint = rangeData.length > 0 ? rangeData[0] : chartData[0];
		const rangeDelta = latestPoint.portfolioValue - rangeStartPoint.portfolioValue;

		return {
			value: rangeDelta,
			percent:
				rangeStartPoint.portfolioValue > 0
					? (rangeDelta / rangeStartPoint.portfolioValue) * 100
					: null,
			label: timeRange === "ALL" ? "All-Time" : timeRange,
			title: `Change over the selected ${timeRange === "ALL" ? "all-time" : timeRange} period`,
		};
	}, [chartData, rangeData, timeRange, totalGain, totalGainPercent]);

	return (
		<div className={cn("flex flex-col space-y-4", className)}>
			{/* ECharts Header */}
			<div className="flex flex-col justify-between gap-3 border-b border-border/10 pb-3 sm:flex-row sm:items-center">
				<div className="flex flex-col">
					<span
						className="text-micro font-bold uppercase tracking-wider text-muted-foreground"
						title={titleTooltip}
					>
						{title}
					</span>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<span className="font-mono text-[2rem] leading-8 font-bold tracking-tight text-foreground">
							{formatCurrency(totalEquity)}
						</span>
						<motion.div
							key={`${timeRange}-${benchmarkMode}`}
							initial={shouldReduceMotion ? false : { opacity: 0.5, y: -2 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
							className="flex flex-wrap items-center gap-x-3 gap-y-1"
						>
							{activeDelta && (
								<SignedDelta
									value={activeDelta.value}
									percent={activeDelta.percent}
									label={activeDelta.label}
									title={activeDelta.title}
									formatCurrency={formatCurrency}
								/>
							)}
						</motion.div>
					</div>
				</div>

				{/* Chart controls (benchmark picker + range pills) are hidden on
				    phones per DESIGN.md — "hide chart controls below 768px". */}
				<div className="hidden md:flex items-center gap-2">
					<div className="flex items-center rounded-full bg-secondary/35 border border-border/50 p-0.5">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 gap-1 rounded-full px-2.5 text-micro text-muted-foreground hover:text-foreground cursor-pointer active:translate-y-px"
								>
									{benchmarkMode === "none" ? "No Benchmark" : `vs ${benchmarkName}`}
									<ChevronDown className="h-2.5 w-2.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => handleBenchmarkChange("none")}>
									None
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleBenchmarkChange("sp500")}>
									S&P 500
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleBenchmarkChange("nasdaq")}>
									NASDAQ 100
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => handleBenchmarkChange("btc")}>
									Bitcoin (BTC)
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<div className="h-3 w-[1px] bg-border/40 mx-1" />

						{TIME_RANGES.map((range) => {
							const isSelected = timeRange === range;
							return (
								<Button
									key={range}
									variant="ghost"
									size="sm"
									aria-pressed={isSelected}
									aria-label={`Show ${range} performance`}
									className={cn(
										"relative min-h-[44px] min-w-[44px] md:min-h-0 md:h-8 md:min-w-[36px] rounded-full px-3 text-micro font-semibold transition-colors duration-150 cursor-pointer active:translate-y-px touch-target",
										isSelected
											? "text-foreground font-bold"
											: "text-muted-foreground hover:text-foreground",
									)}
									onClick={() => handleTimeRangeChange(range)}
								>
									{isSelected && (
										<motion.span
											layoutId={layoutId}
											className="absolute inset-0 rounded-full bg-secondary-foreground/15 shadow-xs"
											transition={
												shouldReduceMotion
													? { duration: 0 }
													: { type: "spring", stiffness: 500, damping: 35 }
											}
										/>
									)}
									<span className="relative z-10">{range}</span>
								</Button>
							);
						})}
					</div>
				</div>
			</div>

			{/* ECharts view using the shared chart with real benchmark comparison */}
			<div className="h-[250px] w-full relative">
				<PortfolioHeroChartCanvas
					data={chartData}
					totalEquity={totalEquity}
					formatCurrency={formatCurrency}
					timeRange={timeRange}
					benchmarkMode={benchmarkMode}
					portfolioID={portfolioID}
					loading={loading}
					error={error}
				/>
			</div>
		</div>
	);
});
