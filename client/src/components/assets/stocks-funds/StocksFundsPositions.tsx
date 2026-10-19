import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ChevronDown,
	ChevronRight,
	Download,
	ExternalLink,
	Eye,
	Layers,
	MoreHorizontal,
	PieChart,
	RefreshCw,
	SlidersHorizontal,
	Trash2,
	Wallet,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SortableHead } from "@/components/assets/stocks-funds/SortableHead";
import { usePortfolio } from "@/components/PortfolioProvider";
import { computeDayChangeAmount } from "@/components/stocks-funds/day-change";
import { type FxResolution, resolveFxBasis } from "@/components/stocks-funds/fx-valuation";
import { resolvePositionValue } from "@/components/stocks-funds/position-value";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrency } from "@/hooks/use-currency";
import { allocatePercentages } from "@/lib/money/rounding";
import { cn } from "@/lib/utils";

export type GroupByMode = "account" | "asset" | "sector" | "none";

export type SortField =
	| "symbol"
	| "price"
	| "dayChange"
	| "quantity"
	| "avgPrice"
	| "value"
	| "weight"
	| "pl";

export type SortDirection = "asc" | "desc";

/**
 * One row in the flattened holdings stream.
 *
 * Group headers and positions live in the same array so a single virtualizer
 * and a single scroll container can render both. Previously each group got its
 * own virtualized table nested inside an Accordion.
 */
export type TableRowModel =
	| { kind: "position"; key: string; pos: PositionItem }
	| {
			kind: "group";
			key: string;
			name: string;
			count: number;
			value: number;
			/**
			 * Group P&L: complete only when every position in the group has a
			 * display-currency basis; a partial sum would read as authoritative.
			 */
			pl: number | null;
			collapsed: boolean;
	  };

/** Leading/trailing spacer cells plus the eight data columns. */
const POSITION_COLUMN_COUNT = 10;

/** Initial size estimates only - `measureElement` corrects them after paint. */
const GROUP_ROW_ESTIMATE = 44;
const POSITION_ROW_ESTIMATE = 68;

export interface PositionItem {
	id: string;
	portfolioId: string;
	symbol: string;
	name: string;
	quantity: number;
	avgPrice: number;
	currentPrice: number;
	value: number;
	cost: number;
	/**
	 * Unrealized P&L in the display currency, or null when the cost basis
	 * cannot be expressed there. The raw purchase price keeps its own
	 * currency, so `value - cost` mixes currencies and must not render; see
	 * fx-valuation.ts and StocksFundsPositions-side resolution.
	 */
	pl: number | null;
	plPercent: number;
	currency: string;
	account: string;
	sector: string;
	dayChange: number;
	dayChangeAmount: number;
	weight: number;
	assetClass: "ETFs/Funds" | "Stocks";
	isPriceResolved: boolean;
	hasDayChange: boolean;
	/**
	 * Server-computed FX verdict for this position. P&L % is rendered only when
	 * `fx.canShowPercentage` is true. See fx-valuation.ts.
	 */
	fx: FxResolution;
}

interface StocksFundsPositionsProps {
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
	externalFilter?: {
		mode: "sector" | "asset-class" | "type" | "asset";
		value: string;
	} | null;
	onClearExternalFilter?: () => void;
	loading?: boolean;
}

/**
 * Export exactly the rows the table is showing.
 *
 * Deliberately kept separate from `ExportService`, which now reads real data
 * from the API. The two answer different questions: this one exports the
 * current view - search, asset-class filter and all - while `ExportService`
 * exports the whole portfolio.
 *
 * Routing the table's button through `ExportService` would be a regression in
 * the other direction. Its title says "Export current positions table to CSV",
 * and a user who filtered to ten positions would receive a file containing
 * every position they own, with nothing in the UI to say so.
 */
export function exportPositionsToCSV(positions: PositionItem[], filename?: string) {
	if (positions.length === 0) {
		toast.error("No positions to export");
		return;
	}

	const headers = [
		"Symbol",
		"Name",
		"Asset Class",
		"Sector",
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

	const escapeCSV = (val: string | number | null | undefined) => {
		if (val === null || val === undefined) return '""';
		const str = String(val);
		if (str.includes(",") || str.includes('"') || str.includes("\n")) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return `"${str}"`;
	};

	const rows = positions.map((p) => [
		escapeCSV(p.symbol),
		escapeCSV(p.name),
		escapeCSV(p.assetClass),
		escapeCSV(p.sector),
		escapeCSV(p.account),
		escapeCSV(p.currency),
		p.quantity,
		p.currentPrice.toFixed(4),
		p.dayChangeAmount.toFixed(2),
		p.dayChange.toFixed(2),
		p.value.toFixed(2),
		p.avgPrice.toFixed(4),
		p.cost.toFixed(2),
		p.pl === null ? "" : p.pl.toFixed(2),
		p.pl === null ? "" : p.plPercent.toFixed(2),
		p.weight.toFixed(2),
	]);

	const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join(
		"\r\n",
	);

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.setAttribute("href", url);
	const dateStr = new Date().toISOString().split("T")[0];
	link.setAttribute("download", filename || `sigma_positions_export_${dateStr}.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
	toast.success(`Exported ${positions.length} positions to CSV`);
}

export function PositionsTableSkeleton() {
	return (
		<div className="border border-border/60 rounded-lg overflow-hidden bg-card/80 flex flex-col h-full animate-pulse">
			<div className="flex flex-col justify-between gap-3 border-b border-border/40 bg-muted/5 px-4 py-4 lg:flex-row lg:items-center">
				<div className="flex w-full items-center gap-2 lg:w-auto">
					<Skeleton className="h-9 w-full lg:w-72 rounded-md" />
					<Skeleton className="h-9 w-9 rounded-md" />
					<Skeleton className="h-9 w-28 rounded-md" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-24 rounded-md" />
				</div>
			</div>

			<div className="overflow-x-auto min-h-[400px]">
				<Table>
					<TableHeader className="bg-muted/10">
						<TableRow className="border-border/50">
							<TableHead className="w-[12px] p-0"></TableHead>
							<TableHead className="w-[140px] sm:w-[210px]">
								<Skeleton className="h-4 w-20" />
							</TableHead>
							<TableHead className="text-right w-[90px]">
								<Skeleton className="h-4 w-12 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[105px]">
								<Skeleton className="h-4 w-16 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[75px] hidden sm:table-cell">
								<Skeleton className="h-4 w-10 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[100px] hidden lg:table-cell">
								<Skeleton className="h-4 w-14 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[110px]">
								<Skeleton className="h-4 w-14 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[80px] hidden md:table-cell">
								<Skeleton className="h-4 w-10 ml-auto" />
							</TableHead>
							<TableHead className="text-right w-[115px]">
								<Skeleton className="h-4 w-16 ml-auto" />
							</TableHead>
							<TableHead className="w-[44px]"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 6 }).map((_, i) => (
							<TableRow key={`pos-skel-${i}`} className="border-border/40">
								<TableCell className="py-3 pl-3">
									<Skeleton className="h-9 w-1 rounded-full" />
								</TableCell>
								<TableCell className="py-3 w-[140px] sm:w-[210px]">
									<div className="space-y-1.5">
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-14" />
											<Skeleton className="h-4 w-16 rounded-full" />
										</div>
										<Skeleton className="h-3 w-28" />
									</div>
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-14 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-16 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right hidden sm:table-cell">
									<Skeleton className="h-4 w-10 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right hidden lg:table-cell">
									<Skeleton className="h-4 w-16 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right">
									<Skeleton className="h-4 w-20 ml-auto" />
								</TableCell>
								<TableCell className="py-3 text-right hidden md:table-cell">
									<div className="flex items-center justify-end gap-1">
										<Skeleton className="h-3 w-8" />
										<Skeleton className="h-1.5 w-8 rounded-full" />
									</div>
								</TableCell>
								<TableCell className="py-3 text-right">
									<div className="space-y-1">
										<Skeleton className="h-4 w-16 ml-auto" />
										<Skeleton className="h-3 w-10 ml-auto" />
									</div>
								</TableCell>
								<TableCell className="py-3 pr-3">
									<Skeleton className="h-7 w-7 rounded-md ml-auto" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-4 py-3">
				<Skeleton className="h-4 w-36" />
				<Skeleton className="h-4 w-40" />
			</div>
		</div>
	);
}

export function StocksFundsPositions({
	onSelectAccount,
	onSelectAsset,
	externalFilter = null,
	onClearExternalFilter,
	loading = false,
}: StocksFundsPositionsProps) {
	const { assets, deleteAsset, currentPortfolio, refreshAssetPrice } = usePortfolio();

	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		portfolioId: string;
		symbol: string;
		name: string;
	} | null>(null);
	const [groupBy, setGroupBy] = useState<GroupByMode>("account");
	const [rawSearchQuery, setRawSearchQuery] = useState("");
	const [sortField, setSortField] = useState<SortField>("value");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	// Debounced search (150ms) to avoid filtering on every keystroke
	const [searchQuery, setSearchQuery] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

	// Shares resolvePositionValue with the module, so the header total, the
	// donut and this table can never disagree.
	const stocksAndFundsAssets = useMemo(
		() => assets.filter((asset) => asset.type === "stock" || asset.type === "fund"),
		[assets],
	);

	// Memoized positions transform with strict typing
	const positions = useMemo<PositionItem[]>(() => {
		// Weights are apportioned with the largest-remainder method, so the weight
		// column and the allocation donut both add up to exactly 100%.
		const resolvedValues = stocksAndFundsAssets.map(
			(asset) => resolvePositionValue(asset.currentValue, asset.currentPrice, asset.quantity).value,
		);
		const apportionedWeights = allocatePercentages(resolvedValues);

		return stocksAndFundsAssets.map((asset, index) => {
			const quantity =
				typeof asset.quantity === "number" && Number.isFinite(asset.quantity) && asset.quantity > 0
					? asset.quantity
					: 0;
			const rawCurrentPrice =
				typeof asset.currentPrice === "number" && Number.isFinite(asset.currentPrice)
					? asset.currentPrice
					: 0;
			const purchasePrice =
				typeof asset.purchasePrice === "number" && Number.isFinite(asset.purchasePrice)
					? asset.purchasePrice
					: 0;
			const currentPrice = rawCurrentPrice > 0 ? rawCurrentPrice : 0;
			const resolvedValue = resolvePositionValue(
				asset.currentValue,
				rawCurrentPrice,
				quantity,
			).value;
			const cost = purchasePrice * quantity;
			// The basis decides which math may run, exactly like the module
			// (see normalizeStockAssets): a converted basis has server-summed
			// display-currency value and basis, so the P&L comes from those
			// instead of mixing a EUR purchase price with a USD value. Without
			// a converted basis the difference is unknowable in the display
			// currency: publish null rather than a number with no currency.
			let pl: number | null = resolvedValue - cost;
			let plPercent = 0;
			// Whether a percentage may be shown is the server's call. It used to
			// be `(asset.currency || "USD") === "USD"`, which was unconditionally
			// true because `currency` is never fetched - so every row printed a
			// percentage computed against an unconverted cost basis. See
			// fx-valuation.ts.
			const fx = asset.fx ?? resolveFxBasis(null);
			if (fx.canShowPercentage) {
				if (
					fx.basis === "converted-basis" &&
					fx.displayValue !== null &&
					fx.costBasisDisplay !== null
				) {
					if (fx.costBasisDisplay > 0) {
						pl = fx.displayValue - fx.costBasisDisplay;
						plPercent = (pl / fx.costBasisDisplay) * 100;
					} else {
						pl = 0;
					}
				} else if (cost > 0) {
					plPercent = (pl / cost) * 100;
				}
			} else {
				pl = null;
			}
			const isPriceResolved = currentPrice > 0;

			// Support both dayChangePercent and dayChange from GraphQL mappings
			const rawAssetRecord = asset as Record<string, unknown>;
			const rawDayChange =
				typeof rawAssetRecord.dayChangePercent === "number" &&
				Number.isFinite(rawAssetRecord.dayChangePercent)
					? (rawAssetRecord.dayChangePercent as number)
					: typeof rawAssetRecord.dayChange === "number" &&
							Number.isFinite(rawAssetRecord.dayChange)
						? (rawAssetRecord.dayChange as number)
						: 0;
			const hasDayChange =
				typeof rawAssetRecord.dayChangePercent === "number" ||
				typeof rawAssetRecord.dayChange === "number";

			const dayChangeAmount = computeDayChangeAmount(resolvedValue, rawDayChange);
			const weight = apportionedWeights[index] ?? 0;

			const sector =
				typeof rawAssetRecord.sector === "string" && rawAssetRecord.sector.trim().length > 0
					? (rawAssetRecord.sector as string)
					: "Needs metadata";

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
				currency: asset.currency || fx.quoteCurrency || fx.costBasisCurrency || "USD",
				account:
					(typeof rawAssetRecord.account === "object" && rawAssetRecord.account !== null
						? (rawAssetRecord.account as { name?: string }).name
						: typeof rawAssetRecord.account === "string"
							? rawAssetRecord.account
							: null) ||
					(typeof asset.account === "string" ? asset.account : null) ||
					"Main Account",
				sector,
				dayChange: rawDayChange,
				dayChangeAmount,
				weight,
				assetClass: asset.type === "fund" ? "ETFs/Funds" : "Stocks",
				isPriceResolved,
				hasDayChange,
				fx,
			};
		});
	}, [stocksAndFundsAssets, currentPortfolio]);

	// Stable row-action callbacks.
	//
	// These were inline arrows in the JSX, so every render handed PositionsTable
	// and PositionRow brand-new function identities. That defeated `memo` on both
	// components: any unrelated state change (typing in the search box, toggling
	// group-by) re-rendered every visible row.
	const handleDeletePosition = useCallback((pos: PositionItem) => {
		setDeleteTarget({
			id: pos.id,
			portfolioId: pos.portfolioId,
			symbol: pos.symbol,
			name: pos.name,
		});
	}, []);

	const handleRefreshPrice = useCallback(
		async (pos: PositionItem) => {
			await refreshAssetPrice(pos.id);
			// No explicit refetch() here. REFRESH_SINGLE_ASSET_PRICE evicts the
			// portfolio/dashboard cache fields in its `update`, so the active
			// GET_DASHBOARD_CRITICAL observer refetches on its own. Calling
			// refetch() as well issued a second, identical network request.
			toast.success(`Price refresh requested for ${pos.symbol}`);
		},
		[refreshAssetPrice],
	);

	// Interactive column sort handler
	const handleSort = useCallback((field: SortField) => {
		setSortField((currentField) => {
			if (currentField === field) {
				setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
				return field;
			}
			setSortDirection("desc");
			return field;
		});
	}, []);

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
			let diff = 0;
			switch (sortField) {
				case "symbol":
					diff = a.symbol.localeCompare(b.symbol);
					break;
				case "price":
					diff = a.currentPrice - b.currentPrice;
					break;
				case "dayChange":
					diff = a.dayChange - b.dayChange;
					break;
				case "quantity":
					diff = a.quantity - b.quantity;
					break;
				case "avgPrice":
					diff = a.avgPrice - b.avgPrice;
					break;
				case "value":
					diff = a.value - b.value;
					break;
				case "weight":
					diff = a.weight - b.weight;
					break;
				case "pl":
					// Null P&L is "not computed", not zero: sort it last instead of
					// folding it into an arithmetic comparison.
					if (a.pl === null || b.pl === null) {
						return sortDirection === "asc"
							? (a.pl === null ? 1 : 0) - (b.pl === null ? 1 : 0)
							: (b.pl === null ? 1 : 0) - (a.pl === null ? 1 : 0);
					}
					diff = a.pl - b.pl;
					break;
			}
			return sortDirection === "asc" ? diff : -diff;
		});
	}, [positions, searchQuery, externalFilter, sortField, sortDirection]);

	// Grouping Logic
	const groupedData = useMemo(() => {
		if (groupBy === "none") return null;

		const groups: { [key: string]: PositionItem[] } = {};

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

	// Collapsed groups in the flattened row stream. An empty set means everything
	// is expanded, which matches the old Accordion's `defaultValue={groupName}`.
	const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
		() => new Set<string>(),
	);

	const toggleGroupCollapsed = useCallback((groupName: string) => {
		setCollapsedGroups((previous) => {
			const next = new Set(previous);
			if (next.has(groupName)) {
				next.delete(groupName);
			} else {
				next.add(groupName);
			}
			return next;
		});
	}, []);

	// Group headers and position rows are flattened into ONE stream so a single
	// virtualizer and a single scroll container cover the whole table. Group
	// aggregates are computed here rather than in a per-group component, so the
	// header row and the rows under it can never disagree.
	const tableRows = useMemo<TableRowModel[]>(() => {
		if (groupBy === "none") {
			return filteredPositions.map((pos) => ({ kind: "position", key: pos.id, pos }));
		}

		const rows: TableRowModel[] = [];
		for (const [groupName, groupPositions] of Object.entries(groupedData ?? {})) {
			const collapsed = collapsedGroups.has(groupName);
			rows.push({
				kind: "group",
				key: `group:${groupName}`,
				name: groupName,
				count: groupPositions.length,
				value: groupPositions.reduce((sum, p) => sum + p.value, 0),
				pl: groupPositions.every((p) => p.pl !== null)
					? groupPositions.reduce((sum, p) => sum + (p.pl ?? 0), 0)
					: null,
				collapsed,
			});
			if (collapsed) continue;
			for (const pos of groupPositions) {
				rows.push({ kind: "position", key: pos.id, pos });
			}
		}
		return rows;
	}, [groupBy, groupedData, filteredPositions, collapsedGroups]);

	if (loading) {
		return <PositionsTableSkeleton />;
	}

	return (
		<TooltipProvider delayDuration={200}>
			<div className="border border-border/60 rounded-lg overflow-hidden bg-card/80">
				{/* Toolbar */}
				<div className="flex flex-col justify-between gap-3 border-b border-border/40 bg-muted/5 px-4 py-4 lg:flex-row lg:items-center">
					<div className="flex w-full items-center gap-2 lg:w-auto">
						<SearchInput
							placeholder="Filter positions by symbol, name, or account..."
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
								<Button
									variant="outline"
									size="sm"
									aria-label="Change sort metric and direction"
									className="h-9 w-9 p-0 border-border/50"
								>
									<SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-48">
								<DropdownMenuLabel className="text-xs">Sort Metric</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={sortField === "value"}
									onCheckedChange={() => {
										setSortField("value");
										setSortDirection("desc");
									}}
								>
									Highest Value
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "weight"}
									onCheckedChange={() => {
										setSortField("weight");
										setSortDirection("desc");
									}}
								>
									Highest Weight %
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "pl" && sortDirection === "desc"}
									onCheckedChange={() => {
										setSortField("pl");
										setSortDirection("desc");
									}}
								>
									Highest Gain
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "pl" && sortDirection === "asc"}
									onCheckedChange={() => {
										setSortField("pl");
										setSortDirection("asc");
									}}
								>
									Highest Loss
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "dayChange"}
									onCheckedChange={() => {
										setSortField("dayChange");
										setSortDirection("desc");
									}}
								>
									Day Change %
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Button
							variant="outline"
							size="sm"
							className="h-9 gap-1.5 border-border/50 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
							onClick={() => exportPositionsToCSV(filteredPositions)}
							title="Export current positions table to CSV"
						>
							<Download className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Export CSV</span>
						</Button>
					</div>

					<div className="flex w-full flex-wrap items-center justify-between gap-3 lg:w-auto lg:flex-nowrap lg:justify-end">
						{externalFilter && (
							<div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-micro">
								<span className="uppercase text-muted-foreground font-semibold">
									Filter:{" "}
									{externalFilter.mode === "sector"
										? "Sector"
										: externalFilter.mode === "type"
											? "Class"
											: "Asset"}
								</span>
								<span className="font-bold text-primary">{externalFilter.value}</span>
								<span className="text-muted-foreground">
									({filteredPositions.length} holding{filteredPositions.length !== 1 ? "s" : ""})
								</span>
								<Button
									variant="ghost"
									size="sm"
									className="h-5 px-1.5 text-micro hover:bg-primary/20 text-foreground cursor-pointer"
									onClick={onClearExternalFilter}
								>
									Clear
								</Button>
							</div>
						)}
						<span
							id="positions-group-by-label"
							className="mr-1 text-micro font-medium uppercase tracking-[0.16em] text-muted-foreground"
						>
							Group By:
						</span>
						{/* Toggle group: aria-pressed on each button is the simplest
					    accessible pattern for an independent-toggle control set. */}
						<div
							className="flex rounded-lg bg-muted p-0.5"
							role="group"
							aria-labelledby="positions-group-by-label"
						>
							{(["account", "asset", "sector", "none"] as const).map((mode) => (
								<button
									type="button"
									key={mode}
									onClick={() => setGroupBy(mode)}
									aria-pressed={groupBy === mode}
									className={cn(
										"rounded-md px-3 py-2 text-micro font-medium transition-all cursor-pointer min-h-[32px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
										groupBy === mode
											? "bg-background shadow-xs text-foreground"
											: "text-foreground/70 hover:text-foreground",
									)}
								>
									{mode === "none" ? "None" : mode.charAt(0).toUpperCase() + mode.slice(1)}
								</button>
							))}
						</div>
					</div>
				</div>
				{/* Content Table Container
				 *
				 * A single scroll container for the whole table. This used to branch:
				 * ungrouped rendered one virtualized table, while every group rendered
				 * an <Accordion> wrapping another virtualized table that had its own
				 * `max-h-[640px] overflow-auto` div. With N groups that meant N nested
				 * scroll areas inside an outer `overflow-x-auto` - nested scrollbars the
				 * user had to fight, and a virtualizer whose scroll target was a 640px
				 * box rather than the page.
				 *
				 * Group headers and position rows now share one flattened stream, so the
				 * scroll ref lives on the single scroller inside PositionsTable.
				 */}
				<div className="min-h-[400px] bg-background">
					<PositionsTable
						rows={tableRows}
						groupBy={groupBy}
						formatCurrency={formatCurrency}
						formatNumber={formatNumber}
						onSelectAsset={onSelectAsset}
						onSelectAccount={onSelectAccount}
						onToggleGroup={toggleGroupCollapsed}
						sortField={sortField}
						sortDirection={sortDirection}
						onSort={handleSort}
						onDeletePosition={handleDeletePosition}
						onRefreshPrice={handleRefreshPrice}
					/>
				</div>{" "}
				{/* Footer / Summary Strip
				    aria-live so filtering/sorting results are announced instead of
				    silently changing the table contents for screen reader users. */}
				<div
					className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-4 py-3 text-xs text-muted-foreground"
					aria-live="polite"
				>
					<div className="flex items-center gap-3">
						<span>
							Showing <strong className="text-foreground">{filteredPositions.length}</strong> of{" "}
							{positions.length} holdings
						</span>
						{searchQuery && (
							<span className="text-primary font-medium">(Filtered by "{searchQuery}")</span>
						)}
					</div>
					<div className="flex items-center gap-4">
						<span>
							Aggregated Value:{" "}
							<strong className="text-foreground font-mono tabular-nums">
								{formatCurrency(filteredPositions.reduce((sum, p) => sum + p.value, 0))}
							</strong>
						</span>
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
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
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
							</AlertDialogAction>{" "}
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</TooltipProvider>
	);
}

interface PositionRowProps {
	pos: PositionItem;
	dataIndex?: number;
	measureRef?: (node: Element | null) => void;
	formatCurrency: (val: number) => string;
	formatNumber: (val: number, decimals?: number) => string;
	onSelectAsset?: (symbol: string) => void;
	onDeletePosition?: (pos: PositionItem) => void;
	onRefreshPrice?: (pos: PositionItem) => void;
}

const PositionRow = memo(function PositionRow({
	pos,
	dataIndex,
	measureRef,
	formatCurrency,
	formatNumber,
	onSelectAsset,
	onDeletePosition,
	onRefreshPrice,
}: PositionRowProps) {
	return (
		<TableRow
			key={pos.id}
			ref={measureRef as React.Ref<HTMLTableRowElement>}
			data-index={dataIndex}
			className="group hover:bg-muted/5 border-border/40 transition-colors data-[state=selected]:bg-muted"
		>
			<TableCell className="py-3 pl-3">
				<div
					aria-hidden
					className={cn(
						"h-9 w-1 rounded-full",
						!pos.isPriceResolved || pos.pl === null
							? "bg-warning"
							: pos.pl >= 0
								? "bg-gain"
								: "bg-loss",
					)}
				/>
			</TableCell>
			<TableCell className="py-3 w-[140px] sm:w-[210px]">
				<div className="flex flex-col gap-1">
					<button
						type="button"
						className="flex items-center gap-2 cursor-pointer hover:underline text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
						onClick={() => onSelectAsset?.(pos.symbol)}
					>
						<span className="text-sm font-bold tracking-tight">{pos.symbol}</span>
						{!pos.isPriceResolved && (
							<Badge
								variant="outline"
								className="h-4 px-1.5 py-0 text-micro font-semibold tracking-wide uppercase border-warning/30 bg-warning/10 text-warning"
							>
								Price Err
							</Badge>
						)}
						{pos.isPriceResolved && pos.sector !== "Other" && (
							<Badge
								variant="outline"
								className={cn(
									"h-4 px-1.5 py-0 text-micro font-semibold tracking-wide uppercase transition-all duration-300",
									pos.sector === "Needs metadata"
										? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
										: "border-border/40 text-muted-foreground",
								)}
							>
								{pos.sector}
							</Badge>
						)}
						{pos.currency && pos.currency !== "USD" && (
							<Badge
								variant="secondary"
								className="h-4 px-1 py-0 text-micro font-mono uppercase bg-muted/60 text-muted-foreground"
								title={pos.fx.canShowPercentage ? undefined : pos.fx.reason}
							>
								{pos.currency}
							</Badge>
						)}
						{pos.fx.isStale && (
							<Badge
								variant="outline"
								className="h-4 px-1 py-0 text-micro font-mono uppercase border-warning/30 bg-warning/10 text-warning"
								title={
									pos.fx.fxAsOf
										? `The FX rate used to value this position was last observed ${pos.fx.fxAsOf} and is considered stale.`
										: "The FX rate used to value this position is stale."
								}
							>
								stale fx
							</Badge>
						)}
					</button>
					{/* Truncation is decorative here: the accessible name of the row button
					    already carries the full name, and pointer users get a tooltip. */}
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="max-w-[160px] truncate text-micro text-foreground/70" tabIndex={-1}>
								{pos.name}
							</span>
						</TooltipTrigger>
						<TooltipContent className="max-w-64">
							<span className="text-xs break-words">{pos.name}</span>
						</TooltipContent>
					</Tooltip>
				</div>
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm">
				{pos.isPriceResolved ? formatCurrency(pos.currentPrice) : "—"}
			</TableCell>
			<TableCell className="py-3 text-right">
				{pos.isPriceResolved && pos.hasDayChange ? (
					<div className="flex flex-col items-end">
						<div
							className={cn(
								"inline-flex items-center font-mono text-xs font-semibold",
								pos.dayChange >= 0 ? "text-gain" : "text-loss",
							)}
						>
							{pos.dayChange >= 0 ? "+" : ""}
							{formatCurrency(pos.dayChangeAmount)}
						</div>
						<span
							className={cn(
								"text-micro font-mono",
								pos.dayChange >= 0 ? "text-gain-muted" : "text-loss-muted",
							)}
						>
							{pos.dayChange >= 0 ? "+" : ""}
							{pos.dayChange.toFixed(2)}%
						</span>
					</div>
				) : (
					<span className="text-muted-foreground">—</span>
				)}
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
				{formatNumber(pos.quantity, pos.quantity % 1 === 0 ? 0 : 4)}
			</TableCell>
			<TableCell className="py-3 text-right hidden sm:table-cell">
				<div className="flex flex-col items-end">
					<span className="font-mono text-sm text-muted-foreground">
						{formatCurrency(pos.avgPrice)}
					</span>
					<span className="text-micro text-muted-foreground font-mono">
						Cost: {formatCurrency(pos.cost)}
					</span>
				</div>
			</TableCell>
			<TableCell className="py-3 text-right font-mono text-sm font-medium">
				{pos.isPriceResolved ? formatCurrency(pos.value) : "—"}
			</TableCell>
			<TableCell className="py-3 text-right hidden md:table-cell">
				<div className="flex flex-col items-end gap-1">
					<span className="font-mono text-xs font-semibold text-foreground">
						{pos.weight.toFixed(1)}%
					</span>{" "}
					<div className="w-12 h-1 bg-secondary/50 rounded-full overflow-hidden">
						{/* transform, not width: the bar animates inside a memoized row
							    that re-measures via the virtualizer. */}
						<div
							className="h-full w-full bg-primary/70 rounded-full origin-right transition-transform duration-300"
							style={{ transform: `scaleX(${Math.min(100, Math.max(3, pos.weight)) / 100})` }}
						/>
					</div>
				</div>
			</TableCell>
			<TableCell className="py-3 text-right">
				{pos.isPriceResolved && pos.pl !== null ? (
					<div className="flex flex-col items-end">
						<span
							className={cn(
								"font-mono font-medium text-sm",
								pos.pl >= 0 ? "text-gain" : "text-loss",
							)}
						>
							{pos.pl >= 0 ? "+" : ""}
							{formatCurrency(pos.pl)}
						</span>
						{pos.fx.canShowPercentage ? (
							<span
								className={cn(
									"text-micro font-mono",
									pos.plPercent >= 0 ? "text-gain-muted" : "text-loss-muted",
								)}
							>
								{pos.plPercent >= 0 ? "+" : ""}
								{pos.plPercent.toFixed(2)}%
							</span>
						) : (
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="text-micro font-mono text-warning cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
										aria-label={`Percentage unavailable: ${pos.fx.reason}`}
									>
										% n/a
									</button>
								</TooltipTrigger>
								<TooltipContent className="max-w-64">
									<span className="text-xs break-words">{pos.fx.reason}</span>
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				) : (
					<div className="flex flex-col items-end">
						<span className="text-muted-foreground font-mono text-sm">—</span>
					</div>
				)}
			</TableCell>
			<TableCell className="py-3 pr-3">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-label={`Actions for ${pos.symbol}`}
							className="h-9 w-9 p-0 cursor-pointer opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:opacity-100 touch-target"
						>
							<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onSelectAsset?.(pos.symbol)}>
							<Eye className="h-4 w-4 mr-2" />
							View Details
						</DropdownMenuItem>
						{!pos.isPriceResolved && onRefreshPrice && (
							<DropdownMenuItem onClick={() => onRefreshPrice(pos)}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Refresh Price
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
});

interface PositionsTableProps {
	rows: TableRowModel[];
	groupBy: GroupByMode;
	formatCurrency: (val: number) => string;
	formatNumber: (val: number, decimals?: number) => string;
	onSelectAsset?: (symbol: string) => void;
	onSelectAccount?: (name: string) => void;
	onToggleGroup?: (groupName: string) => void;
	onDeletePosition?: (pos: PositionItem) => void;
	onRefreshPrice?: (pos: PositionItem) => void;
	sortField?: SortField;
	sortDirection?: SortDirection;
	onSort?: (field: SortField) => void;
}

const GROUP_ICON_BY_MODE = {
	account: Wallet,
	asset: Layers,
	sector: PieChart,
	none: PieChart,
} as const;

/**
 * One group of holdings, rendered as a full-width row in the shared stream.
 *
 * The expand/collapse control and the account link are sibling buttons rather
 * than a nested pair, so each is independently focusable and keyboard
 * operable, and the toggle can advertise `aria-expanded`.
 */
const GroupHeaderRow = memo(function GroupHeaderRow({
	row,
	groupBy,
	dataIndex,
	measureRef,
	formatCurrency,
	onSelectAccount,
	onToggleGroup,
}: {
	row: Extract<TableRowModel, { kind: "group" }>;
	groupBy: GroupByMode;
	dataIndex: number;
	measureRef?: (node: Element | null) => void;
	formatCurrency: (val: number) => string;
	onSelectAccount?: (name: string) => void;
	onToggleGroup?: (groupName: string) => void;
}) {
	const GroupIcon = GROUP_ICON_BY_MODE[groupBy] ?? PieChart;
	const isDefaultAccount = row.name === "Manual Entry";
	const isClickableAccount = groupBy === "account" && !isDefaultAccount;

	return (
		<TableRow
			ref={measureRef as React.Ref<HTMLTableRowElement>}
			data-index={dataIndex}
			className="border-border/40 hover:bg-muted/5 transition-colors"
		>
			<TableCell colSpan={POSITION_COLUMN_COUNT} className="p-0">
				<div className="flex w-full items-center justify-between pr-4">
					<button
						type="button"
						onClick={() => onToggleGroup?.(row.name)}
						aria-expanded={!row.collapsed}
						className="flex items-center gap-3 px-4 py-3 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
					>
						<ChevronDown
							aria-hidden
							className={cn(
								"h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out",
								row.collapsed ? "-rotate-90" : "rotate-0",
							)}
						/>
						<span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
							<GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
						</span>
						<span className="text-sm font-medium tracking-tight">{row.name}</span>
						<Badge variant="outline" className="h-5 text-micro font-normal text-muted-foreground">
							{row.count}
						</Badge>
						{isClickableAccount && (
							<ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover/row:opacity-50" />
						)}
					</button>

					<div className="flex items-center gap-6 text-sm">
						<div className="text-right w-[100px]">
							<span className="mr-2 font-mono text-xs font-medium text-muted-foreground">
								Value
							</span>
							<span className="font-mono font-medium">{formatCurrency(row.value)}</span>
						</div>
						<div className="text-right w-[110px]">
							{row.pl === null ? (
								<span className="text-muted-foreground font-mono font-medium">—</span>
							) : (
								<span
									className={cn("font-mono font-medium", row.pl >= 0 ? "text-gain" : "text-loss")}
								>
									{row.pl >= 0 ? "+" : ""}
									{formatCurrency(row.pl)}
								</span>
							)}
						</div>
					</div>
				</div>

				{isClickableAccount && (
					<div className="px-4 pb-2 -mt-1">
						<button
							type="button"
							onClick={() => onSelectAccount?.(row.name)}
							className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
						>
							Open {row.name}
						</button>
					</div>
				)}
			</TableCell>
		</TableRow>
	);
});

const PositionsTable = memo(function PositionsTable({
	rows,
	groupBy,
	formatCurrency,
	formatNumber,
	onSelectAsset,
	onSelectAccount,
	onToggleGroup,
	onDeletePosition,
	onRefreshPrice,
	sortField,
	sortDirection,
	onSort,
}: PositionsTableProps) {
	// The one and only scroll container in the holdings view.
	const tableContainerRef = useRef<HTMLDivElement>(null);

	const rowVirtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => tableContainerRef.current,
		// Group headers are shorter than position rows. Previously this was a
		// hardcoded `() => 68` for every row, which over-measured headers and
		// under-measured any row whose content wrapped. measureElement corrects
		// the estimate after first paint, so these are just the initial guess.
		estimateSize: (index) =>
			rows[index]?.kind === "group" ? GROUP_ROW_ESTIMATE : POSITION_ROW_ESTIMATE,
		overscan: 8,
	});

	// The `max-h-[640px]` scroller clips whatever row straddles the bottom edge
	// mid-height. With no other scroll affordance, that half-row read as a
	// broken layout rather than "there is more below" — the "Manual Entry"
	// account header arrived sliced in half. Fade the bottom edge while the
	// table can still be advanced, and hide the fade once the end is reached.
	const [showBottomFade, setShowBottomFade] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the scroller only mounts once rows exist, so the effect must re-attach on the 0 -> N transition
	useEffect(() => {
		const el = tableContainerRef.current;
		if (!el) return;
		const update = () => setShowBottomFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		const table = el.querySelector("table");
		if (table) observer.observe(table);
		el.addEventListener("scroll", update, { passive: true });
		return () => {
			observer.disconnect();
			el.removeEventListener("scroll", update);
		};
	}, [rows.length]);

	if (rows.length === 0) {
		return (
			<div className="py-12 text-center text-xs text-muted-foreground">
				No holdings found matching the criteria.
			</div>
		);
	}

	const virtualItems = rowVirtualizer.getVirtualItems();
	const firstItem = virtualItems[0];
	const lastItem = virtualItems[virtualItems.length - 1];
	const padTop = firstItem ? firstItem.start : 0;
	const padBottom = lastItem ? Math.max(0, rowVirtualizer.getTotalSize() - lastItem.end) : 0;

	return (
		<div ref={tableContainerRef} className="overflow-auto max-h-[640px]">
			<Table>
				<TableHeader className="sticky top-0 z-10 bg-muted/95">
					<TableRow className="hover:bg-transparent border-border/50">
						<TableHead className="w-[30px]"></TableHead>
						<SortableHead
							label="Instrument"
							field="symbol"
							className="w-[140px] sm:w-[210px]"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Price"
							field="price"
							className="w-[90px] text-right"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Change (1D)"
							field="dayChange"
							className="w-[105px] text-right"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Quantity"
							field="quantity"
							className="w-[75px] text-right hidden sm:table-cell"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Avg Cost & Basis"
							field="avgPrice"
							className="w-[110px] text-right hidden sm:table-cell"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Value"
							field="value"
							className="w-[105px] text-right"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Weight"
							field="weight"
							className="w-[80px] text-right hidden md:table-cell"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<SortableHead
							label="Total P&L"
							field="pl"
							className="w-[115px] text-right"
							align="right"
							sortField={sortField}
							sortDirection={sortDirection}
							onSort={onSort}
						/>
						<TableHead className="w-[44px]"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{padTop > 0 && (
						<tr>
							<td colSpan={POSITION_COLUMN_COUNT} style={{ padding: 0, height: `${padTop}px` }} />
						</tr>
					)}
					{virtualItems.map((virtualRow) => {
						const row = rows[virtualRow.index];
						if (!row) return null;
						if (row.kind === "group") {
							return (
								<GroupHeaderRow
									key={row.key}
									row={row}
									groupBy={groupBy}
									dataIndex={virtualRow.index}
									measureRef={rowVirtualizer.measureElement}
									formatCurrency={formatCurrency}
									onSelectAccount={onSelectAccount}
									onToggleGroup={onToggleGroup}
								/>
							);
						}
						return (
							<PositionRow
								key={row.key}
								pos={row.pos}
								dataIndex={virtualRow.index}
								measureRef={rowVirtualizer.measureElement}
								formatCurrency={formatCurrency}
								formatNumber={formatNumber}
								onSelectAsset={onSelectAsset}
								onDeletePosition={onDeletePosition}
								onRefreshPrice={onRefreshPrice}
							/>
						);
					})}
					{padBottom > 0 && (
						<tr>
							<td
								colSpan={POSITION_COLUMN_COUNT}
								style={{ padding: 0, height: `${padBottom}px` }}
							/>
						</tr>
					)}
				</TableBody>
			</Table>
			{showBottomFade && (
				// Sticky, not absolute: it has to stay pinned to the bottom of the
				// scroller's viewport while the rows scroll underneath. `-mt-8`
				// overlays the trailing 32px instead of adding layout height.
				<div
					aria-hidden
					className="pointer-events-none sticky bottom-0 -mt-8 h-8 bg-gradient-to-t from-background to-transparent"
				/>
			)}
		</div>
	);
});
