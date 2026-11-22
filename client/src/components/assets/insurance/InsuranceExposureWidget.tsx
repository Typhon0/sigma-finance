import { motion, useReducedMotion } from "framer-motion";
import { memo, useMemo, useState } from "react";
import type { PortfolioAssetItem } from "@/components/PortfolioProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface InsuranceSlice {
	key: string;
	label: string;
	color: string;
	count: number;
	value: number;
	percent: number;
}

export interface InsuranceExposureWidgetProps {
	totalInsuranceValue: number;
	policies: PortfolioAssetItem[];
	activeFilter?: { type: "insurer" | "category"; key: string } | null;
	onSelectFilter?: (filter: { type: "insurer" | "category"; key: string } | null) => void;
	formatCurrency: (val: number) => string;
	loading?: boolean;
}

const PALETTE = [
	"#3b82f6", // Blue
	"#10b981", // Emerald
	"#8b5cf6", // Purple
	"#f59e0b", // Amber
	"#ec4899", // Pink
	"#06b6d4", // Cyan
	"#6366f1", // Indigo
	"#84cc16", // Lime
];

export const CATEGORY_LABELS: Record<string, string> = {
	life_insurance: "Life Insurance",
	retirement: "Retirement Plan",
	savings: "Capitalisation Contract",
	death_insurance: "Term Life",
	loan_insurance: "Loan Insurance",
	whole_life: "Permanent / Whole Life",
	mixed: "Mixed / Endowment",
};

export function computeAnnualPremium(policy: PortfolioAssetItem): number {
	const amount =
		typeof policy.premiumAmount === "number" && Number.isFinite(policy.premiumAmount)
			? policy.premiumAmount
			: 0;
	const freq = (policy.premiumFrequency || "yearly").toLowerCase();
	switch (freq) {
		case "monthly":
			return amount * 12;
		case "quarterly":
			return amount * 4;
		case "semi-annually":
		case "semi_annually":
			return amount * 2;
		case "yearly":
		case "annually":
		default:
			return amount;
	}
}

export const InsuranceExposureWidget = memo(function InsuranceExposureWidget({
	totalInsuranceValue,
	policies,
	activeFilter,
	onSelectFilter,
	formatCurrency,
	loading = false,
}: InsuranceExposureWidgetProps) {
	const shouldReduceMotion = useReducedMotion();
	const [viewMode, setViewMode] = useState<"insurer" | "category">("insurer");

	// Insurer slices
	const insurerSlices = useMemo((): InsuranceSlice[] => {
		const map = new Map<string, { count: number; value: number }>();
		for (const p of policies) {
			const insurer = p.insurer || p.institution || "Other Insurer";
			const cur = map.get(insurer) || { count: 0, value: 0 };
			cur.count += 1;
			cur.value += p.currentValue || 0;
			map.set(insurer, cur);
		}

		return Array.from(map.entries())
			.sort((a, b) => b[1].value - a[1].value)
			.map(([key, data], idx) => ({
				key,
				label: key,
				color: PALETTE[idx % PALETTE.length],
				count: data.count,
				value: data.value,
				percent: totalInsuranceValue > 0 ? (data.value / totalInsuranceValue) * 100 : 0,
			}));
	}, [policies, totalInsuranceValue]);

	// Category / Type slices
	const categorySlices = useMemo((): InsuranceSlice[] => {
		const map = new Map<string, { count: number; value: number }>();
		for (const p of policies) {
			const cat = p.policyType || p.category || "life_insurance";
			const cur = map.get(cat) || { count: 0, value: 0 };
			cur.count += 1;
			cur.value += p.currentValue || 0;
			map.set(cat, cur);
		}

		return Array.from(map.entries())
			.sort((a, b) => b[1].value - a[1].value)
			.map(([key, data], idx) => ({
				key,
				label: CATEGORY_LABELS[key] || key.replace(/_/g, " "),
				color: PALETTE[(idx + 2) % PALETTE.length],
				count: data.count,
				value: data.value,
				percent: totalInsuranceValue > 0 ? (data.value / totalInsuranceValue) * 100 : 0,
			}));
	}, [policies, totalInsuranceValue]);

	const currentSlices = viewMode === "insurer" ? insurerSlices : categorySlices;

	// Total coverage (Guaranteed death/maturity capital)
	const totalCoverage = useMemo(() => {
		return policies.reduce((sum, p) => {
			const cov =
				typeof p.coverageAmount === "number" && Number.isFinite(p.coverageAmount)
					? p.coverageAmount
					: 0;
			return sum + cov;
		}, 0);
	}, [policies]);

	// Total annual premium burden (cash outflow)
	const annualPremiumBurden = useMemo(() => {
		return policies.reduce((sum, p) => sum + computeAnnualPremium(p), 0);
	}, [policies]);

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
						Exposure & Allocation
					</span>
					<div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-muted border border-border/40 text-micro">
						<button
							type="button"
							onClick={() => setViewMode("insurer")}
							className={cn(
								"px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer",
								viewMode === "insurer"
									? "bg-background text-foreground shadow-xs border border-border/60"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							By Insurer
						</button>
						<button
							type="button"
							onClick={() => setViewMode("category")}
							className={cn(
								"px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer",
								viewMode === "category"
									? "bg-background text-foreground shadow-xs border border-border/60"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							By Type
						</button>
					</div>
				</div>

				{/* Multi-segment distribution progress bar */}
				<div
					className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/60"
					role="img"
					aria-label={`Insurance breakdown by ${viewMode}`}
				>
					{currentSlices
						.filter((s) => s.percent > 0)
						.map((s) => (
							<motion.div
								key={s.key}
								className={cn(
									"h-full transition-opacity duration-150",
									activeFilter && activeFilter.key !== s.key ? "opacity-30" : "opacity-100",
								)}
								style={{ backgroundColor: s.color }}
								initial={shouldReduceMotion ? false : { width: 0 }}
								animate={{ width: `${Math.min(100, Math.max(0, s.percent))}%` }}
								transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
							/>
						))}
				</div>

				{/* Clickable slices list */}
				<div className="space-y-1 pt-1 max-h-[160px] overflow-y-auto pr-1">
					{currentSlices.length === 0 ? (
						<div className="text-muted-foreground text-micro py-2 text-center">
							No policy distribution data recorded
						</div>
					) : (
						currentSlices.map((slice) => {
							const isSelected =
								activeFilter?.type === viewMode && activeFilter?.key === slice.key;
							return (
								<button
									key={slice.key}
									type="button"
									onClick={() =>
										onSelectFilter?.(isSelected ? null : { type: viewMode, key: slice.key })
									}
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

			{/* Guaranteed Coverage & Outflow Commitments Summary */}
			<div className="space-y-2 border-t border-border/20 pt-3">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Guaranteed Capital</span>
					<span className="font-mono font-semibold text-foreground">
						{totalCoverage > 0 ? formatCurrency(totalCoverage) : "—"}
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Annual Premiums</span>
					<span className="font-mono font-semibold text-foreground">
						{annualPremiumBurden > 0 ? `${formatCurrency(annualPremiumBurden)} / yr` : "—"}
					</span>
				</div>

				<div className="flex items-center justify-between text-micro text-muted-foreground pt-1 border-t border-border/10">
					<span>Active Policies</span>
					<span className="font-mono font-semibold text-foreground">
						{policies.length} contract{policies.length !== 1 ? "s" : ""}
					</span>
				</div>
			</div>
		</div>
	);
});
