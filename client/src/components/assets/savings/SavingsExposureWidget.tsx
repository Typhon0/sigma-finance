import { motion, useReducedMotion } from "framer-motion";
import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface BankSlice {
	key: string;
	label: string;
	color: string;
	count: number;
	value: number;
	percent: number;
	types?: string[];
}

export interface SavingsExposureWidgetProps {
	totalSavingsValue: number;
	slices: BankSlice[];
	activeFilter?: string | null;
	onSelectCategory?: (key: string | null) => void;
	formatCurrency: (val: number) => string;
	weightedApy?: number | null;
	annualYield?: number;
	monthlyIncome?: number;
	currencyBreakdown?: { currency: string; value: number; percent: number }[];
	loading?: boolean;
}

export const SavingsExposureWidget = memo(function SavingsExposureWidget({
	totalSavingsValue,
	slices,
	activeFilter,
	onSelectCategory,
	formatCurrency,
	weightedApy,
	annualYield = 0,
	monthlyIncome = 0,
	currencyBreakdown = [],
	loading = false,
}: SavingsExposureWidgetProps) {
	const shouldReduceMotion = useReducedMotion();

	if (loading) {
		return (
			<div className="flex flex-col justify-between h-full space-y-4" aria-busy="true">
				<div className="space-y-2">
					<Skeleton className="h-3 w-28" />
					<Skeleton className="h-3 w-full rounded-full" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-5 w-full" />
					<Skeleton className="h-5 w-full" />
					<Skeleton className="h-5 w-3/4" />
				</div>
				<div className="pt-3 border-t border-border/20 space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-4/5" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col justify-between h-full space-y-4 text-xs">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
						Institution & Allocation Split
					</span>
					{activeFilter && (
						<button
							type="button"
							onClick={() => onSelectCategory?.(null)}
							className="text-micro font-medium text-primary hover:underline cursor-pointer"
						>
							Reset filter
						</button>
					)}
				</div>

				{/* Multi-segment distribution progress bar */}
				<div
					className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/60"
					role="img"
					aria-label="Savings breakdown distribution by bank"
				>
					{slices
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

				{/* Clickable institution slices */}
				<div className="space-y-1 pt-1 max-h-[160px] overflow-y-auto pr-1">
					{slices.length === 0 ? (
						<div className="text-muted-foreground text-micro py-2 text-center">
							No institution data recorded
						</div>
					) : (
						slices.map((slice) => {
							const isSelected = activeFilter === slice.key;
							return (
								<button
									key={slice.key}
									type="button"
									onClick={() => onSelectCategory?.(isSelected ? null : slice.key)}
									className={cn(
										"w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer",
										isSelected
											? "bg-primary/10 border border-primary/20 text-foreground font-medium"
											: "hover:bg-muted/50 text-foreground/80",
									)}
								>
									<span className="flex items-center gap-2 truncate pr-2 min-w-0">
										<span
											className="h-2 w-2 rounded-full shrink-0"
											style={{ backgroundColor: slice.color }}
										/>
										<span className="truncate font-medium">{slice.label}</span>
										<span className="text-muted-foreground font-mono text-micro shrink-0">
											({slice.count})
										</span>
									</span>
									<span className="font-mono text-right shrink-0">
										<span className="font-semibold text-foreground">
											{formatCurrency(slice.value)}
										</span>
										<span className="text-muted-foreground ml-1.5 text-micro">
											{slice.percent.toFixed(0)}%
										</span>
									</span>
								</button>
							);
						})
					)}
				</div>
			</div>

			{/* Yield and currency summary */}
			<div className="space-y-2 border-t border-border/20 pt-3">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Weighted APY</span>
					<span className="font-mono font-semibold text-foreground">
						{typeof weightedApy === "number" && Number.isFinite(weightedApy) && weightedApy > 0
							? `${weightedApy.toFixed(2)}%`
							: "—"}
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Est. annual yield</span>
					<span
						className={cn(
							"font-mono font-semibold",
							annualYield > 0
								? "text-gain"
								: weightedApy && weightedApy > 0
									? "text-muted-foreground font-normal"
									: "text-foreground",
						)}
					>
						{annualYield > 0
							? `+${formatCurrency(annualYield)} / yr`
							: weightedApy && weightedApy > 0
								? `${formatCurrency(0)} / yr`
								: "—"}
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Est. monthly income</span>
					<span
						className={cn(
							"font-mono font-semibold",
							monthlyIncome > 0
								? "text-gain"
								: weightedApy && weightedApy > 0
									? "text-muted-foreground font-normal"
									: "text-foreground",
						)}
					>
						{monthlyIncome > 0
							? `+${formatCurrency(monthlyIncome)} / mo`
							: weightedApy && weightedApy > 0
								? `${formatCurrency(0)} / mo`
								: "—"}
					</span>
				</div>

				{currencyBreakdown.length > 1 && (
					<div className="pt-2 border-t border-border/15 flex items-center justify-between text-micro text-muted-foreground">
						<span>Currencies</span>
						<div className="flex items-center gap-1.5 font-mono">
							{currencyBreakdown.map((c) => (
								<span key={c.currency} className="px-1 py-0.5 rounded bg-muted">
									{c.currency} {c.percent.toFixed(0)}%
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
});
