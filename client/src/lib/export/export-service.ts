import type { ApolloClient } from "@apollo/client";
import { EXPORT_USER_PORTFOLIOS } from "@/graphql/queries/export";
import { CSVExporter } from "./csv-exporter";
import {
	fetchAuditTrailData,
	fetchPortfolioData,
	fetchTaxReportData,
	fetchTransactionHistory,
} from "./export-data-source";
import { PDFGenerator } from "./pdf-generator";
import type { ExportFormat, ExportResult, ExportType } from "./types";

/**
 * The Apollo client every export reads through.
 *
 * Injected rather than imported because the service is a static utility with
 * no React context to reach into, and because a test must be able to point it
 * at a mock link rather than the real server.
 */
// The cache shape is deliberately the loose `object` that useApolloClient
// infers, not NormalizedCacheObject: pinning it here made every call site need
// a cast, and this module only ever calls `client.query`.
// biome-ignore lint/suspicious/noExplicitAny: see the note above
export type ExportClient = ApolloClient<any>;

export class ExportService {
	private static downloadFile(blob: Blob, filename: string): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	private static generateFilename(
		type: ExportType,
		format: ExportFormat,
		portfolioName?: string,
	): string {
		const timestamp = new Date().toISOString().split("T")[0];
		const prefix = portfolioName ? `${portfolioName.replace(/[^a-zA-Z0-9]/g, "_")}_` : "";
		return `${prefix}${type.replace(/-/g, "_")}_${timestamp}.${format}`;
	}

	static async exportPortfolioData(
		client: ExportClient,
		portfolioId: string,
		format: ExportFormat = "csv",
	): Promise<ExportResult> {
		try {
			const data = await fetchPortfolioData(client, portfolioId);
			// The transaction list is part of the artefact, not a separate
			// download, so a portfolio export pulls it too.
			const history = await fetchTransactionHistory(client, portfolioId);
			const snapshot = { ...data, transactions: history.transactions };

			let blob: Blob;
			let filename: string;

			switch (format) {
				case "csv": {
					const csvContent = CSVExporter.exportPortfolioData(snapshot);
					blob = new Blob([csvContent], { type: "text/csv" });
					filename = ExportService.generateFilename(
						"portfolio-data",
						"csv",
						snapshot.portfolio.name,
					);
					break;
				}

				case "pdf":
					blob = await PDFGenerator.generatePortfolioReport(snapshot);
					filename = ExportService.generateFilename(
						"portfolio-data",
						"pdf",
						snapshot.portfolio.name,
					);
					break;

				case "json": {
					const jsonContent = JSON.stringify(snapshot, null, 2);
					blob = new Blob([jsonContent], { type: "application/json" });
					filename = ExportService.generateFilename(
						"portfolio-data",
						"json",
						snapshot.portfolio.name,
					);
					break;
				}

				default:
					throw new Error(`Unsupported format: ${format}`);
			}

			ExportService.downloadFile(blob, filename);

			return {
				success: true,
				filename,
				size: blob.size,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Export failed",
			};
		}
	}

	static async exportTransactionHistory(
		client: ExportClient,
		portfolioId: string,
		dateRange?: { start: Date; end: Date },
		format: ExportFormat = "csv",
	): Promise<ExportResult> {
		try {
			const { transactions, truncated } = await fetchTransactionHistory(
				client,
				portfolioId,
				dateRange,
			);

			let blob: Blob;
			let filename: string;

			switch (format) {
				case "csv": {
					const csvContent = CSVExporter.exportTransactionHistory(transactions);
					blob = new Blob([csvContent], { type: "text/csv" });
					filename = ExportService.generateFilename("transaction-history", "csv");
					break;
				}

				case "json": {
					const jsonContent = JSON.stringify(transactions, null, 2);
					blob = new Blob([jsonContent], { type: "application/json" });
					filename = ExportService.generateFilename("transaction-history", "json");
					break;
				}

				default:
					throw new Error(`Unsupported format for transactions: ${format}`);
			}

			ExportService.downloadFile(blob, filename);

			return {
				success: true,
				filename,
				size: blob.size,
				// The caller must show this. A file that stops at the page size
				// looks complete in a spreadsheet, and a user reconciling their
				// own books has no way to see that rows are missing.
				warning: truncated
					? `Only the first ${transactions.length} transactions were exported; this portfolio has more.`
					: undefined,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Export failed",
			};
		}
	}

	/**
	 * Refuses rather than writing an empty filing.
	 *
	 * `fetchTaxReportData` throws: the server computes realised gains per
	 * disposal and then discards them, so there is no tax data to export. The
	 * method keeps its signature and its failure result so the UI path is
	 * unchanged, but the format switch that used to sit below the fetch was
	 * unreachable - a csv/pdf/json branch that could never run read like
	 * three working formats.
	 */
	static async exportTaxReport(
		_client: ExportClient,
		_userId: string,
		_taxYear: number,
		format: ExportFormat = "csv",
	): Promise<ExportResult> {
		void format;
		try {
			await fetchTaxReportData();
			// Unreachable while fetchTaxReportData always throws. If a data
			// source is ever added, this line is where the writers go.
			return { success: false, error: "Tax report export was wired up but not implemented." };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Export failed",
			};
		}
	}

	/** Refuses for the same reason as exportTaxReport: there is no audit query. */
	static async exportAuditTrail(
		_client: ExportClient,
		_userId: string,
		_dateRange: { start: Date; end: Date },
		format: ExportFormat = "csv",
	): Promise<ExportResult> {
		void format;
		try {
			await fetchAuditTrailData();
			return { success: false, error: "Audit trail export was wired up but not implemented." };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Export failed",
			};
		}
	}

	/**
	 * Export every portfolio the user can see, with their positions and
	 * transactions.
	 *
	 * This used to write `{portfolios: [], transactions: [], alerts: []}` and
	 * report success - an empty file called a "Complete Data Backup". A backup
	 * is the artefact a user is least likely to open and most likely to trust,
	 * so the absence of content has to be stated in the file itself, not left
	 * for them to discover.
	 *
	 * `notIncluded` is part of the payload on purpose. What is absent from a
	 * backup is invisible from the outside, and a user who later discovers their
	 * tax history was never exported has no way to tell.
	 */
	static async createDataBackup(client: ExportClient, userId: string): Promise<ExportResult> {
		try {
			const { data, error } = await client.query({
				query: EXPORT_USER_PORTFOLIOS,
				variables: { userID: userId },
				fetchPolicy: "network-only",
			});
			if (error) {
				throw new Error(`Could not load portfolios: ${error.message}`);
			}

			const portfolios = data?.portfolios ?? [];
			if (portfolios.length === 0) {
				throw new Error(
					"No portfolios were returned for this user, so there is nothing to back up. " +
						"An empty backup file would be indistinguishable from a successful one.",
				);
			}

			const exported: Array<Record<string, unknown>> = [];
			for (const portfolio of portfolios) {
				if (!portfolio?.id) continue;
				const snapshot = await fetchPortfolioData(client, portfolio.id);
				const history = await fetchTransactionHistory(client, portfolio.id);
				exported.push({
					portfolio: snapshot.portfolio,
					positions: snapshot.positions,
					transactions: history.transactions,
					transactionsMayBeTruncated: history.truncated,
				});
			}

			const backupData = {
				userId,
				exportDate: new Date().toISOString(),
				portfolioCount: exported.length,
				portfolios: exported,
				notIncluded: [
					"Realised gains per tax lot - the server computes them but does not persist them.",
					"Audit trail - the API exposes no audit query.",
					"Price history and FX rates - the file holds current valuations, not the series they were derived from.",
				],
			};

			const jsonContent = JSON.stringify(backupData, null, 2);
			const blob = new Blob([jsonContent], { type: "application/json" });
			const filename = ExportService.generateFilename("data-backup", "json");

			ExportService.downloadFile(blob, filename);

			return {
				success: true,
				filename,
				size: blob.size,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Backup failed",
			};
		}
	}
}
