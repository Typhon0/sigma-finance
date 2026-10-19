import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset as StockAsset } from "@/components/stocks-funds/types";
import { StockDetail } from "../assets/stocks-funds/StockDetail";
import { TaxLotsTab } from "../assets/stocks-funds/TaxLotsTab";
import { resolveFxBasis } from "../stocks-funds/fx-valuation";

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
	useTheme: () => ({ theme: "dark", resolvedTheme: "dark" }),
}));

// Mock auth — StockDetail and useCurrency read the signed-in user.
vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => ({ user: { id: "test-user", displayCurrency: "USD" }, loading: false }),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: { id: "test-user", displayCurrency: "USD" }, loading: false }),
}));

// Mock sonner
vi.mock("sonner", () => ({
	toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Mock Apollo useQuery for tax lots
const mockTaxLots = [
	{
		id: "lot-1",
		portfolioId: "p-1",
		positionId: "pos-1",
		assetId: "a-1",
		acquiredAt: "2023-01-15T10:00:00Z",
		initialQuantity: 10,
		remainingQuantity: 10,
		costBasisPerUnit: 180,
		totalCostBasis: 1800,
		currency: "USD",
		status: "OPEN",
		holdingPeriodDays: 450,
		isLongTerm: true,
		currentPrice: 150,
		currentValue: 1500,
		unrealizedGainLoss: -300,
		unrealizedGainLossPercent: -16.67,
	},
	{
		id: "lot-2",
		portfolioId: "p-1",
		positionId: "pos-1",
		assetId: "a-1",
		acquiredAt: "2024-05-10T10:00:00Z",
		initialQuantity: 5,
		remainingQuantity: 5,
		costBasisPerUnit: 140,
		totalCostBasis: 700,
		currency: "USD",
		status: "OPEN",
		holdingPeriodDays: 120,
		isLongTerm: false,
		currentPrice: 150,
		currentValue: 750,
		unrealizedGainLoss: 50,
		unrealizedGainLossPercent: 7.14,
	},
];

// Mutable so a test can simulate a position with no recorded lots.
let mockQueryState: {
	lots: typeof mockTaxLots;
	loading: boolean;
	error: Error | undefined;
} = { lots: mockTaxLots, loading: false, error: undefined };

// Variables of the most recent useQuery call, so a test can assert which
// position id the tax-lots request actually carried.
let lastQueryVariables: Record<string, unknown> | undefined;

vi.mock("@apollo/client", () => ({
	gql: (strings: TemplateStringsArray) => strings.join(""),
	useMutation: () => [vi.fn().mockResolvedValue({ data: null }), { loading: false }],
	useQuery: (_document: unknown, options?: { variables?: Record<string, unknown> }) => {
		lastQueryVariables = options?.variables;
		return {
			data: {
				taxLotsByPosition: mockQueryState.lots,
			},
			loading: mockQueryState.loading,
			error: mockQueryState.error,
		};
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

// Normalized position as StockDetail receives it from StocksFundsModule.
const cleanFxValuation = {
	costBasisConverted: true,
	costBasisCurrency: "USD",
	costBasisDisplay: 1500,
	costBasisNative: 1500,
	hasDisplayValue: true,
	isExcluded: false,
	isStale: false,
	quoteCurrency: "USD",
	displayCurrency: "USD",
	fxAsOf: null,
};

const summaryPosition: StockAsset = {
	id: "pos-1",
	portfolioId: "portfolio-1",
	symbol: "AAPL",
	name: "Apple Inc.",
	type: "stock",
	quantity: 10,
	avgCost: 150,
	currentPrice: 200,
	totalValue: 2000,
	totalReturn: 500,
	totalReturnPercentage: 33.33,
	dayChangePercentage: 1.5,
	hasDayChange: true,
	account: "Manual Entry",
	sector: "Technology",
	currency: "USD",
	fx: resolveFxBasis(cleanFxValuation),
	portfolioWeight: 50,
	sparklineData: [],
};

describe("TaxLotsTab Component", () => {
	beforeEach(() => {
		mockQueryState = { lots: mockTaxLots, loading: false, error: undefined };
	});

	it("renders summary KPIs and lots ledger correctly", () => {
		render(
			<TaxLotsTab
				positionId="pos-1"
				symbol="AAPL"
				currency="USD"
				currentPrice={150}
				totalQuantity={15}
				averageCost={166.67}
			/>,
		);

		// Header & title
		expect(screen.getByText(/Tax-Lot Accounting & Capital Gains/i)).toBeInTheDocument();
		expect(screen.getByText(/Holdings Lot Ledger/i)).toBeInTheDocument();

		// Check cards
		expect(screen.getByText("Total Cost Basis")).toBeInTheDocument();
		expect(screen.getByText("Current Value")).toBeInTheDocument();
		expect(screen.getAllByText(/Short-Term/i).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/Long-Term/i).length).toBeGreaterThan(0);
		expect(screen.getByText("Tax-Loss Harvest")).toBeInTheDocument();

		// Check Tax Loss Harvest badge on the losing lot
		expect(screen.getByText("Harvestable")).toBeInTheDocument();
	});

	it("renders tax-loss harvesting opportunity card when losses exist", () => {
		render(
			<TaxLotsTab
				positionId="pos-1"
				symbol="AAPL"
				currency="USD"
				currentPrice={150}
				totalQuantity={15}
				averageCost={166.67}
			/>,
		);

		expect(screen.getByText(/Tax-Loss Harvest/i)).toBeInTheDocument();
		expect(
			screen.getByText(/Offset realized gains by selling high-cost lots \(HIFO\)/i),
		).toBeInTheDocument();
		expect(screen.getByText(/1 Lots Eligible/i)).toBeInTheDocument();
	});
});

// Regression guard: an empty backend result must render an explanation, never
// synthetic lots. The removed fallback derived cost basis, acquisition dates
// and holding periods from averageCost, which produced tax-loss-harvesting
// advice the user could act on.
describe("TaxLotsTab with no recorded lots", () => {
	beforeEach(() => {
		mockQueryState = { lots: [], loading: false, error: undefined };
	});

	it("explains that no lots exist instead of inventing them", () => {
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		expect(screen.getByText(/No tax lots recorded for AAPL/i)).toBeInTheDocument();
		expect(
			screen.getByText(/created when a purchase transaction is recorded/i),
		).toBeInTheDocument();
	});

	it("never renders fabricated cost basis, dates, or harvesting advice", () => {
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		// The old fallback invented these; their absence is the guarantee.
		expect(screen.queryByText(/Offset realized gains/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Lots Eligible/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Total Cost Basis/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Tax-Loss Harvest/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Long-Term/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Short-Term/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/410d|95d/)).not.toBeInTheDocument();
	});

	it("hides the lot strategy selector when there is nothing to allocate", () => {
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		expect(screen.queryByText(/Lot Strategy:/i)).not.toBeInTheDocument();
	});
});

describe("TaxLotsTab request failure", () => {
	it("reports the failure rather than implying there are no lots", () => {
		mockQueryState = { lots: [], loading: false, error: new Error("network down") };

		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		expect(screen.getByText(/Could not load tax lots/i)).toBeInTheDocument();
		expect(screen.queryByText(/No tax lots recorded/i)).not.toBeInTheDocument();
	});
});

describe("StockDetail Component Tab Integration", () => {
	it("renders Overview, Research and Tax Lots & Gains tabs", () => {
		render(
			<StockDetail
				symbol="AAPL"
				positionId="pos-1"
				quantity={15}
				averageCost={166.67}
				currentPrice={150}
				currency="USD"
			/>,
		);

		// Header identity
		expect(screen.getByText("AAPL")).toBeInTheDocument();

		// Tab triggers
		const overviewTab = screen.getByRole("tab", { name: /Overview/i });
		const researchTab = screen.getByRole("tab", { name: /Research/i });
		const taxLotsTab = screen.getByRole("tab", { name: /Tax Lots & Gains/i });
		expect(overviewTab).toBeInTheDocument();
		expect(researchTab).toBeInTheDocument();
		expect(taxLotsTab).toBeInTheDocument();

		// Active shares badge in tab
		expect(screen.getByText("15 sh")).toBeInTheDocument();

		// Overview opens on the position summary; third-party widgets live in
		// Research only. Without a `position` prop there is no summary to show.
		expect(screen.getByText(/No position details available/i)).toBeInTheDocument();
		expect(screen.queryByTestId("symbol-info")).not.toBeInTheDocument();
	});

	it("renders the position summary on the Overview tab", () => {
		render(<StockDetail symbol="AAPL" position={summaryPosition} />);

		expect(screen.getByText("Position Value")).toBeInTheDocument();
		expect(screen.getAllByText("$2,000.00")[0]).toBeInTheDocument();
		expect(screen.getAllByText("+$29.56")[0]).toBeInTheDocument();
		expect(screen.getAllByText(/\+1\.50%/)[0]).toBeInTheDocument();
		expect(screen.getAllByText("+$500.00")[0]).toBeInTheDocument();
		expect(screen.getAllByText("+33.33%")[0]).toBeInTheDocument();
		expect(screen.getAllByText(/50(\.0+)?%/)[0]).toBeInTheDocument();
	});

	it("suppresses the P&L percentage when the server could not convert the basis", () => {
		const gated: StockAsset = {
			...summaryPosition,
			fx: resolveFxBasis({ ...cleanFxValuation, costBasisCurrency: "EUR", costBasisConverted: false }),
		};
		render(<StockDetail symbol="AAPL" position={gated} />);

		expect(screen.getAllByText("% n/a")[0]).toBeInTheDocument();
		expect(screen.queryByText("+33.33%")).not.toBeInTheDocument();
	});

	it("hides the day delta when the provider supplied no day-change figure", () => {
		render(<StockDetail symbol="AAPL" position={{ ...summaryPosition, hasDayChange: false }} />);

		expect(screen.getAllByText("$2,000.00")[0]).toBeInTheDocument();
		expect(screen.queryByText("today")).not.toBeInTheDocument();
	});

	it("renders Tax Lots view when initialTab is set to tax-lots", () => {
		render(
			<StockDetail
				symbol="AAPL"
				positionId="pos-1"
				quantity={15}
				averageCost={166.67}
				currentPrice={150}
				currency="USD"
				initialTab="tax-lots"
			/>,
		);

		// Tax lots tab content should be visible
		expect(screen.getByText(/Tax-Lot Accounting & Capital Gains/i)).toBeInTheDocument();
		expect(screen.getByText(/Holdings Lot Ledger/i)).toBeInTheDocument();
	});

	// Regression guard: the tax-lots endpoint resolves `positions.id`, while
	// `positionId` is an asset id. The tab used to send the asset id, which the
	// server answered with "position not found" — a request failure masked as a
	// missing-lots state. The real position id must win.
	it("sends the server position id to the tax-lots queries, not the asset id", () => {
		lastQueryVariables = undefined;
		render(
			<StockDetail
				symbol="AAPL"
				position={{ ...summaryPosition, positionId: "position-9" }}
				positionId="asset-id-1"
				initialTab="tax-lots"
			/>,
		);

		expect(lastQueryVariables?.positionId).toBe("position-9");
	});
});
