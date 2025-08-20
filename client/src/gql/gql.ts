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
    "\n  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {\n    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {\n      id\n      name\n      symbol\n      currentValue\n      assetType {\n        id\n        name\n      }\n    }\n  }\n": typeof types.GetAssetsDocument,
    "\n  query GetAssetTypes {\n    assetTypes {\n      id\n      name\n    }\n  }\n": typeof types.GetAssetTypesDocument,
    "\n  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {\n    addAssetToPortfolio(input: $input) {\n      asset {\n        id\n        name\n        symbol\n        currentValue\n        assetType {\n          id\n          name\n        }\n      }\n      quantity\n      averagePurchasePrice\n      ownershipPct\n    }\n  }\n": typeof types.AddAssetToPortfolioDocument,
    "\n  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {\n    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)\n  }\n": typeof types.RemoveAssetFromPortfolioDocument,
    "\n  query GetPortfolioAnalytics($portfolioID: ID!) {\n    portfolio(id: $portfolioID) {\n      id\n      name\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n          count\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n          diversification\n        }\n        performanceHistory {\n          date\n          value\n        }\n      }\n    }\n  }\n": typeof types.GetPortfolioAnalyticsDocument,
};
const documents: Documents = {
    "\n  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {\n    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {\n      id\n      name\n      symbol\n      currentValue\n      assetType {\n        id\n        name\n      }\n    }\n  }\n": types.GetAssetsDocument,
    "\n  query GetAssetTypes {\n    assetTypes {\n      id\n      name\n    }\n  }\n": types.GetAssetTypesDocument,
    "\n  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {\n    addAssetToPortfolio(input: $input) {\n      asset {\n        id\n        name\n        symbol\n        currentValue\n        assetType {\n          id\n          name\n        }\n      }\n      quantity\n      averagePurchasePrice\n      ownershipPct\n    }\n  }\n": types.AddAssetToPortfolioDocument,
    "\n  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {\n    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)\n  }\n": types.RemoveAssetFromPortfolioDocument,
    "\n  query GetPortfolioAnalytics($portfolioID: ID!) {\n    portfolio(id: $portfolioID) {\n      id\n      name\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n          count\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n          diversification\n        }\n        performanceHistory {\n          date\n          value\n        }\n      }\n    }\n  }\n": types.GetPortfolioAnalyticsDocument,
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
export function graphql(source: "\n  query GetPortfolioAnalytics($portfolioID: ID!) {\n    portfolio(id: $portfolioID) {\n      id\n      name\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n          count\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n          diversification\n        }\n        performanceHistory {\n          date\n          value\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetPortfolioAnalytics($portfolioID: ID!) {\n    portfolio(id: $portfolioID) {\n      id\n      name\n      analytics {\n        totalValue\n        totalCost\n        totalGainLoss\n        totalGainLossPercent\n        assetAllocation {\n          assetType\n          value\n          percentage\n          count\n        }\n        riskMetrics {\n          volatility\n          sharpeRatio\n          maxDrawdown\n          diversification\n        }\n        performanceHistory {\n          date\n          value\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;