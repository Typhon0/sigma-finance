import { gql } from "@apollo/client";

export const GET_WALLET_DEVICES = gql`
  query GetWalletDevices {
    walletDevices {
      id
      name
      deviceType
      accounts {
        id
        portfolioId
        network
        addressOrXpub
        isActive
        lastSyncAt
        historyStatus
        capabilityLevel
        balances {
          id
          symbol
          name
          decimals
          formattedQuantity
          rawBalance
          tokenAddress
          isSpam
          isHidden
          isStale
          costBasisPerUnit
          costBasisCurrency
          costBasisType
          autoEstimatedBasis
          acquiredAt
          currentPrice
          currentValue
          dayChange24h
          priceUpdatedAt
          priceSource
          isPriceResolved
        }
      }
      createdAt
    }
  }
`;

export const GET_WALLET_ACCOUNTS = gql`
  query GetWalletAccounts($portfolioId: ID) {
    walletAccounts(portfolioId: $portfolioId) {
      id
      portfolioId
      deviceId
      device {
        id
        name
        deviceType
      }
      network
      addressOrXpub
      isXpub
      label
      isActive
      lastSyncAt
      historyStatus
      capabilityLevel
      lastSyncError
      balances {
        id
        symbol
        name
        decimals
        formattedQuantity
        rawBalance
        tokenAddress
        isSpam
        isHidden
        isStale
        costBasisPerUnit
        costBasisCurrency
        costBasisType
        autoEstimatedBasis
        acquiredAt
        currentPrice
        currentValue
        dayChange24h
        priceUpdatedAt
        priceSource
        isPriceResolved
        lastUpdatedAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_WALLET_CU_USAGE = gql`
  query GetWalletCUUsage {
    walletCUUsage {
      billingMonth
      consumedUnits
      maxQuota
      isThrottled
      hasKey
      keySource
      maskedKey
    }
  }
`;

export const GET_PENDING_WALLET_REVIEWS = gql`
  query GetPendingWalletReviews($portfolioId: ID!) {
    pendingWalletReviews(portfolioId: $portfolioId) {
      id
      walletActivityId
      reviewStatus
      suggestedType
      notes
      createdAt
    }
  }
`;

export const GET_BLOCKCHAIN_NETWORK_CONFIGS = gql`
  query GetBlockchainNetworkConfigs {
    blockchainNetworkConfigs {
      network
      rpcUrl
      explorerApiUrl
      source
      updatedAt
    }
  }
`;

