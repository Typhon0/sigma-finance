export interface PerformanceDriversData {
	totalGain: number;
	topContributors: Array<{ symbol: string; gain: number }>;
	worstDraggers: Array<{ symbol: string; gain: number }>;
}

export interface PortfolioHealthData {
	/**
	 * Concentration band derived from the largest single position.
	 *
	 * It was previously called `risk` and rendered as a "Risk: High" badge, but
	 * a 30% position in one stock says nothing about volatility or drawdown - it
	 * is a concentration fact. Naming it honestly keeps it distinct from the
	 * measured risk metrics the card now also shows.
	 */
	concentration: "Low" | "Medium" | "High";
	topHoldingSymbol: string;
	topHoldingPct: number;
	top3Pct: number;
	largestSectorName: string;
	largestSectorPct: number;
	missingClassificationCount: number;
}

export interface IncomeForecastData {
	forwardAnnual: number;
	overallYield: number;
	bestPayerSymbol: string;
	bestPayerAnnual: number;
	nextPayerSymbol: string;
	nextPaymentEst: number;
}

export interface FeesTerData {
	/** Number of fund/ETF holdings in the portfolio. */
	count: number;
	/** Value of the holdings whose expense ratio is known, in display currency. */
	totalValue: number;
	/**
	 * Weighted average expense ratio across the holdings we have a figure for,
	 * as a percentage. Null when no holding reports one.
	 *
	 * It used to be a `number` backed by a hardcoded symbol table in the client
	 * (VOO -> 0.03, fallback 0.15), which turned an average guess into an annual
	 * fee in currency that the user would budget against. Null is the honest
	 * answer when nobody told us.
	 */
	avgTer: number | null;
	/** Estimated annual cost in display currency. Null when unknown. */
	annualCost: number | null;
	/**
	 * Holdings excluded from the calculation because no expense ratio is
	 * published for them. Surfaced so the card can explain a partial figure
	 * instead of presenting it as complete.
	 */
	unknownCount: number;
}

export interface RebalancingData {
	maxVariance: number;
	maxVarianceSector: string;
	needsAttentionCount: number;
	totalVariance: number;
}

export interface CurrencyExposureItem {
	currency: string;
	value: number;
	percentage: number;
}

export interface DataQualityData {
	missingCostCount: number;
	missingSectorCount: number;
	score: number;
}

export interface BenchmarkComparisonData {
	portfolioReturn: number;
	sp500Return: number;
	outperformance: number;
}
