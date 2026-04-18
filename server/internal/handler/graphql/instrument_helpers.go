package graphql

import (
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/service"
)

func mapGQLInstrumentAssetTypeToDomain(assetType gqlModel.InstrumentAssetType) model.InstrumentAssetType {
	switch assetType {
	case gqlModel.InstrumentAssetTypeEtf:
		return model.InstrumentAssetTypeETF
	case gqlModel.InstrumentAssetTypeFund:
		return model.InstrumentAssetTypeFund
	case gqlModel.InstrumentAssetTypeIndex:
		return model.InstrumentAssetTypeIndex
	case gqlModel.InstrumentAssetTypeCurrency:
		return model.InstrumentAssetTypeCurrency
	case gqlModel.InstrumentAssetTypeCrypto:
		return model.InstrumentAssetTypeCrypto
	case gqlModel.InstrumentAssetTypeMoneyMarket:
		return model.InstrumentAssetTypeMoneyMarket
	default:
		return model.InstrumentAssetTypeStock
	}
}

func mapDomainInstrumentAssetTypeToGQL(assetType model.InstrumentAssetType) gqlModel.InstrumentAssetType {
	switch assetType {
	case model.InstrumentAssetTypeETF:
		return gqlModel.InstrumentAssetTypeEtf
	case model.InstrumentAssetTypeFund:
		return gqlModel.InstrumentAssetTypeFund
	case model.InstrumentAssetTypeIndex:
		return gqlModel.InstrumentAssetTypeIndex
	case model.InstrumentAssetTypeCurrency:
		return gqlModel.InstrumentAssetTypeCurrency
	case model.InstrumentAssetTypeCrypto:
		return gqlModel.InstrumentAssetTypeCrypto
	case model.InstrumentAssetTypeMoneyMarket:
		return gqlModel.InstrumentAssetTypeMoneyMarket
	default:
		return gqlModel.InstrumentAssetTypeStock
	}
}

func mapInstrumentSearchFilter(input gqlModel.InstrumentSearchInput) service.InstrumentSearchFilter {
	filter := service.InstrumentSearchFilter{
		Limit:  20,
		Offset: 0,
	}
	if input.Limit != nil && *input.Limit > 0 {
		filter.Limit = int(*input.Limit)
	}
	if input.Offset != nil && *input.Offset > 0 {
		filter.Offset = int(*input.Offset)
	}
	if input.Exchange != nil {
		exchange := *input.Exchange
		filter.Exchange = &exchange
	}
	if len(input.AssetTypes) > 0 {
		assetTypes := make([]model.InstrumentAssetType, 0, len(input.AssetTypes))
		for _, assetType := range input.AssetTypes {
			assetTypes = append(assetTypes, mapGQLInstrumentAssetTypeToDomain(assetType))
		}
		filter.AssetTypes = assetTypes
	}
	return filter
}

func mapInstrumentDetailsToGraphQL(details *service.InstrumentDetails) *gqlModel.Instrument {
	if details == nil || details.Instrument == nil {
		return nil
	}

	return &gqlModel.Instrument{
		ID:                 details.Instrument.ID,
		Symbol:             details.Instrument.Symbol,
		NormalizedSymbol:   details.Instrument.NormalizedSymbol,
		Name:               details.Instrument.Name,
		NormalizedName:     details.Instrument.NormalizedName,
		Exchange:           details.Instrument.Exchange,
		ExchangeCode:       details.Instrument.ExchangeCode,
		Country:            details.Instrument.Country,
		Currency:           details.Instrument.Currency,
		Summary:            details.Instrument.Summary,
		Sector:             details.Instrument.Sector,
		IndustryGroup:      details.Instrument.IndustryGroup,
		Industry:           details.Instrument.Industry,
		CategoryGroup:      details.Instrument.CategoryGroup,
		Category:           details.Instrument.Category,
		Family:             details.Instrument.Family,
		Website:            details.Instrument.Website,
		MarketCap:          details.Instrument.MarketCap,
		State:              details.Instrument.State,
		City:               details.Instrument.City,
		Zipcode:            details.Instrument.Zipcode,
		BaseCurrency:       details.Instrument.BaseCurrency,
		QuoteCurrency:      details.Instrument.QuoteCurrency,
		UnderlyingSymbol:   details.Instrument.UnderlyingSymbol,
		AssetType:          mapDomainInstrumentAssetTypeToGQL(details.Instrument.AssetType),
		Status:             string(details.Instrument.Status),
		ProviderSource:     details.Instrument.ProviderSource,
		ProviderExternalID: details.Instrument.ProviderExternalID,
		Isin:               details.Instrument.ISIN,
		Figi:               details.Instrument.FIGI,
		Cusip:              details.Instrument.CUSIP,
		FirstSeenAt:        details.Instrument.FirstSeenAt,
		LastVerifiedAt:     details.Instrument.LastVerifiedAt,
		LastUsedAt:         details.Instrument.LastUsedAt,
		CreatedAt:          details.Instrument.CreatedAt,
		UpdatedAt:          details.Instrument.UpdatedAt,
		Aliases:            mapInstrumentAliases(details.Aliases),
		SyncState:          mapInstrumentSyncState(details.SyncState),
	}
}

func mapInstrumentAliases(aliases []model.InstrumentAlias) []*gqlModel.InstrumentAlias {
	result := make([]*gqlModel.InstrumentAlias, 0, len(aliases))
	for _, alias := range aliases {
		aliasCopy := alias
		result = append(result, &gqlModel.InstrumentAlias{
			ID:                  aliasCopy.ID,
			InstrumentID:        aliasCopy.InstrumentID,
			AliasText:           aliasCopy.AliasText,
			NormalizedAliasText: aliasCopy.NormalizedAliasText,
			AliasType:           string(aliasCopy.AliasType),
			CreatedAt:           aliasCopy.CreatedAt,
		})
	}
	return result
}

func mapInstrumentSyncState(state *model.InstrumentSyncState) *gqlModel.InstrumentSyncState {
	if state == nil {
		return nil
	}
	return &gqlModel.InstrumentSyncState{
		InstrumentID:           state.InstrumentID,
		LastSyncAttempt:        state.LastSyncAttempt,
		LastSyncSuccess:        state.LastSyncSuccess,
		SyncStatus:             string(state.SyncStatus),
		LastSyncSource:         state.LastSyncSource,
		SyncErrorMessage:       state.SyncErrorMessage,
		Stale:                  state.Stale,
		VerificationConfidence: int32(state.VerificationConfidence),
		CreatedAt:              state.CreatedAt,
		UpdatedAt:              state.UpdatedAt,
	}
}

func mapInstrumentSearchPayloadToGraphQL(payload *service.InstrumentSearchPayload) *gqlModel.InstrumentSearchPayload {
	if payload == nil {
		return nil
	}

	localResults := make([]*gqlModel.InstrumentSearchResult, 0, len(payload.LocalResults))
	for _, result := range payload.LocalResults {
		localResults = append(localResults, &gqlModel.InstrumentSearchResult{
			Instrument:   mapInstrumentDetailsToGraphQL(&service.InstrumentDetails{Instrument: result.Instrument}),
			Score:        result.Score,
			MatchedAlias: result.MatchedAlias,
		})
	}

	var onlineResults []*gqlModel.OnlineInstrumentResult
	if len(payload.OnlineResults) > 0 {
		onlineResults = make([]*gqlModel.OnlineInstrumentResult, 0, len(payload.OnlineResults))
		for _, result := range payload.OnlineResults {
			onlineResults = append(onlineResults, mapDiscoveryInstrumentToGraphQL(result))
		}
	}

	return &gqlModel.InstrumentSearchPayload{
		LocalResults:    localResults,
		CanSearchOnline: payload.CanSearchOnline,
		QueryMetadata:   mapInstrumentQueryMetadata(payload.QueryMetadata),
		OnlineResults:   onlineResults,
	}
}

func mapOnlineSearchPayloadToGraphQL(payload *service.OnlineInstrumentSearchPayload) *gqlModel.OnlineInstrumentSearchPayload {
	if payload == nil {
		return nil
	}

	results := make([]*gqlModel.OnlineInstrumentResult, 0, len(payload.OnlineResults))
	for _, result := range payload.OnlineResults {
		results = append(results, mapDiscoveryInstrumentToGraphQL(result))
	}

	return &gqlModel.OnlineInstrumentSearchPayload{
		OnlineResults: results,
		QueryMetadata: mapInstrumentQueryMetadata(payload.QueryMetadata),
		ProviderUsed:  payload.ProviderUsed,
	}
}

func mapInstrumentQueryMetadata(metadata service.InstrumentQueryMetadata) *gqlModel.InstrumentQueryMetadata {
	return &gqlModel.InstrumentQueryMetadata{
		Query:            metadata.Query,
		Limit:            int32(metadata.Limit),
		Offset:           int32(metadata.Offset),
		LocalCount:       int32(metadata.LocalCount),
		TopScore:         metadata.TopScore,
		WeakResults:      metadata.WeakResults,
		SearchOnlineHint: metadata.SearchOnlineHint,
	}
}

func mapDiscoveryInstrumentToGraphQL(instrument service.DiscoveryInstrument) *gqlModel.OnlineInstrumentResult {
	return &gqlModel.OnlineInstrumentResult{
		Symbol:             instrument.Symbol,
		Name:               instrument.Name,
		Exchange:           instrument.Exchange,
		ExchangeCode:       instrument.ExchangeCode,
		Country:            instrument.Country,
		Currency:           instrument.Currency,
		AssetType:          mapDomainInstrumentAssetTypeToGQL(instrument.AssetType),
		ProviderSource:     instrument.ProviderSource,
		ProviderExternalID: instrument.ProviderExternalID,
		Isin:               instrument.ISIN,
		Figi:               instrument.FIGI,
		Cusip:              instrument.CUSIP,
	}
}

func mapFinanceDatabaseSyncStatusPayload(payload *service.FinanceDatabaseSyncStatusPayload) *gqlModel.FinanceDatabaseSyncStatusPayload {
	if payload == nil {
		return nil
	}
	items := make([]*gqlModel.FinanceDatabaseSyncItem, 0, len(payload.AssetTypes))
	for _, item := range payload.AssetTypes {
		itemCopy := item
		items = append(items, mapFinanceDatabaseSyncItem(&itemCopy))
	}
	return &gqlModel.FinanceDatabaseSyncStatusPayload{AssetTypes: items}
}

func mapFinanceDatabaseSyncItem(item *service.FinanceDatabaseSyncItem) *gqlModel.FinanceDatabaseSyncItem {
	if item == nil {
		return nil
	}
	var progress *int32
	if item.Progress != nil {
		value := int32(*item.Progress)
		progress = &value
	}
	return &gqlModel.FinanceDatabaseSyncItem{
		AssetType:     gqlModel.AssetSyncType(item.AssetType),
		IsEnabled:     item.IsEnabled,
		LastSynced:    item.LastSynced,
		RecordCount:   int32(item.RecordCount),
		SyncStatus:    gqlModel.SyncStatus(item.SyncStatus),
		Progress:      progress,
		CurrentRecord: item.CurrentRecord,
		ErrorMessage:  item.ErrorMessage,
	}
}

func mapFinanceDatabaseSyncHistoryEntry(entry *service.FinanceDatabaseSyncHistoryEntry) *gqlModel.FinanceDatabaseSyncHistoryEntry {
	if entry == nil {
		return nil
	}
	return &gqlModel.FinanceDatabaseSyncHistoryEntry{
		ID:           entry.ID,
		Timestamp:    entry.Timestamp,
		AssetType:    gqlModel.AssetSyncType(entry.AssetType),
		RecordCount:  int32(entry.RecordCount),
		Status:       gqlModel.SyncStatus(entry.Status),
		ErrorMessage: entry.ErrorMessage,
	}
}

func mapFinanceDatabasePreviewItem(item *service.FinanceDatabasePreviewItem) *gqlModel.FinanceDatabasePreviewItem {
	if item == nil {
		return nil
	}
	return &gqlModel.FinanceDatabasePreviewItem{
		Symbol:   item.Symbol,
		Name:     item.Name,
		Exchange: item.Exchange,
		Sector:   item.Sector,
		Country:  item.Country,
	}
}

func intOrDefault(value *int32, fallback int) int {
	if value == nil || *value <= 0 {
		return fallback
	}
	return int(*value)
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func mapPortfolioAssetToGQLWithAssetAndInstrument(pa model.PortfolioAsset, asset gqlModel.Asset, instrumentID *string) *gqlModel.PortfolioAsset {
	result := mapPortfolioAssetToGQLWithAsset(pa, asset)
	if result != nil {
		result.InstrumentID = instrumentID
	}
	return result
}
