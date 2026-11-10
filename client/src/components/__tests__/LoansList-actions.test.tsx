import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoansList } from "../assets/loans/LoansList";

// Mock resize-observer and echarts
vi.mock("@/components/charts/EChart", () => ({
	default: () => <div data-testid="echarts-mock" />,
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "EUR",
		formatCurrency: (val: number) => `€${Math.round(val).toLocaleString()}`,
		formatCurrencyCompact: (val: number) => `€${Math.round(val).toLocaleString()}`,
		formatCurrencyAdaptive: (val: number) => `€${Math.round(val).toLocaleString()}`,
	}),
}));

const mockLinkedRealEstate = {
	id: "re-101",
	portfolioId: "port-1",
	type: "real_estate",
	name: "Villa Hossegor",
	symbol: "VHOS",
	currentValue: 500000,
	purchasePrice: 420000,
};

const mockLoansAssets = [
	{
		id: "loan-1",
		portfolioId: "port-1",
		type: "loan",
		name: "Prêt Principal Villa",
		symbol: "BNP",
		lender: "BNP Paribas",
		loanType: "amortizing",
		loanAmount: 300000,
		remainingBalance: 240000,
		interestRate: 1.85,
		durationMonths: 240,
		monthlyPayment: 1495,
		startDate: "2021-01-01",
		currency: "EUR",
		ownershipPercentage: 100,
		ownershipMode: "personal",
		status: "active",
		linkedAssetIds: ["re-101"],
		downPayment: 60000,
		applicationFee: 1000,
		brokerFee: 1500,
		insuranceFee: 45,
	},
	{
		id: "loan-2",
		portfolioId: "port-1",
		type: "loan",
		name: "Crédit Travaux Appart",
		symbol: "CA",
		lender: "Crédit Agricole",
		loanType: "in-fine",
		loanAmount: 60000,
		remainingBalance: 60000,
		interestRate: 2.4,
		durationMonths: 60,
		monthlyPayment: 120,
		startDate: "2023-06-01",
		currency: "EUR",
		ownershipPercentage: 50,
		ownershipMode: "company",
		status: "active",
		linkedAssetIds: [],
		downPayment: 0,
		applicationFee: 300,
		brokerFee: 0,
		insuranceFee: 15,
	},
	mockLinkedRealEstate,
];

const mockDeleteAsset = vi.fn().mockResolvedValue(true);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: mockLoansAssets,
		currentPortfolio: "port-1",
		selectedPortfolio: { id: "port-1", name: "Main Wealth Portfolio" },
		refetch: mockRefetch,
		deleteAsset: mockDeleteAsset,
		getPortfolioValue: () => 1500000,
	}),
}));

describe("LoansList Private Terminal actions", () => {
	it("renders 70/30 hero section, canonical page header with summary pills, and ledger rows", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		// Canonical Header checks
		expect(screen.getByText("Loans & Debt")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Add Loan/i })).toBeInTheDocument();
		expect(screen.getByText(/2 active/i)).toBeInTheDocument();

		// 70/30 Hero Chart & Exposure Widget checks
		expect(screen.getByText("Total Debt Outstanding")).toBeInTheDocument();
		expect(screen.getByText("Debt Structure")).toBeInTheDocument();
		expect(screen.getByText("Amortizing")).toBeInTheDocument();
		expect(screen.getByText("In fine")).toBeInTheDocument();

		// Ledger Table items & collateral LTV badge
		expect(screen.getByText("Prêt Principal Villa")).toBeInTheDocument();
		expect(screen.getByText("Crédit Travaux Appart")).toBeInTheDocument();
		expect(screen.getByText(/Villa Hossegor/)).toBeInTheDocument();
		expect(screen.getByText(/48% LTV/)).toBeInTheDocument();
	});

	it("switches between Debt Ledger and Holdings & Amortization tabs", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		const holdingsTab = screen.getByRole("tab", { name: /Holdings & Amortization/i });
		fireEvent.click(holdingsTab);

		// Holdings view displays cards with View Schedule buttons
		expect(await screen.findAllByText(/View Schedule/i)).toHaveLength(2);
		expect(screen.getByText(/BNP Paribas/i)).toBeInTheDocument();

		const ledgerTab = screen.getByRole("tab", { name: /Debt Ledger/i });
		fireEvent.click(ledgerTab);

		expect(screen.getByText("Collateral / LTV")).toBeInTheDocument();
	});

	it("activates cross-filter when clicking an exposure slice and allows clearing", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		// Click on Amortizing category button in exposure widget
		const amortizingBtn = screen.getByRole("button", { name: /Amortizing/i });
		fireEvent.click(amortizingBtn);

		// Cross-filter banner appears
		expect(await screen.findByTestId("cross-filter-banner")).toBeInTheDocument();
		expect(screen.getByText("Filtered by Loan Type:")).toBeInTheDocument();

		// Ledger only shows amortizing loan
		expect(screen.getByText("Prêt Principal Villa")).toBeInTheDocument();
		expect(screen.queryByText("Crédit Travaux Appart")).not.toBeInTheDocument();

		// Clear filter
		const clearBtn = screen.getByRole("button", { name: /Clear/i });
		fireEvent.click(clearBtn);

		// Both visible again
		expect(screen.getByText("Prêt Principal Villa")).toBeInTheDocument();
		expect(screen.getByText("Crédit Travaux Appart")).toBeInTheDocument();
	});

	it("toggles table density between compact and normal", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		const densityBtn = screen.getByTitle("Toggle table row height");
		expect(densityBtn).toHaveTextContent(/Compact/i);

		fireEvent.click(densityBtn);
		expect(densityBtn).toHaveTextContent(/Normal/i);
	});

	it("opens slide-over Sheet on loan row click", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		const loanRow = screen.getByText("Prêt Principal Villa");
		fireEvent.click(loanRow);

		// Sheet opens with LoanDetail heading and hybrid schedule
		expect(await screen.findByRole("heading", { name: "Prêt Principal Villa" })).toBeInTheDocument();
		expect(screen.getByText("Amortization Schedule")).toBeInTheDocument();
		expect(screen.getByText("Annual Summary")).toBeInTheDocument();
	});

	it("opens delete confirmation dialog and triggers deleteAsset", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		const moreBtn = screen.getAllByRole("button", { name: /Loan actions/i })[0];
		fireEvent.keyDown(moreBtn, { key: "Enter" });

		const deleteItem = await screen.findByText(/Delete Loan/i);
		fireEvent.click(deleteItem);

		// Confirmation dialog appears
		expect(await screen.findByText(/Are you sure you want to remove/i)).toBeInTheDocument();

		const confirmDeleteBtn = screen.getByRole("button", { name: "Delete Loan" });
		fireEvent.click(confirmDeleteBtn);

		await waitFor(() => {
			expect(mockDeleteAsset).toHaveBeenCalledWith("loan-1", "port-1");
		});
	});

	it("opens the Add Loan modal dialog", async () => {
		render(
			<MockedProvider mocks={[]}>
				<LoansList />
			</MockedProvider>,
		);

		const addBtn = screen.getByRole("button", { name: /Add Loan/i });
		fireEvent.click(addBtn);

		const headings = await screen.findAllByText("Add a loan");
		expect(headings.length).toBeGreaterThanOrEqual(1);
		expect(screen.getByRole("button", { name: "Information" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Characteristics" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Fees & Ownership" })).toBeInTheDocument();
	});
});
