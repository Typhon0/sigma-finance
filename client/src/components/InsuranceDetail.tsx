import ReactECharts from "echarts-for-react";
import { ArrowLeft, Calendar, Clock, Edit, Percent, Shield, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { AddInsuranceForm } from "./AddInsuranceForm";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface InsuranceDetailProps {
	insuranceId: string;
	onBack: () => void;
}

export function InsuranceDetail({ insuranceId, onBack }: InsuranceDetailProps) {
	const { assets, updateAsset, deleteAsset } = usePortfolio();
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

	const insurance = assets.find((a) => a.id === insuranceId);

	if (!insurance) {
		return (
			<div className="p-6">
				<Button variant="ghost" onClick={onBack} className="mb-4">
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back
				</Button>
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Shield className="h-16 w-16 text-muted-foreground mb-4" />
						<h3 className="mb-2">Insurance Policy Not Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
							The insurance policy you're looking for doesn't exist.
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

	const gain = (insurance.currentValue || 0) - (insurance.purchasePrice || 0);
	const gainPercent = insurance.purchasePrice > 0 ? (gain / insurance.purchasePrice) * 100 : 0;

	const getCategoryBadge = (category: string) => {
		const badges: Record<
			string,
			{
				label: string;
				variant: "default" | "secondary" | "outline" | "destructive";
			}
		> = {
			life_insurance: { label: "Assurance Vie", variant: "default" },
			retirement: { label: "PER", variant: "secondary" },
			savings: { label: "Épargne", variant: "outline" },
			death_insurance: { label: "Décès", variant: "destructive" },
			mixed: { label: "Mixte", variant: "outline" },
		};
		return badges[category] || { label: category, variant: "outline" };
	};

	const categoryBadge = getCategoryBadge(insurance.category);

	// Chart for value evolution (mock data - in real app would come from historical data)
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
			data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
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
					insurance.purchasePrice * 0.95,
					insurance.purchasePrice * 0.97,
					insurance.purchasePrice * 1.0,
					insurance.purchasePrice * 1.02,
					insurance.purchasePrice * 1.05,
					insurance.currentValue,
				],
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: "rgba(59, 130, 246, 0.3)" },
							{ offset: 1, color: "rgba(59, 130, 246, 0.0)" },
						],
					},
				},
				lineStyle: { color: "#3b82f6", width: 2 },
				itemStyle: { color: "#3b82f6" },
			},
		],
	};

	const handleDelete = () => {
		deleteAsset(insuranceId);
		toast.success("Insurance policy deleted successfully");
		onBack();
	};

	const handleEdit = (formData: any) => {
		updateAsset(insuranceId, {
			name: formData.name,
			currentValue: parseFloat(formData.currentValue) || 0,
			purchasePrice: parseFloat(formData.purchasePrice) || 0,
			category: formData.category,
			policyNumber: formData.policyNumber,
			annualReturn: parseFloat(formData.annualReturn) || 0,
			openingDate: formData.openingDate,
			ownership: formData.ownership,
			provider: formData.provider,
			beneficiaries: formData.beneficiaries,
			notes: formData.notes,
		});
		setIsEditDialogOpen(false);
		toast.success("Insurance policy updated successfully");
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
								<Shield className="h-8 w-8 text-primary" />
							</div>
							<div>
								<div className="flex items-center gap-2 mb-2">
									<CardTitle>{insurance.name}</CardTitle>
									<Badge variant={categoryBadge.variant}>{categoryBadge.label}</Badge>
								</div>
								<CardDescription>
									{insurance.policyNumber && `Policy ${insurance.policyNumber}`}
									{insurance.provider && ` • ${insurance.provider}`}
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
								{formatCurrency(insurance.currentValue || 0)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
							<p className="text-2xl font-mono font-semibold">
								{formatCurrency(insurance.purchasePrice || 0)}
							</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground mb-1">Gain/Loss</p>
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
				{/* Performance Chart */}
				<Card>
					<CardHeader>
						<CardTitle>Value Evolution</CardTitle>
						<CardDescription>Historical value over time</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts option={valueChartOption} style={{ height: "250px" }} />
					</CardContent>
				</Card>

				{/* Key Metrics */}
				<Card>
					<CardHeader>
						<CardTitle>Key Metrics</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{insurance.annualReturn && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Percent className="h-4 w-4" />
									<span>Annual Return</span>
								</div>
								<span className="font-mono font-semibold">
									{insurance.annualReturn.toFixed(2)}%
								</span>
							</div>
						)}

						{insurance.openingDate && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar className="h-4 w-4" />
									<span>Opening Date</span>
								</div>
								<span className="font-mono">
									{new Date(insurance.openingDate).toLocaleDateString("fr-FR")}
								</span>
							</div>
						)}

						{insurance.openingDate && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Clock className="h-4 w-4" />
									<span>Duration</span>
								</div>
								<span className="font-mono">
									{Math.floor(
										(Date.now() - new Date(insurance.openingDate).getTime()) /
											(1000 * 60 * 60 * 24 * 365.25),
									)}{" "}
									years
								</span>
							</div>
						)}

						{insurance.ownership && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<User className="h-4 w-4" />
									<span>Ownership</span>
								</div>
								<Badge variant="outline" className="capitalize">
									{insurance.ownership}
								</Badge>
							</div>
						)}

						{insurance.beneficiaries && (
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<User className="h-4 w-4" />
									<span>Beneficiaries</span>
								</div>
								<span className="text-sm">{insurance.beneficiaries}</span>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Additional Information */}
			{insurance.notes && (
				<Card>
					<CardHeader>
						<CardTitle>Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground whitespace-pre-wrap">{insurance.notes}</p>
					</CardContent>
				</Card>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the insurance policy "{insurance.name}". This action
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

			{/* Edit Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Insurance Policy</DialogTitle>
					</DialogHeader>
					<AddInsuranceForm
						onSubmit={handleEdit}
						onCancel={() => setIsEditDialogOpen(false)}
						initialData={insurance}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
