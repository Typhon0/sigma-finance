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