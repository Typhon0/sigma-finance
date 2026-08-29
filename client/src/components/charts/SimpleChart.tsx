import type { EChartsCoreOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type React from "react";
import { useMemo } from "react";
import { useMarketData } from "@/hooks/useMarketData";

interface SimpleChartProps {
	symbol: string;
	assetType: string;
	height?: number;
	autoRefresh?: boolean;
}

interface ChartPoint {
	time: string;
	price: number;
	volume: number;
}

const SimpleChart: React.FC<SimpleChartProps> = ({
	symbol,
	assetType,
	height = 400,
	autoRefresh,
}) => {
	const resolvedAutoRefresh = autoRefresh ?? assetType === "CRYPTO";
	const { data, loading, error, currentPrice } = useMarketData({
		symbol,
		assetType,
		interval: "1D",
		autoRefresh: resolvedAutoRefresh,
		refreshInterval: 30000,
	});

	const chartData = useMemo<ChartPoint[]>(
		() =>
			data.map((point) => ({
				time: new Date(point.timestamp).toLocaleDateString(),
				price: point.close,
				volume: point.volume ?? 0,
			})),
		[data],
	);

	const option = useMemo<EChartsCoreOption>(() => {
		return {
			grid: {
				left: 36,
				right: 16,
				top: 24,
				bottom: 32,
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: chartData.map((point) => point.time),
				boundaryGap: false,
				axisLine: { lineStyle: { color: "#666" } },
				axisTick: { show: false },
				axisLabel: { fontSize: 12 },
			},
			yAxis: {
				type: "value",
				axisLine: { show: false },
				splitLine: { lineStyle: { color: "#f0f0f0" } },
				axisLabel: {
					fontSize: 12,
					formatter: (value: number) => `$${value.toLocaleString()}`,
				},
			},
			tooltip: {
				trigger: "axis",
				formatter: (params) => {
					if (!Array.isArray(params) || params.length === 0) {
						return "";
					}

					const item = params[0];
					const price = typeof item.value === "number" ? item.value : Number(item.value ?? 0);

					return `Date: ${item.axisValueLabel}<br/>Price: $${price.toLocaleString()}`;
				},
			},
			series: [
				{
					name: "Price",
					type: "line",
					data: chartData.map((point) => point.price),
					smooth: true,
					symbol: "none",
					lineStyle: { color: "#2563eb", width: 2 },
					areaStyle: {
						color: {
							type: "linear",
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: "rgba(37,99,235,0.15)" },
								{ offset: 1, color: "rgba(37,99,235,0)" },
							],
						},
					},
				},
			],
			animation: true,
		};
	}, [chartData]);

	if (loading) {
		return (
			<div className="flex items-center justify-center" style={{ height }}>
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
					<p className="text-sm text-gray-600">Loading chart data...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center" style={{ height }}>
				<div className="text-center text-red-500">
					<p>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative" style={{ height }}>
			{currentPrice && (
				<div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-sm border">
					<div className="text-sm font-medium">${currentPrice.toLocaleString()}</div>
					<div className="text-xs text-gray-500">Current Price</div>
				</div>
			)}

			<ReactECharts
				option={option}
				notMerge={true}
				lazyUpdate={true}
				style={{ height: "100%", width: "100%" }}
			/>
		</div>
	);
};

export default SimpleChart;
