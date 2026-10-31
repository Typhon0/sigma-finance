import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ChevronDown,
	Download,
	ExternalLink,
	Eye,
	FoldVertical,
	Layers,
	MoreHorizontal,
	PieChart,
	RefreshCw,
	SlidersHorizontal,
	Trash2,
	UnfoldVertical,
	Wallet,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { exportPositionsToCSV } from "./export-csv";
import { PositionsTableSkeleton } from "./PositionsTableSkeleton";
import { SortableHead } from "./SortableHead";
import type {
	BasePositionItem,
	GroupByOption,
	PositionsDataTableProps,
	SortDirection,
	SortField,
	TableDensity,
	TableRowModel,
} from "./types";

const GROUP_ROW_ESTIMATE_COMPACT = 32;
const POSITION_ROW_ESTIMATE_COMPACT = 38;

const GROUP_ROW_ESTIMATE_NORMAL = 44;
const POSITION_ROW_ESTIMATE_NORMAL = 60;

const DEFAULT_GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	account: Wallet,
	asset: Layers,
	sector: PieChart,
	custody: Wallet,
	type: Wallet,
	none: PieChart,
};

// ==========================================
// Position Row Component
// ==========================================

interface GenericPositionRowProps<T extends BasePositionItem> {
	item: T;
	density?: TableDensity;
	dataIndex?: number;
	measureRef?: (node: Element | null) => void;
	formatCurrency: (val: number) => string;
	formatNumber: (val: number, decimals?: number) => string;
	formatQuantity?: (qty: number) => string;
	onSelectAsset?: (symbol: string, item: T) => void;
	onDeletePosition?: (item: T) => void;
	onRefreshPrice?: (item: T) => void;
	renderInstrumentIcon?: (item: T) => React.ReactNode;
	renderBadges?: (item: T) => React.ReactNode;
	renderCostBasisExtra?: (item: T) => React.ReactNode;
	renderTrend?: (item: T) => React.ReactNode;
	renderActions?: (item: T) => React.ReactNode;
	isFocused?: boolean;
}

const GenericPositionRow = memo(function GenericPositionRow<T extends BasePositionItem>({
	item,
	density = "compact",
	dataIndex,
	measureRef,
	formatCurrency,
	formatNumber,
	formatQuantity,
	onSelectAsset,
	onDeletePosition,
	onRefreshPrice,
	renderInstrumentIcon,
	renderBadges,
	renderCostBasisExtra,
	renderTrend,
	renderActions,
	isFocused,
}: GenericPositionRowProps<T>) {
	const isPriceResolved = item.isPriceResolved ?? item.currentPrice > 0;
	const hasDayChange = item.hasDayChange ?? typeof item.dayChange === "number";
	const dayChange = item.dayChange ?? 0;
	const dayChangeAmount = item.dayChangeAmount ?? 0;
	const weight = item.weight ?? 0;
	const isCompact = density === "compact";

	return (
		<TableRow
			key={item.id}
			ref={measureRef as React.Ref<HTMLTableRowElement>}
			data-index={dataIndex}
			className={cn(
				"group hover:bg-muted/5 border-border/40 transition-colors data-[state=selected]:bg-muted",
				isFocused && "bg-muted/20 ring-1 ring-inset ring-primary/40",
			)}
		>
			{/* Status color indicator bar */}
			<TableCell className={cn(isCompact ? "py-1.5 pl-2.5 sm:pl-3 w-[20px]" : "py-3 pl-3 w-[24px]")}>
				<div
					aria-hidden
					className={cn(
						"w-1 rounded-full",
						isCompact ? "h-5" : "h-9",
						!isPriceResolved
							? "bg-muted-foreground/30"
							: item.pl === null
								? "bg-warning"
								: item.pl >= 0
									? "bg-gain"
									: "bg-loss",
					)}
				/>
			</TableCell>

			{/* Instrument cell */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 w-[140px] sm:w-[210px]" : "py-3 px-3 w-[140px] sm:w-[210px]")}>
				<div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3")}>
					{renderInstrumentIcon && (
						<div className="flex-shrink-0">{renderInstrumentIcon(item)}</div>
					)}
					<div className={cn("flex flex-col min-w-0", isCompact ? "gap-0" : "gap-0.5")}>
						<div className="flex items-center gap-1.5 flex-nowrap">
							<button
								type="button"
								className="flex items-center gap-1.5 cursor-pointer hover:underline text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm min-w-0"
								onClick={() => onSelectAsset?.(item.symbol, item)}
							>
								<span className={cn("font-bold tracking-tight truncate", isCompact ? "text-xs sm:text-sm leading-tight" : "text-sm")}>{item.symbol}</span>
							</button>
							{!isPriceResolved && (
								<span
									className="inline-flex items-center h-4 px-1.5 py-0 text-micro font-medium tracking-wide uppercase border border-border/50 bg-muted/50 text-muted-foreground rounded flex-shrink-0"
									title="No active market trading pair available"
								>
									Unlisted
								</span>
							)}
							{renderBadges && (
								<div className="flex items-center gap-1 flex-shrink-0">
									{renderBadges(item)}
								</div>
							)}
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<span
									className={cn("truncate text-micro text-muted-foreground leading-tight", isCompact ? "max-w-[130px] sm:max-w-[160px]" : "max-w-[160px]")}
									tabIndex={-1}
								>
									{item.name}
								</span>
							</TooltipTrigger>
							<TooltipContent className="max-w-64">
								<span className="text-xs break-words">{item.name}</span>
							</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</TableCell>

			{/* Price */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right font-mono text-xs sm:text-sm font-medium tabular-nums" : "py-3 px-3 text-right font-mono text-sm tabular-nums")}>
				{isPriceResolved ? formatCurrency(item.currentPrice) : "—"}
			</TableCell>

			{/* Day Change */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right" : "py-3 px-3 text-right")}>
				{isPriceResolved && hasDayChange ? (
					<div className="flex flex-col items-end leading-tight">
						<div
							className={cn(
								"inline-flex items-center font-mono text-xs font-semibold tabular-nums",
								dayChange >= 0 ? "text-gain" : "text-loss",
							)}
						>
							{dayChange >= 0 ? "+" : ""}
							{formatCurrency(dayChangeAmount)}
						</div>
						<span
							className={cn(
								"text-micro font-mono tabular-nums",
								dayChange >= 0 ? "text-gain-muted" : "text-loss-muted",
							)}
						>
							{dayChange >= 0 ? "+" : ""}
							{dayChange.toFixed(2)}%
						</span>
					</div>
				) : (
					<span className="text-muted-foreground">—</span>
				)}
			</TableCell>

			{/* Optional Trend Column (adjacent to Day Change) */}
			{renderTrend && (
				<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right hidden lg:table-cell" : "py-3 px-3 text-right hidden lg:table-cell")}>
					<div className={cn("ml-auto flex justify-end", isCompact ? "w-[80px]" : "w-[90px]")}>{renderTrend(item)}</div>
				</TableCell>
			)}

			{/* Quantity */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right font-mono text-xs sm:text-sm text-muted-foreground tabular-nums hidden sm:table-cell" : "py-3 px-3 text-right font-mono text-sm text-muted-foreground tabular-nums hidden sm:table-cell")}>
				{formatQuantity
					? formatQuantity(item.quantity)
					: formatNumber(item.quantity, item.quantity % 1 === 0 ? 0 : 4)}
			</TableCell>

			{/* Avg Cost & Basis */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right hidden sm:table-cell" : "py-3 px-3 text-right hidden sm:table-cell")}>
				<div className="flex flex-col items-end leading-tight">
					<span className={cn("font-mono text-foreground font-medium tabular-nums", isCompact ? "text-xs sm:text-sm" : "text-sm")}>
						{item.avgPrice > 0 ? formatCurrency(item.avgPrice) : "—"}
					</span>
					{renderCostBasisExtra ? (
						renderCostBasisExtra(item) || (
							<span className="text-micro text-muted-foreground font-mono tabular-nums">
								Cost: {formatCurrency(item.cost)}
							</span>
						)
					) : (
						<span className="text-micro text-muted-foreground font-mono tabular-nums">
							Cost: {formatCurrency(item.cost)}
						</span>
					)}
				</div>
			</TableCell>

			{/* Total Value */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right font-mono text-xs sm:text-sm font-medium tabular-nums" : "py-3 px-3 text-right font-mono text-sm font-medium tabular-nums")}>
				{isPriceResolved ? formatCurrency(item.value) : "—"}
			</TableCell>

			{/* Total P&L */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right" : "py-3 px-3 text-right")}>
				{isPriceResolved && item.pl !== null ? (
					<div className="flex flex-col items-end leading-tight">
						<span
							className={cn(
								"font-mono font-semibold tabular-nums",
								isCompact ? "text-xs sm:text-sm" : "text-sm",
								item.pl >= 0 ? "text-gain" : "text-loss",
							)}
						>
							{item.pl >= 0 ? "+" : ""}
							{formatCurrency(item.pl)}
						</span>
						<span
							className={cn(
								"text-micro font-mono tabular-nums",
								item.plPercent >= 0 ? "text-gain-muted" : "text-loss-muted",
							)}
						>
							{item.plPercent >= 0 ? "+" : ""}
							{item.plPercent.toFixed(2)}%
						</span>
					</div>
				) : (
					<div className="flex flex-col items-end">
						<span className="text-muted-foreground font-mono text-xs sm:text-sm">—</span>
					</div>
				)}
			</TableCell>

			{/* Weight */}
			<TableCell className={cn(isCompact ? "py-1.5 px-2 text-right hidden md:table-cell" : "py-3 px-3 text-right hidden md:table-cell")}>
				<div className="flex items-center justify-end gap-1.5">
					<span className="font-mono text-xs font-medium text-foreground tabular-nums">
						{weight.toFixed(1)}%
					</span>
					<div className={cn("bg-secondary/50 rounded-full overflow-hidden flex-shrink-0", isCompact ? "w-8 h-1" : "w-10 h-1.5")}>
						<div
							className="h-full w-full bg-primary/70 rounded-full origin-right transition-transform duration-300"
							style={{ transform: `scaleX(${Math.min(100, Math.max(3, weight)) / 100})` }}
						/>
					</div>
				</div>
			</TableCell>

			{/* Actions Cell */}
			<TableCell className={cn(isCompact ? "py-1.5 pr-2.5 pl-1 w-[36px]" : "py-3 pr-3 w-[44px]")}>
				{renderActions ? (
					renderActions(item)
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								aria-label={`Actions for ${item.symbol}`}
								className={cn(
									"min-h-[44px] min-w-[44px] md:min-h-0 p-0 cursor-pointer opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:opacity-100 touch-target",
									isCompact ? "md:h-7 md:w-7" : "md:h-8 md:w-8",
								)}
							>
								<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{onSelectAsset && (
								<DropdownMenuItem onClick={() => onSelectAsset(item.symbol, item)}>
									<Eye className="h-4 w-4 mr-2" />
									View Details
								</DropdownMenuItem>
							)}
							{!isPriceResolved && onRefreshPrice && (
								<DropdownMenuItem onClick={() => onRefreshPrice(item)}>
									<RefreshCw className="h-4 w-4 mr-2" />
									Refresh Price
								</DropdownMenuItem>
							)}
							{onDeletePosition && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive focus:bg-destructive/10"
										onClick={() => onDeletePosition(item)}
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Remove from Portfolio
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</TableCell>
		</TableRow>
	);
}) as <T extends BasePositionItem>(props: GenericPositionRowProps<T>) => React.ReactElement;

// ==========================================
// Group Header Row Component
// ==========================================

interface GenericGroupHeaderRowProps<T extends BasePositionItem> {
	row: Extract<TableRowModel<T>, { kind: "group" }>;
	columnCount: number;
	groupBy: string;
	groupByOptions?: GroupByOption<T>[];
	density?: TableDensity;
	dataIndex: number;
	measureRef?: (node: Element | null) => void;
	formatCurrency: (val: number) => string;
	onSelectAccount?: (name: string) => void;
	onToggleGroup?: (groupName: string) => void;
	renderGroupHeaderExtra?: (group: Extract<TableRowModel<T>, { kind: "group" }>) => React.ReactNode;
}

const GenericGroupHeaderRow = memo(function GenericGroupHeaderRow<T extends BasePositionItem>({
	row,
	columnCount,
	groupBy,
	groupByOptions,
	density = "compact",
	dataIndex,
	measureRef,
	formatCurrency,
	onSelectAccount,
	onToggleGroup,
	renderGroupHeaderExtra,
}: GenericGroupHeaderRowProps<T>) {
	const currentOption = groupByOptions?.find((opt) => opt.id === groupBy);
	const GroupIcon = currentOption?.icon || DEFAULT_GROUP_ICONS[groupBy] || PieChart;
	const isDefaultAccount = row.name === "Manual Entry";
	const isClickableAccount =
		Boolean(onSelectAccount) &&
		(row.isClickableAccount ?? (groupBy === "account" || currentOption?.isClickableAccount)) &&
		!isDefaultAccount;
	const isCompact = density === "compact";

	return (
		<TableRow
			ref={measureRef as React.Ref<HTMLTableRowElement>}
			data-index={dataIndex}
			className="border-border/40 hover:bg-muted/5 transition-colors bg-muted/20"
		>
			<TableCell colSpan={columnCount} className="p-0">
				<div
					className={cn(
						"flex w-full items-center justify-between",
						isCompact ? "pl-2.5 sm:pl-3 py-1.5" : "pl-3 py-3",
					)}
				>
					<div className="flex items-center gap-2 min-w-0 pr-2">
						<button
							type="button"
							onClick={() => onToggleGroup?.(row.name)}
							aria-expanded={!row.collapsed}
							className={cn(
								"flex items-center cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary rounded-sm min-w-0",
								isCompact ? "gap-2" : "gap-3",
							)}
						>
							<ChevronDown
								aria-hidden
								className={cn(
									"h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out shrink-0",
									row.collapsed ? "-rotate-90" : "rotate-0",
								)}
							/>
							<span
								className={cn(
									"flex items-center justify-center rounded-md bg-secondary flex-shrink-0",
									isCompact ? "h-6 w-6" : "h-7 w-7",
								)}
							>
								<GroupIcon
									className={cn(
										"text-muted-foreground",
										isCompact ? "h-3 w-3" : "h-3.5 w-3.5",
									)}
								/>
							</span>
							<span
								className={cn(
									"font-medium tracking-tight truncate",
									isCompact ? "text-xs sm:text-sm" : "text-sm",
								)}
							>
								{row.name}
							</span>
							<span
								className={cn(
									"inline-flex items-center px-1.5 py-0 text-micro font-normal text-muted-foreground border border-border/40 rounded flex-shrink-0",
									isCompact ? "h-4" : "h-5",
								)}
							>
								{row.count}
							</span>
						</button>
						{isClickableAccount && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onSelectAccount?.(row.name);
								}}
								className="inline-flex items-center gap-1 text-micro text-muted-foreground hover:text-foreground hover:underline ml-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary flex-shrink-0"
								title={`Open ${row.name}`}
							>
								<span>Open</span>
								<ExternalLink className="h-2.5 w-2.5" />
							</button>
						)}
					</div>

					<div className="flex items-center flex-shrink-0">
						{renderGroupHeaderExtra?.(row)}

						{/* Value column (matches w-[105px] px-2 text-right) */}
						<div
							className={cn(
								"w-[105px] px-2 text-right shrink-0",
								isCompact ? "text-xs sm:text-sm" : "text-sm",
							)}
						>
							<span
								className="font-mono font-semibold tabular-nums"
								title={`Total Value: ${formatCurrency(row.value)}`}
							>
								{formatCurrency(row.value)}
							</span>
						</div>

						{/* Total P&L column (matches w-[115px] px-2 text-right) */}
						<div
							className={cn(
								"w-[115px] px-2 text-right shrink-0",
								isCompact ? "text-xs sm:text-sm" : "text-sm",
							)}
						>
							{row.pl === null ? (
								<div className="flex flex-col items-end">
									<span className="text-muted-foreground font-mono font-medium text-xs sm:text-sm">
										—
									</span>
								</div>
							) : (
								<div
									className="flex flex-col items-end leading-tight"
									title={
										row.isPartialPl
											? `Partial P&L based on ${row.knownCostBasisCount} of ${row.count} assets with recorded cost basis`
											: `Total P&L: ${row.pl >= 0 ? "+" : ""}${formatCurrency(row.pl)}`
									}
								>
									<span
										className={cn(
											"font-mono font-semibold tabular-nums inline-flex items-center justify-end gap-0.5",
											row.pl >= 0 ? "text-gain" : "text-loss",
										)}
									>
										<span>{row.pl >= 0 ? "+" : ""}{formatCurrency(row.pl)}</span>
										{row.isPartialPl && (
											<span className="text-[10px] text-muted-foreground font-mono select-none" title="Partial">*</span>
										)}
									</span>
									{row.plPercent !== null && row.plPercent !== undefined && (
										<span
											className={cn(
												"text-micro font-mono tabular-nums inline-flex items-center justify-end gap-0.5",
												row.plPercent >= 0 ? "text-gain-muted" : "text-loss-muted",
											)}
										>
											<span>{row.plPercent >= 0 ? "+" : ""}{row.plPercent.toFixed(2)}%</span>
											{row.isPartialPl && (
												<span className="text-[9px] text-muted-foreground font-mono select-none" title="Partial">*</span>
											)}
										</span>
									)}
								</div>
							)}
						</div>

						{/* Weight column (matches w-[80px] px-2 text-right hidden md:flex) */}
						<div
							className={cn(
								"w-[80px] px-2 text-right shrink-0 hidden md:flex items-center justify-end gap-1.5",
								isCompact ? "text-xs sm:text-sm" : "text-sm",
							)}
						>
							<span className="font-mono text-xs font-semibold text-foreground tabular-nums">
								{(row.weight ?? 0).toFixed(1)}%
							</span>
							<div
								className={cn(
									"bg-secondary/50 rounded-full overflow-hidden flex-shrink-0",
									isCompact ? "w-8 h-1" : "w-10 h-1.5",
								)}
							>
								<div
									className="h-full w-full bg-primary/70 rounded-full origin-right transition-transform duration-300"
									style={{
										transform: `scaleX(${Math.min(100, Math.max(3, row.weight ?? 0)) / 100})`,
									}}
								/>
							</div>
						</div>

						{/* Actions column spacer (matches w-[36px] pr-2.5 pl-1 or w-[44px] pr-3) */}
						<div
							className={cn(
								"shrink-0",
								isCompact ? "w-[36px] pr-2.5 pl-1" : "w-[44px] pr-3",
							)}
							aria-hidden="true"
						/>
					</div>
				</div>
			</TableCell>
		</TableRow>
	);
}) as <T extends BasePositionItem>(props: GenericGroupHeaderRowProps<T>) => React.ReactElement;

// ==========================================
// Main Generic Table Component
// ==========================================

export function PositionsDataTable<T extends BasePositionItem>({
	positions,
	loading = false,
	defaultDensity = "compact",
	density: controlledDensity,
	onDensityChange,
	defaultGroupBy = "account",
	groupBy: controlledGroupBy,
	onGroupByChange,
	groupByOptions,
	defaultSortField = "value",
	sortField: controlledSortField,
	defaultSortDirection = "desc",
	sortDirection: controlledSortDirection,
	onSort: controlledOnSort,
	defaultSearchQuery = "",
	searchQuery: controlledSearchQuery,
	onSearchChange,
	searchPlaceholder = 'Search holdings... (Press "/" to focus)',
	searchFilter,
	externalFilter = null,
	onClearExternalFilter,
	toolbarExtra,
	renderInstrumentIcon,
	renderBadges,
	renderCostBasisExtra,
	renderTrend,
	renderActions,
	renderGroupHeaderExtra,
	formatCurrency: propFormatCurrency,
	formatNumber: propFormatNumber,
	formatQuantity,
	onSelectAsset,
	onSelectAccount,
	onDeletePosition,
	onRefreshPrice,
	csvFilename,
	csvHeaders,
	csvRowMapper,
	emptyMessage = "No holdings found matching the criteria.",
	focusedSymbol: propFocusedSymbol,
}: PositionsDataTableProps<T>) {
	// Density state (defaults to compact, persists in localStorage)
	const isControlledDensity = controlledDensity !== undefined;
	const [internalDensity, setInternalDensity] = useState<TableDensity>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem("sf_positions_table_density");
				if (saved === "compact" || saved === "normal") return saved;
			} catch {
				// ignore localStorage issues
			}
		}
		return controlledDensity ?? defaultDensity ?? "compact";
	});
	const density = isControlledDensity ? controlledDensity : internalDensity;
	const isCompact = density === "compact";

	const handleDensityChange = useCallback(
		(nextDensity: TableDensity) => {
			if (onDensityChange) onDensityChange(nextDensity);
			if (!isControlledDensity) {
				setInternalDensity(nextDensity);
				try {
					localStorage.setItem("sf_positions_table_density", nextDensity);
				} catch {
					// ignore
				}
			}
		},
		[onDensityChange, isControlledDensity],
	);

	// Internal vs controlled state
	const isControlledGroupBy = controlledGroupBy !== undefined && onGroupByChange !== undefined;
	const [internalGroupBy, setInternalGroupBy] = useState<string>(
		controlledGroupBy ?? defaultGroupBy ?? "account",
	);
	const groupBy = isControlledGroupBy ? controlledGroupBy : internalGroupBy;
	const handleGroupByChange = useCallback(
		(mode: string) => {
			if (onGroupByChange) onGroupByChange(mode);
			if (!isControlledGroupBy) setInternalGroupBy(mode);
		},
		[onGroupByChange, isControlledGroupBy],
	);

	const isControlledSort = controlledSortField !== undefined && controlledOnSort !== undefined;
	const [internalSortField, setInternalSortField] = useState<SortField>(
		controlledSortField ?? defaultSortField ?? "value",
	);
	const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(
		controlledSortDirection ?? defaultSortDirection ?? "desc",
	);
	const sortField = isControlledSort ? controlledSortField : internalSortField;
	const sortDirection = isControlledSort ? (controlledSortDirection ?? "desc") : internalSortDirection;

	const handleSort = useCallback(
		(field: SortField) => {
			if (controlledOnSort) {
				controlledOnSort(field);
				return;
			}
			setInternalSortField((currentField) => {
				if (currentField === field) {
					setInternalSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
					return field;
				}
				setInternalSortDirection("desc");
				return field;
			});
		},
		[controlledOnSort],
	);

	// Search state with debouncing
	const [rawSearchQuery, setRawSearchQuery] = useState(
		controlledSearchQuery ?? defaultSearchQuery ?? "",
	);
	const [searchQuery, setSearchQuery] = useState(
		controlledSearchQuery ?? defaultSearchQuery ?? "",
	);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setRawSearchQuery(value);
			if (onSearchChange) onSearchChange(value);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => setSearchQuery(value), 150);
		},
		[onSearchChange],
	);

	useEffect(() => {
		if (controlledSearchQuery !== undefined) {
			setRawSearchQuery(controlledSearchQuery);
			setSearchQuery(controlledSearchQuery);
		}
	}, [controlledSearchQuery]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	// Focused row for keyboard navigation
	const [internalFocusedSymbol, setInternalFocusedSymbol] = useState<string | null>(null);
	const focusedSymbol = propFocusedSymbol ?? internalFocusedSymbol;

	// Number & Currency formatting fallbacks
	const formatCurrency = useCallback(
		(val: number) => {
			if (propFormatCurrency) return propFormatCurrency(val);
			return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
		},
		[propFormatCurrency],
	);

	const formatNumber = useCallback(
		(num: number, decimals = 2) => {
			if (propFormatNumber) return propFormatNumber(num, decimals);
			return num.toLocaleString("en-US", {
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals,
			});
		},
		[propFormatNumber],
	);

	// Filtering & Sorting
	const filteredPositions = useMemo(() => {
		let result = positions;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter((p) => {
				if (searchFilter) return searchFilter(p, q);
				return (
					p.symbol.toLowerCase().includes(q) ||
					p.name.toLowerCase().includes(q) ||
					p.account.toLowerCase().includes(q)
				);
			});
		}

		if (externalFilter) {
			result = result.filter((p) => {
				if (externalFilter.mode === "sector") {
					const record = p as Record<string, unknown>;
					const sector = typeof record.sector === "string" ? record.sector : "";
					if (externalFilter.value === "Needs metadata" || externalFilter.value === "Unclassified") {
						return (
							sector === "Needs metadata" ||
							sector === "Other" ||
							sector === "Unclassified" ||
							!sector
						);
					}
					return sector === externalFilter.value;
				}
				if (externalFilter.mode === "asset") {
					return p.symbol === externalFilter.value;
				}
				return true;
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
					diff = (a.dayChange ?? 0) - (b.dayChange ?? 0);
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
					diff = (a.weight ?? 0) - (b.weight ?? 0);
					break;
				case "pl":
					if (a.pl === null || b.pl === null) {
						return sortDirection === "asc"
							? (a.pl === null ? 1 : 0) - (b.pl === null ? 1 : 0)
							: (b.pl === null ? 1 : 0) - (a.pl === null ? 1 : 0);
					}
					diff = a.pl - b.pl;
					break;
				default:
					diff = 0;
					break;
			}
			return sortDirection === "asc" ? diff : -diff;
		});
	}, [positions, searchQuery, searchFilter, externalFilter, sortField, sortDirection]);

	// Grouping Logic
	const activeGroupOption = useMemo(
		() => groupByOptions?.find((opt) => opt.id === groupBy),
		[groupByOptions, groupBy],
	);

	const groupedData = useMemo(() => {
		if (groupBy === "none") return null;

		const groups: Record<string, T[]> = {};

		filteredPositions.forEach((pos) => {
			let key = "Other";
			if (activeGroupOption) {
				key = activeGroupOption.getGroupKey(pos);
			} else if (groupBy === "account") {
				key = pos.account;
			} else if (groupBy === "asset") {
				key = pos.symbol;
			} else {
				const record = pos as Record<string, unknown>;
				if (typeof record[groupBy] === "string") {
					key = record[groupBy] as string;
				}
			}

			if (!groups[key]) groups[key] = [];
			groups[key].push(pos);
		});

		return groups;
	}, [filteredPositions, groupBy, activeGroupOption]);

	// Collapsed state
	const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
		() => new Set<string>(),
	);

	const toggleGroupCollapsed = useCallback((groupName: string) => {
		setCollapsedGroups((previous) => {
			const next = new Set(previous);
			if (next.has(groupName)) next.delete(groupName);
			else next.add(groupName);
			return next;
		});
	}, []);

	// Flattened stream for virtualizer
	const tableRows = useMemo<TableRowModel<T>[]>(() => {
		if (groupBy === "none" || !groupedData) {
			return filteredPositions.map((pos) => ({ kind: "position", key: pos.id, item: pos }));
		}

		const rows: TableRowModel<T>[] = [];
		for (const [groupName, groupItems] of Object.entries(groupedData)) {
			const collapsed = collapsedGroups.has(groupName);
			const itemsWithPl = groupItems.filter((p) => p.pl !== null);
			const totalCost = itemsWithPl.reduce((sum, p) => sum + (p.cost > 0 ? p.cost : 0), 0);
			const totalPl = itemsWithPl.length > 0 ? itemsWithPl.reduce((sum, p) => sum + (p.pl ?? 0), 0) : null;
			const plPercent = totalPl !== null && totalCost > 0 ? (totalPl / totalCost) * 100 : null;
			const groupWeight = groupItems.reduce((sum, p) => sum + (p.weight ?? 0), 0);
			const isPartialPl = itemsWithPl.length > 0 && itemsWithPl.length < groupItems.length;

			rows.push({
				kind: "group",
				key: `group:${groupName}`,
				name: groupName,
				count: groupItems.length,
				value: groupItems.reduce((sum, p) => sum + p.value, 0),
				pl: totalPl,
				plPercent,
				weight: groupWeight,
				isPartialPl,
				knownCostBasisCount: itemsWithPl.length,
				collapsed,
				items: groupItems,
				isClickableAccount: activeGroupOption?.isClickableAccount ?? groupBy === "account",
			});
			if (collapsed) continue;
			for (const pos of groupItems) {
				rows.push({ kind: "position", key: pos.id, item: pos });
			}
		}
		return rows;
	}, [groupBy, groupedData, filteredPositions, collapsedGroups, activeGroupOption]);

	// Virtualizer setup
	const tableContainerRef = useRef<HTMLDivElement>(null);
	const groupRowEstimate = isCompact ? GROUP_ROW_ESTIMATE_COMPACT : GROUP_ROW_ESTIMATE_NORMAL;
	const positionRowEstimate = isCompact ? POSITION_ROW_ESTIMATE_COMPACT : POSITION_ROW_ESTIMATE_NORMAL;
	const rowVirtualizer = useVirtualizer({
		count: tableRows.length,
		getScrollElement: () => tableContainerRef.current,
		estimateSize: (index) =>
			tableRows[index]?.kind === "group" ? groupRowEstimate : positionRowEstimate,
		overscan: 8,
	});

	// Bottom scroll indicator fade
	const [showBottomFade, setShowBottomFade] = useState(false);
	useEffect(() => {
		const el = tableContainerRef.current;
		if (!el) return;
		let rafId: number | null = null;
		const update = () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				const isFaded = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
				setShowBottomFade((prev) => (prev !== isFaded ? isFaded : prev));
			});
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		const table = el.querySelector("table");
		if (table) observer.observe(table);
		el.addEventListener("scroll", update, { passive: true });
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			observer.disconnect();
			el.removeEventListener("scroll", update);
		};
	}, [tableRows.length]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			const activeTag = document.activeElement?.tagName.toLowerCase();
			const isInputActive =
				activeTag === "input" || activeTag === "textarea" || activeTag === "select";

			if (e.key === "/" && !isInputActive) {
				e.preventDefault();
				searchInputRef.current?.focus();
				return;
			}

			if (e.key === "Escape") {
				if (isInputActive) {
					(document.activeElement as HTMLElement)?.blur();
				}
				setInternalFocusedSymbol(null);
				return;
			}

			if (!isInputActive && filteredPositions.length > 0) {
				if (e.key === "j" || e.key === "ArrowDown") {
					e.preventDefault();
					setInternalFocusedSymbol((curr) => {
						const currIdx = curr ? filteredPositions.findIndex((p) => p.symbol === curr) : -1;
						const nextIdx = Math.min(filteredPositions.length - 1, currIdx + 1);
						return filteredPositions[nextIdx]?.symbol ?? null;
					});
				} else if (e.key === "k" || e.key === "ArrowUp") {
					e.preventDefault();
					setInternalFocusedSymbol((curr) => {
						const currIdx = curr ? filteredPositions.findIndex((p) => p.symbol === curr) : 0;
						const prevIdx = Math.max(0, currIdx - 1);
						return filteredPositions[prevIdx]?.symbol ?? null;
					});
				} else if (e.key === "Enter" && focusedSymbol) {
					e.preventDefault();
					const found = filteredPositions.find((p) => p.symbol === focusedSymbol);
					if (found) onSelectAsset?.(focusedSymbol, found);
				}
			}
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [filteredPositions, focusedSymbol, onSelectAsset]);

	if (loading) {
		return <PositionsTableSkeleton hasTrendColumn={!!renderTrend} />;
	}

	const hasTrend = Boolean(renderTrend);
	const columnCount = hasTrend ? 11 : 10;
	const virtualItems = rowVirtualizer.getVirtualItems();
	const firstItem = virtualItems[0];
	const lastItem = virtualItems[virtualItems.length - 1];
	const padTop = firstItem ? firstItem.start : 0;
	const padBottom = lastItem ? Math.max(0, rowVirtualizer.getTotalSize() - lastItem.end) : 0;

	// Available grouping modes
	const defaultOptions: GroupByOption<T>[] = [
		{ id: "account", label: "Account", icon: Wallet, getGroupKey: (p) => p.account, isClickableAccount: true },
		{ id: "asset", label: "Asset", icon: Layers, getGroupKey: (p) => p.symbol },
		{ id: "none", label: "None", icon: PieChart, getGroupKey: () => "All" },
	];
	const effectiveGroupOptions = groupByOptions || defaultOptions;

	return (
		<TooltipProvider delayDuration={200}>
			<div className="border border-border/60 rounded-lg overflow-hidden bg-card/80">
				{/* Toolbar */}
				<div className="flex flex-col justify-between gap-2.5 border-b border-border/40 bg-muted/5 px-3 py-2.5 sm:px-4 sm:py-2.5 lg:flex-row lg:items-center">
					<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
						<SearchInput
							ref={searchInputRef}
							placeholder={searchPlaceholder}
							value={rawSearchQuery}
							onChange={handleSearchChange}
							onClear={() => {
								setRawSearchQuery("");
								setSearchQuery("");
								onSearchChange?.("");
							}}
							size="sm"
							containerClassName="w-full lg:w-64"
							className="h-10 md:h-8 text-sm md:text-xs bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/20 touch-target"
						/>

						{/* Quick Sort Dropdown Menu */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									aria-label="Change sort metric and direction"
									className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-8 md:w-8 p-0 border-border/50 touch-target cursor-pointer"
								>
									<SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-48">
								<DropdownMenuLabel className="text-xs">Sort Metric</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={sortField === "value"}
									onCheckedChange={() => handleSort("value")}
								>
									Highest Value
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "weight"}
									onCheckedChange={() => handleSort("weight")}
								>
									Highest Weight %
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "pl" && sortDirection === "desc"}
									onCheckedChange={() => handleSort("pl")}
								>
									Highest Gain
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "pl" && sortDirection === "asc"}
									onCheckedChange={() => handleSort("pl")}
								>
									Highest Loss
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sortField === "dayChange"}
									onCheckedChange={() => handleSort("dayChange")}
								>
									Day Change %
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Row Density Toggle Button */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									aria-label={density === "compact" ? "Switch to normal density" : "Switch to compact density"}
									onClick={() => handleDensityChange(density === "compact" ? "normal" : "compact")}
									className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-8 md:w-8 p-0 border-border/50 touch-target cursor-pointer"
								>
									{density === "compact" ? (
										<FoldVertical className="h-3.5 w-3.5 text-muted-foreground" />
									) : (
										<UnfoldVertical className="h-3.5 w-3.5 text-muted-foreground" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">
								<span className="text-xs">
									{density === "compact" ? "Density: Compact (click for normal)" : "Density: Normal (click for compact)"}
								</span>
							</TooltipContent>
						</Tooltip>

						{/* Export CSV button */}
						<Button
							variant="outline"
							size="sm"
							className="min-h-[44px] md:min-h-0 md:h-8 gap-1.5 border-border/50 text-xs text-muted-foreground hover:text-foreground cursor-pointer touch-target"
							onClick={() =>
								exportPositionsToCSV(filteredPositions, {
									filename: csvFilename,
									headers: csvHeaders,
									rowMapper: csvRowMapper,
								})
							}
							title="Export current positions table to CSV"
							aria-label="Export holdings as CSV"
						>
							<Download className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Export CSV</span>
						</Button>

						{/* Custom Toolbar Extra Slot (e.g. Account Filter, Hide <$1 switch) */}
						{toolbarExtra}
					</div>

					{/* Right section: External filter badge & Group By toggle */}
					<div className="flex w-full flex-wrap items-center justify-between gap-2.5 lg:w-auto lg:flex-nowrap lg:justify-end">
						{externalFilter && (
							<div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-micro">
								<span className="uppercase text-muted-foreground font-semibold">
									Filter: {externalFilter.label || externalFilter.mode || "Active"}
								</span>
								<span className="font-bold text-primary">{externalFilter.value}</span>
								<span className="text-muted-foreground">
									({filteredPositions.length} holding{filteredPositions.length !== 1 ? "s" : ""})
								</span>
								<Button
									variant="ghost"
									size="sm"
									className="h-4.5 px-1.5 text-micro hover:bg-primary/20 text-foreground cursor-pointer"
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

						<div
							className="flex rounded-lg bg-muted p-0.5"
							role="group"
							aria-labelledby="positions-group-by-label"
						>
							{effectiveGroupOptions.map((opt) => (
								<button
									type="button"
									key={opt.id}
									onClick={() => handleGroupByChange(opt.id)}
									aria-pressed={groupBy === opt.id}
									className={cn(
										"rounded-md px-2.5 py-1 text-micro font-medium transition-all cursor-pointer min-h-[44px] md:min-h-[28px] touch-target focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
										groupBy === opt.id
											? "bg-background shadow-xs text-foreground"
											: "text-foreground/70 hover:text-foreground",
									)}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Table Container */}
				<div className="min-h-[400px] bg-background">
					{tableRows.length === 0 ? (
						<div className="py-12 text-center text-xs text-muted-foreground">
							{emptyMessage}
						</div>
					) : (
						<div ref={tableContainerRef} className="overflow-auto max-h-[640px]">
							<Table>
								<TableHeader className="sticky top-0 z-10 bg-muted/95">
									<TableRow className="hover:bg-transparent border-border/50">
										<TableHead className={cn(isCompact ? "w-[20px] h-8 p-0" : "w-[30px] h-10 p-0")} />
										<SortableHead
											label="Instrument"
											field="symbol"
											className="w-[140px] sm:w-[210px]"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<SortableHead
											label="Price"
											field="price"
											className="w-[90px] text-right"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<SortableHead
											label="Change (1D)"
											field="dayChange"
											className="w-[105px] text-right"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										{hasTrend && (
											<TableHead
												className={cn(
													"w-[90px] text-right hidden lg:table-cell font-semibold",
													isCompact ? "h-8 text-xs px-2" : "h-10 text-xs px-2",
												)}
											>
												Trend (7D)
											</TableHead>
										)}
										<SortableHead
											label="Quantity"
											field="quantity"
											className="w-[75px] text-right hidden sm:table-cell"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<SortableHead
											label="Avg Cost & Basis"
											field="avgPrice"
											className="w-[110px] text-right hidden sm:table-cell"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<SortableHead
											label="Value"
											field="value"
											className="w-[105px] text-right"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<SortableHead
											label="Total P&L"
											field="pl"
											className="w-[115px] text-right"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<SortableHead
											label="Weight"
											field="weight"
											className="w-[80px] text-right hidden md:table-cell"
											align="right"
											sortField={sortField}
											sortDirection={sortDirection}
											onSort={handleSort}
											density={density}
										/>
										<TableHead className={cn(isCompact ? "w-[36px] h-8 p-0" : "w-[44px] h-10 p-0")} />
									</TableRow>
								</TableHeader>
								<TableBody>
									{padTop > 0 && (
										<tr>
											<td colSpan={columnCount} style={{ padding: 0, height: `${padTop}px` }} />
										</tr>
									)}
									{virtualItems.map((virtualRow) => {
										const row = tableRows[virtualRow.index];
										if (!row) return null;
										if (row.kind === "group") {
											return (
												<GenericGroupHeaderRow
													key={row.key}
													row={row}
													columnCount={columnCount}
													groupBy={groupBy}
													groupByOptions={groupByOptions}
													density={density}
													dataIndex={virtualRow.index}
													measureRef={rowVirtualizer.measureElement}
													formatCurrency={formatCurrency}
													onSelectAccount={onSelectAccount}
													onToggleGroup={toggleGroupCollapsed}
													renderGroupHeaderExtra={renderGroupHeaderExtra}
												/>
											);
										}
										return (
											<GenericPositionRow
												key={row.key}
												item={row.item}
												density={density}
												dataIndex={virtualRow.index}
												measureRef={rowVirtualizer.measureElement}
												formatCurrency={formatCurrency}
												formatNumber={formatNumber}
												formatQuantity={formatQuantity}
												onSelectAsset={onSelectAsset}
												onDeletePosition={onDeletePosition}
												onRefreshPrice={onRefreshPrice}
												renderInstrumentIcon={renderInstrumentIcon}
												renderBadges={renderBadges}
												renderCostBasisExtra={renderCostBasisExtra}
												renderTrend={renderTrend}
												renderActions={renderActions}
												isFocused={focusedSymbol === row.item.symbol}
											/>
										);
									})}
									{padBottom > 0 && (
										<tr>
											<td
												colSpan={columnCount}
												style={{ padding: 0, height: `${padBottom}px` }}
											/>
										</tr>
									)}
								</TableBody>
							</Table>
							{showBottomFade && (
								<div
									aria-hidden
									className="pointer-events-none sticky bottom-0 -mt-8 h-8 bg-gradient-to-t from-background to-transparent"
								/>
							)}
						</div>
					)}
				</div>

				{/* Summary Footer */}
				<div
					className="flex items-center justify-between border-t border-border/40 bg-muted/5 px-3 py-2 sm:px-4 sm:py-2 text-micro sm:text-xs text-muted-foreground"
					aria-live="polite"
				>
					<div className="flex items-center gap-2 sm:gap-3">
						<span>
							Showing <strong className="text-foreground">{filteredPositions.length}</strong> of{" "}
							{positions.length} holdings
						</span>
						{searchQuery && (
							<span className="text-primary font-medium">(Filtered by "{searchQuery}")</span>
						)}
					</div>
					<div className="flex items-center gap-3 sm:gap-4">
						<span>
							Aggregated Value:{" "}
							<strong className="text-foreground font-mono tabular-nums">
								{formatCurrency(filteredPositions.reduce((sum, p) => sum + p.value, 0))}
							</strong>
						</span>
					</div>
				</div>
			</div>
		</TooltipProvider>
	);
}
