import {
	ExternalLink,
	Eye,
	Layers,
	MoreHorizontal,
	PieChart,
	Search,
	SlidersHorizontal,
	Trash2,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { useCurrency } from "@/hooks/use-currency";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
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
import { Input } from "./ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { cn } from "./ui/utils";

type GroupByMode = "account" | "asset" | "sector" | "none";

interface StocksFundsPositionsProps {
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
}

export function StocksFundsPositions({
	onSelectAccount,
	onSelectAsset,
}: StocksFundsPositionsProps) {
	const { assets, deleteAsset, currentPortfolio } = usePortfolio();
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		portfolioId: string;
		symbol: string;
		name: string;
	} | null>(null);
	const [groupBy, setGroupBy] = useState<GroupByMode>("account");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("value-desc");

	const { formatCurrency } = useCurrency();

	const formatNumber = (num: number, decimals = 2) => {
		return num.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	};

	// Get stocks and funds from portfolio
	const stocksAndFundsAssets = assets.filter(
		(asset) => asset.type === "stock" || asset.type === "fund",
	);

	// Transform to standardized format
	const positions = stocksAndFundsAssets.map((asset, index) => {
		const currentPrice = (asset.currentValue || 0) / (asset.quantity || 1);
		const purchasePrice = asset.purchasePrice || currentPrice;
		const cost = purchasePrice * (asset.quantity || 1);
		const pl = (asset.currentValue || 0) - cost;
		const plPercent = cost > 0 ? (pl / cost) * 100 : 0;

		return {
			id: asset.id || `pos-${index}`,
			portfolioId: asset.portfolioId || currentPortfolio,
			symbol: asset.symbol || asset.name.substring(0, 4).toUpperCase(),
			name: asset.name,
			quantity: asset.quantity || 1,
			avgPrice: purchasePrice,
			currentPrice: currentPrice,
			value: asset.currentValue || 0,
			cost: cost,
			pl: pl,
			plPercent: plPercent,
			currency: asset.currency || "USD",
			account: asset.account || "Manual Entry",
			sector: (asset as any).sector || "Other",
			dayChange: (asset as any).dayChange ?? plPercent / 30,
		};
	});

	const finalPositions = positions;

	// Filter & Sort
	const filteredPositions = finalPositions
		.filter((p) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				p.symbol.toLowerCase().includes(q) ||
				p.name.toLowerCase().includes(q) ||
				p.account.toLowerCase().includes(q)
			);
		})
		.sort((a, b) => {
			switch (sortBy) {
				case "value-desc":
					return b.value - a.value;
				case "value-asc":
					return a.value - b.value;
				case "pl-desc":
					return b.pl - a.pl;
				case "pl-asc":
					return a.pl - b.pl;
				default:
					return 0;
			}
		});

	// Grouping Logic
	const groupedData = React.useMemo(() => {
		if (groupBy === "none") return null;

		const groups: { [key: string]: typeof filteredPositions } = {};

		filteredPositions.forEach((pos) => {
			const key =
				groupBy === "account"
					? pos.account
					: groupBy === "sector"
						? pos.sector
						: groupBy === "asset"
							? pos.symbol
							: "Other";

			if (!groups[key]) groups[key] = [];
			groups[key].push(pos);
		});

		return groups;
	}, [filteredPositions, groupBy]);

	return (
		<Card className="border-border/40 shadow-sm">
			{/* Toolbar */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-b border-border/40 bg-muted/5">
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder="Filter positions..."
							className="pl-8 h-8 text-xs bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/20"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 w-8 p-0 border-border/50"
							>
								<SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuLabel className="text-xs">
								Sort Order
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem
								checked={sortBy === "value-desc"}
								onCheckedChange={() => setSortBy("value-desc")}
							>
								Highest Value
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={sortBy === "pl-desc"}
								onCheckedChange={() => setSortBy("pl-desc")}
							>
								Highest Gain
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem
								checked={sortBy === "pl-asc"}
								onCheckedChange={() => setSortBy("pl-asc")}
							>
								Highest Loss
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
					<span className="text-[10px] text-muted-foreground uppercase font-medium mr-1">
						Group By:
					</span>
					<div className="flex bg-muted rounded p-0.5">
						{(["account", "asset", "sector", "none"] as const).map((mode) => (
							<button
								type="button"
								key={mode}
								onClick={() => setGroupBy(mode)}
								className={cn(
									"px-3 py-1 text-[10px] font-medium rounded-sm transition-all",
									groupBy === mode
										? "bg-background shadow-sm text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{mode === "none"
									? "None"
									: mode.charAt(0).toUpperCase() + mode.slice(1)}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="overflow-x-auto min-h-[400px] bg-background">
				{groupBy === "none" ? (
					<PositionsTable
						positions={filteredPositions}
						formatCurrency={formatCurrency}
						formatNumber={formatNumber}
						onSelectAsset={onSelectAsset}
						onSelectAccount={onSelectAccount}
						onDeletePosition={(pos) =>
							setDeleteTarget({
								id: pos.id,
								portfolioId: pos.portfolioId,
								symbol: pos.symbol,
								name: pos.name,
							})
						}
					/>
				) : (
					<div className="divide-y divide-border/40">
						{Object.entries(groupedData || {}).map(
							([groupName, groupPositions]) => {
								const groupValue = groupPositions.reduce(
									(sum, p) => sum + p.value,
									0,
								);
								const groupPL = groupPositions.reduce(
									(sum, p) => sum + p.pl,
									0,
								);

								// Determine Icon
								const GroupIcon =
									groupBy === "account"
										? Wallet
										: groupBy === "asset"
											? Layers
											: PieChart;

								const isAccountGroup = groupBy === "account";
								const isDefaultAccount = groupName === "Manual Entry";
								const isClickableAccount = isAccountGroup && !isDefaultAccount;

								return (
									<Accordion
										type="single"
										collapsible
										key={groupName}
										defaultValue={groupName}
										className="w-full"
									>
										<AccordionItem value={groupName} className="border-none">
											<AccordionTrigger className="px-4 py-2 hover:bg-muted/5 hover:no-underline border-b border-border/40 data-[state=closed]:border-none">
												<div className="flex items-center justify-between w-full pr-4">
													<div className="flex items-center gap-3 group">
														<div className="h-6 w-6 rounded bg-secondary flex items-center justify-center">
															<GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
														</div>
														<div
															className={cn(
																"text-sm font-medium",
																isClickableAccount &&
																	"group-hover:text-primary group-hover:underline cursor-pointer",
															)}
															onClick={(e) => {
																if (isClickableAccount && onSelectAccount) {
																	e.stopPropagation();
																	onSelectAccount(groupName);
																}
															}}
														>
															{groupName}
														</div>
														<Badge
															variant="outline"
															className="text-[10px] h-5 font-normal text-muted-foreground"
														>
															{groupPositions.length}
														</Badge>
														{isClickableAccount && (
															<ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />
														)}
													</div>
													<div className="flex items-center gap-6 text-sm">
														<div className="text-right">
															<span className="font-mono font-medium text-xs text-muted-foreground mr-2">
																Value
															</span>
															<span className="font-mono font-medium">
																{formatCurrency(groupValue)}
															</span>
														</div>
														<div className="text-right w-24">
															<span
																className={cn(
																	"font-mono font-medium",
																	groupPL >= 0
																		? "text-emerald-500"
																		: "text-rose-500",
																)}
															>
																{groupPL >= 0 ? "+" : ""}
																{formatCurrency(groupPL)}
															</span>
														</div>
													</div>
												</div>
											</AccordionTrigger>
											<AccordionContent className="p-0 border-b border-border/40">
												<PositionsTable
													positions={groupPositions}
													formatCurrency={formatCurrency}
													formatNumber={formatNumber}
													hideHeader
													onSelectAsset={onSelectAsset}
													onSelectAccount={onSelectAccount}
													onDeletePosition={(pos) =>
														setDeleteTarget({
															id: pos.id,
															portfolioId: pos.portfolioId,
															symbol: pos.symbol,
															name: pos.name,
														})
													}
												/>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								);
							},
						)}
					</div>
				)}
			</div>

			{/* Footer / Pagination Mock */}
			<div className="border-t border-border/40 p-2 flex items-center justify-between bg-muted/5 text-[10px] text-muted-foreground">
				<span>
					Showing {filteredPositions.length} of {finalPositions.length}{" "}
					positions
				</span>
				<div className="flex gap-1">
					<span className="px-2 py-0.5 rounded hover:bg-muted cursor-pointer">
						Prev
					</span>
					<span className="px-2 py-0.5 rounded bg-secondary text-foreground font-medium">
						1
					</span>
					<span className="px-2 py-0.5 rounded hover:bg-muted cursor-pointer">
						Next
					</span>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove from Portfolio</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove{" "}
							<strong>{deleteTarget?.symbol}</strong> ({deleteTarget?.name}){" "}
							from your portfolio? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
							onClick={async (e) => {
								e.preventDefault();
								if (deleteTarget) {
									try {
										await deleteAsset(
											deleteTarget.id,
											deleteTarget.portfolioId,
										);
										toast.success(
											`${deleteTarget.symbol} removed from portfolio`,
										);
									} catch {
										toast.error("Failed to remove asset from portfolio");
									}
								}
								setDeleteTarget(null);
							}}
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

function PositionsTable({
	positions,
	formatCurrency,
	formatNumber,
	hideHeader = false,
	onSelectAsset,
	_onSelectAccount,
	onDeletePosition,
}: {
	positions: any[];
	formatCurrency: (val: number) => string;
	formatNumber: (val: number, decimals?: number) => string;
	hideHeader?: boolean;
	onSelectAsset?: (symbol: string) => void;
	onSelectAccount?: (name: string) => void;
	onDeletePosition?: (pos: any) => void;
}) {
	return (
		<Table>
			{!hideHeader && (
				<TableHeader className="bg-muted/5">
					<TableRow className="hover:bg-transparent border-border/50">
						<TableHead className="w-[30px]"></TableHead>
						<TableHead className="w-[180px] text-xs font-semibold text-muted-foreground h-9">
							Instrument
						</TableHead>
						<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
							Price
						</TableHead>
						<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
							Change (1D)
						</TableHead>
						<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
							Quantity
						</TableHead>
						<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
							Avg Cost
						</TableHead>
						<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
							Value
						</TableHead>
						<TableHead className="text-right text-xs font-semibold text-muted-foreground h-9">
							Total P&L
						</TableHead>
						<TableHead className="w-[40px] h-9"></TableHead>
					</TableRow>
				</TableHeader>
			)}
			<TableBody>
				{positions.map((pos) => (
					<TableRow
						key={pos.id}
						className="group hover:bg-muted/5 border-border/40 transition-colors data-[state=selected]:bg-muted"
					>
						<TableCell className="py-2 pl-3">
							<div
								className={cn(
									"w-1 h-8 rounded-full",
									pos.pl >= 0 ? "bg-emerald-500" : "bg-rose-500",
								)}
							/>
						</TableCell>
						<TableCell className="py-2">
							<div className="flex flex-col">
								<div
									className="flex items-center gap-2 cursor-pointer hover:underline"
									onClick={() => onSelectAsset?.(pos.symbol)}
								>
									<span className="font-bold text-sm tracking-tight">
										{pos.symbol}
									</span>
									{pos.sector !== "Other" && (
										<Badge
											variant="outline"
											className="text-[10px] h-4 px-1 py-0 border-border/40 text-muted-foreground"
										>
											{pos.sector}
										</Badge>
									)}
								</div>
								<span
									className="text-[10px] text-muted-foreground truncate max-w-[140px]"
									title={pos.name}
								>
									{pos.name}
								</span>
							</div>
						</TableCell>
						<TableCell className="text-right py-2 font-mono text-sm">
							{formatCurrency(pos.currentPrice)}
						</TableCell>
						<TableCell className="text-right py-2">
							<div
								className={cn(
									"inline-flex items-center font-mono text-xs",
									pos.dayChange >= 0 ? "text-emerald-500" : "text-rose-500",
								)}
							>
								{pos.dayChange >= 0 ? (
									<TrendingUp className="h-3 w-3 mr-1" />
								) : (
									<TrendingDown className="h-3 w-3 mr-1" />
								)}
								{Math.abs(pos.dayChange).toFixed(2)}%
							</div>
						</TableCell>
						<TableCell className="text-right py-2 font-mono text-sm text-muted-foreground">
							{formatNumber(pos.quantity, 0)}
						</TableCell>
						<TableCell className="text-right py-2 font-mono text-sm text-muted-foreground">
							{formatCurrency(pos.avgPrice)}
						</TableCell>
						<TableCell className="text-right py-2 font-mono font-medium text-sm">
							{formatCurrency(pos.value)}
						</TableCell>
						<TableCell className="text-right py-2">
							<div className="flex flex-col items-end">
								<span
									className={cn(
										"font-mono font-medium text-sm",
										pos.pl >= 0 ? "text-emerald-600" : "text-rose-600",
									)}
								>
									{pos.pl >= 0 ? "+" : ""}
									{formatCurrency(pos.pl)}
								</span>
								<span
									className={cn(
										"text-[10px] font-mono",
										pos.plPercent >= 0
											? "text-emerald-600/80"
											: "text-rose-600/80",
									)}
								>
									{pos.plPercent.toFixed(2)}%
								</span>
							</div>
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
									<DropdownMenuItem onClick={() => onSelectAsset?.(pos.symbol)}>
										<Eye className="h-4 w-4 mr-2" />
										View Details
									</DropdownMenuItem>
									<DropdownMenuItem>Add Transaction</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
										onClick={() => onDeletePosition?.(pos)}
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Remove from Portfolio
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
