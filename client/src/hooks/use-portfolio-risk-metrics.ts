import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { GET_PORTFOLIO_RISK_METRICS } from "@/graphql/queries/performance";

/**
 * Portfolio risk metrics, computed by the server from the actual return series.
 *
 * ## Why this exists
 *
 * Two things used to stand in for real risk measurement:
 *
 * 1. `analytics.riskMetrics` on the portfolio list, which the valuation path
 *    fills with literal zeros because it has portfolio totals but no return
 *    series. "0.00 max drawdown" reads as a boast, not a missing value.
 * 2. Literal numbers typed into the Analytics page: Beta 1.2, Sharpe 1.8,
 *    max drawdown -8.5%. A volatility of `Math.abs(gainPercent)` - the
 *    portfolio's total return, relabelled.
 *
 * `portfolioRiskMetrics` is the one endpoint that actually measures these. It
 * was already exposed and already queried by nobody.
 *
 * ## Reading the result
 *
 * Every field is `number | null`. Null means the server could not compute it -
 * typically too short a history to annualise - and is *not* zero. Callers must
 * render an explicit unavailable state rather than formatting `null` as `0`.
 */

/** The window to measure over, in days. */
const DEFAULT_WINDOW_DAYS = 365;

export interface PortfolioRiskMetrics {
	/** Annualised standard deviation of daily returns, as a percentage. */
	volatility: number | null;
	/** Excess return per unit of total volatility, annualised. */
	sharpeRatio: number | null;
	/** Excess return per unit of downside volatility, annualised. */
	sortinoRatio: number | null;
	/** Largest peak-to-trough decline, as a percentage (a negative number). */
	maxDrawdown: number | null;
	/** Not computed on this path; always null. */
	diversification: number | null;
	/** False when the server could not measure anything over the window. */
	hasData: boolean;
	/** Window the metrics were measured over, for display. */
	windowDays: number;
}

const UNAVAILABLE: PortfolioRiskMetrics = {
	volatility: null,
	sharpeRatio: null,
	sortinoRatio: null,
	maxDrawdown: null,
	diversification: null,
	hasData: false,
	windowDays: DEFAULT_WINDOW_DAYS,
};

function finiteOrNull(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface UsePortfolioRiskMetricsResult {
	metrics: PortfolioRiskMetrics;
	loading: boolean;
	error: Error | null;
}

/**
 * Fetch real risk metrics for a portfolio.
 *
 * @param portfolioId - Portfolio to measure. Empty or null skips the query.
 * @param windowDays  - Lookback window, default one year. The server annualises
 *                      over trading days, so a window shorter than the history
 *                      simply yields no data rather than a noisier estimate.
 */
export function usePortfolioRiskMetrics(
	portfolioId: string | null | undefined,
	windowDays: number = DEFAULT_WINDOW_DAYS,
): UsePortfolioRiskMetricsResult {
	// Round both bounds to the minute. The server keys its performance cache on
	// the exact range, so a millisecond-level `Date.now()` would miss the cache
	// on every render and recompute the whole series.
	const timeRange = useMemo(() => {
		const minuteMs = 60_000;
		const end = new Date(Math.floor(Date.now() / minuteMs) * minuteMs);
		const start = new Date(
			Math.floor((end.getTime() - windowDays * 24 * 60 * 60 * 1000) / minuteMs) * minuteMs,
		);
		return { start: start.toISOString(), end: end.toISOString() };
	}, [windowDays]);

	const { data, loading, error } = useQuery(GET_PORTFOLIO_RISK_METRICS, {
		variables: portfolioId ? { portfolioId, timeRange } : undefined,
		skip: !portfolioId,
		// A portfolio's risk profile does not change minute to minute. Caching
		// for a session avoids recomputing the return series on every mount.
		fetchPolicy: "cache-first",
	});

	const metrics = useMemo<PortfolioRiskMetrics>(() => {
		const raw = data?.portfolioRiskMetrics;
		if (!raw) return UNAVAILABLE;

		const volatility = finiteOrNull(raw.volatility);
		const sharpeRatio = finiteOrNull(raw.sharpeRatio);
		const sortinoRatio = finiteOrNull(raw.sortinoRatio);
		const maxDrawdown = finiteOrNull(raw.maxDrawdown);

		return {
			volatility,
			sharpeRatio,
			sortinoRatio,
			maxDrawdown,
			diversification: finiteOrNull(raw.diversification),
			// A single measurable field is enough to render the card; max drawdown
			// in particular is available as soon as there are two data points,
			// while Sharpe needs a full year of returns.
			hasData: [volatility, sharpeRatio, sortinoRatio, maxDrawdown].some((value) => value !== null),
			windowDays,
		};
	}, [data, windowDays]);

	return {
		metrics,
		loading: Boolean(portfolioId) && loading,
		error: (error as Error | undefined) ?? null,
	};
}
