import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddInsuranceForm } from "../assets/insurance/AddInsuranceForm";

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "USD",
		currencySymbol: "$",
		formatCurrency: (val: number) => `$${val.toLocaleString()}`,
	}),
}));

describe("AddInsuranceForm", () => {
	it("renders 3 horizontal workspace tabs with English copy", () => {
		render(<AddInsuranceForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByRole("tab", { name: /1. Identity & Contract/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /2. Valuation & Cashflow/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /3. Clauses & Governance/i })).toBeInTheDocument();
	});

	it("switches tabs and displays dynamic valuation fields", () => {
		render(<AddInsuranceForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

		// Switch to Valuation & Cashflow tab
		const valTab = screen.getByRole("tab", { name: /2. Valuation & Cashflow/i });
		fireEvent.click(valTab);

		// Default is Life Insurance (an investment contract), so Surrender Value is present
		expect(screen.getByLabelText(/Current Surrender Value/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Total Net Contributions/i)).toBeInTheDocument();
	});

	it("dynamically adapts when pure protection (Term Life) is chosen", () => {
		render(
			<AddInsuranceForm
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				initialData={{
					name: "Credit Agricole Emprunteur",
					category: "loan_insurance",
					coverageAmount: "250000",
					premiumAmount: "35",
					premiumFrequency: "monthly",
				}}
			/>,
		);

		// Switch to Valuation & Cashflow tab
		const valTab = screen.getByRole("tab", { name: /2. Valuation & Cashflow/i });
		fireEvent.click(valTab);

		// Surrender value should NOT be present for pure risk
		expect(screen.queryByLabelText(/Current Surrender Value/i)).not.toBeInTheDocument();
		expect(screen.getByText(/Pure Risk Protection Contract/i)).toBeInTheDocument();
		expect(screen.getByText(/cash value is fixed at 0/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Guaranteed Death Coverage/i)).toBeInTheDocument();
	});

	it("calculates real-time P&L preview when values are entered", () => {
		render(
			<AddInsuranceForm
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				initialData={{
					name: "My Policy",
					category: "life_insurance",
					currentValue: "60000",
					purchasePrice: "50000",
				}}
			/>,
		);

		// Switch to Valuation tab
		const valTab = screen.getByRole("tab", { name: /2. Valuation & Cashflow/i });
		fireEvent.click(valTab);

		expect(screen.getByText("Calculated Unrealized Gain / Loss")).toBeInTheDocument();
		expect(screen.getByText("+$10,000")).toBeInTheDocument();
		expect(screen.getByText("+20.00%")).toBeInTheDocument();
	});

	it("calculates annual outflow based on premium frequency", () => {
		render(
			<AddInsuranceForm
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				initialData={{
					premiumAmount: "250",
					premiumFrequency: "monthly",
				}}
			/>,
		);

		// Switch to Valuation tab
		const valTab = screen.getByRole("tab", { name: /2. Valuation & Cashflow/i });
		fireEvent.click(valTab);

		// 250 * 12 = 3000 / year
		expect(screen.getByText(/Estimated Annual Outflow:/)).toBeInTheDocument();
		expect(screen.getByText("$3,000 / year")).toBeInTheDocument();
	});

	it("applies beneficiary clause presets into the editable textarea", () => {
		render(<AddInsuranceForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

		// Switch to Clauses tab
		const clausesTab = screen.getByRole("tab", { name: /3. Clauses & Governance/i });
		fireEvent.click(clausesTab);

		const spousalPresetBtn = screen.getByRole("button", {
			name: /Standard Spousal \/ Children/i,
		});
		fireEvent.click(spousalPresetBtn);

		const textarea = screen.getByLabelText(/Beneficiary Clause/i) as HTMLTextAreaElement;
		expect(textarea.value).toContain("Spouse (not legally separated or divorced)");
	});

	it("submits the form with sanitized payload", () => {
		const onSubmit = vi.fn();
		render(
			<AddInsuranceForm
				onSubmit={onSubmit}
				onCancel={vi.fn()}
				initialData={{
					name: "Zurich Term Life",
					category: "death_insurance",
					coverageAmount: "200000",
					premiumAmount: "450",
					premiumFrequency: "yearly",
				}}
			/>,
		);

		const submitBtn = screen.getByRole("button", { name: /Update Policy|Add Policy/i });
		fireEvent.click(submitBtn);

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Zurich Term Life",
				category: "death_insurance",
				currentValue: "0",
				coverageAmount: "200000",
				premiumAmount: "450",
			}),
		);
	});
});
