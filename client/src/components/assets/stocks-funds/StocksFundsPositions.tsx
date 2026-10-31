import { Eye, Layers, MoreHorizontal, PieChart, RefreshCw, Trash2, Wallet } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	exportPositionsToCSV as genericExportCSV,
	PositionsDataTable,
	PositionsTableSkeleton,
	type BasePositionItem,
	type GroupByOption,
} from "@/components/assets/positions-table";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Explained } from "@/components/shared/info-hint";
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
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/hooks/use-currency";
import { AssetLogo } from "@/components/shared/AssetLogo";
import { formatDate } from "@/lib/format";
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

export interface PositionItem extends BasePositionItem {
	sector: string;
	assetClass: "ETFs/Funds" | "Stocks";
	isPriceResolved: boolean;
	hasDayChange: boolean;
	fx: FxResolution;
}

export interface StocksFundsPositionsProps {
	onSelectAccount?: (accountName: string) => void;
	onSelectAsset?: (symbol: string) => void;
	externalFilter?: {
		mode: "sector" | "asset-class" | "type" | "asset";
		value: string;
	} | null;
	onClearExternalFilter?: () => void;
	loading?: boolean;
}

export function exportPositionsToCSV(positions: PositionItem[], filename?: string) {
	genericExportCSV(positions, { filename });
}

export { PositionsTableSkeleton };

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
		assetId?: string;
		portfolioId: string;
		symbol: string;
		name: string;
	} | null>(null);

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

			let pl: number | null = resolvedValue - cost;
			let plPercent = 0;
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
					: "Unclassified";

			const accountName =
				(typeof rawAssetRecord.account === "object" && rawAssetRecord.account !== null
					? (rawAssetRecord.account as { name?: string }).name
					: typeof rawAssetRecord.account === "string"
						? rawAssetRecord.account
						: null) ||
				(typeof asset.account === "string" ? asset.account : null) ||
				(typeof asset.institution === "string" ? asset.institution : null) ||
				"Main Account";

			return {
				id: asset.id ? `${asset.id}-${accountName}` : `pos-${index}`,
				assetId: asset.id,
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
				account: accountName,
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

	const handleDeletePosition = useCallback((pos: PositionItem) => {
		setDeleteTarget({
			id: pos.id,
			assetId: pos.assetId,
			portfolioId: pos.portfolioId || currentPortfolio,
			symbol: pos.symbol,
			name: pos.name,
		});
	}, [currentPortfolio]);

	const handleRefreshPrice = useCallback(
		async (pos: PositionItem) => {
			await refreshAssetPrice(pos.assetId || pos.id);
			toast.success(`Price refresh requested for ${pos.symbol}`);
		},
		[refreshAssetPrice],
	);

	// Grouping Options for Stocks & Funds
	const groupByOptions = useMemo<GroupByOption<PositionItem>[]>(
		() => [
			{
				id: "account",
				label: "Account",
				icon: Wallet,
				getGroupKey: (p) => p.account,
				isClickableAccount: true,
			},
			{
				id: "asset",
				label: "Asset",
				icon: Layers,
				getGroupKey: (p) => p.symbol,
			},
			{
				id: "sector",
				label: "Sector",
				icon: PieChart,
				getGroupKey: (p) => p.sector,
			},
			{
				id: "none",
				label: "None",
				icon: PieChart,
				getGroupKey: () => "All",
			},
		],
		[],
	);

	const renderBadges = useCallback((pos: PositionItem) => {
		return (
			<>
				{pos.isPriceResolved && pos.sector !== "Other" && (
					<Badge
						variant="outline"
						className={cn(
							"h-4 px-1.5 py-0 text-micro font-medium tracking-wide uppercase transition-all duration-300 flex-shrink-0",
							pos.sector === "Needs metadata" || pos.sector === "Unclassified"
								? "border-border/40 bg-muted/40 text-muted-foreground hover:bg-muted/60"
								: "border-border/40 text-muted-foreground",
						)}
					>
						{pos.sector}
					</Badge>
				)}
				{pos.currency &&
					pos.currency !== "USD" &&
					(!pos.fx.canShowPercentage ? (
						<Explained description={pos.fx.reason}>
							<Badge
								variant="secondary"
								className="h-4 px-1 py-0 text-micro font-mono uppercase bg-muted/60 text-muted-foreground flex-shrink-0"
							>
								{pos.currency}
							</Badge>
						</Explained>
					) : (
						<Badge
							variant="secondary"
							className="h-4 px-1 py-0 text-micro font-mono uppercase bg-muted/60 text-muted-foreground flex-shrink-0"
						>
							{pos.currency}
						</Badge>
					))}
				{pos.fx.isStale && (
					<Explained
						description={
							pos.fx.fxAsOf
								? `The FX rate used to value this position was last observed ${formatDate(pos.fx.fxAsOf)} and is considered stale.`
								: "The FX rate used to value this position is stale."
						}
					>
						<Badge
							variant="outline"
							className="h-4 px-1 py-0 text-micro font-mono uppercase border-warning/30 bg-warning/10 text-warning flex-shrink-0"
						>
							stale fx
						</Badge>
					</Explained>
				)}
			</>
		);
	}, []);

	const renderActions = useCallback(
		(pos: PositionItem) => {
			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-label={`Actions for ${pos.symbol}`}
							className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-7 md:w-7 p-0 cursor-pointer opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:opacity-100 touch-target"
						>
							<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onSelectAsset?.(pos.symbol)}>
							<Eye className="h-4 w-4 mr-2" />
							View Details
						</DropdownMenuItem>
						{!pos.isPriceResolved && (
							<DropdownMenuItem onClick={() => handleRefreshPrice(pos)}>
								<RefreshCw className="h-4 w-4 mr-2" />
								Refresh Price
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive focus:bg-destructive/10"
							onClick={() => handleDeletePosition(pos)}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Remove from Portfolio
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[onSelectAsset, handleRefreshPrice, handleDeletePosition],
	);

	const renderInstrumentIcon = useCallback(
		(pos: PositionItem) => (
			<AssetLogo
				symbol={pos.symbol}
				name={pos.name}
				assetType={pos.assetClass === "Stocks" ? "stock" : "fund"}
				size="sm"
			/>
		),
		[],
	);

	return (
		<>
			<PositionsDataTable<PositionItem>
				positions={positions}
				loading={loading}
				defaultGroupBy="account"
				groupByOptions={groupByOptions}
				externalFilter={externalFilter}
				onClearExternalFilter={onClearExternalFilter}
				renderInstrumentIcon={renderInstrumentIcon}
				renderBadges={renderBadges}
				renderActions={renderActions}
				onSelectAsset={(symbol) => onSelectAsset?.(symbol)}
				onSelectAccount={onSelectAccount}
				onDeletePosition={handleDeletePosition}
				onRefreshPrice={handleRefreshPrice}
				formatCurrency={formatCurrency}
				formatNumber={formatNumber}
			/>

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
										await deleteAsset(
											deleteTarget.assetId || deleteTarget.id,
											deleteTarget.portfolioId,
										);
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
		</>
	);
}
