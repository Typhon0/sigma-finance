import { gql } from "@apollo/client";

export const CREATE_WALLET_DEVICE = gql`
  mutation CreateWalletDevice($input: CreateWalletDeviceInput!) {
    createWalletDevice(input: $input) {
      id
      name
      deviceType
      createdAt
      updatedAt
    }
  }
`;

export const ADD_WALLET_ACCOUNT = gql`
  mutation AddWalletAccount($input: AddWalletAccountInput!) {
    addWalletAccount(input: $input) {
      id
      portfolioId
      network
      addressOrXpub
      isXpub
      label
      isActive
      historyStatus
      balances {
        id
        symbol
        formattedQuantity
      }
      createdAt
    }
  }
`;

export const REMOVE_WALLET_ACCOUNT = gql`
  mutation RemoveWalletAccount($id: ID!) {
    removeWalletAccount(id: $id)
  }
`;

export const TRIGGER_WALLET_SYNC = gql`
  mutation TriggerWalletSync($id: ID!) {
    triggerWalletSync(id: $id)
  }
`;

export const TOGGLE_SPAM_TOKEN = gql`
  mutation ToggleSpamToken($balanceId: ID!, $isHidden: Boolean!) {
    toggleSpamToken(balanceId: $balanceId, isHidden: $isHidden)
  }
`;

export const REFRESH_WALLET_BALANCE_PRICE = gql`
  mutation RefreshWalletBalancePrice($balanceId: ID!) {
    refreshWalletBalancePrice(balanceId: $balanceId) {
      id
      symbol
      currentPrice
      currentValue
      dayChange24h
      priceUpdatedAt
      priceSource
      isPriceResolved
    }
  }
`;

export const RESOLVE_WALLET_REVIEW = gql`
  mutation ResolveWalletReview($reviewId: ID!, $action: String!, $customType: String) {
    resolveWalletReview(reviewId: $reviewId, action: $action, customType: $customType)
  }
`;

export const CONFIGURE_ALCHEMY_KEY = gql`
  mutation ConfigureAlchemyKey($apiKey: String!) {
    configureAlchemyKey(apiKey: $apiKey)
  }
`;

export const SET_WALLET_BALANCE_COST_BASIS = gql`
  mutation SetWalletBalanceCostBasis($balanceId: ID!, $costBasisPerUnit: Float!, $currency: String) {
    setWalletBalanceCostBasis(balanceId: $balanceId, costBasisPerUnit: $costBasisPerUnit, currency: $currency)
  }
`;

export const RESET_WALLET_BALANCE_COST_BASIS = gql`
  mutation ResetWalletBalanceCostBasis($balanceId: ID!) {
    resetWalletBalanceCostBasis(balanceId: $balanceId)
  }
`;

export const ASSIGN_WALLET_DEVICE = gql`
  mutation AssignWalletDevice($walletAccountId: ID!, $deviceId: ID) {
    assignWalletDevice(walletAccountId: $walletAccountId, deviceId: $deviceId)
  }
`;

export const UPDATE_WALLET_DEVICE = gql`
  mutation UpdateWalletDevice($id: ID!, $name: String!, $deviceType: WalletDeviceType!) {
    updateWalletDevice(id: $id, name: $name, deviceType: $deviceType) {
      id
      name
      deviceType
      updatedAt
    }
  }
`;

export const REMOVE_WALLET_DEVICE = gql`
  mutation RemoveWalletDevice($id: ID!) {
    removeWalletDevice(id: $id)
  }
`;

export const ADD_MULTI_NETWORK_WALLET = gql`
  mutation AddMultiNetworkWallet($input: AddMultiNetworkWalletInput!) {
    addMultiNetworkWallet(input: $input) {
      id
      portfolioId
      deviceId
      network
      addressOrXpub
      label
      isActive
      historyStatus
      capabilityLevel
      createdAt
    }
  }
`;

export const ADD_CUSTOM_TOKEN = gql`
  mutation AddCustomToken($input: AddCustomTokenInput!) {
    addCustomToken(input: $input) {
      id
      symbol
      name
      decimals
      formattedQuantity
      rawBalance
      tokenAddress
    }
  }
`;

export const UPDATE_BLOCKCHAIN_NETWORK_CONFIG = gql`
  mutation UpdateBlockchainNetworkConfig($input: UpdateBlockchainNetworkConfigInput!) {
    updateBlockchainNetworkConfig(input: $input) {
      network
      rpcUrl
      explorerApiUrl
      source
      updatedAt
    }
  }
`;

export const RESET_BLOCKCHAIN_NETWORK_CONFIG = gql`
  mutation ResetBlockchainNetworkConfig($network: BlockchainNetwork!) {
    resetBlockchainNetworkConfig(network: $network) {
      network
      rpcUrl
      explorerApiUrl
      source
      updatedAt
    }
  }
`;

