import { gql } from "@apollo/client";

export const TRIGGER_FINANCE_DATABASE_SYNC = gql`
  mutation TriggerFinanceDatabaseSync($assetType: AssetSyncType!) {
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
`;

export const UPDATE_FINANCE_DATABASE_SYNC_ENABLED = gql`
  mutation UpdateFinanceDatabaseSyncEnabled($assetType: AssetSyncType!, $enabled: Boolean!) {
    updateFinanceDatabaseSyncEnabled(assetType: $assetType, enabled: $enabled) {
      assetType
      isEnabled
    }
  }
`;

export const IMPORT_FINANCE_DATABASE_ASSETS = gql`
  mutation ImportFinanceDatabaseAssets($assetType: AssetSyncType!, $symbols: [String!]!) {
    importFinanceDatabaseAssets(assetType: $assetType, symbols: $symbols) {
      success
      importedCount
      errors
    }
  }
`;
