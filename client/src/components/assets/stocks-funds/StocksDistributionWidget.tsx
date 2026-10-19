import ReactECharts from "echarts-for-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, ChevronDown, Layers, LayoutGrid, PieChart, Sparkles, X } from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { Asset as StockAsset } from "@/components/stocks-funds/types";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getChartColors, getChartThemeColors, hexToRgbTriplet } from "@/lib/chart-colors";
import { allocatePercentages } from "@/lib/money/rounding";
import { cn } from "@/lib/utils";

/**
 * Categorical series colors for the allocation charts, resolved from the
 * theme's chart tokens (DESIGN.md: series draw from `--chart-1…5` per theme).
 * Resolved at call time because ECharts needs concrete color strings and
 * cannot resolve CSS custom properties.
 */
export function getDistributionColors(): { series: string[]; others: string } {
	return {
		series: getChartColors(),
		others: getChartThemeColors().mutedForeground,
	};
}

/** Ink for a label sitting on a filled tile: dark on light fills, white on dark. */
function contrastInkFor(hexColor: string): string {
	const value = hexColor.replace("#", "");
	const full =
		value.length === 3
			? value
					.split("")
					.map((c) => c + c)
					.join("")
			: value.slice(0, 6);
	const int = Number.parseInt(full, 16);
	if (Number.isNaN(int)) {
		return "#ffffff";
	}
	const channel = (raw: number): number => {
		const c = raw / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance =
		0.2126 * channel((int >> 16) & 255) +
		0.7152 * channel((int >> 8) & 255) +
		0.0722 * channel(int & 255);
	return luminance >= 0.19 ? "#111318" : "#ffffff";
}

export interface InsightFilter {
	mode: "sector" | "asset-class" | "type" | "asset";
	value: string;
	label?: string;
}

export interface StocksDistributionWidgetProps {
	assets: StockAsset[];
	totalValue: number;
	sectorValueMap: Map<string, number>;
	currencyValueMap?: Map<string, number>;
	formatCurrency: (val: number) => string;
	activeFilter?: InsightFilter | null;
	onSetFilter?: (filter: InsightFilter | null) => void;
	onSelectAsset?: (symbol: string) => void;
	/** Renders a layout-stable placeholder instead of the empty state. */
	loading?: boolean;
}

type DistributionMode = "asset" | "sector" | "type";
type ChartViewType = "donut" | "treemap" | "bars";

interface DistributionItem {
	name: string;
	value: number;
	percent: number;
	color: string;
	isOthers?: boolean;
	count?: number;
}

export const StocksDistributionWidget = memo(function StocksDistributionWidget({
	assets,
	totalValue,
	sectorValueMap,
	formatCurrency,
	activeFilter,
	onSetFilter,
	onSelectAsset,
	loading = false,
}: StocksDistributionWidgetProps) {
	const shouldReduceMotion = useReducedMotion();
	const [distributionMode, setDistributionMode] = useState<DistributionMode>("asset");
	const [chartType, setChartType] = useState<ChartViewType>("donut");
	const [hoveredItem, setHoveredItem] = useState<DistributionItem | null>(null);
	// `theme` stays "system" when the user has not forced a mode, so it cannot
	// answer "is the UI dark right now?" — reading it painted the light-theme
	// white borders on a dark surface. `resolvedTheme` is the applied mode.
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	// biome-ignore lint/suspicious/noExplicitAny: ECharts instance reference
	const echartsInstanceRef = useRef<any>(null);

	// ── Compute Distribution Items ─────────────────────────────────────────
	const distributionItems = useMemo<DistributionItem[]>(() => {
		if (assets.length === 0 || totalValue <= 0) return [];

		// Resolved per render (isDark sits in the deps): series follow the
		// active theme's chart tokens.
		const { series: seriesColors, others: othersColor } = getDistributionColors();

		const map = new Map<string, { value: number; count: number }>();

		if (distributionMode === "asset") {
			for (const asset of assets) {
				const key = asset.symbol || asset.name;
				const current = map.get(key) ?? { value: 0, count: 0 };
				map.set(key, {
					value: current.value + asset.totalValue,
					count: current.count + 1,
				});
			}
		} else if (distributionMode === "sector") {
			for (const [sec, val] of sectorValueMap.entries()) {
				const label = !sec || sec === "Needs metadata" || sec === "Unclassified" ? "Other" : sec;
				const current = map.get(label) ?? { value: 0, count: 0 };
				map.set(label, {
					value: current.value + val,
					count: current.count + 1,
				});
			}
		} else if (distributionMode === "type") {
			for (const asset of assets) {
				const rawType = asset.type?.toLowerCase() || "stock";
				const typeLabel =
					rawType === "fund" ||
					asset.name.toLowerCase().includes("etf") ||
					asset.symbol.toLowerCase().includes("etf")
						? "ETF & Funds"
						: "Individual Stocks";
				const current = map.get(typeLabel) ?? { value: 0, count: 0 };
				map.set(typeLabel, {
					value: current.value + asset.totalValue,
					count: current.count + 1,
				});
			}
		}

		const sorted = Array.from(map.entries())
			.map(([name, { value, count }]) => ({ name, value, count }))
			.sort((a, b) => b.value - a.value);

		// Apportion once over the full set so every segment - including the
		// aggregated "Others" bucket - is consistent with the same 100% total.
		const allPercents = allocatePercentages(sorted.map((item) => item.value));

		// Format into top items + Others if more than 5
		if (sorted.length > 5 && distributionMode !== "type") {
			const top5 = sorted.slice(0, 5).map((item, idx) => ({
				...item,
				percent: allPercents[idx],
				color: seriesColors[idx % seriesColors.length],
				isOthers: false,
			}));
			const others = sorted.slice(5);
			const othersValue = others.reduce((sum, item) => sum + item.value, 0);
			if (othersValue > 0) {
				top5.push({
					name: "Others",
					value: othersValue,
					count: others.length,
					percent: allPercents.slice(5).reduce((sum, percent) => sum + percent, 0),
					color: othersColor,
					isOthers: true,
				});
			}
			return top5;
		}

		return sorted.map((item, idx) => ({
			...item,
			percent: allPercents[idx],
			color: seriesColors[idx % seriesColors.length],
			isOthers: false,
		}));
	}, [assets, totalValue, sectorValueMap, distributionMode, isDark]);

	// ── Concentration Metric ───────────────────────────────────────────────
	const concentrationInfo = useMemo(() => {
		if (distributionItems.length === 0) return null;
		const top3Total = distributionItems
			.filter((i) => !i.isOthers)
			.slice(0, 3)
			.reduce((acc, curr) => acc + curr.percent, 0);

		return {
			top3Percent: top3Total,
			level: top3Total > 70 ? "high" : top3Total > 45 ? "moderate" : "balanced",
		};
	}, [distributionItems]);

	// ── Item Click Handler (Cross-Filter) ──────────────────────────────────
	const handleItemClick = useCallback(
		(item: DistributionItem) => {
			if (item.isOthers) return;

			if (distributionMode === "asset") {
				if (activeFilter?.mode === "asset" && activeFilter.value === item.name) {
					onSetFilter?.(null);
				} else {
					onSetFilter?.({ mode: "asset", value: item.name, label: item.name });
					onSelectAsset?.(item.name);
				}
			} else if (distributionMode === "sector") {
				if (activeFilter?.mode === "sector" && activeFilter.value === item.name) {
					onSetFilter?.(null);
				} else {
					onSetFilter?.({ mode: "sector", value: item.name, label: item.name });
				}
			} else if (distributionMode === "type") {
				const filterVal = item.name.includes("ETF") ? "fund" : "stock";
				if (activeFilter?.mode === "type" && activeFilter.value === filterVal) {
					onSetFilter?.(null);
				} else {
					onSetFilter?.({ mode: "type", value: filterVal, label: item.name });
				}
			}
		},
		[distributionMode, activeFilter, onSetFilter, onSelectAsset],
	);

	// ── Hover Slice Highlight in ECharts ───────────────────────────────────
	const handleLegendHover = useCallback(
		(item: DistributionItem | null, index?: number) => {
			setHoveredItem(item);
			const chart = echartsInstanceRef.current;
			if (!chart) return;

			if (item && index !== undefined && chartType === "donut") {
				chart.dispatchAction({
					type: "highlight",
					seriesIndex: 0,
					dataIndex: index,
				});
			} else if (chartType === "donut") {
				chart.dispatchAction({
					type: "downplay",
					seriesIndex: 0,
				});
			}
		},
		[chartType],
	);

	// ── Donut Chart ECharts Option ─────────────────────────────────────────
	const donutOption = useMemo(() => {
		// Slice separators are the card surface itself: a hardcoded
		// white/near-black read as a glaring outline on the tinted dark card.
		const themeColors = getChartThemeColors();
		const chartData = distributionItems.map((item) => ({
			name: item.name,
			value: item.value,
			itemStyle: {
				color: item.color,
			},
		}));

		return {
			animationDuration: 400,
			tooltip: {
				show: false, // Handled by dynamic center display for a cleaner UI
			},
			series: [
				{
					type: "pie",
					radius: ["64%", "88%"],
					center: ["50%", "50%"],
					data: chartData,
					padAngle: 2.5,
					itemStyle: {
						borderRadius: 4,
						borderColor: themeColors.card,
						borderWidth: 2,
					},
					label: { show: false },
					emphasis: {
						scale: true,
						scaleSize: 4,
						itemStyle: {
							shadowBlur: 10,
							shadowColor: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.15)",
						},
					},
				},
			],
		};
	}, [distributionItems, isDark]);

	// ── Treemap Chart ECharts Option ───────────────────────────────────────
	const treemapOption = useMemo(() => {
		// Tile separators use the card surface, same reason as the donut: the
		// hardcoded pair drew white gutters over the dark card.
		const themeColors = getChartThemeColors();
		const treemapData = distributionItems.map((item) => {
			// Labels sit ON the tile fill, so their ink follows the tile's
			// luminance instead of a fixed white that faded on light fills.
			const ink = contrastInkFor(item.color);
			return {
				name: item.name,
				value: item.value,
				itemStyle: {
					color: item.color,
				},
				label: {
					rich: {
						name: { fontSize: 11, fontWeight: "bold", lineHeight: 15, color: ink },
						percent: {
							fontSize: 11,
							lineHeight: 14,
							fontFamily: "monospace",
							color: `rgba(${hexToRgbTriplet(ink)}, 0.85)`,
						},
					},
				},
			};
		});

		return {
			animationDuration: 400,
			tooltip: {
				trigger: "item",
				// Theme-aware: the tooltip used to render as a dark slab in both
				// themes, unreadable against dark surfaces and jarring on light.
				backgroundColor: isDark ? "rgba(20, 20, 24, 0.96)" : "rgba(255, 255, 255, 0.98)",
				borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)",
				borderWidth: 1,
				padding: [8, 12],
				textStyle: {
					color: isDark ? "#f4f4f5" : "#18181b",
					fontSize: 12,
					fontFamily: "sans-serif",
				},
				// biome-ignore lint/suspicious/noExplicitAny: ECharts tooltip param
				formatter: (params: any) => {
					const pct = totalValue > 0 ? ((params.value / totalValue) * 100).toFixed(1) : "0.0";
					const muted = isDark ? "#a1a1aa" : "#52525b";
					const strong = isDark ? "#f4f4f5" : "#18181b";
					return `
						<div style="font-weight:600;font-size:12px;margin-bottom:2px;color:${strong};">${params.name}</div>
						<div style="display:flex;justify-content:space-between;gap:16px;color:${muted};font-size:11px;">
							<span>Weight: <b style="color:${strong};">${pct}%</b></span>
							<span>Value: <b style="color:${strong};">${formatCurrency(params.value)}</b></span>
						</div>
					`;
				},
			},
			series: [
				{
					name: "Distribution",
					type: "treemap",
					left: 0,
					top: 0,
					right: 0,
					bottom: 0,
					width: "100%",
					height: "100%",
					roam: false,
					breadcrumb: { show: false },
					nodeClick: false,
					zoomToNodeRatio: 0,
					itemStyle: {
						borderColor: themeColors.card,
						borderWidth: 2,
						gapWidth: 2,
						borderRadius: 4,
					},
					label: {
						show: true,
						position: "inside",
						overflow: "truncate",
						ellipsis: "...",
						// biome-ignore lint/suspicious/noExplicitAny: ECharts label param
						formatter: (params: any) => {
							const pct = totalValue > 0 ? ((params.value / totalValue) * 100).toFixed(1) : "0.0";
							return `{name|${params.name}}\n{percent|${pct}%}`;
						},
						rich: {
							name: {
								fontSize: 11,
								fontWeight: "bold",
								lineHeight: 15,
								color: "#ffffff",
							},
							percent: {
								fontSize: 11,
								lineHeight: 14,
								color: "rgba(255, 255, 255, 0.85)",
								fontFamily: "monospace",
							},
						},
					},
					data: treemapData,
				},
			],
		};
	}, [distributionItems, totalValue, formatCurrency, isDark]);

	const isFilterActive = Boolean(activeFilter);

	// The donut centre used to repeat the hero's total value verbatim, two
	// inches from the hero itself. The centre now carries the one figure the
	// hero does not: how many groups the chart is showing.
	const groupedItemCount = distributionItems.filter((i) => !i.isOthers).length;
	const groupUnit =
		distributionMode === "asset" ? "Assets" : distributionMode === "sector" ? "Sectors" : "Types";

	// While the portfolio is still loading, `assets` is empty and the branch below
	// would render "No distribution data available" - a confident, wrong message
	// that then snaps into a chart. Show a placeholder of the same shape instead.
	if (loading) {
		return (
			<div className="flex flex-col space-y-3 h-full" aria-busy="true" aria-live="polite">
				<span className="sr-only">Loading portfolio allocation…</span>
				<div className="flex items-center justify-between border-b border-border/10 pb-3 h-[45px]">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-6 w-24" />
				</div>
				<Skeleton className="h-[250px] w-full rounded-lg" />
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-3 h-full">
			{/* ── Distribution Header (Aligned with Hero Chart Header) ────── */}
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/10 pb-3 min-h-[45px] sm:h-[45px]">
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5">
						<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Allocation
						</span>
						{/* In the donut view the chart centre already shows this count. */}
						{chartType !== "donut" && (
							<Badge
								variant="outline"
								className="h-4.5 px-1.5 text-micro font-medium border-border/40 bg-secondary/30 text-muted-foreground"
							>
								{groupedItemCount} {groupUnit}
							</Badge>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* Mode Dropdown (Asset / Sector / Type) */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-6 gap-1 rounded-full px-2.5 text-micro font-medium bg-secondary/35 border-border/50 text-muted-foreground hover:text-foreground transition-all"
							>
								{distributionMode === "asset"
									? "By Asset"
									: distributionMode === "sector"
										? "By Sector"
										: "By Type"}
								<ChevronDown className="h-2.5 w-2.5 opacity-60" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-32">
							<DropdownMenuItem
								onClick={() => setDistributionMode("asset")}
								className={cn(
									"text-xs",
									distributionMode === "asset" && "font-semibold text-primary",
								)}
							>
								By Asset
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDistributionMode("sector")}
								className={cn(
									"text-xs",
									distributionMode === "sector" && "font-semibold text-primary",
								)}
							>
								By Sector
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDistributionMode("type")}
								className={cn(
									"text-xs",
									distributionMode === "type" && "font-semibold text-primary",
								)}
							>
								By Asset Type
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* View Switcher: Donut / Treemap / Bars */}
					<div className="relative flex items-center gap-0.5 rounded-full border border-border/50 bg-secondary/20 p-0.5">
						<Button
							variant="ghost"
							size="icon"
							aria-pressed={chartType === "donut"}
							aria-label="Donut allocation view"
							className={cn(
								"relative h-8 w-8 rounded-full transition-colors duration-150 touch-target cursor-pointer active:translate-y-px",
								chartType === "donut"
									? "text-foreground font-bold"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setChartType("donut")}
						>
							{chartType === "donut" && (
								<motion.span
									layoutId="distChartTypeActive"
									className="absolute inset-0 rounded-full bg-secondary/90 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 35 }
									}
								/>
							)}
							<PieChart className="relative z-10 h-3.5 w-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-pressed={chartType === "treemap"}
							aria-label="Treemap grid view"
							className={cn(
								"relative h-8 w-8 rounded-full transition-colors duration-150 touch-target cursor-pointer active:translate-y-px",
								chartType === "treemap"
									? "text-foreground font-bold"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setChartType("treemap")}
						>
							{chartType === "treemap" && (
								<motion.span
									layoutId="distChartTypeActive"
									className="absolute inset-0 rounded-full bg-secondary/90 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 35 }
									}
								/>
							)}
							<LayoutGrid className="relative z-10 h-3.5 w-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-pressed={chartType === "bars"}
							aria-label="Ranked list breakdown view"
							className={cn(
								"relative h-8 w-8 rounded-full transition-colors duration-150 touch-target cursor-pointer active:translate-y-px",
								chartType === "bars"
									? "text-foreground font-bold"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setChartType("bars")}
						>
							{chartType === "bars" && (
								<motion.span
									layoutId="distChartTypeActive"
									className="absolute inset-0 rounded-full bg-secondary/90 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 35 }
									}
								/>
							)}
							<BarChart3 className="relative z-10 h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</div>

			{/* ── Main Content Area (Matches Hero Chart Height ~250px) ───── */}
			{distributionItems.length === 0 ? (
				<div className="h-[250px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/30 rounded-lg bg-secondary/10">
					<PieChart className="h-8 w-8 text-muted-foreground/40 mb-2" />
					<p className="text-xs font-medium text-muted-foreground">
						No distribution data available
					</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Add positions to visualize portfolio weighting
					</p>
				</div>
			) : (
				<div className="h-[250px] flex flex-col justify-between">
					<motion.div
						key={chartType}
						initial={shouldReduceMotion ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.16 }}
						className="h-[200px] flex flex-col justify-between my-auto"
					>
						{/* ── View: Donut + Legend ── */}
						{chartType === "donut" && (
						<div className="flex items-center gap-3 h-[200px] my-auto">
							{/* Donut Chart with Dynamic Interactive Center */}
							<div className="relative w-[140px] h-[140px] shrink-0 mx-auto sm:mx-0">
								<ReactECharts
									ref={(e) => {
										// biome-ignore lint/suspicious/noExplicitAny: ECharts instance
										echartsInstanceRef.current = (e as any)?.getEchartsInstance?.() ?? null;
									}}
									option={donutOption}
									notMerge={true}
									lazyUpdate={true}
									style={{ height: "100%", width: "100%" }}
									opts={{ renderer: "svg" }}
									onEvents={{
										mouseover: (params: { dataIndex: number }) => {
											const item = distributionItems[params.dataIndex];
											if (item) setHoveredItem(item);
										},
										mouseout: () => {
											setHoveredItem(null);
										},
										click: (params: { dataIndex: number }) => {
											const item = distributionItems[params.dataIndex];
											if (item) handleItemClick(item);
										},
									}}
								/>

								{/* Center Text (Smooth Dynamic Fade/Scale) */}
								<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-2 text-center">
									{hoveredItem ? (
										<div className="animate-in fade-in zoom-in-95 duration-150 flex flex-col items-center">
											<span className="text-micro font-bold text-foreground leading-tight truncate max-w-[85px]">
												{hoveredItem.name}
											</span>
											<span
												className="font-mono text-xs font-bold leading-tight mt-0.5"
												style={{ color: hoveredItem.color }}
											>
												{hoveredItem.percent.toFixed(1)}%
											</span>
											<span className="font-mono text-micro text-muted-foreground leading-tight">
												{formatCurrency(hoveredItem.value)}
											</span>
										</div>
									) : (
										<div className="animate-in fade-in duration-200 flex flex-col items-center">
											<span className="font-mono text-sm font-bold tracking-tight text-foreground/90 leading-tight">
												{groupedItemCount}
											</span>
											<span className="text-micro font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
												{groupUnit}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Interactive Top Legend with Progress Bars */}
							<div className="flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
								{distributionItems.map((item, idx) => {
									const isItemActive =
										(activeFilter?.mode === "asset" && activeFilter.value === item.name) ||
										(activeFilter?.mode === "sector" && activeFilter.value === item.name) ||
										(activeFilter?.mode === "type" &&
											((item.name.includes("ETF") && activeFilter.value === "fund") ||
												(!item.name.includes("ETF") && activeFilter.value === "stock")));
									const isHovered = hoveredItem?.name === item.name;

									return (
										<button
											type="button"
											key={item.name}
											aria-pressed={isItemActive}
											aria-label={`${item.name}: ${item.percent.toFixed(1)} percent, ${formatCurrency(item.value)}${isItemActive ? ", filter active" : ""}`}
											className={cn(
												"w-full text-left group flex flex-col rounded-md px-1.5 py-1 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
												isItemActive
													? "bg-primary/10 ring-1 ring-primary/30"
													: isHovered
														? "bg-secondary/40"
														: "hover:bg-secondary/25",
											)}
											onMouseEnter={() => handleLegendHover(item, idx)}
											onMouseLeave={() => handleLegendHover(null)}
											onFocus={() => handleLegendHover(item, idx)}
											onBlur={() => handleLegendHover(null)}
											onClick={() => handleItemClick(item)}
										>
											<div className="flex items-center justify-between text-xs leading-none">
												<div className="flex items-center gap-1.5 min-w-0 pr-1">
													<div
														className={cn(
															"h-2 w-2 rounded-full shrink-0 transition-transform duration-150",
															isHovered && "scale-125 shadow-xs",
														)}
														style={{ backgroundColor: item.color }}
													/>
													<span
														className={cn(
															"font-medium truncate transition-colors text-micro",
															isItemActive
																? "text-primary font-semibold"
																: "text-foreground group-hover:text-foreground",
														)}
														title={item.name}
													>
														{item.name}
													</span>
												</div>
												<div className="flex items-center gap-1.5 shrink-0">
													<span className="font-mono text-micro font-semibold text-foreground/90">
														{item.percent.toFixed(1)}%
													</span>
												</div>
											</div>

											{/* Mini Progress Bar Track */}
											<div className="w-full h-1 bg-secondary/50 rounded-full mt-1 overflow-hidden">
												<div
													className="h-full rounded-full transition-all duration-300"
													style={{
														width: `${Math.min(100, Math.max(3, item.percent))}%`,
														backgroundColor: item.color,
														opacity: isHovered || isItemActive ? 1 : 0.85,
													}}
												/>
											</div>
										</button>
									);
								})}
							</div>
						</div>
					)}

					{/* ── View: Treemap Grid ── */}
					{chartType === "treemap" && (
						<div className="h-[200px] w-full relative my-auto overflow-hidden rounded-md">
							<ReactECharts
								key={`treemap-${distributionMode}`}
								option={treemapOption}
								notMerge={true}
								lazyUpdate={true}
								style={{ height: "100%", width: "100%" }}
								opts={{ renderer: "svg" }}
								onEvents={{
									click: (params: { name: string }) => {
										const item = distributionItems.find((i) => i.name === params.name);
										if (item) handleItemClick(item);
									},
								}}
							/>
						</div>
					)}

					{/* ── View: Ranked List Breakdown ── */}
					{chartType === "bars" && (
						<div className="h-[200px] w-full overflow-y-auto no-scrollbar space-y-1.5 my-auto pr-1">
							{distributionItems.map((item, idx) => {
								const isItemActive =
									(activeFilter?.mode === "asset" && activeFilter.value === item.name) ||
									(activeFilter?.mode === "sector" && activeFilter.value === item.name) ||
									(activeFilter?.mode === "type" &&
										((item.name.includes("ETF") && activeFilter.value === "fund") ||
											(!item.name.includes("ETF") && activeFilter.value === "stock")));

								return (
									<button
										type="button"
										key={item.name}
										onClick={() => handleItemClick(item)}
										aria-pressed={isItemActive}
										className={cn(
											"w-full text-left p-2 rounded-lg border transition-all duration-150 cursor-pointer flex flex-col gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
											isItemActive
												? "border-primary/40 bg-primary/5"
												: "border-border/30 bg-secondary/15 hover:bg-secondary/30 hover:border-border/60",
										)}
									>
										<div className="flex items-center justify-between text-xs">
											<div className="flex items-center gap-2 min-w-0">
												<span className="font-mono text-micro text-muted-foreground w-4">
													#{idx + 1}
												</span>
												<div
													className="h-2 w-2 rounded-full shrink-0"
													style={{ backgroundColor: item.color }}
												/>
												<span className="font-semibold text-foreground truncate text-micro">
													{item.name}
												</span>
											</div>
											<div className="flex items-center gap-2 text-right">
												<span className="font-mono text-micro text-muted-foreground">
													{formatCurrency(item.value)}
												</span>
												<span className="font-mono text-micro font-bold text-foreground">
													{item.percent.toFixed(1)}%
												</span>
											</div>
										</div>

										<div className="w-full h-1.5 bg-secondary/60 rounded-full overflow-hidden">
											<div
												className="h-full rounded-full transition-all duration-300"
												style={{
													width: `${Math.min(100, item.percent)}%`,
													backgroundColor: item.color,
												}}
											/>
										</div>
									</button>
								);
							})}
						</div>
					)}
						</motion.div>

					{/* ── Footer Insight Strip ── */}
					<div className="h-[36px] pt-2 border-t border-border/15 flex items-center justify-between text-micro">
						{isFilterActive ? (
							<div className="flex items-center justify-between w-full">
								<div className="flex items-center gap-1.5 text-primary">
									<Layers className="h-3 w-3" />
									<span className="font-medium truncate max-w-[130px]">
										Filtered: {activeFilter?.label || activeFilter?.value}
									</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="h-5 px-1.5 text-micro text-muted-foreground hover:text-foreground gap-1"
									onClick={() => onSetFilter?.(null)}
								>
									<X className="h-2.5 w-2.5" />
									Reset
								</Button>
							</div>
						) : concentrationInfo ? (
							<>
								<div className="flex items-center gap-1.5 text-muted-foreground">
									<Sparkles className="h-3 w-3 text-warning-muted" />
									<span>Top 3 Concentration:</span>
									<span className="font-mono font-semibold text-foreground">
										{concentrationInfo.top3Percent.toFixed(1)}%
									</span>
								</div>
								<Badge
									variant="outline"
									className={cn(
										"h-4 px-1 text-micro font-semibold border-0",
										concentrationInfo.level === "balanced"
											? "bg-gain/15 text-gain"
											: concentrationInfo.level === "moderate"
												? "bg-warning/15 text-warning"
												: "bg-loss/15 text-loss",
									)}
								>
									{concentrationInfo.level === "balanced"
										? "Balanced"
										: concentrationInfo.level === "moderate"
											? "Moderate"
											: "Concentrated"}
								</Badge>
							</>
						) : (
							<span className="text-muted-foreground">Portfolio Distribution Breakdown</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
});
