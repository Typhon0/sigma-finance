import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssetTypeColor } from "@/lib/chart-colors";
import { formatCurrency, formatPercentage } from "@/lib/utils";

interface AllocationData {
	assetType: string;
	value: number;
	percentage: number;
	count: number;
}

interface CompactAllocationChartProps {
	data: AllocationData[];
	title?: string;
	totalValue?: number;
	height?: number;
	showLegend?: boolean;
	maxItems?: number;
	className?: string;
}

export function CompactAllocationChart({
	data,
	title = "Asset Allocation",
	totalValue,
	height: _height = 120,
	showLegend = true,
	maxItems = 5,
	className,
}: CompactAllocationChartProps) {
	// Process and sort data
	const processedData = useMemo(() => {
		if (!data || data.length === 0) return [];

		// Sort by value descending
		const sorted = [...data].sort((a, b) => b.value - a.value);

		// If we have more items than maxItems, group the rest into "Others"
		if (sorted.length > maxItems) {
			const topItems = sorted.slice(0, maxItems - 1);
			const otherItems = sorted.slice(maxItems - 1);

			const othersTotal = otherItems.reduce((sum, item) => sum + item.value, 0);
			const othersPercentage = otherItems.reduce((sum, item) => sum + item.percentage, 0);
			const othersCount = otherItems.reduce((sum, item) => sum + item.count, 0);

			return [
				...topItems,
				{
					assetType: "Others",
					value: othersTotal,
					percentage: othersPercentage,
					count: othersCount,
				},
			];
		}

		return sorted;
	}, [data, maxItems]);

	// Create visual segments for the bar chart
	const segments = useMemo(() => {
		return processedData.map((item) => ({
			...item,
			color: getAssetTypeColor(item.assetType),
			displayName: item.assetType.replace("_", " "),
		}));
	}, [processedData]);

	if (!data || data.length === 0) {
		return (
			<Card className={className}>
				<CardContent className="p-4">
					<div className="flex items-center justify-center h-24 text-muted-foreground">
						No allocation data
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium">{title}</CardTitle>
					{totalValue && <Badge variant="outline">{formatCurrency(totalValue)}</Badge>}
				</div>
			</CardHeader>
			<CardContent className="p-4 pt-0">
				<div className="space-y-3">
					{/* Horizontal Bar Chart */}
					<div className="space-y-2">
						<div className="flex h-4 rounded-full overflow-hidden bg-muted">
							{segments.map((segment, _index) => (
								<div
									key={segment.assetType}
									className="h-full transition-all duration-300 hover:opacity-80"
									style={{
										width: `${segment.percentage}%`,
										backgroundColor: segment.color,
									}}
									title={`${segment.displayName}: ${formatPercentage(segment.percentage)} (${formatCurrency(segment.value)})`}
								/>
							))}
						</div>
					</div>

					{/* Legend */}
					{showLegend && (
						<div className="space-y-1">
							{segments.map((segment) => (
								<div key={segment.assetType} className="flex items-center justify-between text-xs">
									<div className="flex items-center gap-2">
										<div
											className="w-3 h-3 rounded-sm"
											style={{ backgroundColor: segment.color }}
										/>
										<span className="text-muted-foreground">
											{segment.displayName}
											{segment.count > 1 && ` (${segment.count})`}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-medium">{formatPercentage(segment.percentage)}</span>
										<span className="text-muted-foreground">{formatCurrency(segment.value)}</span>
									</div>
								</div>
							))}
						</div>
					)}

					{/* Summary Stats */}
					<div className="pt-2 border-t">
						<div className="flex justify-between text-xs">
							<span className="text-muted-foreground">
								{data.length} asset {data.length === 1 ? "type" : "types"}
							</span>
							<span className="text-muted-foreground">
								{data.reduce((sum, item) => sum + item.count, 0)} total positions
							</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
