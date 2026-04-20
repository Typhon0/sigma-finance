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
        # Multi-currency fields
        totalNativeValue
        totalDisplayValue
        fxAsOf
        fxSource
        fxGranularity
        isStale
        fxState
        excludedPositionCount
        coveredValueRatio
        displayCurrency
        quoteCurrency
        positionValuations {
          positionId
          assetId
          nativeValue
          displayValue
          fxRate
          fxAsOf
          fxSource
          fxGranularity
          isStale
          quoteCurrency
          displayCurrency
        }
      }
    }
  }
`);

export const GET_PORTFOLIO = gql(`
  query GetPortfolio($id: ID!) {
    portfolio(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
      sortOrder
      user {
        id
      }
      assets {
        asset {
          id
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
        # Multi-currency fields
        totalNativeValue
        totalDisplayValue
        fxAsOf
        fxSource
        fxGranularity
        isStale
        fxState
        excludedPositionCount
        coveredValueRatio
        displayCurrency
        quoteCurrency
        positionValuations {
          positionId
          assetId
          nativeValue
          displayValue
          fxRate
          fxAsOf
          fxSource
          fxGranularity
          isStale
          quoteCurrency
          displayCurrency
        }
      }
      tags {
        id
        name
      }
    }
  }
`);
