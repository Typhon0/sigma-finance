import {
	ApolloClient,
	createHttpLink,
	from,
	InMemoryCache,
} from "@apollo/client";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { GET_DASHBOARD_CRITICAL } from "@/graphql/queries";
import { apolloCacheConfig } from "./apollo-cache-config";

if (import.meta.env.MODE === "development") {
	loadDevMessages();
	loadErrorMessages();
}

// HTTP link to the GraphQL server
const httpLink = createHttpLink({
	uri: import.meta.env.VITE_GRAPHQL_ENDPOINT, // Assuming the GraphQL endpoint is at /graphql
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
		graphQLErrors.forEach(({ message, locations, path }) => {
			console.error(
				`GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`,
			);
		});
	}

	if (networkError) {
		console.error(`Network error: ${networkError}`);
	}
});
const cache = apolloCacheConfig;

// Apollo Client configuration with caching policies and error handling
export const apolloClient = new ApolloClient({
	link: from([errorLink, retryLink, httpLink]),
	credentials: "include",
	cache: new InMemoryCache(),
});
// Cache management utilities
export const clearCache = () => {
	cache.reset();
	localStorage.removeItem("apollo-cache");
};

export const evictUserData = (userID: string) => {
	// Evict user-specific data from cache
	cache.evict({
		fieldName: "portfolios",
		args: { filter: { userID } },
	});
	cache.evict({
		fieldName: "transactions",
		args: { filter: { userID } },
	});
	cache.evict({
		fieldName: "assets",
		args: { filter: { userID } },
	});
	cache.evict({
		fieldName: "alerts",
		args: { filter: { userID } },
	});

	// Garbage collect
	cache.gc();
};

// Performance monitoring
export const getCacheSize = () => {
	try {
		const cacheData = JSON.stringify(cache.extract());
		return new Blob([cacheData]).size;
	} catch (error) {
		console.warn("Failed to calculate cache size:", error);
		return 0;
	}
};

export const logCacheStats = () => {
	const size = getCacheSize();
	const sizeInMB = (size / (1024 * 1024)).toFixed(2);
	console.log(`Apollo Cache Size: ${sizeInMB} MB`);
};

// Preload critical queries
export const preloadCriticalData = async (userID: string) => {
	try {
		await apolloClient.query({
			query: GET_DASHBOARD_CRITICAL,
			variables: { userID },
			fetchPolicy: "cache-first",
		});
	} catch (error) {
		console.warn("Failed to preload critical data:", error);
	}
};
