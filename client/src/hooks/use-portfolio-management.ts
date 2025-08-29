import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useMemo, useState } from "react";
import type {
	CreatePortfolioInput,
	DuplicatePortfolioInput,
	GetPortfoliosWithAnalyticsQuery,
	Portfolio,
	UpdatePortfolioInput,
} from "@/gql/graphql";
import {
	CREATE_PORTFOLIO,
	DELETE_PORTFOLIO,
	DUPLICATE_PORTFOLIO,
	UPDATE_PORTFOLIO,
} from "@/graphql/mutations";
import { GET_PORTFOLIOS_WITH_ANALYTICS } from "@/graphql/queries";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage, useErrorHandling } from "./use-error-handling";

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

// Enhanced Portfolio Management Hook with improved error handling and loading states
export function usePortfolioManagement() {
	const { user } = useAuth();
	const effectiveUserID = user?.id;

	// Loading states for individual operations
	const [operationLoading, setOperationLoading] = useState({
		create: false,
		update: false,
		delete: false,
		duplicate: false,
	});

	// Error handling
	const errorHandling = useErrorHandling({
		maxRetries: 3,
		retryDelay: 1000,
	});

	const { data, loading, error, refetch } =
		useQuery<GetPortfoliosWithAnalyticsQuery>(GET_PORTFOLIOS_WITH_ANALYTICS, {
			client: apolloClient,
			variables: { userID: effectiveUserID },
			errorPolicy: "all",
			fetchPolicy: "cache-and-network",
			nextFetchPolicy: "cache-first",
			notifyOnNetworkStatusChange: true,
			skip: !effectiveUserID,
			onError: (error) => {
				errorHandling.handleError(error);
			},
		});

	// Create portfolio mutation with enhanced optimistic updates
	const [createPortfolioMutation] = useMutation(CREATE_PORTFOLIO, {
		optimisticResponse: (variables: { input: CreatePortfolioInput }) => {
			const optimisticPortfolio = {
				__typename: "Portfolio" as const,
				id: `temp-${Date.now()}`,
				name: variables.input.name,
				description: variables.input.description || null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sortOrder: (data?.portfolios?.length || 0) + 1,
				assets: [],
				analytics: null,
				tags: [],
				transactions: [],
				user: {
					__typename: "User" as const,
					id: variables.input.userID,
					name: user?.name || "",
					email: user?.email || "",
					emailVerified: true,
				},
			};
			return {
				createPortfolio: optimisticPortfolio,
			};
		},
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
			errorHandling.handleError(error);
			setOperationLoading((prev) => ({ ...prev, create: false }));
		},
		onCompleted: () => {
			setOperationLoading((prev) => ({ ...prev, create: false }));
			errorHandling.clearError();
		},
	});

	// Update portfolio mutation with enhanced optimistic updates
	const [updatePortfolioMutation] = useMutation(UPDATE_PORTFOLIO, {
		optimisticResponse: (variables: {
			id: string;
			input: UpdatePortfolioInput;
		}) => {
			const currentPortfolio = data?.portfolios?.find(
				(p) => p.id === variables.id,
			) as Portfolio | undefined;

			if (!currentPortfolio) {
				return null;
			}

			return {
				updatePortfolio: {
					...currentPortfolio,
					name: variables.input.name ?? currentPortfolio.name,
					description:
						variables.input.description !== undefined
							? variables.input.description
							: currentPortfolio.description,
					sortOrder: variables.input.sortOrder ?? currentPortfolio.sortOrder,
					updatedAt: new Date().toISOString(),
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
			errorHandling.handleError(error);
			setOperationLoading((prev) => ({ ...prev, update: false }));
		},
		onCompleted: () => {
			setOperationLoading((prev) => ({ ...prev, update: false }));
			errorHandling.clearError();
		},
	});

	// Delete portfolio mutation with enhanced optimistic updates
	const [deletePortfolioMutation] = useMutation(DELETE_PORTFOLIO, {
		optimisticResponse: (variables: { id: string }) => ({
			deletePortfolio: variables.id,
		}),
		update: (cache, { data: mutationData }, { variables }) => {
			if (mutationData?.deletePortfolio && variables?.id) {
				cacheUpdateUtils.removePortfolioFromCache(cache, variables.id);
				cacheInvalidationHelpers.invalidateDashboardData(cache);
				cacheInvalidationHelpers.invalidatePortfolio(cache, variables.id);
			}
		},
		onError: (error) => {
			errorHandling.handleError(error);
			setOperationLoading((prev) => ({ ...prev, delete: false }));
			// Refetch to restore the optimistically removed portfolio
			if (refetch) refetch();
		},
		onCompleted: () => {
			setOperationLoading((prev) => ({ ...prev, delete: false }));
			errorHandling.clearError();
		},
	});

	// Duplicate portfolio mutation with enhanced optimistic updates
	const [duplicatePortfolioMutation] = useMutation(DUPLICATE_PORTFOLIO, {
		optimisticResponse: (variables: { input: DuplicatePortfolioInput }) => {
			const sourcePortfolio = data?.portfolios?.find(
				(p) => p.id === variables.input.sourcePortfolioID,
			);

			return {
				duplicatePortfolio: {
					__typename: "Portfolio" as const,
					id: `temp-duplicate-${Date.now()}`,
					name: variables.input.newName,
					description:
						variables.input.description || sourcePortfolio?.description || null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					sortOrder: (data?.portfolios?.length || 0) + 1,
					assets: variables.input.copyAssets
						? sourcePortfolio?.assets || []
						: [],
					analytics: null,
					tags: sourcePortfolio?.tags || [],
					transactions: [],
					user: sourcePortfolio?.user || {
						__typename: "User" as const,
						id: user?.id || "",
						name: user?.name || "",
						email: user?.email || "",
						emailVerified: true,
					},
				},
			};
		},
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
			errorHandling.handleError(error);
			setOperationLoading((prev) => ({ ...prev, duplicate: false }));
		},
		onCompleted: () => {
			setOperationLoading((prev) => ({ ...prev, duplicate: false }));
			errorHandling.clearError();
		},
	});

	// Enhanced wrapper functions for mutations with proper loading states and error handling
	const createPortfolio = useCallback(
		async (input: CreatePortfolioInput) => {
			if (!effectiveUserID) {
				throw new Error("User must be authenticated to create a portfolio");
			}

			setOperationLoading((prev) => ({ ...prev, create: true }));
			errorHandling.clearError();

			try {
				const result = await createPortfolioMutation({
					variables: {
						input: {
							...input,
							userID: effectiveUserID,
						},
					},
				});

				if (result.errors) {
					throw new Error(
						result.errors[0]?.message || "Failed to create portfolio",
					);
				}

				return result.data?.createPortfolio;
			} catch (error) {
				const errorMessage = getErrorMessage(error as Error);
				throw new Error(errorMessage);
			}
		},
		[createPortfolioMutation, effectiveUserID, errorHandling],
	);

	const updatePortfolio = useCallback(
		async (id: string, input: UpdatePortfolioInput) => {
			if (!effectiveUserID) {
				throw new Error("User must be authenticated to update a portfolio");
			}

			setOperationLoading((prev) => ({ ...prev, update: true }));
			errorHandling.clearError();

			try {
				const result = await updatePortfolioMutation({
					variables: { id, input },
				});

				if (result.errors) {
					throw new Error(
						result.errors[0]?.message || "Failed to update portfolio",
					);
				}

				return result.data?.updatePortfolio;
			} catch (error) {
				const errorMessage = getErrorMessage(error as Error);
				throw new Error(errorMessage);
			}
		},
		[updatePortfolioMutation, effectiveUserID, errorHandling],
	);

	const deletePortfolio = useCallback(
		async (id: string) => {
			if (!effectiveUserID) {
				throw new Error("User must be authenticated to delete a portfolio");
			}

			setOperationLoading((prev) => ({ ...prev, delete: true }));
			errorHandling.clearError();

			try {
				const result = await deletePortfolioMutation({
					variables: { id },
				});

				if (result.errors) {
					// Enhanced error handling for specific deletion scenarios
					const errorMessage = result.errors[0]?.message || "Failed to delete portfolio";
					
					// Check for specific error types
					if (errorMessage.includes("positions") || errorMessage.includes("assets")) {
						throw new Error("Cannot delete portfolio that contains positions. Please remove all assets first.");
					} else if (errorMessage.includes("unauthorized") || errorMessage.includes("permission")) {
						throw new Error("You don't have permission to delete this portfolio.");
					} else if (errorMessage.includes("not found")) {
						throw new Error("Portfolio not found. It may have already been deleted.");
					} else {
						throw new Error(errorMessage);
					}
				}

				return result.data?.deletePortfolio;
			} catch (error) {
				const errorMessage = getErrorMessage(error as Error);
				throw new Error(errorMessage);
			}
		},
		[deletePortfolioMutation, effectiveUserID, errorHandling],
	);

	const duplicatePortfolio = useCallback(
		async (input: DuplicatePortfolioInput) => {
			if (!effectiveUserID) {
				throw new Error("User must be authenticated to duplicate a portfolio");
			}

			setOperationLoading((prev) => ({ ...prev, duplicate: true }));
			errorHandling.clearError();

			try {
				const result = await duplicatePortfolioMutation({
					variables: { input },
				});

				if (result.errors) {
					throw new Error(
						result.errors[0]?.message || "Failed to duplicate portfolio",
					);
				}

				return result.data?.duplicatePortfolio;
			} catch (error) {
				const errorMessage = getErrorMessage(error as Error);
				throw new Error(errorMessage);
			}
		},
		[duplicatePortfolioMutation, effectiveUserID, errorHandling],
	);

	// Retry function for failed operations
	const retryLastOperation = useCallback(async () => {
		if (errorHandling.canRetry) {
			await errorHandling.retry(refetch);
		}
	}, [errorHandling, refetch]);

	// Memoized data transformation
	const transformedData = useMemo(() => {
		if (!data?.portfolios) return undefined;
		return {
			portfolios: data.portfolios,
		};
	}, [data]);

	// Combined loading state
	const isLoading = loading || Object.values(operationLoading).some(Boolean);

	// Enhanced return object with better UX
	return {
		// Data
		portfolios: transformedData?.portfolios,

		// Loading states
		loading: isLoading,
		operationLoading,

		// Error handling
		error: error || errorHandling.error,
		hasError: !!error || errorHandling.hasError,
		canRetry: errorHandling.canRetry,
		retryCount: errorHandling.retryCount,

		// Operations
		createPortfolio,
		updatePortfolio,
		deletePortfolio,
		duplicatePortfolio,

		// Utility functions
		refetch,
		retry: retryLastOperation,
		clearError: errorHandling.clearError,

		// Status helpers
		isCreating: operationLoading.create,
		isUpdating: operationLoading.update,
		isDeleting: operationLoading.delete,
		isDuplicating: operationLoading.duplicate,
	};
}

// Additional utility hooks for portfolio management

export type { Portfolio } from "./use-portfolio-analytics";
// Re-export the analytics hook from the dedicated file
// Additional utility hooks for portfolio management
// Re-export the analytics hook from the dedicated file
export { usePortfolioAnalytics } from "./use-portfolio-analytics";

/**
 * Hook for managing a single portfolio with enhanced UX
 */
export function usePortfolioOperations(portfolioId?: string) {
	const portfolioManagement = usePortfolioManagement();
	const [lastOperation, setLastOperation] = useState<{
		type: "create" | "update" | "delete" | "duplicate";
		timestamp: number;
	} | null>(null);

	const portfolio = useMemo(() => {
		if (!portfolioId || !portfolioManagement.portfolios) return null;
		return (
			portfolioManagement.portfolios.find((p) => p.id === portfolioId) || null
		);
	}, [portfolioId, portfolioManagement.portfolios]);

	const updatePortfolio = useCallback(
		async (input: UpdatePortfolioInput) => {
			if (!portfolioId) {
				throw new Error("Portfolio ID is required for update operation");
			}

			setLastOperation({ type: "update", timestamp: Date.now() });
			return await portfolioManagement.updatePortfolio(portfolioId, input);
		},
		[portfolioId, portfolioManagement],
	);

	const deletePortfolio = useCallback(async () => {
		if (!portfolioId) {
			throw new Error("Portfolio ID is required for delete operation");
		}

		setLastOperation({ type: "delete", timestamp: Date.now() });
		return await portfolioManagement.deletePortfolio(portfolioId);
	}, [portfolioId, portfolioManagement]);

	const duplicatePortfolio = useCallback(
		async (
			newName: string,
			options?: {
				copyAssets?: boolean;
				description?: string;
			},
		) => {
			if (!portfolioId) {
				throw new Error("Portfolio ID is required for duplicate operation");
			}

			setLastOperation({ type: "duplicate", timestamp: Date.now() });
			return await portfolioManagement.duplicatePortfolio({
				sourcePortfolioID: portfolioId,
				newName,
				copyAssets: options?.copyAssets ?? false,
				description: options?.description,
			});
		},
		[portfolioId, portfolioManagement],
	);

	return {
		portfolio,
		updatePortfolio,
		deletePortfolio,
		duplicatePortfolio,
		lastOperation,
		isLoading:
			portfolioManagement.isUpdating ||
			portfolioManagement.isDeleting ||
			portfolioManagement.isDuplicating,
		error: portfolioManagement.error,
		hasError: portfolioManagement.hasError,
		retry: portfolioManagement.retry,
		clearError: portfolioManagement.clearError,
	};
}

/**
 * Hook for portfolio creation with form-friendly interface
 */
export function usePortfolioCreation() {
	const portfolioManagement = usePortfolioManagement();
	const [createdPortfolio, setCreatedPortfolio] = useState<Portfolio | null>(
		null,
	);

	const createPortfolio = useCallback(
		async (data: { name: string; description?: string }) => {
			const result = await portfolioManagement.createPortfolio({
				name: data.name,
				description: data.description || null,
				userID: "", // This will be set by the hook
			});

			if (result) {
				setCreatedPortfolio(result);
			}

			return result;
		},
		[portfolioManagement],
	);

	const resetCreatedPortfolio = useCallback(() => {
		setCreatedPortfolio(null);
	}, []);

	return {
		createPortfolio,
		createdPortfolio,
		resetCreatedPortfolio,
		isCreating: portfolioManagement.isCreating,
		error: portfolioManagement.error,
		hasError: portfolioManagement.hasError,
		retry: portfolioManagement.retry,
		clearError: portfolioManagement.clearError,
	};
}

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
