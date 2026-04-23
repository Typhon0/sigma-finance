import { ArrowDown, ArrowUp, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { AssetListSkeleton, useComponentErrorHandler } from "@/components/dashboard/error-handling";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/utils";

const getPerformanceColorClass = (change: number) => {
	if (change > 0) return "text-green-500";
	if (change < 0) return "text-red-500";
	return "text-gray-500";
};

interface AssetPerformanceData {
	asset: {
		id: string;
		name: string;
		symbol?: string | null;
	};
	performance?: {
		change: number;
		changePercent: number;
		history: { date: string; value: number }[];
	};
}

interface AssetPerformanceProps {
	assets: AssetPerformanceData[];
	isLoading: boolean;
	onAssetClick: (assetId: string) => void;
}

export function AssetPerformance({ assets, isLoading, onAssetClick }: AssetPerformanceProps) {
	const { handleErrorWithRetry } = useComponentErrorHandler("AssetPerformance", "component");
	const sortedAssets = useMemo(() => {
		if (!assets) return [];
		return [...assets].sort((a, b) => {
			const changeA = a.performance?.changePercent ?? 0;
			const changeB = b.performance?.changePercent ?? 0;
			return changeB - changeA;
		});
	}, [assets]);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top Performing Assets</CardTitle>
					<CardDescription>Assets with the best performance today.</CardDescription>
				</CardHeader>
				<CardContent>
					<AssetListSkeleton count={5} showActions={false} />
				</CardContent>
			</Card>
		);
	}

	if (!assets || assets.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top Performing Assets</CardTitle>
					<CardDescription>Assets with the best performance today.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center text-muted-foreground py-8">
						No performance data available.
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top Performing Assets</CardTitle>
				<CardDescription>Assets with the best performance today.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{sortedAssets.slice(0, 5).map(({ asset, performance }) => (
						<Button
							key={asset.id}
							variant="ghost"
							onClick={async () => {
								await handleErrorWithRetry(async () => {
									onAssetClick(asset.id);
								});
							}}
							className="w-full flex items-center justify-between p-2 rounded-md h-auto"
						>
							<div className="flex items-center gap-4">
								<div className="p-2 bg-muted rounded-full">
									{performance && performance.changePercent > 0.001 ? (
										<TrendingUp className="h-6 w-6 text-green-500" />
									) : performance && performance.changePercent < -0.001 ? (
										<TrendingDown className="h-6 w-6 text-red-500" />
									) : (
										<Minus className="h-6 w-6 text-gray-500" />
									)}
								</div>
								<div>
									<div className="font-semibold">{asset.name}</div>
									<div className="text-sm text-muted-foreground">{asset.symbol}</div>
								</div>
							</div>
							<div className="text-right">
								<div
									className={`font-semibold ${
										performance ? getPerformanceColorClass(performance.change) : "text-gray-500"
									}`}
								>
									{performance ? formatCurrency(performance.change) : "$0.00"}
								</div>
								<div
									className={`text-sm ${
										performance
											? getPerformanceColorClass(performance.changePercent)
											: "text-gray-500"
									}`}
								>
									{performance ? (
										<span className="flex items-center justify-end gap-1">
											{performance.changePercent > 0 ? (
												<ArrowUp className="h-4 w-4" />
											) : (
												<ArrowDown className="h-4 w-4" />
											)}
											{formatPercentage(performance.changePercent)}
										</span>
									) : (
										"0.00%"
									)}
								</div>
							</div>
						</Button>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
