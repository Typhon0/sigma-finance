import { Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CurrencyExposureItem } from "./types";

interface CurrencyExposureCardProps {
	cardId: string;
	currencyExposure: CurrencyExposureItem[];
	isRecommended: boolean;
	formatCurrency: (value: number) => string;
	setActiveTab: (tab: string) => void;
}

export function CurrencyExposureCard({
	cardId,
	currencyExposure,
	isRecommended,
	formatCurrency,
	setActiveTab,
}: CurrencyExposureCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-zinc-950/25 dark:bg-zinc-900/35 backdrop-blur-xs p-5 min-h-[220px] flex flex-col justify-between shadow-xs hover:border-emerald-500/20 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
						Currency Exposure
					</span>
					{isRecommended && (
						<span className="bg-emerald-500/5 text-emerald-500 border border-emerald-500/10 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{currencyExposure.length > 0 ? (
					<div className="space-y-3">
						<div className="flex items-baseline gap-1.5">
							<span className="text-2xl font-bold font-mono text-foreground">
								{currencyExposure[0].currency}
							</span>
							<span className="text-xs text-muted-foreground">
								dominates ({currencyExposure[0].percentage.toFixed(0)}%)
							</span>
						</div>

						<div className="space-y-2 mt-1">
							{currencyExposure.slice(0, 3).map((item) => (
								<div
									key={item.currency}
									className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30"
								>
									<span className="text-muted-foreground font-semibold flex items-center gap-1.5">
										<Globe className="h-3 w-3 text-muted-foreground/60" />
										{item.currency}
									</span>
									<span className="font-mono font-semibold text-foreground">
										{formatCurrency(item.value)}{" "}
										<span className="text-[10px] text-muted-foreground font-normal ml-1">
											({item.percentage.toFixed(1)}%)
										</span>
									</span>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<Globe className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No currencies found</p>
						<p className="text-[10px] text-muted-foreground max-w-[200px] leading-normal">
							Add international investments to analyze global fx distribution.
						</p>
					</div>
				)}
			</div>

			<div className="flex justify-end mt-2 z-10">
				<button
					type="button"
					onClick={() => setActiveTab("positions")}
					className="text-[10px] text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
				>
					View details →
				</button>
			</div>
		</Card>
	);
}
