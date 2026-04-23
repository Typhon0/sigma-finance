import type React from "react";
import LightweightChart from "./LightweightChart";
import SimpleChart from "./SimpleChart";

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
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
	symbol = "BTC/USDT:CRYPTO",
	assetType = "CRYPTO",
	interval = "1D" as ResolutionString,
	theme = "light",
	onChartReady: _onChartReady,
	fallbackToSimpleChart = true,
	height = 400,
	useLightweightCharts = true,
}) => {
	// Use Lightweight Charts by default, with fallback options
	if (useLightweightCharts) {
		return (
			<LightweightChart
				symbol={symbol}
				assetType={assetType}
				height={height}
				theme={theme}
				interval={interval}
				autoRefresh={true}
			/>
		);
	}

	// Fallback to SimpleChart if requested
	if (fallbackToSimpleChart) {
		return (
			<div className="relative h-full w-full">
				<SimpleChart symbol={symbol} assetType={assetType} height={height} />
				<div className="absolute top-2 right-2 z-10">
					<span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
						Fallback Chart
					</span>
				</div>
			</div>
		);
	}

	// Default error state
	return (
		<div
			className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
			style={{ height }}
		>
			<div className="text-center p-6">
				<div className="text-gray-500 mb-2">
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
				<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
					Chart Not Available
				</h3>
				<p className="text-sm text-gray-600 dark:text-gray-400">No chart implementation selected</p>
			</div>
		</div>
	);
};

export default TradingViewChart;
