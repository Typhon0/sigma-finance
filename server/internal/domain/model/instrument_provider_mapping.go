package model

import (
	"time"

	"github.com/uptrace/bun"
)

type InstrumentProviderMappingStatus string

const (
	InstrumentProviderMappingStatusVerified InstrumentProviderMappingStatus = "VERIFIED"
	InstrumentProviderMappingStatusUnmapped InstrumentProviderMappingStatus = "UNMAPPED"
	InstrumentProviderMappingStatusStale    InstrumentProviderMappingStatus = "STALE"
	InstrumentProviderMappingStatusInvalid  InstrumentProviderMappingStatus = "INVALID"
)

type InstrumentProviderMapping struct {
	bun.BaseModel `bun:"table:sigma_finance.instrument_provider_mappings"`

	ID              string                          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	InstrumentID    string                          `bun:"instrument_id,notnull,type:uuid"`
	Provider        string                          `bun:"provider,notnull"`
	ProviderAssetID string                          `bun:"provider_asset_id,notnull"`
	ProviderSymbol  *string                         `bun:"provider_symbol"`
	ProviderMarket  *string                         `bun:"provider_market"`
	QuoteCurrency   *string                         `bun:"quote_currency"`
	MappingStatus   InstrumentProviderMappingStatus `bun:"mapping_status,notnull,default:'UNMAPPED'"`
	LastVerifiedAt  *time.Time                      `bun:"last_verified_at"`
	LastErrorText   *string                         `bun:"last_error_text"`
	CreatedAt       time.Time                       `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt       time.Time                       `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}
