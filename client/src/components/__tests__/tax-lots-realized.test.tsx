import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaxLotsTab } from "../assets/stocks-funds/TaxLotsTab";

// Mock TradingView components
vi.mock("@/components/tradingview", () => ({
	SymbolInfo: () => <div data-testid="symbol-info">SymbolInfo</div>,
	AdvancedRealTimeChart: () => <div>Chart</div>,
	CompanyProfile: () => <div>Profile</div>,
	FundamentalData: () => <div>Fundamentals</div>,
	TechnicalAnalysis: () => <div>Technical</div>,
	Timeline: () => <div>Timeline</div>,
}));

// Mock theme provider
vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ theme: "dark" }),
}));

// Mock sonner
vi.mock("sonner", () => ({
	toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const mockDispositions = [
	{
		id: "disp-1",
		lotId: "lot-1",
		positionId: "pos-1",
		portfolioId: "p-1",
		assetId: "a-1",
		transactionId: "tx-1",
		acquiredAt: "2023-01-15T10:00:00Z",
		soldAt: "2026-03-10T10:00:00Z",
		quantity: 10,
		costBasisPerUnit: 100,
		sellPricePerUnit: 150,
		costBasis: 1000,
		proceeds: 1500,
		realizedGainLoss: 500,
		method: "FIFO",
		holdingPeriodDays: 400,
		isLongTerm: true,
	},
	{
		id: "disp-2",
		lotId: "lot-2",
		positionId: "pos-1",
		portfolioId: "p-1",
		assetId: "a-1",
		transactionId: "tx-2",
		acquiredAt: "2025-11-01T10:00:00Z",
		soldAt: "2026-06-20T10:00:00Z",
		quantity: 5,
		costBasisPerUnit: 200,
		sellPricePerUnit: 150,
		costBasis: 1000,
		proceeds: 750,
		realizedGainLoss: -250,
		method: "FIFO",
		holdingPeriodDays: 30,
		isLongTerm: false,
	},
];

// Mutable per-test state, dispatched per query document so the two useQuery
// calls in the component see independent results.
let mockQueryState: {
	dispositions: typeof mockDispositions;
	loading: boolean;
	error: Error | undefined;
} = { dispositions: mockDispositions, loading: false, error: undefined };

vi.mock("@apollo/client", () => ({
	gql: (strings: TemplateStringsArray) => strings.join(""),
	useQuery: (_doc: unknown) => {
		const doc = String(_doc);
		if (doc.includes("dispositionsByPosition")) {
			return {
				data: { dispositionsByPosition: mockQueryState.dispositions },
				loading: mockQueryState.loading,
				error: mockQueryState.error,
			};
		}
		// taxLotsByPosition: component filters on remainingQuantity > 0; an
		// empty list keeps the unrealized section hidden in these tests.
		return { data: { taxLotsByPosition: [] }, loading: false, error: undefined };
	},
}));

// Mock PortfolioProvider context
vi.mock("@/components/PortfolioProvider", () => ({
	PortfolioContext: {
		Provider: ({ children }: { children: ReactNode }) => children,
		Consumer: ({ children }: { children: (val: unknown) => ReactNode }) => children(null),
	},
	usePortfolio: () => ({
		assets: [
			{
				id: "pos-1",
				symbol: "AAPL",
				name: "Apple Inc.",
				quantity: 15,
				purchasePrice: 166.67,
				currentPrice: 150,
				currency: "USD",
			},
		],
	}),
}));

describe("TaxLotsTab Réalisé (fiscal dispositions)", () => {
	beforeEach(() => {
		mockQueryState = { dispositions: mockDispositions, loading: false, error: undefined };
	});

	it("renders fiscal short/long-term totals from recorded dispositions", () => {
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" />);

		expect(screen.getByText(/Realized — Sales on Record/i)).toBeInTheDocument();
		expect(screen.getByText("Short-Term Realized G/L")).toBeInTheDocument();
		expect(screen.getByText("Long-Term Realized G/L")).toBeInTheDocument();
		expect(screen.getByText("Total Realized G/L")).toBeInTheDocument();

		// Long-term: +$500.00 ; Short-term: -$250.00 ; Total: +$250.00
		// (+$500.00 appears twice: summary card and per-row cell)
		expect(screen.getAllByText("+$500.00").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("-$250.00").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("+$250.00")).toBeInTheDocument();
	});

	it("renders per-disposal rows with sale price, cost basis, proceeds and term", () => {
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" />);

		// Disposal table headers exist
		expect(screen.getByText("Sale Date")).toBeInTheDocument();
		expect(screen.getByText("Realized G/L")).toBeInTheDocument();

		// Lot-matched badge marks this as fiscal, not economic
		expect(screen.getByText("Lot-Matched")).toBeInTheDocument();
	});

	it("renders nothing fabricated when no dispositions exist", () => {
		mockQueryState = { dispositions: [], loading: false, error: undefined };
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" />);

		// No Réalisé section at all — an empty record must not look like $0
		expect(screen.queryByText(/Realized — Sales on Record/i)).not.toBeInTheDocument();
		expect(screen.queryByText("Total Realized G/L")).not.toBeInTheDocument();
	});

	it("stays silent on request failure instead of implying zero gains", () => {
		mockQueryState = {
			dispositions: [],
			loading: false,
			error: new Error("network down"),
		};
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" />);

		expect(screen.queryByText(/Realized — Sales on Record/i)).not.toBeInTheDocument();
		expect(screen.queryByText("+$250.00")).not.toBeInTheDocument();
	});
});
