import { describe, expect, it } from "vitest";
import {
	BUDGET_CATEGORIES,
	cleanMerchantName,
	inferBudgetCategory,
	isTransactionInflow,
	parseTransaction,
} from "../transaction-cleaner";

describe("transaction-cleaner", () => {
	describe("cleanMerchantName", () => {
		it("handles repetition like Leclerc - Leclerc", () => {
			expect(cleanMerchantName("Leclerc - Leclerc")).toBe("Leclerc");
		});

		it("handles France Travail notes", () => {
			const note =
				"FRANCE TRAVAIL GRAND EST - 63 008 4833269D 02112026 - Payment from France Travail Grand Est";
			expect(cleanMerchantName(note)).toBe("France Travail");
		});

		it("handles personal transfers with - From", () => {
			const note = "EMMA HÉLÈNE ALINE ANNA JUSSIANT & LOIC GUY FRANCIS SCULIER - From Emma J";
			expect(cleanMerchantName(note)).toBe("Virement de Emma J");
		});

		it("handles interest payouts", () => {
			const note =
				"EventID: 019e80a2, Stream: timelineTransactions, EventType: INTEREST_PAYOUT, Status: EXECUTED, Title: Interest";
			expect(cleanMerchantName(note)).toBe("Intérêts créditeurs");
		});

		it("handles standard merchant strings", () => {
			expect(cleanMerchantName("Tesla Inc. - Tesla Inc.")).toBe("Tesla Inc.");
			expect(cleanMerchantName("4a10 Hayange - 4a10 Hayange")).toBe("4a10 Hayange");
		});

		it("fallbacks for empty or null notes", () => {
			expect(cleanMerchantName(null)).toBe("Transaction");
			expect(cleanMerchantName("")).toBe("Transaction");
		});
	});

	describe("inferBudgetCategory", () => {
		it("categorizes income and France Travail", () => {
			const cat = inferBudgetCategory("Payment from France Travail Grand Est", "DEPOSIT", 2427.9);
			expect(cat.id).toBe(BUDGET_CATEGORIES.INCOME.id);
		});

		it("categorizes groceries", () => {
			const cat = inferBudgetCategory("Leclerc - Leclerc", "WITHDRAWAL", 5.38);
			expect(cat.id).toBe(BUDGET_CATEGORIES.GROCERIES.id);
		});

		it("categorizes transport", () => {
			const cat = inferBudgetCategory("Tesla Supercharger", "WITHDRAWAL", 24.5);
			expect(cat.id).toBe(BUDGET_CATEGORIES.TRANSPORT.id);
		});

		it("categorizes subscriptions", () => {
			const cat = inferBudgetCategory("Netflix monthly subscription", "WITHDRAWAL", 17.99);
			expect(cat.id).toBe(BUDGET_CATEGORIES.SUBSCRIPTIONS.id);
		});

		it("categorizes interest and savings", () => {
			const cat = inferBudgetCategory("Title: Interest payout", "INTEREST", 0.61);
			expect(cat.id).toBe(BUDGET_CATEGORIES.SAVINGS.id);
		});
	});

	describe("isTransactionInflow & parseTransaction isPositive", () => {
		it("correctly tags withdrawals and expenses as outflows (isPositive = false)", () => {
			expect(isTransactionInflow("WITHDRAWAL", 17.83)).toBe(false);
			expect(isTransactionInflow("withdrawal", 489.85)).toBe(false);
			expect(isTransactionInflow("BUY", 100)).toBe(false);
			expect(isTransactionInflow("TRANSFER_OUT", 50)).toBe(false);
			expect(isTransactionInflow("FEE", 2.5)).toBe(false);

			const parsedTesla = parseTransaction({
				notes: "Tesla Inc. - Tesla Inc.",
				transactionType: "WITHDRAWAL",
				amount: 17.83,
			});
			expect(parsedTesla.isPositive).toBe(false);

			const parsedTransferTo = parseTransaction({
				notes: "Loïc Sculier - Prêt voiture - To Loïc Sculier",
				transactionType: "WITHDRAWAL",
				amount: 489.85,
			});
			expect(parsedTransferTo.isPositive).toBe(false);
			expect(parsedTransferTo.merchant).toBe("Virement vers Loïc Sculier");
			expect(parsedTransferTo.category.id).toBe(BUDGET_CATEGORIES.TRANSFERS.id);

			const parsedEmmaTo = parseTransaction({
				notes: "EMMA HÉLÈNE ALINE ANNA JUSSIANT & LOIC GUY FRANCIS SCULIER - To EMMA HÉLÈNE ALINE ANNA JUSSIANT & LOIC GUY FRANCIS SCULIER",
				transactionType: "WITHDRAWAL",
				amount: 103.76,
			});
			expect(parsedEmmaTo.isPositive).toBe(false);
		});

		it("correctly tags fallback when transactionType is undefined but notes indicate direction", () => {
			// Even with missing transactionType, outgoing notes must never evaluate to positive
			expect(isTransactionInflow(undefined, 489.85, "Loïc Sculier - Prêt voiture - To Loïc Sculier")).toBe(false);
			expect(isTransactionInflow("", 17.83, "Tesla Inc. - Tesla Inc.")).toBe(false);

			// Incoming notes without explicit type
			expect(isTransactionInflow(undefined, 2427.9, "Payment from France Travail Grand Est")).toBe(true);
		});

		it("correctly tags deposits, salary, and interest as inflows (isPositive = true)", () => {
			expect(isTransactionInflow("DEPOSIT", 2427.9)).toBe(true);
			expect(isTransactionInflow("TRANSFER_IN", 100)).toBe(true);
			expect(isTransactionInflow("INTEREST", 0.61)).toBe(true);
			expect(isTransactionInflow("DIVIDEND", 5.0)).toBe(true);

			const parsed = parseTransaction({
				notes: "FRANCE TRAVAIL GRAND EST",
				transactionType: "DEPOSIT",
				amount: 2427.9,
			});
			expect(parsed.isPositive).toBe(true);

			const parsedRefund = parseTransaction({
				notes: "LOIC SCULIER - Netflix - Payment from Loic Sculier",
				transactionType: "DEPOSIT",
				amount: 7.0,
			});
			expect(parsedRefund.isPositive).toBe(true);
		});
	});
});
