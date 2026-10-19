import { Progress } from "@/components/ui/progress";
import type { PortfolioRiskMetrics } from "@/hooks/use-portfolio-risk-metrics";
import { cn } from "@/lib/utils";

/**
 * Presentation for the server-computed risk metrics.
 *
 * Shared by the Stocks & Funds "Portfolio Health" card and the Analytics page's
 * Risk tab, which previously disagreed: one showed nothing, the other showed
 * Beta 1.2 / Sharpe 1.8 / -8.5% as literals typed into the JSX.
 *
 * The one rule this component enforces is that a null metric renders as
 * "n/a" with the reason, never as a formatted zero. A portfolio with a 2-week
 * history has no annualised volatility, and printing `0.00%` says the opposite.
 */

interface RiskMetricRowsProps {
	metrics: PortfolioRiskMetrics;
	/** Compact drops the progress bars, for the card's tight layout. */
	compact?: boolean;
	className?: string;
}

/** Explanation shown when the server could not measure the metric. */
const UNAVAILABLE_TITLE =
	"Cannot be computed from the available price history. Annualising a short window would produce a number that swings wildly with a single day's move.";

function Row({
	label,
	value,
	formatted,
	hint,
	compact,
	scale,
	invert,
}: {
	label: string;
	/** Null renders the unavailable state. */
	value: number | null;
	formatted: (value: number) => string;
	hint?: string;
	compact?: boolean;
	/** Maps the value onto a 0-100 progress bar. */
	scale?: (value: number) => number;
	/** True when a higher value is the better outcome. */
	invert?: boolean;
}) {
	const available = value !== null;

	return (
		<div className="space-y-1.5">
			<div className="flex justify-between items-center text-xs">
				<span
					className={cn(
						"text-muted-foreground font-medium",
						hint &&
							"cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
					)}
					title={hint}
				>
					{label}
				</span>
				{available ? (
					<span className={cn("font-mono font-semibold", invert ? "text-gain" : "text-foreground")}>
						{formatted(value as number)}
					</span>
				) : (
					<span className="font-mono text-micro text-warning" title={hint ?? UNAVAILABLE_TITLE}>
						n/a
					</span>
				)}
			</div>
			{!compact && scale && (
				<Progress
					// A metric outside its expected range would overflow the bar;
					// clamping keeps the visual honest about the direction while
					// still showing where the number sits.
					value={available ? Math.max(0, Math.min(100, scale(value as number))) : 0}
					className="h-1.5"
				/>
			)}
		</div>
	);
}

export function RiskMetricRows({ metrics, compact = false, className }: RiskMetricRowsProps) {
	if (!metrics.hasData) {
		return (
			<p
				className={cn("text-micro text-warning leading-normal", className)}
				title={UNAVAILABLE_TITLE}
			>
				Risk metrics need a price history to measure. This portfolio does not have enough history
				yet.
			</p>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			<Row
				label={`Volatility (${Math.round(metrics.windowDays / 30)}m)`}
				value={metrics.volatility}
				formatted={(v) => `${v.toFixed(2)}%`}
				hint="Annualised standard deviation of daily returns (measures overall volatility; lower is calmer)."
				compact={compact}
				// 40% annualised volatility is a rough upper bound for a
				// conventional equity portfolio; beyond that the bar saturates.
				scale={(v) => v * 2.5}
			/>
			<Row
				label="Sharpe ratio"
				value={metrics.sharpeRatio}
				formatted={(v) => v.toFixed(2)}
				hint="Excess return earned per unit of total volatility, annualised (>1.0 is considered good, >2.0 is strong)."
				compact={compact}
				// 0 is break-even against the risk-free rate, 3 is strong.
				scale={(v) => (v / 3) * 100}
				invert
			/>
			<Row
				label="Sortino ratio"
				value={metrics.sortinoRatio}
				formatted={(v) => v.toFixed(2)}
				hint="Excess return per unit of downside volatility, annualised (>1.5 is considered strong)."
				compact={compact}
				scale={(v) => (v / 4) * 100}
				invert
			/>
			<Row
				label="Max drawdown"
				value={metrics.maxDrawdown}
				formatted={(v) => `${v.toFixed(2)}%`}
				hint="Largest peak-to-trough portfolio decline over the measured time window."
				compact={compact}
				// 50% is the scale of the worst equity declines; the value is
				// negative, so negate for the bar.
				scale={(v) => Math.abs(v) * 2}
			/>
		</div>
	);
}
