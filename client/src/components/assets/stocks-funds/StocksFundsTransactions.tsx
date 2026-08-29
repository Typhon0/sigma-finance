import { gql, useMutation, useQuery } from "@apollo/client";
import {
	ArrowRight,
	DollarSign,
	Download,
	Filter,
	MoreHorizontal,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

interface StocksFundsTransactionsProps {
	onNavigateToFullView?: () => void;
}

export function StocksFundsTransactions({
	onNavigateToFullView: _onNavigateToFullView,
}: StocksFundsTransactionsProps) {
	const [filterType, setFilterType] = useState<string[]>(["buy", "sell", "dividend"]);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<
		"date" | "type" | "symbol" | "quantity" | "price" | "amount"
	>("date");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

	// Dialog states
	const [editingTx, setEditingTx] = useState<any | null>(null);
	const [detailsTx, setDetailsTx] = useState<any | null>(null);

	const { formatCurrency } = useCurrency();
	const { currentPortfolio, refetch: refetchPortfolio } = usePortfolio();

	// Query transactions for the current portfolio
	const {
		data,
		loading,
		error,
		refetch: refetchTransactions,
	} = useQuery(GET_PORTFOLIO_TRANSACTIONS, {
		variables: { portfolioID: currentPortfolio },
		skip: !currentPortfolio,
		fetchPolicy: "cache-and-network",
	});

	const [deleteTransactionMutation] = useMutation(DELETE_TRANSACTION);
	const [updateTransactionMutation] = useMutation(UPDATE_TRANSACTION);

	const handleDelete = async (id: string) => {
		if (confirm("Are you sure you want to delete this transaction?")) {
			try {
				await deleteTransactionMutation({
					variables: { id },
				});
				toast.success("Transaction deleted successfully");
				refetchTransactions();
				refetchPortfolio?.();
			} catch (err: any) {
				toast.error(err.message || "Failed to delete transaction");
			}
		}
	};

	const handleSaveEdit = async () => {
		if (!editingTx) return;
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
		} catch (err: any) {
			toast.error(err.message || "Failed to update transaction");
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
	const portfolioTransactions = useMemo(() => {
		if (!data?.transactions) return [];
		return data.transactions
			.filter((t: any) => {
				const typeName = t.asset?.assetType?.id || t.asset?.assetType?.name;
				const typeLower = typeName?.toLowerCase() || "";
				return typeLower === "stock" || typeLower === "fund" || typeLower === "etf";
			})
			.map((t: any) => ({
				id: t.id,
				date: t.executedAt ? t.executedAt.split("T")[0] : "",
				type: t.transactionType?.toLowerCase() ?? "buy",
				symbol: t.asset?.symbol ?? "",
				name: t.asset?.name ?? "",
				quantity: t.quantity ?? 0,
				price: t.unitPriceAmount ?? 0,
				amount: (t.quantity ?? 0) * (t.unitPriceAmount ?? 0),
				fees: t.feesAmount ?? 0,
				feesCurrency: t.feesCurrency ?? "USD",
				account: "IBKR", // Default broker account
				notes: t.notes ?? "",
				raw: t,
			}));
	}, [data?.transactions]);

	const getTypeColor = (type: string) => {
		switch (type) {
			case "buy":
				return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
			case "sell":
				return "text-rose-500 bg-rose-500/10 border-rose-500/20";
			case "dividend":
				return "text-blue-500 bg-blue-500/10 border-blue-500/20";
			default:
				return "text-muted-foreground bg-muted border-border";
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case "buy":
				return <TrendingUp className="h-3 w-3" />;
			case "sell":
				return <TrendingDown className="h-3 w-3" />;
			default:
				return <ArrowRight className="h-3 w-3" />;
		}
	};

	const filteredTransactions = useMemo(() => {
		let result = portfolioTransactions.filter((tx: any) => {
			if (!filterType.includes(tx.type)) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return tx.symbol.toLowerCase().includes(q) || tx.name.toLowerCase().includes(q);
			}
			return true;
		});

		// Sort transactions
		result = [...result].sort((a: any, b: any) => {
			let aVal: any = a[sortBy];
			let bVal: any = b[sortBy];

			if (sortBy === "date") {
				aVal = new Date(a.date).getTime();
				bVal = new Date(b.date).getTime();
			} else if (typeof aVal === "string") {
				return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			}

			if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
			if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return result;
	}, [portfolioTransactions, filterType, searchQuery, sortBy, sortDirection]);

	const escapeCSV = (val: any) => {
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
		return (
			<div className="border border-border/60 rounded-lg p-8 bg-card/80 backdrop-blur-xs text-center text-xs text-muted-foreground">
				Loading transactions...
			</div>
		);
	}

	if (error) {
		return (
			<div className="border border-border/60 rounded-lg p-8 bg-card/80 backdrop-blur-xs text-center text-xs text-rose-500">
				Failed to load transactions: {error.message}
			</div>
		);
	}

	return (
		<div className="border border-border/60 rounded-lg overflow-hidden shadow-sm bg-card/80 backdrop-blur-xs flex flex-col h-full">
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
					<Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCSV}>
						<Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
						Export CSV
					</Button>
				</div>
			</div>

			{/* Table Content */}
			<div className="overflow-x-auto min-h-[400px]">
				<Table>
					<TableHeader className="bg-muted/5">
						<TableRow className="hover:bg-transparent border-border/50">
							<TableHead
								className="w-[120px] text-xs font-semibold text-muted-foreground h-9 cursor-pointer select-none"
								onClick={() => handleSort("date")}
							>
								Date {sortBy === "date" && (sortDirection === "asc" ? "▲" : "▼")}
							</TableHead>
							<TableHead
								className="w-[100px] text-xs font-semibold text-muted-foreground h-9 cursor-pointer select-none"
								onClick={() => handleSort("type")}
							>
								Type {sortBy === "type" && (sortDirection === "asc" ? "▲" : "▼")}
							</TableHead>
							<TableHead
								className="text-xs font-semibold text-muted-foreground h-9 cursor-pointer select-none"
								onClick={() => handleSort("symbol")}
							>
								Asset {sortBy === "symbol" && (sortDirection === "asc" ? "▲" : "▼")}
							</TableHead>
							<TableHead
								className="text-right text-xs font-semibold text-muted-foreground h-9 cursor-pointer select-none"
								onClick={() => handleSort("quantity")}
							>
								Quantity {sortBy === "quantity" && (sortDirection === "asc" ? "▲" : "▼")}
							</TableHead>
							<TableHead
								className="text-right text-xs font-semibold text-muted-foreground h-9 cursor-pointer select-none"
								onClick={() => handleSort("price")}
							>
								Price {sortBy === "price" && (sortDirection === "asc" ? "▲" : "▼")}
							</TableHead>
							<TableHead
								className="text-right text-xs font-semibold text-muted-foreground h-9 cursor-pointer select-none"
								onClick={() => handleSort("amount")}
							>
								Total Amount {sortBy === "amount" && (sortDirection === "asc" ? "▲" : "▼")}
							</TableHead>
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
												"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border",
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
											className="text-[10px] font-normal text-muted-foreground"
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
												>
													<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => setDetailsTx(tx)}>
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => setEditingTx(tx)}>
													Edit Transaction
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-rose-500"
													onClick={() => handleDelete(tx.id)}
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
									<span className="text-foreground">
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
									<span className="text-foreground">{formatCurrency(detailsTx.amount)}</span>
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
									<span className="text-muted-foreground">Broker:</span>
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
									className="focus-visible:ring-emerald-500 focus-visible:ring-1"
								/>
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
									className="focus-visible:ring-emerald-500 focus-visible:ring-1"
								/>
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
									className="focus-visible:ring-emerald-500 focus-visible:ring-1"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="date">Date</Label>
								<Input
									id="date"
									type="date"
									value={editingTx.date}
									onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })}
									className="focus-visible:ring-emerald-500 focus-visible:ring-1 scheme-dark"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="notes">Notes</Label>
								<Input
									id="notes"
									value={editingTx.notes}
									onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
									className="focus-visible:ring-emerald-500 focus-visible:ring-1"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setEditingTx(null)}>
								Cancel
							</Button>
							<Button
								onClick={handleSaveEdit}
								className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-semibold"
							>
								Save Changes
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
