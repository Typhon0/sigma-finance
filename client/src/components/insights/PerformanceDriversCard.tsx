import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PerformanceDriversData } from "./types";

interface PerformanceDriversCardProps {
	cardId: string;
	performanceDrivers: PerformanceDriversData | null;
	isRecommended: boolean;
	formatCurrency: (value: number) => string;
	setActiveTab: (tab: string) => void;
}

export const PerformanceDriversCard = memo(function PerformanceDriversCard({
	cardId,
	performanceDrivers,
	isRecommended,
	formatCurrency,
	setActiveTab,
}: PerformanceDriversCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] flex flex-col justify-between hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-micro font-bold uppercase tracking-widest text-muted-foreground">
						Performance Drivers
					</span>
					{isRecommended && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{performanceDrivers ? (
					<div className="space-y-3.5">
						<div className="flex items-baseline gap-1.5">
							<span
								className={cn(
									"text-2xl font-bold font-mono",
									performanceDrivers.totalGain >= 0 ? "text-gain" : "text-loss",
								)}
							>
								{performanceDrivers.totalGain >= 0 ? "+" : ""}
								{formatCurrency(performanceDrivers.totalGain)}
							</span>
							<span className="text-xs text-muted-foreground">total gain</span>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-micro uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
									Top contributors
								</p>
								<div className="space-y-1">
									{performanceDrivers.topContributors.length > 0 ? (
										performanceDrivers.topContributors.map((c) => (
											<div key={c.symbol} className="flex justify-between items-center text-xs">
												<span className="truncate w-16 text-muted-foreground font-medium">
													{c.symbol}
												</span>
												<span className="text-gain font-mono font-semibold">
													+{formatCurrency(c.gain)}
												</span>
											</div>
										))
									) : (
										<span className="text-micro text-muted-foreground italic">—</span>
									)}
								</div>
							</div>

							<div>
								<p className="text-micro uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
									Worst draggers
								</p>
								<div className="space-y-1">
									{performanceDrivers.worstDraggers.length > 0 ? (
										performanceDrivers.worstDraggers.map((d) => (
											<div key={d.symbol} className="flex justify-between items-center text-xs">
												<span className="truncate w-16 text-muted-foreground font-medium">
													{d.symbol}
												</span>
												<span className="text-loss font-mono font-semibold">
													{formatCurrency(d.gain)}
												</span>
											</div>
										))
									) : (
										<span className="text-micro text-muted-foreground italic">—</span>
									)}
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-6 text-center h-[130px]">
						<p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
							Add purchase prices to see your winners and losers.
						</p>
					</div>
				)}
			</div>

			{performanceDrivers && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setActiveTab("positions")}
						className="text-micro text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						View details →
					</button>
				</div>
			)}
		</Card>
	);
});
