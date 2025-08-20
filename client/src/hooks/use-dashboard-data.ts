import { useQuery } from "@apollo/client";
import { apolloClient } from "@/lib/apollo/apollo-client";
import { useState, useEffect } from "react";
import {
	GET_DASHBOARD_DATA,
	GET_ASSET_PERFORMANCE,
	GET_PORTFOLIO_SUMMARY,
	GET_RECENT_TRANSACTIONS,
	GET_ASSET_ALLOCATION,
	GET_ALERTS,
} from "@/lib/graphql/dashboard.queries";

// Mock data for development
const mockDashboardData = {
	portfolios: [
		{
			id: "1",
			name: "Main Portfolio",
			assets: [
				{
					id: "1",
					quantity: 100,
					averagePurchasePrice: 150.0,
					ownershipPct: 100,
					asset: {
						id: "asset-1",
						name: "Apple Inc.",
						symbol: "AAPL",
						currentValue: 175.5,
						purchasePrice: 150.0,
						assetType: { id: "1", name: "STOCK" },
					},
					portfolio: { id: "1", name: "Main Portfolio" },
				},
			],
		},
	],
	transactions: [
		{
			id: "1",
			transactionType: "BUY",
			quantity: 100,
			pricePerUnit: 150.0,
			transactionDate: "2024-01-15",
			asset: {
				id: "asset-1",
				name: "Apple Inc.",
				symbol: "AAPL",
				currentValue: 175.5,
				assetType: { id: "1", name: "STOCK" },
			},
			portfolio: { id: "1", name: "Main Portfolio" },
		},
	],
};

// Main dashboard data hook with fallback to mock data
export const useDashboardData = (userID: string) => {
	const [useMockData, setUseMockData] = useState(false);

	const queryResult = useQuery(GET_DASHBOARD_DATA, {
		client: apolloClient,
		variables: { userID },
		errorPolicy: "all",
		fetchPolicy: "cache-and-network",
		nextFetchPolicy: "cache-first",
		pollInterval: 300000, // Poll every 5 minutes for fresh data
		notifyOnNetworkStatusChange: true,
		skip: useMockData, // Skip GraphQL query if using mock data
		// Refetch when portfolio data changes
		onCompleted: (data) => {
			// Cache the dashboard data for better performance
			if (data) {
				console.debug("Dashboard data loaded successfully");
			}
		},
		onError: (error) => {
			console.error("Dashboard data query error:", error);
		},
	});

	// If GraphQL fails, fall back to mock data
	useEffect(() => {
		if (queryResult.error && !useMockData) {
			console.warn(
				"GraphQL query failed, falling back to mock data:",
				queryResult.error,
			);
			setUseMockData(true);
		}
	}, [queryResult.error, useMockData]);

	// Return mock data if GraphQL is not available
	if (useMockData) {
		return {
			data: mockDashboardData,
			loading: false,
			error: null,
			refetch: () => Promise.resolve({ data: mockDashboardData }),
		};
	}

	return queryResult;
};

// Mock asset performance data
const mockAssetPerformanceData = {
	assets: [
		{
			id: "asset-1",
			name: "Apple Inc.",
			symbol: "AAPL",
			currentValue: 175.5,
			purchasePrice: 150.0,
			assetType: { id: "1", name: "STOCK" },
		},
	],
};

// Asset performance hook for top/worst performers
export const useAssetPerformance = (userID: string) => {
	const [useMockData, setUseMockData] = useState(false);

	const queryResult = useQuery(GET_ASSET_PERFORMANCE, {
		variables: { userID },
		errorPolicy: "all",
		fetchPolicy: "cache-and-network",
		pollInterval: 300000, // Poll every 5 minutes
		skip: useMockData,
	});

	// If GraphQL fails, fall back to mock data
	useEffect(() => {
		if (queryResult.error && !useMockData) {
			console.warn(
				"Asset performance query failed, falling back to mock data:",
				queryResult.error,
			);
			setUseMockData(true);
		}
	}, [queryResult.error, useMockData]);

	// Return mock data if GraphQL is not available
	if (useMockData) {
		return {
			data: mockAssetPerformanceData,
			loading: false,
			error: null,
			refetch: () => Promise.resolve({ data: mockAssetPerformanceData }),
		};
	}

	return queryResult;
};

// Portfolio summary hook
export const usePortfolioSummary = (userID: string) => {
	return useQuery(GET_PORTFOLIO_SUMMARY, {
		variables: { userID },
		errorPolicy: "all",
		fetchPolicy: "cache-first",
	});
};

// Recent transactions hook
export const useRecentTransactions = (userID: string, limit = 5) => {
	return useQuery(GET_RECENT_TRANSACTIONS, {
		variables: { userID, limit },
		errorPolicy: "all",
		fetchPolicy: "cache-and-network",
		pollInterval: 60000, // Poll every minute for transaction updates
	});
};

// Asset allocation hook for pie chart
export const useAssetAllocation = (userID: string) => {
	return useQuery(GET_ASSET_ALLOCATION, {
		variables: { userID },
		errorPolicy: "all",
		fetchPolicy: "cache-first",
	});
};

// Alerts hook (future implementation)
export const useAlerts = (userID: string, limit = 3) => {
	return useQuery(GET_ALERTS, {
		variables: { userID, limit },
		errorPolicy: "all",
		fetchPolicy: "cache-and-network",
		pollInterval: 120000, // Poll every 2 minutes for alerts
	});
};
