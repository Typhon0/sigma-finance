export interface PerformanceDriversData {
	totalGain: number;
	topContributors: Array<{ symbol: string; gain: number }>;
	worstDraggers: Array<{ symbol: string; gain: number }>;
}

export interface PortfolioHealthData {
	risk: "Low" | "Medium" | "High";
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
	nextMonthName: string;
}

export interface FeesTerData {
	count: number;
	totalValue: number;
	avgTer: number;
	annualCost: number;
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
