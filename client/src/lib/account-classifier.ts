/**
 * Account classification and ownership detection engine.
 * Provides deterministic, hardened categorization of financial accounts
 * across Bank (Joint, Checking, Vault/Pocket), Broker (CTO, PEA, PER),
 * Wallet (Cold Storage, Hot Wallet, On-Chain), and Exchange (CEX).
 */

export type AccountCategory =
	| "BANK_JOINT"
	| "BANK_CHECKING"
	| "BANK_VAULT"
	| "BROKER_CTO"
	| "BROKER_PEA"
	| "BROKER_PER"
	| "WALLET_COLD"
	| "WALLET_HOT"
	| "WALLET_ONCHAIN"
	| "CEX_SPOT"
	| "OTHER";

export type OwnershipType = "JOINT" | "INDIVIDUAL" | "CORPORATE";

export interface AccountLike {
	id?: string;
	name: string;
	type?: string | null;
	assetClass?: string | null;
	taxWrapper?: string | null;
	institution?: string | null;
	accountNumber?: string | null;
	currency?: string | null;
}

export interface ClassifiedAccountInfo {
	category: AccountCategory;
	ownership: OwnershipType;
	primaryTypeLabel: string;
	subTypeLabel: string;
	badgeLabel: string;
	badgeClassName: string;
	friendlyTitle: string;
	legalName?: string;
	isJoint: boolean;
	isVault: boolean;
}

// Known corporate names containing "&" to avoid false positive joint account matches
const CORPORATE_CONJUNCTION_PATTERN =
	/\b(?:& CO|& COMPANY|& SONS|& BROTHERS|& PARTNERS|& ASSOCIATES|& DAUGHTERS|M&G|B&B|AT&T|S&P|JOHNSON & JOHNSON|MARKS & SPENCER|PROCTER & GAMBLE|ERNST & YOUNG|STANDARD & POOR|TIFFANY & CO)\b/i;

// Keywords indicating joint or community ownership
const JOINT_KEYWORDS_PATTERN =
	/(?:compte\s+joint|joint\s+account|co-?titulaire|indivis|commun|partag[eé]|indivision)/i;

// Keywords indicating currency pockets, vaults or savings pockets
const VAULT_KEYWORDS_PATTERN = /(?:pocket|coffre|vault|safe|sous-compte|tirelire|spare|arrondi)/i;

// Hardware cold storage keywords
const COLD_WALLET_PATTERN =
	/(?:ledger|trezor|cypherock|keystone|bitbox|coldcard|tangem|onekey|ngrave)/i;

// Software hot wallet keywords
const HOT_WALLET_PATTERN =
	/(?:metamask|phantom|rabby|rainbow|trust\s*wallet|coinbase\s*wallet|zerion|backpack)/i;

/**
 * Capitalizes a name token cleanly (e.g. "LOIC" -> "Loïc" or "Loic", "HÉLÈNE" -> "Hélène").
 */
function capitalizeWord(word: string): string {
	if (!word) return "";
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Extracts a friendly person name from an uppercase legal string (e.g. "EMMA HÉLÈNE ALINE ANNA JUSSIANT" -> "Emma").
 */
function extractGivenName(fullPart: string): string {
	const cleaned = fullPart.replace(/^(?:M\.|MME|MR|MRS|MLLE|MONSIEUR|MADAME)\s+/i, "").trim();
	const tokens = cleaned.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return fullPart;
	return capitalizeWord(tokens[0]);
}

/**
 * Inspects whether two string fragments look like two separate person holders.
 */
function isTwoPersonHolders(partA: string, partB: string): boolean {
	// Strip pocket suffix like "(1895)" or "(2c8f)"
	const cleanA = partA.replace(/\s*\([^)]*\)\s*$/, "").trim();
	const cleanB = partB.replace(/\s*\([^)]*\)\s*$/, "").trim();

	if (cleanA.length < 2 || cleanB.length < 2) return false;

	// Neither part should contain purely generic business words
	if (
		/\b(?:bank|bourse|holdings|capital|invest|finance|technologies|corp|ltd|gmbh|sa|sas|sarl)\b/i.test(
			cleanA + " " + cleanB,
		)
	) {
		return false;
	}

	return true;
}

/**
 * Classifies an account and produces dynamic category, ownership, badges, and friendly naming.
 */
export function classifyAccount(account: AccountLike): ClassifiedAccountInfo {
	const rawName = (account.name || "").trim();
	const rawType = (account.type || "BANK").toUpperCase();
	const taxWrapper = (account.taxWrapper || "").toUpperCase();

	const isBankType =
		rawType === "BANK" ||
		rawType === "BANK_ACCOUNT" ||
		rawType === "SAVINGS" ||
		rawType === "CHECKING";
	const isBrokerType = rawType === "BROKER" || rawType === "SECURITIES";
	const isWalletType = rawType === "CRYPTO_WALLET" || rawType === "WALLET";
	const isCexType = rawType === "CRYPTO_EXCHANGE" || rawType === "CEX";

	// 1. BANK ACCOUNTS
	if (isBankType) {
		let isJoint = false;
		const isVault = VAULT_KEYWORDS_PATTERN.test(rawName);
		let ownership: OwnershipType = "INDIVIDUAL";
		let jointHolders: [string, string] | null = null;

		// Check corporate false positive first
		if (!CORPORATE_CONJUNCTION_PATTERN.test(rawName)) {
			// Check explicit joint keywords
			if (JOINT_KEYWORDS_PATTERN.test(rawName)) {
				isJoint = true;
				ownership = "JOINT";
			} else {
				// Check conjunctions between holders: " & ", " ET ", " OU ", " / ", " + "
				const conjunctionMatch = rawName.match(/\s+(&|ET|OU|ET\/OU|\+|\/)\s+/i);
				if (conjunctionMatch && conjunctionMatch.index != null) {
					const sep = conjunctionMatch[0];
					const idx = conjunctionMatch.index;
					const partA = rawName.slice(0, idx).trim();
					const partB = rawName.slice(idx + sep.length).trim();

					if (isTwoPersonHolders(partA, partB)) {
						isJoint = true;
						ownership = "JOINT";
						jointHolders = [extractGivenName(partA), extractGivenName(partB)];
					}
				}
			}
		}

		let category: AccountCategory = "BANK_CHECKING";
		let subTypeLabel = "Compte Courant";
		let badgeLabel = "Compte Courant";
		let badgeClassName = "text-muted-foreground border-border";

		if (isJoint) {
			category = "BANK_JOINT";
			subTypeLabel = "Compte Joint";
			badgeLabel = "Compte Joint";
			badgeClassName =
				"bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-semibold";
		} else if (isVault) {
			category = "BANK_VAULT";
			subTypeLabel = "Poche / Coffre";
			badgeLabel = "Poche / Coffre";
			badgeClassName = "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30";
		}

		// Friendly title resolution
		let friendlyTitle = rawName;
		let legalName: string | undefined;

		if (isJoint) {
			legalName = rawName;
			// Extract pocket suffix if present (e.g. "(1895)", "(2c8f)")
			const suffixMatch = rawName.match(/\s*\(([a-f0-9]{4})\)\s*$/i);
			const suffix = suffixMatch ? ` (${suffixMatch[1]})` : "";

			if (jointHolders) {
				friendlyTitle = `Compte Joint (${jointHolders[0]} & ${jointHolders[1]})${suffix}`;
			} else {
				friendlyTitle = `Compte Joint${suffix}`;
			}
		}

		return {
			category,
			ownership,
			primaryTypeLabel: "Bank",
			subTypeLabel,
			badgeLabel,
			badgeClassName,
			friendlyTitle,
			legalName,
			isJoint,
			isVault,
		};
	}

	// 2. BROKER ACCOUNTS
	if (isBrokerType) {
		let category: AccountCategory = "BROKER_CTO";
		let subTypeLabel = "Compte Titres (CTO)";
		let badgeLabel = "CTO";
		let badgeClassName = "font-mono border-border";

		if (taxWrapper === "PEA") {
			category = "BROKER_PEA";
			subTypeLabel = "Plan d'Épargne en Actions (PEA)";
			badgeLabel = "PEA";
			badgeClassName =
				"bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold";
		} else if (taxWrapper === "RETIREMENT_SHELTERED" || /retraite|per\b/i.test(rawName)) {
			category = "BROKER_PER";
			subTypeLabel = "Plan Épargne Retraite (PER)";
			badgeLabel = "Retraite";
			badgeClassName =
				"bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30";
		}

		return {
			category,
			ownership: "INDIVIDUAL",
			primaryTypeLabel: "Broker",
			subTypeLabel,
			badgeLabel,
			badgeClassName,
			friendlyTitle: rawName,
			isJoint: false,
			isVault: false,
		};
	}

	// 3. CRYPTO WALLETS
	if (isWalletType) {
		const targetStr = `${rawName} ${account.institution || ""}`;
		const isCold = COLD_WALLET_PATTERN.test(targetStr);
		const isHot = !isCold && HOT_WALLET_PATTERN.test(targetStr);

		const category: AccountCategory = isCold
			? "WALLET_COLD"
			: isHot
				? "WALLET_HOT"
				: "WALLET_ONCHAIN";

		const badgeLabel = isCold ? "Cold Storage" : isHot ? "Hot Wallet" : "On-Chain";
		const badgeClassName = isCold
			? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-semibold"
			: isHot
				? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30"
				: "font-mono border-border";

		return {
			category,
			ownership: "INDIVIDUAL",
			primaryTypeLabel: "On-Chain Wallet",
			subTypeLabel: badgeLabel,
			badgeLabel,
			badgeClassName,
			friendlyTitle: rawName,
			isJoint: false,
			isVault: false,
		};
	}

	// 4. CRYPTO EXCHANGES (CEX)
	if (isCexType) {
		return {
			category: "CEX_SPOT",
			ownership: "INDIVIDUAL",
			primaryTypeLabel: "Exchange",
			subTypeLabel: "CEX Spot",
			badgeLabel: "Exchange",
			badgeClassName:
				"bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30 font-medium",
			friendlyTitle: rawName,
			isJoint: false,
			isVault: false,
		};
	}

	// 5. OTHER / FALLBACK
	return {
		category: "OTHER",
		ownership: "INDIVIDUAL",
		primaryTypeLabel: "Autre",
		subTypeLabel: "Compte",
		badgeLabel: "Autre",
		badgeClassName: "text-muted-foreground border-border",
		friendlyTitle: rawName,
		isJoint: false,
		isVault: false,
	};
}
