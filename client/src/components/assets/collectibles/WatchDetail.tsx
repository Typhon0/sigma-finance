import ReactECharts from "echarts-for-react";
import { ArrowLeft, Calendar, Clock, Edit, Package, Shield, Trash2, Watch } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddWatchForm } from "@/components/AddWatchForm";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface WatchDetailProps {
	watchId: string;
	onBack: () => void;
}

export function WatchDetail({ watchId, onBack }: WatchDetailProps) {
	const { assets, updateAsset, deleteAsset } = usePortfolio();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

	const watch = assets.find((a) => a.id === watchId);

	if (!watch) {
		return (
			<div className="p-6">
				<Button variant="ghost" onClick={onBack} className="mb-4">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back
				</Button>
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Watch className="h-16 w-16 text-muted-foreground mb-4" />
						<h3 className="mb-2">Watch Not Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
							The watch you're looking for doesn't exist.
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

	const gain = (watch.currentValue || 0) - (watch.purchasePrice || 0);
	const gainPercent = watch.purchasePrice > 0 ? (gain / watch.purchasePrice) * 100 : 0;

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

	const conditionBadge = getConditionBadge(watch.condition || "excellent");

	// Chart for value appreciation (mock data)
	const valueChartOption = {
		tooltip: {
			trigger: "axis",
			// biome-ignore lint/suspicious/noExplicitAny: unavoidable
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
			data: ["Purchase", "6 Months", "1 Year", "18 Months", "2 Years", "Current"],
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
					watch.purchasePrice,
					watch.purchasePrice * 1.05,
					watch.purchasePrice * 1.1,
					watch.purchasePrice * 1.18,
					watch.purchasePrice * 1.22,
					watch.currentValue,
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
		deleteAsset(watchId);
		toast.success("Watch deleted successfully");
		onBack();
	};

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleEdit = (formData: any) => {
		updateAsset(watchId, {
			name: formData.name,
			brand: formData.brand,
			model: formData.model,
			currentValue: parseFloat(formData.currentValue) || 0,
			purchasePrice: parseFloat(formData.purchasePrice) || 0,
			purchaseDate: formData.purchaseDate,
			serialNumber: formData.serialNumber,
			condition: formData.condition,
			reference: formData.reference,
			yearManufactured: formData.yearManufactured,
			boxPapers: formData.boxPapers,
			description: formData.description,
		});
		setIsEditDialogOpen(false);
		toast.success("Watch updated successfully");
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
					<Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
						<Edit className="h-4 w-4 mr-2" />
						Edit
					</Button>
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
								<Watch className="h-8 w-8 text-primary" />
							</div>
							<div>
								<div className="flex items-center gap-2 mb-2">
									<CardTitle>{watch.name}</CardTitle>
									<Badge variant={conditionBadge.variant}>{conditionBadge.label}</Badge>
								</div>
								<CardDescription>
									{watch.brand} {watch.model}
									{watch.reference && ` • Ref. ${watch.reference}`}
								</CardDescription>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div>
							<p className="text-sm text-muted-foreground mb-1">Current Value</p>
							<p className="text-2xl font-mono font-semibold">
								{formatCurrency(watch.currentValue || 0)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Purchase Price</p>
							<p className="text-2xl font-mono font-semibold">
								{formatCurrency(watch.purchasePrice || 0)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Appreciation</p>
							<div
								className={`flex items-center gap-1.5 text-xl font-mono font-semibold ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
							>
								{gain >= 0 ? (
									<TrendArrowUp className="flex-shrink-0" />
								) : (
									<TrendArrowDown className="flex-shrink-0" />
								)}
								<span>
									{formatCurrency(Math.abs(gain))} ({gainPercent.toFixed(2)}%)
								</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				{/* Value Chart */}
				<Card>
					<CardHeader>
						<CardTitle>Value Appreciation</CardTitle>
						<CardDescription>Historical value over time</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts option={valueChartOption} style={{ height: "250px" }} />
					</CardContent>
				</Card>

				{/* Watch Details */}
				<Card>
					<CardHeader>
						<CardTitle>Watch Details</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{watch.serialNumber && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Shield className="h-4 w-4" />
									<span>Serial Number</span>
								</div>
								<span className="font-mono">{watch.serialNumber}</span>
							</div>
						)}

						{watch.yearManufactured && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar className="h-4 w-4" />
									<span>Year</span>
								</div>
								<span className="font-mono">{watch.yearManufactured}</span>
							</div>
						)}

						{watch.purchaseDate && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar className="h-4 w-4" />
									<span>Purchase Date</span>
								</div>
								<span className="font-mono">
									{new Date(watch.purchaseDate).toLocaleDateString("fr-FR")}
								</span>
							</div>
						)}

						{watch.boxPapers && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Package className="h-4 w-4" />
									<span>Box & Papers</span>
								</div>
								<Badge variant="outline" className="capitalize">
									{watch.boxPapers.replace("_", " ")}
								</Badge>
							</div>
						)}

						{watch.purchaseDate && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Clock className="h-4 w-4" />
									<span>Ownership Duration</span>
								</div>
								<span className="font-mono">
									{Math.floor(
										(Date.now() - new Date(watch.purchaseDate).getTime()) /
											((1000 * 60 * 60 * 24) / 30),
									)}{" "}
									months
								</span>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Description */}
			{watch.description && (
				<Card>
					<CardHeader>
						<CardTitle>Description</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground whitespace-pre-wrap">{watch.description}</p>
					</CardContent>
				</Card>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{watch.name}". This action cannot be undone.
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

			{/* Edit Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Watch</DialogTitle>
					</DialogHeader>
					<AddWatchForm
						onSubmit={handleEdit}
						onCancel={() => setIsEditDialogOpen(false)}
						initialData={watch}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
