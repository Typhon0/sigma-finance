import { gql } from "@apollo/client";

/**
 * Watchlist result fragment.
 *
 * Kept to the id/name pair: the mutation cache update only needs to merge the
 * created list into any `WatchlistsRoot` container; asset membership lives on
 * the server's join and is re-read fresh.
 */
export const WATCHLIST_RESULT_FRAGMENT = gql`
  fragment WatchlistResult on Watchlist {
    id
    name
    createdAt
  }
`;

export const CREATE_WATCHLIST = gql`
  mutation CreateWatchlist($input: CreateWatchlistInput!) {
    createWatchlist(input: $input) {
      id
      name
    }
  }
`;

export const ADD_ASSET_TO_WATCHLIST = gql`
  ${WATCHLIST_RESULT_FRAGMENT}
  mutation AddAssetToWatchlist($watchlistID: ID!, $assetID: ID!) {
    addAssetToWatchlist(watchlistID: $watchlistID, assetID: $assetID) {
      ...WatchlistResult
    }
  }
`;
