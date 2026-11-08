import ReactEChartsCore from "echarts-for-react/esm/core";
import type { EChartsReactProps } from "echarts-for-react/lib/types";
import { forwardRef } from "react";
import { echarts } from "@/lib/charts/echarts-core";

export type EChartProps = Omit<EChartsReactProps, "echarts">;
export type EChartHandle = ReactEChartsCore;

/**
 * ECharts binding for the modular core build.
 *
 * Every chart used to import `echarts-for-react` directly, whose default entry
 * pulls in the full ECharts bundle. This wrapper injects the tree-shaken
 * registration from `lib/charts/echarts-core` instead while keeping the same
 * props/ref API, so consumers only change their import.
 */
const EChart = forwardRef<EChartHandle, EChartProps>(function EChart(props, ref) {
	return <ReactEChartsCore ref={ref} echarts={echarts} {...props} />;
});

export default EChart;
