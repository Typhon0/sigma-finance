import { useMutation, useQuery } from "@apollo/client";
import { RefreshCw, Wallet } from "lucide-react";
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
import { AddWalletDialog } from "@/features/wallets";
import { CREATE_ACCOUNT } from "@/graphql/mutations/accounts";
import { GET_ACCOUNTS, GET_CO_OWNER_CANDIDATES } from "@/graphql/queries/accounts";
import { invalidateDashboardData, invalidatePortfolioQueries } from "@/hooks/use-asset-management";

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
	const [type, setType] = useState<
		"BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "CRYPTO_WALLET" | "OTHER"
	>("BROKER");
	const [taxWrapper, setTaxWrapper] = useState<
		"STANDARD_TAXABLE" | "PEA" | "RETIREMENT_SHELTERED" | "CRYPTO_VAULT"
	>("STANDARD_TAXABLE");
	const [institution, setInstitution] = useState("");
	const [accountNumber, setAccountNumber] = useState("");
	const [currency, setCurrency] = useState("EUR");
	const [ownershipPercentage, setOwnershipPercentage] = useState<number>(100);
	const [coOwnerName, setCoOwnerName] = useState("");
	const [coOwnerUserId, setCoOwnerUserId] = useState<string | null>(null);
	const [showConnectDialog, setShowConnectDialog] = useState(false);
	const [showWalletDialog, setShowWalletDialog] = useState(false);

	const { data: candidatesData } = useQuery(GET_CO_OWNER_CANDIDATES);
	const candidates = candidatesData?.coOwnerCandidates || [];

	const [createAccount, { loading }] = useMutation(CREATE_ACCOUNT, {
		refetchQueries: [{ query: GET_ACCOUNTS, variables: { portfolioId } }],
		update: (cache) => {
			invalidatePortfolioQueries(cache);
			invalidateDashboardData(cache);
		},
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
						ownershipPercentage: ownershipPercentage > 0 ? ownershipPercentage : 100,
						coOwnerName: ownershipPercentage < 100 ? coOwnerName.trim() || undefined : undefined,
						coOwnerUserId: ownershipPercentage < 100 ? coOwnerUserId || undefined : undefined,
					},
				},
			});

			toast.success("Account created successfully!");
			onOpenChange(false);
			setName("");
			setInstitution("");
			setAccountNumber("");
			setCoOwnerName("");
			setCoOwnerUserId(null);
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
											<SelectItem value="CRYPTO_WALLET">
												On-Chain Crypto Wallet (EVM, Solana, Bitcoin)
											</SelectItem>
											<SelectItem value="OTHER">Other</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="grid gap-2">
									<Label htmlFor="acc-wrapper">Tax Wrapper</Label>
									<Select
										value={taxWrapper}
										onValueChange={(v: typeof taxWrapper) => setTaxWrapper(v)}
									>
										<SelectTrigger id="acc-wrapper">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="STANDARD_TAXABLE">Standard Taxable (CTO)</SelectItem>
											<SelectItem value="PEA">PEA (French Tax-Sheltered)</SelectItem>
											<SelectItem value="RETIREMENT_SHELTERED">
												Retirement / Sheltered (IRA/401k)
											</SelectItem>
											<SelectItem value="CRYPTO_VAULT">Crypto Vault</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							{type === "CRYPTO_WALLET" && (
								<div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
									<div className="flex items-center gap-2 text-foreground">
										<Wallet className="h-4 w-4 text-violet-500 shrink-0" />
										<span>Sync live balances & trades automatically from on-chain addresses.</span>
									</div>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={() => {
											onOpenChange(false);
											setShowWalletDialog(true);
										}}
										className="text-xs shrink-0 w-full sm:w-auto h-7 px-2.5 font-medium"
									>
										Connect Public Address
									</Button>
								</div>
							)}

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

						{/* Ownership percentage */}
						<div className="space-y-2 pt-1 border-t border-border/40">
							<div className="flex items-center justify-between">
								<Label htmlFor="create-account-ownership" className="text-xs font-medium">
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
									id="create-account-ownership"
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

							{/* Co-owner details if ownership < 100% */}
							{ownershipPercentage < 100 && (
								<div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border/60 mt-3">
									<div className="flex items-center justify-between">
										<Label htmlFor="create-account-co-owner-name" className="text-xs font-semibold">
											Co-titulaire ({((100 - ownershipPercentage)).toFixed(2).replace(/\.?0+$/, "")}%)
										</Label>
										<span className="text-micro text-muted-foreground">
											Part restante
										</span>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="create-account-co-owner-name" className="text-micro text-muted-foreground">
											Prénom / Nom libre (ex: Emma, Conjoint...)
										</Label>
										<Input
											id="create-account-co-owner-name"
											value={coOwnerName}
											onChange={(e) => setCoOwnerName(e.target.value)}
											placeholder="ex: Emma, Conjoint..."
											className="h-8 text-xs"
										/>
									</div>

									{candidates.length > 0 && (
										<div className="space-y-1.5 pt-1">
											<Label htmlFor="create-account-co-owner-user" className="text-micro text-muted-foreground">
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
												<SelectTrigger id="create-account-co-owner-user" className="h-8 text-xs">
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

			<AddWalletDialog
				open={showWalletDialog}
				onOpenChange={setShowWalletDialog}
				portfolioId={portfolioId}
				onSuccess={() => {
					onOpenChange(false);
				}}
			/>
		</>
	);
}
