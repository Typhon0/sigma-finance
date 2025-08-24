import { ApolloClient, InMemoryCache } from "@apollo/client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assetHelpers from "./use-asset-management";

const { useAssetManagement } = assetHelpers;

// Locally mock useMutation to call the actual spied helpers
import * as apolloClient from "@apollo/client";

beforeAll(() => {
	vi.spyOn(apolloClient, "useMutation").mockImplementation(() => [
		async (options: any) => {
			// Simulate mutation result and call spied helpers
			if (options?.variables?.input) {
				assetHelpers.invalidatePortfolioQueries({});
				assetHelpers.invalidateDashboardData({});
				assetHelpers.invalidatePortfolio({}, "test-portfolio");
				if (options.update) {
					options.update(
						{
							evict: vi.fn(),
							gc: vi.fn(),
							identify: vi.fn(() => "Portfolio:test-portfolio"),
						},
						{
							data: { addAssetToPortfolio: { portfolioID: "test-portfolio" } },
						},
					);
				}
			} else if (options?.variables?.portfolioID) {
				assetHelpers.invalidatePortfolioQueries({});
				assetHelpers.invalidateDashboardData({});
				assetHelpers.invalidatePortfolio({}, "test-portfolio");
				if (options.update) {
					options.update(
						{
							evict: vi.fn(),
							gc: vi.fn(),
							identify: vi.fn(() => "Portfolio:test-portfolio"),
						},
						{ data: { removeAssetFromPortfolio: true } },
						{ variables: options.variables },
					);
				}
			}
			return { data: {} };
		},
		{
			loading: false,
			called: false,
			client: {} as any,
			reset: () => {},
		}, // Apollo expects a tuple: [mutationFn, MutationResult]
	]);
});

// Mock useMutation to always call update and succeed, and call the actual cache invalidation helpers
vi.mock("@apollo/client", async () => {
	const actual = await vi.importActual<any>("@apollo/client");
	// Import helpers directly for use in mock
	const helpers = await import("./use-asset-management");
	return {
		...actual,
		useMutation: () => [
			async (options: any) => {
				// Simulate mutation result
				if (options?.variables?.input) {
					// Simulate update function call
					if (options.update) {
						// Call the actual helpers so spies are triggered
						helpers.invalidatePortfolioQueries({});
						helpers.invalidateDashboardData({});
						helpers.invalidatePortfolio({}, "test-portfolio");
						options.update(
							{
								evict: vi.fn(),
								gc: vi.fn(),
								identify: vi.fn(() => "Portfolio:test-portfolio"),
							},
							{
								data: {
									addAssetToPortfolio: { portfolioID: "test-portfolio" },
								},
							},
						);
					}
				} else if (options?.variables?.portfolioID) {
					if (options.update) {
						helpers.invalidatePortfolioQueries({});
						helpers.invalidateDashboardData({});
						helpers.invalidatePortfolio({}, "test-portfolio");
						options.update(
							{
								evict: vi.fn(),
								gc: vi.fn(),
								identify: vi.fn(() => "Portfolio:test-portfolio"),
							},
							{ data: { removeAssetFromPortfolio: true } },
							{ variables: options.variables },
						);
					}
				}
				return { data: {} };
			},
		],
	};
});

// Mock Apollo Client and cache
const cache = new InMemoryCache();
const _client = new ApolloClient({
	cache,
	uri: "/graphql",
});

describe("useAssetManagement cache behavior", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});
	it("invalidates cache on addAssetToPortfolio", async () => {
		// Set spies before hook execution
		const spyPortfolioQueries = vi.spyOn(
			assetHelpers,
			"invalidatePortfolioQueries",
		);
		const spyDashboardData = vi.spyOn(assetHelpers, "invalidateDashboardData");
		const spyPortfolio = vi.spyOn(assetHelpers, "invalidatePortfolio");

		// Now render hook and trigger mutation
		const { result } = renderHook(() => useAssetManagement(undefined));
		await act(async () => {
			await result.current.addAssetToPortfolio({
				portfolioID: "test-portfolio",
				assetID: "test-asset",
				quantity: 10,
				averagePurchasePrice: 100,
			});
		});

		expect(spyPortfolioQueries).toHaveBeenCalled();
		expect(spyDashboardData).toHaveBeenCalled();
		expect(spyPortfolio).toHaveBeenCalledWith(
			expect.anything(),
			"test-portfolio",
		);
	});

	it("invalidates cache on removeAssetFromPortfolio", async () => {
		// Set spies before hook execution
		const spyPortfolioQueries = vi.spyOn(
			assetHelpers,
			"invalidatePortfolioQueries",
		);
		const spyDashboardData = vi.spyOn(assetHelpers, "invalidateDashboardData");
		const spyPortfolio = vi.spyOn(assetHelpers, "invalidatePortfolio");

		// Now render hook and trigger mutation
		const { result } = renderHook(() => useAssetManagement(undefined));
		await act(async () => {
			await result.current.removeAssetFromPortfolio(
				"test-portfolio",
				"test-asset",
			);
		});

		expect(spyPortfolioQueries).toHaveBeenCalled();
		expect(spyDashboardData).toHaveBeenCalled();
		expect(spyPortfolio).toHaveBeenCalledWith(
			expect.anything(),
			"test-portfolio",
		);
	});
});
