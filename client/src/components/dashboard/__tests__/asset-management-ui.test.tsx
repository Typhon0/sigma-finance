import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Portfolio } from "@/gql/graphql";
import { AssetPerformance } from "../asset-performance";
import { PortfolioSummaryCards } from "../portfolio-summary-cards";
import { QuickActions } from "../quick-actions";
import { RecentTransactions } from "../recent-transactions";
import { ResponsiveAssetList } from "../responsive-asset-list";

// Mock external dependencies
vi.mock("@/hooks/use-portfolio-management", () => ({
	usePortfolioManagement: () => ({
		createPortfolio: vi.fn(),
		updatePortfolio: vi.fn(),
		deletePortfolio: vi.fn(),
		loading: false,
		error: null,
	}),
}));

vi.mock("@/hooks/use-asset-management", () => ({
	useAssetManagement: () => ({
		addAsset: vi.fn(),
		removeAsset: vi.fn(),
		updateAsset: vi.fn(),
		loading: false,
		error: null,
	}),
}));

// Mock chart components
vi.mock("echarts-for-react", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	default: function MockReactECharts({ style }: { style: any }) {
		return <div data-testid="mock-chart" style={style} />;
	},
}));

// Mock data
const mockPortfolios: Portfolio[] = [
	{
		id: "portfolio-1",
		name: "Growth Portfolio",
		description: "High-growth technology stocks",
		totalValue: 125000.0,
		totalGain: 15000.0,
		totalGainPercent: 13.64,
		assetCount: 8,
		assets: [
			{
				asset: {
					id: "asset-1",
					name: "Apple Inc.",
					symbol: "AAPL",
					type: "STOCK",
				},
				quantity: 100,
				currentPrice: 175.0,
				totalValue: 17500.0,
			},
		],
	},
	{
		id: "portfolio-2",
		name: "Crypto Portfolio",
		description: "Cryptocurrency investments",
		totalValue: 75000.0,
		totalGain: -5000.0,
		totalGainPercent: -6.25,
		assetCount: 5,
		assets: [
			{
				asset: {
					id: "asset-2",
					name: "Bitcoin",
					symbol: "BTC",
					type: "CRYPTO",
				},
				quantity: 1.5,
				currentPrice: 50000.0,
				totalValue: 75000.0,
			},
		],
	},
	{
		id: "portfolio-3",
		name: "Conservative Portfolio",
		description: "Low-risk investments and bonds",
		totalValue: 50000.0,
		totalGain: 2500.0,
		totalGainPercent: 5.26,
		assetCount: 12,
		assets: [],
	},
];

const mockAssets = [
	{
		asset: {
			id: "asset-1",
			name: "Apple Inc.",
			symbol: "AAPL",
			type: "STOCK",
		},
		performance: {
			change: 5.25,
			changePercent: 3.09,
			history: [
				{ date: "2024-01-01", value: 170 },
				{ date: "2024-01-02", value: 172 },
				{ date: "2024-01-03", value: 175 },
			],
		},
	},
	{
		asset: {
			id: "asset-2",
			name: "Microsoft Corp.",
			symbol: "MSFT",
			type: "STOCK",
		},
		performance: {
			change: -2.15,
			changePercent: -0.65,
			history: [
				{ date: "2024-01-01", value: 330 },
				{ date: "2024-01-02", value: 328 },
				{ date: "2024-01-03", value: 327.85 },
			],
		},
	},
	{
		asset: {
			id: "asset-3",
			name: "Bitcoin",
			symbol: "BTC",
			type: "CRYPTO",
		},
		performance: {
			change: 1500.0,
			changePercent: 3.09,
			history: [
				{ date: "2024-01-01", value: 48500 },
				{ date: "2024-01-02", value: 49200 },
				{ date: "2024-01-03", value: 50000 },
			],
		},
	},
];

const mockTransactions = [
	{
		id: "tx-1",
		type: "BUY",
		asset: { name: "Apple Inc.", symbol: "AAPL" },
		quantity: 10,
		price: 175.0,
		totalAmount: 1750.0,
		timestamp: "2024-01-03T10:30:00Z",
		portfolio: { name: "Growth Portfolio" },
	},
	{
		id: "tx-2",
		type: "SELL",
		asset: { name: "Tesla Inc.", symbol: "TSLA" },
		quantity: 5,
		price: 180.0,
		totalAmount: 900.0,
		timestamp: "2024-01-02T14:15:00Z",
		portfolio: { name: "Growth Portfolio" },
	},
	{
		id: "tx-3",
		type: "BUY",
		asset: { name: "Bitcoin", symbol: "BTC" },
		quantity: 0.1,
		price: 50000.0,
		totalAmount: 5000.0,
		timestamp: "2024-01-01T09:45:00Z",
		portfolio: { name: "Crypto Portfolio" },
	},
];

describe("Dashboard Asset Management UI Components", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("PortfolioSummaryCards Component", () => {
		it("should render all portfolios correctly", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();

			render(
				<PortfolioSummaryCards
					portfolios={mockPortfolios}
					portfolioMetrics={{}}
					onPortfolioSelect={mockOnPortfolioSelect}
					onPortfolioDelete={mockOnPortfolioDelete}
				/>,
			);

			expect(screen.getByText("Growth Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Crypto Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Conservative Portfolio")).toBeInTheDocument();
		});

		it("should display portfolio metrics correctly", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();

			render(
				<PortfolioSummaryCards
					portfolios={mockPortfolios}
					portfolioMetrics={{}}
					onPortfolioSelect={mockOnPortfolioSelect}
					onPortfolioDelete={mockOnPortfolioDelete}
				/>,
			);

			// Check portfolio values
			expect(screen.getByText("$125,000.00")).toBeInTheDocument();
			expect(screen.getByText("$75,000.00")).toBeInTheDocument();
			expect(screen.getByText("$50,000.00")).toBeInTheDocument();

			// Check gain/loss indicators
			expect(screen.getByText("+$15,000.00")).toBeInTheDocument();
			expect(screen.getByText("-$5,000.00")).toBeInTheDocument();
			expect(screen.getByText("+$2,500.00")).toBeInTheDocument();

			// Check percentages
			expect(screen.getByText("+13.64%")).toBeInTheDocument();
			expect(screen.getByText("-6.25%")).toBeInTheDocument();
			expect(screen.getByText("+5.26%")).toBeInTheDocument();
		});

		it("should handle portfolio selection", async () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();

			render(
				<PortfolioSummaryCards
					portfolios={mockPortfolios}
					portfolioMetrics={{}}
					onPortfolioSelect={mockOnPortfolioSelect}
					onPortfolioDelete={mockOnPortfolioDelete}
				/>,
			);

			const growthPortfolio = screen.getByText("Growth Portfolio");
			fireEvent.click(growthPortfolio);

			await waitFor(() => {
				expect(mockOnPortfolioSelect).toHaveBeenCalledWith(mockPortfolios[0]);
			});
		});

		it("should handle portfolio deletion", async () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();

			render(
				<PortfolioSummaryCards
					portfolios={mockPortfolios}
					portfolioMetrics={{}}
					onPortfolioSelect={mockOnPortfolioSelect}
					onPortfolioDelete={mockOnPortfolioDelete}
				/>,
			);

			const deleteButtons = screen.getAllByTitle("Delete portfolio");
			fireEvent.click(deleteButtons[0]);

			await waitFor(() => {
				expect(mockOnPortfolioDelete).toHaveBeenCalledWith(mockPortfolios[0].id);
			});
		});

		it("should display asset count for each portfolio", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();

			render(
				<PortfolioSummaryCards
					portfolios={mockPortfolios}
					portfolioMetrics={{}}
					onPortfolioSelect={mockOnPortfolioSelect}
					onPortfolioDelete={mockOnPortfolioDelete}
				/>,
			);

			expect(screen.getByText("8 assets")).toBeInTheDocument();
			expect(screen.getByText("5 assets")).toBeInTheDocument();
			expect(screen.getByText("12 assets")).toBeInTheDocument();
		});

		it("should show correct gain/loss styling", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();

			render(
				<PortfolioSummaryCards
					portfolios={mockPortfolios}
					portfolioMetrics={{}}
					onPortfolioSelect={mockOnPortfolioSelect}
					onPortfolioDelete={mockOnPortfolioDelete}
				/>,
			);

			const positiveGain = screen.getByText("+$15,000.00");
			const negativeGain = screen.getByText("-$5,000.00");

			expect(positiveGain).toHaveClass("text-green-600");
			expect(negativeGain).toHaveClass("text-red-600");
		});
	});

	describe("AssetPerformance Component", () => {
		it("should render asset performance data correctly", () => {
			const mockOnAssetClick = vi.fn();

			render(
				<AssetPerformance assets={mockAssets} isLoading={false} onAssetClick={mockOnAssetClick} />,
			);

			expect(screen.getByText("Top Performing Assets")).toBeInTheDocument();
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("AAPL")).toBeInTheDocument();
			expect(screen.getByText("Microsoft Corp.")).toBeInTheDocument();
			expect(screen.getByText("MSFT")).toBeInTheDocument();
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
			expect(screen.getByText("BTC")).toBeInTheDocument();
		});

		it("should display performance metrics correctly", () => {
			const mockOnAssetClick = vi.fn();

			render(
				<AssetPerformance assets={mockAssets} isLoading={false} onAssetClick={mockOnAssetClick} />,
			);

			expect(screen.getByText("+$5.25")).toBeInTheDocument();
			expect(screen.getByText("+3.09%")).toBeInTheDocument();
			expect(screen.getByText("-$2.15")).toBeInTheDocument();
			expect(screen.getByText("-0.65%")).toBeInTheDocument();
			expect(screen.getByText("+$1,500.00")).toBeInTheDocument();
		});

		it("should handle asset click events", async () => {
			const mockOnAssetClick = vi.fn();

			render(
				<AssetPerformance assets={mockAssets} isLoading={false} onAssetClick={mockOnAssetClick} />,
			);

			const appleAsset = screen.getByText("Apple Inc.");
			fireEvent.click(appleAsset);

			await waitFor(() => {
				expect(mockOnAssetClick).toHaveBeenCalledWith(mockAssets[0].asset);
			});
		});

		it("should show loading state", () => {
			const mockOnAssetClick = vi.fn();

			render(<AssetPerformance assets={[]} isLoading={true} onAssetClick={mockOnAssetClick} />);

			expect(screen.getByText("Loading assets...")).toBeInTheDocument();
		});

		it("should render mini performance charts", () => {
			const mockOnAssetClick = vi.fn();

			render(
				<AssetPerformance assets={mockAssets} isLoading={false} onAssetClick={mockOnAssetClick} />,
			);

			const charts = screen.getAllByTestId("mock-chart");
			expect(charts).toHaveLength(3); // One chart per asset
		});

		it("should handle empty asset list", () => {
			const mockOnAssetClick = vi.fn();

			render(<AssetPerformance assets={[]} isLoading={false} onAssetClick={mockOnAssetClick} />);

			expect(screen.getByText("No assets to display")).toBeInTheDocument();
		});
	});

	describe("QuickActions Component", () => {
		it("should render all quick action buttons", () => {
			render(<QuickActions />);

			expect(screen.getByText("Add Asset")).toBeInTheDocument();
			expect(screen.getByText("Create Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Import Data")).toBeInTheDocument();
			expect(screen.getByText("Export Report")).toBeInTheDocument();
		});

		it("should handle quick action clicks", async () => {
			const mockCreatePortfolio = vi.fn();
			const mockAddAsset = vi.fn();

			render(<QuickActions onCreatePortfolio={mockCreatePortfolio} onAddAsset={mockAddAsset} />);

			const createPortfolioBtn = screen.getByText("Create Portfolio");
			fireEvent.click(createPortfolioBtn);

			await waitFor(() => {
				expect(mockCreatePortfolio).toHaveBeenCalled();
			});

			const addAssetBtn = screen.getByText("Add Asset");
			fireEvent.click(addAssetBtn);

			await waitFor(() => {
				expect(mockAddAsset).toHaveBeenCalled();
			});
		});

		it("should show keyboard shortcuts", () => {
			render(<QuickActions showKeyboardShortcuts={true} />);

			expect(screen.getByText("Ctrl+N")).toBeInTheDocument(); // Create Portfolio
			expect(screen.getByText("Ctrl+A")).toBeInTheDocument(); // Add Asset
			expect(screen.getByText("Ctrl+I")).toBeInTheDocument(); // Import Data
			expect(screen.getByText("Ctrl+E")).toBeInTheDocument(); // Export Report
		});

		it("should handle disabled states", () => {
			render(<QuickActions disabled={true} />);

			const buttons = screen.getAllByRole("button");
			buttons.forEach((button) => {
				expect(button).toBeDisabled();
			});
		});
	});

	describe("RecentTransactions Component", () => {
		it("should render transaction list correctly", () => {
			render(<RecentTransactions transactions={mockTransactions} />);

			expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("Tesla Inc.")).toBeInTheDocument();
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
		});

		it("should display transaction details correctly", () => {
			render(<RecentTransactions transactions={mockTransactions} />);

			// Check transaction types
			expect(screen.getAllByText("BUY")).toHaveLength(2);
			expect(screen.getByText("SELL")).toBeInTheDocument();

			// Check amounts
			expect(screen.getByText("$1,750.00")).toBeInTheDocument();
			expect(screen.getByText("$900.00")).toBeInTheDocument();
			expect(screen.getByText("$5,000.00")).toBeInTheDocument();

			// Check quantities
			expect(screen.getByText("10")).toBeInTheDocument();
			expect(screen.getByText("5")).toBeInTheDocument();
			expect(screen.getByText("0.1")).toBeInTheDocument();
		});

		it("should format transaction dates correctly", () => {
			render(<RecentTransactions transactions={mockTransactions} />);

			expect(screen.getByText("Jan 3, 2024")).toBeInTheDocument();
			expect(screen.getByText("Jan 2, 2024")).toBeInTheDocument();
			expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
		});

		it("should show portfolio context for transactions", () => {
			render(<RecentTransactions transactions={mockTransactions} />);

			expect(screen.getByText("Growth Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Crypto Portfolio")).toBeInTheDocument();
		});

		it("should handle empty transaction list", () => {
			render(<RecentTransactions transactions={[]} />);

			expect(screen.getByText("No recent transactions")).toBeInTheDocument();
			expect(screen.getByText("Your transaction history will appear here")).toBeInTheDocument();
		});

		it("should show transaction type indicators with correct styling", () => {
			render(<RecentTransactions transactions={mockTransactions} />);

			const buyIndicators = screen.getAllByText("BUY");
			const sellIndicator = screen.getByText("SELL");

			buyIndicators.forEach((indicator) => {
				expect(indicator).toHaveClass("bg-green-100", "text-green-800");
			});

			expect(sellIndicator).toHaveClass("bg-red-100", "text-red-800");
		});
	});

	describe("ResponsiveAssetList Component", () => {
		it("should render asset list in table format on desktop", () => {
			// Mock desktop viewport
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 1024,
			});

			render(<ResponsiveAssetList assets={mockAssets} />);

			expect(screen.getByRole("table")).toBeInTheDocument();
			expect(screen.getByText("Asset")).toBeInTheDocument();
			expect(screen.getByText("Price")).toBeInTheDocument();
			expect(screen.getByText("Change")).toBeInTheDocument();
			expect(screen.getByText("Performance")).toBeInTheDocument();
		});

		it("should render asset list in card format on mobile", () => {
			// Mock mobile viewport
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 375,
			});

			render(<ResponsiveAssetList assets={mockAssets} />);

			expect(screen.queryByRole("table")).not.toBeInTheDocument();
			expect(screen.getAllByTestId("asset-card")).toHaveLength(3);
		});

		it("should handle asset selection in both formats", async () => {
			const mockOnAssetSelect = vi.fn();

			render(<ResponsiveAssetList assets={mockAssets} onAssetSelect={mockOnAssetSelect} />);

			const appleAsset = screen.getByText("Apple Inc.");
			fireEvent.click(appleAsset);

			await waitFor(() => {
				expect(mockOnAssetSelect).toHaveBeenCalledWith(mockAssets[0].asset);
			});
		});

		it("should show sorting options", () => {
			render(<ResponsiveAssetList assets={mockAssets} showSorting={true} />);

			expect(screen.getByText("Sort by:")).toBeInTheDocument();
			expect(screen.getByText("Name")).toBeInTheDocument();
			expect(screen.getByText("Performance")).toBeInTheDocument();
			expect(screen.getByText("Value")).toBeInTheDocument();
		});

		it("should handle filtering", async () => {
			render(<ResponsiveAssetList assets={mockAssets} showFilter={true} />);

			const filterInput = screen.getByPlaceholderText("Filter assets...");
			fireEvent.change(filterInput, { target: { value: "Apple" } });

			await waitFor(() => {
				expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
				expect(screen.queryByText("Microsoft Corp.")).not.toBeInTheDocument();
				expect(screen.queryByText("Bitcoin")).not.toBeInTheDocument();
			});
		});
	});

	describe("Component Integration", () => {
		it("should work together in dashboard layout", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();
			const mockOnAssetClick = vi.fn();

			render(
				<div className="dashboard-layout">
					<PortfolioSummaryCards
						portfolios={mockPortfolios}
						portfolioMetrics={{}}
						onPortfolioSelect={mockOnPortfolioSelect}
						onPortfolioDelete={mockOnPortfolioDelete}
					/>
					<AssetPerformance assets={mockAssets} isLoading={false} onAssetClick={mockOnAssetClick} />
					<QuickActions />
					<RecentTransactions transactions={mockTransactions} />
				</div>,
			);

			// Verify all components are rendered
			expect(screen.getByText("Growth Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Top Performing Assets")).toBeInTheDocument();
			expect(screen.getByText("Add Asset")).toBeInTheDocument();
			expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
		});

		it("should handle loading states across components", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();
			const mockOnAssetClick = vi.fn();

			render(
				<div className="dashboard-layout">
					<PortfolioSummaryCards
						portfolios={[]}
						portfolioMetrics={{}}
						onPortfolioSelect={mockOnPortfolioSelect}
						onPortfolioDelete={mockOnPortfolioDelete}
						loading={true}
					/>
					<AssetPerformance assets={[]} isLoading={true} onAssetClick={mockOnAssetClick} />
					<RecentTransactions transactions={[]} loading={true} />
				</div>,
			);

			expect(screen.getByText("Loading portfolios...")).toBeInTheDocument();
			expect(screen.getByText("Loading assets...")).toBeInTheDocument();
			expect(screen.getByText("Loading transactions...")).toBeInTheDocument();
		});

		it("should handle error states gracefully", () => {
			const mockOnPortfolioSelect = vi.fn();
			const mockOnPortfolioDelete = vi.fn();
			const mockOnAssetClick = vi.fn();

			render(
				<div className="dashboard-layout">
					<PortfolioSummaryCards
						portfolios={[]}
						portfolioMetrics={{}}
						onPortfolioSelect={mockOnPortfolioSelect}
						onPortfolioDelete={mockOnPortfolioDelete}
						error="Failed to load portfolios"
					/>
					<AssetPerformance
						assets={[]}
						isLoading={false}
						onAssetClick={mockOnAssetClick}
						error="Failed to load assets"
					/>
				</div>,
			);

			expect(screen.getByText("Error loading portfolios")).toBeInTheDocument();
			expect(screen.getByText("Error loading assets")).toBeInTheDocument();
		});
	});
});
