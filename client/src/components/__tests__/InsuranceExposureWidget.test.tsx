import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PortfolioAssetItem } from "@/components/PortfolioProvider";
import {
	InsuranceExposureWidget,
	computeAnnualPremium,
} from "../assets/insurance/InsuranceExposureWidget";

describe("InsuranceExposureWidget", () => {
	const mockPolicies: PortfolioAssetItem[] = [
		{
			id: "ins-1",
			name: "Linxea Avenir 2",
			symbol: "LINXEA",
			type: "insurance",
			portfolioId: "p1",
			currentPrice: 50000,
			purchasePrice: 40000,
			quantity: 1,
			currentValue: 50000,
			portfolioWeight: 50,
			sparklineData: [],
			fx: { isConverted: false, displayCurrency: "EUR", baseCurrency: "EUR" } as any,
			insurer: "Suravenir",
			policyType: "life_insurance",
			coverageAmount: 100000,
			premiumAmount: 200,
			premiumFrequency: "monthly",
		},
		{
			id: "ins-2",
			name: "Generali PER",
			symbol: "PER-GEN",
			type: "insurance",
			portfolioId: "p1",
			currentPrice: 50000,
			purchasePrice: 45000,
			quantity: 1,
			currentValue: 50000,
			portfolioWeight: 50,
			sparklineData: [],
			fx: { isConverted: false, displayCurrency: "EUR", baseCurrency: "EUR" } as any,
			insurer: "Generali",
			policyType: "retirement",
			coverageAmount: 60000,
			premiumAmount: 1200,
			premiumFrequency: "yearly",
		},
	];

	it("correctly computes annualized premiums", () => {
		expect(computeAnnualPremium(mockPolicies[0])).toBe(2400); // 200 * 12
		expect(computeAnnualPremium(mockPolicies[1])).toBe(1200); // 1200 * 1
	});

	it("renders insurer slices and commitments summary", () => {
		render(
			<InsuranceExposureWidget
				totalInsuranceValue={100000}
				policies={mockPolicies}
				formatCurrency={(val) => `€${val.toLocaleString()}`}
			/>,
		);

		expect(screen.getByText("Exposure & Allocation")).toBeInTheDocument();
		expect(screen.getByText("Suravenir")).toBeInTheDocument();
		expect(screen.getByText("Generali")).toBeInTheDocument();

		// Guaranteed capital (100k + 60k = 160k)
		expect(screen.getByText("Guaranteed Capital")).toBeInTheDocument();
		expect(screen.getByText("€160,000")).toBeInTheDocument();

		// Annual premiums (2400 + 1200 = 3600)
		expect(screen.getByText("Annual Premiums")).toBeInTheDocument();
		expect(screen.getByText("€3,600 / yr")).toBeInTheDocument();
	});

	it("switches to Category view mode", () => {
		render(
			<InsuranceExposureWidget
				totalInsuranceValue={100000}
				policies={mockPolicies}
				formatCurrency={(val) => `€${val.toLocaleString()}`}
			/>,
		);

		const byTypeBtn = screen.getByRole("button", { name: "By Type" });
		fireEvent.click(byTypeBtn);

		expect(screen.getByText("Life Insurance")).toBeInTheDocument();
		expect(screen.getByText("Retirement Plan")).toBeInTheDocument();
	});

	it("triggers onSelectFilter callback on slice click", () => {
		const onSelectFilter = vi.fn();
		render(
			<InsuranceExposureWidget
				totalInsuranceValue={100000}
				policies={mockPolicies}
				onSelectFilter={onSelectFilter}
				formatCurrency={(val) => `€${val.toLocaleString()}`}
			/>,
		);

		const suravenirSlice = screen.getByText("Suravenir").closest("button");
		expect(suravenirSlice).toBeDefined();
		fireEvent.click(suravenirSlice!);

		expect(onSelectFilter).toHaveBeenCalledWith({
			type: "insurer",
			key: "Suravenir",
		});
	});
});
