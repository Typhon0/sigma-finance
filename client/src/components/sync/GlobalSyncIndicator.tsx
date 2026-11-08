import { useMutation, useQuery, useApolloClient } from "@apollo/client";
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Loader2,
	RefreshCw,
	Wallet,
	Landmark,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Button } from "@/components/ui/button";
import {
	invalidateDashboardData,
	invalidatePortfolioQueries,
} from "@/hooks/use-asset-management";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import { TRIGGER_WALLET_SYNC } from "@/graphql/mutations/wallets";
import { GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";
import { GET_WALLET_ACCOUNTS } from "@/graphql/queries/wallets";

export interface SyncItem {
	id: string;
	name: string;
	type: "wallet" | "institution";
	status: "SYNCING" | "SUCCESS" | "ERROR";
	networkOrProvider?: string;
	errorMessage?: string;
	lastSyncAt?: string;
	balancesCount?: number;
}

export function GlobalSyncIndicator() {
	const { currentPortfolio } = usePortfolio();
	const apolloClient = useApolloClient();

	const [isExpanded, setIsExpanded] = useState(false);
	const [isDismissed, setIsDismissed] = useState(false);
	const [wasEverSyncing, setWasEverSyncing] = useState(false);
	const [completedAt, setCompletedAt] = useState<number | null>(null);

	// Mutations to retry sync
	const [triggerAccountSync, { loading: retryingAccount }] = useMutation(TRIGGER_ACCOUNT_SYNC);
	const [triggerWalletSync, { loading: retryingWallet }] = useMutation(TRIGGER_WALLET_SYNC);

	// Watch sync connections
	const {
		data: syncData,
		refetch: refetchSync,
	} = useQuery(GET_SYNC_CONNECTIONS, {
		variables: { portfolioId: currentPortfolio },
		skip: !currentPortfolio,
		fetchPolicy: "cache-and-network",
		pollInterval: wasEverSyncing ? 2500 : 0,
	});

	// Watch wallet accounts
	const {
		data: walletData,
		refetch: refetchWallets,
	} = useQuery(GET_WALLET_ACCOUNTS, {
		variables: { portfolioId: currentPortfolio },
		skip: !currentPortfolio,
		fetchPolicy: "cache-and-network",
		pollInterval: wasEverSyncing ? 2500 : 0,
	});

	// Aggregate sync items
	const { activeItems, errorItems, totalSyncing, isAnySyncing } = useMemo(() => {
		const items: SyncItem[] = [];
		const errors: SyncItem[] = [];

		const conns = syncData?.syncConnections || [];
		for (const c of conns) {
			const isSync = c.syncStatus === "SYNCING";
			const isErr = c.syncStatus === "FAILED" || Boolean(c.lastError);
			if (isSync) {
				items.push({
					id: c.id,
					name: c.institutionName || c.account?.name || "Institution",
					type: "institution",
					status: "SYNCING",
					networkOrProvider: c.provider,
				});
			} else if (isErr && c.lastError) {
				errors.push({
					id: c.id,
					name: c.institutionName || c.account?.name || "Institution",
					type: "institution",
					status: "ERROR",
					networkOrProvider: c.provider,
					errorMessage: c.lastError,
				});
			}
		}

		const wallets = walletData?.walletAccounts || [];
		for (const w of wallets) {
			const isSync = w.historyStatus === "IN_PROGRESS" || w.historyStatus === "PENDING";
			const isErr = w.historyStatus === "ERROR" || Boolean(w.lastSyncError);
			if (isSync) {
				items.push({
					id: w.id,
					name: w.label || `${w.network} Wallet`,
					type: "wallet",
					status: "SYNCING",
					networkOrProvider: w.network,
				});
			} else if (isErr && w.lastSyncError) {
				errors.push({
					id: w.id,
					name: w.label || `${w.network} Wallet`,
					type: "wallet",
					status: "ERROR",
					networkOrProvider: w.network,
					errorMessage: w.lastSyncError,
				});
			}
		}

		return {
			activeItems: items,
			errorItems: errors,
			totalSyncing: items.length,
			isAnySyncing: items.length > 0,
		};
	}, [syncData, walletData]);

	// Maintain syncing state flag for polling
	const prevSyncingRef = useRef(false);

	useEffect(() => {
		if (isAnySyncing) {
			setWasEverSyncing(true);
			setIsDismissed(false);
			setCompletedAt(null);
			prevSyncingRef.current = true;
		} else if (prevSyncingRef.current && !isAnySyncing) {
			// Just finished syncing!
			prevSyncingRef.current = false;
			setCompletedAt(Date.now());

			// Invalidate all portfolio queries and dashboard data so all tables update smoothly
			try {
				invalidatePortfolioQueries(apolloClient.cache);
				invalidateDashboardData(apolloClient.cache);
			} catch (e) {
				console.warn("[GlobalSyncIndicator] Cache invalidation warning:", e);
			}

			// Auto dismiss 5 seconds after success
			const timer = setTimeout(() => {
				setIsDismissed(true);
				setWasEverSyncing(false);
			}, 5000);

			return () => clearTimeout(timer);
		}
	}, [isAnySyncing, apolloClient]);

	const handleRetry = async (item: SyncItem) => {
		try {
			if (item.type === "wallet") {
				await triggerWalletSync({ variables: { id: item.id } });
				toast.success(`Synchronisation relancée pour ${item.name}`);
				void refetchWallets();
			} else {
				await triggerAccountSync({ variables: { accountId: item.id } });
				toast.success(`Synchronisation relancée pour ${item.name}`);
				void refetchSync();
			}
		} catch (err: any) {
			toast.error(`Échec: ${err?.message || "Erreur de relance"}`);
		}
	};

	// Determine if widget should be shown
	const shouldShow =
		!isDismissed && (isAnySyncing || completedAt !== null || errorItems.length > 0);

	if (!shouldShow) return null;

	const isCompleted = !isAnySyncing && completedAt !== null && errorItems.length === 0;
	const hasErrors = errorItems.length > 0 && !isAnySyncing;

	return (
		<aside
			aria-label="État de synchronisation"
			className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-background/95 backdrop-blur-md shadow-xl transition-all duration-300"
		>
			{/* Header bar */}
			<div className="flex items-center justify-between p-3 gap-2">
				<div className="flex items-center gap-2.5 min-w-0">
					{isAnySyncing ? (
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
							<Loader2 className="h-4 w-4 animate-spin" />
						</div>
					) : isCompleted ? (
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
							<CheckCircle2 className="h-4 w-4" />
						</div>
					) : (
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
							<AlertCircle className="h-4 w-4" />
						</div>
					)}

					<div className="min-w-0 flex-1">
						<h4 className="text-xs font-semibold truncate leading-tight">
							{isAnySyncing
								? `Synchronisation en cours (${totalSyncing})`
								: isCompleted
									? "Synchronisation terminée !"
									: "Erreur de synchronisation"}
						</h4>
						<p className="text-[11px] text-muted-foreground truncate">
							{isAnySyncing
								? activeItems[0]?.name || "Récupération des données..."
								: isCompleted
									? "Tous vos soldes et actifs sont à jour"
									: `${errorItems.length} compte(s) en erreur`}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1 shrink-0">
					{(activeItems.length > 1 || errorItems.length > 0) && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-muted-foreground hover:text-foreground"
							onClick={() => setIsExpanded(!isExpanded)}
							title={isExpanded ? "Réduire" : "Voir le détail"}
						>
							{isExpanded ? (
								<ChevronDown className="h-3.5 w-3.5" />
							) : (
								<ChevronUp className="h-3.5 w-3.5" />
							)}
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground hover:text-foreground"
						onClick={() => setIsDismissed(true)}
						title="Fermer"
					>
						<X className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			{/* Collapsible detail list */}
			{isExpanded && (
				<div className="border-t border-border/60 p-2.5 space-y-2 max-h-48 overflow-y-auto bg-muted/20">
					{activeItems.map((item) => (
						<div
							key={item.id}
							className="flex items-center justify-between text-xs p-1.5 rounded-md bg-background/80 border border-border/40"
						>
							<div className="flex items-center gap-2 min-w-0">
								{item.type === "wallet" ? (
									<Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
								) : (
									<Landmark className="h-3.5 w-3.5 text-blue-500 shrink-0" />
								)}
								<span className="truncate font-medium">{item.name}</span>
								<span className="text-[10px] text-muted-foreground uppercase px-1 py-0.5 rounded bg-muted">
									{item.networkOrProvider}
								</span>
							</div>
							<Loader2 className="h-3 w-3 animate-spin text-primary shrink-0 ml-2" />
						</div>
					))}

					{errorItems.map((item) => (
						<div
							key={item.id}
							className="text-xs p-2 rounded-md bg-rose-500/10 border border-rose-500/20 space-y-1"
						>
							<div className="flex items-center justify-between">
								<span className="font-semibold text-rose-600 dark:text-rose-400 truncate">
									{item.name}
								</span>
								<Button
									variant="outline"
									size="sm"
									className="h-5 text-[10px] px-1.5 border-rose-500/30 hover:bg-rose-500/20"
									onClick={() => handleRetry(item)}
									disabled={retryingAccount || retryingWallet}
								>
									<RefreshCw className="h-2.5 w-2.5 mr-1" />
									Réessayer
								</Button>
							</div>
							<p className="text-[10px] text-muted-foreground truncate">
								{item.errorMessage || "Échec de connexion au fournisseur"}
							</p>
						</div>
					))}
				</div>
			)}
		</aside>
	);
}
