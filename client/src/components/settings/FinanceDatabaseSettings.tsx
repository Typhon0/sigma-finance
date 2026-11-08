"use client";

import { AlertCircle, CheckCircle2, CloudDownload, Database, Eye, Layers, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataPreviewTable } from "@/components/sync/data-preview-table";
import { SyncHistory, type SyncHistoryEntry } from "@/components/sync/sync-history";
import { SyncProgress } from "@/components/sync/sync-progress";
import { type AssetType, SyncToggleCard } from "@/components/sync/sync-toggle-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AssetSyncType } from "@/graphql/queries/sync";
import {
	useFinanceDatabaseSyncHistory,
	useFinanceDatabaseSyncStatus,
	useImportFinanceDatabaseAssets,
	useTriggerFinanceDatabaseSync,
	useUpdateFinanceDatabaseSyncEnabled,
} from "@/hooks/use-sync-management";
import { cn } from "@/lib/utils";

const assetTypeToSyncAssetType = (assetType: AssetType): AssetSyncType => {
	switch (assetType) {
		case "equities":
			return AssetSyncType.EQUITIES;
		case "etfs":
			return AssetSyncType.ETFs;
		case "funds":
			return AssetSyncType.FUNDS;
		case "indices":
			return AssetSyncType.INDICES;
		case "cryptocurrencies":
		case "cryptos":
			return AssetSyncType.CRYPTOCURRENCIES;
		case "currencies":
			return AssetSyncType.CURRENCIES;
		case "money_markets":
		case "moneymarkets":
			return AssetSyncType.MONEY_MARKETS;
		default:
			return AssetSyncType.EQUITIES;
	}
};

const syncStatusToCardStatus = (
	status?: string | null,
): "idle" | "syncing" | "error" | "complete" => {
	switch ((status ?? "IDLE").toUpperCase()) {
		case "SYNCING":
			return "syncing";
		case "COMPLETE":
			return "complete";
		case "ERROR":
			return "error";
		default:
			return "idle";
	}
};

const syncHistoryStatusToEntryStatus = (status?: string | null): "success" | "error" =>
	(status ?? "").toUpperCase() === "COMPLETE" ? "success" : "error";

const syncAssetTypeToCardType = (assetType: string): AssetType => {
	switch (assetType.toUpperCase()) {
		case "EQUITIES":
			return "equities";
		case "ETFS":
			return "etfs";
		case "FUNDS":
			return "funds";
		case "INDICES":
			return "indices";
		case "CRYPTOCURRENCIES":
			return "cryptocurrencies";
		case "CURRENCIES":
			return "currencies";
		case "MONEY_MARKETS":
			return "money_markets";
		default:
			return "equities";
	}
};

export function FinanceDatabaseSettings() {
	const {
		assetTypes,
		loading: statusLoading,
		error: statusError,
		refetch,
	} = useFinanceDatabaseSyncStatus();
	const {
		history,
		loading: historyLoading,
		error: historyError,
		refetch: refetchHistory,
	} = useFinanceDatabaseSyncHistory(20);
	const { triggerSync, loading: triggerLoading } = useTriggerFinanceDatabaseSync();
	const { updateEnabled, loading: toggleLoading } = useUpdateFinanceDatabaseSyncEnabled();
	const { importAssets, loading: importLoading } = useImportFinanceDatabaseAssets();

	const [previewAssetType, setPreviewAssetType] = useState<AssetType | null>(null);
	const [isSyncSequenceRunning, setIsSyncSequenceRunning] = useState(false);

	const assetStates = useMemo(
		() =>
			assetTypes.map((state) => ({
				assetType: syncAssetTypeToCardType(state.assetType),
				isEnabled: state.isEnabled,
				lastSynced: state.lastSynced ? new Date(state.lastSynced) : null,
				recordCount: state.recordCount,
				syncStatus: syncStatusToCardStatus(state.syncStatus),
				progress: state.progress ?? 0,
				currentRecord: state.currentRecord ?? undefined,
				errorMessage: state.errorMessage ?? undefined,
			})),
		[assetTypes],
	);

	const syncHistory = useMemo<SyncHistoryEntry[]>(
		() =>
			history.map((entry) => ({
				id: entry.id,
				timestamp: new Date(entry.timestamp),
				assetType: syncAssetTypeToCardType(entry.assetType),
				recordCount: entry.recordCount,
				status: syncHistoryStatusToEntryStatus(entry.status),
				errorMessage: entry.errorMessage ?? undefined,
			})),
		[history],
	);

	const stats = useMemo(() => {
		const total = assetStates.length;
		const enabled = assetStates.filter((s) => s.isEnabled).length;
		const totalRecords = assetStates.reduce((acc, s) => acc + s.recordCount, 0);
		return { total, enabled, totalRecords };
	}, [assetStates]);

	const syncingAssets = assetStates.filter((state) => (state.syncStatus as string) === "syncing");
	const isAnySyncing = syncingAssets.length > 0 || isSyncSequenceRunning;

	const waitForSyncToFinish = useCallback(
		async (assetType: AssetType) => {
			const targetAssetType = assetType.toLowerCase();
			for (let attempt = 0; attempt < 180; attempt += 1) {
				const result = await refetch();
				const asset = result.data?.financeDatabaseSyncStatus.assetTypes.find(
					(item) => syncAssetTypeToCardType(item.assetType) === targetAssetType,
				);
				if (!asset || asset.syncStatus !== "SYNCING") {
					return;
				}
				await new Promise((resolve) => window.setTimeout(resolve, 1000));
			}
			throw new Error(`Timed out waiting for ${assetType} sync to finish`);
		},
		[refetch],
	);

	const handleToggle = useCallback(
		async (assetType: AssetType, enabled: boolean) => {
			try {
				await updateEnabled(assetTypeToSyncAssetType(assetType), enabled);
				await refetch();
				await refetchHistory();
				toast.success(
					`${assetType.charAt(0).toUpperCase()}${assetType.slice(1)} sync ${enabled ? "enabled" : "disabled"}`,
				);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to update sync setting");
			}
		},
		[refetch, refetchHistory, updateEnabled],
	);

	const handleSync = useCallback(
		async (assetType: AssetType) => {
			try {
				await triggerSync(assetTypeToSyncAssetType(assetType));
				await refetch();
				await refetchHistory();
				toast.success(`${assetType.toUpperCase()} sync started`);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to sync catalog");
			}
		},
		[refetch, refetchHistory, triggerSync],
	);

	const handleSyncAll = useCallback(async () => {
		if (isAnySyncing) {
			toast.error("A sync is already running. Please wait for it to finish.");
			return;
		}
		setIsSyncSequenceRunning(true);
		try {
			for (const state of assetStates) {
				if (!state.isEnabled) {
					continue;
				}
				await triggerSync(assetTypeToSyncAssetType(state.assetType));
				await refetch();
				await waitForSyncToFinish(state.assetType);
				await refetchHistory();
			}
			toast.success("Enabled catalogs synced");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to sync enabled catalogs");
		} finally {
			setIsSyncSequenceRunning(false);
		}
	}, [assetStates, isAnySyncing, refetch, refetchHistory, triggerSync, waitForSyncToFinish]);

	const handleImport = useCallback(
		async (symbols: string[]) => {
			if (!previewAssetType) return;
			try {
				const result = await importAssets(assetTypeToSyncAssetType(previewAssetType), symbols);
				await refetch();
				await refetchHistory();
				const importedCount = result.data?.importFinanceDatabaseAssets.importedCount ?? 0;
				toast.success(`Imported ${importedCount} selected instruments`);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to import selected instruments");
			}
		},
		[importAssets, previewAssetType, refetch, refetchHistory],
	);

	return (
		<div className="flex flex-col gap-6 w-full">
			{/* En-tête de section */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<CloudDownload className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-semibold tracking-tight text-foreground">
							Sources du Catalogue Financier
						</h1>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Supervisez l'état du référentiel global multi-actifs et lancez des synchronisations administratives.
					</p>
				</div>
				<Button
					size="sm"
					onClick={handleSyncAll}
					className="h-8 gap-1.5 text-xs font-medium"
					disabled={triggerLoading || toggleLoading || statusLoading || isAnySyncing}
				>
					<RefreshCw className={cn("h-3.5 w-3.5", isAnySyncing && "animate-spin")} />
					{isAnySyncing ? "Synchronisation en cours..." : "Lancer Sync Admin"}
				</Button>
			</div>

			{/* Ruban KPI unifié */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs overflow-hidden">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
					{/* Catalogues Actifs */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-primary" />
								Catalogues Actifs
							</span>
							<Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
								{stats.enabled} <span className="text-sm font-normal text-muted-foreground">/ {stats.total}</span>
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Types d'actifs activés
							</p>
						</div>
					</div>

					{/* Total Enregistrements */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
								Enregistrements
							</span>
							<Database className="h-3.5 w-3.5 text-sky-500/80" />
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
								{stats.totalRecords.toLocaleString()}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Instruments indexés
							</p>
						</div>
					</div>

					{/* Santé Synchronisation */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span
									className={cn(
										"h-1.5 w-1.5 rounded-full",
										isAnySyncing ? "bg-sky-500 animate-pulse" : "bg-emerald-500",
									)}
								/>
								Santé Globale
							</span>
							{isAnySyncing ? (
								<RefreshCw className="h-3.5 w-3.5 text-sky-500 animate-spin" />
							) : (
								<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
							)}
						</div>
						<div className="mt-2">
							<span className="text-2xl font-semibold tracking-tight text-foreground">
								{isAnySyncing ? "En synchronisation" : "À Jour"}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{isAnySyncing ? "Mise à jour en arrière-plan" : "Tous les catalogues synchronisés"}
							</p>
						</div>
					</div>

					{/* Fournisseur */}
					<div className="p-4 flex flex-col justify-between">
						<div className="flex items-center justify-between gap-2">
							<span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
								Source de Référence
							</span>
							<CloudDownload className="h-3.5 w-3.5 text-muted-foreground/60" />
						</div>
						<div className="mt-2">
							<span className="text-base font-semibold tracking-tight text-foreground font-mono">
								CoinGecko / Yahoo
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								Fallback multi-fournisseur
							</p>
						</div>
					</div>
				</div>
			</div>

			{(statusError || historyError) && (
				<div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive flex items-center gap-2">
					<AlertCircle className="h-4 w-4 shrink-0" />
					<span>{statusError?.message ?? historyError?.message}</span>
				</div>
			)}

			{(syncingAssets.length > 0 || isSyncSequenceRunning) && (
				<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4">
					<div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Progression de la Synchronisation
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							{syncingAssets.length > 0
								? `Synchronisation active de ${syncingAssets.length} catégorie(s)`
								: "Initialisation du flux..."}
						</p>
					</div>
					<div className="space-y-3">
						{syncingAssets.length > 0 ? (
							syncingAssets.map((state) => (
								<SyncProgress
									key={state.assetType}
									assetType={state.assetType}
									progress={state.progress}
									status={state.syncStatus}
									currentRecord={state.currentRecord}
									errorMessage={state.errorMessage}
								/>
							))
						) : (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<RefreshCw className="h-3.5 w-3.5 animate-spin" />
								Attente du statut du serveur...
							</div>
						)}
					</div>
				</div>
			)}

			<div className="space-y-4">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-sm font-semibold tracking-tight text-foreground">
							Types d'Actifs du Catalogue
						</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Activez ou désactivez les synchronisations périodiques par classe d'actifs.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setPreviewAssetType("equities")}
						className="h-8 gap-1.5 text-xs border-border/60"
						disabled={statusLoading || assetStates.length === 0}
					>
						<Eye className="h-3.5 w-3.5 text-muted-foreground" />
						Aperçu des données
					</Button>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{assetStates.map((state) => (
						<SyncToggleCard
							key={state.assetType}
							assetType={state.assetType}
							isEnabled={state.isEnabled}
							lastSynced={state.lastSynced}
							recordCount={state.recordCount}
							syncStatus={state.syncStatus}
							isBusy={isAnySyncing}
							onToggle={(enabled) => handleToggle(state.assetType, enabled)}
							onSync={() => handleSync(state.assetType)}
						/>
					))}
				</div>
			</div>

			{/* Historique des synchronisations */}
			<div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-5 space-y-4">
				<div>
					<h2 className="text-sm font-semibold tracking-tight text-foreground">
						Historique des Synchronisations
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						Consultez les dernières opérations administratives de catalogage.
					</p>
				</div>
				{historyLoading ? (
					<p className="text-xs text-muted-foreground">Chargement de l'historique...</p>
				) : (
					<SyncHistory entries={syncHistory} />
				)}
			</div>

			<DataPreviewTable
				assetType={previewAssetType || "equities"}
				isOpen={previewAssetType !== null}
				onClose={() => setPreviewAssetType(null)}
				onImport={handleImport}
			/>

			{importLoading && (
				<p className="text-xs text-muted-foreground">Importation des instruments sélectionnés...</p>
			)}
		</div>
	);
}
