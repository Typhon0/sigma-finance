package registry

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

func TestAdapterRegistryRouting(t *testing.T) {
	reg := NewAdapterRegistry("", "", nil)

	assert.Equal(t, "MULTI_PROVIDER_REGISTRY", reg.ProviderName())
	assert.True(t, reg.SupportsNetwork(model.BlockchainNetworkEthereum))
	assert.True(t, reg.SupportsNetwork(model.BlockchainNetworkBase))
	assert.True(t, reg.SupportsNetwork(model.BlockchainNetworkSolana))
	assert.True(t, reg.SupportsNetwork(model.BlockchainNetworkBitcoin))

	// Keyless capability levels
	assert.Equal(t, model.WalletCapabilityActivityIndexed, reg.GetCapability(model.BlockchainNetworkBitcoin))
	assert.Equal(t, model.WalletCapabilityActivityIndexed, reg.GetCapability(model.BlockchainNetworkBase))
	assert.Equal(t, model.WalletCapabilityBalanceOnly, reg.GetCapability(model.BlockchainNetworkEthereum))
	assert.Equal(t, model.WalletCapabilityActivityIndexed, reg.GetCapability(model.BlockchainNetworkSolana))

	// With Alchemy key
	regAlchemy := NewAdapterRegistry("alch-key-123", "", nil)
	assert.Equal(t, model.WalletCapabilityEnhancedHistory, regAlchemy.GetCapability(model.BlockchainNetworkEthereum))
	assert.Equal(t, model.WalletCapabilityEnhancedHistory, regAlchemy.GetCapability(model.BlockchainNetworkBase))

	// With Helius key on Solana
	regHelius := NewAdapterRegistry("", "helius-key-123", nil)
	assert.Equal(t, model.WalletCapabilityEnhancedHistory, regHelius.GetCapability(model.BlockchainNetworkSolana))
}

func TestAdapterRegistry_PersistentTokenAccountProvider(t *testing.T) {
	reg := NewAdapterRegistry("", "", nil)

	// AdapterRegistry must implement PersistentTokenAccountProvider
	tap, ok := any(reg).(blockchain.PersistentTokenAccountProvider)
	assert.True(t, ok, "AdapterRegistry must implement blockchain.PersistentTokenAccountProvider")

	walletAddr := "SolWallet123"
	ataMap := map[string]string{
		"ATAPubkey1": "MintUSDC1",
	}

	tap.LoadKnownTokenAccounts(walletAddr, ataMap)
	loaded := tap.GetKnownTokenAccounts(walletAddr)
	assert.Equal(t, "MintUSDC1", loaded["ATAPubkey1"])
}


