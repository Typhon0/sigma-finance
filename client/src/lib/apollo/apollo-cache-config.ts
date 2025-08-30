import { InMemoryCache, type Reference } from "@apollo/client";

/**
 * Apollo Client cache configuration for Portfolio Tracker
 * - Enforces normalized caching for business entities
 * - Supports pagination, filtering, and sorting for list queries
 * - Ensures financial data integrity and real-time updates
 */

export const apolloCacheConfig = new InMemoryCache({
	typePolicies: {
		Query: {
			fields: {
				portfolios: {
					keyArgs: ["filter", "sort"],
					merge(existing = [], incoming, { args }) {
						// Enhanced caching for portfolio operations
						if (!args || !args.pagination || args.pagination.page === 1) {
							return incoming;
						}
						// For pagination, append new items
						return [...existing, ...incoming];
					},
					read(existing, { args, canRead }) {
						// Return cached data if available and fresh
						if (existing && canRead) {
							return existing;
						}
						return existing;
					},
				},
				portfolio: {
					keyArgs: ["id"],
					merge(existing, incoming) {
						// Always use the latest data for individual portfolio queries
						return incoming;
					},
					read(existing, { args, toReference }) {
						// Try to read from cache first
						if (args?.id && existing) {
							return existing;
						}
						// Fallback to reference lookup
						if (args?.id) {
							return toReference({
								__typename: "Portfolio",
								id: args.id,
							});
						}
						return existing;
					},
				},
				transactions: {
					keyArgs: ["filter", "sort"],
					merge(existing = [], incoming, { args }) {
						// Handle direct array response from GraphQL
						if (!incoming) {
							return existing;
						}
						if (!args || !args.pagination || args.pagination.page === 1) {
							return incoming;
						}
						// For pagination, append new items
						return [...existing, ...incoming];
					},
				},
				assets: {
					keyArgs: ["filter", "sort"],
					merge(existing = [], incoming, { args }) {
						// Handle direct array response from GraphQL
						if (!incoming) {
							return existing;
						}
						if (!args || !args.pagination || args.pagination.page === 1) {
							return incoming;
						}
						// For pagination, append new items
						return [...existing, ...incoming];
					},
				},
				watchlists: {
					keyArgs: ["filter", "sort"],
					merge(existing = [], incoming, { args }) {
						// Handle direct array response from GraphQL
						if (!incoming) {
							return existing;
						}
						if (!args || !args.pagination || args.pagination.page === 1) {
							return incoming;
						}
						// For pagination, append new items
						return [...existing, ...incoming];
					},
				},
				alerts: {
					keyArgs: ["filter", "sort"],
					merge(existing = [], incoming, { args }) {
						// Handle direct array response from GraphQL
						if (!incoming) {
							return existing;
						}
						if (!args || !args.pagination || args.pagination.page === 1) {
							return incoming;
						}
						// For pagination, append new items
						return [...existing, ...incoming];
					},
				},
				reports: {
					keyArgs: ["filter", "sort"],
					merge(existing = [], incoming, { args }) {
						// Handle direct array response from GraphQL
						if (!incoming) {
							return existing;
						}
						if (!args || !args.pagination || args.pagination.page === 1) {
							return incoming;
						}
						// For pagination, append new items
						return [...existing, ...incoming];
					},
				},
			},
		},
		Portfolio: {
			keyFields: ["id"],
			fields: {
				assets: {
					merge(_existing: Reference[] = [], incoming: Reference[]) {
						return incoming;
					},
				},
				tags: {
					merge(_existing: Reference[] = [], incoming: Reference[]) {
						return incoming;
					},
				},
				analytics: {
					merge(existing: any, incoming: any) {
						// Cache analytics data with timestamp for freshness checking
						return {
							...existing,
							...incoming,
							_cachedAt: Date.now(),
						};
					},
					read(existing) {
						// Check if analytics data is fresh (5 minutes)
						if (existing && existing._cachedAt) {
							const age = Date.now() - existing._cachedAt;
							const maxAge = 5 * 60 * 1000; // 5 minutes
							if (age > maxAge) {
								// Data is stale, return undefined to trigger refetch
								return undefined;
							}
						}
						return existing;
					},
				},
			},
		},
		Position: {
			keyFields: ["id"],
			fields: {
				asset: {
					merge(_existing: Reference | undefined, incoming: Reference) {
						return incoming;
					},
				},
			},
		},
		Asset: {
			keyFields: ["id"],
			fields: {
				metadata: {
					merge(
						existing: Record<string, unknown> = {},
						incoming: Record<string, unknown>,
					) {
						return { ...existing, ...incoming };
					},
				},
			},
		},
		Transaction: {
			keyFields: ["id"],
		},
		Watchlist: {
			keyFields: ["id"],
		},
		Alert: {
			keyFields: ["id"],
		},
		Tag: {
			keyFields: ["id"],
		},
		Report: {
			keyFields: ["id"],
		},
		User: {
			keyFields: ["id"],
			fields: {
				portfolios: {
					merge(_existing: Reference[] = [], incoming: Reference[]) {
						return incoming;
					},
				},
			},
		},
	},
});
