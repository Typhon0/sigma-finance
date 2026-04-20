import { gql } from "@apollo/client";

export const UPDATE_USER_DISPLAY_CURRENCY_MUTATION = gql`
  mutation UpdateUserDisplayCurrency($input: UpdateUserDisplayCurrencyInput!) {
    updateUserDisplayCurrency(input: $input) {
      id
      displayCurrency
    }
  }
`;
