import { InMemoryCache, Reference } from '@apollo/client';

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
                    keyArgs: ['filter', 'sort'],
                    merge(existing = { items: [], pageInfo: {} }, incoming, { args }) {
                        // Pagination: replace or append based on args
                        if (!args || !args.pagination || args.pagination.page === 1) {
                            return incoming;
                        }
                        return {
                            ...incoming,
                            items: [...existing.items, ...incoming.items],
                        };
                    },
                },
                transactions: {
                    keyArgs: ['filter', 'sort'],
                    merge(existing = { items: [], pageInfo: {} }, incoming, { args }) {
                        if (!args || !args.pagination || args.pagination.page === 1) {
                            return incoming;
                        }
                        return {
                            ...incoming,
                            items: [...existing.items, ...incoming.items],
                        };
                    },
                },
                assets: {
                    keyArgs: ['filter', 'sort'],
                    merge(existing = { items: [], pageInfo: {} }, incoming, { args }) {
                        if (!args || !args.pagination || args.pagination.page === 1) {
                            return incoming;
                        }
                        return {
                            ...incoming,
                            items: [...existing.items, ...incoming.items],
                        };
                    },
                },
                watchlists: {
                    keyArgs: ['filter', 'sort'],
                    merge(existing = { items: [], pageInfo: {} }, incoming, { args }) {
                        if (!args || !args.pagination || args.pagination.page === 1) {
                            return incoming;
                        }
                        return {
                            ...incoming,
                            items: [...existing.items, ...incoming.items],
                        };
                    },
                },
                alerts: {
                    keyArgs: ['filter', 'sort'],
                    merge(existing = { items: [], pageInfo: {} }, incoming, { args }) {
                        if (!args || !args.pagination || args.pagination.page === 1) {
                            return incoming;
                        }
                        return {
                            ...incoming,
                            items: [...existing.items, ...incoming.items],
                        };
                    },
                },
                reports: {
                    keyArgs: ['filter', 'sort'],
                    merge(existing = { items: [], pageInfo: {} }, incoming, { args }) {
                        if (!args || !args.pagination || args.pagination.page === 1) {
                            return incoming;
                        }
                        return {
                            ...incoming,
                            items: [...existing.items, ...incoming.items],
                        };
                    },
                },
            },
        },
        Portfolio: {
            keyFields: ['id'],
            fields: {
                positions: {
                    merge(existing: Reference[] = [], incoming: Reference[]) {
                        return incoming;
                    },
                },
                tags: {
                    merge(existing: Reference[] = [], incoming: Reference[]) {
                        return incoming;
                    },
                },
            },
        },
        Position: {
            keyFields: ['id'],
            fields: {
                asset: {
                    merge(existing: Reference | undefined, incoming: Reference) {
                        return incoming;
                    },
                },
            },
        },
        Asset: {
            keyFields: ['id'],
            fields: {
                metadata: {
                    merge(existing: Record<string, unknown> = {}, incoming: Record<string, unknown>) {
                        return { ...existing, ...incoming };
                    },
                },
            },
        },
        Transaction: {
            keyFields: ['id'],
        },
        Watchlist: {
            keyFields: ['id'],
        },
        Alert: {
            keyFields: ['id'],
        },
        Tag: {
            keyFields: ['id'],
        },
        Report: {
            keyFields: ['id'],
        },
        User: {
            keyFields: ['id'],
            fields: {
                portfolios: {
                    merge(existing: Reference[] = [], incoming: Reference[]) {
                        return incoming;
                    },
                },
            },
        },
    },
});