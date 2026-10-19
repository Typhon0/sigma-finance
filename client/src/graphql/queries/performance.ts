import { graphql } from "@/gql";

/**
 * Real risk metrics for one portfolio over a window.
 *
 * The other route to these numbers - `analytics.riskMetrics` on the portfolio
 * list - comes from the valuation path, which only has the portfolio totals,
 * not the return series. It therefore returns nulls for every field, and a
 * client that reads it as "0% volatility, 0.00 Sharpe" is displaying a
 * measurement nobody made. This query goes to the performance service, which
 * does have the series and computes them for real.
 *
 * `analytics.riskMetrics` was previously filled with literal zeros, which read
 * as "this portfolio never fell and earned exactly its risk-free rate".
 */
export const GET_PORTFOLIO_RISK_METRICS = graphql(/* GraphQL */ `
  query GetPortfolioRiskMetrics($portfolioId: ID!, $timeRange: PerformanceTimeRangeInput!) {
    portfolioRiskMetrics(portfolioId: $portfolioId, timeRange: $timeRange) {
      volatility
      sharpeRatio
      sortinoRatio
      maxDrawdown
      diversification
    }
  }
`);
