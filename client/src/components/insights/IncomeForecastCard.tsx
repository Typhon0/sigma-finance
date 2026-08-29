import { PiggyBank } from "lucide-react";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import type { IncomeForecastData } from "./types";

interface IncomeForecastCardProps {
	cardId: string;
	incomeForecast: IncomeForecastData | null;
	isRecommended: boolean;
	formatCurrency: (value: number) => string;
	setActiveTab: (tab: string) => void;
}

export const IncomeForecastCard = memo(function IncomeForecastCard({
	cardId,
	incomeForecast,
	isRecommended,
	formatCurrency,
	setActiveTab,
}: IncomeForecastCardProps) {
	return (
		<Card
			key={cardId}
			className="relative overflow-hidden border border-border/40 bg-card/25 backdrop-blur-xs p-5 min-h-[220px] flex flex-col justify-between shadow-xs hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
		>
			<div>
				<div className="flex items-center justify-between mb-3">
					<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
						Income Forecast
					</span>
					{isRecommended && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{incomeForecast ? (
					<div className="space-y-3.5">
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-bold font-mono text-foreground">
								{formatCurrency(incomeForecast.forwardAnnual)}
							</span>
							<span className="text-xs text-muted-foreground flex items-center gap-1">
								<span>next 12 months</span>
								<span className="font-mono text-emerald-500 font-bold">
									({incomeForecast.overallYield.toFixed(2)}% yield)
								</span>
							</span>
						</div>

						<div className="space-y-2.5 mt-2 bg-secondary/15 p-3 rounded-lg border border-border/20">
							<div className="text-xs">
								<p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">
									Next payment estimate
								</p>
								<p className="font-semibold text-foreground flex items-center justify-between">
									<span>{incomeForecast.nextPayerSymbol}</span>
									<span className="font-mono text-emerald-500">
										+{formatCurrency(incomeForecast.nextPaymentEst)} expected in{" "}
										{incomeForecast.nextMonthName}
									</span>
								</p>
							</div>

							<div className="text-xs pt-1.5 border-t border-border/30">
								<p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">
									Best payer
								</p>
								<p className="font-semibold text-foreground flex items-center justify-between">
									<span>{incomeForecast.bestPayerSymbol}</span>
									<span className="font-mono text-emerald-500">
										{formatCurrency(incomeForecast.bestPayerAnnual)} / year
									</span>
								</p>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5">
						<PiggyBank className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No dividend income yet</p>
						<p className="text-[10px] text-muted-foreground max-w-[200px] leading-normal">
							Your current holdings are mostly growth assets.
						</p>
					</div>
				)}
			</div>

			{incomeForecast && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setActiveTab("positions")}
						className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						View income →
					</button>
				</div>
			)}
		</Card>
	);
});
