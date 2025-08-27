import { graphql } from "@/gql";

export const PORTFOLIO_UPDATE_SUBSCRIPTION = graphql(/* GraphQL */ `
  subscription PortfolioUpdateSubscription($userID: ID!) {
    portfolioUpdates(userID: $userID) {
      type
      portfolio {
        id
        name
      }
    }
  }
`);
