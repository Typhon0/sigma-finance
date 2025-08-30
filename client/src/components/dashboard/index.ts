// Dashboard-centric portfolio view components
export { useDashboardState } from '@/hooks/use-dashboard-state';
export { DashboardBreadcrumb } from './dashboard-breadcrumb';
export { DashboardTransition, BreadcrumbTransition, ContentTransition } from './dashboard-transitions';
export { InlinePortfolioDetail } from './inline-portfolio-detail';
export { InlineAssetDetail } from './inline-asset-detail';

// Re-export existing dashboard components for convenience
export { PortfolioSummaryCards } from './portfolio-summary-cards';
export { PortfolioOverview } from './portfolio-overview';
export { AssetPerformance } from './asset-performance';
export { QuickActions } from './quick-actions';
export { RecentTransactions } from './recent-transactions';
export { DashboardSkeleton } from './dashboard-skeleton';

// Performance Analytics Components
export { default as PerformanceMetrics } from './performance-metrics';
export { default as AssetAllocation } from './asset-allocation';
export { default as PerformanceComparison } from './performance-comparison';
export { default as PerformanceReports } from './performance-reports';
export { default as PerformanceAlerts } from './performance-alerts';
export { default as PerformanceDashboard } from './performance-dashboard';

// Performance component types
export type { PerformanceMetric, PerformanceMetricsProps } from './performance-metrics';
export type { AllocationItem, AllocationRecommendation, AssetAllocationProps } from './asset-allocation';
export type { BenchmarkData, PortfolioPerformanceData, PerformanceComparisonProps } from './performance-comparison';
export type { ReportData, ReportConfig, PerformanceReportsProps } from './performance-reports';
export type { PerformanceAlert, AlertFormData, PerformanceAlertsProps } from './performance-alerts';
export type { PerformanceDashboardData, PerformanceDashboardProps } from './performance-dashboard';