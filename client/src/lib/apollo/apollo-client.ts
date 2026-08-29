import { ApolloClient, from } from "@apollo/client";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { onError } from "@apollo/client/link/error";
import { createHttpLink } from "@apollo/client/link/http";
import { RetryLink } from "@apollo/client/link/retry";
import { GET_DASHBOARD_CRITICAL } from "@/graphql/queries";
import { apolloCacheConfig } from "./apollo-cache-config";
import { authErrorLink, authLink } from "./auth-link";

if (import.meta.env.MODE === "development") {
	loadDevMessages();
	loadErrorMessages();
}

// Authentication links are imported from auth-link.ts

// HTTP link to the GraphQL server
const httpLink = createHttpLink({
	uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || "http://localhost:8080/graphql",
	credentials: "include",
});
const retryLink = new RetryLink({
	delay: {
		initial: 300,
		max: Infinity,
		jitter: true,
	},
	attempts: {
		max: 3,
		retryIf: (error, _operation) => !!error && error.statusCode !== 401,
	},
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
	if (graphQLErrors) {
		graphQLErrors.forEach(({ message: _message, locations: _locations, path: _path }) => {});
	}

	if (networkError) {
	}
});
const cache = apolloCacheConfig;

// Apollo Client configuration with enhanced caching and performance optimizations
export const apolloClient = new ApolloClient({
	link: from([authErrorLink, errorLink, retryLink, authLink, httpLink]),
	cache: apolloCacheConfig,
	defaultOptions: {
		watchQuery: {
			fetchPolicy: "cache-first",
			errorPolicy: "all",
		},
		query: {
			fetchPolicy: "cache-first",
			errorPolicy: "all",
		},
		mutate: {
			errorPolicy: "all",
		},
	},
});
// Cache management utilities
export const clearCache = () => {
	cache.reset();
	localStorage.removeItem("apollo-cache");
};

export const evictUserData = (userId: string) => {
	// Evict user-specific data from cache
	cache.evict({
		fieldName: "portfolios",
		args: { filter: { userID: userId } },
	});
	cache.evict({
		fieldName: "transactions",
		args: { filter: { userID: userId } },
	});
	cache.evict({
		fieldName: "assets",
		args: { filter: { userID: userId } },
	});
	cache.evict({
		fieldName: "alerts",
		args: { filter: { userID: userId } },
	});

	// Garbage collect
	cache.gc();
};

// Performance monitoring
export const getCacheSize = () => {
	try {
		const cacheData = JSON.stringify(cache.extract());
		return new Blob([cacheData]).size;
	} catch (_error) {
		return 0;
	}
};

export const logCacheStats = () => {
	const size = getCacheSize();
	const _sizeInMb = (size / (1024 * 1024)).toFixed(2);
};

// Preload critical queries
export const preloadCriticalData = async (userId: string) => {
	try {
		await apolloClient.query({
			query: GET_DASHBOARD_CRITICAL,
			variables: { userID: userId },
			fetchPolicy: "cache-first",
		});
	} catch (_error) {}
};
