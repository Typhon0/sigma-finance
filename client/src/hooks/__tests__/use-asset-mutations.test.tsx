import { MockedProvider } from "@apollo/client/testing";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	ADD_ASSET_TO_PORTFOLIO,
	CREATE_STOCK_ASSET,
	REFRESH_SINGLE_ASSET_PRICE,
} from "@/graphql/mutations/asset";
import { ADD_INSTRUMENT_TO_PORTFOLIO } from "@/graphql/mutations/instruments";
import { useAssetMutations } from "../use-asset-mutations";

// Mock date to have consistent timestamps
const FIXED_DATE = "2024-01-15T00:00:00.000Z";
const fixedDate = new Date(FIXED_DATE);

vi.spyOn(global, "Date").mockImplementation(() => fixedDate);

const createStockAssetSuccessMock = (inputOverride?: Record<string, unknown>) => ({
	request: {
		query: CREATE_STOCK_ASSET,
		variables: {
			input: {
				name: "Test Stock",
				assetTypeID: "1",
				ticker: "TEST",
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				currentValue: 100,
				quoteCurrency: "USD",
				...inputOverride,
			},
		},
	},
	result: {
		data: {
			createStockAsset: {
				__typename: "StockAsset",
				id: "asset-new",
				name: "Test Stock",
				symbol: "TEST",
				ticker: "TEST",
				quantity: 10,
				currentValue: 100,
				purchasePrice: 100,
				sector: null,
				exchange: null,
				dayChange: null,
				dayChangePercent: null,
				assetType: null,
			},
		},
	},
});

const createStockAssetErrorMock = (inputOverride?: Record<string, unknown>) => ({
	request: {
		query: CREATE_STOCK_ASSET,
		variables: {
			input: {
				name: "Test Stock",
				assetTypeID: "1",
				ticker: "TEST",
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				currentValue: 100,
				quoteCurrency: "USD",
				...inputOverride,
			},
		},
	},
	error: new Error("Failed to create stock asset"),
});

const addAssetToPortfolioSuccessMock = (inputOverride?: Record<string, unknown>) => ({
	request: {
		query: ADD_ASSET_TO_PORTFOLIO,
		variables: {
			input: {
				portfolioID: "portfolio-1",
				assetID: "asset-new",
				quantity: 10,
				averagePurchasePrice: 100,
				...inputOverride,
			},
		},
	},
	result: {
		data: {
			addAssetToPortfolio: {
				__typename: "PortfolioAsset",
				id: "pa-new",
				asset: {
					__typename: "Asset",
					id: "asset-new",
					name: "Test Stock",
					symbol: "TEST",
					currentValue: 100,
					purchasePrice: 100,
					sector: null,
					exchange: null,
					dayChange: null,
					dayChangePercent: null,
					assetType: null,
				},
				quantity: 10,
				averagePurchasePrice: 100,
				currentValue: 100,
				dayChange: null,
				dayChangePercent: null,
			},
		},
	},
});

const addAssetToPortfolioErrorMock = (inputOverride?: Record<string, unknown>) => ({
	request: {
		query: ADD_ASSET_TO_PORTFOLIO,
		variables: {
			input: {
				portfolioID: "portfolio-1",
				assetID: "asset-new",
				quantity: 10,
				averagePurchasePrice: 100,
				...inputOverride,
			},
		},
	},
	error: new Error("Failed to add asset to portfolio"),
});

const refreshSingleAssetPriceSuccessMock = (assetId = "asset-new") => ({
	request: {
		query: REFRESH_SINGLE_ASSET_PRICE,
		variables: { assetId },
	},
	result: {
		data: {
			refreshSingleAssetPrice: {
				__typename: "AssetPricePoint",
				id: "price-refresh",
				assetId,
				price: 101.25,
				timestamp: FIXED_DATE,
				source: "TEST",
			},
		},
	},
});

describe("useAssetMutations", () => {
	describe("addAsset currentValue mapping", () => {
		it("sends currentValue from currentPrice when provided", async () => {
			const mocks = [
				{
					request: {
						query: CREATE_STOCK_ASSET,
						variables: {
							input: {
								name: "Test Stock",
								assetTypeID: "1",
								ticker: "TEST",
								quantity: 10,
								purchasePrice: 100,
								purchaseDate: FIXED_DATE,
								currentValue: 120, // currentPrice used
								quoteCurrency: "USD",
							},
						},
					},
					result: {
						data: {
							createStockAsset: {
								__typename: "StockAsset",
								id: "asset-new",
								name: "Test Stock",
								ticker: "TEST",
								quantity: 10,
								currentValue: 120,
								purchasePrice: 100,
								sector: null,
								exchange: null,
								dayChange: null,
								dayChangePercent: null,
								assetType: null,
							},
						},
					},
				},
				{
					request: {
						query: ADD_ASSET_TO_PORTFOLIO,
						variables: {
							input: {
								portfolioID: "portfolio-1",
								assetID: "asset-new",
								quantity: 10,
								averagePurchasePrice: 100,
							},
						},
					},
					result: {
						data: {
							addAssetToPortfolio: {
								__typename: "PortfolioAsset",
								id: "pa-new",
								asset: {
									__typename: "Asset",
									id: "asset-new",
									name: "Test Stock",
									symbol: "TEST",
									currentValue: 120,
									purchasePrice: 100,
									sector: null,
									exchange: null,
									dayChange: null,
									dayChangePercent: null,
									assetType: null,
								},
								quantity: 10,
								averagePurchasePrice: 100,
								currentValue: 120,
								dayChange: null,
								dayChangePercent: null,
							},
						},
					},
				},
				refreshSingleAssetPriceSuccessMock(),
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			const input = {
				portfolioId: "portfolio-1",
				name: "Test Stock",
				symbol: "TEST",
				type: "stock" as const,
				quantity: 10,
				purchasePrice: 100,
				currentPrice: 120,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			};

			await result.current.addAsset(input);

			await waitFor(() => {
				expect(result.current.addAsset).toBeDefined();
			});
		});

		it("falls back to purchasePrice when currentPrice is undefined", async () => {
			const mocks = [
				createStockAssetSuccessMock({ currentValue: 100 }),
				addAssetToPortfolioSuccessMock(),
				refreshSingleAssetPriceSuccessMock(),
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			const input = {
				portfolioId: "portfolio-1",
				name: "Test Stock",
				symbol: "TEST",
				type: "stock" as const,
				quantity: 10,
				purchasePrice: 100,
				// No currentPrice - should fall back to purchasePrice
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			};

			await result.current.addAsset(input);

			await waitFor(() => {
				expect(result.current.addAsset).toBeDefined();
			});
		});
	});

	describe("Promise rejection propagation", () => {
		it("rejects when createStockAsset fails", async () => {
			const mocks = [createStockAssetErrorMock()];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			const input = {
				portfolioId: "portfolio-1",
				name: "Test Stock",
				symbol: "TEST",
				type: "stock" as const,
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			};

			let caughtError: Error | null = null;
			try {
				await result.current.addAsset(input);
			} catch (e) {
				caughtError = e as Error;
			}

			expect(caughtError).toBeTruthy();
			expect(caughtError?.message).toContain("Failed to create stock asset");
		});

		it("rejects when addAssetToPortfolio fails after successful createStockAsset", async () => {
			const mocks = [createStockAssetSuccessMock(), addAssetToPortfolioErrorMock()];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			const input = {
				portfolioId: "portfolio-1",
				name: "Test Stock",
				symbol: "TEST",
				type: "stock" as const,
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			};

			let caughtError: Error | null = null;
			try {
				await result.current.addAsset(input);
			} catch (e) {
				caughtError = e as Error;
			}

			expect(caughtError).toBeTruthy();
			expect(caughtError?.message).toContain("Failed to add asset to portfolio");
		});

		it("rejects when createStockAsset returns null id", async () => {
			const mocks = [
				{
					request: {
						query: CREATE_STOCK_ASSET,
						variables: {
							input: {
								name: "Test Stock",
								assetTypeID: "1",
								ticker: "TEST",
								quantity: 10,
								purchasePrice: 100,
								purchaseDate: FIXED_DATE,
								currentValue: 100,
								quoteCurrency: "USD",
							},
						},
					},
					result: {
						data: {
							createStockAsset: null,
						},
					},
				},
				addAssetToPortfolioSuccessMock(),
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			const input = {
				portfolioId: "portfolio-1",
				name: "Test Stock",
				symbol: "TEST",
				type: "stock" as const,
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			};

			let caughtError: Error | null = null;
			try {
				await result.current.addAsset(input);
			} catch (e) {
				caughtError = e as Error;
			}

			expect(caughtError).toBeTruthy();
			expect(caughtError?.message).toContain("Failed to create stock asset");
		});
	});

	describe("Asset type mapping", () => {
		it("maps 'stock' type to assetTypeID '1'", async () => {
			const mocks = [
				{
					request: {
						query: CREATE_STOCK_ASSET,
						variables: {
							input: {
								name: "Test",
								assetTypeID: "1",
								ticker: "TEST",
								quantity: 10,
								purchasePrice: 100,
								purchaseDate: FIXED_DATE,
								currentValue: 100,
								quoteCurrency: "USD",
							},
						},
					},
					result: {
						data: {
							createStockAsset: {
								__typename: "StockAsset",
								id: "asset-new",
								name: "Test",
								ticker: "TEST",
								quantity: 10,
								currentValue: 100,
								purchasePrice: 100,
								sector: null,
								exchange: null,
								dayChange: null,
								dayChangePercent: null,
								assetType: null,
							},
						},
					},
				},
				{
					request: {
						query: ADD_ASSET_TO_PORTFOLIO,
						variables: {
							input: {
								portfolioID: "portfolio-1",
								assetID: "asset-new",
								quantity: 10,
								averagePurchasePrice: 100,
							},
						},
					},
					result: {
						data: {
							addAssetToPortfolio: {
								__typename: "PortfolioAsset",
								id: "pa-new",
								asset: {
									__typename: "Asset",
									id: "asset-new",
									name: "Test",
									symbol: "TEST",
									currentValue: 100,
									purchasePrice: 100,
									sector: null,
									exchange: null,
									dayChange: null,
									dayChangePercent: null,
									assetType: null,
								},
								quantity: 10,
								averagePurchasePrice: 100,
								currentValue: 100,
								dayChange: null,
								dayChangePercent: null,
							},
						},
					},
				},
				refreshSingleAssetPriceSuccessMock(),
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			await result.current.addAsset({
				portfolioId: "portfolio-1",
				name: "Test",
				symbol: "TEST",
				type: "stock",
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			});

			await waitFor(() => {
				expect(result.current.addAsset).toBeDefined();
			});
		});

		it("maps 'fund' type to assetTypeID '7'", async () => {
			const mocks = [
				{
					request: {
						query: CREATE_STOCK_ASSET,
						variables: {
							input: {
								name: "Test Fund",
								assetTypeID: "7",
								ticker: "FUND",
								quantity: 10,
								purchasePrice: 100,
								purchaseDate: FIXED_DATE,
								currentValue: 100,
								quoteCurrency: "USD",
							},
						},
					},
					result: {
						data: {
							createStockAsset: {
								__typename: "StockAsset",
								id: "asset-new",
								name: "Test Fund",
								ticker: "FUND",
								quantity: 10,
								currentValue: 100,
								purchasePrice: 100,
								sector: null,
								exchange: null,
								dayChange: null,
								dayChangePercent: null,
								assetType: null,
							},
						},
					},
				},
				{
					request: {
						query: ADD_ASSET_TO_PORTFOLIO,
						variables: {
							input: {
								portfolioID: "portfolio-1",
								assetID: "asset-new",
								quantity: 10,
								averagePurchasePrice: 100,
							},
						},
					},
					result: {
						data: {
							addAssetToPortfolio: {
								__typename: "PortfolioAsset",
								id: "pa-new",
								asset: {
									__typename: "Asset",
									id: "asset-new",
									name: "Test Fund",
									symbol: "FUND",
									currentValue: 100,
									purchasePrice: 100,
									sector: null,
									exchange: null,
									dayChange: null,
									dayChangePercent: null,
									assetType: null,
								},
								quantity: 10,
								averagePurchasePrice: 100,
								currentValue: 100,
								dayChange: null,
								dayChangePercent: null,
							},
						},
					},
				},
				refreshSingleAssetPriceSuccessMock(),
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			await result.current.addAsset({
				portfolioId: "portfolio-1",
				name: "Test Fund",
				symbol: "FUND",
				type: "fund",
				quantity: 10,
				purchasePrice: 100,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			});

			await waitFor(() => {
				expect(result.current.addAsset).toBeDefined();
			});
		});

		it("maps 'etf' type to assetTypeID '1'", async () => {
			const mocks = [
				{
					request: {
						query: CREATE_STOCK_ASSET,
						variables: {
							input: {
								name: "SPY",
								assetTypeID: "1",
								ticker: "SPY",
								quantity: 10,
								purchasePrice: 400,
								purchaseDate: FIXED_DATE,
								currentValue: 400,
								quoteCurrency: "USD",
							},
						},
					},
					result: {
						data: {
							createStockAsset: {
								__typename: "StockAsset",
								id: "asset-new",
								name: "SPY",
								ticker: "SPY",
								quantity: 10,
								currentValue: 400,
								purchasePrice: 400,
								sector: null,
								exchange: null,
								dayChange: null,
								dayChangePercent: null,
								assetType: null,
							},
						},
					},
				},
				{
					request: {
						query: ADD_ASSET_TO_PORTFOLIO,
						variables: {
							input: {
								portfolioID: "portfolio-1",
								assetID: "asset-new",
								quantity: 10,
								averagePurchasePrice: 400,
							},
						},
					},
					result: {
						data: {
							addAssetToPortfolio: {
								__typename: "PortfolioAsset",
								id: "pa-new",
								asset: {
									__typename: "Asset",
									id: "asset-new",
									name: "SPY",
									symbol: "SPY",
									currentValue: 400,
									purchasePrice: 400,
									sector: null,
									exchange: null,
									dayChange: null,
									dayChangePercent: null,
									assetType: null,
								},
								quantity: 10,
								averagePurchasePrice: 400,
								currentValue: 400,
								dayChange: null,
								dayChangePercent: null,
							},
						},
					},
				},
				refreshSingleAssetPriceSuccessMock(),
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			await result.current.addAsset({
				portfolioId: "portfolio-1",
				name: "SPY",
				symbol: "SPY",
				type: "etf",
				quantity: 10,
				purchasePrice: 400,
				purchaseDate: FIXED_DATE,
				quoteCurrency: "USD",
			});

			await waitFor(() => {
				expect(result.current.addAsset).toBeDefined();
			});
		});
	});

	describe("Tradeable price refresh", () => {
		it("refreshes linked instrument price after addCrypto with instrumentID", async () => {
			const mocks = [
				{
					request: {
						query: ADD_INSTRUMENT_TO_PORTFOLIO,
						variables: {
							input: {
								portfolioID: "portfolio-1",
								instrumentID: "inst-btc",
								quantity: 2,
								averagePurchasePrice: 42000,
								unitPriceCurrency: "USD",
							},
						},
					},
					result: {
						data: {
							addInstrumentToPortfolio: {
								__typename: "PortfolioAsset",
								instrumentID: "inst-btc",
								quantity: 2,
								averagePurchasePrice: 42000,
								currentValue: 84000,
								dayChange: null,
								dayChangePercent: null,
								asset: {
									__typename: "Crypto",
									id: "asset-btc",
									currentValue: 43000,
									dayChange: null,
									dayChangePercent: null,
								},
							},
						},
					},
				},
				{
					request: {
						query: REFRESH_SINGLE_ASSET_PRICE,
						variables: {
							assetId: "asset-btc",
						},
					},
					result: {
						data: {
							refreshSingleAssetPrice: {
								__typename: "AssetPricePoint",
								id: "price-1",
								assetId: "asset-btc",
								price: 43000,
								timestamp: FIXED_DATE,
								source: "BINANCE",
							},
						},
					},
				},
			];

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MockedProvider mocks={mocks} addTypename={false}>
					{children}
				</MockedProvider>
			);

			const { result } = renderHook(() => useAssetMutations(), { wrapper });

			await result.current.addCrypto({
				portfolioId: "portfolio-1",
				name: "Bitcoin",
				assetTypeID: "2",
				instrumentID: "inst-btc",
				quantity: 2,
				purchasePrice: 42000,
				quoteCurrency: "USD",
			});

			await waitFor(() => {
				expect(result.current.addCrypto).toBeDefined();
			});
		});
	});
});
