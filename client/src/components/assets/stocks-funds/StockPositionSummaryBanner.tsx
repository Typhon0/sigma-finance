import { InfoHint } from "@/components/shared/info-hint";
import { computeDayChangeAmount } from "@/components/stocks-funds/day-change";
import type { Asset } from "@/components/stocks-funds/types";
import { Progress } from "@/components/ui/progress";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StockPositionSummaryBannerProps {
	position?: Asset | null;
	resolvedPrice: number;
	/** The instrument's quote currency — price and cost figures are recorded in it. */
	currency?: string;
	formatCurrency: (value: number) => string;
	formatQuantity: (value: number) => string;
}

export function StockPositionSummaryBanner({
	position,
	resolvedPrice,
	currency = "USD",
	formatCurrency,
	formatQuantity,
}: StockPositionSummaryBannerProps) {
	if (!position || position.quantity <= 0) {
		return null;
	}

	// Per-unit price and average cost stay in the instrument's quote currency;
	// the display-format hook would only relabel them into the viewer's
	// preferred currency, which these figures never underwent. (Market Value
	// and Unrealized Gain above keep the display-bind — the server publishes
	// them in it, or publishes nothing.)
	const formatInstrumentFigure = (val: number) => formatMoney(val, currency);
	const isPriceResolved = (position.currentPrice ?? resolvedPrice ?? 0) > 0;
	const currentPriceVal = position.currentPrice ?? resolvedPrice ?? 0;
	const totalCost = position.avgCost > 0 ? position.avgCost * position.quantity : null;
	const unrealizedGain = position.totalReturn;
	const unrealizedGainPct = position.totalReturnPercentage;

	// Day variation
	const dayChangePct = position.hasDayChange ? position.dayChangePercentage : null;
	const dayChangeAmt =
		position.hasDayChange && isPriceResolved
			? computeDayChangeAmount(position.totalValue, position.dayChangePercentage)
			: null;

	const accountLabel = position.account || "Main portfolio";
	// A weight the provider did not resolve stays unrealized: dash, not a
	// fabricated 100% — allocation must never read as a measurement the
	// provider never sent.
	const allocationPct = position.portfolioWeight > 0 ? position.portfolioWeight : null;
	const canShowPct = position.fx ? position.fx.canShowPercentage : true;

	return (
		<div className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 shadow-xs">
			{/* Cell rows adapt to the sheet container (672px max), not the
			    viewport: 2-col on narrow, 3-col in the sheet. Dividers are
			    drawn per-cell because a grid divide-* rule fragments on
			    same-row neighbour cells. */}
			<div className="grid grid-cols-2 gap-y-4 @xl:grid-cols-3">
				{/* 1. Market Value */}
				<div className="space-y-1 border-b border-border/30">
					<p className="text-xs font-medium text-muted-foreground">Market Value</p>
					<p className="font-mono text-xl font-bold tracking-tight tabular-nums text-foreground whitespace-nowrap">
						{isPriceResolved ? formatCurrency(position.totalValue) : "—"}
					</p>
					{/* Wraps rather than clips: a truncated "15 shares @ $200.00"
					    reads as a different number than the one the server sent. */}
					<p className="font-mono text-xs text-muted-foreground tabular-nums">
						{formatQuantity(position.quantity)} shares @{" "}
						{isPriceResolved ? formatInstrumentFigure(currentPriceVal) : "—"}
					</p>
				</div>

				{/* 2. Cost Basis */}
				<div className="space-y-1 pt-3 @xl:pt-0 @xl:pl-5 border-b border-border/30 @xl:border-l @xl:border-border/30">
					<p className="text-xs font-medium text-muted-foreground">Cost Basis</p>
					<p className="font-mono text-xl font-bold tracking-tight tabular-nums text-foreground whitespace-nowrap">
						{totalCost != null ? formatInstrumentFigure(totalCost) : "—"}
					</p>
					{position.avgCost != null && position.avgCost > 0 ? (
						<p className="font-mono text-xs text-muted-foreground tabular-nums">
							avg. {formatInstrumentFigure(position.avgCost)}
						</p>
					) : null}
				</div>

				{/* 3. Unrealized Gain */}
				<div className="space-y-1 pt-3 @xl:pt-0 @xl:pl-5 border-b border-border/30 @xl:border-l @xl:border-border/30">
					<p className="text-xs font-medium text-muted-foreground">Unrealized Gain/Loss</p>
					<p
						className={cn(
							"font-mono text-xl font-bold tracking-tight tabular-nums whitespace-nowrap",
							unrealizedGain == null
								? "text-muted-foreground"
								: unrealizedGain >= 0
									? "text-gain"
									: "text-loss",
						)}
					>
						{unrealizedGain !== null
							? `${unrealizedGain >= 0 ? "+" : ""}${formatCurrency(unrealizedGain)}`
							: "—"}
					</p>
					{!canShowPct ? (
						<p className="font-mono text-xs text-warning">
							% n/a
							<InfoHint
								label="Why the percentage is unavailable"
								className="ml-1.5 align-middle text-warning/70 hover:text-warning"
							>
								{position.fx.reason}
							</InfoHint>
						</p>
					) : (
						<p
							className={cn(
								"font-mono text-xs tabular-nums whitespace-nowrap",
								unrealizedGainPct == null
									? "text-muted-foreground"
									: unrealizedGainPct >= 0
										? "text-gain-muted"
										: "text-loss-muted",
							)}
						>
							{unrealizedGainPct !== null
								? `${unrealizedGainPct >= 0 ? "+" : ""}${unrealizedGainPct.toFixed(2)}%`
								: "—"}
						</p>
					)}
				</div>

				{/* 4. Day Change */}
				<div className="space-y-1 pt-3 @xl:pt-0 @xl:pl-5 border-b @xl:border-b-0 border-border/30">
					<p className="text-xs font-medium text-muted-foreground">Day Change</p>
					{dayChangeAmt !== null && dayChangePct !== null ? (
						<>
							<p
								className={cn(
									"font-mono text-xl font-bold tracking-tight tabular-nums whitespace-nowrap",
									dayChangeAmt >= 0 ? "text-gain" : "text-loss",
								)}
							>
								{dayChangeAmt >= 0 ? "+" : ""}
								{formatCurrency(dayChangeAmt)}
							</p>
							<p
								className={cn(
									"font-mono text-xs tabular-nums whitespace-nowrap",
									dayChangePct >= 0 ? "text-gain-muted" : "text-loss-muted",
								)}
							>
								{dayChangePct >= 0 ? "+" : ""}
								{dayChangePct.toFixed(2)}%
							</p>
						</>
					) : (
						<>
							<p className="font-mono text-xl font-bold tracking-tight tabular-nums text-muted-foreground">
								—
							</p>
							<p className="font-mono text-xs text-muted-foreground">—</p>
						</>
					)}
				</div>

				{/* 5. Allocation — spans the full second row under 2-col and
				    takes the last row-wide band in the sheet's 3-col rows. */}
				<div className="col-span-2 space-y-2 pt-3 @xl:pt-0 @xl:pl-5 flex flex-col justify-between @xl:border-l @xl:border-border/30">
					<div className="flex items-center justify-between text-xs">
						<span className="font-medium text-muted-foreground">Allocation</span>
						<span className="font-mono font-semibold text-foreground tabular-nums">
							{allocationPct != null ? `${allocationPct.toFixed(2)}%` : "—"}
						</span>
					</div>
					<div className="space-y-2">
						<Progress
							value={allocationPct != null ? Math.min(100, Math.max(0, allocationPct)) : 0}
							className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-gain"
						/>
						<p className="font-mono text-xs text-muted-foreground flex items-center gap-1.5 whitespace-nowrap truncate">
							<span className="inline-block h-2 w-2 rounded-full bg-gain shrink-0" />
							<span className="truncate">{accountLabel}</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
