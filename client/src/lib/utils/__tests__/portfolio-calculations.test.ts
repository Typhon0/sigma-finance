import { describe, expect, it } from "vitest";
import type {
	Asset,
	AssetType,
	Portfolio,
	PortfolioAsset as Position,
} from "@/gql/graphql";
import {
	calculateAssetAllocation,
	calculateAssetPerformance,
	calculateIndividualPortfolioMetrics,
	calculatePortfolioAllocation,
	calculatePortfolioMetrics,
	calculatePositionCost,
	calculatePositionValue,
	formatCurrency,
	formatPercentage,
	getPerformanceColorClass,
	getTopPerformingAssets,
	getWorstPerformingAssets,
} from "../portfolio-calculations";

// Mock data for testing
const mockAssetType: AssetType = {
	id: "1",
	name: "STOCK",
};

const mockAsset: Asset = {
	id: "1",
	name: "Apple Inc.",
	symbol: "AAPL",
	currentValue: 150,
	purchasePrice: 100,
	assetType: mockAssetType,
};

const mockPosition: Position = {
	id: "1",
	quantity: 10,
	averagePurchasePrice: 100,
	ownershipPct: 100,
	asset: mockAsset,
	portfolio: {} as Portfolio,
};

const mockPortfolio: Portfolio = {
	id: "1",
	name: "Tech Portfolio",
	assets: [mockPosition],
};

describe("Portfolio Calculations", () => {
	describe("calculatePositionValue", () => {
		it("should calculate position value correctly", () => {
			const result = calculatePositionValue(mockPosition);
			expect(result).toBe(1500); // 150 * 10 * 100/100
		});

		it("should handle partial ownership", () => {
			const partialPosition = { ...mockPosition, ownershipPct: 50 };
			const result = calculatePositionValue(partialPosition);
			expect(result).toBe(750); // 150 * 10 * 50/100
		});

		it("should handle zero values", () => {
			const zeroPosition = { ...mockPosition, quantity: 0 };
			const result = calculatePositionValue(zeroPosition);
			expect(result).toBe(0);
		});
	});

	describe("calculatePositionCost", () => {
		it("should calculate position cost correctly", () => {
			const result = calculatePositionCost(mockPosition);
			expect(result).toBe(1000); // 100 * 10 * 100/100
		});

		it("should handle partial ownership", () => {
			const partialPosition = { ...mockPosition, ownershipPct: 50 };
			const result = calculatePositionCost(partialPosition);
			expect(result).toBe(500); // 100 * 10 * 50/100
		});
	});

	describe("calculateIndividualPortfolioMetrics", () => {
		it("should calculate portfolio metrics correctly", () => {
			const result = calculateIndividualPortfolioMetrics(mockPortfolio);

			expect(result.totalValue).toBe(1500);
			expect(result.totalCost).toBe(1000);
			expect(result.totalGainLoss).toBe(500);
			expect(result.totalGainLossPercent).toBe(50);
		});

		it("should handle empty portfolio", () => {
			const emptyPortfolio: Portfolio = {
				id: "2",
				name: "Empty Portfolio",
				assets: [],
			};

			const result = calculateIndividualPortfolioMetrics(emptyPortfolio);

			expect(result.totalValue).toBe(0);
			expect(result.totalCost).toBe(0);
			expect(result.totalGainLoss).toBe(0);
			expect(result.totalGainLossPercent).toBe(0);
		});
	});

	describe("calculatePortfolioMetrics", () => {
		it("should calculate total metrics across multiple portfolios", () => {
			const portfolios = [mockPortfolio, mockPortfolio]; // Two identical portfolios
			const result = calculatePortfolioMetrics(portfolios);

			expect(result.totalValue).toBe(3000); // 1500 * 2
			expect(result.totalCost).toBe(2000); // 1000 * 2
			expect(result.totalGainLoss).toBe(1000); // 500 * 2
			expect(result.totalGainLossPercent).toBe(50);
		});

		it("should handle empty portfolios array", () => {
			const result = calculatePortfolioMetrics([]);

			expect(result.totalValue).toBe(0);
			expect(result.totalCost).toBe(0);
			expect(result.totalGainLoss).toBe(0);
			expect(result.totalGainLossPercent).toBe(0);
		});
	});

	describe("calculateAssetPerformance", () => {
		it("should calculate asset performance correctly", () => {
			const result = calculateAssetPerformance([mockPortfolio]);

			expect(result).toHaveLength(1);
			expect(result[0].asset.id).toBe("1");
			expect(result[0].currentValue).toBe(1500);
			expect(result[0].changeAmount).toBe(500);
			expect(result[0].changePercent).toBe(50);
		});

		it("should aggregate multiple positions of same asset", () => {
			const secondPosition: Position = {
				...mockPosition,
				id: "2",
				quantity: 5,
			};

			const portfolioWithDuplicates: Portfolio = {
				id: "1",
				name: "Portfolio",
				assets: [mockPosition, secondPosition],
			};

			const result = calculateAssetPerformance([portfolioWithDuplicates]);

			expect(result).toHaveLength(1);
			expect(result[0].currentValue).toBe(2250); // (150*10) + (150*5)
			expect(result[0].positions).toHaveLength(2);
		});
	});

	describe("getTopPerformingAssets", () => {
		it("should return top performing assets sorted by percentage", () => {
			const performances = [
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: 50,
					changePercent: 50,
					positions: [],
				},
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: 20,
					changePercent: 20,
					positions: [],
				},
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: 80,
					changePercent: 80,
					positions: [],
				},
			];

			const result = getTopPerformingAssets(performances, 2);

			expect(result).toHaveLength(2);
			expect(result[0].changePercent).toBe(80);
			expect(result[1].changePercent).toBe(50);
		});

		it("should filter out negative performers", () => {
			const performances = [
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: 50,
					changePercent: 50,
					positions: [],
				},
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: -20,
					changePercent: -20,
					positions: [],
				},
			];

			const result = getTopPerformingAssets(performances);

			expect(result).toHaveLength(1);
			expect(result[0].changePercent).toBe(50);
		});
	});

	describe("getWorstPerformingAssets", () => {
		it("should return worst performing assets sorted by percentage", () => {
			const performances = [
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: -50,
					changePercent: -50,
					positions: [],
				},
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: -20,
					changePercent: -20,
					positions: [],
				},
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: -80,
					changePercent: -80,
					positions: [],
				},
			];

			const result = getWorstPerformingAssets(performances, 2);

			expect(result).toHaveLength(2);
			expect(result[0].changePercent).toBe(-80);
			expect(result[1].changePercent).toBe(-50);
		});

		it("should filter out positive performers", () => {
			const performances = [
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: -50,
					changePercent: -50,
					positions: [],
				},
				{
					asset: mockAsset,
					currentValue: 100,
					changeAmount: 20,
					changePercent: 20,
					positions: [],
				},
			];

			const result = getWorstPerformingAssets(performances);

			expect(result).toHaveLength(1);
			expect(result[0].changePercent).toBe(-50);
		});
	});

	describe("calculateAssetAllocation", () => {
		it("should calculate asset allocation by type", () => {
			const cryptoAssetType: AssetType = { id: "2", name: "CRYPTO" };
			const cryptoAsset: Asset = {
				...mockAsset,
				id: "2",
				name: "Bitcoin",
				assetType: cryptoAssetType,
			};

			const cryptoPosition: Position = {
				...mockPosition,
				id: "2",
				asset: cryptoAsset,
				quantity: 1,
				averagePurchasePrice: 30000,
			};

			const diversifiedPortfolio: Portfolio = {
				id: "1",
				name: "Diversified",
				assets: [mockPosition, cryptoPosition],
			};

			const result = calculateAssetAllocation([diversifiedPortfolio]);

			expect(result).toHaveLength(2);

			const stockAllocation = result.find((a) => a.assetType === "STOCK");
			const cryptoAllocation = result.find((a) => a.assetType === "CRYPTO");

			expect(stockAllocation?.value).toBe(1500);
			expect(cryptoAllocation?.value).toBe(150); // 150 * 1
			expect(stockAllocation?.percentage).toBeCloseTo(90.91, 1);
			expect(cryptoAllocation?.percentage).toBeCloseTo(9.09, 1);
		});
	});

	describe("calculatePortfolioAllocation", () => {
		it("should calculate portfolio allocation percentages", () => {
			const secondPortfolio: Portfolio = {
				id: "2",
				name: "Second Portfolio",
				assets: [{ ...mockPosition, id: "2", quantity: 5 }],
			};

			const result = calculatePortfolioAllocation([
				mockPortfolio,
				secondPortfolio,
			]);

			expect(result).toHaveLength(2);
			expect(result[0].value).toBe(1500);
			expect(result[1].value).toBe(750);
			expect(result[0].percentage).toBeCloseTo(66.67, 1);
			expect(result[1].percentage).toBeCloseTo(33.33, 1);
		});
	});

	describe("formatCurrency", () => {
		it("should format currency correctly", () => {
			expect(formatCurrency(1234.56)).toBe("$1,234.56");
			expect(formatCurrency(0)).toBe("$0.00");
			expect(formatCurrency(-500.25)).toBe("-$500.25");
		});
	});

	describe("formatPercentage", () => {
		it("should format percentage correctly", () => {
			expect(formatPercentage(25.5)).toBe("+25.50%");
			expect(formatPercentage(-10.25)).toBe("-10.25%");
			expect(formatPercentage(0)).toBe("+0.00%");
		});

		it("should respect decimal places", () => {
			expect(formatPercentage(25.555, 1)).toBe("+25.6%");
			expect(formatPercentage(25.555, 3)).toBe("+25.555%");
		});
	});

	describe("getPerformanceColorClass", () => {
		it("should return correct color classes", () => {
			expect(getPerformanceColorClass(10)).toBe("text-green-600");
			expect(getPerformanceColorClass(-10)).toBe("text-red-600");
			expect(getPerformanceColorClass(0)).toBe("text-gray-600");
		});
	});
});
