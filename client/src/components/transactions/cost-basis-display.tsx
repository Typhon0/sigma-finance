import { Calculator, Eye, EyeOff, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { Position, Transaction } from "@/gql/graphql";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

interface CostBasisData {
	totalCostBasis: number;
	averageCostBasis: number;
	currentValue: number;
	unrealizedGainLoss: number;
	unrealizedGainLossPercent: number;
	realizedGainLoss: number;
	totalQuantity: number;
	transactions: Transaction[];
}

interface CostBasisDisplayProps {
	position: Position;
	costBasisData: CostBasisData;
	isLoading?: boolean;
	showDetails?: boolean;
	compact?: boolean;
}

export function CostBasisDisplay({
	position,
	costBasisData,
	isLoading = false,
	showDetails = false,
	compact = false,
}: CostBasisDisplayProps) {
	const [showBreakdown, setShowBreakdown] = useState(false);

	if (isLoading) {
		return <CostBasisSkeleton compact={compact} />;
	}

	const {
		totalCostBasis,
		averageCostBasis,
		currentValue,
		unrealizedGainLoss,
		unrealizedGainLossPercent,
		realizedGainLoss,
		totalQuantity,
		transactions,
	} = costBasisData;

	const isGain = unrealizedGainLoss >= 0;
	const gainLossColor = isGain ? "text-green-600" : "text-red-600";
	const GainLossIcon = isGain ? TrendingUp : TrendingDown;

	if (compact) {
		return (
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Cost Basis</p>
							<p className="text-lg font-bold">{formatCurrency(averageCostBasis)}</p>
							<p className="text-xs text-muted-foreground">
								{totalQuantity.toLocaleString()} shares
							</p>
						</div>
						<div className="text-right">
							<div className={`flex items-center gap-1 ${gainLossColor}`}>
								<GainLossIcon className="h-4 w-4" />
								<span className="font-medium">{formatCurrency(Math.abs(unrealizedGainLoss))}</span>
							</div>
							<p className={`text-sm ${gainLossColor}`}>
								{formatPercentage(unrealizedGainLossPercent)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Calculator className="h-5 w-5" />
					Cost Basis & Performance
					<Badge variant="outline" className="ml-auto">
						{position.asset.name}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Summary Metrics */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Total Cost Basis</p>
						<p className="text-lg font-semibold">{formatCurrency(totalCostBasis)}</p>
					</div>
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Average Cost</p>
						<p className="text-lg font-semibold">{formatCurrency(averageCostBasis)}</p>
					</div>
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Current Value</p>
						<p className="text-lg font-semibold">{formatCurrency(currentValue)}</p>
					</div>
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Total Quantity</p>
						<p className="text-lg font-semibold">{totalQuantity.toLocaleString()}</p>
					</div>
				</div>

				{/* Gain/Loss Summary */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Card className="border-2">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-muted-foreground">Unrealized Gain/Loss</p>
									<div className={`flex items-center gap-2 ${gainLossColor}`}>
										<GainLossIcon className="h-5 w-5" />
										<span className="text-xl font-bold">
											{isGain ? "+" : ""}
											{formatCurrency(unrealizedGainLoss)}
										</span>
									</div>
									<p className={`text-sm ${gainLossColor}`}>
										{formatPercentage(unrealizedGainLossPercent)}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="border-2">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-muted-foreground">Realized Gain/Loss</p>
									<div
										className={`flex items-center gap-2 ${realizedGainLoss >= 0 ? "text-green-600" : "text-red-600"}`}
									>
										{realizedGainLoss >= 0 ? (
											<TrendingUp className="h-5 w-5" />
										) : (
											<TrendingDown className="h-5 w-5" />
										)}
										<span className="text-xl font-bold">
											{realizedGainLoss >= 0 ? "+" : ""}
											{formatCurrency(realizedGainLoss)}
										</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Cost Basis Calculation Method */}
				<Alert>
					<Info className="h-4 w-4" />
					<AlertDescription>
						Cost basis is calculated using the FIFO (First In, First Out) method. This means the
						oldest shares are considered sold first when calculating realized gains/losses.
					</AlertDescription>
				</Alert>

				{/* Transaction Breakdown */}
				{showDetails && transactions.length > 0 && (
					<Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
						<CollapsibleTrigger asChild>
							<Button variant="outline" className="w-full">
								<Calculator className="h-4 w-4 mr-2" />
								{showBreakdown ? "Hide" : "Show"} Transaction Breakdown
								{showBreakdown ? (
									<EyeOff className="h-4 w-4 ml-2" />
								) : (
									<Eye className="h-4 w-4 ml-2" />
								)}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="space-y-4">
							<div className="border rounded-lg p-4 space-y-3">
								<h4 className="font-medium">Transaction History</h4>
								<div className="space-y-2">
									{transactions.map((transaction, _index) => {
										const transactionValue =
											transaction.quantity * (transaction.unitPriceAmount ?? 0);
										const isBuy = transaction.transactionType === "BUY";

										return (
											<div
												key={transaction.id}
												className="flex items-center justify-between p-3 bg-muted/30 rounded"
											>
												<div className="flex items-center gap-3">
													<Badge variant={isBuy ? "default" : "secondary"}>
														{transaction.transactionType}
													</Badge>
													<div>
														<p className="text-sm font-medium">
															{transaction.quantity.toLocaleString()} shares @{" "}
															{formatCurrency(transaction.unitPriceAmount ?? 0)}
														</p>
														<p className="text-xs text-muted-foreground">
															{new Date(transaction.executedAt).toLocaleDateString()}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className={`font-medium ${isBuy ? "text-red-600" : "text-green-600"}`}>
														{isBuy ? "-" : "+"}
														{formatCurrency(transactionValue)}
													</p>
												</div>
											</div>
										);
									})}
								</div>
							</div>

							{/* FIFO Calculation Explanation */}
							<div className="border rounded-lg p-4 space-y-3">
								<h4 className="font-medium">FIFO Calculation</h4>
								<div className="text-sm text-muted-foreground space-y-2">
									<p>
										<strong>Total Purchases:</strong> {formatCurrency(totalCostBasis)}(
										{totalQuantity.toLocaleString()} shares)
									</p>
									<p>
										<strong>Average Cost per Share:</strong> {formatCurrency(averageCostBasis)}
									</p>
									<p>
										<strong>Current Market Value:</strong> {formatCurrency(currentValue)}
									</p>
									<p>
										<strong>Unrealized Gain/Loss:</strong>
										<span className={gainLossColor}>
											{" "}
											{formatCurrency(currentValue)} - {formatCurrency(totalCostBasis)} ={" "}
											{formatCurrency(unrealizedGainLoss)}
										</span>
									</p>
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>
				)}
			</CardContent>
		</Card>
	);
}

function CostBasisSkeleton({ compact = false }: { compact?: boolean }) {
	if (compact) {
		return (
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div className="space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-3 w-16" />
						</div>
						<div className="text-right space-y-2">
							<Skeleton className="h-5 w-20" />
							<Skeleton className="h-4 w-16" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-6 w-48" />
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-6 w-20" />
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{Array.from({ length: 2 }).map((_, index) => (
						<Card key={index} className="border-2">
							<CardContent className="p-4">
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-8 w-28" />
									<Skeleton className="h-4 w-16" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>

				<Skeleton className="h-12 w-full" />
			</CardContent>
		</Card>
	);
}

export { CostBasisSkeleton };
