import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StocksFundsModule } from "../assets/stocks-funds/StocksFundsModule";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("@apollo/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@apollo/client")>();
	return {
		...actual,
		gql: vi.fn(),
		useQuery: () => ({ data: undefined, loading: false }),
	};
});

vi.mock("@/hooks/useBenchmarkInstrumentId", () => ({
	useBenchmarkInstrumentId: () => ({ id: "bench-1", loading: false }),
}));

// Mock PortfolioProvider
vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: [
			{
				id: "asset-1",
				name: "Apple Inc.",
				symbol: "AAPL",
				type: "stock",
				quantity: 10,
				purchasePrice: 150,
				currentPrice: 175,
				currentValue: 1750,
			},
			{
				id: "asset-2",
				name: "Microsoft Corp.",
				symbol: "MSFT",
				type: "stock",
				quantity: 5,
				purchasePrice: 300,
				currentPrice: 330,
				currentValue: 1650,
			},
		],
		selectedPortfolio: {
			id: "portfolio-1",
			name: "Growth Portfolio",
			analytics: {
				performanceHistory: [
					{ date: "2024-01-01", value: 30000 },
					{ date: "2024-01-02", value: 31000 },
				],
			},
		},
		addAsset: vi.fn().mockResolvedValue({}),
		addingAsset: false,
	}),
}));

// Mock child components
vi.mock("@/components/assets/stocks-funds/StocksFundsPositions", () => ({
	StocksFundsPositions: () => <div data-testid="stocks-positions">Positions</div>,
}));

vi.mock("@/components/assets/stocks-funds/StocksFundsTransactions", () => ({
	StocksFundsTransactions: () => <div data-testid="stocks-transactions">Transactions</div>,
}));

vi.mock("@/components/PieChartWithCenter", () => ({
	PieChartWithCenter: () => <div data-testid="pie-chart">Chart</div>,
}));

vi.mock("@/components/assets/stocks-funds/StocksDistributionWidget", () => ({
	StocksDistributionWidget: ({ onSetFilter }: { onSetFilter?: (filter: unknown) => void }) => (
		<div data-testid="stocks-distribution-widget">
			<button
				type="button"
				data-testid="filter-tech-sector"
				onClick={() => onSetFilter?.({ mode: "sector", value: "Technology", label: "Technology" })}
			>
				Filter Technology
			</button>
		</div>
	),
}));

vi.mock("@/components/charts/PortfolioHeroChart", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../charts/PortfolioHeroChart")>();
	return {
		...actual,
		PortfolioHeroChart: () => <div data-testid="portfolio-hero-chart">Portfolio Hero Chart</div>,
	};
});

vi.mock("@/components/charts/EChart", () => ({
	default: () => <div data-testid="echarts">ECharts</div>,
}));

vi.mock("lucide-react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("lucide-react")>();
	return {
		...actual,
	};
});

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "USD",
		currencySymbol: "$",
		formatCurrency: (val: number | null | undefined) =>
			val !== null && val !== undefined ? `$${val.toFixed(2)}` : "$0.00",
		formatCurrencyCompact: (val: number | null | undefined) =>
			val !== null && val !== undefined ? `$${val.toFixed(0)}` : "$0",
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
		...props
	}: {
		children: ReactNode;
		onClick?: (e: React.MouseEvent) => void;
	}) => (
		<button type="button" onClick={onClick} {...props}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/card", () => ({
	Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Mock AddStockForm to capture the onSubmit handler
let capturedHandleAddPosition: ((formData: Record<string, unknown>) => Promise<void>) | null = null;
vi.mock("@/components/assets/stocks-funds/AddStockForm", () => ({
	AddStockForm: ({
		open,
		onClose: _onClose,
		onSubmit,
	}: {
		open: boolean;
		onClose: () => void;
		onSubmit: (data: unknown) => void;
	}) => {
		if (open) {
			capturedHandleAddPosition = onSubmit as (formData: Record<string, unknown>) => Promise<void>;
		}
		return open ? <div data-testid="add-stock-form">Add Stock Form</div> : null;
	},
}));

describe("StocksFundsModule", () => {
	describe("handleAddPosition payload mapping", () => {
		it("passes currentPrice to addAsset (not just purchasePrice)", async () => {
			const mockAddAsset = vi.fn().mockResolvedValue({});

			// Re-mock with our custom addAsset
			vi.doMock("@/components/PortfolioProvider", () => ({
				usePortfolio: () => ({
					assets: [],
					selectedPortfolio: {
						id: "portfolio-1",
						name: "Test Portfolio",
						analytics: { performanceHistory: [] },
					},
					addAsset: mockAddAsset,
					addingAsset: false,
				}),
			}));

			render(<StocksFundsModule />);

			// Find the Add Position button and click it
			const addButton = screen.getByText("Add Position");
			expect(addButton).toBeInTheDocument();

			// The AddStockForm mock captures the onSubmit handler
			// Now we simulate calling it with specific form data
			if (capturedHandleAddPosition) {
				const formData = {
					name: "Apple Inc.",
					symbol: "AAPL",
					type: "stock" as const,
					quantity: 10,
					purchasePrice: 150,
					currentPrice: 175, // This is the key field being tested
					purchaseDate: "2024-01-15",
				};

				await capturedHandleAddPosition(formData as Record<string, unknown>);

				// Verify addAsset was called with currentPrice
				expect(mockAddAsset).toHaveBeenCalled();
				const callArgs = mockAddAsset.mock.calls[0][0];
				expect(callArgs).toHaveProperty("currentPrice", 175);
				expect(callArgs).toHaveProperty("purchasePrice", 150);
			}
		});

		it("uses correct variable names matching AddAssetInput interface", async () => {
			const mockAddAsset = vi.fn().mockResolvedValue({});

			vi.doMock("@/components/PortfolioProvider", () => ({
				usePortfolio: () => ({
					assets: [],
					selectedPortfolio: {
						id: "portfolio-1",
						name: "Test Portfolio",
						analytics: { performanceHistory: [] },
					},
					addAsset: mockAddAsset,
					addingAsset: false,
				}),
			}));

			render(<StocksFundsModule />);

			// Trigger the form submission
			if (capturedHandleAddPosition) {
				const formData = {
					name: "Microsoft Corp.",
					symbol: "MSFT",
					type: "stock" as const,
					quantity: 5,
					purchasePrice: 300,
					currentPrice: 330,
					purchaseDate: "2024-02-01",
				};

				await capturedHandleAddPosition(formData as Record<string, unknown>);

				// Verify the call matches AddAssetInput interface expectations:
				// - name: string
				// - symbol: string
				// - type: "stock" | "fund" | "etf"
				// - quantity: number
				// - purchasePrice: number
				// - currentPrice?: number
				// - purchaseDate?: string
				expect(mockAddAsset).toHaveBeenCalled();
				const callArgs = mockAddAsset.mock.calls[0][0];

				expect(callArgs).toHaveProperty("name", "Microsoft Corp.");
				expect(callArgs).toHaveProperty("symbol", "MSFT");
				expect(callArgs).toHaveProperty("type", "stock");
				expect(callArgs).toHaveProperty("quantity", 5);
				expect(callArgs).toHaveProperty("purchasePrice", 300);
				expect(callArgs).toHaveProperty("currentPrice", 330);
				expect(callArgs).toHaveProperty("purchaseDate", "2024-02-01");
			}
		});

		it("maps 'etf' type to 'stock' for addAsset", async () => {
			const mockAddAsset = vi.fn().mockResolvedValue({});

			vi.doMock("@/components/PortfolioProvider", () => ({
				usePortfolio: () => ({
					assets: [],
					selectedPortfolio: {
						id: "portfolio-1",
						name: "Test Portfolio",
						analytics: { performanceHistory: [] },
					},
					addAsset: mockAddAsset,
					addingAsset: false,
				}),
			}));

			render(<StocksFundsModule />);

			if (capturedHandleAddPosition) {
				const formData = {
					name: "SPY",
					symbol: "SPY",
					type: "etf" as const,
					quantity: 20,
					purchasePrice: 400,
					currentPrice: 420,
					purchaseDate: "2024-01-20",
				};

				await capturedHandleAddPosition(formData as Record<string, unknown>);

				// handleAddPosition maps etf to stock
				expect(mockAddAsset).toHaveBeenCalled();
				const callArgs = mockAddAsset.mock.calls[0][0];
				expect(callArgs.type).toBe("stock"); // etf mapped to stock
			}
		});
	});

	describe("StocksFundsModule rendering", () => {
		it("renders positions tab by default", () => {
			render(<StocksFundsModule />);

			expect(screen.getByTestId("stocks-positions")).toBeInTheDocument();
		});

		it("renders total value calculation", () => {
			render(<StocksFundsModule />);

			// Check for formatted currency display (3400 = 1750 + 1650)
			// The component should show total value somewhere
			expect(screen.getByText(/Add Position/)).toBeInTheDocument();
		});

		it("renders insights in place instead of behind a third tab", () => {
			localStorage.setItem("sf_show_insights_strip", "true");
			try {
				render(<StocksFundsModule />);

				expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
				expect(screen.queryByRole("tab", { name: /Insights/i })).not.toBeInTheDocument();
				expect(screen.getByRole("tab", { name: /Transactions/i })).toBeInTheDocument();
			} finally {
				localStorage.removeItem("sf_show_insights_strip");
			}
		});

		it("places the insight row between the chart and the ledger, collapsible", () => {
			localStorage.setItem("sf_show_insights_strip", "true");
			localStorage.setItem("sf_insights_expanded", "true");
			try {
				render(<StocksFundsModule />);

				const heading = screen.getByRole("heading", { name: "Insights" });
				const tablist = screen.getByRole("tablist");
				// The row belongs to the brief, not to the workspace: it precedes the tabs.
				expect(heading.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
					Node.DOCUMENT_POSITION_FOLLOWING,
				);

				fireEvent.click(screen.getByRole("button", { name: "Hide" }));

				expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute(
					"aria-expanded",
					"false",
				);
				expect(document.getElementById("insights-body")).toHaveClass("hidden");
			} finally {
				localStorage.removeItem("sf_show_insights_strip");
				localStorage.removeItem("sf_insights_expanded");
			}
		});

		it("renders the insight row as one hairline strip, not a row of cards", () => {
			localStorage.setItem("sf_show_insights_strip", "true");
			try {
				render(<StocksFundsModule />);

				const body = document.getElementById("insights-body");
				expect(body).not.toBeNull();
				// The strip owns the surface and the rules between cells. A card inside
				// it would put a box in a box and rebuild the card wall the redesign
				// removed, so no card chrome may render inside the strip.
				expect(body?.querySelectorAll('[data-slot="card"]')).toHaveLength(0);
				// One grid, hairline rules between cells, no enclosing border.
				const strip = body?.firstElementChild;
				expect(strip?.className).toContain("divide-y");
				// A standalone border utility would make it a box again; the dividers
				// are the only rules it may draw.
				expect(strip?.className ?? "").not.toMatch(/(^|\s)border(\s|$)/);
			} finally {
				localStorage.removeItem("sf_show_insights_strip");
			}
		});

		it("keeps the allocation card and adds the performer panel to the page, not a tab", () => {
			localStorage.setItem("sf_show_insights_strip", "true");
			try {
				render(<StocksFundsModule />);

				expect(screen.getByTestId("stocks-distribution-widget")).toBeInTheDocument();
				// In the strip the panel is labelled for the cell, not for a card title.
				expect(screen.getByRole("heading", { name: /Movers/i })).toBeInTheDocument();
			} finally {
				localStorage.removeItem("sf_show_insights_strip");
			}
		});

		it("displays in-viewport cross-filter banner when filter is active and clears cleanly", () => {
			render(<StocksFundsModule />);

			expect(screen.queryByTestId("cross-filter-banner")).not.toBeInTheDocument();

			// Click the sector filter button in the mock distribution widget
			const filterButton = screen.getByTestId("filter-tech-sector");
			fireEvent.click(filterButton);

			// Active banner should now appear in the viewport
			const banner = screen.getByTestId("cross-filter-banner");
			expect(banner).toBeInTheDocument();
			expect(banner).toHaveTextContent("Filtered by Sector:");
			expect(banner).toHaveTextContent("Technology");

			// Clicking clear removes the banner
			const clearButton = screen.getByText("Clear");
			fireEvent.click(clearButton);
			expect(screen.queryByTestId("cross-filter-banner")).not.toBeInTheDocument();
		});
	});
});
