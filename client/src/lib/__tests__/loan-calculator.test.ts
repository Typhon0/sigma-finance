import { describe, expect, it } from "vitest";
import { computeLoanAmortization } from "../loan-calculator";

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
