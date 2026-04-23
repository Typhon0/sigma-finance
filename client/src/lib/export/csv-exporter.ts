import type { AuditTrailData, PortfolioExportData, TaxReportData } from "./types";

export class CSVExporter {
	private static escapeCSVField(field: any): string {
		if (field === null || field === undefined) return "";

		const str = String(field);
		// Escape quotes and wrap in quotes if contains comma, quote, or newline
		if (str.includes(",") || str.includes('"') || str.includes("\n")) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	}

	private static arrayToCSV(headers: string[], rows: any[][]): string {
		const csvHeaders = headers.join(",");
		const csvRows = rows.map((row) =>
			row.map((field) => CSVExporter.escapeCSVField(field)).join(","),
		);
		return [csvHeaders, ...csvRows].join("\n");
	}

	static exportPortfolioData(data: PortfolioExportData): string {
		// Portfolio summary
		const portfolioHeaders = [
			"Name",
			"Total Value",
			"Total Cost",
			"Gain/Loss",
			"Return %",
			"Created Date",
		];
		const portfolioRow = [
			data.portfolio.name,
			data.portfolio.totalValue,
			data.portfolio.totalCost,
			data.portfolio.gainLoss,
			data.portfolio.returnPercentage,
			data.portfolio.createdAt,
		];

		// Positions
		const positionHeaders = [
			"Asset Name",
			"Asset Type",
			"Symbol",
			"Quantity",
			"Current Price",
			"Current Value",
			"Cost Basis",
			"Gain/Loss",
			"Return %",
			"Ownership %",
		];
		const positionRows = data.positions.map((pos) => [
			pos.assetName,
			pos.assetType,
			pos.symbol || "",
			pos.quantity,
			pos.currentPrice || "",
			pos.currentValue,
			pos.costBasis,
			pos.gainLoss,
			pos.returnPercentage,
			pos.ownershipPercentage,
		]);

		// Transactions
		const transactionHeaders = [
			"Date",
			"Type",
			"Asset Name",
			"Quantity",
			"Amount",
			"Price",
			"Fee",
			"Notes",
		];
		const transactionRows = data.transactions.map((tx) => [
			tx.date,
			tx.type,
			tx.assetName,
			tx.quantity || "",
			tx.amount,
			tx.price || "",
			tx.fee,
			tx.notes || "",
		]);

		// Combine all sections
		const sections = [
			"PORTFOLIO SUMMARY",
			CSVExporter.arrayToCSV(portfolioHeaders, [portfolioRow]),
			"",
			"POSITIONS",
			CSVExporter.arrayToCSV(positionHeaders, positionRows),
			"",
			"TRANSACTIONS",
			CSVExporter.arrayToCSV(transactionHeaders, transactionRows),
		];

		return sections.join("\n");
	}

	static exportTransactionHistory(transactions: PortfolioExportData["transactions"]): string {
		const headers = ["Date", "Type", "Asset Name", "Quantity", "Amount", "Price", "Fee", "Notes"];
		const rows = transactions.map((tx) => [
			tx.date,
			tx.type,
			tx.assetName,
			tx.quantity || "",
			tx.amount,
			tx.price || "",
			tx.fee,
			tx.notes || "",
		]);

		return CSVExporter.arrayToCSV(headers, rows);
	}

	static exportTaxReport(data: TaxReportData): string {
		// Tax summary
		const summaryHeaders = [
			"Tax Year",
			"Total Realized Gains",
			"Total Realized Losses",
			"Net Gain/Loss",
			"Total Dividends",
		];
		const summaryRow = [
			data.taxYear,
			data.summary.totalRealizedGains,
			data.summary.totalRealizedLosses,
			data.summary.netGainLoss,
			data.summary.totalDividends,
		];

		// Realized gains/losses
		const gainsHeaders = [
			"Asset Name",
			"Symbol",
			"Sale Date",
			"Purchase Date",
			"Quantity",
			"Sale Price",
			"Cost Basis",
			"Gain/Loss",
			"Term Type",
		];
		const gainsRows = data.realizedGains.map((gain) => [
			gain.assetName,
			gain.symbol || "",
			gain.saleDate,
			gain.purchaseDate,
			gain.quantity,
			gain.salePrice,
			gain.costBasis,
			gain.gainLoss,
			gain.termType,
		]);

		// Dividend income
		const dividendHeaders = ["Asset Name", "Symbol", "Date", "Amount"];
		const dividendRows = data.dividendIncome.map((div) => [
			div.assetName,
			div.symbol || "",
			div.date,
			div.amount,
		]);

		const sections = [
			`TAX REPORT - ${data.taxYear}`,
			"SUMMARY",
			CSVExporter.arrayToCSV(summaryHeaders, [summaryRow]),
			"",
			"REALIZED GAINS/LOSSES",
			CSVExporter.arrayToCSV(gainsHeaders, gainsRows),
			"",
			"DIVIDEND INCOME",
			CSVExporter.arrayToCSV(dividendHeaders, dividendRows),
		];

		return sections.join("\n");
	}

	static exportAuditTrail(data: AuditTrailData): string {
		const headers = [
			"Timestamp",
			"Event Type",
			"Entity Type",
			"Entity ID",
			"Action",
			"User ID",
			"IP Address",
			"User Agent",
			"Changes",
		];
		const rows = data.events.map((event) => [
			event.timestamp,
			event.eventType,
			event.entityType,
			event.entityId,
			event.action,
			event.userId,
			event.ipAddress || "",
			event.userAgent || "",
			event.changes ? JSON.stringify(event.changes) : "",
		]);

		const sections = [
			`AUDIT TRAIL - ${data.dateRange.start} to ${data.dateRange.end}`,
			CSVExporter.arrayToCSV(headers, rows),
		];

		return sections.join("\n");
	}
}
