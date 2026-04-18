import { graphql } from "@/gql";

export const SEARCH_INSTRUMENTS = graphql(/* GraphQL */ `
	query SearchInstruments($input: InstrumentSearchInput!) {
		searchInstruments(input: $input) {
			localResults {
				instrument {
					id
					symbol
					name
					exchange
					exchangeCode
					country
					currency
					assetType
					providerSource
					providerExternalId
				}
				score
				matchedAlias
			}
			canSearchOnline
			queryMetadata {
				query
				limit
				offset
				localCount
				topScore
				weakResults
				searchOnlineHint
			}
		}
	}
`);

export const SEARCH_INSTRUMENTS_ONLINE = graphql(/* GraphQL */ `
	query SearchInstrumentsOnline($input: InstrumentSearchInput!) {
		searchInstrumentsOnline(input: $input) {
			onlineResults {
				symbol
				name
				exchange
				exchangeCode
				country
				currency
				assetType
				providerSource
				providerExternalId
				isin
				figi
				cusip
			}
			queryMetadata {
				query
				limit
				offset
				localCount
				topScore
				weakResults
				searchOnlineHint
			}
			providerUsed
		}
	}
`);

export const MANUAL_INSTRUMENTS = graphql(/* GraphQL */ `
	query ManualInstruments($filter: ManualInstrumentFilterInput, $pagination: PaginationInput) {
		manualInstruments(filter: $filter, pagination: $pagination) {
			items {
				id
				symbol
				normalizedSymbol
				name
				normalizedName
				exchange
				exchangeCode
				country
				currency
				baseCurrency
				quoteCurrency
				underlyingSymbol
				assetType
				status
				providerSource
				providerExternalId
				firstSeenAt
				lastVerifiedAt
				lastUsedAt
				createdAt
				updatedAt
				syncState {
					instrumentID
					syncStatus
					stale
					verificationConfidence
					lastSyncAttempt
					lastSyncSuccess
					lastSyncSource
					syncErrorMessage
					createdAt
					updatedAt
				}
			}
			hasMore
			limit
			offset
		}
	}
`);
