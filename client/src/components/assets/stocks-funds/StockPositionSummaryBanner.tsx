import { computeDayChangeAmount } from "@/components/stocks-funds/day-change";
import type { Asset } from "@/components/stocks-funds/types";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StockPositionSummaryBannerProps {
	position?: Asset | null;
	symbol: string;
	resolvedPrice: number;
	resolvedCurrency: string;
	formatCurrency: (value: number) => string;
	formatQuantity: (value: number) => string;
}

export function StockPositionSummaryBanner({
	position,
	symbol: _symbol,
	resolvedPrice,
	formatCurrency,
	formatQuantity,
}: StockPositionSummaryBannerProps) {
	if (!position || position.quantity <= 0) {
		return null;
	}

	const isPriceResolved = (position.currentPrice ?? resolvedPrice ?? 0) > 0;
	const currentPriceVal = position.currentPrice ?? resolvedPrice ?? 0;
	const totalCost = position.avgCost * position.quantity;
	const unrealizedGain = position.totalReturn;
	const unrealizedGainPct = position.totalReturnPercentage;

	// Day variation
	const dayChangePct = position.hasDayChange ? position.dayChangePercentage : null;
	const dayChangeAmt =
		position.hasDayChange && isPriceResolved
			? computeDayChangeAmount(position.totalValue, position.dayChangePercentage)
			: null;

	const accountLabel = position.account || "Portefeuille principal";
	const allocationPct = position.portfolioWeight > 0 ? position.portfolioWeight : 100;
	const canShowPct = position.fx ? position.fx.canShowPercentage : true;

	return (
		<div className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 shadow-xs">
			<div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border/30 gap-y-4 lg:gap-y-0">
				{/* 1. Market Value */}
				<div className="space-y-1 pr-0 lg:pr-5">
					<p className="text-xs font-medium text-muted-foreground">
						Market Value
					</p>
					<p className="font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-foreground whitespace-nowrap">
						{isPriceResolved ? formatCurrency(position.totalValue) : "—"}
					</p>
					<p className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
						{formatQuantity(position.quantity)} shares @ {formatCurrency(currentPriceVal)}
					</p>
				</div>

				{/* 2. Cost Basis */}
				<div className="space-y-1 pl-0 lg:pl-5 pr-0 lg:pr-5 pt-3 lg:pt-0">
					<p className="text-xs font-medium text-muted-foreground">
						Cost Basis
					</p>
					<p className="font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-foreground whitespace-nowrap">
						{formatCurrency(totalCost)}
					</p>
					<p className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
						avg. {formatCurrency(position.avgCost)}
					</p>
				</div>

				{/* 3. Unrealized Gain */}
				<div className="space-y-1 pl-0 lg:pl-5 pr-0 lg:pr-5 pt-3 lg:pt-0">
					<p className="text-xs font-medium text-muted-foreground">
						Unrealized Gain
					</p>
					<p
						className={cn(
							"font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap",
							unrealizedGain !== null && unrealizedGain >= 0 ? "text-gain" : "text-loss",
						)}
					>
						{unrealizedGain !== null
							? `${unrealizedGain >= 0 ? "+" : ""}${formatCurrency(unrealizedGain)}`
							: "—"}
					</p>
					{!canShowPct ? (
						<p className="font-mono text-xs text-warning cursor-help" title={position.fx.reason}>
							% n/a
						</p>
					) : (
						<p
							className={cn(
								"font-mono text-xs tabular-nums whitespace-nowrap",
								unrealizedGainPct !== null && unrealizedGainPct >= 0
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
				<div className="space-y-1 pl-0 lg:pl-5 pr-0 lg:pr-5 pt-3 lg:pt-0">
					<p className="text-xs font-medium text-muted-foreground">
						Day Change
					</p>
					{dayChangeAmt !== null && dayChangePct !== null ? (
						<>
							<p
								className={cn(
									"font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap",
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
							<p className="font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-muted-foreground">
								—
							</p>
							<p className="font-mono text-xs text-muted-foreground">—</p>
						</>
					)}
				</div>

				{/* 5. Allocation */}
				<div className="col-span-2 lg:col-span-1 space-y-2 pl-0 lg:pl-5 pt-3 lg:pt-0 flex flex-col justify-between">
					<div className="flex items-center justify-between text-xs">
						<span className="font-medium text-muted-foreground">Allocation</span>
						<span className="font-mono font-semibold text-foreground tabular-nums">
							{allocationPct.toFixed(2)}%
						</span>
					</div>
					<div className="space-y-2">
						<Progress
							value={Math.min(100, Math.max(0, allocationPct))}
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
