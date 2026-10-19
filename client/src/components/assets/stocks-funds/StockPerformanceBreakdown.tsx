import {
	BarChart3,
	HelpCircle,
	TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import type { Asset } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface StockPerformanceBreakdownProps {
	// biome-ignore lint/suspicious/noExplicitAny: normalized position contains rich fields like realizedGainLoss, fx, account
	position?: any;
	currentPrice: number;
	resolvedCurrency: string;
	high?: number | null;
	low?: number | null;
	open?: number | null;
	close?: number | null;
	volume?: number | null;
	formatCurrency: (val: number) => string;
}

export function StockPerformanceBreakdown({
	position,
	currentPrice,
	resolvedCurrency,
	high,
	low,
	open,
	close,
	volume,
	formatCurrency,
}: StockPerformanceBreakdownProps) {
	// True if we have valid real day high/low with spread
	const hasSpread = high != null && low != null && high > low;

	// Realized gain/loss from recorded dispositions on this position
	const realizedGainLoss = position?.realizedGainLoss ?? null;

	// Unrealized gain/loss
	const unrealizedGain = position?.profitLoss ?? null;
	const unrealizedGainPct = position?.profitLossPercentage ?? null;

	// Total combined P&L (Unrealized + Realized)
	const totalPnl = useMemo(() => {
		if (unrealizedGain === null && realizedGainLoss === null) return null;
		return (unrealizedGain ?? 0) + (realizedGainLoss ?? 0);
	}, [unrealizedGain, realizedGainLoss]);

	// Price Return relative to acquisition price (buyingPrice)
	const priceReturnPct = useMemo(() => {
		const avgPrice = position?.buyingPrice;
		if (avgPrice == null || avgPrice <= 0 || currentPrice <= 0) return null;
		return ((currentPrice - avgPrice) / avgPrice) * 100;
	}, [position?.buyingPrice, currentPrice]);

	// FX health check: if quote or base currency is stale or missing rates, suppress misleading percentages
	const canShowPct = position?.fx?.state !== "STALE_CONVERSION" && position?.fx?.state !== "MISSING_RATES";

	// Current price position inside day range (0% to 100%)
	const dayRangePct = useMemo(() => {
		if (!hasSpread || currentPrice <= 0) return 50;
		const pct = ((currentPrice - low!) / (high! - low!)) * 100;
		return Math.min(100, Math.max(0, pct));
	}, [hasSpread, high, low, currentPrice]);

	const accountName = position?.account || "Main Account";

	return (
		<TooltipProvider delayDuration={200}>
			<div className="w-full rounded-xl border border-border/30 bg-card/50 p-5 sm:p-6 shadow-xs">
				{/* Accessible label for screen readers & tests */}
				<span className="sr-only">Position Value</span>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-border/20">
					{/* LEFT COLUMN: Market & Day Range */}
					<div className="space-y-4 lg:pr-6">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							<BarChart3 className="h-3.5 w-3.5 text-primary" />
							<span>Market & Day Range</span>
						</div>

						{/* Range Slider or Flat-day Indicator */}
						{hasSpread ? (
							<div className="space-y-2 py-1">
								<div className="flex justify-between items-center text-xs font-mono">
									<span className="text-muted-foreground">
										Low: <span className="text-foreground">{formatCurrency(low!)}</span>
									</span>
									<span className="font-semibold text-foreground px-2 py-0.5 rounded bg-muted/40">
										Current: {formatCurrency(currentPrice)}
									</span>
									<span className="text-muted-foreground">
										High: <span className="text-foreground">{formatCurrency(high!)}</span>
									</span>
								</div>
								<div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
									<div
										className="absolute top-0 bottom-0 left-0 bg-primary/30 rounded-full"
										style={{ width: `${dayRangePct}%` }}
									/>
									<div
										className="absolute top-0 bottom-0 w-2.5 bg-primary rounded-full shadow-xs -ml-1"
										style={{ left: `${dayRangePct}%` }}
									/>
								</div>
							</div>
						) : (
							<div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20 text-xs">
								<span className="text-muted-foreground">Intraday Range</span>
								<span className="font-mono text-foreground font-medium">
									Stable Price ({formatCurrency(currentPrice)})
								</span>
							</div>
						)}

						{/* Clean 3x2 Grid for Market Metrics */}
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 font-mono text-sm">
							<div className="space-y-0.5">
								<p className="text-xs font-sans text-muted-foreground">Open</p>
								<p className="font-medium text-foreground tabular-nums">
									{open != null ? formatCurrency(open) : "—"}
								</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-xs font-sans text-muted-foreground">Prev Close</p>
								<p className="font-medium text-foreground tabular-nums">
									{close != null ? formatCurrency(close) : "—"}
								</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-xs font-sans text-muted-foreground">Volume</p>
								<p className="font-medium text-foreground tabular-nums">
									{volume != null && volume > 0 ? volume.toLocaleString("en-US") : "—"}
								</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-xs font-sans text-muted-foreground">Quote Currency</p>
								<p className="font-medium text-foreground">{resolvedCurrency}</p>
							</div>
							<div className="space-y-0.5">
								<p className="text-xs font-sans text-muted-foreground">FX Base</p>
								<div className="flex items-center gap-1.5 font-medium text-foreground">
									<span>{position?.fx?.costBasisCurrency ?? resolvedCurrency}</span>
									{position?.fx?.isStale && (
										<Badge
											variant="outline"
											className="h-4 px-1 py-0 text-micro uppercase border-warning/30 bg-warning/10 text-warning"
										>
											stale
										</Badge>
									)}
								</div>
							</div>
							<div className="space-y-0.5">
								<p className="text-xs font-sans text-muted-foreground">Account</p>
								<p className="font-medium text-foreground truncate" title={accountName}>
									{accountName}
								</p>
							</div>
						</div>
					</div>

					{/* RIGHT COLUMN: Performance & Tax Basis */}
					<div className="space-y-4 pt-6 lg:pt-0 lg:pl-6">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							<TrendingUp className="h-3.5 w-3.5 text-primary" />
							<span>Performance & Tax Basis</span>
						</div>

						<div className="divide-y divide-border/20 text-sm">
							{/* Price Return */}
							<div className="py-2.5 flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground">Price Return</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
										</TooltipTrigger>
										<TooltipContent>
											Price change relative to the average purchase cost basis.
										</TooltipContent>
									</Tooltip>
								</div>
								<div className="font-mono tabular-nums">
									{!canShowPct ? (
										<span
											className="px-1.5 py-0.5 rounded text-xs font-medium bg-warning/15 text-warning cursor-help"
											title={position?.fx?.reason}
										>
											% n/a
										</span>
									) : priceReturnPct !== null ? (
										<span
											className={cn(
												"px-2 py-0.5 rounded text-xs font-medium",
												priceReturnPct >= 0
													? "bg-gain/15 text-gain"
													: "bg-loss/15 text-loss",
											)}
										>
											{priceReturnPct >= 0 ? "+" : ""}
											{priceReturnPct.toFixed(2)}%
										</span>
									) : (
										<span className="text-muted-foreground">—</span>
									)}
								</div>
							</div>

							{/* Realized Fiscal P&L */}
							<div className="py-2.5 flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground">Realized Fiscal P&L</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
										</TooltipTrigger>
										<TooltipContent>
											Net capital gains or losses from recorded tax-lot sales.
										</TooltipContent>
									</Tooltip>
								</div>
								<div className="font-mono tabular-nums">
									{realizedGainLoss !== null && realizedGainLoss !== 0 ? (
										<span
											className={cn(
												"font-medium",
												realizedGainLoss >= 0 ? "text-gain" : "text-loss",
											)}
										>
											{realizedGainLoss >= 0 ? "+" : ""}
											{formatCurrency(realizedGainLoss)}
										</span>
									) : (
										<span className="text-xs text-muted-foreground">
											0.00 {resolvedCurrency} (no sales recorded)
										</span>
									)}
								</div>
							</div>

							{/* Dividends */}
							<div className="py-2.5 flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground">Income (Dividends)</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
										</TooltipTrigger>
										<TooltipContent>
											Dividends received for this position.
										</TooltipContent>
									</Tooltip>
								</div>
								<span className="font-mono font-medium tabular-nums text-foreground">
									{formatCurrency(0)}
								</span>
							</div>

							{/* Combined Net P&L if sales exist */}
							{totalPnl !== null && realizedGainLoss !== null && realizedGainLoss !== 0 && (
								<div className="py-2.5 flex items-center justify-between bg-muted/15 px-2 -mx-2 rounded">
									<div className="flex items-center gap-1.5">
										<span className="font-medium text-foreground">Total Net P&L</span>
										<Tooltip>
											<TooltipTrigger asChild>
												<HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
											</TooltipTrigger>
											<TooltipContent>
												Cumulative sum of current unrealized gain and realized gain/loss.
											</TooltipContent>
										</Tooltip>
									</div>
									<div className="flex items-center gap-2 font-mono tabular-nums">
										<span
											className={cn(
												"font-semibold",
												totalPnl >= 0 ? "text-gain" : "text-loss",
											)}
										>
											{totalPnl >= 0 ? "+" : ""}
											{formatCurrency(totalPnl)}
										</span>
										{unrealizedGainPct !== null && (
											<span
												className={cn(
													"px-1.5 py-0.5 rounded text-xs font-medium",
													totalPnl >= 0
														? "bg-gain/15 text-gain"
														: "bg-loss/15 text-loss",
												)}
											>
												{totalPnl >= 0 ? "+" : ""}
												{unrealizedGainPct.toFixed(2)}%
											</span>
										)}
									</div>
								</div>
							)}
						</div>

						{/* Helpful subtle fiscal footer */}
						<p className="text-xs text-muted-foreground/80 pt-2 border-t border-border/15">
							To review lot-by-lot acquisitions or manage capital gains, visit the{" "}
							<span className="font-medium text-foreground">Tax Lots</span> tab.
						</p>
					</div>
				</div>
			</div>
		</TooltipProvider>
	);
}
