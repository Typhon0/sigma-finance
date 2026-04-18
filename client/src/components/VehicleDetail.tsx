import ReactECharts from "echarts-for-react";
import {
	ArrowLeft,
	Car,
	DollarSign,
	FileText,
	Trash2,
	TrendingUp,
} from "lucide-react";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface VehicleDetailProps {
	vehicleId: string;
	onBack: () => void;
}

export function VehicleDetail({ vehicleId, onBack }: VehicleDetailProps) {
	const { assets, _updateAsset, deleteAsset } = usePortfolio();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	const vehicle = assets.find((a) => a.id === vehicleId);

	if (!vehicle) {
		return (
			<div className="p-6">
				<Button variant="ghost" onClick={onBack} className="mb-4">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back
				</Button>
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Car className="h-16 w-16 text-muted-foreground mb-4" />
						<h3 className="mb-2">Vehicle Not Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
							The vehicle you're looking for doesn't exist.
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

	const gain = (vehicle.currentValue || 0) - (vehicle.purchasePrice || 0);
	const gainPercent =
		vehicle.purchasePrice > 0 ? (gain / vehicle.purchasePrice) * 100 : 0;

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

	const conditionBadge = getConditionBadge(vehicle.condition || "good");

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
					vehicle.purchasePrice,
					vehicle.purchasePrice * 1.04,
					vehicle.purchasePrice * 1.1,
					vehicle.purchasePrice * 1.15,
					vehicle.purchasePrice * 1.17,
					vehicle.currentValue,
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
		deleteAsset(vehicleId);
		toast.success("Vehicle deleted successfully");
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
					<Button
						variant="destructive"
						onClick={() => setIsDeleteDialogOpen(true)}
					>
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
								<Car className="h-8 w-8 text-primary" />
							</div>
							<div>
								<CardTitle className="mb-2">{vehicle.name}</CardTitle>
								<div className="flex flex-wrap gap-2 mb-3">
									<Badge variant={conditionBadge.variant}>
										{conditionBadge.label}
									</Badge>
									{vehicle.brand && (
										<Badge variant="outline">{vehicle.brand}</Badge>
									)}
									{vehicle.yearManufactured && (
										<Badge variant="secondary">
											{vehicle.yearManufactured}
										</Badge>
									)}
								</div>
								<CardDescription className="max-w-2xl">
									{vehicle.description || "No description available"}
								</CardDescription>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div>
							<p className="text-sm text-muted-foreground mb-1">
								Current Value
							</p>
							<p className="font-mono">
								{formatCurrency(vehicle.currentValue || 0)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">
								Purchase Price
							</p>
							<p className="font-mono">
								{formatCurrency(vehicle.purchasePrice || 0)}
							</p>
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
				{/* Vehicle Information */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Vehicle Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{vehicle.brand && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Brand</p>
								<p>{vehicle.brand}</p>
							</div>
						)}
						{vehicle.model && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Model</p>
								<p>{vehicle.model}</p>
							</div>
						)}
						{vehicle.yearManufactured && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Year</p>
								<p>{vehicle.yearManufactured}</p>
							</div>
						)}
						{vehicle.serialNumber && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">
									VIN/Serial Number
								</p>
								<p className="font-mono text-sm">{vehicle.serialNumber}</p>
							</div>
						)}
						{vehicle.condition && (
							<div>
								<p className="text-sm text-muted-foreground mb-1">Condition</p>
								<Badge variant={conditionBadge.variant}>
									{conditionBadge.label}
								</Badge>
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
							<p className="text-sm text-muted-foreground mb-1">
								Purchase Date
							</p>
							<p>
								{vehicle.purchaseDate
									? new Date(vehicle.purchaseDate).toLocaleDateString("fr-FR")
									: "N/A"}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">
								Purchase Price
							</p>
							<p className="font-mono">
								{formatCurrency(vehicle.purchasePrice || 0)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">
								Current Value
							</p>
							<p className="font-mono">
								{formatCurrency(vehicle.currentValue || 0)}
							</p>
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
					<CardDescription>
						Historical value trend since purchase
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ReactECharts option={valueChartOption} style={{ height: "300px" }} />
				</CardContent>
			</Card>

			{/* Delete Dialog */}
			<AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{vehicle.name}"? This action
							cannot be undone.
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
