import { ArrowUpDown, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useMarketData } from "@/hooks/useMarketData";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

interface StockPriceHistoryTableProps {
	symbol: string;
	/** The instrument's quote currency — candle prices are recorded in it. */
	currency?: string;
	/**
	 * Refetch a sibling ledger that derives from the same recorded candles
	 * (the performance panel's latest-candle fetch). Its figures otherwise
	 * go stale behind this button, and the button would only pretend to
	 * refresh the whole history.
	 */
	onRefresh?: () => void;
}

export function StockPriceHistoryTable({
	symbol,
	currency = "USD",
	onRefresh,
}: StockPriceHistoryTableProps) {
	const [sortDesc, setSortDesc] = useState(true);
	// Per-unit candle prices live in the instrument's quote currency; the
	// display-format hook would only relabel them. These cells claim the
	// quote currency instead.
	const formatInstrumentFigure = (val: number) => formatMoney(val, currency);

	const {
		data: candles,
		loading,
		error,
		isRefetching,
		refetch,
	} = useMarketData({
		symbol,
		assetType: "STOCK",
		interval: "1d",
		limit: 60,
	});

	const rows = useMemo(() => {
		if (!candles || candles.length === 0) return [];
		// Clone and sort descending by timestamp by default
		const sorted = [...candles].sort((a, b) => {
			const timeA = new Date(a.timestamp).getTime();
			const timeB = new Date(b.timestamp).getTime();
			return sortDesc ? timeB - timeA : timeA - timeB;
		});
		return sorted;
	}, [candles, sortDesc]);

	return (
		<Card className="border-border/30 bg-card/50 shadow-xs overflow-hidden">
			{/* No separate headline of its own: the collapsible trigger above
			    already announces the daily-quotes ledger — repeating it here
			    says the same idea twice for both eyes and screen readers. */}
			<CardHeader className="border-b border-border/20 pb-4">
				<div className="flex items-start justify-between gap-2">
					<CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
						{/* The count is the truth, never the promise: before the rows
						    land (or when history is shorter) "Last 60" would commit to
						    records the ledger does not hold. */}
						{rows.length > 0
							? `Last ${rows.length} recorded daily candles for ${symbol}`
							: `Recorded daily candles for ${symbol}`}
						{/* A refresh in flight over rows on screen means the numbers
						    shown are the previous fetch's — say so, and give a screen
						    reader the same announcement, instead of letting the rows
						    read as current. */}
						{isRefetching && (
							<span className="inline-flex items-center gap-1 text-warning" role="status">
								<Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
								<span>refreshing</span>
							</span>
						)}
					</CardDescription>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs text-muted-foreground shrink-0 cursor-pointer"
						aria-label={`Refresh daily quote history for ${symbol}`}
						disabled={loading || isRefetching}
						onClick={() => {
							refetch();
							onRefresh?.();
						}}
					>
						{isRefetching && <Loader2 className="h-3 w-3 animate-spin" />}
						<RefreshCw className="h-3 w-3" />
					</Button>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{loading && rows.length === 0 ? (
					<div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span className="text-xs">Loading quote history…</span>
					</div>
				) : error && rows.length === 0 ? (
					<div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground px-4">
						<FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mb-1" />
						<span className="text-sm font-medium text-foreground">Could not load quotes</span>
						<span className="text-xs max-w-sm">
							The request for {symbol}&rsquo;s daily candles failed, so no values are shown in the
							meantime.
						</span>
					</div>
				) : rows.length === 0 ? (
					<div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground px-4">
						<FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mb-1" />
						<span className="text-sm font-medium text-foreground">
							No quotes synced for {symbol} yet
						</span>
						<span className="text-xs">
							Daily candles appear here once market data has been recorded for this symbol.
						</span>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader className="bg-muted/20">
								<TableRow className="border-b border-border/30 hover:bg-transparent">
									<TableHead
										aria-sort={sortDesc ? "descending" : "ascending"}
										className="w-[120px] text-xs font-semibold text-muted-foreground"
									>
										<button
											type="button"
											onClick={() => setSortDesc(!sortDesc)}
											className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
										>
											<span>Date</span>
											<ArrowUpDown className="h-3 w-3" aria-hidden />
										</button>
									</TableHead>
									<TableHead className="text-right text-xs font-semibold text-muted-foreground">
										Open
									</TableHead>
									<TableHead className="text-right text-xs font-semibold text-muted-foreground">
										High
									</TableHead>
									<TableHead className="text-right text-xs font-semibold text-muted-foreground">
										Low
									</TableHead>
									<TableHead className="text-right text-xs font-semibold text-muted-foreground">
										Close
									</TableHead>
									<TableHead className="text-right text-xs font-semibold text-muted-foreground">
										Volume
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody className="divide-y divide-border/20">
								{rows.map((row, idx) => (
									<TableRow
										key={row.timestamp || idx}
										className="hover:bg-muted/30 transition-colors"
									>
										<TableCell className="font-mono text-xs font-medium text-foreground py-2.5">
											{formatDate(row.timestamp)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-foreground py-2.5">
											{formatInstrumentFigure(row.open)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-foreground py-2.5">
											{formatInstrumentFigure(row.high)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-muted-foreground py-2.5">
											{formatInstrumentFigure(row.low)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums font-semibold text-foreground py-2.5">
											{formatInstrumentFigure(row.close)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-muted-foreground py-2.5">
											{row.volume !== undefined && row.volume !== null && row.volume > 0
												? formatQty(row.volume)
												: "—"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
