import { graphql } from "@/gql";

// Optimized main dashboard data query with selective field fetching
export const GET_OPTIMIZED_DASHBOARD_DATA = graphql(/* GraphQL */ `
  query GetOptimizedDashboardData($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
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
    }
    transactions(
      filter: { userID: $userID }
      pagination: { limit: 5 }
      orderBy: { field: TRANSACTION_DATE, direction: DESC }
    ) {
      id
      transactionType
      quantity
      pricePerUnit
      transactionDate
      asset {
        id
        name
        symbol
      }
      portfolio {
        id
        name
      }
    }
  }
  `);

// Lightweight portfolio summary for cards (minimal fields)
export const GET_PORTFOLIO_CARDS = graphql(/* GraphQL */ `
  query GetPortfolioCards($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      assets {
        asset {
          id
          currentValue
          assetType {
            name
          }
        }
        quantity
        averagePurchasePrice
        ownershipPct
      }
    }
  }
  `);

// Asset performance with caching optimization
export const GET_ASSET_PERFORMANCE_OPTIMIZED = graphql(/* GraphQL */ `
  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int = 10) {
    assets(
      filter: { userID: $userID }
      pagination: { limit: $limit }
    ) {
      id
      name
      symbol
      currentValue
      purchasePrice
      assetType {
        name
      }
      positions {
        quantity
        averagePurchasePrice
        ownershipPct
      }
    }
  }
  `);

// Minimal recent transactions for dashboard
export const GET_RECENT_TRANSACTIONS_MINIMAL = graphql(/* GraphQL */ `
  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int = 5) {
    transactions(
      filter: { userID: $userID }
      pagination: { limit: $limit }
      orderBy: { field: TRANSACTION_DATE, direction: DESC }
    ) {
      id
      transactionType
      quantity
      pricePerUnit
      transactionDate
      asset {
        name
        symbol
      }
      portfolio {
        name
      }
    }
  }
  `);

// Fragment for common portfolio fields
export const PORTFOLIO_CORE_FIELDS = graphql(/* GraphQL */ `
  fragment PortfolioCoreFields on Portfolio {
    id
    name
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
  }
  `);

// Fragment for common asset fields
export const ASSET_CORE_FIELDS = graphql(/* GraphQL */ `
  fragment AssetCoreFields on Asset {
    id
    name
    symbol
    currentValue
    assetType {
      name
    }
  }
  `);

// Fragment for transaction fields
export const TRANSACTION_CORE_FIELDS = graphql(/* GraphQL */ `
  fragment TransactionCoreFields on Transaction {
    id
    transactionType
    quantity
    pricePerUnit
    transactionDate
    asset {
      name
      symbol
    }
    portfolio {
      name
    }
  }
  `);

// Optimized query using fragments
export const GET_DASHBOARD_WITH_FRAGMENTS = graphql(/* GraphQL */ `
  fragment PortfolioCoreFields on Portfolio {
    id
    name
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
  }

  fragment TransactionCoreFields on Transaction {
    id
    transactionType
    quantity
    pricePerUnit
    transactionDate
    asset {
      name
      symbol
    }
    portfolio {
      name
    }
  }

  query GetDashboardWithFragments($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      ...PortfolioCoreFields
    }
    transactions(
      filter: { userID: $userID }
      pagination: { limit: 5 }
      orderBy: { field: TRANSACTION_DATE, direction: DESC }
    ) {
      ...TransactionCoreFields
    }
  }
  `);

// Subscription for real-time updates
export const DASHBOARD_DATA_SUBSCRIPTION = graphql(/* GraphQL */ `
  subscription DashboardDataUpdates($userID: ID!) {
    portfolioUpdates(userID: $userID) {
      type
      portfolio {
        id
        name
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
      }
    }
  }
  `);

// Subscription for transaction updates (real-time)
export const TRANSACTION_UPDATES_SUBSCRIPTION = graphql(/* GraphQL */ `
  subscription TransactionUpdates($userID: ID!) {
    transactionUpdates(userID: $userID) {
      type
      transaction {
        id
        transactionType
        quantity
        pricePerUnit
        transactionDate
        asset {
          id
          name
          symbol
        }
        portfolio {
          id
          name
        }
      }
    }
  }
`);

// Query for initial page load with critical data only
export const GET_DASHBOARD_CRITICAL = graphql(/* GraphQL */ `
  query GetDashboardCritical($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
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
    }
  }
  `);

// Query for secondary data (loaded after critical data)
export const GET_DASHBOARD_SECONDARY = graphql(/* GraphQL */ `
  query GetDashboardSecondary($userID: ID!) {
    transactions(
      filter: { userID: $userID }
      pagination: { limit: 5 }
      orderBy: { field: TRANSACTION_DATE, direction: DESC }
    ) {
      id
      transactionType
      quantity
      pricePerUnit
      transactionDate
      asset {
        name
        symbol
      }
      portfolio {
        name
      }
    }
  }
  `);

// Query for portfolio summary analytics
export const GET_PORTFOLIO_SUMMARY = graphql(/* GraphQL */ `
  query GetPortfolioSummary($portfolioId: ID!) {
    portfolio(id: $portfolioId) {
      id
      name
      analytics {
        totalValue
        totalGainLoss
        totalGainLossPercent
      }
    }
  }
`);

// Query for asset allocation analytics
export const GET_ASSET_ALLOCATION = graphql(/* GraphQL */ `
  query GetAssetAllocation($portfolioId: ID!) {
    portfolio(id: $portfolioId) {
      id
      analytics {
        assetAllocation {
          assetType
          value
          percentage
          count
        }
      }
    }
  }
`);
