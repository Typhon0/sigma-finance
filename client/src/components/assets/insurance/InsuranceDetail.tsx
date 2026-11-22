import {
	ArrowLeft,
	Calendar,
	CheckCircle2,
	Clock,
	Coins,
	Edit,
	Percent,
	Shield,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { AddInsuranceForm } from "./AddInsuranceForm";
import { CATEGORY_LABELS, computeAnnualPremium } from "./InsuranceExposureWidget";

interface InsuranceDetailProps {
	insuranceId: string;
	onBack: () => void;
	isPanel?: boolean;
}

export function InsuranceDetail({ insuranceId, onBack, isPanel = false }: InsuranceDetailProps) {
	const { assets, updateLifeInsurance, updateAsset, deleteAsset } = usePortfolio();
	const { formatCurrency } = useCurrency();
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
						<h3 className="mb-2 text-base font-semibold">Insurance Policy Not Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
							The insurance policy you're looking for doesn't exist or was removed.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const purchasePrice = insurance.purchasePrice || 0;
	const currentValue = insurance.currentValue || 0;
	const coverageAmount = insurance.coverageAmount || 0;
	const gain = currentValue - purchasePrice;
	const gainPercent = purchasePrice > 0 ? (gain / purchasePrice) * 100 : 0;
	const annualPremium = computeAnnualPremium(insurance);

	const categoryKey = insurance.policyType || insurance.category || "life_insurance";
	const categoryLabel = CATEGORY_LABELS[categoryKey] || categoryKey.replace(/_/g, " ");

	// Max value among pillars to compute relative progress bars
	const maxPillar = Math.max(purchasePrice, currentValue, coverageAmount, 1);
	const purchasePercent = Math.min(100, Math.round((purchasePrice / maxPillar) * 100));
	const currentPercent = Math.min(100, Math.round((currentValue / maxPillar) * 100));
	const coveragePercent = Math.min(100, Math.round((coverageAmount / maxPillar) * 100));

	const handleDelete = () => {
		deleteAsset(insuranceId);
		toast.success("Insurance policy deleted successfully");
		onBack();
	};

	// biome-ignore lint/suspicious/noExplicitAny: form submission handling
	const handleEdit = async (formData: any) => {
		try {
			const beneficiaries = Array.isArray(formData.beneficiaries)
				? formData.beneficiaries
				: typeof formData.beneficiaries === "string" && formData.beneficiaries
					? formData.beneficiaries
							.split(",")
							.map((b: string) => b.trim())
							.filter(Boolean)
					: [];

			if (updateLifeInsurance) {
				await updateLifeInsurance(insuranceId, {
					name: formData.name,
					currentValue: parseFloat(formData.currentValue) || 0,
					purchasePrice: parseFloat(formData.purchasePrice) || 0,
					policyType: formData.category,
					policyNumber: formData.policyNumber,
					coverageAmount: parseFloat(formData.coverageAmount) || 0,
					premiumAmount: parseFloat(formData.premiumAmount) || 0,
					premiumFrequency: formData.premiumFrequency,
					purchaseDate: formData.openingDate,
					insurer: formData.provider,
					beneficiaries,
					maturityDate: formData.maturityDate,
				});
			} else {
				updateAsset(insuranceId, {
					purchasePrice: parseFloat(formData.purchasePrice) || 0,
				});
			}
			setIsEditDialogOpen(false);
			toast.success("Insurance policy updated successfully");
		} catch (error) {
			toast.error("Failed to update insurance policy");
			console.error("Failed to update insurance policy:", error);
		}
	};

	return (
		<div className={cn("p-6 space-y-6", isPanel && "p-4 space-y-4")}>
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3 min-w-0">
					{isPanel ? (
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
							title="Close Details Pane"
						>
							<X className="h-4 w-4" />
						</Button>
					) : (
						<Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1.5 shrink-0">
							<ArrowLeft className="h-4 w-4" />
							<span>Back</span>
						</Button>
					)}
					<div className="min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
								{insurance.name}
							</h2>
							<Badge variant="secondary" className="text-micro font-medium uppercase shrink-0">
								{categoryLabel}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground truncate font-mono">
							{insurance.insurer || insurance.institution || "Unknown Insurer"}
							{insurance.policyNumber && ` • Policy #${insurance.policyNumber}`}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsEditDialogOpen(true)}
						className="h-8 text-xs gap-1.5 border-border/50"
					>
						<Edit className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Edit</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsDeleteDialogOpen(true)}
						className="h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
					>
						<Trash2 className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Delete</span>
					</Button>
				</div>
			</div>

			{/* Authentic 3-Pillar Capital Accumulation & Coverage Benchmark */}
			<Card className="border-border/40 shadow-xs">
				<CardHeader className="pb-3 pt-4 px-4 sm:px-6">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Capital Accumulation & Coverage
							</CardTitle>
							<CardDescription className="text-micro text-muted-foreground">
								Authentic contractual valuation • Zero synthetic modeling
							</CardDescription>
						</div>
						<div
							className={cn(
								"flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold",
								gain >= 0
									? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
									: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
							)}
						>
							{gain >= 0 ? (
								<TrendArrowUp className="h-3.5 w-3.5" />
							) : (
								<TrendArrowDown className="h-3.5 w-3.5" />
							)}
							<span>{formatCurrency(Math.abs(gain))}</span>
							<span className="text-micro font-normal">({gainPercent.toFixed(1)}%)</span>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-4 sm:px-6 pb-4 space-y-4">
					{/* Pillar 1: Total Contributions / Cost Basis */}
					<div className="space-y-1.5">
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground flex items-center gap-1.5">
								<Coins className="h-3.5 w-3.5 text-muted-foreground/70" />
								<span>Total Contributions (Cost Basis)</span>
							</span>
							<span className="font-mono font-semibold text-foreground">
								{formatCurrency(purchasePrice)}
							</span>
						</div>
						<div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
							<div
								className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-300"
								style={{ width: `${purchasePercent}%` }}
							/>
						</div>
					</div>

					{/* Pillar 2: Current Surrender Value */}
					<div className="space-y-1.5">
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground flex items-center gap-1.5">
								<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
								<span>Current Surrender Value (Valeur de Rachat)</span>
							</span>
							<span className="font-mono font-bold text-foreground">
								{formatCurrency(currentValue)}
							</span>
						</div>
						<div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
							<div
								className="h-full bg-primary rounded-full transition-all duration-300"
								style={{ width: `${currentPercent}%` }}
							/>
						</div>
					</div>

					{/* Pillar 3: Guaranteed Coverage (Death / Maturity Capital) */}
					{coverageAmount > 0 && (
						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Shield className="h-3.5 w-3.5 text-emerald-500" />
									<span>Guaranteed Death Coverage (Capital Garanti)</span>
								</span>
								<span className="font-mono font-semibold text-foreground">
									{formatCurrency(coverageAmount)}
								</span>
							</div>
							<div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
								<div
									className="h-full bg-emerald-500 rounded-full transition-all duration-300"
									style={{ width: `${coveragePercent}%` }}
								/>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Contract Parameters & Terms Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
				<Card className="border-border/40 shadow-xs">
					<CardHeader className="pb-2 pt-3.5 px-4">
						<CardTitle className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Contract Terms
						</CardTitle>
					</CardHeader>
					<CardContent className="px-4 pb-3.5 space-y-2.5">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Insurer</span>
							<span className="font-medium text-foreground">
								{insurance.insurer || insurance.institution || "—"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Policy Number</span>
							<span className="font-mono text-foreground">{insurance.policyNumber || "—"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Policy Type</span>
							<span className="font-medium text-foreground">{categoryLabel}</span>
						</div>
						{insurance.openingDate && (
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground flex items-center gap-1">
									<Calendar className="h-3.5 w-3.5" />
									<span>Opening Date</span>
								</span>
								<span className="font-mono text-foreground">
									{new Date(insurance.openingDate).toLocaleDateString()}
								</span>
							</div>
						)}
						{insurance.maturityDate && (
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground flex items-center gap-1">
									<Clock className="h-3.5 w-3.5" />
									<span>Maturity Date</span>
								</span>
								<span className="font-mono text-foreground">
									{new Date(insurance.maturityDate).toLocaleDateString()}
								</span>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="border-border/40 shadow-xs">
					<CardHeader className="pb-2 pt-3.5 px-4">
						<CardTitle className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Premiums & Beneficiaries
						</CardTitle>
					</CardHeader>
					<CardContent className="px-4 pb-3.5 space-y-2.5">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Scheduled Premium</span>
							<span className="font-mono font-semibold text-foreground">
								{insurance.premiumAmount ? (
									<>
										{formatCurrency(insurance.premiumAmount)}
										<span className="text-muted-foreground font-normal ml-1 capitalize">
											/ {insurance.premiumFrequency || "yr"}
										</span>
									</>
								) : (
									"—"
								)}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Annual Outflow</span>
							<span className="font-mono font-semibold text-foreground">
								{annualPremium > 0 ? `${formatCurrency(annualPremium)} / yr` : "—"}
							</span>
						</div>
						{insurance.annualReturn !== undefined && insurance.annualReturn !== null && (
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground flex items-center gap-1">
									<Percent className="h-3.5 w-3.5" />
									<span>Reported Return</span>
								</span>
								<span className="font-mono font-semibold text-foreground">
									{Number(insurance.annualReturn).toFixed(2)}%
								</span>
							</div>
						)}
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground flex items-center gap-1">
								<User className="h-3.5 w-3.5" />
								<span>Beneficiaries</span>
							</span>
							<span className="text-foreground truncate max-w-[150px] font-medium" title={insurance.beneficiaries || "Standard clause"}>
								{insurance.beneficiaries || "Standard clause"}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Notes section if present */}
			{insurance.notes && (
				<Card className="border-border/40 shadow-xs">
					<CardHeader className="pb-2 pt-3.5 px-4">
						<CardTitle className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Notes & Contractual Clauses
						</CardTitle>
					</CardHeader>
					<CardContent className="px-4 pb-3.5">
						<p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
							{insurance.notes}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Insurance Policy</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{insurance.name}"? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete Policy
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
						initialData={{
							name: insurance.name,
							category: insurance.policyType || insurance.category,
							currentValue: insurance.currentValue?.toString(),
							purchasePrice: insurance.purchasePrice?.toString(),
							policyNumber: insurance.policyNumber,
							coverageAmount: insurance.coverageAmount?.toString(),
							premiumAmount: insurance.premiumAmount?.toString(),
							premiumFrequency: insurance.premiumFrequency,
							annualReturn: insurance.annualReturn?.toString(),
							openingDate: insurance.openingDate,
							ownership: insurance.ownership,
							provider: insurance.insurer || insurance.provider,
							beneficiaries: insurance.beneficiaries,
							notes: insurance.notes,
						}}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
