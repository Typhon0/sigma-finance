import { Activity } from "lucide-react";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import type { PortfolioRiskMetrics } from "@/hooks/use-portfolio-risk-metrics";
import { cn } from "@/lib/utils";
import { RiskMetricRows } from "./RiskMetricRows";
import type { PortfolioHealthData } from "./types";

interface PortfolioHealthCardProps {
	cardId: string;
	portfolioHealth: PortfolioHealthData | null;
	/** Server-measured risk. Null until loaded, or when unavailable. */
	riskMetrics: PortfolioRiskMetrics | null;
	riskMetricsLoading: boolean;
	isRecommended: boolean;
	setActiveTab: (tab: string) => void;
}

export const PortfolioHealthCard = memo(function PortfolioHealthCard({
	cardId,
	portfolioHealth,
	riskMetrics,
	riskMetricsLoading,
	isRecommended,
	setActiveTab,
}: PortfolioHealthCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] flex flex-col justify-between hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-micro font-bold uppercase tracking-widest text-muted-foreground">
						Portfolio Health
					</span>
					<div className="flex items-center gap-1.5">
						{portfolioHealth && (
							<span
								className={cn(
									"px-2 py-0.5 rounded-md text-micro font-extrabold uppercase border tracking-wider select-none",
									portfolioHealth.concentration === "High"
										? "bg-loss/5 text-loss border-loss/10"
										: portfolioHealth.concentration === "Medium"
											? "bg-warning/5 text-warning border-warning/10"
											: "bg-primary/5 text-primary border-primary/15",
								)}
								title={`Concentration, not volatility: based on the largest single position (${portfolioHealth.topHoldingPct.toFixed(1)}% of the portfolio).`}
							>
								Concentration: {portfolioHealth.concentration}
							</span>
						)}
						{isRecommended && (
							<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
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
									<span className="font-mono text-muted-foreground text-micro ml-0.5">
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
									<span className="font-mono text-muted-foreground text-micro ml-0.5">
										{portfolioHealth.largestSectorPct.toFixed(0)}%
									</span>
								</span>
							</div>
						</div>

						{portfolioHealth.missingClassificationCount > 0 && (
							<div className="flex items-center gap-1.5 text-micro text-warning bg-warning/5 px-2.5 py-1.5 rounded-lg border border-warning/10 mt-1 leading-normal font-medium">
								<Activity className="h-3 w-3 shrink-0" />
								<span>
									{portfolioHealth.missingClassificationCount} asset
									{portfolioHealth.missingClassificationCount > 1 ? "s" : ""} need sector metadata
								</span>
							</div>
						)}

						{/* Measured risk, from the performance service. Distinct from
						    the concentration band above: this is volatility and
						    drawdown computed over the actual return series. */}
						<div className="border-t border-border/30 pt-3">
							<span className="text-micro font-bold uppercase tracking-widest text-muted-foreground block mb-2.5">
								Measured risk
							</span>
							{riskMetricsLoading && !riskMetrics ? (
								<p className="text-micro text-muted-foreground">Computing…</p>
							) : riskMetrics ? (
								<RiskMetricRows metrics={riskMetrics} compact />
							) : (
								<p className="text-micro text-muted-foreground leading-normal">
									Risk metrics are unavailable for this portfolio.
								</p>
							)}
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<Activity className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No positions detected</p>
						<p className="text-xs text-muted-foreground max-w-[200px] leading-normal">
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
						className="text-micro text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						Check diversification →
					</button>
				</div>
			)}
		</Card>
	);
});
