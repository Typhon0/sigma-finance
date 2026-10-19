import { graphql } from "@/gql";

/**
 * Full portfolio snapshot for export.
 *
 * Deliberately separate from the queries the UI uses. An export is a
 * standalone artefact that gets handed to an accountant or attached to an
 * email, so it cannot lean on a query whose selection set exists to paint a
 * screen. It asks for the fields the CSV/JSON writers emit and nothing else.
 *
 * The fields below line up one-to-one with `PortfolioExportData` in
 * lib/export/types.ts. `averagePurchasePrice` is the per-unit cost, so the
 * service multiplies it by quantity rather than receiving a pre-computed basis.
 */
export const EXPORT_PORTFOLIO = graphql(/* GraphQL */ `
  query ExportPortfolio($id: ID!) {
    portfolio(id: $id) {
      id
      name
      createdAt
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
        displayCurrency
        isStale
      }
      assets {
        quantity
        averagePurchasePrice
        currentValue
        ownershipPct
        quoteCurrency
        asset {
          id
          name
          symbol
          currentValue
          assetType {
            name
          }
        }
      }
    }
  }
`);

/**
 * Transaction history for export.
 *
 * The filter is applied server-side and the page size is deliberately large:
 * an export that silently truncates at 20 rows produces a file that looks
 * complete and is not. `PAGE_SIZE` is the ceiling we ask for; the service
 * reports when the server returns exactly that many, because that is the point
 * at which the user must be told the file may be incomplete.
 */
export const EXPORT_TRANSACTIONS = graphql(/* GraphQL */ `
  query ExportTransactions($filter: TransactionFilter, $pagination: PaginationInput) {
    transactions(filter: $filter, pagination: $pagination) {
      id
      transactionType
      quantity
      unitPriceAmount
      unitPriceCurrency
      feesAmount
      feesCurrency
      executedAt
      notes
      asset {
        name
        symbol
      }
    }
  }
`);

/**
 * Every portfolio a user can see, for the "complete data backup".
 *
 * Only the ids and names are needed here: the service then loads each
 * portfolio in full through EXPORT_PORTFOLIO, which keeps the two shapes from
 * drifting apart.
 */
export const EXPORT_USER_PORTFOLIOS = graphql(/* GraphQL */ `
  query ExportUserPortfolios($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
    }
  }
`);

/**
 * Rows requested per page when exporting.
 *
 * Not a limit the server enforces as a hard cap, but the largest page we ask
 * for in one request. `EXPORT_TRANSACTIONS` returns a bare list with no
 * totalCount, so hitting this number exactly means the caller has to check
 * whether more exist rather than assume this is everything.
 */
export const EXPORT_PAGE_SIZE = 1000;
