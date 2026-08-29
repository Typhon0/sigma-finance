import { BarChart2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { resolveTradingViewSymbol } from "@/lib/resolve-trading-view-symbol";
import LightweightChart from "./LightweightChart";
import SimpleChart from "./SimpleChart";
import TradingViewWidget from "./TradingViewWidget";

type ResolutionString = "1" | "5" | "15" | "30" | "60" | "240" | "1D" | "1W" | "1M";
type _LanguageCode = "en" | "es" | "fr" | "de" | "ja" | "ko" | "zh" | "ru";
type _Timezone = "Etc/UTC" | "America/New_York" | "Europe/London" | "Asia/Tokyo";

interface TradingViewChartProps {
	symbol?: string;
	assetType?: string;
	interval?: ResolutionString;
	theme?: "light" | "dark";
	onChartReady?: () => void;
	fallbackToSimpleChart?: boolean;
	height?: number;
	useLightweightCharts?: boolean;
	autoRefresh?: boolean;
	exchange?: string | null;
	exchangeCode?: string | null;
	baseCurrency?: string | null;
	quoteCurrency?: string | null;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
	symbol = "BTC/USDT:CRYPTO",
	assetType = "CRYPTO",
	interval = "1D" as ResolutionString,
	theme: customTheme,
	onChartReady: _onChartReady,
	fallbackToSimpleChart = true,
	height = 400,
	useLightweightCharts = true,
	autoRefresh,
	exchange,
	exchangeCode,
	baseCurrency,
	quoteCurrency,
}) => {
	const [viewMode, setViewMode] = useState<"local" | "widget">("local");
	const { resolvedTheme } = useTheme();
	const theme = customTheme || resolvedTheme;

	const widgetSymbol = resolveTradingViewSymbol({
		symbol,
		assetType,
		exchange,
		exchangeCode,
		baseCurrency,
		quoteCurrency,
	});
	const resolvedAutoRefresh = autoRefresh ?? assetType === "CRYPTO";

	return (
		<div className="relative w-full h-full group">
			<div className="absolute top-2 right-24 z-20 flex gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
				<Button
					variant="secondary"
					size="sm"
					className="h-7 px-2 text-[10px] font-medium bg-background/80 hover:bg-background backdrop-blur-sm shadow-sm border border-border/40"
					onClick={() => setViewMode(viewMode === "local" ? "widget" : "local")}
				>
					<BarChart2 className="w-3 h-3 mr-1" />
					{viewMode === "local" ? "Live Chart" : "Local Data"}
				</Button>
			</div>

			{viewMode === "widget" ? (
				<TradingViewWidget symbol={widgetSymbol} theme={theme} height={height} />
			) : useLightweightCharts ? (
				<LightweightChart
					symbol={symbol}
					assetType={assetType}
					height={height}
					theme={theme}
					interval={interval}
					autoRefresh={resolvedAutoRefresh}
				/>
			) : fallbackToSimpleChart ? (
				<div className="relative h-full w-full">
					<SimpleChart
						symbol={symbol}
						assetType={assetType}
						height={height}
						autoRefresh={resolvedAutoRefresh}
					/>
					<div className="absolute top-2 right-2 z-10">
						<span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
							Fallback Chart
						</span>
					</div>
				</div>
			) : (
				<div
					className="flex items-center justify-center bg-muted rounded-lg border border-border/40"
					style={{ height }}
				>
					<div className="text-center p-6">
						<div className="text-muted-foreground mb-2">
							<svg
								className="w-12 h-12 mx-auto"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								role="img"
								aria-label="Chart not available"
							>
								<title>Chart not available</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
						</div>
						<h3 className="text-lg font-semibold text-foreground mb-2">Chart Not Available</h3>
						<p className="text-sm text-muted-foreground">No chart implementation selected</p>
					</div>
				</div>
			)}
		</div>
	);
};

export default TradingViewChart;
