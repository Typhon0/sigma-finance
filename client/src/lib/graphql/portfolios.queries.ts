import { gql } from "@apollo/client";

export const GET_PORTFOLIOS_WITH_ANALYTICS = gql`
	query GetPortfoliosWithAnalytics($userID: ID!) {
		portfolios(filter: { userID: $userID }) {
			id
			name
			description
			assets {
				quantity
			}
			analytics {
				totalValue
				totalGainLossPercent
			}
		}
	}
`;
