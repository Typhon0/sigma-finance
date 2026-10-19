import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	ExportUnavailableError,
	fetchAuditTrailData,
	fetchPortfolioData,
	fetchTaxReportData,
	fetchTransactionHistory,
} from "../export-data-source";
import type { ExportClient } from "../export-service";

/**
 * These tests pin that no export type serves invented data.
 *
 * The service used to return a hardcoded object for every call: "My Portfolio",
 * totalValue 150000, one Apple position of 100 shares, and for the backup,
 * `{portfolios: [], transactions: []}` reported as a success. Every file a user
 * downloaded described a portfolio that did not exist, and the one artefact
 * they were least likely to open - the backup - was empty.
 */

const PORTFOLIO = {
	id: "p1",
	name: "Retirement",
	createdAt: "2024-03-01T00:00:00Z",
	analytics: {
		totalValue: 1000,
		totalCost: 800,
		totalGainLoss: 200,
		totalGainLossPercent: 25,
		displayCurrency: "USD",
		isStale: false,
	},
	assets: [
		{
			quantity: 10,
			averagePurchasePrice: 80,
			currentValue: 1000,
			ownershipPct: 100,
			quoteCurrency: "USD",
			asset: {
				id: "a1",
				name: "Acme Corp",
				symbol: "ACME",
				currentValue: 100,
				assetType: { name: "STOCK" },
			},
		},
	],
};

const TRANSACTION = {
	id: "t1",
	transactionType: "BUY",
	quantity: 10,
	unitPriceAmount: 80,
	unitPriceCurrency: "USD",
	feesAmount: 5,
	feesCurrency: "USD",
	executedAt: "2024-03-01T00:00:00Z",
	notes: "initial",
	asset: { name: "Acme Corp", symbol: "ACME" },
};

/**
 * A stub client keyed by operation name.
 *
 * The export documents are generated TypedDocumentNodes, so MockLink would
 * need the full document text duplicated here; branching on the operation name
 * keeps the fixtures readable and fails loudly if a query is renamed.
 */
interface OperationNodeLike {
	definitions?: Array<{ kind?: string; name?: { value?: string } }>;
}

function operationNameOf(query: OperationNodeLike | undefined): string {
	for (const definition of query?.definitions ?? []) {
		if (definition.name?.value) return definition.name.value;
	}
	return "unknown";
}

function stubClient(handlers: {
	portfolio?: unknown;
	transactions?: unknown[];
	userPortfolios?: Array<{ id: string; name: string }>;
}): ExportClient & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		query: vi.fn(({ query }: { query: OperationNodeLike }) => {
			// Apollo hands the raw document through, so the operation name lives
			// in the AST rather than on a top-level `operationName` field.
			const name = operationNameOf(query);
			calls.push(name);
			if (name === "ExportPortfolio") {
				return { data: { portfolio: handlers.portfolio ?? null } };
			}
			if (name === "ExportTransactions") {
				return { data: { transactions: handlers.transactions ?? [] } };
			}
			if (name === "ExportUserPortfolios") {
				return { data: { portfolios: handlers.userPortfolios ?? [] } };
			}
			return { data: null };
		}),
	} as unknown as ExportClient & { calls: string[] };
}

describe("fetchPortfolioData", () => {
	it("maps the server payload onto the export shape", async () => {
		const client = stubClient({ portfolio: PORTFOLIO });

		const data = await fetchPortfolioData(client, "p1");

		expect(data.portfolio.name).toBe("Retirement");
		expect(data.portfolio.totalValue).toBe(1000);
		expect(data.positions).toHaveLength(1);
		expect(data.positions[0].assetName).toBe("Acme Corp");
		expect(data.positions[0].symbol).toBe("ACME");
		// averagePurchasePrice is per unit; the export wants the position total.
		expect(data.positions[0].costBasis).toBe(800);
		expect(data.positions[0].gainLoss).toBe(200);
		expect(data.positions[0].returnPercentage).toBeCloseTo(25, 6);
	});

	it("refuses to fabricate a portfolio the server did not return", async () => {
		const client = stubClient({ portfolio: null });

		// An export that silently returns zero positions is indistinguishable
		// from an empty portfolio.
		await expect(fetchPortfolioData(client, "missing")).rejects.toThrow(/not found/i);
	});

	it("leaves the return percentage undefined when there is no cost basis", async () => {
		const client = stubClient({
			portfolio: {
				...PORTFOLIO,
				assets: [{ ...PORTFOLIO.assets[0], averagePurchasePrice: 0 }],
			},
		});

		const data = await fetchPortfolioData(client, "p1");

		// 0 would claim the holding broke even; it is simply uncomputable.
		expect(data.positions[0].returnPercentage).toBeUndefined();
	});

	it("carries the FX staleness flag into the file", async () => {
		const client = stubClient({
			portfolio: {
				...PORTFOLIO,
				analytics: { ...PORTFOLIO.analytics, isStale: true },
			},
		});

		const data = await fetchPortfolioData(client, "p1");

		// The totals are approximate and the PDF/CSV headers say so.
		expect(data.portfolio.isStale).toBe(true);
	});

	it("asks the network, not the cache", async () => {
		const client = stubClient({ portfolio: PORTFOLIO });

		await fetchPortfolioData(client, "p1");

		// An export is a point-in-time artefact; a cached response would let a
		// file describe the portfolio as it was an hour ago.
		expect(client.query).toHaveBeenCalledWith(
			expect.objectContaining({ fetchPolicy: "network-only" }),
		);
	});
});

describe("fetchTransactionHistory", () => {
	it("maps transactions and reports a complete list", async () => {
		const client = stubClient({ transactions: [TRANSACTION] });

		const result = await fetchTransactionHistory(client, "p1");

		expect(result.truncated).toBe(false);
		expect(result.transactions[0].assetName).toBe("Acme Corp");
		expect(result.transactions[0].amount).toBe(800);
		expect(result.transactions[0].fee).toBe(5);
	});

	it("flags truncation when a full page comes back", async () => {
		// The server returns a bare list with no totalCount, so a full page is
		// the only completeness signal there is. Swallowing it would ship a
		// file that looks whole in a spreadsheet.
		const client = stubClient({
			transactions: Array.from({ length: 1000 }, (_, _i) => TRANSACTION),
		});

		const result = await fetchTransactionHistory(client, "p1");

		expect(result.truncated).toBe(true);
	});

	it("passes a date range through to the server filter", async () => {
		const client = stubClient({ transactions: [] });

		await fetchTransactionHistory(client, "p1", {
			start: new Date("2024-01-01T00:00:00Z"),
			end: new Date("2024-06-30T00:00:00Z"),
		});

		const call = (client.query as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(call.variables.filter.dateFrom).toBe("2024-01-01T00:00:00.000Z");
		expect(call.variables.filter.dateTo).toBe("2024-06-30T00:00:00.000Z");
	});
});

describe("export types with no data source", () => {
	it("refuses a tax report rather than writing an empty filing", async () => {
		// The server computes TaxLotMatch.RealizedGainLoss and then discards it,
		// so there is nothing to file. An empty report is indistinguishable
		// from "you had no taxable activity" and someone would file it.
		await expect(fetchTaxReportData()).rejects.toBeInstanceOf(ExportUnavailableError);
		await expect(fetchTaxReportData()).rejects.toThrow(/not wired yet/i);
	});

	it("refuses an audit trail rather than writing an empty one", async () => {
		await expect(fetchAuditTrailData()).rejects.toBeInstanceOf(ExportUnavailableError);
		await expect(fetchAuditTrailData()).rejects.toThrow(/no audit query/i);
	});
});

describe("no hardcoded export data survives", () => {
	const source = (path: string) =>
		readFileSync(resolve(process.cwd(), path), "utf8")
			// These files quote the values they replaced in their doc comments.
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^[\t ]*\/\/.*$/gm, "");

	it("has no fabricated portfolio in the service", () => {
		const code = source("src/lib/export/export-service.ts");
		expect(code).not.toMatch(/My Portfolio/);
		expect(code).not.toMatch(/150000/);
		expect(code).not.toMatch(/Apple Inc/);
	});

	it("has no empty backup payload", () => {
		const code = source("src/lib/export/export-service.ts");
		// The old backup wrote empty arrays and reported success.
		expect(code).not.toMatch(/portfolios:\s*\[\]/);
		expect(code).toMatch(/notIncluded/);
	});
});
