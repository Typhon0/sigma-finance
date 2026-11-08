// Apache ECharts components for inline analytics

export type {
	AllocationChartProps,
	AllocationDataPoint,
} from "./AllocationChart";
export { default as AllocationChart } from "./AllocationChart";
export type { AssetHeroChartProps } from "./AssetHeroChart";
export {
	AssetHeroChart,
	buildPerformanceSeries,
	SignedDelta,
	TIME_RANGES,
} from "./AssetHeroChart";
export type { BenchmarkMetricsBarProps } from "./BenchmarkMetricsBar";
export { BenchmarkMetricsBar } from "./BenchmarkMetricsBar";
// Existing chart components
export { default as ChartContainer } from "./ChartContainer";
export { default as LightweightChart } from "./LightweightChart";
// Types
export type {
	PerformanceChartProps,
	PerformanceDataPoint,
} from "./PerformanceChart";
export { default as PerformanceChart } from "./PerformanceChart";
export type {
	PortfolioComparisonChartProps,
	PortfolioComparisonData,
	PortfolioPerformanceData,
} from "./PortfolioComparisonChart";
export { default as PortfolioComparisonChart } from "./PortfolioComparisonChart";
export type {
	BenchmarkMode,
	PerformancePoint,
	PortfolioHeroChartProps,
	TimeRange,
} from "./PortfolioHeroChart";
export { filterByRange, PortfolioHeroChart } from "./PortfolioHeroChart";
export type { CurveHoldingInput } from "./performance-series";
export {
	buildHistoryDate,
	buildMarketSynthesizedSeries,
	computeFallbackSparkline,
	getHistoryPointCount,
	resampleSeries,
	resolveHybridPerformanceSeries,
} from "./performance-series";
export { default as SimpleChart } from "./SimpleChart";
export { default as TradingViewChart } from "./TradingViewChart";
