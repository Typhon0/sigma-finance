import { useQuery } from "@apollo/client";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BenchmarkComparisonQuery, BenchmarkComparisonQueryVariables } from "@/gql/graphql";
import { BENCHMARK_COMPARISON } from "@/graphql/queries/benchmarks";
import { type BenchmarkMode, useBenchmarkInstrumentId } from "@/hooks/useBenchmarkInstrumentId";

export type { BenchmarkMode } from "@/hooks/useBenchmarkInstrumentId";

export interface BenchmarkMetricsBarProps {
	/** Current portfolio ID (required for the query to fire). */
	portfolioID?: string;
	/** Benchmark mode e.g. "sp500", "nasdaq", "btc". */
	benchmarkMode?: BenchmarkMode;
	/** ISO date string for the comparison period start. Defaults to 90 days ago. */
	dateStart?: string;
	/** ISO date string for the comparison period end. Defaults to now. */
	dateEnd?: string;
}

/**
 * Self-contained benchmark metrics bar displaying Alpha, Beta, Correlation,
 * Tracking Error, and Information Ratio from the server-side
 * `benchmarkComparison` GraphQL query.
 *
 * Handles its own instrument resolution and query lifecycle.  Renders
 * `null` when data is not yet available or the query cannot fire.
 */
/**
 * Assumption-language for the metric strip: each abbreviation is a hover/focus
 * target with a one-line definition, so the Greek shorthand (β, ρ) never
 * requires finance background (document pass — critique #3, P1).
 */
function MetricTerm({
	term,
	spoken,
	definition,
}: {
	term: string;
	spoken: string;
	definition: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={`${spoken} — ${definition}`}
					className="text-muted-foreground cursor-help underline decoration-border decoration-dotted underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					{term}
				</button>
			</TooltipTrigger>
			<TooltipContent className="max-w-72">
				<span className="text-xs">
					<span className="font-semibold">{spoken}.</span> {definition}
				</span>
			</TooltipContent>
		</Tooltip>
	);
}

export function BenchmarkMetricsBar({
	portfolioID,
	benchmarkMode = "none",
	dateStart,
	dateEnd,
}: BenchmarkMetricsBarProps) {
	const { id: benchmarkInstrumentId, loading: instrumentLoading } =
		useBenchmarkInstrumentId(benchmarkMode);

	const canQuery = Boolean(
		portfolioID && benchmarkInstrumentId && benchmarkMode !== "none" && !instrumentLoading,
	);

	// Default to last 90 days when no explicit range is provided.
	const timeRange = useMemo(() => {
		const start =
			dateStart ??
			new Date(Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 60000) * 60000).toISOString();
		const end = dateEnd ?? new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
		return { start, end };
	}, [dateStart, dateEnd]);

	const { data: comparisonData } = useQuery<
		BenchmarkComparisonQuery,
		BenchmarkComparisonQueryVariables
	>(BENCHMARK_COMPARISON, {
		variables:
			canQuery && portfolioID && benchmarkInstrumentId
				? {
						portfolioId: portfolioID,
						benchmarkAssetId: benchmarkInstrumentId,
						timeRange,
					}
				: undefined,
		skip: !canQuery || !portfolioID || !benchmarkInstrumentId,
		fetchPolicy: "cache-first",
	});

	const metrics = useMemo(() => {
		const c = comparisonData?.benchmarkComparison;
		if (!c) return undefined;
		return {
			excessReturn: c.alpha,
			riskAdjustedAlpha: c.riskAdjustedAlpha,
			beta: c.beta,
			correlation: c.correlation,
			trackingError: c.trackingError,
			informationRatio: c.informationRatio,
		};
	}, [comparisonData]);

	if (!metrics) return null;

	return (
		<TooltipProvider delayDuration={150}>
			<div className="shrink-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-border/30 bg-card/60 px-4 py-2 text-micro backdrop-blur-xs">
				<div className="flex items-center gap-1.5">
					<BarChart3 className="h-3 w-3 text-muted-foreground" />
					<MetricTerm
						term="Excess Return"
						spoken="Excess Return"
						definition="Cumulative outperformance of the portfolio compared to the benchmark over this period (Time-Weighted Return difference)."
					/>
					<span
						className={`font-mono font-semibold ${metrics.excessReturn >= 0 ? "text-gain" : "text-loss"}`}
					>
						{metrics.excessReturn >= 0 ? "+" : ""}
						{metrics.excessReturn.toFixed(2)}%
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<MetricTerm
						term="Alpha (α)"
						spoken="Jensen's Alpha"
						definition="Annualized excess return beyond what this portfolio's market exposure (β) alone would predict (CAPM risk-adjusted alpha)."
					/>
					<span
						className={`font-mono font-semibold ${metrics.riskAdjustedAlpha >= 0 ? "text-gain" : "text-loss"}`}
					>
						{metrics.riskAdjustedAlpha >= 0 ? "+" : ""}
						{metrics.riskAdjustedAlpha.toFixed(2)}%/yr
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<MetricTerm
						term="β"
						spoken="Beta"
						definition="Sensitivity to the benchmark's swings. 1.00 moves in lockstep; above 1 amplifies both gains and losses."
					/>
					<span className="font-mono font-semibold text-foreground">{metrics.beta.toFixed(2)}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<MetricTerm
						term="ρ"
						spoken="Correlation"
						definition="How closely portfolio returns track the benchmark, from −1 to +1. Below 1 means the two partly diverge."
					/>
					<span className="font-mono font-semibold text-foreground">
						{metrics.correlation.toFixed(2)}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<MetricTerm
						term="TE"
						spoken="Tracking error"
						definition="Volatility of the gap between portfolio and benchmark returns. Higher means returns wander further from the index."
					/>
					<span className="font-mono font-semibold text-foreground">
						{metrics.trackingError.toFixed(2)}%
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<MetricTerm
						term="IR"
						spoken="Information ratio"
						definition="Excess return earned for each unit of tracking error. Above 0 means the extra risk against the benchmark is being paid for."
					/>
					<span
						className={`font-mono font-semibold ${metrics.informationRatio >= 0 ? "text-gain" : "text-loss"}`}
					>
						{metrics.informationRatio >= 0 ? "+" : ""}
						{metrics.informationRatio.toFixed(2)}
					</span>
				</div>
			</div>
		</TooltipProvider>
	);
}
