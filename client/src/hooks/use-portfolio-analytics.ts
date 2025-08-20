import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, ApolloClient } from "@apollo/client";
import { apolloCacheConfig } from "@/lib/apollo/apollo-cache-config";

import { gql } from "@apollo/client";
import type { PortfolioAnalytics } from "@/components/portfolio/portfolio-analytics";

// GraphQL query for portfolio analytics
const GET_PORTFOLIO_ANALYTICS = gql`
  query GetPortfolioAnalytics($portfolioID: ID!) {
    portfolio(id: $portfolioID) {
      id
      name
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
        assetAllocation {
          assetType
          value
          percentage
          count
        }
        riskMetrics {
          volatility
          sharpeRatio
          maxDrawdown
          diversification
        }
        performanceHistory {
          date
          value
        }
      }
    }
  }
`;

interface UsePortfolioAnalyticsOptions {
	portfolioId: string;
	enabled?: boolean;
	pollInterval?: number;
	cacheTimeout?: number;
}

interface UsePortfolioAnalyticsReturn {
	analytics: PortfolioAnalytics | null;
	loading: boolean;
	error: Error | null;
	refetch: () => void;
	isStale: boolean;
}

// Cache for analytics data
const analyticsCache = new Map<
	string,
	{
		data: PortfolioAnalytics;
		timestamp: number;
	}
>();

// Default cache timeout: 5 minutes
const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000;

export function usePortfolioAnalytics({
	portfolioId,
	enabled = true,
	pollInterval = 300000, // 5 minutes
	cacheTimeout = DEFAULT_CACHE_TIMEOUT,
}: UsePortfolioAnalyticsOptions): UsePortfolioAnalyticsReturn {
	const [isStale, setIsStale] = useState(false);

	// Check cache first
	const cachedData = useMemo(() => {
		const cached = analyticsCache.get(portfolioId);
		if (cached && Date.now() - cached.timestamp < cacheTimeout) {
			return cached.data;
		}
		return null;
	}, [portfolioId, cacheTimeout]);

	// GraphQL query with caching and polling
	const { data, loading, error, refetch } = useQuery(GET_PORTFOLIO_ANALYTICS, {
		variables: { portfolioID: portfolioId },
		skip: !enabled || !portfolioId || !!cachedData,
		pollInterval: enabled ? pollInterval : 0,
		errorPolicy: "partial",
		fetchPolicy: "cache-and-network",
		notifyOnNetworkStatusChange: true,
	});

	// Transform and cache analytics data
	const analytics = useMemo(() => {
		// Return cached data if available
		if (cachedData) {
			return cachedData;
		}

		// Transform GraphQL response to analytics format
		if (data?.portfolio?.analytics) {
			const portfolioAnalytics: PortfolioAnalytics = {
				portfolioId: data.portfolio.id,
				totalValue: data.portfolio.analytics.totalValue || 0,
				totalCost: data.portfolio.analytics.totalCost || 0,
				totalGainLoss: data.portfolio.analytics.totalGainLoss || 0,
				totalGainLossPercent:
					data.portfolio.analytics.totalGainLossPercent || 0,
				assetAllocation: data.portfolio.analytics.assetAllocation || [],
				riskMetrics: {
					volatility: data.portfolio.analytics.riskMetrics?.volatility || 0,
					sharpeRatio: data.portfolio.analytics.riskMetrics?.sharpeRatio || 0,
					maxDrawdown: data.portfolio.analytics.riskMetrics?.maxDrawdown || 0,
					diversification:
						data.portfolio.analytics.riskMetrics?.diversification || 0,
				},
				performanceHistory: data.portfolio.analytics.performanceHistory || [],
			};

			// Cache the transformed data
			analyticsCache.set(portfolioId, {
				data: portfolioAnalytics,
				timestamp: Date.now(),
			});

			return portfolioAnalytics;
		}

		return null;
	}, [data, cachedData, portfolioId]);

	// Calculate additional derived metrics
	const enhancedAnalytics = useMemo(() => {
		if (!analytics) return null;

		return {
			...analytics,
			// Additional calculated metrics
			diversificationScore: calculateDiversificationScore(
				analytics.assetAllocation,
			),
			riskLevel: calculateRiskLevel(analytics.riskMetrics),
			performanceGrade: calculatePerformanceGrade(
				analytics.totalGainLossPercent,
			),
			volatilityLevel: getVolatilityLevel(analytics.riskMetrics.volatility),
			sharpeRating: getSharpeRating(analytics.riskMetrics.sharpeRatio),
		};
	}, [analytics]);

	// Monitor data staleness
	useEffect(() => {
		if (!analytics) return;

		const cached = analyticsCache.get(portfolioId);
		if (cached) {
			const age = Date.now() - cached.timestamp;
			const staleThreshold = cacheTimeout * 0.8; // Consider stale at 80% of cache timeout
			setIsStale(age > staleThreshold);
		}
	}, [analytics, portfolioId, cacheTimeout]);

	// Handle cache invalidation
	const invalidateCache = useCallback(() => {
		analyticsCache.delete(portfolioId);
		setIsStale(false);
	}, [portfolioId]);

	// Enhanced refetch function that clears cache
	const enhancedRefetch = useCallback(() => {
		invalidateCache();
		return refetch();
	}, [refetch, invalidateCache]);

	// Handle errors with retry logic
	const handleError = useCallback(
		(error: any) => {
			console.error("Portfolio analytics error:", error);

			// If we have cached data and there's a network error, use cached data
			if (cachedData && error?.networkError) {
				setIsStale(true);
				return null;
			}

			return error;
		},
		[cachedData],
	);

	const processedError = error ? handleError(error) : null;

	return {
		analytics: enhancedAnalytics,
		loading: loading && !cachedData,
		error: processedError,
		refetch: enhancedRefetch,
		isStale,
	};
}

// Utility functions for enhanced analytics calculations

function calculateDiversificationScore(assetAllocation: any[]): number {
	if (!assetAllocation || assetAllocation.length === 0) return 0;

	// Calculate Herfindahl-Hirschman Index (HHI) for concentration
	let hhi = 0;
	for (const allocation of assetAllocation) {
		const marketShare = allocation.percentage / 100;
		hhi += marketShare * marketShare;
	}

	// Convert HHI to diversification score (0-100)
	const maxHHI = 1.0;
	const minHHI = 1.0 / assetAllocation.length;

	if (maxHHI === minHHI) return 100;

	const diversificationScore = ((maxHHI - hhi) / (maxHHI - minHHI)) * 100;
	return Math.max(0, Math.min(100, diversificationScore));
}

function calculateRiskLevel(riskMetrics: any): "Low" | "Medium" | "High" {
	const { volatility, maxDrawdown } = riskMetrics;

	// Combine volatility and max drawdown to determine risk level
	const riskScore = volatility * 0.6 + Math.abs(maxDrawdown) * 0.4;

	if (riskScore < 0.15) return "Low";
	if (riskScore < 0.25) return "Medium";
	return "High";
}

function calculatePerformanceGrade(
	totalGainLossPercent: number,
): "A" | "B" | "C" | "D" | "F" {
	if (totalGainLossPercent >= 20) return "A";
	if (totalGainLossPercent >= 10) return "B";
	if (totalGainLossPercent >= 0) return "C";
	if (totalGainLossPercent >= -10) return "D";
	return "F";
}

function getVolatilityLevel(
	volatility: number,
): "Very Low" | "Low" | "Medium" | "High" | "Very High" {
	if (volatility < 0.1) return "Very Low";
	if (volatility < 0.15) return "Low";
	if (volatility < 0.25) return "Medium";
	if (volatility < 0.35) return "High";
	return "Very High";
}

function getSharpeRating(
	sharpeRatio: number,
): "Excellent" | "Good" | "Fair" | "Poor" {
	if (sharpeRatio >= 2.0) return "Excellent";
	if (sharpeRatio >= 1.0) return "Good";
	if (sharpeRatio >= 0.5) return "Fair";
	return "Poor";
}

// Hook for multiple portfolios analytics comparison
export function useMultiplePortfolioAnalytics(portfolioIds: string[]) {
	const [results, setResults] = useState<
		Record<string, UsePortfolioAnalyticsReturn>
	>({});

	useEffect(() => {
		const newResults: Record<string, UsePortfolioAnalyticsReturn> = {};

		portfolioIds.forEach((id) => {
			// This would need to be implemented differently in a real app
			// For now, we'll just return empty results
			newResults[id] = {
				analytics: null,
				loading: false,
				error: null,
				refetch: () => {},
				isStale: false,
			};
		});

		setResults(newResults);
	}, [portfolioIds]);

	return results;
}

// Hook for real-time analytics updates
export function useRealTimePortfolioAnalytics(portfolioId: string) {
	const baseAnalytics = usePortfolioAnalytics({
		portfolioId,
		pollInterval: 60000, // 1 minute for real-time
	});

	const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

	useEffect(() => {
		if (baseAnalytics.analytics) {
			setLastUpdate(new Date());
		}
	}, [baseAnalytics.analytics]);

	return {
		...baseAnalytics,
		lastUpdate,
		isRealTime: true,
	};
}

// Cache management utilities
export const analyticsCache_utils = {
	clear: () => analyticsCache.clear(),
	delete: (portfolioId: string) => analyticsCache.delete(portfolioId),
	size: () => analyticsCache.size,
	has: (portfolioId: string) => analyticsCache.has(portfolioId),
};
