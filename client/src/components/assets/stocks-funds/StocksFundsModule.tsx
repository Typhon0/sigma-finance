import { useQuery } from "@apollo/client";
import {
	Activity,
	AlertTriangle,
	Check,
	ChevronDown,
	FileSpreadsheet,
	Globe,
	LayoutGrid,
	Percent,
	PiggyBank,
	Plus,
	RefreshCw,
	Scale,
	Sliders,
	X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { InsightFilter as DistributionInsightFilter } from "@/components/assets/stocks-funds/StocksDistributionWidget";
import { StocksDistributionWidget } from "@/components/assets/stocks-funds/StocksDistributionWidget";
import {
	filterByRange,
	PortfolioHeroChart as SharedPortfolioHeroChart,
} from "@/components/charts/PortfolioHeroChart";
import { BenchmarkComparisonCard } from "@/components/insights/BenchmarkComparisonCard";
import { CurrencyExposureCard } from "@/components/insights/CurrencyExposureCard";
import { FeesTerCard } from "@/components/insights/FeesTerCard";
import { IncomeForecastCard } from "@/components/insights/IncomeForecastCard";
import { MissingDataCard } from "@/components/insights/MissingDataCard";
import { PerformanceDriversCard } from "@/components/insights/PerformanceDriversCard";
import { PortfolioHealthCard } from "@/components/insights/PortfolioHealthCard";
import { DEFAULT_TARGET_WEIGHTS, RebalancingCard } from "@/components/insights/RebalancingCard";
import type { FeesTerData } from "@/components/insights/types";
import { usePortfolio } from "@/components/PortfolioProvider";
import { type FxResolution, resolveFxBasis } from "@/components/stocks-funds/fx-valuation";
import { resolvePositionValue } from "@/components/stocks-funds/position-value";
import type { Asset as StockAsset } from "@/components/stocks-funds/types";
import { TrendArrowUp } from "@/components/TrendArrows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ErrorBoundary from "@/components/ui/error-boundary";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { BenchmarkComparisonQuery, BenchmarkComparisonQueryVariables } from "@/gql/graphql";
import { BENCHMARK_COMPARISON } from "@/graphql/queries/benchmarks";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { useCurrency } from "@/hooks/use-currency";
import { usePortfolioRiskMetrics } from "@/hooks/use-portfolio-risk-metrics";
import { useBenchmarkInstrumentId } from "@/hooks/useBenchmarkInstrumentId";
import { allocatePercentages, fromMinorUnits, sumMoney, toMinorUnits } from "@/lib/money/rounding";
import { cn } from "@/lib/utils";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddStockForm } from "./AddStockForm";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { StockDetail } from "./StockDetail";
import { PositionsTableSkeleton, StocksFundsPositions } from "./StocksFundsPositions";
import { StocksFundsTransactions, TransactionsTableSkeleton } from "./StocksFundsTransactions";

interface StocksFundsModuleProps {
	onBack?: () => void;
	onNavigateToTransactions?: () => void;
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
	detailMode?: "external" | "panel";
}

type TimeRange = "1D" | "7D" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
type BenchmarkMode = "none" | "sp500" | "nasdaq" | "btc";

interface PerformancePoint {
	date: Date;
	portfolioValue: number;
	benchmarkValue: number;
}

export interface RawAsset {
	id?: string;
	/** Server `positions.id` for this holding, when the provider resolved one. */
	positionId?: string;
	type?: string;
	name?: string;
	symbol?: string;
	quantity?: number;
	purchasePrice?: number;
	currentValue?: number;
	currentPrice?: number;
	sector?: string | null;
	portfolioId?: string;
	account?: string;
	currency?: string;
	/** Portfolio/base currency the position is valued in, when known. */
	quoteCurrency?: string | null;
	/** Server-computed FX verdict for this position. Never guessed. */
	fx?: FxResolution;
	dayChangePercent?: number | null;
	/** Alternate day-change field name used by some GraphQL mappings. */
	dayChange?: number | null;
	/** Instrument reference metrics. Absent means unknown, never zero. */
	expenseRatio?: number;
	dividendYield?: number;
	peRatio?: number;
	sparklineData?: number[];
	portfolioWeight?: number;
}

interface PortfolioTransaction {
	id: string;
	type: string;
	date: string;
	total: number;
	portfolioId: string;
}

/**
 * Cross-filter shared between the distribution widget and the holdings table.
 *
 * This was a second, structurally identical `InsightFilter` declared in
 * StocksDistributionWidget; two copies of one type drift exactly when a new
 * filter mode is added. The widget's export is the single definition.
 */
export type InsightFilter = DistributionInsightFilter;

function toFiniteNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Weighted expense ratio across a portfolio's funds.
 *
 * Only holdings with a published expense ratio contribute. The rest are counted
 * as unknown rather than assigned a default: this used to be a hardcoded symbol
 * table in the client (VOO -> 0.03, "vanguard" -> 0.05, "active" -> 0.65,
 * fallback 0.15), which turned a guess into an annual fee in currency that the
 * user budgets against. A fund whose real TER is 1.8% read as 0.15% - a
 * twelve-fold error in the user's favour, which is worse than an error against
 * them because nobody audits a number that flatters them.
 *
 * Exported for tests: see reference-metrics-no-defaults.test.ts.
 */
export function computeFeesTerData(funds: StockAsset[]): FeesTerData {
	const count = funds.length;
	const totalFundValue = funds.reduce((sum, a) => sum + a.totalValue, 0);
	const known = funds.filter(
		(fund) => typeof fund.expenseRatio === "number" && Number.isFinite(fund.expenseRatio),
	);
	const knownValue = known.reduce((sum, a) => sum + a.totalValue, 0);
	const unknownCount = count - known.length;

	if (known.length === 0 || knownValue <= 0) {
		return { count, totalValue: totalFundValue, avgTer: null, annualCost: null, unknownCount };
	}

	const weightedTerSum = known.reduce(
		(sum, fund) => sum + (fund.expenseRatio as number) * fund.totalValue,
		0,
	);

	return {
		count,
		totalValue: totalFundValue,
		avgTer: Number((weightedTerSum / knownValue).toFixed(3)),
		// Summed in minor units via the shared rounding module so the card total
		// agrees with every other money figure in the module.
		annualCost: sumMoney(known.map((f) => f.totalValue * ((f.expenseRatio as number) / 100))),
		unknownCount,
	};
}

/**
 * Placeholder for the insight cockpit while the portfolio is still loading.
 *
 * Without it, every card renders its own "not enough data" empty state during
 * the initial fetch - which reads as a real, permanent result rather than a
 * loading state, and then swaps to content with a jarring layout shift.
 */
function InsightCardSkeleton() {
	return (
		<Card
			className="relative overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] flex flex-col justify-between"
			aria-busy="true"
		>
			<span className="sr-only">Loading insight…</span>
			<div className="space-y-3">
				<Skeleton className="h-2.5 w-24" />
				<Skeleton className="h-7 w-32" />
			</div>
			<div className="space-y-2">
				<Skeleton className="h-3 w-full" />
				<Skeleton className="h-3 w-4/5" />
			</div>
		</Card>
	);
}

/**
 * Insight card catalogue for the "Customize Cockpit" dialog.
 *
 * Hoisted to module scope: it is a constant, so building it inside the render
 * allocated a new array of 8 objects (and 8 new icon references) on every
 * single render of the module.
 */
/**
 * Default insight-card set when the user has never customized the cockpit.
 * Shared by the first-render initializer and the "Reset to Smart Defaults"
 * action so both stay in sync.
 */
const INSIGHT_CARD_SMART_DEFAULTS = ["performance-drivers", "portfolio-health", "income-forecast"];

const INSIGHT_CARD_CATALOGUE = [
	{
		id: "performance-drivers",
		title: "Performance Drivers",
		description: "Explains why the portfolio moved with top contributors and worst draggers.",
		icon: TrendArrowUp,
	},
	{
		id: "portfolio-health",
		title: "Portfolio Health",
		description: "Evaluates risk rating, asset concentration, and missing sector metadata.",
		icon: Activity,
	},
	{
		id: "income-forecast",
		title: "Income Forecast",
		description: "Projects dividend and coupon income for the next 12 months.",
		icon: PiggyBank,
	},
	{
		id: "fees-ter",
		title: "Fees & TER",
		description: "Estimates annual ETF/fund management fees and expense ratios.",
		icon: FileSpreadsheet,
	},
	{
		id: "rebalancing",
		title: "Rebalancing Status",
		description: "Compares current sector allocations against targets to keep weights in line.",
		icon: Scale,
	},
	{
		id: "currency-exposure",
		title: "Currency Exposure",
		description: "Breaks down assets by exchange currency to monitor fx risk.",
		icon: Globe,
	},
	{
		id: "missing-data",
		title: "Data Quality / Missing Info",
		description: "Flags assets missing average purchase price or categorization.",
		icon: AlertTriangle,
	},
	{
		id: "benchmark-comparison",
		title: "Benchmark Comparison",
		description: "Compares portfolio returns vs index benchmarks like the S&P 500.",
		icon: Percent,
	},
] as const;

/**
 * Exported for tests: the module and the holdings table must derive identical
 * totals from identical assets. See stocks-funds/__tests__/money-parity.test.ts.
 */
export function normalizeStockAssets(
	assets: RawAsset[],
	fallbackPortfolioId: string,
): StockAsset[] {
	const stockAssets = assets.filter((asset) => asset.type === "stock" || asset.type === "fund");

	// Weights are apportioned with the largest-remainder method, on the same
	// resolved values the holdings table uses, so the printed percentages add up
	// to exactly 100. Independently rounding each share produced totals like
	// 99.98%, which read as a calculation bug.
	const apportionedWeights = allocatePercentages(
		stockAssets.map(
			(asset) => resolvePositionValue(asset.currentValue, asset.currentPrice, asset.quantity).value,
		),
	);

	return stockAssets.map((asset, index) => {
		const quantity = Math.max(0, toFiniteNumber(asset.quantity, 0));
		const resolved = resolvePositionValue(asset.currentValue, asset.currentPrice, quantity);
		const totalPositionValue = resolved.value;

		const currentPrice = toFiniteNumber(asset.currentPrice, 0);
		// Cost basis stays in the instrument's own currency. We do NOT derive an FX
		// rate from value/price: that would apply today's rate to a historical
		// purchase and silently fold currency movement into unrealized P&L.
		const avgCost = toFiniteNumber(asset.purchasePrice, currentPrice);
		// Whether a percentage may be shown is the server's call, resolved from
		// PositionValuation. It used to be `asset.currency === asset.quoteCurrency`,
		// but `currency` was never fetched by any query, so this always evaluated
		// to false and every header return read 0.00%. See fx-valuation.ts.
		const fx = asset.fx ?? resolveFxBasis(null);
		const canShowPercentage = fx.canShowPercentage;
		const costBasis = avgCost * quantity;
		// The source of the figures follows the basis: a converted basis has
		// server-summed display-currency value and basis, so the return is
		// computed from those and not from the raw EUR/GBP purchase price. A
		// same-currency basis keeps the local math - no FX was involved.
		// Without a display-currency basis the P&L itself is unknowable: null
		// suppresses both the dollar figure and the percentage.
		let totalReturn: number | null = null;
		let totalReturnPercentage = 0;
		if (canShowPercentage) {
			if (
				fx.basis === "converted-basis" &&
				fx.displayValue !== null &&
				fx.costBasisDisplay !== null
			) {
				if (fx.costBasisDisplay > 0) {
					totalReturn = fx.displayValue - fx.costBasisDisplay;
					totalReturnPercentage = (totalReturn / fx.costBasisDisplay) * 100;
				} else {
					totalReturn = 0;
				}
			} else if (costBasis > 0) {
				totalReturn = totalPositionValue - costBasis;
				totalReturnPercentage = (totalReturn / costBasis) * 100;
			}
		}
		// Presence and value are resolved separately: a missing day-change
		// figure is not a flat session, so the detail panel hides the delta
		// instead of printing $0.00. Same resolution as the holdings table.
		const rawDayChange =
			typeof asset.dayChangePercent === "number" && Number.isFinite(asset.dayChangePercent)
				? asset.dayChangePercent
				: typeof asset.dayChange === "number" && Number.isFinite(asset.dayChange)
					? asset.dayChange
					: null;
		const hasDayChange = rawDayChange !== null;
		const dayChangePercentage = rawDayChange ?? 0;

		// Only a real series is carried through. A synthesized 7-point line used
		// to be derived here from price + day change, and the provider fed a
		// second synthetic series in as its "real" input. Either way the chart
		// rendered a fabricated trend; an empty array ("no trend data") is the
		// honest state.
		const incomingSparkline = Array.isArray(asset.sparklineData)
			? asset.sparklineData.filter((point) => Number.isFinite(point)).slice(-7)
			: [];

		const providedWeight = toFiniteNumber(asset.portfolioWeight, -1);
		const computedWeight = apportionedWeights[index] ?? 0;

		return {
			id: asset.id || `stock-${index}`,
			positionId: asset.positionId,
			portfolioId: asset.portfolioId || fallbackPortfolioId,
			symbol: (asset.symbol || asset.name || "ASSET").toUpperCase(),
			name: asset.name || "Unnamed Asset",
			type: asset.type || "stock",
			quantity,
			avgCost,
			currentPrice,
			totalValue: totalPositionValue,
			totalReturn,
			totalReturnPercentage,
			dayChangePercentage,
			hasDayChange,
			account: asset.account || "Manual Entry",
			sector: asset.sector || "Needs metadata",
			currency: asset.currency || fx.quoteCurrency || fx.costBasisCurrency || "USD",
			fx,
			portfolioWeight: providedWeight >= 0 ? providedWeight : computedWeight,
			// Reference metrics pass through untouched. They are already
			// undefined-when-unknown at the provider boundary, and re-deriving
			// them here would only create a second place to get it wrong.
			expenseRatio: asset.expenseRatio,
			dividendYield: asset.dividendYield,
			peRatio: asset.peRatio,
			sparklineData: incomingSparkline,
		};
	});
}

/** Session-scoped latch so the dev tripwire below cannot spam the console. */
let warnedPerformanceMismatch = false;

function buildPerformanceSeries(
	history: Array<{ date: string; value: number }>,
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
			date: new Date(point.date),
			portfolioValue: toFiniteNumber(point.value, fallbackValue),
		}))
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	// Dev-only tripwire for the bug this used to ship: a unit or scope mismatch
	// between the history feed and the live total (cents vs major units, or a
	// whole-portfolio curve paired with a subset subtotal) showed up as an axis
	// that contradicted the headline. A lagging tail is legitimate, so only
	// order-of-magnitude breaks are flagged, once per session.
	if (import.meta.env.DEV && import.meta.env.MODE !== "test" && fallbackValue > 0) {
		const tail = points[points.length - 1]?.portfolioValue ?? 0;
		const ratio = tail / fallbackValue;
		if ((ratio > 2.5 || ratio < 0.4) && !warnedPerformanceMismatch) {
			warnedPerformanceMismatch = true;
			// biome-ignore lint/suspicious/noConsole: dev-only tripwire for the axis/headline mismatch bug
			console.warn(
				`[StocksFunds] performance tail ${tail.toFixed(2)} vs live total ${fallbackValue.toFixed(2)} (x${ratio.toFixed(2)}) — check units/scope`,
			);
		}
	}

	return points.map((point) => ({
		date: point.date,
		portfolioValue: point.portfolioValue,
		benchmarkValue: point.portfolioValue,
	}));
}

function SignedDelta({
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
	const isUp = value >= 0;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-sm font-semibold",
				isUp ? "text-gain" : "text-loss",
			)}
			title={title}
		>
			<span className="font-mono tabular-nums">
				{isUp ? "+" : ""}
				{formatCurrency(value)}
				{percent !== null && ` (${isUp ? "+" : ""}${percent.toFixed(2)}%)`}
			</span>
			<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
		</span>
	);
}

interface PortfolioHeroChartProps {
	data: PerformancePoint[];
	totalEquity: number;
	totalGain?: number;
	totalGainPercent?: number;
	formatCurrency: (value: number) => string;
	timeRange: TimeRange;
	onTimeRangeChange: (range: TimeRange) => void;
	portfolioID?: string;
	loading?: boolean;
}

const PortfolioHeroChart = memo(function PortfolioHeroChart({
	data,
	totalEquity,
	totalGain,
	totalGainPercent,
	formatCurrency,
	timeRange,
	onTimeRangeChange,
	portfolioID,
	loading = false,
}: PortfolioHeroChartProps) {
	const shouldReduceMotion = useReducedMotion();
	const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>("sp500");
	const benchmarkName =
		benchmarkMode === "sp500"
			? "S&P 500"
			: benchmarkMode === "nasdaq"
				? "NASDAQ 100"
				: benchmarkMode === "btc"
					? "Bitcoin"
					: "Benchmark";

	const rangeData = useMemo(() => filterByRange(data, timeRange), [data, timeRange]);

	// The header displays the single performance delta for the active timeframe:
	// 1D when 1D is selected, range delta when a multi-day range is selected, or
	// all-time performance when ALL is active.
	const activeDelta = useMemo(() => {
		if (data.length < 2) {
			if (timeRange === "ALL" && totalGain !== undefined && totalGainPercent !== undefined) {
				return {
					value: totalGain,
					percent: totalGainPercent,
					label: "All-Time",
					title: "Unrealized gain/loss based on current holdings vs cost basis",
				};
			}
			return null;
		}

		if (timeRange === "1D") {
			const latestPoint = data[data.length - 1];
			const cutoff = latestPoint.date.getTime() - 24 * 60 * 60 * 1000;
			let priorPoint: PerformancePoint | null = null;
			for (const point of data) {
				if (point.date.getTime() <= cutoff) priorPoint = point;
				else break;
			}

			// When weekend or market closure causes identical consecutive prices (latest === priorPoint),
			// look back to the most recent trading session with a price movement for a meaningful 1D delta.
			if (priorPoint && latestPoint.portfolioValue === priorPoint.portfolioValue) {
				for (let i = data.length - 2; i >= 0; i--) {
					if (data[i].portfolioValue !== latestPoint.portfolioValue) {
						priorPoint = data[i];
						break;
					}
				}
			}

			if (priorPoint) {
				const dayDelta = latestPoint.portfolioValue - priorPoint.portfolioValue;
				return {
					value: dayDelta,
					percent: priorPoint.portfolioValue > 0 ? (dayDelta / priorPoint.portfolioValue) * 100 : null,
					label: "1D",
					title: "Change over the last trading session",
				};
			}
		}

		// Calculate delta across the active time range (e.g. 7D, 1M, 3M, YTD, 1Y, ALL)
		const latestPoint = data[data.length - 1];
		const rangeStartPoint = rangeData.length > 0 ? rangeData[0] : data[0];
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
	}, [data, rangeData, timeRange, totalGain, totalGainPercent]);

	return (
		<div className="flex flex-col space-y-4">
			{/* ECharts Header */}
			<div className="flex flex-col justify-between gap-3 border-b border-border/10 pb-3 sm:flex-row sm:items-center">
				<div className="flex flex-col">
					<span
						className="text-micro font-bold uppercase tracking-wider text-muted-foreground"
						title="Total value of the stocks and funds held in this portfolio"
					>
						Stocks & Funds Value
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
								<DropdownMenuItem onClick={() => setBenchmarkMode("none")}>None</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setBenchmarkMode("sp500")}>
									S&P 500
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setBenchmarkMode("nasdaq")}>
									NASDAQ 100
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setBenchmarkMode("btc")}>
									Bitcoin (BTC)
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<div className="h-3 w-[1px] bg-border/40 mx-1" />

						{(["1D", "7D", "1M", "3M", "YTD", "1Y", "ALL"] as const).map((range) => {
							const isSelected = timeRange === range;
							return (
								<Button
									key={range}
									variant="ghost"
									size="sm"
									aria-pressed={isSelected}
									aria-label={`Show ${range} performance`}
									className={cn(
										"relative h-9 rounded-full px-3 text-micro font-semibold transition-colors duration-150 min-w-[36px] cursor-pointer active:translate-y-px",
										isSelected
											? "text-foreground font-bold"
											: "text-muted-foreground hover:text-foreground",
									)}
									onClick={() => onTimeRangeChange(range)}
								>
									{isSelected && (
										<motion.span
											layoutId="heroRangePillActive"
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
				<SharedPortfolioHeroChart
					data={data}
					totalEquity={totalEquity}
					formatCurrency={formatCurrency}
					timeRange={timeRange}
					benchmarkMode={benchmarkMode}
					portfolioID={portfolioID}
					loading={loading}
				/>
			</div>
		</div>
	);
});

type ActiveTab = "positions" | "insights" | "transactions";

export function StocksFundsModule({
	onBack,
	onNavigateToTransactions,
	onSelectAccount,
	onSelectAsset,
	detailMode = "panel",
}: StocksFundsModuleProps) {
	const shouldReduceMotion = useReducedMotion();
	const [activeTab, setActiveTab] = useState<ActiveTab>("positions");
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");
	const [insightFilter, setInsightFilter] = useState<InsightFilter | null>(null);
	// Defer the insight filter to prevent expensive positions table re-renders
	// from blocking the insight card interaction (e.g. sector click animation).
	const deferredInsightFilter = useDeferredValue(insightFilter);

	// Stable identity for the "Clear" button in the holdings toolbar.
	// This was an inline `() => setInsightFilter(null)`, so the function changed
	// on every render and the memoized PositionsTable subtree re-rendered
	// whenever any module state changed, regardless of the deferred filter.
	const clearInsightFilter = useCallback(() => setInsightFilter(null), []);
	const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);

	const scrollToPositions = useCallback(() => {
		setTimeout(() => {
			const element = document.getElementById("positions-section");
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}, 80);
	}, []);

	/**
	 * Radix returns focus to a Dialog/Sheet trigger only when the surface was
	 * opened by one of its own <*Trigger> elements. This page opens both the
	 * detail sheet and the customize dialog from plain row/header clicks, so
	 * the previously focused element is remembered here and restored on close
	 * — otherwise Escape dropped focus to <body> and the keyboard user lost
	 * their place in the table.
	 */
	const overlayOpenerRef = useRef<HTMLElement | null>(null);
	const rememberOverlayOpener = useCallback(() => {
		overlayOpenerRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
	}, []);
	const restoreOverlayFocus = useCallback((event: Event) => {
		event.preventDefault();
		const opener = overlayOpenerRef.current;
		const active = document.activeElement;
		// A follow-up surface may already hold focus (e.g. Add position opened
		// from the sheet); only rescue focus that fell out of the document, and
		// keep the remembered opener so the follow-up can still return it.
		if ((!active || active === document.body) && opener?.isConnected) {
			opener.focus();
			overlayOpenerRef.current = null;
		}
	}, []);

	const handleSelectAsset = useCallback(
		(symbol: string) => {
			if (detailMode === "panel") {
				rememberOverlayOpener();
				setSelectedStockSymbol(symbol);
			} else {
				onSelectAsset?.(symbol);
			}
		},
		[detailMode, onSelectAsset, rememberOverlayOpener],
	);

	const handleSetActiveTab = useCallback(
		(tab: string) => {
			if (tab === "positions" || tab === "insights" || tab === "transactions") {
				setActiveTab(tab as ActiveTab);
			} else {
				setActiveTab("positions");
			}
			scrollToPositions();
		},
		[scrollToPositions],
	);

	const handleSetInsightFilter = useCallback(
		(filter: InsightFilter | null) => {
			setInsightFilter(filter);
			setActiveTab("positions");
			scrollToPositions();
		},
		[scrollToPositions],
	);

	const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
	const [selectedCards, setSelectedCards] = useState<string[]>(() => {
		try {
			const saved = localStorage.getItem("sf_insight_selected_cards");
			if (saved) {
				return JSON.parse(saved);
			}
		} catch {}
		return [...INSIGHT_CARD_SMART_DEFAULTS];
	});

	// Dialog-local edit buffer. Toggling a card must NOT touch the live
	// selection (or this persistence effect) until the user confirms, or
	// "Cancel" would behave as Save (critique #3, P2 — previously both buttons
	// only closed the dialog while toggles had already committed through
	// selectedCards). Drafts are re-seeded from the saved selection every time
	// the dialog opens; Cancel simply discards them.
	const [draftCards, setDraftCards] = useState<string[]>([]);
	const openCustomizeDialog = useCallback(() => {
		rememberOverlayOpener();
		setDraftCards(selectedCards);
		setIsCustomizeOpen(true);
	}, [rememberOverlayOpener, selectedCards]);

	useEffect(() => {
		try {
			localStorage.setItem("sf_insight_selected_cards", JSON.stringify(selectedCards));
		} catch {}
	}, [selectedCards]);

	// Dev-only skeleton preview. Previously reachable via ?skeleton=true in any
	// build, which let anyone force the loading state in production.
	const [forceSkeleton] = useState(() => {
		if (import.meta.env.DEV && typeof window !== "undefined") {
			return new URLSearchParams(window.location.search).get("skeleton") === "true";
		}
		return false;
	});

	const [targetWeights, setTargetWeights] = useState<Record<string, number>>(() => {
		try {
			const saved = localStorage.getItem("sf_rebalancing_target_weights");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length > 0) {
					return parsed;
				}
			}
		} catch {}
		return DEFAULT_TARGET_WEIGHTS;
	});

	const handleUpdateTargetWeights = useCallback((newWeights: Record<string, number>) => {
		setTargetWeights(newWeights);
		try {
			localStorage.setItem("sf_rebalancing_target_weights", JSON.stringify(newWeights));
		} catch {}
		toast.success("Updated model rebalancing targets");
	}, []);

	const {
		assets,
		addAsset,
		selectedPortfolio,
		addingAsset,
		currentPortfolio,
		loading: portfolioLoading,
		analyticsError: portfolioError,
		refetch: refetchPortfolioData,
	} = usePortfolio() as {
		assets: RawAsset[];
		addAsset: (input: {
			name: string;
			instrumentID?: string;
			type: "stock" | "fund";
			symbol: string;
			quantity: number;
			purchasePrice: number;
			purchaseDate?: string;
			sector?: string;
			quoteCurrency?: string;
			unitPriceCurrency?: string;
			currentPrice?: number;
			account?: string;
			accountId?: string;
		}) => Promise<unknown>;
		selectedPortfolio: {
			id: string;
			createdAt?: string;
			analytics?: {
				totalValue?: number;
				totalCost?: number;
				performanceHistory?: Array<{ date: string; value: number }>;
			};
		} | null;
		addingAsset: boolean;
		currentPortfolio: string;
		transactions: PortfolioTransaction[];
		loading: boolean;
		/** Combined dashboard-analytics failure from the provider (see P0 critique #3). */
		analyticsError?: unknown;
		refetch?: () => Promise<unknown>;
	};

	/**
	 * A failed analytics request must never render as a clean empty portfolio.
	 * When the critical dashboard query errors, every downstream value (hero,
	 * allocation, insights) collapses to zeros that read as real holdings data.
	 * The banner makes the failure explicit and offers a retry; the "$0" that
	 * remains on screen is then labelled as unavailable, not silent.
	 */
	const analyticsFailed = !portfolioLoading && Boolean(portfolioError);

	const normalizedAssets = useMemo(
		() => normalizeStockAssets(assets, currentPortfolio),
		[assets, currentPortfolio],
	);

	const selectedStockAsset = useMemo(() => {
		if (!selectedStockSymbol) return null;
		const sym = selectedStockSymbol.toUpperCase();
		return normalizedAssets.find((a) => a.symbol.toUpperCase() === sym) || null;
	}, [normalizedAssets, selectedStockSymbol]);

	// ---- Single-pass precomputation for all derived insights ----
	// Replaces 9+ separate useMemo hooks that each iterated over normalizedAssets.
	const assetPrecomputed = useMemo(() => {
		const assets = normalizedAssets;
		const len = assets.length;

		// Fast path: empty
		if (len === 0) {
			return {
				totalValue: 0,
				totalCost: 0,
				totalGain: 0,
				totalGainPercent: 0,
				sortedByValue: [] as StockAsset[],
				sectorValueMap: new Map<string, number>(),
				currencyValueMap: new Map<string, number>(),
				dividendAssets: [] as StockAsset[],
				fundAssets: [] as StockAsset[],
				missingCostCount: 0,
				missingSectorCount: 0,
				gainContributors: [] as Array<{ symbol: string; gain: number }>,
			};
		}

		// Accumulated as integer minor units so the header total is the exact
		// cent-value sum of the rows, not a float sum that can drift by ~1e-13.
		let totalValueMinor = 0;
		let totalValue = 0;
		let totalCost = 0;
		const sectorValueMap = new Map<string, number>();
		const currencyValueMap = new Map<string, number>();
		const dividendAssets: StockAsset[] = [];
		const fundAssets: StockAsset[] = [];
		let missingCostCount = 0;
		let missingSectorCount = 0;
		const gainContributors: Array<{ symbol: string; gain: number }> = [];

		for (const asset of assets) {
			totalValueMinor += toMinorUnits(asset.totalValue);
			const costBasis = asset.avgCost * asset.quantity;
			totalCost += costBasis;

			// Sector map
			const sec = asset.sector || "Other";
			sectorValueMap.set(sec, (sectorValueMap.get(sec) ?? 0) + asset.totalValue);

			// Currency map
			const cur = asset.currency || "USD";
			currencyValueMap.set(cur, (currencyValueMap.get(cur) ?? 0) + asset.totalValue);

			// Dividends
			if ((asset.dividendYield ?? 0) > 0) {
				dividendAssets.push(asset);
			}

			// Funds
			if (
				asset.type === "fund" ||
				asset.name.toLowerCase().includes("etf") ||
				asset.symbol.toLowerCase().includes("etf")
			) {
				fundAssets.push(asset);
			}

			// Data quality
			if (asset.avgCost <= 0) missingCostCount++;
			if (
				!asset.sector ||
				asset.sector === "Needs metadata" ||
				asset.sector === "Unclassified" ||
				asset.sector === "Unknown sector" ||
				asset.sector === "Other"
			) {
				missingSectorCount++;
			}

			// Gain contributor
			gainContributors.push({
				symbol: asset.symbol || asset.name,
				gain: asset.totalValue - costBasis,
			});
		}
		totalValue = fromMinorUnits(totalValueMinor);

		gainContributors.sort((a, b) => b.gain - a.gain);

		const sortedByValue = [...assets].sort((a, b) => b.totalValue - a.totalValue);
		const totalGain = totalValue - totalCost;
		const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

		return {
			totalValue,
			totalCost,
			totalGain,
			totalGainPercent,
			sortedByValue,
			sectorValueMap,
			currencyValueMap,
			dividendAssets,
			fundAssets,
			missingCostCount,
			missingSectorCount,
			gainContributors,
		};
	}, [normalizedAssets]);

	// Destructure for convenience
	const { totalValue, totalCost, totalGain } = assetPrecomputed;

	// biome-ignore lint/correctness/noUnusedVariables: used by insight cards & template
	const totalGainPercent = assetPrecomputed.totalGainPercent;

	const activeFilterStats = useMemo(() => {
		if (!insightFilter) return null;
		let matching = normalizedAssets;
		if (insightFilter.mode === "sector") {
			matching = normalizedAssets.filter((a) =>
				insightFilter.value === "Needs metadata"
					? !a.sector ||
						a.sector === "Needs metadata" ||
						a.sector === "Unclassified" ||
						a.sector === "Unknown sector" ||
						a.sector === "Other"
					: a.sector === insightFilter.value,
			);
		} else if (insightFilter.mode === "type") {
			const isFund = (a: StockAsset) =>
				a.type === "fund" ||
				a.name.toLowerCase().includes("etf") ||
				a.symbol.toLowerCase().includes("etf");
			matching = normalizedAssets.filter((a) =>
				insightFilter.value === "fund" ? isFund(a) : !isFund(a),
			);
		} else if (insightFilter.mode === "asset") {
			matching = normalizedAssets.filter(
				(a) =>
					a.symbol.toUpperCase() === insightFilter.value.toUpperCase() ||
					a.name.toLowerCase() === insightFilter.value.toLowerCase(),
			);
		}
		const count = matching.length;
		const value = matching.reduce((sum, a) => sum + a.totalValue, 0);
		const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
		return { count, value, percent };
	}, [insightFilter, normalizedAssets, totalValue]);

	// The hero describes stocks and funds only — this page's own scope, and the
	// same subtotal the holdings footer aggregates. The series comes from
	// `scopedPerformanceHistory`, which the server values with the snapshot
	// method (quantity-at-date × price-at-date) restricted to STOCK/FUND; it is
	// computed per read, never persisted, so it cannot lag behind or drift from
	// the snapshots. The previous pairing — stocks subtotal headline over the
	// portfolio-wide series — produced a chart axis that contradicted the
	// headline on mixed portfolios: a $6.6K headline over a $68K–$78K axis.
	const { data: scopedHistoryData, loading: scopedHistoryLoading } = useQuery(
		GET_SCOPED_PERFORMANCE_HISTORY,
		{
			variables: {
				portfolioID: selectedPortfolio?.id ?? "",
				assetTypes: ["STOCK", "FUND"],
			},
			skip: !selectedPortfolio?.id,
		},
	);
	const performanceData = useMemo(
		() => buildPerformanceSeries(scopedHistoryData?.scopedPerformanceHistory ?? [], totalValue),
		[scopedHistoryData, totalValue],
	);

	const performanceDrivers = useMemo(() => {
		if (assetPrecomputed.gainContributors.length === 0 || totalCost === 0) return null;
		const topContributors = assetPrecomputed.gainContributors.filter((c) => c.gain > 0).slice(0, 3);
		const worstDraggers = [...assetPrecomputed.gainContributors]
			.reverse()
			.filter((c) => c.gain < 0)
			.slice(0, 2);
		return { totalGain, topContributors, worstDraggers };
	}, [assetPrecomputed, totalCost, totalGain]);

	const portfolioHealth = useMemo(() => {
		const sorted = assetPrecomputed.sortedByValue;
		if (sorted.length === 0) return null;
		const topHolding = sorted[0];
		const topHoldingPct = totalValue > 0 ? (topHolding.totalValue / totalValue) * 100 : 0;
		const top3Value = sorted.slice(0, 3).reduce((sum, a) => sum + a.totalValue, 0);
		const top3Pct = totalValue > 0 ? (top3Value / totalValue) * 100 : 0;

		let largestSectorName = "None";
		let largestSectorPct = 0;
		for (const [sec, val] of assetPrecomputed.sectorValueMap) {
			if (
				sec !== "Needs metadata" &&
				sec !== "Unclassified" &&
				sec !== "Unknown sector" &&
				sec !== "Other" &&
				sec
			) {
				const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
				if (pct > largestSectorPct) {
					largestSectorPct = pct;
					largestSectorName = sec;
				}
			}
		}

		// Concentration, not risk. A single 30% position is a concentration
		// fact; calling it "risk" alongside real volatility and drawdown would
		// make the two indistinguishable to the reader.
		let concentration: "Low" | "Medium" | "High" = "Low";
		if (topHoldingPct > 25) concentration = "High";
		else if (topHoldingPct > 15) concentration = "Medium";

		return {
			concentration,
			topHoldingSymbol: topHolding.symbol || topHolding.name,
			topHoldingPct,
			top3Pct,
			largestSectorName,
			largestSectorPct,
			missingClassificationCount: assetPrecomputed.missingSectorCount,
		};
	}, [assetPrecomputed, totalValue]);

	const incomeForecast = useMemo(() => {
		const dlist = assetPrecomputed.dividendAssets;
		if (dlist.length === 0 || totalValue === 0) return null;

		const forwardAnnual = dlist.reduce(
			(sum, a) => sum + a.totalValue * ((a.dividendYield ?? 0) / 100),
			0,
		);
		const overallYield = (forwardAnnual / totalValue) * 100;

		const bestPayerAsset = dlist.reduce((prev, curr) => {
			const prevPay = prev.totalValue * ((prev.dividendYield ?? 0) / 100);
			const currPay = curr.totalValue * ((curr.dividendYield ?? 0) / 100);
			return currPay > prevPay ? curr : prev;
		});
		const bestPayerAnnual = bestPayerAsset.totalValue * ((bestPayerAsset.dividendYield ?? 0) / 100);

		const nextPayerAsset = dlist[0];
		const nextPaymentEst =
			(nextPayerAsset.totalValue * ((nextPayerAsset.dividendYield ?? 0) / 100)) / 4;

		return {
			forwardAnnual,
			overallYield,
			bestPayerSymbol: bestPayerAsset.symbol || bestPayerAsset.name,
			bestPayerAnnual,
			nextPayerSymbol: nextPayerAsset.symbol || nextPayerAsset.name,
			nextPaymentEst,
		};
	}, [assetPrecomputed, totalValue]);

	const feesTerData = useMemo(() => {
		if (assetPrecomputed.fundAssets.length === 0) return null;
		return computeFeesTerData(assetPrecomputed.fundAssets);
	}, [assetPrecomputed]);

	const rebalancingData = useMemo(() => {
		if (normalizedAssets.length === 0) return null;

		const sectorValues: Record<string, number> = {};
		for (const asset of normalizedAssets) {
			const sec = asset.sector || "Other";
			const canonicalSec = targetWeights[sec] !== undefined ? sec : "Other";
			sectorValues[canonicalSec] = (sectorValues[canonicalSec] ?? 0) + asset.totalValue;
		}

		let maxVariance = 0;
		let maxVarianceSector = Object.keys(targetWeights)[0] || "Other";
		let totalVariance = 0;

		for (const [sec, target] of Object.entries(targetWeights)) {
			const val = sectorValues[sec] ?? 0;
			const actualPct = totalValue > 0 ? (val / totalValue) * 100 : 0;
			const variance = actualPct - target;
			totalVariance += Math.abs(variance);
			if (Math.abs(variance) > Math.abs(maxVariance)) {
				maxVariance = variance;
				maxVarianceSector = sec;
			}
		}

		return {
			maxVariance,
			maxVarianceSector,
			needsAttentionCount: Object.keys(targetWeights).filter((sec) => {
				const val = sectorValues[sec] ?? 0;
				const actualPct = totalValue > 0 ? (val / totalValue) * 100 : 0;
				return Math.abs(actualPct - (targetWeights[sec] ?? 0)) > 5;
			}).length,
			totalVariance,
		};
	}, [normalizedAssets, totalValue, targetWeights]);

	const currencyExposure = useMemo(() => {
		if (normalizedAssets.length === 0) return [];
		const entries = Array.from(assetPrecomputed.currencyValueMap.entries());
		// Apportioned so the currency split sums to exactly 100%.
		const percentages = allocatePercentages(entries.map(([, value]) => value));
		return entries
			.map(([currency, value], index) => ({
				currency,
				value,
				percentage: percentages[index],
			}))
			.sort((a, b) => b.percentage - a.percentage);
	}, [normalizedAssets, assetPrecomputed]);

	const dataQuality = useMemo(() => {
		if (normalizedAssets.length === 0) return null;
		const totalPossibleChecks = normalizedAssets.length * 2;
		const passedChecks =
			totalPossibleChecks -
			(assetPrecomputed.missingCostCount + assetPrecomputed.missingSectorCount);
		const score = totalPossibleChecks > 0 ? (passedChecks / totalPossibleChecks) * 100 : 100;
		return {
			missingCostCount: assetPrecomputed.missingCostCount,
			missingSectorCount: assetPrecomputed.missingSectorCount,
			score,
		};
	}, [normalizedAssets, assetPrecomputed]);

	// Real risk metrics, measured by the performance service over the return
	// series. The alternative - analytics.riskMetrics - is filled with nulls on
	// the valuation path, and the Analytics page's stand-in was Beta 1.2 /
	// Sharpe 1.8 / -8.5% typed into the JSX.
	const portfolioRisk = usePortfolioRiskMetrics(selectedPortfolio?.id);

	const { id: sp500InstrumentId } = useBenchmarkInstrumentId("sp500");

	const comparisonTimeRange = useMemo(() => {
		const start = selectedPortfolio?.createdAt
			? new Date(selectedPortfolio.createdAt).toISOString()
			: new Date(
					Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 60000) * 60000,
				).toISOString();
		const end = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
		return { start, end };
	}, [selectedPortfolio?.createdAt]);

	const canQueryComparison = Boolean(selectedPortfolio?.id && sp500InstrumentId);

	const { data: comparisonData } = useQuery<
		BenchmarkComparisonQuery,
		BenchmarkComparisonQueryVariables
	>(BENCHMARK_COMPARISON, {
		variables:
			canQueryComparison && sp500InstrumentId && selectedPortfolio?.id
				? {
						portfolioId: selectedPortfolio.id ?? "",
						benchmarkAssetId: sp500InstrumentId,
						timeRange: comparisonTimeRange,
					}
				: undefined,
		skip: !canQueryComparison || !sp500InstrumentId || !selectedPortfolio?.id,
		fetchPolicy: "cache-first",
	});

	const benchmarkComparison = useMemo(() => {
		const c = comparisonData?.benchmarkComparison;
		if (!c) return null;

		// Server returns percentage values (e.g. 5.2 for 5.2%); display directly.
		const portfolioReturn = c.portfolioReturn;
		const sp500Return = c.benchmarkReturn;
		const outperformance = portfolioReturn - sp500Return;

		return { portfolioReturn, sp500Return, outperformance };
	}, [comparisonData]);

	const smartRecommendedCards = useMemo(() => {
		const list = ["performance-drivers", "portfolio-health"];

		if (assetPrecomputed.fundAssets.length > 0) list.push("fees-ter");
		if (assetPrecomputed.currencyValueMap.size > 1) list.push("currency-exposure");
		if (assetPrecomputed.dividendAssets.length > 0 && !list.includes("income-forecast"))
			list.push("income-forecast");
		if (
			(assetPrecomputed.missingCostCount > 0 || assetPrecomputed.missingSectorCount > 0) &&
			!list.includes("missing-data")
		)
			list.push("missing-data");

		if (list.length < 3) {
			if (!list.includes("income-forecast")) list.push("income-forecast");
			if (!list.includes("benchmark-comparison")) list.push("benchmark-comparison");
		}

		return list;
	}, [assetPrecomputed]);

	// Membership was tested with Array.includes() inside two render loops (one per
	// rendered insight card, one per card in the customize dialog), so every
	// render did O(cards x recommendations) string comparisons. A Set makes each
	// test O(1) and keeps the lookup stable across renders.
	const recommendedCardIds = useMemo(
		() => new Set<string>(smartRecommendedCards),
		[smartRecommendedCards],
	);

	const { formatCurrencyCompact: formatCurrency } = useCurrency();

	const handleAddPosition = async (formData: {
		instrumentID?: string;
		accountId?: string;
		name: string;
		symbol: string;
		type: "stock" | "fund" | "etf";
		quantity: number;
		purchasePrice: number;
		currentPrice?: number;
		purchaseDate?: string;
		account?: string;
		sector?: string;
		quoteCurrency?: string;
		unitPriceCurrency?: string;
	}) => {
		try {
			await addAsset({
				name: formData.name || formData.symbol,
				instrumentID: formData.instrumentID,
				type: formData.type === "etf" ? "stock" : formData.type,
				symbol: formData.symbol.toUpperCase(),
				quantity: formData.quantity,
				purchasePrice: formData.purchasePrice,
				purchaseDate: formData.purchaseDate,
				account: formData.accountId || formData.account,
				sector: formData.sector,
				quoteCurrency: formData.quoteCurrency,
				unitPriceCurrency: formData.unitPriceCurrency,
				currentPrice: formData.currentPrice,
			});
			setIsAddOpen(false);
			toast.success(`Added ${formData.symbol} to portfolio`);
		} catch (_error) {
			toast.error("Failed to add position. Please try again.");
		}
	};

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			<AssetPageHeader
				title="Stocks & Funds"
				description="Track stock assets, mutual funds, ETF performance, sector weightings, and real-time insights."
				onBack={onBack}
				actions={
					<>
						<MarketStatusBadge holdings={normalizedAssets} assetType="stock" />

						<Button
							size="sm"
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
							onClick={() => {
								rememberOverlayOpener();
								setIsAddOpen(true);
							}}
							disabled={addingAsset}
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							{addingAsset ? "Adding..." : "Add Position"}
						</Button>
					</>
				}
			/>

			<AddStockForm
				open={isAddOpen}
				onClose={() => setIsAddOpen(false)}
				onSubmit={handleAddPosition}
				onCloseAutoFocus={restoreOverlayFocus}
			/>

			{analyticsFailed && (
				<div
					role="alert"
					aria-live="assertive"
					data-testid="analytics-error-banner"
					className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
				>
					<AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-destructive">Portfolio data failed to load</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							Holdings, valuations, and analytics are unavailable because the request failed.
							Amounts shown as $0 are placeholders, not real data.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						className="h-8 shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer touch-target"
						onClick={() => {
							refetchPortfolioData?.();
						}}
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Retry
					</Button>
				</div>
			)}

			{/* Unified Dashboard Grid: Chart + Distribution side by side with vertical separator */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-10 border-b border-border/30 pb-6">
				{/* Unified Left Section: Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<ErrorBoundary>
						<PortfolioHeroChart
							data={performanceData}
							totalEquity={totalValue}
							totalGain={assetPrecomputed.totalGain}
							totalGainPercent={assetPrecomputed.totalGainPercent}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={selectedPortfolio?.id}
							loading={portfolioLoading || scopedHistoryLoading || forceSkeleton}
						/>
					</ErrorBoundary>
				</div>

				{/* Unified Right Section: Distribution */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<ErrorBoundary>
						<StocksDistributionWidget
							assets={normalizedAssets}
							totalValue={totalValue}
							sectorValueMap={assetPrecomputed.sectorValueMap}
							currencyValueMap={assetPrecomputed.currencyValueMap}
							formatCurrency={formatCurrency}
							activeFilter={insightFilter}
							onSetFilter={handleSetInsightFilter}
							onSelectAsset={handleSelectAsset}
							loading={portfolioLoading || forceSkeleton}
						/>
					</ErrorBoundary>
				</div>
			</div>

			{/* In-Viewport Active Cross-Filter Banner */}
			{insightFilter && activeFilterStats && (
				<motion.div
					key="cross-filter-banner"
					data-testid="cross-filter-banner"
					initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.99 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
					className="overflow-hidden"
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 text-xs shadow-xs mb-1">
						<div className="flex items-center gap-2.5 flex-wrap">
							<span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
							<span className="font-semibold text-foreground">
								Filtered by{" "}
								{insightFilter.mode === "sector"
									? "Sector"
									: insightFilter.mode === "type"
										? "Asset Class"
										: "Asset"}
								:
							</span>
							<span className="font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-micro">
								{insightFilter.label || insightFilter.value}
							</span>
							<span className="text-muted-foreground text-micro sm:text-xs">
								({activeFilterStats.count} holding{activeFilterStats.count !== 1 ? "s" : ""} •{" "}
								{formatCurrency(activeFilterStats.value)} • {activeFilterStats.percent.toFixed(1)}% of
								stocks)
							</span>
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setActiveTab("positions");
									scrollToPositions();
								}}
								className="h-7 text-xs bg-background/80 hover:bg-background border-border/60 gap-1.5 cursor-pointer touch-target active:translate-y-px"
							>
								<span>Jump to Holdings</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={clearInsightFilter}
								className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer touch-target active:translate-y-px"
							>
								<X className="h-3.5 w-3.5" />
								<span>Clear</span>
							</Button>
						</div>
					</div>
				</motion.div>
			)}

			{/* Segmented Mode Navigation & View Switcher */}
			<div id="positions-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-2">
					<div
						className="relative flex p-0.5 rounded-lg bg-muted border border-border/40"
						role="tablist"
						aria-label="Stocks and funds workspace view"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "positions"}
							onClick={() => setActiveTab("positions")}
							className={cn(
								"relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px",
								activeTab === "positions"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeTab === "positions" && (
								<motion.span
									layoutId="stocksActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Holdings</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{normalizedAssets.length}
							</span>
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "insights"}
							onClick={() => setActiveTab("insights")}
							className={cn(
								"relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px",
								activeTab === "insights"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeTab === "insights" && (
								<motion.span
									layoutId="stocksActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<Activity className="relative z-10 h-3.5 w-3.5 text-primary" />
							<span className="relative z-10">Insights & Analytics</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{selectedCards.length}
							</span>
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "transactions"}
							onClick={() => setActiveTab("transactions")}
							className={cn(
								"relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px",
								activeTab === "transactions"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeTab === "transactions" && (
								<motion.span
									layoutId="stocksActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Transactions</span>
						</button>
					</div>

					{activeTab === "insights" && (
						<button
							type="button"
							onClick={openCustomizeDialog}
							className="text-xs text-primary hover:text-primary/90 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/20 shadow-xs touch-target active:translate-y-px"
						>
							<Sliders className="h-3 w-3" />
							<span>Customize Cockpit</span>
						</button>
					)}
				</div>

				<AnimatePresence mode="wait">
					{/* Active View: Holdings Table */}
					{activeTab === "positions" && (
						<motion.div
							key="positions"
							initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
							transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
							className="min-h-[520px]"
						>
							<ErrorBoundary>
								{forceSkeleton ? (
									<PositionsTableSkeleton />
								) : (
									<StocksFundsPositions
										loading={portfolioLoading}
										onSelectAccount={onSelectAccount}
										onSelectAsset={handleSelectAsset}
										externalFilter={deferredInsightFilter}
										onClearExternalFilter={clearInsightFilter}
									/>
								)}
							</ErrorBoundary>
						</motion.div>
					)}

					{/* Active View: Insights Cockpit */}
					{activeTab === "insights" && (
						<motion.div
							key="insights"
							initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
							transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
							className="flex flex-col space-y-4"
						>
							<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
								{portfolioLoading || forceSkeleton ? (
									selectedCards.map((cardId) => <InsightCardSkeleton key={cardId} />)
								) : selectedCards.length === 0 ? (
									<Card className="col-span-full border border-dashed border-border/50 bg-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-3 animate-in fade-in duration-300 min-h-[220px]">
										<div className="rounded-full bg-primary/10 p-3 text-primary border border-primary/20">
											<LayoutGrid className="h-6 w-6" />
										</div>
										<div className="space-y-1">
											<p className="text-sm font-semibold text-foreground">Cockpit Customized</p>
											<p className="text-xs text-muted-foreground max-w-sm">
												All insights cards are currently hidden. Click "Customize" to select which
												cards to display on your dashboard.
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={openCustomizeDialog}
											className="h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/25 font-semibold mt-1"
										>
											Choose insights
										</Button>
									</Card>
								) : (
									selectedCards.map((cardId, index) => {
										const isRecommended = recommendedCardIds.has(cardId);
										let cardElement: React.ReactNode = null;
										switch (cardId) {
											case "performance-drivers":
												cardElement = (
													<PerformanceDriversCard
														key={cardId}
														cardId={cardId}
														performanceDrivers={performanceDrivers}
														isRecommended={isRecommended}
														formatCurrency={formatCurrency}
														setActiveTab={handleSetActiveTab}
													/>
												);
												break;
											case "portfolio-health":
												cardElement = (
													<PortfolioHealthCard
														key={cardId}
														cardId={cardId}
														portfolioHealth={portfolioHealth}
														riskMetrics={portfolioRisk.metrics}
														riskMetricsLoading={portfolioRisk.loading}
														isRecommended={isRecommended}
														setActiveTab={handleSetActiveTab}
													/>
												);
												break;
											case "income-forecast":
												cardElement = (
													<IncomeForecastCard
														key={cardId}
														cardId={cardId}
														incomeForecast={incomeForecast}
														isRecommended={isRecommended}
														formatCurrency={formatCurrency}
														setActiveTab={handleSetActiveTab}
													/>
												);
												break;
											case "fees-ter":
												cardElement = (
													<FeesTerCard
														key={cardId}
														cardId={cardId}
														feesTerData={feesTerData}
														isRecommended={isRecommended}
														formatCurrency={formatCurrency}
														setActiveTab={handleSetActiveTab}
													/>
												);
												break;
											case "rebalancing":
												cardElement = (
													<RebalancingCard
														key={cardId}
														cardId={cardId}
														rebalancingData={rebalancingData}
														isRecommended={isRecommended}
														setActiveTab={handleSetActiveTab}
														targetWeights={targetWeights}
														onUpdateTargetWeights={handleUpdateTargetWeights}
													/>
												);
												break;
											case "currency-exposure":
												cardElement = (
													<CurrencyExposureCard
														key={cardId}
														cardId={cardId}
														currencyExposure={currencyExposure}
														isRecommended={isRecommended}
														formatCurrency={formatCurrency}
														setActiveTab={handleSetActiveTab}
													/>
												);
												break;
											case "missing-data":
												cardElement = (
													<MissingDataCard
														key={cardId}
														cardId={cardId}
														dataQuality={dataQuality}
														isRecommended={isRecommended}
														setInsightFilter={handleSetInsightFilter}
													/>
												);
												break;
											case "benchmark-comparison":
												cardElement = (
													<BenchmarkComparisonCard
														key={cardId}
														cardId={cardId}
														benchmarkComparison={benchmarkComparison}
														isRecommended={isRecommended}
														setActiveTab={handleSetActiveTab}
													/>
												);
												break;
											default:
												return null;
										}
										if (!cardElement) return null;
										return (
											<motion.div
												key={cardId}
												initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{
													delay: shouldReduceMotion ? 0 : Math.min(index * 0.04, 0.16),
													duration: 0.25,
													ease: [0.16, 1, 0.3, 1],
												}}
											>
												<ErrorBoundary>{cardElement}</ErrorBoundary>
											</motion.div>
										);
									})
								)}
							</div>
						</motion.div>
					)}

					{/* Active View: Transactions */}
					{activeTab === "transactions" && (
						<motion.div
							key="transactions"
							initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
							transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
							className="min-h-[520px]"
						>
							<ErrorBoundary>
								{forceSkeleton ? (
									<TransactionsTableSkeleton />
								) : (
									<StocksFundsTransactions onNavigateToFullView={onNavigateToTransactions} />
								)}
							</ErrorBoundary>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Customize Insights Dialog Modal */}
				<Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
					<DialogContent
						className="max-w-2xl bg-card border border-border/60 p-6 overflow-hidden flex flex-col max-h-[85vh]"
						onCloseAutoFocus={restoreOverlayFocus}
					>
						<DialogHeader className="pb-3 border-b border-border/40">
							<DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
								<LayoutGrid className="h-4 w-4 text-primary" />
								<span>Customize Insights Cockpit</span>
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground mt-1">
								Choose which insight cards to display on your dashboard. Recommends cards based on
								your current portfolio structure.
							</DialogDescription>
						</DialogHeader>

						<div className="py-4 overflow-y-auto flex-1 space-y-3 pr-1">
							<div className="grid grid-cols-1 gap-3">
								{INSIGHT_CARD_CATALOGUE.map((card) => {
									const Icon = card.icon;
									const isSelected = draftCards.includes(card.id);
									const isRecommended = recommendedCardIds.has(card.id);

									return (
										<button
											key={card.id}
											type="button"
											onClick={() => {
												if (isSelected) {
													setDraftCards(draftCards.filter((id) => id !== card.id));
												} else {
													setDraftCards([...draftCards, card.id]);
												}
											}}
											className={cn(
												"w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-4",
												isSelected
													? "border-primary/40 bg-primary/5 hover:bg-primary/8"
													: "border-border/60 hover:bg-secondary/20 bg-secondary/5",
											)}
										>
											<div className="flex items-center gap-3.5 min-w-0">
												<div
													className={cn(
														"p-2.5 rounded-lg border shrink-0",
														isSelected
															? "bg-primary/10 border-primary/20 text-primary"
															: "bg-muted/40 border-border/40 text-muted-foreground",
													)}
												>
													<Icon className="h-4 w-4" />
												</div>
												<div className="space-y-0.5 min-w-0">
													<div className="flex items-center gap-2 flex-wrap">
														<span className="font-semibold text-xs text-foreground">
															{card.title}
														</span>
														{isRecommended && (
															<span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-micro font-extrabold uppercase tracking-wider">
																Recommended
															</span>
														)}
													</div>
													<p className="text-micro text-muted-foreground leading-normal line-clamp-2">
														{card.description}
													</p>
												</div>
											</div>

											<div className="shrink-0">
												{isSelected ? (
													<div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
														<Check className="h-3 w-3 stroke-[3]" />
													</div>
												) : (
													<div className="h-5 w-5 rounded-md border border-border/60 bg-transparent" />
												)}
											</div>
										</button>
									);
								})}
							</div>
						</div>

						<div className="pt-3 border-t border-border/40 flex justify-between items-center shrink-0">
							<button
								type="button"
								onClick={() => setDraftCards([...INSIGHT_CARD_SMART_DEFAULTS])}
								className="text-micro text-muted-foreground hover:text-foreground font-semibold px-2 py-1.5 transition-colors cursor-pointer bg-transparent border-0"
							>
								Reset to Smart Defaults
							</button>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="h-8 text-xs px-4"
									onClick={() => {
										// Explicit revert: the draft is discarded and the
										// committed selection stays untouched.
										setDraftCards(selectedCards);
										setIsCustomizeOpen(false);
									}}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									className="h-8 text-xs px-4 bg-primary text-primary-foreground border-0 font-semibold"
									onClick={() => {
										setSelectedCards(draftCards);
										setIsCustomizeOpen(false);
									}}
								>
									Save Changes
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{/* Stocks Detail Panel */}
			<Sheet
				open={detailMode === "panel" && selectedStockSymbol !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedStockSymbol(null);
				}}
			>
				<SheetContent
					side="right"
					className="w-full p-0 sm:max-w-2xl"
					onCloseAutoFocus={restoreOverlayFocus}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Stock Details</SheetTitle>
						<SheetDescription>
							Detailed view of the selected stock position and historical performance chart.
						</SheetDescription>
					</SheetHeader>
					{selectedStockSymbol && (
						<StockDetail
							symbol={selectedStockSymbol}
							position={selectedStockAsset}
							positionId={selectedStockAsset?.id}
							quantity={selectedStockAsset?.quantity}
							currentPrice={selectedStockAsset?.currentPrice}
							currency={selectedStockAsset?.currency}
							onBack={() => setSelectedStockSymbol(null)}
							onTrade={() => {
								// Keep the sheet's own opener as the restore target:
								// closing the add dialog should return to the table
								// where the sheet was opened from, not to the sheet.
								setSelectedStockSymbol(null);
								setIsAddOpen(true);
							}}
							isPanel={true}
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
