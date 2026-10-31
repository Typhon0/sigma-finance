import { PiggyBank } from "lucide-react";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IncomeForecastData } from "./types";

interface IncomeForecastCardProps {
	cardId: string;
	incomeForecast: IncomeForecastData | null;
	isRecommended: boolean;
	formatCurrency: (value: number) => string;
	setActiveTab: (tab: string) => void;
	/** Brief-row fit: the headline figure only, detail stays behind the drill. */
	compact?: boolean;
	/** No card of its own: the insight strip owns the surface. */
	bare?: boolean;
}

export const IncomeForecastCard = memo(function IncomeForecastCard({
	cardId,
	incomeForecast,
	isRecommended,
	formatCurrency,
	setActiveTab,
	compact = false,
	bare = false,
}: IncomeForecastCardProps) {
	const Wrapper = bare ? "div" : Card;

	return (
		<Wrapper
			key={cardId}
			className={cn(
				"relative flex flex-col justify-between",
				!bare &&
					"overflow-hidden border border-border/40 bg-card/25 hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out",
				!bare && (compact ? "min-h-[160px] p-3.5" : "min-h-[220px] p-5"),
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
						Income Forecast
					</span>
					{isRecommended && !bare && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{incomeForecast ? (
					<div className={cn("space-y-3.5", bare && "space-y-2")}>
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-bold font-mono text-foreground">
								{formatCurrency(incomeForecast.forwardAnnual)}
							</span>
							<span className="text-xs text-muted-foreground flex items-center gap-1">
								<span>next 12 months</span>
								<span className="font-mono text-gain font-bold">
									({incomeForecast.overallYield.toFixed(2)}% yield)
								</span>
							</span>
						</div>

						{/* In the strip the payer table is one line, not a block. */}
						{bare ? (
							<p className="text-micro text-muted-foreground">
								Next:{" "}
								<span className="font-mono font-semibold text-foreground">
									{incomeForecast.nextPayerSymbol}
								</span>{" "}
								<span className="font-mono text-gain">
									≈{formatCurrency(incomeForecast.nextPaymentEst)}
								</span>{" "}
								/ quarter
							</p>
						) : (
							<div
								className={cn(
									"space-y-2.5 mt-2 bg-secondary/15 p-3 rounded-lg border border-border/20",
									compact && "hidden",
								)}
							>
								<div className="text-xs">
									<p className="text-micro uppercase tracking-wider text-muted-foreground font-bold mb-0.5">
										Next payment estimate
									</p>
									<p className="font-semibold text-foreground flex items-center justify-between">
										<span>{incomeForecast.nextPayerSymbol}</span>
										<span className="font-mono text-gain">
											≈{formatCurrency(incomeForecast.nextPaymentEst)} / quarter
										</span>
									</p>
								</div>

								<div className="text-xs pt-1.5 border-t border-border/30">
									<p className="text-micro uppercase tracking-wider text-muted-foreground font-bold mb-0.5">
										Best payer
									</p>
									<p className="font-semibold text-foreground flex items-center justify-between">
										<span>{incomeForecast.bestPayerSymbol}</span>
										<span className="font-mono text-gain">
											{formatCurrency(incomeForecast.bestPayerAnnual)} / year
										</span>
									</p>
								</div>
							</div>
						)}
					</div>
				) : bare ? (
					<p className="text-xs text-muted-foreground">
						No dividend income yet — these holdings are growth assets.
					</p>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5">
						<PiggyBank className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No dividend income yet</p>
						<p className="text-xs text-muted-foreground max-w-[200px] leading-normal">
							Your current holdings are mostly growth assets.
						</p>
					</div>
				)}
			</div>

			{incomeForecast && !bare && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setActiveTab("positions")}
						className="text-micro text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						View income →
					</button>
				</div>
			)}
		</Wrapper>
	);
});
