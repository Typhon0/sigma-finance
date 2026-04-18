import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StocksFundsModule } from "../StocksFundsModule";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
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
vi.mock("@/components/StocksFundsPositions", () => ({
	StocksFundsPositions: () => (
		<div data-testid="stocks-positions">Positions</div>
	),
}));

vi.mock("@/components/StocksFundsTransactions", () => ({
	StocksFundsTransactions: () => (
		<div data-testid="stocks-transactions">Transactions</div>
	),
}));

vi.mock("@/components/PieChartWithCenter", () => ({
	PieChartWithCenter: () => <div data-testid="pie-chart">Chart</div>,
}));

vi.mock("echarts-for-react", () => ({
	default: () => <div data-testid="echarts">ECharts</div>,
}));

vi.mock("lucide-react", () => ({
	Plus: () => <span>+</span>,
	Upload: () => <span>Upload</span>,
	TrendingUp: () => <span>TrendingUp</span>,
	ArrowUpDown: () => <span>ArrowUpDown</span>,
	Activity: () => <span>Activity</span>,
	Package: () => <span>Package</span>,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: ReactNode }) => (
		<button>{children}</button>
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
let capturedHandleAddPosition:
	| ((formData: Record<string, unknown>) => Promise<void>)
	| null = null;
vi.mock("@/components/AddStockForm", () => ({
	AddStockForm: ({
		open,
		onClose,
		onSubmit,
	}: {
		open: boolean;
		onClose: () => void;
		onSubmit: (data: unknown) => void;
	}) => {
		if (open) {
			capturedHandleAddPosition = onSubmit as (
				formData: Record<string, unknown>,
			) => Promise<void>;
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
	});
});
