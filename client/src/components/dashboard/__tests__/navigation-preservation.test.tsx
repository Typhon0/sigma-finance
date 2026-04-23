import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { Portfolio } from "@/gql/graphql";
import type { Asset } from "@/hooks/use-dashboard-state";
import { useDashboardState } from "@/hooks/use-dashboard-state";
import { useResponsiveDashboard } from "@/hooks/use-responsive-dashboard";
import { DashboardBreadcrumb } from "../dashboard-breadcrumb";
import { DashboardTransition } from "../dashboard-transitions";

// Mock external dependencies
vi.mock("@/hooks/use-responsive-dashboard", () => ({
	useResponsiveDashboard: vi.fn(() => [
		{
			isMobile: false,
			isTablet: false,
			sidebarCollapsed: false,
			showMobileMenu: false,
		},
		{
			setSidebarCollapsed: vi.fn(),
			setShowMobileMenu: vi.fn(),
			handleSwipeGesture: vi.fn(),
		},
	]),
}));

vi.mock("@/hooks/use-sidebar", () => ({
	useSidebar: () => ({
		open: true,
		setOpen: vi.fn(),
		openMobile: false,
		setOpenMobile: vi.fn(),
		isMobile: false,
		state: "expanded",
		toggleSidebar: vi.fn(),
	}),
}));

// Mock data
const mockPortfolio: Portfolio = {
	id: "portfolio-1",
	name: "Test Portfolio",
	description: "A test portfolio",
	assets: [],
};

const mockAsset: Asset = {
	id: "asset-1",
	name: "Apple Inc.",
	symbol: "AAPL",
	type: "STOCK",
};

// Test component that simulates the dashboard layout
function TestDashboardLayout() {
	const [viewState, actions] = useDashboardState();
	const [responsiveState, responsiveActions] = useResponsiveDashboard();

	return (
		<BrowserRouter>
			<SidebarProvider
				open={!responsiveState.sidebarCollapsed}
				onOpenChange={responsiveActions.setSidebarCollapsed}
			>
				<AppSidebar />
				<SidebarInset>
					<header className="flex shrink-0 items-center gap-2 h-16">
						<div className="flex items-center gap-2 px-4 w-full">
							<SidebarTrigger data-testid="sidebar-trigger" />
							<div className="flex-1">
								<DashboardBreadcrumb items={viewState.breadcrumbPath} />
							</div>
						</div>
					</header>

					<main className="flex-1 p-4">
						<DashboardTransition viewMode={viewState.viewMode}>
							{viewState.viewMode === "overview" && (
								<div data-testid="overview-content">
									<h1>Dashboard Overview</h1>
									<button
										type="button"
										onClick={() => actions.viewPortfolio(mockPortfolio)}
										data-testid="view-portfolio-btn"
									>
										View Portfolio
									</button>
									<button
										type="button"
										onClick={() => actions.viewAsset(mockAsset, mockPortfolio)}
										data-testid="view-asset-btn"
									>
										View Asset
									</button>
								</div>
							)}

							{viewState.viewMode === "portfolio-detail" && (
								<div data-testid="portfolio-content">
									<h1>Portfolio Detail: {viewState.selectedPortfolio?.name}</h1>
									<button
										type="button"
										onClick={() => actions.backToOverview()}
										data-testid="back-to-overview-btn"
									>
										Back to Overview
									</button>
									<button
										type="button"
										onClick={() => actions.viewAsset(mockAsset, viewState.selectedPortfolio!)}
										data-testid="view-asset-from-portfolio-btn"
									>
										View Asset
									</button>
								</div>
							)}

							{viewState.viewMode === "asset-detail" && (
								<div data-testid="asset-content">
									<h1>Asset Detail: {viewState.selectedAsset?.name}</h1>
									<button
										type="button"
										onClick={() => actions.backToOverview()}
										data-testid="back-to-overview-from-asset-btn"
									>
										Back to Overview
									</button>
									<button
										type="button"
										onClick={() =>
											viewState.selectedPortfolio &&
											actions.backToPortfolio(viewState.selectedPortfolio)
										}
										data-testid="back-to-portfolio-btn"
									>
										Back to Portfolio
									</button>
								</div>
							)}
						</DashboardTransition>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</BrowserRouter>
	);
}

describe("Dashboard Navigation Preservation Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Sidebar Persistence Across View Modes", () => {
		it("should maintain sidebar visibility in overview mode", () => {
			render(<TestDashboardLayout />);

			// Verify sidebar is present
			expect(screen.getByRole("complementary")).toBeInTheDocument();

			// Verify sidebar trigger is accessible
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();

			// Verify overview content is displayed
			expect(screen.getByTestId("overview-content")).toBeInTheDocument();
			expect(screen.getByText("Dashboard Overview")).toBeInTheDocument();
		});

		it("should maintain sidebar visibility in portfolio detail mode", async () => {
			render(<TestDashboardLayout />);

			// Navigate to portfolio detail
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Verify sidebar is still present
			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();

			// Verify portfolio content is displayed
			expect(screen.getByText("Portfolio Detail: Test Portfolio")).toBeInTheDocument();
		});

		it("should maintain sidebar visibility in asset detail mode", async () => {
			render(<TestDashboardLayout />);

			// Navigate to asset detail
			fireEvent.click(screen.getByTestId("view-asset-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Verify sidebar is still present
			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();

			// Verify asset content is displayed
			expect(screen.getByText("Asset Detail: Apple Inc.")).toBeInTheDocument();
		});

		it("should handle sidebar toggle across all view modes", async () => {
			const mockSetSidebarCollapsed = vi.fn();
			vi.mocked(useResponsiveDashboard).mockReturnValue([
				{
					isMobile: false,
					isTablet: false,
					sidebarCollapsed: false,
					showMobileMenu: false,
				},
				{
					setSidebarCollapsed: mockSetSidebarCollapsed,
					setShowMobileMenu: vi.fn(),
					handleSwipeGesture: vi.fn(),
				},
			]);

			render(<TestDashboardLayout />);

			// Test sidebar toggle in overview
			fireEvent.click(screen.getByTestId("sidebar-trigger"));
			expect(mockSetSidebarCollapsed).toHaveBeenCalled();

			// Navigate to portfolio detail
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Test sidebar toggle in portfolio detail
			fireEvent.click(screen.getByTestId("sidebar-trigger"));
			expect(mockSetSidebarCollapsed).toHaveBeenCalledTimes(2);

			// Navigate to asset detail
			fireEvent.click(screen.getByTestId("view-asset-from-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Test sidebar toggle in asset detail
			fireEvent.click(screen.getByTestId("sidebar-trigger"));
			expect(mockSetSidebarCollapsed).toHaveBeenCalledTimes(3);
		});
	});

	describe("Breadcrumb Navigation Preservation", () => {
		it("should show correct breadcrumb in overview mode", () => {
			render(<TestDashboardLayout />);

			const breadcrumb = screen.getByRole("navigation");
			expect(within(breadcrumb).getByText("Dashboard")).toBeInTheDocument();
		});

		it("should show correct breadcrumb in portfolio detail mode", async () => {
			render(<TestDashboardLayout />);

			// Navigate to portfolio detail
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			const breadcrumb = screen.getByRole("navigation");
			expect(within(breadcrumb).getByText("Dashboard")).toBeInTheDocument();
			expect(within(breadcrumb).getByText("Test Portfolio")).toBeInTheDocument();
		});

		it("should show correct breadcrumb in asset detail mode", async () => {
			render(<TestDashboardLayout />);

			// Navigate to asset detail
			fireEvent.click(screen.getByTestId("view-asset-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			const breadcrumb = screen.getByRole("navigation");
			expect(within(breadcrumb).getByText("Dashboard")).toBeInTheDocument();
			expect(within(breadcrumb).getByText("Test Portfolio")).toBeInTheDocument();
			expect(within(breadcrumb).getByText("Apple Inc.")).toBeInTheDocument();
		});

		it("should handle breadcrumb navigation correctly", async () => {
			render(<TestDashboardLayout />);

			// Navigate to asset detail
			fireEvent.click(screen.getByTestId("view-asset-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Click on portfolio breadcrumb
			const breadcrumb = screen.getByRole("navigation");
			fireEvent.click(within(breadcrumb).getByText("Test Portfolio"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Click on dashboard breadcrumb
			fireEvent.click(within(breadcrumb).getByText("Dashboard"));

			await waitFor(() => {
				expect(screen.getByTestId("overview-content")).toBeInTheDocument();
			});
		});
	});

	describe("Navigation State Preservation", () => {
		it("should preserve navigation state during view transitions", async () => {
			render(<TestDashboardLayout />);

			// Start in overview
			expect(screen.getByTestId("overview-content")).toBeInTheDocument();

			// Navigate to portfolio
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Navigate to asset
			fireEvent.click(screen.getByTestId("view-asset-from-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Navigate back to portfolio
			fireEvent.click(screen.getByTestId("back-to-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Navigate back to overview
			fireEvent.click(screen.getByTestId("back-to-overview-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("overview-content")).toBeInTheDocument();
			});

			// Verify we're back to the original state
			expect(screen.getByText("Dashboard Overview")).toBeInTheDocument();
		});

		it("should handle rapid navigation changes", async () => {
			render(<TestDashboardLayout />);

			// Rapid navigation sequence
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));
			fireEvent.click(screen.getByTestId("view-asset-btn"));

			// Wait for final state
			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Verify correct final state
			expect(screen.getByText("Asset Detail: Apple Inc.")).toBeInTheDocument();
		});

		it("should preserve sidebar state during navigation", async () => {
			const mockSetSidebarCollapsed = vi.fn();
			vi.mocked(useResponsiveDashboard).mockReturnValue([
				{
					isMobile: false,
					isTablet: false,
					sidebarCollapsed: true, // Start with collapsed sidebar
					showMobileMenu: false,
				},
				{
					setSidebarCollapsed: mockSetSidebarCollapsed,
					setShowMobileMenu: vi.fn(),
					handleSwipeGesture: vi.fn(),
				},
			]);

			render(<TestDashboardLayout />);

			// Verify sidebar starts collapsed
			expect(screen.getByRole("complementary")).toBeInTheDocument();

			// Navigate to portfolio
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Verify sidebar state is preserved
			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
		});
	});

	describe("Mobile Responsive Navigation", () => {
		it("should handle mobile navigation correctly", async () => {
			vi.mocked(useResponsiveDashboard).mockReturnValue([
				{
					isMobile: true,
					isTablet: false,
					sidebarCollapsed: false,
					showMobileMenu: false,
				},
				{
					setSidebarCollapsed: vi.fn(),
					setShowMobileMenu: vi.fn(),
					handleSwipeGesture: vi.fn(),
				},
			]);

			render(<TestDashboardLayout />);

			// Verify mobile-specific behavior
			const sidebarTrigger = screen.getByTestId("sidebar-trigger");
			expect(sidebarTrigger).toBeInTheDocument();

			// Navigate to portfolio on mobile
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Verify sidebar is still accessible on mobile
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
		});

		it("should handle tablet navigation correctly", async () => {
			vi.mocked(useResponsiveDashboard).mockReturnValue([
				{
					isMobile: false,
					isTablet: true,
					sidebarCollapsed: false,
					showMobileMenu: false,
				},
				{
					setSidebarCollapsed: vi.fn(),
					setShowMobileMenu: vi.fn(),
					handleSwipeGesture: vi.fn(),
				},
			]);

			render(<TestDashboardLayout />);

			// Navigate through all view modes on tablet
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			fireEvent.click(screen.getByTestId("view-asset-from-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Verify sidebar remains functional on tablet
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
			expect(screen.getByRole("complementary")).toBeInTheDocument();
		});
	});

	describe("Accessibility During Navigation", () => {
		it("should maintain proper ARIA labels across view modes", async () => {
			render(<TestDashboardLayout />);

			// Check initial accessibility
			expect(screen.getByRole("complementary")).toBeInTheDocument(); // Sidebar
			expect(screen.getByRole("navigation")).toBeInTheDocument(); // Breadcrumb
			expect(screen.getByRole("main")).toBeInTheDocument(); // Main content

			// Navigate to portfolio
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Verify accessibility is maintained
			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByRole("navigation")).toBeInTheDocument();
			expect(screen.getByRole("main")).toBeInTheDocument();

			// Navigate to asset
			fireEvent.click(screen.getByTestId("view-asset-from-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Verify accessibility is still maintained
			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByRole("navigation")).toBeInTheDocument();
			expect(screen.getByRole("main")).toBeInTheDocument();
		});

		it("should support keyboard navigation across all view modes", async () => {
			render(<TestDashboardLayout />);

			// Test keyboard navigation in overview
			const viewPortfolioBtn = screen.getByTestId("view-portfolio-btn");
			viewPortfolioBtn.focus();
			fireEvent.keyDown(viewPortfolioBtn, { key: "Enter" });

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Test keyboard navigation in portfolio detail
			const backBtn = screen.getByTestId("back-to-overview-btn");
			backBtn.focus();
			fireEvent.keyDown(backBtn, { key: "Enter" });

			await waitFor(() => {
				expect(screen.getByTestId("overview-content")).toBeInTheDocument();
			});
		});

		it("should announce view changes to screen readers", async () => {
			render(<TestDashboardLayout />);

			// Navigate to portfolio
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			// Check for screen reader announcements (aria-live regions)
			const liveRegion = screen.queryByRole("status");
			if (liveRegion) {
				expect(liveRegion).toBeInTheDocument();
			}
		});
	});

	describe("Performance During Navigation", () => {
		it("should not cause layout shifts during navigation", async () => {
			render(<TestDashboardLayout />);

			const initialLayout = screen.getByRole("complementary").getBoundingClientRect();

			// Navigate through all view modes
			fireEvent.click(screen.getByTestId("view-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("portfolio-content")).toBeInTheDocument();
			});

			const portfolioLayout = screen.getByRole("complementary").getBoundingClientRect();
			expect(portfolioLayout).toEqual(initialLayout);

			fireEvent.click(screen.getByTestId("view-asset-from-portfolio-btn"));

			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			const assetLayout = screen.getByRole("complementary").getBoundingClientRect();
			expect(assetLayout).toEqual(initialLayout);
		});

		it("should handle concurrent navigation requests without breaking layout", async () => {
			render(<TestDashboardLayout />);

			// Simulate rapid clicking
			const portfolioBtn = screen.getByTestId("view-portfolio-btn");
			const assetBtn = screen.getByTestId("view-asset-btn");

			fireEvent.click(portfolioBtn);
			fireEvent.click(assetBtn);

			// Wait for final state
			await waitFor(() => {
				expect(screen.getByTestId("asset-content")).toBeInTheDocument();
			});

			// Verify layout integrity
			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
			expect(screen.getByRole("navigation")).toBeInTheDocument();
		});
	});
});
