import { BarChart3, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Explained, InfoHint } from "@/components/shared/info-hint";
import type { Asset } from "@/components/stocks-funds/types";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StockPerformanceBreakdownProps {
	/** Normalized position from StocksFundsModule — the same Asset the banner consumes. */
	position?: Asset | null;
	/**
	 * Live price the caller has already resolved from the position. Zero means
	 * "not resolved yet": every display renders —, never $0.00.
	 */
	currentPrice?: number;
	resolvedCurrency: string;
	/**
	 * Realized fiscal gain/loss for this position, summed by the caller from
	 * recorded dispositions (the same ledger the Tax Lots section renders).
	 * null when the caller has no records loaded — renders —, never a
	 * fabricated zero.
	 */
	realizedGainLoss?: number | null;
	/**
	 * The currency those realized figures are recorded in (single currency
	 * across the position's lots). null ⇒ the sum is mixed-basis or not yet
	 * known: the figures exist but the caller withholds them (realized is
	 * already null) and the rows print —, never a labeled figure without a
	 * real currency claim behind it.
	 */
	realizedCurrencyBasis?: string | null;
	/**
	 * Realized gain/loss that is held in a tax-exempt wrapper (or PEA

	 * portfolio) — genuinely realized but outside the capital-gains tax
	 * ledger. Rendered as a muted secondary note when non-zero.
	 */
	exemptGainLoss?: number | null;
	hasDispositionRecords?: boolean;
	/**
	 * The viewer's display currency (the formatCurrency bind). The server
	 * publishes `totalReturn` only when the whole position converted into it
	 * (fx-valuation rules) — so a Total Net P&L is a real number only when
	 * the ledger's realized basis IS the display currency; otherwise the
	 * addends stand in different currencies and the row withholds.
	 */
	displayCurrency?: string;
	/** Last recorded daily quote (O/H/L/C/V), or null when none is on record. */
	open?: number | null;
	high?: number | null;
	low?: number | null;
	close?: number | null;
	volume?: number | null;
}

export function StockPerformanceBreakdown({
	position,
	currentPrice = 0,
	resolvedCurrency,
	realizedGainLoss,
	realizedCurrencyBasis,
	exemptGainLoss,
	hasDispositionRecords,
	displayCurrency,
	open,
	high,
	low,
	close,
	volume,
}: StockPerformanceBreakdownProps) {
	// A zero price means the price fetch has not landed yet (same gate as the
	// holdings table); every display flows through this single value.
	const price = currentPrice;

	// Per-unit candle prices are recorded in the instrument's own currency —
	// the display-format hook would only relabel them. These cells claim the
	// quote currency, exactly as the panel's Quote Currency cell does.
	const formatInstrumentFigure = (val: number) => formatMoney(val, resolvedCurrency);

	// True only when a real day range exists on the recorded quote; a narrowed
	// case keeps the type-checker above the non-null-assertion line.
	const dayRange = high != null && low != null && high > low ? { high, low } : null;
	const hasSpread = dayRange !== null;

	// Price Return relative to the position's average cost basis. Both figures
	// are per-unit prices in the instrument's own currency, so the ratio stays
	// valid even when a display-currency FX conversion is unavailable.
	const priceReturnPct = useMemo(() => {
		const avgPrice = position?.avgCost;
		if (avgPrice == null || avgPrice <= 0 || price <= 0) return null;
		return ((price - avgPrice) / avgPrice) * 100;
	}, [position?.avgCost, price]);

	// Current price position inside the day range (0% to 100%)
	const dayRangePct = useMemo(() => {
		if (!dayRange || price <= 0) return 50;
		const pct = ((price - dayRange.low) / (dayRange.high - dayRange.low)) * 100;
		return Math.min(100, Math.max(0, pct));
	}, [dayRange, price]);

	// Total Net P&L: unrealized gain (display currency, server valuation) plus
	// realized gain from recorded dispositions. It renders only when every
	// input is real — a missing part suppresses the row instead of printing a
	// synthesized zero.
	const totalNetPnl = useMemo(() => {
		if (!hasDispositionRecords || realizedGainLoss == null) return null;
		// Adding the two only stands when they share ONE currency by real
		// basis: realized stands in the ledger's recorded currency, while a
		// published totalReturn is display-currency by the server's
		// conversion rule (`fx.basis: converted-basis | same-currency`).
		// Different currencies ⇒ the sum is withheld, not relabeled.
		if (realizedCurrencyBasis == null || displayCurrency == null) return null;
		if (realizedCurrencyBasis !== displayCurrency) return null;
		if (position?.totalReturn == null) return null;
		return position.totalReturn + realizedGainLoss;
	}, [
		position?.totalReturn,
		realizedGainLoss,
		hasDispositionRecords,
		realizedCurrencyBasis,
		displayCurrency,
	]);

	// The Account row shows what the provider recorded, or an honest dash —
	// "Manual Entry" invented an account that may not exist.
	const accountName = position?.account || null;

	return (
		<div className="w-full rounded-xl border border-border/30 bg-card/50 p-5 sm:p-6 shadow-xs">
			<h2 className="sr-only">Performance</h2>

			{/* Two-column split at @xl (36rem): the only wide step this 672px
			    sheet can reach — @2xl+ measure 42rem+, wider than the sheet's
			    ~640px content box, so they would never fire. */}
			<div className="grid grid-cols-1 gap-8 divide-y divide-border/20 @xl:grid-cols-2 @xl:divide-y-0 @xl:divide-x">
				{/* LEFT COLUMN: Market & Day Range */}
				<div className="space-y-4 @xl:pr-4">
					<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						<BarChart3 className="h-3.5 w-3.5 text-primary" />
						<span>Market &amp; Day Range</span>
					</div>

					{/* Range slider or flat-day indicator */}
					{hasSpread ? (
						<div className="space-y-2 py-1">
							<div className="flex justify-between items-center flex-wrap gap-y-1 text-xs font-mono">
								<span className="text-muted-foreground">
									Low:{" "}
									<span className="text-foreground">{formatInstrumentFigure(dayRange.low)}</span>
								</span>
								<span className="font-semibold text-foreground px-2 py-0.5 rounded bg-muted/40">
									{/* A recorded range does not mean a live price: the
									    quote chain may still be settling, and "$0.00" in
									    the middle of a range would read as a real value
									    the chain never produced. */}
									Current: {price > 0 ? formatInstrumentFigure(price) : "—"}
								</span>
								<span className="text-muted-foreground">
									High:{" "}
									<span className="text-foreground">{formatInstrumentFigure(dayRange.high)}</span>
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
								{price > 0 ? "Range unavailable" : "—"}
							</span>
						</div>
					)}

					{/* Clean 3x2 grid for market metrics */}
					<div className="grid grid-cols-2 @xl:grid-cols-3 gap-4 pt-2 font-mono text-sm">
						<div className="space-y-0.5">
							<p className="text-xs font-sans text-muted-foreground">Open</p>
							<p className="font-medium text-foreground tabular-nums">
								{open != null && open > 0 ? formatInstrumentFigure(open) : "—"}
							</p>
						</div>
						<div className="space-y-0.5">
							<p className="text-xs font-sans text-muted-foreground">Prev Close</p>
							<p className="font-medium text-foreground tabular-nums">
								{close != null && close > 0 ? formatInstrumentFigure(close) : "—"}
							</p>
						</div>
						<div className="space-y-0.5">
							<p className="text-xs font-sans text-muted-foreground">Volume</p>
							<p className="font-medium text-foreground tabular-nums">
								{volume != null && volume > 0 ? formatQty(volume) : "—"}
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
									<Explained
										description={
											position.fx.fxAsOf
												? `The FX rate used to value this position was last observed ${formatDate(position.fx.fxAsOf)} and is considered stale.`
												: "The FX rate used to value this position is stale."
										}
									>
										<Badge
											variant="outline"
											className="h-4 px-1 py-0 text-micro uppercase border-warning/30 bg-warning/10 text-warning"
										>
											stale rates
										</Badge>
									</Explained>
								)}
							</div>
						</div>
						<div className="space-y-0.5">
							<p className="text-xs font-sans text-muted-foreground">Account</p>
							<p
								className={cn(
									"font-medium truncate",
									accountName ? "text-foreground" : "text-muted-foreground",
								)}
								title={accountName ?? undefined}
							>
								{accountName ?? "—"}
							</p>
						</div>
					</div>
				</div>

				{/* RIGHT COLUMN: Performance & Tax Basis */}
				<div className="space-y-4 @xl:pl-4">
					<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						<TrendingUp className="h-3.5 w-3.5 text-primary" />
						<span>Performance &amp; Tax Basis</span>
					</div>

					<div className="divide-y divide-border/20 text-sm">
						{/* Price Return */}
						<div className="py-2.5 flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground">Price Return</span>
								<InfoHint label="What is Price Return?">
									Price change relative to the average purchase cost basis.
								</InfoHint>
							</div>
							<div className="font-mono tabular-nums">
								{priceReturnPct !== null ? (
									<span
										className={cn(
											"px-2 py-0.5 rounded text-xs font-medium",
											priceReturnPct >= 0 ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss",
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

						{/* Realized Fiscal P&L — from recorded dispositions, the same
						    ledger the Tax Lots section renders. Unknown until its
						    records load: an honest dash, not a fabricated zero. */}
						<div className="py-2.5 flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground">Realized Fiscal P&amp;L</span>
								<InfoHint label="What is Realized Fiscal P&L?">
									{realizedCurrencyBasis == null
										? "Net capital gains or losses from recorded tax-lot sales — shown once the ledger's recorded currency basis resolves."
										: "Net capital gains or losses from recorded tax-lot sales."}
								</InfoHint>
							</div>
							<div className="font-mono tabular-nums">
								{realizedGainLoss == null || realizedCurrencyBasis == null ? (
									<span className="text-muted-foreground">—</span>
								) : realizedGainLoss === 0 ? (
									<span className="text-xs text-muted-foreground">
										{formatMoney(realizedGainLoss, realizedCurrencyBasis)}
									</span>
								) : (
									<span
										className={cn("font-medium", realizedGainLoss >= 0 ? "text-gain" : "text-loss")}
									>
										{realizedGainLoss >= 0 ? "+" : ""}
										{formatMoney(realizedGainLoss, realizedCurrencyBasis)}
									</span>
								)}
							</div>
						</div>
						{exemptGainLoss != null && exemptGainLoss !== 0 && realizedCurrencyBasis != null && (
							<div className="py-1.5 pl-1 flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Held in a tax-exempt wrapper</span>
								<span
									className={cn(
										"font-mono font-medium",
										exemptGainLoss >= 0 ? "text-gain-muted" : "text-loss-muted",
									)}
								>
									{exemptGainLoss >= 0 ? "+" : ""}
									{formatMoney(exemptGainLoss, realizedCurrencyBasis)}
								</span>
							</div>
						)}

						{/* Combined Net P&L if the split is fully known */}
						{totalNetPnl !== null && (
							<div className="py-2.5 flex items-center justify-between bg-muted/15 px-2 -mx-2 rounded">
								<div className="flex items-center gap-1.5">
									<span className="font-medium text-foreground">Total Net P&amp;L</span>
									<InfoHint label="What is Total Net P&L?">
										Unrealized gain plus realized gain from recorded tax-lot sales.
									</InfoHint>
								</div>
								<div className="font-mono tabular-nums">
									<span
										className={cn("font-semibold", totalNetPnl >= 0 ? "text-gain" : "text-loss")}
									>
										{totalNetPnl >= 0 ? "+" : ""}
										{formatMoney(
											totalNetPnl,
											realizedCurrencyBasis ?? displayCurrency ?? resolvedCurrency,
										)}
									</span>
								</div>
							</div>
						)}
					</div>

					{/* Helpful subtle fiscal footer */}
					<p className="text-xs text-muted-foreground/80 pt-2 border-t border-border/15">
						Lot-by-lot acquisitions and capital-gain classifications are in the{" "}
						<span className="font-medium text-foreground">Tax Lots</span> section below.
					</p>
				</div>
			</div>
		</div>
	);
}
