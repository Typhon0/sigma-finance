// Performance Metrics and Analytics Components
export { default as PerformanceMetrics, type PerformanceMetric, type PerformanceMetricsProps } from '../performance-metrics';
export { default as AssetAllocation, type AllocationItem, type AllocationRecommendation, type AssetAllocationProps } from '../asset-allocation';
export { default as PerformanceComparison, type BenchmarkData, type PortfolioPerformanceData, type PerformanceComparisonProps } from '../performance-comparison';
export { default as PerformanceReports, type ReportData, type ReportConfig, type PerformanceReportsProps } from '../performance-reports';
export { default as PerformanceAlerts, type PerformanceAlert, type AlertFormData, type PerformanceAlertsProps } from '../performance-alerts';
export { default as PerformanceDashboard, type PerformanceDashboardData, type PerformanceDashboardProps } from '../performance-dashboard';

// Re-export utility types
export type {
  ReportSection,
  ReportTemplate,
  ScheduledReportConfig,
} from '../performance-reports';