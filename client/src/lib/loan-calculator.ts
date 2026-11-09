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

export interface AmortizationScheduleEntry {
	month: number;
	year: number;
	date: Date;
	dateString: string; // e.g. "Nov 2026"
	payment: number;
	principal: number;
	interest: number;
	insurance: number;
	remainingBalance: number;
}

export interface AnnualAmortizationSummary {
	year: number;
	calendarYear: number;
	totalPayment: number;
	totalPrincipal: number;
	totalInterest: number;
	totalInsurance: number;
	endingBalance: number;
	monthsCount: number;
}

export interface FullAmortizationParams {
	loanAmount: number;
	interestRate: number;
	durationMonths: number;
	startDate?: Date | string;
	monthlyPayment?: number;
	insuranceFeeMonthly?: number;
	loanType?: string;
	steps?: Array<{ date?: string; amount: number; interestRate: number }>;
}

export interface FullAmortizationResult {
	entries: AmortizationScheduleEntry[];
	annualSummaries: AnnualAmortizationSummary[];
	totalInterest: number;
	totalPrincipal: number;
	totalInsurance: number;
	totalPayments: number;
	endDate?: Date;
}

/**
 * Computes deterministic full amortization schedule (monthly + annual rollup).
 */
export function computeFullAmortizationSchedule({
	loanAmount,
	interestRate,
	durationMonths,
	startDate,
	monthlyPayment: customMonthlyPayment,
	insuranceFeeMonthly = 0,
	loanType = "amortizing",
}: FullAmortizationParams): FullAmortizationResult {
	if (loanAmount <= 0 || durationMonths <= 0) {
		return {
			entries: [],
			annualSummaries: [],
			totalInterest: 0,
			totalPrincipal: 0,
			totalInsurance: 0,
			totalPayments: 0,
		};
	}

	const baseAmort = computeLoanAmortization({
		loanAmount,
		interestRate,
		durationMonths,
		startDate,
		insuranceFeeMonthly,
	});

	const monthlyPayment =
		typeof customMonthlyPayment === "number" && customMonthlyPayment > 0
			? customMonthlyPayment
			: baseAmort.monthlyPayment;

	const monthlyRate = interestRate > 0 ? interestRate / 100 / 12 : 0;
	const parsedStartDate = startDate ? new Date(startDate) : new Date();
	const validStartDate = !isNaN(parsedStartDate.getTime()) ? parsedStartDate : new Date();

	const entries: AmortizationScheduleEntry[] = [];
	let balance = loanAmount;
	let totalInterest = 0;
	let totalPrincipal = 0;
	let totalInsurance = 0;

	for (let m = 1; m <= durationMonths; m++) {
		const entryDate = new Date(validStartDate);
		entryDate.setMonth(entryDate.getMonth() + m);

		let interest = Math.round(balance * monthlyRate * 100) / 100;
		let principal = 0;

		if (loanType === "in-fine") {
			// In-fine loan: only pay interest, principal paid at final month
			principal = m === durationMonths ? balance : 0;
		} else if (loanType === "deferred-total") {
			// Deferred total: no payment during deferral, interest accumulates
			principal = 0;
			interest = 0;
		} else {
			// Standard amortizing
			principal = Math.max(0, Math.min(balance, monthlyPayment - interest));
			if (m === durationMonths) {
				// Final month balance cleanup to avoid penny rounding residual
				principal = balance;
			}
		}

		balance = Math.max(0, balance - principal);
		const roundPrincipal = Math.round(principal * 100) / 100;
		const roundInterest = Math.round(interest * 100) / 100;
		const roundInsurance = Math.round(insuranceFeeMonthly * 100) / 100;
		const roundPayment = Math.round((roundPrincipal + roundInterest + roundInsurance) * 100) / 100;

		totalPrincipal += roundPrincipal;
		totalInterest += roundInterest;
		totalInsurance += roundInsurance;

		entries.push({
			month: m,
			year: Math.ceil(m / 12),
			date: entryDate,
			dateString: entryDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
			payment: roundPayment,
			principal: roundPrincipal,
			interest: roundInterest,
			insurance: roundInsurance,
			remainingBalance: Math.round(balance * 100) / 100,
		});

		if (balance <= 0 && loanType !== "in-fine") {
			break;
		}
	}

	// Annual summaries aggregation by loan year (Year 1, Year 2...)
	const annualMap = new Map<number, AnnualAmortizationSummary>();
	entries.forEach((entry) => {
		const loanYear = entry.year;
		const current = annualMap.get(loanYear) || {
			year: loanYear,
			calendarYear: entry.date.getFullYear(),
			totalPayment: 0,
			totalPrincipal: 0,
			totalInterest: 0,
			totalInsurance: 0,
			endingBalance: entry.remainingBalance,
			monthsCount: 0,
		};

		current.totalPayment = Math.round((current.totalPayment + entry.payment) * 100) / 100;
		current.totalPrincipal = Math.round((current.totalPrincipal + entry.principal) * 100) / 100;
		current.totalInterest = Math.round((current.totalInterest + entry.interest) * 100) / 100;
		current.totalInsurance = Math.round((current.totalInsurance + entry.insurance) * 100) / 100;
		current.endingBalance = entry.remainingBalance;
		current.monthsCount += 1;
		annualMap.set(loanYear, current);
	});

	const annualSummaries = Array.from(annualMap.values());
	const calculatedEndDate = entries.length > 0 ? entries[entries.length - 1].date : undefined;

	return {
		entries,
		annualSummaries,
		totalInterest: Math.round(totalInterest * 100) / 100,
		totalPrincipal: Math.round(totalPrincipal * 100) / 100,
		totalInsurance: Math.round(totalInsurance * 100) / 100,
		totalPayments: Math.round((totalPrincipal + totalInterest + totalInsurance) * 100) / 100,
		endDate: calculatedEndDate,
	};
}

/**
 * Computes Loan-to-Value (LTV) percentage.
 */
export function computeLoanToValue(remainingBalance: number, assetValue: number): number {
	if (assetValue <= 0 || remainingBalance <= 0) return 0;
	return Math.round((remainingBalance / assetValue) * 1000) / 10;
}

export interface PortfolioLoanItem {
	id: string;
	name: string;
	remainingBalance: number;
	loanAmount: number;
	monthlyPayment: number;
	interestRate: number;
	durationMonths?: number;
	startDate?: string;
	endDate?: string;
	ownershipPercentage?: number;
	status?: string;
	currency?: string;
}

export interface PortfolioDebtSummary {
	totalGrossDebt: number;
	totalNetDebt: number;
	totalGrossOriginal: number;
	totalNetOriginal: number;
	totalGrossMonthlyPayment: number;
	totalNetMonthlyPayment: number;
	weightedAverageRate: number;
	principalPaidGross: number;
	principalPaidNet: number;
	amortizedRatio: number;
	activeLoansCount: number;
	averageRemainingMonths: number;
}

/**
 * Computes debt aggregations across all loans in a portfolio,
 * with strict prorata support for ownership percentage.
 */
export function computePortfolioDebtSummary(loans: PortfolioLoanItem[]): PortfolioDebtSummary {
	const activeLoans = loans.filter((l) => (l.status || "active").toLowerCase() !== "paid-off");

	if (activeLoans.length === 0) {
		return {
			totalGrossDebt: 0,
			totalNetDebt: 0,
			totalGrossOriginal: 0,
			totalNetOriginal: 0,
			totalGrossMonthlyPayment: 0,
			totalNetMonthlyPayment: 0,
			weightedAverageRate: 0,
			principalPaidGross: 0,
			principalPaidNet: 0,
			amortizedRatio: 0,
			activeLoansCount: 0,
			averageRemainingMonths: 0,
		};
	}

	let totalGrossDebt = 0;
	let totalNetDebt = 0;
	let totalGrossOriginal = 0;
	let totalNetOriginal = 0;
	let totalGrossMonthlyPayment = 0;
	let totalNetMonthlyPayment = 0;
	let weightedRateNumerator = 0;

	activeLoans.forEach((loan) => {
		const share = (typeof loan.ownershipPercentage === "number" ? loan.ownershipPercentage : 100) / 100;
		const balance = loan.remainingBalance || 0;
		const original = loan.loanAmount || balance;
		const payment = loan.monthlyPayment || 0;
		const rate = loan.interestRate || 0;

		totalGrossDebt += balance;
		totalNetDebt += balance * share;
		totalGrossOriginal += original;
		totalNetOriginal += original * share;
		totalGrossMonthlyPayment += payment;
		totalNetMonthlyPayment += payment * share;
		weightedRateNumerator += balance * rate;
	});

	const weightedAverageRate =
		totalGrossDebt > 0 ? Math.round((weightedRateNumerator / totalGrossDebt) * 100) / 100 : 0;
	const principalPaidGross = Math.max(0, totalGrossOriginal - totalGrossDebt);
	const principalPaidNet = Math.max(0, totalNetOriginal - totalNetDebt);
	const amortizedRatio =
		totalGrossOriginal > 0 ? Math.round((principalPaidGross / totalGrossOriginal) * 1000) / 10 : 0;

	return {
		totalGrossDebt: Math.round(totalGrossDebt * 100) / 100,
		totalNetDebt: Math.round(totalNetDebt * 100) / 100,
		totalGrossOriginal: Math.round(totalGrossOriginal * 100) / 100,
		totalNetOriginal: Math.round(totalNetOriginal * 100) / 100,
		totalGrossMonthlyPayment: Math.round(totalGrossMonthlyPayment * 100) / 100,
		totalNetMonthlyPayment: Math.round(totalNetMonthlyPayment * 100) / 100,
		weightedAverageRate,
		principalPaidGross: Math.round(principalPaidGross * 100) / 100,
		principalPaidNet: Math.round(principalPaidNet * 100) / 100,
		amortizedRatio,
		activeLoansCount: activeLoans.length,
		averageRemainingMonths: 0,
	};
}
