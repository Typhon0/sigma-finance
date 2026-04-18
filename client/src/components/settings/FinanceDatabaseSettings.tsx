"use client";

import { CloudDownload, Eye, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataPreviewTable } from "@/components/sync/data-preview-table";
import {
	SyncHistory,
	type SyncHistoryEntry,
} from "@/components/sync/sync-history";
import { SyncProgress } from "@/components/sync/sync-progress";
import {
	type SyncStatus,
	useFinanceDatabaseSyncHistory,
	useFinanceDatabaseSyncStatus,
	useImportFinanceDatabaseAssets,
	useTriggerFinanceDatabaseSync,
	useUpdateFinanceDatabaseSyncEnabled,
} from "@/hooks/use-sync-management";
import {
	type AssetType,
	SyncToggleCard,
} from "@/components/sync/sync-toggle-card";
import { AssetSyncType } from "@/graphql/queries/sync";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

const syncStatusToCardStatus = (status?: string | null): SyncStatus => {
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
	const { assetTypes, loading: statusLoading, error: statusError, refetch } =
		useFinanceDatabaseSyncStatus();
	const {
		history,
		loading: historyLoading,
		error: historyError,
		refetch: refetchHistory,
	} = useFinanceDatabaseSyncHistory(20);
	const { triggerSync, loading: triggerLoading } = useTriggerFinanceDatabaseSync();
	const { updateEnabled, loading: toggleLoading } =
		useUpdateFinanceDatabaseSyncEnabled();
	const { importAssets, loading: importLoading } =
		useImportFinanceDatabaseAssets();

	const [previewAssetType, setPreviewAssetType] = useState<AssetType | null>(
		null,
	);
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

	const syncingAssets = assetStates.filter(
		(state) => state.syncStatus === "syncing",
	);
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
				toast.error(
					err instanceof Error ? err.message : "Failed to update sync setting",
				);
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
				toast.error(
					err instanceof Error ? err.message : "Failed to sync catalog",
				);
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
			toast.error(
				err instanceof Error ? err.message : "Failed to sync enabled catalogs",
			);
		} finally {
			setIsSyncSequenceRunning(false);
		}
	}, [assetStates, isAnySyncing, refetch, refetchHistory, triggerSync, waitForSyncToFinish]);

	const handleImport = useCallback(
		async (symbols: string[]) => {
			if (!previewAssetType) return;
			try {
				const result = await importAssets(
					assetTypeToSyncAssetType(previewAssetType),
					symbols,
				);
				await refetch();
				await refetchHistory();
				const importedCount =
					result.data?.importFinanceDatabaseAssets.importedCount ?? 0;
				toast.success(`Imported ${importedCount} selected instruments`);
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to import selected instruments",
				);
			}
		},
		[importAssets, previewAssetType, refetch, refetchHistory],
	);

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold flex items-center gap-2">
						<CloudDownload className="h-6 w-6" />
						Finance Database
					</h1>
					<p className="text-muted-foreground mt-1">
						Inspect, refresh, and import the catalog sourced from FinanceDatabase
					</p>
				</div>
				<Button
					onClick={handleSyncAll}
					className="flex items-center gap-2"
					disabled={triggerLoading || toggleLoading || statusLoading || isAnySyncing}
				>
					<RefreshCw className="h-4 w-4" />
					{isAnySyncing ? "Sync Running" : "Sync All Enabled"}
				</Button>
			</div>

			<Separator />

			{(statusError || historyError) && (
				<Card className="border-destructive/40">
					<CardContent className="py-4 text-sm text-destructive">
						{statusError?.message ?? historyError?.message}
					</CardContent>
				</Card>
			)}

			{(syncingAssets.length > 0 || isSyncSequenceRunning) && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Sync Progress</CardTitle>
						<CardDescription>
							{syncingAssets.length > 0
								? `Currently syncing ${syncingAssets.length} asset type${syncingAssets.length > 1 ? "s" : ""}`
								: "Sync is starting..."}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
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
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<RefreshCw className="h-4 w-4 animate-spin" />
								Waiting for sync status...
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<div>
				<div className="flex items-center justify-between mb-4 gap-4">
					<h2 className="text-lg font-medium">Asset Types</h2>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setPreviewAssetType("equities")}
						className="flex items-center gap-2"
						disabled={statusLoading || assetStates.length === 0}
					>
						<Eye className="h-4 w-4" />
						Preview Available Data
					</Button>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
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

			<Separator />

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Sync History</CardTitle>
					<CardDescription>
						View past sync operations and their status
					</CardDescription>
				</CardHeader>
				<CardContent>
					{historyLoading ? (
						<p className="text-sm text-muted-foreground">Loading history...</p>
					) : (
						<SyncHistory entries={syncHistory} />
					)}
				</CardContent>
			</Card>

			<DataPreviewTable
				assetType={previewAssetType || "equities"}
				isOpen={previewAssetType !== null}
				onClose={() => setPreviewAssetType(null)}
				onImport={handleImport}
			/>

			{importLoading && (
				<p className="text-xs text-muted-foreground">
					Importing selected instruments...
				</p>
			)}
		</div>
	);
}
