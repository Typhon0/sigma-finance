import { gql } from "@apollo/client";

export const GET_PORTFOLIOS_WITH_ANALYTICS = gql(`
  query GetPortfoliosWithAnalytics($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      description
      taxWrapper
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
          costBasisNative
          costBasisDisplay
          costBasisCurrency
          costBasisConverted
          hasDisplayValue
          isExcluded
          exclusionReason
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
      taxWrapper
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
          costBasisNative
          costBasisDisplay
          costBasisCurrency
          costBasisConverted
          hasDisplayValue
          isExcluded
          exclusionReason
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

/**
 * Daily value of a portfolio restricted to a set of asset types.
 *
 * Exists so a per-asset-type page (Stocks & Funds today) can show a hero
 * chart that belongs to its own scope. The portfolio-wide
 * `analytics.performanceHistory` stays for pages that genuinely mean the
 * whole portfolio.
 */
export const GET_SCOPED_PERFORMANCE_HISTORY = gql(`
  query GetScopedPerformanceHistory($portfolioID: ID!, $assetTypes: [String!]!) {
    scopedPerformanceHistory(portfolioID: $portfolioID, assetTypes: $assetTypes) {
      date
      value
    }
  }
`);
