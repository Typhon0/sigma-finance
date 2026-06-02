import { Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RebalancingData } from "./types";

interface RebalancingCardProps {
	cardId: string;
	rebalancingData: RebalancingData | null;
	isRecommended: boolean;
	setActiveTab: (tab: string) => void;
}

export function RebalancingCard({
	cardId,
	rebalancingData,
	isRecommended,
	setActiveTab,
}: RebalancingCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-zinc-950/25 dark:bg-zinc-900/35 backdrop-blur-xs p-5 min-h-[220px] flex flex-col justify-between shadow-xs hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
						Rebalancing
					</span>
					{isRecommended && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{rebalancingData ? (
					<div className="space-y-3.5">
						<div className="flex items-baseline gap-1.5">
							<span
								className={cn(
									"text-2xl font-bold font-mono",
									rebalancingData.needsAttentionCount > 0 ? "text-amber-500" : "text-emerald-500",
								)}
							>
								{rebalancingData.needsAttentionCount > 0
									? `${rebalancingData.needsAttentionCount} alerts`
									: "Balanced"}
							</span>
							<span className="text-xs text-muted-foreground">sector targets</span>
						</div>

						<div className="space-y-2 mt-1">
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Largest drift</span>
								<span className="font-semibold text-foreground flex items-center gap-1">
									<span>{rebalancingData.maxVarianceSector}</span>
									<span
										className={cn(
											"font-mono font-semibold text-[11px]",
											rebalancingData.maxVariance >= 0 ? "text-emerald-500" : "text-rose-500",
										)}
									>
										{rebalancingData.maxVariance >= 0 ? "+" : ""}
										{rebalancingData.maxVariance.toFixed(1)}%
									</span>
								</span>
							</div>
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Total deviation</span>
								<span className="font-mono font-semibold text-foreground">
									{rebalancingData.totalVariance.toFixed(1)}%
								</span>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<Scale className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No targets configured</p>
						<p className="text-[10px] text-muted-foreground max-w-[200px] leading-normal">
							Define model allocation targets to monitor portfolio drift.
						</p>
					</div>
				)}
			</div>

			<div className="flex justify-end mt-2 z-10">
				<button
					type="button"
					onClick={() => setActiveTab("positions")}
					className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
				>
					Define targets →
				</button>
			</div>
		</Card>
	);
}
