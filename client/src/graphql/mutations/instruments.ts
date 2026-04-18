import { graphql } from "@/gql";

export const PERSIST_DISCOVERED_INSTRUMENT = graphql(/* GraphQL */ `
	mutation PersistDiscoveredInstrument($input: PersistDiscoveredInstrumentInput!) {
		persistDiscoveredInstrument(input: $input) {
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
			isin
			figi
			cusip
			firstSeenAt
			lastVerifiedAt
			lastUsedAt
			createdAt
			updatedAt
		}
	}
`);

export const ADD_INSTRUMENT_TO_PORTFOLIO = graphql(/* GraphQL */ `
	mutation AddInstrumentToPortfolio($input: AddInstrumentHoldingInput!) {
		addInstrumentToPortfolio(input: $input) {
			instrumentID
			quantity
			averagePurchasePrice
			currentValue
			dayChange
			dayChangePercent
		}
	}
`);

export const UPDATE_MANUAL_INSTRUMENT = graphql(/* GraphQL */ `
	mutation UpdateManualInstrument($id: ID!, $input: UpdateManualInstrumentInput!) {
		updateManualInstrument(id: $id, input: $input) {
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
	}
`);

export const ARCHIVE_MANUAL_INSTRUMENT = graphql(/* GraphQL */ `
	mutation ArchiveManualInstrument($id: ID!) {
		archiveManualInstrument(id: $id) {
			id
			status
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
	}
`);

export const RESTORE_MANUAL_INSTRUMENT = graphql(/* GraphQL */ `
	mutation RestoreManualInstrument($id: ID!) {
		restoreManualInstrument(id: $id) {
			id
			status
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
	}
`);
