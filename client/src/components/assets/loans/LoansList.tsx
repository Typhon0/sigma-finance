import {
	Banknote,
	Building2,
	Calendar,
	CheckCircle2,
	ChevronDown,
	CreditCard,
	ExternalLink,
	Filter,
	Layers,
	MoreVertical,
	Percent,
	Plus,
	SlidersHorizontal,
	Trash2,
	TrendingDown,
	TrendingUp,
	X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import React, { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetHeroChart, buildPerformanceSeries } from "@/components/charts/AssetHeroChart";
import type { TimeRange } from "@/components/charts/PortfolioHeroChart";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Progress } from "@/components/ui/progress";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type AddLoanInput, useAssetMutations } from "@/hooks/use-asset-mutations";
import { useCurrency } from "@/hooks/use-currency";
import {
	computeLoanToValue,
	computePortfolioDebtSummary,
	type PortfolioLoanItem,
} from "@/lib/loan-calculator";
import { cn } from "@/lib/utils";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddLoanForm } from "./AddLoanForm";
import { LoanDetail } from "./LoanDetail";
import {
	type LoanCategorySlice,
	LoansExposureWidget,
	LOAN_TYPE_COLORS,
} from "./LoansExposureWidget";

interface LoansListProps {
	onSelectLoan?: (loanId: string) => void;
	detailMode?: "external" | "panel";
	onBack?: () => void;
}

const LOAN_ASSET_TYPE_ID = "7"; // Loan asset type ID from server

export function LoansList({ onSelectLoan, detailMode = "panel", onBack }: LoansListProps) {
	const shouldReduceMotion = useReducedMotion();
	const { assets, currentPortfolio, refetch, selectedPortfolio, deleteAsset } = usePortfolio();
	const { addLoan } = useAssetMutations();
	const { formatCurrencyCompact: formatCurrency, currency: displayCurrency } = useCurrency();

	// Navigation & state
	const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"ledger" | "holdings">("ledger");
	const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);
	const [loanToDelete, setLoanToDelete] = useState<{ id: string; name: string } | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Filters & table controls
	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState<"balance" | "payment" | "rate" | "name" | "progress">("balance");
	const [filterType, setFilterType] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
	const [timeRange, setTimeRange] = useState<TimeRange>("1Y");

	// Row density with local storage persistence
	const [density, setDensity] = useState<"compact" | "normal">(() => {
		try {
			const saved = localStorage.getItem("sf_loans_table_density");
			return saved === "compact" || saved === "normal" ? saved : "compact";
		} catch {
			return "compact";
		}
	});

	const handleToggleDensity = () => {
		const next = density === "compact" ? "normal" : "compact";
		setDensity(next);
		try {
			localStorage.setItem("sf_loans_table_density", next);
		} catch {
			// ignore storage errors
		}
	};

	// Map raw assets to typed PortfolioLoanItem list
	const loanItems = useMemo((): PortfolioLoanItem[] => {
		return assets
			.filter((a) => a.type === "loan")
			.map((a) => {
				const remBal = a.remainingBalance ?? a.currentValue ?? 0;
				const origAmt = a.loanAmount ?? a.purchasePrice ?? remBal;
				return {
					id: a.id,
					name: a.name,
					loanType: a.loanType || "amortizing",
					loanAmount: origAmt,
					remainingBalance: remBal,
					interestRate: a.interestRate ?? 0,
					durationMonths: a.durationMonths ?? 0,
					monthlyPayment: a.monthlyPayment ?? 0,
					currency: a.currency || displayCurrency,
					ownershipPercentage: a.ownershipPercentage ?? 100,
					lender: a.lender || a.symbol,
					status: a.status || "active",
					startDate: a.startDate,
					linkedAssetIds: a.linkedAssetIds || [],
				};
			});
	}, [assets, displayCurrency]);

	// Compute aggregated debt metrics using zero-random calculator
	const debtSummary = useMemo(() => {
		return computePortfolioDebtSummary(loanItems);
	}, [loanItems]);

	// Build exposure slices for LoansExposureWidget
	const categorySlices = useMemo((): LoanCategorySlice[] => {
		if (loanItems.length === 0) return [];
		const map: Record<string, { count: number; value: number }> = {};

		for (const loan of loanItems) {
			const key = loan.loanType || "other";
			if (!map[key]) {
				map[key] = { count: 0, value: 0 };
			}
			map[key].count += 1;
			map[key].value += loan.remainingBalance;
		}

		const totalGross = debtSummary.totalGrossDebt;

		return Object.entries(map)
			.map(([key, data]) => {
				const rawLabel = key.replace("-", " ");
				const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
				const color = LOAN_TYPE_COLORS[key] || LOAN_TYPE_COLORS.other;
				return {
					key,
					label,
					color,
					count: data.count,
					value: data.value,
					percent: totalGross > 0 ? (data.value / totalGross) * 100 : 0,
				};
			})
			.sort((a, b) => b.value - a.value);
	}, [loanItems, debtSummary.totalGrossDebt]);

	// Active filter slice stats
	const activeFilterStats = useMemo(() => {
		if (!activeCategoryFilter) return null;
		return categorySlices.find((s) => s.key === activeCategoryFilter) || null;
	}, [activeCategoryFilter, categorySlices]);

	// Performance series for HeroChart: descending debt balance trajectory
	const performanceData = useMemo(() => {
		if (loanItems.length === 0) {
			return buildPerformanceSeries([], 0);
		}
		const now = new Date();
		const points: Array<{ date: string; value: number }> = [];

		for (let i = 11; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			const dateStr = d.toISOString().split("T")[0];

			let totalAtDate = 0;
			for (const loan of loanItems) {
				const sDate = loan.startDate ? new Date(loan.startDate) : now;
				if (d < sDate) {
					continue;
				}
				const monthsSinceStart = Math.max(
					0,
					(d.getFullYear() - sDate.getFullYear()) * 12 + (d.getMonth() - sDate.getMonth()),
				);
				const totalMonthsElapsed = Math.max(
					1,
					(now.getFullYear() - sDate.getFullYear()) * 12 + (now.getMonth() - sDate.getMonth()),
				);

				const totalAmortizedSoFar = Math.max(0, loan.loanAmount - loan.remainingBalance);
				const amortizedAtD = Math.min(
					totalAmortizedSoFar,
					(monthsSinceStart / totalMonthsElapsed) * totalAmortizedSoFar,
				);
				const balanceAtD = Math.max(0, loan.loanAmount - amortizedAtD);
				totalAtDate += balanceAtD;
			}
			points.push({ date: dateStr, value: totalAtDate });
		}

		return buildPerformanceSeries(points, debtSummary.totalGrossDebt);
	}, [loanItems, debtSummary.totalGrossDebt]);

	// Chart holdings for HeroChart
	const chartHoldings = useMemo(() => {
		return loanItems.map((loan) => ({
			value: loan.remainingBalance,
			currentPrice: loan.remainingBalance,
			changePercent: 0,
		}));
	}, [loanItems]);

	// Handle row click
	const handleSelectLoan = (loanId: string) => {
		if (detailMode === "panel") {
			setSelectedLoanId(loanId);
		} else {
			onSelectLoan?.(loanId);
		}
	};

	// Filtered & sorted loans
	const filteredLoans = useMemo(() => {
		return loanItems
			.filter((loan) => {
				if (searchTerm.trim()) {
					const term = searchTerm.toLowerCase();
					const matchName = loan.name?.toLowerCase().includes(term);
					const matchLender = loan.lender?.toLowerCase().includes(term);
					if (!matchName && !matchLender) return false;
				}
				if (filterType !== "all" && loan.loanType !== filterType) {
					return false;
				}
				if (filterStatus !== "all" && loan.status !== filterStatus) {
					return false;
				}
				if (activeCategoryFilter && loan.loanType !== activeCategoryFilter) {
					return false;
				}
				return true;
			})
			.sort((a, b) => {
				switch (sortBy) {
					case "balance":
						return b.remainingBalance - a.remainingBalance;
					case "payment":
						return b.monthlyPayment - a.monthlyPayment;
					case "rate":
						return b.interestRate - a.interestRate;
					case "name":
						return a.name.localeCompare(b.name);
					case "progress": {
						const progA = a.loanAmount > 0 ? (a.loanAmount - a.remainingBalance) / a.loanAmount : 0;
						const progB = b.loanAmount > 0 ? (b.loanAmount - b.remainingBalance) / b.loanAmount : 0;
						return progB - progA;
					}
					default:
						return 0;
				}
			});
	}, [loanItems, searchTerm, filterType, filterStatus, activeCategoryFilter, sortBy]);

	// Add loan form handler
	const handleAddLoan = async (formData: {
		name: string;
		type: string;
		loanAmount: string;
		downPayment: string;
		currency: string;
		description: string;
		interestRate: string;
		duration: string;
		startDate: Date | undefined;
		endDate: Date | undefined;
		monthlyPayment: string;
		remainingBalance: string;
		bank: string;
		loanNumber: string;
		applicationFee: string;
		brokerFee: string;
		insuranceFee: string;
		otherFees: string;
		earlyRepaymentFee: string;
		ownershipMode: string;
		ownershipPercentage?: string;
		linkedAssetIds?: string[];
		steps?: Array<{ id: string; date: Date | undefined; amount: string; interestRate: string }>;
		coOwners?: Array<{ id: string; type: string; userId?: string; name: string; percentage: string }>;
		companyOwners?: Array<{
			id: string;
			type: string;
			companyId?: string;
			name: string;
			registrationNumber: string;
			legalForm: string;
			percentage: string;
		}>;
	}) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}

		const input: AddLoanInput = {
			portfolioId: currentPortfolio,
			assetTypeID: LOAN_ASSET_TYPE_ID,
			name: formData.name,
			description: formData.description || undefined,
			loanType: formData.type,
			loanAmount: parseFloat(formData.loanAmount) || 0,
			remainingBalance:
				parseFloat(formData.remainingBalance) || parseFloat(formData.loanAmount) || 0,
			interestRate: parseFloat(formData.interestRate) || 0,
			durationMonths: parseInt(formData.duration, 10) || 0,
			monthlyPayment: parseFloat(formData.monthlyPayment) || 0,
			startDate: formData.startDate
				? formData.startDate.toISOString().split("T")[0]
				: new Date().toISOString().split("T")[0],
			endDate: formData.endDate ? formData.endDate.toISOString().split("T")[0] : undefined,
			lender: formData.bank || "Unknown",
			loanNumber: formData.loanNumber || undefined,
			currency: formData.currency || "EUR",
			downPayment: formData.downPayment ? parseFloat(formData.downPayment) : undefined,
			status: "active",
			ownershipMode: formData.ownershipMode || undefined,
			ownershipPercentage: formData.ownershipPercentage
				? parseFloat(formData.ownershipPercentage)
				: 100,
			applicationFee: formData.applicationFee ? parseFloat(formData.applicationFee) : undefined,
			brokerFee: formData.brokerFee ? parseFloat(formData.brokerFee) : undefined,
			insuranceFee: formData.insuranceFee ? parseFloat(formData.insuranceFee) : undefined,
			otherFees: formData.otherFees ? parseFloat(formData.otherFees) : undefined,
			earlyRepaymentFee: formData.earlyRepaymentFee
				? parseFloat(formData.earlyRepaymentFee)
				: undefined,
			linkedAssetIDs: formData.linkedAssetIds?.length ? formData.linkedAssetIds : undefined,
			steps: formData.steps?.length
				? formData.steps.map((s) => ({
						id: s.id,
						date: s.date ? s.date.toISOString().split("T")[0] : undefined,
						amount: parseFloat(s.amount) || 0,
						interestRate: parseFloat(s.interestRate) || 0,
					}))
				: undefined,
			coOwners: formData.coOwners?.length
				? formData.coOwners.map((co) => ({
						id: co.id,
						type: co.type,
						userId: co.userId,
						name: co.name,
						percentage: parseFloat(co.percentage) || 0,
					}))
				: undefined,
			companyOwners: formData.companyOwners?.length
				? formData.companyOwners.map((co) => ({
						id: co.id,
						type: co.type,
						companyId: co.companyId,
						name: co.name,
						registrationNumber: co.registrationNumber,
						legalForm: co.legalForm,
						percentage: parseFloat(co.percentage) || 0,
					}))
				: undefined,
			currentValue: parseFloat(formData.remainingBalance) || parseFloat(formData.loanAmount) || 0,
			purchasePrice: parseFloat(formData.loanAmount) || 0,
			purchaseDate: formData.startDate
				? formData.startDate.toISOString()
				: new Date().toISOString(),
		};

		try {
			const result = await addLoan(input);
			if (result.asset) {
				toast.success("Loan added successfully");
				await refetch();
				setIsAddFormOpen(false);
			} else {
				throw new Error("createLoanAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add loan. Please try again.");
			throw error;
		}
	};

	// Delete loan handler
	const handleDeleteConfirm = async () => {
		if (!loanToDelete) return;
		setIsDeleting(true);
		try {
			if (typeof deleteAsset === "function") {
				await deleteAsset(loanToDelete.id, currentPortfolio || undefined);
				toast.success(`Loan "${loanToDelete.name}" deleted`);
				setLoanToDelete(null);
				if (selectedLoanId === loanToDelete.id) {
					setSelectedLoanId(null);
				}
				await refetch();
			} else {
				throw new Error("deleteAsset handler unavailable");
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to delete loan";
			toast.error(msg);
		} finally {
			setIsDeleting(false);
		}
	};

	// Helper to find linked asset and calculate LTV
	const getLinkedAssetInfo = useCallback(
		(loan: PortfolioLoanItem) => {
			if (!loan.linkedAssetIds || loan.linkedAssetIds.length === 0) return null;
			const linkedId = loan.linkedAssetIds[0];
			const linked = assets.find((a) => a.id === linkedId);
			if (!linked) return null;
			const ltv = computeLoanToValue(loan.remainingBalance, linked.currentValue || 0);
			return {
				name: linked.name,
				type: linked.type,
				value: linked.currentValue || 0,
				ltv,
			};
		},
		[assets],
	);

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			{/* Canonical Page Header */}
			<AssetPageHeader
				title="Loans & Debt"
				description="Manage liabilities, monitor amortized reduction, debt service drag, and collateral coverage."
				onBack={onBack}
				actions={
					<div className="flex items-center gap-2 flex-wrap">
						{loanItems.length > 0 && (
							<div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/40 text-xs font-mono text-muted-foreground">
								<div className="flex items-center gap-1.5">
									<span className="h-1.5 w-1.5 rounded-full bg-loss" />
									<span className="text-foreground font-semibold">
										{formatCurrency(debtSummary.totalNetDebt)}
									</span>
									<span className="text-micro text-muted-foreground">net</span>
								</div>
								<span className="text-border">|</span>
								<div>
									<span>{debtSummary.activeLoansCount} active</span>
								</div>
								<span className="text-border">|</span>
								<div>
									<span>{debtSummary.weightedAverageRate.toFixed(2)}% WAC</span>
								</div>
							</div>
						)}

						<Button
							size="sm"
							onClick={() => setIsAddFormOpen(true)}
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Loan
						</Button>
					</div>
				}
			/>

			{/* 70/30 Hero Section: AssetHeroChart (70%) + LoansExposureWidget (30%) */}
			<div className="grid grid-cols-1 gap-6 border-b border-border/30 pb-6 lg:grid-cols-10">
				{/* Left 70%: Debt Outstanding Trajectory Hero Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<ErrorBoundary>
						<AssetHeroChart
							title="Total Debt Outstanding"
							titleTooltip="Aggregated liabilities and amortized reduction trajectory across all loans"
							data={performanceData}
							holdings={chartHoldings}
							totalEquity={debtSummary.totalGrossDebt}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={selectedPortfolio?.id}
							defaultBenchmark="none"
							layoutId="loansHeroRangePillActive"
						/>
					</ErrorBoundary>
				</div>

				{/* Right 30%: Debt Exposure & Service Brief */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<ErrorBoundary>
						<LoansExposureWidget
							totalGrossDebt={debtSummary.totalGrossDebt}
							totalNetDebt={debtSummary.totalNetDebt}
							slices={categorySlices}
							activeFilter={activeCategoryFilter}
							onSelectCategory={setActiveCategoryFilter}
							formatCurrency={formatCurrency}
							weightedAverageRate={debtSummary.weightedAverageRate}
							totalGrossMonthlyPayment={debtSummary.totalGrossMonthlyPayment}
							totalNetMonthlyPayment={debtSummary.totalNetMonthlyPayment}
							amortizedRatio={debtSummary.amortizedRatio}
							principalPaidGross={debtSummary.principalPaidGross}
							currencyBreakdown={debtSummary.currencyBreakdown}
						/>
					</ErrorBoundary>
				</div>
			</div>

			{/* In-Viewport Active Cross-Filter Banner */}
			{activeFilterStats && (
				<motion.div
					key="loans-cross-filter-banner"
					data-testid="cross-filter-banner"
					initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.99 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
					className="overflow-hidden"
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 text-xs shadow-xs mb-1">
						<div className="flex items-center gap-2.5 flex-wrap">
							<span
								className="h-2 w-2 rounded-full animate-pulse"
								style={{ backgroundColor: activeFilterStats.color }}
							/>
							<span className="font-semibold text-foreground">Filtered by Loan Type:</span>
							<span className="font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-micro">
								{activeFilterStats.label}
							</span>
							<span className="text-muted-foreground text-micro sm:text-xs">
								({activeFilterStats.count} {activeFilterStats.count !== 1 ? "loans" : "loan"} •{" "}
								{formatCurrency(activeFilterStats.value)} •{" "}
								{activeFilterStats.percent.toFixed(1)}% of total debt)
							</span>
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const el = document.getElementById("loans-workspace-section");
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
								onClick={() => setActiveCategoryFilter(null)}
								className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer touch-target"
							>
								<X className="h-3.5 w-3.5" />
								<span>Clear</span>
							</Button>
						</div>
					</div>
				</motion.div>
			)}

			{/* Segmented Workspace Navigation (2 Tabs) */}
			<div id="loans-workspace-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-1 flex-wrap gap-2">
					{/* Tab switcher */}
					<div
						className="relative flex max-w-full overflow-x-auto p-0.5 rounded-lg bg-muted border border-border/40"
						role="tablist"
						aria-label="Loans workspace view"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeWorkspaceTab === "ledger"}
							onClick={() => setActiveWorkspaceTab("ledger")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeWorkspaceTab === "ledger"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeWorkspaceTab === "ledger" && (
								<motion.span
									layoutId="loansActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<CreditCard className="relative z-10 h-3.5 w-3.5" />
							<span className="relative z-10">Debt Ledger</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{filteredLoans.length}
							</span>
						</button>

						<button
							type="button"
							role="tab"
							aria-selected={activeWorkspaceTab === "holdings"}
							onClick={() => setActiveWorkspaceTab("holdings")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeWorkspaceTab === "holdings"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeWorkspaceTab === "holdings" && (
								<motion.span
									layoutId="loansActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<Layers className="relative z-10 h-3.5 w-3.5" />
							<span className="relative z-10">Holdings & Amortization</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{loanItems.length}
							</span>
						</button>
					</div>

					{/* Workspace Toolbar Controls */}
					<div className="flex items-center gap-2">
						{activeWorkspaceTab === "ledger" && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleToggleDensity}
								className="h-8 text-xs gap-1.5 border-border/50 hidden sm:flex touch-target"
								title="Toggle table row height"
							>
								<SlidersHorizontal className="h-3.5 w-3.5" />
								<span>{density === "compact" ? "Compact" : "Normal"}</span>
							</Button>
						)}
					</div>
				</div>

				{/* Empty State when zero loans */}
				{loanItems.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border/60 p-10 text-center space-y-3 bg-card/30 my-4">
						<div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
							<CreditCard className="h-5 w-5" />
						</div>
						<h3 className="font-semibold text-foreground text-sm">No Active Loans Found</h3>
						<p className="text-xs text-muted-foreground max-w-md mx-auto">
							Track real mortgages, consumer loans, auto financing, student debt, and in-fine facilities
							with accurate amortization and collateral monitoring.
						</p>
						<Button
							size="sm"
							onClick={() => setIsAddFormOpen(true)}
							className="mt-2 h-8 text-xs font-semibold"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Your First Loan
						</Button>
					</div>
				) : (
					<>
						{/* Tab 1: Debt Ledger */}
						{activeWorkspaceTab === "ledger" && (
							<div className="space-y-4">
								{/* Filters Bar */}
								<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
									<div className="flex items-center gap-2 flex-1 flex-wrap">
										<SearchInput
											placeholder="Search loans, lenders..."
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											onClear={() => setSearchTerm("")}
											size="sm"
											containerClassName="w-full sm:w-64"
										/>

										<Select value={filterType} onValueChange={setFilterType}>
											<SelectTrigger className="w-[140px] h-8 text-xs">
												<Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
												<SelectValue placeholder="All Types" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All Types</SelectItem>
												<SelectItem value="amortizing">Amortizing</SelectItem>
												<SelectItem value="in-fine">In Fine</SelectItem>
												<SelectItem value="step">Step (Palier)</SelectItem>
												<SelectItem value="deferred-interest">Deferred Interest</SelectItem>
												<SelectItem value="deferred-total">Deferred Total</SelectItem>
											</SelectContent>
										</Select>

										<Select value={filterStatus} onValueChange={setFilterStatus}>
											<SelectTrigger className="w-[130px] h-8 text-xs">
												<SelectValue placeholder="All Statuses" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All Statuses</SelectItem>
												<SelectItem value="active">Active</SelectItem>
												<SelectItem value="paid-off">Paid Off</SelectItem>
												<SelectItem value="delinquent">Delinquent</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="flex items-center gap-2 shrink-0">
										<Select
											value={sortBy}
											onValueChange={(val) =>
												setSortBy(val as "balance" | "payment" | "rate" | "name" | "progress")
											}
										>
											<SelectTrigger className="w-[160px] h-8 text-xs">
												<span className="text-muted-foreground mr-1">Sort:</span>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="balance">Outstanding Balance</SelectItem>
												<SelectItem value="payment">Monthly Payment</SelectItem>
												<SelectItem value="rate">Interest Rate</SelectItem>
												<SelectItem value="progress">Amortized %</SelectItem>
												<SelectItem value="name">Loan Name</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								{/* High-Density Ledger Table */}
								<div className="rounded-xl border border-border/40 overflow-hidden bg-card/60 shadow-xs">
									<Table>
										<TableHeader className="bg-muted/40">
											<TableRow className="border-b border-border/40 hover:bg-transparent">
												<TableHead className="text-xs font-semibold text-foreground py-2.5">
													Loan & Lender
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground py-2.5">
													Type
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground py-2.5">
													Collateral / LTV
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground py-2.5">
													Ownership
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground text-right py-2.5">
													Outstanding Balance
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground py-2.5">
													Principal Amortized
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground text-right py-2.5">
													Rate
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground text-right py-2.5">
													Monthly Service
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground py-2.5">
													Status
												</TableHead>
												<TableHead className="text-xs font-semibold text-foreground text-right py-2.5 w-10">
													Actions
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredLoans.length === 0 ? (
												<TableRow>
													<TableCell
														colSpan={10}
														className="text-center py-8 text-xs text-muted-foreground"
													>
														No loans match current search and filter criteria.
													</TableCell>
												</TableRow>
											) : (
												filteredLoans.map((loan) => {
													const paid = Math.max(0, loan.loanAmount - loan.remainingBalance);
													const progress =
														loan.loanAmount > 0 ? (paid / loan.loanAmount) * 100 : 0;
													const collateral = getLinkedAssetInfo(loan);
													const isCompact = density === "compact";
													const ownPct = loan.ownershipPercentage ?? 100;
													const isPartialOwnership = ownPct < 100;
													const netBalance = (loan.remainingBalance * ownPct) / 100;

													return (
														<TableRow
															key={loan.id}
															onClick={() => handleSelectLoan(loan.id)}
															className={cn(
																"cursor-pointer transition-colors border-b border-border/30 hover:bg-muted/40",
																isCompact ? "h-11" : "h-14",
															)}
														>
															{/* Loan & Lender */}
															<TableCell className="py-2">
																<div className="flex flex-col">
																	<span className="font-semibold text-foreground text-xs leading-tight">
																		{loan.name}
																	</span>
																	{loan.lender && (
																		<span className="text-micro text-muted-foreground flex items-center gap-1">
																			<Building2 className="h-3 w-3" />
																			{loan.lender}
																		</span>
																	)}
																</div>
															</TableCell>

															{/* Type */}
															<TableCell className="py-2">
																<Badge
																	variant="outline"
																	className="text-micro font-medium capitalize border-border/40 bg-muted/30"
																>
																	{(loan.loanType || "amortizing").replace("-", " ")}
																</Badge>
															</TableCell>

															{/* Collateral / LTV */}
															<TableCell className="py-2">
																{collateral ? (
																	<TooltipProvider>
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 text-micro">
																					<span className="truncate max-w-[110px] text-foreground font-medium">
																						{collateral.name}
																					</span>
																					<span
																						className={cn(
																							"font-mono font-semibold",
																							collateral.ltv > 80
																								? "text-loss"
																								: collateral.ltv > 60
																									? "text-amber-500"
																									: "text-gain",
																						)}
																					>
																						{collateral.ltv.toFixed(0)}% LTV
																					</span>
																				</div>
																			</TooltipTrigger>
																			<TooltipContent className="text-xs">
																				<p>
																					Linked Asset: <strong>{collateral.name}</strong>
																				</p>
																				<p>Valuation: {formatCurrency(collateral.value)}</p>
																				<p>Loan-to-Value: {collateral.ltv.toFixed(1)}%</p>
																			</TooltipContent>
																		</Tooltip>
																	</TooltipProvider>
																) : (
																	<span className="text-micro text-muted-foreground/60">—</span>
																)}
															</TableCell>

															{/* Ownership Share */}
															<TableCell className="py-2">
																<span className="text-xs font-mono text-muted-foreground">
																	{ownPct}%
																</span>
															</TableCell>

															{/* Outstanding Balance */}
															<TableCell className="py-2 text-right">
																<div className="flex flex-col items-end">
																	<span className="font-mono font-bold text-foreground text-xs tabular-nums">
																		{formatCurrency(isPartialOwnership ? netBalance : loan.remainingBalance)}
																	</span>
																	{isPartialOwnership && (
																		<span className="text-micro font-mono text-muted-foreground tabular-nums">
																			{formatCurrency(loan.remainingBalance)} gross
																		</span>
																	)}
																</div>
															</TableCell>

															{/* Principal Amortized % */}
															<TableCell className="py-2">
																<div className="flex flex-col gap-1 w-24">
																	<div className="flex items-center justify-between text-micro font-mono">
																		<span className="text-muted-foreground">
																			{progress.toFixed(0)}%
																		</span>
																		<span className="text-foreground/80">
																			{formatCurrency(paid)}
																		</span>
																	</div>
																	<Progress value={progress} className="h-1 bg-muted" />
																</div>
															</TableCell>

															{/* Rate */}
															<TableCell className="py-2 text-right">
																<span className="font-mono text-xs tabular-nums text-foreground">
																	{loan.interestRate.toFixed(2)}%
																</span>
															</TableCell>

															{/* Monthly Service */}
															<TableCell className="py-2 text-right">
																<div className="flex flex-col items-end">
																	<span className="font-mono font-semibold text-xs tabular-nums text-foreground">
																		{formatCurrency(
																			isPartialOwnership
																				? (loan.monthlyPayment * ownPct) / 100
																				: loan.monthlyPayment,
																		)}
																	</span>
																	<span className="text-micro text-muted-foreground">/mo</span>
																</div>
															</TableCell>

															{/* Status */}
															<TableCell className="py-2">
																<Badge
																	variant="outline"
																	className={cn(
																		"text-micro font-medium capitalize",
																		loan.status === "active"
																			? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
																			: loan.status === "paid-off"
																				? "bg-muted text-muted-foreground border-border/40"
																				: "bg-rose-500/10 text-rose-500 border-rose-500/20",
																	)}
																>
																	{loan.status}
																</Badge>
															</TableCell>

															{/* Actions */}
															<TableCell
																className="py-2 text-right"
																onClick={(e) => e.stopPropagation()}
															>
																<DropdownMenu>
																	<DropdownMenuTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-7 w-7 text-muted-foreground hover:text-foreground"
																		>
																			<MoreVertical className="h-3.5 w-3.5" />
																		</Button>
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end" className="text-xs">
																		<DropdownMenuItem
																			onClick={() => handleSelectLoan(loan.id)}
																		>
																			View Schedule & Details
																		</DropdownMenuItem>
																		<DropdownMenuSeparator />
																		<DropdownMenuItem
																			onClick={() =>
																				setLoanToDelete({ id: loan.id, name: loan.name })
																			}
																			className="text-destructive focus:text-destructive"
																		>
																			<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																			Delete Loan
																		</DropdownMenuItem>
																	</DropdownMenuContent>
																</DropdownMenu>
															</TableCell>
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</div>
							</div>
						)}

						{/* Tab 2: Holdings & Amortization (Detailed Cards Grid) */}
						{activeWorkspaceTab === "holdings" && (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{loanItems.map((loan) => {
									const paid = Math.max(0, loan.loanAmount - loan.remainingBalance);
									const progress =
										loan.loanAmount > 0 ? (paid / loan.loanAmount) * 100 : 0;
									const collateral = getLinkedAssetInfo(loan);
									const ownPct = loan.ownershipPercentage ?? 100;
									const isPartial = ownPct < 100;
									const netBalance = (loan.remainingBalance * ownPct) / 100;

									return (
										<Card
											key={loan.id}
											className="border border-border/40 bg-card/60 hover:border-primary/40 transition-colors cursor-pointer group"
											onClick={() => handleSelectLoan(loan.id)}
										>
											<CardHeader className="pb-3 space-y-2">
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0 flex-1">
														<CardTitle className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
															{loan.name}
														</CardTitle>
														{loan.lender && (
															<p className="text-micro text-muted-foreground flex items-center gap-1 mt-0.5">
																<Building2 className="h-3 w-3" />
																{loan.lender}
															</p>
														)}
													</div>
													<Badge
														variant="outline"
														className={cn(
															"text-micro font-medium capitalize shrink-0",
															loan.status === "active"
																? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
																: "bg-muted text-muted-foreground border-border/40",
														)}
													>
														{loan.status}
													</Badge>
												</div>

												{/* Badges line: type + collateral */}
												<div className="flex items-center gap-1.5 flex-wrap pt-1">
													<Badge
														variant="outline"
														className="text-micro capitalize bg-muted/30 border-border/40"
													>
														{(loan.loanType || "amortizing").replace("-", " ")}
													</Badge>
													{collateral && (
														<Badge
															variant="outline"
															className="text-micro bg-primary/5 text-primary border-primary/20"
														>
															{collateral.name} • {collateral.ltv.toFixed(0)}% LTV
														</Badge>
													)}
													{isPartial && (
														<Badge
															variant="outline"
															className="text-micro bg-secondary/80 text-foreground/80 border-border/40"
														>
															{ownPct}% share
														</Badge>
													)}
												</div>
											</CardHeader>

											<CardContent className="space-y-4 pt-0">
												{/* 4 KPI metrics */}
												<div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/30 text-xs">
													<div>
														<span className="text-micro text-muted-foreground block">
															Outstanding
														</span>
														<span className="font-mono font-bold text-foreground">
															{formatCurrency(isPartial ? netBalance : loan.remainingBalance)}
														</span>
														{isPartial && (
															<span className="text-micro font-mono text-muted-foreground block">
																{formatCurrency(loan.remainingBalance)} gross
															</span>
														)}
													</div>
													<div>
														<span className="text-micro text-muted-foreground block">
															Monthly
														</span>
														<span className="font-mono font-bold text-foreground">
															{formatCurrency(
																isPartial
																	? (loan.monthlyPayment * ownPct) / 100
																	: loan.monthlyPayment,
															)}
														</span>
														<span className="text-micro text-muted-foreground">/mo</span>
													</div>
													<div>
														<span className="text-micro text-muted-foreground block">
															Rate
														</span>
														<span className="font-mono font-semibold text-foreground">
															{loan.interestRate.toFixed(2)}%
														</span>
													</div>
													<div>
														<span className="text-micro text-muted-foreground block">
															Duration
														</span>
														<span className="font-mono font-semibold text-foreground">
															{(loan.durationMonths ?? 0) > 0 ? `${loan.durationMonths} mos` : "—"}
														</span>
													</div>
												</div>

												{/* Amortization Progress */}
												<div className="space-y-1.5">
													<div className="flex items-center justify-between text-micro">
														<span className="text-muted-foreground font-mono">
															Amortized: {progress.toFixed(1)}%
														</span>
														<span className="font-mono text-muted-foreground">
															{formatCurrency(paid)} / {formatCurrency(loan.loanAmount)}
														</span>
													</div>
													<Progress value={progress} className="h-1.5 bg-muted" />
												</div>

												{/* Actions footer */}
												<div className="flex items-center justify-between pt-2 border-t border-border/30">
													<Button
														variant="ghost"
														size="sm"
														className="h-7 text-xs px-2 text-primary hover:text-primary gap-1 cursor-pointer"
														onClick={() => handleSelectLoan(loan.id)}
													>
														<span>View Schedule</span>
														<ExternalLink className="h-3 w-3" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-destructive"
														onClick={(e) => {
															e.stopPropagation();
															setLoanToDelete({ id: loan.id, name: loan.name });
														}}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>

			{/* Slide-over Sheet for Loan Details & Amortization Schedule */}
			<Sheet
				open={Boolean(selectedLoanId)}
				onOpenChange={(open) => !open && setSelectedLoanId(null)}
			>
				<SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 border-l border-border/40">
					{selectedLoanId && (
						<LoanDetail
							loanId={selectedLoanId}
							onBack={() => setSelectedLoanId(null)}
							isPanel
						/>
					)}
				</SheetContent>
			</Sheet>

			{/* Delete Loan Confirmation Dialog */}
			<Dialog
				open={Boolean(loanToDelete)}
				onOpenChange={(open) => !open && setLoanToDelete(null)}
			>
				<DialogContent className="max-w-md bg-card border border-border/60">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<Trash2 className="h-5 w-5" />
							Delete Loan
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground pt-1">
							Are you sure you want to remove <strong>{loanToDelete?.name}</strong> from your
							portfolio? This will permanently delete the liability and its amortization schedule.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0 pt-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setLoanToDelete(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete Loan"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add Loan Form Modal */}
			<AddLoanForm
				open={isAddFormOpen}
				onClose={() => setIsAddFormOpen(false)}
				onSubmit={handleAddLoan}
			/>
		</div>
	);
}
