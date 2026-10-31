import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Mock auth — StockDetail and useCurrency read the signed-in user. The user
// object is mutable so a test can switch the fiscal jurisdiction; the
// beforeEach reset restores the US default.
const mockAuthUser = { id: "test-user", displayCurrency: "USD", taxJurisdiction: "US" };
vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => ({ user: mockAuthUser, loading: false }),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: mockAuthUser, loading: false }),
	useSafeAuth: () => ({ user: mockAuthUser, loading: false }),
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

// Variables of the most recent tax-lots-family useQuery call, so a test can
// assert which position id the request actually carried. Only the
// lots/dispositions queries carry a `positionId`; recording just those keeps
// About's instrument-search call from overwriting the record.
let lastQueryVariables: Record<string, unknown> | undefined;

// Dashboard watchlist payload served to the sheet's membership query. Mutable
// so a test can simulate an existing watchlist; default is none. Reset with
// the lots state below — same test-ordering trap, same cure.
let mockWatchlists: Array<{
	id: string;
	name: string;
	assets: Array<{ id: string; symbol: string }>;
}> = [];

vi.mock("@apollo/client", () => ({
	gql: (strings: TemplateStringsArray) => strings.join(""),
	useMutation: () => [vi.fn().mockResolvedValue({ data: null }), { loading: false }],
	useQuery: (_document: unknown, options?: { variables?: Record<string, unknown> }) => {
		const variables = options?.variables;
		if (variables && "positionId" in variables) {
			lastQueryVariables = variables;
			return {
				data: { taxLotsByPosition: mockQueryState.lots },
				loading: mockQueryState.loading,
				error: mockQueryState.error,
			};
		}
		// Dashboard query (userID): serves the sheet's watch-membership check.
		return { data: { watchlists: mockWatchlists }, loading: false, error: undefined };
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

// Every test starts from the rich fixture. This must live at the top level:
// the "request failure" suite below mutates the shared query state, and
// without a global reset the later StockDetail suites would inherit its
// error/empty state — a test-ordering dependency, not a real behavior.
beforeEach(() => {
	mockQueryState = { lots: mockTaxLots, loading: false, error: undefined };
	mockWatchlists = [];
	mockAuthUser.taxJurisdiction = "US";
});

describe("TaxLotsTab Component", () => {
	it("renders summary KPIs and lots ledger correctly", () => {
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

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
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

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

describe("StockDetail one-page integration", () => {
	it("renders a one-page surface — no tab strip, sections in order", () => {
		render(<StockDetail symbol="AAPL" positionId="pos-1" currentPrice={150} currency="USD" />);

		// Header identity and position actions live in the sticky header. The
		// ticker appears there and again in the About section, so assert on
		// any match rather than a unique one.
		expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
		expect(screen.getByRole("button", { name: /Add AAPL to watchlist/i })).toBeInTheDocument();

		// The five-tab strip is gone: nothing announces itself as a tab.
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();

		// Sections of the one page, in order.
		expect(screen.getByText(/No position details available/i)).toBeInTheDocument();
		expect(screen.getByText(/^Daily quotes$/)).toBeInTheDocument();
		expect(screen.getByText(/Company research/i)).toBeInTheDocument();
		expect(screen.getByText(/Tax-Lot Accounting & Capital Gains/i)).toBeInTheDocument();
		expect(screen.getByText(/Holdings Lot Ledger/i)).toBeInTheDocument();

		// Third-party widgets stay inside the collapsed research disclosure.
		expect(screen.queryByTestId("symbol-info")).not.toBeInTheDocument();
	});

	it("reflects watchlist membership from the cached dashboard lists", () => {
		mockWatchlists = [
			{ id: "wl-1", name: "My Watchlist", assets: [{ id: "pos-1", symbol: "AAPL" }] },
		];
		render(<StockDetail symbol="AAPL" positionId="pos-1" currentPrice={150} currency="USD" />);

		// Membership flips the control into its remove-mode: filled star state
		// ("Watching") and a remove action, not a second "add".
		const watchButton = screen.getByRole("button", { name: /Remove AAPL from watchlist/i });
		expect(watchButton).toHaveTextContent("Watching");
	});

	it("offers alert configuration before committing the alert", () => {
		render(<StockDetail symbol="AAPL" positionId="pos-1" currentPrice={150} currency="USD" />);

		fireEvent.click(screen.getByRole("button", { name: /Set a price alert for AAPL/i }));

		expect(screen.getByText("Set a price alert")).toBeInTheDocument();
		// The threshold is an editable field, not a silently-owned assumption;
		// the default suggestion is +5% of the live price.
		expect(screen.getByLabelText(/Threshold/)).toHaveValue(157.5);
		expect(screen.getByRole("button", { name: "Price rises above" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "Price falls below" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		// The commit button names the exact rule it will create.
		expect(screen.getByRole("button", { name: /Alert above \$157\.50/ })).toBeInTheDocument();
	});

	it("refuses the identical alert for the rest of the session", async () => {
		render(<StockDetail symbol="AAPL" positionId="pos-1" currentPrice={150} currency="USD" />);

		fireEvent.click(screen.getByRole("button", { name: /Set a price alert for AAPL/i }));
		fireEvent.click(screen.getByRole("button", { name: /Alert above \$157\.50/i }));

		// Success closes the popover; the rule lives in the session memory, so
		// reopening the same configuration is refused until the sheet closes.
		await waitFor(() => expect(screen.queryByText("Set a price alert")).not.toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: /Set a price alert for AAPL/i }));
		expect(
			screen.getByText(/Alert already set for this session: AAPL above \$157\.50/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Set alert" })).toBeDisabled();
	});

	it("commits a typed threshold even when no live price has landed", () => {
		// A symbol the portfolio context cannot resolve: no price anywhere, so
		// the +5% default is unavailable and the draft starts at "0".
		render(<StockDetail symbol="XYZ" positionId="pos-1" currency="USD" />);

		fireEvent.click(screen.getByRole("button", { name: /Set a price alert for XYZ/i }));
		fireEvent.change(screen.getByLabelText(/Threshold/), { target: { value: "100" } });

		// A threshold the user typed is an absolute standing rule — it must not
		// silently fail to commit just because quotes have not landed.
		expect(screen.getByRole("button", { name: /Alert above \$100\.00/ })).toBeEnabled();
	});

	it("says truthfully what happens to a committed alert while no alerts surface exists", () => {
		render(<StockDetail symbol="AAPL" positionId="pos-1" currency="USD" />);

		fireEvent.click(screen.getByRole("button", { name: /Set a price alert for AAPL/i }));

		// There is no routed alerts panel in the app today; the footnote may
		// not point at one. Only the storage fact is claimable.
		expect(
			screen.getByText(/stored with this portfolio — an alerts panel is not built yet/i),
		).toBeInTheDocument();
	});

	it("promotes the alerts footnote to a real affordance when a destination is wired", () => {
		render(
			<StockDetail symbol="AAPL" positionId="pos-1" currency="USD" onNavigateToAlerts={() => {}} />,
		);

		fireEvent.click(screen.getByRole("button", { name: /Set a price alert for AAPL/i }));

		expect(screen.getByRole("button", { name: /Manage your alerts/ })).toBeInTheDocument();
	});

	it("renders the position banner and performance block", () => {
		render(<StockDetail symbol="AAPL" position={summaryPosition} />);

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
			fx: resolveFxBasis({
				...cleanFxValuation,
				costBasisCurrency: "EUR",
				costBasisConverted: false,
			}),
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

	it("renders the Tax Lots section without tab state", () => {
		render(<StockDetail symbol="AAPL" positionId="pos-1" currentPrice={150} currency="USD" />);

		// Tax lots section content is visible on the page body itself.
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
			/>,
		);

		expect(lastQueryVariables?.positionId).toBe("position-9");
	});
});

describe("TaxLotsTab fiscal dialect", () => {
	it("speaks US rate vocabulary for a US jurisdiction", () => {
		mockAuthUser.taxJurisdiction = "US";
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		expect(screen.getAllByText("Ordinary Rate").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Pref. 15-20%").length).toBeGreaterThan(0);
	});

	it("speaks FR rate vocabulary for an FR jurisdiction", () => {
		mockAuthUser.taxJurisdiction = "FR";
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		// Flat PFU regardless of term: both holding classes print the same
		// honest rate; no foreign (US) vocabulary survives.
		expect(screen.getAllByText("PFU 30%").length).toBeGreaterThan(0);
		expect(screen.queryByText("Ordinary Rate")).not.toBeInTheDocument();
		expect(screen.queryByText("Pref. 15-20%")).not.toBeInTheDocument();
	});

	it("exempts a PEA envelope instead of raising rate or harvest advice", () => {
		mockAuthUser.taxJurisdiction = "FR";
		render(
			<TaxLotsTab
				positionId="pos-1"
				symbol="AAPL"
				currency="USD"
				currentPrice={150}
				portfolioTaxWrapper="PEA"
			/>,
		);

		expect(screen.getAllByText("PEA Tax-Exempt").length).toBeGreaterThan(0);
		expect(screen.queryByText(/PFU 30%/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Tax-Loss Harvest/)).not.toBeInTheDocument();
		expect(screen.queryByText("Harvestable")).not.toBeInTheDocument();
	});

	it("prints no rate vocabulary at all when the jurisdiction is unknown", () => {
		mockAuthUser.taxJurisdiction = undefined;
		render(<TaxLotsTab positionId="pos-1" symbol="AAPL" currency="USD" currentPrice={150} />);

		// An unknown jurisdiction claims nothing: a dash token for the rates,
		// neutral term badges for the rows.
		expect(screen.getAllByText("—").length).toBeGreaterThan(0);
		expect(screen.queryByText("Ordinary Rate")).not.toBeInTheDocument();
		expect(screen.queryByText("PFU 30%")).not.toBeInTheDocument();
		expect(screen.queryByText("Low Tax Rate")).not.toBeInTheDocument();
		expect(screen.getAllByText(/Long-Term/i).length).toBeGreaterThan(0);
	});
});
