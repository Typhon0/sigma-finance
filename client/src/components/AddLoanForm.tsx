import { format } from "date-fns";
import {
	Building2,
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	DollarSign,
	FileText,
	Info,
	Layers,
	TrendingUp,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

interface AddLoanFormProps {
	open: boolean;
	onClose: () => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onSubmit: (data: any) => Promise<void>;
}

type FormStep =
	| "information"
	| "characteristics"
	| "fees-ownership"
	| "steps"
	| "linked-assets"
	| "ownership";

type LoanType = "step" | "amortizing" | "in-fine" | "deferred-interest" | "deferred-total";

interface CoOwner {
	id: string;
	type: "registered" | "custom";
	userId?: string;
	name: string;
	percentage: string;
}

interface CompanyOwner {
	id: string;
	type: "existing" | "new";
	companyId?: string;
	name: string;
	registrationNumber: string;
	legalForm: string;
	percentage: string;
}

interface StepEntry {
	id: string;
	date: Date | undefined;
	amount: string;
	interestRate: string;
}

interface FormData {
	// Information
	name: string;
	type: LoanType;
	loanAmount: string;
	downPayment: string;
	currency: string;
	description: string;

	// Characteristics
	interestRate: string;
	duration: string; // in months
	startDate: Date | undefined;
	endDate: Date | undefined;
	monthlyPayment: string;
	remainingBalance: string;
	bank: string;
	loanNumber: string;

	// Fees & Ownership
	applicationFee: string;
	brokerFee: string;
	insuranceFee: string;
	otherFees: string;
	earlyRepaymentFee: string;

	// Steps (for step loans)
	steps: StepEntry[];

	// Linked assets
	linkedAssetIds: string[];

	// Ownership
	ownershipMode: "personal" | "company";
	ownershipPercentage: string;
	coOwners: CoOwner[];
	companyOwners: CompanyOwner[];
}

export function AddLoanForm({ open, onClose, onSubmit }: AddLoanFormProps) {
	const [currentStep, setCurrentStep] = useState<FormStep>("information");
	const [formData, setFormData] = useState<FormData>({
		name: "",
		type: "amortizing",
		loanAmount: "",
		downPayment: "",
		currency: "EUR",
		description: "",
		interestRate: "",
		duration: "",
		startDate: undefined,
		endDate: undefined,
		monthlyPayment: "",
		remainingBalance: "",
		bank: "",
		loanNumber: "",
		applicationFee: "",
		brokerFee: "",
		insuranceFee: "",
		otherFees: "",
		earlyRepaymentFee: "",
		steps: [],
		linkedAssetIds: [],
		ownershipMode: "personal",
		ownershipPercentage: "100",
		coOwners: [],
		companyOwners: [],
	});

	const steps: { id: FormStep; label: string }[] = [
		{ id: "information", label: "Information" },
		{ id: "characteristics", label: "Characteristics" },
		{ id: "fees-ownership", label: "Fees & Ownership" },
		...(formData.type === "step" ? [{ id: "steps" as FormStep, label: "Steps" }] : []),
		{ id: "linked-assets", label: "Linked assets" },
		{ id: "ownership", label: "Ownership" },
	];

	const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleInputChange = (field: keyof FormData, value: any) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleNext = async () => {
		if (currentStepIndex < steps.length - 1) {
			setCurrentStep(steps[currentStepIndex + 1].id);
		} else {
			// Submit form — await so dialog stays open on error
			setIsSubmitting(true);
			try {
				await onSubmit(formData);
				onClose();
			} catch {
				// Error is handled by the caller; keep dialog open
			} finally {
				setIsSubmitting(false);
			}
		}
	};

	const handleBack = () => {
		if (currentStepIndex > 0) {
			setCurrentStep(steps[currentStepIndex - 1].id);
		}
	};

	const renderStepContent = () => {
		switch (currentStep) {
			case "information":
				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Loan Information
							</h3>
							<p className="text-sm text-muted-foreground">Basic information about your loan</p>
						</div>

						{/* Name */}
						<div className="space-y-2">
							<Label htmlFor="name" className="text-sm">
								Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="name"
								type="text"
								value={formData.name}
								onChange={(e) => handleInputChange("name", e.target.value)}
								className="bg-background border-border"
								placeholder="e.g., Home Mortgage, Car Loan, etc."
							/>
						</div>

						{/* Loan Type */}
						<div className="space-y-2">
							<Label htmlFor="type" className="text-sm">
								Type <span className="text-destructive">*</span>
							</Label>
							<Select
								value={formData.type}
								onValueChange={(value) => handleInputChange("type", value as LoanType)}
							>
								<SelectTrigger className="bg-background border-border">
									<SelectValue placeholder="Select loan type..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="amortizing">Amortizing loan</SelectItem>
									<SelectItem value="in-fine">In fine loan</SelectItem>
									<SelectItem value="deferred-interest">Deferred interest</SelectItem>
									<SelectItem value="deferred-total">Deferred total</SelectItem>
									<SelectItem value="step">Step loan</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground mt-1">
								{formData.type === "amortizing" && "Regular payments of principal + interest"}
								{formData.type === "in-fine" && "Pay interest only, principal at end"}
								{formData.type === "deferred-interest" && "Defer interest payments for a period"}
								{formData.type === "deferred-total" && "Defer all payments for a period"}
								{formData.type === "step" && "Variable payment schedule over time"}
							</p>
						</div>

						{/* Loan Amount & Currency */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="loanAmount" className="text-sm">
									Loan Amount <span className="text-destructive">*</span>
								</Label>
								<div className="flex gap-2">
									<Input
										id="loanAmount"
										type="number"
										min="0"
										step="0.01"
										value={formData.loanAmount}
										onChange={(e) => handleInputChange("loanAmount", e.target.value)}
										className="bg-background border-border flex-1"
										placeholder="0.00"
									/>
									<Select
										value={formData.currency}
										onValueChange={(value) => handleInputChange("currency", value)}
									>
										<SelectTrigger className="bg-background border-border w-24">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="EUR">EUR</SelectItem>
											<SelectItem value="USD">USD</SelectItem>
											<SelectItem value="GBP">GBP</SelectItem>
											<SelectItem value="CHF">CHF</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="downPayment" className="text-sm flex items-center gap-1">
									Down payment
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="downPayment"
										type="number"
										min="0"
										step="0.01"
										value={formData.downPayment}
										onChange={(e) => handleInputChange("downPayment", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="0.00"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>
						</div>

						{/* Description */}
						<div className="space-y-2">
							<Label htmlFor="description" className="text-sm">
								Description{" "}
								<span className="text-xs text-muted-foreground font-normal">Optional</span>
							</Label>
							<Textarea
								id="description"
								value={formData.description}
								onChange={(e) => handleInputChange("description", e.target.value)}
								className="bg-background border-border min-h-[100px]"
								placeholder="Add any additional notes about this loan..."
							/>
						</div>
					</div>
				);

			case "characteristics":
				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								Loan Characteristics
							</h3>
							<p className="text-sm text-muted-foreground">
								Interest rate, duration, and payment details
							</p>
						</div>

						{/* Interest Rate & Duration */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="interestRate" className="text-sm">
									Interest Rate <span className="text-destructive">*</span>
								</Label>
								<div className="relative">
									<Input
										id="interestRate"
										type="number"
										min="0"
										max="100"
										step="0.01"
										value={formData.interestRate}
										onChange={(e) => handleInputChange("interestRate", e.target.value)}
										className="bg-background border-border pr-12"
										placeholder="0.00"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										%
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="duration" className="text-sm">
									Duration (months) <span className="text-destructive">*</span>
								</Label>
								<Input
									id="duration"
									type="number"
									min="1"
									step="1"
									value={formData.duration}
									onChange={(e) => handleInputChange("duration", e.target.value)}
									className="bg-background border-border"
									placeholder="e.g., 240 (20 years)"
								/>
							</div>
						</div>

						{/* Start Date & End Date */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label className="text-sm">
									Start Date <span className="text-destructive">*</span>
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full justify-start text-left bg-background border-border"
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{formData.startDate ? (
												format(formData.startDate, "PPP")
											) : (
												<span>Pick a date</span>
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={formData.startDate}
											onSelect={(date) => handleInputChange("startDate", date)}
											autoFocus
										/>
									</PopoverContent>
								</Popover>
							</div>

							<div className="space-y-2">
								<Label className="text-sm flex items-center gap-1">
									End Date
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full justify-start text-left bg-background border-border"
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{formData.endDate ? (
												format(formData.endDate, "PPP")
											) : (
												<span>Pick a date</span>
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={formData.endDate}
											onSelect={(date) => handleInputChange("endDate", date)}
											autoFocus
										/>
									</PopoverContent>
								</Popover>
							</div>
						</div>

						{/* Monthly Payment & Remaining Balance */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="monthlyPayment" className="text-sm flex items-center gap-1">
									Monthly Payment
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="monthlyPayment"
										type="number"
										min="0"
										step="0.01"
										value={formData.monthlyPayment}
										onChange={(e) => handleInputChange("monthlyPayment", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="Auto-calculated"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="remainingBalance" className="text-sm flex items-center gap-1">
									Remaining Balance
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="remainingBalance"
										type="number"
										min="0"
										step="0.01"
										value={formData.remainingBalance}
										onChange={(e) => handleInputChange("remainingBalance", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="Current balance"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>
						</div>

						{/* Bank & Loan Number */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="bank" className="text-sm">
									Bank / Lender <span className="text-destructive">*</span>
								</Label>
								<Input
									id="bank"
									type="text"
									value={formData.bank}
									onChange={(e) => handleInputChange("bank", e.target.value)}
									className="bg-background border-border"
									placeholder="e.g., BNP Paribas"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="loanNumber" className="text-sm flex items-center gap-1">
									Loan Number
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<Input
									id="loanNumber"
									type="text"
									value={formData.loanNumber}
									onChange={(e) => handleInputChange("loanNumber", e.target.value)}
									className="bg-background border-border"
									placeholder="Reference number"
								/>
							</div>
						</div>

						{/* Info Box */}
						<div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
							<div className="flex gap-3">
								<Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
										Payment Calculation
									</p>
									<p className="text-xs text-blue-700 dark:text-blue-300">
										If you don't enter a monthly payment, it will be automatically calculated based
										on the loan amount, interest rate, and duration.
									</p>
								</div>
							</div>
						</div>
					</div>
				);

			case "fees-ownership":
				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<DollarSign className="h-5 w-5" />
								Fees & Costs
							</h3>
							<p className="text-sm text-muted-foreground">
								Additional fees and charges associated with the loan
							</p>
						</div>

						{/* Application Fee & Broker Fee */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="applicationFee" className="text-sm flex items-center gap-1">
									Application Fee
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="applicationFee"
										type="number"
										min="0"
										step="0.01"
										value={formData.applicationFee}
										onChange={(e) => handleInputChange("applicationFee", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="0.00"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="brokerFee" className="text-sm flex items-center gap-1">
									Broker Fee
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="brokerFee"
										type="number"
										min="0"
										step="0.01"
										value={formData.brokerFee}
										onChange={(e) => handleInputChange("brokerFee", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="0.00"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>
						</div>

						{/* Insurance Fee & Other Fees */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="insuranceFee" className="text-sm flex items-center gap-1">
									Insurance Fee (monthly)
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="insuranceFee"
										type="number"
										min="0"
										step="0.01"
										value={formData.insuranceFee}
										onChange={(e) => handleInputChange("insuranceFee", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="0.00"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="otherFees" className="text-sm flex items-center gap-1">
									Other Fees
									<span className="text-xs text-muted-foreground font-normal">Optional</span>
								</Label>
								<div className="relative">
									<Input
										id="otherFees"
										type="number"
										min="0"
										step="0.01"
										value={formData.otherFees}
										onChange={(e) => handleInputChange("otherFees", e.target.value)}
										className="bg-background border-border pr-16"
										placeholder="0.00"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										{formData.currency}
									</span>
								</div>
							</div>
						</div>

						{/* Early Repayment Fee */}
						<div className="space-y-2">
							<Label htmlFor="earlyRepaymentFee" className="text-sm flex items-center gap-1">
								Early Repayment Fee
								<span className="text-xs text-muted-foreground font-normal">Optional</span>
							</Label>
							<div className="relative">
								<Input
									id="earlyRepaymentFee"
									type="number"
									min="0"
									max="100"
									step="0.01"
									value={formData.earlyRepaymentFee}
									onChange={(e) => handleInputChange("earlyRepaymentFee", e.target.value)}
									className="bg-background border-border pr-12"
									placeholder="0.00"
								/>
								<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
									%
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Percentage fee charged if you pay off the loan early
							</p>
						</div>
					</div>
				);

			case "steps": {
				const addStep = () => {
					const newStep: StepEntry = {
						id: `step-${Date.now()}`,
						date: undefined,
						amount: "",
						interestRate: formData.interestRate || "0",
					};
					handleInputChange("steps", [...formData.steps, newStep]);
				};

				const removeStep = (id: string) => {
					handleInputChange(
						"steps",
						formData.steps.filter((s) => s.id !== id),
					);
				};

				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				const updateStep = (id: string, field: keyof StepEntry, value: any) => {
					handleInputChange(
						"steps",
						formData.steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
					);
				};

				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<Layers className="h-5 w-5" />
								Payment Steps
							</h3>
							<p className="text-sm text-muted-foreground">
								Define the payment schedule for your step loan
							</p>
						</div>

						{/* Steps List */}
						{formData.steps.length > 0 && (
							<div className="space-y-4">
								{formData.steps.map((step, index) => (
									<div
										key={step.id}
										className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm font-medium">Step {index + 1}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeStep(step.id)}
												className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>

										<div className="grid grid-cols-3 gap-4">
											<div className="space-y-2">
												<Label className="text-sm">Date</Label>
												<Popover>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															className="w-full justify-start text-left bg-background border-border"
														>
															<CalendarIcon className="mr-2 h-4 w-4" />
															{step.date ? (
																format(step.date, "PP")
															) : (
																<span className="text-xs">Pick date</span>
															)}
														</Button>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-0" align="start">
														<Calendar
															mode="single"
															selected={step.date}
															onSelect={(date) => updateStep(step.id, "date", date)}
															autoFocus
														/>
													</PopoverContent>
												</Popover>
											</div>

											<div className="space-y-2">
												<Label className="text-sm">Amount</Label>
												<div className="relative">
													<Input
														type="number"
														min="0"
														step="0.01"
														value={step.amount}
														onChange={(e) => updateStep(step.id, "amount", e.target.value)}
														className="bg-background border-border pr-16"
														placeholder="0.00"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
														{formData.currency}
													</span>
												</div>
											</div>

											<div className="space-y-2">
												<Label className="text-sm">Interest Rate</Label>
												<div className="relative">
													<Input
														type="number"
														min="0"
														max="100"
														step="0.01"
														value={step.interestRate}
														onChange={(e) => updateStep(step.id, "interestRate", e.target.value)}
														className="bg-background border-border pr-12"
														placeholder="0.00"
													/>
													<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
														%
													</span>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{/* Add Step Button */}
						<Button type="button" variant="outline" onClick={addStep} className="w-full gap-2">
							<Layers className="h-4 w-4" />
							Add Step
						</Button>

						{/* Info Box */}
						<div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
							<div className="flex gap-3">
								<Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
										Step Loan Schedule
									</p>
									<p className="text-xs text-blue-700 dark:text-blue-300">
										Define each payment period with its own amount and interest rate. This is useful
										for loans with variable payment schedules.
									</p>
								</div>
							</div>
						</div>
					</div>
				);
			}

			case "linked-assets": {
				// Mock assets for demo
				const availableAssets = [
					{
						id: "asset-1",
						name: "Main Residence - Paris",
						type: "Real Estate",
						value: "€450,000",
					},
					{
						id: "asset-2",
						name: "Investment Property - Lyon",
						type: "Real Estate",
						value: "€280,000",
					},
					{
						id: "asset-3",
						name: "Tesla Model 3",
						type: "Vehicle",
						value: "€42,000",
					},
				];

				const toggleAsset = (assetId: string) => {
					const current = formData.linkedAssetIds;
					if (current.includes(assetId)) {
						handleInputChange(
							"linkedAssetIds",
							current.filter((id) => id !== assetId),
						);
					} else {
						handleInputChange("linkedAssetIds", [...current, assetId]);
					}
				};

				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<Building2 className="h-5 w-5" />
								Linked Assets
							</h3>
							<p className="text-sm text-muted-foreground">
								Link this loan to one or more assets in your portfolio
							</p>
						</div>

						{/* Info Box */}
						<div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
							<div className="flex gap-3">
								<Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
										Why Link Assets?
									</p>
									<ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
										<li>Calculate true equity (asset value - loan balance)</li>
										<li>Track loan-to-value ratio (LTV)</li>
										<li>Accurate net worth calculations</li>
										<li>Better financial overview</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Assets List */}
						<div className="space-y-3">
							{availableAssets.map((asset) => (
								// biome-ignore lint/a11y/noStaticElementInteractions: unavoidable
								// biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable
								<div
									key={asset.id}
									onClick={() => toggleAsset(asset.id)}
									className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
										formData.linkedAssetIds.includes(asset.id)
											? "border-primary bg-primary/5"
											: "border-border hover:border-border/80 bg-muted/20"
									}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<p className="font-medium">{asset.name}</p>
											</div>
											<p className="text-xs text-muted-foreground mt-1">
												{asset.type} • {asset.value}
											</p>
										</div>
										<div
											className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
												formData.linkedAssetIds.includes(asset.id)
													? "border-primary bg-primary"
													: "border-muted-foreground"
											}`}
										>
											{formData.linkedAssetIds.includes(asset.id) && (
												<div className="h-2 w-2 bg-white rounded-full" />
											)}
										</div>
									</div>
								</div>
							))}
						</div>

						{formData.linkedAssetIds.length === 0 && (
							<p className="text-sm text-muted-foreground text-center py-4">
								No assets linked yet. Select one or more assets above.
							</p>
						)}
					</div>
				);
			}

			case "ownership": {
				// Mock registered users
				const registeredUsers = [
					{ id: "user-1", name: "Alice Johnson", email: "alice@example.com" },
					{ id: "user-2", name: "Bob Smith", email: "bob@example.com" },
					{ id: "user-3", name: "Carol Williams", email: "carol@example.com" },
				];

				// Mock existing companies
				const existingCompanies = [
					{
						id: "comp-1",
						name: "Sigma Real Estate SCI",
						registrationNumber: "123456789",
						legalForm: "SCI",
					},
					{
						id: "comp-2",
						name: "Investment Holdings SARL",
						registrationNumber: "987654321",
						legalForm: "SARL",
					},
					{
						id: "comp-3",
						name: "Property Management SA",
						registrationNumber: "456789123",
						legalForm: "SA",
					},
				];

				const addCoOwner = () => {
					const newCoOwner: CoOwner = {
						id: `co-owner-${Date.now()}`,
						type: "registered",
						name: "",
						percentage: "0",
					};
					handleInputChange("coOwners", [...formData.coOwners, newCoOwner]);
				};

				const removeCoOwner = (id: string) => {
					handleInputChange(
						"coOwners",
						formData.coOwners.filter((co) => co.id !== id),
					);
				};

				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				const updateCoOwner = (id: string, field: keyof CoOwner, value: any) => {
					handleInputChange(
						"coOwners",
						formData.coOwners.map((co) => (co.id === id ? { ...co, [field]: value } : co)),
					);
				};

				const addCompanyOwner = () => {
					const newCompanyOwner: CompanyOwner = {
						id: `company-owner-${Date.now()}`,
						type: "existing",
						name: "",
						registrationNumber: "",
						legalForm: "",
						percentage: "0",
					};
					handleInputChange("companyOwners", [...formData.companyOwners, newCompanyOwner]);
				};

				const removeCompanyOwner = (id: string) => {
					handleInputChange(
						"companyOwners",
						formData.companyOwners.filter((co) => co.id !== id),
					);
				};

				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				const updateCompanyOwner = (id: string, field: keyof CompanyOwner, value: any) => {
					handleInputChange(
						"companyOwners",
						formData.companyOwners.map((co) => (co.id === id ? { ...co, [field]: value } : co)),
					);
				};

				const totalOwnership =
					(formData.ownershipMode === "personal"
						? parseFloat(formData.ownershipPercentage || "0")
						: 0) +
					formData.coOwners.reduce((sum, co) => sum + parseFloat(co.percentage || "0"), 0) +
					formData.companyOwners.reduce((sum, co) => sum + parseFloat(co.percentage || "0"), 0);

				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Loan Ownership
							</h3>
							<p className="text-sm text-muted-foreground">
								Define who is responsible for this loan
							</p>
						</div>

						{/* Ownership Mode Selection */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<h4 className="text-sm font-medium">Ownership Type</h4>
							<div className="flex gap-3">
								<Button
									variant="ghost"
									onClick={() => handleInputChange("ownershipMode", "personal")}
									className={`flex-1 p-4 rounded-lg border-2 transition-all h-auto ${
										formData.ownershipMode === "personal"
											? "border-primary bg-primary/5"
											: "border-border hover:border-border/80"
									}`}
								>
									<div className="flex flex-col items-center gap-2">
										<Users
											className={`h-5 w-5 ${formData.ownershipMode === "personal" ? "text-primary" : "text-muted-foreground"}`}
										/>
										<span className="text-sm font-medium">Personal</span>
										<span className="text-xs text-muted-foreground text-center">
											Individual borrowers
										</span>
									</div>
								</Button>
								<Button
									variant="ghost"
									onClick={() => handleInputChange("ownershipMode", "company")}
									className={`flex-1 p-4 rounded-lg border-2 transition-all h-auto ${
										formData.ownershipMode === "company"
											? "border-primary bg-primary/5"
											: "border-border hover:border-border/80"
									}`}
								>
									<div className="flex flex-col items-center gap-2">
										<Building2
											className={`h-5 w-5 ${formData.ownershipMode === "company" ? "text-primary" : "text-muted-foreground"}`}
										/>
										<span className="text-sm font-medium">Company</span>
										<span className="text-xs text-muted-foreground text-center">
											Corporate borrowers
										</span>
									</div>
								</Button>
							</div>
						</div>

						{/* Personal Ownership */}
						{formData.ownershipMode === "personal" && (
							<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
								<div className="flex items-center gap-2 mb-2">
									<Users className="h-4 w-4 text-primary" />
									<h4 className="text-sm text-muted-foreground">Your Responsibility</h4>
								</div>

								<div className="space-y-2">
									<Label htmlFor="ownershipPercentage" className="text-sm">
										Responsibility percentage
									</Label>
									<div className="relative">
										<Input
											id="ownershipPercentage"
											type="number"
											min="0"
											max="100"
											step="0.01"
											value={formData.ownershipPercentage}
											onChange={(e) => handleInputChange("ownershipPercentage", e.target.value)}
											className="bg-background border-border pr-12"
											placeholder="100"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
											%
										</span>
									</div>
								</div>
							</div>
						)}

						{/* Co-Borrowers */}
						{formData.coOwners.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center gap-2">
									<h4 className="text-sm text-muted-foreground">Co-Borrowers</h4>
								</div>

								{formData.coOwners.map((coOwner, index) => (
									<div
										key={coOwner.id}
										className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm">Co-Borrower {index + 1}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeCoOwner(coOwner.id)}
												className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>

										<div className="flex gap-2">
											<Button
												variant="ghost"
												onClick={() => updateCoOwner(coOwner.id, "type", "registered")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													coOwner.type === "registered"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												Registered User
											</Button>
											<Button
												variant="ghost"
												onClick={() => updateCoOwner(coOwner.id, "type", "custom")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													coOwner.type === "custom"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												Custom Borrower
											</Button>
										</div>

										{coOwner.type === "registered" ? (
											<div className="space-y-2">
												<Label className="text-sm">Select User</Label>
												<Select
													value={coOwner.userId}
													onValueChange={(value) => {
														const user = registeredUsers.find((u) => u.id === value);
														updateCoOwner(coOwner.id, "userId", value);
														if (user) {
															updateCoOwner(coOwner.id, "name", user.name);
														}
													}}
												>
													<SelectTrigger className="bg-background border-border">
														<SelectValue placeholder="Select a user..." />
													</SelectTrigger>
													<SelectContent>
														{registeredUsers.map((user) => (
															<SelectItem key={user.id} value={user.id}>
																<div className="flex flex-col">
																	<span>{user.name}</span>
																	<span className="text-xs text-muted-foreground">
																		{user.email}
																	</span>
																</div>
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										) : (
											<div className="space-y-2">
												<Label className="text-sm">Borrower Name</Label>
												<Input
													type="text"
													value={coOwner.name}
													onChange={(e) => updateCoOwner(coOwner.id, "name", e.target.value)}
													className="bg-background border-border"
													placeholder="Enter borrower name..."
												/>
											</div>
										)}

										<div className="space-y-2">
											<Label className="text-sm">Responsibility percentage</Label>
											<div className="relative">
												<Input
													type="number"
													min="0"
													max="100"
													step="0.01"
													value={coOwner.percentage}
													onChange={(e) => updateCoOwner(coOwner.id, "percentage", e.target.value)}
													className="bg-background border-border pr-12"
													placeholder="0"
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
													%
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{/* Company Owners */}
						{formData.companyOwners.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center gap-2">
									<Building2 className="h-4 w-4 text-primary" />
									<h4 className="text-sm text-muted-foreground">Company Borrowers</h4>
								</div>

								{formData.companyOwners.map((company, index) => (
									<div
										key={company.id}
										className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm">Company {index + 1}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeCompanyOwner(company.id)}
												className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>

										<div className="flex gap-2">
											<Button
												variant="ghost"
												onClick={() => updateCompanyOwner(company.id, "type", "existing")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													company.type === "existing"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												Existing Company
											</Button>
											<Button
												variant="ghost"
												onClick={() => updateCompanyOwner(company.id, "type", "new")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													company.type === "new"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												New Company
											</Button>
										</div>

										{company.type === "existing" ? (
											<div className="space-y-2">
												<Label className="text-sm">Select Company</Label>
												<Select
													value={company.companyId}
													onValueChange={(value) => {
														const comp = existingCompanies.find((c) => c.id === value);
														updateCompanyOwner(company.id, "companyId", value);
														if (comp) {
															updateCompanyOwner(company.id, "name", comp.name);
															updateCompanyOwner(
																company.id,
																"registrationNumber",
																comp.registrationNumber,
															);
															updateCompanyOwner(company.id, "legalForm", comp.legalForm);
														}
													}}
												>
													<SelectTrigger className="bg-background border-border">
														<SelectValue placeholder="Select a company..." />
													</SelectTrigger>
													<SelectContent>
														{existingCompanies.map((comp) => (
															<SelectItem key={comp.id} value={comp.id}>
																<div className="flex flex-col">
																	<span>{comp.name}</span>
																	<span className="text-xs text-muted-foreground">
																		{comp.legalForm} • {comp.registrationNumber}
																	</span>
																</div>
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										) : (
											<div className="space-y-4">
												<div className="space-y-2">
													<Label className="text-sm">Company Name</Label>
													<Input
														type="text"
														value={company.name}
														onChange={(e) => updateCompanyOwner(company.id, "name", e.target.value)}
														className="bg-background border-border"
														placeholder="Enter company name..."
													/>
												</div>
												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-2">
														<Label className="text-sm">Legal Form</Label>
														<Select
															value={company.legalForm}
															onValueChange={(value) =>
																updateCompanyOwner(company.id, "legalForm", value)
															}
														>
															<SelectTrigger className="bg-background border-border">
																<SelectValue placeholder="Select..." />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="SCI">SCI</SelectItem>
																<SelectItem value="SARL">SARL</SelectItem>
																<SelectItem value="SA">SA</SelectItem>
																<SelectItem value="SAS">SAS</SelectItem>
																<SelectItem value="EURL">EURL</SelectItem>
																<SelectItem value="LLC">LLC</SelectItem>
																<SelectItem value="LTD">LTD</SelectItem>
																<SelectItem value="Other">Other</SelectItem>
															</SelectContent>
														</Select>
													</div>
													<div className="space-y-2">
														<Label className="text-sm">Registration Number</Label>
														<Input
															type="text"
															value={company.registrationNumber}
															onChange={(e) =>
																updateCompanyOwner(company.id, "registrationNumber", e.target.value)
															}
															className="bg-background border-border"
															placeholder="000 000 000"
														/>
													</div>
												</div>
											</div>
										)}

										<div className="space-y-2">
											<Label className="text-sm">Responsibility percentage</Label>
											<div className="relative">
												<Input
													type="number"
													min="0"
													max="100"
													step="0.01"
													value={company.percentage}
													onChange={(e) =>
														updateCompanyOwner(company.id, "percentage", e.target.value)
													}
													className="bg-background border-border pr-12"
													placeholder="0"
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
													%
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{/* Add Buttons */}
						<div className="flex gap-3">
							<Button type="button" variant="outline" onClick={addCoOwner} className="flex-1 gap-2">
								<Users className="h-4 w-4" />
								Add Co-Borrower
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={addCompanyOwner}
								className="flex-1 gap-2"
							>
								<Building2 className="h-4 w-4" />
								Add Company
							</Button>
						</div>

						{/* Total Responsibility Summary */}
						<div
							className={`p-4 rounded-lg border ${
								totalOwnership === 100
									? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
									: totalOwnership > 100
										? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
										: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900"
							}`}
						>
							<div className="flex items-center justify-between">
								<span className="text-sm">Total Responsibility</span>
								<span
									className={`font-medium ${
										totalOwnership === 100
											? "text-green-600 dark:text-green-400"
											: totalOwnership > 100
												? "text-red-600 dark:text-red-400"
												: "text-yellow-600 dark:text-yellow-400"
									}`}
								>
									{totalOwnership.toFixed(2)}%
								</span>
							</div>
							{totalOwnership !== 100 && (
								<p className="text-xs mt-2 text-muted-foreground">
									{totalOwnership > 100
										? "Total responsibility exceeds 100%. Please adjust the percentages."
										: "Total responsibility is less than 100%. Remaining responsibility will be unassigned."}
								</p>
							)}
						</div>
					</div>
				);
			}

			default:
				return (
					<div className="space-y-4">
						<p className="text-muted-foreground">Section "{currentStep}"</p>
					</div>
				);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-[1400px] w-[95vw] h-[92vh] p-0 gap-0 overflow-hidden bg-background">
				<DialogTitle className="sr-only">Add a loan</DialogTitle>
				<DialogDescription className="sr-only">
					Add a new loan to your portfolio by filling out the information step by step
				</DialogDescription>

				{/* Content */}
				<div className="flex flex-1 overflow-hidden h-full">
					{/* Left Sidebar - Steps Navigation */}
					<div className="w-56 border-r border-border p-5 space-y-1 flex-shrink-0">
						{steps.map((step, index) => (
							<Button
								variant="ghost"
								key={step.id}
								onClick={() => setCurrentStep(step.id)}
								className={`w-full justify-start px-3 py-2.5 rounded-lg transition-colors text-sm h-auto ${
									currentStep === step.id
										? "bg-primary/10 text-primary font-medium"
										: index <= currentStepIndex
											? "text-foreground hover:bg-accent"
											: "text-muted-foreground cursor-not-allowed"
								}`}
								disabled={index > currentStepIndex}
							>
								{step.label}
							</Button>
						))}
					</div>

					{/* Right Content Area */}
					<div className="flex-1 flex flex-col min-w-0">
						<div className="flex-1 overflow-y-auto px-10 py-8">
							<div className="max-w-3xl mx-auto">
								<div className="flex items-start justify-between mb-8">
									<h1>Add a loan</h1>
									<Button
										variant="ghost"
										onClick={onClose}
										className="p-2 h-auto w-auto -mt-1"
										aria-label="Close dialog"
									>
										<X className="h-5 w-5" />
									</Button>
								</div>
								{renderStepContent()}
							</div>
						</div>

						{/* Footer Actions */}
						<div className="border-t border-border px-10 py-4 flex items-center justify-between bg-background">
							<Button
								variant="ghost"
								onClick={handleBack}
								disabled={currentStepIndex === 0}
								className="gap-2"
							>
								<ChevronLeft className="h-4 w-4" />
								Back
							</Button>
							<Button
								onClick={handleNext}
								disabled={isSubmitting}
								className="gap-2 bg-primary hover:bg-primary/90"
							>
								{isSubmitting
									? "Saving…"
									: currentStepIndex === steps.length - 1
										? "Submit"
										: "Next"}
								{!isSubmitting && <ChevronRight className="h-4 w-4" />}
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
