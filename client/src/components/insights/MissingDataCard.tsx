import { Info } from "lucide-react";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DataQualityData } from "./types";

interface MissingDataCardProps {
	cardId: string;
	dataQuality: DataQualityData | null;
	isRecommended: boolean;
	setInsightFilter: (filter: { mode: "sector" | "asset-class"; value: string } | null) => void;
}

export const MissingDataCard = memo(function MissingDataCard({
	cardId,
	dataQuality,
	isRecommended,
	setInsightFilter,
}: MissingDataCardProps) {
	const issuesCount = (dataQuality?.missingCostCount ?? 0) + (dataQuality?.missingSectorCount ?? 0);

	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] flex flex-col justify-between hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-micro font-bold uppercase tracking-widest text-muted-foreground">
						Data Quality
					</span>
					{isRecommended && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{dataQuality ? (
					<div className="space-y-3">
						<div className="flex items-baseline gap-1.5">
							<span
								className={cn(
									"text-2xl font-bold font-mono",
									dataQuality.score < 90 ? "text-warning" : "text-gain",
								)}
							>
								{dataQuality.score.toFixed(0)}%
							</span>
							<span className="text-xs text-muted-foreground font-semibold">health score</span>
						</div>

						<div className="space-y-2 mt-1">
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Missing purchase price</span>
								<span
									className={cn(
										"font-mono font-semibold",
										dataQuality.missingCostCount > 0 ? "text-warning" : "text-foreground",
									)}
								>
									{dataQuality.missingCostCount} assets
								</span>
							</div>
							<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
								<span className="text-muted-foreground font-medium">Missing sector data</span>
								<span
									className={cn(
										"font-mono font-semibold",
										dataQuality.missingSectorCount > 0 ? "text-warning" : "text-foreground",
									)}
								>
									{dataQuality.missingSectorCount} assets
								</span>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<Info className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">Perfect quality</p>
						<p className="text-micro text-muted-foreground max-w-[200px] leading-normal">
							Your portfolio contains complete metadata for all positions.
						</p>
					</div>
				)}
			</div>

			{/* The filter below matches positions whose sector is "Needs metadata".
			    With a complete portfolio that set is empty, so the CTA used to
			    filter the table down to nothing. */}
			{issuesCount > 0 && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setInsightFilter({ mode: "sector", value: "Needs metadata" })}
						className="text-micro text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						Improve data →
					</button>
				</div>
			)}
		</Card>
	);
});
