import { MockedProvider } from "@apollo/client/testing";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import DashboardHomePage from "@/pages/dashboard-home";

// Mock external dependencies
vi.mock("echarts-for-react", () => ({
	default: function MockReactECharts({ style }: { style: any }) {
		return <div data-testid="mock-chart" style={style} />;
	},
}));

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

// Mock GraphQL queries and mutations
const mockPortfolioData = {
	portfolios: [
		{
			id: "portfolio-1",
			name: "Growth Portfolio",
			description: "High-growth technology stocks",
			totalValue: 125000.0,
			totalGain: 15000.0,
			totalGainPercent: 13.64,
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
					unrealizedGain: 2500.0,
					unrealizedGainPercent: 16.67,
				},
				{
					asset: {
						id: "asset-2",
						name: "Microsoft Corp.",
						symbol: "MSFT",
						type: "STOCK",
					},
					quantity: 50,
					currentPrice: 330.0,
					totalValue: 16500.0,
					unrealizedGain: 1500.0,
					unrealizedGainPercent: 10.0,
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
			assets: [
				{
					asset: {
						id: "asset-3",
						name: "Bitcoin",
						symbol: "BTC",
						type: "CRYPTO",
					},
					quantity: 1.5,
					currentPrice: 50000.0,
					totalValue: 75000.0,
					unrealizedGain: -5000.0,
					unrealizedGainPercent: -6.25,
				},
			],
		},
	],
	totalValue: 200000.0,
	totalChange: 10000.0,
	totalChangePercent: 5.26,
	topPerformingAssets: [
		{
			asset: {
				id: "asset-1",
				name: "Apple Inc.",
				symbol: "AAPL",
				type: "STOCK",
			},
			changeAmount: 2500.0,
			changePercent: 16.67,
		},
	],
	assetAllocation: [
		{ name: "Stocks", value: 125000, percentage: 62.5, assetType: "STOCK" },
		{ name: "Crypto", value: 75000, percentage: 37.5, assetType: "CRYPTO" },
	],
	recentTransactions: [
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
	],
};

const mocks = [
	{
		request: {
			query: require("@/graphql/queries/dashboard").GET_DASHBOARD_DATA,
			variables: { userId: "test-user-id" },
		},
		result: {
			data: mockPortfolioData,
		},
	},
];

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
	const mockUser = {
		id: "test-user-id",
		email: "test@example.com",
		name: "Test User",
	};

	return (
		<BrowserRouter>
			<MockedProvider mocks={mocks} addTypename={false}>
				<AuthProvider
					value={{
						user: mockUser,
						isLoading: false,
						login: vi.fn(),
						logout: vi.fn(),
					}}
				>
					<ThemeProvider defaultTheme="light" storageKey="test-theme">
						{children}
						<Toaster />
					</ThemeProvider>
				</AuthProvider>
			</MockedProvider>
		</BrowserRouter>
	);
}

describe("Dashboard Workflow E2E Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock window.matchMedia for responsive tests
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Dashboard Overview to Portfolio Detail Flow", () => {
		it("should navigate from overview to portfolio detail and back", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			// Wait for dashboard to load
			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Verify overview state
			expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			expect(screen.getByText("Growth Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Crypto Portfolio")).toBeInTheDocument();

			// Click on Growth Portfolio
			const growthPortfolio = screen.getByText("Growth Portfolio");
			fireEvent.click(growthPortfolio);

			// Wait for portfolio detail view
			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Verify portfolio detail state
			expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("Microsoft Corp.")).toBeInTheDocument();

			// Verify breadcrumb navigation
			const breadcrumb = screen.getByRole("navigation");
			expect(within(breadcrumb).getByText("Dashboard")).toBeInTheDocument();
			expect(
				within(breadcrumb).getByText("Growth Portfolio"),
			).toBeInTheDocument();

			// Navigate back to overview via breadcrumb
			const dashboardBreadcrumb = within(breadcrumb).getByText("Dashboard");
			fireEvent.click(dashboardBreadcrumb);

			// Wait for overview to return
			await waitFor(() => {
				expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			});

			// Verify we're back to overview
			expect(screen.getByText("Growth Portfolio")).toBeInTheDocument();
			expect(screen.getByText("Crypto Portfolio")).toBeInTheDocument();
		});

		it("should handle portfolio switching correctly", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Navigate to Growth Portfolio
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Navigate back to overview
			fireEvent.click(screen.getByText("Back to Dashboard"));

			await waitFor(() => {
				expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			});

			// Navigate to Crypto Portfolio
			fireEvent.click(screen.getByText("Crypto Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("Cryptocurrency investments"),
				).toBeInTheDocument();
			});

			// Verify correct portfolio is displayed
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
			expect(screen.getByText("BTC")).toBeInTheDocument();
		});
	});

	describe("Portfolio Detail to Asset Detail Flow", () => {
		it("should navigate from portfolio to asset detail and back", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Navigate to Growth Portfolio
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Click on Apple asset
			const appleAsset = screen.getByText("Apple Inc.");
			fireEvent.click(appleAsset);

			// Wait for asset detail view
			await waitFor(() => {
				expect(
					screen.getByText("Back to Growth Portfolio"),
				).toBeInTheDocument();
			});

			// Verify asset detail state
			expect(screen.getByText("AAPL")).toBeInTheDocument();
			expect(screen.getByText("STOCK")).toBeInTheDocument();
			expect(screen.getByText("$175.00")).toBeInTheDocument(); // Current price

			// Verify breadcrumb navigation
			const breadcrumb = screen.getByRole("navigation");
			expect(within(breadcrumb).getByText("Dashboard")).toBeInTheDocument();
			expect(
				within(breadcrumb).getByText("Growth Portfolio"),
			).toBeInTheDocument();
			expect(within(breadcrumb).getByText("Apple Inc.")).toBeInTheDocument();

			// Navigate back to portfolio
			fireEvent.click(screen.getByText("Back to Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Verify we're back to portfolio detail
			expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
			expect(screen.getByText("Microsoft Corp.")).toBeInTheDocument();
		});

		it("should handle asset switching within portfolio", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Navigate to Growth Portfolio
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Navigate to Apple asset
			fireEvent.click(screen.getByText("Apple Inc."));

			await waitFor(() => {
				expect(screen.getByText("AAPL")).toBeInTheDocument();
			});

			// Navigate back to portfolio
			fireEvent.click(screen.getByText("Back to Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Navigate to Microsoft asset
			fireEvent.click(screen.getByText("Microsoft Corp."));

			await waitFor(() => {
				expect(screen.getByText("MSFT")).toBeInTheDocument();
			});

			// Verify correct asset is displayed
			expect(screen.getByText("$330.00")).toBeInTheDocument(); // Microsoft price
		});
	});

	describe("Direct Asset Navigation Flow", () => {
		it("should navigate directly from overview to asset detail", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Click on asset from top performing assets section
			const topPerformingSection = screen
				.getByText("Top Performing Assets")
				.closest("div");
			const appleAsset = within(topPerformingSection!).getByText("Apple Inc.");
			fireEvent.click(appleAsset);

			// Wait for asset detail view
			await waitFor(() => {
				expect(screen.getByText("AAPL")).toBeInTheDocument();
			});

			// Verify breadcrumb shows correct path
			const breadcrumb = screen.getByRole("navigation");
			expect(within(breadcrumb).getByText("Dashboard")).toBeInTheDocument();
			expect(
				within(breadcrumb).getByText("Growth Portfolio"),
			).toBeInTheDocument();
			expect(within(breadcrumb).getByText("Apple Inc.")).toBeInTheDocument();

			// Navigate back to overview via breadcrumb
			const dashboardBreadcrumb = within(breadcrumb).getByText("Dashboard");
			fireEvent.click(dashboardBreadcrumb);

			await waitFor(() => {
				expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			});
		});
	});

	describe("Sidebar Navigation Persistence", () => {
		it("should maintain sidebar accessibility during all view transitions", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Verify sidebar is present in overview
			const sidebar = screen.getByRole("complementary"); // Sidebar role
			expect(sidebar).toBeInTheDocument();

			// Navigate to portfolio detail
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Verify sidebar is still present
			expect(screen.getByRole("complementary")).toBeInTheDocument();

			// Navigate to asset detail
			fireEvent.click(screen.getByText("Apple Inc."));

			await waitFor(() => {
				expect(screen.getByText("AAPL")).toBeInTheDocument();
			});

			// Verify sidebar is still present
			expect(screen.getByRole("complementary")).toBeInTheDocument();
		});

		it("should handle sidebar toggle during navigation", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Find and click sidebar toggle
			const sidebarToggle = screen.getByRole("button", {
				name: /toggle sidebar/i,
			});
			fireEvent.click(sidebarToggle);

			// Navigate to portfolio while sidebar is collapsed
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Verify sidebar toggle is still functional
			expect(
				screen.getByRole("button", { name: /toggle sidebar/i }),
			).toBeInTheDocument();

			// Expand sidebar again
			fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));

			// Verify sidebar is expanded
			expect(screen.getByRole("complementary")).toBeInTheDocument();
		});
	});

	describe("Context Switching and State Management", () => {
		it("should maintain correct context during rapid navigation", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Rapid navigation sequence
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			fireEvent.click(screen.getByText("Apple Inc."));

			await waitFor(() => {
				expect(screen.getByText("AAPL")).toBeInTheDocument();
			});

			// Navigate back to overview quickly
			const breadcrumb = screen.getByRole("navigation");
			fireEvent.click(within(breadcrumb).getByText("Dashboard"));

			await waitFor(() => {
				expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			});

			// Navigate to different portfolio
			fireEvent.click(screen.getByText("Crypto Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("Cryptocurrency investments"),
				).toBeInTheDocument();
			});

			// Verify correct context is maintained
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
			expect(screen.queryByText("Apple Inc.")).not.toBeInTheDocument();
		});

		it("should handle browser back/forward navigation", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Navigate to portfolio
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Simulate browser back button
			window.history.back();

			await waitFor(() => {
				expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			});

			// Simulate browser forward button
			window.history.forward();

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});
		});
	});

	describe("Error Handling During Navigation", () => {
		it("should handle navigation errors gracefully", async () => {
			// Mock a GraphQL error
			const errorMocks = [
				{
					request: {
						query: require("@/graphql/queries/dashboard").GET_DASHBOARD_DATA,
						variables: { userId: "test-user-id" },
					},
					error: new Error("Network error"),
				},
			];

			render(
				<BrowserRouter>
					<MockedProvider mocks={errorMocks} addTypename={false}>
						<AuthProvider
							value={{
								user: { id: "test-user-id" },
								isLoading: false,
								login: vi.fn(),
								logout: vi.fn(),
							}}
						>
							<ThemeProvider defaultTheme="light" storageKey="test-theme">
								<DashboardHomePage />
							</ThemeProvider>
						</AuthProvider>
					</MockedProvider>
				</BrowserRouter>,
			);

			// Wait for error state
			await waitFor(() => {
				expect(
					screen.getByText("Failed to load dashboard"),
				).toBeInTheDocument();
			});

			// Verify error message and retry button
			expect(screen.getByText("Network error")).toBeInTheDocument();
			expect(screen.getByText("Try Again")).toBeInTheDocument();
		});

		it("should handle missing data gracefully", async () => {
			const emptyMocks = [
				{
					request: {
						query: require("@/graphql/queries/dashboard").GET_DASHBOARD_DATA,
						variables: { userId: "test-user-id" },
					},
					result: {
						data: {
							portfolios: [],
							totalValue: 0,
							totalChange: 0,
							totalChangePercent: 0,
							topPerformingAssets: [],
							assetAllocation: [],
							recentTransactions: [],
						},
					},
				},
			];

			render(
				<BrowserRouter>
					<MockedProvider mocks={emptyMocks} addTypename={false}>
						<AuthProvider
							value={{
								user: { id: "test-user-id" },
								isLoading: false,
								login: vi.fn(),
								logout: vi.fn(),
							}}
						>
							<ThemeProvider defaultTheme="light" storageKey="test-theme">
								<DashboardHomePage />
							</ThemeProvider>
						</AuthProvider>
					</MockedProvider>
				</BrowserRouter>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Verify empty states are handled
			expect(screen.getByText("No portfolios yet")).toBeInTheDocument();
			expect(
				screen.getByText("Create your first portfolio to get started"),
			).toBeInTheDocument();
		});
	});

	describe("Responsive Behavior During Navigation", () => {
		it("should adapt navigation for mobile screens", async () => {
			// Mock mobile viewport
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 375,
			});

			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: vi.fn().mockImplementation((query) => ({
					matches: query.includes("max-width: 768px"),
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				})),
			});

			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Verify mobile-specific behavior
			const sidebarToggle = screen.getByRole("button", {
				name: /toggle sidebar/i,
			});
			expect(sidebarToggle).toHaveClass("h-10", "w-10"); // Mobile touch target size

			// Navigate to portfolio on mobile
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Verify mobile layout is maintained
			expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
		});

		it("should handle touch gestures for navigation", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Navigate to portfolio
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			// Simulate swipe gesture to go back
			const portfolioDetail = screen
				.getByText("High-growth technology stocks")
				.closest("div");

			fireEvent.touchStart(portfolioDetail!, {
				touches: [{ clientX: 0, clientY: 0 }],
			});
			fireEvent.touchMove(portfolioDetail!, {
				touches: [{ clientX: 100, clientY: 0 }],
			});
			fireEvent.touchEnd(portfolioDetail!);

			// Verify swipe back navigation (if implemented)
			await waitFor(() => {
				expect(screen.getByText("Welcome back!")).toBeInTheDocument();
			});
		});
	});

	describe("Performance During Navigation", () => {
		it("should handle navigation without performance degradation", async () => {
			const performanceStart = performance.now();

			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Perform multiple navigation actions
			fireEvent.click(screen.getByText("Growth Portfolio"));

			await waitFor(() => {
				expect(
					screen.getByText("High-growth technology stocks"),
				).toBeInTheDocument();
			});

			fireEvent.click(screen.getByText("Apple Inc."));

			await waitFor(() => {
				expect(screen.getByText("AAPL")).toBeInTheDocument();
			});

			const performanceEnd = performance.now();
			const navigationTime = performanceEnd - performanceStart;

			// Verify navigation completes within reasonable time (adjust threshold as needed)
			expect(navigationTime).toBeLessThan(5000); // 5 seconds
		});

		it("should handle concurrent navigation requests", async () => {
			render(
				<TestWrapper>
					<DashboardHomePage />
				</TestWrapper>,
			);

			await waitFor(() => {
				expect(screen.getByText("Dashboard")).toBeInTheDocument();
			});

			// Simulate rapid clicking (concurrent navigation)
			const growthPortfolio = screen.getByText("Growth Portfolio");
			const cryptoPortfolio = screen.getByText("Crypto Portfolio");

			fireEvent.click(growthPortfolio);
			fireEvent.click(cryptoPortfolio);

			// Wait for final state to settle
			await waitFor(() => {
				expect(
					screen.getByText("Cryptocurrency investments"),
				).toBeInTheDocument();
			});

			// Verify correct final state
			expect(screen.getByText("Bitcoin")).toBeInTheDocument();
		});
	});
});
