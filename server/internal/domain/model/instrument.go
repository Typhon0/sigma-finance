package model

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

type InstrumentAssetType string

const (
	InstrumentAssetTypeStock       InstrumentAssetType = "STOCK"
	InstrumentAssetTypeETF         InstrumentAssetType = "ETF"
	InstrumentAssetTypeFund        InstrumentAssetType = "FUND"
	InstrumentAssetTypeIndex       InstrumentAssetType = "INDEX"
	InstrumentAssetTypeCurrency    InstrumentAssetType = "CURRENCY"
	InstrumentAssetTypeCrypto      InstrumentAssetType = "CRYPTO"
	InstrumentAssetTypeMoneyMarket InstrumentAssetType = "MONEY_MARKET"
)

func (t InstrumentAssetType) IsValid() bool {
	switch t {
	case InstrumentAssetTypeStock, InstrumentAssetTypeETF, InstrumentAssetTypeFund, InstrumentAssetTypeIndex, InstrumentAssetTypeCurrency, InstrumentAssetTypeCrypto, InstrumentAssetTypeMoneyMarket:
		return true
	default:
		return false
	}
}

type InstrumentStatus string

const (
	InstrumentStatusActive   InstrumentStatus = "ACTIVE"
	InstrumentStatusStale    InstrumentStatus = "STALE"
	InstrumentStatusDelisted InstrumentStatus = "DELISTED"
	InstrumentStatusArchived InstrumentStatus = "ARCHIVED"
	InstrumentStatusUnknown  InstrumentStatus = "UNKNOWN"
)

func (s InstrumentStatus) IsValid() bool {
	switch s {
	case InstrumentStatusActive, InstrumentStatusStale, InstrumentStatusDelisted, InstrumentStatusArchived, InstrumentStatusUnknown:
		return true
	default:
		return false
	}
}

type InstrumentAliasType string

const (
	InstrumentAliasTypeSymbol        InstrumentAliasType = "SYMBOL"
	InstrumentAliasTypeName          InstrumentAliasType = "NAME"
	InstrumentAliasTypeIssuer        InstrumentAliasType = "ISSUER"
	InstrumentAliasTypeIndustryGroup InstrumentAliasType = "INDUSTRY_GROUP"
	InstrumentAliasTypeSector        InstrumentAliasType = "SECTOR"
	InstrumentAliasTypeIndustry      InstrumentAliasType = "INDUSTRY"
	InstrumentAliasTypeCategoryGroup InstrumentAliasType = "CATEGORY_GROUP"
	InstrumentAliasTypeCategory      InstrumentAliasType = "CATEGORY"
	InstrumentAliasTypeFamily        InstrumentAliasType = "FAMILY"
	InstrumentAliasTypeManual        InstrumentAliasType = "MANUAL"
	InstrumentAliasTypeProvider      InstrumentAliasType = "PROVIDER"
)

type InstrumentSyncStatus string

const (
	InstrumentSyncStatusPending InstrumentSyncStatus = "PENDING"
	InstrumentSyncStatusSynced  InstrumentSyncStatus = "SYNCED"
	InstrumentSyncStatusFailed  InstrumentSyncStatus = "FAILED"
	InstrumentSyncStatusStale   InstrumentSyncStatus = "STALE"
)

type Instrument struct {
	bun.BaseModel `bun:"table:sigma_finance.instruments"`

	ID                     string              `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Symbol                 string              `bun:"symbol,notnull"`
	NormalizedSymbol       string              `bun:"normalized_symbol,notnull"`
	Name                   string              `bun:"name,notnull"`
	NormalizedName         string              `bun:"normalized_name,notnull"`
	Exchange               string              `bun:"exchange,notnull"`
	ExchangeCode           *string             `bun:"exchange_code"`
	Country                *string             `bun:"country"`
	Currency               *string             `bun:"currency"`
	Summary                *string             `bun:"summary"`
	Sector                 *string             `bun:"sector"`
	IndustryGroup          *string             `bun:"industry_group"`
	Industry               *string             `bun:"industry"`
	CategoryGroup          *string             `bun:"category_group"`
	Category               *string             `bun:"category"`
	Family                 *string             `bun:"family"`
	Website                *string             `bun:"website"`
	MarketCap              *string             `bun:"market_cap"`
	State                  *string             `bun:"state"`
	City                   *string             `bun:"city"`
	Zipcode                *string             `bun:"zipcode"`
	BaseCurrency           *string             `bun:"base_currency"`
	QuoteCurrency          *string             `bun:"quote_currency"`
	UnderlyingSymbol       *string             `bun:"underlying_symbol"`
	AssetType              InstrumentAssetType `bun:"asset_type,notnull"`
	Status                 InstrumentStatus    `bun:"status,notnull"`
	ProviderSource         string              `bun:"provider_source,notnull"`
	ProviderExternalID     *string             `bun:"provider_external_id"`
	ExternalSource         *string             `bun:"external_source"`
	ExternalID             *string             `bun:"external_id"`
	PlatformsJSON          json.RawMessage     `bun:"platforms_json,type:jsonb"`
	PrimaryContractAddress *string             `bun:"primary_contract_address"`
	InstrumentStatus       *string             `bun:"instrument_status"`
	MarketCapRank          *int                `bun:"market_cap_rank"`
	ImageURL               *string             `bun:"image_url"`
	MetadataUpdatedAt      *time.Time          `bun:"metadata_updated_at"`
	OwnerUserID            *string             `bun:"owner_user_id"`
	ISIN                   *string             `bun:"isin"`
	FIGI                   *string             `bun:"figi"`
	CUSIP                  *string             `bun:"cusip"`
	Metadata               json.RawMessage     `bun:"metadata,type:jsonb"`
	FirstSeenAt            time.Time           `bun:"first_seen_at,notnull,default:current_timestamp"`
	LastVerifiedAt         *time.Time          `bun:"last_verified_at"`
	LastUsedAt             *time.Time          `bun:"last_used_at"`
	CreatedAt              time.Time           `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt              time.Time           `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

type InstrumentAlias struct {
	bun.BaseModel `bun:"table:sigma_finance.instrument_aliases"`

	ID                  string              `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	InstrumentID        string              `bun:"instrument_id,notnull,type:uuid"`
	AliasText           string              `bun:"alias_text,notnull"`
	NormalizedAliasText string              `bun:"normalized_alias_text,notnull"`
	AliasType           InstrumentAliasType `bun:"alias_type,notnull"`
	CreatedAt           time.Time           `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}

type InstrumentSyncState struct {
	bun.BaseModel `bun:"table:sigma_finance.instrument_sync_state"`

	InstrumentID           string               `bun:"instrument_id,pk,type:uuid"`
	LastSyncAttempt        *time.Time           `bun:"last_sync_attempt"`
	LastSyncSuccess        *time.Time           `bun:"last_sync_success"`
	SyncStatus             InstrumentSyncStatus `bun:"sync_status,notnull"`
	LastSyncSource         *string              `bun:"last_sync_source"`
	SyncErrorMessage       *string              `bun:"sync_error_message"`
	Stale                  bool                 `bun:"stale,notnull,default:false"`
	VerificationConfidence int                  `bun:"verification_confidence,notnull,default:0"`
	CreatedAt              time.Time            `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt              time.Time            `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

type DiscoveryLog struct {
	bun.BaseModel `bun:"table:sigma_finance.discovery_logs"`

	ID                    string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	QueryString           string    `bun:"query_string,notnull"`
	ProviderUsed          string    `bun:"provider_used,notnull"`
	NumberOfResults       int       `bun:"number_of_results,notnull,default:0"`
	UserID                *string   `bun:"user_id"`
	SelectedResultID      *string   `bun:"selected_result_id"`
	PersistedInstrumentID *string   `bun:"persisted_instrument_id"`
	CreatedAt             time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
}
