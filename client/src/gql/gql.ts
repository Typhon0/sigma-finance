/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  mutation CreatePortfolio($input: CreatePortfolioInput!) {\n    createPortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n": typeof types.CreatePortfolioDocument,
    "\n  mutation UpdatePortfolio($id: ID!, $input: UpdatePortfolioInput!) {\n    updatePortfolio(id: $id, input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n": typeof types.UpdatePortfolioDocument,
    "\n  mutation DeletePortfolio($id: ID!) {\n    deletePortfolio(id: $id)\n  }\n": typeof types.DeletePortfolioDocument,
    "\n  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {\n    duplicatePortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n": typeof types.DuplicatePortfolioDocument,
    "\n  query GetDashboardCritical($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n      }\n    }\n    watchlists(filter: { userID: $userID }) {\n      id\n      name\n    }\n  }\n": typeof types.GetDashboardCriticalDocument,
    "\n  query GetDashboardSecondary($userID: ID!) {\n    transactions(filter: { userID: $userID }, pagination: { limit: 10 }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n      transactionDate\n    }\n  }\n": typeof types.GetDashboardSecondaryDocument,
    "\n  query GetPortfolioCards($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n        totalGainLossPercent\n      }\n    }\n  }\n": typeof types.GetPortfolioCardsDocument,
    "\n  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {\n    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n    }\n  }\n": typeof types.GetRecentTransactionsMinimalDocument,
    "\n  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int) {\n    assets(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      name\n      currentValue\n      purchasePrice\n    }\n  }\n": typeof types.GetAssetPerformanceOptimizedDocument,
    "\n  query GetPortfoliosWithAnalytics($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      description\n      createdAt\n      updatedAt\n      assets {\n        asset {\n          name\n          symbol\n          currentValue\n          assetType {\n            name\n          }\n        }\n        quantity\n        averagePurchasePrice\n        ownershipPct\n      }\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n        }\n        performanceHistory {\n          date\n          value\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n        }\n      }\n    }\n  }\n": typeof types.GetPortfoliosWithAnalyticsDocument,
    "\n  subscription PortfolioUpdateSubscription($userID: ID!) {\n    portfolioUpdates(userID: $userID) {\n      type\n      portfolio {\n        id\n        name\n      }\n    }\n  }\n": typeof types.PortfolioUpdateSubscriptionDocument,
    "\n  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {\n    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {\n      id\n      name\n      symbol\n      currentValue\n      assetType {\n        id\n        name\n      }\n    }\n  }\n": typeof types.GetAssetsDocument,
    "\n  query GetAssetTypes {\n    assetTypes {\n      id\n      name\n    }\n  }\n": typeof types.GetAssetTypesDocument,
    "\n  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {\n    addAssetToPortfolio(input: $input) {\n      asset {\n        id\n        name\n        symbol\n        currentValue\n        assetType {\n          id\n          name\n        }\n      }\n      quantity\n      averagePurchasePrice\n      ownershipPct\n    }\n  }\n": typeof types.AddAssetToPortfolioDocument,
    "\n  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {\n    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)\n  }\n": typeof types.RemoveAssetFromPortfolioDocument,
    "\n\t\t\t\tfragment PortfolioFields on Portfolio {\n\t\t\t\t\tid\n\t\t\t\t\tname\n\t\t\t\t\tdescription\n\t\t\t\t\tcreatedAt\n\t\t\t\t\tupdatedAt\n\t\t\t\t}\n\t\t\t": typeof types.PortfolioFieldsFragmentDoc,
};
const documents: Documents = {
    "\n  mutation CreatePortfolio($input: CreatePortfolioInput!) {\n    createPortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n": types.CreatePortfolioDocument,
    "\n  mutation UpdatePortfolio($id: ID!, $input: UpdatePortfolioInput!) {\n    updatePortfolio(id: $id, input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n": types.UpdatePortfolioDocument,
    "\n  mutation DeletePortfolio($id: ID!) {\n    deletePortfolio(id: $id)\n  }\n": types.DeletePortfolioDocument,
    "\n  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {\n    duplicatePortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n": types.DuplicatePortfolioDocument,
    "\n  query GetDashboardCritical($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n      }\n    }\n    watchlists(filter: { userID: $userID }) {\n      id\n      name\n    }\n  }\n": types.GetDashboardCriticalDocument,
    "\n  query GetDashboardSecondary($userID: ID!) {\n    transactions(filter: { userID: $userID }, pagination: { limit: 10 }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n      transactionDate\n    }\n  }\n": types.GetDashboardSecondaryDocument,
    "\n  query GetPortfolioCards($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n        totalGainLossPercent\n      }\n    }\n  }\n": types.GetPortfolioCardsDocument,
    "\n  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {\n    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n    }\n  }\n": types.GetRecentTransactionsMinimalDocument,
    "\n  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int) {\n    assets(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      name\n      currentValue\n      purchasePrice\n    }\n  }\n": types.GetAssetPerformanceOptimizedDocument,
    "\n  query GetPortfoliosWithAnalytics($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      description\n      createdAt\n      updatedAt\n      assets {\n        asset {\n          name\n          symbol\n          currentValue\n          assetType {\n            name\n          }\n        }\n        quantity\n        averagePurchasePrice\n        ownershipPct\n      }\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n        }\n        performanceHistory {\n          date\n          value\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n        }\n      }\n    }\n  }\n": types.GetPortfoliosWithAnalyticsDocument,
    "\n  subscription PortfolioUpdateSubscription($userID: ID!) {\n    portfolioUpdates(userID: $userID) {\n      type\n      portfolio {\n        id\n        name\n      }\n    }\n  }\n": types.PortfolioUpdateSubscriptionDocument,
    "\n  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {\n    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {\n      id\n      name\n      symbol\n      currentValue\n      assetType {\n        id\n        name\n      }\n    }\n  }\n": types.GetAssetsDocument,
    "\n  query GetAssetTypes {\n    assetTypes {\n      id\n      name\n    }\n  }\n": types.GetAssetTypesDocument,
    "\n  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {\n    addAssetToPortfolio(input: $input) {\n      asset {\n        id\n        name\n        symbol\n        currentValue\n        assetType {\n          id\n          name\n        }\n      }\n      quantity\n      averagePurchasePrice\n      ownershipPct\n    }\n  }\n": types.AddAssetToPortfolioDocument,
    "\n  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {\n    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)\n  }\n": types.RemoveAssetFromPortfolioDocument,
    "\n\t\t\t\tfragment PortfolioFields on Portfolio {\n\t\t\t\t\tid\n\t\t\t\t\tname\n\t\t\t\t\tdescription\n\t\t\t\t\tcreatedAt\n\t\t\t\t\tupdatedAt\n\t\t\t\t}\n\t\t\t": types.PortfolioFieldsFragmentDoc,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreatePortfolio($input: CreatePortfolioInput!) {\n    createPortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n"): (typeof documents)["\n  mutation CreatePortfolio($input: CreatePortfolioInput!) {\n    createPortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdatePortfolio($id: ID!, $input: UpdatePortfolioInput!) {\n    updatePortfolio(id: $id, input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n"): (typeof documents)["\n  mutation UpdatePortfolio($id: ID!, $input: UpdatePortfolioInput!) {\n    updatePortfolio(id: $id, input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeletePortfolio($id: ID!) {\n    deletePortfolio(id: $id)\n  }\n"): (typeof documents)["\n  mutation DeletePortfolio($id: ID!) {\n    deletePortfolio(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {\n    duplicatePortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n"): (typeof documents)["\n  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {\n    duplicatePortfolio(input: $input) {\n      id\n      name\n      description\n      sortOrder\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetDashboardCritical($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n      }\n    }\n    watchlists(filter: { userID: $userID }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query GetDashboardCritical($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n      }\n    }\n    watchlists(filter: { userID: $userID }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetDashboardSecondary($userID: ID!) {\n    transactions(filter: { userID: $userID }, pagination: { limit: 10 }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n      transactionDate\n    }\n  }\n"): (typeof documents)["\n  query GetDashboardSecondary($userID: ID!) {\n    transactions(filter: { userID: $userID }, pagination: { limit: 10 }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n      transactionDate\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPortfolioCards($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n        totalGainLossPercent\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetPortfolioCards($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      analytics {\n        totalValue\n        totalGainLossPercent\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {\n    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n    }\n  }\n"): (typeof documents)["\n  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {\n    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      notes\n      quantity\n      pricePerUnit\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int) {\n    assets(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      name\n      currentValue\n      purchasePrice\n    }\n  }\n"): (typeof documents)["\n  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int) {\n    assets(filter: { userID: $userID }, pagination: { limit: $limit }) {\n      id\n      name\n      currentValue\n      purchasePrice\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPortfoliosWithAnalytics($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      description\n      createdAt\n      updatedAt\n      assets {\n        asset {\n          name\n          symbol\n          currentValue\n          assetType {\n            name\n          }\n        }\n        quantity\n        averagePurchasePrice\n        ownershipPct\n      }\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n        }\n        performanceHistory {\n          date\n          value\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetPortfoliosWithAnalytics($userID: ID!) {\n    portfolios(filter: { userID: $userID }) {\n      id\n      name\n      description\n      createdAt\n      updatedAt\n      assets {\n        asset {\n          name\n          symbol\n          currentValue\n          assetType {\n            name\n          }\n        }\n        quantity\n        averagePurchasePrice\n        ownershipPct\n      }\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n        }\n        performanceHistory {\n          date\n          value\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription PortfolioUpdateSubscription($userID: ID!) {\n    portfolioUpdates(userID: $userID) {\n      type\n      portfolio {\n        id\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  subscription PortfolioUpdateSubscription($userID: ID!) {\n    portfolioUpdates(userID: $userID) {\n      type\n      portfolio {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {\n    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {\n      id\n      name\n      symbol\n      currentValue\n      assetType {\n        id\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {\n    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {\n      id\n      name\n      symbol\n      currentValue\n      assetType {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetAssetTypes {\n    assetTypes {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query GetAssetTypes {\n    assetTypes {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {\n    addAssetToPortfolio(input: $input) {\n      asset {\n        id\n        name\n        symbol\n        currentValue\n        assetType {\n          id\n          name\n        }\n      }\n      quantity\n      averagePurchasePrice\n      ownershipPct\n    }\n  }\n"): (typeof documents)["\n  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {\n    addAssetToPortfolio(input: $input) {\n      asset {\n        id\n        name\n        symbol\n        currentValue\n        assetType {\n          id\n          name\n        }\n      }\n      quantity\n      averagePurchasePrice\n      ownershipPct\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {\n    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)\n  }\n"): (typeof documents)["\n  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {\n    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\t\t\tfragment PortfolioFields on Portfolio {\n\t\t\t\t\tid\n\t\t\t\t\tname\n\t\t\t\t\tdescription\n\t\t\t\t\tcreatedAt\n\t\t\t\t\tupdatedAt\n\t\t\t\t}\n\t\t\t"): (typeof documents)["\n\t\t\t\tfragment PortfolioFields on Portfolio {\n\t\t\t\t\tid\n\t\t\t\t\tname\n\t\t\t\t\tdescription\n\t\t\t\t\tcreatedAt\n\t\t\t\t\tupdatedAt\n\t\t\t\t}\n\t\t\t"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;