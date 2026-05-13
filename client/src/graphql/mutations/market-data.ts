import { gql } from "@apollo/client";

export const UPSERT_MARKET_DATA_CREDENTIAL = gql`
  mutation UpsertMarketDataCredential(
    $provider: String!
    $apiKey: String!
    $isEnabled: Boolean
    $priority: Int
  ) {
    upsertMarketDataCredential(
      provider: $provider
      apiKey: $apiKey
      isEnabled: $isEnabled
      priority: $priority
    ) {
      id
      provider
      isEnabled
      priority
      lastValidatedAt
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_MARKET_DATA_CREDENTIAL = gql`
  mutation DeleteMarketDataCredential($provider: String!) {
    deleteMarketDataCredential(provider: $provider)
  }
`;

export const VALIDATE_PROVIDER_CREDENTIALS = gql`
  mutation ValidateProviderCredentials($provider: String!, $apiKey: String!) {
    validateProviderCredentials(provider: $provider, apiKey: $apiKey) {
      valid
      message
    }
  }
`;

export const UPDATE_PROVIDER_ROUTING_PREFERENCES = gql`
  mutation UpdateProviderRoutingPreferences($input: ProviderRoutingPreferencesInput!) {
    updateProviderRoutingPreferences(input: $input) {
      id
      userId
      preferredProviders {
        provider
        priority
        enabled
      }
      useIntelligentRouting
      enableFallback
      staleDataThresholdMinutes
      createdAt
      updatedAt
    }
  }
`;

export const INSTALL_MARKET_DATA_PACK = gql`
  mutation InstallMarketDataPack($packId: ID!) {
    installMarketDataPack(packId: $packId) {
      id
      packId
      jobType
      status
      progressPercent
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;

export const UPDATE_MARKET_DATA_PACK = gql`
  mutation UpdateMarketDataPack($packId: ID!) {
    updateMarketDataPack(packId: $packId) {
      id
      packId
      jobType
      status
      progressPercent
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;

export const REMOVE_MARKET_DATA_PACK = gql`
  mutation RemoveMarketDataPack($packId: ID!) {
    removeMarketDataPack(packId: $packId) {
      id
      packId
      jobType
      status
      progressPercent
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;

export const REPAIR_MARKET_DATA_PACK = gql`
  mutation RepairMarketDataPack($packId: ID!) {
    repairMarketDataPack(packId: $packId) {
      id
      packId
      jobType
      status
      progressPercent
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;

export const CANCEL_MARKET_DATA_PACK_JOB = gql`
  mutation CancelMarketDataPackJob($jobId: ID!) {
    cancelMarketDataPackJob(jobId: $jobId) {
      id
      packId
      jobType
      status
      progressPercent
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;

export const START_LOCAL_PACK_BUILD = gql`
  mutation StartLocalPackBuild($input: StartLocalPackBuildInput!) {
    startLocalPackBuild(input: $input) {
      id
      packId
      sourceProvider
      status
      progressPercent
      currentSymbol
      currentDate
      currentAssetType
      totalSymbols
      completedSymbols
      failedSymbols
      completedDates
      totalDates
      rowsWritten
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;

export const CANCEL_PACK_BUILD_JOB = gql`
  mutation CancelPackBuildJob($id: ID!) {
    cancelPackBuildJob(id: $id) {
      id
      packId
      sourceProvider
      status
      progressPercent
      currentSymbol
      currentDate
      currentAssetType
      totalSymbols
      completedSymbols
      failedSymbols
      completedDates
      totalDates
      rowsWritten
      errorMessage
      createdAt
      startedAt
      finishedAt
    }
  }
`;
