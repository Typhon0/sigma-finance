export const BANK_PALETTE = [
	"#ec4899", // pink (BoursoBank)
	"#10b981", // emerald (Trade Republic)
	"#3b82f6", // blue
	"#8b5cf6", // purple
	"#f59e0b", // amber
	"#ec4899", // pink
	"#06b6d4", // cyan
	"#6366f1", // indigo
	"#14b8a6", // teal
];

export function getBankColor(bankName: string, index: number): string {
	const lower = bankName.toLowerCase();
	if (lower.includes("bourso") || lower.includes("boursorama")) return "#ec4899";
	if (lower.includes("trade republic")) return "#10b981";
	if (lower.includes("revolut")) return "#3b82f6";
	if (lower.includes("bnp")) return "#059669";
	if (lower.includes("credit agricole") || lower.includes("ca")) return "#0284c7";
	if (lower.includes("societe generale") || lower.includes("sg")) return "#e11d48";
	if (lower.includes("bil")) return "#0ea5e9";
	return BANK_PALETTE[index % BANK_PALETTE.length];
}

export function resolveBankName(rawName: string, rawInstitution?: string | null): string {
	const n = (rawName || "").toLowerCase();
	const inst = (rawInstitution || "").trim();
	const instLower = inst.toLowerCase();

	if (n.includes("revolut") || instLower.includes("revolut")) return "Revolut";
	if (n.includes("bourso") || instLower.includes("bourso")) return "BoursoBank";
	if (n.includes("trade republic") || instLower.includes("trade republic")) return "Trade Republic";
	if (n.includes("bnp") || instLower.includes("bnp")) return "BNP Paribas";
	if (n.includes("bil") || instLower.includes("bil")) return "BIL";
	if (n.includes("cic") || instLower.includes("cic")) return "CIC";
	if (
		n.includes("credit agricole") ||
		n.includes("crédit agricole") ||
		instLower.includes("credit agricole") ||
		instLower.includes("crédit agricole")
	)
		return "Crédit Agricole";
	if (
		n.includes("societe generale") ||
		n.includes("société générale") ||
		instLower.includes("societe generale")
	)
		return "Société Générale";
	if (n.includes("n26") || instLower.includes("n26")) return "N26";
	if (n.includes("wise") || instLower.includes("wise")) return "Wise";

	// If institution is present and doesn't look like a person's name with year/id
	if (inst && !/\(\d{4}\)/.test(inst) && !/\([a-f0-9]{4}\)/i.test(inst)) {
		return inst;
	}

	const cleanedName = rawName.replace(/\s*\([^)]*\)\s*$/, "").trim();
	return inst || cleanedName || "Bank";
}

export function resolveCategoryLabel(
	name: string,
	accountType?: string,
	isVault?: boolean,
): string {
	const n = name.toLowerCase();
	if (n.includes("livret a")) return "Livret A";
	if (n.includes("ldds")) return "LDDS";
	if (n.includes("lep")) return "LEP";
	if (n.includes("pel")) return "PEL";
	if (n.includes("cel")) return "CEL";
	if (n.includes("cat") || n.includes("terme")) return "Compte à Terme (CAT)";
	if (
		n.includes("epargne") ||
		n.includes("épargne") ||
		n.includes("savings") ||
		accountType === "savings"
	)
		return "Compte Épargne";
	if (n.includes("cash") || n.includes("liquid")) return "Liquidités / Cash";
	if (
		isVault ||
		n.includes("coffre") ||
		n.includes("vault") ||
		n.includes("pocket") ||
		n.includes("poche")
	)
		return "Coffre / Vault";
	return "Compte Épargne";
}
