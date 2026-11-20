import {
	AlertCircle,
	ArrowLeft,
	Building2,
	Calendar,
	Check,
	ChevronDown,
	ChevronRight,
	CreditCard,
	DollarSign,
	ExternalLink,
	FileText,
	HelpCircle,
	Layers,
	Percent,
	Search,
	ShieldCheck,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";
import {
	computeFullAmortizationSchedule,
	computeLoanAmortization,
	computeLoanToValue,
} from "@/lib/loan-calculator";
import { cn, formatCurrency as formatCurrencyWithCode } from "@/lib/utils";

interface LoanDetailProps {
	loanId: string;
	onBack: () => void;
	onSelectAsset?: (assetId: string) => void;
	isPanel?: boolean;
}

export function LoanDetail({ loanId, onBack, onSelectAsset, isPanel = false }: LoanDetailProps) {
	const { assets, loading, deleteAsset, currentPortfolio, refetch } = usePortfolio();
	const { formatCurrency, currency: displayCurrency } = useCurrency();
	const [scheduleMode, setScheduleMode] = useState<"annual" | "monthly">("annual");
	const [searchSchedule, setSearchSchedule] = useState("");
	const [showAllMonths, setShowAllMonths] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	// Find the loan in portfolio assets
	const rawAsset = useMemo(() => {
		return assets.find((a) => a.id === loanId);
	}, [assets, loanId]);

	const loan = useMemo(() => {
		if (!rawAsset) return null;

		const originalAmount = rawAsset.loanAmount || rawAsset.purchasePrice || rawAsset.currentValue || 0;
		const balance = rawAsset.remainingBalance ?? rawAsset.currentValue ?? originalAmount;
		const rate = rawAsset.interestRate ?? 0;
		const duration = rawAsset.durationMonths || 120;
		const currency = rawAsset.currency || displayCurrency;

		// Deterministic amortization
		const baseAmort = computeLoanAmortization({
			loanAmount: originalAmount,
			interestRate: rate,
			durationMonths: duration,
			startDate: rawAsset.startDate,
			insuranceFeeMonthly: rawAsset.insuranceFee || 0,
		});

		const monthlyPayment = rawAsset.monthlyPayment || baseAmort.monthlyPayment;
		const ownershipShare =
			typeof rawAsset.ownershipPercentage === "number" ? rawAsset.ownershipPercentage : 100;

		return {
			id: rawAsset.id,
			name: rawAsset.name,
			type: rawAsset.loanType || "amortizing",
			loanAmount: originalAmount,
			remainingBalance: balance,
			interestRate: rate,
			durationMonths: duration,
			monthlyPayment,
			startDate: rawAsset.startDate ? new Date(rawAsset.startDate) : new Date(),
			endDate: rawAsset.endDate
				? new Date(rawAsset.endDate)
				: baseAmort.endDate || new Date(),
			bank: rawAsset.lender || rawAsset.institution || rawAsset.symbol || "Lender",
			loanNumber: rawAsset.loanNumber,
			currency,
			downPayment: rawAsset.downPayment,
			status: rawAsset.status || "active",
			ownershipMode: rawAsset.ownershipMode || "personal",
			ownershipPercentage: ownershipShare,
			applicationFee: rawAsset.applicationFee,
			brokerFee: rawAsset.brokerFee,
			insuranceFee: rawAsset.insuranceFee,
			otherFees: rawAsset.otherFees,
			earlyRepaymentFee: rawAsset.earlyRepaymentFee,
			linkedAssetIDs: rawAsset.linkedAssetIDs || [],
			coOwners: rawAsset.coOwners || [],
			companyOwners: rawAsset.companyOwners || [],
			steps: rawAsset.steps || [],
			monthsElapsed: baseAmort.monthsElapsed,
			monthsRemaining: baseAmort.monthsRemaining,
		};
	}, [rawAsset, displayCurrency]);

	// Full deterministic amortization schedule
	const scheduleData = useMemo(() => {
		if (!loan) return null;
		return computeFullAmortizationSchedule({
			loanAmount: loan.loanAmount,
			interestRate: loan.interestRate,
			durationMonths: loan.durationMonths,
			startDate: loan.startDate,
			monthlyPayment: loan.monthlyPayment,
			insuranceFeeMonthly: loan.insuranceFee || 0,
			loanType: loan.type,
			steps: loan.steps,
		});
	}, [loan]);

	// Collateral & Linked assets with LTV
	const linkedAssetsList = useMemo(() => {
		if (!loan || !loan.linkedAssetIDs.length) return [];
		return loan.linkedAssetIDs
			.map((id) => assets.find((a) => a.id === id))
			.filter((a): a is NonNullable<typeof a> => Boolean(a))
			.map((asset) => {
				const assetVal = asset.currentValue || asset.purchasePrice || 0;
				const ltv = computeLoanToValue(loan.remainingBalance, assetVal);
				return {
					id: asset.id,
					name: asset.name,
					type: asset.type,
					value: assetVal,
					ltv,
				};
			});
	}, [loan, assets]);

	const handleDelete = async () => {
		if (!loan) return;
		setIsDeleting(true);
		try {
			if (typeof deleteAsset === "function") {
				await deleteAsset(loan.id, currentPortfolio || undefined);
				toast.success(`Loan "${loan.name}" deleted`);
				await refetch?.();
				setIsDeleteDialogOpen(false);
				onBack();
			} else {
				throw new Error("deleteAsset handler not available");
			}
		} catch (_err) {
			toast.error("Failed to delete loan. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64 p-6">
				<div className="flex flex-col items-center space-y-3">
					<div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
					<p className="text-xs text-muted-foreground">Loading loan details...</p>
				</div>
			</div>
		);
	}

	if (!loan) {
		return (
			<div className="flex flex-col items-center justify-center h-64 p-6 space-y-3 text-center">
				<CreditCard className="h-10 w-10 text-muted-foreground/60" />
				<p className="text-sm font-semibold text-foreground">Loan not found</p>
				<p className="text-xs text-muted-foreground">This debt record may have been removed.</p>
				<Button size="sm" variant="outline" onClick={onBack} className="h-8 text-xs">
					<ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
					Return to Ledger
				</Button>
			</div>
		);
	}

	const formatNativeCurrency = (amount: number) => {
		return formatCurrencyWithCode(amount, loan.currency);
	};

	// Progress
	const totalPaid = Math.max(0, loan.loanAmount - loan.remainingBalance);
	const amortizedPct = loan.loanAmount > 0 ? (totalPaid / loan.loanAmount) * 100 : 0;
	const shareRatio = (loan.ownershipPercentage || 100) / 100;
	const netBalance = loan.remainingBalance * shareRatio;
	const netMonthly = loan.monthlyPayment * shareRatio;

	const getLoanTypeBadgeVariant = (type: string) => {
		switch (type) {
			case "amortizing":
				return "bg-info/10 text-info border-info/20";
			case "in-fine":
				return "bg-warning/10 text-warning border-warning/20";
			case "step":
				return "bg-primary/10 text-primary border-primary/20";
			case "deferred-interest":
				return "bg-warning/10 text-warning border-warning/20";
			case "deferred-total":
				return "bg-loss/10 text-loss border-loss/20";
			default:
				return "bg-secondary text-secondary-foreground border-border/40";
		}
	};

	const filteredMonthlyEntries = useMemo(() => {
		const entries = scheduleData?.entries || [];
		if (!searchSchedule) return entries;
		const query = searchSchedule.toLowerCase();
		return entries.filter(
			(e) => e.dateString.toLowerCase().includes(query) || `month ${e.month}`.includes(query),
		);
	}, [scheduleData?.entries, searchSchedule]);

	const displayedMonthlyEntries = useMemo(() => {
		if (showAllMonths || searchSchedule) {
			return filteredMonthlyEntries;
		}
		return filteredMonthlyEntries.slice(0, 120);
	}, [filteredMonthlyEntries, showAllMonths, searchSchedule]);

	return (
		<div className="flex flex-col h-full bg-background text-foreground">
			{/* Slide-over Header */}
			<div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-background/95 px-6 py-4 backdrop-blur-md">
				<div className="flex items-center gap-3 min-w-0">
					<Button
						variant="ghost"
						size="icon"
						onClick={onBack}
						className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
						aria-label="Back to loans ledger"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div className="min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<h2 className="text-base font-bold tracking-tight truncate text-foreground">
								{loan.name}
							</h2>
							<Badge
								variant="outline"
								className={cn("text-[11px] font-semibold border uppercase", getLoanTypeBadgeVariant(loan.type))}
							>
								{loan.type}
							</Badge>
							<Badge
								variant="outline"
								className="text-[11px] font-semibold border border-border/40 text-muted-foreground"
							>
								{loan.status}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground truncate font-mono">
							{loan.bank} {loan.loanNumber ? `· Ref: ${loan.loanNumber}` : ""}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsDeleteDialogOpen(true)}
						className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer gap-1.5"
					>
						<Trash2 className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Delete</span>
					</Button>
				</div>
			</div>

			{/* Slide-over Content Scroll */}
			<div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
				{/* 4 KPI Cards Grid */}
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div className="p-3.5 rounded-xl border border-border/30 bg-card/60 space-y-1">
						<div className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Outstanding Balance
						</div>
						<div className="text-lg font-bold font-mono tabular-nums text-foreground">
							{formatNativeCurrency(loan.remainingBalance)}
						</div>
						{loan.ownershipPercentage < 100 && (
							<div className="text-micro text-muted-foreground font-mono">
								Net share: {formatNativeCurrency(netBalance)} ({loan.ownershipPercentage}%)
							</div>
						)}
					</div>

					<div className="p-3.5 rounded-xl border border-border/30 bg-card/60 space-y-1">
						<div className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Monthly Payment
						</div>
						<div className="text-lg font-bold font-mono tabular-nums text-foreground">
							{loan.monthlyPayment > 0 ? `${formatNativeCurrency(loan.monthlyPayment)}/mo` : "--"}
						</div>
						{loan.ownershipPercentage < 100 && (
							<div className="text-micro text-muted-foreground font-mono">
								Net share: {formatNativeCurrency(netMonthly)}/mo
							</div>
						)}
					</div>

					<div className="p-3.5 rounded-xl border border-border/30 bg-card/60 space-y-1">
						<div className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Interest Rate
						</div>
						<div className="text-lg font-bold font-mono tabular-nums text-foreground">
							{loan.interestRate > 0 ? `${loan.interestRate.toFixed(2)}%` : "0.00% (PTZ)"}
						</div>
						<div className="text-micro text-muted-foreground">Nominal fixed rate</div>
					</div>

					<div className="p-3.5 rounded-xl border border-border/30 bg-card/60 space-y-1">
						<div className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
							Total Interest
						</div>
						<div className="text-lg font-bold font-mono tabular-nums text-foreground">
							{scheduleData?.totalInterest ? formatNativeCurrency(scheduleData.totalInterest) : "--"}
						</div>
						<div className="text-micro text-muted-foreground">Lifetime credit cost</div>
					</div>
				</div>

				{/* Amortization Progress Bar */}
				<div className="p-4 rounded-xl border border-border/30 bg-card/40 space-y-3">
					<div className="flex items-center justify-between text-xs">
						<span className="font-semibold text-foreground">Amortization Progress</span>
						<span className="font-mono font-bold text-gain tabular-nums">
							{amortizedPct.toFixed(1)}% Amortized
						</span>
					</div>

					<div className="h-2 w-full overflow-hidden rounded-full bg-secondary/60">
						<div
							className="h-full bg-gain transition-all duration-300"
							style={{ width: `${Math.min(100, Math.max(0, amortizedPct))}%` }}
						/>
					</div>

					<div className="flex items-center justify-between text-micro text-muted-foreground font-mono">
						<span>Started: {loan.startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
						<span>
							{loan.monthsElapsed} mos elapsed · {loan.monthsRemaining} mos remaining
						</span>
						<span>Maturity: {loan.endDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
					</div>
				</div>

				{/* Loan Characteristics & Fees Details */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="p-4 rounded-xl border border-border/30 bg-card/40 space-y-3 text-xs">
						<h3 className="font-semibold text-foreground flex items-center gap-2">
							<Building2 className="h-4 w-4 text-muted-foreground" />
							<span>Loan Terms</span>
						</h3>
						<div className="space-y-2 border-t border-border/15 pt-2">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Original Principal:</span>
								<span className="font-mono font-semibold">{formatNativeCurrency(loan.loanAmount)}</span>
							</div>
							{Boolean(loan.downPayment) && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Down Payment (Apport):</span>
									<span className="font-mono">{formatNativeCurrency(loan.downPayment || 0)}</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-muted-foreground">Total Duration:</span>
								<span className="font-mono">
									{loan.durationMonths} months ({(loan.durationMonths / 12).toFixed(1)} yrs)
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Lender / Institution:</span>
								<span className="font-semibold text-foreground">{loan.bank}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Ownership Mode:</span>
								<span className="capitalize">{loan.ownershipMode}</span>
							</div>
						</div>
					</div>

					<div className="p-4 rounded-xl border border-border/30 bg-card/40 space-y-3 text-xs">
						<h3 className="font-semibold text-foreground flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-muted-foreground" />
							<span>Fees & Ancillary Costs</span>
						</h3>
						<div className="space-y-2 border-t border-border/15 pt-2">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Monthly Insurance:</span>
								<span className="font-mono">
									{loan.insuranceFee ? `${formatNativeCurrency(loan.insuranceFee)}/mo` : "--"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Application Fee:</span>
								<span className="font-mono">
									{loan.applicationFee ? formatNativeCurrency(loan.applicationFee) : "--"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Broker Fee:</span>
								<span className="font-mono">
									{loan.brokerFee ? formatNativeCurrency(loan.brokerFee) : "--"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Early Repayment Fee (IRA):</span>
								<span className="font-mono">
									{loan.earlyRepaymentFee ? `${loan.earlyRepaymentFee.toFixed(2)}%` : "--"}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Linked Assets & Collateral (LTV) */}
				{linkedAssetsList.length > 0 && (
					<div className="p-4 rounded-xl border border-border/30 bg-card/40 space-y-3 text-xs">
						<h3 className="font-semibold text-foreground flex items-center gap-2">
							<Layers className="h-4 w-4 text-muted-foreground" />
							<span>Financed Assets & Collateral (Loan-to-Value)</span>
						</h3>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
							{linkedAssetsList.map((asset) => (
								<div
									key={asset.id}
									className="flex items-center justify-between p-2.5 rounded-lg border border-border/25 bg-background/60"
								>
									<div className="min-w-0 pr-2">
										<button
											type="button"
											onClick={() => onSelectAsset?.(asset.id)}
											className="font-medium text-foreground hover:underline flex items-center gap-1.5 truncate text-left cursor-pointer"
										>
											<span className="truncate">{asset.name}</span>
											<ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
										</button>
										<span className="text-micro text-muted-foreground font-mono">
											Val: {formatCurrency(asset.value)}
										</span>
									</div>
									<div className="text-right shrink-0">
										<Badge
											variant="outline"
											className={cn(
												"text-micro font-bold font-mono px-2 py-0.5",
												asset.ltv > 90
													? "bg-loss/10 text-loss border-loss/30"
													: asset.ltv > 70
														? "bg-warning/10 text-warning border-warning/30"
														: "bg-gain/10 text-gain border-gain/30",
											)}
										>
											{asset.ltv}% LTV
										</Badge>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Co-Borrowers / Company Owners */}
				{(loan.coOwners.length > 0 || loan.companyOwners.length > 0) && (
					<div className="p-4 rounded-xl border border-border/30 bg-card/40 space-y-3 text-xs">
						<h3 className="font-semibold text-foreground flex items-center gap-2">
							<Users className="h-4 w-4 text-muted-foreground" />
							<span>Co-Borrowers & Ownership Structure</span>
						</h3>
						<div className="space-y-1.5 pt-1">
							<div className="flex justify-between text-muted-foreground">
								<span>My Personal Share:</span>
								<span className="font-mono font-semibold text-foreground">
									{loan.ownershipPercentage}% ({formatNativeCurrency(netBalance)})
								</span>
							</div>
							{loan.coOwners.map((co) => (
								<div key={co.id} className="flex justify-between text-muted-foreground">
									<span>{co.name} (Co-borrower):</span>
									<span className="font-mono font-semibold text-foreground">{co.percentage}%</span>
								</div>
							))}
							{loan.companyOwners.map((co) => (
								<div key={co.id} className="flex justify-between text-muted-foreground">
									<span>
										{co.name} ({co.legalForm || "Company"}):
									</span>
									<span className="font-mono font-semibold text-foreground">{co.percentage}%</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Hybrid Amortization Schedule Table */}
				<div className="p-4 rounded-xl border border-border/30 bg-card/40 space-y-4 text-xs">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h3 className="font-semibold text-foreground flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<span>Amortization Schedule</span>
							</h3>
							<p className="text-micro text-muted-foreground">
								Deterministic principal, interest, and residual debt breakdown
							</p>
						</div>

						<div className="flex items-center gap-2">
							{scheduleMode === "monthly" && (
								<div className="relative">
									<Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="Filter date..."
										value={searchSchedule}
										onChange={(e) => setSearchSchedule(e.target.value)}
										className="h-7 text-micro pl-8 w-32 bg-background border-border/40"
									/>
								</div>
							)}

							<div className="flex p-0.5 rounded-lg bg-muted border border-border/40">
								<button
									type="button"
									onClick={() => setScheduleMode("annual")}
									className={cn(
										"px-2.5 py-1 text-micro font-medium rounded-md transition-colors cursor-pointer",
										scheduleMode === "annual"
											? "bg-background text-foreground font-bold shadow-xs"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									Annual Summary
								</button>
								<button
									type="button"
									onClick={() => setScheduleMode("monthly")}
									className={cn(
										"px-2.5 py-1 text-micro font-medium rounded-md transition-colors cursor-pointer",
										scheduleMode === "monthly"
											? "bg-background text-foreground font-bold shadow-xs"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									Monthly Breakdown
								</button>
							</div>
						</div>
					</div>

					{/* Schedule Table */}
					<div className="rounded-lg border border-border/30 overflow-hidden bg-background/50">
						<Table>
							<TableHeader className="bg-muted/40">
								<TableRow className="border-border/20 text-micro">
									<TableHead className="w-16">Period</TableHead>
									<TableHead className="text-right">Monthly / Ann.</TableHead>
									<TableHead className="text-right">Principal</TableHead>
									<TableHead className="text-right">Interest</TableHead>
									<TableHead className="text-right">Ending Balance</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody className="text-micro font-mono">
								{scheduleMode === "annual" ? (
									(scheduleData?.annualSummaries || []).map((summary) => (
										<TableRow key={summary.year} className="border-border/15 hover:bg-muted/30">
											<TableCell className="font-semibold text-foreground">
												Year {summary.year} ({summary.calendarYear})
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatNativeCurrency(summary.totalPayment)}
											</TableCell>
											<TableCell className="text-right text-gain font-semibold tabular-nums">
												{formatNativeCurrency(summary.totalPrincipal)}
											</TableCell>
											<TableCell className="text-right text-muted-foreground tabular-nums">
												{formatNativeCurrency(summary.totalInterest)}
											</TableCell>
											<TableCell className="text-right font-bold text-foreground tabular-nums">
												{formatNativeCurrency(summary.endingBalance)}
											</TableCell>
										</TableRow>
									))
								) : filteredMonthlyEntries.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="text-center py-6 text-muted-foreground font-sans">
											No matching monthly periods found
										</TableCell>
									</TableRow>
								) : (
									displayedMonthlyEntries.map((entry) => (
										<TableRow key={entry.month} className="border-border/15 hover:bg-muted/30">
											<TableCell className="font-medium text-foreground">
												M{entry.month} ({entry.dateString})
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{formatNativeCurrency(entry.payment)}
											</TableCell>
											<TableCell className="text-right text-gain font-medium tabular-nums">
												{formatNativeCurrency(entry.principal)}
											</TableCell>
											<TableCell className="text-right text-muted-foreground tabular-nums">
												{formatNativeCurrency(entry.interest)}
											</TableCell>
											<TableCell className="text-right font-semibold text-foreground tabular-nums">
												{formatNativeCurrency(entry.remainingBalance)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
					{scheduleMode === "monthly" && (scheduleData?.entries.length || 0) > 120 && (
						<div className="flex items-center justify-between pt-2 px-1">
							<span className="text-micro text-muted-foreground">
								{showAllMonths || searchSchedule
									? `Showing all ${filteredMonthlyEntries.length} months.`
									: `Showing first 120 of ${scheduleData?.entries.length} months.`}
							</span>
							{!searchSchedule && (
								<Button
									variant="ghost"
									size="sm"
									type="button"
									onClick={() => setShowAllMonths(!showAllMonths)}
									className="h-6 text-micro font-medium hover:underline text-primary cursor-pointer"
								>
									{showAllMonths
										? "Show first 120 months"
										: `Show all ${scheduleData?.entries.length} months`}
								</Button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Delete Loan Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Loan</DialogTitle>
						<DialogDescription>
							Are you sure you want to remove <strong>{loan.name}</strong> from your portfolio?
							This will delete the loan record and its amortization history.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete Loan"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
