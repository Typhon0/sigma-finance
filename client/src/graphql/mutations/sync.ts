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

export const REGISTER_SYNC_CREDENTIAL = gql`
  mutation RegisterSyncCredential($provider: String!, $credentials: JSON!, $portfolioId: ID) {
    registerSyncCredential(provider: $provider, credentials: $credentials, portfolioId: $portfolioId) {
      id
      provider
      status
      createdAt
      updatedAt
    }
  }
`;

export const GENERATE_AGGREGATOR_LINK = gql`
  mutation GenerateAggregatorLink($provider: String!, $redirectUrl: String!) {
    generateAggregatorLink(provider: $provider, redirectUrl: $redirectUrl) {
      link
      sessionToken
      provider
    }
  }
`;

export const COMPLETE_AGGREGATOR_AUTH = gql`
  mutation CompleteAggregatorAuth($connectionId: ID!, $sessionToken: String!) {
    completeAggregatorAuth(connectionId: $connectionId, sessionToken: $sessionToken) {
      id
      portfolioId
      accountId
      provider
      externalInstitutionId
      externalAccountId
      institutionName
      syncStatus
      lastSyncAt
      lastError
      createdAt
      updatedAt
    }
  }
`;

export const LINK_SYNC_ACCOUNT = gql`
  mutation LinkSyncAccount($connectionId: ID!, $accountId: ID, $autoCreate: Boolean) {
    linkSyncAccount(connectionId: $connectionId, accountId: $accountId, autoCreate: $autoCreate) {
      id
      portfolioId
      accountId
      provider
      externalInstitutionId
      externalAccountId
      institutionName
      syncStatus
      lastSyncAt
      lastError
      createdAt
      updatedAt
    }
  }
`;

export const TRIGGER_ACCOUNT_SYNC = gql`
  mutation TriggerAccountSync($accountId: ID!) {
    triggerAccountSync(accountId: $accountId) {
      id
      connectionId
      status
      itemsImported
      itemsUpdated
      errorMessage
      startedAt
      completedAt
    }
  }
`;
