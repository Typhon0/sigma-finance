import { useLazyQuery, useQuery, useSubscription } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	GET_ASSET_PERFORMANCE_OPTIMIZED,
	GET_DASHBOARD_CRITICAL,
	GET_DASHBOARD_SECONDARY,
	GET_PORTFOLIO_CARDS,
	GET_RECENT_TRANSACTIONS_MINIMAL,
} from "@/graphql/queries";
import { PORTFOLIO_UPDATE_SUBSCRIPTION } from "@/graphql/subscriptions";

// Hook for critical dashboard data (loads first)
export const useCriticalDashboardData = (userID: string) => {
	console.log('useCriticalDashboardData called with userID:', userID, 'skip:', !userID || userID.trim() === "");
	
	return useQuery(GET_DASHBOARD_CRITICAL, {
		variables: { userID },
		fetchPolicy: "cache-and-network",
		errorPolicy: "all",
		notifyOnNetworkStatusChange: true,
		// Skip if no userID or userID is empty string
		skip: !userID || userID.trim() === "",
	});
};

// Hook for secondary dashboard data (loads after critical)
export const useSecondaryDashboardData = (userID: string, enabled = true) => {
	return useQuery(GET_DASHBOARD_SECONDARY, {
		variables: { userID },
		fetchPolicy: "cache-first",
		errorPolicy: "all",
		// Only fetch when enabled and userID exists and is not empty
		skip: !userID || userID.trim() === "" || !enabled,
	});
};

// Hook for portfolio cards with optimized caching
export const usePortfolioCards = (userID: string) => {
	return useQuery(GET_PORTFOLIO_CARDS, {
		variables: { userID },
		fetchPolicy: "cache-first",
		errorPolicy: "all",
		// Poll every 5 minutes for portfolio updates
		pollInterval: 5 * 60 * 1000,
		skip: !userID || userID.trim() === "",
	});
};

// Hook for recent transactions with lazy loading
export const useRecentTransactions = (userID: string, limit = 5) => {
	const [loadTransactions, { data, loading, error }] = useLazyQuery(
		GET_RECENT_TRANSACTIONS_MINIMAL,
		{
			variables: { userID, limit },
			fetchPolicy: "cache-first",
			errorPolicy: "all",
		},
	);

	// Load transactions when component becomes visible
	const loadWhenVisible = useCallback(() => {
		if (userID && userID.trim() !== "") {
			loadTransactions();
		}
	}, [userID, loadTransactions]);

	return {
		data,
		loading,
		error,
		loadTransactions: loadWhenVisible,
	};
};

// Hook for asset performance with pagination
export const useAssetPerformance = (userID: string, limit = 10) => {
	return useQuery(GET_ASSET_PERFORMANCE_OPTIMIZED, {
		variables: { userID, limit },
		fetchPolicy: "cache-first",
		errorPolicy: "all",
		// Poll every 10 minutes for performance updates
		pollInterval: 10 * 60 * 1000,
		skip: !userID || userID.trim() === "",
	});
};

// Hook for real-time dashboard updates
export const useDashboardSubscription = (userID: string, enabled = true) => {
	const { data: subscriptionData } = useSubscription(
		PORTFOLIO_UPDATE_SUBSCRIPTION,
		{
			variables: { userID },
			skip: !userID || userID.trim() === "" || !enabled,
			onSubscriptionData: ({ subscriptionData }) => {
				if (subscriptionData.data) {
					console.log("Dashboard update received:", subscriptionData.data);
				}
			},
		},
	);

	return subscriptionData;
};

// Optimized dashboard data hook with progressive loading
export const useOptimizedDashboardData = (userID: string) => {
	const [secondaryEnabled, setSecondaryEnabled] = useState(false);

	// Load critical data first
	const {
		data: criticalData,
		loading: criticalLoading,
		error: criticalError,
		refetch: refetchCritical,
	} = useCriticalDashboardData(userID);

	// Load secondary data after critical data is loaded
	const {
		data: secondaryData,
		loading: secondaryLoading,
		error: secondaryError,
		refetch: refetchSecondary,
	} = useSecondaryDashboardData(userID, secondaryEnabled);

	// Enable secondary data loading when critical data is loaded
	useEffect(() => {
		if (criticalData && !criticalLoading) {
			// Delay secondary loading slightly to prioritize critical rendering
			const timer = setTimeout(() => {
				setSecondaryEnabled(true);
			}, 100);

			return () => clearTimeout(timer);
		}
	}, [criticalData, criticalLoading]);

	// Combine data from both queries
	const combinedData = useMemo(() => {
		return {
			portfolios: criticalData?.portfolios || [],
			transactions: secondaryData?.transactions || [],
			alerts: [],
		};
	}, [criticalData, secondaryData]);

	// Determine overall loading state
	const isLoading = criticalLoading || (secondaryEnabled && secondaryLoading);

	// Combine errors
	const error = criticalError || secondaryError;

	const refetch = useCallback(() => {
		const p1 = refetchCritical ? refetchCritical() : Promise.resolve();
		const p2 = refetchSecondary ? refetchSecondary() : Promise.resolve();
		return Promise.all([p1, p2]);
	}, [refetchCritical, refetchSecondary]);

	return {
		data: combinedData,
		loading: isLoading,
		error,
		refetch,
		criticalLoaded: !!criticalData && !criticalLoading,
		secondaryLoaded: !!secondaryData && !secondaryLoading,
	};
};

// Hook for intersection observer (for lazy loading)
export const useIntersectionObserver = (
	callback: () => void,
	options: IntersectionObserverInit = {},
) => {
	const [elementRef, setElementRef] = useState<Element | null>(null);

	useEffect(() => {
		if (!elementRef) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						callback();
						observer.unobserve(entry.target);
					}
				});
			},
			{
				threshold: 0.1,
				...options,
			},
		);

		observer.observe(elementRef);

		return () => {
			observer.disconnect();
		};
	}, [elementRef, callback, options]);

	return setElementRef;
};

// Hook for performance monitoring
export const useDashboardPerformance = () => {
	const [metrics, setMetrics] = useState({
		renderTime: 0,
		queryTime: 0,
		cacheHitRate: 0,
	});

	const startTiming = useCallback(() => {
		return performance.now();
	}, []);

	const endTiming = useCallback(
		(startTime: number, type: "render" | "query") => {
			const endTime = performance.now();
			const duration = endTime - startTime;

			setMetrics((prev) => ({
				...prev,
				[type === "render" ? "renderTime" : "queryTime"]: duration,
			}));

			return duration;
		},
		[],
	);

	const logPerformance = useCallback(() => {
		console.log("Dashboard Performance Metrics:", metrics);
	}, [metrics]);

	return {
		metrics,
		startTiming,
		endTiming,
		logPerformance,
	};
};

// Hook for cache management
export const useCacheManagement = () => {
	const clearUserCache = useCallback((userID: string) => {
		// Implementation would depend on Apollo Client instance
		console.log(`Clearing cache for user: ${userID}`);
	}, []);

	const preloadData = useCallback(async (userID: string) => {
		// Preload critical data
		console.log(`Preloading data for user: ${userID}`);
	}, []);

	const getCacheStats = useCallback(() => {
		// Return cache statistics
		return {
			size: 0,
			hitRate: 0,
			entries: 0,
		};
	}, []);

	return {
		clearUserCache,
		preloadData,
		getCacheStats,
	};
};
