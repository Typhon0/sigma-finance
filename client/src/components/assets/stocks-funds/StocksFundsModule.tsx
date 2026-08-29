import { useQuery } from "@apollo/client";
import {
	Activity,
	AlertTriangle,
	CalendarDays,
	Check,
	ChevronDown,
	FileSpreadsheet,
	Globe,
	LayoutGrid,
	Percent,
	PiggyBank,
	Plus,
	Scale,
	Sliders,
	TrendingUp,
	Upload,
} from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StocksDistributionWidget } from "@/components/assets/stocks-funds/StocksDistributionWidget";
import { PortfolioHeroChart as SharedPortfolioHeroChart } from "@/components/charts/PortfolioHeroChart";
import { BenchmarkComparisonCard } from "@/components/insights/BenchmarkComparisonCard";
import { CurrencyExposureCard } from "@/components/insights/CurrencyExposureCard";
import { FeesTerCard } from "@/components/insights/FeesTerCard";
import { IncomeForecastCard } from "@/components/insights/IncomeForecastCard";
import { MissingDataCard } from "@/components/insights/MissingDataCard";
import { PerformanceDriversCard } from "@/components/insights/PerformanceDriversCard";
import { PortfolioHealthCard } from "@/components/insights/PortfolioHealthCard";
import { RebalancingCard } from "@/components/insights/RebalancingCard";
import { usePortfolio } from "@/components/PortfolioProvider";
import type { Asset as StockAsset, TargetAllocation } from "@/components/stocks-funds/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { BenchmarkComparisonQuery, BenchmarkComparisonQueryVariables } from "@/gql/graphql";
import { BENCHMARK_COMPARISON } from "@/graphql/queries/benchmarks";
import { useCurrency } from "@/hooks/use-currency";
import { useBenchmarkInstrumentId } from "@/hooks/useBenchmarkInstrumentId";
import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/utils/formatters";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddStockForm } from "./AddStockForm";
import { StockDetail } from "./StockDetail";
import { StocksFundsPositions } from "./StocksFundsPositions";
import { StocksFundsTransactions } from "./StocksFundsTransactions";

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

interface RawAsset {
	id?: string;
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
	dayChangePercent?: number | null;
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

interface AllocationManagerProps {
	targetAllocations: TargetAllocation[];
	actualBySector: Record<string, number>;
}

interface DividendSummaryProps {
	assets: StockAsset[];
	portfolioValue: number;
	formatCurrency: (value: number) => string;
}

export interface InsightFilter {
	mode: "sector" | "asset-class" | "type" | "asset";
	value: string;
	label?: string;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStockAssets(assets: RawAsset[], fallbackPortfolioId: string): StockAsset[] {
	const stockAssets = assets.filter((asset) => asset.type === "stock" || asset.type === "fund");
	const totalValue = stockAssets.reduce((sum, asset) => {
		const quantity = Math.max(1, toFiniteNumber(asset.quantity, 1));
		const currentValue = toFiniteNumber(
			asset.currentValue,
			toFiniteNumber(asset.currentPrice, 0) * quantity,
		);
		return sum + currentValue;
	}, 0);

	return stockAssets.map((asset, index) => {
		const quantity = Math.max(1, toFiniteNumber(asset.quantity, 1));
		const totalPositionValue = toFiniteNumber(
			asset.currentValue,
			toFiniteNumber(asset.currentPrice, 0) * quantity,
		);
		const currentPrice =
			quantity > 0
				? toFiniteNumber(asset.currentPrice, totalPositionValue / quantity)
				: toFiniteNumber(asset.currentPrice, 0);
		const avgCost = toFiniteNumber(asset.purchasePrice, currentPrice);
		const costBasis = avgCost * quantity;
		const totalReturn = totalPositionValue - costBasis;
		const totalReturnPercentage = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0;
		const dayChangePercentage = toFiniteNumber(asset.dayChangePercent, 0);

		const startPrice = currentPrice / (1 + dayChangePercentage / 100);
		const step = (currentPrice - startPrice) / 6;
		const fallbackSparkline = Array.from({ length: 7 }, (_, sparkIndex) =>
			Number((startPrice + step * sparkIndex).toFixed(4)),
		);
		const incomingSparkline = Array.isArray(asset.sparklineData)
			? asset.sparklineData.filter((point) => Number.isFinite(point)).slice(-7)
			: [];

		const providedWeight = toFiniteNumber(asset.portfolioWeight, -1);
		const computedWeight = totalValue > 0 ? (totalPositionValue / totalValue) * 100 : 0;

		return {
			id: asset.id || `stock-${index}`,
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
			account: asset.account || "Manual Entry",
			sector: asset.sector || "Needs metadata",
			currency: asset.currency || "USD",
			portfolioWeight: providedWeight >= 0 ? providedWeight : Number(computedWeight.toFixed(2)),
			dividendYield:
				typeof asset.dividendYield === "number" && Number.isFinite(asset.dividendYield)
					? asset.dividendYield
					: undefined,
			peRatio:
				typeof asset.peRatio === "number" && Number.isFinite(asset.peRatio)
					? asset.peRatio
					: undefined,
			sparklineData: incomingSparkline.length >= 2 ? incomingSparkline : fallbackSparkline,
		};
	});
}

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

	return points.map((point) => ({
		date: point.date,
		portfolioValue: point.portfolioValue,
		benchmarkValue: point.portfolioValue,
	}));
}

interface PortfolioHeroChartProps {
	data: PerformancePoint[];
	totalEquity: number;
	formatCurrency: (value: number) => string;
	timeRange: TimeRange;
	onTimeRangeChange: (range: TimeRange) => void;
	portfolioID?: string;
}

const PortfolioHeroChart = memo(function PortfolioHeroChart({
	data,
	totalEquity,
	formatCurrency,
	timeRange,
	onTimeRangeChange,
	portfolioID,
}: PortfolioHeroChartProps) {
	const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>("sp500");
	const benchmarkName =
		benchmarkMode === "sp500"
			? "S&P 500"
			: benchmarkMode === "nasdaq"
				? "NASDAQ 100"
				: benchmarkMode === "btc"
					? "Bitcoin"
					: "Benchmark";

	return (
		<div className="flex flex-col space-y-4">
			{/* ECharts Header */}
			<div className="flex flex-col justify-between gap-3 border-b border-border/10 pb-3 sm:flex-row sm:items-center">
				<div className="flex flex-col">
					<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
						Stocks & Funds Value
					</span>
					<div className="flex items-baseline gap-2">
						<span className="font-mono text-2xl font-bold tracking-tight text-foreground">
							{formatCurrency(totalEquity)}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="flex items-center rounded-full bg-secondary/35 border border-border/50 p-0.5 backdrop-blur-xs">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 gap-1 rounded-full px-2.5 text-[10px] text-muted-foreground hover:text-foreground"
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

						{(["1D", "7D", "1M", "3M", "YTD", "1Y", "ALL"] as const).map((range) => (
							<Button
								key={range}
								variant="ghost"
								size="sm"
								className={cn(
									"h-6 rounded-full px-2.5 text-[10px] font-semibold transition-all duration-200",
									timeRange === range
										? "bg-secondary-foreground/15 text-foreground shadow-xs font-bold"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => onTimeRangeChange(range)}
							>
								{range}
							</Button>
						))}
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
				/>
			</div>
		</div>
	);
});

// biome-ignore lint/correctness/noUnusedVariables: future use
const AllocationManager = memo(function AllocationManager({
	targetAllocations,
	actualBySector,
}: AllocationManagerProps) {
	const rows = targetAllocations.slice(0, 6);

	return (
		<Card className="border-border/60 bg-card/80">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-semibold">Allocation Manager</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{rows.map((target) => {
					const actual = toFiniteNumber(actualBySector[target.sector], 0);
					const variance = actual - target.targetPercentage;
					const offTarget = Math.abs(variance) > 5;

					return (
						<div key={target.sector} className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<div className="flex items-center gap-1.5">
									<span className="font-medium text-foreground">{target.sector}</span>
									{offTarget && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
								</div>
								<span className="font-mono text-muted-foreground">
									{actual.toFixed(1)}% / {target.targetPercentage.toFixed(1)}%
								</span>
							</div>
							<div className="relative h-2 overflow-hidden rounded-full bg-muted/40">
								<div
									className="absolute inset-y-0 left-0 rounded-full bg-blue-400/45"
									style={{
										width: `${Math.min(100, target.targetPercentage)}%`,
									}}
								/>
								<div
									className={cn(
										"absolute inset-y-0 left-0 rounded-full",
										offTarget ? "bg-amber-400/85" : "bg-emerald-500/85",
									)}
									style={{ width: `${Math.min(100, actual)}%` }}
								/>
							</div>
							<div className="text-[10px] text-muted-foreground">
								Variance: {formatPercentage(variance)}
							</div>
						</div>
					);
				})}
				{rows.length === 0 && (
					<p className="text-xs text-muted-foreground">
						Add sector metadata to see target vs actual allocation.
					</p>
				)}
			</CardContent>
		</Card>
	);
});

function getUpcomingQuarterDate(offset: number): Date {
	const now = new Date();
	const payoutMonths = [2, 5, 8, 11];
	const startMonth = now.getMonth();
	const currentYear = now.getFullYear();

	const upcomingMonth = payoutMonths.find((month) => month >= startMonth);
	const baseMonth = upcomingMonth ?? payoutMonths[0];
	const baseYear = upcomingMonth !== undefined ? currentYear : currentYear + 1;

	const date = new Date(baseYear, baseMonth, 15);
	date.setMonth(date.getMonth() + offset * 3);
	return date;
}

// biome-ignore lint/correctness/noUnusedVariables: future use
const DividendSummary = memo(function DividendSummary({
	assets,
	portfolioValue,
	formatCurrency,
}: DividendSummaryProps) {
	const dividendAssets = assets
		.filter((asset) => typeof asset.dividendYield === "number" && asset.dividendYield > 0)
		.sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0));

	const forwardAnnualDividend = dividendAssets.reduce((sum, asset) => {
		return sum + asset.totalValue * ((asset.dividendYield || 0) / 100);
	}, 0);

	const overallYield = portfolioValue > 0 ? (forwardAnnualDividend / portfolioValue) * 100 : 0;

	const upcomingPayouts = dividendAssets.slice(0, 3).map((asset, index) => {
		const estimatedAmount = (asset.totalValue * ((asset.dividendYield || 0) / 100)) / 4;
		return {
			symbol: asset.symbol,
			date: getUpcomingQuarterDate(index),
			estimatedAmount,
		};
	});

	return (
		<Card className="border-border/60 bg-card/80">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-semibold">Dividend Summary</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="rounded-md border border-border/40 bg-secondary/10 p-3">
					<p className="text-[11px] uppercase tracking-wider text-muted-foreground">
						Forward Annual Dividend
					</p>
					<p className="font-mono text-lg font-semibold">{formatCurrency(forwardAnnualDividend)}</p>
					<p className="text-xs text-muted-foreground">
						Overall Yield: {formatPercentage(overallYield)}
					</p>
				</div>

				<div className="space-y-2">
					<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<CalendarDays className="h-3.5 w-3.5" />
						Next 3 Payouts
					</div>
					{upcomingPayouts.length > 0 ? (
						upcomingPayouts.map((payout) => (
							<div
								key={`${payout.symbol}-${payout.date.toISOString()}`}
								className="flex items-center justify-between rounded border border-border/35 bg-secondary/5 px-2.5 py-1.5 text-xs"
							>
								<span className="font-medium">{payout.symbol}</span>
								<span className="font-mono text-muted-foreground">
									{payout.date.toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric",
									})}
								</span>
								<span className="font-mono">{formatCurrency(payout.estimatedAmount)}</span>
							</div>
						))
					) : (
						<p className="text-xs text-muted-foreground">
							No dividend yield data available for current holdings.
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
});

export function StocksFundsModule({
	onBack,
	onNavigateToTransactions,
	onSelectAccount,
	onSelectAsset,
	detailMode = "panel",
}: StocksFundsModuleProps) {
	const [activeTab, setActiveTab] = useState("positions");
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");
	const [insightFilter, setInsightFilter] = useState<InsightFilter | null>(null);
	// Defer the insight filter to prevent expensive positions table re-renders
	// from blocking the insight card interaction (e.g. sector click animation).
	const deferredInsightFilter = useDeferredValue(insightFilter);
	const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);

	const scrollToPositions = useCallback(() => {
		setTimeout(() => {
			const element = document.getElementById("positions-section");
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}, 80);
	}, []);

	const handleSelectAsset = useCallback(
		(symbol: string) => {
			if (detailMode === "panel") {
				setSelectedStockSymbol(symbol);
			} else {
				onSelectAsset?.(symbol);
			}
		},
		[detailMode, onSelectAsset],
	);

	const handleSetActiveTab = useCallback(
		(tab: string) => {
			setActiveTab(tab);
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
		return ["performance-drivers", "portfolio-health", "income-forecast"];
	});

	useEffect(() => {
		try {
			localStorage.setItem("sf_insight_selected_cards", JSON.stringify(selectedCards));
		} catch {}
	}, [selectedCards]);
	const { assets, addAsset, selectedPortfolio, addingAsset, currentPortfolio } = usePortfolio() as {
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
	};

	const normalizedAssets = useMemo(
		() => normalizeStockAssets(assets, currentPortfolio),
		[assets, currentPortfolio],
	);

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
			totalValue += asset.totalValue;
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

	const performanceHistory = selectedPortfolio?.analytics?.performanceHistory ?? [];
	const effectivePerformanceHistory = useMemo(() => {
		if (performanceHistory.length >= 2) {
			const lastHistoryValue = performanceHistory[performanceHistory.length - 1]?.value ?? 0;
			const ratio = lastHistoryValue > 0 ? totalValue / lastHistoryValue : 1;
			return performanceHistory.map((point) => ({
				...point,
				value: point.value * ratio,
			}));
		}
		if (performanceHistory.length === 1) {
			return [{ ...performanceHistory[0], value: totalValue }];
		}
		if (!selectedPortfolio) return performanceHistory;
		const now = new Date();
		const startD =
			selectedPortfolio.createdAt &&
			Number.isFinite(new Date(selectedPortfolio.createdAt).getTime())
				? new Date(selectedPortfolio.createdAt)
				: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
		return [
			{ date: startD.toISOString(), value: totalCost > 0 ? totalCost : totalValue },
			{ date: now.toISOString(), value: totalValue },
		];
	}, [performanceHistory, selectedPortfolio, totalValue, totalCost]);
	const performanceData = useMemo(
		() =>
			buildPerformanceSeries(
				effectivePerformanceHistory,
				selectedPortfolio?.analytics?.totalValue ?? totalValue,
			),
		[effectivePerformanceHistory, selectedPortfolio?.analytics?.totalValue, totalValue],
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

		let risk: "Low" | "Medium" | "High" = "Low";
		if (topHoldingPct > 25) risk = "High";
		else if (topHoldingPct > 15) risk = "Medium";

		return {
			risk,
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
		const nextMonthName = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
			"en-US",
			{ month: "long" },
		);

		return {
			forwardAnnual,
			overallYield,
			bestPayerSymbol: bestPayerAsset.symbol || bestPayerAsset.name,
			bestPayerAnnual,
			nextPayerSymbol: nextPayerAsset.symbol || nextPayerAsset.name,
			nextPaymentEst,
			nextMonthName,
		};
	}, [assetPrecomputed, totalValue]);

	const feesTerData = useMemo(() => {
		if (assetPrecomputed.fundAssets.length === 0) return null;
		const totalFundValue = assetPrecomputed.fundAssets.reduce((sum, a) => sum + a.totalValue, 0);
		return {
			count: assetPrecomputed.fundAssets.length,
			totalValue: totalFundValue,
			avgTer: 0.18,
			annualCost: totalFundValue * 0.0018,
		};
	}, [assetPrecomputed]);

	const rebalancingData = useMemo(() => {
		if (normalizedAssets.length === 0) return null;

		const targetWeights: Record<string, number> = {
			Technology: 35,
			Financials: 20,
			Healthcare: 15,
			"Consumer Discretionary": 15,
			Other: 15,
		};

		const sectorValues: Record<string, number> = {};
		for (const asset of normalizedAssets) {
			const sec = asset.sector || "Other";
			const canonicalSec = targetWeights[sec] !== undefined ? sec : "Other";
			sectorValues[canonicalSec] = (sectorValues[canonicalSec] ?? 0) + asset.totalValue;
		}

		let maxVariance = 0;
		let maxVarianceSector = "Other";
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
				return Math.abs(actualPct - targetWeights[sec]) > 5;
			}).length,
			totalVariance,
		};
	}, [normalizedAssets, totalValue]);

	const currencyExposure = useMemo(() => {
		if (normalizedAssets.length === 0) return [];
		return Array.from(assetPrecomputed.currencyValueMap.entries())
			.map(([currency, value]) => ({
				currency,
				value,
				percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
			}))
			.sort((a, b) => b.percentage - a.percentage);
	}, [normalizedAssets, totalValue, assetPrecomputed]);

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

	const { formatCurrencyCompact: formatCurrency } = useCurrency();

	const handleAddPosition = async (formData: {
		instrumentID?: string;
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
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs bg-secondary/20 hover:bg-secondary/40 border-border/40"
						>
							<Upload className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
							Import
						</Button>

						<Button
							size="sm"
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs"
							onClick={() => setIsAddOpen(true)}
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
			/>

			{/* Unified Dashboard Grid: Chart + Distribution side by side with vertical separator */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-10 border-b border-border/30 pb-6">
				{/* Unified Left Section: Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<PortfolioHeroChart
						data={performanceData}
						totalEquity={totalValue}
						formatCurrency={formatCurrency}
						timeRange={timeRange}
						onTimeRangeChange={setTimeRange}
						portfolioID={selectedPortfolio?.id}
					/>
				</div>

				{/* Unified Right Section: Distribution */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<StocksDistributionWidget
						assets={normalizedAssets}
						totalValue={totalValue}
						sectorValueMap={assetPrecomputed.sectorValueMap}
						currencyValueMap={assetPrecomputed.currencyValueMap}
						formatCurrency={formatCurrency}
						activeFilter={insightFilter}
						onSetFilter={handleSetInsightFilter}
						onSelectAsset={handleSelectAsset}
					/>
				</div>
			</div>

			{/* Insights Section */}
			<div className="flex flex-col space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h2 className="text-base font-bold tracking-tight text-foreground">Insights</h2>
					</div>

					<button
						type="button"
						onClick={() => setIsCustomizeOpen(true)}
						className="text-xs text-primary hover:text-primary/90 font-semibold flex items-center gap-1 cursor-pointer transition-colors bg-primary/10 hover:bg-primary/20 px-3 py-1 rounded-full border border-primary/20 shadow-xs"
					>
						<Sliders className="h-3 w-3" />
						<span>Customize Cockpit</span>
					</button>
				</div>

				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{selectedCards.length === 0 ? (
						<Card className="col-span-full border border-dashed border-border/50 bg-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-3 animate-in fade-in duration-300 min-h-[220px]">
							<div className="rounded-full bg-primary/10 p-3 text-primary border border-primary/20">
								<LayoutGrid className="h-6 w-6" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-semibold text-foreground">Cockpit Customized</p>
								<p className="text-xs text-muted-foreground max-w-sm">
									All insights cards are currently hidden. Click "Customize" to select which cards
									to display on your dashboard.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsCustomizeOpen(true)}
								className="h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/25 font-semibold mt-1"
							>
								Choose insights
							</Button>
						</Card>
					) : (
						selectedCards.map((cardId) => {
							const isRecommended = smartRecommendedCards.includes(cardId);
							switch (cardId) {
								case "performance-drivers":
									return (
										<PerformanceDriversCard
											key={cardId}
											cardId={cardId}
											performanceDrivers={performanceDrivers}
											isRecommended={isRecommended}
											formatCurrency={formatCurrency}
											setActiveTab={handleSetActiveTab}
										/>
									);
								case "portfolio-health":
									return (
										<PortfolioHealthCard
											key={cardId}
											cardId={cardId}
											portfolioHealth={portfolioHealth}
											isRecommended={isRecommended}
											setActiveTab={handleSetActiveTab}
										/>
									);
								case "income-forecast":
									return (
										<IncomeForecastCard
											key={cardId}
											cardId={cardId}
											incomeForecast={incomeForecast}
											isRecommended={isRecommended}
											formatCurrency={formatCurrency}
											setActiveTab={handleSetActiveTab}
										/>
									);
								case "fees-ter":
									return (
										<FeesTerCard
											key={cardId}
											cardId={cardId}
											feesTerData={feesTerData}
											isRecommended={isRecommended}
											formatCurrency={formatCurrency}
											setActiveTab={handleSetActiveTab}
										/>
									);
								case "rebalancing":
									return (
										<RebalancingCard
											key={cardId}
											cardId={cardId}
											rebalancingData={rebalancingData}
											isRecommended={isRecommended}
											setActiveTab={handleSetActiveTab}
										/>
									);
								case "currency-exposure":
									return (
										<CurrencyExposureCard
											key={cardId}
											cardId={cardId}
											currencyExposure={currencyExposure}
											isRecommended={isRecommended}
											formatCurrency={formatCurrency}
											setActiveTab={handleSetActiveTab}
										/>
									);
								case "missing-data":
									return (
										<MissingDataCard
											key={cardId}
											cardId={cardId}
											dataQuality={dataQuality}
											isRecommended={isRecommended}
											setInsightFilter={handleSetInsightFilter}
										/>
									);
								case "benchmark-comparison":
									return (
										<BenchmarkComparisonCard
											key={cardId}
											cardId={cardId}
											benchmarkComparison={benchmarkComparison}
											isRecommended={isRecommended}
											setActiveTab={handleSetActiveTab}
										/>
									);
								default:
									return null;
							}
						})
					)}
				</div>

				{/* Customize Insights Dialog Modal */}
				<Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
					<DialogContent className="max-w-2xl bg-card border border-border/60 p-6 overflow-hidden flex flex-col max-h-[85vh] shadow-xl rounded-2xl">
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
								{[
									{
										id: "performance-drivers",
										title: "Performance Drivers",
										description:
											"Explains why the portfolio moved with top contributors and worst draggers.",
										icon: TrendingUp,
									},
									{
										id: "portfolio-health",
										title: "Portfolio Health",
										description:
											"Evaluates risk rating, asset concentration, and missing sector metadata.",
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
										description:
											"Compares current sector allocations against targets to keep weights in line.",
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
								].map((card) => {
									const Icon = card.icon;
									const isSelected = selectedCards.includes(card.id);
									const isRecommended = smartRecommendedCards.includes(card.id);

									return (
										<button
											key={card.id}
											type="button"
											onClick={() => {
												if (isSelected) {
													setSelectedCards(selectedCards.filter((id) => id !== card.id));
												} else {
													setSelectedCards([...selectedCards, card.id]);
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
															<span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wider">
																Recommended
															</span>
														)}
													</div>
													<p className="text-[10px] text-muted-foreground leading-normal line-clamp-2">
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
								onClick={() =>
									setSelectedCards(["performance-drivers", "portfolio-health", "income-forecast"])
								}
								className="text-[10px] text-muted-foreground hover:text-foreground font-semibold px-2 py-1.5 transition-colors cursor-pointer bg-transparent border-0"
							>
								Reset to Smart Defaults
							</button>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="h-8 text-xs px-4"
									onClick={() => setIsCustomizeOpen(false)}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									className="h-8 text-xs px-4 bg-primary text-primary-foreground border-0 font-semibold"
									onClick={() => setIsCustomizeOpen(false)}
								>
									Save Changes
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{/* Bottom Segmented Tabs Control */}
			<div id="positions-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-6">
					<div className="flex p-0.5 rounded-lg bg-muted border border-border/40">
						<button
							type="button"
							onClick={() => setActiveTab("positions")}
							className={cn(
								"px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer focus:outline-hidden",
								activeTab === "positions"
									? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold shadow-xs"
									: "text-muted-foreground hover:text-foreground border border-transparent",
							)}
						>
							Accounts
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("transactions")}
							className={cn(
								"px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer focus:outline-hidden",
								activeTab === "transactions"
									? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold shadow-xs"
									: "text-muted-foreground hover:text-foreground border border-transparent",
							)}
						>
							Transactions
						</button>
					</div>
				</div>

				<div className="min-h-[520px]">
					{activeTab === "positions" ? (
						<StocksFundsPositions
							onSelectAccount={onSelectAccount}
							onSelectAsset={handleSelectAsset}
							externalFilter={deferredInsightFilter}
							onClearExternalFilter={() => setInsightFilter(null)}
						/>
					) : (
						<StocksFundsTransactions onNavigateToFullView={onNavigateToTransactions} />
					)}
				</div>
			</div>

			{/* Stocks Detail Panel */}
			<Sheet
				open={detailMode === "panel" && selectedStockSymbol !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedStockSymbol(null);
				}}
			>
				<SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
					<SheetHeader className="sr-only">
						<SheetTitle>Stock Details</SheetTitle>
						<SheetDescription>
							Detailed view of the selected stock position and historical performance chart.
						</SheetDescription>
					</SheetHeader>
					{selectedStockSymbol && (
						<StockDetail
							symbol={selectedStockSymbol}
							onBack={() => setSelectedStockSymbol(null)}
							isPanel={true}
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
