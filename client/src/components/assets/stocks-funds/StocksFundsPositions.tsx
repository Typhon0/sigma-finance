import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useQuery,
} from "@apollo/client";
import {
	Eye,
	Landmark,
	Layers,
	Lock,
	MoreHorizontal,
	PieChart,
	RefreshCw,
	Trash2,
	Wallet,
} from "lucide-react";
import type React from "react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type BasePositionItem,
	type GroupByOption,
	exportPositionsToCSV as genericExportCSV,
	PositionsDataTable,
	PositionsTableSkeleton,
} from "@/components/assets/positions-table";
import { usePortfolio } from "@/components/PortfolioProvider";
import { AssetLogo } from "@/components/shared/AssetLogo";
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
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { useCurrency } from "@/hooks/use-currency";
import { formatDate } from "@/lib/format";
import { formatAssetDisplayName } from "@/lib/format-asset-name";
import { allocatePercentages } from "@/lib/money/rounding";
import { cn } from "@/lib/utils";

export type GroupByMode = "account" | "exchange" | "asset" | "sector" | "none";

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
	exchange: string;
	assetClass: "ETFs/Funds" | "Stocks";
	isPriceResolved: boolean;
	hasDayChange: boolean;
	fx: FxResolution;
	accountId?: string;
	positionId?: string;
	isSynced?: boolean;
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
	onAddPositionToAccount?: (accountName: string) => void;
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
	onAddPositionToAccount,
}: StocksFundsPositionsProps) {
	const {
		assets,
		deleteAsset,
		currentPortfolio,
		refreshAssetPrice,
		refetch: refetchPortfolio,
	} = usePortfolio();

	const portfolioIdStr =
		typeof currentPortfolio === "string" ? currentPortfolio : ((currentPortfolio as any)?.id ?? "");

	// Safe Apollo context handling when rendered in tests without ApolloProvider
	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);
	const apolloClient = apolloContext?.client || fallbackClient;

	const { data: accountsData } = useQuery(GET_ACCOUNTS, {
		client: apolloClient,
		variables: { portfolioId: portfolioIdStr },
		skip: !portfolioIdStr,
		fetchPolicy: "cache-and-network",
		pollInterval: 5000,
	});

	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		assetId?: string;
		portfolioId: string;
		accountId?: string;
		accountName: string;
		symbol: string;
		name: string;
		isSynced?: boolean;
	} | null>(null);

	const { formatCurrency, currency: displayCurrency } = useCurrency();

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
			const resolvedValue = resolvePositionValue(
				asset.currentValue,
				rawCurrentPrice,
				quantity,
			).value;
			const currentPrice =
				resolvedValue > 0 && quantity > 0
					? resolvedValue / quantity
					: rawCurrentPrice > 0
						? rawCurrentPrice
						: 0;
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
			} else if (cost > 0 && resolvedValue > 0) {
				pl = resolvedValue - cost;
				plPercent = (pl / cost) * 100;
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

			const exchange =
				typeof rawAssetRecord.exchange === "string" && rawAssetRecord.exchange.trim().length > 0
					? (rawAssetRecord.exchange as string)
					: typeof asset.exchange === "string" && asset.exchange.trim().length > 0
						? asset.exchange
						: "Other Exchanges";

			const accountName =
				asset.account ||
				(typeof rawAssetRecord.account === "object" && rawAssetRecord.account !== null
					? (rawAssetRecord.account as { name?: string }).name
					: typeof rawAssetRecord.account === "string"
						? rawAssetRecord.account
						: null) ||
				asset.institution ||
				"Compte Principal";

			const accountId = asset.accountId || (rawAssetRecord.accountID as string | undefined);
			const isSynced =
				(
					accountsData?.accounts as
						| Array<{ id: string; syncProvider?: string; name: string }>
						| undefined
				)?.some(
					(acc) =>
						(acc.id === accountId || acc.name === accountName) &&
						acc.syncProvider &&
						acc.syncProvider !== "MANUAL",
				) || /trade republic/i.test(accountName);

			return {
				id: asset.id ? `${asset.id}-${accountName}-${index}` : `pos-${index}`,
				assetId: asset.id,
				portfolioId: asset.portfolioId || currentPortfolio,
				accountId,
				positionId: asset.positionId || (rawAssetRecord.positionID as string | undefined),
				isSynced: !!isSynced,
				symbol: asset.symbol || asset.name.substring(0, 4).toUpperCase(),
				name: formatAssetDisplayName(asset.name, asset.symbol),
				quantity,
				avgPrice: purchasePrice,
				currentPrice,
				value: resolvedValue,
				cost,
				pl,
				plPercent,
				currency: asset.currency || fx.quoteCurrency || fx.costBasisCurrency || "USD",
				account: accountName,
				exchange,
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

	const knownAccountGroups = useMemo(() => {
		const rawAccounts = (accountsData?.accounts || []) as Array<{
			id: string;
			name: string;
			type?: string;
			syncConnection?: { syncStatus?: string };
			totalValue?: number;
		}>;

		const accountsWithHoldings = new Set<string>(
			stocksAndFundsAssets.map((a) => String(a.account || a.institution || "Compte Principal")),
		);

		const relevantAccounts = rawAccounts.filter((acc) => {
			// Always include accounts with active stock/fund positions
			if (accountsWithHoldings.has(acc.name)) return true;
			// Only include broker accounts if they are actively syncing
			if (acc.type === "BROKER" && acc.syncConnection?.syncStatus === "SYNCING") return true;
			return false;
		});

		if (relevantAccounts.length === 0) {
			return Array.from(accountsWithHoldings).map((name) => ({ name }));
		}

		return relevantAccounts.map((acc) => ({
			id: acc.id,
			name: acc.name,
			syncStatus: acc.syncConnection?.syncStatus,
			totalValue: acc.totalValue,
		}));
	}, [accountsData?.accounts, stocksAndFundsAssets]);

	const hasSyncingAccount = useMemo(
		() =>
			(
				accountsData?.accounts as Array<{ syncConnection?: { syncStatus?: string } }> | undefined
			)?.some((acc) => acc.syncConnection?.syncStatus === "SYNCING"),
		[accountsData?.accounts],
	);

	const prevSyncingRef = useRef(hasSyncingAccount);
	useEffect(() => {
		if (prevSyncingRef.current && !hasSyncingAccount) {
			refetchPortfolio?.();
		}
		prevSyncingRef.current = hasSyncingAccount;
	}, [hasSyncingAccount, refetchPortfolio]);

	const handleDeletePosition = useCallback(
		(pos: PositionItem) => {
			setDeleteTarget({
				id: pos.id,
				assetId: pos.assetId,
				portfolioId: pos.portfolioId || currentPortfolio,
				accountId: pos.accountId,
				accountName: pos.account,
				symbol: pos.symbol,
				name: pos.name,
				isSynced: pos.isSynced,
			});
		},
		[currentPortfolio],
	);

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
				id: "exchange",
				label: "Exchange",
				icon: Landmark,
				getGroupKey: (p) => p.exchange,
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
					pos.currency !== displayCurrency &&
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
						{pos.isSynced ? (
							<DropdownMenuItem
								disabled
								className="text-muted-foreground opacity-60 cursor-not-allowed"
								title={`Géré par la synchronisation ${pos.account}`}
							>
								<Lock className="h-4 w-4 mr-2" />
								Synchronized ({pos.account})
							</DropdownMenuItem>
						) : (
							<DropdownMenuItem
								className="text-destructive focus:text-destructive focus:bg-destructive/10"
								onClick={() => handleDeletePosition(pos)}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Remove from {pos.account}
							</DropdownMenuItem>
						)}
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
				knownAccountGroups={knownAccountGroups}
				onAddPositionToAccount={onAddPositionToAccount}
				onDeletePosition={handleDeletePosition}
				onRefreshPrice={handleRefreshPrice}
				formatCurrency={formatCurrency}
				formatNumber={formatNumber}
			/>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remove from {deleteTarget?.accountName || "Account"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove <strong>{deleteTarget?.symbol}</strong> (
							{deleteTarget?.name}) from <strong>{deleteTarget?.accountName}</strong>? Other
							accounts holding this asset will not be affected.
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
											deleteTarget.accountId,
										);
										toast.success(
											`${deleteTarget.symbol} removed from ${deleteTarget.accountName}`,
										);
									} catch {
										toast.error(`Failed to remove asset from ${deleteTarget.accountName}`);
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
