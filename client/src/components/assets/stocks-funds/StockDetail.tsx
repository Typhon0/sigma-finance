import { ArrowLeft, Bell, ChevronRight, Star, Zap } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { resolveTradingViewSymbol } from "@/lib/resolve-trading-view-symbol";
import { cn } from "@/lib/utils";

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

/** Wraps a lazy TradingView widget with intersection observer to defer loading. */
function LazyWidget({ children, height = 400 }: { children: React.ReactNode; height?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
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
				<Suspense
					fallback={
						<div
							className="flex items-center justify-center bg-muted/20 rounded-lg border border-border/30"
							style={{ height }}
						>
							<div className="flex flex-col items-center gap-3">
								<div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
								<p className="text-xs text-muted-foreground">Loading widget…</p>
							</div>
						</div>
					}
				>
					{children}
				</Suspense>
			) : (
				<div
					className="flex items-center justify-center bg-muted/10 rounded-lg border border-border/20"
					style={{ height }}
				/>
			)}
		</div>
	);
}

interface StockDetailProps {
	symbol: string;
	onBack?: () => void;
	onTrade?: () => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onNavigateToScreener?: (filters: any) => void;
	isPanel?: boolean;
}

export function StockDetail({
	symbol,
	onBack,
	onTrade,
	onNavigateToScreener: _onNavigateToScreener,
	isPanel = false,
}: StockDetailProps) {
	const { theme } = useTheme();
	const resolvedTheme = theme === "dark" ? "dark" : "light";
	const resolvedSymbol = resolveTradingViewSymbol({ symbol, assetType: "STOCK" });
	const containerBg = resolvedTheme === "dark" ? "bg-[#0b0e14]" : "bg-card";

	return (
		<div className="space-y-6 animate-fade-in p-2 sm:p-4 max-w-7xl mx-auto">
			{/* 1. Header & Navigation */}
			<div className="flex flex-col gap-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
					<div className="flex items-center gap-3">
						{onBack && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={onBack}
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<span>Dashboard</span>
							<ChevronRight className="h-3 w-3" />
							<span>Stocks</span>
							<ChevronRight className="h-3 w-3" />
							<span className="text-foreground font-semibold font-mono">{symbol}</span>
						</div>
					</div>

					<div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs flex-1 sm:flex-initial cursor-pointer"
							onClick={() => toast.success(`Added ${symbol} to watchlist`)}
						>
							<Star className="h-3.5 w-3.5 mr-2" /> Watch
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs flex-1 sm:flex-initial cursor-pointer"
							onClick={() => toast.success(`Price alert created for ${symbol}`)}
						>
							<Bell className="h-3.5 w-3.5 mr-2" /> Alert
						</Button>
						<div className="h-4 w-px bg-border/50 mx-1 hidden sm:block" />
						<Button
							size="sm"
							className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-0 flex-1 sm:flex-initial cursor-pointer"
							onClick={() => {
								if (onTrade) {
									onTrade();
								} else {
									toast.info(`Trade action triggered for ${symbol}`);
								}
							}}
						>
							<Zap className="h-3.5 w-3.5 mr-2" /> Trade
						</Button>
					</div>
				</div>

				{/* 3. Main Widgets Unified Page (reproducing the TradingView demo page layout as one page) */}
				<div
					className={cn(
						"max-w-5xl mx-auto rounded-2xl shadow-md divide-y divide-border/10 space-y-6",
						containerBg,
					)}
				>
					{" "}
					{/* Symbol Info Widget — lightweight, keep eager */}
					<div className="pb-4 border-none">
						<SymbolInfo symbol={resolvedSymbol} colorTheme={resolvedTheme} autosize isTransparent />
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
								backgroundColor={resolvedTheme === "dark" ? "#09090b" : "#ffffff"}
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
								className="h-5 w-5 fill-blue-500"
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
			</div>
		</div>
	);
}
