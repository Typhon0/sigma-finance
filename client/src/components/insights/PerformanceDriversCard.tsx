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

export function PerformanceDriversCard({
	cardId,
	performanceDrivers,
	isRecommended,
	formatCurrency,
	setActiveTab,
}: PerformanceDriversCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-zinc-950/25 dark:bg-zinc-900/35 backdrop-blur-xs p-5 min-h-[220px] flex flex-col justify-between shadow-xs hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
						Performance Drivers
					</span>
					{isRecommended && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none">
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
									performanceDrivers.totalGain >= 0 ? "text-emerald-500" : "text-rose-500",
								)}
							>
								{performanceDrivers.totalGain >= 0 ? "+" : ""}
								{formatCurrency(performanceDrivers.totalGain)}
							</span>
							<span className="text-xs text-muted-foreground">total gain</span>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
									Top contributors
								</p>
								<div className="space-y-1">
									{performanceDrivers.topContributors.length > 0 ? (
										performanceDrivers.topContributors.map((c) => (
											<div key={c.symbol} className="flex justify-between items-center text-xs">
												<span className="truncate w-16 text-muted-foreground font-medium">
													{c.symbol}
												</span>
												<span className="text-emerald-500 font-mono font-semibold">
													+{formatCurrency(c.gain)}
												</span>
											</div>
										))
									) : (
										<span className="text-[10px] text-muted-foreground italic">—</span>
									)}
								</div>
							</div>

							<div>
								<p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
									Worst draggers
								</p>
								<div className="space-y-1">
									{performanceDrivers.worstDraggers.length > 0 ? (
										performanceDrivers.worstDraggers.map((d) => (
											<div key={d.symbol} className="flex justify-between items-center text-xs">
												<span className="truncate w-16 text-muted-foreground font-medium">
													{d.symbol}
												</span>
												<span className="text-rose-500 font-mono font-semibold">
													{formatCurrency(d.gain)}
												</span>
											</div>
										))
									) : (
										<span className="text-[10px] text-muted-foreground italic">—</span>
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
						className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						View details →
					</button>
				</div>
			)}
		</Card>
	);
}
