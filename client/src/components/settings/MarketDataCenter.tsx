import { useMutation, useQuery } from "@apollo/client";
import {
	AlertTriangle,
	CheckCircle2,
	Database,
	Download,
	Loader2,
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
import {
	CANCEL_PACK_BUILD_JOB,
	INSTALL_MARKET_DATA_PACK,
	REMOVE_MARKET_DATA_PACK,
	REPAIR_MARKET_DATA_PACK,
	START_LOCAL_PACK_BUILD,
	UPDATE_MARKET_DATA_PACK,
} from "@/graphql/mutations/market-data";
import {
	GET_MARKET_DATA_CREDENTIALS,
	GET_MARKET_DATA_PACK_JOB,
	GET_MARKET_DATA_PACKS_CENTER,
	GET_PACK_BUILD_JOB,
	GET_PACK_BUILD_JOBS,
} from "@/graphql/queries/market-data";

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
	const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || "http://localhost:8080/graphql";
	const apiBaseURL = graphqlEndpoint.replace(/\/graphql$/, "");

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
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="flex items-center gap-2 text-2xl font-semibold">
						<Database className="h-6 w-6" />
						Market Data
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Install local daily candle packs and manage provider fallback.
					</p>
				</div>
				<TabsList>
					<TabsTrigger value="packs">Packs</TabsTrigger>
					<TabsTrigger value="local-build">Local Build</TabsTrigger>
					<TabsTrigger value="providers">
						<Settings className="mr-2 h-4 w-4" />
						Providers
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent value="packs" className="space-y-6">
				{error && (
					<Card className="border-destructive/40">
						<CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
							<XCircle className="h-4 w-4" />
							{error.message}
						</CardContent>
					</Card>
				)}

				<div className="grid gap-4 md:grid-cols-4">
					<StatusCard
						label="Installed packs"
						value={String(data?.installedMarketDataPacks.length ?? 0)}
					/>
					<StatusCard
						label="Assets"
						value={formatCount(
							(data?.installedMarketDataPacks ?? []).reduce(
								(sum, pack) => sum + pack.assetsCount,
								0,
							),
						)}
					/>
					<StatusCard
						label="Rows"
						value={formatCount(
							(data?.installedMarketDataPacks ?? []).reduce((sum, pack) => sum + pack.rowsCount, 0),
						)}
					/>
					<StatusCard
						label="Latest install"
						value={data?.installedMarketDataPacks[0]?.installedAt?.slice(0, 10) ?? "-"}
					/>
				</div>

				{recommendedPack && (
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-start justify-between gap-4">
								<div>
									<CardTitle className="text-base">{recommendedPack.name}</CardTitle>
									<CardDescription>{recommendedPack.description}</CardDescription>
								</div>
								<Badge>Recommended</Badge>
							</div>
						</CardHeader>
						<CardContent className="flex flex-wrap items-center justify-between gap-4">
							<div className="grid gap-3 text-sm sm:grid-cols-4">
								<span>{formatBytes(recommendedPack.compressedSizeBytes)}</span>
								<span>{formatCount(recommendedPack.assetsCount)} assets</span>
								<span>{formatCount(recommendedPack.rowsCount)} rows</span>
								<span>{recommendedPack.assetTypes.join(", ")}</span>
							</div>
							<Button
								onClick={() => startMutation("install", recommendedPack.packId)}
								disabled={busy || installedById.has(recommendedPack.packId)}
							>
								<Download className="mr-2 h-4 w-4" />
								{installedById.has(recommendedPack.packId) ? "Installed" : "Install"}
							</Button>
						</CardContent>
					</Card>
				)}

				{activeJob && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Job progress</CardTitle>
							<CardDescription>
								{activeJob.jobType} {activeJob.packId} · {activeJob.status}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<Progress value={activeJob.progressPercent} />
							<div className="flex items-center justify-between text-sm text-muted-foreground">
								<span>{activeJob.progressPercent.toFixed(0)}%</span>
								<span>
									{formatBytes(activeJob.downloadedBytes)} / {formatBytes(activeJob.totalBytes)}
								</span>
							</div>
							{activeJob.errorMessage && (
								<p className="text-sm text-destructive">{activeJob.errorMessage}</p>
							)}
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Available packs</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Version</TableHead>
									<TableHead>Size</TableHead>
									<TableHead>Assets</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(data?.availableMarketDataPacks ?? []).map((pack) => {
									const installed = installedById.get(pack.packId);
									return (
										<TableRow key={pack.packId}>
											<TableCell>
												<div className="font-medium">{pack.name}</div>
												<div className="text-xs text-muted-foreground">
													{pack.assetTypes.join(", ")}
												</div>
											</TableCell>
											<TableCell>{pack.version}</TableCell>
											<TableCell>{formatBytes(pack.compressedSizeBytes)}</TableCell>
											<TableCell>{formatCount(pack.assetsCount)}</TableCell>
											<TableCell>
												<Badge variant={installed ? "default" : "secondary"}>
													{installed?.status ?? "available"}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<Button
														size="icon"
														variant="outline"
														onClick={() => startMutation("install", pack.packId)}
														disabled={busy}
													>
														<Download className="h-4 w-4" />
													</Button>
													{installed && (
														<>
															<Button
																size="icon"
																variant="outline"
																onClick={() => startMutation("update", pack.packId)}
																disabled={busy}
															>
																<RefreshCw className="h-4 w-4" />
															</Button>
															<Button
																size="icon"
																variant="outline"
																onClick={() => startMutation("repair", pack.packId)}
																disabled={busy}
															>
																<Wrench className="h-4 w-4" />
															</Button>
															<Button
																size="icon"
																variant="outline"
																onClick={() => startMutation("remove", pack.packId)}
																disabled={busy}
															>
																<Trash2 className="h-4 w-4" />
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
											className="py-8 text-center text-sm text-muted-foreground"
										>
											No registry packs available.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Coverage check</CardTitle>
						<CardDescription>Enter instrument UUID to inspect local pack coverage.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex gap-2">
							<Input
								value={coverageInstrumentId}
								onChange={(event) => setCoverageInstrumentId(event.target.value)}
								placeholder="instrument id"
							/>
							<Button variant="outline" onClick={() => refetch()}>
								<Search className="mr-2 h-4 w-4" />
								Check
							</Button>
						</div>
						<Separator />
						{(data?.marketDataCoverage ?? []).map((coverage) => (
							<div
								key={`${coverage.packId}-${coverage.instrumentId}-${coverage.quoteCurrency}`}
								className="flex items-center justify-between text-sm"
							>
								<span>
									{coverage.symbol} · {coverage.quoteCurrency} · {coverage.firstDate.slice(0, 10)}{" "}
									to {coverage.lastDate.slice(0, 10)}
								</span>
								<Badge variant="secondary">{coverage.packId}</Badge>
							</div>
						))}
						{coverageInstrumentId.trim() && (data?.marketDataCoverage ?? []).length === 0 && (
							<p className="text-sm text-muted-foreground">
								No local pack coverage for this instrument.
							</p>
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="local-build" className="space-y-6">
				<Card className="border-amber-300/60">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<AlertTriangle className="h-4 w-4 text-amber-500" />
							Local stock/fund history pack
						</CardTitle>
						<CardDescription>
							Build a private local daily-candle pack from your own data access. MarketParquet is
							recommended for self-hosted stock/ETF history. The pack stays on this instance and
							must not be uploaded or redistributed.
						</CardDescription>
					</CardHeader>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Build from your provider key</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
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
							<Button variant="outline" onClick={handleRepairLocalPacks}>
								Repair local packs
							</Button>
						</div>
					</CardContent>
				</Card>

				{activeLocalBuildJob && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Current local build</CardTitle>
							<CardDescription>
								{activeLocalBuildJob.packId} · {activeLocalBuildJob.sourceProvider} ·{" "}
								{activeLocalBuildJob.status}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
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
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Recent local build jobs</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Pack</TableHead>
									<TableHead>Provider</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Progress</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{localBuildJobs.map((job) => (
									<TableRow key={job.id}>
										<TableCell className="font-medium">{job.packId}</TableCell>
										<TableCell>{job.sourceProvider}</TableCell>
										<TableCell>
											<Badge variant={job.status === "succeeded" ? "default" : "secondary"}>
												{job.status}
											</Badge>
										</TableCell>
										<TableCell>{job.progressPercent.toFixed(0)}%</TableCell>
									</TableRow>
								))}
								{localBuildJobs.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={4}
											className="py-8 text-center text-sm text-muted-foreground"
										>
											No local build jobs yet.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="providers">
				<MarketDataSettingsWrapper showHeader={false} />
			</TabsContent>
		</Tabs>
	);
}

function StatusCard({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="flex items-center justify-between p-4">
				<div>
					<p className="text-xs text-muted-foreground">{label}</p>
					<p className="text-xl font-semibold">{value}</p>
				</div>
				<CheckCircle2 className="h-5 w-5 text-muted-foreground" />
			</CardContent>
		</Card>
	);
}
