import { motion, useReducedMotion } from "framer-motion";
import { Building2, Check, DollarSign, Home, Layers, MapPin, Maximize, Percent, RefreshCw } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ExposureDimension = "type" | "location";

export interface RealEstateExposureSlice {
	key: string;
	label: string;
	color: string;
	count: number;
	value: number;
	percent: number;
	surfaceArea?: number;
}

export interface RealEstateExposureWidgetProps {
	totalRealEstateValue: number;
	totalCost: number;
	totalPortfolioValue: number;
	totalSurface: number;
	typeSlices: RealEstateExposureSlice[];
	locationSlices: RealEstateExposureSlice[];
	activeFilter?: string | null;
	activeDimension?: ExposureDimension;
	onSelectSlice?: (key: string | null, dimension: ExposureDimension) => void;
	formatCurrency: (val: number) => string;
	loading?: boolean;
}

export const RealEstateExposureWidget = memo(function RealEstateExposureWidget({
	totalRealEstateValue,
	totalCost,
	totalPortfolioValue,
	totalSurface,
	typeSlices,
	locationSlices,
	activeFilter,
	activeDimension: controlledDimension,
	onSelectSlice,
	formatCurrency,
	loading = false,
}: RealEstateExposureWidgetProps) {
	const shouldReduceMotion = useReducedMotion();
	const [internalDimension, setInternalDimension] = useState<ExposureDimension>("type");
	const dimension = controlledDimension ?? internalDimension;

	const handleDimensionChange = (nextDim: ExposureDimension) => {
		setInternalDimension(nextDim);
		// Reset active filter when switching dimensions
		if (activeFilter) {
			onSelectSlice?.(null, nextDim);
		}
	};

	const currentSlices = dimension === "type" ? typeSlices : locationSlices;

	const totalGainLoss = totalRealEstateValue - totalCost;
	const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
	const portfolioSharePercent =
		totalPortfolioValue > 0 ? (totalRealEstateValue / totalPortfolioValue) * 100 : 0;
	const avgPricePerM2 = totalSurface > 0 ? Math.round(totalRealEstateValue / totalSurface) : null;

	if (loading) {
		return (
			<div className="flex flex-col justify-between h-full space-y-4" aria-busy="true">
				<div className="flex items-center justify-between">
					<Skeleton className="h-3.5 w-24" />
					<Skeleton className="h-5 w-28 rounded-md" />
				</div>
				<Skeleton className="h-2 w-full rounded-full" />
				<div className="space-y-2 pt-1">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
				<div className="pt-3 border-t border-border/20 grid grid-cols-2 gap-2">
					<Skeleton className="h-9 w-full rounded-lg" />
					<Skeleton className="h-9 w-full rounded-lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col justify-between h-full space-y-4 text-xs">
			<div className="space-y-3">
				{/* Header & Commutable Dimension Switcher */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
							Exposure Split
						</span>
						{activeFilter && (
							<button
								type="button"
								onClick={() => onSelectSlice?.(null, dimension)}
								className="text-micro font-medium text-primary hover:underline cursor-pointer ml-1"
							>
								Reset filter
							</button>
						)}
					</div>

					{/* Dimension selector: Type vs Location */}
					<div
						className="inline-flex items-center p-0.5 rounded-md bg-muted border border-border/40 text-micro font-medium"
						role="tablist"
						aria-label="Exposure dimension"
					>
						<button
							type="button"
							role="tab"
							aria-selected={dimension === "type"}
							onClick={() => handleDimensionChange("type")}
							className={cn(
								"px-2 py-0.5 rounded transition-all cursor-pointer font-medium touch-target min-h-[22px]",
								dimension === "type"
									? "bg-background text-foreground shadow-xs font-semibold"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							By Type
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={dimension === "location"}
							onClick={() => handleDimensionChange("location")}
							className={cn(
								"px-2 py-0.5 rounded transition-all cursor-pointer font-medium touch-target min-h-[22px]",
								dimension === "location"
									? "bg-background text-foreground shadow-xs font-semibold"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							By City
						</button>
					</div>
				</div>

				{/* Multi-segment Progress Bar */}
				<div
					className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/60"
					role="img"
					aria-label={`Real estate ${dimension} breakdown`}
				>
					{currentSlices
						.filter((s) => s.percent > 0)
						.map((s) => (
							<motion.div
								key={s.key}
								className={cn(
									"h-full transition-opacity duration-150",
									activeFilter && activeFilter !== s.key ? "opacity-30" : "opacity-100",
								)}
								style={{ backgroundColor: s.color }}
								initial={shouldReduceMotion ? false : { width: 0 }}
								animate={{ width: `${Math.min(100, Math.max(0, s.percent))}%` }}
								transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
							/>
						))}
				</div>

				{/* Clickable slice rows */}
				<div className="space-y-1 pt-1 max-h-[170px] overflow-y-auto pr-0.5">
					{currentSlices.length === 0 ? (
						<p className="text-micro text-muted-foreground py-2 text-center">
							No real estate assets to categorize.
						</p>
					) : (
						currentSlices.map((slice) => {
							const isSelected = activeFilter === slice.key;
							return (
								<button
									key={slice.key}
									type="button"
									onClick={() =>
										onSelectSlice?.(isSelected ? null : slice.key, dimension)
									}
									className={cn(
										"w-full flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors cursor-pointer text-left touch-target min-h-[30px]",
										isSelected
											? "bg-primary/10 border border-primary/30"
											: "hover:bg-muted/60 border border-transparent",
									)}
								>
									<div className="flex items-center gap-2 min-w-0">
										<span
											className="h-2 w-2 rounded-full shrink-0"
											style={{ backgroundColor: slice.color }}
										/>
										<span
											className={cn(
												"truncate max-w-[130px]",
												isSelected ? "font-bold text-foreground" : "font-medium text-foreground/80",
											)}
										>
											{slice.label}
										</span>
										<span className="text-micro text-muted-foreground font-mono">
											({slice.count})
										</span>
									</div>

									<div className="flex items-center gap-2 shrink-0">
										<span className="font-mono text-muted-foreground">
											{formatCurrency(slice.value)}
										</span>
										<span
											className={cn(
												"font-mono text-micro w-10 text-right",
												isSelected ? "font-bold text-primary" : "text-foreground/70",
											)}
										>
											{slice.percent.toFixed(1)}%
										</span>
										{isSelected && <Check className="h-3 w-3 text-primary ml-0.5" />}
									</div>
								</button>
							);
						})
					)}
				</div>
			</div>

			{/* Telemetry Footer: Real Estate Metrics */}
			<div className="pt-3 border-t border-border/20 space-y-2">
				<div className="grid grid-cols-2 gap-2 text-micro">
					<div className="p-2 rounded-md bg-muted/40 border border-border/30">
						<span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
							Portfolio Share
						</span>
						<span className="font-mono font-bold text-foreground text-xs mt-0.5 block">
							{portfolioSharePercent.toFixed(1)}%
						</span>
						<span className="text-muted-foreground text-[10px] block">
							of total net worth
						</span>
					</div>

					<div className="p-2 rounded-md bg-muted/40 border border-border/30">
						<span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
							Surface & Price/m²
						</span>
						<span className="font-mono font-bold text-foreground text-xs mt-0.5 block">
							{totalSurface > 0 ? `${totalSurface.toLocaleString()} m²` : "—"}
						</span>
						<span className="text-muted-foreground text-[10px] block">
							{avgPricePerM2 !== null ? `${formatCurrency(avgPricePerM2)}/m² avg` : "No surface data"}
						</span>
					</div>
				</div>

				{totalCost > 0 && (
					<div className="flex items-center justify-between text-micro px-1 text-muted-foreground font-mono">
						<span>Total Cost Basis:</span>
						<span>{formatCurrency(totalCost)}</span>
						<span>•</span>
						<span
							className={cn(
								"font-bold",
								totalGainLoss >= 0 ? "text-gain" : "text-loss",
							)}
						>
							{totalGainLoss >= 0 ? "+" : ""}
							{formatCurrency(totalGainLoss)} ({totalGainLoss >= 0 ? "+" : ""}
							{totalGainLossPercent.toFixed(1)}%)
						</span>
					</div>
				)}
			</div>
		</div>
	);
});
