/**
 * Detects whether an asset symbol is an internal synthetic cash placeholder
 * (e.g. EUR_CASH_1e8fda4e-f1ae-4105-9c87-86ea962ca620).
 */
export function isSyntheticCashSymbol(symbol?: string | null): boolean {
	if (!symbol) return false;
	const s = symbol.trim().toUpperCase();
	return (
		s.includes("_CASH_") || s.startsWith("CASH_") || s === "CASH" || /^[A-Z]{3,4}_CASH$/i.test(s)
	);
}

/**
 * Extracts a human-friendly symbol or label from technical/synthetic symbols.
 * Prevents raw UUIDs like "EUR_CASH_1e8fda4e-f1ae-4105-9c87-86ea962ca620" from leaking to the UI.
 */
export function cleanAssetSymbolForDisplay(symbol?: string | null): string {
	if (!symbol) return "";
	const s = symbol.trim();
	const cashMatch = s.match(/^([A-Z]{3,4})_CASH(?:_[a-f0-9-]+)?$/i);
	if (cashMatch) {
		return `Cash • ${cashMatch[1].toUpperCase()}`;
	}
	if (/^CASH_/i.test(s) || s.toUpperCase() === "CASH") {
		return "Cash";
	}
	return s;
}

/**
 * Cleans and formats instrument/asset names for display.
 * - Resolves known mojibake (e.g. "mo√´t" -> "Moët", "Ã©" -> "é")
 * - Handles known French/European bluechips with clean official branding
 * - Title-cases raw lowercase names from bank/broker sync
 * - Strips redundant trailing legal noise (", Societe Europeenne", " SA", " S.A.", " A/S")
 */
export function formatAssetDisplayName(rawName?: string | null, symbol?: string | null): string {
	if (!rawName) {
		if (isSyntheticCashSymbol(symbol)) {
			return cleanAssetSymbolForDisplay(symbol);
		}
		return symbol || "";
	}
	let name = rawName.trim();

	// If name itself is an unformatted synthetic cash ID, format it cleanly
	if (isSyntheticCashSymbol(name)) {
		return cleanAssetSymbolForDisplay(name);
	}

	// 1. Fix common mojibake sequences
	name = name
		.replace(/mo[√\u221a]['´\u0027\u00b4\u2018\u2019\u02bc]?t/gi, "Moët")
		.replace(/Ã©/g, "é")
		.replace(/Ã¨/g, "è")
		.replace(/Ã /g, "à")
		.replace(/Ã¢/g, "â")
		.replace(/Ã®/g, "î")
		.replace(/Ã´/g, "ô")
		.replace(/Ã»/g, "û")
		.replace(/Ã§/g, "ç")
		.replace(/Ã‹/g, "Ë")
		.replace(/Ã‰/g, "É");

	// 2. Direct overrides for major Euronext / European tickers
	const sym = (symbol || "").toUpperCase().trim();
	const lower = name.toLowerCase();

	if (
		sym === "FP.PA" ||
		sym === "TTE" ||
		sym === "TTE.PA" ||
		lower.startsWith("total se") ||
		lower === "total"
	) {
		return "TotalEnergies";
	}
	if (sym === "AI.PA" || lower.includes("air liquide")) {
		return "Air Liquide";
	}
	if (sym === "DG.PA" || lower.startsWith("vinci")) {
		return "VINCI";
	}
	if (sym === "CS.PA" || lower.startsWith("axa")) {
		return "AXA";
	}
	if (sym === "NOVO-B.CO" || lower.includes("novo nordisk")) {
		return "Novo Nordisk";
	}
	if (sym === "MC.PA" || lower.includes("lvmh")) {
		return "LVMH Moët Hennessy";
	}
	if (sym === "BNP.PA" || lower.includes("bnp paribas")) {
		return "BNP Paribas";
	}
	if (
		sym === "GLE.PA" ||
		lower.includes("societe generale") ||
		lower.includes("société générale")
	) {
		return "Société Générale";
	}
	if (sym === "SAN.PA" || lower.startsWith("sanofi")) {
		return "Sanofi";
	}
	if (sym === "OR.PA" || lower.includes("l'oreal") || lower.includes("l'oréal")) {
		return "L'Oréal";
	}
	if (sym === "RMS.PA" || lower.startsWith("hermes") || lower.startsWith("hermès")) {
		return "Hermès";
	}
	if (sym === "SU.PA" || lower.includes("schneider electric")) {
		return "Schneider Electric";
	}

	// 3. Strip legal structure clutter at the end
	name = name
		.replace(/,\s*societe\s+europeenne\b/gi, "")
		.replace(/,\s*société\s+européenne\b/gi, "")
		.replace(
			/(?:,\s*|\s+)(?:s\.a\.|sa|s\.e\.|se|a\/s|ag|n\.v\.|nv|plc|corp\.|corp|inc\.|inc)\.?$/gi,
			"",
		)
		.replace(/,\s*$/g, "")
		.trim();

	// 4. If all lowercase or all uppercase, convert to Title Case
	if (name === name.toLowerCase() || (name === name.toUpperCase() && name.length > 5)) {
		name = name
			.split(" ")
			.map((word) => {
				if (!word) return "";
				if (/^(etf|usd|eur|gbp|chf|dax|cac|nasdaq|nyse)$/i.test(word)) return word.toUpperCase();
				return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
			})
			.join(" ");
	}

	return name;
}
