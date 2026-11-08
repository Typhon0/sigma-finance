import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Portfolio } from "@/gql/graphql";
import type { Asset } from "@/hooks/use-dashboard-state";
import { DashboardBreadcrumb } from "../dashboard-breadcrumb";
import { InlineAssetDetail } from "../inline-asset-detail";

// Mock the chart components to avoid canvas issues
vi.mock("@/components/charts/EChart", () => ({
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

	describe("Accessibility", () => {
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
