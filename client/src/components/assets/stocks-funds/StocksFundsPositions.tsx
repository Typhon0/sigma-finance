import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ExternalLink,
	Eye,
	Layers,
	MoreHorizontal,
	PieChart,
	RefreshCw,
	SlidersHorizontal,
	Trash2,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

type GroupByMode = "account" | "asset" | "sector" | "none";

interface StocksFundsPositionsProps {
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
	externalFilter?: {
		mode: "sector" | "asset-class" | "type" | "asset";
		value: string;
	} | null;
	onClearExternalFilter?: () => void;
}

export function StocksFundsPositions({
	onSelectAccount,
	onSelectAsset,
	externalFilter = null,
	onClearExternalFilter,
}: StocksFundsPositionsProps) {
	const { assets, deleteAsset, currentPortfolio, refreshAssetPrice, refetch } = usePortfolio();

	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		portfolioId: string;
		symbol: string;
		name: string;
	} | null>(null);
	const [groupBy, setGroupBy] = useState<GroupByMode>("account");
	const [rawSearchQuery, setRawSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("value-desc");

	// Debounced search (150ms) to avoid filtering on every keystroke
	const [searchQuery, setSearchQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout>>();

	const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setRawSearchQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => setSearchQuery(value), 150);
	}, []);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const { formatCurrency } = useCurrency();

	const formatNumber = useCallback((num: number, decimals = 2) => {
		return num.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	}, []);

	// Memoized positions transform — only recomputed when assets change
	const positions = useMemo(() => {
		const stocksAndFundsAssets = assets.filter(
			(asset) => asset.type === "stock" || asset.type === "fund",
		);

		return stocksAndFundsAssets.map((asset, index) => {
			const quantity = Number.isFinite(asset.quantity) && asset.quantity > 0 ? asset.quantity : 0;
			const rawCurrentPrice = Number.isFinite(asset.currentPrice) ? asset.currentPrice : 0;
			const purchasePrice = Number.isFinite(asset.purchasePrice) ? asset.purchasePrice : 0;
			const currentValue = Number.isFinite(asset.currentValue) ? asset.currentValue : 0;
			const currentPrice = rawCurrentPrice > 0 ? rawCurrentPrice : 0;
			const resolvedValue =
				currentValue > 0
					? currentValue
					: currentPrice > 0 && quantity > 0
						? currentPrice * quantity
						: 0;
			const cost = purchasePrice * quantity;
			const pl = resolvedValue - cost;
			const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
			const isPriceResolved = currentPrice > 0;
			const rawDayChange = (asset as any).dayChange;
			const hasDayChange = typeof rawDayChange === "number" && Number.isFinite(rawDayChange);

			return {
				id: asset.id || `pos-${index}`,
				portfolioId: asset.portfolioId || currentPortfolio,
				symbol: asset.symbol || asset.name.substring(0, 4).toUpperCase(),
				name: asset.name,
				quantity,
				avgPrice: purchasePrice,
				currentPrice,
				value: resolvedValue,
				cost,
				pl,
				plPercent,
				currency: asset.currency || "USD",
				account: asset.account || "Manual Entry",
				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				sector: (asset as any).sector || "Needs metadata",
				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				dayChange: (asset as any).dayChange ?? 0,
				assetClass: asset.type === "fund" ? "ETFs/Funds" : "Stocks",
				isPriceResolved,
				hasDayChange,
			};
		});
	}, [assets, currentPortfolio]);

	// Memoized filtered & sorted positions
	const filteredPositions = useMemo(() => {
		let result = positions;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.symbol.toLowerCase().includes(q) ||
					p.name.toLowerCase().includes(q) ||
					p.account.toLowerCase().includes(q),
			);
		}

		if (externalFilter) {
			result = result.filter((p) => {
				if (externalFilter.mode === "sector") {
					if (externalFilter.value === "Needs metadata") {
						return (
							p.sector === "Needs metadata" ||
							p.sector === "Other" ||
							p.sector === "Unclassified" ||
							p.sector === "Unknown sector" ||
							!p.sector
						);
					}
					return p.sector === externalFilter.value;
				}
				if (externalFilter.mode === "type") {
					return p.assetClass === (externalFilter.value === "fund" ? "ETFs/Funds" : "Stocks");
				}
				if (externalFilter.mode === "asset") {
					return p.symbol === externalFilter.value;
				}
				return p.assetClass === externalFilter.value;
			});
		}

		return [...result].sort((a, b) => {
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
	}, [positions, searchQuery, externalFilter, sortBy]);

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
		<div className="border border-border/60 rounded-lg overflow-hidden shadow-sm bg-card/80 backdrop-blur-xs">
			{/* Toolbar */}
			<div className="flex flex-col justify-between gap-3 border-b border-border/40 bg-muted/5 px-4 py-4 lg:flex-row lg:items-center">
				<div className="flex w-full items-center gap-2 lg:w-auto">
					<SearchInput
						placeholder="Filter positions..."
						value={rawSearchQuery}
						onChange={handleSearchChange}
						onClear={() => {
							setRawSearchQuery("");
							setSearchQuery("");
						}}
						size="sm"
						containerClassName="w-full lg:w-72"
						className="h-9 text-xs bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/20"
					/>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-9 w-9 p-0 border-border/50">
								<SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuLabel className="text-xs">Sort Order</DropdownMenuLabel>
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

				<div className="flex w-full flex-wrap items-center justify-between gap-3 lg:w-auto lg:flex-nowrap lg:justify-end">
					{externalFilter && (
						<div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-[10px]">
							<span className="uppercase text-muted-foreground">
								Filter: {externalFilter.mode === "sector" ? "Sector" : "Class"}
							</span>
							<span className="font-medium">{externalFilter.value}</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-5 px-1.5 text-[10px]"
								onClick={onClearExternalFilter}
							>
								Clear
							</Button>
						</div>
					)}
					<span className="mr-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Group By:
					</span>
					<div className="flex rounded-lg bg-muted p-0.5">
						{(["account", "asset", "sector", "none"] as const).map((mode) => (
							<button
								type="button"
								key={mode}
								onClick={() => setGroupBy(mode)}
								className={cn(
									"rounded-md px-3 py-1.5 text-[10px] font-medium transition-all",
									groupBy === mode
										? "bg-background shadow-sm text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{mode === "none" ? "None" : mode.charAt(0).toUpperCase() + mode.slice(1)}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="min-h-[400px] overflow-x-auto bg-background">
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
						onRefreshPrice={async (pos) => {
							await refreshAssetPrice(pos.id);
							await refetch();
							toast.success(`Price refresh requested for ${pos.symbol}`);
						}}
					/>
				) : (
					<div className="divide-y divide-border/40">
						{Object.entries(groupedData || {}).map(([groupName, groupPositions]) => {
							const groupValue = groupPositions.reduce((sum, p) => sum + p.value, 0);
							const groupPl = groupPositions.reduce((sum, p) => sum + p.pl, 0);

							// Determine Icon
							const GroupIcon =
								groupBy === "account" ? Wallet : groupBy === "asset" ? Layers : PieChart;

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
										<AccordionTrigger className="border-b border-border/40 px-4 py-3 hover:bg-muted/5 hover:no-underline data-[state=closed]:border-none">
											<div className="flex w-full items-center justify-between pr-4">
												<div className="group flex items-center gap-3">
													<div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
														<GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
													</div>
													{/* biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable */}
													{/* biome-ignore lint/a11y/noStaticElementInteractions: unavoidable */}
													<div
														className={cn(
															"text-sm font-medium tracking-tight",
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
														className="h-5 text-[10px] font-normal text-muted-foreground"
													>
														{groupPositions.length}
													</Badge>
													{isClickableAccount && (
														<ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />
													)}
												</div>
												<div className="flex items-center gap-6 text-sm pr-6">
													<div className="text-right w-[100px]">
														<span className="mr-2 font-mono text-xs font-medium text-muted-foreground">
															Value
														</span>
														<span className="font-mono font-medium">
															{formatCurrency(groupValue)}
														</span>
													</div>
													<div className="text-right w-[110px]">
														<span
															className={cn(
																"font-mono font-medium",
																groupPl >= 0 ? "text-emerald-500" : "text-rose-500",
															)}
														>
															{groupPl >= 0 ? "+" : ""}
															{formatCurrency(groupPl)}
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
												onRefreshPrice={async (pos) => {
													await refreshAssetPrice(pos.id);
													await refetch();
													toast.success(`Price refresh requested for ${pos.symbol}`);
												}}
											/>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer / Pagination Mock */}
			<div className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-4 py-3 text-[10px] text-muted-foreground">
				<span>
					Showing {filteredPositions.length} of {positions.length} positions
				</span>
				<div className="flex items-center gap-1.5">
					<span className="cursor-pointer rounded-md px-2.5 py-1 hover:bg-muted">Prev</span>
					<span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-foreground">1</span>
					<span className="cursor-pointer rounded-md px-2.5 py-1 hover:bg-muted">Next</span>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove from Portfolio</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove <strong>{deleteTarget?.symbol}</strong> (
							{deleteTarget?.name}) from your portfolio? This action cannot be undone.
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
										await deleteAsset(deleteTarget.id, deleteTarget.portfolioId);
										toast.success(`${deleteTarget.symbol} removed from portfolio`);
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
		</div>
	);
}

function PositionRow({
	pos,
	formatCurrency,
	formatNumber,
	onSelectAsset,
	onDeletePosition,
	onRefreshPrice,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	pos: any;
	formatCurrency: (val: number) => string;
	formatNumber: (val: number, decimals?: number) => string;
	onSelectAsset?: (symbol: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onDeletePosition?: (pos: any) => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onRefreshPrice?: (pos: any) => void;
}) {
	return (
		<TableRow
			key={pos.id}
			className="group hover:bg-muted/5 border-border/40 transition-colors data-[state=selected]:bg-muted"
		>
			<TableCell className="py-3 pl-3">
				<div
					className={cn(
						"h-9 w-1 rounded-full",
						!pos.isPriceResolved ? "bg-amber-500" : pos.pl >= 0 ? "bg-emerald-500" : "bg-rose-500",
					)}
				/>
			</TableCell>
			<TableCell className="py-3 w-[130px] sm:w-[210px]">
				<div className="flex flex-col gap-1">
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: unavoidable */}
					<div
						className="flex items-center gap-2 cursor-pointer hover:underline"
						onClick={() => onSelectAsset?.(pos.symbol)}
					>
						<span className="text-sm font-bold tracking-tight">{pos.symbol}</span>
						{!pos.isPriceResolved && (
							<Badge
								variant="outline"
								className="h-4 px-1.5 py-0 text-[9px] font-semibold tracking-wide uppercase border-amber-500/30 bg-amber-500/10 text-amber-500"
							>
								Price Err
							</Badge>
						)}
						{pos.isPriceResolved && pos.sector !== "Other" && (
							<Badge
								variant="outline"
								className={cn(
									"h-4 px-1.5 py-0 text-[9px] font-semibold tracking-wide uppercase transition-all duration-300",
									pos.sector === "Needs metadata"
										? "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
										: "border-border/40 text-muted-foreground",
								)}
							>
								{pos.sector}
							</Badge>
						)}
					</div>
					<span className="max-w-[160px] truncate text-[10px] text-foreground/70" title={pos.name}>
						{pos.name}
					</span>
				</div>
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm">
				{pos.isPriceResolved ? formatCurrency(pos.currentPrice) : "—"}
			</TableCell>
			<TableCell className="py-3 text-right">
				{pos.isPriceResolved && pos.hasDayChange ? (
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
				) : (
					<span className="text-muted-foreground/60">—</span>
				)}
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
				{formatNumber(pos.quantity, 0)}
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
				{formatCurrency(pos.avgPrice)}
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm font-medium">
				{pos.isPriceResolved ? formatCurrency(pos.value) : "—"}
			</TableCell>
			<TableCell className="py-3 text-right">
				{pos.isPriceResolved ? (
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
								pos.plPercent >= 0 ? "text-emerald-600/80" : "text-rose-600/80",
							)}
						>
							{pos.plPercent.toFixed(2)}%
						</span>
					</div>
				) : (
					<div className="flex flex-col items-end">
						<span className="text-muted-foreground/60 font-mono text-sm">—</span>
					</div>
				)}
			</TableCell>
			<TableCell className="py-3 pr-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
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
						{!pos.isPriceResolved && onRefreshPrice && (
							<DropdownMenuItem onClick={() => onRefreshPrice(pos)}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Refresh Price
							</DropdownMenuItem>
						)}
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
	);
}

function PositionsTable({
	positions,
	formatCurrency,
	formatNumber,
	hideHeader = false,
	onSelectAsset,
	onSelectAccount: _onSelectAccount,
	onDeletePosition,
	onRefreshPrice,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	positions: any[];
	formatCurrency: (val: number) => string;
	formatNumber: (val: number, decimals?: number) => string;
	hideHeader?: boolean;
	onSelectAsset?: (symbol: string) => void;
	onSelectAccount?: (name: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onDeletePosition?: (pos: any) => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onRefreshPrice?: (pos: any) => void;
}) {
	const tableContainerRef = useRef<HTMLDivElement>(null);

	const rowVirtualizer = useVirtualizer({
		count: positions.length,
		getScrollElement: () => tableContainerRef.current,
		estimateSize: () => 56, // row height with padding + badges
		overscan: 5,
	});

	// Only virtualize when > 20 rows; fall through to direct rendering for small tables
	if (positions.length <= 20) {
		return (
			<Table>
				{hideHeader ? (
					<TableHeader className="bg-transparent/5">
						<TableRow className="hover:bg-transparent border-b border-border/20">
							<TableHead className="w-[30px] py-1"></TableHead>
							<TableHead className="h-7 w-[130px] sm:w-[210px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Instrument
							</TableHead>
							<TableHead className="h-7 text-right w-[80px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Price
							</TableHead>
							<TableHead className="h-7 text-right w-[90px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Change (1D)
							</TableHead>
							<TableHead className="h-7 text-right w-[75px] hidden sm:table-cell text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Quantity
							</TableHead>
							<TableHead className="h-7 text-right w-[80px] hidden sm:table-cell text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Avg Cost
							</TableHead>
							<TableHead className="h-7 text-right w-[100px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Value
							</TableHead>
							<TableHead className="h-7 text-right w-[110px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Total P&L
							</TableHead>
							<TableHead className="h-7 w-[44px]"></TableHead>
						</TableRow>
					</TableHeader>
				) : (
					<TableHeader className="bg-muted/5">
						<TableRow className="hover:bg-transparent border-border/50">
							<TableHead className="w-[30px]"></TableHead>
							<TableHead className="h-10 w-[130px] sm:w-[210px] text-xs font-semibold text-muted-foreground">
								Instrument
							</TableHead>
							<TableHead className="h-10 text-right w-[80px] text-xs font-semibold text-muted-foreground">
								Price
							</TableHead>
							<TableHead className="h-10 text-right w-[90px] text-xs font-semibold text-muted-foreground">
								Change (1D)
							</TableHead>
							<TableHead className="h-10 text-right w-[75px] hidden sm:table-cell text-xs font-semibold text-muted-foreground">
								Quantity
							</TableHead>
							<TableHead className="h-10 text-right w-[80px] hidden sm:table-cell text-xs font-semibold text-muted-foreground">
								Avg Cost
							</TableHead>
							<TableHead className="h-10 text-right w-[100px] text-xs font-semibold text-muted-foreground">
								Value
							</TableHead>
							<TableHead className="h-10 text-right w-[110px] text-xs font-semibold text-muted-foreground">
								Total P&L
							</TableHead>
							<TableHead className="h-10 w-[44px]"></TableHead>
						</TableRow>
					</TableHeader>
				)}
				<TableBody>
					{positions.map((pos) => (
						<PositionRow
							key={pos.id}
							pos={pos}
							formatCurrency={formatCurrency}
							formatNumber={formatNumber}
							onSelectAsset={onSelectAsset}
							onDeletePosition={onDeletePosition}
							onRefreshPrice={onRefreshPrice}
						/>
					))}
				</TableBody>
			</Table>
		);
	}

	// Virtualized rendering for tables with > 20 rows
	const ESTIMATED_ROW_HEIGHT = 56;
	return (
		<div ref={tableContainerRef} style={{ overflow: "auto", maxHeight: "600px" }}>
			<Table>
				{hideHeader ? (
					<TableHeader className="bg-transparent/5">
						<TableRow className="hover:bg-transparent border-b border-border/20">
							<TableHead className="w-[30px] py-1"></TableHead>
							<TableHead className="h-7 w-[130px] sm:w-[210px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Instrument
							</TableHead>
							<TableHead className="h-7 text-right w-[80px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Price
							</TableHead>
							<TableHead className="h-7 text-right w-[90px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Change (1D)
							</TableHead>
							<TableHead className="h-7 text-right w-[75px] hidden sm:table-cell text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Quantity
							</TableHead>
							<TableHead className="h-7 text-right w-[80px] hidden sm:table-cell text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Avg Cost
							</TableHead>
							<TableHead className="h-7 text-right w-[100px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Value
							</TableHead>
							<TableHead className="h-7 text-right w-[110px] text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
								Total P&L
							</TableHead>
							<TableHead className="h-7 w-[44px]"></TableHead>
						</TableRow>
					</TableHeader>
				) : (
					<TableHeader className="bg-muted/5">
						<TableRow className="hover:bg-transparent border-border/50">
							<TableHead className="w-[30px]"></TableHead>
							<TableHead className="h-10 w-[130px] sm:w-[210px] text-xs font-semibold text-muted-foreground">
								Instrument
							</TableHead>
							<TableHead className="h-10 text-right w-[80px] text-xs font-semibold text-muted-foreground">
								Price
							</TableHead>
							<TableHead className="h-10 text-right w-[90px] text-xs font-semibold text-muted-foreground">
								Change (1D)
							</TableHead>
							<TableHead className="h-10 text-right w-[75px] hidden sm:table-cell text-xs font-semibold text-muted-foreground">
								Quantity
							</TableHead>
							<TableHead className="h-10 text-right w-[80px] hidden sm:table-cell text-xs font-semibold text-muted-foreground">
								Avg Cost
							</TableHead>
							<TableHead className="h-10 text-right w-[100px] text-xs font-semibold text-muted-foreground">
								Value
							</TableHead>
							<TableHead className="h-10 text-right w-[110px] text-xs font-semibold text-muted-foreground">
								Total P&L
							</TableHead>
							<TableHead className="h-10 w-[44px]"></TableHead>
						</TableRow>
					</TableHeader>
				)}
				<TableBody>
					{rowVirtualizer.getVirtualItems().map((virtualRow) => {
						const pos = positions[virtualRow.index];
						return (
							<PositionRow
								key={pos.id}
								pos={pos}
								formatCurrency={formatCurrency}
								formatNumber={formatNumber}
								onSelectAsset={onSelectAsset}
								onDeletePosition={onDeletePosition}
								onRefreshPrice={onRefreshPrice}
							/>
						);
					})}
					{/* Spacer row to drive scroll height */}
					<tr>
						<td
							colSpan={9}
							style={{
								padding: 0,
								height: `${Math.max(0, rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems().reduce((s, v) => s + v.size, 0))}px`,
							}}
						/>
					</tr>
				</TableBody>
			</Table>
		</div>
	);
}
