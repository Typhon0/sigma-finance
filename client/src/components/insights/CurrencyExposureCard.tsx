import { Globe } from "lucide-react";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CurrencyExposureItem } from "./types";

interface CurrencyExposureCardProps {
	cardId: string;
	currencyExposure: CurrencyExposureItem[];
	isRecommended: boolean;
	formatCurrency: (value: number) => string;
	setActiveTab: (tab: string) => void;
	/** No card of its own: the insight strip owns the surface. */
	bare?: boolean;
}

export const CurrencyExposureCard = memo(function CurrencyExposureCard({
	cardId,
	currencyExposure,
	isRecommended,
	formatCurrency,
	setActiveTab,
	bare = false,
}: CurrencyExposureCardProps) {
	const Wrapper = bare ? "div" : Card;

	return (
		<Wrapper
			key={cardId}
			className={cn(
				"relative flex flex-col justify-between",
				!bare &&
					"overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] hover:border-gain/20 hover:bg-card/75 transition-all duration-300 ease-in-out",
			)}
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span
						className={cn(
							"text-muted-foreground",
							bare ? "text-xs font-medium" : "text-micro font-bold uppercase tracking-widest",
						)}
					>
						Currency Exposure
					</span>
					{isRecommended && !bare && (
						<span className="bg-gain/5 text-gain border border-gain/10 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{currencyExposure.length > 0 ? (
					<div className={cn("space-y-3", bare && "space-y-1")}>
						<div className="flex items-baseline gap-1.5">
							<span className="text-2xl font-bold font-mono text-foreground">
								{currencyExposure[0].currency}
							</span>
							<span className="text-xs text-muted-foreground">
								dominates ({currencyExposure[0].percentage.toFixed(0)}%)
							</span>
						</div>

						<div className={cn("space-y-2 mt-1", bare && "space-y-1")}>
							{currencyExposure.slice(0, bare ? 2 : 3).map((item) => (
								<div
									key={item.currency}
									className={cn(
										"flex justify-between items-center text-xs pb-1.5",
										!bare && "border-b border-border/30",
									)}
								>
									<span className="text-muted-foreground font-semibold flex items-center gap-1.5">
										<Globe className="h-3 w-3 text-muted-foreground/60" />
										{item.currency}
									</span>
									<span className="font-mono font-semibold text-foreground">
										{formatCurrency(item.value)}{" "}
										<span className="text-micro text-muted-foreground font-normal ml-1">
											({item.percentage.toFixed(1)}%)
										</span>
									</span>
								</div>
							))}
						</div>
					</div>
				) : bare ? (
					<p className="text-xs text-muted-foreground">Everything is priced in one currency.</p>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<Globe className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No currencies found</p>
						<p className="text-micro text-muted-foreground max-w-[200px] leading-normal">
							Add international investments to analyze global fx distribution.
						</p>
					</div>
				)}
			</div>

			{!bare && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setActiveTab("positions")}
						className="text-micro text-gain hover:text-gain/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						View details →
					</button>
				</div>
			)}
		</Wrapper>
	);
});
