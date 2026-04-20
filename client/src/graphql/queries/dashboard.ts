import { graphql } from "@/gql";

export const GET_DASHBOARD_CRITICAL = graphql(/* GraphQL */ `
  query GetDashboardCritical($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
        assetAllocation {
          assetType
          value
          percentage
          count
        }
        riskMetrics {
          volatility
          sharpeRatio
          maxDrawdown
          diversification
        }
        performanceHistory {
          date
          value
        }
      }
      assets {
        quantity
        averagePurchasePrice
        currentValue
        dayChange
        dayChangePercent
        asset {
          id
          name
          symbol
          currentValue
          purchasePrice
          sector
          exchange
          dayChange
          dayChangePercent
          assetType {
            id
            name
          }
        }
      }
    }
    watchlists(filter: { userID: $userID }) {
      id
      name
    }
  }
`);

export const GET_DASHBOARD_SECONDARY = graphql(/* GraphQL */ `
  query GetDashboardSecondary($userID: ID!) {
    transactions(filter: { userID: $userID }, pagination: { limit: 10 }) {
      id
      notes
      quantity
      unitPriceAmount
      unitPriceCurrency
      executedAt
      feesAmount
      feesCurrency
      transactionType
    }
  }
`);

export const GET_PORTFOLIO_CARDS = graphql(/* GraphQL */ `
  query GetPortfolioCards($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
      }
    }
  }
`);

export const GET_RECENT_TRANSACTIONS_MINIMAL = graphql(/* GraphQL */ `
  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {
    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {
      id
      notes
      quantity
      unitPriceAmount
      unitPriceCurrency
      executedAt
      transactionType
    }
  }
`);

export const GET_ASSET_PERFORMANCE_OPTIMIZED = graphql(/* GraphQL */ `
  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int) {
    assets(filter: { userID: $userID }, pagination: { limit: $limit }) {
      id
      name
      currentValue
      purchasePrice
    }
  }
`);
