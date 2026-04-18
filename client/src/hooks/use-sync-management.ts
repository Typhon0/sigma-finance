import { type ApolloClient, useMutation, useQuery } from "@apollo/client";
import { graphql } from "@/gql";
import { AssetSyncType, SyncStatus } from "@/graphql/queries/sync";
import { useEffect } from "react";
import { apolloClient } from "@/lib/apollo/apollo-client";

// Re-export enum values so callers can use them at runtime and in types.
export { AssetSyncType, SyncStatus } from "@/graphql/queries/sync";

// Types
export interface SyncAssetTypeStatus {
	assetType: AssetSyncType;
	isEnabled: boolean;
	lastSynced: string | null;
	recordCount: number;
	syncStatus: SyncStatus;
	progress: number | null;
	currentRecord: string | null;
	errorMessage: string | null;
}

export interface SyncHistoryEntry {
	id: string;
	timestamp: string;
	assetType: AssetSyncType;
	recordCount: number;
	status: SyncStatus;
	errorMessage: string | null;
}

export interface SyncPreviewAsset {
	symbol: string;
	name: string;
	exchange: string | null;
	sector: string | null;
	country: string | null;
}

export interface FinanceDatabaseSyncStatusResult {
	financeDatabaseSyncStatus: {
		assetTypes: SyncAssetTypeStatus[];
	};
}

export interface FinanceDatabaseSyncHistoryResult {
	financeDatabaseSyncHistory: SyncHistoryEntry[];
}

export interface FinanceDatabasePreviewResult {
	financeDatabasePreview: SyncPreviewAsset[];
}

export interface TriggerSyncResult {
	triggerFinanceDatabaseSync: {
		success: boolean;
		message: string;
		syncStatus: {
			assetType: AssetSyncType;
			syncStatus: SyncStatus;
			progress: number | null;
		};
	};
}

export interface UpdateSyncEnabledResult {
	updateFinanceDatabaseSyncEnabled: {
		assetType: AssetSyncType;
		isEnabled: boolean;
	};
}

export interface ImportAssetsResult {
	importFinanceDatabaseAssets: {
		success: boolean;
		importedCount: number;
		errors: string[];
	};
}

// GraphQL Documents for hooks
const GET_SYNC_STATUS_DOC = graphql(/* GraphQL */ `
  query GetFinanceDatabaseSyncStatusHook {
    financeDatabaseSyncStatus {
      assetTypes {
        assetType
        isEnabled
        lastSynced
        recordCount
        syncStatus
        progress
        currentRecord
        errorMessage
      }
    }
  }
`);

const GET_SYNC_HISTORY_DOC = graphql(/* GraphQL */ `
  query GetFinanceDatabaseSyncHistoryHook($limit: Int) {
    financeDatabaseSyncHistory(limit: $limit) {
      id
      timestamp
      assetType
      recordCount
      status
      errorMessage
    }
  }
`);

const GET_SYNC_PREVIEW_DOC = graphql(/* GraphQL */ `
  query GetFinanceDatabasePreviewHook($assetType: AssetSyncType!, $search: String, $limit: Int) {
    financeDatabasePreview(assetType: $assetType, search: $search, limit: $limit) {
      symbol
      name
      exchange
      sector
      country
    }
  }
`);

const TRIGGER_SYNC_DOC = graphql(/* GraphQL */ `
  mutation TriggerFinanceDatabaseSyncHook($assetType: AssetSyncType!) {
    triggerFinanceDatabaseSync(assetType: $assetType) {
      success
      message
      syncStatus {
        assetType
        syncStatus
        progress
      }
    }
  }
`);

const UPDATE_SYNC_ENABLED_DOC = graphql(/* GraphQL */ `
  mutation UpdateFinanceDatabaseSyncEnabledHook($assetType: AssetSyncType!, $enabled: Boolean!) {
    updateFinanceDatabaseSyncEnabled(assetType: $assetType, enabled: $enabled) {
      assetType
      isEnabled
    }
  }
`);

const IMPORT_ASSETS_DOC = graphql(/* GraphQL */ `
  mutation ImportFinanceDatabaseAssetsHook($assetType: AssetSyncType!, $symbols: [String!]!) {
    importFinanceDatabaseAssets(assetType: $assetType, symbols: $symbols) {
      success
      importedCount
      errors
    }
  }
`);

// Hooks
export function useFinanceDatabaseSyncStatus(client?: ApolloClient<unknown>) {
	const { data, loading, error, refetch, startPolling, stopPolling } =
		useQuery<FinanceDatabaseSyncStatusResult>(GET_SYNC_STATUS_DOC, {
			client: client ?? apolloClient,
			fetchPolicy: "cache-and-network",
		});

	const isSyncing = data?.financeDatabaseSyncStatus?.assetTypes.some(
		(assetType) => assetType.syncStatus === SyncStatus.SYNCING,
	);

	useEffect(() => {
		if (isSyncing) {
			startPolling(1000);
			return;
		}
		stopPolling();
	}, [isSyncing, startPolling, stopPolling]);

	return {
		syncStatus: data?.financeDatabaseSyncStatus ?? null,
		assetTypes: data?.financeDatabaseSyncStatus?.assetTypes ?? [],
		loading,
		error,
		refetch,
	};
}

export function useFinanceDatabaseSyncHistory(
	limit?: number,
	client?: ApolloClient<unknown>,
) {
	const { data, loading, error, refetch } =
		useQuery<FinanceDatabaseSyncHistoryResult>(GET_SYNC_HISTORY_DOC, {
			variables: { limit },
			client: client ?? apolloClient,
			fetchPolicy: "cache-and-network",
		});

	return {
		history: data?.financeDatabaseSyncHistory ?? [],
		loading,
		error,
		refetch,
	};
}

export function useFinanceDatabasePreview(
	assetType: AssetSyncType,
	search?: string,
	limit?: number,
	client?: ApolloClient<unknown>,
	enabled = true,
) {
	const { data, loading, error, refetch } =
		useQuery<FinanceDatabasePreviewResult>(GET_SYNC_PREVIEW_DOC, {
			variables: { assetType, search, limit },
			client: client ?? apolloClient,
			fetchPolicy: "cache-and-network",
			skip: !enabled,
		});

	return {
		preview: data?.financeDatabasePreview ?? [],
		loading,
		error,
		refetch,
	};
}

export function useTriggerFinanceDatabaseSync(client?: ApolloClient<unknown>) {
	const [triggerSyncMutation, { loading, error }] =
		useMutation<TriggerSyncResult>(TRIGGER_SYNC_DOC, {
			client: client ?? apolloClient,
			refetchQueries: ["GetFinanceDatabaseSyncStatusHook"],
		});

	const triggerSync = async (assetType: AssetSyncType) => {
		try {
			const result = await triggerSyncMutation({
				variables: { assetType },
			});
			return result;
		} catch (err) {
			console.error("Error triggering finance database sync:", err);
			throw err;
		}
	};

	return {
		triggerSync,
		loading,
		error,
	};
}

export function useUpdateFinanceDatabaseSyncEnabled(
	client?: ApolloClient<unknown>,
) {
	const [updateEnabledMutation, { loading, error }] =
		useMutation<UpdateSyncEnabledResult>(UPDATE_SYNC_ENABLED_DOC, {
			client: client ?? apolloClient,
			refetchQueries: ["GetFinanceDatabaseSyncStatusHook"],
		});

	const updateEnabled = async (assetType: AssetSyncType, enabled: boolean) => {
		try {
			const result = await updateEnabledMutation({
				variables: { assetType, enabled },
			});
			return result;
		} catch (err) {
			console.error("Error updating finance database sync enabled:", err);
			throw err;
		}
	};

	return {
		updateEnabled,
		loading,
		error,
	};
}

export function useImportFinanceDatabaseAssets(client?: ApolloClient<unknown>) {
	const [importAssetsMutation, { loading, error }] =
		useMutation<ImportAssetsResult>(IMPORT_ASSETS_DOC, {
			client: client ?? apolloClient,
			refetchQueries: [
				"GetFinanceDatabaseSyncStatusHook",
				"GetFinanceDatabaseSyncHistoryHook",
			],
		});

	const importAssets = async (assetType: AssetSyncType, symbols: string[]) => {
		try {
			const result = await importAssetsMutation({
				variables: { assetType, symbols },
			});
			return result;
		} catch (err) {
			console.error("Error importing finance database assets:", err);
			throw err;
		}
	};

	return {
		importAssets,
		loading,
		error,
	};
}
