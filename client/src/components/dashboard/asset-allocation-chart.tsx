import { useMemo } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withErrorBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { getAssetTypeColor } from "@/lib/chart-colors";
import {
	type AssetAllocationData,
	formatCurrency,
} from "@/lib/utils/portfolio-calculations";
import { 
	ChartErrorFallback,
	InlineChartSkeleton,
	useComponentErrorHandler,
} from "@/components/dashboard/error-handling";

// Helper function to format asset type names for display
function formatAssetTypeName(assetType: string): string {
	return assetType
		.replace(/_/g, " ")
		.toLowerCase()
		.replace(/\b\w/g, (l) => l.toUpperCase());
}

interface AssetAllocationChartProps {
	allocationData: AssetAllocationData[];
	isLoading?: boolean;
	onAssetTypeClick?: (assetType: string) => void;
	className?: string;
}

function AssetAllocationChartComponent({
	allocationData,
	isLoading = false,
	onAssetTypeClick,
	className,
}: AssetAllocationChartProps) {
	const { handleErrorWithRetry } = useComponentErrorHandler('AssetAllocationChart', 'chart');
	const chartData = useMemo(() => {
		if (!allocationData || allocationData.length === 0) {
			return [];
		}

		return allocationData
			.filter((item) => item.value > 0) // Only show asset types with value
			.sort((a, b) => b.value - a.value) // Sort by value descending
			.map((item) => ({
				name: formatAssetTypeName(item.assetType), // Format asset type name
				value: item.value,
				percentage: item.percentage,
				color: getAssetTypeColor(item.assetType),
				assetType: item.assetType,
			}));
	}, [allocationData]);

	// Calculate total value for display
	const totalValue = useMemo(() => {
		return allocationData.reduce((sum, item) => sum + item.value, 0);
	}, [allocationData]);

	// Handle pie chart click events
	const handlePieClick = async (data: any) => {
		if (onAssetTypeClick && data && data.assetType) {
			await handleErrorWithRetry(async () => {
				onAssetTypeClick(data.assetType);
			});
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<InlineChartSkeleton 
				height={320}
				title="Asset Allocation"
				className={className}
			/>
		);
	}

	// Empty state
	if (chartData.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Asset Allocation</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center h-80">
					<div className="text-center text-muted-foreground">
						<p className="text-lg font-medium">No data available</p>
						<p className="text-sm">
							Add assets to your portfolio to see the allocation chart.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Asset Allocation</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="h-80 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Tooltip
								content={({ active, payload }) => {
									if (active && payload && payload.length) {
										const data = payload[0].payload;
										return (
											<div className="rounded-lg border bg-background p-2.5 text-sm shadow-lg">
												<div className="font-medium">{data.name}</div>
												<div className="text-muted-foreground">
													<div>Value: {formatCurrency(data.value)}</div>
													<div>Percentage: {data.percentage.toFixed(1)}%</div>
												</div>
											</div>
										);
									}
									return null;
								}}
							/>
							<Legend
								verticalAlign="bottom"
								height={36}
								formatter={(value, entry) => {
									const { color, payload } = entry;
									const percentage = (payload as any)?.percentage;
									return (
										<span style={{ color }}>
											{value} ({percentage?.toFixed(1)}%)
										</span>
									);
								}}
							/>
							<Pie
								data={chartData}
								cx="50%"
								cy="50%"
								labelLine={false}
								outerRadius={80}
								fill="#8884d8"
								dataKey="value"
								nameKey="name"
								onClick={handlePieClick}
							>
								{chartData.map((entry, index) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Pie>
							<foreignObject
								x="50%"
								y="50%"
								width="100"
								height="100"
								style={{ transform: "translate(-50px, -50px)" }}
							>
								<div className="flex flex-col items-center justify-center h-full w-full pointer-events-none">
									<span className="text-xs text-muted-foreground">
										Total Value
									</span>
									<span className="text-2xl font-bold">
										{formatCurrency(totalValue)}
									</span>
								</div>
							</foreignObject>
						</PieChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}

export default withErrorBoundary(AssetAllocationChartComponent);
