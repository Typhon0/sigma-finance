import { gql } from "@apollo/client";

export const UPSERT_MARKET_DATA_CREDENTIAL = gql`
  mutation UpsertMarketDataCredential($provider: String!, $apiKey: String!) {
    upsertMarketDataCredential(provider: $provider, apiKey: $apiKey) {
      id
      provider
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
