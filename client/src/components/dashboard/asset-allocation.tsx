import {
	AlertCircle,
	BarChart3,
	Lightbulb,
	PieChart,
	Target,
	TrendingUp,
} from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import AllocationChart from "@/components/charts/AllocationChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssetTypeColor } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatters";

export interface AllocationItem {
	assetType: string;
	name: string;
	value: number;
	percentage: number;
	targetPercentage?: number;
	count: number;
	color?: string;
}

export interface AllocationRecommendation {
	type: "overweight" | "underweight" | "rebalance" | "diversify";
	assetType: string;
	currentPercentage: number;
	targetPercentage: number;
	suggestedAction: string;
	priority: "high" | "medium" | "low";
	impact: number; // Expected impact on portfolio performance
}

export interface AssetAllocationProps {
	allocations: AllocationItem[];
	recommendations?: AllocationRecommendation[];
	totalValue: number;
	timeRange?: string;
	isLoading?: boolean;
	className?: string;
	compact?: boolean;
	showRecommendations?: boolean;
	showChart?: boolean;
	onAssetTypeClick?: (assetType: string) => void;
	onRecommendationAction?: (recommendation: AllocationRecommendation) => void;
}

const formatAssetTypeName = (assetType: string): string => {
	return assetType
		.replace(/_/g, " ")
		.toLowerCase()
		.replace(/\b\w/g, (l) => l.toUpperCase());
};

const getRecommendationIcon = (type: AllocationRecommendation["type"]) => {
	switch (type) {
		case "overweight":
			return <TrendingUp className="h-4 w-4 text-orange-500" />;
		case "underweight":
			return <TrendingUp className="h-4 w-4 text-blue-500 rotate-180" />;
		case "rebalance":
			return <Target className="h-4 w-4 text-purple-500" />;
		case "diversify":
			return <BarChart3 className="h-4 w-4 text-green-500" />;
		default:
			return <AlertCircle className="h-4 w-4" />;
	}
};

const getPriorityColor = (priority: AllocationRecommendation["priority"]) => {
	switch (priority) {
		case "high":
			return "destructive";
		case "medium":
			return "default";
		case "low":
			return "secondary";
		default:
			return "outline";
	}
};

const AllocationBreakdown: React.FC<{
	allocations: AllocationItem[];
	totalValue: number;
	compact?: boolean;
	onAssetTypeClick?: (assetType: string) => void;
}> = ({ allocations, _totalValue, compact = false, onAssetTypeClick }) => {
	const sortedAllocations = useMemo(() => {
		return [...allocations].sort((a, b) => b.value - a.value);
	}, [allocations]);

	return (
		<div className="space-y-3">
			{sortedAllocations.map((allocation) => {
				const hasTarget = allocation.targetPercentage !== undefined;
				const deviation = hasTarget
					? allocation.percentage - allocation.targetPercentage!
					: 0;
				const isOverweight = deviation > 5; // More than 5% over target
				const isUnderweight = deviation < -5; // More than 5% under target

				return (
					<div
						key={allocation.assetType}
						className={cn(
							"flex items-center justify-between p-3 rounded-lg border transition-colors",
							onAssetTypeClick && "cursor-pointer hover:bg-muted/50",
							compact && "p-2",
						)}
						onClick={() => onAssetTypeClick?.(allocation.assetType)}
					>
						<div className="flex items-center gap-3 flex-1">
							<div
								className="w-3 h-3 rounded-full flex-shrink-0"
								style={{
									backgroundColor:
										allocation.color || getAssetTypeColor(allocation.assetType),
								}}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<p
										className={cn("font-medium truncate", compact && "text-sm")}
									>
										{formatAssetTypeName(allocation.assetType)}
									</p>
									<Badge variant="outline" className="text-xs">
										{allocation.count}
									</Badge>
									{isOverweight && (
										<Badge variant="destructive" className="text-xs">
											Overweight
										</Badge>
									)}
									{isUnderweight && (
										<Badge variant="secondary" className="text-xs">
											Underweight
										</Badge>
									)}
								</div>
								<div className="flex items-center gap-2 mt-1">
									<Progress
										value={allocation.percentage}
										className={cn("flex-1", compact && "h-1")}
										style={
											{
												"--progress-background":
													allocation.color ||
													getAssetTypeColor(allocation.assetType),
											} as React.CSSProperties
										}
									/>
									{hasTarget && (
										<div className="text-xs text-muted-foreground">
											Target: {allocation.targetPercentage?.toFixed(1)}%
										</div>
									)}
								</div>
							</div>
						</div>

						<div className="text-right space-y-1">
							<p className={cn("font-semibold", compact && "text-sm")}>
								{formatCurrency(allocation.value)}
							</p>
							<p
								className={cn(
									"text-sm text-muted-foreground",
									compact && "text-xs",
								)}
							>
								{allocation.percentage.toFixed(1)}%
							</p>
						</div>
					</div>
				);
			})}
		</div>
	);
};

const RecommendationsList: React.FC<{
	recommendations: AllocationRecommendation[];
	compact?: boolean;
	onAction?: (recommendation: AllocationRecommendation) => void;
}> = ({ recommendations, compact = false, onAction }) => {
	const sortedRecommendations = useMemo(() => {
		const priorityOrder = { high: 3, medium: 2, low: 1 };
		return [...recommendations].sort(
			(a, b) => priorityOrder[b.priority] - priorityOrder[a.priority],
		);
	}, [recommendations]);

	if (recommendations.length === 0) {
		return (
			<div className="text-center py-8">
				<Lightbulb className="h-12 w-12 text-green-500 mx-auto mb-4" />
				<h3 className="text-lg font-semibold mb-2">Well Balanced Portfolio</h3>
				<p className="text-muted-foreground">
					Your asset allocation looks good! No immediate rebalancing needed.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{sortedRecommendations.map((recommendation, index) => (
				<Card
					key={`${recommendation.assetType}-${index}`}
					className="border-l-4"
					style={{
						borderLeftColor:
							recommendation.priority === "high"
								? "#ef4444"
								: recommendation.priority === "medium"
									? "#f59e0b"
									: "#6b7280",
					}}
				>
					<CardContent className={cn("p-4", compact && "p-3")}>
						<div className="flex items-start justify-between">
							<div className="flex items-start gap-3 flex-1">
								{getRecommendationIcon(recommendation.type)}
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<h4 className={cn("font-semibold", compact && "text-sm")}>
											{formatAssetTypeName(recommendation.assetType)}
										</h4>
										<Badge
											variant={getPriorityColor(recommendation.priority)}
											className="text-xs"
										>
											{recommendation.priority}
										</Badge>
									</div>
									<p
										className={cn(
											"text-sm text-muted-foreground mb-2",
											compact && "text-xs",
										)}
									>
										{recommendation.suggestedAction}
									</p>
									<div className="flex items-center gap-4 text-xs">
										<span>
											Current:{" "}
											<strong>
												{recommendation.currentPercentage.toFixed(1)}%
											</strong>
										</span>
										<span>
											Target:{" "}
											<strong>
												{recommendation.targetPercentage.toFixed(1)}%
											</strong>
										</span>
										<span className="text-green-600">
											Impact:{" "}
											<strong>+{recommendation.impact.toFixed(1)}%</strong>
										</span>
									</div>
								</div>
							</div>

							{onAction && (
								<Button
									size="sm"
									variant="outline"
									onClick={() => onAction(recommendation)}
									className={cn("ml-2", compact && "text-xs px-2")}
								>
									Apply
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
};

export const AssetAllocation: React.FC<AssetAllocationProps> = ({
	allocations,
	recommendations = [],
	totalValue,
	timeRange,
	isLoading = false,
	className,
	compact = false,
	showRecommendations = true,
	showChart = true,
	onAssetTypeClick,
	onRecommendationAction,
}) => {
	const chartData = useMemo(() => {
		return allocations.map((allocation) => ({
			name: formatAssetTypeName(allocation.assetType),
			value: allocation.value,
			assetType: allocation.assetType,
			percentage: allocation.percentage,
		}));
	}, [allocations]);

	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-64 w-full" />
					<div className="space-y-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!allocations || allocations.length === 0) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5" />
						Asset Allocation
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Assets</h3>
						<p className="text-muted-foreground">
							Add assets to your portfolio to see allocation breakdown.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5" />
						Asset Allocation
					</CardTitle>
					{timeRange && (
						<Badge variant="outline" className="text-xs">
							{timeRange}
						</Badge>
					)}
				</div>
				<div className="text-sm text-muted-foreground">
					Total Portfolio Value: <strong>{formatCurrency(totalValue)}</strong>
				</div>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="breakdown" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="breakdown">Breakdown</TabsTrigger>
						{showRecommendations && (
							<TabsTrigger value="recommendations" className="relative">
								Recommendations
								{recommendations.length > 0 && (
									<Badge variant="destructive" className="ml-2 text-xs px-1">
										{recommendations.length}
									</Badge>
								)}
							</TabsTrigger>
						)}
					</TabsList>

					<TabsContent value="breakdown" className="space-y-4">
						{showChart && (
							<AllocationChart
								data={chartData}
								height={compact ? 200 : 300}
								compact={compact}
								showHeader={false}
								onSegmentClick={(data) => onAssetTypeClick?.(data.assetType!)}
							/>
						)}

						<AllocationBreakdown
							allocations={allocations}
							totalValue={totalValue}
							compact={compact}
							onAssetTypeClick={onAssetTypeClick}
						/>
					</TabsContent>

					{showRecommendations && (
						<TabsContent value="recommendations">
							<RecommendationsList
								recommendations={recommendations}
								compact={compact}
								onAction={onRecommendationAction}
							/>
						</TabsContent>
					)}
				</Tabs>
			</CardContent>
		</Card>
	);
};

export default AssetAllocation;
