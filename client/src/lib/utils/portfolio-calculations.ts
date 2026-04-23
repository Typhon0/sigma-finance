import type { Asset, Portfolio, PortfolioAsset } from "@/gql/graphql";

// Define more specific types for calculation results
export interface PortfolioMetrics {
	totalValue: number;
	totalCost: number;
	totalGainLoss: number;
	totalGainLossPercent: number;
}

export interface AssetPerformance {
	asset: Asset;
	currentValue: number;
	purchaseValue: number;
	changePercent: number;
	changeAmount: number;
	positions: PortfolioAsset[];
}

export interface AssetAllocationData {
	assetType: string;
	value: number;
	percentage: number;
	color: string;
}

/**
 * Calculates the total value and performance metrics for a list of portfolios.
 * @param portfolios - An array of Portfolio objects.
 * @returns An object containing totalValue, totalCost, totalGainLoss, and totalGainLossPercent.
 */
export function calculatePortfolioMetrics(portfolios: Readonly<Portfolio[]>): PortfolioMetrics {
	let totalValue = 0;
	let totalCost = 0;

	for (const portfolio of portfolios) {
		// Check if portfolio.assets exists and is an array
		if (portfolio.assets && Array.isArray(portfolio.assets)) {
			for (const position of portfolio.assets) {
				totalValue += calculatePositionValue(position);
				totalCost += calculatePositionCost(position);
			}
		}
	}

	const totalGainLoss = totalValue - totalCost;
	const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

	return {
		totalValue: Number.isNaN(totalValue) ? 0 : totalValue,
		totalCost: Number.isNaN(totalCost) ? 0 : totalCost,
		totalGainLoss: Number.isNaN(totalGainLoss) ? 0 : totalGainLoss,
		totalGainLossPercent: Number.isNaN(totalGainLossPercent) ? 0 : totalGainLossPercent,
	};
}

/**
 * Calculates the total value and performance metrics for a single portfolio.
 * @param portfolio - A single Portfolio object.
 * @returns An object containing totalValue, totalCost, totalGainLoss, and totalGainLossPercent.
 */
export function calculateIndividualPortfolioMetrics(portfolio: Portfolio): PortfolioMetrics {
	let totalValue = 0;
	let totalCost = 0;

	if (portfolio.assets && Array.isArray(portfolio.assets)) {
		for (const position of portfolio.assets) {
			totalValue += calculatePositionValue(position);
			totalCost += calculatePositionCost(position);
		}
	}

	const totalGainLoss = totalValue - totalCost;
	const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

	return {
		totalValue: Number.isNaN(totalValue) ? 0 : totalValue,
		totalCost: Number.isNaN(totalCost) ? 0 : totalCost,
		totalGainLoss: Number.isNaN(totalGainLoss) ? 0 : totalGainLoss,
		totalGainLossPercent: Number.isNaN(totalGainLossPercent) ? 0 : totalGainLossPercent,
	};
}

/**
 * Calculates the current market value of a single position.
 * @param position - A Position object.
 * @returns The current value of the position.
 */
export function calculatePositionValue(position: PortfolioAsset): number {
	const quantity = position.quantity ?? 0;
	const currentValue = position.asset?.currentValue ?? 0;
	const ownershipPct = position.ownershipPct ?? 100;
	const result = (quantity * currentValue * ownershipPct) / 100;
	return Number.isNaN(result) ? 0 : result;
}

/**
 * Calculates the original purchase cost of a single position.
 * @param position - A Position object.
 * @returns The original cost of the position.
 */
export function calculatePositionCost(position: PortfolioAsset): number {
	const quantity = position.quantity ?? 0;
	const purchasePrice = position.averagePurchasePrice ?? 0;
	const ownershipPct = position.ownershipPct ?? 100;
	const result = (quantity * purchasePrice * ownershipPct) / 100;
	return Number.isNaN(result) ? 0 : result;
}

/**
 * Calculates the performance of each individual asset across all portfolios.
 * @param portfolios - An array of Portfolio objects.
 * @returns An array of AssetPerformance objects.
 */
export function calculateAssetPerformance(portfolios: Readonly<Portfolio[]>): AssetPerformance[] {
	const assetMap = new Map<string, AssetPerformance>();

	for (const portfolio of portfolios) {
		// Check if portfolio.assets exists and is an array
		if (portfolio.assets && Array.isArray(portfolio.assets)) {
			for (const position of portfolio.assets) {
				const assetId = position.asset.id;
				const currentValue = calculatePositionValue(position);
				const purchaseValue = calculatePositionCost(position);
				const changeAmount = currentValue - purchaseValue;
				const changePercent = purchaseValue > 0 ? (changeAmount / purchaseValue) * 100 : 0;

				if (assetMap.has(assetId)) {
					const existing = assetMap.get(assetId)!;
					const totalCurrentValue = existing.currentValue + currentValue;
					const totalPurchaseValue = existing.purchaseValue + purchaseValue;
					const totalChangeAmount = totalCurrentValue - totalPurchaseValue;
					const totalChangePercent =
						totalPurchaseValue > 0 ? (totalChangeAmount / totalPurchaseValue) * 100 : 0;

					assetMap.set(assetId, {
						asset: position.asset,
						currentValue: totalCurrentValue,
						purchaseValue: totalPurchaseValue,
						changeAmount: totalChangeAmount,
						changePercent: totalChangePercent,
						positions: [...existing.positions, position],
					});
				} else {
					assetMap.set(assetId, {
						asset: position.asset,
						currentValue,
						purchaseValue,
						changeAmount,
						changePercent,
						positions: [position],
					});
				}
			}
		}
	}

	return Array.from(assetMap.values());
}

/**
 * Get top performing assets by percentage gain
 */
export function getTopPerformingAssets(
	assetPerformances: AssetPerformance[],
	limit = 3,
): AssetPerformance[] {
	return assetPerformances
		.filter((asset) => asset.changePercent > 0)
		.sort((a, b) => b.changePercent - a.changePercent)
		.slice(0, limit);
}

/**
 * Get worst performing assets by percentage loss
 */
export function getWorstPerformingAssets(
	assetPerformances: AssetPerformance[],
	limit = 3,
): AssetPerformance[] {
	return assetPerformances
		.filter((asset) => asset.changePercent < 0)
		.sort((a, b) => a.changePercent - b.changePercent)
		.slice(0, limit);
}

/**
 * Calculate asset allocation by asset type
 */
export function calculateAssetAllocation(portfolios: Readonly<Portfolio[]>): AssetAllocationData[] {
	const allocationMap = new Map<string, { value: number; color: string }>();
	let totalValue = 0;

	// Asset type colors for consistent visualization
	const assetTypeColors: Record<string, string> = {
		STOCK: "#10b981", // green
		CRYPTO: "#f59e0b", // amber
		BANK_ACCOUNT: "#3b82f6", // blue
		REAL_ESTATE: "#8b5cf6", // violet
		LIFE_INSURANCE: "#ef4444", // red
		WATCH: "#6b7280", // gray
		OTHER: "#64748b", // slate
	};

	portfolios.forEach((portfolio) => {
		// Check if portfolio.assets exists and is an array
		if (portfolio.assets && Array.isArray(portfolio.assets)) {
			portfolio.assets.forEach((position) => {
				const assetType = position.asset.assetType.name;
				const positionValue = calculatePositionValue(position);

				totalValue += positionValue;

				if (allocationMap.has(assetType)) {
					const existing = allocationMap.get(assetType)!;
					allocationMap.set(assetType, {
						value: existing.value + positionValue,
						color: existing.color,
					});
				} else {
					allocationMap.set(assetType, {
						value: positionValue,
						color: assetTypeColors[assetType] || assetTypeColors.OTHER,
					});
				}
			});
		}
	});

	return Array.from(allocationMap.entries()).map(([assetType, data]) => ({
		assetType,
		value: data.value,
		percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
		color: data.color,
	}));
}

/**
 * Calculate portfolio allocation percentages relative to total assets
 */
export function calculatePortfolioAllocation(portfolios: Readonly<Portfolio[]>): Array<{
	portfolio: Portfolio;
	value: number;
	percentage: number;
}> {
	const { totalValue } = calculatePortfolioMetrics(portfolios);

	return portfolios.map((portfolio) => {
		const portfolioMetrics = calculatePortfolioMetrics([portfolio]);
		return {
			portfolio,
			value: portfolioMetrics.totalValue,
			percentage: totalValue > 0 ? (portfolioMetrics.totalValue / totalValue) * 100 : 0,
		};
	});
}

/**
 * Utility function to format currency values
 */
export function formatCurrency(value: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

/**
 * Utility function to format percentage values
 */
export function formatPercentage(value: number, decimals = 2): string {
	return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/**
 * Utility function to determine performance color class
 */
export function getPerformanceColorClass(value: number): string {
	if (value > 0) return "text-green-600";
	if (value < 0) return "text-red-600";
	return "text-gray-600";
}
