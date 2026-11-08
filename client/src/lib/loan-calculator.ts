/**
 * Deterministic loan amortization and balance calculations.
 * Used for mortgage & loan tracking (e.g. Caisse d'Épargne, Fortuneo, BNP Paribas).
 */

export interface LoanAmortizationParams {
	loanAmount: number;
	interestRate: number; // Annual interest rate in percent (e.g. 2.5 for 2.5%)
	durationMonths: number;
	startDate?: Date | string;
	insuranceFeeMonthly?: number;
}

export interface LoanAmortizationResult {
	monthlyPayment: number;
	monthlyPaymentWithInsurance: number;
	remainingBalance: number;
	totalInterest: number;
	monthsElapsed: number;
	monthsRemaining: number;
	endDate?: Date;
}

export const POPULAR_FRENCH_BANKS = [
	"Caisse d'Épargne",
	"Fortuneo",
	"Crédit Agricole",
	"BNP Paribas",
	"Société Générale",
	"BoursoBank",
	"Crédit Mutuel",
	"LCL",
	"La Banque Postale",
	"CIC",
	"BRED Banque Populaire",
	"BforBank",
] as const;

export function computeLoanAmortization({
	loanAmount,
	interestRate,
	durationMonths,
	startDate,
	insuranceFeeMonthly = 0,
}: LoanAmortizationParams): LoanAmortizationResult {
	if (loanAmount <= 0 || durationMonths <= 0) {
		return {
			monthlyPayment: 0,
			monthlyPaymentWithInsurance: 0,
			remainingBalance: Math.max(0, loanAmount),
			totalInterest: 0,
			monthsElapsed: 0,
			monthsRemaining: Math.max(0, durationMonths),
		};
	}

	const monthlyRate = interestRate > 0 ? interestRate / 100 / 12 : 0;
	let monthlyPrincipalInterest = 0;

	if (monthlyRate === 0) {
		monthlyPrincipalInterest = loanAmount / durationMonths;
	} else {
		const factor = (1 + monthlyRate) ** durationMonths;
		monthlyPrincipalInterest = (loanAmount * (monthlyRate * factor)) / (factor - 1);
	}

	const parsedStartDate = startDate ? new Date(startDate) : undefined;
	let monthsElapsed = 0;
	let remainingBalance = loanAmount;
	let calculatedEndDate: Date | undefined;

	if (parsedStartDate && !isNaN(parsedStartDate.getTime())) {
		calculatedEndDate = new Date(parsedStartDate.getTime());
		calculatedEndDate.setMonth(calculatedEndDate.getMonth() + durationMonths);

		const now = new Date();
		monthsElapsed =
			(now.getFullYear() - parsedStartDate.getFullYear()) * 12 +
			(now.getMonth() - parsedStartDate.getMonth());

		if (now.getDate() < parsedStartDate.getDate()) {
			monthsElapsed = Math.max(0, monthsElapsed - 1);
		}
		monthsElapsed = Math.max(0, Math.min(monthsElapsed, durationMonths));

		if (monthsElapsed >= durationMonths) {
			remainingBalance = 0;
		} else if (monthsElapsed > 0) {
			let balance = loanAmount;
			for (let m = 1; m <= monthsElapsed; m++) {
				const interest = balance * monthlyRate;
				const principal = Math.min(balance, monthlyPrincipalInterest - interest);
				balance = Math.max(0, balance - principal);
			}
			remainingBalance = balance;
		}
	}

	const monthsRemaining = Math.max(0, durationMonths - monthsElapsed);
	const totalPaid = monthlyPrincipalInterest * durationMonths;
	const totalInterest = Math.max(0, totalPaid - loanAmount);

	return {
		monthlyPayment: Math.round(monthlyPrincipalInterest * 100) / 100,
		monthlyPaymentWithInsurance:
			Math.round((monthlyPrincipalInterest + insuranceFeeMonthly) * 100) / 100,
		remainingBalance: Math.round(remainingBalance * 100) / 100,
		totalInterest: Math.round(totalInterest * 100) / 100,
		monthsElapsed,
		monthsRemaining,
		endDate: calculatedEndDate,
	};
}
