import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { RealEstateList } from "../assets/real-estate/RealEstateList";

// Mock resize-observer and echarts
vi.mock("@/components/charts/EChart", () => ({
	default: () => <div data-testid="echarts-mock" />,
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "EUR",
		formatCurrency: (val: number) => `€${val.toLocaleString()}`,
		formatCurrencyCompact: (val: number) => `€${val}`,
		formatCurrencyAdaptive: (val: number) => `€${val}`,
	}),
}));

const mockRealEstateAssets = [
	{
		id: "re-1",
		portfolioId: "port-1",
		type: "real_estate",
		name: "Villa Cap Ferret",
		symbol: "VCF",
		propertyType: "House",
		address: "12 Avenue de l'Océan",
		city: "Cap Ferret",
		country: "France",
		zipCode: "33970",
		surfaceArea: 180,
		yearBuilt: 2018,
		bedrooms: 4,
		bathrooms: 3,
		currentValue: 1250000,
		purchasePrice: 980000,
		purchaseDate: "2020-05-15T00:00:00Z",
		quantity: 1,
		currentPrice: 1250000,
		sector: null,
		exchange: null,
		dayChange: null,
		dayChangePercent: null,
		portfolioWeight: 65,
		sparklineData: [],
		fx: { canBackReturn: true, isStale: false },
		ownershipPercentage: 100,
		ownershipStructure: "Nom propre",
		linkedLoanId: "loan-1",
		monthlyRent: 3500,
		utilityCosts: 200,
		yearlyMiscCosts: 2400,
	},
	{
		id: "re-2",
		portfolioId: "port-1",
		type: "real_estate",
		name: "Appartement Marais",
		symbol: "MAR",
		propertyType: "Apartment",
		address: "4 Rue des Rosiers",
		city: "Paris",
		country: "France",
		zipCode: "75004",
		surfaceArea: 65,
		yearBuilt: 1890,
		bedrooms: 2,
		bathrooms: 1,
		currentValue: 720000,
		purchasePrice: 650000,
		purchaseDate: "2022-09-01T00:00:00Z",
		quantity: 1,
		currentPrice: 720000,
		sector: null,
		exchange: null,
		dayChange: null,
		dayChangePercent: null,
		portfolioWeight: 35,
		sparklineData: [],
		fx: { canBackReturn: true, isStale: false },
		ownershipPercentage: 50,
		ownershipStructure: "SCI à l'IS",
	},
	{
		id: "loan-1",
		portfolioId: "port-1",
		type: "loan",
		name: "Prêt Immo Cap Ferret",
		lender: "Crédit Agricole",
		loanAmount: 800000,
		remainingBalance: 500000,
		monthlyPayment: 2100,
		linkedAssetIDs: ["re-1"],
	},
];

const mockDeleteAsset = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: mockRealEstateAssets,
		currentPortfolio: "port-1",
		selectedPortfolio: { id: "port-1", name: "Main Portfolio" },
		refetch: mockRefetch,
		deleteAsset: mockDeleteAsset,
		getPortfolioValue: () => 1970000,
	}),
}));

const scopedHistoryMock = {
	request: {
		query: GET_SCOPED_PERFORMANCE_HISTORY,
		variables: {
			portfolioID: "port-1",
			assetTypes: ["REAL_ESTATE"],
		},
	},
	result: {
		data: {
			scopedPerformanceHistory: [
				{ date: "2024-01-01", value: 1630000 },
				{ date: "2024-06-01", value: 1800000 },
				{ date: "2024-11-01", value: 1970000 },
			],
		},
	},
};

describe("RealEstateList Private Terminal actions", () => {
	it("renders 70/30 hero section and canonical page header", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		// Header checks
		expect(screen.getByText("Real Estate")).toBeInTheDocument();
		expect(screen.getByText(/2 properties/)).toBeInTheDocument();
		expect(screen.getAllByText(/245 m²/).length).toBeGreaterThanOrEqual(1);
		expect(screen.getByRole("button", { name: /Add Property/i })).toBeInTheDocument();

		// 70/30 Hero Chart & Exposure Widget checks
		expect(screen.getByText("Real Estate Portfolio Valuation")).toBeInTheDocument();
		expect(screen.getByText("Exposure Split")).toBeInTheDocument();
		expect(screen.getByText("By Type")).toBeInTheDocument();
		expect(screen.getByText("By City")).toBeInTheDocument();

		// Properties rendered in the Ledger table
		expect(screen.getByText("Villa Cap Ferret")).toBeInTheDocument();
		expect(screen.getByText("Appartement Marais")).toBeInTheDocument();
	});

	it("switches between Real Estate Ledger and Holdings & Specifications tabs", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		const holdingsTab = screen.getByRole("tab", { name: /Holdings & Specifications/i });
		fireEvent.click(holdingsTab);

		// Should render property dossier cards
		expect(await screen.findByText(/Cap Ferret, France/i)).toBeInTheDocument();
		expect(screen.getAllByText(/Inspect/i).length).toBe(2);

		const ledgerTab = screen.getByRole("tab", { name: /Real Estate Ledger/i });
		fireEvent.click(ledgerTab);

		expect(screen.getByText("Surface & €/m²")).toBeInTheDocument();
	});

	it("activates cross-filter when clicking an exposure slice and allows clearing", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		// Click on House slice
		const houseSliceBtn = screen.getByRole("button", { name: /House/i });
		fireEvent.click(houseSliceBtn);

		// Active cross-filter banner appears
		expect(await screen.findByTestId("cross-filter-banner")).toBeInTheDocument();
		expect(screen.getByText("Filtered by Type:")).toBeInTheDocument();

		// Ledger now only shows Villa Cap Ferret
		expect(screen.getByText("Villa Cap Ferret")).toBeInTheDocument();
		expect(screen.queryByText("Appartement Marais")).not.toBeInTheDocument();

		// Click Clear button on banner
		const clearBtn = screen.getByRole("button", { name: /Clear/i });
		fireEvent.click(clearBtn);

		// Both properties visible again
		expect(screen.getByText("Villa Cap Ferret")).toBeInTheDocument();
		expect(screen.getByText("Appartement Marais")).toBeInTheDocument();
	});

	it("toggles table density between compact and normal", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		const densityBtn = screen.getByTitle("Toggle table row height");
		expect(densityBtn).toHaveTextContent(/Compact/i);

		fireEvent.click(densityBtn);
		expect(densityBtn).toHaveTextContent(/Normal/i);
	});

	it("opens slide-over Sheet with honest metrics on property click", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		// Click on Villa Cap Ferret row
		const propertyRow = screen.getByText("Villa Cap Ferret");
		fireEvent.click(propertyRow);

		// Slide-over Sheet content should appear
		expect(await screen.findByRole("heading", { name: "Villa Cap Ferret" })).toBeInTheDocument();
		expect(screen.getByText("Valuation Trajectory")).toBeInTheDocument();
		expect(
			screen.getByText("Honest linear appreciation between acquisition and current recorded value"),
		).toBeInTheDocument();
		expect(screen.getByText("Property Specifications")).toBeInTheDocument();
		expect(screen.getAllByText(/180 m²/).length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("4")).toBeInTheDocument();
	});

	it("opens the Add Real Estate property dialog and navigates tabs", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		const addBtn = screen.getByRole("button", { name: /Add Property/i });
		fireEvent.click(addBtn);

		// Modal should open
		expect(await screen.findByRole("heading", { name: "Add Real Estate Property" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "1. Identity" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "2. Financials" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "3. Specs" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "4. Quality" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "5. Rental" })).toBeInTheDocument();

		// Click on tab 2
		fireEvent.click(screen.getByRole("tab", { name: "2. Financials" }));
		expect(screen.getByLabelText(/Current Valuation/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Net Purchase Price/i)).toBeInTheDocument();

		// Click on tab 3
		fireEvent.click(screen.getByRole("tab", { name: "3. Specs" }));
		expect(screen.getByLabelText(/Year Built/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Living Area/i)).toBeInTheDocument();

		// Click on tab 5
		fireEvent.click(screen.getByRole("tab", { name: "5. Rental" }));
		expect(screen.getByLabelText(/Gross Monthly Rent/i)).toBeInTheDocument();
	});

	it("toggles between Valeur Brute and Valeur Nette in Hero section", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		// Initially Valeur Brute is selected
		const netBtn = screen.getByRole("button", { name: /Valeur Nette/i });
		expect(netBtn).toBeInTheDocument();

		// Click on Valeur Nette
		fireEvent.click(netBtn);

		// Telemetry strip updates to reflect debt and net equity
		expect(screen.getAllByText(/Dette:/i).length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText(/LTV:/i).length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText(/€500,000/i).length).toBeGreaterThanOrEqual(1);
	});

	it("displays Debt & LTV card and allows inline editing in slide-over Sheet", async () => {
		render(
			<MockedProvider mocks={[scopedHistoryMock]}>
				<RealEstateList />
			</MockedProvider>,
		);

		// Click on Villa Cap Ferret (linked to loan-1)
		const propertyRow = screen.getByText("Villa Cap Ferret");
		fireEvent.click(propertyRow);

		// Sheet opens with Debt & LTV card
		expect(await screen.findByRole("heading", { name: "Villa Cap Ferret" })).toBeInTheDocument();
		expect(screen.getByText(/Bank Financing & LTV Ratio/i)).toBeInTheDocument();
		expect(screen.getByText(/Crédit Agricole/i)).toBeInTheDocument();
		expect(screen.getByText(/Remaining Debt/i)).toBeInTheDocument();
		expect(screen.getByText(/Net Cashflow :/i)).toBeInTheDocument();

		// Click on Edit to enter direct inline editing mode
		const modifyBtn = screen.getByRole("button", { name: /Edit/i });
		fireEvent.click(modifyBtn);

		// Inline form is displayed
		expect(screen.getByText("Edit Property Specifications")).toBeInTheDocument();
		expect(screen.getByText("Identity & Ownership")).toBeInTheDocument();
		expect(screen.getByText("Acquisition & Cost Basis")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();

		// Cancel returns to view mode
		const cancelBtns = screen.getAllByRole("button", { name: /Cancel/i });
		expect(cancelBtns.length).toBeGreaterThanOrEqual(1);
		fireEvent.click(cancelBtns[0]);

		expect(screen.queryByText("Edit Property Specifications")).not.toBeInTheDocument();
		expect(screen.getByText("Property Specifications")).toBeInTheDocument();
	});
});
