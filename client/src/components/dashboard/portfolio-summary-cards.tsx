import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, MoreHorizontal, Pencil, PlusCircle, Trash2 } from "lucide-react";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardFooter,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Skeleton,
} from "@/components/ui";
import type { Portfolio } from "@/gql/graphql";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import type { PortfolioMetrics } from "@/lib/utils/portfolio-calculations";

interface PortfolioSummaryCardsProps {
	portfolios: Portfolio[];
	portfolioMetrics: Record<string, PortfolioMetrics>;
	onPortfolioDelete: (id: string) => void;
}

export function PortfolioSummaryCards({
	portfolios,
	portfolioMetrics,
	onPortfolioDelete,
}: PortfolioSummaryCardsProps) {
	const navigate = useNavigate();

	if (portfolios.length === 0) {
		return (
			<section
				className="text-center py-8"
				aria-labelledby="empty-portfolios-title"
			>
				<Card>
					<CardContent className="p-6">
						<h3 id="empty-portfolios-title" className="text-xl font-semibold">
							No Portfolios Yet
						</h3>
						<p className="text-muted-foreground mt-2">
							Create your first portfolio to start tracking your assets.
						</p>
						<Button className="mt-4" asChild>
							<Link to="/portfolios/create">
								<PlusCircle className="mr-2 h-4 w-4" />
								Create Portfolio
							</Link>
						</Button>
					</CardContent>
				</Card>
			</section>
		);
	}

	const handlePortfolioClick = (portfolioId: string) => {
		navigate({ to: "/portfolios/$portfolioId", params: { portfolioId } });
	};

	const totalOverallValue = portfolios.reduce(
		(acc, p) => acc + (portfolioMetrics[p.id]?.totalValue || 0),
		0,
	);

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{portfolios.map((portfolio) => {
				const metrics = portfolioMetrics[portfolio.id];
				if (!metrics) {
					// This can happen if metrics are still loading
					return (
						<Card key={portfolio.id}>
							<CardContent className="p-4">
								<div className="flex justify-between items-start mb-2">
									<h3 className="font-semibold text-lg">{portfolio.name}</h3>
									<Skeleton className="h-5 w-5" />
								</div>
								<Skeleton className="h-8 w-32 mb-2" />
								<div className="flex items-center gap-2">
									<Skeleton className="h-4 w-16" />
									<Skeleton className="h-4 w-12" />
								</div>
							</CardContent>
						</Card>
					);
				}

				const assetCount = portfolio.assets?.length || 0;
				const allocationPercentage =
					totalOverallValue > 0
						? (metrics.totalValue / totalOverallValue) * 100
						: 0;

				return (
					<Card
						key={portfolio.id}
						className="flex flex-col justify-between transition-transform duration-200 hover:scale-[1.02] focus-within:scale-[1.02] hover:shadow-lg focus-within:shadow-lg"
					>
						<button
							type="button"
							onClick={() => handlePortfolioClick(portfolio.id)}
							className="h-full w-full text-left p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							aria-label={`View details for ${portfolio.name}. Value: ${formatCurrency(metrics.totalValue)}. ${assetCount} assets. ${allocationPercentage.toFixed(1)}% of total portfolio.`}
						>
							<div className="flex justify-between items-start mb-2">
								<h3 className="font-semibold text-lg truncate pr-2">
									{portfolio.name}
									<Badge
										variant={
											metrics.totalGainLoss >= 0 ? "default" : "destructive"
										}
										className={cn(
											"text-xs",
											metrics.totalGainLoss >= 0 &&
												"border-transparent bg-green-600 text-primary-foreground hover:bg-green-600/80",
										)}
									>
										{metrics.totalGainLoss >= 0 ? "▲" : "▼"}{" "}
										{formatPercentage(Math.abs(metrics.totalGainLossPercent))}
									</Badge>
								</h3>
							</div>
							<p className="text-2xl font-bold">
								{formatCurrency(metrics.totalValue)}
							</p>
							<div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
								<span>
									{assetCount} {assetCount === 1 ? "asset" : "assets"}
								</span>
								<span className="font-mono">
									({allocationPercentage.toFixed(1)}%)
								</span>
							</div>
						</button>
						<CardFooter className="p-4 pt-2 flex justify-end">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={(e) => e.stopPropagation()} // Prevent card click
									>
										<MoreHorizontal className="h-4 w-4" />
										<span className="sr-only">More options</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									onClick={(e) => e.stopPropagation()}
								>
									<DropdownMenuItem
										onSelect={() =>
											navigate({
												to: "/portfolios/$portfolioId",
												params: { portfolioId: portfolio.id },
											})
										}
									>
										<Eye className="mr-2 h-4 w-4" />
										View
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() =>
											navigate({
												to: "/portfolios/create",
												search: { portfolioId: portfolio.id },
											})
										}
									>
										<Pencil className="mr-2 h-4 w-4" />
										Edit
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
										onSelect={() => onPortfolioDelete(portfolio.id)}
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</CardFooter>
					</Card>
				);
			})}
		</div>
	);
}

export function PortfolioSummarySkeleton({ count }: { count: number }) {
	const skeletonItems = Array.from({ length: count }, (_, index) => ({
		id: `portfolio-summary-skeleton-${index}`,
	}));
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{skeletonItems.map((item) => (
				<Card key={item.id}>
					<CardContent className="p-4">
						<div className="flex justify-between items-start mb-3">
							<Skeleton className="h-6 w-3/5" />
							<Skeleton className="h-5 w-1/5" />
						</div>
						<Skeleton className="h-8 w-1/2 mb-2" />
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-12" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
