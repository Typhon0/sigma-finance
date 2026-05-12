import { graphql } from "@/gql";

export const UPDATE_TRANSACTION = graphql(/* GraphQL */ `
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id
      quantity
      unitPriceAmount
      executedAt
      notes
      transactionType
      feesAmount
      feesCurrency
    }
  }
`);
