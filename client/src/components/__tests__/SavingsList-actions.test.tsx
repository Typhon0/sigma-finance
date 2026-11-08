import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { SavingsList } from "../assets/savings/SavingsList";

// Mock resize-observer and echarts
vi.mock("@/components/charts/EChart", () => ({
	default: () => <div data-testid="echarts-mock" />,
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "EUR",
		formatCurrency: (val: number) => `€${val.toFixed(2)}`,
		formatCurrencyCompact: (val: number) => `€${val}`,
		formatCurrencyAdaptive: (val: number) => `€${val}`,
	}),
}));

const mockAssets = [
	{
		id: "asset-saving-1",
		name: "Livret A",
		type: "savings",
		institution: "BoursoBank",
		accountNumber: "FR76 1234 5678 9012",
		currency: "EUR",
		balance: 10000,
		currentValue: 10000,
		interestRate: 3.0,
		accountType: "savings",
		symbol: "LIVRET-A",
	},
	{
		id: "asset-saving-2",
		name: "Compte à Terme",
		type: "savings",
		institution: "BNP Paribas",
		accountNumber: "FR76 9876 5432 1098",
		currency: "EUR",
		balance: 15000,
		currentValue: 15000,
		interestRate: 3.5,
		accountType: "term_deposit",
		symbol: "CAT",
	},
];

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: mockAssets,
		transactions: [],
		currentPortfolio: "port-1",
		selectedPortfolio: { id: "port-1" },
		refetch: vi.fn(),
		deleteAsset: vi.fn(),
		getPortfolioValue: () => 25000,
	}),
}));

describe("SavingsList actions and Private Terminal UI", () => {
	const createMocks = () => [
		{
			request: {
				query: GET_SCOPED_PERFORMANCE_HISTORY,
				variables: { portfolioID: "port-1", assetTypes: ["BANK_ACCOUNT"] },
			},
			result: {
				data: { scopedPerformanceHistory: [] },
			},
		},
	];

	it("renders savings ledger with real balances and APY rates", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<SavingsList />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getAllByText("Livret A").length).toBeGreaterThan(0);
			expect(screen.getByText("Compte à Terme")).toBeInTheDocument();
			expect(screen.getByText("3.00%")).toBeInTheDocument();
			expect(screen.getByText("3.50%")).toBeInTheDocument();
		});
	});

	it("renders 70/30 hero section with exposure widget", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<SavingsList />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("Savings & Cash Reserves")).toBeInTheDocument();
			expect(screen.getByText("Institution & Allocation Split")).toBeInTheDocument();
			expect(screen.getByText("Weighted APY")).toBeInTheDocument();
			expect(screen.getByText("Est. annual yield")).toBeInTheDocument();
		});
	});

	it("activates active cross-filter banner when clicking an institution slice", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<SavingsList />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getAllByText("BoursoBank").length).toBeGreaterThan(0);
		});

		// Click the BoursoBank slice button in the exposure widget
		const boursoSliceBtn = screen.getByRole("button", { name: /BoursoBank/i });
		fireEvent.click(boursoSliceBtn);

		await waitFor(() => {
			expect(screen.getByTestId("cross-filter-banner")).toBeInTheDocument();
			expect(screen.getByText("Filtered by Institution:")).toBeInTheDocument();
		});

		// Clear filter
		const clearBtn = screen.getByText("Clear");
		fireEvent.click(clearBtn);

		await waitFor(() => {
			expect(screen.queryByTestId("cross-filter-banner")).not.toBeInTheDocument();
		});
	});

	it("switches between Savings Ledger and Holdings détaillées tabs", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<SavingsList />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("Savings Ledger")).toBeInTheDocument();
			expect(screen.getByText("Holdings détaillées")).toBeInTheDocument();
		});

		const holdingsTab = screen.getByText("Holdings détaillées");
		fireEvent.click(holdingsTab);

		await waitFor(() => {
			expect(holdingsTab.closest("button")).toHaveAttribute("aria-selected", "true");
		});
	});

	it("opens slide-over detail sheet on account click", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<SavingsList />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getAllByText("Livret A").length).toBeGreaterThan(0);
		});

		const livretRow = screen.getAllByText("Livret A")[0].closest("tr");
		if (livretRow) {
			fireEvent.click(livretRow);
		}

		await waitFor(() => {
			expect(screen.getByText("Account Metadata & Specifications")).toBeInTheDocument();
			expect(screen.getAllByText("Est. Annual Yield").length).toBeGreaterThan(0);
		});
	});

	it("opens Add Account dialog when clicking Add Account button", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<SavingsList />
			</MockedProvider>,
		);

		const addBtn = screen.getByRole("button", { name: /add account/i });
		fireEvent.click(addBtn);

		await waitFor(() => {
			expect(screen.getAllByText("Add Savings Account").length).toBeGreaterThan(0);
		});
	});
});
