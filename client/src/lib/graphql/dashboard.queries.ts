import { graphql } from "@/gql";

export const GET_DASHBOARD_DATA = graphql(/* GraphQL */ `
query GetDashboardData($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      assets {
        asset {
          id
          name
          symbol
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

// Asset performance query - for calculating top/worst performers
export const GET_ASSET_PERFORMANCE = graphql(/* GraphQL */ `
query GetAssetPerformance($userID: ID!) {
    assets(filter: { userID: $userID }) {
      id
      name
      symbol
      currentValue
      purchasePrice
      assetType {
        id
        name
      }
      positions {
        id
        quantity
        averagePurchasePrice
        ownershipPct
        portfolio {
          id
          name
        }
      }
    }
  }
`);

// Portfolio summary query - for individual portfolio cards
export const GET_PORTFOLIO_SUMMARY = graphql(
	/* GraphQL */
	`
query GetPortfolioSummary($userID: ID!) {
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
`,
);

// Recent transactions query - for transaction history section
export const GET_RECENT_TRANSACTIONS = graphql(/* GraphQL */ `
query GetRecentTransactions($userID: ID!, $limit: Int = 5) {
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

// Asset allocation query - for pie chart data
export const GET_ASSET_ALLOCATION = graphql(/* GraphQL */ `
query GetAssetAllocation($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      assets {
        asset {
          id
          name
          currentValue
          assetType {
            id
            name
          }
        }
        quantity
        ownershipPct
      }
    }
  }
`);

// Alerts query - for notifications section (future implementation)
export const GET_ALERTS = graphql(/* GraphQL */ `
query GetAlerts($userID: ID!, $limit: Int = 3) {
    alerts(
      filter: { userID: $userID, active: true }
      pagination: { limit: $limit }
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      id
      alertType
      condition
      threshold
      createdAt
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
