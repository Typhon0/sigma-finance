package solana

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sony/gobreaker"
	"golang.org/x/time/rate"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/sync/blockchain"
)

const (
	DefaultSolanaRPCEndpoint = "https://api.mainnet-beta.solana.com"
	SPLTokenProgramID        = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
	Token2022ProgramID       = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
	WSOLMintSPL              = "So11111111111111111111111111111111111111112"
	WSOLMintToken2022        = "9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP"
)

// IsWrappedSOL checks whether a mint address corresponds to Wrapped SOL (SPL or Token-2022)
func IsWrappedSOL(mint string) bool {
	return mint == WSOLMintSPL || mint == WSOLMintToken2022
}

type SolanaAdapter struct {
	endpoint             string
	httpClient           *http.Client
	rateLimiter          *rate.Limiter
	circuitBreaker       *gobreaker.CircuitBreaker
	heliusAPIKey         string
	knownTokenAccountsMu sync.RWMutex
	knownTokenAccounts   map[string]map[string]string // walletAddress -> (tokenAccountPubkey -> mint)
}

func NewSolanaAdapter(endpoint string, heliusAPIKey string) *SolanaAdapter {
	if endpoint == "" {
		endpoint = DefaultSolanaRPCEndpoint
	}
	if heliusAPIKey != "" {
		endpoint = fmt.Sprintf("https://mainnet.helius-rpc.com/?api-key=%s", heliusAPIKey)
	}

	return &SolanaAdapter{
		endpoint:           endpoint,
		httpClient:         &http.Client{Timeout: 15 * time.Second},
		rateLimiter:        rate.NewLimiter(rate.Limit(3), 3), // 3 rps polite rate limit
		circuitBreaker:     gobreaker.NewCircuitBreaker(gobreaker.Settings{Name: "Solana-RPC"}),
		heliusAPIKey:       heliusAPIKey,
		knownTokenAccounts: make(map[string]map[string]string),
	}
}

// RegisterKnownTokenAccount records a token account pubkey to wallet owner and mint mapping
func (a *SolanaAdapter) RegisterKnownTokenAccount(walletAddress, tokenPubkey, mint string) {
	if walletAddress == "" || tokenPubkey == "" {
		return
	}
	a.knownTokenAccountsMu.Lock()
	defer a.knownTokenAccountsMu.Unlock()
	if a.knownTokenAccounts[walletAddress] == nil {
		a.knownTokenAccounts[walletAddress] = make(map[string]string)
	}
	a.knownTokenAccounts[walletAddress][tokenPubkey] = mint
}

func (a *SolanaAdapter) isKnownTokenAccount(walletAddress, tokenPubkey string) bool {
	a.knownTokenAccountsMu.RLock()
	defer a.knownTokenAccountsMu.RUnlock()
	if m, ok := a.knownTokenAccounts[walletAddress]; ok {
		_, found := m[tokenPubkey]
		return found
	}
	return false
}

// GetKnownTokenAccounts returns a copy of known token accounts for a wallet
func (a *SolanaAdapter) GetKnownTokenAccounts(walletAddress string) map[string]string {
	a.knownTokenAccountsMu.RLock()
	defer a.knownTokenAccountsMu.RUnlock()
	res := make(map[string]string)
	if m, ok := a.knownTokenAccounts[walletAddress]; ok {
		for k, v := range m {
			res[k] = v
		}
	}
	return res
}

// LoadKnownTokenAccounts loads known token accounts into memory cache
func (a *SolanaAdapter) LoadKnownTokenAccounts(walletAddress string, ataMap map[string]string) {
	if walletAddress == "" || len(ataMap) == 0 {
		return
	}
	a.knownTokenAccountsMu.Lock()
	defer a.knownTokenAccountsMu.Unlock()
	if a.knownTokenAccounts[walletAddress] == nil {
		a.knownTokenAccounts[walletAddress] = make(map[string]string)
	}
	for k, v := range ataMap {
		a.knownTokenAccounts[walletAddress][k] = v
	}
}

func (a *SolanaAdapter) ProviderName() string {
	return "SOLANA_RPC"
}

func (a *SolanaAdapter) SupportsNetwork(net model.BlockchainNetwork) bool {
	return net == model.BlockchainNetworkSolana
}

func (a *SolanaAdapter) GetCapability(net model.BlockchainNetwork) model.WalletCapabilityLevel {
	if a.heliusAPIKey != "" {
		return model.WalletCapabilityEnhancedHistory
	}
	return model.WalletCapabilityActivityIndexed
}

type rpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type solanaBalanceResult struct {
	Value uint64 `json:"value"`
}

type solanaTokenAccountItem struct {
	Pubkey  string `json:"pubkey"`
	Account struct {
		Data struct {
			Parsed struct {
				Info struct {
					Mint        string `json:"mint"`
					TokenAmount struct {
						Amount   string `json:"amount"`
						Decimals int    `json:"decimals"`
					} `json:"tokenAmount"`
				} `json:"info"`
			} `json:"parsed"`
		} `json:"data"`
	} `json:"account"`
}

type solanaSignatureItem struct {
	Signature string `json:"signature"`
	Slot      uint64 `json:"slot"`
	BlockTime *int64 `json:"blockTime"`
}

type solanaTransactionResult struct {
	BlockTime *int64 `json:"blockTime"`
	Slot      uint64 `json:"slot"`
	Meta      struct {
		Err             interface{} `json:"err"`
		Fee             uint64      `json:"fee"`
		PreBalances     []int64     `json:"preBalances"`
		PostBalances    []int64     `json:"postBalances"`
		LoadedAddresses struct {
			Writable []string `json:"writable"`
			Readonly []string `json:"readonly"`
		} `json:"loadedAddresses"`
		PreTokenBalances []struct {
			AccountIndex  int    `json:"accountIndex"`
			Mint          string `json:"mint"`
			Owner         string `json:"owner"`
			UITokenAmount struct {
				Amount   string `json:"amount"`
				Decimals int    `json:"decimals"`
			} `json:"uiTokenAmount"`
		} `json:"preTokenBalances"`
		PostTokenBalances []struct {
			AccountIndex  int    `json:"accountIndex"`
			Mint          string `json:"mint"`
			Owner         string `json:"owner"`
			UITokenAmount struct {
				Amount   string `json:"amount"`
				Decimals int    `json:"decimals"`
			} `json:"uiTokenAmount"`
		} `json:"postTokenBalances"`
		InnerInstructions []struct {
			Index        int               `json:"index"`
			Instructions []json.RawMessage `json:"instructions"`
		} `json:"innerInstructions"`
	} `json:"meta"`
	Transaction struct {
		Signatures []string `json:"signatures"`
		Message    struct {
			AccountKeys  []interface{}     `json:"accountKeys"`
			Instructions []json.RawMessage `json:"instructions"`
		} `json:"message"`
	} `json:"transaction"`
}

// FetchBalances fetches native SOL and SPL + Token-2022 balances
func (a *SolanaAdapter) FetchBalances(ctx context.Context, net model.BlockchainNetwork, address string) ([]blockchain.RawTokenBalance, error) {
	if net != model.BlockchainNetworkSolana {
		return nil, fmt.Errorf("network %s not supported by SolanaAdapter", net)
	}

	var results []blockchain.RawTokenBalance

	// 1. Native SOL Balance
	balReq := rpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "getBalance",
		Params:  []interface{}{address},
	}
	balResBytes, errBal := a.doRPCPost(ctx, balReq)
	if errBal == nil {
		var parsedBal solanaBalanceResult
		if errUnmarshal := json.Unmarshal(balResBytes, &parsedBal); errUnmarshal == nil {
			results = append(results, blockchain.RawTokenBalance{
				Network:      model.BlockchainNetworkSolana,
				Address:      address,
				TokenAddress: nil,
				Symbol:       "SOL",
				Name:         "Solana",
				Decimals:     9,
				RawBalance:   strconv.FormatUint(parsedBal.Value, 10),
				IsNative:     true,
			})
		}
	} else {
		log.Printf("[WARN] [SolanaAdapter] getBalance failed: %v", errBal)
	}

	// 2. Query both SPL Token and Token-2022 programs
	tokenPrograms := []string{SPLTokenProgramID, Token2022ProgramID}
	for _, progID := range tokenPrograms {
		tokReq := rpcRequest{
			JSONRPC: "2.0",
			ID:      2,
			Method:  "getTokenAccountsByOwner",
			Params: []interface{}{
				address,
				map[string]interface{}{"programId": progID},
				map[string]interface{}{"encoding": "jsonParsed"},
			},
		}
		tokResBytes, errTok := a.doRPCPost(ctx, tokReq)
		if errTok != nil {
			continue
		}

		var parsedTok struct {
			Value []solanaTokenAccountItem `json:"value"`
		}
		if errUnmarshal := json.Unmarshal(tokResBytes, &parsedTok); errUnmarshal == nil {
			for _, item := range parsedTok.Value {
				info := item.Account.Data.Parsed.Info
				mint := info.Mint
				amt := info.TokenAmount.Amount
				if amt == "" || amt == "0" {
					continue
				}

				sym, name, dec := ResolveSolanaTokenMetadata(ctx, mint, a.httpClient)
				decimals := info.TokenAmount.Decimals
				if decimals <= 0 && dec > 0 {
					decimals = dec
				}

				a.RegisterKnownTokenAccount(address, item.Pubkey, mint)

				results = append(results, blockchain.RawTokenBalance{
					Network:      model.BlockchainNetworkSolana,
					Address:      address,
					TokenAddress: &mint,
					Symbol:       sym,
					Name:         name,
					Decimals:     decimals,
					RawBalance:   amt,
					IsNative:     false,
				})
			}
		}
	}

	if errBal != nil && len(results) == 0 {
		return nil, fmt.Errorf("solana rpc failed to fetch balances: %w", errBal)
	}

	return results, nil
}

// discoverTokenAccountsFromInstructions inspects outer and inner instructions to discover
// token accounts (and their owners/mints) created or closed in this transaction.
func (a *SolanaAdapter) discoverTokenAccountsFromInstructions(walletAddress string, rawInstructions []json.RawMessage) {
	for _, raw := range rawInstructions {
		var parsedInstr struct {
			Program   string `json:"program"`
			ProgramID string `json:"programId"`
			Parsed    struct {
				Type string                 `json:"type"`
				Info map[string]interface{} `json:"info"`
			} `json:"parsed"`
		}
		if err := json.Unmarshal(raw, &parsedInstr); err != nil {
			continue
		}

		info := parsedInstr.Parsed.Info
		if info == nil {
			continue
		}

		switch parsedInstr.Parsed.Type {
		case "closeAccount":
			// SPL Token closeAccount info:
			// { "account": "tokenAccountPubkey", "destination": "walletPubkey", "owner": "walletPubkey" }
			dest, _ := info["destination"].(string)
			owner, _ := info["owner"].(string)
			acc, _ := info["account"].(string)
			if (strings.EqualFold(dest, walletAddress) || strings.EqualFold(owner, walletAddress)) && acc != "" {
				mint, _ := info["mint"].(string)
				a.RegisterKnownTokenAccount(walletAddress, acc, mint)
			}
		case "initializeAccount", "initializeAccount2", "initializeAccount3":
			// { "account": "tokenAccountPubkey", "mint": "mintPubkey", "owner": "walletPubkey" }
			owner, _ := info["owner"].(string)
			acc, _ := info["account"].(string)
			mint, _ := info["mint"].(string)
			if strings.EqualFold(owner, walletAddress) && acc != "" {
				a.RegisterKnownTokenAccount(walletAddress, acc, mint)
			}
		}
	}
}

type closeInstructionDetails struct {
	Account         string
	Destination     string
	Owner           string
	ProgramID       string
	IsToken2022     bool
	AccountDataSize int
	PriorTransfers  bool
}

// Solana SIMD-0437 Versioned Rent Schedule & Reduction Steps
type RentScheduleStep struct {
	StepIndex       int
	ActivationEpoch uint64
	ActivationSlot  uint64
	LamportsPerByte int64
	Name            string
}

const SlotsPerEpoch = uint64(432000)

// SIMD0437RentSchedule defines the complete activation history of SIMD-0437.
// - Step 0: Before epoch 1028 -> 6,960 lamports/byte (165B -> 2,039,280; 230B -> 2,491,680)
// - Step 1: Epoch 1028 to 1032 -> 6,333 lamports/byte (activated Sept 3, 2026; 165B -> 1,855,569; 230B -> 2,267,214)
// - Step 2: Epoch 1033 onwards -> 5,080 lamports/byte (activated Sept 11, 2026 at epoch 1033; 165B -> 1,488,440; 230B -> 1,818,640)
// Future steps (Step 3, 4, 5) can be appended without modifying the calculation engine.
var SIMD0437RentSchedule = []RentScheduleStep{
	{StepIndex: 0, ActivationEpoch: 0, ActivationSlot: 0, LamportsPerByte: 6960, Name: "ORIGINAL"},
	{StepIndex: 1, ActivationEpoch: 1028, ActivationSlot: 1028 * SlotsPerEpoch, LamportsPerByte: 6333, Name: "SIMD_0437_STEP_1"},
	{StepIndex: 2, ActivationEpoch: 1033, ActivationSlot: 1033 * SlotsPerEpoch, LamportsPerByte: 5080, Name: "SIMD_0437_STEP_2"},
}

// GetEpochForSlot converts a Solana slot to an epoch number (432,000 slots per epoch)
func GetEpochForSlot(slot uint64) uint64 {
	return slot / SlotsPerEpoch
}

// GetRentRateForEpoch returns the applicable lamports-per-byte rate for a specific Solana epoch
func GetRentRateForEpoch(epoch uint64) int64 {
	rate := SIMD0437RentSchedule[0].LamportsPerByte
	for _, step := range SIMD0437RentSchedule {
		if epoch >= step.ActivationEpoch {
			rate = step.LamportsPerByte
		}
	}
	return rate
}

// CalculateSolanaRentForRate calculates the rent-exempt reserve for a given data size and rate
func CalculateSolanaRentForRate(dataSize int, rate int64) int64 {
	if dataSize <= 0 {
		dataSize = 165
	}
	return int64(128+dataSize) * rate
}

// CalculateSolanaRentForEpoch calculates the rent-exempt reserve for a given data size at an epoch
func CalculateSolanaRentForEpoch(dataSize int, epoch uint64) int64 {
	return CalculateSolanaRentForRate(dataSize, GetRentRateForEpoch(epoch))
}

// CalculateSolanaRentExemptLamportsHistorical calculates reserve for historical era
func CalculateSolanaRentExemptLamportsHistorical(dataSize int, isPreSIMD bool) int64 {
	if isPreSIMD {
		return CalculateSolanaRentForRate(dataSize, 6960)
	}
	return CalculateSolanaRentForRate(dataSize, 5080)
}

// CalculateSolanaRentExemptLamports derives current rent-exempt reserve (Step 2 active)
func CalculateSolanaRentExemptLamports(dataSize int) int64 {
	return CalculateSolanaRentForRate(dataSize, 5080)
}

// ResolveSolanaWSOLRentReserve determines the exact rent reserve for a WSOL account across all SIMD-0437 epochs:
// - Step 0 (before epoch 1028): 6,960 lamports/byte (165B -> 2,039,280; 230B -> 2,491,680)
// - Step 1 (epoch 1028..1032): 6,333 lamports/byte (165B -> 1,855,569; 230B -> 2,267,214)
// - Step 2 (epoch 1033 onwards): 5,080 lamports/byte (165B -> 1,488,440; 230B -> 1,818,640)
// It respects accounts created before reductions that retain historical reserves,
// checks balance deltas, and flags isAmbiguous = true when historical funding cannot be proven.
func ResolveSolanaWSOLRentReserve(dataSize int, slot uint64, blockTime *int64, accountLamports int64, tokenAmount *big.Int) (int64, bool) {
	epoch := GetEpochForSlot(slot)
	if epoch == 0 && blockTime != nil {
		if *blockTime < 1788480000 {
			epoch = 1020 // Pre-SIMD (before Sept 3, 2026)
		} else if *blockTime < 1789171200 {
			epoch = 1030 // Step 1 (Sept 3 to Sept 11, 2026)
		} else {
			epoch = 1035 // Step 2 (Sept 11, 2026 onwards)
		}
	}

	res0 := CalculateSolanaRentForRate(dataSize, 6960)
	res1 := CalculateSolanaRentForRate(dataSize, 6333)
	res2 := CalculateSolanaRentForRate(dataSize, 5080)

	// 1. Transaction executed prior to Step 1 (before epoch 1028)
	if epoch < 1028 {
		return res0, false
	}

	// 2. Exact matches with candidate reserves (0 token balance or pure rent reclamation)
	if accountLamports == res0 {
		return res0, false // Retained Step 0 reserve
	}
	if accountLamports == res1 {
		return res1, false // Retained Step 1 reserve
	}
	if accountLamports == res2 {
		return res2, false // Funded under Step 2
	}

	// 3. Match with declared token amount: accountLamports - candidateReserve == tokenAmount
	if tokenAmount != nil && tokenAmount.Sign() > 0 {
		amt := tokenAmount.Int64()
		if accountLamports-res0 == amt {
			return res0, false // Proven Step 0 creation!
		}
		if accountLamports-res1 == amt {
			return res1, false // Proven Step 1 creation!
		}
		if accountLamports-res2 == amt {
			return res2, false // Proven Step 2 creation!
		}
	}

	// 4. For Step 1 era transactions (epoch 1028..1032)
	if epoch < 1033 {
		if tokenAmount != nil && tokenAmount.Sign() > 0 && accountLamports > res1 {
			// Ambiguous excess lamports without matching delta
			return res1, true
		}
		return res1, false
	}

	// 5. For Step 2 era transactions (epoch >= 1033)
	if tokenAmount != nil && tokenAmount.Sign() > 0 && accountLamports > res2 {
		// Ambiguous historical funding: could be old Step 0 / Step 1 account or direct transfer
		return res2, true
	}

	// If no excess lamports, current Step 2 rate applies
	return res2, false
}

func parseCloseAccountInstructions(outer []json.RawMessage, inners []struct {
	Index        int               `json:"index"`
	Instructions []json.RawMessage `json:"instructions"`
}) map[string]closeInstructionDetails {
	details := make(map[string]closeInstructionDetails)
	accountsWithPriorTransfers := make(map[string]bool)

	processInstr := func(raw json.RawMessage) {
		var parsedInstr struct {
			Program   string `json:"program"`
			ProgramID string `json:"programId"`
			Parsed    struct {
				Type string                 `json:"type"`
				Info map[string]interface{} `json:"info"`
			} `json:"parsed"`
		}
		if err := json.Unmarshal(raw, &parsedInstr); err != nil || parsedInstr.Parsed.Info == nil {
			return
		}
		info := parsedInstr.Parsed.Info

		// Detect prior transfer instructions that shift lamports of token accounts
		if parsedInstr.Parsed.Type == "transfer" || parsedInstr.Parsed.Type == "transferChecked" || parsedInstr.Parsed.Type == "transferWithSeed" {
			if src, ok := info["source"].(string); ok && src != "" {
				accountsWithPriorTransfers[src] = true
			}
			if dst, ok := info["destination"].(string); ok && dst != "" {
				accountsWithPriorTransfers[dst] = true
			}
		}

		if parsedInstr.Parsed.Type == "closeAccount" {
			acc, _ := info["account"].(string)
			dest, _ := info["destination"].(string)
			owner, _ := info["owner"].(string)
			if acc != "" {
				prog := parsedInstr.ProgramID
				if prog == "" {
					prog = parsedInstr.Program
				}
				isTok2022 := prog == Token2022ProgramID || parsedInstr.Program == "spl-token-2022"
				accSize := 165
				if isTok2022 {
					if ds, ok := info["dataSize"].(float64); ok && int(ds) > 0 {
						accSize = int(ds)
					} else if extList, ok := info["extensions"].([]interface{}); ok && len(extList) > 0 {
						accSize = 165 + len(extList)*64
					}
				}
				details[acc] = closeInstructionDetails{
					Account:         acc,
					Destination:     dest,
					Owner:           owner,
					ProgramID:       prog,
					IsToken2022:     isTok2022,
					AccountDataSize: accSize,
					PriorTransfers:  accountsWithPriorTransfers[acc],
				}
			}
		}
	}

	for _, raw := range outer {
		processInstr(raw)
	}
	for _, inner := range inners {
		for _, raw := range inner.Instructions {
			processInstr(raw)
		}
	}

	return details
}

// FetchTransfers retrieves historical transaction signatures and details with rate limiting
func (a *SolanaAdapter) FetchTransfers(ctx context.Context, net model.BlockchainNetwork, address string, cursor string) (*blockchain.TransferPage, error) {
	if net != model.BlockchainNetworkSolana {
		return nil, fmt.Errorf("network %s not supported by SolanaAdapter", net)
	}

	sigParams := map[string]interface{}{"limit": 25}
	if cursor != "" {
		sigParams["before"] = cursor
	}

	sigReq := rpcRequest{
		JSONRPC: "2.0",
		ID:      10,
		Method:  "getSignaturesForAddress",
		Params:  []interface{}{address, sigParams},
	}

	sigResBytes, err := a.doRPCPost(ctx, sigReq)
	if err != nil {
		return &blockchain.TransferPage{}, nil // fail gracefully without blocking sync
	}

	var sigs []solanaSignatureItem
	if err := json.Unmarshal(sigResBytes, &sigs); err != nil || len(sigs) == 0 {
		return &blockchain.TransferPage{}, nil
	}

	var movements []blockchain.RawTransferMovement
	var nextCursor *string

	for i, sigItem := range sigs {
		if i == len(sigs)-1 {
			nextCursor = &sigItem.Signature
		}

		txReq := rpcRequest{
			JSONRPC: "2.0",
			ID:      20 + i,
			Method:  "getTransaction",
			Params: []interface{}{
				sigItem.Signature,
				map[string]interface{}{
					"encoding":                       "jsonParsed",
					"maxSupportedTransactionVersion": 0,
				},
			},
		}

		txResBytes, errTx := a.doRPCPost(ctx, txReq)
		if errTx != nil {
			continue
		}

		var txResult solanaTransactionResult
		if err := json.Unmarshal(txResBytes, &txResult); err != nil {
			continue
		}

		execTime := time.Now().UTC()
		if txResult.BlockTime != nil {
			execTime = time.Unix(*txResult.BlockTime, 0).UTC()
		}

		feeStr := strconv.FormatUint(txResult.Meta.Fee, 10)
		rawMeta, _ := json.Marshal(txResult)

		// Reconstruct full account keys (static + Address Lookup Table loadedAddresses)
		allAccountKeys := make([]string, 0, len(txResult.Transaction.Message.AccountKeys)+len(txResult.Meta.LoadedAddresses.Writable)+len(txResult.Meta.LoadedAddresses.Readonly))
		for _, keyObj := range txResult.Transaction.Message.AccountKeys {
			switch v := keyObj.(type) {
			case string:
				allAccountKeys = append(allAccountKeys, v)
			case map[string]interface{}:
				if pk, ok := v["pubkey"].(string); ok {
					allAccountKeys = append(allAccountKeys, pk)
				}
			}
		}
		allAccountKeys = append(allAccountKeys, txResult.Meta.LoadedAddresses.Writable...)
		allAccountKeys = append(allAccountKeys, txResult.Meta.LoadedAddresses.Readonly...)

		closeDetailsMap := parseCloseAccountInstructions(
			txResult.Transaction.Message.Instructions,
			txResult.Meta.InnerInstructions,
		)

		// Discover token accounts from outer instructions and inner instructions (crucial on first import)
		a.discoverTokenAccountsFromInstructions(address, txResult.Transaction.Message.Instructions)
		for _, inner := range txResult.Meta.InnerInstructions {
			a.discoverTokenAccountsFromInstructions(address, inner.Instructions)
		}

		// Also discover token accounts from pre/post token balances where owner is explicit
		for _, preTok := range txResult.Meta.PreTokenBalances {
			if preTok.Owner == address && preTok.AccountIndex < len(allAccountKeys) {
				a.RegisterKnownTokenAccount(address, allAccountKeys[preTok.AccountIndex], preTok.Mint)
			}
		}
		for _, postTok := range txResult.Meta.PostTokenBalances {
			if postTok.Owner == address && postTok.AccountIndex < len(allAccountKeys) {
				a.RegisterKnownTokenAccount(address, allAccountKeys[postTok.AccountIndex], postTok.Mint)
			}
		}

		// Find index of wallet address in reconstructed account keys
		accIdx := -1
		for idx, keyStr := range allAccountKeys {
			if keyStr == address {
				accIdx = idx
				break
			}
		}

		// If transaction failed, handle fee-only deduction if wallet is fee payer
		if txResult.Meta.Err != nil {
			if accIdx == 0 && feeStr != "0" {
				failedMeta, _ := json.Marshal(map[string]interface{}{
					"slot":         txResult.Slot,
					"fee":          txResult.Meta.Fee,
					"is_failed_tx": true,
					"error":        fmt.Sprintf("%v", txResult.Meta.Err),
				})
				movements = append(movements, blockchain.RawTransferMovement{
					TxHash:          sigItem.Signature,
					BlockOrSlot:     int64(txResult.Slot),
					ExecutedAt:      execTime,
					FromAddress:     address,
					ToAddress:       address,
					TokenAddress:    nil,
					RawAmount:       "0",
					Decimals:        9,
					FeeAmount:       feeStr,
					MovementIndex:   0,
					ProviderSource:  "SOLANA_RPC",
					RawMetadataJSON: failedMeta,
				})
			}
			continue
		}

		// Check if any token account belonging to this wallet was closed in this transaction
		hasClosedATA := false
		var closedWSOLAmount *big.Int
		var wsolBreakdownIncomplete bool

		for _, preTok := range txResult.Meta.PreTokenBalances {
			var ataPubkey string
			if preTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[preTok.AccountIndex]
			}
			isOwner := preTok.Owner == address || (ataPubkey != "" && a.isKnownTokenAccount(address, ataPubkey))
			if !isOwner {
				continue
			}
			foundInPost := false
			for _, postTok := range txResult.Meta.PostTokenBalances {
				if postTok.AccountIndex == preTok.AccountIndex {
					foundInPost = true
					break
				}
			}
			if !foundInPost {
				closeDetail, hasCloseDetail := closeDetailsMap[ataPubkey]
				destMatchesWallet := true
				accountDataSize := 165
				priorTransfers := false
				if hasCloseDetail {
					if closeDetail.Destination != "" && !strings.EqualFold(closeDetail.Destination, address) {
						destMatchesWallet = false
					}
					accountDataSize = closeDetail.AccountDataSize
					priorTransfers = closeDetail.PriorTransfers
				}

				if destMatchesWallet {
					hasClosedATA = true
				}

				if IsWrappedSOL(preTok.Mint) {
					preAmt, _ := new(big.Int).SetString(preTok.UITokenAmount.Amount, 10)
					if preAmt == nil {
						preAmt = big.NewInt(0)
					}

					accountLamports := int64(0)
					if preTok.AccountIndex < len(txResult.Meta.PreBalances) {
						accountLamports = txResult.Meta.PreBalances[preTok.AccountIndex]
					}

					// Derive rent-exempt deposit dynamically accounting for SIMD-0437 versioned rent schedule
					rentDeposit, isRentAmbiguous := ResolveSolanaWSOLRentReserve(accountDataSize, txResult.Slot, txResult.BlockTime, accountLamports, preAmt)
					if isRentAmbiguous {
						wsolBreakdownIncomplete = true
					}

					if priorTransfers {
						// Prior SOL transfers modified account balance before CloseAccount; exact split cannot be proven
						wsolBreakdownIncomplete = true
						if destMatchesWallet && preAmt.Sign() > 0 {
							if closedWSOLAmount == nil {
								closedWSOLAmount = new(big.Int).Set(preAmt)
							} else {
								closedWSOLAmount.Add(closedWSOLAmount, preAmt)
							}
						}
					} else {
						principalFromLamports := accountLamports - rentDeposit
						if principalFromLamports < 0 {
							principalFromLamports = 0
						}

						effectiveWSOL := preAmt
						if principalFromLamports > preAmt.Int64() {
							effectiveWSOL = big.NewInt(principalFromLamports)
						}

						if destMatchesWallet && effectiveWSOL.Sign() > 0 {
							if closedWSOLAmount == nil {
								closedWSOLAmount = new(big.Int).Set(effectiveWSOL)
							} else {
								closedWSOLAmount.Add(closedWSOLAmount, effectiveWSOL)
							}
						}
					}
				}
			}
		}

		// 1. Detect Native SOL delta for the wallet
		hasNativeDelta := false
		if accIdx >= 0 && accIdx < len(txResult.Meta.PreBalances) && accIdx < len(txResult.Meta.PostBalances) {
			pre := txResult.Meta.PreBalances[accIdx]
			post := txResult.Meta.PostBalances[accIdx]
			isFeePayer := accIdx == 0

			delta := post - pre
			fee := txResult.Meta.Fee

			if isFeePayer {
				// Invariant: post = pre - fee + netTransfer => netTransfer = delta + fee
				netTransfer := delta + int64(fee)
				isRentRecovery := hasClosedATA && netTransfer > 0
				isWSOLUnwrap := closedWSOLAmount != nil && closedWSOLAmount.Sign() > 0 && netTransfer > 0

				var wrappedSolUnwrappedLamports string
				var rentRecoveredLamports string
				if isWSOLUnwrap {
					wsolLamports := closedWSOLAmount.Int64()
					rentRecovered := netTransfer - wsolLamports
					if rentRecovered < 0 {
						rentRecovered = 0
					}
					wrappedSolUnwrappedLamports = closedWSOLAmount.String()
					rentRecoveredLamports = strconv.FormatInt(rentRecovered, 10)
				} else if isRentRecovery {
					rentRecoveredLamports = strconv.FormatInt(netTransfer, 10)
				}

				nativeMetaMap := map[string]interface{}{
					"slot":                   txResult.Slot,
					"fee":                    txResult.Meta.Fee,
					"net_transfer_lamports":  netTransfer,
					"rent_recovery_detected": isRentRecovery,
				}
				if isWSOLUnwrap {
					nativeMetaMap["is_wsol_unwrap"] = true
					nativeMetaMap["wrapped_sol_unwrapped_lamports"] = wrappedSolUnwrappedLamports
					nativeMetaMap["rent_recovered_lamports"] = rentRecoveredLamports
					if wsolBreakdownIncomplete {
						nativeMetaMap["wsol_breakdown_incomplete"] = true
					}
				} else if isRentRecovery {
					nativeMetaMap["rent_recovered_lamports"] = rentRecoveredLamports
				}
				rawNativeMeta, _ := json.Marshal(nativeMetaMap)

				if netTransfer < 0 {
					// Net outflow from fee payer
					hasNativeDelta = true
					transferAmt := uint64(-netTransfer)
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     address,
						ToAddress:       "",
						TokenAddress:    nil,
						RawAmount:       strconv.FormatUint(transferAmt, 10),
						Decimals:        9,
						FeeAmount:       feeStr,
						MovementIndex:   0,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: rawNativeMeta,
					})
				} else if netTransfer > 0 {
					// Net inflow to fee payer (e.g. received transfer, reward, unwrap, or swap output)
					hasNativeDelta = true
					transferAmt := uint64(netTransfer)
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     "",
						ToAddress:       address,
						TokenAddress:    nil,
						RawAmount:       strconv.FormatUint(transferAmt, 10),
						Decimals:        9,
						FeeAmount:       feeStr,
						MovementIndex:   0,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: rawNativeMeta,
					})
				} else {
					// netTransfer == 0: Fee-only interaction (no transfer, just fee spent)
					hasNativeDelta = true
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     address,
						ToAddress:       address,
						TokenAddress:    nil,
						RawAmount:       "0",
						Decimals:        9,
						FeeAmount:       feeStr,
						MovementIndex:   0,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: rawNativeMeta,
					})
				}
			} else {
				// Wallet is recipient or third-party (fee was paid by accountKeys[0])
				delta := post - pre
				if delta != 0 {
					hasNativeDelta = true
					rawAmt := strconv.FormatInt(delta, 10)
					fromAddr := address
					toAddr := ""
					if delta > 0 {
						fromAddr = ""
						toAddr = address
					} else {
						rawAmt = strconv.FormatInt(-delta, 10)
					}

					recipientMeta := rawMeta
					if hasClosedATA && delta > 0 {
						isWSOLUnwrap := closedWSOLAmount != nil && closedWSOLAmount.Sign() > 0
						mMap := map[string]interface{}{
							"slot":                   txResult.Slot,
							"fee":                    0,
							"net_transfer_lamports":  delta,
							"rent_recovery_detected": true,
						}
						if isWSOLUnwrap {
							wsolLamports := closedWSOLAmount.Int64()
							rentRecovered := delta - wsolLamports
							if rentRecovered < 0 {
								rentRecovered = 0
							}
							mMap["is_wsol_unwrap"] = true
							mMap["wrapped_sol_unwrapped_lamports"] = closedWSOLAmount.String()
							mMap["rent_recovered_lamports"] = strconv.FormatInt(rentRecovered, 10)
							if wsolBreakdownIncomplete {
								mMap["wsol_breakdown_incomplete"] = true
							}
						}
						recipientMeta, _ = json.Marshal(mMap)
					}

					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     fromAddr,
						ToAddress:       toAddr,
						TokenAddress:    nil,
						RawAmount:       rawAmt,
						Decimals:        9,
						FeeAmount:       "0", // fee paid by sender/fee payer
						MovementIndex:   0,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: recipientMeta,
					})
				}
			}
		}

		// 2. Detect SPL Token deltas for the wallet
		preTokenMap := make(map[int]string)
		for _, preTok := range txResult.Meta.PreTokenBalances {
			var ataPubkey string
			if preTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[preTok.AccountIndex]
			}
			isOwner := preTok.Owner == address || (preTok.Owner == "" && ataPubkey != "" && a.isKnownTokenAccount(address, ataPubkey))
			if isOwner {
				if ataPubkey != "" && preTok.Mint != "" {
					a.RegisterKnownTokenAccount(address, ataPubkey, preTok.Mint)
				}
				preTokenMap[preTok.AccountIndex] = preTok.UITokenAmount.Amount
			}
		}

		hasTokenDelta := false
		for _, postTok := range txResult.Meta.PostTokenBalances {
			var ataPubkey string
			if postTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[postTok.AccountIndex]
			}
			isOwner := postTok.Owner == address || (postTok.Owner == "" && ataPubkey != "" && a.isKnownTokenAccount(address, ataPubkey))
			if !isOwner {
				continue
			}
			if ataPubkey != "" && postTok.Mint != "" {
				a.RegisterKnownTokenAccount(address, ataPubkey, postTok.Mint)
			}

			preAmtStr := preTokenMap[postTok.AccountIndex]
			postAmtStr := postTok.UITokenAmount.Amount

			preBig, _ := new(big.Int).SetString(preAmtStr, 10)
			if preBig == nil {
				preBig = big.NewInt(0)
			}
			postBig, _ := new(big.Int).SetString(postAmtStr, 10)
			if postBig == nil {
				postBig = big.NewInt(0)
			}

			diff := new(big.Int).Sub(postBig, preBig)
			if diff.Sign() != 0 {
				hasTokenDelta = true
				absDiff := new(big.Int).Abs(diff)
				mint := postTok.Mint
				fromAddr := address
				toAddr := ""
				if diff.Sign() > 0 {
					fromAddr = ""
					toAddr = address
				}

				movements = append(movements, blockchain.RawTransferMovement{
					TxHash:          sigItem.Signature,
					BlockOrSlot:     int64(txResult.Slot),
					ExecutedAt:      execTime,
					FromAddress:     fromAddr,
					ToAddress:       toAddr,
					TokenAddress:    &mint,
					RawAmount:       absDiff.String(),
					Decimals:        postTok.UITokenAmount.Decimals,
					FeeAmount:       "0",
					MovementIndex:   100 + postTok.AccountIndex, // Deterministic index for SPL token account
					ProviderSource:  "SOLANA_RPC",
					RawMetadataJSON: rawMeta,
				})
			}
		}

		// Handle closed token accounts (in PreTokenBalances but omitted from PostTokenBalances)
		for _, preTok := range txResult.Meta.PreTokenBalances {
			var ataPubkey string
			if preTok.AccountIndex < len(allAccountKeys) {
				ataPubkey = allAccountKeys[preTok.AccountIndex]
			}
			isOwner := preTok.Owner == address || (preTok.Owner == "" && ataPubkey != "" && a.isKnownTokenAccount(address, ataPubkey))
			if !isOwner {
				continue
			}

			foundInPost := false
			for _, postTok := range txResult.Meta.PostTokenBalances {
				if postTok.AccountIndex == preTok.AccountIndex {
					foundInPost = true
					break
				}
			}

			if !foundInPost {
				preBig, _ := new(big.Int).SetString(preTok.UITokenAmount.Amount, 10)
				if preBig == nil {
					preBig = big.NewInt(0)
				}
				mint := preTok.Mint
				isWSOL := IsWrappedSOL(mint)

				closeDetail, hasCloseDetail := closeDetailsMap[ataPubkey]
				destMatchesWallet := true
				accountDataSize := 165
				priorTransfers := false
				if hasCloseDetail {
					if closeDetail.Destination != "" && !strings.EqualFold(closeDetail.Destination, address) {
						destMatchesWallet = false
					}
					accountDataSize = closeDetail.AccountDataSize
					priorTransfers = closeDetail.PriorTransfers
				}

				effectiveAmount := preBig
				var rentDeposit int64
				var isRentAmbiguous bool
				if isWSOL {
					accountLamports := int64(0)
					if preTok.AccountIndex < len(txResult.Meta.PreBalances) {
						accountLamports = txResult.Meta.PreBalances[preTok.AccountIndex]
					}
					rentDeposit, isRentAmbiguous = ResolveSolanaWSOLRentReserve(accountDataSize, txResult.Slot, txResult.BlockTime, accountLamports, preBig)
					if isRentAmbiguous {
						wsolBreakdownIncomplete = true
					}
					if !priorTransfers && !isRentAmbiguous {
						principalFromLamports := accountLamports - rentDeposit
						if principalFromLamports > preBig.Int64() {
							effectiveAmount = big.NewInt(principalFromLamports)
						}
					}
				}

				if effectiveAmount.Sign() > 0 || hasCloseDetail {
					hasTokenDelta = true
					closedMetaMap := map[string]interface{}{
						"slot":                txResult.Slot,
						"mint":                mint,
						"is_account_closure":  true,
						"destination_is_user": destMatchesWallet,
					}
					if hasCloseDetail && closeDetail.Destination != "" {
						closedMetaMap["close_destination"] = closeDetail.Destination
					}
					if isWSOL {
						closedMetaMap["is_wsol_unwrap"] = destMatchesWallet
						closedMetaMap["unwrapped_to_native"] = destMatchesWallet
						closedMetaMap["wrapped_sol_unwrapped_lamports"] = effectiveAmount.String()
						closedMetaMap["rent_deposit_lamports"] = rentDeposit
						epoch := GetEpochForSlot(txResult.Slot)
						if epoch == 0 && txResult.BlockTime != nil {
							if *txResult.BlockTime < 1788480000 {
								epoch = 1020
							} else if *txResult.BlockTime < 1789171200 {
								epoch = 1030
							} else {
								epoch = 1035
							}
						}
						if epoch < 1028 {
							closedMetaMap["rent_parameter_step"] = "ORIGINAL_PRE_SIMD"
						} else if epoch < 1033 {
							closedMetaMap["rent_parameter_step"] = "SIMD_0437_STEP_1"
						} else {
							closedMetaMap["rent_parameter_step"] = "SIMD_0437_STEP_2"
						}
						if priorTransfers {
							closedMetaMap["wsol_breakdown_incomplete"] = true
							closedMetaMap["breakdown_reason"] = "intra_transaction_sol_transfers"
						} else if wsolBreakdownIncomplete || isRentAmbiguous {
							closedMetaMap["wsol_breakdown_incomplete"] = true
							closedMetaMap["breakdown_reason"] = "ambiguous_rent_reserve_split"
						}
					}
					closedMeta, _ := json.Marshal(closedMetaMap)
					movements = append(movements, blockchain.RawTransferMovement{
						TxHash:          sigItem.Signature,
						BlockOrSlot:     int64(txResult.Slot),
						ExecutedAt:      execTime,
						FromAddress:     address,
						ToAddress:       "",
						TokenAddress:    &mint,
						RawAmount:       effectiveAmount.String(),
						Decimals:        preTok.UITokenAmount.Decimals,
						FeeAmount:       "0",
						MovementIndex:   100 + preTok.AccountIndex,
						ProviderSource:  "SOLANA_RPC",
						RawMetadataJSON: closedMeta,
					})
				}
			}
		}

		// Fallback for interactions where fees were paid without balance deltas
		if !hasNativeDelta && !hasTokenDelta && feeStr != "0" && accIdx == 0 {
			movements = append(movements, blockchain.RawTransferMovement{
				TxHash:          sigItem.Signature,
				BlockOrSlot:     int64(txResult.Slot),
				ExecutedAt:      execTime,
				FromAddress:     address,
				ToAddress:       address,
				TokenAddress:    nil,
				RawAmount:       "0",
				Decimals:        9,
				FeeAmount:       feeStr,
				MovementIndex:   0,
				ProviderSource:  "SOLANA_RPC",
				RawMetadataJSON: rawMeta,
			})
		}
	}

	return &blockchain.TransferPage{
		Movements:   movements,
		NextPageKey: nextCursor,
	}, nil
}

func (a *SolanaAdapter) doRPCPost(ctx context.Context, req rpcRequest) (json.RawMessage, error) {
	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	maxRetries := 2
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt*500) * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		if errWait := a.rateLimiter.Wait(ctx); errWait != nil {
			return nil, errWait
		}

		httpReq, errHttp := http.NewRequestWithContext(ctx, "POST", a.endpoint, bytes.NewReader(payloadBytes))
		if errHttp != nil {
			return nil, errHttp
		}
		httpReq.Header.Set("Content-Type", "application/json")

		httpResp, errDo := a.httpClient.Do(httpReq)
		if errDo != nil {
			lastErr = errDo
			continue
		}

		bodyBytes, errRead := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if errRead != nil {
			lastErr = errRead
			continue
		}

		if httpResp.StatusCode == http.StatusTooManyRequests || httpResp.StatusCode == http.StatusServiceUnavailable {
			lastErr = fmt.Errorf("solana rpc rate limited HTTP %d", httpResp.StatusCode)
			continue
		}

		if httpResp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("solana rpc returned HTTP %d: %s", httpResp.StatusCode, string(bodyBytes))
		}

		var rpcResp struct {
			JSONRPC string          `json:"jsonrpc"`
			ID      int             `json:"id"`
			Result  json.RawMessage `json:"result"`
			Error   *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}

		if errUnmarshal := json.Unmarshal(bodyBytes, &rpcResp); errUnmarshal != nil {
			return nil, fmt.Errorf("failed to parse Solana JSON-RPC response: %w", errUnmarshal)
		}

		if rpcResp.Error != nil {
			return nil, fmt.Errorf("Solana JSON-RPC error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
		}

		return rpcResp.Result, nil
	}

	return nil, fmt.Errorf("solana rpc failed after %d retries: %w", maxRetries, lastErr)
}
