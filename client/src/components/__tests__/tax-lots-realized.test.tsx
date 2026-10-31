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

// Closed lots backing the dispositions above: the ledger refuses to print a
// unified sum whose currency basis it cannot resolve, so each disposition's
// source lot must exist (and record its currency) for the trio to print.
const mockClosedLots = [
	{
		id: "lot-1",
		positionId: "pos-1",
		status: "CLOSED",
		currency: "USD",
		remainingQuantity: 0,
		initialQuantity: 10,
		costBasisPerUnit: 100,
		currentPrice: 0,
		currentValue: 0,
		unrealizedGainLoss: null,
		acquiredAt: "2023-01-15T10:00:00Z",
		method: "FIFO",
	},
	{
		id: "lot-2",
		positionId: "pos-1",
		status: "CLOSED",
		currency: "USD",
		remainingQuantity: 0,
		initialQuantity: 5,
		costBasisPerUnit: 200,
		currentPrice: 0,
		currentValue: 0,
		unrealizedGainLoss: null,
		acquiredAt: "2025-11-01T10:00:00Z",
		method: "FIFO",
	},
];

// Tests may reseed a mixed-currency ledger; `useQuery` reads the let below.
let mockLots = mockClosedLots.slice();

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
		// taxLotsByPosition: closed lots only (remainingQuantity is 0, so the
		// component's `> 0` filter keeps the unrealized section hidden), while
		// the dispositions keep their resolvable currency basis.
		return { data: { taxLotsByPosition: mockLots }, loading: false, error: undefined };
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
		// Every test starts from the same ledger; a test that reseeds a
		// different currency shape must not leak it into the next one.
		mockLots = mockClosedLots.slice();
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

	it("withholds unified sums when lots record several currencies, rows keep their own", () => {
		mockLots = mockClosedLots.map((lot, index) => ({
			...lot,
			currency: index === 0 ? "USD" : "EUR",
		}));

		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		// No unified sum is a number in one currency — the cards and the
		// realized trio dash, and the explanation names the reason.
		expect(screen.getByText(/Recorded lots span more than one currency/)).toBeInTheDocument();
		expect(screen.getByText(/Dispositions stand in more than one currency/)).toBeInTheDocument();
		expect(screen.queryByText("+$250.00")).not.toBeInTheDocument();

		// The rows never stop printing their own recorded figure, each in its
		// own currency symbol.
		expect(screen.getByText("$100.00")).toBeInTheDocument();
		expect(screen.getByText("€200.00")).toBeInTheDocument();
	});

	it("withholds unified sums when one lot's currency is unreadable, and dashes that row", () => {
		mockLots = mockClosedLots.map((lot, index) => ({
			...lot,
			currency: index === 0 ? "" : "USD",
		}));

		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		// A single readable currency does not license a unified print while
		// another contributing lot never names one — the sum would absorb a
		// figure whose basis never resolved.
		expect(screen.getByText(/recorded cost currency is unreadable/i)).toBeInTheDocument();
		expect(
			screen.getByText(/dispositions' recorded currency basis is unreadable/i),
		).toBeInTheDocument();
		expect(screen.queryByText("+$250.00")).not.toBeInTheDocument();

		// The row whose record names no currency prints dashes rather than
		// inheriting the position's; its sibling still prints its own.
		expect(screen.queryByText("$100.00")).not.toBeInTheDocument();
		expect(screen.getByText("$200.00")).toBeInTheDocument();
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
