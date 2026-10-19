import { jsPDF } from "jspdf";
import type { PortfolioExportData, TaxReportData } from "./types";

/**
 * PDF generation for exports.
 *
 * ## What this used to be
 *
 * `htmlToPDF` built an HTML string, stripped every tag with a regex, joined the
 * result onto one line and wrapped it in a Blob typed `application/pdf`, saved
 * as `*.pdf`. The file that landed on the user's disk was plain text with a
 * PDF extension and would not open in any reader. The comment above it called
 * this a "placeholder", which is fair, but the service reported `success:
 * true` and the UI closed the dialog - so from the user's side it looked like
 * an export that worked.
 *
 * A document this is meant to be handed to an accountant has to actually open,
 * so this now uses jsPDF. The HTML template it replaces was only ever a
 * formatting sketch; the layout below draws the same tables directly.
 */

const PAGE_MARGIN = 14;
const LINE_HEIGHT = 5;

/** Column layout for the positions table, in millimetres from the left edge. */
const POSITION_COLUMNS = [
	{ label: "Asset", width: 44, align: "left" as const },
	{ label: "Qty", width: 16, align: "right" as const },
	{ label: "Value", width: 26, align: "right" as const },
	{ label: "Cost", width: 26, align: "right" as const },
	{ label: "G/L", width: 26, align: "right" as const },
	{ label: "Return", width: 22, align: "right" as const },
];

export class PDFGenerator {
	/**
	 * Format an amount in the currency the server actually valued in.
	 *
	 * The currency is a parameter rather than a hardcoded "USD" because the
	 * previous version printed a dollar sign on every number: a euro-denominated
	 * portfolio was exported as dollars at a 1:1 rate, which is a number the
	 * reader trusts and that is wrong. When the server did not say which
	 * currency it used, the amount is printed bare - a missing unit is visible,
	 * a wrong one is not.
	 */
	private static formatCurrency(amount: number, currency?: string): string {
		const plain = new Intl.NumberFormat("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);

		if (!currency) return plain;
		try {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency,
			}).format(amount);
		} catch {
			// Intl throws RangeError on anything that is not an ISO 4217 code.
			// A malformed code from the server must not take the export down.
			return `${plain} ${currency}`;
		}
	}

	private static formatPercentage(value: number | undefined): string {
		// Undefined, not 0: a position with no cost basis has no computable
		// return, and printing 0.00% states the opposite.
		if (value === undefined || !Number.isFinite(value)) return "n/a";
		return `${value.toFixed(2)}%`;
	}

	private static formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString("en-US");
	}

	/** Green / red / grey, chosen so the colour is not the only signal. */
	private static tone(value: number | undefined): [number, number, number] {
		if (value === undefined || !Number.isFinite(value)) return [110, 110, 110];
		if (value > 0) return [22, 122, 60];
		if (value < 0) return [185, 28, 28];
		return [60, 60, 60];
	}

	private static document(title: string): jsPDF {
		const doc = new jsPDF({ unit: "mm", format: "a4" });
		doc.setFont("helvetica", "bold");
		doc.setFontSize(16);
		doc.text(title, PAGE_MARGIN, 20);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(110, 110, 110);
		doc.text(`Generated ${PDFGenerator.formatDate(new Date().toISOString())}`, PAGE_MARGIN, 26);
		doc.setTextColor(0, 0, 0);
		return doc;
	}

	/** Page geometry for the current position, and a page break when needed. */
	private static ensureRoom(doc: jsPDF, y: number, needed: number): number {
		const pageHeight = doc.internal.pageSize.getHeight();
		if (y + needed <= pageHeight - PAGE_MARGIN) return y;
		doc.addPage();
		return 20;
	}

	private static heading(doc: jsPDF, text: string, y: number): number {
		y = PDFGenerator.ensureRoom(doc, y, 12);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.text(text, PAGE_MARGIN, y);
		doc.setFont("helvetica", "normal");
		return y + LINE_HEIGHT + 1;
	}

	private static keyValue(
		doc: jsPDF,
		label: string,
		value: string,
		y: number,
		tone?: number,
	): number {
		doc.setFontSize(10);
		doc.setTextColor(90, 90, 90);
		doc.text(label, PAGE_MARGIN, y);
		doc.setTextColor(
			...(tone !== undefined ? PDFGenerator.tone(tone) : ([0, 0, 0] as [number, number, number])),
		);
		doc.text(value, 90, y);
		doc.setTextColor(0, 0, 0);
		return y + LINE_HEIGHT + 1;
	}

	/** Draw a table header, returning the y coordinate for the first data row. */
	private static tableHeader(doc: jsPDF, y: number, columns: typeof POSITION_COLUMNS): number {
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setFillColor(240, 240, 240);
		doc.rect(
			PAGE_MARGIN,
			y - 3.5,
			POSITION_COLUMNS.reduce((s, c) => s + c.width, 0),
			5,
			"F",
		);
		let x = PAGE_MARGIN;
		for (const column of columns) {
			const textX = column.align === "right" ? x + column.width - 1.5 : x + 1.5;
			doc.text(column.label, textX, y, { align: column.align });
			x += column.width;
		}
		doc.setFont("helvetica", "normal");
		return y + LINE_HEIGHT;
	}

	static async generatePortfolioReport(data: PortfolioExportData): Promise<Blob> {
		const doc = PDFGenerator.document(`Portfolio Report - ${data.portfolio.name}`);
		if (data.portfolio.currency) {
			// A page that gets separated from its portfolio and handed to
			// someone else has to still say which currency it is in.
			doc.setFontSize(8);
			doc.text(`All amounts in ${data.portfolio.currency}`, PAGE_MARGIN, 32);
		}

		let y = PDFGenerator.heading(doc, "Portfolio Summary", 36);
		y = PDFGenerator.keyValue(
			doc,
			"Total value",
			PDFGenerator.formatCurrency(data.portfolio.totalValue, data.portfolio.currency),
			y,
		);
		y = PDFGenerator.keyValue(
			doc,
			"Total cost",
			PDFGenerator.formatCurrency(data.portfolio.totalCost, data.portfolio.currency),
			y,
		);
		y = PDFGenerator.keyValue(
			doc,
			"Gain / loss",
			PDFGenerator.formatCurrency(data.portfolio.gainLoss, data.portfolio.currency),
			y,
			data.portfolio.gainLoss,
		);
		y = PDFGenerator.keyValue(
			doc,
			"Return",
			PDFGenerator.formatPercentage(data.portfolio.returnPercentage),
			y,
			data.portfolio.returnPercentage,
		);
		y = PDFGenerator.keyValue(doc, "Created", PDFGenerator.formatDate(data.portfolio.createdAt), y);

		// A stale FX rate means the totals above are approximate. A report that
		// does not say so reads as exact, and these numbers get used.
		if (data.portfolio.isStale) {
			doc.setTextColor(150, 100, 0);
			doc.setFontSize(9);
			doc.text(
				"Note: valued with a stale FX rate - these totals are approximate.",
				PAGE_MARGIN,
				y + 2,
			);
			doc.setTextColor(0, 0, 0);
			y += LINE_HEIGHT + 2;
		}

		y = PDFGenerator.heading(doc, "Positions", y + 4);
		y = PDFGenerator.tableHeader(doc, y, POSITION_COLUMNS);

		doc.setFontSize(8);
		for (const position of data.positions) {
			y = PDFGenerator.ensureRoom(doc, y, LINE_HEIGHT);
			const cells: Array<[string, number[] | undefined]> = [
				[
					position.symbol ? `${position.assetName} (${position.symbol})` : position.assetName,
					undefined,
				],
				[position.quantity.toLocaleString("en-US"), undefined],
				[PDFGenerator.formatCurrency(position.currentValue, data.portfolio.currency), undefined],
				[PDFGenerator.formatCurrency(position.costBasis, data.portfolio.currency), undefined],
				[
					PDFGenerator.formatCurrency(position.gainLoss, data.portfolio.currency),
					PDFGenerator.tone(position.gainLoss),
				],
				[
					PDFGenerator.formatPercentage(position.returnPercentage),
					PDFGenerator.tone(position.returnPercentage),
				],
			];

			let x = PAGE_MARGIN;
			cells.forEach(([text, colour], index) => {
				const column = POSITION_COLUMNS[index];
				if (colour) {
					doc.setTextColor(colour[0], colour[1], colour[2]);
				}
				const textX = column.align === "right" ? x + column.width - 1.5 : x + 1.5;
				// Long asset names would otherwise overrun the column into the
				// next one; jsPDF wraps by default, which turns one row into four.
				doc.text(doc.splitTextToSize(text, column.width - 3)[0] ?? "", textX, y, {
					align: column.align,
				});
				doc.setTextColor(0, 0, 0);
				x += column.width;
			});
			y += LINE_HEIGHT;
		}

		if (data.transactions.length > 0) {
			y = PDFGenerator.heading(doc, "Transactions", y + 4);
			y = PDFGenerator.tableHeader(doc, y, [
				{ label: "Date", width: 26, align: "left" },
				{ label: "Type", width: 22, align: "left" },
				{ label: "Asset", width: 60, align: "left" },
				{ label: "Qty", width: 18, align: "right" },
				{ label: "Amount", width: 34, align: "right" },
			]);
			doc.setFontSize(8);
			for (const transaction of data.transactions) {
				y = PDFGenerator.ensureRoom(doc, y, LINE_HEIGHT);
				const cells = [
					PDFGenerator.formatDate(transaction.date),
					transaction.type,
					transaction.symbol
						? `${transaction.assetName} (${transaction.symbol})`
						: transaction.assetName,
					(transaction.quantity ?? 0).toLocaleString("en-US"),
					transaction.amount === undefined
						? "n/a"
						: PDFGenerator.formatCurrency(transaction.amount, data.portfolio.currency),
				];
				let x = PAGE_MARGIN;
				cells.forEach((text, index) => {
					const column = [
						{ width: 26, align: "left" as const },
						{ width: 22, align: "left" as const },
						{ width: 60, align: "left" as const },
						{ width: 18, align: "right" as const },
						{ width: 34, align: "right" as const },
					][index];
					const textX = column.align === "right" ? x + column.width - 1.5 : x + 1.5;
					doc.text(doc.splitTextToSize(text, column.width - 3)[0] ?? "", textX, y, {
						align: column.align,
					});
					x += column.width;
				});
				y += LINE_HEIGHT;
			}
		}

		return doc.output("blob");
	}

	static async generateTaxReport(data: TaxReportData): Promise<Blob> {
		const doc = PDFGenerator.document(`Tax Report ${data.taxYear}`);
		let y = PDFGenerator.heading(doc, "Summary", 36);
		y = PDFGenerator.keyValue(
			doc,
			"Realised gains",
			PDFGenerator.formatCurrency(data.summary.totalRealizedGains),
			y,
		);
		y = PDFGenerator.keyValue(
			doc,
			"Realised losses",
			PDFGenerator.formatCurrency(data.summary.totalRealizedLosses),
			y,
		);
		y = PDFGenerator.keyValue(doc, "Net", PDFGenerator.formatCurrency(data.summary.netGainLoss), y);
		y = PDFGenerator.keyValue(
			doc,
			"Dividends",
			PDFGenerator.formatCurrency(data.summary.totalDividends),
			y,
		);
		return doc.output("blob");
	}
}
