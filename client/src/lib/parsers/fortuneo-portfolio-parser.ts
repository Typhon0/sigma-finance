export interface ParsedFortuneoPosition {
	isin: string;
	symbol: string;
	name: string;
	quantity: number;
	purchasePrice: number; // PRU
	currentPrice: number; // Dernier cours
	valuation: number;
	currency: string;
	gainLossPercent?: number;
}

export interface FortuneoPortfolioResult {
	positions: ParsedFortuneoPosition[];
	cashBalance?: number;
	accountName?: string;
	totalValuation?: number;
}

// Known French PEA popular instruments mapping ISIN -> Yahoo Finance Symbol
export const POPULAR_PEA_ISIN_MAP: Record<string, { symbol: string; name: string }> = {
	FR0010756098: { symbol: "CW8.PA", name: "Amundi MSCI World UCITS ETF EUR" },
	FR0011869353: { symbol: "ESE.PA", name: "BNP Paribas Easy S&P 500 UCITS ETF" },
	FR001400U5Q4: { symbol: "WPEA.PA", name: "iShares MSCI World Swap PEA UCITS ETF" },
	FR0010315770: { symbol: "LQQ.PA", name: "Amundi Nasdaq-100 Daily (2x) Leveraged UCITS ETF" },
	FR0013412020: { symbol: "PAASI.PA", name: "Amundi PEA Asie Pacifique UCITS ETF" },
	FR0013412012: { symbol: "PAEEM.PA", name: "Amundi PEA Marchés Émergents UCITS ETF" },
	FR0011550185: { symbol: "PANX.PA", name: "Amundi PEA NASDAQ-100 UCITS ETF" },
	FR0013412285: { symbol: "PUST.PA", name: "Amundi PEA US Tech ESG UCITS ETF" },
	FR0000120271: { symbol: "TTE.PA", name: "TotalEnergies SE" },
	FR0000121014: { symbol: "MC.PA", name: "LVMH Moët Hennessy Louis Vuitton" },
	FR0000120578: { symbol: "SAN.PA", name: "Sanofi SA" },
	FR0000120644: { symbol: "OR.PA", name: "L'Oréal SA" },
	FR0000125338: { symbol: "CAP.PA", name: "Capgemini SE" },
	FR0000121972: { symbol: "SU.PA", name: "Schneider Electric SE" },
	FR0000120073: { symbol: "AI.PA", name: "Air Liquide SA" },
	FR0000051732: { symbol: "ATO.PA", name: "Atos SE" },
	FR0000051807: { symbol: "TEP.PA", name: "Teleperformance SE" },
	FR0000035081: { symbol: "ICAD.PA", name: "Icade" },
	FR0010259150: { symbol: "LEM.PA", name: "Lyxor PEA Eau (Water) UCITS ETF" },
};

export function parseFrenchNumber(val: string | null | undefined): number {
	if (!val) return 0;
	// Strip currency symbols, spaces, quotes
	const cleaned = val
		.replace(/[€$£\s"']/g, "")
		.replace(/\u00a0/g, "") // non-breaking space
		.replace(",", ".");
	const parsed = parseFloat(cleaned);
	return isNaN(parsed) ? 0 : parsed;
}

export function extractIsin(text: string): string | null {
	const match = text.match(/\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/);
	return match ? match[1] : null;
}

export function resolveSymbolForIsin(isin: string, label: string): string {
	if (POPULAR_PEA_ISIN_MAP[isin]) {
		return POPULAR_PEA_ISIN_MAP[isin].symbol;
	}
	// If text contains a short ticker like "CW8" or "WPEA"
	const tickerMatch = label.match(/\b([A-Z0-9]{3,5})\b/);
	if (
		tickerMatch &&
		tickerMatch[1] !== "UCITS" &&
		tickerMatch[1] !== "ETF" &&
		tickerMatch[1] !== "EUR"
	) {
		return `${tickerMatch[1]}.PA`;
	}
	return isin;
}

export function parseFortuneoCSV(content: string): FortuneoPortfolioResult {
	const lines = content
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	if (lines.length === 0) {
		return { positions: [] };
	}

	// Detect delimiter (; or , or \t)
	const firstLine = lines[0];
	let delimiter = ";";
	if (firstLine.includes(";") && !firstLine.includes("\t")) {
		delimiter = ";";
	} else if (firstLine.includes("\t")) {
		delimiter = "\t";
	} else if (firstLine.includes(",")) {
		delimiter = ",";
	}

	const positions: ParsedFortuneoPosition[] = [];
	let cashBalance: number | undefined;

	let headers: string[] = [];
	let headerIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const rawTokens = lines[i].split(delimiter).map((t) => t.replace(/^["']|["']$/g, "").trim());
		const lowerJoined = rawTokens.join(" ").toLowerCase();

		if (
			lowerJoined.includes("isin") ||
			lowerJoined.includes("libell") ||
			lowerJoined.includes("quantit")
		) {
			headers = rawTokens.map((h) => h.toLowerCase());
			headerIndex = i;
			break;
		}
	}

	const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

	for (let i = startIndex; i < lines.length; i++) {
		const tokens = lines[i].split(delimiter).map((t) => t.replace(/^["']|["']$/g, "").trim());
		if (tokens.length < 2) continue;

		const rowStr = tokens.join(" ");

		// Check if this is a cash balance line (e.g. "Liquidités disponibles", "Solde Espèces")
		if (
			rowStr.toLowerCase().includes("liquidit") ||
			rowStr.toLowerCase().includes("solde esp") ||
			rowStr.toLowerCase().includes("espèces")
		) {
			// Find the monetary amounts and take the maximum non-trivial amount
			const candidateNums = tokens.map((tok) => parseFrenchNumber(tok)).filter((n) => n > 1);
			if (candidateNums.length > 0) {
				cashBalance = Math.max(...candidateNums);
			} else {
				// Fallback for amounts <= 1
				for (const tok of tokens) {
					const num = parseFrenchNumber(tok);
					if (num > 0) {
						cashBalance = num;
						break;
					}
				}
			}
			continue;
		}

		// Look for ISIN code
		const isin = extractIsin(rowStr);
		if (!isin) continue;

		let label = "";
		let quantity = 0;
		let purchasePrice = 0;
		let currentPrice = 0;
		let valuation = 0;

		if (headers.length > 0) {
			const isinCol = headers.findIndex((h) => h.includes("isin"));
			const labelCol = headers.findIndex(
				(h) => h.includes("libell") || h.includes("valeur") || h.includes("nom"),
			);
			const qCol = headers.findIndex(
				(h) => h.includes("quantit") || h.includes("qte") || h.includes("titres"),
			);
			const coursCol = headers.findIndex(
				(h) => h.includes("cours") || h.includes("prix") || h.includes("dernier"),
			);
			const pruCol = headers.findIndex(
				(h) => h.includes("pru") || h.includes("revient") || h.includes("achat"),
			);
			const valCol = headers.findIndex(
				(h) => h.includes("valorisation") || h.includes("montant") || h.includes("total"),
			);

			label = labelCol >= 0 && tokens[labelCol] ? tokens[labelCol] : "";
			quantity = qCol >= 0 ? parseFrenchNumber(tokens[qCol]) : 0;
			currentPrice = coursCol >= 0 ? parseFrenchNumber(tokens[coursCol]) : 0;
			purchasePrice = pruCol >= 0 ? parseFrenchNumber(tokens[pruCol]) : currentPrice;
			valuation = valCol >= 0 ? parseFrenchNumber(tokens[valCol]) : quantity * currentPrice;
		}

		// Fallback if headers were not matched or columns missing
		if (!label) {
			// Pick longest non-numeric token as label
			const textTokens = tokens.filter(
				(t) =>
					t !== isin &&
					isNaN(parseFrenchNumber(t)) &&
					t.length > 3 &&
					!t.includes("PEA") &&
					!t.includes("EUR"),
			);
			label = textTokens[0] || isin;
		}

		if (quantity === 0) {
			const numericTokens = tokens.map((t) => parseFrenchNumber(t)).filter((n) => n > 0);
			if (numericTokens.length >= 2) {
				quantity = numericTokens[0];
				currentPrice = numericTokens[1];
				purchasePrice = numericTokens[2] || currentPrice;
			}
		}

		if (quantity > 0) {
			const symbol = resolveSymbolForIsin(isin, label);
			positions.push({
				isin,
				symbol,
				name: label || symbol,
				quantity,
				purchasePrice: purchasePrice || currentPrice,
				currentPrice: currentPrice || purchasePrice,
				valuation: valuation || quantity * (currentPrice || purchasePrice),
				currency: "EUR",
			});
		}
	}

	return { positions, cashBalance };
}

export function parseFortuneoClipboard(text: string): FortuneoPortfolioResult {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	const positions: ParsedFortuneoPosition[] = [];
	let cashBalance: number | undefined;

	for (const line of lines) {
		// Check for cash balance line (e.g. "Solde Espèces : 2 450,75 €")
		if (
			line.toLowerCase().includes("solde esp") ||
			line.toLowerCase().includes("liquidit") ||
			line.toLowerCase().includes("espèces :")
		) {
			const match = line.match(/([\d\s]+[,.]\d{2})/);
			if (match) {
				cashBalance = parseFrenchNumber(match[1]);
			}
			continue;
		}

		const isin = extractIsin(line);
		if (!isin) continue;

		// Split on tabs if available, else look for numbers
		const tokens = line.includes("\t")
			? line.split("\t").map((t) => t.trim())
			: line.split(/\s{2,}/).map((t) => t.trim());

		let label = "";
		const numericValues: number[] = [];

		for (const token of tokens) {
			if (token.includes(isin)) continue;
			const num = parseFrenchNumber(token);
			if (
				num > 0 &&
				(token.includes("€") || token.includes(",") || !isNaN(Number(token.replace(/\s/g, ""))))
			) {
				numericValues.push(num);
			} else if (!label && token.length > 3 && !token.includes("PEA")) {
				label = token;
			}
		}

		// Default label fallback if label was next to isin
		if (!label) {
			const lineWithoutIsin = line.replace(isin, "").trim();
			const parts = lineWithoutIsin.split(/[\d\t]/);
			label = parts[0]?.trim() || isin;
		}

		// Typical numeric sequence: quantity, current price, PRU, valuation
		let quantity = 0;
		let currentPrice = 0;
		let purchasePrice = 0;
		let valuation = 0;

		if (numericValues.length >= 3) {
			quantity = numericValues[0];
			currentPrice = numericValues[1];
			purchasePrice = numericValues[2];
			valuation = numericValues[3] || quantity * currentPrice;
		} else if (numericValues.length === 2) {
			quantity = numericValues[0];
			currentPrice = numericValues[1];
			purchasePrice = currentPrice;
			valuation = quantity * currentPrice;
		}

		if (quantity > 0) {
			const symbol = resolveSymbolForIsin(isin, label);
			positions.push({
				isin,
				symbol,
				name: label || symbol,
				quantity,
				purchasePrice: purchasePrice || currentPrice,
				currentPrice: currentPrice || purchasePrice,
				valuation: valuation || quantity * currentPrice,
				currency: "EUR",
			});
		}
	}

	return { positions, cashBalance };
}

export function parseFortuneoPortfolio(raw: string): FortuneoPortfolioResult {
	const trimmed = (raw || "").trim();
	if (trimmed.includes(";") || (trimmed.includes(",") && trimmed.includes("\n"))) {
		const csvRes = parseFortuneoCSV(trimmed);
		if (csvRes.positions.length > 0) return csvRes;
	}
	return parseFortuneoClipboard(trimmed);
}
