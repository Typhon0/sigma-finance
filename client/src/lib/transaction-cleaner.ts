export interface CleanedTransaction {
	merchant: string;
	category: {
		id: string;
		label: string;
		color: string;
		badgeClass: string;
	};
	rawNote: string;
	isPositive: boolean;
}

export const BUDGET_CATEGORIES = {
	INCOME: {
		id: "income",
		label: "Salaire & Revenus",
		color: "#10b981", // emerald-500
		badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
	},
	GROCERIES: {
		id: "groceries",
		label: "Alimentation & Courses",
		color: "#f59e0b", // amber-500
		badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
	},
	TRANSPORT: {
		id: "transport",
		label: "Transport & Auto",
		color: "#06b6d4", // cyan-500
		badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
	},
	SHOPPING: {
		id: "shopping",
		label: "Shopping",
		color: "#ec4899", // pink-500
		badgeClass: "bg-pink-500/10 text-pink-400 border-pink-500/20",
	},
	SUBSCRIPTIONS: {
		id: "subscriptions",
		label: "Abonnements & Services",
		color: "#8b5cf6", // purple-500
		badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
	},
	SAVINGS: {
		id: "savings",
		label: "Épargne & Intérêts",
		color: "#3b82f6", // blue-500
		badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	},
	TRANSFERS: {
		id: "transfers",
		label: "Virements",
		color: "#6366f1", // indigo-500
		badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
	},
	OTHER: {
		id: "other",
		label: "Dépenses courantes",
		color: "#94a3b8", // slate-400
		badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
	},
} as const;

function toTitleCase(str: string): string {
	if (!str) return "";
	return str
		.toLowerCase()
		.split(" ")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function cleanMerchantName(rawNote: string | null | undefined): string {
	if (!rawNote || !rawNote.trim()) {
		return "Transaction";
	}

	let text = rawNote.trim();

	// If notes contain structured event (e.g. Timeline interest)
	if (
		text.includes("EventType: INTEREST_PAYOUT") ||
		text.toLowerCase().includes("title: interest")
	) {
		return "Intérêts créditeurs";
	}

	// Handle personal transfers with "- From X" or "- To X"
	if (text.includes("- From ")) {
		const fromPart = text.split(/- From /i)[1]?.trim();
		if (fromPart) {
			return `Virement de ${fromPart}`;
		}
	}
	if (text.includes("- To ")) {
		const toPart = text.split(/- To /i)[1]?.trim();
		if (toPart) {
			return `Virement vers ${toPart}`;
		}
	}

	// Handle "X - X" repetition (e.g. "Leclerc - Leclerc" -> "Leclerc")
	if (text.includes(" - ")) {
		const parts = text
			.split(" - ")
			.map((p) => p.trim())
			.filter(Boolean);
		if (parts.length >= 2) {
			if (parts[0].toLowerCase() === parts[1].toLowerCase()) {
				text = parts[0];
			} else if (parts[0].toLowerCase().includes("france travail")) {
				return "France Travail";
			} else {
				// Prefer first segment if it looks like a clean name
				text = parts[0];
			}
		}
	}

	// Strip common noisy banking suffixes and prefixes
	text = text.replace(/^(Payment from|Paiement de|Prélèvement de|Virement de)\s+/i, "");
	text = text.replace(/\s+(Grand Est|Grand-Est|France|SAS|SARL|SA)\b/i, "");

	// Strip long numeric / alphanumeric reference tokens (e.g. "63 008 4833269D 02112026")
	text = text.replace(/\b\d{2,}\s+\d{2,}\s+[A-Z0-9]+\b/gi, "").trim();
	text = text.replace(/\b\d{6,}\b/g, "").trim();

	// If text is all uppercase, convert to title case
	if (text === text.toUpperCase() && text.length > 3) {
		text = toTitleCase(text);
	}

	// Limit length
	if (text.length > 40) {
		text = text.substring(0, 37) + "...";
	}

	return text || "Transaction";
}

export function inferBudgetCategory(
	rawNote: string | null | undefined,
	type: string,
	amount: number,
): (typeof BUDGET_CATEGORIES)[keyof typeof BUDGET_CATEGORIES] {
	const note = (rawNote || "").toLowerCase();
	const txType = (type || "").toUpperCase();

	// Savings / Interest
	if (
		txType === "INTEREST" ||
		txType === "DIVIDEND" ||
		note.includes("interest") ||
		note.includes("intérêts") ||
		note.includes("dividende") ||
		note.includes("yield")
	) {
		return BUDGET_CATEGORIES.SAVINGS;
	}

	// Income / Salary
	if (
		note.includes("france travail") ||
		note.includes("salaire") ||
		note.includes("remuneration") ||
		note.includes("payroll") ||
		note.includes("pole emploi") ||
		(txType === "DEPOSIT" &&
			amount >= 500 &&
			(note.includes("employeur") || note.includes("virement recu") || note.includes("rembt")))
	) {
		return BUDGET_CATEGORIES.INCOME;
	}

	// Groceries / Supermarket / Food
	if (
		note.includes("leclerc") ||
		note.includes("carrefour") ||
		note.includes("lidl") ||
		note.includes("auchan") ||
		note.includes("monoprix") ||
		note.includes("intermarche") ||
		note.includes("super u") ||
		note.includes("boulangerie") ||
		note.includes("restaurant") ||
		note.includes("uber eats") ||
		note.includes("deliveroo") ||
		note.includes("casino") ||
		note.includes("picard")
	) {
		return BUDGET_CATEGORIES.GROCERIES;
	}

	// Transport & Auto
	if (
		note.includes("tesla") ||
		note.includes("total") ||
		note.includes("shell") ||
		note.includes("bp ") ||
		note.includes("sncf") ||
		note.includes("ratp") ||
		note.includes("uber") ||
		note.includes("bolt") ||
		note.includes("parking") ||
		note.includes("peage") ||
		note.includes("sanef") ||
		note.includes("aprr") ||
		note.includes("station")
	) {
		return BUDGET_CATEGORIES.TRANSPORT;
	}

	// Subscriptions & Tech
	if (
		note.includes("netflix") ||
		note.includes("spotify") ||
		note.includes("apple.com/bill") ||
		note.includes("google *") ||
		note.includes("openai") ||
		note.includes("chatgpt") ||
		note.includes("amazon prime") ||
		note.includes("free mobile") ||
		note.includes("orange") ||
		note.includes("sfr") ||
		note.includes("bouygues") ||
		note.includes("edf") ||
		note.includes("engie") ||
		note.includes("canal+") ||
		note.includes("assurance")
	) {
		return BUDGET_CATEGORIES.SUBSCRIPTIONS;
	}

	// Shopping & eCommerce
	if (
		note.includes("amazon") ||
		note.includes("fnac") ||
		note.includes("darty") ||
		note.includes("zara") ||
		note.includes("ikea") ||
		note.includes("decathlon") ||
		note.includes("leroy merlin") ||
		note.includes("castorama")
	) {
		return BUDGET_CATEGORIES.SHOPPING;
	}

	// Transfers
	if (
		txType === "TRANSFER_IN" ||
		txType === "TRANSFER_OUT" ||
		note.includes("virement") ||
		note.includes("transfer") ||
		note.includes("from ") ||
		note.includes("vers ") ||
		note.includes("- to ") ||
		note.includes(" to ")
	) {
		return BUDGET_CATEGORIES.TRANSFERS;
	}

	if (txType === "DEPOSIT") {
		return BUDGET_CATEGORIES.INCOME;
	}

	return BUDGET_CATEGORIES.OTHER;
}

/**
 * Determines whether a transaction represents an inflow (positive cash flow / credit)
 * or an outflow (expense / debit / withdrawal / fee) for display.
 */
export function isTransactionInflow(
	transactionType?: string | null,
	rawAmount?: number | null,
	rawNotes?: string | null,
): boolean {
	const type = (transactionType || "").toUpperCase();
	const note = (rawNotes || "").toLowerCase();

	// 1. Explicit outflow transaction types
	if (["WITHDRAWAL", "BUY", "TRANSFER_OUT", "FEE", "TAX", "EXPENSE", "PAYMENT"].includes(type)) {
		return false;
	}

	// 2. Explicit inflow transaction types
	if (["DEPOSIT", "SELL", "TRANSFER_IN", "INTEREST", "DIVIDEND", "REFUND", "INCOME"].includes(type)) {
		return true;
	}

	// 3. Raw negative numeric amount (e.g. -489.85) is unambiguously an outflow
	if (typeof rawAmount === "number" && rawAmount < 0) {
		return false;
	}

	// 4. Note semantic parsing for banking and transfers
	// Money leaving (outflow): "- To ...", " vers ", " prlv ", "paiement", "prelevement"
	if (
		note.includes("- to ") ||
		note.includes(" vers ") ||
		note.includes("to loïc") ||
		note.includes("to loic") ||
		note.includes("to emma") ||
		note.includes("prlv ") ||
		note.includes("prelevement") ||
		note.includes("paiement ") ||
		note.includes("payment to")
	) {
		return false;
	}

	// Money entering (inflow): "- From ...", " de ", " vir inst ", "payment from", "refund", "remboursement", "salaire", "france travail"
	if (
		note.includes("- from ") ||
		note.includes("payment from") ||
		note.includes("refund from") ||
		note.includes("remboursement") ||
		note.includes("vir inst") ||
		note.includes("salaire") ||
		note.includes("france travail")
	) {
		return true;
	}

	// 5. Default for bank transactions: standard merchant / purchases are expenses (outflows)
	// (Only explicit deposits or income notes should be marked positive)
	return false;
}

export function parseTransaction(tx: {
	notes?: string | null;
	transactionType?: string | null;
	type?: string | null;
	amount?: number | null;
}): CleanedTransaction {
	const rawType = (tx.transactionType || tx.type || "").toUpperCase();
	const merchant = cleanMerchantName(tx.notes);
	const category = inferBudgetCategory(tx.notes, rawType, Math.abs(tx.amount ?? 0));
	const isPositive = isTransactionInflow(rawType, tx.amount, tx.notes);
	return {
		merchant,
		category,
		rawNote: tx.notes || "",
		isPositive,
	};
}
