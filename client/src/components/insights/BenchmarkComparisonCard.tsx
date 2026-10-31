import { TrendingUp } from "lucide-react";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BenchmarkComparisonData } from "./types";

interface BenchmarkComparisonCardProps {
	cardId: string;
	benchmarkComparison: BenchmarkComparisonData | null;
	isRecommended: boolean;
	setActiveTab: (tab: string) => void;
	/** No card of its own: the insight strip owns the surface. */
	bare?: boolean;
}

export const BenchmarkComparisonCard = memo(function BenchmarkComparisonCard({
	cardId,
	benchmarkComparison,
	isRecommended,
	setActiveTab,
	bare = false,
}: BenchmarkComparisonCardProps) {
	const Wrapper = bare ? "div" : Card;

	return (
		<Wrapper
			key={cardId}
			className={cn(
				"relative flex flex-col justify-between",
				!bare &&
					"overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out",
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
						vs S&amp;P 500
					</span>
					{isRecommended && !bare && (
						<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
							Recommended
						</span>
					)}
				</div>

				{benchmarkComparison ? (
					<div className={cn("space-y-3", bare && "space-y-1")}>
						<div className="flex items-baseline gap-1.5">
							<span
								className={cn(
									"text-2xl font-bold font-mono",
									benchmarkComparison.outperformance >= 0 ? "text-gain" : "text-loss",
								)}
							>
								{benchmarkComparison.outperformance >= 0 ? "+" : ""}
								{benchmarkComparison.outperformance.toFixed(1)}%
							</span>
							<span className="text-xs text-muted-foreground font-semibold">outperformance</span>
						</div>

						{bare ? (
							<p className="text-micro text-muted-foreground">
								You{" "}
								<span
									className={cn(
										"font-mono font-semibold",
										benchmarkComparison.portfolioReturn >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{benchmarkComparison.portfolioReturn >= 0 ? "+" : ""}
									{benchmarkComparison.portfolioReturn.toFixed(1)}%
								</span>{" "}
								· S&amp;P 500{" "}
								<span className="font-mono font-semibold text-foreground">
									{benchmarkComparison.sp500Return >= 0 ? "+" : ""}
									{benchmarkComparison.sp500Return.toFixed(1)}%
								</span>
							</p>
						) : (
							<div className="space-y-2 mt-1">
								<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
									<span className="text-muted-foreground font-medium">Your return</span>
									<span
										className={cn(
											"font-mono font-semibold",
											benchmarkComparison.portfolioReturn >= 0 ? "text-gain" : "text-loss",
										)}
									>
										{benchmarkComparison.portfolioReturn >= 0 ? "+" : ""}
										{benchmarkComparison.portfolioReturn.toFixed(1)}%
									</span>
								</div>
								<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
									<span className="text-muted-foreground font-medium">S&amp;P 500 Return</span>
									<span className="font-mono font-semibold text-muted-foreground">
										{benchmarkComparison.sp500Return >= 0 ? "+" : ""}
										{benchmarkComparison.sp500Return.toFixed(1)}%
									</span>
								</div>
							</div>
						)}
					</div>
				) : bare ? (
					<p className="text-xs text-muted-foreground">
						Needs purchase history to compare against an index.
					</p>
				) : (
					<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
						<TrendingUp className="h-6 w-6 text-muted-foreground/40 shrink-0" />
						<p className="text-xs font-semibold text-foreground/90">No comparison data</p>
						<p className="text-micro text-muted-foreground max-w-[200px] leading-normal">
							Add historical purchases to compare performance vs global index benchmarks.
						</p>
					</div>
				)}
			</div>

			{benchmarkComparison && !bare && (
				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={() => setActiveTab("positions")}
						className="text-micro text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						Detailed comparison →
					</button>
				</div>
			)}
		</Wrapper>
	);
});
