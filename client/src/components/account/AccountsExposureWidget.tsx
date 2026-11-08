import { motion } from "framer-motion";
import {
	AlertCircle,
	ArrowUpRight,
	Check,
	Coins,
	DollarSign,
	Globe,
	Shield,
	Wallet,
} from "lucide-react";
import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CustodyCategoryKey = "banks" | "savings" | "brokerages" | "exchanges" | "wallets";

export interface CustodySlice {
	key: CustodyCategoryKey;
	label: string;
	color: string;
	count: number;
	value: number;
	percent: number;
}

export interface AccountsExposureWidgetProps {
	totalCashValue: number;
	totalPortfolioValue: number;
	slices: CustodySlice[];
	activeFilter?: CustodyCategoryKey | null;
	onSelectCategory?: (key: CustodyCategoryKey | null) => void;
	formatCurrency: (val: number) => string;
	currencyBreakdown?: { currency: string; value: number; percent: number }[];
	loading?: boolean;
}

export const AccountsExposureWidget = memo(function AccountsExposureWidget({
	totalCashValue,
	totalPortfolioValue,
	slices,
	activeFilter,
	onSelectCategory,
	formatCurrency,
	currencyBreakdown = [],
	loading = false,
}: AccountsExposureWidgetProps) {
	if (loading) {
		return (
			<div className="flex flex-col justify-between h-full space-y-4" aria-busy="true">
				<div className="space-y-2">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-3 w-full rounded-full" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-4/5" />
				</div>
				<div className="pt-3 border-t border-border/20 space-y-2">
					<Skeleton className="h-3 w-28" />
					<Skeleton className="h-4 w-full" />
				</div>
			</div>
		);
	}

	const dryPowderPercent =
		totalPortfolioValue > 0 ? (totalCashValue / totalPortfolioValue) * 100 : 0;
	const investedValue = Math.max(0, totalPortfolioValue - totalCashValue);

	return (
		<div className="flex flex-col justify-between h-full space-y-4 text-xs">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
						Custody Split
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

				{/* Multi-segment custody progress bar */}
				<div
					className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/60"
					role="img"
					aria-label="Custody breakdown distribution"
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
								initial={{ width: 0 }}
								animate={{ width: `${Math.min(100, Math.max(0, s.percent))}%` }}
								transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
							/>
						))}
				</div>

				{/* Clickable slice rows */}
				<div className="space-y-1 pt-1">
					{slices.map((slice) => {
						const isSelected = activeFilter === slice.key;
						return (
							<button
								key={slice.key}
								type="button"
								onClick={() => onSelectCategory?.(isSelected ? null : slice.key)}
								className={cn(
									"w-full flex items-center justify-between px-2 py-1 rounded-md transition-colors text-left cursor-pointer",
									isSelected
										? "bg-primary/10 border border-primary/20 text-foreground font-medium"
										: "hover:bg-muted/50 text-foreground/80",
								)}
							>
								<span className="flex items-center gap-2 truncate pr-2">
									<span
										className="h-2 w-2 rounded-full shrink-0"
										style={{ backgroundColor: slice.color }}
									/>
									<span className="truncate">{slice.label}</span>
									<span className="text-muted-foreground font-mono text-micro">
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
					})}
				</div>
			</div>

			{/* Dry Powder & Currency Summary */}
			<div className="space-y-2.5 border-t border-border/20 pt-3">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Liquid cash</span>
					<span className="font-mono font-semibold text-foreground">
						{formatCurrency(totalCashValue)}
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Dry powder ratio</span>
					<span className="font-mono font-semibold text-foreground">
						{dryPowderPercent.toFixed(1)}%{" "}
						<span className="text-muted-foreground font-normal text-micro">of total</span>
					</span>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Invested assets</span>
					<span className="font-mono font-semibold text-foreground">
						{formatCurrency(investedValue)}
					</span>
				</div>

				{currencyBreakdown.length > 1 && (
					<div className="pt-2 border-t border-border/15 flex items-center justify-between">
						<span className="text-muted-foreground flex items-center gap-1 text-micro">
							<Globe className="h-3 w-3" />
							Currencies
						</span>
						<div className="flex items-center gap-1.5 flex-wrap justify-end">
							{currencyBreakdown.map((curr) => (
								<span
									key={curr.currency}
									className="px-1.5 py-0.5 rounded-sm bg-muted text-micro font-mono font-medium text-foreground/80"
								>
									{curr.currency} {curr.percent.toFixed(0)}%
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
});
