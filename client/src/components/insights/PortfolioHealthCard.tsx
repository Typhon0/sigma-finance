import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PortfolioHealthData } from "./types";

interface PortfolioHealthCardProps {
	cardId: string;
	portfolioHealth: PortfolioHealthData | null;
	isRecommended: boolean;
	setActiveTab: (tab: string) => void;
}

export function PortfolioHealthCard({
	cardId,
	portfolioHealth,
	isRecommended,
	setActiveTab,
}: PortfolioHealthCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-zinc-950/25 dark:bg-zinc-900/35 backdrop-blur-xs p-5 min-h-[220px] flex flex-col justify-between shadow-xs hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
						Portfolio Health
					</span>
					<div className="flex items-center gap-1.5">
						{portfolioHealth && (
							<span
								className={cn(
									"px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border shadow-xs tracking-wider select-none",
									portfolioHealth.risk === "High"
										? "bg-rose-500/5 text-rose-500 border-rose-500/10"
										: portfolioHealth.risk === "Medium"
											? "bg-amber-500/5 text-amber-500 border-amber-500/10"
											: "bg-primary/5 text-primary border border-primary/15",
								)}
							>
								Risk: {portfolioHealth.risk}
							</span>
						)}
						{isRecommended && (
							<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none">
								Recommended
							</span>
						)}
					</div>
				</div>

				{portfolioHealth ? (
					<div className="space-y-3">
						<div className="space-y-2">
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Top holding</span>
								<span className="font-semibold text-foreground">
									{portfolioHealth.topHoldingSymbol}{" "}
									<span className="font-mono text-muted-foreground/75 text-[11px] ml-0.5">
										{portfolioHealth.topHoldingPct.toFixed(0)}%
									</span>
								</span>
							</div>

							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Top 3 holdings</span>
								<span className="font-mono font-semibold text-foreground">
									{portfolioHealth.top3Pct.toFixed(0)}%
								</span>
							</div>

							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Largest sector</span>
								<span className="font-semibold text-foreground">
									{portfolioHealth.largestSectorName}{" "}
									<span className="font-mono text-muted-foreground/75 text-[11px] ml-0.5">
										{portfolioHealth.largestSectorPct.toFixed(0)}%
									</span>
								</span>
							</div>
						</div>

						{portfolioHealth.missingClassificationCount > 0 && (
							<div className="flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10 mt-1 leading-normal font-medium">
								<Activity className="h-3 w-3 shrink-0" />
								<span>
									{portfolioHealth.missingClassificationCount} asset
									{portfolioHealth.missingClassificationCount > 1 ? "s" : ""} need sector metadata
								</span>
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<Activity className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No positions detected</p>
						<p className="text-[10px] text-muted-foreground max-w-[200px] leading-normal">
							Add stocks or fund holdings to review portfolio diversification health metrics.
						</p>
					</div>
				)}
			</div>

			{portfolioHealth && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setActiveTab("positions")}
						className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						Check diversification →
					</button>
				</div>
			)}
		</Card>
	);
}
