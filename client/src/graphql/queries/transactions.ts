import { graphql } from "@/gql";

export const GET_TRANSACTIONS_BY_ACCOUNT = graphql(/* GraphQL */ `
  query GetTransactionsByAccount($filter: TransactionFilter, $pagination: PaginationInput) {
    transactions(filter: $filter, pagination: $pagination) {
      id
      accountId
      transactionType
      quantity
      amount
      unitPriceAmount
      unitPriceCurrency
      feesAmount
      feesCurrency
      executedAt
      notes
      account {
        id
        name
        institution
      }
      asset {
        id
        symbol
        name
      }
      portfolio {
        id
        name
      }
    }
  }
`);

export const GET_ALL_TRANSACTIONS = graphql(/* GraphQL */ `
  query GetAllTransactions($filter: TransactionFilter, $pagination: PaginationInput) {
    transactions(filter: $filter, pagination: $pagination) {
      id
      accountId
      transactionType
      quantity
      amount
      unitPriceAmount
      unitPriceCurrency
      feesAmount
      feesCurrency
      executedAt
      notes
      account {
        id
        name
        institution
      }
      asset {
        id
        symbol
        name
      }
      portfolio {
        id
        name
      }
    }
  }
`);
