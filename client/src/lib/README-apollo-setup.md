# Apollo Client and GraphQL Infrastructure Setup

This document summarizes the Apollo Client and GraphQL infrastructure setup for the dashboard home page.

## Files Created

### 1. Apollo Client Configuration (`src/lib/apollo-client.ts`)
- Configured Apollo Client with HTTP link to `/graphql` endpoint
- Added error handling link for GraphQL and network errors
- Configured InMemoryCache with type policies for Portfolio and Query types
- Set default options for error handling and fetch policies
- Configured cache-and-network strategy for real-time data

### 2. GraphQL Query Definitions (`src/lib/graphql/dashboard.queries.ts`)
- `GET_DASHBOARD_DATA`: Main query for portfolios and recent transactions
- `GET_ASSET_PERFORMANCE`: Query for asset performance calculations
- `GET_PORTFOLIO_SUMMARY`: Query for individual portfolio summaries
- `GET_RECENT_TRANSACTIONS`: Query for transaction history
- `GET_ASSET_ALLOCATION`: Query for asset allocation pie chart data
- `GET_ALERTS`: Query for alerts and notifications (future implementation)

### 3. Custom Apollo Hooks (`src/hooks/use-dashboard-data.ts`)
- `useDashboardData`: Main dashboard data hook with 5-minute polling
- `useAssetPerformance`: Asset performance hook with 5-minute polling
- `usePortfolioSummary`: Portfolio summary hook with cache-first strategy
- `useRecentTransactions`: Recent transactions hook with 1-minute polling
- `useAssetAllocation`: Asset allocation hook with cache-first strategy
- `useAlerts`: Alerts hook with 2-minute polling (future implementation)

### 4. TypeScript Types (`src/lib/types/dashboard.types.ts`)
- Complete type definitions for all GraphQL entities
- Dashboard-specific calculated data types
- GraphQL response types for type safety
- Portfolio and asset metrics interfaces

### 5. Apollo Provider Integration (`src/App.tsx`)
- Added ApolloProvider wrapper around the entire application
- Integrated with existing ThemeProvider
- Ensures Apollo Client is available throughout the component tree

### 6. Example Component (`src/components/dashboard/dashboard-example.tsx`)
- Demonstrates how to use the dashboard hooks
- Shows loading, error, and success states
- Example of data rendering and error handling

## Configuration Details

### Caching Strategy
- **Cache-and-network**: For real-time data (portfolios, transactions)
- **Cache-first**: For relatively static data (portfolio summaries, asset allocation)
- **Polling intervals**: 1-5 minutes depending on data freshness requirements

### Error Handling
- Partial data loading with graceful error handling
- Network error logging and user-friendly error messages
- Retry mechanisms available through refetch functions

### Performance Optimizations
- Type policies prevent unnecessary cache merging
- Polling intervals optimized for data freshness vs. performance
- Error policies allow partial data rendering

## Usage Example

```typescript
import { useDashboardData } from '@/hooks/use-dashboard-data'

const DashboardComponent = () => {
  const { data, loading, error, refetch } = useDashboardData('user-id')
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Portfolios: {data?.portfolios?.length}</p>
      <p>Transactions: {data?.transactions?.length}</p>
    </div>
  )
}
```

## Next Steps

The GraphQL infrastructure is now ready for dashboard component implementation. The next tasks should focus on:

1. Creating dashboard data fetching layer (Task 2.1)
2. Implementing portfolio metrics calculations (Task 2.2)
3. Building dashboard layout and components (Tasks 3+)

All GraphQL queries, hooks, and types are prepared and ready for use in the dashboard components.