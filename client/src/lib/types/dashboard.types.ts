// Dashboard-specific TypeScript types for GraphQL data

export interface AssetType {
  id: string
  name: string
}

export interface Asset {
  id: string
  name: string
  symbol?: string
  currentValue: number
  purchasePrice?: number
  assetType: AssetType
}

export interface Position {
  id: string
  quantity: number
  averagePurchasePrice: number
  ownershipPct: number
  asset: Asset
  portfolio: Portfolio
}

export interface Portfolio {
  id: string
  name: string
  assets: Position[]
}

export interface Transaction {
  id: string
  transactionType: string
  quantity: number
  pricePerUnit: number
  transactionDate: string
  asset: Asset
  portfolio: Portfolio
}

export interface Alert {
  id: string
  alertType: string
  condition: string
  threshold: number
  createdAt: string
  asset: Asset
  portfolio: Portfolio
}

// Calculated dashboard data types
export interface DashboardData {
  portfolios: Portfolio[]
  totalValue: number
  totalChange: number
  totalChangePercent: number
  topPerformingAssets: AssetPerformance[]
  worstPerformingAssets: AssetPerformance[]
  recentTransactions: Transaction[]
  assetAllocation: AssetAllocationData[]
  alerts: Alert[]
  portfolioAllocation?: Array<{
    portfolio: Portfolio
    value: number
    percentage: number
  }>
}

export interface AssetPerformance {
  asset: Asset
  currentValue: number
  changePercent: number
  changeAmount: number
  positions: Position[]
}

export interface AssetAllocationData {
  assetType: string
  value: number
  percentage: number
  color: string
}

// Portfolio metrics for calculations
export interface PortfolioMetrics {
  totalValue: number
  totalCost: number
  totalGainLoss: number
  totalGainLossPercent: number
}

// Asset metrics for performance calculations
export interface AssetMetrics {
  currentValue: number
  purchaseValue: number
  gainLoss: number
  gainLossPercent: number
  allocation: number
}

// GraphQL query response types
export interface GetDashboardDataResponse {
  portfolios: Portfolio[]
  transactions: Transaction[]
}

export interface GetAssetPerformanceResponse {
  assets: Asset[]
}

export interface GetPortfolioSummaryResponse {
  portfolios: Portfolio[]
}

export interface GetRecentTransactionsResponse {
  transactions: Transaction[]
}

export interface GetAssetAllocationResponse {
  portfolios: Portfolio[]
}

export interface GetAlertsResponse {
  alerts: Alert[]
}