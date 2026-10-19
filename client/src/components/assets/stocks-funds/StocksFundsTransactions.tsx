import { gql, useMutation, useQuery } from "@apollo/client";
import {
	AlertTriangle,
	ArrowRight,
	Download,
	Filter,
	MoreHorizontal,
	RefreshCw,
	Upload,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SortableHead } from "@/components/assets/stocks-funds/SortableHead";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DELETE_TRANSACTION, UPDATE_TRANSACTION } from "@/graphql/mutations/transaction";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

const GET_PORTFOLIO_TRANSACTIONS = gql`
  query GetPortfolioTransactions($portfolioID: ID!) {
    transactions(filter: { portfolioID: $portfolioID }) {
      id
      quantity
      unitPriceAmount
      unitPriceCurrency
      feesAmount
      feesCurrency
      executedAt
      notes
      transactionType
      asset {
        id
        symbol
        name
        assetType {
          id
          name
        }
      }
      portfolio {
        id
        name
      }
    }
  }
`;

export interface TransactionAssetType {
	id?: string | null;
	name?: string | null;
}

export interface TransactionAsset {
	id: string;
	symbol?: string | null;
	name?: string | null;
	assetType?: TransactionAssetType | null;
}

export interface TransactionPortfolio {
	id: string;
	name?: string | null;
}

/**
 * Edit-dialog validation. Quantity and price must be strictly positive: a
 * zero or negative basis corrupts lot matching and P&L downstream. Fees may
 * be zero but never negative. Field-level errors render inline and Save
 * stays disabled while any rule fails (critique #3, P1 — previously only
 * checked on submit with toasts, per .agents/frontend.md all inputs are
 * validated with zod).
 */
const transactionEditSchema = z.object({
	quantity: z
		.number({ message: "Quantity is required" })
		.positive("Quantity must be greater than 0"),
	price: z
		.number({ message: "Price is required" })
		.positive("Price per unit must be greater than 0"),
	fees: z.number().min(0, "Fees cannot be negative"),
	date: z
		.string()
		.min(1, "Transaction date is required")
		.refine((value) => !Number.isNaN(new Date(value).getTime()), {
			message: "Transaction date is invalid",
		}),
	notes: z.string().max(500, "Notes must be less than 500 characters"),
});

type TransactionEditField = keyof z.infer<typeof transactionEditSchema>;

export interface RawTransaction {
	id: string;
	quantity?: number | null;
	unitPriceAmount?: number | null;
	unitPriceCurrency?: string | null;
	feesAmount?: number | null;
	feesCurrency?: string | null;
	executedAt?: string | null;
	notes?: string | null;
	transactionType?: string | null;
	asset?: TransactionAsset | null;
	portfolio?: TransactionPortfolio | null;
}

interface GetPortfolioTransactionsData {
	transactions: RawTransaction[];
}

export interface TransactionItem {
	id: string;
	date: string;
	type: string;
	symbol: string;
	name: string;
	quantity: number;
	price: number;
	amount: number;
	fees: number;
	feesCurrency: string;
	account: string;
	notes: string;
	raw: RawTransaction;
}

interface EditingTransactionState {
	id: string;
	symbol: string;
	quantity: number;
	price: number;
	fees: number;
	date: string;
	notes: string;
}

export interface StocksFundsTransactionsProps {
	onNavigateToFullView?: () => void;
}

export function TransactionsTableSkeleton() {
	return (
		<div className="border border-border/60 rounded-lg overflow-hidden bg-card/80 flex flex-col h-full animate-pulse">
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-b border-border/40 bg-muted/5">
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<Skeleton className="h-8 w-64 rounded-md" />
					<Skeleton className="h-8 w-20 rounded-md" />
				</div>
				<Skeleton className="h-8 w-28 rounded-md" />
			</div>

			<div className="overflow-x-auto min-h-[400px]">
				<Table>
					<TableHeader className="bg-muted/5">
						<TableRow className="border-border/50">
							<TableHead className="w-[120px]">
								<Skeleton className="h-4 w-16" />
							</TableHead>
							<TableHead className="w-[100px]">
								<Skeleton className="h-4 w-12" />
							</TableHead>
							<TableHead>
								<Skeleton className="h-4 w-20" />
							</TableHead>
							<TableHead className="text-right">
								<Skeleton className="h-4 w-16 ml-auto" />
							</TableHead>
							<TableHead className="text-right">
								<Skeleton className="h-4 w-14 ml-auto" />
							</TableHead>
							<TableHead className="text-right">
								<Skeleton className="h-4 w-24 ml-auto" />
							</TableHead>
							<TableHead className="text-right">
								<Skeleton className="h-4 w-12 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[100px]">
								<Skeleton className="h-4 w-16 ml-auto" />
							</TableHead>
							<TableHead className="w-[40px]"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 6 }).map((_, i) => (
							<TableRow key={`tx-skel-${i}`} className="border-border/40">
								<TableCell className="py-3 pl-4">
									<Skeleton className="h-4 w-20" />
								</TableCell>
								<TableCell className="py-3">
									<Skeleton className="h-5 w-14 rounded-full" />
								</TableCell>
								<TableCell className="py-3">
									<div className="flex items-center gap-2">
										<Skeleton className="h-4 w-12" />
										<Skeleton className="h-3 w-24" />
									</div>
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-14 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-16 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-20 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-10 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-5 w-16 rounded-md ml-auto" />
								</TableCell>
								<TableCell className="py-3 pr-3">
									<Skeleton className="h-6 w-6 rounded-md" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

export const StocksFundsTransactions = memo(function StocksFundsTransactions({
	onNavigateToFullView,
}: StocksFundsTransactionsProps) {
	const [filterType, setFilterType] = useState<string[]>(["buy", "sell", "dividend"]);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<
		"date" | "type" | "symbol" | "quantity" | "price" | "amount"
	>("date");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

	// Dialog & Sheet states
	const [editingTx, setEditingTx] = useState<EditingTransactionState | null>(null);
	const [detailsTx, setDetailsTx] = useState<TransactionItem | null>(null);
	const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);

	const { formatCurrency } = useCurrency();
	const { currentPortfolio, refetch: refetchPortfolio } = usePortfolio();

	// Field-level validation for the edit dialog. Runs on every keystroke; the
	// computed message map drives both the inline errors and the disabled Save.
	const editFieldErrors = useMemo((): Partial<Record<TransactionEditField, string>> | null => {
		if (!editingTx) return null;
		const parsed = transactionEditSchema.safeParse({
			quantity: editingTx.quantity,
			price: editingTx.price,
			fees: editingTx.fees,
			date: editingTx.date,
			notes: editingTx.notes ?? "",
		});
		if (parsed.success) return null;
		const messages: Partial<Record<TransactionEditField, string>> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0] as TransactionEditField;
			if (key && !messages[key]) messages[key] = issue.message;
		}
		return messages;
	}, [editingTx]);
	const isEditInvalid = editFieldErrors !== null;

	// Query transactions for the current portfolio
	const {
		data,
		loading,
		error,
		refetch: refetchTransactions,
	} = useQuery<GetPortfolioTransactionsData>(GET_PORTFOLIO_TRANSACTIONS, {
		variables: { portfolioID: currentPortfolio },
		skip: !currentPortfolio,
		fetchPolicy: "cache-and-network",
	});

	const [deleteTransactionMutation] = useMutation(DELETE_TRANSACTION);
	const [updateTransactionMutation] = useMutation(UPDATE_TRANSACTION);

	const confirmDelete = async () => {
		if (!txToDelete) return;
		try {
			await deleteTransactionMutation({
				variables: { id: txToDelete.id },
			});
			toast.success("Transaction deleted successfully");
			refetchTransactions();
			refetchPortfolio?.();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Failed to delete transaction";
			toast.error(message);
		} finally {
			setTxToDelete(null);
		}
	};

	const handleSaveEdit = async () => {
		// Defensive guard: the Save button is already disabled while invalid,
		// but this keeps the mutation unreachable from other invocation paths.
		if (!editingTx || isEditInvalid) return;
		try {
			await updateTransactionMutation({
				variables: {
					id: editingTx.id,
					input: {
						quantity: Number(editingTx.quantity),
						unitPriceAmount: Number(editingTx.price),
						feesAmount: Number(editingTx.fees),
						executedAt: new Date(editingTx.date).toISOString(),
						notes: editingTx.notes,
					},
				},
			});
			toast.success("Transaction updated successfully");
			setEditingTx(null);
			refetchTransactions();
			refetchPortfolio?.();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Failed to update transaction";
			toast.error(message);
		}
	};

	const handleSort = (field: typeof sortBy) => {
		if (sortBy === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortBy(field);
			setSortDirection("desc");
		}
	};

	// Map transactions to UI structure, and filter by Stock / Fund asset types
	const portfolioTransactions = useMemo<TransactionItem[]>(() => {
		if (!data?.transactions) return [];
		return data.transactions
			.filter((t) => {
				const typeName = t.asset?.assetType?.id || t.asset?.assetType?.name;
				const typeLower = typeName?.toLowerCase() || "";
				return typeLower === "stock" || typeLower === "fund" || typeLower === "etf";
			})
			.map((t) => {
				const quantity = t.quantity ?? 0;
				const price = t.unitPriceAmount ?? 0;
				const executedDate = t.executedAt ? t.executedAt.split("T")[0] : "";
				const accountName = t.portfolio?.name || "Portfolio Account";

				return {
					id: t.id,
					date: executedDate,
					type: (t.transactionType ?? "buy").toLowerCase(),
					symbol: t.asset?.symbol ?? "",
					name: t.asset?.name ?? "",
					quantity,
					price,
					amount: quantity * price,
					fees: t.feesAmount ?? 0,
					feesCurrency: t.feesCurrency ?? "USD",
					account: accountName,
					notes: t.notes ?? "",
					raw: t,
				};
			});
	}, [data?.transactions]);

	const getTypeColor = (type: string) => {
		switch (type) {
			case "buy":
				return "text-gain bg-gain/10 border-gain/20";
			case "sell":
				return "text-loss bg-loss/10 border-loss/20";
			case "dividend":
				return "text-info bg-info/10 border-info/20";
			default:
				return "text-muted-foreground bg-muted border-border";
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case "buy":
				return <TrendArrowUp className="h-3 w-3" />;
			case "sell":
				return <TrendArrowDown className="h-3 w-3" />;
			default:
				return <ArrowRight className="h-3 w-3" />;
		}
	};

	const filteredTransactions = useMemo(() => {
		let result = portfolioTransactions.filter((tx) => {
			if (!filterType.includes(tx.type)) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return tx.symbol.toLowerCase().includes(q) || tx.name.toLowerCase().includes(q);
			}
			return true;
		});

		// Sort transactions
		result = [...result].sort((a, b) => {
			let aVal: string | number = a[sortBy];
			let bVal: string | number = b[sortBy];

			if (sortBy === "date") {
				aVal = new Date(a.date).getTime();
				bVal = new Date(b.date).getTime();
			} else if (typeof aVal === "string") {
				return sortDirection === "asc"
					? aVal.localeCompare(String(bVal))
					: String(bVal).localeCompare(aVal);
			}

			if (Number(aVal) < Number(bVal)) return sortDirection === "asc" ? -1 : 1;
			if (Number(aVal) > Number(bVal)) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return result;
	}, [portfolioTransactions, filterType, searchQuery, sortBy, sortDirection]);

	const escapeCSV = (val: unknown): string => {
		if (val === undefined || val === null) return "";
		const str = String(val);
		if (str.includes(",") || str.includes('"') || str.includes("\n")) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};

	const handleExportCSV = () => {
		if (filteredTransactions.length === 0) {
			toast.error("No transactions to export");
			return;
		}
		const headers = [
			"Date",
			"Type",
			"Symbol",
			"Name",
			"Quantity",
			"Price",
			"Amount",
			"Fees",
			"Notes",
		];
		const rows = filteredTransactions.map((tx) => [
			escapeCSV(tx.date),
			escapeCSV(tx.type),
			escapeCSV(tx.symbol),
			escapeCSV(tx.name),
			tx.quantity,
			tx.price,
			tx.amount,
			tx.fees,
			escapeCSV(tx.notes),
		]);
		const csvContent =
			"data:text/csv;charset=utf-8," +
			[headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", `portfolio_transactions_${currentPortfolio}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	if (loading) {
		return <TransactionsTableSkeleton />;
	}

	if (error) {
		return (
			<div
				role="alert"
				aria-live="assertive"
				className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
			>
				<AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-destructive">Could not load transactions</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						The request failed, so this view could not be retrieved. Retry the request; your data
						was not modified.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="h-8 shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer touch-target"
					onClick={() => refetchTransactions()}
				>
					<RefreshCw className="h-3.5 w-3.5" />
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="border border-border/60 rounded-lg overflow-hidden bg-card/80 flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-b border-border/40 bg-muted/5">
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<SearchInput
						placeholder="Filter transactions..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onClear={() => setSearchQuery("")}
						size="sm"
						containerClassName="w-full sm:w-64"
						className="h-8 text-xs bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/20"
					/>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 text-xs gap-2">
								<Filter className="h-3.5 w-3.5 text-muted-foreground" />
								<span>Type</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuLabel className="text-xs">Transaction Type</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{["buy", "sell", "dividend"].map((t) => (
								<DropdownMenuCheckboxItem
									key={t}
									checked={filterType.includes(t)}
									onCheckedChange={(checked) => {
										if (checked) setFilterType([...filterType, t]);
										else setFilterType(filterType.filter((type) => type !== t));
									}}
									className="capitalize text-xs"
								>
									{t}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs cursor-pointer touch-target"
						onClick={() => {
							if (onNavigateToFullView) {
								onNavigateToFullView();
							} else {
								toast.info(
									"Bulk CSV import is available on the full Transactions page (/transactions).",
								);
							}
						}}
						title="Import transactions via CSV"
					>
						<Upload className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
						Import CSV
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-8 text-xs cursor-pointer touch-target"
						onClick={handleExportCSV}
					>
						<Download className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
						Export CSV
					</Button>
				</div>
			</div>

			{/* Table Content */}
			<div className="overflow-x-auto min-h-[400px]">
				<Table>
					<TableHeader className="bg-muted/5">
						<TableRow className="hover:bg-transparent border-border/50">
							<SortableHead
								label="Date"
								field="date"
								className="w-[120px]"
								sortField={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
							/>
							<SortableHead
								label="Type"
								field="type"
								className="w-[100px]"
								sortField={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
							/>
							<SortableHead
								label="Asset"
								field="symbol"
								sortField={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
							/>
							<SortableHead
								label="Quantity"
								field="quantity"
								className="text-right"
								align="right"
								sortField={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
							/>
							<SortableHead
								label="Price"
								field="price"
								className="text-right"
								align="right"
								sortField={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
							/>
							<SortableHead
								label="Total Amount"
								field="amount"
								className="text-right"
								align="right"
								sortField={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
							/>
							<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
								Fees
							</TableHead>
							<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9 w-[100px]">
								Account
							</TableHead>
							<TableHead className="w-[40px] h-9"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredTransactions.length === 0 ? (
							<TableRow>
								<TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
									No transactions found matching the filters.
								</TableCell>
							</TableRow>
						) : (
							filteredTransactions.map((tx) => (
								<TableRow
									key={tx.id}
									className="group hover:bg-muted/5 border-border/40 transition-colors"
								>
									<TableCell className="py-2 pl-4">
										<div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
											{tx.date}
										</div>
									</TableCell>
									<TableCell className="py-2">
										<div
											className={cn(
												"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-micro uppercase font-bold border",
												getTypeColor(tx.type),
											)}
										>
											{getTypeIcon(tx.type)}
											{tx.type}
										</div>
									</TableCell>
									<TableCell className="py-2">
										<div className="flex items-center gap-2">
											<span className="font-bold text-sm text-foreground">{tx.symbol}</span>
											<span className="text-xs text-muted-foreground hidden sm:inline">
												{tx.name}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-right py-2 font-mono text-sm">
										{tx.quantity.toLocaleString()}
									</TableCell>
									<TableCell className="text-right py-2 font-mono text-sm text-muted-foreground">
										{formatCurrency(tx.price)}
									</TableCell>
									<TableCell className="text-right py-2">
										<span className="font-mono font-medium text-sm text-foreground">
											{formatCurrency(tx.amount)}
										</span>
									</TableCell>
									<TableCell className="text-right py-2 font-mono text-xs text-muted-foreground">
										{tx.fees > 0 ? formatCurrency(tx.fees) : "-"}
									</TableCell>
									<TableCell className="text-right py-2">
										<Badge
											variant="secondary"
											className="text-micro font-normal text-muted-foreground"
										>
											{tx.account}
										</Badge>
									</TableCell>
									<TableCell className="py-2 pr-3">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
													aria-label="Transaction options"
												>
													<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => setDetailsTx(tx)}>
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														setEditingTx({
															id: tx.id,
															symbol: tx.symbol,
															quantity: tx.quantity,
															price: tx.price,
															fees: tx.fees,
															date: tx.date,
															notes: tx.notes,
														})
													}
												>
													Edit Transaction
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive focus:bg-destructive/10"
													onClick={() => setTxToDelete(tx)}
												>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Details Sidepanel */}
			{detailsTx && (
				<Sheet open={!!detailsTx} onOpenChange={(open) => !open && setDetailsTx(null)}>
					<SheetContent side="right" className="w-full p-0 sm:max-w-md">
						<div className="flex h-full flex-col">
							<SheetHeader className="border-b border-border/40 px-6 py-4">
								<SheetTitle className="text-left text-lg font-semibold">
									Transaction Details
								</SheetTitle>
							</SheetHeader>
							<div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 text-sm font-mono">
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Asset:</span>
									<span className="text-foreground font-semibold">
										{detailsTx.name} ({detailsTx.symbol})
									</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Type:</span>
									<span className="uppercase font-bold text-foreground">{detailsTx.type}</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Quantity:</span>
									<span className="text-foreground">{detailsTx.quantity.toLocaleString()}</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Price per Unit:</span>
									<span className="text-foreground">{formatCurrency(detailsTx.price)}</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Total Amount:</span>
									<span className="text-foreground font-bold">
										{formatCurrency(detailsTx.amount)}
									</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Fees:</span>
									<span className="text-foreground">
										{detailsTx.fees > 0 ? formatCurrency(detailsTx.fees) : "-"}
									</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Date:</span>
									<span className="text-foreground">{detailsTx.date}</span>
								</div>
								<div className="flex justify-between border-b border-border/30 pb-2">
									<span className="text-muted-foreground">Account:</span>
									<span className="text-foreground">{detailsTx.account}</span>
								</div>
								{detailsTx.notes && (
									<div className="flex flex-col gap-1 pt-2">
										<span className="text-muted-foreground">Notes:</span>
										<p className="text-foreground leading-relaxed">{detailsTx.notes}</p>
									</div>
								)}
							</div>
							<div className="border-t border-border/40 px-6 py-4 bg-muted/20 flex justify-end">
								<Button variant="outline" onClick={() => setDetailsTx(null)}>
									Close
								</Button>
							</div>
						</div>
					</SheetContent>
				</Sheet>
			)}

			{/* Edit Dialog */}
			{editingTx && (
				<Dialog open={!!editingTx} onOpenChange={() => setEditingTx(null)}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Edit Transaction ({editingTx.symbol})</DialogTitle>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="qty">Quantity</Label>
								<Input
									id="qty"
									type="number"
									step="any"
									value={editingTx.quantity}
									onChange={(e) =>
										setEditingTx({ ...editingTx, quantity: parseFloat(e.target.value) || 0 })
									}
									aria-invalid={Boolean(editFieldErrors?.quantity)}
									aria-describedby={editFieldErrors?.quantity ? "qty-error" : undefined}
								/>
								{editFieldErrors?.quantity && (
									<p id="qty-error" className="text-xs font-medium text-destructive">
										{editFieldErrors.quantity}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="price">Price per Unit</Label>
								<Input
									id="price"
									type="number"
									step="any"
									value={editingTx.price}
									onChange={(e) =>
										setEditingTx({ ...editingTx, price: parseFloat(e.target.value) || 0 })
									}
									aria-invalid={Boolean(editFieldErrors?.price)}
									aria-describedby={editFieldErrors?.price ? "price-error" : undefined}
								/>
								{editFieldErrors?.price && (
									<p id="price-error" className="text-xs font-medium text-destructive">
										{editFieldErrors.price}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="fees">Fees</Label>
								<Input
									id="fees"
									type="number"
									step="any"
									value={editingTx.fees}
									onChange={(e) =>
										setEditingTx({ ...editingTx, fees: parseFloat(e.target.value) || 0 })
									}
									aria-invalid={Boolean(editFieldErrors?.fees)}
									aria-describedby={editFieldErrors?.fees ? "fees-error" : undefined}
								/>
								{editFieldErrors?.fees && (
									<p id="fees-error" className="text-xs font-medium text-destructive">
										{editFieldErrors.fees}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="date">Date</Label>
								<Input
									id="date"
									type="date"
									value={editingTx.date}
									onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
									aria-invalid={Boolean(editFieldErrors?.date)}
									aria-describedby={editFieldErrors?.date ? "date-error" : undefined}
								/>
								{editFieldErrors?.date && (
									<p id="date-error" className="text-xs font-medium text-destructive">
										{editFieldErrors.date}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="notes">Notes</Label>
								<Input
									id="notes"
									value={editingTx.notes}
									onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
									aria-invalid={Boolean(editFieldErrors?.notes)}
									aria-describedby={editFieldErrors?.notes ? "notes-error" : undefined}
								/>
								{editFieldErrors?.notes && (
									<p id="notes-error" className="text-xs font-medium text-destructive">
										{editFieldErrors.notes}
									</p>
								)}
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setEditingTx(null)}>
								Cancel
							</Button>
							<Button
								onClick={handleSaveEdit}
								disabled={isEditInvalid}
								className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 font-semibold"
							>
								Save Changes
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}

			{/* Delete Confirmation Dialog */}
			<ConfirmationDialog
				open={Boolean(txToDelete)}
				onOpenChange={(open) => {
					if (!open) setTxToDelete(null);
				}}
				title="Delete Transaction"
				description={`Are you sure you want to delete this ${txToDelete?.type.toUpperCase()} transaction for ${txToDelete?.symbol}? This action cannot be undone.`}
				confirmText="Delete Transaction"
				variant="destructive"
				onConfirm={confirmDelete}
			/>
		</div>
	);
});
