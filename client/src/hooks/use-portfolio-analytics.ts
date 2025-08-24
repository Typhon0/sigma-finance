import { useMemo } from "react";
import type { Portfolio as CodegenPortfolio, Transaction } from "@/gql/graphql";
import {
	type AssetAllocationData,
	type AssetPerformance,
	calculateAssetAllocation,
	calculateAssetPerformance,
	calculatePortfolioAllocation,
	calculatePortfolioMetrics,
	getTopPerformingAssets,
	getWorstPerformingAssets,
} from "@/lib/utils/portfolio-calculations";
import { useOptimizedDashboardData } from "./use-optimized-dashboard-data";

// Re-exporting the generated types with more specific names for clarity
export type Portfolio = CodegenPortfolio;

// Define the shape of the calculated data
export type CalculatedDashboardData = {
	portfolios: Readonly<Portfolio[]>;
	totalValue: number;
	totalChange: number;
	totalChangePercent: number;
	topPerformingAssets: AssetPerformance[];
	worstPerformingAssets: AssetPerformance[];
	recentTransactions: Readonly<Transaction[]>;
	assetAllocation: AssetAllocationData[];
	portfolioAllocation: Array<{
		portfolio: Portfolio;
		value: number;
		percentage: number;
	}>;
};

/**
 * A comprehensive hook for portfolio analytics.
 * It can be used for an overview of all portfolios or for a single portfolio.
 * @param userID - The ID of the user.
 * @param portfolioId - (Optional) The ID of a specific portfolio to analyze.
 */
export const usePortfolioAnalytics = (userID: string, portfolioId?: string) => {
	const {
		data: dashboardData,
		loading,
		error,
		refetch,
	} = useOptimizedDashboardData(userID);

	const calculatedData = useMemo(() => {
		if (!dashboardData) {
			return null;
		}

		const { portfolios } = dashboardData;
		const portfolioToAnalyze = portfolioId
			? portfolios.filter((p) => p.id === portfolioId)
			: portfolios;

		if (portfolioToAnalyze.length === 0 && portfolioId) {
			// Handle case where a specific portfolio is not found
			return null;
		}

		const metrics = calculatePortfolioMetrics(portfolioToAnalyze as any);
		const assetPerformances = calculateAssetPerformance(
			portfolioToAnalyze as any,
		);
		const assetAllocation = calculateAssetAllocation(portfolioToAnalyze as any);
		const portfolioAllocation = calculatePortfolioAllocation(portfolios as any);

		return {
			portfolios: portfolioToAnalyze,
			totalValue: metrics.totalValue,
			totalChange: metrics.totalGainLoss,
			totalChangePercent: metrics.totalGainLossPercent,
			topPerformingAssets: getTopPerformingAssets(assetPerformances),
			worstPerformingAssets: getWorstPerformingAssets(assetPerformances),
			recentTransactions: dashboardData.transactions,
			assetAllocation,
			portfolioAllocation,
		};
	}, [dashboardData, portfolioId]);

	return {
		data: calculatedData,
		loading,
		error,
		refetch,
	};
	return {
		data: calculatedData,
		loading,
		error,
	};
};
