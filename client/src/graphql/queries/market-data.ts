import { gql } from "@apollo/client";

export const GET_MARKET_DATA_CREDENTIALS = gql`
  query GetMarketDataCredentials {
    marketDataCredentials {
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

export const GET_AVAILABLE_PROVIDERS = gql`
  query GetAvailableProviders($instrumentId: ID!, $dataType: String!) {
    availableProviders(instrumentId: $instrumentId, dataType: $dataType) {
      provider
      capability
      requiresApiKey
      hasCredential
      credentialValid
      credentialEnabled
      priority
      mappingStatus
      effectiveEnabled
    }
  }
`;

export const GET_SUPPORTED_PROVIDERS = gql`
  query GetSupportedProviders($assetType: String) {
    supportedProviders(assetType: $assetType) {
      id
      name
      type
      requiresKey
      intervals
      rateLimit {
        requestsPerMinute
        requestsPerDay
        burstLimit
      }
      supportsRealtime
    }
  }
`;

export const GET_PROVIDER_HEALTH = gql`
  query GetProviderHealth {
    providerHealth {
      provider
      assetType
      healthy
      lastChecked
    }
  }
`;

export const GET_PROVIDER_ROUTING_PREFERENCES = gql`
  query GetProviderRoutingPreferences {
    providerRoutingPreferences {
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

export const GET_MARKET_DATA_SETTINGS = gql`
  query GetMarketDataSettings($assetType: String) {
    marketDataCredentials {
      id
      provider
      isEnabled
      priority
      lastValidatedAt
      createdAt
      updatedAt
    }
    supportedProviders(assetType: $assetType) {
      id
      name
      type
      requiresKey
      intervals
      rateLimit {
        requestsPerMinute
        requestsPerDay
        burstLimit
      }
      supportsRealtime
    }
    providerHealth {
      provider
      assetType
      healthy
      apiKeyValid
      lastChecked
    }
    providerRoutingPreferences {
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
