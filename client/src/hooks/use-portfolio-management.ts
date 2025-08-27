import { gql, useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";
import type {
	CreatePortfolioInput,
	DuplicatePortfolioInput,
	GetPortfoliosWithAnalyticsQuery,
	Portfolio,
	UpdatePortfolioInput,
} from "@/gql/graphql";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { useAuth } from "@/lib/auth-context";
import {
	CREATE_PORTFOLIO,
	DELETE_PORTFOLIO,
	DUPLICATE_PORTFOLIO,
	UPDATE_PORTFOLIO,
} from "@/graphql/mutations";
import { GET_PORTFOLIOS_WITH_ANALYTICS } from "@/graphql/queries";

// --- Utility Stubs (replace with real implementations as needed) ---
const optimisticResponseGenerators = {
	createPortfolio: (input: CreatePortfolioInput) => ({
		createPortfolio: {
			__typename: "Portfolio" as const,
			id: "temp-id",
			name: input.name,
			description: input.description,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			assets: [],
			analytics: null,
			sortOrder: 0,
			tags: [],
			transactions: [],
			user: {
				__typename: "User" as const,
				id: input.userID,
			},
		},
	}),
	updatePortfolio: (id: string, input: UpdatePortfolioInput) => {
		// This is tricky because we don't have access to the cache here.
		// A full implementation would require reading the portfolio from the cache
		// or passing the current portfolio data to the mutation function.
		// For now, we'll construct a partial optimistic response.
		return {
			updatePortfolio: {
				__typename: "Portfolio" as const,
				id,
				name: input.name,
				description: input.description,
				updatedAt: new Date().toISOString(),
				// The following fields are required by the Portfolio type,
				// but we don't have the data here. Apollo will merge this
				// partial data with the existing data in the cache.
				createdAt: new Date().toISOString(),
				assets: [],
				analytics: null,
				sortOrder: 0,
				tags: [],
				transactions: [],
				user: {
					__typename: "User" as const,
					id: "temp-user-id", // This should be the actual user ID
				},
			},
		};
	},
	deletePortfolio: (id: string) => ({
		deletePortfolio: id,
	}),
	duplicatePortfolio: (input: DuplicatePortfolioInput) => ({
		duplicatePortfolio: {
			__typename: "Portfolio" as const,
			id: "temp-id",
			name: input.newName,
			description: "",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			assets: [],
			analytics: null,
			sortOrder: 0,
			tags: [],
			transactions: [],
			user: {
				__typename: "User" as const,
				id: "temp-user-id", // This should be the actual user ID
			},
		},
	}),
};

const cacheUpdateUtils = {
	addPortfolioToCache: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolio: Portfolio,
	) => {
		const data = cache.readQuery<GetPortfoliosWithAnalyticsQuery>({
			query: GET_PORTFOLIOS_WITH_ANALYTICS,
		});
		if (data && data.portfolios) {
			cache.writeQuery({
				query: GET_PORTFOLIOS_WITH_ANALYTICS,
				data: {
					portfolios: [...data.portfolios, portfolio],
				},
			});
		}
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
				}
			`,
			data: portfolio,
		});
	},
	removePortfolioFromCache: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolioId: string,
	) => {
		const data = cache.readQuery<GetPortfoliosWithAnalyticsQuery>({
			query: GET_PORTFOLIOS_WITH_ANALYTICS,
		});
		if (data && data.portfolios) {
			cache.writeQuery({
				query: GET_PORTFOLIOS_WITH_ANALYTICS,
				data: {
					portfolios: data.portfolios.filter((p) => p.id !== portfolioId),
				},
			});
		}
		cache.evict({ id: `Portfolio:${portfolioId}` });
		cache.gc();
	},
};

const cacheInvalidationHelpers = {
	invalidateDashboardData: (
		cache: import("@apollo/client").ApolloCache<unknown>,
	) => {
		// This is a placeholder. In a real app, you would invalidate specific queries
		// related to the dashboard. For now, we can refetch active queries.
		// A more robust implementation would use cache.evict() and cache.gc()
		// on specific dashboard-related query root fields.
		const query = GET_PORTFOLIOS_WITH_ANALYTICS;
		if (query) {
			const data = cache.readQuery<GetPortfoliosWithAnalyticsQuery>({
				query,
			});
			if (data) {
				cache.writeQuery({ query, data: null });
			}
		}
	},
	invalidatePortfolio: (
		cache: import("@apollo/client").ApolloCache<unknown>,
		portfolioId: string,
	) => {
		cache.evict({ id: `Portfolio:${portfolioId}` });
		cache.gc();
	},
};

// FIXED: Main Hook Implementation
export function usePortfolioManagement() {
	const { user } = useAuth();
	const effectiveUserID = user?.id;

	const { data, loading, error, refetch } =
		useQuery<GetPortfoliosWithAnalyticsQuery>(GET_PORTFOLIOS_WITH_ANALYTICS, {
			client: apolloClient,
			variables: { userID: effectiveUserID },
			errorPolicy: "all",
			fetchPolicy: "cache-and-network",
			nextFetchPolicy: "cache-first",
			notifyOnNetworkStatusChange: true,
			skip: !effectiveUserID,
		});

	// Create portfolio mutation with optimistic updates
	const [createPortfolioMutation] = useMutation(CREATE_PORTFOLIO, {
		optimisticResponse: (variables: { input: CreatePortfolioInput }) =>
			optimisticResponseGenerators.createPortfolio(variables.input),
		update: (cache, { data: mutationData }) => {
			if (mutationData?.createPortfolio) {
				cacheUpdateUtils.addPortfolioToCache(
					cache,
					mutationData.createPortfolio as Portfolio,
				);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
			}
		},
		onError: (error) => {
			console.error("Create portfolio error:", error);
		},
	});

	// Update portfolio mutation with optimistic updates
	const [updatePortfolioMutation] = useMutation(UPDATE_PORTFOLIO, {
		optimisticResponse: (variables: {
			id: string;
			input: UpdatePortfolioInput;
		}) => {
			const currentPortfolio = data?.portfolios?.find(
				(p) => p.id === variables.id,
			) as Portfolio | undefined;
			return {
				updatePortfolio: {
					__typename: "Portfolio" as const,
					id: variables.id,
					name: variables.input.name ?? currentPortfolio?.name ?? "",
					description:
						variables.input.description ??
						currentPortfolio?.description ??
						null,
					updatedAt: new Date().toISOString(),
					createdAt: currentPortfolio?.createdAt ?? new Date().toISOString(),
					assets: currentPortfolio?.assets ?? [],
					analytics: currentPortfolio?.analytics ?? null,
					sortOrder: currentPortfolio?.sortOrder ?? 0,
					tags: currentPortfolio?.tags ?? [],
					transactions: currentPortfolio?.transactions ?? [],
					user: currentPortfolio?.user ?? {
						__typename: "User" as const,
						id: user?.id ?? "temp-user-id",
					},
				},
			};
		},
		update: (cache, { data: mutationData }) => {
			if (mutationData?.updatePortfolio) {
				cacheUpdateUtils.updatePortfolioInCache(
					cache,
					mutationData.updatePortfolio as Portfolio,
				);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
			}
		},
		onError: (error) => {
			console.error("Update portfolio error:", error);
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
					mutationData.duplicatePortfolio as Portfolio,
				);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
			}
		},
		onError: (error) => {
			console.error("Duplicate portfolio error:", error);
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
		portfolios: transformedData?.portfolios,
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

export type { Portfolio } from "./use-portfolio-analytics";
// Re-export the analytics hook from the dedicated file
// Additional utility hooks for portfolio management
// Re-export the analytics hook from the dedicated file
export { usePortfolioAnalytics } from "./use-portfolio-analytics";

export function usePortfolioExport() {
	// This would be implemented when export functionality is added
	const exportToFormat = async (
		portfolioId: string,
		format: "CSV" | "PDF" | "EXCEL",
		_options: unknown = {},
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
