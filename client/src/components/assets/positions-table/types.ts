import type React from "react";

export interface BasePositionItem {
	id: string;
	assetId?: string;
	portfolioId?: string;
	symbol: string;
	name: string;
	quantity: number;
	avgPrice: number;
	currentPrice: number;
	value: number;
	cost: number;
	pl: number | null;
	plPercent: number;
	currency?: string;
	account: string;
	dayChange?: number;
	dayChangeAmount?: number;
	weight?: number;
	isPriceResolved?: boolean;
	hasDayChange?: boolean;
}

export type SortDirection = "asc" | "desc";

export type TableDensity = "compact" | "normal";

export type StandardSortField =
	| "symbol"
	| "price"
	| "dayChange"
	| "quantity"
	| "avgPrice"
	| "value"
	| "weight"
	| "pl";

export type SortField = StandardSortField | (string & {});

export interface GroupByOption<T> {
	id: string;
	label: string;
	icon?: React.ComponentType<{ className?: string }>;
	getGroupKey: (item: T) => string;
	isClickableAccount?: boolean;
}

export type TableRowModel<T> =
	| {
			kind: "group";
			key: string;
			name: string;
			count: number;
			value: number;
			pl: number | null;
			plPercent?: number | null;
			weight?: number;
			isPartialPl?: boolean;
			knownCostBasisCount?: number;
			collapsed: boolean;
			items: T[];
			isClickableAccount?: boolean;
	  }
	| {
			kind: "position";
			key: string;
			item: T;
	  };

export interface PositionsDataTableProps<T extends BasePositionItem> {
	positions: T[];
	loading?: boolean;
	defaultDensity?: TableDensity;
	density?: TableDensity;
	onDensityChange?: (density: TableDensity) => void;
	defaultGroupBy?: string;
	groupBy?: string;
	onGroupByChange?: (mode: string) => void;
	groupByOptions?: GroupByOption<T>[];
	defaultSortField?: SortField;
	sortField?: SortField;
	defaultSortDirection?: SortDirection;
	sortDirection?: SortDirection;
	onSort?: (field: SortField) => void;
	defaultSearchQuery?: string;
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
	searchPlaceholder?: string;
	searchFilter?: (item: T, query: string) => boolean;
	externalFilter?: {
		mode?: string;
		label?: string;
		value: string;
		count?: number;
	} | null;
	onClearExternalFilter?: () => void;
	toolbarExtra?: React.ReactNode;
	renderInstrumentIcon?: (item: T) => React.ReactNode;
	renderBadges?: (item: T) => React.ReactNode;
	renderCostBasisExtra?: (item: T) => React.ReactNode;
	renderTrend?: (item: T) => React.ReactNode;
	renderActions?: (item: T) => React.ReactNode;
	renderGroupHeaderExtra?: (group: Extract<TableRowModel<T>, { kind: "group" }>) => React.ReactNode;
	formatCurrency?: (val: number) => string;
	formatNumber?: (val: number, decimals?: number) => string;
	formatQuantity?: (qty: number) => string;
	onSelectAsset?: (symbol: string, item: T) => void;
	onSelectAccount?: (accountName: string) => void;
	onDeletePosition?: (item: T) => void;
	onRefreshPrice?: (item: T) => void;
	csvFilename?: string;
	csvHeaders?: string[];
	csvRowMapper?: (item: T) => (string | number | null | undefined)[];
	emptyMessage?: string;
	className?: string;
	focusedSymbol?: string | null;
}
