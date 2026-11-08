import { describe, expect, it } from "vitest";
import {
	cleanAssetSymbolForDisplay,
	formatAssetDisplayName,
	isSyntheticCashSymbol,
} from "../format-asset-name";

describe("formatAssetDisplayName", () => {
	it("resolves mojibake for LVMH", () => {
		const ugly = "lvmh mo√´t hennessy - louis vuitton, societe europeenne";
		expect(formatAssetDisplayName(ugly, "MC.PA")).toBe("LVMH Moët Hennessy");
	});

	it("formats TotalEnergies cleanly", () => {
		expect(formatAssetDisplayName("total se", "FP.PA")).toBe("TotalEnergies");
		expect(formatAssetDisplayName("TOTAL", "TTE")).toBe("TotalEnergies");
	});

	it("formats Air Liquide cleanly", () => {
		expect(formatAssetDisplayName("l'air liquide s.a.", "AI.PA")).toBe("Air Liquide");
	});

	it("formats VINCI and AXA cleanly", () => {
		expect(formatAssetDisplayName("vinci sa", "DG.PA")).toBe("VINCI");
		expect(formatAssetDisplayName("axa sa", "CS.PA")).toBe("AXA");
	});

	it("formats Novo Nordisk cleanly", () => {
		expect(formatAssetDisplayName("novo nordisk a/s", "NOVO-B.CO")).toBe("Novo Nordisk");
	});

	it("converts raw lowercase names to Title Case and strips legal clutter", () => {
		expect(formatAssetDisplayName("apple inc.", "AAPL")).toBe("Apple");
		expect(formatAssetDisplayName("alphabet class a inc.", "GOOGL")).toBe("Alphabet Class A");
	});
});

describe("isSyntheticCashSymbol", () => {
	it("identifies synthetic cash symbols with UUIDs", () => {
		expect(isSyntheticCashSymbol("EUR_CASH_1e8fda4e-f1ae-4105-9c87-86ea962ca620")).toBe(true);
		expect(isSyntheticCashSymbol("USD_CASH_abcdef12-3456-7890-abcd-ef1234567890")).toBe(true);
		expect(isSyntheticCashSymbol("EUR_CASH")).toBe(true);
		expect(isSyntheticCashSymbol("CASH_EUR")).toBe(true);
		expect(isSyntheticCashSymbol("CASH")).toBe(true);
	});

	it("returns false for real asset tickers", () => {
		expect(isSyntheticCashSymbol("AAPL")).toBe(false);
		expect(isSyntheticCashSymbol("MC.PA")).toBe(false);
		expect(isSyntheticCashSymbol("BTC")).toBe(false);
		expect(isSyntheticCashSymbol(null)).toBe(false);
	});
});

describe("cleanAssetSymbolForDisplay", () => {
	it("converts synthetic cash symbols to clean human readable labels", () => {
		expect(cleanAssetSymbolForDisplay("EUR_CASH_1e8fda4e-f1ae-4105-9c87-86ea962ca620")).toBe(
			"Cash • EUR",
		);
		expect(cleanAssetSymbolForDisplay("USD_CASH_1234")).toBe("Cash • USD");
		expect(cleanAssetSymbolForDisplay("CASH")).toBe("Cash");
	});

	it("preserves standard tickers intact", () => {
		expect(cleanAssetSymbolForDisplay("MC.PA")).toBe("MC.PA");
		expect(cleanAssetSymbolForDisplay("NOVO-B.CO")).toBe("NOVO-B.CO");
	});
});
