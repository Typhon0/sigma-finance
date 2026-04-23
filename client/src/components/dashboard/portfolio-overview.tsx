import {
	ArrowDownLeft,
	ArrowUpRight,
	Loader2,
	RefreshCw,
	TrendingDown,
	TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

interface PortfolioOverviewProps {
	title: string;
	subtitle?: string;
	totalValue: number;
	change: number;
	changePercentage: number;
	timeframe: string;
	onRefresh: () => void;
	isRefreshing: boolean;
	children?: React.ReactNode;
}

export function PortfolioOverview({
	title,
	subtitle,
	totalValue,
	change,
	changePercentage,
	timeframe,
	onRefresh,
	isRefreshing,
	children,
}: PortfolioOverviewProps) {
	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
					<div className="flex-1">
						<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
						{subtitle && (
							<p className="text-sm sm:text-base text-muted-foreground mt-1">{subtitle}</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										className="h-8 w-8"
										onClick={onRefresh}
										disabled={isRefreshing}
									>
										{isRefreshing ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="h-4 w-4" />
										)}
										<span className="sr-only">Refresh data</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Refresh data</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						{children}
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<output
					className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
					aria-live="polite"
				>
					{formatCurrency(totalValue)}
				</output>
				{change !== 0 && (
					<output
						className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
						aria-live="polite"
					>
						<div
							className={cn(
								"flex items-center gap-1 text-base sm:text-lg font-semibold",
								change > 0 ? "text-success-foreground" : "text-destructive",
							)}
						>
							{change > 0 ? (
								<TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
							) : (
								<TrendingDown className="h-5 w-5 sm:h-6 sm:w-6" />
							)}
							<span>
								{formatCurrency(Math.abs(change))} ({formatPercentage(Math.abs(changePercentage))})
							</span>
						</div>
						<div className="text-xs sm:text-sm text-muted-foreground">{timeframe}</div>
					</output>
				)}
			</CardContent>
		</Card>
	);
}

interface PortfolioCardProps {
	title: string;
	value: number;
	change: number;
	changePercentage: number;
	icon: React.ReactNode;
	timeframe: string;
}

export function PortfolioMetricCard({
	title,
	value,
	change,
	changePercentage,
	icon,
	timeframe,
}: PortfolioCardProps) {
	const isPositive = change >= 0;

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<div className="text-muted-foreground">{icon}</div>
			</CardHeader>
			<CardContent>
				<output className="text-2xl font-bold" aria-live="polite">
					<span className="sr-only">Total portfolio value: {formatCurrency(value)}</span>
					{formatCurrency(value)}
				</output>
				<output className="flex items-center gap-2 text-xs mt-1" aria-live="polite">
					<div
						className={cn(
							"flex items-center gap-1 text-xs",
							isPositive ? "text-success-foreground" : "text-destructive",
						)}
					>
						{isPositive ? (
							<ArrowUpRight className="h-4 w-4" />
						) : (
							<ArrowDownLeft className="h-4 w-4" />
						)}
						<span>
							{formatCurrency(Math.abs(change))} (
							{formatPercentage(Math.abs(changePercentage) / 100)})
						</span>
					</div>
					<span className="text-muted-foreground">{timeframe}</span>
				</output>
			</CardContent>
		</Card>
	);
}
