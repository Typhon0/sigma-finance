import { gql } from "@apollo/client";

export const ESTIMATE_REAL_ESTATE = gql`
  query EstimateRealEstate($input: RealEstateEstimationInput!) {
    estimateRealEstate(input: $input) {
      estimatedValue
      estimatedMin
      estimatedMax
      estimatedPricePerM2
      basePricePerM2
      confidence
      method
      comparablesCount
      searchRadiusMeters
      lastEstimatedAt
      rentalMarket {
        marketRentPerM2
        estimatedMonthlyRent
        estimatedGrossYield
        isCommuneLevel
        r2Adjusted
        sourceLabel
      }
    }
  }
`;

export const FETCH_ADEME_DPE = gql`
  query FetchADEMEDpe($banId: String!, $surfaceM2: Float!, $propertyType: String) {
    fetchADEMEDpe(banId: $banId, surfaceM2: $surfaceM2, propertyType: $propertyType) {
      rating
      surfaceM2
      diagnosticDate
      sourceDataset
    }
  }
`;

export const GET_COMMUNE_RENTAL_INDICATORS = gql`
  query GetCommuneRentalIndicators(
    $cityCode: String!
    $propertyType: String
    $roomsCount: Int
    $surfaceM2: Float
    $propertyValue: Float
  ) {
    getCommuneRentalIndicators(
      cityCode: $cityCode
      propertyType: $propertyType
      roomsCount: $roomsCount
      surfaceM2: $surfaceM2
      propertyValue: $propertyValue
    ) {
      marketRentPerM2
      estimatedMonthlyRent
      estimatedGrossYield
      isCommuneLevel
      r2Adjusted
      sourceLabel
    }
  }
`;
