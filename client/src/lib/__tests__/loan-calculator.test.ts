import { describe, expect, it } from "vitest";
import {
	computeFullAmortizationSchedule,
	computeLoanAmortization,
	computeLoanToValue,
	computePortfolioDebtSummary,
} from "../loan-calculator";

describe("computeLoanAmortization", () => {
	it("returns zero values when amount or duration are invalid", () => {
		const res = computeLoanAmortization({
			loanAmount: 0,
			interestRate: 2.5,
			durationMonths: 240,
		});
		expect(res.monthlyPayment).toBe(0);
		expect(res.remainingBalance).toBe(0);
	});

	it("calculates 0% interest loan (e.g. PTZ / prêt taux zéro)", () => {
		const res = computeLoanAmortization({
			loanAmount: 60000,
			interestRate: 0,
			durationMonths: 120,
		});
		expect(res.monthlyPayment).toBe(500);
		expect(res.remainingBalance).toBe(60000);
	});

	it("calculates standard French mortgage monthly payment correctly", () => {
		// 200,000 € at 2.5% over 20 years (240 months)
		// Standard formula: M = 200000 * (r / (1 - (1+r)^-240)) ~ 1059.81 €
		const res = computeLoanAmortization({
			loanAmount: 200000,
			interestRate: 2.5,
			durationMonths: 240,
			insuranceFeeMonthly: 30,
		});
		expect(res.monthlyPayment).toBe(1059.81);
		expect(res.monthlyPaymentWithInsurance).toBe(1089.81);
		expect(res.totalInterest).toBe(54353.39);
	});

	it("calculates remaining balance based on elapsed months from start date", () => {
		// Start date 12 months ago
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

		const res = computeLoanAmortization({
			loanAmount: 200000,
			interestRate: 2.5,
			durationMonths: 240,
			startDate: oneYearAgo,
		});

		expect(res.monthsElapsed).toBe(12);
		expect(res.monthsRemaining).toBe(228);
		// After 1 year, balance should be around 192k-193k €
		expect(res.remainingBalance).toBeGreaterThan(190000);
		expect(res.remainingBalance).toBeLessThan(195000);
	});

	it("calculates balance as 0 when loan is matured", () => {
		const thirtyYearsAgo = new Date();
		thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);

		const res = computeLoanAmortization({
			loanAmount: 150000,
			interestRate: 2.0,
			durationMonths: 240,
			startDate: thirtyYearsAgo,
		});

		expect(res.monthsElapsed).toBe(240);
		expect(res.monthsRemaining).toBe(0);
		expect(res.remainingBalance).toBe(0);
	});
});

describe("computeFullAmortizationSchedule", () => {
	it("generates correct monthly entries and annual summaries for a standard mortgage", () => {
		const result = computeFullAmortizationSchedule({
			loanAmount: 120000,
			interestRate: 2.0,
			durationMonths: 24, // 2 years
			startDate: new Date("2026-01-01"),
			insuranceFeeMonthly: 20,
		});

		expect(result.entries.length).toBe(24);
		expect(result.annualSummaries.length).toBe(2);
		expect(result.entries[0].principal).toBeGreaterThan(0);
		expect(result.entries[0].interest).toBeGreaterThan(0);
		expect(result.entries[0].insurance).toBe(20);
		expect(result.entries[23].remainingBalance).toBe(0);
		expect(result.annualSummaries[1].endingBalance).toBe(0);
	});

	it("supports in-fine loans with bullet principal payment at end", () => {
		const result = computeFullAmortizationSchedule({
			loanAmount: 100000,
			interestRate: 3.0,
			durationMonths: 12,
			startDate: new Date("2026-01-01"),
			loanType: "in-fine",
		});

		expect(result.entries.length).toBe(12);
		expect(result.entries[0].principal).toBe(0);
		expect(result.entries[0].remainingBalance).toBe(100000);
		expect(result.entries[11].principal).toBe(100000);
		expect(result.entries[11].remainingBalance).toBe(0);
	});
});

describe("computeLoanToValue", () => {
	it("computes accurate LTV percentages", () => {
		expect(computeLoanToValue(180000, 250000)).toBe(72.0);
		expect(computeLoanToValue(200000, 200000)).toBe(100.0);
		expect(computeLoanToValue(0, 250000)).toBe(0);
		expect(computeLoanToValue(180000, 0)).toBe(0);
	});
});

describe("computePortfolioDebtSummary", () => {
	it("calculates gross and prorated net liabilities across loans", () => {
		const loans = [
			{
				id: "l1",
				name: "Villa Mortgage",
				remainingBalance: 200000,
				loanAmount: 250000,
				monthlyPayment: 1200,
				interestRate: 2.0,
				ownershipPercentage: 50, // 50% co-borrowed
				status: "active",
			},
			{
				id: "l2",
				name: "Car Loan",
				remainingBalance: 20000,
				loanAmount: 30000,
				monthlyPayment: 500,
				interestRate: 4.0,
				ownershipPercentage: 100, // 100% personal
				status: "active",
			},
		];

		const summary = computePortfolioDebtSummary(loans);
		expect(summary.totalGrossDebt).toBe(220000);
		expect(summary.totalNetDebt).toBe(120000); // (200k * 0.5) + (20k * 1.0)
		expect(summary.totalGrossMonthlyPayment).toBe(1700);
		expect(summary.totalNetMonthlyPayment).toBe(1100); // (1200 * 0.5) + 500
		expect(summary.activeLoansCount).toBe(2);
		// Weighted rate: (200k * 2% + 20k * 4%) / 220k = 480k / 220k ~ 2.18%
		expect(summary.weightedAverageRate).toBe(2.18);
	});
});
