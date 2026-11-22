import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { InsuranceList } from "../assets/insurance/InsuranceList";

// Mock EChart
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

const mockPolicies = [
	{
		id: "asset-ins-1",
		name: "Linxea Avenir 2",
		type: "insurance",
		insurer: "Suravenir",
		policyNumber: "POL-1001",
		policyType: "life_insurance",
		currency: "EUR",
		purchasePrice: 40000,
		currentValue: 50000,
		coverageAmount: 100000,
		premiumAmount: 200,
		premiumFrequency: "monthly",
		beneficiaries: "Children & Spouse",
		symbol: "LINXEA",
	},
	{
		id: "asset-ins-2",
		name: "Generali PER Horizon",
		type: "insurance",
		insurer: "Generali",
		policyNumber: "PER-2002",
		policyType: "retirement",
		currency: "EUR",
		purchasePrice: 50000,
		currentValue: 60000,
		coverageAmount: 60000,
		premiumAmount: 1200,
		premiumFrequency: "yearly",
		beneficiaries: "Spouse",
		symbol: "GEN-PER",
	},
];

const mockAddLifeInsurance = vi.fn().mockResolvedValue({ asset: { id: "new-ins" } });
const mockRefetch = vi.fn().mockResolvedValue({});

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: mockPolicies,
		currentPortfolio: "port-1",
		selectedPortfolio: { id: "port-1" },
		addLifeInsurance: mockAddLifeInsurance,
		refetch: mockRefetch,
		deleteAsset: vi.fn(),
		updateAsset: vi.fn(),
	}),
}));

const apolloMocks = [
	{
		request: {
			query: GET_SCOPED_PERFORMANCE_HISTORY,
			variables: {
				portfolioID: "port-1",
				assetTypes: ["LIFE_INSURANCE"],
			},
		},
		result: {
			data: {
				scopedPerformanceHistory: [
					{ date: "2026-01-01", value: 90000 },
					{ date: "2026-02-01", value: 110000 },
				],
			},
		},
	},
];

function renderInsuranceList() {
	return render(
		<MockedProvider mocks={apolloMocks} addTypename={false}>
			<InsuranceList detailMode="panel" />
		</MockedProvider>,
	);
}

describe("InsuranceList actions and Private Terminal UI", () => {
	it("renders canonical header with summary pill and policies", () => {
		renderInsuranceList();

		expect(screen.getByText("Insurance & Retirement")).toBeInTheDocument();
		expect(
			screen.getByText(/Manage life insurance policies, PER retirement contracts/),
		).toBeInTheDocument();
		// Summary pill: 2 policies • €110,000 • €160,000 coverage
		expect(screen.getByText(/2 policies • €110,000 • €160,000 coverage/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Add Policy/i })).toBeInTheDocument();
	});

	it("renders 70/30 hero section with AssetHeroChart and InsuranceExposureWidget", () => {
		renderInsuranceList();

		// Left 70% Chart title
		expect(screen.getByText("Insurance & Retirement Capital")).toBeInTheDocument();

		// Right 30% Exposure Widget
		expect(screen.getByText("Exposure & Allocation")).toBeInTheDocument();
		expect(screen.getByText("Guaranteed Capital")).toBeInTheDocument();
		expect(screen.getByText("Annual Premiums")).toBeInTheDocument();
	});

	it("activates active cross-filter banner when clicking an insurer slice", async () => {
		renderInsuranceList();

		// Click on Suravenir slice in widget
		const suravenirBtn = screen.getByText("Suravenir").closest("button");
		expect(suravenirBtn).toBeDefined();
		fireEvent.click(suravenirBtn!);

		// Banner should appear
		await waitFor(() => {
			expect(screen.getByTestId("cross-filter-banner")).toBeInTheDocument();
			expect(screen.getByText("Filtered by Insurer:")).toBeInTheDocument();
		});

		// Click clear
		const clearBtn = screen.getByRole("button", { name: /clear/i });
		fireEvent.click(clearBtn);

		await waitFor(() => {
			expect(screen.queryByTestId("cross-filter-banner")).not.toBeInTheDocument();
		});
	});

	it("switches between Insurance Ledger and Holdings détaillées tabs", () => {
		renderInsuranceList();

		// Initially in Ledger tab
		expect(screen.getByText("Linxea Avenir 2")).toBeInTheDocument();
		expect(screen.getByText("Generali PER Horizon")).toBeInTheDocument();

		// Switch to Holdings détaillées
		const holdingsTab = screen.getByRole("tab", { name: /Holdings détaillées/i });
		fireEvent.click(holdingsTab);

		expect(screen.getAllByText("Suravenir").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Generali").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText(/Children & Spouse/)).toBeInTheDocument();
	});

	it("opens details pane when a policy row is clicked", () => {
		renderInsuranceList();

		// Click on the Linxea policy row
		const policyRow = screen.getByText("Linxea Avenir 2").closest("tr");
		expect(policyRow).toBeDefined();
		fireEvent.click(policyRow!);

		// Details pane should render
		expect(screen.getByText("Capital Accumulation & Coverage")).toBeInTheDocument();
		expect(screen.getByText("Total Contributions (Cost Basis)")).toBeInTheDocument();
	});

	it("opens Add Policy dialog when clicking Add Policy button", () => {
		renderInsuranceList();

		const addBtn = screen.getByRole("button", { name: /Add Policy/i });
		fireEvent.click(addBtn);

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Add Insurance Policy")).toBeInTheDocument();
	});
});
