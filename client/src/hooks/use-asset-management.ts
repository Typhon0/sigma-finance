// Hook to fetch asset types for asset filtering dialogs
import { useQuery, useMutation, ApolloClient } from "@apollo/client";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { graphql } from "@/gql";

// Hook to fetch assets for asset selection dialogs
export function useAssets(
	filter?: AssetFilter,
	pagination?: PaginationInput,
	orderBy?: AssetOrder,
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
	symbol?: string;
	currentValue?: number;
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

export interface AssetOrder {
	field: "NAME" | "CURRENT_VALUE" | "PURCHASE_DATE";
	direction: "ASC" | "DESC";
}

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

export function invalidatePortfolio(cache: any, portfolioID: string) {
	cache.evict({
		id: cache.identify({ __typename: "Portfolio", id: portfolioID }),
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
  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {
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
	const clientInstance = apolloClient;

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
				invalidatePortfolio(
					cache,
					mutationData.addAssetToPortfolio.portfolioID,
				);
			}
		},
		onError: (error) => {
			console.error("Add asset to portfolio error:", error);
		},
	});

	const [removeAssetFromPortfolioMutation] = useMutation(
		REMOVE_ASSET_FROM_PORTFOLIO,
		{
			client: apolloClient,
			optimisticResponse: () =>
				optimisticResponseGenerators.removeAssetFromPortfolio(),
			update: (cache, { data: mutationData }, { variables }) => {
				if (mutationData?.removeAssetFromPortfolio && variables) {
					invalidatePortfolioQueries(cache);
					invalidateDashboardData(cache);
					invalidatePortfolio(cache, variables.portfolioID);
				}
			},
			onError: (error) => {
				console.error("Remove asset from portfolio error:", error);
			},
		},
	);

	const addAssetToPortfolio = async (input: PortfolioAssetInput) => {
		try {
			const result = await addAssetToPortfolioMutation({
				variables: { input },
			});
			return result;
		} catch (error) {
			console.error("Error adding asset to portfolio:", error);
			throw error;
		}
	};

	const removeAssetFromPortfolio = async (
		portfolioID: string,
		assetID: string,
	) => {
		try {
			const result = await removeAssetFromPortfolioMutation({
				variables: { portfolioID, assetID },
			});
			return result;
		} catch (error) {
			console.error("Error removing asset from portfolio:", error);
			throw error;
		}
	};

	return {
		addAssetToPortfolio,
		removeAssetFromPortfolio,
	};
}
