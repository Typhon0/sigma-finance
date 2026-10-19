export type ExportFormat = "csv" | "pdf" | "json";

export type ExportType =
	| "portfolio-data"
	| "transaction-history"
	| "performance-analytics"
	| "tax-report"
	| "audit-trail"
	| "data-backup";

export interface ExportRequest {
	type: ExportType;
	format: ExportFormat;
	portfolioId?: string;
	dateRange?: {
		start: Date;
		end: Date;
	};
	filters?: Record<string, unknown>;
	includeMetadata?: boolean;
}

export interface ExportResult {
	success: boolean;
	downloadUrl?: string;
	filename?: string;
	error?: string;
	size?: number;
	/**
	 * Set when the export succeeded but is known to be incomplete - currently
	 * only when a transaction history hit the page size. Callers must display
	 * it: the file is valid, it is just not the whole picture.
	 */
	warning?: string;
}

export interface PortfolioExportData {
	portfolio: {
		id: string;
		name: string;
		createdAt: string;
		totalValue: number;
		totalCost: number;
		gainLoss: number;
		returnPercentage: number;
		/**
		 * The currency the server valued this portfolio in, e.g. "EUR".
		 *
		 * The PDF writer used to print a hardcoded "$" on every amount, so a
		 * portfolio held in euros was exported to an accountant as dollars at
		 * a 1:1 rate - a number that is confidently wrong rather than
		 * obviously missing. Undefined when the server did not say.
		 */
		currency?: string;
		/**
		 * True when the server valued this portfolio with a stale FX rate. The
		 * exporters write it into the file header: a spreadsheet that does not
		 * say its totals are approximate reads as authoritative, and the totals
		 * go into tax and performance decisions.
		 */
		isStale: boolean;
	};
	positions: Array<{
		id: string;
		assetName: string;
		assetType: string;
		symbol?: string;
		quantity: number;
		currentPrice?: number;
		currentValue: number;
		costBasis: number;
		gainLoss: number;
		/**
		 * Optional because "not computable" is a real state: a position with
		 * no cost basis has no return, and writing 0 there would claim the
		 * holding broke even. Writers render undefined as "n/a".
		 */
		returnPercentage?: number;
		ownershipPercentage: number;
	}>;
	transactions: Array<{
		id: string;
		type: string;
		assetName: string;
		symbol?: string;
		quantity?: number;
		/** Undefined when the transaction records no unit price. */
		amount?: number;
		price?: number;
		fee: number;
		date: string;
		notes?: string;
	}>;
}

export interface TaxReportData {
	taxYear: number;
	userId: string;
	realizedGains: Array<{
		assetName: string;
		symbol?: string;
		saleDate: string;
		purchaseDate: string;
		quantity: number;
		salePrice: number;
		costBasis: number;
		gainLoss: number;
		termType: "short" | "long";
	}>;
	dividendIncome: Array<{
		assetName: string;
		symbol?: string;
		date: string;
		amount: number;
	}>;
	summary: {
		totalRealizedGains: number;
		totalRealizedLosses: number;
		netGainLoss: number;
		totalDividends: number;
	};
}

export interface AuditTrailData {
	userId: string;
	dateRange: {
		start: string;
		end: string;
	};
	events: Array<{
		id: string;
		timestamp: string;
		eventType: string;
		entityType: string;
		entityId: string;
		action: string;
		changes?: Record<string, unknown>;
		userId: string;
		ipAddress?: string;
		userAgent?: string;
	}>;
}
