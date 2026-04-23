import ReactECharts from "echarts-for-react";
import { ArrowLeft, Coins, DollarSign, FileText, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "./TrendArrows";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface PreciousMetalsDetailProps {
	metalId: string;
	onBack: () => void;
}

export function PreciousMetalsDetail({ metalId, onBack }: PreciousMetalsDetailProps) {
	const { assets, _updateAsset, deleteAsset } = usePortfolio();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const metal = assets.find((a) => a.id === metalId);

	if (!metal) {
		return (
			<div className="p-6">
				<Button variant="ghost" onClick={onBack} className="mb-4">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back
				</Button>
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Coins className="h-16 w-16 text-muted-foreground mb-4" />
						<h3 className="mb-2">Precious Metal Not Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
							The precious metal you're looking for doesn't exist.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("fr-FR", {
			style: "currency",
			currency: "EUR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const gain = (metal.currentValue || 0) - (metal.purchasePrice || 0);
	const gainPercent = metal.purchasePrice > 0 ? (gain / metal.purchasePrice) * 100 : 0;

	const getConditionBadge = (condition: string) => {
		const badges: Record<
			string,
			{
				label: string;
				variant: "default" | "secondary" | "outline" | "destructive";
			}
		> = {
			mint: { label: "Mint", variant: "default" },
			excellent: { label: "Excellent", variant: "default" },
			very_good: { label: "Very Good", variant: "secondary" },
			good: { label: "Good", variant: "outline" },
			fair: { label: "Fair", variant: "outline" },
			poor: { label: "Poor", variant: "destructive" },
		};
		return badges[condition] || { label: condition, variant: "outline" };
	};

	const conditionBadge = getConditionBadge(metal.condition || "mint");

	// Chart for value appreciation
	const valueChartOption = {
		tooltip: {
			trigger: "axis",
			formatter: (params: any) => {
				const param = params[0];
				return `${param.name}<br/>${formatCurrency(param.value)}`;
			},
		},
		grid: {
			left: "3%",
			right: "4%",
			bottom: "3%",
			top: "3%",
			containLabel: true,
		},
		xAxis: {
			type: "category",
			boundaryGap: false,
			data: ["Purchase", "1 Year", "2 Years", "3 Years", "4 Years", "Current"],
			axisLine: { lineStyle: { color: "#666" } },
		},
		yAxis: {
			type: "value",
			axisLine: { lineStyle: { color: "#666" } },
			splitLine: { lineStyle: { color: "#333", type: "dashed" } },
		},
		series: [
			{
				name: "Value",
				type: "line",
				smooth: true,
				data: [
					metal.purchasePrice,
					metal.purchasePrice * 1.06,
					metal.purchasePrice * 1.1,
					metal.purchasePrice * 1.11,
					metal.purchasePrice * 1.12,
					metal.currentValue,
				],
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(34, 197, 94, 0.3)" },
							{ offset: 1, color: "rgba(34, 197, 94, 0.0)" },
						],
					},
				},
				lineStyle: { color: "#22c55e", width: 2 },
				itemStyle: { color: "#22c55e" },
			},
		],
	};

	const handleDelete = () => {
		deleteAsset(metalId);
		toast.success("Precious metal deleted successfully");
		onBack();
	};

	return (
		<div className="p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" onClick={onBack}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back
					</Button>
				</div>
				<div className="flex gap-2">
					<Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
						<Trash2 className="h-4 w-4 mr-2" />
						Delete
					</Button>
				</div>
			</div>

			{/* Main Info Card */}
			<Card className="mb-6">
				<CardHeader>
					<div className="flex items-start justify-between">
						<div className="flex items-start gap-4">
							<div className="p-3 rounded-lg bg-primary/10">
								<Coins className="h-8 w-8 text-primary" />
							</div>
							<div>
								<CardTitle className="mb-2">{metal.name}</CardTitle>
								<div className="flex flex-wrap gap-2 mb-3">
									<Badge variant={conditionBadge.variant}>{conditionBadge.label}</Badge>
									{metal.brand && <Badge variant="outline">{metal.brand}</Badge>}
									{metal.model && <Badge variant="secondary">{metal.model}</Badge>}
								</div>
								<CardDescription className="max-w-2xl">
									{metal.description || "No description available"}
								</CardDescription>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div>
							<p className="text-sm text-muted-foreground mb-1">Current Value</p>
							<p className="font-mono">{formatCurrency(metal.currentValue || 0)}</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Purchase Price</p>
							<p className="font-mono">{formatCurrency(metal.purchasePrice || 0)}</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Gain/Loss</p>
							<div
								className={`flex items-center gap-1.5 font-mono ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
							>
								{gain >= 0 ? (
									<TrendArrowUp className="flex-shrink-0" />
								) : (
									<TrendArrowDown className="flex-shrink-0" />
								)}
								<span>{formatCurrency(Math.abs(gain))}</span>
								<span className="text-xs">({gainPercent.toFixed(2)}%)</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Details Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				{/* Metal Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Metal Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{metal.brand && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Mint/Refiner</p>
								<p>{metal.brand}</p>
							</div>
						)}
						{metal.model && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Type/Weight</p>
								<p>{metal.model}</p>
							</div>
						)}
						{metal.serialNumber && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Serial Number</p>
								<p className="font-mono text-sm">{metal.serialNumber}</p>
							</div>
						)}
						{metal.condition && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Condition</p>
								<Badge variant={conditionBadge.variant}>{conditionBadge.label}</Badge>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Purchase Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<DollarSign className="h-5 w-5" />
							Purchase Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="text-sm text-muted-foreground mb-1">Purchase Date</p>
							<p>
								{metal.purchaseDate
									? new Date(metal.purchaseDate).toLocaleDateString("fr-FR")
									: "N/A"}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Purchase Price</p>
							<p className="font-mono">{formatCurrency(metal.purchasePrice || 0)}</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Current Value</p>
							<p className="font-mono">{formatCurrency(metal.currentValue || 0)}</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Value Appreciation Chart */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5" />
						Value Appreciation
					</CardTitle>
					<CardDescription>Historical value trend since purchase</CardDescription>
				</CardHeader>
				<CardContent>
					<ReactECharts option={valueChartOption} style={{ height: "300px" }} />
				</CardContent>
			</Card>

			{/* Delete Dialog */}
			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Precious Metal</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{metal.name}"? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
