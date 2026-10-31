import ReactECharts from "echarts-for-react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, ChevronDown, Layers, LayoutGrid, PieChart, Sparkles, X } from "lucide-react";
import { memo, useCallback, useId, useMemo, useRef, useState } from "react";
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
import { getChartThemeColors, hexToRgbTriplet } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import type { AllocationFilter, AllocationModeOption, AllocationSlice } from "./types";

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

export type AllocationChartView = "donut" | "treemap" | "bars";

export interface AllocationWidgetProps {
	/** Grouping tabs, e.g. By Asset / By Sector. A single mode hides the dropdown. */
	modes: readonly AllocationModeOption[];
	activeMode: string;
	onModeChange: (mode: string) => void;
	/** Pre-grouped, value-ranked slices for the active mode. */
	items: AllocationSlice[];
	totalValue: number;
	formatCurrency: (val: number) => string;
	activeFilter?: AllocationFilter | null;
	/**
	 * Map a clicked slice to a cross-filter. Defaults to
	 * `{ mode: activeMode, value: item.name, label: item.name }`.
	 */
	toFilter?: (item: AllocationSlice, mode: string) => AllocationFilter;
	/** Custom active-state check for slice names that differ from filter values. */
	isItemActive?: (
		item: AllocationSlice,
		mode: string,
		filter: AllocationFilter | null | undefined,
	) => boolean;
	onFilterChange?: (filter: AllocationFilter | null) => void;
	/** Extra navigation on slice click (e.g. open the asset detail). */
	onSelectItem?: (item: AllocationSlice, mode: string) => void;
	/** Renders a layout-stable placeholder instead of the empty state. */
	loading?: boolean;
	loadingLabel?: string;
	/** @default "allocation-widget" */
	testId?: string;
}

const defaultToFilter = (item: AllocationSlice, mode: string): AllocationFilter => ({
	mode,
	value: item.name,
	label: item.name,
});

const defaultIsItemActive = (
	item: AllocationSlice,
	mode: string,
	filter: AllocationFilter | null | undefined,
): boolean => Boolean(filter && filter.mode === mode && filter.value === item.name);

export const AllocationWidget = memo(function AllocationWidget({
	modes,
	activeMode,
	onModeChange,
	items,
	totalValue,
	formatCurrency,
	activeFilter,
	toFilter = defaultToFilter,
	isItemActive = defaultIsItemActive,
	onFilterChange,
	onSelectItem,
	loading = false,
	loadingLabel = "Loading portfolio allocation…",
	testId = "allocation-widget",
}: AllocationWidgetProps) {
	const shouldReduceMotion = useReducedMotion();
	const [chartType, setChartType] = useState<AllocationChartView>("donut");
	const [hoveredItem, setHoveredItem] = useState<AllocationSlice | null>(null);
	// `theme` stays "system" when the user has not forced a mode, so it cannot
	// answer "is the UI dark right now?" — `resolvedTheme` is the applied mode.
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	// framer-motion layoutIds are page-scoped: two allocation widgets sharing
	// one id would animate the active pill across cards.
	const layoutId = `allocationChartTypeActive-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

	// biome-ignore lint/suspicious/noExplicitAny: ECharts instance reference
	const echartsInstanceRef = useRef<any>(null);

	const activeModeOption = modes.find((mode) => mode.id === activeMode) ?? modes[0];

	// ── Concentration Metric ───────────────────────────────────────────────
	const concentrationInfo = useMemo(() => {
		if (items.length === 0) return null;
		const top3Total = items
			.filter((i) => !i.isOthers)
			.slice(0, 3)
			.reduce((acc, curr) => acc + curr.percent, 0);

		return {
			top3Percent: top3Total,
			level: top3Total > 70 ? "high" : top3Total > 45 ? "moderate" : "balanced",
		};
	}, [items]);

	// ── Item Click Handler (Cross-Filter) ──────────────────────────────────
	const handleItemClick = useCallback(
		(item: AllocationSlice) => {
			if (item.isOthers) return;
			if (activeFilter && isItemActive(item, activeMode, activeFilter)) {
				onFilterChange?.(null);
			} else {
				onFilterChange?.(toFilter(item, activeMode));
				onSelectItem?.(item, activeMode);
			}
		},
		[activeMode, activeFilter, isItemActive, onFilterChange, onSelectItem, toFilter],
	);

	// ── Hover Slice Highlight in ECharts ───────────────────────────────────
	const handleLegendHover = useCallback(
		(item: AllocationSlice | null, index?: number) => {
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
		const chartData = items.map((item) => ({
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
	}, [items, isDark]);

	// ── Treemap Chart ECharts Option ───────────────────────────────────────
	const treemapOption = useMemo(() => {
		// Tile separators use the card surface, same reason as the donut: the
		// hardcoded pair drew white gutters over the dark card.
		const themeColors = getChartThemeColors();
		const treemapData = items.map((item) => {
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
	}, [items, totalValue, formatCurrency, isDark]);

	const isFilterActive = Boolean(activeFilter);

	// The donut centre used to repeat the hero's total value verbatim, two
	// inches from the hero itself. The centre now carries the one figure the
	// hero does not: how many groups the chart is showing.
	const groupedItemCount = items.filter((i) => !i.isOthers).length;
	const groupUnit = activeModeOption?.groupUnit ?? "Items";

	// While the portfolio is still loading, `items` is empty and the branch below
	// would render "No distribution data available" - a confident, wrong message
	// that then snaps into a chart. Show a placeholder of the same shape instead.
	if (loading) {
		return (
			<div
				className="flex flex-col space-y-3 h-full"
				aria-busy="true"
				aria-live="polite"
				data-testid={testId}
			>
				<span className="sr-only">{loadingLabel}</span>
				<div className="flex items-center justify-between border-b border-border/10 pb-3 h-[45px]">
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-6 w-24" />
				</div>
				<Skeleton className="h-[250px] w-full rounded-lg" />
			</div>
		);
	}

	return (
		<div className="flex flex-col space-y-3 h-full" data-testid={testId}>
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
					{/* Mode Dropdown (hidden when a single grouping exists) */}
					{modes.length > 1 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-6 gap-1 rounded-full px-2.5 text-micro font-medium bg-secondary/35 border-border/50 text-muted-foreground hover:text-foreground transition-all"
								>
									{activeModeOption?.label ?? "By Asset"}
									<ChevronDown className="h-2.5 w-2.5 opacity-60" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-32">
								{modes.map((mode) => (
									<DropdownMenuItem
										key={mode.id}
										onClick={() => onModeChange(mode.id)}
										className={cn(
											"text-xs",
											activeMode === mode.id && "font-semibold text-primary",
										)}
									>
										{mode.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					{/* View Switcher: Donut / Treemap / Bars */}
					<div className="relative flex items-center gap-0.5 rounded-full border border-border/50 bg-secondary/20 p-0.5">
						{(
							[
								{ id: "donut", label: "Donut allocation view", Icon: PieChart },
								{ id: "treemap", label: "Treemap grid view", Icon: LayoutGrid },
								{ id: "bars", label: "Ranked list breakdown view", Icon: BarChart3 },
							] as const
						).map(({ id, label, Icon }) => (
							<Button
								key={id}
								variant="ghost"
								size="icon"
								aria-pressed={chartType === id}
								aria-label={label}
								className={cn(
									"relative h-8 w-8 rounded-full transition-colors duration-150 touch-target cursor-pointer active:translate-y-px",
									chartType === id
										? "text-foreground font-bold"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setChartType(id)}
							>
								{chartType === id && (
									<motion.span
										layoutId={layoutId}
										className="absolute inset-0 rounded-full bg-secondary/90 shadow-xs"
										transition={
											shouldReduceMotion
												? { duration: 0 }
												: { type: "spring", stiffness: 500, damping: 35 }
										}
									/>
								)}
								<Icon className="relative z-10 h-3.5 w-3.5" />
							</Button>
						))}
					</div>
				</div>
			</div>

			{/* ── Main Content Area (Matches Hero Chart Height ~250px) ───── */}
			{items.length === 0 ? (
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
												const item = items[params.dataIndex];
												if (item) setHoveredItem(item);
											},
											mouseout: () => {
												setHoveredItem(null);
											},
											click: (params: { dataIndex: number }) => {
												const item = items[params.dataIndex];
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
									{items.map((item, idx) => {
										const itemActive = isItemActive(item, activeMode, activeFilter);
										const isHovered = hoveredItem?.name === item.name;

										return (
											<button
												type="button"
												key={item.name}
												aria-pressed={itemActive}
												aria-label={`${item.name}: ${item.percent.toFixed(1)} percent, ${formatCurrency(item.value)}${itemActive ? ", filter active" : ""}`}
												className={cn(
													"w-full text-left group flex flex-col rounded-md px-1.5 py-1 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
													itemActive
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
																itemActive
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
															opacity: isHovered || itemActive ? 1 : 0.85,
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
									key={`treemap-${activeMode}`}
									option={treemapOption}
									notMerge={true}
									lazyUpdate={true}
									style={{ height: "100%", width: "100%" }}
									opts={{ renderer: "svg" }}
									onEvents={{
										click: (params: { name: string }) => {
											const item = items.find((i) => i.name === params.name);
											if (item) handleItemClick(item);
										},
									}}
								/>
							</div>
						)}

						{/* ── View: Ranked List Breakdown ── */}
						{chartType === "bars" && (
							<div className="h-[200px] w-full overflow-y-auto no-scrollbar space-y-1.5 my-auto pr-1">
								{items.map((item, idx) => {
									const itemActive = isItemActive(item, activeMode, activeFilter);

									return (
										<button
											type="button"
											key={item.name}
											onClick={() => handleItemClick(item)}
											aria-pressed={itemActive}
											className={cn(
												"w-full text-left p-2 rounded-lg border transition-all duration-150 cursor-pointer flex flex-col gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
												itemActive
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
									onClick={() => onFilterChange?.(null)}
								>
									<X className="h-2.5 w-2.5" />
									Reset
								</Button>
							</div>
						) : concentrationInfo ? (
							<>
								<div className="flex items-center gap-1.5 text-muted-foreground">
									<Sparkles className="h-3 w-3 text-muted-foreground" />
									<span>Top 3 Concentration:</span>
									<span className="font-mono font-semibold text-foreground">
										{concentrationInfo.top3Percent.toFixed(1)}%
									</span>
								</div>
								<Badge
									variant="outline"
									className={cn(
										"h-4 px-1.5 text-micro font-medium border-0",
										concentrationInfo.level === "balanced"
											? "bg-secondary text-foreground/80"
											: concentrationInfo.level === "moderate"
												? "bg-secondary text-foreground/80"
												: "bg-muted text-muted-foreground",
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
