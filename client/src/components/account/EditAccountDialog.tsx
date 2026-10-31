import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useMutation,
} from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";

export interface AccountEditData {
	id: string;
	name: string;
	type?: "BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "OTHER" | "CEX" | "Broker" | "Bank" | string;
	taxWrapper?: string | null;
	institution?: string | null;
	accountNumber?: string | null;
	currency?: string | null;
}

export interface EditAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountEditData | null;
	portfolioId?: string;
	onSuccess?: () => void;
}

function normalizeTypeToEnum(type?: string): "BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "OTHER" {
	if (!type) return "BROKER";
	const upper = type.toUpperCase();
	if (upper === "CEX" || upper === "CRYPTO_EXCHANGE") return "CRYPTO_EXCHANGE";
	if (upper === "BANK") return "BANK";
	if (upper === "BROKER") return "BROKER";
	return "OTHER";
}

function normalizeTaxWrapper(
	wrapper?: string | null,
): "STANDARD_TAXABLE" | "PEA" | "RETIREMENT_SHELTERED" | "CRYPTO_VAULT" {
	if (!wrapper) return "STANDARD_TAXABLE";
	const upper = wrapper.toUpperCase();
	if (upper === "PEA") return "PEA";
	if (upper === "RETIREMENT_SHELTERED") return "RETIREMENT_SHELTERED";
	if (upper === "CRYPTO_VAULT") return "CRYPTO_VAULT";
	return "STANDARD_TAXABLE";
}

export function EditAccountDialog({
	open,
	onOpenChange,
	account,
	portfolioId,
	onSuccess,
}: EditAccountDialogProps) {
	const [name, setName] = useState("");
	const [type, setType] = useState<"BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "OTHER">("BROKER");
	const [taxWrapper, setTaxWrapper] = useState<
		"STANDARD_TAXABLE" | "PEA" | "RETIREMENT_SHELTERED" | "CRYPTO_VAULT"
	>("STANDARD_TAXABLE");
	const [institution, setInstitution] = useState("");
	const [accountNumber, setAccountNumber] = useState("");
	const [currency, setCurrency] = useState("EUR");

	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);

	useEffect(() => {
		if (account) {
			setName(account.name || "");
			setType(normalizeTypeToEnum(account.type));
			setTaxWrapper(normalizeTaxWrapper(account.taxWrapper));
			setInstitution(account.institution || "");
			setAccountNumber(account.accountNumber || "");
			setCurrency(account.currency || "EUR");
		}
	}, [account]);

	const [updateAccount, { loading }] = useMutation(UPDATE_ACCOUNT, {
		client: fallbackClient,
		refetchQueries: portfolioId ? [{ query: GET_ACCOUNTS, variables: { portfolioId } }] : undefined,
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!account?.id) return;

		const trimmedName = name.trim();
		if (!trimmedName) {
			toast.error("Account name is required");
			return;
		}

		const toastId = toast.loading("Updating account...");
		try {
			await updateAccount({
				variables: {
					id: account.id,
					input: {
						name: trimmedName,
						type,
						taxWrapper,
						institution: institution.trim() || null,
						accountNumber: accountNumber.trim() || null,
						currency: currency.trim() || "EUR",
					},
				},
			});

			toast.success("Account updated successfully", { id: toastId });
			onOpenChange(false);
			onSuccess?.();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to update account";
			toast.error(msg, { id: toastId });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Edit Account</DialogTitle>
					<DialogDescription>
						Update details and classification for this financial account.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-account-name">Account Name *</Label>
						<Input
							id="edit-account-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Main Brokerage, Kraken Trading"
							required
							autoFocus
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="edit-account-type">Account Type</Label>
							<Select
								value={type}
								onValueChange={(val) =>
									setType(val as "BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "OTHER")
								}
							>
								<SelectTrigger id="edit-account-type">
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="BROKER">Brokerage</SelectItem>
									<SelectItem value="BANK">Bank Account</SelectItem>
									<SelectItem value="CRYPTO_EXCHANGE">Crypto Exchange</SelectItem>
									<SelectItem value="OTHER">Other / Valuables</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-account-currency">Currency</Label>
							<Select value={currency} onValueChange={setCurrency}>
								<SelectTrigger id="edit-account-currency">
									<SelectValue placeholder="Currency" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="EUR">EUR (€)</SelectItem>
									<SelectItem value="USD">USD ($)</SelectItem>
									<SelectItem value="GBP">GBP (£)</SelectItem>
									<SelectItem value="CHF">CHF (Fr)</SelectItem>
									<SelectItem value="JPY">JPY (¥)</SelectItem>
									<SelectItem value="CAD">CAD ($)</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-account-tax">Tax Wrapper</Label>
						<Select
							value={taxWrapper}
							onValueChange={(val) =>
								setTaxWrapper(
									val as "STANDARD_TAXABLE" | "PEA" | "RETIREMENT_SHELTERED" | "CRYPTO_VAULT",
								)
							}
						>
							<SelectTrigger id="edit-account-tax">
								<SelectValue placeholder="Select tax classification" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="STANDARD_TAXABLE">Standard Taxable (CTO)</SelectItem>
								<SelectItem value="PEA">PEA (Plan d'Épargne en Actions)</SelectItem>
								<SelectItem value="RETIREMENT_SHELTERED">
									Retirement / Sheltered (PER/401k)
								</SelectItem>
								<SelectItem value="CRYPTO_VAULT">Crypto Vault</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="edit-account-institution">Institution</Label>
							<Input
								id="edit-account-institution"
								value={institution}
								onChange={(e) => setInstitution(e.target.value)}
								placeholder="e.g. Interactive Brokers, Kraken"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-account-number">Account Number / ID</Label>
							<Input
								id="edit-account-number"
								value={accountNumber}
								onChange={(e) => setAccountNumber(e.target.value)}
								placeholder="e.g. U1234567, DE89..."
							/>
						</div>
					</div>

					<DialogFooter className="pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Save Changes
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
