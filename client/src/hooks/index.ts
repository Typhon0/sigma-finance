// Export dashboard data hooks
export * from './use-dashboard-data'
export * from './use-dashboard-calculations'

// Re-export commonly used hooks
export {
  useDashboardData,
  useAssetPerformance,
  usePortfolioSummary,
  useRecentTransactions,
  useAssetAllocation,
  useAlerts,
} from './use-dashboard-data'

export {
  useDashboardCalculations,
  usePortfolioCalculations,
} from './use-dashboard-calculations'