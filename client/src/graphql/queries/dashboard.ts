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
        # FX provenance. The module must not guess whether a value was
        # converted - the server is the only party that knows.
        displayCurrency
        quoteCurrency
        isStale
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
          isStale
          quoteCurrency
          displayCurrency
        }
      }
      assets {
        quantity
        averagePurchasePrice
        currentValue
        dayChange
        dayChangePercent
        quoteCurrency
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
          # Instrument reference metrics, on the concrete types: the Asset
          # interface does not carry them. Nullable - null means the provider
          # has not supplied the figure, which is not the same as zero.
          ... on Stock {
            peRatio
            dividendYield
          }
          ... on Fund {
            expenseRatio
            dividendYield
          }
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
      asset {
        id
        symbol
        name
      }
      portfolio {
        id
      }
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

export const GET_RECENT_TRANSACTIONS_MINIMAL = graphql(/* GraphQL */ `
  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {
    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {
      id
      asset {
        id
        symbol
        name
      }
      portfolio {
        id
      }
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
