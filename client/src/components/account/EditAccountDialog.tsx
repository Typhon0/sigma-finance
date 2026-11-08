import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useMutation,
	useQuery,
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
import { GET_ACCOUNTS, GET_CO_OWNER_CANDIDATES } from "@/graphql/queries/accounts";
import { classifyAccount } from "@/lib/account-classifier";

export interface AccountEditData {
	id: string;
	name: string;
	type?: "BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "OTHER" | "CEX" | "Broker" | "Bank" | string;
	taxWrapper?: string | null;
	institution?: string | null;
	accountNumber?: string | null;
	currency?: string | null;
	ownershipPercentage?: number | null;
	coOwnerName?: string | null;
	coOwnerUserId?: string | null;
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
	const [ownershipPercentage, setOwnershipPercentage] = useState<number>(100);
	const [coOwnerName, setCoOwnerName] = useState("");
	const [coOwnerUserId, setCoOwnerUserId] = useState<string | null>(null);

	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);

	const { data: candidatesData } = useQuery(GET_CO_OWNER_CANDIDATES, {
		client: fallbackClient,
	});
	const candidates = candidatesData?.coOwnerCandidates || [];

	useEffect(() => {
		if (account) {
			setName(account.name || "");
			setType(normalizeTypeToEnum(account.type));
			setTaxWrapper(normalizeTaxWrapper(account.taxWrapper));
			setInstitution(account.institution || "");
			setAccountNumber(account.accountNumber || "");
			setCurrency(account.currency || "EUR");
			setOwnershipPercentage(
				typeof account.ownershipPercentage === "number" && account.ownershipPercentage > 0
					? account.ownershipPercentage
					: 100,
			);
			setCoOwnerName(account.coOwnerName || "");
			setCoOwnerUserId(account.coOwnerUserId || null);
		}
	}, [account]);

	const isJointDetected = useMemo(() => {
		const classified = classifyAccount({
			name,
			institution,
			accountNumber,
		});
		return classified.isJoint;
	}, [name, institution, accountNumber]);

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
						ownershipPercentage: ownershipPercentage > 0 ? ownershipPercentage : 100,
						coOwnerName: ownershipPercentage < 100 ? coOwnerName.trim() || null : null,
						coOwnerUserId: ownershipPercentage < 100 ? coOwnerUserId || null : null,
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

					{/* Joint Account Detection Banner */}
					{isJointDetected && ownershipPercentage === 100 && (
						<div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs">
							<div className="space-y-0.5">
								<p className="font-semibold text-primary">Compte joint détecté</p>
								<p className="text-muted-foreground text-micro">
									Souhaitez-vous appliquer une quote-part de 50% sur ce compte ?
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="h-7 text-xs ml-2 shrink-0"
								onClick={() => setOwnershipPercentage(50)}
							>
								Appliquer 50%
							</Button>
						</div>
					)}

					{/* Ownership Percentage Control */}
					<div className="space-y-2 pt-1 border-t border-border/40">
						<div className="flex items-center justify-between">
							<Label htmlFor="edit-account-ownership" className="text-xs font-medium">
								Quote-part personnelle (%)
							</Label>
							<div className="flex items-center gap-1.5">
								<Button
									type="button"
									variant={ownershipPercentage === 100 ? "default" : "outline"}
									className="h-6 text-micro px-2 py-0"
									onClick={() => setOwnershipPercentage(100)}
								>
									100% Plein
								</Button>
								<Button
									type="button"
									variant={ownershipPercentage === 50 ? "default" : "outline"}
									className="h-6 text-micro px-2 py-0"
									onClick={() => setOwnershipPercentage(50)}
								>
									50% Compte joint
								</Button>
							</div>
						</div>
						<div className="relative">
							<Input
								id="edit-account-ownership"
								type="number"
								min="0.01"
								max="100"
								step="0.01"
								value={ownershipPercentage}
								onChange={(e) => {
									const val = Number.parseFloat(e.target.value);
									setOwnershipPercentage(Number.isNaN(val) ? 0 : val);
								}}
								className="pr-8 font-mono text-sm"
							/>
							<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
								%
							</span>
						</div>
						<p className="text-micro text-muted-foreground">
							Définit votre part dans le patrimoine net. Les positions de ce compte seront
							automatiquement mises à jour.
						</p>

						{/* Co-owner details if ownership < 100% */}
						{ownershipPercentage < 100 && (
							<div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border/60 mt-3">
								<div className="flex items-center justify-between">
									<Label htmlFor="edit-account-co-owner-name" className="text-xs font-semibold">
										Co-titulaire ({((100 - ownershipPercentage)).toFixed(2).replace(/\.?0+$/, "")}%)
									</Label>
									<span className="text-micro text-muted-foreground">
										Part restante
									</span>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="edit-account-co-owner-name" className="text-micro text-muted-foreground">
										Prénom / Nom libre (ex: Emma, Conjoint, Associé...)
									</Label>
									<Input
										id="edit-account-co-owner-name"
										value={coOwnerName}
										onChange={(e) => setCoOwnerName(e.target.value)}
										placeholder="ex: Emma, Conjoint..."
										className="h-8 text-xs"
									/>
								</div>

								{candidates.length > 0 && (
									<div className="space-y-1.5 pt-1">
										<Label htmlFor="edit-account-co-owner-user" className="text-micro text-muted-foreground">
											Lier à un compte utilisateur Sigma Finance (optionnel)
										</Label>
										<Select
											value={coOwnerUserId || "none"}
											onValueChange={(val) => {
												if (val === "none") {
													setCoOwnerUserId(null);
												} else {
													setCoOwnerUserId(val);
													const matched = candidates.find((c) => c.id === val);
													if (matched && !coOwnerName) {
														setCoOwnerName(matched.name);
													}
												}
											}}
										>
											<SelectTrigger id="edit-account-co-owner-user" className="h-8 text-xs">
												<SelectValue placeholder="Aucun compte lié" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Aucun compte lié (nom libre seul)</SelectItem>
												{candidates.map((c) => (
													<SelectItem key={c.id} value={c.id}>
														{c.name} ({c.email})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						)}
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
