import { gql } from "@apollo/client";

export const GET_ACCOUNTS = gql`
  query GetAccounts($portfolioId: ID) {
    accounts(portfolioId: $portfolioId) {
      id
      portfolioId
      name
      type
      taxWrapper
      institution
      accountNumber
      currency
      syncProvider
      ownershipPercentage
      coOwnerName
      coOwnerUserId
      coOwnerUser {
        id
        username
        email
      }
      externalId
      syncConnection {
        id
        provider
        syncStatus
        lastSyncAt
        lastError
      }
      positionsCount
      totalValue
      createdAt
      updatedAt
    }
  }
`;

export const GET_ACCOUNT = gql`
  query GetAccount($id: ID!) {
    account(id: $id) {
      id
      portfolioId
      name
      type
      taxWrapper
      institution
      accountNumber
      currency
      syncProvider
      ownershipPercentage
      coOwnerName
      coOwnerUserId
      coOwnerUser {
        id
        username
        email
      }
      externalId
      syncConnection {
        id
        provider
        syncStatus
        lastSyncAt
        lastError
      }
      positionsCount
      totalValue
      createdAt
      updatedAt
    }
  }
`;

export const GET_CO_OWNER_CANDIDATES = gql`
  query GetCoOwnerCandidates($search: String) {
    coOwnerCandidates(search: $search) {
      id
      name
      email
    }
  }
`;

