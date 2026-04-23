import ReactECharts from "echarts-for-react";
import {
	Activity,
	AlertTriangle,
	ArrowUpDown,
	CalendarDays,
	Package,
	Plus,
	Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import type { Asset as StockAsset, TargetAllocation } from "@/components/stocks-funds/types";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/utils/formatters";
import { AddStockForm } from "./AddStockForm";
import { StocksFundsPositions } from "./StocksFundsPositions";
import { StocksFundsTransactions } from "./StocksFundsTransactions";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent } from "./ui/tabs";

interface StocksFundsModuleProps {
	onBack?: () => void;
	onNavigateToTransactions?: () => void;
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
}

type TimeRange = "1D" | "1W" | "1M" | "YTD";

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

interface PortfolioHeroChartProps {
	data: PerformancePoint[];
	totalEquity: number;
	benchmarkName: string;
	formatCurrency: (value: number) => string;
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
			sector: asset.sector || "Other",
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

function filterByRange(data: PerformancePoint[], range: TimeRange): PerformancePoint[] {
	if (data.length === 0) return [];

	const now = new Date();
	let rangeStart = new Date(data[0].date);

	switch (range) {
		case "1D":
			rangeStart = new Date(now);
			rangeStart.setDate(now.getDate() - 1);
			break;
		case "1W":
			rangeStart = new Date(now);
			rangeStart.setDate(now.getDate() - 7);
			break;
		case "1M":
			rangeStart = new Date(now);
			rangeStart.setMonth(now.getMonth() - 1);
			break;
		case "YTD":
			rangeStart = new Date(now.getFullYear(), 0, 1);
			break;
	}

	const filtered = data.filter((point) => point.date >= rangeStart);
	if (filtered.length >= 2) return filtered;

	if (range === "1D") {
		return data.slice(-Math.min(12, data.length));
	}

	return data.slice(-Math.min(30, data.length));
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

	const startValue = toFiniteNumber(points[0]?.portfolioValue, fallbackValue || 1);
	const endValue = toFiniteNumber(
		points[points.length - 1]?.portfolioValue,
		fallbackValue || startValue,
	);
	const portfolioReturn = startValue > 0 ? (endValue - startValue) / startValue : 0;
	const benchmarkReturn = portfolioReturn * 0.8;

	return points.map((point, index) => {
		const progress = points.length > 1 ? index / (points.length - 1) : 1;
		const benchmarkValue = startValue * (1 + benchmarkReturn * progress);
		return {
			date: point.date,
			portfolioValue: point.portfolioValue,
			benchmarkValue,
		};
	});
}

function PortfolioHeroChart({
	data,
	totalEquity,
	benchmarkName,
	formatCurrency,
}: PortfolioHeroChartProps) {
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");
	const filteredData = useMemo(() => filterByRange(data, timeRange), [data, timeRange]);

	const chartOption = useMemo(() => {
		const labels = filteredData.map((point) =>
			point.date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
		);

		return {
			animation: true,
			tooltip: {
				trigger: "axis",
				backgroundColor: "rgba(10,10,10,0.92)",
				borderColor: "rgba(255,255,255,0.18)",
				textStyle: { color: "#fff" },
				valueFormatter: (value: number) => formatCurrency(value),
			},
			grid: {
				left: 10,
				right: 16,
				top: 60,
				bottom: 10,
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: labels,
				boundaryGap: false,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { color: "#9ca3af", fontSize: 10 },
			},
			yAxis: {
				type: "value",
				scale: true,
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
				axisLabel: {
					color: "#9ca3af",
					fontSize: 10,
					formatter: (value: number) =>
						new Intl.NumberFormat("en-US", {
							style: "currency",
							currency: "USD",
							notation: "compact",
							maximumFractionDigits: 1,
						}).format(value),
				},
			},
			series: [
				{
					name: "Portfolio",
					type: "line",
					smooth: true,
					showSymbol: false,
					lineStyle: {
						color: "#34d399",
						width: 2.2,
					},
					areaStyle: {
						color: {
							type: "linear",
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: "rgba(52,211,153,0.26)" },
								{ offset: 1, color: "rgba(52,211,153,0)" },
							],
						},
					},
					data: filteredData.map((point) => point.portfolioValue),
				},
				{
					name: benchmarkName,
					type: "line",
					smooth: true,
					showSymbol: false,
					lineStyle: {
						color: "#60a5fa",
						width: 1.6,
						type: "dashed",
					},
					data: filteredData.map((point) => point.benchmarkValue),
				},
			],
		};
	}, [filteredData, benchmarkName, formatCurrency]);

	const comparisonText = useMemo(() => {
		if (filteredData.length < 2) {
			return {
				text: `Benchmark delta will appear as more history builds`,
				className: "text-muted-foreground",
			};
		}

		const first = filteredData[0];
		const last = filteredData[filteredData.length - 1];
		const portfolioReturn =
			first.portfolioValue > 0
				? ((last.portfolioValue - first.portfolioValue) / first.portfolioValue) * 100
				: 0;
		const benchmarkReturn =
			first.benchmarkValue > 0
				? ((last.benchmarkValue - first.benchmarkValue) / first.benchmarkValue) * 100
				: 0;
		const delta = portfolioReturn - benchmarkReturn;

		if (delta >= 0) {
			return {
				text: `Outperforming ${benchmarkName} by ${formatPercentage(delta)}`,
				className: "text-emerald-500",
			};
		}

		return {
			text: `Underperforming ${benchmarkName} by ${formatPercentage(Math.abs(delta))}`,
			className: "text-rose-500",
		};
	}, [filteredData, benchmarkName]);

	return (
		<Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card/95 to-secondary/10">
			<CardContent className="relative h-[320px] p-4">
				<div className="absolute left-4 top-4 z-10">
					<p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						Total Equity
					</p>
					<h2 className="font-mono text-3xl font-bold tracking-tight">
						{formatCurrency(totalEquity)}
					</h2>
					<p className={cn("mt-1 text-xs font-medium", comparisonText.className)}>
						{comparisonText.text}
					</p>
				</div>

				<div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded border border-border/50 bg-background/70 p-1 backdrop-blur">
					{(["1D", "1W", "1M", "YTD"] as const).map((range) => (
						<Button
							key={range}
							variant={timeRange === range ? "secondary" : "ghost"}
							size="sm"
							className="h-6 px-2 text-[11px]"
							onClick={() => setTimeRange(range)}
						>
							{range}
						</Button>
					))}
				</div>

				<ReactECharts
					option={chartOption}
					notMerge={true}
					lazyUpdate={true}
					style={{ height: "100%", width: "100%" }}
					opts={{ renderer: "svg" }}
				/>
			</CardContent>
		</Card>
	);
}

function AllocationManager({ targetAllocations, actualBySector }: AllocationManagerProps) {
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
}

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

function DividendSummary({ assets, portfolioValue, formatCurrency }: DividendSummaryProps) {
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
}

export function StocksFundsModule({
	onNavigateToTransactions,
	onSelectAccount,
	onSelectAsset,
}: StocksFundsModuleProps) {
	const [activeTab, setActiveTab] = useState("positions");
	const [isAddOpen, setIsAddOpen] = useState(false);
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
			analytics?: {
				totalValue?: number;
				totalCost?: number;
				performanceHistory?: Array<{ date: string; value: number }>;
			};
		} | null;
		addingAsset: boolean;
		currentPortfolio: string;
	};

	const normalizedAssets = useMemo(
		() => normalizeStockAssets(assets, currentPortfolio),
		[assets, currentPortfolio],
	);

	const totalValue = normalizedAssets.reduce((sum, asset) => sum + asset.totalValue, 0);
	const totalCost = normalizedAssets.reduce(
		(sum, asset) => sum + asset.avgCost * asset.quantity,
		0,
	);
	const totalGain = totalValue - totalCost;
	const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

	const performanceHistory = selectedPortfolio?.analytics?.performanceHistory ?? [];
	const performanceData = useMemo(
		() =>
			buildPerformanceSeries(
				performanceHistory,
				selectedPortfolio?.analytics?.totalValue ?? totalValue,
			),
		[performanceHistory, selectedPortfolio?.analytics?.totalValue, totalValue],
	);

	const sectorTotals = useMemo(() => {
		const grouped: Record<string, number> = {};
		normalizedAssets.forEach((asset) => {
			grouped[asset.sector] = (grouped[asset.sector] || 0) + asset.totalValue;
		});
		return grouped;
	}, [normalizedAssets]);

	const actualBySector = useMemo(() => {
		const percentages: Record<string, number> = {};
		Object.entries(sectorTotals).forEach(([sector, value]) => {
			percentages[sector] = totalValue > 0 ? (value / totalValue) * 100 : 0;
		});
		return percentages;
	}, [sectorTotals, totalValue]);

	const targetAllocations = useMemo<TargetAllocation[]>(() => {
		const defaultTargets: Record<string, number> = {
			Technology: 30,
			Healthcare: 15,
			Financials: 15,
			Consumer: 15,
			Industrial: 10,
			Energy: 10,
			Other: 5,
		};

		const sectors = Object.entries(actualBySector).sort((a, b) => b[1] - a[1]);
		if (sectors.length === 0) {
			return [
				{ sector: "Technology", targetPercentage: 30 },
				{ sector: "Healthcare", targetPercentage: 20 },
				{ sector: "Financials", targetPercentage: 20 },
				{ sector: "Other", targetPercentage: 30 },
			];
		}

		if (sectors.length === 1) {
			const [onlySector, onlyActual] = sectors[0];
			return [
				{
					sector: onlySector,
					targetPercentage: Number(onlyActual.toFixed(1)),
				},
			];
		}

		return sectors.map(([sector, actual]) => ({
			sector,
			targetPercentage: defaultTargets[sector] ?? Number(actual.toFixed(1)),
		}));
	}, [actualBySector]);

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
		<div className="animate-in fade-in flex h-full flex-col space-y-4 duration-500">
			<div className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
						<Activity className="h-5 w-5 text-emerald-500" />
					</div>
					<div>
						<h1 className="text-xl font-bold tracking-tight">Stocks & Funds</h1>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
								Market Open
							</span>
							<span>•</span>
							<span>Updated from live holdings</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="hidden rounded-lg border bg-secondary/50 p-1 md:flex">
						<Button
							variant={activeTab === "positions" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("positions")}
							className="h-7 text-xs"
						>
							<Package className="mr-2 h-3.5 w-3.5" />
							Positions
						</Button>
						<Button
							variant={activeTab === "transactions" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("transactions")}
							className="h-7 text-xs"
						>
							<ArrowUpDown className="mr-2 h-3.5 w-3.5" />
							Ledger
						</Button>
					</div>

					<div className="mx-2 hidden h-6 w-px bg-border md:block" />

					<Button variant="outline" size="sm" className="h-9">
						<Upload className="mr-2 h-3.5 w-3.5" />
						Import
					</Button>

					<Button
						size="sm"
						className="h-9 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
						onClick={() => setIsAddOpen(true)}
						disabled={addingAsset}
					>
						<Plus className="mr-2 h-3.5 w-3.5" />
						{addingAsset ? "Adding..." : "Add Position"}
					</Button>

					<AddStockForm
						open={isAddOpen}
						onClose={() => setIsAddOpen(false)}
						onSubmit={handleAddPosition}
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<PortfolioHeroChart
						data={performanceData}
						totalEquity={totalValue}
						benchmarkName="S&P 500"
						formatCurrency={formatCurrency}
					/>
				</div>

				<div className="space-y-4">
					<Card className="border-border/60 bg-card/80">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-semibold">Snapshot</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-3 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Total Return</span>
								<span
									className={cn(
										"font-mono font-semibold",
										totalGain >= 0 ? "text-emerald-500" : "text-rose-500",
									)}
								>
									{totalGain >= 0 ? "+" : ""}
									{formatCurrency(totalGain)}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Total Return %</span>
								<span
									className={cn(
										"font-mono font-semibold",
										totalGainPercent >= 0 ? "text-emerald-500" : "text-rose-500",
									)}
								>
									{formatPercentage(totalGainPercent)}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Cost Basis</span>
								<span className="font-mono font-semibold">{formatCurrency(totalCost)}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Holdings</span>
								<span className="font-mono font-semibold">{normalizedAssets.length}</span>
							</div>
						</CardContent>
					</Card>

					<AllocationManager
						targetAllocations={targetAllocations}
						actualBySector={actualBySector}
					/>

					<DividendSummary
						assets={normalizedAssets}
						portfolioValue={totalValue}
						formatCurrency={formatCurrency}
					/>
				</div>
			</div>

			<div className="min-h-[520px]">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
					<TabsContent value="positions" className="mt-0 h-full focus-visible:outline-none">
						<StocksFundsPositions onSelectAccount={onSelectAccount} onSelectAsset={onSelectAsset} />
					</TabsContent>
					<TabsContent value="transactions" className="mt-0 h-full focus-visible:outline-none">
						<StocksFundsTransactions onNavigateToFullView={onNavigateToTransactions} />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
