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
