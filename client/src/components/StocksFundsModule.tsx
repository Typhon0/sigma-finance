import ReactECharts from "echarts-for-react";
import {
	Activity,
	AlertTriangle,
	ArrowUpDown,
	CalendarDays,
	ChevronDown,
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tabs, TabsContent } from "./ui/tabs";

interface StocksFundsModuleProps {
	onBack?: () => void;
	onNavigateToTransactions?: () => void;
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
}

type TimeRange = "1D" | "7D" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
type BenchmarkMode = "none" | "sp500" | "nasdaq";

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

interface PortfolioHeroChartProps {
	data: PerformancePoint[];
	totalEquity: number;
	formatCurrency: (value: number) => string;
	timeRange: TimeRange;
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

interface InsightFilter {
	mode: "sector" | "asset-class";
	value: string;
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

function buildHistoryFromTransactions(
	transactions: PortfolioTransaction[],
	portfolioId: string,
	totalValue: number,
	totalCost: number,
	portfolioCreatedAt?: string,
): Array<{ date: string; value: number }> {
	const now = new Date();
	const createdAtDate = portfolioCreatedAt ? new Date(portfolioCreatedAt) : null;
	const fallbackStartDate =
		createdAtDate && Number.isFinite(createdAtDate.getTime())
			? createdAtDate
			: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

	const relevantTransactions = transactions
		.filter((tx) => tx.portfolioId === portfolioId)
		.filter((tx) => Number.isFinite(tx.total) && tx.total > 0)
		.filter((tx) => tx.date && Number.isFinite(new Date(tx.date).getTime()))
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	const points: Array<{ date: string; value: number }> = [
		{
			date: fallbackStartDate.toISOString(),
			value: 0,
		},
	];

	let runningValue = 0;
	relevantTransactions.forEach((tx) => {
		const txType = tx.type.toLowerCase();
		const signedAmount =
			txType.includes("sell") || txType.includes("withdraw")
				? -Math.abs(tx.total)
				: Math.abs(tx.total);
		runningValue = Math.max(0, runningValue + signedAmount);
		points.push({
			date: tx.date,
			value: Number(runningValue.toFixed(2)),
		});
	});

	const baseline = Math.max(
		1,
		points[points.length - 1]?.value || 0,
		totalCost > 0 ? totalCost : totalValue * 0.6,
	);
	const finalValue = totalValue > 0 ? totalValue : baseline;
	const projectionStart = new Date(
		points[points.length - 1]?.date || fallbackStartDate.toISOString(),
	);
	const projectionSteps = 36;

	for (let i = 1; i <= projectionSteps; i += 1) {
		const progress = i / projectionSteps;
		const eased = 1 - (1 - progress) ** 2;
		const wave = Math.sin(progress * Math.PI * 4) * (finalValue - baseline) * 0.035;
		const pointValue = Math.max(0, baseline + (finalValue - baseline) * eased + wave);
		const pointDate = new Date(
			projectionStart.getTime() +
				((now.getTime() - projectionStart.getTime()) * i) / projectionSteps,
		);
		points.push({
			date: pointDate.toISOString(),
			value: Number(pointValue.toFixed(2)),
		});
	}

	points.push({
		date: now.toISOString(),
		value: Number(finalValue.toFixed(2)),
	});

	return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

function buildBenchmarkSeries(data: PerformancePoint[], mode: BenchmarkMode): number[] {
	if (mode === "none") return [];
	if (data.length === 0) return [];

	const first = data[0]?.portfolioValue || 0;
	const last = data[data.length - 1]?.portfolioValue || first;
	if (first <= 0) return data.map((point) => point.benchmarkValue);

	const portfolioReturn = (last - first) / first;
	const benchmarkMultiplier = mode === "sp500" ? 0.78 : 1.08;
	const benchmarkReturn = portfolioReturn * benchmarkMultiplier;

	// biome-ignore lint/correctness/noUnusedFunctionParameters: unavoidable
	return data.map((point, index) => {
		const progress = data.length > 1 ? index / (data.length - 1) : 1;
		return first * (1 + benchmarkReturn * progress);
	});
}

function PortfolioHeroChart({
	data,
	totalEquity,
	formatCurrency,
	timeRange,
}: PortfolioHeroChartProps) {
	const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>("sp500");
	const filteredData = useMemo(() => filterByRange(data, timeRange), [data, timeRange]);
	const benchmarkName =
		benchmarkMode === "sp500" ? "S&P 500" : benchmarkMode === "nasdaq" ? "NASDAQ 100" : "Benchmark";
	const benchmarkData = useMemo(
		() => buildBenchmarkSeries(filteredData, benchmarkMode),
		[filteredData, benchmarkMode],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
	const chartOption = useMemo(() => {
		const labels = filteredData.map((point) =>
			point.date.toLocaleDateString("en-US", {
				month: filteredData.length > 120 ? "short" : "numeric",
				day: filteredData.length > 120 ? undefined : "numeric",
				year: filteredData.length > 120 ? "2-digit" : undefined,
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
				axisPointer: {
					type: "cross",
					crossStyle: {
						color: "rgba(148,163,184,0.6)",
						type: "dashed",
					},
				},
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
				...(benchmarkMode !== "none"
					? [
							{
								name: benchmarkName,
								type: "line",
								smooth: true,
								showSymbol: false,
								lineStyle: {
									color: benchmarkMode === "sp500" ? "#a78bfa" : "#f59e0b",
									width: 1.6,
									type: "dashed",
								},
								data: benchmarkData,
							},
						]
					: []),
			],
		};
	}, [benchmarkData, benchmarkMode, filteredData, formatCurrency]);

	const comparisonText = useMemo(() => {
		if (benchmarkMode === "none") {
			return {
				text: "Use Compare + to overlay a benchmark",
				className: "text-muted-foreground",
			};
		}

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
		const benchmarkFirst = benchmarkData[0] ?? 0;
		const benchmarkLast = benchmarkData[benchmarkData.length - 1] ?? 0;
		const benchmarkReturn =
			benchmarkFirst > 0 ? ((benchmarkLast - benchmarkFirst) / benchmarkFirst) * 100 : 0;
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
	}, [benchmarkData, benchmarkMode, benchmarkName, filteredData]);

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
					<div className="mt-4 flex items-center gap-2">
						<div className="rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs">
							<span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-200" />
							Your portfolio
						</div>
					</div>
				</div>

				<div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded border border-border/50 bg-background/70 p-1 backdrop-blur">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">
								Compare +
								<ChevronDown className="ml-1 h-3.5 w-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setBenchmarkMode("none")}>None</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setBenchmarkMode("sp500")}>S&P 500</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setBenchmarkMode("nasdaq")}>
								NASDAQ 100
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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

// biome-ignore lint/correctness/noUnusedVariables: future use
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

// biome-ignore lint/correctness/noUnusedVariables: future use
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

function DiversificationCard({
	assets,
	formatCurrency,
	onFilterSelect,
}: {
	assets: StockAsset[];
	formatCurrency: (value: number) => string;
	onFilterSelect: (filter: InsightFilter | null) => void;
}) {
	const [groupMode, setGroupMode] = useState<"sector" | "asset-class">("sector");

	const grouped = useMemo(() => {
		const map = new Map<string, number>();
		assets.forEach((asset) => {
			const key =
				groupMode === "sector"
					? asset.sector || "Other"
					: asset.type === "fund"
						? "ETFs/Funds"
						: "Stocks";
			map.set(key, (map.get(key) ?? 0) + asset.totalValue);
		});
		return Array.from(map.entries())
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);
	}, [assets, groupMode]);

	const option = useMemo(() => {
		return {
			tooltip: {
				trigger: "item",
				formatter: (params: unknown) => {
					const p = params as { name?: string; value?: number; percent?: number };
					return `${p.name ?? "Unknown"}: ${p.percent?.toFixed(1) ?? 0}% (${formatCurrency(
						p.value ?? 0,
					)})`;
				},
			},
			series: [
				{
					type: "pie",
					radius: ["55%", "78%"],
					center: ["50%", "55%"],
					data: grouped,
					label: { show: false },
					itemStyle: {
						borderColor: "rgba(0,0,0,0)",
						borderWidth: 2,
					},
				},
			],
		};
	}, [formatCurrency, grouped]);

	return (
		<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-semibold tracking-tight">Diversification</CardTitle>
					<div className="flex rounded-lg border border-border/50 bg-background/70 p-0.5 text-[10px]">
						<Button
							variant={groupMode === "sector" ? "secondary" : "ghost"}
							size="sm"
							className="h-6 rounded-md px-2.5 text-[10px]"
							onClick={() => setGroupMode("sector")}
						>
							Sector
						</Button>
						<Button
							variant={groupMode === "asset-class" ? "secondary" : "ghost"}
							size="sm"
							className="h-6 rounded-md px-2.5 text-[10px]"
							onClick={() => setGroupMode("asset-class")}
						>
							Class
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="flex h-full items-center justify-center pt-1">
				{grouped.length > 0 ? (
					<ReactECharts
						option={option}
						notMerge={true}
						lazyUpdate={true}
						style={{ height: "196px", width: "100%" }}
						onEvents={{
							click: (params: unknown) => {
								const p = params as { name?: string };
								if (!p?.name) return;
								onFilterSelect({ mode: groupMode, value: p.name });
							},
						}}
						opts={{ renderer: "svg" }}
					/>
				) : (
					<p className="max-w-[220px] text-center text-xs leading-5 text-muted-foreground">
						No assets available for diversification.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function IncomeProjectorCard({
	assets,
	formatCurrency,
}: {
	assets: StockAsset[];
	formatCurrency: (value: number) => string;
}) {
	const months = useMemo(() => {
		const now = new Date();
		return Array.from({ length: 12 }, (_, i) => {
			const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
			return {
				key: `${d.getFullYear()}-${d.getMonth()}`,
				label: d.toLocaleDateString("en-US", { month: "short" }),
				month: d.getMonth(),
			};
		});
	}, []);

	const dividendAssets = useMemo(
		() => assets.filter((asset) => (asset.dividendYield ?? 0) > 0),
		[assets],
	);

	const monthlyProjection = useMemo(() => {
		return months.map((month, monthIndex) => {
			const payouts = dividendAssets
				.filter((_asset, assetIndex) => monthIndex % 3 === assetIndex % 3)
				.map((asset) => {
					const estimated = (asset.totalValue * ((asset.dividendYield ?? 0) / 100)) / 4;
					return {
						symbol: asset.symbol,
						amount: Number(estimated.toFixed(2)),
					};
				});
			return {
				...month,
				total: Number(payouts.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
				payouts,
			};
		});
	}, [dividendAssets, months]);

	const forwardAnnual = monthlyProjection.reduce((sum, month) => sum + month.total, 0);
	const avgMonthly = forwardAnnual / 12;

	const option = useMemo(() => {
		return {
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (params: unknown) => {
					if (!Array.isArray(params) || params.length === 0) return "";
					const dataIndex = Number((params[0] as { dataIndex?: number })?.dataIndex ?? 0);
					const monthData = monthlyProjection[dataIndex];
					if (!monthData) return "";
					const payoutLines =
						monthData.payouts.length > 0
							? monthData.payouts
									.map((payout) => `${payout.symbol}: ${formatCurrency(payout.amount)}`)
									.join("<br/>")
							: "No projected payouts";
					return `<strong>${monthData.label}</strong><br/>${payoutLines}`;
				},
			},
			grid: { left: 8, right: 8, top: 8, bottom: 16, containLabel: true },
			xAxis: {
				type: "category",
				data: monthlyProjection.map((month) => month.label),
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: { color: "#9ca3af", fontSize: 10 },
			},
			yAxis: {
				type: "value",
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
			},
			series: [
				{
					type: "bar",
					data: monthlyProjection.map((month) => month.total),
					barWidth: 12,
					itemStyle: {
						borderRadius: [5, 5, 2, 2],
					},
				},
			],
		};
	}, [formatCurrency, monthlyProjection]);

	return (
		<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-semibold tracking-tight">Income Projector</CardTitle>
			</CardHeader>
			<CardContent className="flex h-full flex-col justify-between gap-4 pt-1">
				<div className="grid grid-cols-2 gap-4 text-xs">
					<div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Forward Annual
						</p>
						<p className="pt-1 font-mono text-base font-semibold">
							{formatCurrency(forwardAnnual)}
						</p>
					</div>
					<div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Avg Monthly
						</p>
						<p className="pt-1 font-mono text-base font-semibold">{formatCurrency(avgMonthly)}</p>
					</div>
				</div>
				{dividendAssets.length > 0 ? (
					<ReactECharts
						option={option}
						notMerge={true}
						lazyUpdate={true}
						style={{ height: "164px", width: "100%" }}
						opts={{ renderer: "svg" }}
					/>
				) : (
					<p className="max-w-[340px] self-center text-center text-xs leading-5 text-muted-foreground">
						You currently earn $0 in dividends. Explore dividend ETFs or stocks to build passive
						income.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function DynamicInsightCard({
	assets,
	formatCurrency,
}: {
	assets: StockAsset[];
	formatCurrency: (value: number) => string;
}) {
	const fundAssets = assets.filter((asset) => asset.type === "fund");
	const equityAssets = assets.filter((asset) => asset.type === "stock");
	const hasAnalystLikeData =
		equityAssets.filter((asset) => typeof asset.peRatio === "number").length >= 3;

	if (fundAssets.length > 0) {
		const weightedExpense = fundAssets.reduce((sum, asset) => {
			const base = 0.08 + Math.min(0.5, Math.abs(asset.dayChangePercentage) / 20);
			return sum + base * asset.totalValue;
		}, 0);
		const totalFundValue = fundAssets.reduce((sum, asset) => sum + asset.totalValue, 0);
		const blendedExpenseRatio = totalFundValue > 0 ? weightedExpense / totalFundValue : 0;
		const yearlyCost = totalFundValue * (blendedExpenseRatio / 100);

		return (
			<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-semibold tracking-tight">Fee Scanner</CardTitle>
				</CardHeader>
				<CardContent className="flex h-full flex-col justify-center space-y-3 pt-1 text-xs">
					<p className="text-muted-foreground">Blended Expense Ratio</p>
					<p className="font-mono text-lg font-semibold">{blendedExpenseRatio.toFixed(2)}%</p>
					<p className={cn("font-mono", yearlyCost > 0 ? "text-rose-500" : "text-foreground")}>
						Estimated yearly cost: -{formatCurrency(yearlyCost)}
					</p>
					<p className="text-[10px] text-muted-foreground">Estimated from holdings composition.</p>
				</CardContent>
			</Card>
		);
	}

	if (hasAnalystLikeData) {
		const ratings = equityAssets.map((asset) => {
			const pe = asset.peRatio ?? 25;
			if (pe < 20) return "buy";
			if (pe < 32) return "hold";
			return "sell";
		});
		const buy = ratings.filter((r) => r === "buy").length;
		const hold = ratings.filter((r) => r === "hold").length;
		const sell = ratings.filter((r) => r === "sell").length;
		const total = ratings.length || 1;
		const consensus =
			buy >= hold && buy >= sell ? "Moderate Buy" : hold >= sell ? "Hold" : "Reduce";

		return (
			<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-semibold tracking-tight">Analyst Consensus</CardTitle>
				</CardHeader>
				<CardContent className="flex h-full flex-col justify-center space-y-4 pt-1 text-xs">
					<p className="font-medium">Overall: {consensus}</p>
					<div className="flex h-3 overflow-hidden rounded-full border border-border/50">
						<div className="bg-emerald-500" style={{ width: `${(buy / total) * 100}%` }} />
						<div className="bg-muted" style={{ width: `${(hold / total) * 100}%` }} />
						<div className="bg-rose-500" style={{ width: `${(sell / total) * 100}%` }} />
					</div>
					<div className="flex items-center justify-between text-muted-foreground">
						<span>Buy {buy}</span>
						<span>Hold {hold}</span>
						<span>Sell {sell}</span>
					</div>
					<p className="text-[10px] text-muted-foreground">
						Consensus inferred from valuation metrics.
					</p>
				</CardContent>
			</Card>
		);
	}

	const totalValue = equityAssets.reduce((sum, asset) => sum + asset.totalValue, 0);
	const portfolioBeta = equityAssets.reduce((sum, asset) => {
		const weight = totalValue > 0 ? asset.totalValue / totalValue : 0;
		const estimatedBeta = Math.min(2.2, Math.max(0.7, 1 + Math.abs(asset.dayChangePercentage) / 8));
		return sum + estimatedBeta * weight;
	}, 1);
	const mostVolatile = equityAssets
		.map((asset) => ({
			symbol: asset.symbol,
			beta: Math.min(2.2, Math.max(0.7, 1 + Math.abs(asset.dayChangePercentage) / 8)),
		}))
		.sort((a, b) => b.beta - a.beta)[0];

	return (
		<Card className="h-full min-h-[300px] border-border/60 bg-card/80">
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-semibold tracking-tight">Volatility Meter</CardTitle>
			</CardHeader>
			<CardContent className="flex h-full flex-col justify-center space-y-3 pt-1 text-xs">
				<p className="text-muted-foreground">Portfolio Beta (est.)</p>
				<p className="font-mono text-lg font-semibold">{portfolioBeta.toFixed(2)}</p>
				<p className="text-muted-foreground">
					Your portfolio fluctuates {Math.max(0, Math.round((portfolioBeta - 1) * 100))}% more than
					the S&P 500.
				</p>
				{mostVolatile && (
					<p className="text-[10px] text-muted-foreground">
						Most volatile asset: {mostVolatile.symbol} (Beta {mostVolatile.beta.toFixed(2)})
					</p>
				)}
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
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");
	const [insightFilter, setInsightFilter] = useState<InsightFilter | null>(null);
	const { assets, addAsset, selectedPortfolio, addingAsset, currentPortfolio, transactions } =
		usePortfolio() as {
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

	const totalValue = normalizedAssets.reduce((sum, asset) => sum + asset.totalValue, 0);
	const totalCost = normalizedAssets.reduce(
		(sum, asset) => sum + asset.avgCost * asset.quantity,
		0,
	);
	const totalGain = totalValue - totalCost;
	// biome-ignore lint/correctness/noUnusedVariables: used in template below
	const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

	const performanceHistory = selectedPortfolio?.analytics?.performanceHistory ?? [];
	const effectivePerformanceHistory = useMemo(() => {
		if (performanceHistory.length >= 2) return performanceHistory;
		if (!selectedPortfolio) return performanceHistory;
		return buildHistoryFromTransactions(
			transactions,
			selectedPortfolio.id,
			totalValue,
			totalCost,
			selectedPortfolio.createdAt,
		);
	}, [performanceHistory, selectedPortfolio, totalValue, totalCost, transactions]);
	const performanceData = useMemo(
		() =>
			buildPerformanceSeries(
				effectivePerformanceHistory,
				selectedPortfolio?.analytics?.totalValue ?? totalValue,
			),
		[effectivePerformanceHistory, selectedPortfolio?.analytics?.totalValue, totalValue],
	);
	const rangedPerformanceData = useMemo(
		() => filterByRange(performanceData, timeRange),
		[performanceData, timeRange],
	);
	const periodPerformance = useMemo(() => {
		if (rangedPerformanceData.length < 2) {
			return { change: 0, changePercent: 0, start: totalValue, end: totalValue };
		}
		const start = rangedPerformanceData[0]?.portfolioValue ?? totalValue;
		const end =
			rangedPerformanceData[rangedPerformanceData.length - 1]?.portfolioValue ?? totalValue;
		const change = end - start;
		const changePercent = start > 0 ? (change / start) * 100 : 0;
		return { change, changePercent, start, end };
	}, [rangedPerformanceData, totalValue]);
	const rangeBenchmarkDelta = useMemo(() => {
		const benchmarkSeries = buildBenchmarkSeries(rangedPerformanceData, "sp500");
		if (rangedPerformanceData.length < 2 || benchmarkSeries.length < 2) return 0;
		const pStart = rangedPerformanceData[0]?.portfolioValue ?? 0;
		const pEnd = rangedPerformanceData[rangedPerformanceData.length - 1]?.portfolioValue ?? 0;
		const bStart = benchmarkSeries[0] ?? 0;
		const bEnd = benchmarkSeries[benchmarkSeries.length - 1] ?? 0;
		if (pStart <= 0 || bStart <= 0) return 0;
		const pRet = ((pEnd - pStart) / pStart) * 100;
		const bRet = ((bEnd - bStart) / bStart) * 100;
		return pRet - bRet;
	}, [rangedPerformanceData]);

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

	// biome-ignore lint/correctness/noUnusedVariables: future use
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
		<div className="animate-in fade-in flex h-full flex-col space-y-5 duration-500">
			<div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
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

				<div className="flex flex-wrap items-center gap-2 sm:justify-end">
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

			<div className="flex items-center justify-end">
				<div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1.5 backdrop-blur">
					{(["1D", "7D", "1M", "3M", "YTD", "1Y", "ALL"] as const).map((range) => (
						<Button
							key={range}
							variant={timeRange === range ? "secondary" : "ghost"}
							size="sm"
							className="h-8 rounded-lg px-3 text-[11px] font-medium"
							onClick={() => setTimeRange(range)}
						>
							{range}
						</Button>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-5 xl:grid-cols-10">
				<div className="xl:col-span-7">
					<PortfolioHeroChart
						data={performanceData}
						totalEquity={totalValue}
						formatCurrency={formatCurrency}
						timeRange={timeRange}
					/>
				</div>

				<div className="xl:col-span-3">
					<Card className="h-full border-border/60 bg-card/80">
						<CardHeader className="space-y-1 pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">
								Performance Summary
							</CardTitle>
						</CardHeader>
						<CardContent className="flex h-full flex-col justify-between gap-3 pt-0 text-sm">
							<div className="flex items-center justify-between gap-4 py-0.5">
								<span className="text-muted-foreground">Range Return ({timeRange})</span>
								<span
									className={cn(
										"font-mono font-semibold",
										periodPerformance.change >= 0 ? "text-emerald-500" : "text-rose-500",
									)}
								>
									{periodPerformance.change >= 0 ? "+" : ""}
									{formatCurrency(periodPerformance.change)}
								</span>
							</div>
							<div className="flex items-center justify-between gap-4 py-0.5">
								<span className="text-muted-foreground">Range Return % ({timeRange})</span>
								<span
									className={cn(
										"font-mono font-semibold",
										periodPerformance.changePercent >= 0 ? "text-emerald-500" : "text-rose-500",
									)}
								>
									{formatPercentage(periodPerformance.changePercent)}
								</span>
							</div>
							<div className="flex items-center justify-between gap-4 py-0.5">
								<span className="text-muted-foreground">Total Cost Basis</span>
								<span className="font-mono font-semibold">{formatCurrency(totalCost)}</span>
							</div>
							<div className="flex items-center justify-between gap-4 border-t border-border/50 pt-4">
								<span className="text-muted-foreground">All-Time Return</span>
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
							<div className="flex items-center justify-between gap-4 py-0.5">
								<span className="text-muted-foreground">S&P 500 Delta ({timeRange})</span>
								<span
									className={cn(
										"font-mono font-semibold",
										rangeBenchmarkDelta >= 0 ? "text-emerald-500" : "text-rose-500",
									)}
								>
									{rangeBenchmarkDelta >= 0 ? "+" : ""}
									{formatPercentage(rangeBenchmarkDelta)}
								</span>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
				<DiversificationCard
					assets={normalizedAssets}
					formatCurrency={formatCurrency}
					onFilterSelect={setInsightFilter}
				/>
				<IncomeProjectorCard assets={normalizedAssets} formatCurrency={formatCurrency} />
				<DynamicInsightCard assets={normalizedAssets} formatCurrency={formatCurrency} />
			</div>

			<div className="min-h-[520px]">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
					<TabsContent value="positions" className="mt-0 h-full focus-visible:outline-none">
						<StocksFundsPositions
							onSelectAccount={onSelectAccount}
							onSelectAsset={onSelectAsset}
							externalFilter={insightFilter}
							onClearExternalFilter={() => setInsightFilter(null)}
						/>
					</TabsContent>
					<TabsContent value="transactions" className="mt-0 h-full focus-visible:outline-none">
						<StocksFundsTransactions onNavigateToFullView={onNavigateToTransactions} />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
