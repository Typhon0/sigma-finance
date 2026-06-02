import { FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FeesTerData } from "./types";

interface FeesTerCardProps {
	cardId: string;
	feesTerData: FeesTerData | null;
	isRecommended: boolean;
	formatCurrency: (value: number) => string;
	setActiveTab: (tab: string) => void;
}

export function FeesTerCard({
	cardId,
	feesTerData,
	isRecommended,
	formatCurrency,
	setActiveTab,
}: FeesTerCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-zinc-950/25 dark:bg-zinc-900/35 backdrop-blur-xs p-5 min-h-[220px] flex flex-col justify-between shadow-xs hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
						Fees & TER
					</span>
					{isRecommended && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{feesTerData ? (
					<div className="space-y-3">
						<div className="flex items-baseline gap-1.5">
							<span className="text-2xl font-bold font-mono text-foreground">
								{formatCurrency(feesTerData.annualCost)}
							</span>
							<span className="text-xs text-muted-foreground">est. annual cost</span>
						</div>

						<div className="space-y-2 mt-1">
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Funds/ETFs</span>
								<span className="font-semibold text-foreground">{feesTerData.count} assets</span>
							</div>
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Avg. Expense Ratio</span>
								<span className="font-mono font-semibold text-emerald-500">
									{feesTerData.avgTer}%
								</span>
							</div>
						</div>
						<p className="text-[10px] text-muted-foreground leading-normal mt-1.5 italic">
							Fees eat into returns. Prefer index funds with low expense ratios.
						</p>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<FileSpreadsheet className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No funds detected</p>
						<p className="text-[10px] text-muted-foreground max-w-[200px] leading-normal">
							Add mutual funds or ETFs to calculate expense ratio costs automatically.
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
					View positions →
				</button>
			</div>
		</Card>
	);
}
