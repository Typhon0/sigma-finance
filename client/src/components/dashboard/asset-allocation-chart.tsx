import type { ECElementEvent, EChartsCoreOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import {
	InlineChartSkeleton,
	useComponentErrorHandler,
} from "@/components/dashboard/error-handling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withErrorBoundary } from "@/components/ui/error-boundary";
import { getAssetTypeColor } from "@/lib/chart-colors";
import { formatCurrency } from "@/lib/utils";
import type { AssetAllocationData } from "@/lib/utils/portfolio-calculations";

function formatAssetTypeName(assetType: string): string {
	return assetType
		.replace(/_/g, " ")
		.toLowerCase()
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface AssetAllocationChartProps {
	allocationData: AssetAllocationData[];
	isLoading?: boolean;
	onAssetTypeClick?: (assetType: string) => void;
	className?: string;
}

interface AllocationChartRow {
	name: string;
	value: number;
	percentage: number;
	color: string;
	assetType: string;
}

function AssetAllocationChartComponent({
	allocationData,
	isLoading = false,
	onAssetTypeClick,
	className,
}: AssetAllocationChartProps) {
	const { handleErrorWithRetry } = useComponentErrorHandler("AssetAllocationChart", "chart");

	const chartData = useMemo<AllocationChartRow[]>(() => {
		if (!allocationData || allocationData.length === 0) {
			return [];
		}

		return allocationData
			.filter((item) => item.value > 0)
			.sort((a, b) => b.value - a.value)
			.map((item) => ({
				name: formatAssetTypeName(item.assetType),
				value: item.value,
				percentage: item.percentage,
				color: getAssetTypeColor(item.assetType),
				assetType: item.assetType,
			}));
	}, [allocationData]);

	const totalValue = useMemo(
		() => allocationData.reduce((sum, item) => sum + item.value, 0),
		[allocationData],
	);

	const chartOption = useMemo<EChartsCoreOption>(() => {
		return {
			tooltip: {
				trigger: "item",
				formatter: (params) => {
					if (typeof params !== "object" || params === null || !("data" in params)) {
						return "";
					}

					const row = params.data as AllocationChartRow;
					return `${row.name}<br/>Value: ${formatCurrency(row.value)}<br/>Percentage: ${row.percentage.toFixed(1)}%`;
				},
			},
			legend: {
				bottom: 0,
				left: "center",
				type: "scroll",
				formatter: (name: string) => {
					const row = chartData.find((item) => item.name === name);
					return row ? `${name} (${row.percentage.toFixed(1)}%)` : name;
				},
			},
			series: [
				{
					name: "Asset Allocation",
					type: "pie",
					radius: ["45%", "75%"],
					center: ["50%", "43%"],
					avoidLabelOverlap: true,
					label: { show: false },
					emphasis: {
						label: {
							show: true,
							fontWeight: "bold",
							formatter: "{b}\n{d}%",
						},
					},
					data: chartData.map((item) => ({
						name: item.name,
						value: item.value,
						assetType: item.assetType,
						percentage: item.percentage,
						itemStyle: { color: item.color },
					})),
				},
			],
			graphic: {
				type: "group",
				left: "center",
				top: "38%",
				children: [
					{
						type: "text",
						style: {
							text: "Total Value",
							fill: "#6b7280",
							fontSize: 12,
							textAlign: "center",
						},
						x: -30,
						y: -8,
					},
					{
						type: "text",
						style: {
							text: formatCurrency(totalValue),
							fill: "#111827",
							fontWeight: "bold",
							fontSize: 16,
							textAlign: "center",
						},
						x: -50,
						y: 12,
					},
				],
			},
		};
	}, [chartData, totalValue]);

	const chartEvents = useMemo(
		() => ({
			click: async (params: ECElementEvent) => {
				if (!onAssetTypeClick) {
					return;
				}
				const rawData = params.data;
				if (typeof rawData !== "object" || rawData === null) {
					return;
				}
				if (!("assetType" in rawData)) {
					return;
				}
				const assetType = rawData.assetType;
				if (typeof assetType !== "string" || assetType.length === 0) {
					return;
				}

				await handleErrorWithRetry(async () => {
					onAssetTypeClick(assetType);
				});
			},
		}),
		[handleErrorWithRetry, onAssetTypeClick],
	);

	if (isLoading) {
		return <InlineChartSkeleton height={320} title="Asset Allocation" className={className} />;
	}

	if (chartData.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Asset Allocation</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center justify-center h-80">
					<div className="text-center text-muted-foreground">
						<p className="text-lg font-medium">No data available</p>
						<p className="text-sm">Add assets to your portfolio to see the allocation chart.</p>
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
					<ReactECharts
						option={chartOption}
						onEvents={chartEvents}
						notMerge={true}
						lazyUpdate={true}
						style={{ height: "100%", width: "100%" }}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

export default withErrorBoundary(AssetAllocationChartComponent);
