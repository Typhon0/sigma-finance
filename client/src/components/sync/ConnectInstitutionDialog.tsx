import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useMutation,
	useQuery,
} from "@apollo/client";
import {
	ArrowRight,
	Building2,
	CheckCircle2,
	ExternalLink,
	Eye,
	EyeOff,
	Key,
	Landmark,
	Loader2,
	ShieldCheck,
	Wallet,
} from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CREATE_ACCOUNT } from "@/graphql/mutations/accounts";
import {
	COMPLETE_AGGREGATOR_AUTH,
	GENERATE_AGGREGATOR_LINK,
	LINK_SYNC_ACCOUNT,
	REGISTER_SYNC_CREDENTIAL,
} from "@/graphql/mutations/sync";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";

export interface ConnectInstitutionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioId: string;
	onSuccess?: (connectionId?: string) => void;
}

interface AccountItem {
	id: string;
	name: string;
	type: string;
	institution?: string | null;
}

export function ConnectInstitutionDialog({
	open,
	onOpenChange,
	portfolioId,
	onSuccess,
}: ConnectInstitutionDialogProps) {
	const [activeProviderTab, setActiveProviderTab] = useState<"kraken" | "snaptrade" | "gocardless">(
		"kraken",
	);

	// Kraken Form State
	const [krakenApiKey, setKrakenApiKey] = useState("");
	const [krakenApiSecret, setKrakenApiSecret] = useState("");
	const [showSecret, setShowSecret] = useState(false);

	// Account Mapping State
	const [mappingMode, setMappingMode] = useState<"auto" | "existing">("auto");
	const [selectedAccountId, setSelectedAccountId] = useState<string>("");

	// Pending Aggregator Session State
	const [pendingSession, setPendingSession] = useState<{
		provider: string;
		sessionToken: string;
		link: string;
	} | null>(null);

	// Safe Apollo context handling when rendered in tests without ApolloProvider
	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);

	// Restore pending aggregator authorization state on mount/open
	useEffect(() => {
		try {
			const saved = sessionStorage.getItem("sigma_pending_aggregator_auth");
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed.sessionToken && (!parsed.portfolioId || parsed.portfolioId === portfolioId)) {
					setPendingSession(parsed);
				}
			}
		} catch {
			// Ignore sessionStorage errors
		}
	}, [open, portfolioId]);

	// Queries & Mutations
	const { data: accountsData } = useQuery<{ accounts: AccountItem[] }>(GET_ACCOUNTS, {
		client: fallbackClient,
		variables: { portfolioId },
		skip: !open || !portfolioId || !apolloContext?.client,
	});

	const { data: syncConnsData } = useQuery<{
		syncConnections: Array<{ id: string; provider: string; accountId?: string | null }>;
	}>(GET_SYNC_CONNECTIONS, {
		client: fallbackClient,
		variables: { portfolioId },
		skip: !open || !portfolioId || !apolloContext?.client,
	});

	const [registerCredential, { loading: registeringKraken }] = useMutation(
		REGISTER_SYNC_CREDENTIAL,
		{
			client: fallbackClient,
		},
	);
	const [generateLink, { loading: generatingLink }] = useMutation(GENERATE_AGGREGATOR_LINK, {
		client: fallbackClient,
	});
	const [completeAggregatorAuth, { loading: completingAuth }] = useMutation(
		COMPLETE_AGGREGATOR_AUTH,
		{
			client: fallbackClient,
			refetchQueries: [
				{ query: GET_ACCOUNTS, variables: { portfolioId } },
				{ query: GET_SYNC_CONNECTIONS, variables: { portfolioId } },
			],
		},
	);
	const [linkAccount, { loading: linkingAccount }] = useMutation(LINK_SYNC_ACCOUNT, {
		client: fallbackClient,
		refetchQueries: [{ query: GET_ACCOUNTS, variables: { portfolioId } }],
	});
	const [createAccount, { loading: creatingAccount }] = useMutation(CREATE_ACCOUNT, {
		client: fallbackClient,
		refetchQueries: [{ query: GET_ACCOUNTS, variables: { portfolioId } }],
	});

	const accounts = accountsData?.accounts ?? [];
	const isBusy =
		registeringKraken || generatingLink || linkingAccount || creatingAccount || completingAuth;

	const resetForm = () => {
		setKrakenApiKey("");
		setKrakenApiSecret("");
		setShowSecret(false);
		setMappingMode("auto");
		setSelectedAccountId("");
		setPendingSession(null);
	};

	const handleCompleteAuth = async (tokenOverride?: string) => {
		const token = tokenOverride || pendingSession?.sessionToken;
		if (!token) return;

		const toastId = toast.loading("Finalizing account discovery and synchronization...");
		try {
			const res = await completeAggregatorAuth({
				variables: {
					connectionId: portfolioId,
					sessionToken: token,
				},
			});

			try {
				sessionStorage.removeItem("sigma_pending_aggregator_auth");
			} catch {
				// Ignore
			}

			setPendingSession(null);
			toast.success("Account connected and synchronized successfully!", { id: toastId });
			const conns = res.data?.completeAggregatorAuth;
			const connId = conns && conns.length > 0 ? conns[0].id : token;
			onSuccess?.(connId);
			onOpenChange(false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to complete aggregator connection";
			toast.error(msg, { id: toastId });
		}
	};

	// 1. Handle Kraken Direct Connection
	const handleConnectKraken = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!krakenApiKey.trim() || !krakenApiSecret.trim()) {
			toast.error("Please enter both Kraken API Key and API Secret");
			return;
		}

		if (mappingMode === "existing" && accounts.length > 0 && !selectedAccountId) {
			toast.error("Please select an existing account to link");
			return;
		}

		const toastId = toast.loading("Registering Kraken credentials...");

		try {
			// Register credential in backend
			const credRes = await registerCredential({
				variables: {
					provider: "KRAKEN",
					credentials: {
						apiKey: krakenApiKey.trim(),
						apiSecret: krakenApiSecret.trim(),
					},
					portfolioId,
				},
			});

			if (!credRes.data?.registerSyncCredential?.id) {
				throw new Error("Failed to register Kraken credentials");
			}

			// If auto-create account is chosen, create an account if user doesn't already have one mapped
			if (mappingMode === "auto") {
				await createAccount({
					variables: {
						input: {
							portfolioId,
							name: "Kraken Spot Account",
							type: "CRYPTO_EXCHANGE",
							taxWrapper: "CRYPTO_VAULT",
							institution: "Kraken",
							currency: "EUR",
							syncProvider: "KRAKEN",
						},
					},
				});
			} else if (mappingMode === "existing" && selectedAccountId) {
				// If a sync connection for Kraken already exists, link it
				const krakenConn = syncConnsData?.syncConnections.find(
					(c) => c.provider === "KRAKEN" && (!c.accountId || c.accountId === selectedAccountId),
				);
				if (krakenConn) {
					await linkAccount({
						variables: {
							connectionId: krakenConn.id,
							accountId: selectedAccountId,
							autoCreate: false,
						},
					});
				}
			}

			toast.success("Kraken connected successfully!", { id: toastId });
			resetForm();
			onOpenChange(false);
			onSuccess?.(credRes.data.registerSyncCredential.id);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to connect Kraken";
			toast.error(msg, { id: toastId });
		}
	};

	// 2. Handle SnapTrade (Trade Republic, IBKR, etc.)
	const handleConnectSnapTrade = async () => {
		if (mappingMode === "existing" && accounts.length > 0 && !selectedAccountId) {
			toast.error("Please select an existing account to link");
			return;
		}

		const redirectUrl = `${window.location.origin}/dashboard`;
		const toastId = toast.loading("Initializing Trade Republic & Brokerage connection...");

		try {
			const res = await generateLink({
				variables: {
					provider: "SNAPTRADE",
					redirectUrl,
				},
			});

			const authSession = res.data?.generateAggregatorLink;
			if (!authSession?.link) {
				throw new Error("No authorization link received from broker aggregator");
			}

			// If linking to existing account, link any matching connection if available
			if (mappingMode === "existing" && selectedAccountId) {
				const snapConn = syncConnsData?.syncConnections.find(
					(c) => c.provider === "SNAPTRADE" && !c.accountId,
				);
				if (snapConn) {
					await linkAccount({
						variables: {
							connectionId: snapConn.id,
							accountId: selectedAccountId,
							autoCreate: false,
						},
					});
				}
			}

			toast.success("Redirecting to institution authentication portal...", { id: toastId });

			const sessionData = {
				provider: "SNAPTRADE",
				sessionToken: authSession.sessionToken,
				link: authSession.link,
				portfolioId,
			};
			setPendingSession(sessionData);
			try {
				sessionStorage.setItem("sigma_pending_aggregator_auth", JSON.stringify(sessionData));
			} catch {
				// Ignore
			}

			// Open portal in new window or redirect
			const popup = window.open(
				authSession.link,
				"snaptrade_auth",
				"width=720,height=800,scrollbars=yes,resizable=yes",
			);
			if (popup) {
				const checkPopup = setInterval(() => {
					if (popup.closed) {
						clearInterval(checkPopup);
						handleCompleteAuth(authSession.sessionToken);
					}
				}, 1000);
			} else {
				// Popup blocked, open in same tab
				window.location.href = authSession.link;
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to generate connection link";
			toast.error(msg, { id: toastId });
		}
	};

	// 3. Handle GoCardless (European Banks Open Banking)
	const handleConnectGoCardless = async () => {
		if (mappingMode === "existing" && accounts.length > 0 && !selectedAccountId) {
			toast.error("Please select an existing account to link");
			return;
		}

		const redirectUrl = `${window.location.origin}/dashboard`;
		const toastId = toast.loading("Initializing European Open Banking session...");

		try {
			const res = await generateLink({
				variables: {
					provider: "GOCARDLESS",
					redirectUrl,
				},
			});

			const authSession = res.data?.generateAggregatorLink;
			if (!authSession?.link) {
				throw new Error("No authorization link received from Open Banking provider");
			}

			// If linking to existing account, link any matching connection if available
			if (mappingMode === "existing" && selectedAccountId) {
				const gcConn = syncConnsData?.syncConnections.find(
					(c) => c.provider === "GOCARDLESS" && !c.accountId,
				);
				if (gcConn) {
					await linkAccount({
						variables: {
							connectionId: gcConn.id,
							accountId: selectedAccountId,
							autoCreate: false,
						},
					});
				}
			}

			toast.success("Redirecting to Bank authorization gateway...", { id: toastId });

			const sessionData = {
				provider: "GOCARDLESS",
				sessionToken: authSession.sessionToken,
				link: authSession.link,
				portfolioId,
			};
			setPendingSession(sessionData);
			try {
				sessionStorage.setItem("sigma_pending_aggregator_auth", JSON.stringify(sessionData));
			} catch {
				// Ignore
			}

			const popup = window.open(
				authSession.link,
				"gocardless_auth",
				"width=720,height=800,scrollbars=yes,resizable=yes",
			);
			if (popup) {
				const checkPopup = setInterval(() => {
					if (popup.closed) {
						clearInterval(checkPopup);
						handleCompleteAuth(authSession.sessionToken);
					}
				}, 1000);
			} else {
				window.location.href = authSession.link;
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to generate bank connection link";
			toast.error(msg, { id: toastId });
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(val) => {
				if (!val) resetForm();
				onOpenChange(val);
			}}
		>
			<DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Building2 className="h-5 w-5 text-primary" />
						<DialogTitle>Connect External Institution</DialogTitle>
					</div>
					<DialogDescription>
						Link your financial institution to automatically synchronize balances, positions, and
						trades into this portfolio.
					</DialogDescription>
				</DialogHeader>

				{pendingSession ? (
					<div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
						<div className="rounded-full bg-primary/10 p-4">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
						<div className="space-y-1">
							<h3 className="font-semibold text-lg">Waiting for authorization...</h3>
							<p className="text-sm text-muted-foreground max-w-sm">
								Please complete the authentication process in the institution's portal. Once approved,
								click below to discover accounts and initiate synchronization.
							</p>
						</div>
						<div className="flex flex-col gap-2 w-full max-w-xs pt-2">
							<Button
								type="button"
								onClick={() => handleCompleteAuth()}
								disabled={completingAuth}
								className="w-full gap-2"
							>
								{completingAuth ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Connecting Accounts...
									</>
								) : (
									<>
										<CheckCircle2 className="h-4 w-4" />
										Complete Connection
									</>
								)}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setPendingSession(null);
									try {
										sessionStorage.removeItem("sigma_pending_aggregator_auth");
									} catch {
										// Ignore
									}
								}}
								disabled={completingAuth}
								className="w-full"
							>
								Cancel
							</Button>
						</div>
					</div>
				) : (
					<Tabs
						value={activeProviderTab}
						onValueChange={(val) => setActiveProviderTab(val as typeof activeProviderTab)}
						className="mt-2"
					>
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger
							value="kraken"
							onClick={() => setActiveProviderTab("kraken")}
							className="flex items-center gap-1.5 text-xs sm:text-sm"
						>
							<Wallet className="h-4 w-4" />
							<span>Kraken</span>
						</TabsTrigger>
						<TabsTrigger
							value="snaptrade"
							onClick={() => setActiveProviderTab("snaptrade")}
							className="flex items-center gap-1.5 text-xs sm:text-sm"
						>
							<Building2 className="h-4 w-4" />
							<span>Trade Republic</span>
						</TabsTrigger>
						<TabsTrigger
							value="gocardless"
							onClick={() => setActiveProviderTab("gocardless")}
							className="flex items-center gap-1.5 text-xs sm:text-sm"
						>
							<Landmark className="h-4 w-4" />
							<span>European Banks</span>
						</TabsTrigger>
					</TabsList>

					{/* 1. KRAKEN TAB */}
					<TabsContent value="kraken" className="space-y-4 pt-3">
						<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-1">
							<div className="flex items-center gap-2 font-medium text-foreground">
								<ShieldCheck className="h-4 w-4 text-emerald-500" />
								<span>Direct Read-Only Exchange Integration</span>
							</div>
							<p className="text-muted-foreground leading-relaxed">
								Generate an API key in your account security settings. Only enable
								<strong className="text-foreground"> "Query Funds"</strong> and
								<strong className="text-foreground"> "Query Closed Orders & Trades"</strong>. Never
								enable withdrawal or trading permissions.
							</p>
						</div>

						<form onSubmit={handleConnectKraken} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="kraken-key">API Key *</Label>
								<div className="relative">
									<Input
										id="kraken-key"
										placeholder="e.g. abcd1234efgh5678..."
										value={krakenApiKey}
										onChange={(e) => setKrakenApiKey(e.target.value)}
										required
										autoFocus
									/>
									<Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="kraken-secret">Private Key (Secret) *</Label>
								<div className="relative">
									<Input
										id="kraken-secret"
										type={showSecret ? "text" : "password"}
										placeholder="Enter API Private Key"
										value={krakenApiSecret}
										onChange={(e) => setKrakenApiSecret(e.target.value)}
										required
									/>
									<button
										type="button"
										onClick={() => setShowSecret((v) => !v)}
										className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
										aria-label={showSecret ? "Hide secret" : "Show secret"}
									>
										{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
							</div>

							{/* Account Mapping Option */}
							<div className="space-y-3 pt-2 border-t">
								<Label className="text-sm font-medium">Account Mapping</Label>
								<RadioGroup
									value={mappingMode}
									onValueChange={(v) => setMappingMode(v as typeof mappingMode)}
									className="gap-2"
								>
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="auto" id="kraken-map-auto" />
										<Label htmlFor="kraken-map-auto" className="cursor-pointer text-xs sm:text-sm">
											Auto-create a dedicated exchange account in this portfolio
										</Label>
									</div>
									{accounts.length > 0 && (
										<div className="flex items-center space-x-2">
											<RadioGroupItem value="existing" id="kraken-map-existing" />
											<Label
												htmlFor="kraken-map-existing"
												className="cursor-pointer text-xs sm:text-sm"
											>
												Link to an existing account
											</Label>
										</div>
									)}
								</RadioGroup>

								{mappingMode === "existing" && accounts.length > 0 && (
									<div className="pt-1">
										<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
											<SelectTrigger>
												<SelectValue placeholder="Select existing account" />
											</SelectTrigger>
											<SelectContent>
												{accounts.map((acc) => (
													<SelectItem key={acc.id} value={acc.id}>
														{acc.name} ({acc.type})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>

							<DialogFooter className="pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => onOpenChange(false)}
									disabled={isBusy}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isBusy || !krakenApiKey || !krakenApiSecret}>
									{registeringKraken || creatingAccount ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Connecting...
										</>
									) : (
										<>
											Connect Account
											<ArrowRight className="ml-2 h-4 w-4" />
										</>
									)}
								</Button>
							</DialogFooter>
						</form>
					</TabsContent>

					{/* 2. SNAPTRADE TAB (Trade Republic, IBKR, etc.) */}
					<TabsContent value="snaptrade" className="space-y-4 pt-3">
						<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-2">
							<div className="flex items-center gap-2 font-medium text-foreground">
								<Building2 className="h-4 w-4 text-primary" />
								<span>Retail Brokerages & Stock Accounts</span>
							</div>
							<p className="text-muted-foreground leading-relaxed">
								Connect Interactive Brokers, Robinhood, Degiro, Charles Schwab, and 100+ stock
								brokerages securely via SnapTrade Open Brokerage API.
							</p>
							<div className="flex flex-wrap gap-1.5 pt-1">
								<Badge variant="secondary">Interactive Brokers</Badge>
								<Badge variant="secondary">Degiro</Badge>
								<Badge variant="secondary">Robinhood</Badge>
							</div>
						</div>

						<div className="space-y-3 pt-2 border-t">
							<Label className="text-sm font-medium">Account Mapping</Label>
							<RadioGroup
								value={mappingMode}
								onValueChange={(v) => setMappingMode(v as typeof mappingMode)}
								className="gap-2"
							>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="auto" id="snap-map-auto" />
									<Label htmlFor="snap-map-auto" className="cursor-pointer text-xs sm:text-sm">
										Auto-create accounts discovered from the brokerage connection
									</Label>
								</div>
								{accounts.length > 0 && (
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="existing" id="snap-map-existing" />
										<Label
											htmlFor="snap-map-existing"
											className="cursor-pointer text-xs sm:text-sm"
										>
											Link to existing account in portfolio
										</Label>
									</div>
								)}
							</RadioGroup>

							{mappingMode === "existing" && accounts.length > 0 && (
								<div className="pt-1">
									<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
										<SelectTrigger>
											<SelectValue placeholder="Select existing account" />
										</SelectTrigger>
										<SelectContent>
											{accounts.map((acc) => (
												<SelectItem key={acc.id} value={acc.id}>
													{acc.name} ({acc.type})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						<DialogFooter className="pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isBusy}
							>
								Cancel
							</Button>
							<Button type="button" onClick={handleConnectSnapTrade} disabled={isBusy}>
								{generatingLink ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Generating Portal...
									</>
								) : (
									<>
										Connect via SnapTrade
										<ExternalLink className="ml-2 h-4 w-4" />
									</>
								)}
							</Button>
						</DialogFooter>
					</TabsContent>

					{/* 3. GOCARDLESS TAB (European Banks) */}
					<TabsContent value="gocardless" className="space-y-4 pt-3">
						<div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm space-y-2">
							<div className="flex items-center gap-2 font-medium text-foreground">
								<Landmark className="h-4 w-4 text-emerald-500" />
								<span>Open Banking (PSD2)</span>
							</div>
							<p className="text-muted-foreground leading-relaxed">
								Connect over 2,500+ financial institutions in 31 countries via GoCardless (formerly
								Nordigen) PSD2 Open Banking. Sync checking, savings, and deposit accounts with
								read-only bank consent.
							</p>
							<div className="flex flex-wrap gap-1.5 pt-1">
								<Badge variant="secondary">BNP Paribas</Badge>
								<Badge variant="secondary">Crédit Agricole</Badge>
								<Badge variant="secondary">Revolut</Badge>
								<Badge variant="secondary">N26</Badge>
								<Badge variant="secondary">Fortuneo</Badge>
								<Badge variant="secondary">Boursorama</Badge>
							</div>
						</div>

						<div className="space-y-3 pt-2 border-t">
							<Label className="text-sm font-medium">Account Mapping</Label>
							<RadioGroup
								value={mappingMode}
								onValueChange={(v) => setMappingMode(v as typeof mappingMode)}
								className="gap-2"
							>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="auto" id="gc-map-auto" />
									<Label htmlFor="gc-map-auto" className="cursor-pointer text-xs sm:text-sm">
										Auto-create bank accounts discovered during authentication
									</Label>
								</div>
								{accounts.length > 0 && (
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="existing" id="gc-map-existing" />
										<Label htmlFor="gc-map-existing" className="cursor-pointer text-xs sm:text-sm">
											Link to existing account in portfolio
										</Label>
									</div>
								)}
							</RadioGroup>

							{mappingMode === "existing" && accounts.length > 0 && (
								<div className="pt-1">
									<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
										<SelectTrigger>
											<SelectValue placeholder="Select existing account" />
										</SelectTrigger>
										<SelectContent>
											{accounts.map((acc) => (
												<SelectItem key={acc.id} value={acc.id}>
													{acc.name} ({acc.type})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						<DialogFooter className="pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isBusy}
							>
								Cancel
							</Button>
							<Button type="button" onClick={handleConnectGoCardless} disabled={isBusy}>
								{generatingLink ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Opening Gateway...
									</>
								) : (
									<>
										Connect via Open Banking
										<ExternalLink className="ml-2 h-4 w-4" />
									</>
								)}
							</Button>
						</DialogFooter>
					</TabsContent>
				</Tabs>
				)}
			</DialogContent>
		</Dialog>
	);
}
