import { gql } from "@apollo/client";

export const GET_PORTFOLIOS_WITH_ANALYTICS = gql(`
  query GetPortfoliosWithAnalytics($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      description
      createdAt
      updatedAt
      assets {
        asset {
          name
          symbol
          currentValue
          assetType {
            name
          }
        }
        quantity
        averagePurchasePrice
        ownershipPct
      }
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
        assetAllocation {
          assetType
          value
          percentage
        }
        performanceHistory {
          date
          value
        }
        riskMetrics {
          volatility
          sharpeRatio
          maxDrawdown
        }
      }
    }
  }
`);
