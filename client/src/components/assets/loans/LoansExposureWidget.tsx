import { motion, useReducedMotion } from "framer-motion";
import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface LoanCategorySlice {
	key: string;
	label: string;
	color: string;
	count: number;
	value: number;
	percent: number;
}

export interface LoanEquityData {
	totalCollateralValue: number;
	totalRemainingDebt: number;
	netEquity: number;
	ltvPercent: number;
}

export interface LoansExposureWidgetProps {
	totalGrossDebt: number;
	totalNetDebt?: number;
	slices: LoanCategorySlice[];
	activeFilter?: string | null;
	onSelectCategory?: (key: string | null) => void;
	formatCurrency: (val: number) => string;
	weightedAverageRate: number;
	totalGrossMonthlyPayment: number;
	totalNetMonthlyPayment?: number;
	amortizedRatio: number;
	principalPaidGross: number;
	currencyBreakdown?: Array<{ currency: string; value: number; percent: number }>;
	equityData?: LoanEquityData;
	loading?: boolean;
}

export const LOAN_TYPE_COLORS: Record<string, string> = {
	amortizing: "var(--chart-1)",
	"in-fine": "var(--chart-2)",
	"deferred-interest": "var(--chart-3)",
	"deferred-total": "var(--chart-4)",
	step: "var(--chart-5)",
	mortgage: "var(--chart-1)",
	consumer: "var(--chart-2)",
	student: "var(--chart-3)",
	auto: "var(--chart-4)",
	other: "var(--muted-foreground)",
};

export const LoansExposureWidget = memo(function LoansExposureWidget({
	totalGrossDebt,
	totalNetDebt,
	slices,
	activeFilter,
	onSelectCategory,
	formatCurrency,
	weightedAverageRate,
	totalGrossMonthlyPayment,
	totalNetMonthlyPayment,
	amortizedRatio,
	principalPaidGross,
	currencyBreakdown = [],
	equityData,
	loading = false,
}: LoansExposureWidgetProps) {
	const shouldReduceMotion = useReducedMotion();

	if (loading) {
		return (
			<div className="flex flex-col justify-between h-full space-y-4" aria-busy="true">
				<div className="space-y-2">
					<Skeleton className="h-3 w-28" />
					<Skeleton className="h-2 w-full rounded-full" />
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

	const hasNetDivergence =
		typeof totalNetDebt === "number" && Math.abs(totalGrossDebt - totalNetDebt) > 1;

	return (
		<div className="flex flex-col justify-between h-full space-y-4 text-xs">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
						Debt Structure
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
					aria-label="Debt breakdown distribution by category"
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

				{/* Clickable category slices */}
				<div className="space-y-1 pt-1 max-h-[160px] overflow-y-auto pr-1">
					{slices.length === 0 ? (
						<div className="text-muted-foreground text-micro py-2 text-center">
							No loan records found
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
											? "bg-primary/10 border border-primary/30"
											: "hover:bg-secondary/40 border border-transparent",
									)}
								>
									<span className="flex items-center gap-2 truncate pr-2">
										<span
											className="h-2 w-2 rounded-full shrink-0"
											style={{ backgroundColor: slice.color }}
										/>
										<span className="truncate font-medium text-foreground">{slice.label}</span>
										<span className="text-micro text-muted-foreground shrink-0 font-mono">
											· {slice.count}
										</span>
									</span>
									<span className="font-mono font-semibold shrink-0 tabular-nums">
										{formatCurrency(slice.value)}{" "}
										<span className="text-muted-foreground font-normal text-micro">
											· {slice.percent.toFixed(0)}%
										</span>
									</span>
								</button>
							);
						})
					)}
				</div>
			</div>

			{/* Key Debt Metrics Section */}
			<div className="space-y-2 border-t border-border/20 pt-3">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Weighted Avg Rate (WAC)</span>
					<span className="font-mono font-semibold tabular-nums text-foreground">
						{weightedAverageRate > 0 ? `${weightedAverageRate.toFixed(2)}%` : "--"}
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Monthly Debt Service</span>
					<div className="text-right">
						<span className="font-mono font-semibold tabular-nums text-foreground">
							{totalGrossMonthlyPayment > 0
								? `${formatCurrency(totalGrossMonthlyPayment)} /mo`
								: "--"}
						</span>
						{hasNetDivergence && typeof totalNetMonthlyPayment === "number" && (
							<div className="text-micro text-muted-foreground font-mono">
								Net share: {formatCurrency(totalNetMonthlyPayment)} /mo
							</div>
						)}
					</div>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Principal Amortized</span>
					<div className="text-right">
						<span className="font-mono font-semibold tabular-nums text-gain">
							{amortizedRatio > 0 ? `${amortizedRatio.toFixed(1)}%` : "--"}
						</span>
						{principalPaidGross > 0 && (
							<div className="text-micro text-muted-foreground font-mono">
								{formatCurrency(principalPaidGross)} paid
							</div>
						)}
					</div>
				</div>

				{currencyBreakdown.length > 1 && (
					<div className="flex items-center justify-between border-t border-border/10 pt-2 text-micro text-muted-foreground">
						<span>Currencies</span>
						<span className="font-mono tabular-nums">
							{currencyBreakdown.map((c) => `${c.currency} ${c.percent.toFixed(0)}%`).join(" · ")}
						</span>
					</div>
				)}

				{equityData && equityData.totalCollateralValue > 0 && (
					<div className="space-y-2 border-t border-border/20 pt-3">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
								Net Real Estate Equity
							</span>
							<span className="font-mono text-micro font-semibold text-gain">
								+{formatCurrency(equityData.netEquity)}
							</span>
						</div>
						<div className="rounded-lg bg-secondary/30 p-2.5 space-y-1.5 border border-border/30">
							<div className="flex items-center justify-between text-micro">
								<span className="text-muted-foreground">Collateral Value</span>
								<span className="font-mono font-medium text-foreground">
									{formatCurrency(equityData.totalCollateralValue)}
								</span>
							</div>
							<div className="flex items-center justify-between text-micro">
								<span className="text-muted-foreground">Remaining Debt</span>
								<span className="font-mono font-medium text-loss">
									-{formatCurrency(equityData.totalRemainingDebt)}
								</span>
							</div>
							<div className="flex items-center justify-between text-micro border-t border-border/20 pt-1 font-semibold">
								<span className="text-foreground">Net Acquired Equity</span>
								<span className="font-mono text-gain">
									+{formatCurrency(equityData.netEquity)}
								</span>
							</div>
							<div className="space-y-1 pt-1">
								<div className="flex justify-between text-[10px] text-muted-foreground">
									<span>LTV (Couverture)</span>
									<span className="font-mono font-semibold text-foreground">
										{equityData.ltvPercent.toFixed(1)}%
									</span>
								</div>
								<div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
									<div
										className={cn(
											"h-full rounded-full transition-all",
											equityData.ltvPercent > 80 ? "bg-amber-500" : "bg-emerald-500",
										)}
										style={{ width: `${Math.min(100, Math.max(0, equityData.ltvPercent))}%` }}
									/>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
});
