// Performance Metrics and Analytics Components

export {
	type AllocationItem,
	type AllocationRecommendation,
	type AssetAllocationProps,
	default as AssetAllocation,
} from "../asset-allocation";
export {
	type AlertFormData,
	default as PerformanceAlerts,
	type PerformanceAlert,
	type PerformanceAlertsProps,
} from "../performance-alerts";
export {
	type BenchmarkData,
	default as PerformanceComparison,
	type PerformanceComparisonProps,
	type PortfolioPerformanceData,
} from "../performance-comparison";
export {
	default as PerformanceDashboard,
	type PerformanceDashboardData,
	type PerformanceDashboardProps,
} from "../performance-dashboard";
export {
	default as PerformanceMetrics,
	type PerformanceMetric,
	type PerformanceMetricsProps,
} from "../performance-metrics";
// Re-export utility types
export type {
	ReportSection,
	ReportTemplate,
	ScheduledReportConfig,
} from "../performance-reports";
export {
	default as PerformanceReports,
	type PerformanceReportsProps,
	type ReportConfig,
	type ReportData,
} from "../performance-reports";
