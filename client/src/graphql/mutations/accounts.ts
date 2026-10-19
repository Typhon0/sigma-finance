import { gql } from "@apollo/client";

export const CREATE_ACCOUNT = gql`
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
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
      positionsCount
      totalValue
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_ACCOUNT = gql`
  mutation UpdateAccount($id: ID!, $input: UpdateAccountInput!) {
    updateAccount(id: $id, input: $input) {
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
      positionsCount
      totalValue
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`;
