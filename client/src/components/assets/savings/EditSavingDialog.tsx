import { useMutation } from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UPDATE_ACCOUNT } from "@/graphql/mutations/accounts";

export interface SavingEditData {
	id: string;
	accountName: string;
	bankName: string;
	accountNumber: string;
	currency: string;
	interestRate?: number | null;
	balance: number;
	accountType?: string;
}

export interface EditSavingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	saving: SavingEditData | null;
	onSuccess?: () => void;
}

export function EditSavingDialog({ open, onOpenChange, saving, onSuccess }: EditSavingDialogProps) {
	const { currentPortfolio, refetch } = usePortfolio();
	const portfolioId =
		typeof currentPortfolio === "string" ? currentPortfolio : currentPortfolio?.id;

	const [accountName, setAccountName] = useState("");
	const [bankName, setBankName] = useState("");
	const [accountNumber, setAccountNumber] = useState("");
	const [currency, setCurrency] = useState("EUR");
	const [interestRate, setInterestRate] = useState("");
	const [balance, setBalance] = useState("");
	const [accountType, setAccountType] = useState("savings");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [updateAccountMutation] = useMutation(UPDATE_ACCOUNT);

	useEffect(() => {
		if (saving) {
			setAccountName(saving.accountName || "");
			setBankName(saving.bankName || "");
			setAccountNumber(saving.accountNumber || "");
			setCurrency(saving.currency || "EUR");
			setInterestRate(
				typeof saving.interestRate === "number" && saving.interestRate > 0
					? saving.interestRate.toString()
					: "",
			);
			setBalance(saving.balance ? saving.balance.toString() : "0");
			setAccountType(saving.accountType || "savings");
		}
	}, [saving]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!saving) return;

		if (!accountName.trim()) {
			toast.error("Please enter an account name");
			return;
		}

		setIsSubmitting(true);
		try {
			// Save custom interest rate and metadata locally if asset-level
			const rateNum = interestRate.trim() ? parseFloat(interestRate) : null;
			if (rateNum !== null && !isNaN(rateNum)) {
				try {
					const ratesMap = JSON.parse(localStorage.getItem("sf_savings_custom_rates") || "{}");
					ratesMap[saving.id] = rateNum;
					localStorage.setItem("sf_savings_custom_rates", JSON.stringify(ratesMap));
				} catch {
					// ignore
				}
			}

			// Try updating server account if it's an account ID
			try {
				await updateAccountMutation({
					variables: {
						id: saving.id,
						input: {
							name: accountName.trim(),
							institution: bankName.trim() || undefined,
							accountNumber: accountNumber.trim() || undefined,
							currency: currency || undefined,
							type: "BANK",
						},
					},
				});
			} catch {
				// Non-fatal if this was an asset id rather than an accounts table id
			}

			toast.success("Savings account updated successfully");
			await refetch();
			onSuccess?.();
			onOpenChange(false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to update savings account";
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Edit Savings Account</DialogTitle>
						<DialogDescription>
							Adjust account details, bank provider, and APY interest yield.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4 text-xs">
						<div className="space-y-1.5">
							<Label htmlFor="saving-edit-name">Account Name</Label>
							<Input
								id="saving-edit-name"
								value={accountName}
								onChange={(e) => setAccountName(e.target.value)}
								placeholder="e.g. Livret A, High-Yield Cash"
								className="h-8 text-xs"
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="saving-edit-bank">Bank / Institution</Label>
								<Input
									id="saving-edit-bank"
									value={bankName}
									onChange={(e) => setBankName(e.target.value)}
									placeholder="e.g. BoursoBank, BNP"
									className="h-8 text-xs"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="saving-edit-type">Product Category</Label>
								<Select value={accountType} onValueChange={setAccountType}>
									<SelectTrigger id="saving-edit-type" className="h-8 text-xs">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="savings">Livret / Epargne</SelectItem>
										<SelectItem value="hysa">Super Livret / HYSA</SelectItem>
										<SelectItem value="term_deposit">Compte à Terme (CAT)</SelectItem>
										<SelectItem value="vault">Coffre / Pocket</SelectItem>
										<SelectItem value="checking">Compte Rémunéré</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="saving-edit-rate">Interest Rate (APY %)</Label>
								<Input
									id="saving-edit-rate"
									type="number"
									step="0.01"
									min="0"
									max="100"
									value={interestRate}
									onChange={(e) => setInterestRate(e.target.value)}
									placeholder="e.g. 3.00 (leave blank if 0%)"
									className="h-8 text-xs font-mono"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="saving-edit-currency">Currency</Label>
								<Select value={currency} onValueChange={setCurrency}>
									<SelectTrigger id="saving-edit-currency" className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="EUR">EUR (€)</SelectItem>
										<SelectItem value="USD">USD ($)</SelectItem>
										<SelectItem value="CHF">CHF (Fr.)</SelectItem>
										<SelectItem value="GBP">GBP (£)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="saving-edit-num">Account Identifier / Masked IBAN</Label>
							<Input
								id="saving-edit-num"
								value={accountNumber}
								onChange={(e) => setAccountNumber(e.target.value)}
								placeholder="e.g. FR76 **** **** 1234"
								className="h-8 text-xs font-mono"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
							className="h-8 text-xs"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting}
							className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
						>
							{isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
							Save Changes
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
