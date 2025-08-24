// Export dashboard data hooks

export * from "./use-dashboard-calculations";
export {
	useDashboardCalculations,
	usePortfolioCalculations,
} from "./use-dashboard-calculations";
export * from "./use-dashboard-data";
// Re-export commonly used hooks
export {
	useAlerts,
	useAssetAllocation,
	useAssetPerformance,
	useDashboardData,
	usePortfolioSummary,
	useRecentTransactions,
} from "./use-dashboard-data";
