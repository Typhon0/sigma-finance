import type { EChartsOption } from "echarts";
import React from "react";
import { EChartsDataFormatter } from "@/lib/charts/echarts";

/**
 * Chart interaction utilities for Apache ECharts components
 */

export interface ChartTooltipConfig {
	showCrosshair?: boolean;
	showDataZoom?: boolean;
	showBrush?: boolean;
	customFormatter?: (params: unknown) => string;
}

export interface ChartInteractionConfig {
	enableZoom?: boolean;
	enablePan?: boolean;
	enableBrush?: boolean;
	enableDataZoom?: boolean;
	zoomOnMouseWheel?: boolean;
	panOnDrag?: boolean;
}

/**
 * Create enhanced tooltip configuration
 */
export function createTooltipConfig(config: ChartTooltipConfig = {}): Partial<EChartsOption> {
	const { showCrosshair = true, showDataZoom = false, showBrush = false, customFormatter } = config;

	return {
		tooltip: {
			trigger: "axis",
			axisPointer: {
				type: showCrosshair ? "cross" : "line",
				crossStyle: {
					color: "hsl(var(--muted-foreground))",
				},
				lineStyle: {
					color: "hsl(var(--muted-foreground))",
				},
			},
			backgroundColor: "hsl(var(--popover))",
			borderColor: "hsl(var(--border))",
			borderWidth: 1,
			textStyle: {
				color: "hsl(var(--popover-foreground))",
				fontSize: 12,
			},
			formatter:
				customFormatter ||
				((params: unknown) => {
					if (Array.isArray(params)) {
						const items = params as Array<Record<string, unknown>>;
						let result = `<div style="font-weight: 600; margin-bottom: 4px;">${(items[0]?.axisValue as string) || ""}</div>`;
						items.forEach((param) => {
							const color = (param.color as string) || "#000";
							const rawValue = param.value;
							const value =
								typeof rawValue === "number"
									? EChartsDataFormatter.formatCurrency(rawValue)
									: String(rawValue);
							result += `
              <div style="display: flex; align-items: center; margin: 2px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>
                <span style="margin-right: 8px;">${param.seriesName as string}:</span>
                <span style="font-weight: 600;">${value}</span>
              </div>
            `;
						});
						return result;
					}
					const p = params as Record<string, unknown>;
					return `${p.seriesName as string}: ${EChartsDataFormatter.formatCurrency(p.value as number)}`;
				}),
		},
		...(showDataZoom && {
			dataZoom: [
				{
					type: "inside",
					xAxisIndex: 0,
					filterMode: "none",
				},
				{
					type: "slider",
					xAxisIndex: 0,
					filterMode: "none",
					height: 20,
					bottom: 10,
				},
			],
		}),
		...(showBrush && {
			brush: {
				toolbox: ["rect", "polygon", "lineX", "lineY", "keep", "clear"],
				xAxisIndex: 0,
			},
		}),
	};
}

/**
 * Create interaction configuration for charts
 */
export function createInteractionConfig(
	config: ChartInteractionConfig = {},
): Partial<EChartsOption> {
	const {
		enableZoom = true,
		enablePan = true,
		enableBrush = false,
		enableDataZoom = false,
		zoomOnMouseWheel = true,
		panOnDrag = true,
	} = config;

	const interactions: Partial<EChartsOption> = {};

	if (enableZoom || enablePan) {
		interactions.dataZoom = [
			{
				type: "inside",
				xAxisIndex: 0,
				zoomOnMouseWheel: zoomOnMouseWheel,
				moveOnMouseMove: panOnDrag,
				moveOnMouseWheel: false,
			},
		];

		if (enableDataZoom) {
			interactions.dataZoom.push({
				type: "slider",
				xAxisIndex: 0,
				height: 20,
				bottom: 10,
			});
		}
	}

	if (enableBrush) {
		interactions.brush = {
			toolbox: ["rect", "polygon", "lineX", "lineY", "keep", "clear"],
			xAxisIndex: 0,
		};
	}

	return interactions;
}

/**
 * Performance chart tooltip formatter
 */
export function performanceTooltipFormatter(params: unknown): string {
	if (Array.isArray(params)) {
		const items = params as Array<Record<string, unknown>>;
		const date = (items[0]?.axisValue as string) || "";
		let result = `<div style="font-weight: 600; margin-bottom: 8px; color: hsl(var(--foreground));">${date}</div>`;

		items.forEach((param) => {
			const color = (param.color as string) || "#000";
			const rawValue = param.value;
			const value =
				typeof rawValue === "number"
					? EChartsDataFormatter.formatCurrency(rawValue)
					: String(rawValue);

			// Calculate change if previous value is available
			const data = param.data as Record<string, unknown> | undefined;
			const change = data?.change as number | undefined;
			const changeText =
				change !== undefined
					? `<span style="color: ${change >= 0 ? "#22c55e" : "#ef4444"}; font-size: 11px;">
             (${change >= 0 ? "+" : ""}${EChartsDataFormatter.formatPercentage(change, 2)})
           </span>`
					: "";

			result += `
        <div style="display: flex; align-items: center; justify-content: space-between; margin: 4px 0; padding: 2px 0;">
          <div style="display: flex; align-items: center;">
            <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>
            <span style="color: hsl(var(--muted-foreground)); font-size: 12px;">${param.seriesName as string}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-weight: 600; color: hsl(var(--foreground));">${value}</span>
            ${changeText}
          </div>
        </div>
      `;
		});
		return result;
	}

	const p = params as Record<string, unknown>;
	const rawValue = p.value;
	const value =
		typeof rawValue === "number" ? EChartsDataFormatter.formatCurrency(rawValue) : String(rawValue);
	return `${p.seriesName as string}: ${value}`;
}

/**
 * Allocation chart tooltip formatter
 */
export function allocationTooltipFormatter(params: unknown): string {
	const { name, value, percent, color } = params as Record<string, unknown>;
	const formattedValue = EChartsDataFormatter.formatCurrency(value as number);
	const formattedPercent = EChartsDataFormatter.formatPercentage(percent as number, 1);

	return `
    <div style="padding: 8px;">
      <div style="display: flex; align-items: center; margin-bottom: 6px;">
        <span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>
        <span style="font-weight: 600; color: hsl(var(--foreground));">${name}</span>
      </div>
      <div style="margin-left: 20px;">
        <div style="color: hsl(var(--muted-foreground)); font-size: 12px;">Value: <span style="font-weight: 600; color: hsl(var(--foreground));">${formattedValue}</span></div>
        <div style="color: hsl(var(--muted-foreground)); font-size: 12px;">Allocation: <span style="font-weight: 600; color: hsl(var(--foreground));">${formattedPercent}</span></div>
      </div>
    </div>
  `;
}

/**
 * Comparison chart tooltip formatter
 */
export function comparisonTooltipFormatter(params: unknown): string {
	if (Array.isArray(params)) {
		const items = params as Array<Record<string, unknown>>;
		const date = (items[0]?.axisValue as string) || "";
		let result = `<div style="font-weight: 600; margin-bottom: 8px; color: hsl(var(--foreground)); border-bottom: 1px solid hsl(var(--border)); padding-bottom: 4px;">${date}</div>`;

		// Sort by value for better readability
		const sortedParams = [...items].sort(
			(a, b) => ((b.value as number) || 0) - ((a.value as number) || 0),
		);

		sortedParams.forEach((param, index) => {
			const color = (param.color as string) || "#000";
			const rawValue = param.value;
			const value =
				typeof rawValue === "number"
					? EChartsDataFormatter.formatCurrency(rawValue)
					: String(rawValue);

			const isTop = index === 0;
			const rankIcon = isTop ? "👑" : `#${index + 1}`;

			result += `
        <div style="display: flex; align-items: center; justify-content: space-between; margin: 4px 0; padding: 3px 0; ${isTop ? "background-color: hsl(var(--muted)/0.3); border-radius: 4px; padding: 4px 6px;" : ""}">
          <div style="display: flex; align-items: center;">
            <span style="font-size: 10px; margin-right: 4px;">${rankIcon}</span>
            <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; margin-right: 8px;"></span>
            <span style="color: hsl(var(--muted-foreground)); font-size: 12px; ${isTop ? "font-weight: 600;" : ""}">${param.seriesName as string}</span>
          </div>
          <span style="font-weight: 600; color: hsl(var(--foreground)); ${isTop ? "font-size: 13px;" : ""}">${value}</span>
        </div>
      `;
		});
		return result;
	}

	const p = params as Record<string, unknown>;
	const rawValue = p.value;
	const value =
		typeof rawValue === "number" ? EChartsDataFormatter.formatCurrency(rawValue) : String(rawValue);
	return `${p.seriesName as string}: ${value}`;
}

/**
 * Chart legend configuration
 */
export function createLegendConfig(
	position: "top" | "bottom" | "left" | "right" = "top",
): Partial<EChartsOption> {
	const baseConfig = {
		show: true,
		textStyle: {
			color: "hsl(var(--foreground))",
			fontSize: 12,
		},
		itemGap: 20,
		itemWidth: 14,
		itemHeight: 14,
	};

	switch (position) {
		case "top":
			return {
				legend: {
					...baseConfig,
					top: 10,
					left: "center",
					orient: "horizontal",
				},
			};
		case "bottom":
			return {
				legend: {
					...baseConfig,
					bottom: 10,
					left: "center",
					orient: "horizontal",
				},
			};
		case "left":
			return {
				legend: {
					...baseConfig,
					left: 10,
					top: "middle",
					orient: "vertical",
				},
			};
		case "right":
			return {
				legend: {
					...baseConfig,
					right: 10,
					top: "middle",
					orient: "vertical",
				},
			};
		default:
			return { legend: baseConfig };
	}
}

/**
 * Responsive chart configuration
 */
export function createResponsiveConfig(
	breakpoint: "mobile" | "tablet" | "desktop" = "desktop",
): Partial<EChartsOption> {
	switch (breakpoint) {
		case "mobile":
			return {
				grid: {
					left: "8%",
					right: "8%",
					top: "15%",
					bottom: "20%",
					containLabel: true,
				},
				xAxis: {
					axisLabel: {
						fontSize: 10,
						rotate: 45,
					},
				},
				yAxis: {
					axisLabel: {
						fontSize: 10,
					},
				},
				legend: {
					textStyle: {
						fontSize: 10,
					},
					itemWidth: 10,
					itemHeight: 10,
					itemGap: 10,
				},
			};
		case "tablet":
			return {
				grid: {
					left: "6%",
					right: "6%",
					top: "12%",
					bottom: "15%",
					containLabel: true,
				},
				xAxis: {
					axisLabel: {
						fontSize: 11,
					},
				},
				yAxis: {
					axisLabel: {
						fontSize: 11,
					},
				},
				legend: {
					textStyle: {
						fontSize: 11,
					},
					itemWidth: 12,
					itemHeight: 12,
					itemGap: 15,
				},
			};
		default:
			return {
				grid: {
					left: "4%",
					right: "4%",
					top: "10%",
					bottom: "10%",
					containLabel: true,
				},
			};
	}
}

/**
 * Chart animation configuration
 */
export function createAnimationConfig(
	enabled: boolean = true,
	duration: number = 1000,
): Partial<EChartsOption> {
	if (!enabled) {
		return {
			animation: false,
		};
	}

	return {
		animation: true,
		animationDuration: duration,
		animationEasing: "cubicOut",
		animationDelay: (idx: number) => idx * 50,
		animationDurationUpdate: 300,
		animationEasingUpdate: "cubicOut",
	};
}

/**
 * Chart loading configuration
 */
export function createLoadingConfig(): Record<string, unknown> {
	return {
		text: "Loading...",
		color: "hsl(var(--primary))",
		textColor: "hsl(var(--foreground))",
		maskColor: "hsl(var(--background)/0.8)",
		zlevel: 0,
		fontSize: 12,
		showSpinner: true,
		spinnerRadius: 10,
		lineWidth: 2,
	};
}

/**
 * Hook for responsive chart configuration
 */
export function useResponsiveChart() {
	const [breakpoint, setBreakpoint] = React.useState<"mobile" | "tablet" | "desktop">("desktop");

	React.useEffect(() => {
		const updateBreakpoint = () => {
			const width = window.innerWidth;
			if (width < 768) {
				setBreakpoint("mobile");
			} else if (width < 1024) {
				setBreakpoint("tablet");
			} else {
				setBreakpoint("desktop");
			}
		};

		updateBreakpoint();
		window.addEventListener("resize", updateBreakpoint);
		return () => window.removeEventListener("resize", updateBreakpoint);
	}, []);

	return {
		breakpoint,
		config: createResponsiveConfig(breakpoint),
	};
}
