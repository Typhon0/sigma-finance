import { Loader2, Minus, TrendingDown, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type PortfolioData, useRealTimeDashboard } from "@/contexts/RealTimeDashboardContext";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

interface RealTimePortfolioValueProps {
	portfolioId: string;
	portfolioName: string;
	className?: string;
	showDetailedMetrics?: boolean;
}

export function RealTimePortfolioValue({
	portfolioId,
	portfolioName,
	className = "",
	showDetailedMetrics = true,
}: RealTimePortfolioValueProps) {
	const { state, actions } = useRealTimeDashboard();
	const [isUpdating, setIsUpdating] = useState(false);
	const [lastUpdate, setLastUpdate] = useState<number | null>(null);
	const [valueDirection, setValueDirection] = useState<"up" | "down" | "neutral">("neutral");
	const [previousValue, setPreviousValue] = useState<number | null>(null);

	const portfolioData = actions.getPortfolioValue(portfolioId);
	const optimisticUpdate = state.optimisticUpdates.get(`portfolio-${portfolioId}`);

	// Use optimistic update if available, otherwise use real-time data
	const currentData = (optimisticUpdate || portfolioData) as PortfolioData | undefined;

	// Handle value changes and animations
	useEffect(() => {
		if (currentData && currentData.timestamp !== lastUpdate) {
			setIsUpdating(true);

			// Determine direction
			if (previousValue !== null && currentData.totalValue !== previousValue) {
				if (currentData.totalValue > previousValue) {
					setValueDirection("up");
				} else if (currentData.totalValue < previousValue) {
					setValueDirection("down");
				} else {
					setValueDirection("neutral");
				}
			}

			setPreviousValue(currentData.totalValue);
			setLastUpdate(currentData.timestamp);

			// Clear updating state after animation
			const timer = setTimeout(() => {
				setIsUpdating(false);
			}, 1000);

			return () => clearTimeout(timer);
		}
	}, [currentData, lastUpdate, previousValue]);

	const { formatCurrency } = useCurrency();

	const formatPercentage = (percent: number) => {
		const sign = percent >= 0 ? "+" : "";
		return `${sign}${percent.toFixed(2)}%`;
	};

	const getValueChangeColor = (value: number) => {
		if (value > 0) return "text-green-600";
		if (value < 0) return "text-red-600";
		return "text-gray-600";
	};

	const getValueChangeBackground = (value: number) => {
		if (value > 0) return "bg-green-50 border-green-200";
		if (value < 0) return "bg-red-50 border-red-200";
		return "bg-gray-50 border-gray-200";
	};

	const getTrendIcon = () => {
		switch (valueDirection) {
			case "up":
				return <TrendingUp className="h-4 w-4 text-green-500" />;
			case "down":
				return <TrendingDown className="h-4 w-4 text-red-500" />;
			default:
				return <Minus className="h-4 w-4 text-gray-500" />;
		}
	};

	const getLastUpdateText = () => {
		if (!currentData?.timestamp) return "No data";

		const now = Date.now();
		const diff = now - currentData.timestamp;

		if (diff < 60000) return "Just now";
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	};

	return (
		<Card
			className={cn(
				"transition-all duration-300",
				isUpdating && "ring-2 ring-blue-200 shadow-lg",
				currentData && getValueChangeBackground(currentData.gainLoss),
				className,
			)}
		>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold">{portfolioName}</CardTitle>
					<div className="flex items-center gap-2">
						{isUpdating && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
						{getTrendIcon()}
						<Badge variant={state.isConnected ? "default" : "destructive"}>
							{state.isConnected ? (
								<>
									<Wifi className="h-3 w-3 mr-1" />
									Live
								</>
							) : (
								<>
									<WifiOff className="h-3 w-3 mr-1" />
									Offline
								</>
							)}
						</Badge>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{currentData ? (
					<>
						{/* Total Value */}
						<div className="space-y-1">
							<div className="flex items-center justify-between">
								<span className="text-sm text-gray-600">Total Value</span>
								<span className="text-xs text-gray-500">{getLastUpdateText()}</span>
							</div>
							<div
								className={cn(
									"text-2xl font-bold transition-all duration-300",
									isUpdating && "scale-105",
								)}
							>
								{formatCurrency(currentData.totalValue)}
							</div>
						</div>

						{/* Gain/Loss */}
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<span className="text-sm text-gray-600">Gain/Loss</span>
								<div
									className={cn(
										"font-semibold transition-all duration-300",
										getValueChangeColor(currentData.gainLoss),
										isUpdating && "scale-105",
									)}
								>
									{formatCurrency(currentData.gainLoss)}
								</div>
							</div>
							<div
								className={cn(
									"text-right font-medium transition-all duration-300",
									getValueChangeColor(currentData.gainLossPercent),
									isUpdating && "scale-105",
								)}
							>
								{formatPercentage(currentData.gainLossPercent)}
							</div>
						</div>

						{/* Detailed Metrics */}
						{showDetailedMetrics && (
							<div className="grid grid-cols-2 gap-4 pt-2 border-t">
								<div className="space-y-1">
									<span className="text-xs text-gray-500">Cost Basis</span>
									<div className="text-sm font-medium">{formatCurrency(currentData.totalCost)}</div>
								</div>
								<div className="space-y-1">
									<span className="text-xs text-gray-500">Return</span>
									<div
										className={cn(
											"text-sm font-medium",
											getValueChangeColor(currentData.gainLossPercent),
										)}
									>
										{formatPercentage(currentData.gainLossPercent)}
									</div>
								</div>
							</div>
						)}
					</>
				) : (
					<div className="flex items-center justify-center py-8">
						<div className="text-center">
							<Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
							<p className="text-sm text-gray-600">Loading portfolio data...</p>
						</div>
					</div>
				)}

				{/* Connection Status */}
				{!state.isConnected && currentData && (
					<div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
						<WifiOff className="h-3 w-3" />
						<span>Showing cached data - reconnecting...</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Hook for optimistic portfolio updates
 */
export function useOptimisticPortfolioUpdate(portfolioId: string) {
	const { actions } = useRealTimeDashboard();

	const updatePortfolioOptimistically = (updates: {
		totalValue?: number;
		totalCost?: number;
		gainLoss?: number;
		gainLossPercent?: number;
	}) => {
		const optimisticData = {
			...updates,
			timestamp: Date.now(),
		};

		actions.addOptimisticUpdate(`portfolio-${portfolioId}`, optimisticData);

		// Remove optimistic update after 5 seconds (assuming real update will arrive)
		setTimeout(() => {
			actions.removeOptimisticUpdate(`portfolio-${portfolioId}`);
		}, 5000);
	};

	const clearOptimisticUpdate = () => {
		actions.removeOptimisticUpdate(`portfolio-${portfolioId}`);
	};

	return {
		updatePortfolioOptimistically,
		clearOptimisticUpdate,
	};
}
