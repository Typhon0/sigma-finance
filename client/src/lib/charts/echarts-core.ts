/**
 * Modular Apache ECharts registration.
 *
 * The default `echarts` entry ships every chart type, component and renderer
 * (~1.1 MB). Only register what this app actually renders so route chunks
 * (especially stocks and crypto) load a fraction of that.
 *
 * Chart types below were inventoried from the option objects in
 * `src/components`: line, bar, pie, treemap, gauge and candlestick. Many charts
 * request the SVG renderer via `opts={{ renderer: "svg" }}`, so both renderers
 * are registered.
 */
import {
	BarChart,
	CandlestickChart,
	GaugeChart,
	LineChart,
	PieChart,
	TreemapChart,
} from "echarts/charts";
import {
	AxisPointerComponent,
	BrushComponent,
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	LegendScrollComponent,
	MarkLineComponent,
	MarkPointComponent,
	TitleComponent,
	ToolboxComponent,
	TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

echarts.use([
	BarChart,
	CandlestickChart,
	GaugeChart,
	LineChart,
	PieChart,
	TreemapChart,
	AxisPointerComponent,
	BrushComponent,
	DataZoomComponent,
	GraphicComponent,
	GridComponent,
	LegendComponent,
	LegendScrollComponent,
	MarkLineComponent,
	MarkPointComponent,
	TitleComponent,
	ToolboxComponent,
	TooltipComponent,
	CanvasRenderer,
	SVGRenderer,
]);

export { echarts };
