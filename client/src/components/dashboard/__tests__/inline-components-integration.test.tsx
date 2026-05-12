import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Portfolio } from "@/gql/graphql";
import type { Asset } from "@/hooks/use-dashboard-state";
import { DashboardBreadcrumb } from "../dashboard-breadcrumb";
import { InlineAssetDetail } from "../inline-asset-detail";
import { InlinePortfolioDetail } from "../inline-portfolio-detail";

// Mock the chart components to avoid canvas issues
vi.mock("echarts-for-react", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	default: function MockReactECharts({ style }: { style: any }) {
		return <div data-testid="mock-chart" style={style} />;
	},
}));

// Mock the lightweight charts
vi.mock("lightweight-charts", () => ({
	createChart: vi.fn(() => ({
		addAreaSeries: vi.fn(() => ({
			setData: vi.fn(),
		})),
		timeScale: vi.fn(() => ({
			fitContent: vi.fn(),
		})),
		remove: vi.fn(),
	})),
}));

// Mock data
const mockPortfolio: Portfolio = {
	id: "portfolio-1",
	name: "Test Portfolio",
	description: "A comprehensive test portfolio",
	assets: [
		{
			asset: {
				id: "asset-1",
				name: "Apple Inc.",
				symbol: "AAPL",
				type: "STOCK",
			},
			quantity: 100,
			averagePurchasePrice: 150.0,
			currentPrice: 175.0,
			totalValue: 17500.0,
			unrealizedGain: 2500.0,
			unrealizedGainPercent: 16.67,
		},
		{
			asset: {
				id: "asset-2",
				name: "Bitcoin",
				symbol: "BTC",
				type: "CRYPTO",
			},
			quantity: 0.5,
			averagePurchasePrice: 45000.0,
			currentPrice: 50000.0,
			totalValue: 25000.0,
			unrealizedGain: 2500.0,
			unrealizedGainPercent: 11.11,
		},
		{
			asset: {
				id: "asset-3",
				name: "Tesla Inc.",
				symbol: "TSLA",
				type: "STOCK",
			},
			quantity: 50,
			averagePurchasePrice: 200.0,
			currentPrice: 180.0,
			totalValue: 9000.0,
			unrealizedGain: -1000.0,
			unrealizedGainPercent: -10.0,
		},
	],
};

const mockAsset: Asset = {
	id: "asset-1",
	name: "Apple Inc.",
	symbol: "AAPL",
	type: "STOCK",
};

const mockAssetWithMetrics = {
	...mockAsset,
	currentPrice: 175.0,
	priceChange: 5.25,
	priceChangePercent: 3.09,
	volume: 45000000,
	marketCap: 2800000000000,
	dayHigh: 178.5,
	dayLow: 172.3,
	yearHigh: 198.23,
	yearLow: 124.17,
};

describe("Inline Components Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("InlinePortfolioDetail Component", () => {
		it("should render portfolio information correctly", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			expect(screen.getByText("Test Portfolio")).toBeInTheDocument();
			expect(screen.getByText("A comprehensive test portfolio")).toBeInTheDocument();
			expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
		});

		it("should display portfolio assets with correct data", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			// Check for asset names and symbols
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("AAPL")).toBeInTheDocument();
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
			expect(screen.getByText("BTC")).toBeInTheDocument();
			expect(screen.getByText("Tesla Inc.")).toBeInTheDocument();
			expect(screen.getByText("TSLA")).toBeInTheDocument();

			// Check for asset types
			expect(screen.getAllByText("STOCK")).toHaveLength(2);
			expect(screen.getByText("CRYPTO")).toBeInTheDocument();
		});

		it("should display portfolio metrics and performance", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			// Check for portfolio value calculations
			expect(screen.getByText("$51,500.00")).toBeInTheDocument(); // Total value
			expect(screen.getByText("$4,000.00")).toBeInTheDocument(); // Total gain
			expect(screen.getByText("+8.41%")).toBeInTheDocument(); // Total gain percentage

			// Check for individual asset values
			expect(screen.getByText("$17,500.00")).toBeInTheDocument(); // AAPL value
			expect(screen.getByText("$25,000.00")).toBeInTheDocument(); // BTC value
			expect(screen.getByText("$9,000.00")).toBeInTheDocument(); // TSLA value
		});

		it("should handle asset selection correctly", async () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			// Click on Apple asset
			const appleAsset = screen.getByText("Apple Inc.");
			fireEvent.click(appleAsset);

			await waitFor(() => {
				expect(mockOnAssetSelect).toHaveBeenCalledWith(
					expect.objectContaining({
						id: "asset-1",
						name: "Apple Inc.",
						symbol: "AAPL",
						type: "STOCK",
					}),
				);
			});
		});

		it("should handle back navigation correctly", async () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			const backButton = screen.getByText("Back to Dashboard");
			fireEvent.click(backButton);

			await waitFor(() => {
				expect(mockOnBack).toHaveBeenCalled();
			});
		});

		it("should render portfolio allocation chart", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
			expect(screen.getByText("Asset Allocation")).toBeInTheDocument();
		});

		it("should handle empty portfolio gracefully", () => {
			const emptyPortfolio = {
				...mockPortfolio,
				assets: [],
			};

			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={emptyPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			expect(screen.getByText("No assets in this portfolio")).toBeInTheDocument();
			expect(screen.getByText("Add your first asset to get started")).toBeInTheDocument();
		});

		it("should display correct gain/loss indicators", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			// Check for positive gains (green indicators)
			const positiveGains = screen.getAllByText(/\+/);
			expect(positiveGains.length).toBeGreaterThan(0);

			// Check for negative gains (red indicators)
			const negativeGains = screen.getAllByText(/-10\.00%/);
			expect(negativeGains).toHaveLength(1);
		});
	});

	describe("InlineAssetDetail Component", () => {
		it("should render asset information correctly", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("AAPL")).toBeInTheDocument();
			expect(screen.getByText("STOCK")).toBeInTheDocument();
			expect(screen.getByText("Back to Test Portfolio")).toBeInTheDocument();
		});

		it("should display asset metrics correctly", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			// Check for price information
			expect(screen.getByText("$175.00")).toBeInTheDocument(); // Current price
			expect(screen.getByText("+$5.25")).toBeInTheDocument(); // Price change
			expect(screen.getByText("+3.09%")).toBeInTheDocument(); // Price change percent

			// Check for market data
			expect(screen.getByText("45,000,000")).toBeInTheDocument(); // Volume
			expect(screen.getByText("$2.80T")).toBeInTheDocument(); // Market cap
			expect(screen.getByText("$178.50")).toBeInTheDocument(); // Day high
			expect(screen.getByText("$172.30")).toBeInTheDocument(); // Day low
		});

		it("should display position information from portfolio context", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			// Check for position data
			expect(screen.getByText("100")).toBeInTheDocument(); // Quantity
			expect(screen.getByText("$150.00")).toBeInTheDocument(); // Average purchase price
			expect(screen.getByText("$17,500.00")).toBeInTheDocument(); // Position value
			expect(screen.getByText("$2,500.00")).toBeInTheDocument(); // Unrealized gain
			expect(screen.getByText("+16.67%")).toBeInTheDocument(); // Unrealized gain percent
		});

		it("should handle back navigation correctly", async () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			const backButton = screen.getByText("Back to Test Portfolio");
			fireEvent.click(backButton);

			await waitFor(() => {
				expect(mockOnBack).toHaveBeenCalled();
			});
		});

		it("should render asset price chart", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
			expect(screen.getByText("Price History")).toBeInTheDocument();
		});

		it("should display asset-specific information based on type", () => {
			const cryptoAsset = {
				id: "asset-2",
				name: "Bitcoin",
				symbol: "BTC",
				type: "CRYPTO" as const,
				currentPrice: 50000.0,
				priceChange: 1500.0,
				priceChangePercent: 3.09,
				volume: 25000000000,
				marketCap: 980000000000,
				dayHigh: 51200.0,
				dayLow: 48800.0,
				yearHigh: 73800.0,
				yearLow: 15500.0,
			};

			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail asset={cryptoAsset} portfolio={mockPortfolio} onBack={mockOnBack} />,
			);

			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
			expect(screen.getByText("BTC")).toBeInTheDocument();
			expect(screen.getByText("CRYPTO")).toBeInTheDocument();
			expect(screen.getByText("$50,000.00")).toBeInTheDocument();
		});

		it("should handle asset without portfolio context", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail asset={mockAssetWithMetrics} portfolio={null} onBack={mockOnBack} />,
			);

			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
			expect(screen.queryByText("Position Value")).not.toBeInTheDocument();
		});
	});

	describe("Component Integration with Dashboard State", () => {
		it("should integrate portfolio and asset detail views seamlessly", async () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			const { rerender } = render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			// Verify portfolio view is rendered
			expect(screen.getByText("Test Portfolio")).toBeInTheDocument();

			// Click on an asset
			const appleAsset = screen.getByText("Apple Inc.");
			fireEvent.click(appleAsset);

			await waitFor(() => {
				expect(mockOnAssetSelect).toHaveBeenCalled();
			});

			// Simulate transition to asset detail view
			rerender(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			// Verify asset view is rendered
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("Back to Test Portfolio")).toBeInTheDocument();
		});

		it("should maintain consistent breadcrumb navigation", () => {
			const breadcrumbItems = [
				{ title: "Dashboard", onClick: vi.fn() },
				{ title: "Test Portfolio", onClick: vi.fn() },
				{ title: "Apple Inc." },
			];

			render(<DashboardBreadcrumb items={breadcrumbItems} />);

			expect(screen.getByText("Dashboard")).toBeInTheDocument();
			expect(screen.getByText("Test Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();

			// Test navigation callbacks
			fireEvent.click(screen.getByText("Dashboard"));
			expect(breadcrumbItems[0].onClick).toHaveBeenCalled();

			fireEvent.click(screen.getByText("Test Portfolio"));
			expect(breadcrumbItems[1].onClick).toHaveBeenCalled();
		});

		it("should handle loading states during transitions", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					loading={true}
				/>,
			);

			expect(screen.getByText("Loading asset data...")).toBeInTheDocument();
		});

		it("should handle error states gracefully", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					error="Failed to load asset data"
				/>,
			);

			expect(screen.getByText("Error loading asset")).toBeInTheDocument();
			expect(screen.getByText("Failed to load asset data")).toBeInTheDocument();
		});
	});

	describe("Responsive Behavior", () => {
		it("should adapt layout for mobile screens", () => {
			// Mock mobile viewport
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 375,
			});

			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			// Check for mobile-specific classes or behavior
			const container = screen.getByText("Test Portfolio").closest("div");
			expect(container).toHaveClass("mobile-layout");
		});

		it("should handle touch interactions on mobile", async () => {
			const mockOnAssetSelect = vi.fn();
			const mockOnBack = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			const assetElement = screen.getByText("Apple Inc.");

			// Simulate touch events
			fireEvent.touchStart(assetElement);
			fireEvent.touchEnd(assetElement);

			await waitFor(() => {
				expect(mockOnAssetSelect).toHaveBeenCalled();
			});
		});
	});

	describe("Accessibility", () => {
		it("should provide proper ARIA labels and roles", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			expect(screen.getByRole("button", { name: /back to dashboard/i })).toBeInTheDocument();
			expect(screen.getByRole("list")).toBeInTheDocument(); // Asset list
			expect(screen.getAllByRole("listitem")).toHaveLength(3); // Three assets
		});

		it("should support keyboard navigation", async () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			const backButton = screen.getByRole("button", {
				name: /back to dashboard/i,
			});

			// Test keyboard navigation
			fireEvent.keyDown(backButton, { key: "Enter" });
			await waitFor(() => {
				expect(mockOnBack).toHaveBeenCalled();
			});
		});

		it("should announce state changes to screen readers", () => {
			const mockOnBack = vi.fn();

			render(
				<InlineAssetDetail
					asset={mockAssetWithMetrics}
					portfolio={mockPortfolio}
					onBack={mockOnBack}
				/>,
			);

			expect(screen.getByRole("status")).toBeInTheDocument();
			expect(screen.getByText(/viewing apple inc\. details/i)).toBeInTheDocument();
		});
	});
});
