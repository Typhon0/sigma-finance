import { useMemo } from 'react'
import { useDashboardData, useAssetPerformance } from './use-dashboard-data'
import {
  calculatePortfolioMetrics,
  calculateAssetPerformance,
  getTopPerformingAssets,
  getWorstPerformingAssets,
  calculateAssetAllocation,
  calculatePortfolioAllocation,
} from '@/lib/utils/portfolio-calculations'
import { DashboardData } from '@/lib/types/dashboard.types'

/**
 * Custom hook that combines GraphQL data fetching with calculation utilities
 * to provide computed dashboard metrics
 */
export const useDashboardCalculations = (userID: string) => {
  // Fetch raw data from GraphQL
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardData(userID)

  const {
    data: assetData,
    loading: assetLoading,
    error: assetError,
    refetch: refetchAssets,
  } = useAssetPerformance(userID)

  // Calculate derived metrics
  const calculatedData = useMemo((): DashboardData | null => {
    if (!dashboardData?.portfolios) return null

    const portfolios = dashboardData.portfolios
    const transactions = dashboardData.transactions || []

    // Calculate portfolio metrics
    const portfolioMetrics = calculatePortfolioMetrics(portfolios)
    
    // Calculate asset performance
    const assetPerformances = calculateAssetPerformance(portfolios)
    const topPerformingAssets = getTopPerformingAssets(assetPerformances, 3)
    const worstPerformingAssets = getWorstPerformingAssets(assetPerformances, 3)
    
    // Calculate asset allocation
    const assetAllocation = calculateAssetAllocation(portfolios)
    
    // Portfolio allocation for summary cards
    const portfolioAllocation = calculatePortfolioAllocation(portfolios)

    return {
      portfolios,
      totalValue: portfolioMetrics.totalValue,
      totalChange: portfolioMetrics.totalGainLoss,
      totalChangePercent: portfolioMetrics.totalGainLossPercent,
      topPerformingAssets,
      worstPerformingAssets,
      recentTransactions: transactions,
      assetAllocation,
      alerts: [], // Will be implemented when alert system is ready
      portfolioAllocation,
    }
  }, [dashboardData])

  // Loading state - true if any critical data is loading
  const loading = dashboardLoading || assetLoading

  // Error state - combine errors from different queries
  const error = dashboardError || assetError

  // Refetch function to refresh all data
  const refetch = async () => {
    await Promise.all([refetchDashboard(), refetchAssets()])
  }

  return {
    data: calculatedData,
    loading,
    error,
    refetch,
    // Individual loading states for granular control
    dashboardLoading,
    assetLoading,
    // Individual error states
    dashboardError,
    assetError,
  }
}

/**
 * Hook for individual portfolio calculations
 */
export const usePortfolioCalculations = (userID: string, portfolioId?: string) => {
  const { data: dashboardData, loading, error } = useDashboardData(userID)

  const calculatedData = useMemo(() => {
    if (!dashboardData?.portfolios) return null

    const portfolios = dashboardData.portfolios
    const targetPortfolio = portfolioId 
      ? portfolios.find(p => p.id === portfolioId)
      : null

    if (portfolioId && !targetPortfolio) return null

    const portfoliosToCalculate = targetPortfolio ? [targetPortfolio] : portfolios
    const portfolioMetrics = calculatePortfolioMetrics(portfoliosToCalculate)
    const assetPerformances = calculateAssetPerformance(portfoliosToCalculate)
    const assetAllocation = calculateAssetAllocation(portfoliosToCalculate)

    return {
      portfolios: portfoliosToCalculate,
      metrics: portfolioMetrics,
      assetPerformances,
      assetAllocation,
      topPerformers: getTopPerformingAssets(assetPerformances, 5),
      worstPerformers: getWorstPerformingAssets(assetPerformances, 5),
    }
  }, [dashboardData, portfolioId])

  return {
    data: calculatedData,
    loading,
    error,
  }
}