import {
	ArrowRight,
	ChevronLeft,
	FileText,
	Filter,
	LayoutGrid,
	List,
	Percent,
	Plus,
	Shield,
	SortAsc,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BenchmarkMetricsBar } from "@/components/charts/BenchmarkMetricsBar";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddInsuranceForm } from "./AddInsuranceForm";
import { InsuranceDetail } from "./InsuranceDetail";

interface InsuranceListProps {
	onSelectInsurance?: (insuranceId: string) => void;
	detailMode?: "external" | "panel";
	onBack?: () => void;
}

type ViewMode = "grid" | "list";

export function InsuranceList({
	onSelectInsurance,
	detailMode = "panel",
	onBack,
}: InsuranceListProps) {
	const { assets, addLifeInsurance, currentPortfolio, refetch, selectedPortfolio } = usePortfolio();
	const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | null>(null);

	const handleSelectInsurance = (insuranceId: string) => {
		if (detailMode === "panel") {
			setSelectedInsuranceId(insuranceId);
		} else {
			onSelectInsurance?.(insuranceId);
		}
	};
	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState("value");
	const [filterCategory, setFilterCategory] = useState("all");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);

	const insuranceAssets = assets.filter((asset) => asset.type === "insurance");

	const filteredInsurances = insuranceAssets
		.filter((insurance) => {
			const matchesSearch =
				insurance.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				insurance.category?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesCategory = filterCategory === "all" || insurance.category === filterCategory;
			return matchesSearch && matchesCategory;
		})
		.sort((a, b) => {
			switch (sortBy) {
				case "value":
					return (b.currentValue || 0) - (a.currentValue || 0);
				case "gain": {
					const gainA = (a.currentValue || 0) - (a.purchasePrice || 0);
					const gainB = (b.currentValue || 0) - (b.purchasePrice || 0);
					return gainB - gainA;
				}
				case "return":
					return (b.annualReturn || 0) - (a.annualReturn || 0);
				case "name":
					return (a.name || "").localeCompare(b.name || "");
				default:
					return 0;
			}
		});

	const getTotalValue = () => {
		return insuranceAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
	};

	const getTotalGain = () => {
		return insuranceAssets.reduce((sum, asset) => {
			const gain = (asset.currentValue || 0) - (asset.purchasePrice || 0);
			return sum + gain;
		}, 0);
	};

	const getAverageReturn = () => {
		if (insuranceAssets.length === 0) return 0;
		const totalReturn = insuranceAssets.reduce((sum, asset) => sum + (asset.annualReturn || 0), 0);
		return totalReturn / insuranceAssets.length;
	};

	const totalValue = getTotalValue();
	const totalGain = getTotalGain();
	const gainPercent = totalValue > 0 ? (totalGain / (totalValue - totalGain)) * 100 : 0;
	const averageReturn = getAverageReturn();

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("fr-FR", {
			style: "currency",
			currency: "EUR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const getCategoryBadge = (category: string) => {
		const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> =
			{
				life_insurance: { label: "Assurance Vie", variant: "default" },
				retirement: { label: "PER", variant: "secondary" },
				savings: { label: "Épargne", variant: "outline" },
			};
		return badges[category] || { label: category, variant: "outline" };
	};

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleAddInsurance = async (formData: any) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addLifeInsurance({
				name: formData.name,
				assetTypeID: "5", // Life Insurance asset type ID from server
				policyNumber: formData.policyNumber || "N/A",
				insurer: formData.provider || "Unknown",
				policyType: formData.category || "life_insurance",
				coverageAmount: parseFloat(formData.coverageAmount) || 0,
				premiumAmount: parseFloat(formData.premiumAmount) || 0,
				premiumFrequency: formData.premiumFrequency || "yearly",
				beneficiaries: Array.isArray(formData.beneficiaries)
					? formData.beneficiaries
					: typeof formData.beneficiaries === "string" && formData.beneficiaries
						? formData.beneficiaries
								.split(",")
								.map((b: string) => b.trim())
								.filter(Boolean)
						: [],
				currentValue: parseFloat(formData.currentValue) || undefined,
				purchasePrice: parseFloat(formData.purchasePrice) || undefined,
				purchaseDate: formData.openingDate || undefined,
			});

			if (result.asset) {
				setIsAddFormOpen(false);
				toast.success("Insurance policy added successfully");
				await refetch();
			} else {
				throw new Error("createLifeInsuranceAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add insurance policy. Please try again.");
			throw error;
		}
	};

	if (insuranceAssets.length === 0) {
		return (
			<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
				<AssetPageHeader
					title="Insurance & Retirement"
					description="Manage your insurance policies and retirement plans."
					onBack={onBack}
					actions={
						<Button
							size="sm"
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs"
							onClick={() => setIsAddFormOpen(true)}
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Insurance
						</Button>
					}
				/>

				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Shield className="h-16 w-16 text-muted-foreground mb-4" />
						<h3 className="mb-2">No Insurance Policies</h3>
						<p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
							Start tracking your insurance policies, life insurance contracts, and retirement
							plans.
						</p>
						<Button onClick={() => setIsAddFormOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Your First Policy
						</Button>
					</CardContent>
				</Card>

				<Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Add Insurance Policy</DialogTitle>
						</DialogHeader>
						<AddInsuranceForm
							onSubmit={handleAddInsurance}
							onCancel={() => setIsAddFormOpen(false)}
						/>
					</DialogContent>
				</Dialog>
			</div>
		);
	}

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			<AssetPageHeader
				title="Insurance & Retirement"
				description="Manage your insurance policies, life insurance contracts, and retirement plans."
				onBack={onBack}
				actions={
					<Button
						size="sm"
						className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs"
						onClick={() => setIsAddFormOpen(true)}
					>
						<Plus className="mr-1.5 h-3.5 w-3.5" />
						Add Insurance
					</Button>
				}
			/>

			{/* Benchmark metrics */}
			<BenchmarkMetricsBar portfolioID={selectedPortfolio?.id} benchmarkMode="sp500" />

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Value</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="font-mono">{formatCurrency(totalValue)}</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Gain</CardDescription>
					</CardHeader>
					<CardContent>
						<div
							className={`flex items-center gap-1.5 font-mono ${totalGain >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{totalGain >= 0 ? (
								<TrendArrowUp className="flex-shrink-0" />
							) : (
								<TrendArrowDown className="flex-shrink-0" />
							)}
							<span>{formatCurrency(Math.abs(totalGain))}</span>
							<span className="text-xs">({gainPercent.toFixed(2)}%)</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Average Return</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2 font-mono">
							<Percent className="h-4 w-4 text-muted-foreground" />
							<span>{averageReturn.toFixed(2)}%</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Active Policies</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2 font-mono">
							<FileText className="h-4 w-4 text-muted-foreground" />
							<span>{insuranceAssets.length}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters & Search */}
			<Card className="mb-6">
				<CardContent className="pt-6">
					<div className="flex flex-col md:flex-row gap-4">
						<SearchInput
							placeholder="Search policies..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onClear={() => setSearchTerm("")}
							containerClassName="flex-1"
						/>

						<Select value={filterCategory} onValueChange={setFilterCategory}>
							<SelectTrigger className="w-full md:w-[200px]">
								<Filter className="h-4 w-4 mr-2" />
								<SelectValue placeholder="Filter by category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Categories</SelectItem>
								<SelectItem value="life_insurance">Life Insurance</SelectItem>
								<SelectItem value="retirement">Retirement</SelectItem>
								<SelectItem value="savings">Savings</SelectItem>
							</SelectContent>
						</Select>

						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger className="w-full md:w-[200px]">
								<SortAsc className="h-4 w-4 mr-2" />
								<SelectValue placeholder="Sort by" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="value">Value</SelectItem>
								<SelectItem value="gain">Gain</SelectItem>
								<SelectItem value="return">Return</SelectItem>
								<SelectItem value="name">Name</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex gap-2">
							<Button
								variant={viewMode === "grid" ? "default" : "outline"}
								size="icon"
								onClick={() => setViewMode("grid")}
							>
								<LayoutGrid className="h-4 w-4" />
							</Button>
							<Button
								variant={viewMode === "list" ? "default" : "outline"}
								size="icon"
								onClick={() => setViewMode("list")}
							>
								<List className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Grid View */}
			{viewMode === "grid" && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredInsurances.map((insurance) => {
						const gain = (insurance.currentValue || 0) - (insurance.purchasePrice || 0);
						const gainPercent =
							insurance.purchasePrice > 0 ? (gain / insurance.purchasePrice) * 100 : 0;
						const categoryBadge = getCategoryBadge(insurance.category);

						return (
							<Card
								key={insurance.id}
								className="cursor-pointer hover:shadow-md transition-shadow"
								onClick={() => handleSelectInsurance(insurance.id)}
							>
								<CardHeader>
									<div className="flex items-start justify-between mb-2">
										<Shield className="h-10 w-10 text-primary" />
										<Badge variant={categoryBadge.variant}>{categoryBadge.label}</Badge>
									</div>
									<CardTitle className="line-clamp-1">{insurance.name}</CardTitle>
									<CardDescription className="text-xs">
										Policy {insurance.policyNumber}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div>
											<p className="text-xs text-muted-foreground mb-1">Current Value</p>
											<p className="font-mono">{formatCurrency(insurance.currentValue || 0)}</p>
										</div>

										<div>
											<p className="text-xs text-muted-foreground mb-1">Gain/Loss</p>
											<div
												className={`flex items-center gap-1.5 font-mono text-sm ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
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

										{insurance.annualReturn && (
											<div>
												<p className="text-xs text-muted-foreground mb-1">Annual Return</p>
												<p className="font-mono text-sm">{insurance.annualReturn.toFixed(2)}%</p>
											</div>
										)}

										<div className="pt-2 border-t">
											<Button variant="ghost" size="sm" className="w-full justify-between">
												View Details
												<ArrowRight className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* List View */}
			{viewMode === "list" && (
				<Card>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Policy</TableHead>
								<TableHead>Category</TableHead>
								<TableHead className="text-right">Current Value</TableHead>
								<TableHead className="text-right">Gain/Loss</TableHead>
								<TableHead className="text-right">Annual Return</TableHead>
								<TableHead>Opening Date</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredInsurances.map((insurance) => {
								const gain = (insurance.currentValue || 0) - (insurance.purchasePrice || 0);
								const gainPercent =
									insurance.purchasePrice > 0 ? (gain / insurance.purchasePrice) * 100 : 0;
								const categoryBadge = getCategoryBadge(insurance.category);

								return (
									<TableRow
										key={insurance.id}
										className="cursor-pointer"
										onClick={() => handleSelectInsurance(insurance.id)}
									>
										<TableCell>
											<div>
												<p className="font-medium">{insurance.name}</p>
												<p className="text-xs text-muted-foreground">{insurance.policyNumber}</p>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant={categoryBadge.variant}>{categoryBadge.label}</Badge>
										</TableCell>
										<TableCell className="text-right font-mono">
											{formatCurrency(insurance.currentValue || 0)}
										</TableCell>
										<TableCell className="text-right">
											<div
												className={`flex items-center justify-end gap-1.5 font-mono ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												{gain >= 0 ? (
													<TrendArrowUp className="flex-shrink-0" />
												) : (
													<TrendArrowDown className="flex-shrink-0" />
												)}
												<span>{formatCurrency(Math.abs(gain))}</span>
												<span className="text-xs">({gainPercent.toFixed(2)}%)</span>
											</div>
										</TableCell>
										<TableCell className="text-right font-mono">
											{insurance.annualReturn ? `${insurance.annualReturn.toFixed(2)}%` : "-"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{insurance.openingDate
												? new Date(insurance.openingDate).toLocaleDateString("fr-FR")
												: "-"}
										</TableCell>
										<TableCell className="text-right">
											<Button variant="ghost" size="sm">
												<ArrowRight className="h-4 w-4" />
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</Card>
			)}

			{/* Add Insurance Dialog */}
			<Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add Insurance Policy</DialogTitle>
					</DialogHeader>
					<AddInsuranceForm
						onSubmit={handleAddInsurance}
						onCancel={() => setIsAddFormOpen(false)}
					/>
				</DialogContent>
			</Dialog>

			{/* Insurance Detail Panel */}
			<Sheet
				open={detailMode === "panel" && selectedInsuranceId !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedInsuranceId(null);
				}}
			>
				<SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
					{selectedInsuranceId && (
						<InsuranceDetail
							insuranceId={selectedInsuranceId}
							onBack={() => setSelectedInsuranceId(null)}
							isPanel={true}
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
