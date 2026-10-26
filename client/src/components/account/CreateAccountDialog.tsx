import { useMutation } from "@apollo/client";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConnectInstitutionDialog } from "@/components/sync/ConnectInstitutionDialog";
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
import { CREATE_ACCOUNT } from "@/graphql/mutations/accounts";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";

interface CreateAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioId: string;
	onSuccess?: (accountId: string) => void;
}

export function CreateAccountDialog({
	open,
	onOpenChange,
	portfolioId,
	onSuccess,
}: CreateAccountDialogProps) {
	const [name, setName] = useState("");
	const [type, setType] = useState<"BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "OTHER">("BROKER");
	const [taxWrapper, setTaxWrapper] = useState<
		"STANDARD_TAXABLE" | "PEA" | "RETIREMENT_SHELTERED" | "CRYPTO_VAULT"
	>("STANDARD_TAXABLE");
	const [institution, setInstitution] = useState("");
	const [accountNumber, setAccountNumber] = useState("");
	const [currency, setCurrency] = useState("EUR");
	const [showConnectDialog, setShowConnectDialog] = useState(false);

	const [createAccount, { loading }] = useMutation(CREATE_ACCOUNT, {
		refetchQueries: [{ query: GET_ACCOUNTS, variables: { portfolioId } }],
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			toast.error("Please enter an account name");
			return;
		}

		try {
			const res = await createAccount({
				variables: {
					input: {
						portfolioId,
						name: name.trim(),
						type,
						taxWrapper,
						institution: institution.trim() || undefined,
						accountNumber: accountNumber.trim() || undefined,
						currency,
					},
				},
			});

			toast.success("Account created successfully!");
			onOpenChange(false);
			setName("");
			setInstitution("");
			setAccountNumber("");
			if (res.data?.createAccount?.id) {
				onSuccess?.(res.data.createAccount.id);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to create account";
			toast.error(msg);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>New Financial Account</DialogTitle>
						<DialogDescription>
							Define the custody and legal envelope (Brokerage, Tax-Sheltered, Crypto...) held at
							your institution.
						</DialogDescription>
					</DialogHeader>

					<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm mt-2">
						<div className="flex items-center gap-2">
							<RefreshCw className="h-4 w-4 text-primary shrink-0" />
							<span>Want to sync balances & trades automatically?</span>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								onOpenChange(false);
								setShowConnectDialog(true);
							}}
							className="text-xs shrink-0 w-full sm:w-auto"
						>
							Connect External Institution
						</Button>
					</div>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="acc-name">Account Name *</Label>
							<Input
								id="acc-name"
								placeholder="e.g. Trade Republic CTO, Fortuneo PEA..."
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								autoFocus
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="acc-type">Account Type</Label>
								<Select value={type} onValueChange={(v: typeof type) => setType(v)}>
									<SelectTrigger id="acc-type">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="BROKER">Brokerage / Trading</SelectItem>
										<SelectItem value="BANK">Bank / Savings</SelectItem>
										<SelectItem value="CRYPTO_EXCHANGE">Crypto Exchange</SelectItem>
										<SelectItem value="OTHER">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="acc-wrapper">Tax Wrapper</Label>
								<Select value={taxWrapper} onValueChange={(v: typeof taxWrapper) => setTaxWrapper(v)}>
									<SelectTrigger id="acc-wrapper">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="STANDARD_TAXABLE">Standard Taxable (CTO)</SelectItem>
										<SelectItem value="PEA">PEA (French Tax-Sheltered)</SelectItem>
										<SelectItem value="RETIREMENT_SHELTERED">Retirement / Sheltered (IRA/401k)</SelectItem>
										<SelectItem value="CRYPTO_VAULT">Crypto Vault</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="acc-inst">Institution / Broker</Label>
								<Input
									id="acc-inst"
									placeholder="e.g. Trade Republic, Interactive Brokers..."
									value={institution}
									onChange={(e) => setInstitution(e.target.value)}
								/>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="acc-num">Account Number (Optional)</Label>
								<Input
									id="acc-num"
									placeholder="e.g. FR76..."
									value={accountNumber}
									onChange={(e) => setAccountNumber(e.target.value)}
								/>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="acc-curr">Reference Currency</Label>
							<Select value={currency} onValueChange={setCurrency}>
								<SelectTrigger id="acc-curr">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="EUR">Euro (EUR - €)</SelectItem>
									<SelectItem value="USD">US Dollar (USD - $)</SelectItem>
									<SelectItem value="GBP">British Pound (GBP - £)</SelectItem>
									<SelectItem value="CHF">Swiss Franc (CHF - ₣)</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading || !name.trim()}>
							{loading ? "Creating..." : "Create Account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>

		<ConnectInstitutionDialog
			open={showConnectDialog}
			onOpenChange={setShowConnectDialog}
			portfolioId={portfolioId}
			onSuccess={(id) => {
				if (id) onSuccess?.(id);
			}}
		/>
	</>
	);
}
