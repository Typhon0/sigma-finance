import { describe, expect, it } from "vitest";
import {
	type ParsedFortuneoPosition,
	parseFortuneoClipboard,
	parseFortuneoCSV,
	parseFortuneoPortfolio,
} from "../fortuneo-portfolio-parser";

describe("fortuneo-portfolio-parser", () => {
	describe("parseFortuneoCSV", () => {
		it("parses standard Fortuneo semicolon CSV export", () => {
			const csv = `"Compte";"Code ISIN";"Libellé";"Quantité";"Cours";"Devise";"PRU";"Valorisation";"+/- Value"
"PEA 123456";"FR0010756098";"AMUNDI MSCI WORLD UCITS ETF";"50";"520,35";"EUR";"460,00";"26 017,50";"+3 017,50"
"PEA 123456";"FR0011869353";"BNP PARIBAS EASY S&P 500";"120";"28,40";"EUR";"22,10";"3 408,00";"+756,00"
"PEA 123456";"";"Liquidités disponibles";"1";"1 450,20";"EUR";"1 450,20";"1 450,20";"0,00"`;

			const result = parseFortuneoCSV(csv);

			expect(result.positions).toHaveLength(2);
			expect(result.cashBalance).toBe(1450.2);

			const cw8 = result.positions.find((p) => p.isin === "FR0010756098");
			expect(cw8).toBeDefined();
			expect(cw8?.name).toContain("AMUNDI MSCI WORLD");
			expect(cw8?.symbol).toBe("CW8.PA");
			expect(cw8?.quantity).toBe(50);
			expect(cw8?.purchasePrice).toBe(460);
			expect(cw8?.currentPrice).toBe(520.35);

			const ese = result.positions.find((p) => p.isin === "FR0011869353");
			expect(ese).toBeDefined();
			expect(ese?.symbol).toBe("ESE.PA");
			expect(ese?.quantity).toBe(120);
			expect(ese?.purchasePrice).toBe(22.1);
		});

		it("parses comma-separated CSV with standard floats", () => {
			const csv = `Code ISIN,Libellé,Quantité,Cours,PRU,Valorisation
FR0010756098,AMUNDI MSCI WORLD,50,520.35,460.00,26017.50`;

			const result = parseFortuneoCSV(csv);
			expect(result.positions).toHaveLength(1);
			expect(result.positions[0].quantity).toBe(50);
			expect(result.positions[0].purchasePrice).toBe(460);
		});
	});

	describe("parseFortuneoClipboard", () => {
		it("parses tab-separated web table copy-paste", () => {
			const pasted = `AMUNDI MSCI WORLD UCITS ETF - EUR (C)	FR0010756098	50	520,35 €	460,00 €	26 017,50 €
BNP PARIBAS EASY S&P 500 UCITS ETF	FR0011869353	120	28,40 €	22,10 €	3 408,00 €`;

			const result = parseFortuneoClipboard(pasted);
			expect(result.positions).toHaveLength(2);
			expect(result.positions[0].isin).toBe("FR0010756098");
			expect(result.positions[0].quantity).toBe(50);
			expect(result.positions[0].currentPrice).toBe(520.35);
			expect(result.positions[0].purchasePrice).toBe(460);
		});

		it("extracts cash balance if present in pasted lines", () => {
			const pasted = `Solde Espèces : 2 450,75 €
AMUNDI MSCI WORLD UCITS ETF	FR0010756098	10	520,00 €	500,00 €	5 200,00 €`;

			const result = parseFortuneoClipboard(pasted);
			expect(result.cashBalance).toBe(2450.75);
			expect(result.positions).toHaveLength(1);
		});
	});

	describe("parseFortuneoPortfolio auto-detection", () => {
		it("auto-detects CSV vs clipboard text", () => {
			const csv = `"Code ISIN";"Libellé";"Quantité";"Cours";"PRU"\n"FR0010756098";"AMUNDI MSCI WORLD";"10";"500";"450"`;
			const res = parseFortuneoPortfolio(csv);
			expect(res.positions).toHaveLength(1);
			expect(res.positions[0].isin).toBe("FR0010756098");
		});
	});
});
