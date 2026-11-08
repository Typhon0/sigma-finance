import { useMutation, useQuery } from "@apollo/client";
import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	Database,
	Download,
	Eye,
	EyeOff,
	Key,
	Layers,
	Loader2,
	Package,
	Play,
	RefreshCw,
	Search,
	Settings,
	Trash2,
	Wrench,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MarketDataSettingsWrapper } from "@/components/MarketDataSettingsWrapper";
import { usePortfolio } from "@/components/PortfolioProvider";
import { ConnectInstitutionDialog } from "@/components/sync/ConnectInstitutionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlchemySettingsCard } from "@/features/wallets";
import { cn } from "@/lib/utils";
import {
	CANCEL_PACK_BUILD_JOB,
	INSTALL_MARKET_DATA_PACK,
	REMOVE_MARKET_DATA_PACK,
	REPAIR_MARKET_DATA_PACK,
	START_LOCAL_PACK_BUILD,
	UPDATE_MARKET_DATA_PACK,
} from "@/graphql/mutations/market-data";
import { REGISTER_SYNC_CREDENTIAL } from "@/graphql/mutations/sync";
import {
	GET_MARKET_DATA_CREDENTIALS,
	GET_MARKET_DATA_PACK_JOB,
	GET_MARKET_DATA_PACKS_CENTER,
	GET_PACK_BUILD_JOB,
	GET_PACK_BUILD_JOBS,
} from "@/graphql/queries/market-data";
import { GET_SYNC_CREDENTIALS } from "@/graphql/queries/sync";

interface RegistryPack {
	packId: string;
	version: string;
	name: string;
	description?: string | null;
	sizeBytes: number;
	compressedSizeBytes: number;
	assetsCount: number;
	rowsCount: number;
	interval: string;
	assetTypes: string[];
	quoteCurrencies: string[];
	recommended: boolean;
}

interface InstalledPack {
	id: string;
	version: string;
	name: string;
	status: string;
	assetsCount: number;
	rowsCount: number;
	installedAt?: string | null;
}

interface PackCoverage {
	packId: string;
	instrumentId: string;
	symbol: string;
	assetType: string;
	interval: string;
	quoteCurrency: string;
	firstDate: string;
	lastDate: string;
	rowCount: number;
}

interface PackJob {
	id: string;
	packId: string;
	jobType: string;
	status: string;
	progressPercent: number;
	downloadedBytes: number;
	totalBytes: number;
	importedRows: number;
	errorMessage?: string | null;
}

interface PackCenterData {
	availableMarketDataPacks: RegistryPack[];
	installedMarketDataPacks: InstalledPack[];
	marketDataCoverage: PackCoverage[];
}

interface PackJobData {
	marketDataPackJob: PackJob | null;
}

interface LocalBuildJob {
	id: string;
	packId: string;
	sourceProvider: string;
	status: string;
	progressPercent: number;
	currentSymbol?: string | null;
	currentDate?: string | null;
	currentAssetType?: string | null;
	totalSymbols: number;
	completedSymbols: number;
	failedSymbols: number;
	completedDates?: number;
	totalDates?: number;
	rowsWritten?: number;
	errorMessage?: string | null;
	createdAt: string;
	startedAt?: string | null;
	finishedAt?: string | null;
}

interface LocalBuildJobData {
	packBuildJob: LocalBuildJob | null;
}

interface LocalBuildJobsData {
	packBuildJobs: LocalBuildJob[];
}

interface LocalBuildItem {
	id: string;
	job_id: string;
	instrument_id: string;
	symbol: string;
	status: string;
	attempt_count: number;
	next_retry_at?: string | null;
	error_message?: string | null;
	provider_error_code?: string | null;
	http_status?: number | null;
	retryable?: boolean | null;
}

interface MarketDataCredential {
	id: string;
	provider: string;
	isEnabled: boolean;
}

interface MarketDataCredentialsData {
	marketDataCredentials: MarketDataCredential[];
}

interface SyncCredentialItem {
	id: string;
	provider: string;
	status: string;
	createdAt: string;
	updatedAt: string;
}

interface SyncCredentialsData {
	syncCredentials: SyncCredentialItem[];
}

const emptyInstrumentId = "00000000-0000-0000-0000-000000000000";

const formatBytes = (value: number) => {
	if (!Number.isFinite(value) || value <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let size = value;
	let index = 0;
	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index += 1;
	}
	return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
};

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

export function MarketDataCenter() {
	const [activeTab, setActiveTab] = useState("packs");
	const [coverageInstrumentId, setCoverageInstrumentId] = useState("");
	const [activeJobId, setActiveJobId] = useState<string | null>(null);
	const [activeLocalBuildJobID, setActiveLocalBuildJobID] = useState<string | null>(null);
	const [localProvider, setLocalProvider] = useState("MARKETPARQUET");
	const [localSourceMode, setLocalSourceMode] = useState("api_key");
	const [localImportPath, setLocalImportPath] = useState("");
	const [includeStock, setIncludeStock] = useState(true);
	const [includeFund, setIncludeFund] = useState(true);
	const [localPortfolioFirst, setLocalPortfolioFirst] = useState(true);
	const [localHistoryRange, setLocalHistoryRange] = useState("10");
	const [customHistoryYears, setCustomHistoryYears] = useState("10");
	const [requestsPerMinute, setRequestsPerMinute] = useState("");
	const [requestsPerDay, setRequestsPerDay] = useState("");
	const [concurrentRequests, setConcurrentRequests] = useState("");
	const [localBuildItems, setLocalBuildItems] = useState<LocalBuildItem[]>([]);
	const [loadingLocalBuildItems, setLoadingLocalBuildItems] = useState(false);
	const instrumentId = coverageInstrumentId.trim() || emptyInstrumentId;
	const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || "/graphql";
	const apiBaseURL = graphqlEndpoint.startsWith("http")
		? graphqlEndpoint.replace(/\/graphql$/, "")
		: "";

	const { data, loading, error, refetch } = useQuery<PackCenterData>(GET_MARKET_DATA_PACKS_CENTER, {
		variables: { instrumentId },
		fetchPolicy: "cache-and-network",
	});
	const { data: jobData } = useQuery<PackJobData>(GET_MARKET_DATA_PACK_JOB, {
		variables: { id: activeJobId ?? "" },
		skip: !activeJobId,
		pollInterval: activeJobId ? 1500 : 0,
		onCompleted: (result) => {
			const status = result.marketDataPackJob?.status;
			if (status === "succeeded" || status === "failed" || status === "canceled") {
				void refetch();
			}
		},
	});
	const { data: localBuildJobsData, refetch: refetchLocalBuildJobs } = useQuery<LocalBuildJobsData>(
		GET_PACK_BUILD_JOBS,
		{
			variables: { limit: 20 },
			fetchPolicy: "cache-and-network",
		},
	);
	const { data: localBuildJobData, refetch: refetchLocalBuildJob } = useQuery<LocalBuildJobData>(
		GET_PACK_BUILD_JOB,
		{
			variables: { id: activeLocalBuildJobID ?? "" },
			skip: !activeLocalBuildJobID,
			pollInterval: activeLocalBuildJobID ? 1500 : 0,
		},
	);
	const { data: credentialData } = useQuery<MarketDataCredentialsData>(GET_MARKET_DATA_CREDENTIALS);

	// Sync Credentials state & mutations
	const { currentPortfolio } = usePortfolio();
	const [showConnectDialog, setShowConnectDialog] = useState(false);
	const [newSyncProvider, setNewSyncProvider] = useState("KRAKEN");
	const [newSyncApiKey, setNewSyncApiKey] = useState("");
	const [newSyncApiSecret, setNewSyncApiSecret] = useState("");
	const [showSyncSecret, setShowSyncSecret] = useState(false);

	const {
		data: syncCredsData,
		loading: loadingSyncCreds,
		refetch: refetchSyncCreds,
	} = useQuery<SyncCredentialsData>(GET_SYNC_CREDENTIALS, {
		fetchPolicy: "cache-and-network",
	});

	const [registerSyncCred, { loading: registeringSyncCred }] =
		useMutation(REGISTER_SYNC_CREDENTIAL);

	const handleRegisterSyncCredential = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newSyncApiKey.trim() || !newSyncApiSecret.trim()) {
			toast.error("Please provide both API Key and API Secret");
			return;
		}

		try {
			await registerSyncCred({
				variables: {
					provider: newSyncProvider,
					credentials: {
						apiKey: newSyncApiKey.trim(),
						apiSecret: newSyncApiSecret.trim(),
					},
				},
			});
			toast.success(`${newSyncProvider} sync credential registered successfully!`);
			setNewSyncApiKey("");
			setNewSyncApiSecret("");
			void refetchSyncCreds();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to register sync credential";
			toast.error(msg);
		}
	};

	const [installPack, { loading: installing }] = useMutation(INSTALL_MARKET_DATA_PACK);
	const [updatePack, { loading: updating }] = useMutation(UPDATE_MARKET_DATA_PACK);
	const [removePack, { loading: removing }] = useMutation(REMOVE_MARKET_DATA_PACK);
	const [repairPack, { loading: repairing }] = useMutation(REPAIR_MARKET_DATA_PACK);
	const [startLocalPackBuild, { loading: startingLocalBuild }] =
		useMutation(START_LOCAL_PACK_BUILD);
	const [cancelPackBuildJob, { loading: cancelingLocalBuild }] = useMutation(CANCEL_PACK_BUILD_JOB);

	const installedById = useMemo(() => {
		const map = new Map<string, InstalledPack>();
		for (const pack of data?.installedMarketDataPacks ?? []) {
			map.set(pack.id, pack);
		}
		return map;
	}, [data?.installedMarketDataPacks]);

	const recommendedPack = (data?.availableMarketDataPacks ?? []).find((pack) => pack.recommended);
	const activeJob = jobData?.marketDataPackJob ?? null;
	const latestLocalBuildJob = localBuildJobData?.packBuildJob ?? null;
	const localBuildJobs = localBuildJobsData?.packBuildJobs ?? [];
	const activeLocalBuildJob =
		latestLocalBuildJob ??
		localBuildJobs.find((job) => job.status === "running" || job.status === "queued") ??
		null;
	const hasEnabledCredential = (credentialData?.marketDataCredentials ?? []).some(
		(item) => item.provider === localProvider && item.isEnabled,
	);
	const requiresCredential = localProvider !== "MARKETPARQUET" || localSourceMode === "api_key";
	const activeLocalBuildItems = activeLocalBuildJob
		? localBuildItems.filter((item) => item.job_id === activeLocalBuildJob.id)
		: [];
	const failedLocalBuildItems = activeLocalBuildItems.filter((item) => item.status === "failed");
	const busy = installing || updating || removing || repairing;

	const startMutation = async (
		operation: "install" | "update" | "remove" | "repair",
		packId: string,
	) => {
		const mutation =
			operation === "install"
				? installPack
				: operation === "update"
					? updatePack
					: operation === "remove"
						? removePack
						: repairPack;
		try {
			const result = await mutation({ variables: { packId } });
			const job = result.data?.[`${operation}MarketDataPack`] as PackJob | undefined;
			if (job?.id) setActiveJobId(job.id);
			toast.success(`${operation} queued for ${packId}`);
			await refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : `Failed to ${operation} pack`);
		}
	};

	const fetchLocalBuildItems = useCallback(
		async (jobId: string) => {
			setLoadingLocalBuildItems(true);
			try {
				const token = localStorage.getItem("auth_token");
				const response = await fetch(`${apiBaseURL}/market-data/packs/build-jobs/${jobId}/items`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
					credentials: "include",
				});
				if (!response.ok) {
					throw new Error(`failed to load build items (${response.status})`);
				}
				const payload = (await response.json()) as { items?: LocalBuildItem[] };
				setLocalBuildItems(payload.items ?? []);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to load build items");
			} finally {
				setLoadingLocalBuildItems(false);
			}
		},
		[apiBaseURL],
	);

	useEffect(() => {
		if (!activeLocalBuildJob?.id) {
			setLocalBuildItems([]);
			return;
		}
		void fetchLocalBuildItems(activeLocalBuildJob.id);
		const timer = window.setInterval(() => {
			void fetchLocalBuildItems(activeLocalBuildJob.id);
		}, 2500);
		return () => window.clearInterval(timer);
	}, [activeLocalBuildJob?.id, fetchLocalBuildItems]);

	const handleStartLocalBuild = async () => {
		const assetTypes: string[] = [];
		if (includeStock) assetTypes.push("STOCK");
		if (includeFund) assetTypes.push("FUND");
		if (assetTypes.length === 0) {
			toast.error("Select at least one asset type");
			return;
		}
		const input: Record<string, unknown> = {
			sourceProvider: localProvider,
			assetTypes,
			portfolioFirst: localPortfolioFirst,
		};
		if (localProvider === "MARKETPARQUET") {
			input.sourceMode = localSourceMode;
			if (localSourceMode === "local_folder") {
				if (!localImportPath.trim()) {
					toast.error("Import path is required for MarketParquet local folder mode");
					return;
				}
				input.importPath = localImportPath.trim();
			}
		}
		const now = new Date();
		const computeStartISO = (years: number) =>
			new Date(
				Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()),
			).toISOString();
		const endISO = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		).toISOString();
		if (localHistoryRange === "5") {
			input.historyStart = computeStartISO(5);
			input.historyEnd = endISO;
		}
		if (localHistoryRange === "10") {
			input.historyStart = computeStartISO(10);
			input.historyEnd = endISO;
		}
		if (localHistoryRange === "custom") {
			const years = Number.parseInt(customHistoryYears, 10);
			if (!Number.isFinite(years) || years < 1 || years > 30) {
				toast.error("Custom history must be between 1 and 30 years");
				return;
			}
			input.historyStart = computeStartISO(years);
			input.historyEnd = endISO;
		}
		if (requestsPerMinute.trim()) {
			const value = Number.parseInt(requestsPerMinute, 10);
			if (Number.isFinite(value) && value > 0) input.requestsPerMinute = value;
		}
		if (requestsPerDay.trim()) {
			const value = Number.parseInt(requestsPerDay, 10);
			if (Number.isFinite(value) && value > 0) input.requestsPerDay = value;
		}
		if (concurrentRequests.trim()) {
			const value = Number.parseInt(concurrentRequests, 10);
			if (Number.isFinite(value) && value > 0) input.concurrentRequests = value;
		}
		try {
			const result = await startLocalPackBuild({
				variables: {
					input,
				},
			});
			const job = result.data?.startLocalPackBuild as LocalBuildJob | undefined;
			if (job?.id) {
				setActiveLocalBuildJobID(job.id);
				void refetchLocalBuildJob();
			}
			void refetchLocalBuildJobs();
			toast.success("Local build started");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to start local build");
		}
	};

	const handleCancelLocalBuild = async () => {
		if (!activeLocalBuildJob?.id) return;
		try {
			await cancelPackBuildJob({ variables: { id: activeLocalBuildJob.id } });
			void refetchLocalBuildJob();
			void refetchLocalBuildJobs();
			toast.success("Local build canceled");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel local build");
		}
	};

	const handleRetryFailedLocalBuild = async () => {
		if (!activeLocalBuildJob?.id) return;
		try {
			const token = localStorage.getItem("auth_token");
			const response = await fetch(
				`${apiBaseURL}/market-data/packs/build-jobs/${activeLocalBuildJob.id}/retry-failed`,
				{
					method: "POST",
					headers: token ? { Authorization: `Bearer ${token}` } : {},
					credentials: "include",
				},
			);
			if (!response.ok) {
				throw new Error(`retry failed (${response.status})`);
			}
			void refetchLocalBuildJob();
			void refetchLocalBuildJobs();
			toast.success("Retry queued for failed symbols");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to retry failed symbols");
		}
	};

	const handleRepairLocalPacks = async () => {
		try {
			const token = localStorage.getItem("auth_token");
			const response = await fetch(`${apiBaseURL}/market-data/packs/build-jobs/repair-local`, {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error(`repair-local failed (${response.status})`);
			}
			toast.success("Local pack metadata repaired");
			void refetch();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to repair local packs");
		}
	};

	const historyYears =
		localHistoryRange === "custom"
			? Number.parseInt(customHistoryYears, 10) || 10
			: Number.parseInt(localHistoryRange, 10) || 10;
	const estimatedTradingDays = Math.max(1, Math.ceil(historyYears * 252));
	const selectedAssetKinds = Number(includeStock) + Number(includeFund);
	const estimatedDateFiles = Math.max(0, estimatedTradingDays * selectedAssetKinds);

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<Database className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							Données de Marché & Packs Locaux
						</h1>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Installez des packs de bougies quotidiennes et configurez les fournisseurs de secours.
					</p>
				</div>
				<TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full md:w-auto h-auto p-1 bg-muted/20 border border-border/50 rounded-xl gap-1">
					<TabsTrigger
						value="packs"
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-1.5"
					>
						Packs
					</TabsTrigger>
					<TabsTrigger
						value="local-build"
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-1.5"
					>
						Construction Locale
					</TabsTrigger>
					<TabsTrigger
						value="providers"
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-1.5"
					>
						<Settings className="h-3.5 w-3.5 text-muted-foreground" />
						Fournisseurs
					</TabsTrigger>
					<TabsTrigger
						value="sync"
						className="h-9 text-xs font-medium data-[state=active]:bg-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-lg gap-1.5"
					>
						<RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
						Identifiants Sync
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent value="packs" className="space-y-6">
				{error && (
					<div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 flex items-center gap-2 text-xs text-destructive">
						<XCircle className="h-4 w-4 shrink-0" />
						<span>{error.message}</span>
					</div>
				)}

				{/* Ruban KPI unifié */}
				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
						<div className="p-4 flex flex-col justify-between">
							<div className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
									<span className="h-1.5 w-1.5 rounded-full bg-primary" />
									Packs Installés
								</span>
								<Package className="h-3.5 w-3.5 text-muted-foreground/60" />
							</div>
							<div className="mt-2">
								<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
									{String(data?.installedMarketDataPacks.length ?? 0)}
								</span>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Packs disponibles en local
								</p>
							</div>
						</div>

						<div className="p-4 flex flex-col justify-between">
							<div className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
									<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
									Actifs Couverts
								</span>
								<Layers className="h-3.5 w-3.5 text-sky-500/80" />
							</div>
							<div className="mt-2">
								<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
									{formatCount(
										(data?.installedMarketDataPacks ?? []).reduce(
											(sum, pack) => sum + pack.assetsCount,
											0,
										),
									)}
								</span>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Actions & fonds indiciels
								</p>
							</div>
						</div>

						<div className="p-4 flex flex-col justify-between">
							<div className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
									<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
									Lignes Historiques
								</span>
								<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
							</div>
							<div className="mt-2">
								<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
									{formatCount(
										(data?.installedMarketDataPacks ?? []).reduce(
											(sum, pack) => sum + pack.rowsCount,
											0,
										),
									)}
								</span>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Cotations journalières
								</p>
							</div>
						</div>

						<div className="p-4 flex flex-col justify-between">
							<div className="flex items-center justify-between gap-2">
								<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
									<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
									Dernière Installation
								</span>
								<Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
							</div>
							<div className="mt-2">
								<span className="text-lg font-semibold tracking-tight text-foreground font-mono">
									{data?.installedMarketDataPacks[0]?.installedAt?.slice(0, 10) ?? "—"}
								</span>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Horodatage du registre
								</p>
							</div>
						</div>
					</div>
				</div>

				{recommendedPack && (
					<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4">
						<div className="flex items-start justify-between gap-4">
							<div>
								<div className="text-base font-semibold text-foreground">{recommendedPack.name}</div>
								<p className="text-xs text-muted-foreground mt-0.5">{recommendedPack.description}</p>
							</div>
							<Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Recommandé</Badge>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/40">
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono text-muted-foreground">
								<span>{formatBytes(recommendedPack.compressedSizeBytes)}</span>
								<span>{formatCount(recommendedPack.assetsCount)} actifs</span>
								<span>{formatCount(recommendedPack.rowsCount)} lignes</span>
								<span>{recommendedPack.assetTypes.join(", ")}</span>
							</div>
							<Button
								size="sm"
								onClick={() => startMutation("install", recommendedPack.packId)}
								disabled={busy || installedById.has(recommendedPack.packId)}
								className="h-8 gap-1.5 text-xs"
							>
								<Download className="h-3.5 w-3.5" />
								{installedById.has(recommendedPack.packId) ? "Installé" : "Installer le pack"}
							</Button>
						</div>
					</div>
				)}

				{activeJob && (
					<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-semibold">Progression de l'installation</span>
							<Badge variant="outline" className="text-xs font-mono">
								{activeJob.jobType} · {activeJob.status}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground font-mono">{activeJob.packId}</p>
						<Progress value={activeJob.progressPercent} className="h-2" />
						<div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
							<span>{activeJob.progressPercent.toFixed(0)}%</span>
							<span>
								{formatBytes(activeJob.downloadedBytes)} / {formatBytes(activeJob.totalBytes)}
							</span>
						</div>
						{activeJob.errorMessage && (
							<p className="text-xs text-destructive">{activeJob.errorMessage}</p>
						)}
					</div>
				)}

				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
					<div className="px-5 py-4 border-b border-border/40">
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Packs Disponibles dans le Registre
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Sélectionnez et gérez les packages de données de marché locaux pour ce serveur.
						</p>
					</div>
					<Table>
						<TableHeader>
							<TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Nom
								</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Version
								</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Taille
								</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Actifs
								</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Statut
								</TableHead>
								<TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody className="divide-y divide-border/20">
							{(data?.availableMarketDataPacks ?? []).map((pack) => {
								const installed = installedById.get(pack.packId);
								return (
									<TableRow key={pack.packId} className="hover:bg-muted/30 transition-colors">
										<TableCell>
											<div className="font-medium text-xs text-foreground">{pack.name}</div>
											<div className="text-[11px] text-muted-foreground font-mono">
												{pack.assetTypes.join(", ")}
											</div>
										</TableCell>
										<TableCell className="font-mono text-xs">{pack.version}</TableCell>
										<TableCell className="font-mono text-xs tabular-nums">
											{formatBytes(pack.compressedSizeBytes)}
										</TableCell>
										<TableCell className="font-mono text-xs tabular-nums">
											{formatCount(pack.assetsCount)}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={cn(
													"text-[11px] font-mono",
													installed
														? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
														: "border-border/60 bg-muted/30 text-muted-foreground",
												)}
											>
												{installed?.status ?? "disponible"}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1.5">
												<Button
													size="icon"
													variant="outline"
													className="h-7 w-7 border-border/60"
													onClick={() => startMutation("install", pack.packId)}
													disabled={busy}
												>
													<Download className="h-3.5 w-3.5" />
												</Button>
												{installed && (
													<>
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7 border-border/60"
															onClick={() => startMutation("update", pack.packId)}
															disabled={busy}
														>
															<RefreshCw className="h-3.5 w-3.5" />
														</Button>
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7 border-border/60"
															onClick={() => startMutation("repair", pack.packId)}
															disabled={busy}
														>
															<Wrench className="h-3.5 w-3.5" />
														</Button>
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7 border-border/60 text-rose-500 hover:text-rose-600"
															onClick={() => startMutation("remove", pack.packId)}
															disabled={busy}
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</>
												)}
											</div>
										</TableCell>
									</TableRow>
								);
							})}
							{!loading && (data?.availableMarketDataPacks ?? []).length === 0 && (
								<TableRow>
									<TableCell
										colSpan={6}
										className="py-8 text-center text-xs text-muted-foreground"
									>
										Aucun pack disponible dans le registre.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4">
					<div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Vérification de Couverture
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Saisissez l'UUID ou identifiant d'un instrument pour inspecter sa disponibilité locale.
						</p>
					</div>
					<div className="flex gap-2">
						<Input
							value={coverageInstrumentId}
							onChange={(event) => setCoverageInstrumentId(event.target.value)}
							placeholder="ex: 123e4567-e89b-12d3-a456-426614174000"
							className="h-9 text-xs font-mono"
						/>
						<Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-1.5 text-xs">
							<Search className="h-3.5 w-3.5" />
							Vérifier
						</Button>
					</div>
					<Separator className="border-border/30" />
					{(data?.marketDataCoverage ?? []).map((coverage) => (
						<div
							key={`${coverage.packId}-${coverage.instrumentId}-${coverage.quoteCurrency}`}
							className="flex items-center justify-between text-xs"
						>
							<span className="font-mono">
								{coverage.symbol} · {coverage.quoteCurrency} · {coverage.firstDate.slice(0, 10)}{" "}
								à {coverage.lastDate.slice(0, 10)}
							</span>
							<Badge variant="secondary" className="font-mono text-[11px]">{coverage.packId}</Badge>
						</div>
					))}
					{coverageInstrumentId.trim() && (data?.marketDataCoverage ?? []).length === 0 && (
						<p className="text-xs text-muted-foreground">
							Aucune couverture locale trouvée pour cet instrument.
						</p>
					)}
				</div>
			</TabsContent>

			<TabsContent value="local-build" className="space-y-6">
				<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-1">
					<div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
						<AlertTriangle className="h-4 w-4" />
						Pack d'historique local actions / ETF
					</div>
					<p className="text-xs text-muted-foreground leading-relaxed">
						Générez un pack local de bougies quotidiennes à partir de vos accès API. MarketParquet est
						recommandé pour l'auto-hébergement. Les données restent strictement confinées sur cette
						instance et ne sont jamais téléversées.
					</p>
				</div>

				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4">
					<div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Construire depuis votre clé de fournisseur
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Configurez les paramètres d'extraction et les classes d'actifs à indexer.
						</p>
					</div>
						<div className="rounded-md border border-amber-300/60 bg-amber-50/40 p-3 text-sm text-amber-900">
							Provider market data is licensed to you. SigmaFinance stores this pack locally for
							your private use and will not upload it.
						</div>
						<div className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
							MarketParquet stock/ETF candles are adjusted for splits and dividends. SigmaFinance
							uses them for historical performance charts.
						</div>
						{requiresCredential && !hasEnabledCredential && (
							<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
								<span>Missing API key for {localProvider}. Configure it before building.</span>
								<Button size="sm" variant="outline" onClick={() => setActiveTab("providers")}>
									Configure key
								</Button>
							</div>
						)}
						{localProvider === "MARKETPARQUET" && localSourceMode === "api_key" && (
							<div className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
								MarketParquet API downloads one Parquet file per trading date and asset type.
								Estimated files for this build: {formatCount(estimatedDateFiles)}. For large ranges,
								Pro API or local folder import is recommended.
							</div>
						)}
						<div className="grid gap-4 md:grid-cols-3">
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">Provider</p>
								<Select value={localProvider} onValueChange={setLocalProvider}>
									<SelectTrigger>
										<SelectValue placeholder="Select provider" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="MARKETPARQUET">MarketParquet (recommended)</SelectItem>
										<SelectItem value="TIINGO">Tiingo (fallback)</SelectItem>
										<SelectItem value="TWELVEDATA">TwelveData (fallback)</SelectItem>
										<SelectItem value="ALPHAVANTAGE">AlphaVantage (fallback)</SelectItem>
										<SelectItem value="FINNHUB">Finnhub (fallback)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">History range</p>
								<Select value={localHistoryRange} onValueChange={setLocalHistoryRange}>
									<SelectTrigger>
										<SelectValue placeholder="History range" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="5">5 years</SelectItem>
										<SelectItem value="10">10 years</SelectItem>
										<SelectItem value="custom">Custom</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">Universe</p>
								<Button
									type="button"
									variant={localPortfolioFirst ? "default" : "outline"}
									onClick={() => setLocalPortfolioFirst((v) => !v)}
									className="w-full"
								>
									{localPortfolioFirst ? "Portfolio assets first" : "Selected only"}
								</Button>
							</div>
						</div>
						{localProvider === "MARKETPARQUET" && (
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground">Source mode</p>
									<Select value={localSourceMode} onValueChange={setLocalSourceMode}>
										<SelectTrigger>
											<SelectValue placeholder="Source mode" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="api_key">API key</SelectItem>
											<SelectItem value="local_folder">Local folder import</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{localSourceMode === "local_folder" && (
									<div className="space-y-2">
										<p className="text-xs text-muted-foreground">Server import path</p>
										<Input
											value={localImportPath}
											onChange={(e) => setLocalImportPath(e.target.value)}
											placeholder="e.g. /data/marketparquet"
										/>
										<p className="text-xs text-muted-foreground">
											Expected structure: by_date/stock_daily/YYYY-MM-DD.parquet and
											by_date/etf_daily/YYYY-MM-DD.parquet. In Docker, mount the folder into the
											backend container.
										</p>
									</div>
								)}
							</div>
						)}
						{localHistoryRange === "custom" && (
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">Custom years (max 30)</p>
								<Input
									type="number"
									min={1}
									max={30}
									value={customHistoryYears}
									onChange={(e) => setCustomHistoryYears(e.target.value)}
								/>
							</div>
						)}
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">Asset types</p>
								<div className="flex items-center gap-4">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="asset-type-stock"
											checked={includeStock}
											onCheckedChange={(value) => setIncludeStock(Boolean(value))}
										/>
										<Label htmlFor="asset-type-stock">Stocks</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="asset-type-fund"
											checked={includeFund}
											onCheckedChange={(value) => setIncludeFund(Boolean(value))}
										/>
										<Label htmlFor="asset-type-fund">Funds</Label>
									</div>
								</div>
							</div>
							<div className="space-y-2">
								<p className="text-xs text-muted-foreground">Advanced rate limit</p>
								<div className="grid gap-2 md:grid-cols-3">
									<Input
										type="number"
										placeholder="req/min"
										value={requestsPerMinute}
										onChange={(e) => setRequestsPerMinute(e.target.value)}
									/>
									<Input
										type="number"
										placeholder="req/day"
										value={requestsPerDay}
										onChange={(e) => setRequestsPerDay(e.target.value)}
									/>
									<Input
										type="number"
										placeholder="concurrency"
										value={concurrentRequests}
										onChange={(e) => setConcurrentRequests(e.target.value)}
									/>
								</div>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={handleStartLocalBuild}
								disabled={
									startingLocalBuild ||
									cancelingLocalBuild ||
									(requiresCredential && !hasEnabledCredential)
								}
							>
								{startingLocalBuild ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Play className="mr-2 h-4 w-4" />
								)}
								Build pack
							</Button>
							<Button
								variant="outline"
								onClick={handleCancelLocalBuild}
								disabled={!activeLocalBuildJob || cancelingLocalBuild}
							>
								Cancel running build
							</Button>
							<Button
								variant="outline"
								onClick={handleRetryFailedLocalBuild}
								disabled={!activeLocalBuildJob || activeLocalBuildJob.failedSymbols === 0}
							>
								Retry failed symbols
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									activeLocalBuildJob
										? startMutation("remove", activeLocalBuildJob.packId)
										: undefined
								}
								disabled={!activeLocalBuildJob || busy}
							>
								Remove local pack
							</Button>
							<Button variant="outline" size="sm" className="h-8 text-xs border-border/60" onClick={handleRepairLocalPacks}>
								Repair local packs
							</Button>
						</div>
				</div>

				{activeLocalBuildJob && (
					<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-3">
						<div>
							<div className="text-base font-semibold">Current local build</div>
							<div className="text-xs text-muted-foreground font-mono mt-0.5">
								{activeLocalBuildJob.packId} · {activeLocalBuildJob.sourceProvider} ·{" "}
								{activeLocalBuildJob.status}
							</div>
						</div>
						<div className="space-y-3">
							<Progress value={activeLocalBuildJob.progressPercent} />
							<div className="text-sm text-muted-foreground">
								{activeLocalBuildJob.completedSymbols}/{activeLocalBuildJob.totalSymbols} completed
								· {activeLocalBuildJob.failedSymbols} failed
							</div>
							{typeof activeLocalBuildJob.completedDates === "number" &&
								typeof activeLocalBuildJob.totalDates === "number" &&
								activeLocalBuildJob.totalDates > 0 && (
									<div className="text-sm text-muted-foreground">
										Date files: {activeLocalBuildJob.completedDates}/
										{activeLocalBuildJob.totalDates}
										{activeLocalBuildJob.rowsWritten
											? ` · rows written ${formatCount(activeLocalBuildJob.rowsWritten)}`
											: ""}
									</div>
								)}
							{activeLocalBuildJob.currentDate && (
								<div className="text-sm text-muted-foreground">
									Current date: {activeLocalBuildJob.currentDate.slice(0, 10)}
									{activeLocalBuildJob.currentAssetType
										? ` · ${activeLocalBuildJob.currentAssetType}`
										: ""}
								</div>
							)}
							{activeLocalBuildJob.currentSymbol && (
								<div className="text-sm text-muted-foreground">
									Current symbol: {activeLocalBuildJob.currentSymbol}
								</div>
							)}
							{activeLocalBuildJob.errorMessage && (
								<div className="text-sm text-destructive">{activeLocalBuildJob.errorMessage}</div>
							)}
							{loadingLocalBuildItems && (
								<div className="text-xs text-muted-foreground">Loading item errors…</div>
							)}
							{failedLocalBuildItems.length > 0 && (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Symbol</TableHead>
											<TableHead>Attempt</TableHead>
											<TableHead>Error</TableHead>
											<TableHead>Next retry</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{failedLocalBuildItems.slice(0, 20).map((item) => (
											<TableRow key={item.id}>
												<TableCell>{item.symbol || item.instrument_id.slice(0, 8)}</TableCell>
												<TableCell>{item.attempt_count}</TableCell>
												<TableCell className="text-xs">{item.error_message ?? "-"}</TableCell>
												<TableCell className="text-xs">
													{item.next_retry_at ? new Date(item.next_retry_at).toISOString() : "-"}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</div>
					</div>
				)}

				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
					<div className="p-5 border-b border-border/40">
						<div className="text-base font-semibold">Recent local build jobs</div>
					</div>
					<Table>
						<TableHeader>
							<TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pack</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Provider</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progress</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody className="divide-y divide-border/20">
							{localBuildJobs.map((job) => (
								<TableRow key={job.id} className="hover:bg-muted/30 transition-colors">
									<TableCell className="font-medium text-xs font-mono">{job.packId}</TableCell>
									<TableCell className="text-xs">{job.sourceProvider}</TableCell>
									<TableCell>
										<Badge
											variant="outline"
											className={cn(
												"text-[11px] font-mono gap-1",
												job.status === "succeeded"
													? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
													: "border-border/60 bg-muted/20 text-muted-foreground",
											)}
										>
											{job.status}
										</Badge>
									</TableCell>
									<TableCell className="text-xs font-mono tabular-nums">{job.progressPercent.toFixed(0)}%</TableCell>
								</TableRow>
							))}
							{localBuildJobs.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={4}
										className="py-8 text-center text-xs text-muted-foreground"
									>
										No local build jobs yet.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</TabsContent>

			<TabsContent value="providers">
				<MarketDataSettingsWrapper showHeader={false} />
			</TabsContent>

			<TabsContent value="sync" className="space-y-6">
				<AlchemySettingsCard />

				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-border/40">
						<div>
							<div className="text-base font-semibold">Configured Institution Sync Credentials</div>
							<div className="text-xs text-muted-foreground mt-0.5">
								Active API keys and authentication tokens for automated account synchronization.
							</div>
						</div>
						{currentPortfolio && (
							<Button size="sm" variant="outline" className="h-8 text-xs border-border/60 gap-1.5" onClick={() => setShowConnectDialog(true)}>
								<RefreshCw className="h-3.5 w-3.5" />
								Institution Wizard
							</Button>
						)}
					</div>
					<Table>
						<TableHeader>
							<TableRow className="border-b border-border/40 bg-muted/20 hover:bg-muted/20">
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Provider</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
								<TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last Updated</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody className="divide-y divide-border/20">
							{(syncCredsData?.syncCredentials ?? []).map((cred) => (
								<TableRow key={cred.id} className="hover:bg-muted/30 transition-colors">
									<TableCell className="font-mono text-xs font-medium uppercase text-foreground">{cred.provider}</TableCell>
									<TableCell>
										<Badge
											variant="outline"
											className={cn(
												"text-[11px] font-mono gap-1",
												cred.status === "ACTIVE" || cred.status === "SUCCESS"
													? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
													: "border-border/60 bg-muted/20 text-muted-foreground",
											)}
										>
											{cred.status}
										</Badge>
									</TableCell>
									<TableCell className="text-xs text-muted-foreground font-mono">
										{new Date(cred.createdAt).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-xs text-muted-foreground font-mono">
										{new Date(cred.updatedAt).toLocaleDateString()}
									</TableCell>
								</TableRow>
							))}
							{!loadingSyncCreds && (syncCredsData?.syncCredentials ?? []).length === 0 && (
								<TableRow>
									<TableCell
										colSpan={4}
										className="py-8 text-center text-xs text-muted-foreground"
									>
										No sync credentials configured yet. Register a new API key below or use the
										wizard.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4">
					<div>
						<div className="text-base font-semibold">Register Direct API Key</div>
						<div className="text-xs text-muted-foreground mt-0.5">
							Add credentials directly for supported providers (e.g. Kraken, Binance).
						</div>
					</div>
					<form onSubmit={handleRegisterSyncCredential} className="space-y-4 max-w-lg">
						<div className="space-y-1.5">
							<Label htmlFor="sync-provider-select" className="text-xs text-muted-foreground">Provider</Label>
							<Select value={newSyncProvider} onValueChange={setNewSyncProvider}>
								<SelectTrigger id="sync-provider-select" className="h-9 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="KRAKEN">Kraken (Crypto Exchange)</SelectItem>
									<SelectItem value="SNAPTRADE">SnapTrade (Stock Brokerages)</SelectItem>
									<SelectItem value="GOCARDLESS">GoCardless (Open Banking)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="sync-api-key" className="text-xs text-muted-foreground">API Key *</Label>
							<Input
								id="sync-api-key"
								placeholder="Enter provider API key"
								value={newSyncApiKey}
								onChange={(e) => setNewSyncApiKey(e.target.value)}
								className="h-9 text-xs font-mono border-border/60 bg-background/50 focus-visible:ring-primary/20"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="sync-api-secret" className="text-xs text-muted-foreground">API Secret / Private Key *</Label>
							<div className="relative">
								<Input
									id="sync-api-secret"
									type={showSyncSecret ? "text" : "password"}
									placeholder="Enter provider secret"
									value={newSyncApiSecret}
									onChange={(e) => setNewSyncApiSecret(e.target.value)}
									className="h-9 pr-10 text-xs font-mono border-border/60 bg-background/50 focus-visible:ring-primary/20"
									required
								/>
								<button
									type="button"
									onClick={() => setShowSyncSecret((v) => !v)}
									className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
									aria-label={showSyncSecret ? "Hide secret" : "Show secret"}
								>
									{showSyncSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
						</div>

						<Button
							type="submit"
							size="sm"
							className="h-8 text-xs font-medium"
							disabled={registeringSyncCred || !newSyncApiKey || !newSyncApiSecret}
						>
							{registeringSyncCred ? (
								<>
									<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Key className="mr-1.5 h-3.5 w-3.5" />
									Register Credential
								</>
							)}
						</Button>
					</form>
				</div>

				{currentPortfolio && (
					<ConnectInstitutionDialog
						open={showConnectDialog}
						onOpenChange={setShowConnectDialog}
						portfolioId={currentPortfolio}
						onSuccess={() => {
							void refetchSyncCreds();
						}}
					/>
				)}
			</TabsContent>
		</Tabs>
	);
}

function StatusCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-4 flex items-center justify-between">
			<div>
				<p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
				<p className="text-xl font-semibold tabular-nums text-foreground mt-1">{value}</p>
			</div>
			<CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
		</div>
	);
}
