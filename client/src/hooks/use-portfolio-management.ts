import { useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { gql } from "@apollo/client";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { useAuth } from "@/lib/auth-context";

// GraphQL Queries and Mutations
const GET_PORTFOLIOS_WITH_ANALYTICS = gql`
  query GetPortfoliosWithAnalytics($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      description
      createdAt
      updatedAt
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
`;

// --- Utility Stubs (replace with real implementations as needed) ---
const optimisticResponseGenerators = {
	createPortfolio: (input: unknown) => ({
		createPortfolio: {
			id: "temp-id",
			name: (input as CreatePortfolioInput).name,
			description: (input as CreatePortfolioInput).description,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	}),
	updatePortfolio: (id: string, input: unknown) => ({
		updatePortfolio: {
			id,
			name: (input as UpdatePortfolioInput).name,
			description: (input as UpdatePortfolioInput).description,
			updatedAt: new Date().toISOString(),
		},
	}),
	deletePortfolio: (id: string) => ({
		deletePortfolio: id,
	}),
	duplicatePortfolio: (input: unknown) => ({
		duplicatePortfolio: {
			id: "temp-id",
			name: (input as DuplicatePortfolioInput).newName,
			description: "",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			assets: [],
		},
	}),
};

const cacheUpdateUtils = {
	addPortfolioToCache: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolio: Portfolio,
	) => {
		// Add new portfolio to cached list for user
		cache.modify({
			fields: {
				portfolios(
					existing: readonly import("@apollo/client").Reference[],
					{
						toReference,
					}: { toReference: (obj: any) => import("@apollo/client").Reference },
				) {
					const newPortfolioRef = toReference(portfolio);
					return [...existing, newPortfolioRef];
				},
			},
		});
	},
	updatePortfolioInCache: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolio: Portfolio,
	) => {
		// Update portfolio in cache
		cache.writeFragment({
			id: `Portfolio:${portfolio.id}`,
			fragment: gql`
        fragment PortfolioFields on Portfolio {
          id
          name
          description
          createdAt
          updatedAt
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
      `,
			data: portfolio,
		});
	},
	removePortfolioFromCache: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolioId: string,
	) => {
		// Remove portfolio from cached list for user
		cache.modify({
			fields: {
				portfolios(
					existing: readonly import("@apollo/client").Reference[],
					{
						readField,
					}: {
						readField: (
							fieldName: string,
							ref: import("@apollo/client").Reference,
						) => any;
					},
				) {
					return existing.filter((ref) => readField("id", ref) !== portfolioId);
				},
			},
		});
		cache.evict({ id: `Portfolio:${portfolioId}` });
		cache.gc();
	},
};

const cacheInvalidationHelpers = {
	invalidateDashboardData: (
		cache: import("@apollo/client").ApolloCache<unknown>,
	) => {
		// Invalidate dashboard queries for user
		cache.modify({
			fields: {
				dashboard(existing: any, { DELETE }: { DELETE: any }) {
					return DELETE;
				},
			},
		});
	},
	invalidatePortfolioQueries: (
		cache: import("@apollo/client").ApolloCache<unknown>,
	) => {
		// Invalidate all portfolio queries for user
		cache.modify({
			fields: {
				portfolios(
					existing: readonly import("@apollo/client").Reference[],
					{ DELETE }: { DELETE: any },
				) {
					return DELETE;
				},
			},
		});
	},
	invalidatePortfolio: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolioId: string,
	) => {
		// Invalidate a single portfolio
		cache.evict({ id: `Portfolio:${portfolioId}` });
		cache.gc();
	},
};

const CREATE_PORTFOLIO = gql`
  mutation CreatePortfolio($input: CreatePortfolioInput!) {
    createPortfolio(input: $input) {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_PORTFOLIO = gql`
  mutation UpdatePortfolio($id: ID!, $input: UpdatePortfolioInput!) {
    updatePortfolio(id: $id, input: $input) {
      id
      name
      description
      updatedAt
    }
  }
`;

const DELETE_PORTFOLIO = gql`
  mutation DeletePortfolio($id: ID!) {
    deletePortfolio(id: $id)
  }
`;

const DUPLICATE_PORTFOLIO = gql`
  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {
    duplicatePortfolio(input: $input) {
      id
      name
      description
      createdAt
      updatedAt
      assets {
        id
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
`;

// Types
export interface Portfolio {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
	assets: PortfolioAsset[];
}

export interface PortfolioAsset {
	id: string;
	asset: {
		id: string;
		name: string;
		symbol?: string;
		currentValue: number;
		assetType: {
			name: string;
		};
	};
	quantity: number;
	averagePurchasePrice: number;
	ownershipPct: number;
}

export interface CreatePortfolioInput {
	userID: string;
	name: string;
	description?: string;
}

export interface UpdatePortfolioInput {
	name?: string;
	description?: string;
}

export interface DuplicatePortfolioInput {
	sourcePortfolioID: string;
	newName: string;
	copyAssets: boolean;
}

export interface PortfolioManagementData {
	portfolios: Portfolio[];
}

// FIXED: Main Hook Implementation
export function usePortfolioManagement() {
	const { user } = useAuth();
	const effectiveUserID = user?.id;

	const { data, loading, error, refetch } = useQuery<PortfolioManagementData>(
		GET_PORTFOLIOS_WITH_ANALYTICS,
		{
			client: apolloClient,
			variables: { userID: effectiveUserID },
			errorPolicy: "all",
			fetchPolicy: "cache-and-network",
			nextFetchPolicy: "cache-first",
			notifyOnNetworkStatusChange: true,
			skip: !effectiveUserID,
		},
	);

	// Create portfolio mutation with optimistic updates
	const [createPortfolioMutation] = useMutation(CREATE_PORTFOLIO, {
		optimisticResponse: (variables: { input: CreatePortfolioInput }) =>
			optimisticResponseGenerators.createPortfolio(variables.input),
		update: (cache, { data: mutationData }) => {
			if (mutationData?.createPortfolio) {
				cacheUpdateUtils.addPortfolioToCache(
					cache,
					mutationData.createPortfolio,
				);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
			}
		},
		onError: (error) => {
			console.error("Create portfolio error:", error);
			// Optionally, trigger a refetch or other error recovery here if needed
		},
	});

	// Update portfolio mutation with optimistic updates
	const [updatePortfolioMutation] = useMutation(UPDATE_PORTFOLIO, {
		optimisticResponse: (variables: {
			id: string;
			input: UpdatePortfolioInput;
		}) =>
			optimisticResponseGenerators.updatePortfolio(
				variables.id,
				variables.input,
			),
		update: (cache, { data: mutationData }) => {
			if (mutationData?.updatePortfolio) {
				cacheUpdateUtils.updatePortfolioInCache(
					cache,
					mutationData.updatePortfolio,
				);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
			}
		},
		onError: (error) => {
			console.error("Update portfolio error:", error);
			// Optionally, trigger cache invalidation or recovery logic here if needed
		},
	});

	// Delete portfolio mutation with optimistic updates
	const [deletePortfolioMutation] = useMutation(DELETE_PORTFOLIO, {
		optimisticResponse: (variables: { id: string }) =>
			optimisticResponseGenerators.deletePortfolio(variables.id),
		update: (cache, { data: mutationData }, { variables }) => {
			if (mutationData?.deletePortfolio && variables?.id) {
				cacheUpdateUtils.removePortfolioFromCache(cache, variables.id);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
				cacheInvalidationHelpers.invalidatePortfolio(cache, variables.id);
			}
		},
		onError: (error) => {
			console.error("Delete portfolio error:", error);
			// Invalidate all portfolio queries using Apollo cache
			// 'cache' is not available in onError, so refetch queries as fallback
			if (refetch) refetch();
		},
	});

	// Duplicate portfolio mutation with optimistic updates
	const [duplicatePortfolioMutation] = useMutation(DUPLICATE_PORTFOLIO, {
		optimisticResponse: (variables: { input: DuplicatePortfolioInput }) =>
			optimisticResponseGenerators.duplicatePortfolio(variables.input),
		update: (cache, { data: mutationData }) => {
			if (mutationData?.duplicatePortfolio) {
				cacheUpdateUtils.addPortfolioToCache(
					cache,
					mutationData.duplicatePortfolio,
				);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
			}
		},
		onError: (error) => {
			console.error("Duplicate portfolio error:", error);
			// Invalidate all portfolio queries using Apollo cache
			// 'cache' is not available in onError, so refetch queries as fallback
			if (refetch) refetch();
		},
	});

	// Wrapper functions for mutations
	const createPortfolio = async (input: CreatePortfolioInput) => {
		try {
			const result = await createPortfolioMutation({
				variables: { input },
			});
			return result;
		} catch (error) {
			console.error("Error creating portfolio:", error);
			throw error;
		}
	};

	const updatePortfolio = async (id: string, input: UpdatePortfolioInput) => {
		try {
			const result = await updatePortfolioMutation({
				variables: { id, input },
			});
			return result;
		} catch (error) {
			console.error("Error updating portfolio:", error);
			throw error;
		}
	};

	const deletePortfolio = async (id: string) => {
		try {
			const result = await deletePortfolioMutation({
				variables: { id },
			});
			return result;
		} catch (error) {
			console.error("Error deleting portfolio:", error);
			throw error;
		}
	};

	const duplicatePortfolio = async (input: DuplicatePortfolioInput) => {
		try {
			const result = await duplicatePortfolioMutation({
				variables: { input },
			});
			return result;
		} catch (error) {
			console.error("Error duplicating portfolio:", error);
			throw error;
		}
	};

	// Undo delete portfolio stub (not implemented)
	const undoDeletePortfolio = async (_portfolio: Portfolio) => {
		throw new Error("Undo delete portfolio is not implemented");
	};

	// Memoized data transformation
	const transformedData = useMemo(() => {
		if (!data?.portfolios) return undefined;
		return {
			portfolios: data.portfolios,
		};
	}, [data]);

	return {
		data: transformedData,
		loading,
		error,
		refetch,
		createPortfolio,
		updatePortfolio,
		deletePortfolio,
		duplicatePortfolio,
		undoDeletePortfolio,
	};
}

// Additional utility hooks for portfolio management

// Re-export the analytics hook from the dedicated file
export {
	usePortfolioAnalytics,
	useRealTimePortfolioAnalytics,
} from "./use-portfolio-analytics";

export function usePortfolioExport() {
	// This would be implemented when export functionality is added
	const exportToFormat = async (
		portfolioId: string,
		format: "CSV" | "PDF" | "EXCEL",
		options: unknown = {},
	) => {
		// Mock implementation
		console.log(`Exporting portfolio ${portfolioId} to ${format}`);
		return { success: true };
	};

	return {
		exportToFormat,
		isExporting: false,
	};
}
