import { graphql } from "@/gql";

export const CREATE_PORTFOLIO = graphql(/* GraphQL */ `
  mutation CreatePortfolio($input: CreatePortfolioInput!) {
    createPortfolio(input: $input) {
      id
      name
      description
      sortOrder
    }
  }
`);

export const UPDATE_PORTFOLIO = graphql(/* GraphQL */ `
  mutation UpdatePortfolio($id: ID!, $input: UpdatePortfolioInput!) {
    updatePortfolio(id: $id, input: $input) {
      id
      name
      description
      sortOrder
    }
  }
`);

export const DELETE_PORTFOLIO = graphql(/* GraphQL */ `
  mutation DeletePortfolio($id: ID!) {
    deletePortfolio(id: $id)
  }
`);

export const DUPLICATE_PORTFOLIO = graphql(/* GraphQL */ `
  mutation DuplicatePortfolio($input: DuplicatePortfolioInput!) {
    duplicatePortfolio(input: $input) {
      id
      name
      description
      sortOrder
    }
  }
`);
