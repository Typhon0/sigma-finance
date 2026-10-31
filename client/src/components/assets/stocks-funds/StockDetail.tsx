import { gql, useMutation, useQuery } from "@apollo/client";
import { ArrowLeft, Bell, ChevronDown, Loader2, Plus, Star } from "lucide-react";
import { lazy, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { PortfolioContext } from "@/components/PortfolioProvider";
import { AssetLogo } from "@/components/shared/AssetLogo";
import { Explained } from "@/components/shared/info-hint";
import type { Asset } from "@/components/stocks-funds/types";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type {
	AddAssetToWatchlistMutation,
	CreateAlertMutation,
	CreateWatchlistMutation,
	RemoveAssetFromWatchlistMutation,
} from "@/gql/graphql";
import { AlertNotificationMethod, AlertType, ConditionType } from "@/gql/graphql";
import {
	ADD_ASSET_TO_WATCHLIST,
	ALERT_RESULT_FRAGMENT,
	CREATE_ALERT,
	CREATE_WATCHLIST,
	REMOVE_ASSET_FROM_WATCHLIST,
} from "@/graphql/mutations";
import { GET_DASHBOARD_CRITICAL } from "@/graphql/queries/dashboard";
import { GET_DISPOSITIONS_BY_POSITION, GET_TAX_LOTS_BY_POSITION } from "@/graphql/queries/tax-lots";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { useMarketData } from "@/hooks/useMarketData";
import { getChartThemeColors } from "@/lib/chart-colors";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { resolveTradingViewSymbol } from "@/lib/resolve-trading-view-symbol";
import { LazyWidget, WidgetErrorFallback } from "./LazyWidget";
import { StockAboutSection } from "./StockAboutSection";
import { StockPerformanceBreakdown } from "./StockPerformanceBreakdown";
import { StockPositionSummaryBanner } from "./StockPositionSummaryBanner";
import { StockPriceHistoryTable } from "./StockPriceHistoryTable";
import type { TaxLotDispositionItem, TaxLotItem } from "./TaxLotsTab";
import { TaxLotsTab } from "./TaxLotsTab";

// Lazy-load heavy TradingView widgets only when their disclosure opens.
const AdvancedRealTimeChart = lazy(() =>
	import("@/components/tradingview").then((m) => ({ default: m.AdvancedRealTimeChart })),
);
const FundamentalData = lazy(() =>
	import("@/components/tradingview").then((m) => ({ default: m.FundamentalData })),
);
const TechnicalAnalysis = lazy(() =>
	import("@/components/tradingview").then((m) => ({ default: m.TechnicalAnalysis })),
);
const Timeline = lazy(() =>
	import("@/components/tradingview").then((m) => ({ default: m.Timeline })),
);

// SymbolInfo is lightweight — keep it eager
import { SymbolInfo } from "@/components/tradingview";

const roundToCents = (value: number) => Math.round(value * 100) / 100;

export interface StockDetailProps {
	symbol: string;
	/**
	 * Normalized position from StocksFundsModule — the single source of truth
	 * for value, cost basis, P&L, weight and FX status. Absent when the panel
	 * is rendered without a portfolio position.
	 */
	position?: Asset | null;
	positionId?: string;
	currentPrice?: number;
	currency?: string;
	onBack?: () => void;
	onTrade?: () => void;
	/**
	 * Closes this sheet and switches the module to its Transactions surface.
	 * The empty Tax Lots state links here: "record transactions" must be an
	 * action, not a hint to remember a hidden tab.
	 */
	onNavigateToTransactions?: () => void;
	/**
	 * Promotes the alert footnote from text to a real affordance. No routed
	 * alerts surface exists in the app yet — the backend `alerts` query does,
	 * the client page does not — so unwired render sites say only what is
	 * true: the alert is stored with the portfolio. When a destination is
	 * actually reachable, wire this on the Dashboard/module render site.
	 */
	onNavigateToAlerts?: () => void;
}

export function StockDetail({
	symbol,
	position,
	positionId,
	currentPrice,
	currency,
	onBack,
	onTrade,
	onNavigateToTransactions,
	onNavigateToAlerts,
}: StockDetailProps) {
	// Same trap as the distribution widget: `theme` is "system" unless the user
	// forced a mode, which resolved to the light TradingView palette on a dark UI.
	// Check both resolvedTheme and document dark class to guarantee dark widgets.
	const { resolvedTheme } = useTheme();
	const isDark =
		resolvedTheme === "dark" ||
		(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
	const tvTheme: "dark" | "light" = isDark ? "dark" : "light";
	const resolvedSymbol = resolveTradingViewSymbol({ symbol, assetType: "STOCK" });

	// Safe portfolio context lookup if props not directly passed
	const portfolioContext = useContext(PortfolioContext);
	const assets = portfolioContext?.assets;
	const { user } = useAuth();

	interface PortfolioAssetLike {
		id?: string | null;
		positionId?: string | null;
		name?: string | null;
		symbol?: string | null;
		type?: string | null;
		quantity?: number | null;
		currentPrice?: number | null;
		currency?: string | null;
	}

	const matchingAsset = useMemo(() => {
		if (!Array.isArray(assets)) return null;
		const list = assets as PortfolioAssetLike[];
		const s = symbol.trim().toUpperCase();
		return (
			list.find(
				(a) =>
					(typeof a.symbol === "string" && a.symbol.trim().toUpperCase() === s) ||
					(typeof a.name === "string" && a.name.trim().toUpperCase() === s),
			) ?? null
		);
	}, [assets, symbol]);

	const resolvedPositionId = positionId || matchingAsset?.id || undefined;
	/**
	 * The tax-lots endpoints look the position up by `positions.id`, while the
	 * `positionId` prop is an asset id (it also feeds the watchlist and alert
	 * mutations). Prefer the id the provider resolved from `PositionValuation`
	 * and keep the asset id only as a last resort for callers that never had a
	 * portfolio position: a wrong id fails the request loudly instead of
	 * returning another holding's lots.
	 */
	const taxLotsPositionId = position?.positionId ?? matchingAsset?.positionId ?? positionId;
	const resolvedPrice = currentPrice ?? matchingAsset?.currentPrice ?? 0;
	const resolvedCurrency = currency ?? matchingAsset?.currency ?? "USD";
	// Suggested default in the alert popover: 5% above the live price, rounded
	// to cents so the figure the user confirms is exactly what the server
	// persists. It sits inside an editable field — the price of owning this
	// alert is reading and confirming it.
	const alertThreshold = roundToCents(resolvedPrice * 1.05);

	// ---- Watch / Alert mutations ------------------------------------------
	// These buttons used to fire a success toast while persisting nothing. A
	// user who believed a price alert existed was holding a broken promise -
	// in a finance app that is not a missing feature, it is a lie.
	const [addToWatchlist, { loading: watchLoading }] = useMutation<
		AddAssetToWatchlistMutation,
		{ watchlistID: string; assetID: string }
	>(ADD_ASSET_TO_WATCHLIST, {
		onError: (e) => toast.error(e.message),
		// Reflect membership instantly: the "Watching" state reads the cached
		// watchlist assets, so both mutations keep that list coherent.
		update: (cache, { data }) => {
			const list = data?.addAssetToWatchlist;
			if (!list) return;
			cache.modify({
				id: cache.identify(list),
				fields: {
					assets(existing = [], { readField }) {
						if (existing.some((ref) => readField("id", ref) === resolvedPositionId)) {
							return existing;
						}
						const assetRef = cache.writeFragment({
							data: { __typename: "Asset", id: resolvedPositionId },
							fragment: gql`fragment StockDetailWatchAsset on Asset { id }`,
						});
						return assetRef ? [...existing, assetRef] : existing;
					},
				},
			});
		},
	});
	const [createWatchlist] = useMutation<
		CreateWatchlistMutation,
		{ input: { userID: string; name: string } }
	>(CREATE_WATCHLIST);
	const [removeFromWatch, { loading: unwatchLoading }] = useMutation<
		RemoveAssetFromWatchlistMutation,
		{ watchlistID: string; assetID: string }
	>(REMOVE_ASSET_FROM_WATCHLIST, {
		onError: (e) => toast.error(e.message),
		update: (cache, { data }) => {
			const list = data?.removeAssetFromWatchlist;
			if (!list) return;
			cache.modify({
				id: cache.identify(list),
				fields: {
					assets(existing = [], { readField }) {
						return existing.filter((ref) => readField("id", ref) !== resolvedPositionId);
					},
				},
			});
		},
	});
	const [createAlertMutation, { loading: alertLoading }] = useMutation<
		CreateAlertMutation,
		{
			input: {
				alertType: AlertType;
				conditionType: ConditionType;
				thresholdValue?: number;
				assetId?: string;
				notificationMethods: AlertNotificationMethod[];
			};
		}
	>(CREATE_ALERT, {
		// Read the fresh alert back without a refetch: the fragment matches the
		// full Alert shape, so a later alerts(...) query is served from cache.
		update(cache, { data }) {
			const alert = data?.createAlert;
			if (alert) cache.writeFragment({ fragment: ALERT_RESULT_FRAGMENT, data: alert });
		},
		onError: (e) => toast.error(e.message),
	});

	// Server-side watchlists are fetched by user id on GET_DASHBOARD_CRITICAL;
	// reusing the cached query keeps the list fresh without a new document.
	const { data: dashData } = useQuery(GET_DASHBOARD_CRITICAL, {
		variables: { userID: user?.id ?? "" },
		skip: !user?.id,
		fetchPolicy: "cache-first",
		returnPartialData: true,
	});

	// "Watching" reads the cached watchlist assets; unknown membership quietly
	// renders as "Watch" — the button itself never fabricates a state.
	const isWatched = useMemo(
		() =>
			dashData?.watchlists?.some((list) =>
				list.assets?.some((asset) => asset.id === resolvedPositionId),
			) ?? false,
		[dashData, resolvedPositionId],
	);
	// Removal must hit the list that actually holds the asset: with several
	// watchlists, acting on the first one would toast success and leave the
	// membership label silently wrong.
	const watchedListId = useMemo(() => {
		const list = dashData?.watchlists?.find((list) =>
			list.assets?.some((asset) => asset.id === resolvedPositionId),
		);
		return list?.id;
	}, [dashData, resolvedPositionId]);

	const toggleWatch = useCallback(async () => {
		if (!user?.id || !resolvedPositionId) {
			toast.error("Open a position first — watchlists track real holdings");
			return;
		}
		try {
			let listId = isWatched ? watchedListId : dashData?.watchlists?.[0]?.id;
			if (isWatched && listId) {
				await removeFromWatch({ variables: { watchlistID: listId, assetID: resolvedPositionId } });
				toast.info(`${symbol} removed from watchlist`);
				return;
			}
			if (!listId) {
				const created = await createWatchlist({
					variables: { input: { userID: user.id, name: "My Watchlist" } },
				});
				listId = created.data?.createWatchlist?.id;
			}
			if (!listId) {
				toast.error("Could not find or create a watchlist");
				return;
			}
			await addToWatchlist({ variables: { watchlistID: listId, assetID: resolvedPositionId } });
			toast.success(`Added ${symbol} to watchlist`);
		} catch {
			// Errors already surfaced by the mutation's onError handler.
		}
	}, [
		addToWatchlist,
		createWatchlist,
		dashData?.watchlists,
		isWatched,
		removeFromWatch,
		resolvedPositionId,
		symbol,
		user?.id,
		watchedListId,
	]);

	// ---- Alert popover -----------------------------------------------------
	// One undisclosed click used to own the user a permanent +5%-Above in-app
	// alert. The rule is now configured before it is created and duplicates
	// (same condition + threshold) are refused for the session. The server
	// exposes no alert listing to this sheet, so the dedupe is stated honestly
	// as session-scoped; existing alerts are managed on the dashboard.
	const [alertOpen, setAlertOpen] = useState(false);
	const [alertCondition, setAlertCondition] = useState<"Above" | "Below">("Above");
	const [alertDraft, setAlertDraft] = useState<string>(String(alertThreshold));
	// Alerts created during this sheet's lifetime, for the duplicate rule.
	const [sessionAlerts, setSessionAlerts] = useState<
		Array<{ conditionType: "Above" | "Below"; thresholdValue: number }>
	>([]);

	const openAlertPopover = useCallback(
		(open: boolean) => {
			setAlertOpen(open);
			if (open) {
				setAlertCondition("Above");
				// A live price suggests +5% as the threshold; without one the
				// field opens empty — "0" would read as a rule to warn at $0.
				setAlertDraft(resolvedPrice > 0 ? String(alertThreshold) : "");
			}
		},
		[alertThreshold, resolvedPrice],
	);

	const alertDraftNum = Number(alertDraft);
	const alertDraftValid =
		alertDraft.trim() !== "" &&
		Number.isFinite(alertDraftNum) && // "1e999" is a number past > 0 — and not an amount
		alertDraftNum > 0;
	// The committed threshold, in the threshold's own currency units (the
	// typed amount rounded the way the server stores it) — not cents, it is
	// never multiplied: naming keeps the unit visible at every use.
	const alertDraftAmount = alertDraftValid ? roundToCents(alertDraftNum) : null;
	const isDuplicateAlert = Boolean(
		alertDraftAmount != null &&
			sessionAlerts.some(
				(a) => a.conditionType === alertCondition && a.thresholdValue === alertDraftAmount,
			),
	);
	const conditionWord = alertCondition === "Below" ? "below" : "above";

	const confirmAlert = useCallback(async () => {
		// The threshold is an absolute figure the user typed: it does not need
		// the live price to be a meaningful standing rule (only the +5% default
		// derives from it — the reference line says as much instead of blocking
		// silently). Invalid or duplicate drafts are refused at the button.
		if (alertDraftAmount == null || isDuplicateAlert) {
			return;
		}
		try {
			await createAlertMutation({
				variables: {
					input: {
						alertType: AlertType.Price,
						conditionType: alertCondition === "Below" ? ConditionType.Below : ConditionType.Above,
						thresholdValue: alertDraftAmount,
						...(resolvedPositionId ? { assetId: resolvedPositionId } : {}),
						notificationMethods: [AlertNotificationMethod.InApp],
					},
				},
			});
			setSessionAlerts((prev) => [
				...prev,
				{ conditionType: alertCondition, thresholdValue: alertDraftAmount },
			]);
			toast.success(
				`Alert set: ${symbol} ${conditionWord} ${formatMoney(alertDraftAmount, resolvedCurrency)}`,
			);
			setAlertOpen(false);
		} catch {
			// Errors already surfaced by the mutation's onError handler.
		}
	}, [
		alertCondition,
		alertDraftAmount,
		conditionWord,
		createAlertMutation,
		isDuplicateAlert,
		resolvedCurrency,
		resolvedPositionId,
		symbol,
	]);

	const { formatCurrency, currency: displayCurrency } = useCurrency();
	// Same gate as the holdings table: a price of zero means the fetch has not
	// landed, and the position figures cannot be stood behind.
	const isPriceResolved = (position?.currentPrice ?? 0) > 0;
	const displayName = position?.name ?? matchingAsset?.name ?? symbol;

	// Latest recorded daily quote feeds the market panel (O/H/L/C/V).
	// One candle keeps the request small; when nothing has been recorded for
	// this symbol yet the panel shows honest dashes instead of inventing data.
	const { data: dailyCandles, refetch: refetchLatestCandle } = useMarketData({
		symbol,
		assetType: "STOCK",
		interval: "1d",
		limit: 1,
	});
	const latestCandle = useMemo(() => {
		if (!dailyCandles?.length) return null;
		return dailyCandles.reduce((latest, candle) =>
			new Date(candle.timestamp).getTime() > new Date(latest.timestamp).getTime() ? candle : latest,
		);
	}, [dailyCandles]);

	// ---- Tax Lots gate + unified Realized Fiscal P&L ----------------------
	// Both summaries and the Tax Lots section read the same two server ledgers.
	// cache-first keeps the gate cheap; the section's own cache-and-network
	// query still refreshes, and these queries re-render from that cache.
	const { data: lotsGateData, error: lotsGateError } = useQuery<{
		taxLotsByPosition: TaxLotItem[];
	}>(GET_TAX_LOTS_BY_POSITION, {
		variables: { positionId: taxLotsPositionId ?? "" },
		skip: !taxLotsPositionId,
		fetchPolicy: "cache-first",
	});
	const { data: dispGateData, error: dispGateError } = useQuery<{
		dispositionsByPosition: TaxLotDispositionItem[];
	}>(GET_DISPOSITIONS_BY_POSITION, {
		variables: { positionId: taxLotsPositionId ?? "" },
		skip: !taxLotsPositionId,
		fetchPolicy: "cache-first",
	});

	const lotsCount = lotsGateData?.taxLotsByPosition?.length ?? 0;
	const dispositionsCount = dispGateData?.dispositionsByPosition?.length ?? 0;
	const hasLotData = lotsCount > 0 || dispositionsCount > 0;
	// A failed gate request must not read as "no lots exist": when either gate
	// errors, TaxLotsTab renders and reports the failure itself (with retry)
	// instead of the sheet implying a clean ledger.
	const lotsGateFailed = Boolean(lotsGateError || dispGateError);

	/**
	 * Lifetime realized totals with the SAME fiscal rule the Tax Lots ledger
	 * applies: exempt dispositions (and everything held in a PEA wrapper) are
	 * reported separately — they are genuinely realized, just not taxable as
	 * capital gains. null while records have not loaded; never a zero fill.
	 *
	 * The unified sum is only a number when ONE currency underlies the
	 * recorded lots. Those currencies are the ledger's own records: a single
	 * currency labels the whole sum; several make it mixed-basis — withheld
	 * ("—"), not printed as someone's currency by assumption.
	 */
	const realizedTotals = useMemo(() => {
		const rows = dispGateData?.dispositionsByPosition;
		if (!rows) return null;
		const currencies = new Set((lotsGateData?.taxLotsByPosition ?? []).map((lot) => lot.currency));
		const basis = currencies.size === 1 ? [...currencies][0] : null;
		if (!basis) return null;
		const isPEA = portfolioContext?.selectedPortfolio?.taxWrapper === "PEA";
		let taxable = 0;
		let exempt = 0;
		for (const row of rows) {
			if (row.isTaxExempt || isPEA) {
				exempt += row.realizedGainLoss;
			} else {
				taxable += row.realizedGainLoss;
			}
		}
		return { taxable, exempt, basis };
	}, [dispGateData, lotsGateData, portfolioContext?.selectedPortfolio?.taxWrapper]);

	return (
		<div className="animate-fade-in min-w-0">
			{/* 1. Sticky compact header — identity, honest badges, position actions.
			    It survives the whole scroll so Watch/Alert/Add stay one tap away. */}
			<div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/40 px-2 sm:px-4 pt-3 pb-2.5">
				<div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
					<div className="flex items-center gap-2 min-w-0">
						{onBack && (
							<Button
								variant="ghost"
								size="sm"
								aria-label={`Back to ${symbol} overview`}
								className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={onBack}
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<AssetLogo
							symbol={symbol}
							name={displayName}
							assetType={matchingAsset?.type === "fund" ? "fund" : "stock"}
							size="md"
						/>
						<div className="min-w-0">
							<div className="flex items-baseline gap-2 min-w-0">
								<h1 className="truncate text-base font-semibold text-foreground">{displayName}</h1>
								{displayName !== symbol && (
									<span className="shrink-0 font-mono text-xs text-muted-foreground">{symbol}</span>
								)}
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-1.5">
								{position && !isPriceResolved && (
									<Badge
										variant="outline"
										className="h-4 px-1.5 py-0 text-micro font-medium border-warning/30 bg-warning/10 text-warning"
									>
										No price
									</Badge>
								)}
								{position && !isPriceResolved && (
									<span className="text-micro text-warning/90">
										No live quote for {symbol} — value figures show “—” until a price resolves.
									</span>
								)}
								{position?.fx.isStale && (
									<Explained
										description={
											position.fx.fxAsOf
												? `The FX rate used to value this position was last observed ${formatDate(position.fx.fxAsOf)} and is considered stale.`
												: "The FX rate used to value this position is stale."
										}
									>
										<Badge
											variant="outline"
											className="h-4 px-1 py-0 text-micro font-medium border-warning/30 bg-warning/10 text-warning"
										>
											stale rates · updated{" "}
											{position.fx.fxAsOf ? formatDate(position.fx.fxAsOf) : "—"}
										</Badge>
									</Explained>
								)}
								{resolvedCurrency !== "USD" &&
									(position && !position.fx.canShowPercentage ? (
										<Explained description={position.fx.reason}>
											<Badge
												variant="secondary"
												className="h-4 px-1 py-0 text-micro font-mono uppercase bg-muted/60 text-muted-foreground"
											>
												{resolvedCurrency}
											</Badge>
										</Explained>
									) : (
										<Badge
											variant="secondary"
											className="h-4 px-1 py-0 text-micro font-mono uppercase bg-muted/60 text-muted-foreground"
										>
											{resolvedCurrency}
										</Badge>
									))}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<Button
							size="sm"
							variant="outline"
							aria-label={
								isWatched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`
							}
							aria-pressed={isWatched}
							className="h-9 text-xs flex-1 sm:flex-initial cursor-pointer touch-target"
							onClick={toggleWatch}
							disabled={watchLoading || unwatchLoading}
						>
							{watchLoading || unwatchLoading ? (
								<Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
							) : (
								<Star
									className={
										isWatched ? "h-3.5 w-3.5 mr-2 fill-warning text-warning" : "h-3.5 w-3.5 mr-2"
									}
								/>
							)}
							{isWatched ? "Watching" : "Watch"}
						</Button>
						<Popover open={alertOpen} onOpenChange={openAlertPopover}>
							<PopoverTrigger asChild>
								<Button
									size="sm"
									variant="outline"
									aria-label={`Set a price alert for ${symbol}`}
									aria-expanded={alertOpen}
									className="h-9 text-xs flex-1 sm:flex-initial cursor-pointer touch-target"
									disabled={alertLoading}
								>
									{alertLoading ? (
										<Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
									) : (
										<Bell className="h-3.5 w-3.5 mr-2" />
									)}
									Alert
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-80 p-4 space-y-4">
								<div className="space-y-1">
									<p className="text-sm font-semibold text-foreground">Set a price alert</p>
									<p className="text-xs text-muted-foreground">
										Notify me in-app when {symbol} crosses the level I choose.
									</p>
								</div>

								{/* Direction — real condition buttons, pressed state carries
								    the current choice instead of an assumption. */}
								<div className="space-y-1.5">
									<span className="text-xs font-medium text-foreground">Direction</span>
									<fieldset className="m-0 grid grid-cols-2 gap-1 rounded-lg border border-border/40 bg-muted/40 p-1">
										<legend className="sr-only">Alert direction</legend>
										{(["Above", "Below"] as const).map((condition) => (
											<button
												key={condition}
												type="button"
												aria-pressed={alertCondition === condition}
												className={`h-8 rounded-md text-xs font-medium cursor-pointer transition-colors ${
													alertCondition === condition
														? "bg-background text-foreground shadow-xs"
														: "text-muted-foreground hover:text-foreground"
												}`}
												onClick={() => setAlertCondition(condition)}
											>
												{condition === "Above" ? "Price rises above" : "Price falls below"}
											</button>
										))}
									</fieldset>
								</div>

								<div className="space-y-1.5">
									<label htmlFor="alert-threshold" className="text-xs font-medium text-foreground">
										Threshold ({resolvedCurrency})
									</label>
									<Input
										id="alert-threshold"
										type="number"
										inputMode="decimal"
										min="0"
										step="0.01"
										value={alertDraft}
										onChange={(event) => setAlertDraft(event.target.value)}
										aria-invalid={alertDraftValid ? undefined : true}
										aria-describedby={!alertDraftValid ? "alert-threshold-warning" : undefined}
										className="h-9"
									/>
									<p className="text-xs text-muted-foreground">
										{resolvedPrice > 0
											? `Last price ${formatMoney(resolvedPrice, resolvedCurrency)}`
											: "No live price recorded yet — a typed threshold still works."}
									</p>
									{/* A disabled button told the user nothing; the reason
									    beside the field does, and the input points at it. */}
									{!alertDraftValid && (
										<p id="alert-threshold-warning" className="text-xs text-warning" role="status">
											{alertDraft.trim() === ""
												? "Type the threshold you want to be notified at."
												: "The threshold must be a positive amount."}
										</p>
									)}
								</div>

								{/* The duplicate rule is visible where it bites, and is
								    stated as session-scoped because the sheet has no way
								    to list the alerts the server already holds. */}
								{isDuplicateAlert && (
									<p className="text-xs text-warning" role="status">
										Alert already set for this session: {symbol} {conditionWord}{" "}
										{formatMoney(alertDraftAmount ?? 0, resolvedCurrency)}.
									</p>
								)}

								<Button
									className="w-full cursor-pointer"
									disabled={!alertDraftValid || isDuplicateAlert || alertLoading}
									onClick={confirmAlert}
								>
									{alertLoading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
									{alertLoading
										? "Setting alert…"
										: alertDraftValid && !isDuplicateAlert
											? `Alert ${conditionWord} ${formatMoney(alertDraftAmount ?? alertThreshold, resolvedCurrency)}`
											: "Set alert"}
								</Button>
								{/* The footnote may only claim what exists: with no routed
								    alerts panel, the truthful line is "stored with this
								    portfolio". A wired onNavigateToAlerts promotes it to a
								    real affordance instead of a dead map note. */}
								{onNavigateToAlerts ? (
									<button
										type="button"
										onClick={onNavigateToAlerts}
										className="text-xs text-muted-foreground text-center underline underline-offset-2 hover:text-foreground cursor-pointer w-full"
									>
										Manage your alerts →
									</button>
								) : (
									<p className="text-xs text-muted-foreground text-center">
										Your alert is stored with this portfolio — an alerts panel is not built yet.
									</p>
								)}
							</PopoverContent>
						</Popover>
						<Button
							size="sm"
							aria-label={`Add a position for ${symbol}`}
							className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/95 border-0 flex-1 sm:flex-initial cursor-pointer touch-target"
							onClick={() => {
								if (onTrade) {
									onTrade();
								} else {
									// Honest fallback: no add-position flow is wired here, so
									// say so instead of faking an action with a success toast.
									toast.info(`Adding a position for ${symbol} is not available yet`);
								}
							}}
						>
							<Plus className="h-3.5 w-3.5 mr-2" /> Add position
						</Button>
					</div>
				</div>
			</div>

			{/* 2. The one scrolling page. Top-to-bottom: position banner →
			    performance → hero chart → recorded quotes → about → research →
			    tax lots. The five-tab strip is gone; the section order itself is
			    the navigation. */}
			{/* The page is its own layout container: the sheet is a fixed 672px
			    space, so every section adapts to the sheet's width (@container)
			    instead of the browser viewport, which lies about how much room
			    these sections actually have. */}
			<div className="@container px-2 sm:px-4 py-4 space-y-6">
				{/* Position banner — 5 KPIs, unchanged numbers, container-queried chrome */}
				{position && (
					<StockPositionSummaryBanner
						position={position}
						resolvedPrice={resolvedPrice}
						currency={resolvedCurrency}
						formatCurrency={formatCurrency}
						formatQuantity={formatQty}
					/>
				)}

				{/* Performance — market rows plus Price Return and the unified
				    Realized Fiscal P&L from the recorded dispositions ledger */}
				{position ? (
					<StockPerformanceBreakdown
						position={position}
						currentPrice={resolvedPrice}
						resolvedCurrency={resolvedCurrency}
						realizedGainLoss={realizedTotals ? realizedTotals.taxable : null}
						exemptGainLoss={realizedTotals ? realizedTotals.exempt : null}
						realizedCurrencyBasis={realizedTotals ? realizedTotals.basis : null}
						hasDispositionRecords={
							taxLotsPositionId != null && realizedTotals !== null && dispositionsCount > 0
						}
						displayCurrency={displayCurrency}
						high={latestCandle?.high ?? null}
						low={latestCandle?.low ?? null}
						open={latestCandle?.open ?? null}
						close={latestCandle?.close ?? null}
						volume={latestCandle?.volume ?? null}
					/>
				) : (
					<div className="rounded-xl border border-border/40 bg-card/40 p-6 text-center max-w-xl mx-auto">
						<p className="text-sm font-medium text-foreground">No position details available</p>
						<p className="mt-1 text-xs text-muted-foreground">
							This instrument is not part of the current portfolio view.
						</p>
					</div>
				)}

				{/* Hero chart — one interactive price chart, TradingView-sourced */}
				<div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden relative">
					<div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-2 border-b border-border/30">
						<div className="flex items-center gap-2">
							<h2 className="text-sm font-semibold text-foreground">Price</h2>
							<a
								href="#after-tradingview-chart"
								className="sr-only focus:not-sr-only focus:inline-block px-2 py-0.5 text-micro rounded bg-primary text-primary-foreground font-medium z-20"
							>
								Skip chart
							</a>
						</div>
						<span className="text-xs text-muted-foreground">Interactive chart · TradingView</span>
					</div>
					<div className="p-3">
						<LazyWidget height={420}>
							<AdvancedRealTimeChart
								symbol={resolvedSymbol}
								theme={tvTheme}
								width="100%"
								height={420}
								interval="D"
								timezone="Etc/UTC"
								style="1"
								locale="en"
								allow_symbol_change={false}
								calendar={false}
								backgroundColor={tvTheme === "dark" ? "#09090b" : "#ffffff"}
								toolbar_bg={tvTheme === "dark" ? "#131722" : "#f1f3f6"}
							/>
						</LazyWidget>
					</div>
					<div id="after-tradingview-chart" tabIndex={-1} className="sr-only" />
				</div>

				{/* Daily quotes — the price-history ledger, collapsed by default.
				    The header never promises a window ("60d"): the table counts
				    exactly what the ledger holds. */}
				<Collapsible>
					<div className="rounded-xl border border-border/40">
						<CollapsibleTrigger className="w-full cursor-pointer group">
							<div className="h-12 px-4 flex items-center justify-between gap-2">
								<span className="text-sm font-semibold text-foreground">Daily quotes</span>
								<ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
							</div>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="pb-1">
								<StockPriceHistoryTable
									symbol={symbol}
									currency={resolvedCurrency}
									onRefresh={refetchLatestCandle}
								/>
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>

				{/* About — honest company facts; TradingView profile inside */}
				<StockAboutSection symbol={symbol} displayName={displayName} />

				{/* Company research — third-party TradingView wall, demoted to a
				    collapsed disclosure; nothing loads until the user opens it. */}
				<Collapsible>
					<div className="rounded-xl border border-border/40">
						<CollapsibleTrigger className="w-full cursor-pointer group">
							<div className="h-12 px-4 flex items-center justify-between gap-2">
								<span className="text-sm font-semibold text-foreground">Company research</span>
								{/* Chevron always pairs with the trigger — a disclosure that
								    loses its affordance above sm looks like a static banner. */}
								<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
									TradingView
									<ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
								</span>
							</div>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="p-3 space-y-4">
								<ErrorBoundary
									fallback={({ resetErrorBoundary }) => (
										<WidgetErrorFallback height={120} onRetry={resetErrorBoundary} />
									)}
								>
									<SymbolInfo symbol={resolvedSymbol} colorTheme={tvTheme} autosize isTransparent />
								</ErrorBoundary>
								<LazyWidget height={490}>
									<FundamentalData
										symbol={resolvedSymbol}
										colorTheme={tvTheme}
										width="100%"
										height={490}
										isTransparent
									/>
								</LazyWidget>
								<LazyWidget height={425}>
									<TechnicalAnalysis
										symbol={resolvedSymbol}
										colorTheme={tvTheme}
										width="100%"
										height={425}
										interval="1D"
										isTransparent
									/>
								</LazyWidget>
								<LazyWidget height={425}>
									<Timeline
										feedMode="symbol"
										symbol={resolvedSymbol}
										colorTheme={tvTheme}
										width="100%"
										height={425}
										isTransparent
									/>
								</LazyWidget>
								{/* Powered by TradingView attribution */}
								<div className="pt-2 flex flex-col gap-2 justify-center items-center text-center">
									<p className="text-xs text-muted-foreground max-w-md">
										Financial data, company profiles, and technical analysis are powered by
										TradingView's interactive, real-time widgets.
									</p>
								</div>
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>

				{/* Tax Lots section — only when the server ledgers actually carry
				    lots or dispositions. The empty state is one quiet line with a
				    real route to the Transactions surface, not a French-tax ritual. */}
				{taxLotsPositionId ? (
					hasLotData || lotsGateFailed ? (
						<TaxLotsTab
							positionId={taxLotsPositionId}
							symbol={symbol}
							currency={resolvedCurrency}
							currentPrice={resolvedPrice}
							accountName={position?.account}
							portfolioTaxWrapper={portfolioContext?.selectedPortfolio?.taxWrapper}
							onNavigateToTransactions={onNavigateToTransactions}
						/>
					) : (
						<div className="rounded-xl border border-border/40 bg-card/40 p-6 text-center">
							<p className="text-sm font-medium text-foreground">No lot history yet for {symbol}</p>
							<p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
								Record the purchase and sale transactions for this holding and its cost basis,
								holding periods and capital-gain reporting appear here.
							</p>
							{onNavigateToTransactions && (
								<Button
									variant="outline"
									size="sm"
									className="mt-4 cursor-pointer"
									onClick={onNavigateToTransactions}
								>
									Record transactions
								</Button>
							)}
						</div>
					)
				) : null}
			</div>
		</div>
	);
}
