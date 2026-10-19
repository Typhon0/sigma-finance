import { useMutation, useQuery } from "@apollo/client";
import {
	AlertTriangle,
	ArrowLeft,
	Bell,
	Building2,
	History,
	LineChart,
	Loader2,
	Plus,
	Receipt,
	Star,
	Wallet,
} from "lucide-react";
import {
	lazy,
	Suspense,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { PortfolioContext } from "@/components/PortfolioProvider";
import { computeDayChangeAmount } from "@/components/stocks-funds/day-change";
import type { Asset } from "@/components/stocks-funds/types";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type {
	AddAssetToWatchlistMutation,
	CreateAlertMutation,
	CreateWatchlistMutation,
} from "@/gql/graphql";
import { AlertNotificationMethod, AlertType, ConditionType } from "@/gql/graphql";
import {
	ADD_ASSET_TO_WATCHLIST,
	ALERT_RESULT_FRAGMENT,
	CREATE_ALERT,
	CREATE_WATCHLIST,
} from "@/graphql/mutations";
import { GET_DASHBOARD_CRITICAL } from "@/graphql/queries/dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { getChartThemeColors } from "@/lib/chart-colors";
import { resolveTradingViewSymbol } from "@/lib/resolve-trading-view-symbol";
import { cn } from "@/lib/utils";
import { StockAboutSection } from "./StockAboutSection";
import { StockPerformanceBreakdown } from "./StockPerformanceBreakdown";
import { StockPositionSummaryBanner } from "./StockPositionSummaryBanner";
import { StockPriceHistoryTable } from "./StockPriceHistoryTable";
import { TaxLotsTab } from "./TaxLotsTab";

// Lazy-load heavy TradingView widgets only when they scroll into view.
const AdvancedRealTimeChart = lazy(() =>
	import("@/components/tradingview").then((m) => ({ default: m.AdvancedRealTimeChart })),
);
const CompanyProfile = lazy(() =>
	import("@/components/tradingview").then((m) => ({ default: m.CompanyProfile })),
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

function WidgetErrorFallback({ height, onRetry }: { height: number; onRetry: () => void }) {
	return (
		<div
			className="flex flex-col items-center justify-center bg-muted/10 rounded-lg border border-border/30 p-4 text-center"
			style={{ minHeight: height }}
		>
			<AlertTriangle className="h-6 w-6 text-warning mb-2" />
			<p className="text-xs font-medium text-foreground">Widget temporarily unavailable</p>
			<p className="text-micro text-muted-foreground mt-0.5 mb-3">
				Failed to load TradingView component
			</p>
			<Button variant="outline" size="sm" onClick={onRetry} className="h-7 text-xs">
				Retry
			</Button>
		</div>
	);
}

/** Wraps a lazy TradingView widget with intersection observer to defer loading. */
function LazyWidget({ children, height = 400 }: { children: React.ReactNode; height?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (typeof IntersectionObserver === "undefined") {
			setVisible(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" }, // preload 200px before visible
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} style={{ minHeight: height }}>
			{visible ? (
				<ErrorBoundary
					fallback={({ resetErrorBoundary }) => (
						<WidgetErrorFallback height={height} onRetry={resetErrorBoundary} />
					)}
				>
					<Suspense
						fallback={
							<div
								className="flex items-center justify-center bg-muted/20 rounded-lg border border-border/30"
								style={{ height }}
							>
								<div className="flex flex-col items-center gap-3">
									<div className="h-6 w-6 animate-spin rounded-full border-2 border-gain border-t-transparent" />
									<p className="text-xs text-muted-foreground">Loading widget…</p>
								</div>
							</div>
						}
					>
						{children}
					</Suspense>
				</ErrorBoundary>
			) : (
				<div
					className="flex items-center justify-center bg-muted/10 rounded-lg border border-border/20"
					style={{ height }}
				/>
			)}
		</div>
	);
}

/**
 * Filter bag handed to `onNavigateToScreener`.
 *
 * This was `(filters: any)`, which pushed an unchecked value straight through to
 * the screener. The concrete callers only ever send primitive filter fields, so
 * that is what the contract says.
 */
export type ScreenerFilters = Record<string, unknown>;

/**
 * The subset of the polymorphic portfolio asset model this panel reads.
 * Declared here so the lookup is checked instead of `any`.
 */
interface PortfolioAssetLike {
	id?: string | null;
	positionId?: string | null;
	name?: string | null;
	symbol?: string | null;
	quantity?: number | null;
	currentPrice?: number | null;
	currency?: string | null;
}

const roundToCents = (value: number) => Math.round(value * 100) / 100;

/** Same quantity convention as the holdings table: whole shares, or 4 dp. */
const formatQuantity = (value: number) =>
	value % 1 === 0
		? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
		: value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const formatAlertThreshold = (value: number, currency: string) => {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
		}).format(value);
	} catch {
		return `$${value.toFixed(2)}`;
	}
};

export interface StockDetailProps {
	symbol: string;
	/**
	 * Normalized position from StocksFundsModule — the single source of truth
	 * for value, cost basis, P&L, weight and FX status. Absent when the panel
	 * is rendered without a portfolio position.
	 */
	position?: Asset | null;
	positionId?: string;
	quantity?: number;
	currentPrice?: number;
	currency?: string;
	onBack?: () => void;
	onTrade?: () => void;
	onNavigateToScreener?: (filters: ScreenerFilters) => void;
	isPanel?: boolean;
	initialTab?: "overview" | "about" | "history" | "research" | "tax-lots" | string;
}

export function StockDetail({
	symbol,
	position,
	positionId,
	quantity,
	currentPrice,
	currency,
	onBack,
	onTrade,
	onNavigateToScreener: _onNavigateToScreener,
	isPanel: _isPanel = false,
	initialTab = "overview",
}: StockDetailProps) {
	const [activeTab, setActiveTab] = useState<string>(initialTab);
	// Same trap as the distribution widget: `theme` is "system" unless the user
	// forced a mode, which resolved to the light TradingView palette on a dark UI.
	const { resolvedTheme } = useTheme();
	const resolvedSymbol = resolveTradingViewSymbol({ symbol, assetType: "STOCK" });

	// Safe portfolio context lookup if props not directly passed
	const portfolioContext = useContext(PortfolioContext);
	const assets = portfolioContext?.assets;
	const { user } = useAuth();

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
	const resolvedQuantity = quantity ?? matchingAsset?.quantity ?? 0;
	const resolvedPrice = currentPrice ?? matchingAsset?.currentPrice ?? 0;
	const resolvedCurrency = currency ?? matchingAsset?.currency ?? "USD";
	// Default alert: 5% above the live price. Rounded to cents so the figure in
	// the toast is exactly the figure the server persists.
	const alertThreshold = roundToCents(resolvedPrice * 1.05);

	// ---- Real Watch / Alert mutations ------------------------------------
	// These buttons used to fire a success toast while persisting nothing. A
	// user who believed a price alert existed was holding a broken promise -
	// in a finance app that is not a missing feature, it is a lie.
	const [addToWatchlist, { loading: watchLoading }] = useMutation<
		AddAssetToWatchlistMutation,
		{ watchlistID: string; assetID: string }
	>(ADD_ASSET_TO_WATCHLIST, { onError: (e) => toast.error(e.message) });
	const [createWatchlist] = useMutation<
		CreateWatchlistMutation,
		{ input: { userID: string; name: string } }
	>(CREATE_WATCHLIST);
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

	const handleWatch = useCallback(async () => {
		if (!user?.id || !resolvedPositionId) {
			toast.error("Open a position first — watchlists track real holdings");
			return;
		}
		try {
			let list = dashData?.watchlists?.[0];
			if (!list) {
				const created = await createWatchlist({
					variables: { input: { userID: user.id, name: "My Watchlist" } },
				});
				list = created.data?.createWatchlist;
			}
			if (!list?.id) {
				toast.error("Could not find or create a watchlist");
				return;
			}
			await addToWatchlist({ variables: { watchlistID: list.id, assetID: resolvedPositionId } });
			toast.success(`Added ${symbol} to watchlist`);
		} catch {
			// Errors already surfaced by the mutation's onError handler.
		}
	}, [addToWatchlist, createWatchlist, dashData?.watchlists, resolvedPositionId, symbol, user?.id]);

	const handleAlert = useCallback(async () => {
		if (!resolvedPrice || resolvedPrice <= 0) {
			toast.error("No live price available — cannot set an alert threshold");
			return;
		}
		try {
			await createAlertMutation({
				variables: {
					input: {
						alertType: AlertType.Price,
						conditionType: ConditionType.Above,
						thresholdValue: alertThreshold,
						...(resolvedPositionId ? { assetId: resolvedPositionId } : {}),
						notificationMethods: [AlertNotificationMethod.InApp],
					},
				},
			});
			toast.success(
				`Alert set: ${symbol} above ${formatAlertThreshold(alertThreshold, resolvedCurrency)}`,
			);
		} catch {
			// Errors already surfaced by the mutation's onError handler.
		}
	}, [alertThreshold, createAlertMutation, resolvedCurrency, resolvedPositionId, symbol]);

	const { formatCurrency } = useCurrency();
	// Same gate as the holdings table: a price of zero means the fetch has not
	// landed, and the position figures cannot be stood behind.
	const isPriceResolved = (position?.currentPrice ?? 0) > 0;
	const displayName = position?.name ?? matchingAsset?.name ?? symbol;

	// Today's move, derived from the same normalized value and the same helper
	// as the holdings table. Hidden entirely when the provider supplied no
	// day-change figure: a missing metric is not a flat session.
	const dayChange = useMemo(() => {
		if (!position?.hasDayChange) return null;
		return {
			percent: position.dayChangePercentage,
			amount: computeDayChangeAmount(position.totalValue, position.dayChangePercentage),
		};
	}, [position]);

	return (
		<div className="space-y-6 animate-fade-in p-2 sm:p-4 max-w-7xl mx-auto w-full min-w-0">
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				{/* 1. Header & Navigation */}
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 pb-2 border-b border-border/40 min-w-0">
						<div className="flex flex-wrap items-center justify-between gap-3">
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
								<div className="min-w-0">
									<div className="flex items-baseline gap-2 min-w-0">
										<span className="truncate text-base font-semibold text-foreground">
											{displayName}
										</span>
										{displayName !== symbol && (
											<span className="shrink-0 font-mono text-xs text-muted-foreground">
												{symbol}
											</span>
										)}
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-1.5">
										{position && !isPriceResolved && (
											<Badge
												variant="outline"
												className="h-4 px-1.5 py-0 text-micro font-semibold tracking-wide uppercase border-warning/30 bg-warning/10 text-warning"
											>
												Price Err
											</Badge>
										)}
										{position?.fx.isStale && (
											<Badge
												variant="outline"
												className="h-4 px-1 py-0 text-micro font-mono uppercase border-warning/30 bg-warning/10 text-warning"
												title={
													position.fx.fxAsOf
														? `The FX rate used to value this position was last observed ${position.fx.fxAsOf} and is considered stale.`
														: "The FX rate used to value this position is stale."
												}
											>
												stale fx
											</Badge>
										)}
										{resolvedCurrency !== "USD" && (
											<Badge
												variant="secondary"
												className="h-4 px-1 py-0 text-micro font-mono uppercase bg-muted/60 text-muted-foreground"
												title={
													position && !position.fx.canShowPercentage
														? position.fx.reason
														: undefined
												}
											>
												{resolvedCurrency}
											</Badge>
										)}
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2 shrink-0">
								<Button
									size="sm"
									variant="outline"
									aria-label={`Add ${symbol} to watchlist`}
									className="h-9 text-xs flex-1 sm:flex-initial cursor-pointer touch-target"
									onClick={handleWatch}
									disabled={watchLoading}
								>
									{watchLoading ? (
										<Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
									) : (
										<Star className="h-3.5 w-3.5 mr-2" />
									)}
									Watch
								</Button>
								<Button
									size="sm"
									variant="outline"
									aria-label={`Set price alert for ${symbol}`}
									className="h-9 text-xs flex-1 sm:flex-initial cursor-pointer touch-target"
									onClick={handleAlert}
									disabled={alertLoading}
								>
									{alertLoading ? (
										<Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
									) : (
										<Bell className="h-3.5 w-3.5 mr-2" />
									)}
									Alert
								</Button>
								<div className="h-4 w-px bg-border/50 mx-1 hidden sm:block" />
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
						{position && (
							<StockPositionSummaryBanner
								position={position}
								symbol={symbol}
								resolvedPrice={resolvedPrice}
								resolvedCurrency={resolvedCurrency}
								formatCurrency={formatCurrency}
								formatQuantity={formatQuantity}
							/>
						)}

						{/* Elegant border-b underline tab navigation */}
						<div className="border-b border-border/30 w-full">
							<TabsList
								variant="line"
								className="h-auto p-0 bg-transparent rounded-none w-full justify-start gap-5 sm:gap-7 overflow-x-auto scrollbar-none border-none"
							>
								<TabsTrigger
									value="overview"
									className="group relative h-9 px-1 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground/80 hover:text-foreground text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer"
								>
									<span>Overview</span>
								</TabsTrigger>
								<TabsTrigger
									value="about"
									className="group relative h-9 px-1 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground/80 hover:text-foreground text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer"
								>
									<span>À propos</span>
								</TabsTrigger>
								<TabsTrigger
									value="history"
									className="group relative h-9 px-1 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground/80 hover:text-foreground text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer"
								>
									<span>Historique</span>
								</TabsTrigger>
								<TabsTrigger
									value="research"
									className="group relative h-9 px-1 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground/80 hover:text-foreground text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer"
								>
									<span>Research</span>
								</TabsTrigger>
								<TabsTrigger
									value="tax-lots"
									className="group relative h-9 px-1 pb-2.5 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground/80 hover:text-foreground text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
								>
									<span>Tax Lots & Gains</span>
									{resolvedQuantity > 0 && (
										<span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-micro font-mono text-muted-foreground border border-border/40 group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary group-data-[state=active]:border-primary/20">
											{resolvedQuantity} sh
										</span>
									)}
								</TabsTrigger>
							</TabsList>
						</div>
					</div>

					<TabsContent value="overview" className="mt-4">
						{position ? (
							<StockPerformanceBreakdown
								position={position}
								positionId={taxLotsPositionId}
								symbol={symbol}
								resolvedPrice={resolvedPrice}
								resolvedCurrency={resolvedCurrency}
								formatCurrency={formatCurrency}
								formatQuantity={formatQuantity}
							/>
						) : (
							<div className="rounded-xl border border-border/40 bg-card/40 p-6 text-center max-w-xl mx-auto">
								<p className="text-sm font-medium text-foreground">No position details available</p>
								<p className="mt-1 text-xs text-muted-foreground">
									This instrument is not part of the current portfolio view.
								</p>
							</div>
						)}
					</TabsContent>

					<TabsContent value="about" className="mt-4">
						<StockAboutSection symbol={symbol} displayName={displayName} />
					</TabsContent>

					<TabsContent value="history" className="mt-4">
						<StockPriceHistoryTable symbol={symbol} formatCurrency={formatCurrency} />
					</TabsContent>

					<TabsContent value="research" className="mt-4 space-y-6">
						{/* 3. Research — third-party market data, explicitly walled off */}
						<div className="max-w-5xl mx-auto rounded-xl divide-y divide-border/10 space-y-6 bg-card">
							{/* Symbol Info Widget — lightweight, keep eager */}
							<div className="pb-4 border-none">
								<ErrorBoundary
									fallback={({ resetErrorBoundary }) => (
										<WidgetErrorFallback height={120} onRetry={resetErrorBoundary} />
									)}
								>
									<SymbolInfo
										symbol={resolvedSymbol}
										colorTheme={resolvedTheme}
										autosize
										isTransparent
									/>
								</ErrorBoundary>
							</div>
							{/* Advanced Chart Widget — lazy loaded */}
							<div className="pt-4 pb-4">
								<LazyWidget height={500}>
									<AdvancedRealTimeChart
										symbol={resolvedSymbol}
										theme={resolvedTheme}
										width="100%"
										height={500}
										interval="D"
										timezone="Etc/UTC"
										style="1"
										locale="en"
										allow_symbol_change={true}
										calendar={false}
										backgroundColor={getChartThemeColors().card}
									/>
								</LazyWidget>
							</div>
							{/* Company Profile Widget — lazy loaded */}
							<div className="pt-4 pb-4">
								<LazyWidget height={390}>
									<CompanyProfile
										symbol={resolvedSymbol}
										colorTheme={resolvedTheme}
										width="100%"
										height={390}
										isTransparent
									/>
								</LazyWidget>
							</div>
							{/* Fundamental Financials Widget — lazy loaded */}
							<div className="pt-4 pb-4">
								<LazyWidget height={490}>
									<FundamentalData
										symbol={resolvedSymbol}
										colorTheme={resolvedTheme}
										width="100%"
										height={490}
										isTransparent
									/>
								</LazyWidget>
							</div>
							{/* Technical Analysis — lazy loaded */}
							<div>
								<LazyWidget height={425}>
									<TechnicalAnalysis
										symbol={resolvedSymbol}
										colorTheme={resolvedTheme}
										width="100%"
										height={425}
										interval="1D"
										isTransparent
									/>
								</LazyWidget>
							</div>
							{/* Timeline/News — lazy loaded */}
							<div>
								<LazyWidget height={425}>
									<Timeline
										feedMode="symbol"
										symbol={resolvedSymbol}
										colorTheme={resolvedTheme}
										width="100%"
										height={425}
										isTransparent
									/>
								</LazyWidget>
							</div>
							{/* Powered by TradingView Attribution (Integrated cleanly at the bottom) */}
							<div className="pt-6 flex flex-col gap-2 justify-center items-center text-center">
								<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
									<svg
										className="h-5 w-5 fill-foreground"
										viewBox="0 0 28 28"
										xmlns="http://www.w3.org/2000/svg"
										role="img"
									>
										<title>TradingView Logo</title>
										<path d="M0 0h28v28H0z" fill="none" />
										<path d="M12.3 8.3c-.3-.3-.8-.3-1.1 0L6.7 12.8c-.3.3-.3.8 0 1.1l4.5 4.5c.3.3.8.3 1.1 0l4.5-4.5c.3-.3.3-.8 0-1.1L12.3 8.3zm0 7.8l-3.3-3.3 3.3-3.3 3.3 3.3-3.3 3.3zM19.1 11.2h4.5v1.6h-4.5v-1.6zm0 4h4.5v1.6h-4.5v-1.6z" />
									</svg>
									<span>Powered by TradingView</span>
								</div>
								<p className="text-xs text-muted-foreground max-w-md">
									Charts, financial data, company profiles, and technical analysis are powered by
									TradingView’s interactive, real-time widgets.
								</p>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="tax-lots" className="mt-4">
						<TaxLotsTab
							positionId={taxLotsPositionId}
							symbol={symbol}
							currency={resolvedCurrency}
							currentPrice={resolvedPrice}
							portfolioTaxWrapper={portfolioContext?.selectedPortfolio?.taxWrapper}
						/>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
