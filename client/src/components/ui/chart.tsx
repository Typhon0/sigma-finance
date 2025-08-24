"use client";

import type * as React from "react";
import { createContext, forwardRef, useContext, useId, useMemo } from "react";
import { Legend, type LegendProps, Tooltip, type TooltipProps } from "recharts";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

// Define recharts value and name types
type ValueType = string | number | (string | number)[];
type NameType = string | number;

// Chart Container
const ChartContainer = forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & {
		config: ChartConfig;
		children: React.ReactNode;
	}
>(({ id, className, children, config, ...props }, ref) => {
	const chartId = useId();
	const containerId = `chart-container-${id || chartId}`;

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				id={containerId}
				data-chart-container={containerId}
				ref={ref}
				className={cn(
					"flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-curve]:stroke-primary [&_.recharts-dot[stroke='var(--color-primary)']]:fill-primary [&_.recharts-label_text]:fill-foreground [&_.recharts-polar-grid_[stroke='var(--color-primary)']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle]:fill-primary [&_.recharts-reference-line_line]:stroke-border [&_.recharts-sector]:stroke-primary [&_.recharts-sector[stroke='var(--color-primary)']]:fill-primary [&_.recharts-surface]:outline-none",
					className,
				)}
				{...props}
			>
				<ChartStyle id={containerId} config={config} />
				{children}
			</div>
		</ChartContext.Provider>
	);
});
ChartContainer.displayName = "ChartContainer";

// Chart Context
type ChartConfig = {
	[k in string]: {
		label?: React.ReactNode;
		icon?: React.ComponentType;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<string, string> }
	);
};

const ChartContext = createContext<{
	config: ChartConfig;
} | null>(null);

function useChart() {
	const context = useContext(ChartContext);

	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}

	return context;
}

// Chart Style
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
	const styleString = useMemo(() => {
		return Object.entries(config)
			.map(([key, config]) => {
				const color = config.theme?.[key] || config.color;
				return color
					? `.${id} [data-chart-color="${key}"] {--color-primary: ${color};}`
					: null;
			})
			.filter(Boolean)
			.join("\n");
	}, [config, id]);

	return <style dangerouslySetInnerHTML={{ __html: styleString }} />;
};

// Chart Tooltip
const ChartTooltip = Tooltip;

// Chart Tooltip Content
const chartTooltipContentVariants = tv({
	base: "group rounded-lg border bg-background p-2.5 text-sm shadow-lg transition-all duration-200",
	variants: {
		indicator: {
			line: "group-hover:translate-y-0",
			dot: "group-hover:translate-y-0",
			none: "",
		},
	},
	defaultVariants: {
		indicator: "dot",
	},
});

const ChartTooltipContent = forwardRef<
	HTMLDivElement,
	TooltipProps<ValueType, NameType> &
		React.HTMLAttributes<HTMLDivElement> &
		VariantProps<typeof chartTooltipContentVariants> & {
			hideLabel?: boolean;
			hideIndicator?: boolean;
			indicator?: "line" | "dot" | "none";
			nameKey?: string;
			labelKey?: string;
			label?: string;
			payload?: any[];
		}
>(
	(
		{
			active,
			payload,
			className,
			indicator = "dot",
			hideLabel = false,
			hideIndicator = false,
			label,
			labelFormatter,
			labelClassName,
			formatter,
			color,
			nameKey,
			labelKey,
		},
		ref,
	) => {
		const { config } = useChart();

		const tooltipLabel = useMemo(() => {
			if (hideLabel || !payload?.length) {
				return null;
			}

			const [item] = payload;
			const key = `${labelKey || item.dataKey || "value"}`;
			const itemConfig = config[key];
			const value =
				!labelKey && typeof label === "string"
					? config[label as keyof typeof config]?.label || label
					: itemConfig?.label;

			if (labelFormatter) {
				return (
					<div className={cn("font-medium", labelClassName)}>
						{labelFormatter(value, payload)}
					</div>
				);
			}

			if (!value) {
				return null;
			}

			return <div className={cn("font-medium", labelClassName)}>{value}</div>;
		}, [
			label,
			labelFormatter,
			payload,
			hideLabel,
			labelClassName,
			config,
			labelKey,
		]);

		if (!active || !payload?.length) {
			return null;
		}

		const nestLabel = payload.length === 1 && indicator !== "dot";

		return (
			<div
				ref={ref}
				className={cn(chartTooltipContentVariants({ indicator }), className)}
			>
				{!nestLabel ? tooltipLabel : null}
				<div className="grid gap-1.5">
					{payload.map((item: any, index: number) => {
						const key = `${nameKey || item.name || item.dataKey || "value"}`;
						const itemConfig = config[key];
						const indicatorColor = color || item.color || itemConfig?.color;

						return (
							<div
								key={item.dataKey}
								className={cn(
									"flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
									indicator === "dot" && "items-center",
								)}
							>
								{formatter && item.value !== undefined && item.name ? (
									formatter(item.value, item.name, item, index, payload)
								) : (
									<>
										{itemConfig?.icon ? (
											<itemConfig.icon />
										) : (
											!hideIndicator && (
												<div
													className={cn(
														"shrink-0 rounded-[2px] border-[--color-primary] bg-[--color-primary]",
														{
															"h-2.5 w-2.5": indicator === "dot",
															"w-1": indicator === "line",
														},
													)}
													style={
														{
															"--color-primary": indicatorColor,
														} as React.CSSProperties
													}
												/>
											)
										)}
										<div
											className={cn(
												"flex flex-1 justify-between leading-none",
												nestLabel ? "items-end" : "items-center",
											)}
										>
											<div className="grid gap-1.5">
												{nestLabel ? tooltipLabel : null}
												<span className="text-muted-foreground">
													{itemConfig?.label || item.name}
												</span>
											</div>
											{item.value && (
												<span className="font-mono font-medium tabular-nums text-foreground">
													{item.value.toLocaleString()}
												</span>
											)}
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	},
);
ChartTooltipContent.displayName = "ChartTooltipContent";

// Chart Legend
const ChartLegend = Legend;

// Chart Legend Content
const ChartLegendContent = forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> &
		Pick<LegendProps, "verticalAlign"> & {
			payload?: any[];
			hideIcon?: boolean;
			nameKey?: string;
		}
>(
	(
		{ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
		ref,
	) => {
		const { config } = useChart();

		if (!payload || !payload.length) {
			return null;
		}

		return (
			<div
				ref={ref}
				className={cn(
					"flex items-center justify-center gap-4",
					verticalAlign === "top" ? "pb-3" : "pt-3",
					className,
				)}
			>
				{payload.map((item: any) => {
					const key = `${nameKey || item.dataKey || "value"}`;
					const itemConfig = config[key];

					return (
						<div
							key={item.value}
							className={cn(
								"flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
							)}
						>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className="h-2 w-2 shrink-0 rounded-[2px]"
									style={{
										backgroundColor: item.color,
									}}
								/>
							)}
							{itemConfig?.label}
						</div>
					);
				})}
			</div>
		);
	},
);
ChartLegendContent.displayName = "ChartLegendContent";

export {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	ChartStyle,
	type ChartConfig,
	useChart,
};
