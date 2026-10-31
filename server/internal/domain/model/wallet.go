package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uptrace/bun"
)

// BlockchainNetwork represents a supported blockchain network
type BlockchainNetwork string

const (
	BlockchainNetworkEthereum BlockchainNetwork = "ETHEREUM"
	BlockchainNetworkBase     BlockchainNetwork = "BASE"
	BlockchainNetworkArbitrum BlockchainNetwork = "ARBITRUM"
	BlockchainNetworkOptimism BlockchainNetwork = "OPTIMISM"
	BlockchainNetworkPolygon  BlockchainNetwork = "POLYGON"
	BlockchainNetworkSolana   BlockchainNetwork = "SOLANA"
	BlockchainNetworkBitcoin  BlockchainNetwork = "BITCOIN"
)

func (bn BlockchainNetwork) IsValid() bool {
	switch bn {
	case BlockchainNetworkEthereum, BlockchainNetworkBase, BlockchainNetworkArbitrum,
		BlockchainNetworkOptimism, BlockchainNetworkPolygon, BlockchainNetworkSolana,
		BlockchainNetworkBitcoin:
		return true
	}
	return false
}

// WalletDeviceType identifies the nature of a wallet container
type WalletDeviceType string

const (
	WalletDeviceTypeHardware   WalletDeviceType = "HARDWARE"
	WalletDeviceTypeSoftware   WalletDeviceType = "SOFTWARE"
	WalletDeviceTypeStandalone WalletDeviceType = "STANDALONE"
)

// WalletHistoryStatus tracks backfill status
type WalletHistoryStatus string

const (
	WalletHistoryStatusPending    WalletHistoryStatus = "PENDING"
	WalletHistoryStatusInProgress WalletHistoryStatus = "IN_PROGRESS"
	WalletHistoryStatusSynced     WalletHistoryStatus = "SYNCED"
	WalletHistoryStatusError      WalletHistoryStatus = "ERROR"
)

// WalletCapabilityLevel tracks network tracking capability
type WalletCapabilityLevel string

const (
	WalletCapabilityBalanceOnly     WalletCapabilityLevel = "BALANCE_ONLY"
	WalletCapabilityActivityIndexed WalletCapabilityLevel = "ACTIVITY_INDEXED"
	WalletCapabilityEnhancedHistory WalletCapabilityLevel = "ENHANCED_HISTORY"
)

// WalletReviewStatus for staged complex transactions
type WalletReviewStatus string

const (
	WalletReviewStatusPending   WalletReviewStatus = "PENDING"
	WalletReviewStatusApproved  WalletReviewStatus = "APPROVED"
	WalletReviewStatusDismissed WalletReviewStatus = "DISMISSED"
)

// WalletDevice represents an optional parent container grouping multi-chain addresses (e.g. Ledger, Phantom)
type WalletDevice struct {
	bun.BaseModel `bun:"table:sigma_finance.wallet_devices,alias:wd"`

	ID         string           `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID     string           `bun:"user_id,notnull,type:uuid"`
	Name       string           `bun:"name,notnull"`
	DeviceType WalletDeviceType `bun:"device_type,notnull,default:'SOFTWARE'"`
	CreatedAt  time.Time        `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt  time.Time        `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User     *User            `bun:"rel:belongs-to,join:user_id=id"`
	Accounts []*WalletAccount `bun:"rel:has-many,join:id=device_id"`
}

func (w WalletDevice) GetID() string             { return w.ID }
func (w *WalletDevice) SetID(id string)          { w.ID = id }
func (w WalletDevice) GetCreatedAt() time.Time   { return w.CreatedAt }
func (w *WalletDevice) SetCreatedAt(t time.Time) { w.CreatedAt = t }
func (w WalletDevice) GetUpdatedAt() time.Time   { return w.UpdatedAt }
func (w *WalletDevice) SetUpdatedAt(t time.Time) { w.UpdatedAt = t }

// WalletAccount represents a single chain public address or xpub
type WalletAccount struct {
	bun.BaseModel `bun:"table:sigma_finance.wallet_accounts,alias:wacc"`

	ID            string              `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID        string              `bun:"user_id,notnull,type:uuid"`
	DeviceID      *string             `bun:"device_id,type:uuid"`
	AccountID     *string             `bun:"account_id,type:uuid"`
	Network       BlockchainNetwork   `bun:"network,notnull"`
	AddressOrXpub string              `bun:"address_or_xpub,notnull"`
	IsXpub        bool                `bun:"is_xpub,notnull,default:false"`
	Label         *string             `bun:"label"`
	IsActive      bool                `bun:"is_active,notnull,default:true"`
	LastSyncAt          *time.Time            `bun:"last_sync_at"`
	SyncCursor          *string               `bun:"sync_cursor"`
	HistoryStatus       WalletHistoryStatus   `bun:"history_status,notnull,default:'PENDING'"`
	CapabilityLevel     WalletCapabilityLevel `bun:"capability_level,notnull,default:'BALANCE_ONLY'"`
	DiscoveredAddresses *string               `bun:"discovered_addresses,type:jsonb"`
	LastSyncError       *string               `bun:"last_sync_error"`
	CreatedAt     time.Time           `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt     time.Time           `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User       *User             `bun:"rel:belongs-to,join:user_id=id"`
	Device     *WalletDevice     `bun:"rel:belongs-to,join:device_id=id"`
	Account    *Account          `bun:"rel:belongs-to,join:account_id=id"`
	Balances   []*WalletBalance  `bun:"rel:has-many,join:id=wallet_account_id"`
	Activities []*WalletActivity `bun:"rel:has-many,join:id=wallet_account_id"`
}

func (w WalletAccount) GetID() string             { return w.ID }
func (w *WalletAccount) SetID(id string)          { w.ID = id }
func (w WalletAccount) GetCreatedAt() time.Time   { return w.CreatedAt }
func (w *WalletAccount) SetCreatedAt(t time.Time) { w.CreatedAt = t }
func (w WalletAccount) GetUpdatedAt() time.Time   { return w.UpdatedAt }
func (w *WalletAccount) SetUpdatedAt(t time.Time) { w.UpdatedAt = t }

func (w *WalletAccount) Validate() error {
	if strings.TrimSpace(w.UserID) == "" {
		return errors.New("user ID is required")
	}
	if !w.Network.IsValid() {
		return fmt.Errorf("invalid blockchain network: %s", w.Network)
	}
	addr := strings.TrimSpace(w.AddressOrXpub)
	if addr == "" {
		return errors.New("address or xpub is required")
	}

	// Address format validation
	switch w.Network {
	case BlockchainNetworkEthereum, BlockchainNetworkBase, BlockchainNetworkArbitrum,
		BlockchainNetworkOptimism, BlockchainNetworkPolygon:
		if !strings.HasPrefix(strings.ToLower(addr), "0x") || len(addr) != 42 {
			return errors.New("invalid EVM address: must be 42 characters starting with 0x")
		}
	case BlockchainNetworkSolana:
		if len(addr) < 32 || len(addr) > 44 {
			return errors.New("invalid Solana address: base58 string must be 32-44 characters")
		}
	case BlockchainNetworkBitcoin:
		if w.IsXpub {
			if !strings.HasPrefix(addr, "xpub") && !strings.HasPrefix(addr, "ypub") && !strings.HasPrefix(addr, "zpub") {
				return errors.New("invalid Bitcoin extended public key: must start with xpub, ypub, or zpub")
			}
		} else {
			if !strings.HasPrefix(addr, "1") && !strings.HasPrefix(addr, "3") && !strings.HasPrefix(addr, "bc1") {
				return errors.New("invalid Bitcoin address: must start with 1, 3, or bc1")
			}
		}
	}
	return nil
}

// WalletBalance stores exact raw token balance
type WalletBalance struct {
	bun.BaseModel `bun:"table:sigma_finance.wallet_balances,alias:wb"`

	ID                string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	WalletAccountID   string          `bun:"wallet_account_id,notnull,type:uuid"`
	InstrumentID      *string         `bun:"instrument_id,type:uuid"`
	AssetID           *string         `bun:"asset_id,type:uuid"`
	TokenAddress      *string         `bun:"token_address"`
	Symbol            string          `bun:"symbol,notnull"`
	Name              string          `bun:"name"`
	Decimals          int             `bun:"decimals,notnull,default:18"`
	RawBalance        string          `bun:"raw_balance,type:numeric(78,0),notnull,default:0"`
	FormattedQuantity decimal.Decimal `bun:"formatted_quantity,type:decimal(36,18),notnull,default:0"`
	IsSpam            bool            `bun:"is_spam,notnull,default:false"`
	IsHidden          bool            `bun:"is_hidden,notnull,default:false"`
	IsStale           bool            `bun:"is_stale,notnull,default:false"`
	CostBasisPerUnit  *decimal.Decimal `bun:"cost_basis_per_unit,type:decimal(36,18)"`
	CostBasisCurrency string           `bun:"cost_basis_currency,type:varchar(10),default:USD"`
	CostBasisType     string           `bun:"cost_basis_type,type:varchar(30),default:UNRECORDED"`
	AutoEstimatedBasis *decimal.Decimal `bun:"auto_estimated_basis,type:decimal(36,18)"`
	AcquiredAt        *time.Time       `bun:"acquired_at"`
	CurrentPrice      *decimal.Decimal `bun:"current_price,type:decimal(36,18)"`
	DayChange24h      *decimal.Decimal `bun:"day_change_24h,type:decimal(10,4)"`
	PriceUpdatedAt    *time.Time       `bun:"price_updated_at"`
	PriceSource       *string          `bun:"price_source,type:varchar(50)"`
	LastUpdatedAt     time.Time        `bun:"last_updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	WalletAccount *WalletAccount `bun:"rel:belongs-to,join:wallet_account_id=id"`
	Instrument    *Instrument    `bun:"rel:belongs-to,join:instrument_id=id"`
}

func (w WalletBalance) GetID() string             { return w.ID }
func (w *WalletBalance) SetID(id string)          { w.ID = id }
func (w WalletBalance) GetCreatedAt() time.Time   { return w.LastUpdatedAt }
func (w *WalletBalance) SetCreatedAt(t time.Time) { w.LastUpdatedAt = t }
func (w WalletBalance) GetUpdatedAt() time.Time   { return w.LastUpdatedAt }
func (w *WalletBalance) SetUpdatedAt(t time.Time) { w.LastUpdatedAt = t }

// NewWalletBalanceFromRaw converts raw uint256 / string into decimal FormattedQuantity
func NewWalletBalanceFromRaw(accountID, symbol, name string, decimals int, rawBalance string, tokenAddress *string, isSpam bool) *WalletBalance {
	rawBalance = strings.TrimSpace(rawBalance)
	if rawBalance == "" {
		rawBalance = "0"
	}

	// Calculate formatted quantity: raw / 10^decimals
	var formatted decimal.Decimal
	rawBig, ok := new(big.Int).SetString(rawBalance, 10)
	if ok {
		decInt := decimal.NewFromBigInt(rawBig, 0)
		formatted = decInt.Shift(-int32(decimals))
	}

	return &WalletBalance{
		WalletAccountID:   accountID,
		Symbol:            symbol,
		Name:              name,
		Decimals:          decimals,
		RawBalance:        rawBalance,
		FormattedQuantity: formatted,
		TokenAddress:      tokenAddress,
		IsSpam:            isSpam,
		IsHidden:          isSpam,
		LastUpdatedAt:     time.Now(),
	}
}

// WalletActivity represents an on-chain transfer or transaction
type WalletActivity struct {
	bun.BaseModel `bun:"table:sigma_finance.wallet_activities,alias:wact"`

	ID                         string          `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	WalletAccountID            string          `bun:"wallet_account_id,notnull,type:uuid"`
	TxHash                     string          `bun:"tx_hash,notnull"`
	BlockOrSlot                int64           `bun:"block_or_slot,notnull"`
	ExecutedAt                 time.Time       `bun:"executed_at,notnull"`
	FromAddress                string          `bun:"from_address,notnull"`
	ToAddress                  string          `bun:"to_address,notnull"`
	TokenAddress               *string         `bun:"token_address"`
	RawAmount                  string          `bun:"raw_amount,type:numeric(78,0),notnull,default:0"`
	Decimals                   int             `bun:"decimals,notnull,default:18"`
	FormattedAmount            decimal.Decimal `bun:"formatted_amount,type:decimal(36,18),notnull,default:0"`
	FeeAmount                  string          `bun:"fee_amount,type:numeric(78,0),notnull,default:0"`
	MovementIndex              int             `bun:"movement_index,notnull,default:0"`
	ProviderSource             string          `bun:"provider_source,notnull,default:'ALCHEMY'"`
	RawMetadata                json.RawMessage `bun:"raw_metadata,type:jsonb"`
	MatchedInternalActivityID  *string         `bun:"matched_internal_activity_id,type:uuid"`
	ClassifiedTransactionID    *string         `bun:"classified_transaction_id,type:uuid"`
	CreatedAt                  time.Time       `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	WalletAccount *WalletAccount `bun:"rel:belongs-to,join:wallet_account_id=id"`
	Transaction   *Transaction   `bun:"rel:belongs-to,join:classified_transaction_id=id"`
}

// WalletActivityReview for staging complex DeFi transactions
type WalletActivityReview struct {
	bun.BaseModel `bun:"table:sigma_finance.wallet_activity_reviews,alias:war"`

	ID               string             `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	WalletActivityID string             `bun:"wallet_activity_id,notnull,type:uuid"`
	UserID           string             `bun:"user_id,notnull,type:uuid"`
	ReviewStatus     WalletReviewStatus `bun:"review_status,notnull,default:'PENDING'"`
	SuggestedType    TransactionType    `bun:"suggested_type,notnull,default:'TRANSFER_IN'"`
	Notes            *string            `bun:"notes"`
	CreatedAt        time.Time          `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	UpdatedAt        time.Time          `bun:"updated_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	Activity *WalletActivity `bun:"rel:belongs-to,join:wallet_activity_id=id"`
	User     *User           `bun:"rel:belongs-to,join:user_id=id"`
}

// WalletCUTracking tracks monthly Compute Units consumed
type WalletCUTracking struct {
	bun.BaseModel `bun:"table:sigma_finance.wallet_cu_tracking,alias:wcu"`

	ID                   string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	BillingMonth         string    `bun:"billing_month,notnull"` // e.g. "2026-10"
	ComputeUnitsConsumed int64     `bun:"compute_units_consumed,notnull,default:0"`
	IsThrottled          bool      `bun:"is_throttled,notnull,default:false"`
	UpdatedAt            time.Time `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

// ShouldThrottle checks if usage exceeded threshold (e.g. 80% of maxQuota)
func (w *WalletCUTracking) ShouldThrottle(maxQuota int64, threshold float64) bool {
	limit := int64(float64(maxQuota) * threshold)
	return w.ComputeUnitsConsumed >= limit
}

// BlockchainNetworkConfig represents an RPC & Explorer endpoint configuration
type BlockchainNetworkConfig struct {
	bun.BaseModel `bun:"table:sigma_finance.blockchain_network_configs,alias:bnc"`

	Network        BlockchainNetwork `bun:"network,pk"`
	RPCURL         string            `bun:"rpc_url,notnull"`
	ExplorerAPIURL *string           `bun:"explorer_api_url"`
	Source         string            `bun:"source,notnull,default:'DEFAULT'"`
	UpdatedAt      time.Time         `bun:"updated_at,nullzero,notnull,default:current_timestamp"`
}

