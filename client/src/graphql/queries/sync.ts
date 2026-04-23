import { gql } from "@apollo/client";

// Enum types for sync operations
export enum AssetSyncType {
	EQUITIES = "EQUITIES",
	ETFs = "ETFS",
	FUNDS = "FUNDS",
	INDICES = "INDICES",
	CRYPTOCURRENCIES = "CRYPTOCURRENCIES",
	CURRENCIES = "CURRENCIES",
	MONEY_MARKETS = "MONEY_MARKETS",
}

export enum SyncStatus {
	IDLE = "IDLE",
	SYNCING = "SYNCING",
	COMPLETE = "COMPLETE",
	ERROR = "ERROR",
}

export const GET_FINANCE_DATABASE_SYNC_STATUS = gql`
  query GetFinanceDatabaseSyncStatus {
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
`;

export const GET_FINANCE_DATABASE_SYNC_HISTORY = gql`
  query GetFinanceDatabaseSyncHistory($limit: Int) {
    financeDatabaseSyncHistory(limit: $limit) {
      id
      timestamp
      assetType
      recordCount
      status
      errorMessage
    }
  }
`;

export const GET_FINANCE_DATABASE_PREVIEW = gql`
  query GetFinanceDatabasePreview($assetType: AssetSyncType!, $search: String, $limit: Int) {
    financeDatabasePreview(assetType: $assetType, search: $search, limit: $limit) {
      symbol
      name
      exchange
      sector
      country
    }
  }
`;
