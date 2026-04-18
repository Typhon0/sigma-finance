// Dashboard-centric portfolio view components
export { useDashboardState } from "@/hooks/use-dashboard-state";
export type {
	AllocationItem,
	AllocationRecommendation,
	AssetAllocationProps,
} from "./asset-allocation";
export { default as AssetAllocation } from "./asset-allocation";
export { AssetPerformance } from "./asset-performance";
export { DashboardBreadcrumb } from "./dashboard-breadcrumb";
export { DashboardSkeleton } from "./dashboard-skeleton";
export {
	BreadcrumbTransition,
	ContentTransition,
	DashboardTransition,
} from "./dashboard-transitions";
export { InlineAssetDetail } from "./inline-asset-detail";
export { InlinePortfolioDetail } from "./inline-portfolio-detail";
export type {
	AlertFormData,
	PerformanceAlert,
	PerformanceAlertsProps,
} from "./performance-alerts";
export { default as PerformanceAlerts } from "./performance-alerts";
export type {
	BenchmarkData,
	PerformanceComparisonProps,
	PortfolioPerformanceData,
} from "./performance-comparison";
export { default as PerformanceComparison } from "./performance-comparison";
export type {
	PerformanceDashboardData,
	PerformanceDashboardProps,
} from "./performance-dashboard";
export { default as PerformanceDashboard } from "./performance-dashboard";
// Performance component types
export type {
	PerformanceMetric,
	PerformanceMetricsProps,
} from "./performance-metrics";
// Performance Analytics Components
export { default as PerformanceMetrics } from "./performance-metrics";
export type {
	PerformanceReportsProps,
	ReportConfig,
	ReportData,
} from "./performance-reports";
export { default as PerformanceReports } from "./performance-reports";
export { PortfolioOverview } from "./portfolio-overview";
// Re-export existing dashboard components for convenience
export { PortfolioSummaryCards } from "./portfolio-summary-cards";
export { QuickActions } from "./quick-actions";
export { RecentTransactions } from "./recent-transactions";
