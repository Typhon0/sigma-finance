import { format } from "date-fns";
import {
	AlertCircle,
	ArrowRight,
	Building2,
	Calendar as CalendarIcon,
	Check,
	CheckCircle2,
	ChevronsUpDown,
	Clock,
	Coins,
	DollarSign,
	FileText,
	HelpCircle,
	Info,
	Percent,
	Shield,
	Sparkles,
	TrendingUp,
	User,
} from "lucide-react";
import type React from "react";
import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

export type InsuranceFamily =
	| "life_insurance"
	| "retirement"
	| "savings"
	| "death_insurance"
	| "loan_insurance"
	| "whole_life";

export interface InsuranceFormData {
	name: string;
	category: string;
	currentValue: string;
	purchasePrice: string;
	policyNumber: string;
	coverageAmount: string;
	premiumAmount: string;
	premiumFrequency: string;
	annualReturn: string;
	openingDate: string;
	maturityDate: string;
	ownership: string;
	managementMode: string;
	provider: string;
	beneficiaries: string;
	notes: string;
}

interface AddInsuranceFormProps {
	onSubmit: (data: InsuranceFormData) => void;
	onCancel: () => void;
	initialData?: Partial<InsuranceFormData>;
}

export const POPULAR_INSURERS = [
	"AXA",
	"Allianz",
	"Generali",
	"SwissLife",
	"Suravenir",
	"Spirica",
	"Linxea",
	"BoursoBank",
	"Zurich",
	"Prudential",
	"MetLife",
	"Aviva / Abeille Assurances",
	"Crédit Agricole (Predica)",
	"BNP Paribas Cardif",
	"Société Générale (Sogecap)",
	"Mutavie",
	"Placement-direct",
	"Northwestern Mutual",
	"Yomoni",
	"Nalo",
	"Ramify",
];

export const CONTRACT_FAMILIES: Array<{
	id: InsuranceFamily;
	label: string;
	subtitle: string;
	isPureRisk?: boolean;
}> = [
	{
		id: "life_insurance",
		label: "Life Insurance",
		subtitle: "Investment & estate accumulation (e.g. Assurance-Vie, Unit-Linked)",
	},
	{
		id: "retirement",
		label: "Retirement Plan",
		subtitle: "Pension scheme & tax deductible savings (PER, Annuity)",
	},
	{
		id: "savings",
		label: "Capitalisation Contract",
		subtitle: "Personal or corporate treasury holding",
	},
	{
		id: "death_insurance",
		label: "Term Life",
		subtitle: "Pure death & disability protection (no cash surrender value)",
		isPureRisk: true,
	},
	{
		id: "loan_insurance",
		label: "Loan Insurance",
		subtitle: "Mortgage / credit borrower insurance delegation",
		isPureRisk: true,
	},
	{
		id: "whole_life",
		label: "Permanent / Whole Life",
		subtitle: "Guaranteed cash value accumulation + permanent death benefit",
	},
];

export const BENEFICIARY_PRESETS = [
	{
		id: "spousal_children",
		label: "Standard Spousal / Children",
		text: "Spouse (not legally separated or divorced), failing whom children born or to be born in equal shares, failing whom legal heirs.",
	},
	{
		id: "children_only",
		label: "Children in equal shares",
		text: "Children in equal shares (living or represented), failing whom legal heirs.",
	},
	{
		id: "custom",
		label: "Custom Free Clause",
		text: "",
	},
];

export function AddInsuranceForm({ onSubmit, onCancel, initialData }: AddInsuranceFormProps) {
	const { formatCurrency, currencySymbol } = useCurrency();
	const [activeTab, setActiveTab] = useState<"identity" | "valuation" | "clauses">("identity");

	// Combobox open state
	const [insurerOpen, setInsurerOpen] = useState(false);
	const [insurerQuery, setInsurerQuery] = useState("");

	const [formData, setFormData] = useState<InsuranceFormData>({
		name: initialData?.name || "",
		category: initialData?.category || "life_insurance",
		currentValue: initialData?.currentValue || "",
		purchasePrice: initialData?.purchasePrice || "",
		policyNumber: initialData?.policyNumber || "",
		coverageAmount: initialData?.coverageAmount || "",
		premiumAmount: initialData?.premiumAmount || "",
		premiumFrequency: initialData?.premiumFrequency || "yearly",
		annualReturn: initialData?.annualReturn || "",
		openingDate: initialData?.openingDate || "",
		maturityDate: initialData?.maturityDate || "",
		ownership: initialData?.ownership || "personal",
		managementMode: initialData?.managementMode || "free",
		provider: initialData?.provider || "",
		beneficiaries: initialData?.beneficiaries || "",
		notes: initialData?.notes || "",
	});

	// Pure protection detection (Term life / Loan insurance have zero surrender value)
	const isPureRisk = useMemo(() => {
		const family = CONTRACT_FAMILIES.find((f) => f.id === formData.category);
		return family?.isPureRisk ?? false;
	}, [formData.category]);

	const handleChange = (field: keyof InsuranceFormData, value: string) => {
		setFormData((prev) => {
			const updated = { ...prev, [field]: value };
			// If switching to pure risk, zero out surrender value
			if (field === "category") {
				const isRisk = value === "death_insurance" || value === "loan_insurance";
				if (isRisk) {
					updated.currentValue = "0";
				}
			}
			return updated;
		});
	};

	// Real-time P&L calculation for investment contracts
	const liveGainMetrics = useMemo(() => {
		const current = parseFloat(formData.currentValue) || 0;
		const cost = parseFloat(formData.purchasePrice) || 0;
		if (cost <= 0) return null;
		const gain = current - cost;
		const percent = (gain / cost) * 100;
		return { gain, percent };
	}, [formData.currentValue, formData.purchasePrice]);

	// Real-time Annual Outflow calculation
	const annualOutflow = useMemo(() => {
		const amount = parseFloat(formData.premiumAmount) || 0;
		if (amount <= 0) return 0;
		switch (formData.premiumFrequency) {
			case "monthly":
				return amount * 12;
			case "quarterly":
				return amount * 4;
			case "semi_annually":
				return amount * 2;
			case "yearly":
			default:
				return amount;
		}
	}, [formData.premiumAmount, formData.premiumFrequency]);

	// 8-Year Tax Milestone Calculation (for Assurance-Vie)
	const eightYearMilestone = useMemo(() => {
		if (!formData.openingDate) return null;
		const opening = new Date(formData.openingDate);
		if (Number.isNaN(opening.getTime())) return null;

		const milestone = new Date(opening);
		milestone.setFullYear(opening.getFullYear() + 8);
		const now = new Date();
		const diffTime = milestone.getTime() - now.getTime();
		const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
		const reached = diffTime <= 0;

		return {
			date: milestone,
			reached,
			remainingYears: Math.max(0, diffYears),
		};
	}, [formData.openingDate]);

	// Apply Beneficiary Preset
	const handleApplyBeneficiaryPreset = (presetText: string) => {
		if (presetText) {
			setFormData((prev) => ({ ...prev, beneficiaries: presetText }));
		}
	};

	// Quick Horizon Date Setters (for PER / maturity)
	const handleSetHorizonYears = (years: number) => {
		const target = new Date();
		target.setFullYear(target.getFullYear() + years);
		setFormData((prev) => ({ ...prev, maturityDate: target.toISOString() }));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Clean payload
		const cleanPayload: InsuranceFormData = {
			...formData,
			currentValue: isPureRisk ? "0" : formData.currentValue || "0",
			coverageAmount: formData.coverageAmount || "0",
			premiumAmount: formData.premiumAmount || "0",
			purchasePrice: formData.purchasePrice || "0",
		};
		onSubmit(cleanPayload);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6 text-xs">
			{/* Navigation Tabs Header */}
			<Tabs
				value={activeTab}
				onValueChange={(val) => setActiveTab(val as "identity" | "valuation" | "clauses")}
				className="w-full"
			>
				<TabsList className="grid grid-cols-3 w-full h-10 p-1 bg-muted/60 border border-border/40">
					<TabsTrigger
						value="identity"
						onClick={() => setActiveTab("identity")}
						className="flex items-center gap-1.5 text-xs font-semibold"
					>
						<Shield className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">1. Identity & Contract</span>
					</TabsTrigger>
					<TabsTrigger
						value="valuation"
						onClick={() => setActiveTab("valuation")}
						className="flex items-center gap-1.5 text-xs font-semibold"
					>
						<DollarSign className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">2. Valuation & Cashflow</span>
					</TabsTrigger>
					<TabsTrigger
						value="clauses"
						onClick={() => setActiveTab("clauses")}
						className="flex items-center gap-1.5 text-xs font-semibold"
					>
						<FileText className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">3. Clauses & Governance</span>
					</TabsTrigger>
				</TabsList>

				{/* Tab 1: Identity & Contract */}
				<TabsContent value="identity" className="space-y-4 pt-3 focus-visible:outline-none">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="ins-name" className="text-xs font-semibold">
								Policy Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="ins-name"
								placeholder="e.g. Linxea Spirit 2, Generali PER, Whole Life Security"
								value={formData.name}
								onChange={(e) => handleChange("name", e.target.value)}
								className="h-9 text-xs"
								required
							/>
						</div>

						{/* Contract Family Selector */}
						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="ins-category" className="text-xs font-semibold">
								Contract Family & Legal Nature <span className="text-destructive">*</span>
							</Label>
							<Select
								value={formData.category}
								onValueChange={(value) => handleChange("category", value)}
							>
								<SelectTrigger id="ins-category" className="h-10 text-xs text-left">
									<SelectValue placeholder="Select contract family" />
								</SelectTrigger>
								<SelectContent className="max-h-[300px]">
									{CONTRACT_FAMILIES.map((family) => (
										<SelectItem key={family.id} value={family.id} className="py-2">
											<div>
												<p className="font-semibold text-xs text-foreground flex items-center gap-2">
													<span>{family.label}</span>
													{family.isPureRisk && (
														<Badge variant="outline" className="text-[10px] uppercase font-normal text-amber-500 border-amber-500/30">
															Pure Protection
														</Badge>
													)}
												</p>
												<p className="text-micro text-muted-foreground">{family.subtitle}</p>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Insurer Combobox */}
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Insurer / Managing Institution</Label>
							<Popover open={insurerOpen} onOpenChange={setInsurerOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										role="combobox"
										aria-expanded={insurerOpen}
										className="w-full justify-between h-9 text-xs font-normal"
									>
										<span className="truncate">
											{formData.provider || "Select or enter an insurer..."}
										</span>
										<ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[280px] p-0" align="start">
									<Command>
										<CommandInput
											placeholder="Search insurer..."
											value={insurerQuery}
											onValueChange={setInsurerQuery}
											className="h-9 text-xs"
										/>
										<CommandList className="max-h-[220px]">
											<CommandEmpty className="py-2 px-3 text-xs">
												<p className="text-muted-foreground mb-1.5">No insurer matched.</p>
												{insurerQuery && (
													<Button
														type="button"
														variant="secondary"
														size="sm"
														className="w-full h-7 text-xs font-medium"
														onClick={() => {
															handleChange("provider", insurerQuery);
															setInsurerOpen(false);
														}}
													>
														Use "{insurerQuery}"
													</Button>
												)}
											</CommandEmpty>
											<CommandGroup heading="Popular Insurers">
												{POPULAR_INSURERS.map((ins) => (
													<CommandItem
														key={ins}
														value={ins}
														onSelect={() => {
															handleChange("provider", ins);
															setInsurerOpen(false);
														}}
														className="text-xs cursor-pointer"
													>
														<Check
															className={cn(
																"mr-2 h-3.5 w-3.5",
																formData.provider === ins ? "opacity-100" : "opacity-0",
															)}
														/>
														{ins}
													</CommandItem>
												))}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>

						{/* Policy Number */}
						<div className="space-y-1.5">
							<Label htmlFor="ins-policynumber" className="text-xs font-semibold">
								Policy / Contract Number
							</Label>
							<Input
								id="ins-policynumber"
								placeholder="e.g. POL-847291, AXA-9928"
								value={formData.policyNumber}
								onChange={(e) => handleChange("policyNumber", e.target.value)}
								className="h-9 text-xs font-mono"
							/>
						</div>

						{/* Subscription / Opening Date */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label className="text-xs font-semibold">Subscription / Opening Date</Label>
								{eightYearMilestone && formData.category === "life_insurance" && (
									<Badge
										variant={eightYearMilestone.reached ? "default" : "secondary"}
										className="text-[10px] font-mono shrink-0"
									>
										{eightYearMilestone.reached
											? "8y Tax Milestone Reached"
											: `8y Milestone: ${eightYearMilestone.remainingYears.toFixed(1)}y left`}
									</Badge>
								)}
							</div>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className={cn(
											"w-full pl-3 text-left font-normal h-9 text-xs",
											!formData.openingDate && "text-muted-foreground",
										)}
									>
										<CalendarIcon className="mr-2 h-3.5 w-3.5" />
										{formData.openingDate ? (
											format(new Date(formData.openingDate), "PPP")
										) : (
											<span>Select subscription date</span>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={formData.openingDate ? new Date(formData.openingDate) : undefined}
										onSelect={(date) => handleChange("openingDate", date ? date.toISOString() : "")}
										disabled={(date) => date > new Date() || date < new Date("1950-01-01")}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
						</div>

						{/* Target Maturity / Horizon Date */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label className="text-xs font-semibold">Maturity / Retirement Horizon</Label>
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => handleSetHorizonYears(5)}
										className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded bg-muted font-mono cursor-pointer"
									>
										+5y
									</button>
									<button
										type="button"
										onClick={() => handleSetHorizonYears(10)}
										className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded bg-muted font-mono cursor-pointer"
									>
										+10y
									</button>
									<button
										type="button"
										onClick={() => handleSetHorizonYears(15)}
										className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded bg-muted font-mono cursor-pointer"
									>
										+15y
									</button>
								</div>
							</div>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className={cn(
											"w-full pl-3 text-left font-normal h-9 text-xs",
											!formData.maturityDate && "text-muted-foreground",
										)}
									>
										<Clock className="mr-2 h-3.5 w-3.5" />
										{formData.maturityDate ? (
											format(new Date(formData.maturityDate), "PPP")
										) : (
											<span>Optional target maturity / term</span>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={formData.maturityDate ? new Date(formData.maturityDate) : undefined}
										onSelect={(date) => handleChange("maturityDate", date ? date.toISOString() : "")}
										disabled={(date) => date < new Date("1970-01-01")}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>

					<div className="flex justify-end pt-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={() => setActiveTab("valuation")}
							className="h-8 text-xs gap-1"
						>
							<span>Next: Valuation & Cashflow</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</TabsContent>

				{/* Tab 2: Valuation & Cashflow */}
				<TabsContent value="valuation" className="space-y-4 pt-3 focus-visible:outline-none">
					{/* Pure Risk Banner if applicable */}
					{isPureRisk ? (
						<div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs space-y-1">
							<p className="font-semibold text-amber-500 flex items-center gap-1.5">
								<Info className="h-4 w-4 shrink-0" />
								Pure Risk Protection Contract
							</p>
							<p className="text-muted-foreground text-micro">
								This policy provides a guaranteed death or disability benefit. Premiums are
								protection costs with zero surrender value (cash value is fixed at 0).
							</p>
						</div>
					) : null}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Current Surrender Value (Required for investment, disabled for risk) */}
						{!isPureRisk ? (
							<div className="space-y-1.5">
								<Label htmlFor="ins-val" className="text-xs font-semibold">
									Current Surrender Value ({currencySymbol}) <span className="text-destructive">*</span>
								</Label>
								<Input
									id="ins-val"
									type="number"
									step="0.01"
									placeholder="e.g. 52400"
									value={formData.currentValue}
									onChange={(e) => handleChange("currentValue", e.target.value)}
									className="h-9 text-xs font-mono font-semibold"
									required
								/>
								<p className="text-micro text-muted-foreground">Current total cash value of the contract</p>
							</div>
						) : null}

						{/* Total Contributions / Net Deposits (Cost Basis) */}
						{!isPureRisk ? (
							<div className="space-y-1.5">
								<Label htmlFor="ins-cost" className="text-xs font-semibold">
									Total Net Contributions ({currencySymbol})
								</Label>
								<Input
									id="ins-cost"
									type="number"
									step="0.01"
									placeholder="e.g. 45000"
									value={formData.purchasePrice}
									onChange={(e) => handleChange("purchasePrice", e.target.value)}
									className="h-9 text-xs font-mono"
								/>
								<p className="text-micro text-muted-foreground">Cumulative deposits (used to calculate unrealized P&L)</p>
							</div>
						) : null}

						{/* Guaranteed Coverage (Primary for Pure Risk, floor for investment) */}
						<div className="space-y-1.5">
							<Label htmlFor="ins-cov" className="text-xs font-semibold">
								Guaranteed Death Coverage ({currencySymbol}){" "}
								{isPureRisk && <span className="text-destructive">*</span>}
							</Label>
							<Input
								id="ins-cov"
								type="number"
								step="0.01"
								placeholder={isPureRisk ? "e.g. 150000" : "Optional floor guarantee"}
								value={formData.coverageAmount}
								onChange={(e) => handleChange("coverageAmount", e.target.value)}
								className="h-9 text-xs font-mono"
								required={isPureRisk}
							/>
							<p className="text-micro text-muted-foreground">
								{isPureRisk ? "Guaranteed capital paid to beneficiaries" : "Optional floor guarantee (Garantie plancher)"}
							</p>
						</div>

						{/* Estimated Annual Return */}
						<div className="space-y-1.5">
							<Label htmlFor="ins-return" className="text-xs font-semibold">
								Estimated Annual Return (%)
							</Label>
							<Input
								id="ins-return"
								type="number"
								step="0.01"
								placeholder="e.g. 3.5"
								value={formData.annualReturn}
								onChange={(e) => handleChange("annualReturn", e.target.value)}
								className="h-9 text-xs font-mono"
							/>
							<p className="text-micro text-muted-foreground">Historical average or annualized yield</p>
						</div>
					</div>

					{/* Live Unrealized P&L Preview Card */}
					{!isPureRisk && liveGainMetrics && (
						<div className="p-3 rounded-xl border border-border/40 bg-muted/40 flex items-center justify-between text-xs font-mono">
							<div>
								<span className="text-muted-foreground text-micro uppercase tracking-wider block">
									Calculated Unrealized Gain / Loss
								</span>
								<span className="font-bold text-foreground">
									{liveGainMetrics.gain >= 0 ? "+" : ""}
									{formatCurrency(liveGainMetrics.gain)}
								</span>
							</div>
							<Badge
								variant={liveGainMetrics.gain >= 0 ? "default" : "destructive"}
								className="text-xs font-bold"
							>
								{liveGainMetrics.percent >= 0 ? "+" : ""}
								{liveGainMetrics.percent.toFixed(2)}%
							</Badge>
						</div>
					)}

					{/* Premium & Scheduled Outflow */}
					<div className="p-3.5 rounded-xl border border-border/40 bg-card space-y-3">
						<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
							<Coins className="h-3.5 w-3.5" />
							Scheduled Premium & Outflow
						</span>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<Label htmlFor="ins-prem" className="text-xs font-semibold">
									Premium Amount ({currencySymbol})
								</Label>
								<Input
									id="ins-prem"
									type="number"
									step="0.01"
									placeholder="e.g. 250"
									value={formData.premiumAmount}
									onChange={(e) => handleChange("premiumAmount", e.target.value)}
									className="h-9 text-xs font-mono"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="ins-freq" className="text-xs font-semibold">
									Payment Frequency
								</Label>
								<Select
									value={formData.premiumFrequency}
									onValueChange={(val) => handleChange("premiumFrequency", val)}
								>
									<SelectTrigger id="ins-freq" className="h-9 text-xs">
										<SelectValue placeholder="Select frequency" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="monthly">Monthly (12x/yr)</SelectItem>
										<SelectItem value="quarterly">Quarterly (4x/yr)</SelectItem>
										<SelectItem value="semi_annually">Semi-Annually (2x/yr)</SelectItem>
										<SelectItem value="yearly">Yearly (1x/yr)</SelectItem>
										<SelectItem value="single">Single Initial Premium</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{annualOutflow > 0 && (
							<div className="pt-2 border-t border-border/20 flex items-center justify-between text-xs font-mono">
								<span className="text-muted-foreground">Estimated Annual Outflow:</span>
								<span className="font-bold text-foreground">
									{formatCurrency(annualOutflow)} / year
								</span>
							</div>
						)}
					</div>

					<div className="flex justify-between pt-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setActiveTab("identity")}
							className="h-8 text-xs"
						>
							Back
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={() => setActiveTab("clauses")}
							className="h-8 text-xs gap-1"
						>
							<span>Next: Clauses & Governance</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</TabsContent>

				{/* Tab 3: Clauses & Governance */}
				<TabsContent value="clauses" className="space-y-4 pt-3 focus-visible:outline-none">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{/* Ownership Mode */}
						<div className="space-y-1.5">
							<Label htmlFor="ins-owner" className="text-xs font-semibold">
								Ownership Mode
							</Label>
							<Select
								value={formData.ownership}
								onValueChange={(val) => handleChange("ownership", val)}
							>
								<SelectTrigger id="ins-owner" className="h-9 text-xs">
									<SelectValue placeholder="Select ownership" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="personal">Personal (Direct ownership)</SelectItem>
									<SelectItem value="joint">Joint / Usufruct (Démembrement / Co-souscription)</SelectItem>
									<SelectItem value="corporate">Corporate / Holding (Personne morale)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Management Mode */}
						<div className="space-y-1.5">
							<Label htmlFor="ins-mgmt" className="text-xs font-semibold">
								Management Mode
							</Label>
							<Select
								value={formData.managementMode}
								onValueChange={(val) => handleChange("managementMode", val)}
							>
								<SelectTrigger id="ins-mgmt" className="h-9 text-xs">
									<SelectValue placeholder="Select management" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="free">Self-Directed (Gestion Libre)</SelectItem>
									<SelectItem value="mandated">Mandated / Robo-Advisor (Gestion Pilotée)</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Beneficiary Clause with One-Click Presets */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="ins-benef" className="text-xs font-semibold flex items-center gap-1.5">
								<User className="h-3.5 w-3.5" />
								<span>Beneficiary Clause</span>
							</Label>
							<span className="text-micro text-muted-foreground">One-click presets:</span>
						</div>

						<div className="flex items-center gap-1.5 flex-wrap">
							{BENEFICIARY_PRESETS.filter((p) => p.text).map((preset) => (
								<button
									key={preset.id}
									type="button"
									onClick={() => handleApplyBeneficiaryPreset(preset.text)}
									className="px-2 py-1 rounded-md text-[11px] bg-muted/80 hover:bg-muted border border-border/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
								>
									{preset.label}
								</button>
							))}
						</div>

						<Textarea
							id="ins-benef"
							placeholder="e.g. Spouse (not separated or divorced), failing whom children in equal shares..."
							value={formData.beneficiaries}
							onChange={(e) => handleChange("beneficiaries", e.target.value)}
							rows={3}
							className="text-xs font-sans leading-relaxed"
						/>
					</div>

					{/* Notes */}
					<div className="space-y-1.5">
						<Label htmlFor="ins-notes" className="text-xs font-semibold">
							Notes & Contractual Clauses
						</Label>
						<Textarea
							id="ins-notes"
							placeholder="Additional policy details, tax envelope specifications (e.g. 757B vs 990I), asset distribution..."
							value={formData.notes}
							onChange={(e) => handleChange("notes", e.target.value)}
							rows={2}
							className="text-xs"
						/>
					</div>
				</TabsContent>
			</Tabs>

			{/* Form Footer Actions */}
			<div className="flex items-center justify-between pt-4 border-t border-border/30">
				<Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
					Cancel
				</Button>
				<Button type="submit" size="sm" className="h-8 text-xs font-semibold shadow-xs">
					{initialData?.name ? "Update Policy" : "Add Policy"}
				</Button>
			</div>
		</form>
	);
}
