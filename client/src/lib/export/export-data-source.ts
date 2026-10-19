import type { ApolloClient } from "@apollo/client";
import { EXPORT_PAGE_SIZE, EXPORT_PORTFOLIO, EXPORT_TRANSACTIONS } from "@/graphql/queries/export";
import type { PortfolioExportData } from "./types";

/**
 * Data sources for the export service.
 *
 * ## Why this used to be a stub
 *
 * Every `fetch*` method in ExportService returned a hardcoded object:
 * "My Portfolio", totalValue 150000, one Apple position of 100 shares. The
 * export dialog and the data-backup component both called it, so clicking
 * "Export CSV" on any portfolio produced a file describing a portfolio that
 * did not exist. `createDataBackup` was worse: it wrote
 * `{portfolios: [], transactions: []}` and reported success. A backup is the
 * one artefact a user is most likely to trust without opening it.
 *
 * ## What is still not available
 *
 * Two of the six export types have no data source at all, and pretending
 * otherwise is what the stub was doing:
 *
 * - `tax-report` needs realised gains per disposal. The server now persists
 *   lot-matched dispositions (sigma_finance.tax_lot_dispositions) and exposes
 *   `dispositionsByPosition` plus a portfolio-level `realizedGains` summary.
 *   This export stays unavailable only because no portfolio-wide per-disposal
 *   query is wired into an export document yet - the data itself exists.
 * - `audit-trail` has no GraphQL surface at all - the schema exposes no audit
 *   query - so there is nothing to read.
 *
 * Both raise `ExportUnavailableError`, which the UI surfaces verbatim. The
 * alternative, an empty file, is indistinguishable from "you had no activity".
 */

/** Thrown when an export type has no backing data source. */
export class ExportUnavailableError extends Error {
	constructor(
		public readonly exportType: string,
		reason: string,
	) {
		super(reason);
		this.name = "ExportUnavailableError";
	}
}

// The cache shape is whatever the host app's client uses; this module only
// calls `client.query`, so constraining it buys nothing.
// Mirrors ExportClient: this module only ever calls client.query.
// biome-ignore lint/suspicious/noExplicitAny: see ExportClient
type Client = ApolloClient<any>;

function finite(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalFinite(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Load a full portfolio snapshot.
 *
 * @throws if the portfolio does not exist or the caller cannot see it. An
 *         export that silently returns zero positions is indistinguishable
 *         from an empty portfolio.
 */
export async function fetchPortfolioData(
	client: Client,
	portfolioId: string,
): Promise<PortfolioExportData> {
	const { data, error } = await client.query({
		query: EXPORT_PORTFOLIO,
		variables: { id: portfolioId },
		// An export is a point-in-time artefact. Caching would let a file
		// describe the portfolio as it was an hour ago.
		fetchPolicy: "network-only",
	});

	if (error) {
		throw new Error(`Could not load portfolio: ${error.message}`);
	}

	const portfolio = data?.portfolio;
	if (!portfolio) {
		throw new Error(`Portfolio ${portfolioId} was not found or is not visible to you.`);
	}

	const analytics = portfolio.analytics;
	const positions = (portfolio.assets ?? []).map((entry, index) => {
		const quantity = finite(entry.quantity);
		// averagePurchasePrice is per unit; the exporters want the position's
		// total basis, so it is derived here rather than left to each writer.
		const costBasis = finite(entry.averagePurchasePrice) * quantity;
		const currentValue = finite(entry.currentValue);
		const gainLoss = currentValue - costBasis;

		return {
			// PortfolioAsset carries no stable id of its own in this selection,
			// and the asset id alone is not unique when the same holding sits in
			// two accounts. The index keeps export rows distinct and ordered.
			id: `${entry.asset?.id ?? "asset"}-${index}`,
			assetName: entry.asset?.name ?? "Unnamed asset",
			assetType: entry.asset?.assetType?.name ?? "UNKNOWN",
			symbol: entry.asset?.symbol ?? undefined,
			quantity,
			currentPrice: optionalFinite(entry.asset?.currentValue),
			currentValue,
			costBasis,
			gainLoss,
			// Undefined, not 0, when there is no cost basis to divide by.
			returnPercentage: costBasis > 0 ? (gainLoss / costBasis) * 100 : undefined,
			ownershipPercentage: finite(entry.ownershipPct),
		};
	});

	return {
		portfolio: {
			id: portfolio.id,
			name: portfolio.name,
			createdAt: portfolio.createdAt,
			totalValue: finite(analytics?.totalValue),
			totalCost: finite(analytics?.totalCost),
			gainLoss: finite(analytics?.totalGainLoss),
			returnPercentage: finite(analytics?.totalGainLossPercent),
			currency: optionalString(analytics?.displayCurrency),
			isStale: analytics?.isStale ?? false,
		},
		positions,
		// Populated by fetchTransactionHistory, which callers run when they
		// need the full artefact.
		transactions: [],
	};
}

/** A transaction list plus whether the server may have more behind it. */
export interface TransactionHistory {
	transactions: PortfolioExportData["transactions"];
	/**
	 * True when a full page came back, meaning more transactions may exist
	 * beyond EXPORT_PAGE_SIZE. The server returns a bare list with no
	 * totalCount, so this is the only completeness signal available and the
	 * caller must surface it rather than assume the file is whole.
	 */
	truncated: boolean;
}

/** Load a portfolio's transactions, optionally within a date range. */
export async function fetchTransactionHistory(
	client: Client,
	portfolioId: string,
	dateRange?: { start: Date; end: Date },
): Promise<TransactionHistory> {
	const { data, error } = await client.query({
		query: EXPORT_TRANSACTIONS,
		variables: {
			filter: {
				portfolioID: portfolioId,
				...(dateRange ? { dateFrom: dateRange.start.toISOString() } : {}),
				...(dateRange ? { dateTo: dateRange.end.toISOString() } : {}),
			},
			pagination: { limit: EXPORT_PAGE_SIZE, offset: 0 },
		},
		fetchPolicy: "network-only",
	});

	if (error) {
		throw new Error(`Could not load transactions: ${error.message}`);
	}

	const rows = data?.transactions ?? [];
	const transactions = rows.map((row) => {
		const quantity = finite(row.quantity);
		const unitPrice = optionalFinite(row.unitPriceAmount);
		return {
			id: row.id,
			type: row.transactionType,
			assetName: row.asset?.name ?? "Unnamed asset",
			symbol: row.asset?.symbol ?? undefined,
			quantity,
			amount: unitPrice === undefined ? undefined : quantity * unitPrice,
			price: unitPrice,
			fee: finite(row.feesAmount),
			date: row.executedAt,
			notes: row.notes ?? undefined,
		};
	});

	return { transactions, truncated: rows.length >= EXPORT_PAGE_SIZE };
}

/**
 * Unavailable for now: fiscal disposal records exist server-side
 * (tax_lot_dispositions, exposed via dispositionsByPosition/realizedGains)
 * but no portfolio-wide per-disposal export document is wired yet.
 */
export async function fetchTaxReportData(): Promise<never> {
	throw new ExportUnavailableError(
		"tax-report",
		"Tax reports need realised gains per disposal for the whole portfolio. " +
			"Per-position fiscal G/L is available in the Tax Lots tab, but a portfolio-wide " +
			"export is not wired yet, and a partial report would understate what you owe.",
	);
}

/** Always unavailable: the GraphQL schema exposes no audit query. */
export async function fetchAuditTrailData(): Promise<never> {
	throw new ExportUnavailableError(
		"audit-trail",
		"There is no audit trail data source: the API exposes no audit query. " +
			"An empty trail would be indistinguishable from no activity.",
	);
}
