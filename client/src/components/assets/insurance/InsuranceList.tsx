import { useQuery } from "@apollo/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	ArrowRight,
	Building2,
	Calendar,
	ChevronDown,
	ChevronRight,
	Clock,
	Coins,
	FileText,
	Filter,
	Layers,
	List,
	MoreVertical,
	Percent,
	Plus,
	RefreshCw,
	Shield,
	SlidersHorizontal,
	Table as TableIcon,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetHeroChart, buildPerformanceSeries, type TimeRange } from "@/components/charts/AssetHeroChart";
import { type PortfolioAssetItem, usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ErrorBoundary from "@/components/ui/error-boundary";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddInsuranceForm } from "./AddInsuranceForm";
import { InsuranceDetail } from "./InsuranceDetail";
import {
	CATEGORY_LABELS,
	computeAnnualPremium,
	InsuranceExposureWidget,
} from "./InsuranceExposureWidget";

export interface InsuranceListProps {
	onSelectInsurance?: (insuranceId: string) => void;
	detailMode?: "external" | "panel";
	onBack?: () => void;
}

export type TableDensity = "compact" | "normal";
export type WorkspaceTab = "ledger" | "holdings";
export type GroupByOption = "insurer" | "category";

export function InsuranceList({
	onSelectInsurance,
	detailMode = "panel",
	onBack,
}: InsuranceListProps) {
	const { assets, addLifeInsurance, currentPortfolio, refetch, selectedPortfolio } = usePortfolio();
	const { formatCurrency } = useCurrency();
	const shouldReduceMotion = useReducedMotion();

	// Selected policy for details
	const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | null>(null);

	// Navigation & View States
	const [activeTab, setActiveTab] = useState<WorkspaceTab>("ledger");
	const [groupBy, setGroupBy] = useState<GroupByOption>("insurer");
	const [density, setDensity] = useState<TableDensity>(() => {
		try {
			const saved = localStorage.getItem("sf_insurance_table_density");
			return saved === "normal" ? "normal" : "compact";
		} catch {
			return "compact";
		}
	});

	// Filter & Sort States
	const [searchTerm, setSearchTerm] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [sortBy, setSortBy] = useState<"value" | "gain" | "coverage" | "return" | "name">("value");
	const [activeFilter, setActiveFilter] = useState<{ type: "insurer" | "category"; key: string } | null>(
		null,
	);
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");

	// Filter insurance assets only
	const insuranceAssets = useMemo(() => {
		return assets.filter(
			(a) =>
				a.type === "insurance" ||
				(a.type as string)?.toLowerCase()?.includes("insurance") ||
				a.policyNumber !== undefined ||
				a.insurer !== undefined,
		);
	}, [assets]);

	// Performance History for Insurance (scoped)
	const portfolioId = selectedPortfolio?.id || currentPortfolio;
	const { data: scopedHistoryData, loading: scopedHistoryLoading } = useQuery(
		GET_SCOPED_PERFORMANCE_HISTORY,
		{
			variables: {
				portfolioID: portfolioId,
				assetTypes: ["LIFE_INSURANCE"],
			},
			skip: !portfolioId,
			fetchPolicy: "cache-and-network",
		},
	);

	// Total Value & Coverage
	const totalValue = useMemo(() => {
		return insuranceAssets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
	}, [insuranceAssets]);

	const totalCost = useMemo(() => {
		return insuranceAssets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
	}, [insuranceAssets]);

	const totalGain = totalValue - totalCost;
	const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

	const totalCoverage = useMemo(() => {
		return insuranceAssets.reduce((sum, a) => sum + (a.coverageAmount || 0), 0);
	}, [insuranceAssets]);

	// Chart Holdings Mapping
	const chartHoldings = useMemo(() => {
		return insuranceAssets.map((a) => ({
			symbol: (a.insurer || a.name || "INS").toUpperCase().slice(0, 8),
			name: a.name || "Insurance Policy",
			value: a.currentValue || 0,
			weight: totalValue > 0 ? ((a.currentValue || 0) / totalValue) * 100 : 0,
		}));
	}, [insuranceAssets, totalValue]);

	// Performance data series
	const performanceData = useMemo(() => {
		const rawHistory = scopedHistoryData?.scopedPerformanceHistory ?? [];
		return buildPerformanceSeries(rawHistory, totalValue);
	}, [scopedHistoryData, totalValue]);

	// Filtered policies based on search, category dropdown, and active cross-filter
	const filteredInsurances = useMemo(() => {
		return insuranceAssets
			.filter((ins) => {
				// Search matching
				const query = searchTerm.toLowerCase().trim();
				const matchesSearch =
					!query ||
					ins.name?.toLowerCase().includes(query) ||
					ins.insurer?.toLowerCase().includes(query) ||
					ins.policyNumber?.toLowerCase().includes(query) ||
					ins.beneficiaries?.toLowerCase().includes(query);

				// Dropdown category matching
				const catKey = ins.policyType || ins.category || "life_insurance";
				const matchesCategory = categoryFilter === "all" || catKey === categoryFilter;

				// Active cross-filter from 30% widget
				let matchesCrossFilter = true;
				if (activeFilter) {
					if (activeFilter.type === "insurer") {
						const insCompany = ins.insurer || ins.institution || "Other Insurer";
						matchesCrossFilter = insCompany === activeFilter.key;
					} else if (activeFilter.type === "category") {
						matchesCrossFilter = catKey === activeFilter.key;
					}
				}

				return matchesSearch && matchesCategory && matchesCrossFilter;
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
					case "coverage":
						return (b.coverageAmount || 0) - (a.coverageAmount || 0);
					case "return":
						return (b.annualReturn || 0) - (a.annualReturn || 0);
					case "name":
						return (a.name || "").localeCompare(b.name || "");
					default:
						return 0;
				}
			});
	}, [insuranceAssets, searchTerm, categoryFilter, activeFilter, sortBy]);

	// Cross-filter statistics for animated banner
	const activeFilterStats = useMemo(() => {
		if (!activeFilter) return null;
		const count = filteredInsurances.length;
		const value = filteredInsurances.reduce((sum, p) => sum + (p.currentValue || 0), 0);
		const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
		const label =
			activeFilter.type === "category"
				? CATEGORY_LABELS[activeFilter.key] || activeFilter.key
				: activeFilter.key;
		return { label, count, value, percent };
	}, [activeFilter, filteredInsurances, totalValue]);

	// Grouped policies for Tab 2 (Holdings détaillées)
	const groupedHoldings = useMemo(() => {
		const groups = new Map<string, PortfolioAssetItem[]>();
		for (const policy of filteredInsurances) {
			const groupKey =
				groupBy === "insurer"
					? policy.insurer || policy.institution || "Other Insurer"
					: CATEGORY_LABELS[policy.policyType || policy.category || "life_insurance"] ||
						"Life Insurance";
			const list = groups.get(groupKey) || [];
			list.push(policy);
			groups.set(groupKey, list);
		}
		return Array.from(groups.entries()).map(([name, items]) => ({
			name,
			items,
			totalValue: items.reduce((sum, i) => sum + (i.currentValue || 0), 0),
			totalCoverage: items.reduce((sum, i) => sum + (i.coverageAmount || 0), 0),
			totalCost: items.reduce((sum, i) => sum + (i.purchasePrice || 0), 0),
		}));
	}, [filteredInsurances, groupBy]);

	// Selection handler
	const handleSelectPolicy = useCallback(
		(policyId: string) => {
			setSelectedInsuranceId((prev) => (prev === policyId ? null : policyId));
			onSelectInsurance?.(policyId);
		},
		[onSelectInsurance],
	);

	const handleToggleDensity = () => {
		const next: TableDensity = density === "compact" ? "normal" : "compact";
		setDensity(next);
		try {
			localStorage.setItem("sf_insurance_table_density", next);
		} catch {
			// ignore storage errors
		}
	};

	// biome-ignore lint/suspicious/noExplicitAny: form payload
	const handleAddInsurance = async (formData: any) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addLifeInsurance({
				name: formData.name,
				assetTypeID: "5",
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
				maturityDate: formData.maturityDate || undefined,
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

	// Empty state when no policies exist in portfolio
	if (insuranceAssets.length === 0) {
		return (
			<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
				<AssetPageHeader
					title="Insurance & Retirement"
					description="Manage life insurance policies, PER retirement contracts, guaranteed capital, and recurring premiums."
					onBack={onBack}
					actions={
						<Button
							size="sm"
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
							onClick={() => setIsAddFormOpen(true)}
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Policy
						</Button>
					}
				/>

				<Card className="border-border/40 shadow-xs">
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<div className="p-4 rounded-2xl bg-primary/5 text-primary mb-4 border border-primary/10">
							<Shield className="h-12 w-12" />
						</div>
						<h3 className="text-base font-bold mb-1">No Insurance Policies Tracked</h3>
						<p className="text-xs text-muted-foreground max-w-sm mb-6">
							Start tracking your life insurance contracts, PER retirement plans, capitalisation funds, and death coverages in your Private Terminal.
						</p>
						<Button
							size="sm"
							onClick={() => setIsAddFormOpen(true)}
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
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
			{/* Canonical Page Header */}
			<AssetPageHeader
				title="Insurance & Retirement"
				description="Manage life insurance policies, PER retirement contracts, guaranteed capital, and recurring premiums."
				onBack={onBack}
				actions={
					<div className="flex items-center gap-2 flex-wrap">
						<div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/40 text-micro font-mono text-muted-foreground">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
							<span>
								{filteredInsurances.length} polic{filteredInsurances.length !== 1 ? "ies" : "y"} •{" "}
								{formatCurrency(totalValue)}
								{totalCoverage > 0 && ` • ${formatCurrency(totalCoverage)} coverage`}
							</span>
						</div>

						<Button
							size="sm"
							onClick={() => setIsAddFormOpen(true)}
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Policy
						</Button>
					</div>
				}
			/>

			{/* 70/30 Hero Section: Insurance Capital Chart (70%) + Exposure & Outflow Widget (30%) */}
			<div className="grid grid-cols-1 gap-6 border-b border-border/30 pb-6 lg:grid-cols-10">
				{/* Left 70%: Insurance Capital Hero Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<ErrorBoundary>
						<AssetHeroChart
							title="Insurance & Retirement Capital"
							titleTooltip="Aggregated surrender value and capital accumulation across life insurance and retirement policies"
							data={performanceData}
							holdings={chartHoldings}
							totalEquity={totalValue}
							totalGain={totalGain}
							totalGainPercent={gainPercent}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={portfolioId}
							loading={scopedHistoryLoading && insuranceAssets.length === 0}
							defaultBenchmark="none"
							layoutId="insuranceHeroRangePillActive"
						/>
					</ErrorBoundary>
				</div>

				{/* Right 30%: Insurance Exposure Widget */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<ErrorBoundary>
						<InsuranceExposureWidget
							totalInsuranceValue={totalValue}
							policies={insuranceAssets}
							activeFilter={activeFilter}
							onSelectFilter={setActiveFilter}
							formatCurrency={formatCurrency}
							loading={scopedHistoryLoading && insuranceAssets.length === 0}
						/>
					</ErrorBoundary>
				</div>
			</div>

			{/* In-Viewport Active Cross-Filter Banner */}
			{activeFilterStats && (
				<motion.div
					key="insurance-cross-filter-banner"
					data-testid="cross-filter-banner"
					initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.99 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
					className="overflow-hidden"
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 text-xs shadow-xs mb-1">
						<div className="flex items-center gap-2.5 flex-wrap">
							<span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
							<span className="font-semibold text-foreground">
								Filtered by {activeFilter?.type === "category" ? "Category" : "Insurer"}:
							</span>
							<span className="font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-micro">
								{activeFilterStats.label}
							</span>
							<span className="text-muted-foreground text-micro sm:text-xs">
								({activeFilterStats.count} polic{activeFilterStats.count !== 1 ? "ies" : "y"} •{" "}
								{formatCurrency(activeFilterStats.value)} • {activeFilterStats.percent.toFixed(1)}%
								of insurance)
							</span>
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const el = document.getElementById("insurance-workspace-section");
									el?.scrollIntoView({ behavior: "smooth" });
								}}
								className="h-7 text-xs bg-background/80 hover:bg-background border-border/60 gap-1.5 cursor-pointer touch-target"
							>
								<span>Jump to Ledger</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setActiveFilter(null)}
								className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer touch-target"
							>
								<X className="h-3.5 w-3.5" />
								<span>Clear</span>
							</Button>
						</div>
					</div>
				</motion.div>
			)}

			{/* Segmented Workspace Navigation */}
			<div id="insurance-workspace-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-1 flex-wrap gap-3">
					<div
						className="relative flex max-w-full overflow-x-auto p-0.5 rounded-lg bg-muted border border-border/40"
						role="tablist"
						aria-label="Insurance workspace views"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "ledger"}
							onClick={() => setActiveTab("ledger")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeTab === "ledger"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeTab === "ledger" && (
								<motion.span
									layoutId="insuranceActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<TableIcon className="relative z-10 h-3.5 w-3.5" />
							<span className="relative z-10">Insurance Ledger</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{filteredInsurances.length}
							</span>
						</button>

						<button
							type="button"
							role="tab"
							aria-selected={activeTab === "holdings"}
							onClick={() => setActiveTab("holdings")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeTab === "holdings"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeTab === "holdings" && (
								<motion.span
									layoutId="insuranceActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<Layers className="relative z-10 h-3.5 w-3.5" />
							<span className="relative z-10">Holdings détaillées</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{groupedHoldings.length} groups
							</span>
						</button>
					</div>

					{/* Toolbar Controls */}
					<div className="flex items-center gap-2 flex-wrap">
						{activeTab === "holdings" && (
							<div className="flex items-center gap-1.5 text-xs">
								<span className="text-muted-foreground text-micro">Group by:</span>
								<div className="flex items-center p-0.5 rounded-lg bg-muted border border-border/40 text-micro">
									<button
										type="button"
										onClick={() => setGroupBy("insurer")}
										className={cn(
											"px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer",
											groupBy === "insurer"
												? "bg-background text-foreground shadow-xs border border-border/60"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										Insurer
									</button>
									<button
										type="button"
										onClick={() => setGroupBy("category")}
										className={cn(
											"px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer",
											groupBy === "category"
												? "bg-background text-foreground shadow-xs border border-border/60"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										Category
									</button>
								</div>
							</div>
						)}

						{activeTab === "ledger" && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleToggleDensity}
								className="h-8 text-xs gap-1.5 border-border/50 text-muted-foreground hover:text-foreground touch-target"
								title="Toggle table density"
							>
								<SlidersHorizontal className="h-3.5 w-3.5" />
								<span className="capitalize">{density}</span>
							</Button>
						)}
					</div>
				</div>

				{/* Search & Filter Toolbar */}
				<div className="flex flex-col sm:flex-row gap-3">
					<SearchInput
						placeholder="Search by policy name, insurer, or policy number..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						onClear={() => setSearchTerm("")}
						containerClassName="flex-1"
					/>

					<Select value={categoryFilter} onValueChange={setCategoryFilter}>
						<SelectTrigger className="w-full sm:w-[200px] h-9 text-xs">
							<Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
							<SelectValue placeholder="All Categories" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							<SelectItem value="life_insurance">Life Insurance</SelectItem>
							<SelectItem value="retirement">Retirement Plan</SelectItem>
							<SelectItem value="savings">Capitalisation Contract</SelectItem>
							<SelectItem value="death_insurance">Term Life</SelectItem>
							<SelectItem value="loan_insurance">Loan Insurance</SelectItem>
							<SelectItem value="whole_life">Permanent / Whole Life</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={sortBy}
						onValueChange={(val: "value" | "gain" | "coverage" | "return" | "name") =>
							setSortBy(val)
						}
					>
						<SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="value">Sort by Value</SelectItem>
							<SelectItem value="gain">Sort by Gain / Loss</SelectItem>
							<SelectItem value="coverage">Sort by Coverage</SelectItem>
							<SelectItem value="return">Sort by Return</SelectItem>
							<SelectItem value="name">Sort by Name</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Workspace Content with Responsive Split-Screen Details Pane */}
				<div className="w-full">
					{/* Active Split Layout: on wide desktop, if detailMode === "panel" and a policy is selected */}
					<div
						className={cn(
							"grid gap-6 transition-all duration-200",
							detailMode === "panel" && selectedInsuranceId
								? "grid-cols-1 lg:grid-cols-10"
								: "grid-cols-1",
						)}
					>
						{/* Left Column: Tables / Holdings (10 cols or 6 cols when docked) */}
						<div
							className={cn(
								"transition-all",
								detailMode === "panel" && selectedInsuranceId ? "lg:col-span-6" : "col-span-1",
							)}
						>
							{/* Tab 1: Ledger Compact */}
							{activeTab === "ledger" && (
								<Card className="border-border/40 shadow-xs overflow-hidden">
									<Table>
										<TableHeader>
											<TableRow className="border-border/40 hover:bg-transparent">
												<TableHead className="text-xs font-semibold">Policy & Insurer</TableHead>
												<TableHead className="text-xs font-semibold hidden md:table-cell">Type</TableHead>
												<TableHead className="text-xs font-semibold text-right hidden sm:table-cell">
													Guaranteed
												</TableHead>
												<TableHead className="text-xs font-semibold text-right hidden lg:table-cell">
													Scheduled Premium
												</TableHead>
												<TableHead className="text-xs font-semibold text-right">
													Surrender Value
												</TableHead>
												<TableHead className="text-xs font-semibold text-right">
													P&L / Return
												</TableHead>
												<TableHead className="text-xs font-semibold text-right w-[48px]" />
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredInsurances.length === 0 ? (
												<TableRow>
													<TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
														No insurance policies match your active search or filters.
													</TableCell>
												</TableRow>
											) : (
												filteredInsurances.map((ins) => {
													const purchase = ins.purchasePrice || 0;
													const current = ins.currentValue || 0;
													const gain = current - purchase;
													const gainPct = purchase > 0 ? (gain / purchase) * 100 : 0;
													const catKey = ins.policyType || ins.category || "life_insurance";
													const catLabel = CATEGORY_LABELS[catKey] || catKey.replace(/_/g, " ");
													const isSelected = selectedInsuranceId === ins.id;

													return (
														<TableRow
															key={ins.id}
															onClick={() => handleSelectPolicy(ins.id)}
															className={cn(
																"cursor-pointer transition-colors border-border/30",
																density === "compact" ? "h-11" : "h-14",
																isSelected
																	? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary"
																	: "hover:bg-muted/40",
															)}
														>
															<TableCell className={cn(density === "compact" ? "py-1.5" : "py-2.5")}>
																<div className="flex items-center gap-2.5 min-w-0">
																	<div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 hidden sm:block">
																		<Shield className="h-4 w-4" />
																	</div>
																	<div className="min-w-0">
																		<p className="font-semibold text-xs tracking-tight truncate">
																			{ins.name}
																		</p>
																		<p className="text-micro text-muted-foreground font-mono truncate">
																			{ins.insurer || ins.institution || "Unknown Insurer"}
																			{ins.policyNumber && ` • #${ins.policyNumber}`}
																		</p>
																	</div>
																</div>
															</TableCell>
															<TableCell className="hidden md:table-cell">
																<Badge variant="secondary" className="text-micro font-normal">
																	{catLabel}
																</Badge>
															</TableCell>
															<TableCell className="text-right font-mono text-xs hidden sm:table-cell">
																{ins.coverageAmount ? (
																	<span className="font-semibold text-foreground">
																		{formatCurrency(ins.coverageAmount)}
																	</span>
																) : (
																	<span className="text-muted-foreground">—</span>
																)}
															</TableCell>
															<TableCell className="text-right font-mono text-xs hidden lg:table-cell">
																{ins.premiumAmount ? (
																	<div>
																		<span className="font-semibold text-foreground">
																			{formatCurrency(ins.premiumAmount)}
																		</span>
																		<span className="text-micro text-muted-foreground ml-1 capitalize">
																			/{ins.premiumFrequency || "yr"}
																		</span>
																	</div>
																) : (
																	<span className="text-muted-foreground">—</span>
																)}
															</TableCell>
															<TableCell className="text-right font-mono text-xs">
																<span className="font-bold text-foreground">
																	{formatCurrency(current)}
																</span>
															</TableCell>
															<TableCell className="text-right font-mono text-xs">
																<div className="flex flex-col items-end">
																	<div
																		className={cn(
																			"flex items-center gap-1 font-semibold",
																			gain >= 0 ? "text-emerald-500" : "text-rose-500",
																		)}
																	>
																		{gain >= 0 ? (
																			<TrendArrowUp className="h-3 w-3" />
																		) : (
																			<TrendArrowDown className="h-3 w-3" />
																		)}
																		<span>{formatCurrency(Math.abs(gain))}</span>
																	</div>
																	<span className="text-micro text-muted-foreground">
																		{gainPct >= 0 ? `+${gainPct.toFixed(1)}%` : `${gainPct.toFixed(1)}%`}
																	</span>
																</div>
															</TableCell>
															<TableCell className="text-right pr-3">
																<ChevronRight
																	className={cn(
																		"h-4 w-4 text-muted-foreground transition-transform",
																		isSelected && "rotate-90 text-primary",
																	)}
																/>
															</TableCell>
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</Card>
							)}

							{/* Tab 2: Holdings Détaillées (Grouped View) */}
							{activeTab === "holdings" && (
								<div className="space-y-4">
									{groupedHoldings.length === 0 ? (
										<Card className="border-border/40 shadow-xs p-10 text-center text-muted-foreground text-xs">
											No insurance policies match your active filters.
										</Card>
									) : (
										groupedHoldings.map((group) => (
											<Card key={group.name} className="border-border/40 shadow-xs overflow-hidden">
												<CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/20">
													<div className="flex items-center justify-between flex-wrap gap-2">
														<div className="flex items-center gap-2">
															<span className="font-bold text-xs uppercase tracking-wider text-foreground">
																{group.name}
															</span>
															<span className="text-micro font-mono px-2 py-0.5 rounded-full bg-secondary/80 text-foreground/80">
																{group.items.length} contract{group.items.length !== 1 ? "s" : ""}
															</span>
														</div>
														<div className="flex items-center gap-3 text-xs font-mono">
															<span className="text-muted-foreground">
																Total:{" "}
																<strong className="text-foreground">{formatCurrency(group.totalValue)}</strong>
															</span>
															{group.totalCoverage > 0 && (
																<span className="text-muted-foreground hidden sm:inline">
																	• Guaranteed:{" "}
																	<strong className="text-emerald-500">
																		{formatCurrency(group.totalCoverage)}
																	</strong>
																</span>
															)}
														</div>
													</div>
												</CardHeader>
												<CardContent className="p-0">
													<div className="divide-y divide-border/20">
														{group.items.map((policy) => {
															const purchase = policy.purchasePrice || 0;
															const current = policy.currentValue || 0;
															const gain = current - purchase;
															const gainPct = purchase > 0 ? (gain / purchase) * 100 : 0;
															const isSelected = selectedInsuranceId === policy.id;

															return (
																<div
																	key={policy.id}
																	onClick={() => handleSelectPolicy(policy.id)}
																	className={cn(
																		"p-4 cursor-pointer transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs",
																		isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40",
																	)}
																>
																	<div className="space-y-1 min-w-0">
																		<div className="flex items-center gap-2">
																			<h4 className="font-bold text-sm tracking-tight truncate">
																				{policy.name}
																			</h4>
																			{policy.policyType && (
																				<Badge variant="outline" className="text-micro uppercase">
																					{CATEGORY_LABELS[policy.policyType] || policy.policyType}
																				</Badge>
																			)}
																		</div>
																		<p className="text-micro text-muted-foreground font-mono">
																			Policy #{policy.policyNumber || "N/A"} • Insurer:{" "}
																			{policy.insurer || policy.institution || "Unknown"}
																			{policy.openingDate &&
																				` • Active since ${new Date(policy.openingDate).getFullYear()}`}
																		</p>
																		{policy.beneficiaries && (
																			<p className="text-micro text-muted-foreground truncate">
																				Beneficiaries: <span className="text-foreground">{policy.beneficiaries}</span>
																			</p>
																		)}
																	</div>

																	<div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto shrink-0 font-mono">
																		{policy.coverageAmount ? (
																			<div className="text-right hidden md:block">
																				<p className="text-micro text-muted-foreground">Guaranteed</p>
																				<p className="font-semibold text-foreground">
																					{formatCurrency(policy.coverageAmount)}
																				</p>
																			</div>
																		) : null}

																		<div className="text-right">
																			<p className="text-micro text-muted-foreground">Surrender Value</p>
																			<p className="font-bold text-sm text-foreground">
																				{formatCurrency(current)}
																			</p>
																		</div>

																		<div className="text-right min-w-[70px]">
																			<p className="text-micro text-muted-foreground">P&L</p>
																			<p
																				className={cn(
																					"font-bold text-xs",
																					gain >= 0 ? "text-emerald-500" : "text-rose-500",
																				)}
																			>
																				{gainPct >= 0 ? `+${gainPct.toFixed(1)}%` : `${gainPct.toFixed(1)}%`}
																			</p>
																		</div>

																		<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
																			<ChevronRight className="h-4 w-4 text-muted-foreground" />
																		</Button>
																	</div>
																</div>
															);
														})}
													</div>
												</CardContent>
											</Card>
										))
									)}
								</div>
							)}
						</div>

						{/* Right Column: Docked Details Pane on Desktop in panel mode */}
						{detailMode === "panel" && selectedInsuranceId && (
							<div className="hidden lg:block lg:col-span-4 border border-border/40 rounded-xl bg-card shadow-xs overflow-hidden sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
								<InsuranceDetail
									insuranceId={selectedInsuranceId}
									onBack={() => setSelectedInsuranceId(null)}
									isPanel={true}
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Slide-over Sheet for Details on Mobile or when not in wide docked pane */}
			<Sheet
				open={selectedInsuranceId !== null && (detailMode !== "panel" || typeof window !== "undefined" && window.innerWidth < 1024)}
				onOpenChange={(open) => {
					if (!open) setSelectedInsuranceId(null);
				}}
			>
				<SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
					<SheetHeader className="sr-only">
						<SheetTitle>Insurance Policy Details</SheetTitle>
						<SheetDescription>Detailed contractual clauses and capital coverage</SheetDescription>
					</SheetHeader>
					{selectedInsuranceId && (
						<InsuranceDetail
							insuranceId={selectedInsuranceId}
							onBack={() => setSelectedInsuranceId(null)}
							isPanel={true}
						/>
					)}
				</SheetContent>
			</Sheet>

			{/* Add Insurance Dialog */}
			<Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add Insurance Policy</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Enter the contract details, insurer, guaranteed coverage, and premium terms.
						</DialogDescription>
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
