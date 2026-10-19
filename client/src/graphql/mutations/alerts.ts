import { gql } from "@apollo/client";

/**
 * Alert result fragment.
 *
 * The full Alert shape is small; reading it back complete means a subsequent
 * `alerts(...)` query against the same object can be served entirely from the
 * cache without a network round trip.
 */
export const ALERT_RESULT_FRAGMENT = gql`
  fragment AlertResult on Alert {
    id
    userId
    assetId
    portfolioId
    alertType
    conditionType
    thresholdValue
    thresholdPercentage
    isActive
    lastTriggered
    notificationMethods
    createdAt
    updatedAt
  }
`;

export const CREATE_ALERT = gql`
  ${ALERT_RESULT_FRAGMENT}
  mutation CreateAlert($input: CreateAlertInput!) {
    createAlert(input: $input) {
      ...AlertResult
    }
  }
`;
