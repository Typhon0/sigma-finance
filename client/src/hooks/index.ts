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

// Export retry and error handling hooks
export * from "./use-retry-mechanism";
export {
	useRetryMechanism,
	useApolloRetry,
	usePortfolioRetry,
	type RetryOptions,
	type RetryState,
} from "./use-retry-mechanism";
export * from "./use-error-handling";
