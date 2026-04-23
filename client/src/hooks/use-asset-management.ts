// Hook to fetch asset types for asset filtering dialogs
import { type ApolloClient, useMutation, useQuery } from "@apollo/client";
import { graphql } from "@/gql";
import type { AssetOrder as GqlAssetOrder } from "@/gql/graphql";
import { apolloClient } from "@/lib/apollo/apollo-client";

// Hook to fetch assets for asset selection dialogs
export function useAssets(
	filter?: AssetFilter,
	pagination?: PaginationInput,
	orderBy?: GqlAssetOrder,
) {
	const { data, loading, error, refetch } = useQuery(GET_ASSETS, {
		variables: {
			filter,
			pagination,
			orderBy,
		},
		fetchPolicy: "cache-and-network",
		client: apolloClient,
	});
	return {
		assets: data?.assets ?? [],
		loading,
		error,
		refetch,
	};
}

// GraphQL query for asset types

export function useAssetTypes() {
	const { data, loading } = useQuery(GET_ASSET_TYPES, { client: apolloClient });
	const assetTypes = data?.assetTypes ?? [];
	return { assetTypes, loading };
}

// Types
export interface Asset {
	id: string;
	name: string;
	symbol?: string | null;
	currentValue?: number | null;
	assetType: {
		id: string;
		name: string;
	};
}

export interface AssetType {
	id: string;
	name: string;
}

export interface PortfolioAssetInput {
	portfolioID: string;
	assetID: string;
	quantity: number;
	averagePurchasePrice?: number;
}

export interface AssetFilter {
	userID?: string;
	assetTypeID?: string;
	nameContains?: string;
	hasTagIDs?: string[];
}

export type AssetOrder = GqlAssetOrder;

export interface PaginationInput {
	limit?: number;
	offset?: number;
}

export interface AddAssetToPortfolioMutationResult {
	addAssetToPortfolio: {
		asset: Asset;
		quantity: number;
		averagePurchasePrice: number;
		ownershipPct: number;
		portfolioID: string;
		__typename: string;
	};
}

export interface AddAssetToPortfolioMutationVariables {
	input: PortfolioAssetInput;
}

export const optimisticResponseGenerators = {
	addAssetToPortfolio: (input: PortfolioAssetInput) => ({
		addAssetToPortfolio: {
			asset: {
				id: input.assetID,
				name: "",
				symbol: "",
				currentValue: 0,
				assetType: {
					id: "",
					name: "",
				},
			},
			quantity: input.quantity,
			averagePurchasePrice: input.averagePurchasePrice ?? 0,
			ownershipPct: 100,
			portfolioID: input.portfolioID,
			__typename: "PortfolioAsset",
		},
	}),
	removeAssetFromPortfolio: () => ({
		removeAssetFromPortfolio: true,
	}),
};

export function invalidatePortfolioQueries(cache: any) {
	cache.evict({ fieldName: "portfolios" });
	cache.evict({ fieldName: "portfolio" });
	cache.gc();
}

export function invalidateDashboardData(cache: any) {
	cache.evict({ fieldName: "dashboard" });
	cache.gc();
}

export function invalidatePortfolio(cache: any, portfolioId: string) {
	cache.evict({
		id: cache.identify({ __typename: "Portfolio", id: portfolioId }),
	});
	cache.gc();
}

// GraphQL Queries
export const GET_ASSETS = graphql(/* GraphQL */ `
  query GetAssets($filter: AssetFilter, $pagination: PaginationInput, $orderBy: AssetOrder) {
    assets(filter: $filter, pagination: $pagination, orderBy: $orderBy) {
      id
      name
      symbol
      currentValue
      assetType {
        id
        name
      }
    }
  }
`);

const GET_ASSET_TYPES = graphql(/* GraphQL */ `
  query GetAssetTypes {
    assetTypes {
      id
      name
    }
  }
`);

const ADD_ASSET_TO_PORTFOLIO = graphql(/* GraphQL */ `
  mutation AddAssetToPortfolioHook($input: PortfolioAssetInput!) {
    addAssetToPortfolio(input: $input) {
      asset {
        id
        name
        symbol
        currentValue
        assetType {
          id
          name
        }
      }
      quantity
      averagePurchasePrice
      ownershipPct
    }
  }
`);

const REMOVE_ASSET_FROM_PORTFOLIO = graphql(/* GraphQL */ `
  mutation RemoveAssetFromPortfolio($portfolioID: ID!, $assetID: ID!) {
    removeAssetFromPortfolio(portfolioID: $portfolioID, assetID: $assetID)
  }
`);

export function useAssetManagement(apolloClient?: ApolloClient<any>) {
	const [addAssetToPortfolioMutation] = useMutation<
		AddAssetToPortfolioMutationResult,
		AddAssetToPortfolioMutationVariables
	>(ADD_ASSET_TO_PORTFOLIO, {
		client: apolloClient,
		optimisticResponse: (variables: AddAssetToPortfolioMutationVariables) =>
			optimisticResponseGenerators.addAssetToPortfolio(variables.input),
		update: (
			cache: any,
			result: Omit<
				import("@apollo/client").FetchResult<AddAssetToPortfolioMutationResult>,
				"context"
			>,
		) => {
			const mutationData = result.data;
			if (mutationData?.addAssetToPortfolio) {
				invalidatePortfolioQueries(cache);
				invalidateDashboardData(cache);
				invalidatePortfolio(cache, mutationData.addAssetToPortfolio.portfolioID);
			}
		},
		onError: (_error) => {},
	});

	const [removeAssetFromPortfolioMutation] = useMutation(REMOVE_ASSET_FROM_PORTFOLIO, {
		client: apolloClient,
		update: (cache, { data: mutationData }, { variables }) => {
			if (mutationData?.removeAssetFromPortfolio && variables) {
				const portfolioId = typeof variables.portfolioID === "string" ? variables.portfolioID : "";

				if (portfolioId) {
					invalidatePortfolioQueries(cache);
					invalidateDashboardData(cache);
					invalidatePortfolio(cache, portfolioId);
				}
			}
		},
		onError: (_error) => {},
	});

	const addAssetToPortfolio = async (input: PortfolioAssetInput) => {
		const result = await addAssetToPortfolioMutation({
			variables: { input },
		});
		return result;
	};

	const removeAssetFromPortfolio = async (portfolioId: string, assetId: string) => {
		const result = await removeAssetFromPortfolioMutation({
			variables: { portfolioID: portfolioId, assetID: assetId },
		});
		return result;
	};

	return {
		addAssetToPortfolio,
		removeAssetFromPortfolio,
	};
}
