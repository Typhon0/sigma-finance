package registry

import (
	"context"
	"fmt"
	"strings"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
	"sigma_finance/internal/service/sync/blockchain/alchemy"
	"sigma_finance/internal/service/sync/blockchain/bitcoin"
	"sigma_finance/internal/service/sync/blockchain/evm"
	"sigma_finance/internal/service/sync/blockchain/solana"
)

// AdapterRegistry coordinates network adapters, implementing BlockchainProvider, CapabilityProvider, and PersistentHDProvider
type AdapterRegistry struct {
	evmAdapter    *evm.EVMAdapter
	solanaAdapter *solana.SolanaAdapter
	bitcoinClient *bitcoin.Client
	alchemyClient *alchemy.Client
}

// NewAdapterRegistry initializes all chain adapters with optional API keys and custom endpoints
func NewAdapterRegistry(
	alchemyAPIKey string,
	heliusAPIKey string,
	customEndpoints map[model.BlockchainNetwork]string,
) *AdapterRegistry {
	btcEndpoints := []string{}
	if ep, ok := customEndpoints[model.BlockchainNetworkBitcoin]; ok && ep != "" {
		ep = strings.TrimSpace(ep)
		if ep != bitcoin.DefaultMempoolEndpoint && ep != bitcoin.DefaultBlockstreamEndpoint {
			// Custom user-configured Esplora endpoint has priority
			btcEndpoints = append(btcEndpoints, ep)
		}
	}
	// Mempool as primary default
	btcEndpoints = append(btcEndpoints, bitcoin.DefaultMempoolEndpoint)
	// Blockstream as failover default
	btcEndpoints = append(btcEndpoints, bitcoin.DefaultBlockstreamEndpoint)

	solanaEndpoint := ""
	if ep, ok := customEndpoints[model.BlockchainNetworkSolana]; ok && ep != "" {
		solanaEndpoint = ep
	}

	var alch *alchemy.Client
	if alchemyAPIKey != "" {
		alch = alchemy.NewClient(alchemyAPIKey)
	}

	return &AdapterRegistry{
		evmAdapter:    evm.NewEVMAdapter(alchemyAPIKey, customEndpoints),
		solanaAdapter: solana.NewSolanaAdapter(solanaEndpoint, heliusAPIKey),
		bitcoinClient: bitcoin.NewClient(btcEndpoints...),
		alchemyClient: alch,
	}
}

func (r *AdapterRegistry) ProviderName() string {
	return "MULTI_PROVIDER_REGISTRY"
}

func (r *AdapterRegistry) SupportsNetwork(network model.BlockchainNetwork) bool {
	switch network {
	case model.BlockchainNetworkEthereum,
		model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum,
		model.BlockchainNetworkOptimism,
		model.BlockchainNetworkPolygon,
		model.BlockchainNetworkSolana,
		model.BlockchainNetworkBitcoin:
		return true
	default:
		return false
	}
}

func (r *AdapterRegistry) GetCapability(network model.BlockchainNetwork) model.WalletCapabilityLevel {
	switch network {
	case model.BlockchainNetworkBitcoin:
		return model.WalletCapabilityActivityIndexed
	case model.BlockchainNetworkSolana:
		return r.solanaAdapter.GetCapability(network)
	default:
		return r.evmAdapter.GetCapability(network)
	}
}

func (r *AdapterRegistry) ScanExtendedKeyPersistent(ctx context.Context, descriptor string, cachedJSON *string) ([]string, uint64, string, error) {
	return r.bitcoinClient.ScanExtendedKeyPersistent(ctx, descriptor, cachedJSON)
}

func (r *AdapterRegistry) FetchBalances(ctx context.Context, network model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	switch network {
	case model.BlockchainNetworkBitcoin:
		return r.bitcoinClient.FetchBalances(ctx, address)
	case model.BlockchainNetworkSolana:
		return r.solanaAdapter.FetchBalances(ctx, network, address)
	case model.BlockchainNetworkEthereum,
		model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum,
		model.BlockchainNetworkOptimism,
		model.BlockchainNetworkPolygon:
		return r.evmAdapter.FetchBalances(ctx, network, address)
	default:
		return nil, fmt.Errorf("unsupported network %s", network)
	}
}

func (r *AdapterRegistry) FetchTransfers(ctx context.Context, network model.BlockchainNetwork, address string, cursor string) (*blockchain.TransferPage, error) {
	switch network {
	case model.BlockchainNetworkBitcoin:
		return r.bitcoinClient.FetchTransfers(ctx, address, cursor)
	case model.BlockchainNetworkSolana:
		return r.solanaAdapter.FetchTransfers(ctx, network, address, cursor)
	case model.BlockchainNetworkEthereum,
		model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum,
		model.BlockchainNetworkOptimism,
		model.BlockchainNetworkPolygon:
		// If alchemy client is available and network is Ethereum or L2, prefer Alchemy for transfers
		if r.alchemyClient != nil {
			page, err := r.alchemyClient.FetchTransfers(ctx, network, address, cursor)
			if err == nil && page != nil && len(page.Movements) > 0 {
				return page, nil
			}
		}
		// Fallback to Blockscout for keyless L2s
		return r.evmAdapter.FetchTransfers(ctx, network, address, cursor)
	default:
		return nil, fmt.Errorf("unsupported network %s", network)
	}
}

// Compile-time interface checks
var (
	_ blockchain.BlockchainProvider             = (*AdapterRegistry)(nil)
	_ blockchain.CapabilityProvider             = (*AdapterRegistry)(nil)
	_ blockchain.PersistentHDProvider           = (*AdapterRegistry)(nil)
	_ blockchain.PersistentTokenAccountProvider = (*AdapterRegistry)(nil)
)

func (r *AdapterRegistry) GetKnownTokenAccounts(walletAddress string) map[string]string {
	if r.solanaAdapter != nil {
		return r.solanaAdapter.GetKnownTokenAccounts(walletAddress)
	}
	return nil
}

func (r *AdapterRegistry) LoadKnownTokenAccounts(walletAddress string, ataMap map[string]string) {
	if r.solanaAdapter != nil {
		r.solanaAdapter.LoadKnownTokenAccounts(walletAddress, ataMap)
	}
}

// EVMAdapter returns the internal EVM adapter for token introspection
func (r *AdapterRegistry) EVMAdapter() *evm.EVMAdapter {
	return r.evmAdapter
}

// BitcoinClient returns the internal Bitcoin client for persistent HD discovery
func (r *AdapterRegistry) BitcoinClient() *bitcoin.Client {
	return r.bitcoinClient
}

