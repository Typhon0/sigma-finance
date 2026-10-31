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
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
	const {
		data: mdData,
		refetch: refetchMd,
	} = useQuery<MarketDataSettingsData>(GET_MARKET_DATA_SETTINGS, {
		variables: { assetType: null },
		fetchPolicy: "cache-and-network",
	});

	// Sync credentials query (Kraken, etc.)
	const {
		data: syncData,
		refetch: refetchSync,
	} = useQuery<SyncCredentialsData>(GET_SYNC_CREDENTIALS, {
		fetchPolicy: "cache-and-network",
	});

	// Alchemy CU quota query
	const {
		data: cuData,
		refetch: refetchCU,
	} = useQuery<CUUsageData>(GET_WALLET_CU_USAGE, {
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
	const [registerSyncCredential, { loading: savingSync }] = useMutation(
		REGISTER_SYNC_CREDENTIAL,
		{
			onCompleted: () => {
				void refetchSync();
			},
		},
	);

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

	// Metrics calculations
	const configuredMdCount = useMemo(() => {
		return mdData?.marketDataCredentials?.length ?? 0;
	}, [mdData?.marketDataCredentials]);

	const krakenCred = useMemo(() => {
		return syncData?.syncCredentials?.find((c) => c.provider.toUpperCase() === "KRAKEN");
	}, [syncData?.syncCredentials]);

	const isKrakenConfigured = Boolean(krakenCred);

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
	const totalConfigured = configuredMdCount + (isKrakenConfigured ? 1 : 0) + (isAlchemyConfigured ? 1 : 0);

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
						<Card key={provider.id} className="flex flex-col justify-between">
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between gap-2">
									<div>
										<div className="flex items-center gap-2">
											<CardTitle className="text-base font-semibold">{meta.name}</CardTitle>
											{isConfigured ? (
												isEnv ? (
													<Badge
														variant="outline"
														className="border-teal-500/50 bg-teal-500/10 text-teal-400 text-xs flex items-center gap-1"
													>
														<Cpu className="h-3 w-3" /> Configured (Env)
													</Badge>
												) : (
													<Badge
														variant="default"
														className="bg-green-600 hover:bg-green-600 text-xs flex items-center gap-1"
													>
														<CheckCircle2 className="h-3 w-3 mr-1" /> Configured (Database)
													</Badge>
												)
											) : (
												<Badge variant="secondary" className="text-xs">
													Not Configured
												</Badge>
											)}
										</div>
										<CardDescription className="text-xs mt-1">
											{meta.description}
										</CardDescription>
									</div>
									<a
										href={meta.signupUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
									>
										Get Key <ExternalLink className="h-3 w-3" />
									</a>
								</div>
							</CardHeader>

							<CardContent className="space-y-3 pb-3">
								<div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-md">
									<span>Free Tier Allowance:</span>
									<span className="font-mono font-medium text-foreground">{meta.freeTier}</span>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor={`key-${provider.id}`} className="text-xs">
										API Key
									</Label>
									<div className="relative">
										<Input
											id={`key-${provider.id}`}
											type={isRevealed ? "text" : "password"}
											placeholder={
												isConfigured
													? isEnv
														? "•••••••••••••••• (Loaded from .env)"
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
											className="pr-10 font-mono text-xs"
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
												<EyeOff className="h-4 w-4 text-muted-foreground" />
											) : (
												<Eye className="h-4 w-4 text-muted-foreground" />
											)}
										</Button>
									</div>
								</div>

								{/* Validation result feedback alert */}
								{valState?.valid !== undefined && (
									<Alert
										variant={valState.valid ? "default" : "destructive"}
										className={`py-2 text-xs ${valState.valid ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}`}
									>
										<div className="flex items-center gap-1.5">
											{valState.valid ? (
												<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
											) : (
												<AlertCircle className="h-3.5 w-3.5" />
											)}
											<AlertDescription>
												{valState.valid
													? "Valid API key: Connection successfully established."
													: valState.message || "Invalid API key."}
											</AlertDescription>
										</div>
									</Alert>
								)}
							</CardContent>

							<CardFooter className="pt-2 flex items-center justify-between border-t bg-muted/20">
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
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
										onClick={() =>
											handleSaveMarketDataKey(provider.id, priority, isEnabled)
										}
										disabled={savingMd || !keyInputs[provider.id]?.trim()}
									>
										{savingMd ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
										Save
									</Button>
								</div>

								{isConfigured && (
									<div>
										{deleteConfirm === provider.id ? (
											<div className="flex items-center gap-1">
												<Button
													variant="destructive"
													size="sm"
													onClick={() => handleDeleteMarketDataKey(provider.id)}
													disabled={deletingMd}
												>
													Confirm
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setDeleteConfirm(null)}
												>
													Cancel
												</Button>
											</div>
										) : (
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive hover:bg-destructive/10"
												onClick={() => setDeleteConfirm(provider.id)}
											>
												<Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
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
					Single-key architecture connecting 7 networks (Ethereum, Solana, Bitcoin, Arbitrum, Base, Optimism, Polygon).
				</p>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
						<div>
							<div className="flex items-center gap-2">
								<CardTitle className="text-base flex items-center gap-2">
									<Cpu className="h-4 w-4 text-primary" /> Alchemy API & Compute Unit Meter
								</CardTitle>
								{cuUsage?.keySource === "ENV" ? (
									<Badge
										variant="outline"
										className="border-teal-500/50 bg-teal-500/10 text-teal-400 text-xs flex items-center gap-1"
									>
										<Cpu className="h-3 w-3" /> Configured (Env)
									</Badge>
								) : cuUsage?.keySource === "DATABASE" ? (
									<Badge
										variant="default"
										className="bg-green-600 hover:bg-green-600 text-xs flex items-center gap-1"
									>
										<CheckCircle2 className="h-3 w-3 mr-1" /> Configured (Database)
									</Badge>
								) : (
									<Badge variant="secondary" className="text-xs">
										Not Configured
									</Badge>
								)}
							</div>
							<CardDescription className="text-xs mt-1">
								Powers on-chain token discovery, native balance scans, and UTXO transactions at zero subscription fees.
							</CardDescription>
						</div>
						<a
							href="https://dashboard.alchemy.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
						>
							Alchemy Console <ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="space-y-2 bg-muted/30 p-4 rounded-lg border">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium flex items-center gap-1.5">
								<Zap className="h-4 w-4 text-amber-500" /> Monthly Quota Consumption
							</span>
							<span className="font-mono font-semibold">
								{formatCU(cuConsumed)} / {formatCU(cuMax)} CUs ({cuPct}%)
							</span>
						</div>
						<Progress value={cuPct} className="h-2.5" />
						<div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
							<span>0 CUs</span>
							<span className="text-amber-600/90 font-medium">80% soft-throttle limit ({formatCU(cuMax * 0.8)})</span>
							<span>{formatCU(cuMax)} (Free Limit)</span>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
						<div className="md:col-span-2 space-y-1.5">
							<Label htmlFor="alchemy-key-input" className="text-xs">
								Update Alchemy API Key
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
												: "Enter Alchemy API Key (e.g. alch_...)"
									}
									value={alchemyKeyInput}
									onChange={(e) => setAlchemyKeyInput(e.target.value)}
									className="pr-10 font-mono text-xs"
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
										<EyeOff className="h-4 w-4 text-muted-foreground" />
									) : (
										<Eye className="h-4 w-4 text-muted-foreground" />
									)}
								</Button>
							</div>
							{cuUsage?.keySource === "ENV" && (
								<p className="text-[11px] text-muted-foreground mt-1">
									Currently active via environment variable. You can enter a custom key above to save it to the database and override the environment default.
								</p>
							)}
							{cuUsage?.keySource === "DATABASE" && (
								<p className="text-[11px] text-muted-foreground mt-1">
									Currently active via secure database credentials.
								</p>
							)}
						</div>
						<Button
							onClick={handleSaveAlchemyKey}
							disabled={savingAlchemy || !alchemyKeyInput.trim()}
							className="w-full md:w-auto"
						>
							{savingAlchemy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
							Save Alchemy Key
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

			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-2">
						<div>
							<div className="flex items-center gap-2">
								<CardTitle className="text-base">Kraken Direct API Key</CardTitle>
								{isKrakenConfigured ? (
									krakenCred?.source === "ENV" ? (
										<Badge
											variant="outline"
											className="border-teal-500/50 bg-teal-500/10 text-teal-400 text-xs flex items-center gap-1"
										>
											<Cpu className="h-3 w-3" /> Configured (Env)
										</Badge>
									) : (
										<Badge
											variant="default"
											className="bg-green-600 hover:bg-green-600 text-xs flex items-center gap-1"
										>
											<CheckCircle2 className="h-3 w-3 mr-1" /> Active
										</Badge>
									)
								) : (
									<Badge variant="secondary" className="text-xs">
										Not Configured
									</Badge>
								)}
							</div>
							<CardDescription className="text-xs mt-1">
								Syncs spot balances, trading positions, and staking ledgers directly without aggregators.
							</CardDescription>
						</div>
						<a
							href="https://www.kraken.com/u/security/api"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
						>
							Kraken Security <ExternalLink className="h-3 w-3" />
						</a>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="kraken-key" className="text-xs">
								Kraken API Key *
							</Label>
							<Input
								id="kraken-key"
								placeholder={
									isKrakenConfigured
										? krakenCred?.source === "ENV"
											? "•••••••••••••••• (Loaded from .env)"
											: "••••••••••••••••••••••••"
										: "Enter API Key"
								}
								value={krakenKey}
								onChange={(e) => setKrakenKey(e.target.value)}
								className="font-mono text-xs"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="kraken-secret" className="text-xs">
								Kraken API Secret *
							</Label>
							<div className="relative">
								<Input
									id="kraken-secret"
									type={showKrakenSecret ? "text" : "password"}
									placeholder={
										isKrakenConfigured
											? krakenCred?.source === "ENV"
												? "•••••••••••••••• (Loaded from .env)"
												: "••••••••••••••••••••••••"
											: "Enter Private Key / Secret"
									}
									value={krakenSecret}
									onChange={(e) => setKrakenSecret(e.target.value)}
									className="pr-10 font-mono text-xs"
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
										<EyeOff className="h-4 w-4 text-muted-foreground" />
									) : (
										<Eye className="h-4 w-4 text-muted-foreground" />
									)}
								</Button>
							</div>
						</div>
					</div>
					<div className="flex justify-end">
						<Button
							onClick={handleRegisterKraken}
							disabled={savingSync || !krakenKey.trim() || !krakenSecret.trim()}
						>
							{savingSync ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
							Save Kraken Credentials
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
						Centrally configure, validate, and monitor third-party API credentials, rate limits, and Web3 quotas.
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
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Configured Providers
						</CardTitle>
						<ShieldCheck className="h-4 w-4 text-primary" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalConfigured} / 6</div>
						<p className="text-xs text-muted-foreground mt-1">
							Encrypted at rest using AES-256-GCM
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Alchemy Web3 CU Quota
						</CardTitle>
						<Zap className="h-4 w-4 text-amber-500" />
					</CardHeader>
					<CardContent className="space-y-2">
						<div className="flex items-center justify-between text-sm font-semibold">
							<span>
								{formatCU(cuConsumed)} / {formatCU(cuMax)}
							</span>
							<Badge variant={isCUThrottled ? "destructive" : "secondary"}>
								{cuPct}% used
							</Badge>
						</div>
						<Progress value={cuPct} className="h-2" />
						<p className="text-[11px] text-muted-foreground">
							{cuUsage?.billingMonth ? `Billing cycle: ${cuUsage.billingMonth}` : "Free tier: 30M CUs/month"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							System Integration Health
						</CardTitle>
						<Activity className="h-4 w-4 text-green-500" />
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
							<span className="text-sm font-semibold text-foreground">Operational</span>
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Live market fallback: Yahoo Finance (free, zero-key)
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Main Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
				<TabsList>
					<TabsTrigger value="all" onClick={() => setActiveTab("all")}>
						<KeyRound className="h-4 w-4 mr-2" />
						All Providers
					</TabsTrigger>
					<TabsTrigger value="market-data" onClick={() => setActiveTab("market-data")}>
						<Activity className="h-4 w-4 mr-2" />
						Market Data Feeds
					</TabsTrigger>
					<TabsTrigger value="web3" onClick={() => setActiveTab("web3")}>
						<Cpu className="h-4 w-4 mr-2" />
						Blockchain Node (Alchemy)
					</TabsTrigger>
					<TabsTrigger value="sync" onClick={() => setActiveTab("sync")}>
						<Link2 className="h-4 w-4 mr-2" />
						Exchange Sync (Kraken)
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
