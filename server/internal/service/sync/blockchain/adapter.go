package blockchain

import (
	"context"
	"time"

	"sigma_finance/internal/domain/model"
)

// RawTokenBalance represents an exact token holding returned from an on-chain indexer
type RawTokenBalance struct {
	Network      model.BlockchainNetwork
	Address      string
	TokenAddress *string
	Symbol       string
	Name         string
	Decimals     int
	RawBalance   string // exact uint256 / satoshis / lamports string representation
	IsNative     bool
}

// RawTransferMovement represents a single token or coin transfer event on-chain
type RawTransferMovement struct {
	TxHash          string
	BlockOrSlot     int64
	ExecutedAt      time.Time
	FromAddress     string
	ToAddress       string
	TokenAddress    *string
	RawAmount       string
	Decimals        int
	FeeAmount       string
	MovementIndex   int // deterministic index: logIndex for EVM, vout for BTC, instruction/account for SOL
	ProviderSource  string
	RawMetadataJSON []byte
}

// TransferPage holds a paginated batch of transfer movements
type TransferPage struct {
	Movements   []RawTransferMovement
	NextPageKey *string
}

// BlockchainProvider defines the contract for fetching on-chain balances and transfer history
type BlockchainProvider interface {
	ProviderName() string
	SupportsNetwork(network model.BlockchainNetwork) bool
	FetchBalances(ctx context.Context, network model.BlockchainNetwork, address string) ([]RawTokenBalance, error)
	FetchTransfers(ctx context.Context, network model.BlockchainNetwork, address string, cursor string) (*TransferPage, error)
}

// PersistentHDProvider is an optional interface for providers that support persistent HD derivation
type PersistentHDProvider interface {
	ScanExtendedKeyPersistent(ctx context.Context, descriptor string, cachedJSON *string) ([]string, uint64, string, error)
}

// PersistentTokenAccountProvider is an optional interface for providers that persist discovered token accounts
type PersistentTokenAccountProvider interface {
	GetKnownTokenAccounts(walletAddress string) map[string]string
	LoadKnownTokenAccounts(walletAddress string, ataMap map[string]string)
}

// SolanaDiscoveredData represents persistent Solana token account cache in wallet_accounts.discovered_addresses
type SolanaDiscoveredData struct {
	TokenAccounts map[string]string `json:"token_accounts"`
}

// CapabilityProvider is an optional interface for providers that report capability levels
type CapabilityProvider interface {
	GetCapability(network model.BlockchainNetwork) model.WalletCapabilityLevel
}
