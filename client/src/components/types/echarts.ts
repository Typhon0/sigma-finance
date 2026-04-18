/**
 * Shared type definitions for ECharts callback and event parameters.
 * Used by components that use echarts-for-react.
 */

export interface EChartsTooltipParam {
	name: string;
	value: number;
}

export interface EChartsMouseEventParam {
	componentType: string;
	seriesType: string;
	name: string;
	value: number;
	percent: number;
}

export interface HoveredChartData {
	name: string;
	value: number;
	percent: number;
}
