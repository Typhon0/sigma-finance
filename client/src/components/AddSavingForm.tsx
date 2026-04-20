import {
	Building2,
	DollarSign,
	Info,
	Percent,
	Users,
	Wallet,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

interface AddSavingFormProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (data: SavingsFormData) => void | Promise<void>;
}

export interface SavingsFormData {
	bankName: string;
	accountName: string;
	balance: string;
	interestRate: string;
	accountType: string;
	accountNumber: string;
	currency: string;
	ownership: "personal" | "joint" | "company";
	jointOwnerName: string;
	companyName: string;
	companyId: string;
}

export function AddSavingForm({ open, onClose, onSubmit }: AddSavingFormProps) {
	const { currency: displayCurrency, currencySymbol } = useCurrency();
	const [formData, setFormData] = useState<SavingsFormData>({
		bankName: "",
		accountName: "",
		balance: "",
		interestRate: "",
		accountType: "savings",
		accountNumber: "",
		currency: displayCurrency,
		ownership: "personal",
		jointOwnerName: "",
		companyName: "",
		companyId: "",
	});

	const handleInputChange = (field: keyof SavingsFormData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async () => {
		// Validation
		if (
			!formData.bankName.trim() ||
			!formData.accountName.trim() ||
			!formData.balance.trim() ||
			!formData.accountNumber.trim()
		) {
			toast.error("Please fill in all required fields");
			return;
		}

		const balanceNum = parseFloat(formData.balance);
		if (Number.isNaN(balanceNum) || balanceNum < 0) {
			toast.error("Please enter a valid balance");
			return;
		}

		// Additional validation based on ownership type
		if (formData.ownership === "joint" && !formData.jointOwnerName.trim()) {
			toast.error("Please enter the joint account holder name");
			return;
		}

		if (formData.ownership === "company" && !formData.companyName.trim()) {
			toast.error("Please enter the company name");
			return;
		}

		setSubmitting(true);
		try {
			await onSubmit(formData);
			handleClose();
		} catch {
			// Don't close dialog on error — let user retry
		} finally {
			setSubmitting(false);
		}
	};

	const handleClose = () => {
		setFormData({
			bankName: "",
			accountName: "",
			balance: "",
			interestRate: "",
			accountType: "savings",
			accountNumber: "",
			currency: displayCurrency,
			ownership: "personal",
			jointOwnerName: "",
			companyName: "",
			companyId: "",
		});
		onClose();
	};

	// Mock existing companies for selection
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

	if (!open) return null;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
				<DialogTitle className="sr-only">Add Savings Account</DialogTitle>
				<DialogDescription className="sr-only">
					Create a new savings account entry in your portfolio
				</DialogDescription>

				{/* Header */}
				<div className="p-6 pb-4 border-b">
					<div className="flex items-center justify-between mb-4">
						<Logo compact />
						<Button variant="ghost" size="icon" onClick={handleClose}>
							<X className="h-5 w-5" />
						</Button>
					</div>

					<div>
						<h2 className="text-2xl">Add Savings Account</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Enter your savings account details
						</p>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto px-6 py-4">
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3>Account Details</h3>
							<p className="text-sm text-muted-foreground">
								Enter the basic information about your savings account
							</p>
						</div>

						{/* Form Fields */}
						<div className="space-y-4">
							{/* Bank Name */}
							<div className="space-y-2">
								<Label htmlFor="bankName" className="flex items-center gap-2">
									<Building2 className="h-4 w-4 text-primary" />
									Bank Name <span className="text-destructive">*</span>
								</Label>
								<Input
									id="bankName"
									type="text"
									placeholder="e.g., BNP Paribas, Crédit Agricole..."
									value={formData.bankName}
									onChange={(e) =>
										handleInputChange("bankName", e.target.value)
									}
									className="bg-background border-border"
								/>
							</div>

							{/* Account Name */}
							<div className="space-y-2">
								<Label
									htmlFor="accountName"
									className="flex items-center gap-2"
								>
									<Wallet className="h-4 w-4 text-primary" />
									Account Name <span className="text-destructive">*</span>
								</Label>
								<Input
									id="accountName"
									type="text"
									placeholder="e.g., Livret A, Savings Account..."
									value={formData.accountName}
									onChange={(e) =>
										handleInputChange("accountName", e.target.value)
									}
									className="bg-background border-border"
								/>
							</div>

							{/* Account Type */}
							<div className="space-y-2">
								<Label htmlFor="accountType" className="text-sm">
									Account Type
								</Label>
								<Select
									value={formData.accountType}
									onValueChange={(value) =>
										handleInputChange("accountType", value)
									}
								>
									<SelectTrigger
										id="accountType"
										className="bg-background border-border"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="savings">Savings Account</SelectItem>
										<SelectItem value="money-market">Money Market</SelectItem>
										<SelectItem value="high-yield">
											High Yield Savings
										</SelectItem>
										<SelectItem value="fixed-deposit">
											Fixed Deposit / CD
										</SelectItem>
										<SelectItem value="business-savings">
											Business Savings
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Account Number */}
							<div className="space-y-2">
								<Label
									htmlFor="accountNumber"
									className="flex items-center gap-2"
								>
									<Wallet className="h-4 w-4 text-primary" />
									Account Number <span className="text-destructive">*</span>
								</Label>
								<Input
									id="accountNumber"
									type="text"
									placeholder="e.g., IBAN, account number..."
									value={formData.accountNumber}
									onChange={(e) =>
										handleInputChange("accountNumber", e.target.value)
									}
									className="bg-background border-border"
								/>
							</div>

							{/* Currency */}
							<div className="space-y-2">
								<Label htmlFor="currency" className="text-sm">
									Currency
								</Label>
								<Select
									value={formData.currency}
									onValueChange={(value) =>
										handleInputChange("currency", value)
									}
								>
									<SelectTrigger
										id="currency"
										className="bg-background border-border"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="USD">USD - US Dollar</SelectItem>
										<SelectItem value="EUR">EUR - Euro</SelectItem>
										<SelectItem value="GBP">GBP - British Pound</SelectItem>
										<SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
										<SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Balance */}
							<div className="space-y-2">
								<Label htmlFor="balance" className="flex items-center gap-2">
									<DollarSign className="h-4 w-4 text-primary" />
									Current Balance <span className="text-destructive">*</span>
								</Label>
								<Input
									id="balance"
									type="number"
									step="0.01"
									placeholder="0.00"
									value={formData.balance}
									onChange={(e) => handleInputChange("balance", e.target.value)}
									className="bg-background border-border font-mono"
								/>
							</div>

							{/* Interest Rate */}
							<div className="space-y-2">
								<Label
									htmlFor="interestRate"
									className="flex items-center gap-2"
								>
									<Percent className="h-4 w-4 text-primary" />
									Interest Rate{" "}
									<span className="text-muted-foreground text-xs">
										(Annual %)
									</span>
								</Label>
								<Input
									id="interestRate"
									type="number"
									step="0.01"
									placeholder="e.g., 3.0"
									value={formData.interestRate}
									onChange={(e) =>
										handleInputChange("interestRate", e.target.value)
									}
									className="bg-background border-border font-mono"
								/>
							</div>

							{/* Ownership */}
							<div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
								<Label htmlFor="ownership" className="flex items-center gap-2">
									<Users className="h-4 w-4 text-primary" />
									Account Ownership <span className="text-destructive">*</span>
								</Label>
								<Select
									value={formData.ownership}
									onValueChange={(value: string) =>
										handleInputChange("ownership", value)
									}
								>
									<SelectTrigger
										id="ownership"
										className="bg-background border-border"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="personal">
											<div className="flex items-center gap-2">
												<Users className="h-4 w-4" />
												<div>
													<div>Personal</div>
													<div className="text-xs text-muted-foreground">
														Individual account
													</div>
												</div>
											</div>
										</SelectItem>
										<SelectItem value="joint">
											<div className="flex items-center gap-2">
												<Users className="h-4 w-4" />
												<div>
													<div>Joint Account</div>
													<div className="text-xs text-muted-foreground">
														Shared with another person
													</div>
												</div>
											</div>
										</SelectItem>
										<SelectItem value="company">
											<div className="flex items-center gap-2">
												<Building2 className="h-4 w-4" />
												<div>
													<div>Company</div>
													<div className="text-xs text-muted-foreground">
														Business account
													</div>
												</div>
											</div>
										</SelectItem>
									</SelectContent>
								</Select>

								{/* Joint Account Holder */}
								{formData.ownership === "joint" && (
									<div className="space-y-2 pt-2">
										<Label htmlFor="jointOwnerName" className="text-sm">
											Joint Account Holder Name{" "}
											<span className="text-destructive">*</span>
										</Label>
										<Input
											id="jointOwnerName"
											type="text"
											placeholder="e.g., Spouse name, Family member..."
											value={formData.jointOwnerName}
											onChange={(e) =>
												handleInputChange("jointOwnerName", e.target.value)
											}
											className="bg-background border-border"
										/>
										<p className="text-xs text-muted-foreground">
											Enter the name of the person with whom you share this
											account
										</p>
									</div>
								)}

								{/* Company Selection */}
								{formData.ownership === "company" && (
									<div className="space-y-3 pt-2">
										<div className="space-y-2">
											<Label className="text-sm">
												Select Company{" "}
												<span className="text-muted-foreground">
													(Optional)
												</span>
											</Label>
											<Select
												value={formData.companyId}
												onValueChange={(value) => {
													const company = existingCompanies.find(
														(c) => c.id === value,
													);
													handleInputChange("companyId", value);
													if (company) {
														handleInputChange("companyName", company.name);
													}
												}}
											>
												<SelectTrigger className="bg-background border-border">
													<SelectValue placeholder="Select an existing company or enter new..." />
												</SelectTrigger>
												<SelectContent>
													{existingCompanies.map((company) => (
														<SelectItem key={company.id} value={company.id}>
															<div className="flex flex-col">
																<span>{company.name}</span>
																<span className="text-xs text-muted-foreground">
																	{company.legalForm} •{" "}
																	{company.registrationNumber}
																</span>
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label htmlFor="companyName" className="text-sm">
												Company Name <span className="text-destructive">*</span>
											</Label>
											<Input
												id="companyName"
												type="text"
												placeholder="e.g., My Business SARL..."
												value={formData.companyName}
												onChange={(e) =>
													handleInputChange("companyName", e.target.value)
												}
												className="bg-background border-border"
											/>
											<p className="text-xs text-muted-foreground">
												Enter the company that owns this business account
											</p>
										</div>
									</div>
								)}

								{/* Info Box */}
								<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
									<div className="flex gap-2">
										<Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
										<div className="text-xs text-blue-900 dark:text-blue-100">
											{formData.ownership === "personal" && (
												<p>This account is owned individually by you</p>
											)}
											{formData.ownership === "joint" && (
												<p>
													Joint accounts are shared between two account holders
													with equal access and ownership
												</p>
											)}
											{formData.ownership === "company" && (
												<p>
													Business accounts help separate personal and
													professional finances for tax and accounting purposes
												</p>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Summary Box */}
						{formData.bankName && formData.accountName && formData.balance && (
							<div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
								<h4 className="text-sm font-medium mb-3">Summary</h4>
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Bank:</span>
										<span className="font-medium">{formData.bankName}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Account:</span>
										<span className="font-medium">{formData.accountName}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Type:</span>
										<span className="font-medium capitalize">
											{formData.accountType.replace("-", " ")}
										</span>
									</div>
									{formData.accountNumber && (
										<div className="flex justify-between">
											<span className="text-muted-foreground">
												Account No.:
											</span>
											<span className="font-mono text-sm">
												{formData.accountNumber}
											</span>
										</div>
									)}
									<div className="flex justify-between">
										<span className="text-muted-foreground">Currency:</span>
										<span className="font-medium">{formData.currency}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Balance:</span>
										<span className="font-mono font-medium text-green-600">
											{currencySymbol}
											{parseFloat(formData.balance || "0").toLocaleString(
												"en-US",
												{ minimumFractionDigits: 2 },
											)}
										</span>
									</div>
									{formData.interestRate && (
										<div className="flex justify-between">
											<span className="text-muted-foreground">
												Interest Rate:
											</span>
											<span className="font-mono">
												{formData.interestRate}%
											</span>
										</div>
									)}
									<div className="flex justify-between pt-2 border-t">
										<span className="text-muted-foreground">Ownership:</span>
										<span className="font-medium capitalize">
											{formData.ownership}
										</span>
									</div>
									{formData.ownership === "joint" &&
										formData.jointOwnerName && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Joint Holder:
												</span>
												<span className="font-medium">
													{formData.jointOwnerName}
												</span>
											</div>
										)}
									{formData.ownership === "company" && formData.companyName && (
										<div className="flex justify-between">
											<span className="text-muted-foreground">Company:</span>
											<span className="font-medium">
												{formData.companyName}
											</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="p-6 pt-4 border-t bg-muted/20">
					<div className="flex items-center justify-end gap-3">
						<Button variant="ghost" onClick={handleClose}>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={submitting}>
							{submitting ? "Adding..." : "Add Account"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
