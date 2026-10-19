import { gql } from "@apollo/client";

export const GET_TAX_LOTS_BY_POSITION = gql`
  query GetTaxLotsByPosition($positionId: ID!) {
    taxLotsByPosition(positionId: $positionId) {
      id
      portfolioId
      positionId
      assetId
      transactionId
      acquiredAt
      initialQuantity
      remainingQuantity
      costBasisPerUnit
      totalCostBasis
      currency
      status
      holdingPeriodDays
      isLongTerm
      currentPrice
      currentValue
      unrealizedGainLoss
      unrealizedGainLossPercent
    }
  }
`;

// Fiscal (lot-matched) realized gain/loss records per disposal.
// Distinct from economic P/L — these rows feed tax reporting.
export const GET_DISPOSITIONS_BY_POSITION = gql`
  query GetDispositionsByPosition($positionId: ID!) {
    dispositionsByPosition(positionId: $positionId) {
      id
      lotId
      positionId
      portfolioId
      assetId
      transactionId
      acquiredAt
      soldAt
      quantity
      costBasisPerUnit
      sellPricePerUnit
      costBasis
      proceeds
      realizedGainLoss
      method
      holdingPeriodDays
      isLongTerm
      isTaxExempt
    }
  }
`;

export const GET_TAX_HARVEST_OPPORTUNITIES = gql`
  query GetTaxHarvestOpportunities($portfolioId: ID!) {
    taxHarvestOpportunities(portfolioId: $portfolioId) {
      positionId
      symbol
      name
      harvestableLoss
      eligibleLotsCount
    }
  }
`;

export const GET_REALIZED_GAINS = gql`
  query GetRealizedGains($portfolioId: ID!, $dateFrom: Time!, $dateTo: Time!) {
    realizedGains(portfolioId: $portfolioId, dateFrom: $dateFrom, dateTo: $dateTo) {
      portfolioId
      dateFrom
      dateTo
      totalRealized
      shortTermGains
      longTermGains
      dispositionCount
      transactionCount
      taxWrapper
      taxJurisdiction
      isTaxExempt
    }
  }
`;
