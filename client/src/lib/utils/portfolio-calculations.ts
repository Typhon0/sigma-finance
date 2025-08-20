import {
  Portfolio,
  Position,
  Asset,
  PortfolioMetrics,
  AssetMetrics,
  AssetPerformance,
  AssetAllocationData,
} from '@/lib/types/dashboard.types'

/**
 * Calculate total portfolio value and performance metrics
 */
export function calculatePortfolioMetrics(portfolios: Portfolio[]): PortfolioMetrics {
  let totalValue = 0
  let totalCost = 0

  portfolios.forEach((portfolio) => {
    portfolio.assets.forEach((position) => {
      const positionValue = calculatePositionValue(position)
      const positionCost = calculatePositionCost(position)
      
      totalValue += positionValue
      totalCost += positionCost
    })
  })

  const totalGainLoss = totalValue - totalCost
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
  }
}

/**
 * Calculate individual portfolio metrics
 */
export function calculateIndividualPortfolioMetrics(portfolio: Portfolio): PortfolioMetrics {
  let totalValue = 0
  let totalCost = 0

  portfolio.assets.forEach((position) => {
    const positionValue = calculatePositionValue(position)
    const positionCost = calculatePositionCost(position)
    
    totalValue += positionValue
    totalCost += positionCost
  })

  const totalGainLoss = totalValue - totalCost
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
  }
}

/**
 * Calculate position value (current market value)
 */
export function calculatePositionValue(position: Position): number {
  const currentValue = position.asset.currentValue || 0
  const quantity = position.quantity || 0
  const ownershipPct = position.ownershipPct || 100
  
  return (currentValue * quantity * ownershipPct) / 100
}

/**
 * Calculate position cost (original purchase value)
 */
export function calculatePositionCost(position: Position): number {
  const averagePurchasePrice = position.averagePurchasePrice || 0
  const quantity = position.quantity || 0
  const ownershipPct = position.ownershipPct || 100
  
  return (averagePurchasePrice * quantity * ownershipPct) / 100
}

/**
 * Calculate asset performance metrics for ranking
 */
export function calculateAssetPerformance(portfolios: Portfolio[]): AssetPerformance[] {
  const assetMap = new Map<string, AssetPerformance>()

  portfolios.forEach((portfolio) => {
    portfolio.assets.forEach((position) => {
      const assetId = position.asset.id
      const currentValue = calculatePositionValue(position)
      const purchaseValue = calculatePositionCost(position)
      const changeAmount = currentValue - purchaseValue
      const changePercent = purchaseValue > 0 ? (changeAmount / purchaseValue) * 100 : 0

      if (assetMap.has(assetId)) {
        // Aggregate multiple positions of the same asset
        const existing = assetMap.get(assetId)!
        const totalCurrentValue = existing.currentValue + currentValue
        const totalPurchaseValue = existing.currentValue - existing.changeAmount + purchaseValue
        const totalChangeAmount = totalCurrentValue - totalPurchaseValue
        const totalChangePercent = totalPurchaseValue > 0 ? (totalChangeAmount / totalPurchaseValue) * 100 : 0

        assetMap.set(assetId, {
          asset: position.asset,
          currentValue: totalCurrentValue,
          changeAmount: totalChangeAmount,
          changePercent: totalChangePercent,
          positions: [...existing.positions, position],
        })
      } else {
        assetMap.set(assetId, {
          asset: position.asset,
          currentValue,
          changeAmount,
          changePercent,
          positions: [position],
        })
      }
    })
  })

  return Array.from(assetMap.values())
}

/**
 * Get top performing assets by percentage gain
 */
export function getTopPerformingAssets(
  assetPerformances: AssetPerformance[],
  limit = 3
): AssetPerformance[] {
  return assetPerformances
    .filter((asset) => asset.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, limit)
}

/**
 * Get worst performing assets by percentage loss
 */
export function getWorstPerformingAssets(
  assetPerformances: AssetPerformance[],
  limit = 3
): AssetPerformance[] {
  return assetPerformances
    .filter((asset) => asset.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, limit)
}

/**
 * Calculate asset allocation by asset type
 */
export function calculateAssetAllocation(portfolios: Portfolio[]): AssetAllocationData[] {
  const allocationMap = new Map<string, { value: number; color: string }>()
  let totalValue = 0

  // Asset type colors for consistent visualization
  const assetTypeColors: Record<string, string> = {
    STOCK: '#10b981', // green
    CRYPTO: '#f59e0b', // amber
    BANK_ACCOUNT: '#3b82f6', // blue
    REAL_ESTATE: '#8b5cf6', // violet
    LIFE_INSURANCE: '#ef4444', // red
    WATCH: '#6b7280', // gray
    OTHER: '#64748b', // slate
  }

  portfolios.forEach((portfolio) => {
    portfolio.assets.forEach((position) => {
      const assetType = position.asset.assetType.name
      const positionValue = calculatePositionValue(position)
      
      totalValue += positionValue

      if (allocationMap.has(assetType)) {
        const existing = allocationMap.get(assetType)!
        allocationMap.set(assetType, {
          value: existing.value + positionValue,
          color: existing.color,
        })
      } else {
        allocationMap.set(assetType, {
          value: positionValue,
          color: assetTypeColors[assetType] || assetTypeColors.OTHER,
        })
      }
    })
  })

  return Array.from(allocationMap.entries()).map(([assetType, data]) => ({
    assetType,
    value: data.value,
    percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
    color: data.color,
  }))
}

/**
 * Calculate portfolio allocation percentages relative to total assets
 */
export function calculatePortfolioAllocation(portfolios: Portfolio[]): Array<{
  portfolio: Portfolio
  value: number
  percentage: number
}> {
  const totalValue = calculatePortfolioMetrics(portfolios).totalValue

  return portfolios.map((portfolio) => {
    const portfolioMetrics = calculateIndividualPortfolioMetrics(portfolio)
    return {
      portfolio,
      value: portfolioMetrics.totalValue,
      percentage: totalValue > 0 ? (portfolioMetrics.totalValue / totalValue) * 100 : 0,
    }
  })
}

/**
 * Utility function to format currency values
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Utility function to format percentage values
 */
export function formatPercentage(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * Utility function to determine performance color class
 */
export function getPerformanceColorClass(value: number): string {
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-gray-600'
}