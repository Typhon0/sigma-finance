import { useQuery } from "@apollo/client";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
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
			alpha: c.alpha,
			beta: c.beta,
			correlation: c.correlation,
			trackingError: c.trackingError,
			informationRatio: c.informationRatio,
		};
	}, [comparisonData]);

	if (!metrics) return null;

	return (
		<div className="shrink-0 flex items-center justify-center gap-5 border-t border-border/30 bg-card/60 px-4 py-2 text-[10px] backdrop-blur-xs">
			<div className="flex items-center gap-1.5">
				<BarChart3 className="h-3 w-3 text-violet-400" />
				<span className="text-muted-foreground">Alpha</span>
				<span
					className={`font-mono font-semibold ${metrics.alpha >= 0 ? "text-emerald-500" : "text-rose-500"}`}
				>
					{metrics.alpha >= 0 ? "+" : ""}
					{metrics.alpha.toFixed(2)}%
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="text-muted-foreground">β</span>
				<span className="font-mono font-semibold text-foreground">{metrics.beta.toFixed(2)}</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="text-muted-foreground">ρ</span>
				<span className="font-mono font-semibold text-foreground">
					{metrics.correlation.toFixed(2)}
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="text-muted-foreground">TE</span>
				<span className="font-mono font-semibold text-foreground">
					{metrics.trackingError.toFixed(2)}%
				</span>
			</div>
			<div className="flex items-center gap-1.5">
				<span className="text-muted-foreground">IR</span>
				<span
					className={`font-mono font-semibold ${metrics.informationRatio >= 0 ? "text-emerald-500" : "text-rose-500"}`}
				>
					{metrics.informationRatio >= 0 ? "+" : ""}
					{metrics.informationRatio.toFixed(2)}
				</span>
			</div>
		</div>
	);
}
