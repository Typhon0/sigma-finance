package catalog

import (
	"time"

	"sigma_finance/internal/domain/model"
)

type DiscoveryInstrument struct {
	Symbol             string                    `json:"symbol"`
	Name               string                    `json:"name"`
	Exchange           string                    `json:"exchange"`
	ExchangeCode       *string                   `json:"exchangeCode,omitempty"`
	Country            *string                   `json:"country,omitempty"`
	Currency           *string                   `json:"currency,omitempty"`
	AssetType          model.InstrumentAssetType `json:"assetType"`
	ProviderSource     string                    `json:"providerSource"`
	ProviderExternalID *string                   `json:"providerExternalId,omitempty"`
	ISIN               *string                   `json:"isin,omitempty"`
	FIGI               *string                   `json:"figi,omitempty"`
	CUSIP              *string                   `json:"cusip,omitempty"`
}

type SourceInstrument struct {
	DiscoveryInstrument
	Summary          *string        `json:"summary,omitempty"`
	Sector           *string        `json:"sector,omitempty"`
	IndustryGroup    *string        `json:"industryGroup,omitempty"`
	Industry         *string        `json:"industry,omitempty"`
	CategoryGroup    *string        `json:"categoryGroup,omitempty"`
	Category         *string        `json:"category,omitempty"`
	Family           *string        `json:"family,omitempty"`
	Website          *string        `json:"website,omitempty"`
	MarketCap        *string        `json:"marketCap,omitempty"`
	State            *string        `json:"state,omitempty"`
	City             *string        `json:"city,omitempty"`
	Zipcode          *string        `json:"zipcode,omitempty"`
	BaseCurrency     *string        `json:"baseCurrency,omitempty"`
	QuoteCurrency    *string        `json:"quoteCurrency,omitempty"`
	UnderlyingSymbol *string        `json:"underlyingSymbol,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
	SourceFile       string         `json:"sourceFile,omitempty"`
	SourceVersion    string         `json:"sourceVersion,omitempty"`
	ImportedAt       time.Time      `json:"importedAt,omitempty"`
}
