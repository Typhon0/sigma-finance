// Apache ECharts components for inline analytics
export { default as PerformanceChart } from './PerformanceChart';
export { default as AllocationChart } from './AllocationChart';
export { default as PortfolioComparisonChart } from './PortfolioComparisonChart';

// Compact chart variants for dashboard integration
export {
  CompactPerformanceChart,
  CompactAllocationChart,
  CompactPortfolioComparisonChart,
  MiniPerformanceSparkline,
  MiniAllocationDonut,
  DashboardChartGrid,
  ChartCard,
  ResponsiveChartContainer,
} from './CompactCharts';

// Chart interaction utilities
export * from './ChartInteractions';

// Example/demo components
export { default as ChartExamples } from './ChartExamples';
export { default as DashboardIntegrationExample } from './DashboardIntegrationExample';

// Existing chart components
export { default as ChartContainer } from './ChartContainer';
export { default as LightweightChart } from './LightweightChart';
export { default as SimpleChart } from './SimpleChart';
export { default as TradingViewChart } from './TradingViewChart';

// Types
export type { PerformanceDataPoint, PerformanceChartProps } from './PerformanceChart';
export type { AllocationDataPoint, AllocationChartProps } from './AllocationChart';
export type { 
  PortfolioPerformanceData, 
  PortfolioComparisonData, 
  PortfolioComparisonChartProps 
} from './PortfolioComparisonChart';
export type {
  CompactPerformanceChartProps,
  CompactAllocationChartProps,
  CompactPortfolioComparisonChartProps,
  MiniPerformanceSparklineProps,
  MiniAllocationDonutProps,
  DashboardChartGridProps,
  ChartCardProps,
  ResponsiveChartContainerProps,
} from './CompactCharts';