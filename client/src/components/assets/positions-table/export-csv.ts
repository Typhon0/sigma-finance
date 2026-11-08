import { toast } from "sonner";
import type { BasePositionItem } from "./types";

export interface CSVExportOptions<T extends BasePositionItem> {
	filename?: string;
	headers?: string[];
	rowMapper?: (item: T) => (string | number | null | undefined)[];
}

const DEFAULT_HEADERS = [
	"Symbol",
	"Name",
	"Account",
	"Currency",
	"Quantity",
	"Current Price",
	"Day Change ($)",
	"Day Change (%)",
	"Total Value",
	"Avg Cost Price",
	"Total Cost Basis",
	"Unrealized P&L ($)",
	"Unrealized P&L (%)",
	"Portfolio Weight (%)",
];

function escapeCSV(val: string | number | null | undefined): string {
	if (val === null || val === undefined) return '""';
	const str = String(val);
	if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return `"${str}"`;
}

export function exportPositionsToCSV<T extends BasePositionItem>(
	positions: T[],
	options?: CSVExportOptions<T>,
) {
	if (positions.length === 0) {
		toast.error("No positions to export");
		return;
	}

	const headers = options?.headers ?? DEFAULT_HEADERS;

	const defaultRowMapper = (p: T) => [
		escapeCSV(p.symbol),
		escapeCSV(p.name),
		escapeCSV(p.account),
		escapeCSV(p.currency || "USD"),
		p.quantity,
		p.currentPrice.toFixed(4),
		(p.dayChangeAmount ?? 0).toFixed(2),
		(p.dayChange ?? 0).toFixed(2),
		p.value.toFixed(2),
		p.avgPrice.toFixed(4),
		p.cost.toFixed(2),
		p.pl === null ? "" : p.pl.toFixed(2),
		p.pl === null ? "" : p.plPercent.toFixed(2),
		(p.weight ?? 0).toFixed(2),
	];

	const mapper = options?.rowMapper
		? (p: T) => options.rowMapper!(p).map(escapeCSV)
		: defaultRowMapper;

	const rows = positions.map(mapper);

	const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join(
		"\r\n",
	);

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.setAttribute("href", url);
	const dateStr = new Date().toISOString().split("T")[0];
	link.setAttribute("download", options?.filename || `sigma_positions_export_${dateStr}.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
	toast.success(`Exported ${positions.length} positions to CSV`);
}
