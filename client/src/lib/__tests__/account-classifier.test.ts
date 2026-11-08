import { describe, expect, it } from "vitest";
import { classifyAccount } from "../account-classifier";

describe("account-classifier", () => {
	describe("Joint Accounts (Compte Joint)", () => {
		it("detects uppercase Revolut joint account with multiple names separated by &", () => {
			const result = classifyAccount({
				name: "EMMA HÉLÈNE ALINE ANNA JUSSIANT & LOIC GUY FRANCIS SCULIER (2c8f)",
				type: "BANK",
				currency: "JPY",
			});

			expect(result.category).toBe("BANK_JOINT");
			expect(result.ownership).toBe("JOINT");
			expect(result.isJoint).toBe(true);
			expect(result.badgeLabel).toBe("Compte Joint");
			expect(result.friendlyTitle).toBe("Compte Joint (Emma & Loic) (2c8f)");
			expect(result.legalName).toBe(
				"EMMA HÉLÈNE ALINE ANNA JUSSIANT & LOIC GUY FRANCIS SCULIER (2c8f)",
			);
		});

		it("detects joint accounts separated by ET or OU", () => {
			const resEt = classifyAccount({
				name: "Loïc Sculier et Emma Jussiant",
				type: "BANK",
			});
			expect(resEt.category).toBe("BANK_JOINT");
			expect(resEt.friendlyTitle).toBe("Compte Joint (Loïc & Emma)");

			const resOu = classifyAccount({
				name: "M. Sculier OU Mme Jussiant",
				type: "BANK",
			});
			expect(resOu.category).toBe("BANK_JOINT");
		});

		it("detects joint accounts with explicit keyword 'Compte Joint'", () => {
			const result = classifyAccount({
				name: "Compte Joint Famille",
				type: "BANK",
			});
			expect(result.category).toBe("BANK_JOINT");
			expect(result.isJoint).toBe(true);
		});

		it("does not false-positive on corporate names with &", () => {
			const result1 = classifyAccount({
				name: "Johnson & Johnson Bank Account",
				type: "BANK",
			});
			expect(result1.category).toBe("BANK_CHECKING");
			expect(result1.isJoint).toBe(false);

			const result2 = classifyAccount({
				name: "Marks & Spencer Holdings",
				type: "BANK",
			});
			expect(result2.category).toBe("BANK_CHECKING");
			expect(result2.isJoint).toBe(false);
		});
	});

	describe("Personal Bank Accounts & Vaults", () => {
		it("classifies standard personal bank account as Compte Courant", () => {
			const result = classifyAccount({
				name: "Loïc Sculier",
				type: "BANK",
				currency: "CHF",
			});
			expect(result.category).toBe("BANK_CHECKING");
			expect(result.ownership).toBe("INDIVIDUAL");
			expect(result.badgeLabel).toBe("Compte Courant");
			expect(result.friendlyTitle).toBe("Loïc Sculier");
		});

		it("classifies currency pockets / vaults as Poche / Coffre", () => {
			const result = classifyAccount({
				name: "Coffre Vacances USD",
				type: "BANK",
			});
			expect(result.category).toBe("BANK_VAULT");
			expect(result.isVault).toBe(true);
			expect(result.badgeLabel).toBe("Poche / Coffre");
		});
	});

	describe("Broker Accounts", () => {
		it("classifies standard broker account as CTO (never Bank or PEA)", () => {
			const result = classifyAccount({
				name: "Trade Republic CTO",
				type: "BROKER",
				taxWrapper: "STANDARD_TAXABLE",
			});
			expect(result.category).toBe("BROKER_CTO");
			expect(result.badgeLabel).toBe("CTO");
			expect(result.primaryTypeLabel).toBe("Broker");
		});

		it("classifies PEA broker account as PEA", () => {
			const result = classifyAccount({
				name: "Fortuneo PEA",
				type: "BROKER",
				taxWrapper: "PEA",
			});
			expect(result.category).toBe("BROKER_PEA");
			expect(result.badgeLabel).toBe("PEA");
		});

		it("classifies retirement sheltered account as Retraite", () => {
			const result = classifyAccount({
				name: "Plan Épargne Retraite",
				type: "BROKER",
				taxWrapper: "RETIREMENT_SHELTERED",
			});
			expect(result.category).toBe("BROKER_PER");
			expect(result.badgeLabel).toBe("Retraite");
		});
	});

	describe("Crypto Wallets & Exchanges", () => {
		it("classifies hardware wallets as Cold Storage", () => {
			const result = classifyAccount({
				name: "Cypherock Solana",
				type: "CRYPTO_WALLET",
			});
			expect(result.category).toBe("WALLET_COLD");
			expect(result.badgeLabel).toBe("Cold Storage");
		});

		it("classifies software wallets as Hot Wallet", () => {
			const result = classifyAccount({
				name: "MetaMask Main",
				type: "CRYPTO_WALLET",
			});
			expect(result.category).toBe("WALLET_HOT");
			expect(result.badgeLabel).toBe("Hot Wallet");
		});

		it("classifies exchanges as Exchange", () => {
			const result = classifyAccount({
				name: "Kraken Spot",
				type: "CRYPTO_EXCHANGE",
			});
			expect(result.category).toBe("CEX_SPOT");
			expect(result.badgeLabel).toBe("Exchange");
		});
	});
});
