import { format } from "date-fns";
import { ArrowUpDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useMarketData } from "@/hooks/useMarketData";

interface StockPriceHistoryTableProps {
	symbol: string;
	formatCurrency: (value: number) => string;
}

export function StockPriceHistoryTable({ symbol, formatCurrency }: StockPriceHistoryTableProps) {
	const [isManualMode, setIsManualMode] = useState(false);
	const [sortDesc, setSortDesc] = useState(true);

	const { data: candles, loading, error } = useMarketData({
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

	const formatDate = (isoString: string) => {
		try {
			return format(new Date(isoString), "dd/MM/yyyy");
		} catch {
			return isoString.slice(0, 10);
		}
	};

	return (
		<Card className="border-border/30 bg-card/50 shadow-xs overflow-hidden">
			<CardHeader className="border-b border-border/20 pb-4 flex flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="text-base font-semibold text-foreground">
						Price History
					</CardTitle>
					<CardDescription className="text-xs text-muted-foreground mt-0.5">
						Daily price quotes recorded in database for {symbol}
					</CardDescription>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground font-medium">Manual</span>
						<Switch
							checked={isManualMode}
							onCheckedChange={setIsManualMode}
							aria-label="Toggle manual mode"
							className="scale-90"
						/>
					</div>
					{isManualMode && (
						<Badge variant="outline" className="text-micro font-mono border-warning/40 text-warning bg-warning/10">
							Active editing
						</Badge>
					)}
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{loading && rows.length === 0 ? (
					<div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span className="text-xs">Loading price history…</span>
					</div>
				) : error && rows.length === 0 ? (
					<div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground px-4">
						<FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mb-1" />
						<span className="text-sm font-medium text-foreground">
							Local data unavailable
						</span>
						<span className="text-xs max-w-sm">
							No price quotes recorded in database for {symbol}. You can switch to Manual mode to enter quotes.
						</span>
					</div>
				) : rows.length === 0 ? (
					<div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground px-4">
						<FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mb-1" />
						<span className="text-sm font-medium text-foreground">No price quotes recorded</span>
						<span className="text-xs">Recorded prices will appear here.</span>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader className="bg-muted/20">
								<TableRow className="border-b border-border/30 hover:bg-transparent">
									<TableHead
										className="w-[120px] text-xs font-semibold text-muted-foreground cursor-pointer select-none"
										onClick={() => setSortDesc(!sortDesc)}
									>
										<div className="flex items-center gap-1">
											<span>Date</span>
											<ArrowUpDown className="h-3 w-3" />
										</div>
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
											{formatCurrency(row.open)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-gain py-2.5">
											{formatCurrency(row.high)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-loss py-2.5">
											{formatCurrency(row.low)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums font-semibold text-foreground py-2.5">
											{formatCurrency(row.close)}
										</TableCell>
										<TableCell className="font-mono text-xs text-right tabular-nums text-muted-foreground py-2.5">
											{row.volume !== undefined && row.volume !== null && row.volume > 0
												? row.volume.toLocaleString("en-US")
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
