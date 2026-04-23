import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Portfolio } from "@/gql/graphql";
import type { Asset } from "@/hooks/use-dashboard-state";
import { useDashboardState } from "@/hooks/use-dashboard-state";
import { DashboardBreadcrumb } from "../dashboard-breadcrumb";
import { InlineAssetDetail } from "../inline-asset-detail";
import { InlinePortfolioDetail } from "../inline-portfolio-detail";

// Mock portfolio data
const mockPortfolio: Portfolio = {
	id: "portfolio-1",
	name: "Test Portfolio",
	description: "A test portfolio for dashboard functionality",
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
		},
	],
};

const mockAsset: Asset = {
	id: "asset-1",
	name: "Apple Inc.",
	symbol: "AAPL",
	type: "STOCK",
};

// Test component that uses the dashboard state hook
function TestDashboardComponent() {
	const [viewState, actions] = useDashboardState();

	return (
		<div>
			<div data-testid="view-mode">{viewState.viewMode}</div>
			<div data-testid="selected-portfolio">{viewState.selectedPortfolio?.name || "none"}</div>
			<div data-testid="selected-asset">{viewState.selectedAsset?.name || "none"}</div>

			<button
				type="button"
				data-testid="view-portfolio-btn"
				onClick={() => actions.viewPortfolio(mockPortfolio)}
			>
				View Portfolio
			</button>

			<button
				type="button"
				data-testid="view-asset-btn"
				onClick={() => actions.viewAsset(mockAsset, mockPortfolio)}
			>
				View Asset
			</button>

			<button
				type="button"
				data-testid="back-to-overview-btn"
				onClick={() => actions.backToOverview()}
			>
				Back to Overview
			</button>

			<button
				type="button"
				data-testid="back-to-portfolio-btn"
				onClick={() => actions.backToPortfolio(mockPortfolio)}
			>
				Back to Portfolio
			</button>

			<DashboardBreadcrumb items={viewState.breadcrumbPath} />
		</div>
	);
}

describe("Dashboard-Centric Portfolio View", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("useDashboardState Hook", () => {
		it("should initialize with overview state", () => {
			render(<TestDashboardComponent />);

			expect(screen.getByTestId("view-mode")).toHaveTextContent("overview");
			expect(screen.getByTestId("selected-portfolio")).toHaveTextContent("none");
			expect(screen.getByTestId("selected-asset")).toHaveTextContent("none");
		});

		it("should transition to portfolio detail view", async () => {
			render(<TestDashboardComponent />);

			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("view-mode")).toHaveTextContent("portfolio-detail");
				expect(screen.getByTestId("selected-portfolio")).toHaveTextContent("Test Portfolio");
				expect(screen.getByTestId("selected-asset")).toHaveTextContent("none");
			});
		});

		it("should transition to asset detail view", async () => {
			render(<TestDashboardComponent />);

			fireEvent.click(screen.getByTestId("view-asset-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("view-mode")).toHaveTextContent("asset-detail");
				expect(screen.getByTestId("selected-portfolio")).toHaveTextContent("Test Portfolio");
				expect(screen.getByTestId("selected-asset")).toHaveTextContent("Apple Inc.");
			});
		});

		it("should navigate back to overview from portfolio detail", async () => {
			render(<TestDashboardComponent />);

			// Go to portfolio detail first
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));
			await waitFor(() => {
				expect(screen.getByTestId("view-mode")).toHaveTextContent("portfolio-detail");
			});

			// Navigate back to overview
			fireEvent.click(screen.getByTestId("back-to-overview-btn"));
			await waitFor(() => {
				expect(screen.getByTestId("view-mode")).toHaveTextContent("overview");
				expect(screen.getByTestId("selected-portfolio")).toHaveTextContent("none");
			});
		});

		it("should navigate back to portfolio from asset detail", async () => {
			render(<TestDashboardComponent />);

			// Go to asset detail first
			fireEvent.click(screen.getByTestId("view-asset-btn"));
			await waitFor(() => {
				expect(screen.getByTestId("view-mode")).toHaveTextContent("asset-detail");
			});

			// Navigate back to portfolio
			fireEvent.click(screen.getByTestId("back-to-portfolio-btn"));
			await waitFor(() => {
				expect(screen.getByTestId("view-mode")).toHaveTextContent("portfolio-detail");
				expect(screen.getByTestId("selected-asset")).toHaveTextContent("none");
				expect(screen.getByTestId("selected-portfolio")).toHaveTextContent("Test Portfolio");
			});
		});
	});

	describe("DashboardBreadcrumb Component", () => {
		it("should render default breadcrumb for overview", () => {
			render(<DashboardBreadcrumb items={[{ title: "Dashboard" }]} />);

			expect(screen.getByText("Dashboard")).toBeInTheDocument();
		});

		it("should render portfolio breadcrumb with clickable navigation", () => {
			const mockOnClick = vi.fn();
			const breadcrumbItems = [
				{ title: "Dashboard", onClick: mockOnClick },
				{ title: "Test Portfolio" },
			];

			render(<DashboardBreadcrumb items={breadcrumbItems} />);

			expect(screen.getByText("Dashboard")).toBeInTheDocument();
			expect(screen.getByText("Test Portfolio")).toBeInTheDocument();

			fireEvent.click(screen.getByText("Dashboard"));
			expect(mockOnClick).toHaveBeenCalled();
		});

		it("should render asset breadcrumb with multiple navigation levels", () => {
			const mockDashboardClick = vi.fn();
			const mockPortfolioClick = vi.fn();
			const breadcrumbItems = [
				{ title: "Dashboard", onClick: mockDashboardClick },
				{ title: "Test Portfolio", onClick: mockPortfolioClick },
				{ title: "Apple Inc." },
			];

			render(<DashboardBreadcrumb items={breadcrumbItems} />);

			expect(screen.getByText("Dashboard")).toBeInTheDocument();
			expect(screen.getByText("Test Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();

			fireEvent.click(screen.getByText("Dashboard"));
			expect(mockDashboardClick).toHaveBeenCalled();

			fireEvent.click(screen.getByText("Test Portfolio"));
			expect(mockPortfolioClick).toHaveBeenCalled();
		});
	});

	describe("InlinePortfolioDetail Component", () => {
		it("should render portfolio details with back navigation", () => {
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
			expect(screen.getByText("A test portfolio for dashboard functionality")).toBeInTheDocument();
			expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();

			fireEvent.click(screen.getByText("Back to Dashboard"));
			expect(mockOnBack).toHaveBeenCalled();
		});

		it("should display portfolio assets with click handlers", () => {
			const mockOnBack = vi.fn();
			const mockOnAssetSelect = vi.fn();

			render(
				<InlinePortfolioDetail
					portfolio={mockPortfolio}
					onBack={mockOnBack}
					onAssetSelect={mockOnAssetSelect}
				/>,
			);

			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("AAPL")).toBeInTheDocument();
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
			expect(screen.getByText("BTC")).toBeInTheDocument();
		});
	});

	describe("InlineAssetDetail Component", () => {
		it("should render asset details with back navigation", () => {
			const mockOnBack = vi.fn();

			render(<InlineAssetDetail asset={mockAsset} portfolio={mockPortfolio} onBack={mockOnBack} />);

			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("AAPL")).toBeInTheDocument();
			expect(screen.getByText("Back to Test Portfolio")).toBeInTheDocument();

			fireEvent.click(screen.getByText("Back to Test Portfolio"));
			expect(mockOnBack).toHaveBeenCalled();
		});

		it("should display asset metrics and information", () => {
			const mockOnBack = vi.fn();

			render(<InlineAssetDetail asset={mockAsset} portfolio={mockPortfolio} onBack={mockOnBack} />);

			expect(screen.getByText("Type: STOCK")).toBeInTheDocument();
			expect(screen.getByText("Portfolio: Test Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Current Price")).toBeInTheDocument();
			expect(screen.getByText("Position Value")).toBeInTheDocument();
		});
	});
});

describe("Dashboard Navigation Flow Integration", () => {
	it("should maintain sidebar accessibility during all view transitions", () => {
		// This would be tested in an E2E test with actual sidebar component
		// For now, we verify that the components don't interfere with layout
		const mockOnBack = vi.fn();

		const { rerender } = render(<div data-testid="sidebar">Sidebar</div>);

		// Render portfolio detail view
		rerender(
			<div>
				<div data-testid="sidebar">Sidebar</div>
				<InlinePortfolioDetail portfolio={mockPortfolio} onBack={mockOnBack} />
			</div>,
		);

		expect(screen.getByTestId("sidebar")).toBeInTheDocument();
		expect(screen.getByText("Test Portfolio")).toBeInTheDocument();

		// Render asset detail view
		rerender(
			<div>
				<div data-testid="sidebar">Sidebar</div>
				<InlineAssetDetail asset={mockAsset} portfolio={mockPortfolio} onBack={mockOnBack} />
			</div>,
		);

		expect(screen.getByTestId("sidebar")).toBeInTheDocument();
		expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
	});
});
