import ReactECharts from "echarts-for-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export interface AssetDistributionData {
	name: string;
	value: number;
	color?: string;
	itemStyle?: {
		color: string;
	};
}

import type { EChartsMouseEventParam, HoveredChartData } from "./types/echarts";

export interface AssetDistributionChartProps {
	data: AssetDistributionData[];
	height?: string;
	currency?: string;
	showPercentage?: boolean;
	formatValue?: (value: number) => string;
	emptyMessage?: string;
}

const defaultColors = [
	"#dc2626", // Red
	"#fbbf24", // Yellow/Amber
	"#22c55e", // Green
	"#3b82f6", // Blue
	"#8b5cf6", // Purple/Violet
	"#f97316", // Orange
	"#000000", // Black
	"#0ea5e9", // Cyan/Sky
	"#ec4899", // Pink
	"#14b8a6", // Teal
	"#a855f7", // Purple
	"#f59e0b", // Amber
];

export function AssetDistributionChart({
	data,
	height = "320px",
	currency = "$",
	showPercentage = true,
	formatValue,
	emptyMessage = "No data available",
}: AssetDistributionChartProps) {
	const [hoveredData, setHoveredData] = useState<HoveredChartData | null>(null);

	const totalValue = useMemo(() => {
		return data.reduce((sum, item) => sum + item.value, 0);
	}, [data]);

	const chartData = useMemo(() => {
		return data.map((item, index) => ({
			...item,
			itemStyle: item.itemStyle || {
				color: item.color || defaultColors[index % defaultColors.length],
			},
		}));
	}, [data]);

	const formatDisplayValue = (value: number): string => {
		if (formatValue) return formatValue(value);
		return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	};

	// Empty state
	if (!data || data.length === 0 || totalValue === 0) {
		return (
			<div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
				<p>{emptyMessage}</p>
			</div>
		);
	}

	const option = {
		tooltip: {
			show: false,
		},
		legend: {
			show: false,
		},
		graphic: {
			type: "group",
			left: "center",
			top: "center",
			children: [
				{
					type: "text",
					z: 100,
					left: "center",
					top: "middle",
					style: {
						text: hoveredData ? hoveredData.name : formatDisplayValue(totalValue),
						textAlign: "center",
						fill: document.documentElement.classList.contains("dark") ? "#fafafa" : "#0a0a0a",
						fontSize: hoveredData ? 16 : 24,
						fontWeight: "600",
						lineHeight: 1.2,
						y: hoveredData ? -15 : 0,
					},
				},
				{
					type: "text",
					z: 100,
					left: "center",
					top: "middle",
					style: {
						text: hoveredData ? formatDisplayValue(hoveredData.value) : "",
						textAlign: "center",
						fill: document.documentElement.classList.contains("dark") ? "#a3a3a3" : "#737373",
						fontSize: 14,
						fontWeight: "500",
						y: 8,
					},
				},
				{
					type: "text",
					z: 100,
					left: "center",
					top: "middle",
					style: {
						text: hoveredData && showPercentage ? `${hoveredData.percent.toFixed(1)}%` : "",
						textAlign: "center",
						fill: document.documentElement.classList.contains("dark") ? "#737373" : "#a3a3a3",
						fontSize: 12,
						fontWeight: "400",
						y: 28,
					},
				},
			],
		},
		series: [
			{
				type: "pie",
				radius: ["60%", "85%"],
				avoidLabelOverlap: false,
				itemStyle: {
					borderRadius: 4,
					borderColor: document.documentElement.classList.contains("dark") ? "#0a0a0a" : "#fafafa",
					borderWidth: 3,
				},
				label: {
					show: false,
				},
				emphasis: {
					scale: false,
					itemStyle: {
						shadowBlur: 0,
					},
				},
				data: chartData,
			},
		],
	};

	return (
		<ReactECharts
			option={option}
			style={{ height }}
			opts={{ renderer: "svg" }}
			onEvents={{
				mouseover: (params: EChartsMouseEventParam) => {
					if (params.componentType === "series" && params.seriesType === "pie") {
						setHoveredData({
							name: params.name,
							value: params.value,
							percent: params.percent,
						});
					}
				},
				mouseout: () => {
					setHoveredData(null);
				},
			}}
		/>
	);
}

// Variant with legend below for more detailed distribution view
export interface AssetDistributionWithLegendProps extends AssetDistributionChartProps {
	showLegend?: boolean;
	onItemClick?: (item: AssetDistributionData) => void;
}

export function AssetDistributionWithLegend({
	data,
	height = "320px",
	currency = "$",
	showPercentage = true,
	formatValue,
	emptyMessage = "No data available",
	showLegend = true,
	onItemClick,
}: AssetDistributionWithLegendProps) {
	const totalValue = useMemo(() => {
		return data.reduce((sum, item) => sum + item.value, 0);
	}, [data]);

	const chartData = useMemo(() => {
		return data.map((item, index) => ({
			...item,
			itemStyle: item.itemStyle || {
				color: item.color || defaultColors[index % defaultColors.length],
			},
		}));
	}, [data]);

	const formatDisplayValue = (value: number): string => {
		if (formatValue) return formatValue(value);
		return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	};

	const getPercentage = (value: number) => {
		if (totalValue === 0) return 0;
		return ((value / totalValue) * 100).toFixed(1);
	};

	return (
		<div className="space-y-4">
			<AssetDistributionChart
				data={data}
				height={height}
				currency={currency}
				showPercentage={showPercentage}
				formatValue={formatValue}
				emptyMessage={emptyMessage}
			/>

			{showLegend && data && data.length > 0 && (
				<div className="space-y-2">
					{chartData.map((item, index) => {
						const color = item.itemStyle?.color || defaultColors[index % defaultColors.length];
						const percentage = getPercentage(item.value);

						return (
							<Button
								key={index}
								variant="ghost"
								onClick={() => onItemClick?.(item)}
								disabled={!onItemClick}
								className="w-full flex items-center justify-between p-2 rounded-lg text-left h-auto"
							>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
									<span className="truncate text-sm">{item.name}</span>
								</div>
								<div className="flex items-center gap-3 shrink-0">
									{showPercentage && (
										<span className="text-xs text-muted-foreground">{percentage}%</span>
									)}
									<span className="text-sm font-medium">{formatDisplayValue(item.value)}</span>
								</div>
							</Button>
						);
					})}
				</div>
			)}
		</div>
	);
}
