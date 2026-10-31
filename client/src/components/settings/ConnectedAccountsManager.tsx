import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
	Activity,
	AlertCircle,
	AlertTriangle,
	Building2,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Copy,
	Cpu,
	Edit,
	ExternalLink,
	Eye,
	EyeOff,
	Globe,
	HardDrive,
	KeyRound,
	Layers,
	Link2,
	Loader2,
	Plus,
	RefreshCw,
	Server,
	Shield,
	ShieldAlert,
	Smartphone,
	Trash2,
	Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { usePortfolio } from "@/components/PortfolioProvider";
import { ConnectInstitutionDialog } from "@/components/sync/ConnectInstitutionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	AddWalletDialog,
	AlchemySettingsCard,
	DeFiReviewQueueBanner,
} from "@/features/wallets";
import { BlockchainEndpointsManager } from "./BlockchainEndpointsManager";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import {
	ADD_CUSTOM_TOKEN,
	ASSIGN_WALLET_DEVICE,
	REMOVE_WALLET_ACCOUNT,
	REMOVE_WALLET_DEVICE,
	RESET_BLOCKCHAIN_NETWORK_CONFIG,
	TOGGLE_SPAM_TOKEN,
	TRIGGER_WALLET_SYNC,
	UPDATE_BLOCKCHAIN_NETWORK_CONFIG,
} from "@/graphql/mutations/wallets";
import { GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";
import {
	GET_BLOCKCHAIN_NETWORK_CONFIGS,
	GET_PENDING_WALLET_REVIEWS,
	GET_WALLET_ACCOUNTS,
	GET_WALLET_CU_USAGE,
	GET_WALLET_DEVICES,
} from "@/graphql/queries/wallets";
import { cn } from "@/lib/utils";

const NETWORK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
	ETHEREUM: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
	BASE: { bg: "bg-sky-500/10", text: "text-sky-500", border: "border-sky-500/20" },
	ARBITRUM: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/20" },
	OPTIMISM: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
	POLYGON: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/20" },
	SOLANA: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
	BITCOIN: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
};

function formatNetworkBadge(network: string) {
	const styling = NETWORK_COLORS[network] || {
		bg: "bg-muted",
		text: "text-muted-foreground",
		border: "border-muted-foreground/20",
	};
	return (
		<Badge
			variant="outline"
			className={cn("text-xs font-mono font-medium px-2 py-0.5", styling.bg, styling.text, styling.border)}
		>
			{network}
		</Badge>
	);
}

function formatCapabilityBadge(capLevel?: string | null) {
	switch (capLevel) {
		case "ENHANCED_HISTORY":
			return (
				<Badge
					variant="outline"
					className="text-[11px] font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1"
					title="Enriched history from specialized indexer (e.g. Alchemy, Helius)"
				>
					<CheckCircle2 className="h-3 w-3" /> Enhanced History
				</Badge>
			);
		case "ACTIVITY_INDEXED":
			return (
				<Badge
					variant="outline"
					className="text-[11px] font-mono px-2 py-0.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 gap-1"
					title="On-chain activity indexed via open block explorer / RPC"
				>
					<Activity className="h-3 w-3" /> Activity Indexed
				</Badge>
			);
		case "BALANCE_ONLY":
		default:
			return (
				<Badge
					variant="outline"
					className="text-[11px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1"
					title="Balances tracked via keyless Public RPC + Multicall3"
				>
					<Eye className="h-3 w-3" /> Balance Only
				</Badge>
			);
	}
}

function formatAddress(addr: string) {
	if (!addr || addr.length <= 16) return addr;
	return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export function ConnectedAccountsManager() {
	const { currentPortfolio } = usePortfolio();
	const portfolioId = currentPortfolio?.id;

	const [isConnectInstitutionOpen, setIsConnectInstitutionOpen] = useState(false);
	const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("all");
	const [walletToRemove, setWalletToRemove] = useState<{ id: string; label?: string | null; address: string } | null>(null);
	const [isSyncingAll, setIsSyncingAll] = useState(false);
	const [expandedWallets, setExpandedWallets] = useState<Record<string, boolean>>({});

	// Queries
	const { data: syncData, loading: syncLoading, refetch: refetchSync } = useQuery(GET_SYNC_CONNECTIONS, {
		variables: { portfolioId: portfolioId || "" },
		skip: !portfolioId,
		fetchPolicy: "cache-and-network",
	});

	const { data: walletData, loading: walletLoading, refetch: refetchWallets } = useQuery(GET_WALLET_ACCOUNTS, {
		variables: portfolioId ? { portfolioId } : {},
		fetchPolicy: "cache-and-network",
	});

	const { data: cuData, refetch: refetchCU } = useQuery(GET_WALLET_CU_USAGE, {
		fetchPolicy: "cache-and-network",
	});

	const { data: reviewsData } = useQuery(GET_PENDING_WALLET_REVIEWS, {
		variables: { portfolioId: portfolioId || "" },
		skip: !portfolioId,
		fetchPolicy: "cache-and-network",
	});

	const { data: devicesData, refetch: refetchDevices } = useQuery(GET_WALLET_DEVICES, {
		fetchPolicy: "cache-and-network",
	});
	const walletDevices = devicesData?.walletDevices || [];

	// Mutations
	const [triggerWalletSync] = useMutation(TRIGGER_WALLET_SYNC);
	const [triggerAccountSync] = useMutation(TRIGGER_ACCOUNT_SYNC);
	const [removeWalletAccount, { loading: isRemovingWallet }] = useMutation(REMOVE_WALLET_ACCOUNT);
	const [toggleSpamToken] = useMutation(TOGGLE_SPAM_TOKEN);
	const [assignWalletDevice] = useMutation(ASSIGN_WALLET_DEVICE);
	const [removeWalletDevice] = useMutation(REMOVE_WALLET_DEVICE);

	const [assignDeviceTarget, setAssignDeviceTarget] = useState<any | null>(null);
	const [customTokenTarget, setCustomTokenTarget] = useState<any | null>(null);
	const [customTokenAddress, setCustomTokenAddress] = useState("");

	const [addCustomToken, { loading: isAddingCustomToken }] = useMutation(ADD_CUSTOM_TOKEN, {
		onCompleted: (res) => {
			toast.success(`Jeton ${res.addCustomToken.symbol} ajouté avec succès !`);
			setCustomTokenTarget(null);
			setCustomTokenAddress("");
			refetchWallets();
		},
		onError: (err) => {
			toast.error(`Erreur: ${err.message}`);
		},
	});

	const syncConnections = syncData?.syncConnections || [];
	const walletAccounts = walletData?.walletAccounts || [];
	const pendingReviewsCount = reviewsData?.pendingWalletReviews?.length || 0;
	const cuUsage = cuData?.walletCUUsage;

	const deviceGroups = useMemo(() => {
		const deviceMap = new Map<string, { device: any; accounts: any[] }>();
		for (const d of walletDevices) {
			deviceMap.set(d.id, { device: d, accounts: [] });
		}
		const standaloneAccounts: any[] = [];
		for (const w of walletAccounts) {
			if (w.deviceId && deviceMap.has(w.deviceId)) {
				deviceMap.get(w.deviceId)!.accounts.push(w);
			} else {
				standaloneAccounts.push(w);
			}
		}
		return {
			devices: Array.from(deviceMap.values()).filter(
				(g) => g.accounts.length > 0 || g.device.deviceType === "HARDWARE",
			),
			standalone: standaloneAccounts,
		};
	}, [walletDevices, walletAccounts]);

	const totalConnected = syncConnections.length + walletAccounts.length;
	const failedTradFi = syncConnections.filter((c: any) => c.syncStatus === "FAILED").length;
	const failedWallets = walletAccounts.filter((w: any) => w.historyStatus === "ERROR").length;
	const totalErrors = failedTradFi + failedWallets;

	const toggleWalletExpanded = (id: string) => {
		setExpandedWallets((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const handleSyncSingleWallet = async (id: string, label: string) => {
		try {
			await triggerWalletSync({ variables: { id } });
			toast.success(`Synchronisation initiée pour ${label}`);
			refetchWallets();
			refetchCU();
		} catch (err: any) {
			toast.error(`Échec de synchro: ${err?.message || "Erreur inconnue"}`);
		}
	};

	const handleSyncSingleInstitution = async (accountId: string, institutionName: string) => {
		try {
			await triggerAccountSync({ variables: { accountId } });
			toast.success(`Synchronisation initiée pour ${institutionName}`);
			refetchSync();
		} catch (err: any) {
			toast.error(`Échec de synchro: ${err?.message || "Erreur inconnue"}`);
		}
	};

	const handleRemoveWallet = async () => {
		if (!walletToRemove) return;
		try {
			await removeWalletAccount({ variables: { id: walletToRemove.id } });
			toast.success("Wallet déconnecté avec succès");
			setWalletToRemove(null);
			refetchWallets();
		} catch (err: any) {
			toast.error(`Impossible de supprimer le wallet: ${err?.message || "Erreur inconnue"}`);
		}
	};

	const handleToggleTokenSpam = async (balanceId: string, currentHidden: boolean) => {
		try {
			await toggleSpamToken({ variables: { balanceId, isHidden: !currentHidden } });
			toast.success(currentHidden ? "Jeton réactivé" : "Jeton masqué");
			refetchWallets();
		} catch (err: any) {
			toast.error(`Erreur: ${err?.message || "Erreur inconnue"}`);
		}
	};

	const handleSyncAll = async () => {
		setIsSyncingAll(true);
		let successCount = 0;
		let failCount = 0;

		try {
			// 1. Sync all active wallet accounts
			for (const w of walletAccounts) {
				if (w.isActive) {
					try {
						await triggerWalletSync({ variables: { id: w.id } });
						successCount++;
					} catch {
						failCount++;
					}
				}
			}

			// 2. Sync all institution accounts
			for (const conn of syncConnections) {
				if (conn.accountId) {
					try {
						await triggerAccountSync({ variables: { accountId: conn.accountId } });
						successCount++;
					} catch {
						failCount++;
					}
				}
			}

			if (failCount === 0) {
				toast.success(`Synchronisation globale terminée (${successCount} flux relancés)`);
			} else {
				toast.warning(`${successCount} flux synchronisés, ${failCount} erreurs rencontrées`);
			}

			refetchWallets();
			refetchSync();
			refetchCU();
		} finally {
			setIsSyncingAll(false);
		}
	};

	return (
		<div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
			{/* En-tête principal */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<Link2 className="h-6 w-6 text-primary" />
						Connected Accounts & Wallets
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Supervisez et gérez tous vos flux financiers automatisés (banques, courtiers, exchanges et wallets Web3).
					</p>
				</div>
				<div className="flex items-center gap-2 flex-wrap">
					<Button
						variant="outline"
						size="sm"
						onClick={handleSyncAll}
						disabled={isSyncingAll || totalConnected === 0}
						className="gap-2"
					>
						<RefreshCw className={cn("h-4 w-4", isSyncingAll && "animate-spin")} />
						{isSyncingAll ? "Sync in progress..." : "Sync All Active"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsConnectInstitutionOpen(true)}
						className="gap-2"
					>
						<Building2 className="h-4 w-4 text-blue-500" />
						Connect Institution
					</Button>
					<Button
						size="sm"
						onClick={() => setIsAddWalletOpen(true)}
						className="gap-2 bg-primary text-primary-foreground"
					>
						<Wallet className="h-4 w-4" />
						Add On-Chain Wallet
					</Button>
				</div>
			</div>

			{/* File d'attente DeFi si des revues sont en attente */}
			{portfolioId && <DeFiReviewQueueBanner portfolioId={portfolioId} />}

			{/* KPI & Jauges de santé */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-sm font-medium">Flux Connectés</CardTitle>
						<Layers className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalConnected}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{syncConnections.length} institution(s) TradFi · {walletAccounts.length} wallet(s) on-chain
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-sm font-medium">Santé des Synchronisations</CardTitle>
						{totalErrors === 0 ? (
							<CheckCircle2 className="h-4 w-4 text-emerald-500" />
						) : (
							<AlertCircle className="h-4 w-4 text-rose-500" />
						)}
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{totalErrors === 0 ? "100% Opérationnel" : `${totalErrors} Requiert Attention`}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{totalErrors === 0
								? "Tous les flux sont synchronisés sans erreur"
								: `${totalErrors} connexion(s) ont signalé une anomalie`}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-sm font-medium">Staging DeFi</CardTitle>
						<Activity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{pendingReviewsCount}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{pendingReviewsCount === 0
								? "Toutes les activités sont classifiées"
								: "Transactions complexes à valider"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
						<CardTitle className="text-sm font-medium">Quota Alchemy API</CardTitle>
						<Cpu className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{cuUsage ? `${((cuUsage.consumedUnits / cuUsage.maxQuota) * 100).toFixed(1)}%` : "0.0%"}
						</div>
						<Progress
							value={cuUsage ? (cuUsage.consumedUnits / cuUsage.maxQuota) * 100 : 0}
							className="h-1.5 mt-2"
						/>
						<p className="text-xs text-muted-foreground mt-1.5 flex justify-between">
							<span>{cuUsage?.consumedUnits?.toLocaleString() || "0"} CUs</span>
							<span>/ 30M CUs</span>
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Onglets de segmentation */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
				<TabsList className="grid grid-cols-2 md:grid-cols-6 w-full md:w-auto h-auto p-1">
					<TabsTrigger value="all" className="py-2">
						All Connections ({totalConnected})
					</TabsTrigger>
					<TabsTrigger value="wallets" className="py-2">
						On-Chain Wallets ({walletAccounts.length})
					</TabsTrigger>
					<TabsTrigger value="institutions" className="py-2">
						Institutions TradFi ({syncConnections.length})
					</TabsTrigger>
					<TabsTrigger value="reviews" className="py-2">
						DeFi Reviews ({pendingReviewsCount})
					</TabsTrigger>
					<TabsTrigger value="endpoints" className="py-2">
						Endpoints & Providers
					</TabsTrigger>
					<TabsTrigger value="quotas" className="py-2">
						API Credentials & Quotas
					</TabsTrigger>
				</TabsList>

				{/* TAB 1: ALL CONNECTIONS */}
				<TabsContent value="all" className="space-y-4">
					{totalConnected === 0 ? (
						<EmptySyncState
							onConnectInstitution={() => setIsConnectInstitutionOpen(true)}
							onAddWallet={() => setIsAddWalletOpen(true)}
						/>
					) : (
						<div className="grid grid-cols-1 gap-4">
							{/* Wallets */}
							{walletAccounts.map((w: any) => (
								<WalletAccountRow
									key={w.id}
									wallet={w}
									isExpanded={!!expandedWallets[w.id]}
									onToggleExpand={() => toggleWalletExpanded(w.id)}
									onSync={() => handleSyncSingleWallet(w.id, w.label || w.network)}
									onRemove={() => setWalletToRemove({ id: w.id, label: w.label, address: w.addressOrXpub })}
									onToggleTokenSpam={handleToggleTokenSpam}
									onAssignDevice={() => setAssignDeviceTarget(w)}
									onAddCustomToken={() => setCustomTokenTarget(w)}
								/>
							))}

							{/* TradFi Institutions */}
							{syncConnections.map((conn: any) => (
								<InstitutionRow
									key={conn.id}
									connection={conn}
									onSync={() => handleSyncSingleInstitution(conn.accountId, conn.institutionName || conn.provider)}
								/>
							))}
						</div>
					)}
				</TabsContent>

				{/* TAB 2: ON-CHAIN WALLETS */}
				<TabsContent value="wallets" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-base font-semibold">Web3 & Hardware Wallets</h3>
							<p className="text-xs text-muted-foreground">
								Adresses de chaînes individuelles et dispositifs multi-chaînes synchronisés sans frais via Alchemy & RPC.
							</p>
						</div>
						<Button size="sm" onClick={() => setIsAddWalletOpen(true)} className="gap-2">
							<Plus className="h-4 w-4" />
							Add Wallet
						</Button>
					</div>

					{walletAccounts.length === 0 ? (
						<Card className="p-8 text-center border-dashed">
							<Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
							<h4 className="font-semibold text-base">Aucun wallet on-chain connecté</h4>
							<p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
								Connectez vos adresses Ethereum, Solana, Bitcoin, Base ou vos clés xpub pour synchroniser automatiquement vos soldes.
							</p>
							<Button size="sm" onClick={() => setIsAddWalletOpen(true)} className="mt-4 gap-2">
								<Plus className="h-4 w-4" />
								Connect On-Chain Wallet
							</Button>
						</Card>
					) : (
						<div className="space-y-6">
							{/* Appareils physiques & logiciels regroupés */}
							{deviceGroups.devices.map((group) => (
								<Card key={group.device.id} className="border-border/70 overflow-hidden shadow-xs">
									<div className="p-4 bg-muted/30 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
										<div className="flex items-center gap-3">
											<div
												className={cn(
													"p-2.5 rounded-lg shrink-0",
													group.device.deviceType === "HARDWARE"
														? "bg-amber-500/10 text-amber-500"
														: "bg-primary/10 text-primary",
												)}
											>
												{group.device.deviceType === "HARDWARE" ? (
													<HardDrive className="h-5 w-5" />
												) : (
													<Smartphone className="h-5 w-5" />
												)}
											</div>
											<div>
												<div className="flex items-center gap-2 flex-wrap">
													<span className="font-semibold text-base">{group.device.name}</span>
													<Badge
														variant="outline"
														className={cn(
															"text-xs font-semibold px-2 py-0.5",
															group.device.deviceType === "HARDWARE"
																? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
																: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
														)}
													>
														{group.device.deviceType === "HARDWARE" ? "🛡️ Cold Storage (Hardware)" : "📱 Software App"}
													</Badge>
												</div>
												<div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
													<span>{group.accounts.length} adresse(s) connectée(s)</span>
													{group.device.description && <span>· {group.device.description}</span>}
												</div>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												className="h-8 text-xs gap-1.5"
												onClick={async () => {
													for (const acc of group.accounts) {
														try {
															await triggerWalletSync({ variables: { id: acc.id } });
														} catch {}
													}
													toast.success(`Synchronisation de ${group.device.name} initiée`);
													refetchWallets();
													refetchCU();
												}}
											>
												<RefreshCw className="h-3.5 w-3.5" />
												Sync Device
											</Button>
											{group.accounts.length === 0 && (
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-rose-600"
													onClick={async () => {
														try {
															await removeWalletDevice({ variables: { id: group.device.id } });
															toast.success("Appareil supprimé");
															refetchDevices();
														} catch (err: any) {
															toast.error(`Erreur: ${err?.message || "Inconnue"}`);
														}
													}}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									</div>
									<div className="p-3 space-y-2 bg-background/50">
										{group.accounts.map((w: any) => (
											<WalletAccountRow
												key={w.id}
												wallet={w}
												isExpanded={!!expandedWallets[w.id]}
												onToggleExpand={() => toggleWalletExpanded(w.id)}
												onSync={() => handleSyncSingleWallet(w.id, w.label || w.network)}
												onRemove={() =>
													setWalletToRemove({ id: w.id, label: w.label, address: w.addressOrXpub })
												}
												onToggleTokenSpam={handleToggleTokenSpam}
												onAssignDevice={() => setAssignDeviceTarget(w)}
												onAddCustomToken={() => setCustomTokenTarget(w)}
											/>
										))}
										{group.accounts.length === 0 && (
											<p className="text-xs text-muted-foreground italic text-center py-2">
												Aucune adresse associée à cet appareil pour le moment.
											</p>
										)}
									</div>
								</Card>
							))}

							{/* Portefeuilles autonomes / Hot wallets */}
							{deviceGroups.standalone.length > 0 && (
								<div className="space-y-3 pt-2">
									{deviceGroups.devices.length > 0 && (
										<h4 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
											<Wallet className="h-4 w-4" />
											Hot Wallets & Adresses Autonomes ({deviceGroups.standalone.length})
										</h4>
									)}
									<div className="space-y-3">
										{deviceGroups.standalone.map((w: any) => (
											<WalletAccountRow
												key={w.id}
												wallet={w}
												isExpanded={!!expandedWallets[w.id]}
												onToggleExpand={() => toggleWalletExpanded(w.id)}
												onSync={() => handleSyncSingleWallet(w.id, w.label || w.network)}
												onRemove={() =>
													setWalletToRemove({ id: w.id, label: w.label, address: w.addressOrXpub })
												}
												onToggleTokenSpam={handleToggleTokenSpam}
												onAssignDevice={() => setAssignDeviceTarget(w)}
												onAddCustomToken={() => setCustomTokenTarget(w)}
											/>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</TabsContent>

				{/* TAB 3: TRADFI INSTITUTIONS */}
				<TabsContent value="institutions" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-base font-semibold">Banques, Courtiers & Exchanges</h3>
							<p className="text-xs text-muted-foreground">
								Connexions agrégées via GoCardless (Open Banking), SnapTrade (courtiers boursiers) et Kraken.
							</p>
						</div>
						<Button size="sm" onClick={() => setIsConnectInstitutionOpen(true)} className="gap-2">
							<Plus className="h-4 w-4" />
							Connect Institution
						</Button>
					</div>

					{syncConnections.length === 0 ? (
						<Card className="p-8 text-center border-dashed">
							<Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
							<h4 className="font-semibold text-base">Aucune institution connectée</h4>
							<p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
								Synchronisez automatiquement vos comptes bancaires européens, vos courtiers boursiers ou votre compte Kraken.
							</p>
							<Button size="sm" onClick={() => setIsConnectInstitutionOpen(true)} className="mt-4 gap-2">
								<Building2 className="h-4 w-4" />
								Connect Institution
							</Button>
						</Card>
					) : (
						<div className="space-y-3">
							{syncConnections.map((conn: any) => (
								<InstitutionRow
									key={conn.id}
									connection={conn}
									onSync={() => handleSyncSingleInstitution(conn.accountId, conn.institutionName || conn.provider)}
								/>
							))}
						</div>
					)}
				</TabsContent>

				{/* TAB 4: DEFI REVIEWS */}
				<TabsContent value="reviews" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-base font-semibold">File de Révision Staging DeFi</h3>
							<p className="text-xs text-muted-foreground">
								Transactions on-chain complexes (swaps multi-tokens, mints, staking, LPs) en attente de qualification comptable.
							</p>
						</div>
					</div>

					{pendingReviewsCount === 0 ? (
						<Card className="p-8 text-center border-dashed">
							<CheckCircle2 className="h-10 w-10 text-emerald-500/60 mx-auto mb-3" />
							<h4 className="font-semibold text-base">Toutes les activités sont classifiées</h4>
							<p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
								Aucune transaction on-chain n'attend de revue manuelle. Vos positions et plus-values sont à jour.
							</p>
						</Card>
					) : (
						portfolioId && <DeFiReviewQueueBanner portfolioId={portfolioId} />
					)}
				</TabsContent>

				{/* TAB 5: BLOCKCHAIN ENDPOINTS & PROVIDERS */}
				<TabsContent value="endpoints" className="space-y-4">
					<BlockchainEndpointsManager />
				</TabsContent>

				{/* TAB 6: API QUOTAS & KEYS */}
				<TabsContent value="quotas" className="space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/30 border rounded-lg">
						<div>
							<h4 className="font-semibold text-sm flex items-center gap-2">
								<KeyRound className="h-4 w-4 text-primary" />
								Centre de Gestion des Clés d'API & Fournisseurs
							</h4>
							<p className="text-xs text-muted-foreground mt-0.5">
								Configurez, testez et mettez à jour l'ensemble de vos clés (Tiingo, Finnhub, Alpha Vantage, CoinGecko, Kraken, Alchemy) dans l'interface unifiée.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="shrink-0"
							onClick={() => {
								window.location.href = "/settings/api-keys";
							}}
						>
							Gérer Toutes les Clés
						</Button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<AlchemySettingsCard />
						<Card>
							<CardHeader>
								<CardTitle className="text-base flex items-center gap-2">
									<Building2 className="h-4 w-4 text-primary" />
									Architecture Multi-Fournisseurs
								</CardTitle>
								<CardDescription>
									Stratégie de synchronisation à coût zéro (€0/mois)
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<div className="flex items-start gap-2">
									<Badge variant="outline" className="mt-0.5 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
										Free-First
									</Badge>
									<p>
										Une seule clé Alchemy couvre EVM (Ethereum, Base, Arbitrum, Optimism, Polygon), Solana et Bitcoin avec un quota gratuit de 30 millions de CU/mois.
									</p>
								</div>
								<div className="flex items-start gap-2">
									<Badge variant="outline" className="mt-0.5 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
										Open Banking
									</Badge>
									<p>
										Les banques utilisent l'API GoCardless / Nordigen conforme PSD2 pour une actualisation périodique sécurisée sans stocker vos identifiants bancaires.
									</p>
								</div>
								<div className="flex items-start gap-2">
									<Badge variant="outline" className="mt-0.5 text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
										Protection Spam
									</Badge>
									<p>
										Les faux airdrops et tokens malveillants sans liquidité sont automatiquement filtrés et isolés dans le volet masqué.
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>

			{/* Boîtes de dialogue */}
			{portfolioId && (
				<ConnectInstitutionDialog
					open={isConnectInstitutionOpen}
					onOpenChange={(open) => {
						setIsConnectInstitutionOpen(open);
						if (!open) {
							refetchSync();
							refetchWallets();
						}
					}}
					portfolioId={portfolioId}
				/>
			)}

			<AddWalletDialog
				open={isAddWalletOpen}
				onOpenChange={setIsAddWalletOpen}
				portfolioId={portfolioId}
				onSuccess={() => {
					refetchWallets();
					refetchDevices();
					refetchCU();
				}}
			/>

			{/* Modal association appareil */}
			<AssignDeviceModal
				wallet={assignDeviceTarget}
				devices={walletDevices}
				onClose={() => setAssignDeviceTarget(null)}
				onAssign={async (walletAccountId, deviceId) => {
					await assignWalletDevice({
						variables: {
							walletAccountId,
							deviceId,
						},
					});
					refetchWallets();
					refetchDevices();
				}}
			/>

			{/* Modal confirmation suppression wallet */}
			<Dialog open={!!walletToRemove} onOpenChange={(open) => !open && setWalletToRemove(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-rose-600">
							<AlertTriangle className="h-5 w-5" />
							Déconnecter ce portefeuille ?
						</DialogTitle>
						<DialogDescription>
							Cette action supprimera la synchronisation de l'adresse{" "}
							<span className="font-mono text-foreground font-medium">
								{walletToRemove?.address}
							</span>
							. Les soldes et positions associées seront retirés du portefeuille.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setWalletToRemove(null)}>
							Annuler
						</Button>
						<Button
							variant="destructive"
							onClick={handleRemoveWallet}
							disabled={isRemovingWallet}
							className="gap-2"
						>
							<Trash2 className="h-4 w-4" />
							{isRemovingWallet ? "Suppression..." : "Confirmer la déconnexion"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modal ajout de jeton custom */}
			<Dialog open={!!customTokenTarget} onOpenChange={(open) => !open && setCustomTokenTarget(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Ajouter un Jeton Personnalisé</DialogTitle>
						<DialogDescription>
							Importez et suivez le solde d'un contrat de jeton (ERC-20 / SPL) non indexé par défaut pour l'adresse{" "}
							<span className="font-mono text-foreground font-medium">
								{customTokenTarget && formatAddress(customTokenTarget.addressOrXpub)}
							</span>
							.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={async (e) => {
							e.preventDefault();
							if (!customTokenTarget || !customTokenAddress.trim()) return;
							await addCustomToken({
								variables: {
									walletAccountId: customTokenTarget.id,
									contractAddress: customTokenAddress.trim(),
								},
							});
						}}
						className="space-y-4 pt-2"
					>
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								Adresse du contrat de jeton ({customTokenTarget?.network})
							</label>
							<input
								type="text"
								placeholder={
									customTokenTarget?.network === "SOLANA"
										? "ex: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
										: "ex: 0x6b175474e89094c44da98b954eedeac495271d0f"
								}
								value={customTokenAddress}
								onChange={(e) => setCustomTokenAddress(e.target.value)}
								className="w-full px-3 py-2 text-sm font-mono border rounded-md bg-background focus:outline-hidden focus:ring-2 focus:ring-primary"
								required
							/>
						</div>
						<DialogFooter className="gap-2 sm:gap-0">
							<Button type="button" variant="outline" onClick={() => setCustomTokenTarget(null)}>
								Annuler
							</Button>
							<Button type="submit" disabled={isAddingCustomToken || !customTokenAddress.trim()}>
								{isAddingCustomToken ? "Interrogation..." : "Ajouter et Synchroniser"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// -------------------------------------------------------------
// Composant : Ligne d'un Wallet On-Chain
// -------------------------------------------------------------
function WalletAccountRow({
	wallet,
	isExpanded,
	onToggleExpand,
	onSync,
	onRemove,
	onToggleTokenSpam,
	onAssignDevice,
	onAddCustomToken,
}: {
	wallet: any;
	isExpanded: boolean;
	onToggleExpand: () => void;
	onSync: () => void;
	onRemove: () => void;
	onToggleTokenSpam: (balanceId: string, currentHidden: boolean) => void;
	onAssignDevice?: () => void;
	onAddCustomToken?: () => void;
}) {
	const [hasCopied, setHasCopied] = useState(false);
	const balances = wallet.balances || [];
	const visibleBalances = balances.filter((b: any) => !b.isHidden && !b.isSpam);
	const hiddenBalances = balances.filter((b: any) => b.isHidden || b.isSpam);

	const handleCopyAddress = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (wallet.addressOrXpub) {
			navigator.clipboard.writeText(wallet.addressOrXpub);
			setHasCopied(true);
			toast.success("Adresse copiée dans le presse-papiers");
			setTimeout(() => setHasCopied(false), 2000);
		}
	};

	return (
		<Card className="overflow-hidden border transition-shadow hover:shadow-xs">
			<div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card">
				<div className="flex items-start md:items-center gap-3">
					<div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5 md:mt-0">
						<Wallet className="h-5 w-5" />
					</div>
					<div>
						<div className="flex items-center gap-2 flex-wrap">
							<span className="font-semibold text-sm">
								{wallet.label || "Wallet On-Chain"}
							</span>
							{formatNetworkBadge(wallet.network)}
							{formatCapabilityBadge(wallet.capabilityLevel)}
							{wallet.device ? (
								<Badge
									variant="outline"
									className={cn(
										"text-[11px] font-medium px-2 py-0.5 gap-1",
										wallet.device.deviceType === "HARDWARE"
											? "bg-amber-500/10 text-amber-600 border-amber-500/20"
											: "bg-blue-500/10 text-blue-600 border-blue-500/20",
									)}
								>
									{wallet.device.deviceType === "HARDWARE" ? "🛡️ " : "📱 "}
									{wallet.device.name}
								</Badge>
							) : null}
							{wallet.historyStatus === "SYNCED" ? (
								<Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
									Synced
								</Badge>
							) : wallet.historyStatus === "IN_PROGRESS" || wallet.historyStatus === "PENDING" ? (
								<Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 flex items-center gap-1">
									<Loader2 className="h-3 w-3 animate-spin" />
									Syncing
								</Badge>
							) : wallet.historyStatus === "ERROR" ? (
								<Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/20">
									Error
								</Badge>
							) : (
								<Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
									Not Synced
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-mono">
							<div className="inline-flex items-center gap-1.5 bg-muted/40 hover:bg-muted/70 px-1.5 py-0.5 rounded transition-colors group">
								<span>{formatAddress(wallet.addressOrXpub)}</span>
								<button
									type="button"
									onClick={handleCopyAddress}
									className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary/40"
									title={`Copier : ${wallet.addressOrXpub}`}
									aria-label="Copier l'adresse"
								>
									{hasCopied ? (
										<Check className="h-3 w-3 text-emerald-500" />
									) : (
										<Copy className="h-3 w-3" />
									)}
								</button>
							</div>
							<span>·</span>
							<span className="font-sans">
								{wallet.lastSyncAt
									? `Synchro : ${new Date(wallet.lastSyncAt).toLocaleString()}`
									: "Non synchronisé"}
							</span>
							{wallet.historyStatus === "ERROR" && wallet.lastSyncError && (
								<span className="text-rose-500 font-sans truncate max-w-xs">
									· {wallet.lastSyncError}
								</span>
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2 self-end md:self-auto">
					<Button
						variant="ghost"
						size="sm"
						onClick={onToggleExpand}
						className="gap-1.5 text-xs text-muted-foreground"
					>
						{balances.length} token(s)
						{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onSync}
						disabled={wallet.historyStatus === "IN_PROGRESS"}
						className="h-8 gap-1.5 text-xs"
					>
						<RefreshCw className={cn("h-3.5 w-3.5", wallet.historyStatus === "IN_PROGRESS" && "animate-spin")} />
						{wallet.historyStatus === "IN_PROGRESS" ? "Syncing..." : "Sync Now"}
					</Button>
					{onAssignDevice && (
						<Button
							variant="outline"
							size="sm"
							onClick={onAssignDevice}
							className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
							title={wallet.device ? `Géré par ${wallet.device.name}` : "Associer à un appareil"}
						>
							<HardDrive className="h-3.5 w-3.5 text-amber-500" />
							{wallet.device ? "Modifier" : "Associer"}
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						onClick={onRemove}
						className="h-8 w-8 text-muted-foreground hover:text-rose-600"
						title="Déconnecter"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Volet déroulant des soldes & tokens */}
			{isExpanded && (
				<div className="border-t bg-muted/20 p-4 space-y-3">
					<div className="flex items-center justify-between">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Soldes & Jetons Détectés ({visibleBalances.length})
						</div>
						{wallet.network !== "BITCOIN" && onAddCustomToken && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onAddCustomToken}
								className="h-7 text-xs gap-1 text-primary hover:text-primary"
							>
								<Plus className="h-3.5 w-3.5" />
								Ajouter un Jeton
							</Button>
						)}
					</div>
					{visibleBalances.length === 0 ? (
						<p className="text-xs text-muted-foreground italic">Aucun jeton actif avec solde non nul.</p>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
							{visibleBalances.map((b: any) => (
								<div
									key={b.id}
									className="flex items-center justify-between p-2 rounded-md bg-background border text-xs"
								>
									<div>
										<span className="font-bold">{b.symbol}</span>{" "}
										<span className="text-muted-foreground">({b.name || b.symbol})</span>
										<div className="font-mono text-muted-foreground mt-0.5">
											{b.formattedQuantity}
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 text-muted-foreground hover:text-foreground"
										onClick={() => onToggleTokenSpam(b.id, false)}
										title="Masquer le jeton"
									>
										<EyeOff className="h-3 w-3" />
									</Button>
								</div>
							))}
						</div>
					)}

					{/* Section Tokens Masqués / Spam */}
					{hiddenBalances.length > 0 && (
						<div className="pt-2">
							<div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
								<ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
								Tokens Masqués & Filtre Anti-Spam ({hiddenBalances.length})
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 opacity-75">
								{hiddenBalances.map((b: any) => (
									<div
										key={b.id}
										className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-dashed text-xs"
									>
										<div>
											<span className="font-medium line-through text-muted-foreground">{b.symbol}</span>
											<div className="font-mono text-xs text-muted-foreground">
												{b.formattedQuantity}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 text-muted-foreground hover:text-foreground"
											onClick={() => onToggleTokenSpam(b.id, true)}
											title="Réafficher le jeton"
										>
											<Eye className="h-3 w-3" />
										</Button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</Card>
	);
}

// -------------------------------------------------------------
// Composant : Ligne d'une Institution TradFi
// -------------------------------------------------------------
function InstitutionRow({
	connection,
	onSync,
}: {
	connection: any;
	onSync: () => void;
}) {
	const isFailed = connection.syncStatus === "FAILED";
	const isSyncing = connection.syncStatus === "SYNCING";

	return (
		<Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition-shadow hover:shadow-xs">
			<div className="flex items-start md:items-center gap-3">
				<div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 shrink-0 mt-0.5 md:mt-0">
					<Building2 className="h-5 w-5" />
				</div>
				<div>
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-semibold text-sm">
							{connection.institutionName || connection.provider}
						</span>
						<Badge variant="outline" className="text-xs uppercase font-mono px-2 py-0.5">
							{connection.provider}
						</Badge>
						{isSyncing ? (
							<Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
								Syncing
							</Badge>
						) : isFailed ? (
							<Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/20">
								Failed
							</Badge>
						) : (
							<Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
								Active
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
						{connection.account?.name && (
							<>
								<span>Compte : {connection.account.name}</span>
								<span>·</span>
							</>
						)}
						<span>
							{connection.lastSyncAt
								? `Dernière synchro : ${new Date(connection.lastSyncAt).toLocaleString()}`
								: "En attente du premier cycle"}
						</span>
						{connection.lastError && (
							<span className="text-rose-500 truncate max-w-xs">
								· {connection.lastError}
							</span>
						)}
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2 self-end md:self-auto">
				<Button
					variant="outline"
					size="sm"
					onClick={onSync}
					disabled={isSyncing}
					className="h-8 gap-1.5 text-xs"
				>
					<RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
					{isSyncing ? "Syncing..." : "Sync Now"}
				</Button>
			</div>
		</Card>
	);
}

// -------------------------------------------------------------
// Composant : Modal Association Appareil
// -------------------------------------------------------------
function AssignDeviceModal({
	wallet,
	devices,
	onClose,
	onAssign,
}: {
	wallet: any;
	devices: any[];
	onClose: () => void;
	onAssign: (walletAccountId: string, deviceId: string | null) => Promise<void>;
}) {
	const [selectedDev, setSelectedDev] = useState<string>(wallet?.deviceId || "none");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (wallet) {
			setSelectedDev(wallet.deviceId || "none");
		}
	}, [wallet]);

	if (!wallet) return null;

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await onAssign(wallet.id, selectedDev === "none" ? null : selectedDev);
			toast.success("Appareil mis à jour avec succès");
			onClose();
		} catch (err: any) {
			toast.error(err?.message || "Erreur association appareil");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={!!wallet} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Associer à un Appareil / Hardware</DialogTitle>
					<DialogDescription>
						Associez le wallet {wallet.label || wallet.network} ({formatAddress(wallet.addressOrXpub)}) à un appareil physique ou logiciel.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSave} className="space-y-4 pt-2">
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-muted-foreground">Appareil cible</label>
						<select
							value={selectedDev}
							onChange={(e) => setSelectedDev(e.target.value)}
							className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-hidden focus:ring-2 focus:ring-primary"
						>
							<option value="none">🌐 Aucun (Hot Wallet indépendant)</option>
							{devices.map((d) => (
								<option key={d.id} value={d.id}>
									{d.deviceType === "HARDWARE" ? "🛡️ " : "📱 "} {d.name} ({d.deviceType})
								</option>
							))}
						</select>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button type="button" variant="outline" onClick={onClose}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Enregistrement..." : "Enregistrer"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// -------------------------------------------------------------
// Composant : État Vide Global
// -------------------------------------------------------------
function EmptySyncState({
	onConnectInstitution,
	onAddWallet,
}: {
	onConnectInstitution: () => void;
	onAddWallet: () => void;
}) {
	return (
		<Card className="p-12 text-center border-dashed">
			<Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
			<h3 className="font-semibold text-lg">Aucun compte ou wallet synchronisé</h3>
			<p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
				Automatisez le suivi de votre patrimoine en connectant vos comptes bancaires, courtiers ou portefeuilles on-chain.
			</p>
			<div className="flex items-center justify-center gap-3 mt-6">
				<Button variant="outline" onClick={onConnectInstitution} className="gap-2">
					<Building2 className="h-4 w-4 text-blue-500" />
					Connect Institution
				</Button>
				<Button onClick={onAddWallet} className="gap-2 bg-primary text-primary-foreground">
					<Wallet className="h-4 w-4" />
					Add On-Chain Wallet
				</Button>
			</div>
		</Card>
	);
}
