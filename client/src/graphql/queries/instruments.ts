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
					sector
					assetType
					providerSource
					providerExternalId
					isin
					figi
					cusip
					industry
					website
					family
					category
					city
					state
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
				source
				externalId
				marketCapRank
				imageUrl
				platforms {
					platform
					address
				}
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
			coverageStatus
			errorMessage
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
				summary
				sector
				industryGroup
				industry
				categoryGroup
				category
				family
				website
				marketCap
				state
				city
				zipcode
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

export const LATEST_HISTORICAL_DATA_BACKFILL_JOB = graphql(/* GraphQL */ `
	query LatestHistoricalDataBackfillJob($portfolioId: ID!, $assetId: ID!) {
		latestHistoricalDataBackfillJob(portfolioId: $portfolioId, assetId: $assetId) {
			id
			status
			step
			progress
			rowsWritten
			errorCode
			errorMessage
			createdAt
			startedAt
			finishedAt
		}
	}
`);

export const HISTORICAL_DATA_BACKFILL_JOBS = graphql(/* GraphQL */ `
	query HistoricalDataBackfillJobs(
		$filter: HistoricalDataBackfillJobFilterInput
		$pagination: PaginationInput
	) {
		historicalDataBackfillJobs(filter: $filter, pagination: $pagination) {
			id
			userId
			portfolioId
			assetId
			instrumentId
			provider
			status
			step
			progress
			rowsWritten
			errorCode
			errorMessage
			requestedFrom
			requestedTo
			createdAt
			startedAt
			finishedAt
		}
	}
`);
