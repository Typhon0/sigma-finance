import { describe, expect, it } from "vitest";
import { PDFGenerator } from "../pdf-generator";
import type { PortfolioExportData } from "../types";

/**
 * The PDF writer used to build an HTML string, strip the tags with a regex and
 * wrap the result in a Blob typed `application/pdf`. The file landed on disk
 * as plain text with a .pdf extension, and the service reported success, so
 * the failure was invisible until someone tried to open the file.
 *
 * These tests assert on the bytes: a real PDF starts with %PDF- and ends with
 * EOF. Anything else is a text file wearing a PDF's name.
 */

function sample(overrides: Partial<PortfolioExportData["portfolio"]> = {}): PortfolioExportData {
	return {
		portfolio: {
			id: "p1",
			name: "Retirement",
			createdAt: "2024-03-01T00:00:00Z",
			totalValue: 1000,
			totalCost: 800,
			gainLoss: 200,
			returnPercentage: 25,
			currency: "USD",
			isStale: false,
			...overrides,
		},
		positions: [
			{
				id: "a1-0",
				assetName: "Acme Corp",
				assetType: "STOCK",
				symbol: "ACME",
				quantity: 10,
				currentValue: 1000,
				costBasis: 800,
				gainLoss: 200,
				returnPercentage: 25,
				ownershipPercentage: 100,
			},
		],
		transactions: [],
	};
}

/**
 * Read a Blob back as text.
 *
 * jsdom's Blob is a stub exposing only `slice`, `size` and `type` - no
 * `arrayBuffer()`, no `text()` - so Blob.arrayBuffer() throws here even though
 * it works in every real browser. FileReader is the one full implementation
 * jsdom provides. A string is enough: the assertions only look at the PDF
 * header, the trailer and literal text operators.
 */
function readBlob(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsText(blob);
	});
}

/** The first five bytes, which is what makes a file a PDF. */
function header(text: string): string {
	return text.slice(0, 5);
}

describe("PDFGenerator", () => {
	it("produces a real PDF, not text with a .pdf extension", async () => {
		const blob = await PDFGenerator.generatePortfolioReport(sample());
		const text = await readBlob(blob);

		expect(blob.type).toBe("application/pdf");
		expect(header(text)).toBe("%PDF-");
		expect(blob.size).toBeGreaterThan(500);
	});

	it("ends the file where a PDF reader expects the trailer", async () => {
		const text = await readBlob(await PDFGenerator.generatePortfolioReport(sample()));
		expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
	});

	it("names the portfolio on the document", async () => {
		const text = await readBlob(await PDFGenerator.generatePortfolioReport(sample()));
		// PDF text operators keep the literal string, so the title is
		// recoverable from the raw stream without a parser.
		expect(text).toContain("Retirement");
	});

	it("uses the currency the server valued in, not a hardcoded dollar sign", async () => {
		const text = await readBlob(
			await PDFGenerator.generatePortfolioReport(sample({ currency: "EUR" })),
		);

		expect(text).toContain("EUR");
		expect(text).not.toContain("USD");
		expect(text).not.toContain("$1,000.00");
	});

	it("prints a bare amount when the server did not say the currency", async () => {
		const text = await readBlob(
			await PDFGenerator.generatePortfolioReport(sample({ currency: undefined })),
		);

		// A missing unit is visible; a wrong one is not.
		expect(text).not.toContain("$");
		expect(text).toContain("1,000.00");
	});

	it("survives a currency code Intl would reject", async () => {
		const text = await readBlob(
			await PDFGenerator.generatePortfolioReport(sample({ currency: "NOT-A-CODE" })),
		);

		expect(header(text)).toBe("%PDF-");
		expect(text).toContain("NOT-A-CODE");
	});

	it("says the totals are approximate when the FX rate was stale", async () => {
		const text = await readBlob(
			await PDFGenerator.generatePortfolioReport(sample({ isStale: true })),
		);
		expect(text).toContain("stale FX rate");
	});

	it("renders an uncomputable return as n/a, not as 0.00%", async () => {
		const data = sample();
		data.positions[0].returnPercentage = undefined;

		const text = await readBlob(await PDFGenerator.generatePortfolioReport(data));
		expect(text).toContain("n/a");
		expect(text).not.toContain("0.00%");
	});

	it("still produces a document when there are no positions and no transactions", async () => {
		const data = sample();
		data.positions = [];
		const text = await readBlob(await PDFGenerator.generatePortfolioReport(data));

		expect(header(text)).toBe("%PDF-");
	});
});
