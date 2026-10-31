package evm

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

type CuratedToken struct {
	Address  string
	Symbol   string
	Name     string
	Decimals int
}

// CuratedTokensPerNetwork contains top verified tokens per chain
var CuratedTokensPerNetwork = map[model.BlockchainNetwork][]CuratedToken{
	model.BlockchainNetworkEthereum: {
		{Address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", Symbol: "USDC", Name: "USD Coin", Decimals: 6},
		{Address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", Symbol: "USDT", Name: "Tether USD", Decimals: 6},
		{Address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", Symbol: "DAI", Name: "Dai Stablecoin", Decimals: 18},
		{Address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", Symbol: "WETH", Name: "Wrapped Ether", Decimals: 18},
		{Address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", Symbol: "WBTC", Name: "Wrapped BTC", Decimals: 8},
		{Address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", Symbol: "LINK", Name: "ChainLink", Decimals: 18},
		{Address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", Symbol: "UNI", Name: "Uniswap", Decimals: 18},
	},
	model.BlockchainNetworkBase: {
		{Address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Symbol: "USDC", Name: "USD Coin", Decimals: 6},
		{Address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", Symbol: "USDbC", Name: "USD Base Coin", Decimals: 6},
		{Address: "0x4200000000000000000000000000000000000006", Symbol: "WETH", Name: "Wrapped Ether", Decimals: 18},
		{Address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", Symbol: "cbBTC", Name: "Coinbase Wrapped BTC", Decimals: 8},
		{Address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", Symbol: "DAI", Name: "Dai Stablecoin", Decimals: 18},
	},
	model.BlockchainNetworkArbitrum: {
		{Address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", Symbol: "USDC", Name: "USD Coin", Decimals: 6},
		{Address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", Symbol: "USDC.e", Name: "Bridged USDC", Decimals: 6},
		{Address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", Symbol: "USDT", Name: "Tether USD", Decimals: 6},
		{Address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", Symbol: "WETH", Name: "Wrapped Ether", Decimals: 18},
		{Address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", Symbol: "WBTC", Name: "Wrapped BTC", Decimals: 8},
		{Address: "0x912CE59144191C1204E64559FE8253a0e49E6548", Symbol: "ARB", Name: "Arbitrum", Decimals: 18},
	},
	model.BlockchainNetworkOptimism: {
		{Address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", Symbol: "USDC", Name: "USD Coin", Decimals: 6},
		{Address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", Symbol: "USDC.e", Name: "Bridged USDC", Decimals: 6},
		{Address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", Symbol: "USDT", Name: "Tether USD", Decimals: 6},
		{Address: "0x4200000000000000000000000000000000000006", Symbol: "WETH", Name: "Wrapped Ether", Decimals: 18},
		{Address: "0x4200000000000000000000000000000000000042", Symbol: "OP", Name: "Optimism", Decimals: 18},
		{Address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", Symbol: "WBTC", Name: "Wrapped BTC", Decimals: 8},
	},
	model.BlockchainNetworkPolygon: {
		{Address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", Symbol: "USDC", Name: "USD Coin", Decimals: 6},
		{Address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", Symbol: "USDC.e", Name: "Bridged USDC", Decimals: 6},
		{Address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", Symbol: "USDT", Name: "Tether USD", Decimals: 6},
		{Address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", Symbol: "WETH", Name: "Wrapped Ether", Decimals: 18},
		{Address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", Symbol: "WMATIC", Name: "Wrapped Matic", Decimals: 18},
		{Address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", Symbol: "WBTC", Name: "Wrapped BTC", Decimals: 8},
	},
}

var DefaultRPCEndpoints = map[model.BlockchainNetwork]string{
	model.BlockchainNetworkEthereum: "https://ethereum-rpc.publicnode.com",
	model.BlockchainNetworkBase:     "https://mainnet.base.org",
	model.BlockchainNetworkArbitrum: "https://arb1.arbitrum.io/rpc",
	model.BlockchainNetworkOptimism: "https://mainnet.optimism.io",
	model.BlockchainNetworkPolygon:  "https://polygon-rpc.com",
}

// NativeAssetSymbols maps EVM network to native coin symbol & name
var NativeAssetSymbols = map[model.BlockchainNetwork]struct{ Symbol, Name string }{
	model.BlockchainNetworkEthereum: {"ETH", "Ethereum"},
	model.BlockchainNetworkBase:     {"ETH", "Ethereum"},
	model.BlockchainNetworkArbitrum: {"ETH", "Ethereum"},
	model.BlockchainNetworkOptimism: {"ETH", "Ethereum"},
	model.BlockchainNetworkPolygon:  {"POL", "Polygon Ecosystem Token"},
}

// EVMAdapter provides keyless balance & activity synchronization for EVM networks
type EVMAdapter struct {
	endpoints       map[model.BlockchainNetwork]string
	httpClient      *http.Client
	rateLimiter     *rate.Limiter
	circuitBreaker  *gobreaker.CircuitBreaker
	blockscout      *BlockscoutClient
	alchemyAPIKey   string
}

func NewEVMAdapter(alchemyAPIKey string, customEndpoints map[model.BlockchainNetwork]string) *EVMAdapter {
	endpoints := make(map[model.BlockchainNetwork]string)
	for net, url := range DefaultRPCEndpoints {
		endpoints[net] = url
	}
	for net, url := range customEndpoints {
		if url != "" {
			endpoints[net] = url
		}
	}

	return &EVMAdapter{
		endpoints:      endpoints,
		httpClient:     &http.Client{Timeout: 12 * time.Second},
		rateLimiter:    rate.NewLimiter(rate.Limit(10), 10), // Polite 10 rps
		circuitBreaker: gobreaker.NewCircuitBreaker(gobreaker.Settings{Name: "EVM-RPC"}),
		blockscout:     NewBlockscoutClient(),
		alchemyAPIKey:  alchemyAPIKey,
	}
}

func (a *EVMAdapter) ProviderName() string {
	return "EVM_RPC_MULTICALL3"
}

func (a *EVMAdapter) SupportsNetwork(net model.BlockchainNetwork) bool {
	switch net {
	case model.BlockchainNetworkEthereum,
		model.BlockchainNetworkBase,
		model.BlockchainNetworkArbitrum,
		model.BlockchainNetworkOptimism,
		model.BlockchainNetworkPolygon:
		return true
	default:
		return false
	}
}

func (a *EVMAdapter) GetCapability(net model.BlockchainNetwork) model.WalletCapabilityLevel {
	if a.alchemyAPIKey != "" {
		return model.WalletCapabilityEnhancedHistory
	}
	if SupportsBlockscout(net) {
		return model.WalletCapabilityActivityIndexed
	}
	return model.WalletCapabilityBalanceOnly
}

type jsonRpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type jsonRpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// FetchBalances retrieves native ETH/POL balance and curated ERC-20 balances in ONE atomic Multicall3 call
func (a *EVMAdapter) FetchBalances(ctx context.Context, net model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	if !a.SupportsNetwork(net) {
		return nil, fmt.Errorf("network %s is not supported by EVMAdapter", net)
	}

	rpcURL, ok := a.endpoints[net]
	if !ok || rpcURL == "" {
		return nil, fmt.Errorf("no RPC endpoint configured for network %s", net)
	}

	curatedTokens := CuratedTokensPerNetwork[net]

	// 1. Build Multicall3 calls:
	// Call 0: getEthBalance(address)
	ethCall, err := BuildGetEthBalanceCall(address)
	if err != nil {
		return nil, fmt.Errorf("failed to build getEthBalance call: %w", err)
	}

	calls := []Call3{ethCall}
	for _, tok := range curatedTokens {
		tokCall, err := BuildBalanceOfCall(tok.Address, address)
		if err == nil {
			calls = append(calls, tokCall)
		}
	}

	calldata, err := EncodeAggregate3(calls)
	if err != nil {
		return nil, fmt.Errorf("failed to encode Multicall3 aggregate3: %w", err)
	}

	// 2. Perform eth_call
	callObj := map[string]string{
		"to":   Multicall3Address,
		"data": "0x" + hex.EncodeToString(calldata),
	}

	rpcPayload := jsonRpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "eth_call",
		Params:  []interface{}{callObj, "latest"},
	}

	respBytes, err := a.doRPCPost(ctx, rpcURL, rpcPayload)
	if err != nil {
		return nil, fmt.Errorf("multicall3 eth_call failed on %s: %w", net, err)
	}

	var hexResult string
	if err := json.Unmarshal(respBytes, &hexResult); err != nil {
		return nil, fmt.Errorf("failed to unmarshal eth_call hex result: %w", err)
	}

	rawReturnBytes, err := hex.DecodeString(strings.TrimPrefix(hexResult, "0x"))
	if err != nil {
		return nil, fmt.Errorf("failed to decode return data hex: %w", err)
	}

	results, err := DecodeAggregate3Results(rawReturnBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decode aggregate3 return data: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("multicall3 returned 0 results")
	}

	var balances []blockchain.RawTokenBalance

	// 3. Process Native Coin Balance (Result 0)
	nativeInfo := NativeAssetSymbols[net]
	if results[0].Success && len(results[0].ReturnData) >= 32 {
		nativeBalBig := DecodeUint256(results[0].ReturnData)
		balances = append(balances, blockchain.RawTokenBalance{
			Network:      net,
			Address:      address,
			TokenAddress: nil,
			Symbol:       nativeInfo.Symbol,
			Name:         nativeInfo.Name,
			Decimals:     18,
			RawBalance:   nativeBalBig.String(),
			IsNative:     true,
		})
	}

	// 4. Process Curated ERC-20 Tokens (Results 1..N)
	for i, tok := range curatedTokens {
		idx := i + 1
		if idx >= len(results) {
			break
		}
		if !results[idx].Success || len(results[idx].ReturnData) < 32 {
			continue
		}
		balBig := DecodeUint256(results[idx].ReturnData)
		// Only track tokens with non-zero balance or major stablecoins
		if balBig.Cmp(big.NewInt(0)) > 0 || tok.Symbol == "USDC" || tok.Symbol == "USDT" {
			tokAddr := strings.ToLower(tok.Address)
			balances = append(balances, blockchain.RawTokenBalance{
				Network:      net,
				Address:      address,
				TokenAddress: &tokAddr,
				Symbol:       tok.Symbol,
				Name:         tok.Name,
				Decimals:     tok.Decimals,
				RawBalance:   balBig.String(),
				IsNative:     false,
			})
		}
	}

	return balances, nil
}

// FetchTransfers retrieves historical transfers using Blockscout where available
func (a *EVMAdapter) FetchTransfers(ctx context.Context, net model.BlockchainNetwork, address string, cursor string) (*blockchain.TransferPage, error) {
	if !SupportsBlockscout(net) {
		// Return empty page for networks without an open indexer
		return &blockchain.TransferPage{}, nil
	}

	movements, err := a.blockscout.FetchTransfers(ctx, net, address, 1, 50)
	if err != nil {
		return &blockchain.TransferPage{}, err
	}

	return &blockchain.TransferPage{
		Movements:   movements,
		NextPageKey: nil, // Blockscout 1-page backfill
	}, nil
}

// IntrospectERC20 reads decimals, symbol, and name of an arbitrary ERC-20 token
func (a *EVMAdapter) IntrospectERC20(ctx context.Context, net model.BlockchainNetwork, tokenAddress string) (*CuratedToken, error) {
	rpcURL := a.endpoints[net]
	if rpcURL == "" {
		return nil, fmt.Errorf("no RPC endpoint for %s", net)
	}

	decCall := Call3{Target: tokenAddress, AllowFailure: true, CallData: mustHex(SelectorDecimals)}
	symCall := Call3{Target: tokenAddress, AllowFailure: true, CallData: mustHex(SelectorSymbol)}
	nameCall := Call3{Target: tokenAddress, AllowFailure: true, CallData: mustHex(SelectorName)}

	calldata, err := EncodeAggregate3([]Call3{decCall, symCall, nameCall})
	if err != nil {
		return nil, err
	}

	rpcPayload := jsonRpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "eth_call",
		Params:  []interface{}{map[string]string{"to": Multicall3Address, "data": "0x" + hex.EncodeToString(calldata)}, "latest"},
	}

	respBytes, err := a.doRPCPost(ctx, rpcURL, rpcPayload)
	if err != nil {
		return nil, err
	}

	var hexResult string
	_ = json.Unmarshal(respBytes, &hexResult)
	rawBytes, _ := hex.DecodeString(strings.TrimPrefix(hexResult, "0x"))
	results, err := DecodeAggregate3Results(rawBytes)
	if err != nil || len(results) < 3 {
		return nil, fmt.Errorf("failed to introspect token %s: %v", tokenAddress, err)
	}

	decimals := 18
	if results[0].Success && len(results[0].ReturnData) >= 32 {
		decimals = int(DecodeUint256(results[0].ReturnData).Int64())
	}
	symbol := "UNKNOWN"
	if results[1].Success {
		symbol = DecodeStringOrBytes32(results[1].ReturnData)
	}
	name := symbol
	if results[2].Success {
		name = DecodeStringOrBytes32(results[2].ReturnData)
	}

	return &CuratedToken{
		Address:  tokenAddress,
		Symbol:   symbol,
		Name:     name,
		Decimals: decimals,
	}, nil
}

func mustHex(h string) []byte {
	b, _ := hex.DecodeString(h)
	return b
}

func (a *EVMAdapter) doRPCPost(ctx context.Context, url string, req jsonRpcRequest) (json.RawMessage, error) {
	if err := a.rateLimiter.Wait(ctx); err != nil {
		return nil, err
	}

	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	httpResp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer httpResp.Body.Close()

	bodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, err
	}

	var rpcResp jsonRpcResponse
	if err := json.Unmarshal(bodyBytes, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON-RPC response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("JSON-RPC error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

