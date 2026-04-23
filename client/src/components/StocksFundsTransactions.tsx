import {
	ArrowRight,
	DollarSign,
	Download,
	Filter,
	MoreHorizontal,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface StocksFundsTransactionsProps {
	onNavigateToFullView?: () => void;
}

export function StocksFundsTransactions({
	onNavigateToFullView: _onNavigateToFullView,
}: StocksFundsTransactionsProps) {
	const [filterType, setFilterType] = useState<string[]>(["buy", "sell", "dividend"]);
	const [searchQuery, setSearchQuery] = useState("");

	const { formatCurrency } = useCurrency();

	// Mock recent transactions
	const recentTransactions = [
		{
			id: "tx-1",
			date: "2024-10-08",
			type: "buy",
			symbol: "AAPL",
			name: "Apple Inc.",
			quantity: 50,
			price: 182.9,
			amount: 9145.0,
			fees: 2.5,
			account: "IBKR",
		},
		{
			id: "tx-2",
			date: "2024-09-25",
			type: "dividend",
			symbol: "JNJ",
			name: "Johnson & Johnson",
			quantity: 120,
			price: 1.19,
			amount: 142.8,
			fees: 0,
			account: "Degiro",
		},
		{
			id: "tx-3",
			date: "2024-09-15",
			type: "buy",
			symbol: "MSFT",
			name: "Microsoft Corp.",
			quantity: 50,
			price: 348.9,
			amount: 17445.0,
			fees: 3.5,
			account: "IBKR",
		},
		{
			id: "tx-4",
			date: "2024-08-20",
			type: "sell",
			symbol: "TSLA",
			name: "Tesla Inc.",
			quantity: 25,
			price: 242.5,
			amount: 6062.5,
			fees: 2.0,
			account: "IBKR",
		},
		{
			id: "tx-5",
			date: "2024-08-10",
			type: "dividend",
			symbol: "AAPL",
			name: "Apple Inc.",
			quantity: 150,
			price: 0.24,
			amount: 36.0,
			fees: 0,
			account: "IBKR",
		},
		{
			id: "tx-6",
			date: "2024-07-28",
			type: "buy",
			symbol: "ASML",
			name: "ASML Holding",
			quantity: 25,
			price: 680.5,
			amount: 17012.5,
			fees: 4.5,
			account: "Degiro",
		},
		{
			id: "tx-7",
			date: "2024-06-18",
			type: "dividend",
			symbol: "MSFT",
			name: "Microsoft Corp.",
			quantity: 80,
			price: 0.75,
			amount: 60.0,
			fees: 0,
			account: "IBKR",
		},
		{
			id: "tx-8",
			date: "2024-06-10",
			type: "buy",
			symbol: "AAPL",
			name: "Apple Inc.",
			quantity: 50,
			price: 178.4,
			amount: 8920.0,
			fees: 2.5,
			account: "IBKR",
		},
	];

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
			case "dividend":
				return <DollarSign className="h-3 w-3" />;
			default:
				return <ArrowRight className="h-3 w-3" />;
		}
	};

	const filteredTransactions = recentTransactions.filter((tx) => {
		if (!filterType.includes(tx.type)) return false;
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			return tx.symbol.toLowerCase().includes(q) || tx.name.toLowerCase().includes(q);
		}
		return true;
	});

	return (
		<Card className="border-border/40 shadow-sm flex flex-col h-full">
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
							<Button variant="outline" size="sm" className="h-8 border-border/50 text-xs gap-2">
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
					<Button variant="outline" size="sm" className="h-8 text-xs border-border/50">
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
							<TableHead className="w-[120px] text-xs font-semibold text-muted-foreground h-9">
								Date
							</TableHead>
							<TableHead className="w-[100px] text-xs font-semibold text-muted-foreground h-9">
								Type
							</TableHead>
							<TableHead className="text-xs font-semibold text-muted-foreground h-9">
								Asset
							</TableHead>
							<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
								Quantity
							</TableHead>
							<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
								Price
							</TableHead>
							<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
								Total Amount
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
						{filteredTransactions.map((tx) => (
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
								<TableCell className="text-right py-2 font-mono text-sm">{tx.quantity}</TableCell>
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
											<DropdownMenuItem>View Details</DropdownMenuItem>
											<DropdownMenuItem>Edit Transaction</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem className="text-rose-500">Delete</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</Card>
	);
}
