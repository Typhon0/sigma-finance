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
		method: "PMP",
		holdingPeriodDays: 400,
		isLongTerm: true,
		isTaxExempt: true,
	},
];

const mockQueryState = {
	lots: [] as any[],
	dispositions: mockDispositions as any[],
	error: null as Error | null,
};

vi.mock("@apollo/client", async () => {
	const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");
	return {
		...actual,
		useQuery: (queryDoc: any) => {
			const doc = queryDoc?.loc?.source?.body || "";
			if (doc.includes("dispositionsByPosition")) {
				return {
					data: { dispositionsByPosition: mockQueryState.dispositions },
					loading: false,
					error: mockQueryState.error,
					refetch: vi.fn(),
				};
			}
			return {
				data: { taxLotsByPosition: mockQueryState.lots },
				loading: false,
				error: mockQueryState.error,
				refetch: vi.fn(),
			};
		},
	};
});

describe("TaxLotsTab PEA and Jurisdiction behavior", () => {
	beforeEach(() => {
		mockQueryState.lots = [];
		mockQueryState.dispositions = mockDispositions;
		mockQueryState.error = null;
	});

	it("renders PEA banner and marks gains as exempt when portfolio wrapper is PEA", () => {
		render(
			<TaxLotsTab
				positionId="pos-1"
				symbol="MC.PA"
				currency="EUR"
				portfolioTaxWrapper="PEA"
			/>,
		);

		// PEA banner must appear
		expect(
			screen.getByText(/PEA Tax-Sheltered Account \(French Equity Plan\)/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Internal tax-sheltered regime under French tax law/i),
		).toBeInTheDocument();

		// Realized G/L shows $0.00 / 0.00 € taxable with PEA Tax-Exempt badges
		const badges = screen.getAllByText("PEA Tax-Exempt");
		expect(badges.length).toBeGreaterThan(0);

		// Gross internal performance gain tracking displayed
		expect(screen.getByText(/Gross internal gain: \+€500\.00/i)).toBeInTheDocument();
	});
});
