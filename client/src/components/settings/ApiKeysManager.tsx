import { useMutation, useQuery } from "@apollo/client";
import {
	Activity,
	AlertCircle,
	CheckCircle2,
	Cpu,
	ExternalLink,
	Eye,
	EyeOff,
	KeyRound,
	Link2,
	Loader2,
	RefreshCw,
	ShieldCheck,
	Trash2,
	Upload,
	Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	DELETE_MARKET_DATA_CREDENTIAL,
	UPSERT_MARKET_DATA_CREDENTIAL,
	VALIDATE_PROVIDER_CREDENTIALS,
} from "@/graphql/mutations/market-data";
import { REGISTER_SYNC_CREDENTIAL } from "@/graphql/mutations/sync";
import { CONFIGURE_ALCHEMY_KEY } from "@/graphql/mutations/wallets";
import { GET_MARKET_DATA_SETTINGS } from "@/graphql/queries/market-data";
import { GET_SYNC_CREDENTIALS } from "@/graphql/queries/sync";
import { GET_WALLET_CU_USAGE } from "@/graphql/queries/wallets";

interface MarketDataCredential {
	id: string;
	provider: string;
	isEnabled: boolean;
	priority: number;
	source?: string | null;
	lastValidatedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

interface SupportedProvider {
	id: string;
	name: string;
	type: string;
	requiresKey: boolean;
	intervals: string[];
	rateLimit: {
		requestsPerMinute: number;
		requestsPerDay: number;
		burstLimit: number;
	};
	supportsRealtime: boolean;
}

interface ProviderHealth {
	provider: string;
	assetType: string;
	healthy: boolean;
	apiKeyValid?: boolean | null;
	lastChecked: string;
}

interface MarketDataSettingsData {
	marketDataCredentials: MarketDataCredential[];
	supportedProviders: SupportedProvider[];
	providerHealth: ProviderHealth[];
}

interface SyncCredentialItem {
	id: string;
	provider: string;
	status: string;
	source?: string | null;
	createdAt: string;
	updatedAt: string;
}

interface SyncCredentialsData {
	syncCredentials: SyncCredentialItem[];
}

interface CUUsageData {
	walletCUUsage?: {
		billingMonth: string;
		consumedUnits: number;
		maxQuota: number;
		isThrottled: boolean;
		hasKey: boolean;
		keySource?: string | null;
		maskedKey?: string | null;
	};
}

const PROVIDER_METADATA: Record<
	string,
	{
		name: string;
		description: string;
		signupUrl: string;
		freeTier: string;
		category: "market-data" | "web3" | "sync";
	}
> = {
	TIINGO: {
		name: "Tiingo",
		description: "High-frequency stock, ETF, mutual fund, and forex prices.",
		signupUrl: "https://www.tiingo.com/account/api/token",
		freeTier: "500 requests/hour, 50 symbols",
		category: "market-data",
	},
	FINNHUB: {
		name: "Finnhub",
		description: "Real-time institutional stock quotes, fundamentals, and financials.",
		signupUrl: "https://finnhub.io/dashboard",
		freeTier: "60 requests/minute",
		category: "market-data",
	},
	ALPHAVANTAGE: {
		name: "Alpha Vantage",
		description: "Historical candlestick series, technical indicators, and FX rates.",
		signupUrl: "https://www.alphavantage.co/support/#api-key",
		freeTier: "25 requests/day",
		category: "market-data",
	},
	COINGECKO: {
		name: "CoinGecko",
		description: "Global cryptocurrency prices, token metadata, and volume stats.",
		signupUrl: "https://www.coingecko.com/en/api",
		freeTier: "30 calls/minute (Demo key optional)",
		category: "market-data",
	},
	ALCHEMY: {
		name: "Alchemy",
		description: "Multi-chain RPC node powering EVM, Solana, and Bitcoin scanning.",
		signupUrl: "https://dashboard.alchemy.com/",
		freeTier: "30,000,000 Compute Units / month (Free)",
		category: "web3",
	},
	KRAKEN: {
		name: "Kraken Exchange",
		description: "Direct read-only API sync for spot balances, trades, and ledgers.",
		signupUrl: "https://www.kraken.com/u/security/api",
		freeTier: "Standard Kraken account with Query Funds permissions",
		category: "sync",
	},
};

export function ApiKeysManager() {
	const [activeTab, setActiveTab] = useState("all");

	// Market Data credentials query
	const { data: mdData, refetch: refetchMd } = useQuery<MarketDataSettingsData>(
		GET_MARKET_DATA_SETTINGS,
		{
			variables: { assetType: null },
			fetchPolicy: "cache-and-network",
		},
	);

	// Sync credentials query (Kraken, etc.)
	const { data: syncData, refetch: refetchSync } = useQuery<SyncCredentialsData>(
		GET_SYNC_CREDENTIALS,
		{
			fetchPolicy: "cache-and-network",
		},
	);

	// Alchemy CU quota query
	const { data: cuData, refetch: refetchCU } = useQuery<CUUsageData>(GET_WALLET_CU_USAGE, {
		fetchPolicy: "cache-and-network",
	});

	// Market data mutations
	const [upsertCredential, { loading: savingMd }] = useMutation(UPSERT_MARKET_DATA_CREDENTIAL, {
		onCompleted: () => {
			void refetchMd();
		},
	});
	const [deleteCredential, { loading: deletingMd }] = useMutation(DELETE_MARKET_DATA_CREDENTIAL, {
		onCompleted: () => {
			void refetchMd();
		},
	});
	const [validateCredential, { loading: validatingMd }] = useMutation(
		VALIDATE_PROVIDER_CREDENTIALS,
	);

	// Alchemy mutation
	const [configureAlchemyKey, { loading: savingAlchemy }] = useMutation(CONFIGURE_ALCHEMY_KEY, {
		onCompleted: () => {
			void refetchCU();
		},
	});

	// Sync mutation (Kraken)
	const [registerSyncCredential, { loading: savingSync }] = useMutation(REGISTER_SYNC_CREDENTIAL, {
		onCompleted: () => {
			void refetchSync();
		},
	});

	// Form states
	const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
	const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
	const [validationStates, setValidationStates] = useState<
		Record<string, { valid?: boolean; message?: string; testing?: boolean }>
	>({});
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	// Kraken sync form state
	const [krakenKey, setKrakenKey] = useState("");
	const [krakenSecret, setKrakenSecret] = useState("");
	const [showKrakenSecret, setShowKrakenSecret] = useState(false);

	// Enable Banking sync form state
	const [enableBankingAppId, setEnableBankingAppId] = useState("");
	const [enableBankingPrivateKey, setEnableBankingPrivateKey] = useState("");
	const [showEnableBankingPrivateKey, setShowEnableBankingPrivateKey] = useState(false);
	const ebFileInputRef = useRef<HTMLInputElement>(null);

	const handleEbKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			if (text) {
				setEnableBankingPrivateKey(text.trim());
				toast.success(`Clé privée chargée depuis "${file.name}"`);
			}
		};
		reader.readAsText(file);
	};

	// Alchemy key form state
	const [alchemyKeyInput, setAlchemyKeyInput] = useState("");
	const [showAlchemyKey, setShowAlchemyKey] = useState(false);

	const toggleReveal = (provider: string) => {
		setRevealedKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
	};

	// Handlers
	const handleSaveMarketDataKey = async (provider: string, priority = 100, isEnabled = true) => {
		const key = keyInputs[provider]?.trim();
		if (!key) {
			toast.error(`Please enter a valid API key for ${provider}`);
			return;
		}

		try {
			await upsertCredential({
				variables: {
					provider,
					apiKey: key,
					priority,
					isEnabled,
				},
			});
			toast.success(`API key for ${provider} saved securely (encrypted)`);
			setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to save API key";
			toast.error(msg);
		}
	};

	const handleValidateMarketDataKey = async (provider: string) => {
		const key = keyInputs[provider]?.trim();
		if (!key) {
			toast.error(`Enter an API key first to validate ${provider}`);
			return;
		}

		setValidationStates((prev) => ({
			...prev,
			[provider]: { testing: true },
		}));

		try {
			const res = await validateCredential({
				variables: { provider, apiKey: key },
			});
			const valid = res.data?.validateProviderCredentials?.valid ?? false;
			const message = res.data?.validateProviderCredentials?.message ?? undefined;

			setValidationStates((prev) => ({
				...prev,
				[provider]: { valid, message, testing: false },
			}));

			if (valid) {
				toast.success(`${provider} API key is verified and operational!`);
			} else {
				toast.error(`${provider} API key validation failed: ${message || "Invalid credentials"}`);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Validation request failed";
			setValidationStates((prev) => ({
				...prev,
				[provider]: { valid: false, message: msg, testing: false },
			}));
			toast.error(msg);
		}
	};

	const handleDeleteMarketDataKey = async (provider: string) => {
		try {
			await deleteCredential({ variables: { provider } });
			toast.success(`${provider} credential removed`);
			setDeleteConfirm(null);
			setKeyInputs((prev) => {
				const next = { ...prev };
				delete next[provider];
				return next;
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to delete API key";
			toast.error(msg);
		}
	};

	const handleSaveAlchemyKey = async () => {
		const trimmed = alchemyKeyInput.trim();
		if (!trimmed) {
			toast.error("Please enter an Alchemy API key");
			return;
		}

		try {
			await configureAlchemyKey({
				variables: { apiKey: trimmed },
			});
			toast.success("Alchemy API key successfully configured and activated");
			setAlchemyKeyInput("");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to configure Alchemy key";
			toast.error(msg);
		}
	};

	const handleRegisterKraken = async () => {
		const key = krakenKey.trim();
		const secret = krakenSecret.trim();
		if (!key || !secret) {
			toast.error("Please provide both Kraken API Key and API Secret");
			return;
		}

		try {
			await registerSyncCredential({
				variables: {
					provider: "KRAKEN",
					credentials: {
						apiKey: key,
						apiSecret: secret,
					},
				},
			});
			toast.success("Kraken sync credentials securely registered!");
			setKrakenKey("");
			setKrakenSecret("");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to register Kraken credentials";
			toast.error(msg);
		}
	};

	const handleRegisterEnableBanking = async () => {
		const appId = enableBankingAppId.trim();
		const privKey = enableBankingPrivateKey.trim();
		if (!appId || !privKey) {
			toast.error("Please provide both Enable Banking Application ID and RSA Private Key");
			return;
		}

		try {
			await registerSyncCredential({
				variables: {
					provider: "ENABLEBANKING",
					credentials: {
						application_id: appId,
						applicationId: appId,
						private_key: privKey,
						privateKey: privKey,
					},
				},
			});
			toast.success("Enable Banking credentials securely registered!");
			setEnableBankingAppId("");
			setEnableBankingPrivateKey("");
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Failed to register Enable Banking credentials";
			toast.error(msg);
		}
	};

	// Metrics calculations
	const configuredMdCount = useMemo(() => {
		return mdData?.marketDataCredentials?.length ?? 0;
	}, [mdData?.marketDataCredentials]);

	const krakenCred = useMemo(() => {
		return syncData?.syncCredentials?.find((c) => c.provider.toUpperCase() === "KRAKEN");
	}, [syncData?.syncCredentials]);

	const isKrakenConfigured = Boolean(krakenCred);

	const enableBankingCred = useMemo(() => {
		return syncData?.syncCredentials?.find((c) => c.provider.toUpperCase() === "ENABLEBANKING");
	}, [syncData?.syncCredentials]);

	const isEnableBankingConfigured = Boolean(enableBankingCred);

	const cuUsage = cuData?.walletCUUsage;
	const cuConsumed = cuUsage?.consumedUnits ?? 0;
	const cuMax = cuUsage?.maxQuota ?? 30_000_000;
	const cuPct = cuMax > 0 ? Math.min(100, Math.round((cuConsumed / cuMax) * 100)) : 0;
	const isCUThrottled = cuUsage?.isThrottled ?? false;

	const formatCU = (n: number) => {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
		return n.toLocaleString();
	};

	const marketProviders = useMemo(() => {
		const raw = mdData?.supportedProviders?.filter((p) => p.requiresKey) ?? [];
		if (raw.length > 0) return raw;
		return [
			{ id: "TIINGO", name: "Tiingo", requiresKey: true },
			{ id: "FINNHUB", name: "Finnhub", requiresKey: true },
			{ id: "ALPHAVANTAGE", name: "Alpha Vantage", requiresKey: true },
			{ id: "COINGECKO", name: "CoinGecko", requiresKey: true },
		];
	}, [mdData?.supportedProviders]);

	const isAlchemyConfigured = cuUsage?.hasKey ?? false;
	const totalConfigured =
		configuredMdCount +
		(isKrakenConfigured ? 1 : 0) +
		(isAlchemyConfigured ? 1 : 0) +
		(isEnableBankingConfigured ? 1 : 0);

	// Render Category 1: Market Data Feeds
	const renderMarketDataSection = () => (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold tracking-tight">Market Data Feeds</h2>
					<p className="text-xs text-muted-foreground">
						Configure custom keys to increase rate limits and unlock real-time streaming prices.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{marketProviders.map((provider) => {
					const existing = mdData?.marketDataCredentials?.find(
						(c) => c.provider.toUpperCase() === provider.id.toUpperCase(),
					);
					const isConfigured = Boolean(existing);
					const isEnv = existing?.source === "ENV";
					const isEnabled = existing?.isEnabled ?? true;
					const priority = existing?.priority ?? 100;
					const meta = PROVIDER_METADATA[provider.id.toUpperCase()] ?? {
						name: provider.name,
						description: "Financial market data provider",
						signupUrl: "#",
						freeTier: "Standard rate limits",
					};
					const valState = validationStates[provider.id];
					const isRevealed = revealedKeys[provider.id] ?? false;

					return (
						<Card
							key={provider.id}
							className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs transition-colors hover:border-border/80 flex flex-col justify-between overflow-hidden"
						>
							<CardHeader className="pb-3 pt-5 px-5">
								<div className="flex items-start justify-between gap-2">
									<div>
										<div className="flex items-center gap-2">
											<CardTitle className="text-sm font-semibold tracking-tight text-foreground">
												{meta.name}
											</CardTitle>
											{isConfigured ? (
												isEnv ? (
													<Badge
														variant="outline"
														className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[11px] gap-1.5"
													>
														<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
														Configured (Env)
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] gap-1.5"
													>
														<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
														Configured (Database)
													</Badge>
												)
											) : (
												<Badge
													variant="outline"
													className="border-border/60 bg-muted/20 text-muted-foreground font-mono text-[11px]"
												>
													Not Configured
												</Badge>
											)}
										</div>
										<CardDescription className="text-xs text-muted-foreground mt-1">
											{meta.description}
										</CardDescription>
									</div>
									<a
										href={meta.signupUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
									>
										Obtenir <ExternalLink className="h-3 w-3" />
									</a>
								</div>
							</CardHeader>

							<CardContent className="space-y-3.5 pb-4 px-5">
								<div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/15 px-3 py-1.5 rounded-lg border border-border/30 font-mono">
									<span>Quota gratuit :</span>
									<span className="font-semibold text-foreground">{meta.freeTier}</span>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor={`key-${provider.id}`} className="text-xs text-muted-foreground">
										Clé API
									</Label>
									<div className="relative">
										<Input
											id={`key-${provider.id}`}
											type={isRevealed ? "text" : "password"}
											placeholder={
												isConfigured
													? isEnv
														? "•••••••••••••••• (Chargée depuis .env)"
														: "••••••••••••••••••••••••"
													: `Enter ${meta.name} API Key`
											}
											value={keyInputs[provider.id] ?? ""}
											onChange={(e) =>
												setKeyInputs((prev) => ({
													...prev,
													[provider.id]: e.target.value,
												}))
											}
											className="h-9 pr-10 font-mono text-xs border-border/60 bg-background/50 focus-visible:ring-primary/20"
										/>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											aria-label={`Toggle ${provider.id} key visibility`}
											data-testid={`toggle-reveal-${provider.id}`}
											className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent"
											onClick={() => toggleReveal(provider.id)}
										>
											{isRevealed ? (
												<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
											) : (
												<Eye className="h-3.5 w-3.5 text-muted-foreground" />
											)}
										</Button>
									</div>
								</div>

								{/* Validation result feedback alert */}
								{valState?.valid !== undefined && (
									<Alert
										variant={valState.valid ? "default" : "destructive"}
										className={cn(
											"py-2 text-xs rounded-lg",
											valState.valid
												? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
												: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
										)}
									>
										<div className="flex items-center gap-1.5">
											{valState.valid ? (
												<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
											) : (
												<AlertCircle className="h-3.5 w-3.5 text-rose-500" />
											)}
											<AlertDescription className="text-xs">
												{valState.valid
													? "Valid API key: Connection successfully established."
													: valState.message || "Invalid API key."}
											</AlertDescription>
										</div>
									</Alert>
								)}
							</CardContent>

							<CardFooter className="pt-3 pb-3 px-5 flex items-center justify-between border-t border-border/30 bg-muted/10">
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										className="h-8 text-xs border-border/60"
										onClick={() => handleValidateMarketDataKey(provider.id)}
										disabled={
											valState?.testing ||
											validatingMd ||
											!(keyInputs[provider.id]?.trim() || isConfigured)
										}
									>
										{valState?.testing ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
										) : null}
										Test Key
									</Button>
									<Button
										size="sm"
										className="h-8 text-xs font-medium"
										onClick={() => handleSaveMarketDataKey(provider.id, priority, isEnabled)}
										disabled={savingMd || !keyInputs[provider.id]?.trim()}
									>
										{savingMd ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
										Enregistrer
									</Button>
								</div>

								{isConfigured && (
									<div>
										{deleteConfirm === provider.id ? (
											<div className="flex items-center gap-1">
												<Button
													variant="destructive"
													size="sm"
													className="h-8 text-xs"
													onClick={() => handleDeleteMarketDataKey(provider.id)}
													disabled={deletingMd}
												>
													Confirmer
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 text-xs"
													onClick={() => setDeleteConfirm(null)}
												>
													Annuler
												</Button>
											</div>
										) : (
											<Button
												variant="ghost"
												size="sm"
												className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
												onClick={() => setDeleteConfirm(provider.id)}
											>
												<Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
											</Button>
										)}
									</div>
								)}
							</CardFooter>
						</Card>
					);
				})}
			</div>
		</div>
	);

	// Render Category 2: Web3 Alchemy
	const renderWeb3Section = () => (
		<div className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Web3 & Blockchain Infrastructure</h2>
				<p className="text-xs text-muted-foreground">
					Single-key architecture connecting 7 networks (Ethereum, Solana, Bitcoin, Arbitrum, Base,
					Optimism, Polygon).
				</p>
			</div>

			<Card className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<CardHeader className="pt-5 px-5 pb-3">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
						<div>
							<div className="flex items-center gap-2">
								<CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
									<Cpu className="h-4 w-4 text-primary" /> Alchemy API & Compute Unit Meter
								</CardTitle>
								{cuUsage?.keySource === "ENV" ? (
									<Badge
										variant="outline"
										className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[11px] gap-1.5"
									>
										<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
										Configured (Env)
									</Badge>
								) : cuUsage?.keySource === "DATABASE" ? (
									<Badge
										variant="outline"
										className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] gap-1.5"
									>
										<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
										Configured (Database)
									</Badge>
								) : (
									<Badge
										variant="outline"
										className="border-border/60 bg-muted/20 text-muted-foreground font-mono text-[11px]"
									>
										Not Configured
									</Badge>
								)}
							</div>
							<CardDescription className="text-xs text-muted-foreground mt-1">
								Alimente la découverte des jetons on-chain, les soldes natifs et les flux RPC multi-chaînes sans frais d'abonnement.
							</CardDescription>
						</div>
						<a
							href="https://dashboard.alchemy.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
						>
							Console Alchemy <ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</CardHeader>
				<CardContent className="space-y-5 px-5 pb-5">
					<div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2.5">
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium flex items-center gap-1.5 text-foreground">
								<Zap className="h-3.5 w-3.5 text-amber-500" /> Quota Mensuel (Compute Units)
							</span>
							<span className="font-mono font-semibold text-foreground tabular-nums">
								{formatCU(cuConsumed)} / {formatCU(cuMax)} CUs ({cuPct}%)
							</span>
						</div>
						<Progress value={cuPct} className="h-2 bg-muted/40" />
						<div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
							<span>0 CUs</span>
							<span className="text-amber-500/90 font-medium">
								Seuil souple 80% ({formatCU(cuMax * 0.8)})
							</span>
							<span>{formatCU(cuMax)} (Plafond gratuit)</span>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
						<div className="md:col-span-2 space-y-1.5">
							<Label htmlFor="alchemy-key-input" className="text-xs text-muted-foreground">
								Mettre à jour la clé API Alchemy
							</Label>
							<div className="relative">
								<Input
									id="alchemy-key-input"
									type={showAlchemyKey ? "text" : "password"}
									placeholder={
										cuUsage?.maskedKey
											? cuUsage.maskedKey
											: cuUsage?.hasKey
												? "••••••••••••••••••••••••••••••••"
												: "Saisir la clé API Alchemy (ex: alch_...)"
									}
									value={alchemyKeyInput}
									onChange={(e) => setAlchemyKeyInput(e.target.value)}
									className="h-9 pr-10 font-mono text-xs border-border/60 bg-background/50 focus-visible:ring-primary/20"
								/>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Toggle Alchemy key visibility"
									data-testid="toggle-reveal-alchemy"
									className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent"
									onClick={() => setShowAlchemyKey(!showAlchemyKey)}
								>
									{showAlchemyKey ? (
										<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
									) : (
										<Eye className="h-3.5 w-3.5 text-muted-foreground" />
									)}
								</Button>
							</div>
							{cuUsage?.keySource === "ENV" && (
								<p className="text-[11px] text-muted-foreground mt-1">
									Active via variable d'environnement (.env). Vous pouvez enregistrer une clé personnalisée pour surcharger le défaut.
								</p>
							)}
							{cuUsage?.keySource === "DATABASE" && (
								<p className="text-[11px] text-muted-foreground mt-1">
									Active et chiffrée de manière sécurisée en base de données.
								</p>
							)}
						</div>
						<Button
							size="sm"
							onClick={handleSaveAlchemyKey}
							disabled={savingAlchemy || !alchemyKeyInput.trim()}
							className="h-9 text-xs font-medium w-full md:w-auto"
						>
							{savingAlchemy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
							Enregistrer la clé Alchemy
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);

	// Render Category 3: Exchange Sync
	const renderSyncSection = () => (
		<div className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Exchange & Account Sync</h2>
				<p className="text-xs text-muted-foreground">
					Direct institution API credentials for automated portfolio syncing.
				</p>
			</div>

			<Card className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<CardHeader className="pt-5 px-5 pb-3">
					<div className="flex items-start justify-between gap-2">
						<div>
							<div className="flex items-center gap-2">
								<CardTitle className="text-sm font-semibold tracking-tight text-foreground">
									Kraken Direct API Key
								</CardTitle>
								{isKrakenConfigured ? (
									krakenCred?.source === "ENV" ? (
										<Badge
											variant="outline"
											className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[11px] gap-1.5"
										>
											<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
											Configured (Env)
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] gap-1.5"
										>
											<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
											Active
										</Badge>
									)
								) : (
									<Badge
										variant="outline"
										className="border-border/60 bg-muted/20 text-muted-foreground font-mono text-[11px]"
									>
										Not Configured
									</Badge>
								)}
							</div>
							<CardDescription className="text-xs text-muted-foreground mt-1">
								Synchronise les soldes spot, ordres et positions de staking sans intermédiaire.
							</CardDescription>
						</div>
						<a
							href="https://www.kraken.com/u/security/api"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
						>
							Sécurité Kraken <ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</CardHeader>
				<CardContent className="space-y-4 px-5 pb-5">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="kraken-key" className="text-xs text-muted-foreground">
								Kraken API Key *
							</Label>
							<Input
								id="kraken-key"
								placeholder={
									isKrakenConfigured
										? krakenCred?.source === "ENV"
											? "•••••••••••••••• (Chargée depuis .env)"
											: "••••••••••••••••••••••••"
										: "Enter API Key"
								}
								value={krakenKey}
								onChange={(e) => setKrakenKey(e.target.value)}
								className="h-9 font-mono text-xs border-border/60 bg-background/50 focus-visible:ring-primary/20"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="kraken-secret" className="text-xs text-muted-foreground">
								Kraken API Secret *
							</Label>
							<div className="relative">
								<Input
									id="kraken-secret"
									type={showKrakenSecret ? "text" : "password"}
									placeholder={
										isKrakenConfigured
											? krakenCred?.source === "ENV"
												? "•••••••••••••••• (Chargée depuis .env)"
												: "••••••••••••••••••••••••"
											: "Enter Private Key / Secret"
									}
									value={krakenSecret}
									onChange={(e) => setKrakenSecret(e.target.value)}
									className="h-9 pr-10 font-mono text-xs border-border/60 bg-background/50 focus-visible:ring-primary/20"
								/>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Toggle Kraken secret visibility"
									data-testid="toggle-reveal-kraken"
									className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent"
									onClick={() => setShowKrakenSecret(!showKrakenSecret)}
								>
									{showKrakenSecret ? (
										<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
									) : (
										<Eye className="h-3.5 w-3.5 text-muted-foreground" />
									)}
								</Button>
							</div>
						</div>
					</div>
					<div className="flex justify-end pt-1">
						<Button
							size="sm"
							className="h-8 text-xs font-medium"
							onClick={handleRegisterKraken}
							disabled={savingSync || !krakenKey.trim() || !krakenSecret.trim()}
						>
							{savingSync ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
							Save Kraken Credentials
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Enable Banking PSD2 Open Banking */}
			<Card className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<CardHeader className="pt-5 px-5 pb-3">
					<div className="flex items-start justify-between gap-2">
						<div>
							<div className="flex items-center gap-2">
								<CardTitle className="text-sm font-semibold tracking-tight text-foreground">
									Enable Banking (European Open Banking)
								</CardTitle>
								{isEnableBankingConfigured ? (
									enableBankingCred?.source === "ENV" ? (
										<Badge
											variant="outline"
											className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[11px] gap-1.5"
										>
											<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
											Configured (Env)
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] gap-1.5"
										>
											<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
											Active
										</Badge>
									)
								) : (
									<Badge
										variant="outline"
										className="border-border/60 bg-muted/20 text-muted-foreground font-mono text-[11px]"
									>
										Not Configured
									</Badge>
								)}
							</div>
							<CardDescription className="text-xs text-muted-foreground mt-1">
								Connecte les comptes bancaires (France, Luxembourg, Allemagne, Belgique...) via PSD2 AIS (gratuit pour usage personnel).
							</CardDescription>
						</div>
						<a
							href="https://enablebanking.com/cp/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
						>
							Panneau Enable Banking <ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</CardHeader>
				<CardContent className="space-y-4 px-5 pb-5">
					<div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
						<p className="font-semibold text-foreground">Configuration en 2 étapes simples :</p>
						<ol className="list-decimal list-inside space-y-1">
							<li>
								Sur le{" "}
								<a
									href="https://enablebanking.com/cp/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary underline font-medium"
								>
									Control Panel Enable Banking
								</a>
								, créez votre application avec l&apos;option par défaut <em>&quot;Generate in the browser&quot;</em>. Enable Banking télécharge automatiquement votre clé privée.
							</li>
							<li>
								Copiez l&apos;<strong>Application ID</strong> et chargez le fichier de clé privée téléchargé (ou collez son contenu) ci-dessous.
							</li>
						</ol>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="eb-app-id" className="text-xs text-muted-foreground">
								Enable Banking Application ID (UUID) *
							</Label>
							<Input
								id="eb-app-id"
								placeholder={
									isEnableBankingConfigured
										? enableBankingCred?.source === "ENV"
											? "•••••••••••••••• (Chargée depuis .env)"
											: "••••••••-••••-••••-••••-••••••••••••"
										: "e.g. b82877a5-4e78-43f1-b847-bb703b44b9b9"
								}
								value={enableBankingAppId}
								onChange={(e) => setEnableBankingAppId(e.target.value)}
								className="h-9 font-mono text-xs border-border/60 bg-background/50 focus-visible:ring-primary/20"
							/>
						</div>
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="eb-private-key" className="text-xs text-muted-foreground">
									RSA Private Key (PEM) *
								</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary"
									onClick={() => ebFileInputRef.current?.click()}
								>
									<Upload className="h-3 w-3" /> Importer fichier (.key / .pem)
								</Button>
								<input
									type="file"
									ref={ebFileInputRef}
									onChange={handleEbKeyFileUpload}
									accept=".key,.pem,.txt"
									className="hidden"
								/>
							</div>
							<div className="relative">
								<Input
									id="eb-private-key"
									type={showEnableBankingPrivateKey ? "text" : "password"}
									placeholder={
										isEnableBankingConfigured
											? enableBankingCred?.source === "ENV"
												? "•••••••••••••••• (Chargée depuis .env)"
												: "-----BEGIN PRIVATE KEY----- ••••••••"
											: "-----BEGIN PRIVATE KEY----- ... ou importer le fichier ci-dessus"
									}
									value={enableBankingPrivateKey}
									onChange={(e) => setEnableBankingPrivateKey(e.target.value)}
									className="h-9 pr-10 font-mono text-xs border-border/60 bg-background/50 focus-visible:ring-primary/20"
								/>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label="Toggle Enable Banking private key visibility"
									className="absolute right-0 top-0 h-full px-3 py-1 hover:bg-transparent"
									onClick={() => setShowEnableBankingPrivateKey(!showEnableBankingPrivateKey)}
								>
									{showEnableBankingPrivateKey ? (
										<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
									) : (
										<Eye className="h-3.5 w-3.5 text-muted-foreground" />
									)}
								</Button>
							</div>
						</div>
					</div>
					<div className="flex justify-end pt-1">
						<Button
							size="sm"
							className="h-8 text-xs font-medium"
							onClick={handleRegisterEnableBanking}
							disabled={savingSync || !enableBankingAppId.trim() || !enableBankingPrivateKey.trim()}
						>
							{savingSync ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
							Save Enable Banking Credentials
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
						<KeyRound className="h-7 w-7 text-primary" /> API Keys & Integrations
					</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Centrally configure, validate, and monitor third-party API credentials, rate limits, and
						Web3 quotas.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							void refetchMd();
							void refetchSync();
							void refetchCU();
							toast.info("Refreshed API credentials and provider statuses");
						}}
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh Status
					</Button>
				</div>
			</div>

			{/* KPI Summary Ribbon */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
					{/* Segment 1: Providers */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								<span className="h-1.5 w-1.5 rounded-full bg-primary" />
								Configured Providers
							</span>
							<ShieldCheck className="h-4 w-4 text-primary" />
						</div>
						<div className="mt-2">
							<span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
								{totalConfigured} / 6
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Encrypted at rest using AES-256-GCM
							</p>
						</div>
					</div>

					{/* Segment 2: Web3 Quota */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
								Alchemy Web3 CU Quota
							</span>
							<Zap className="h-4 w-4 text-amber-500" />
						</div>
						<div className="mt-2 space-y-1.5">
							<div className="flex items-center justify-between text-xs font-semibold tabular-nums">
								<span>
									{formatCU(cuConsumed)} / {formatCU(cuMax)}
								</span>
								<Badge variant={isCUThrottled ? "destructive" : "secondary"} className="text-[10px] py-0 px-1.5">
									{cuPct}% used
								</Badge>
							</div>
							<Progress value={cuPct} className="h-1.5" />
							<p className="text-[11px] text-muted-foreground">
								{cuUsage?.billingMonth
									? `Billing cycle: ${cuUsage.billingMonth}`
									: "Free tier: 30M CUs/month"}
							</p>
						</div>
					</div>

					{/* Segment 3: System Health */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								System Integration Health
							</span>
							<Activity className="h-4 w-4 text-emerald-500" />
						</div>
						<div className="mt-2">
							<div className="flex items-center gap-2">
								<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
								<span className="text-sm font-semibold text-foreground">Operational</span>
							</div>
							<p className="text-[11px] text-muted-foreground mt-1">
								Live market fallback: Yahoo Finance (free, zero-key)
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Main Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full h-auto p-1 bg-muted/20 border border-border/50 rounded-xl gap-1">
					<TabsTrigger
						value="all"
						onClick={() => setActiveTab("all")}
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-2"
					>
						<KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
						All Providers
					</TabsTrigger>
					<TabsTrigger
						value="market-data"
						onClick={() => setActiveTab("market-data")}
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-2"
					>
						<Activity className="h-3.5 w-3.5 text-muted-foreground" />
						Market Data Feeds
					</TabsTrigger>
					<TabsTrigger
						value="web3"
						onClick={() => setActiveTab("web3")}
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-2"
					>
						<Cpu className="h-3.5 w-3.5 text-muted-foreground" />
						Blockchain Node (Alchemy)
					</TabsTrigger>
					<TabsTrigger
						value="sync"
						onClick={() => setActiveTab("sync")}
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-2"
					>
						<Link2 className="h-3.5 w-3.5 text-muted-foreground" />
						Exchange & Bank Sync
					</TabsTrigger>
				</TabsList>

				{activeTab === "all" && (
					<TabsContent value="all" className="space-y-6">
						{renderMarketDataSection()}
						{renderWeb3Section()}
						{renderSyncSection()}
					</TabsContent>
				)}

				{activeTab === "market-data" && (
					<TabsContent value="market-data" className="space-y-4">
						{renderMarketDataSection()}
					</TabsContent>
				)}

				{activeTab === "web3" && (
					<TabsContent value="web3" className="space-y-4">
						{renderWeb3Section()}
					</TabsContent>
				)}

				{activeTab === "sync" && (
					<TabsContent value="sync" className="space-y-4">
						{renderSyncSection()}
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
