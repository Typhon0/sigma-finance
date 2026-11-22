import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InsuranceDetail } from "../assets/insurance/InsuranceDetail";

const mockPolicy = {
	id: "ins-test-1",
	name: "Linxea Avenir 2",
	symbol: "LINXEA",
	type: "insurance",
	currentValue: 60000,
	purchasePrice: 50000,
	coverageAmount: 100000,
	premiumAmount: 200,
	premiumFrequency: "monthly",
	insurer: "Suravenir",
	policyNumber: "POL-123456",
	policyType: "life_insurance",
	beneficiaries: "Children & Spouse",
	annualReturn: 3.8,
	openingDate: "2020-01-15T00:00:00Z",
	maturityDate: "2030-01-15T00:00:00Z",
	notes: "Fonds euros et ETF World",
};

const mockUpdateAsset = vi.fn();
const mockUpdateLifeInsurance = vi.fn();
const mockDeleteAsset = vi.fn();

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: [mockPolicy],
		updateAsset: mockUpdateAsset,
		updateLifeInsurance: mockUpdateLifeInsurance,
		deleteAsset: mockDeleteAsset,
	}),
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		formatCurrency: (val: number) => `€${val.toLocaleString()}`,
	}),
}));

describe("InsuranceDetail", () => {
	it("renders authentic 3-pillar capital accumulation & coverage without fake curves", () => {
		render(<InsuranceDetail insuranceId="ins-test-1" onBack={vi.fn()} />);

		// Policy name and badge
		expect(screen.getByText("Linxea Avenir 2")).toBeInTheDocument();
		expect(screen.getAllByText("Life Insurance").length).toBeGreaterThanOrEqual(1);

		// Authentic 3 pillars
		expect(screen.getByText("Total Contributions (Cost Basis)")).toBeInTheDocument();
		expect(screen.getByText("€50,000")).toBeInTheDocument();

		expect(screen.getByText("Current Surrender Value (Valeur de Rachat)")).toBeInTheDocument();
		expect(screen.getByText("€60,000")).toBeInTheDocument();

		expect(screen.getByText("Guaranteed Death Coverage (Capital Garanti)")).toBeInTheDocument();
		expect(screen.getByText("€100,000")).toBeInTheDocument();

		// Gain calculation: 60000 - 50000 = 10000 (+20%)
		expect(screen.getByText("€10,000")).toBeInTheDocument();
		expect(screen.getByText("(20.0%)")).toBeInTheDocument();

		// Terms & Outflow
		expect(screen.getByText("Suravenir")).toBeInTheDocument();
		expect(screen.getByText("POL-123456")).toBeInTheDocument();
		expect(screen.getByText("€2,400 / yr")).toBeInTheDocument(); // 200 * 12
		expect(screen.getByText("Children & Spouse")).toBeInTheDocument();
		expect(screen.getByText("Fonds euros et ETF World")).toBeInTheDocument();
	});

	it("handles delete flow", () => {
		const onBack = vi.fn();
		render(<InsuranceDetail insuranceId="ins-test-1" onBack={onBack} />);

		const deleteBtn = screen.getByRole("button", { name: /delete/i });
		fireEvent.click(deleteBtn);

		const confirmDeleteBtn = screen.getByRole("button", { name: "Delete Policy" });
		fireEvent.click(confirmDeleteBtn);

		expect(mockDeleteAsset).toHaveBeenCalledWith("ins-test-1");
		expect(onBack).toHaveBeenCalled();
	});

	it("opens edit dialog and submits update", async () => {
		render(<InsuranceDetail insuranceId="ins-test-1" onBack={vi.fn()} />);

		const editBtn = screen.getByRole("button", { name: /edit/i });
		fireEvent.click(editBtn);

		expect(screen.getByText("Edit Insurance Policy")).toBeInTheDocument();
		const submitBtn = screen.getByRole("button", { name: /update policy/i });
		fireEvent.click(submitBtn);

		expect(mockUpdateLifeInsurance).toHaveBeenCalledWith(
			"ins-test-1",
			expect.objectContaining({
				name: "Linxea Avenir 2",
				policyType: "life_insurance",
				currentValue: 60000,
			}),
		);
	});

	it("renders not found state when insurance id does not match", () => {
		render(<InsuranceDetail insuranceId="non-existent" onBack={vi.fn()} />);
		expect(screen.getByText("Insurance Policy Not Found")).toBeInTheDocument();
	});
});
