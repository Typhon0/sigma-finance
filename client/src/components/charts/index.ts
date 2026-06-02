// Apache ECharts components for inline analytics

export type {
	AllocationChartProps,
	AllocationDataPoint,
} from "./AllocationChart";
export { default as AllocationChart } from "./AllocationChart";
// Existing chart components
export { default as ChartContainer } from "./ChartContainer";
// Example/demo components
export { default as ChartExamples } from "./ChartExamples";

// Chart interaction utilities
export * from "./ChartInteractions";
export type {
	ChartCardProps,
	CompactAllocationChartProps,
	CompactPerformanceChartProps,
	CompactPortfolioComparisonChartProps,
	DashboardChartGridProps,
	MiniAllocationDonutProps,
	MiniPerformanceSparklineProps,
	ResponsiveChartContainerProps,
} from "./CompactCharts";
// Compact chart variants for dashboard integration
export {
	ChartCard,
	CompactAllocationChart,
	CompactPerformanceChart,
	CompactPortfolioComparisonChart,
	DashboardChartGrid,
	MiniAllocationDonut,
	MiniPerformanceSparkline,
	ResponsiveChartContainer,
} from "./CompactCharts";
export { default as DashboardIntegrationExample } from "./DashboardIntegrationExample";
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
export { buildBenchmarkSeries, filterByRange, PortfolioHeroChart } from "./PortfolioHeroChart";
export { default as SimpleChart } from "./SimpleChart";
export { default as TradingViewChart } from "./TradingViewChart";
