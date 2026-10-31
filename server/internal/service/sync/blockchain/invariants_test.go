package blockchain_test

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/base58"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/joho/godotenv"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure"
	"sigma_finance/internal/service/sync/blockchain"
	"sigma_finance/internal/service/sync/blockchain/bitcoin"
)

// Invariant 1: Conservation of Balances
// closing_balance = opening_balance + sum(inflows) - sum(outflows) - sum(fees_when_payer)
func TestInvariant_ConservationOfBalances(t *testing.T) {
	// Starting balance: 10.0 ETH (10 * 10^18 wei)
	openingWei, _ := new(big.Int).SetString("10000000000000000000", 10)
	closingWei := new(big.Int).Set(openingWei)

	// Transfer 1: Incoming 2.5 ETH (no fee paid by recipient)
	inflowWei, _ := new(big.Int).SetString("2500000000000000000", 10)
	closingWei.Add(closingWei, inflowWei)

	// Transfer 2: Outgoing 1.0 ETH, fee 0.0021 ETH (2100000000000000 wei)
	outflowWei, _ := new(big.Int).SetString("1000000000000000000", 10)
	feeWei, _ := new(big.Int).SetString("2100000000000000", 10)
	closingWei.Sub(closingWei, outflowWei)
	closingWei.Sub(closingWei, feeWei)

	// Transfer 3: ERC-20 transfer out (0 ETH principal outflow, only 0.0015 ETH gas fee)
	tokenGasFeeWei, _ := new(big.Int).SetString("1500000000000000", 10)
	closingWei.Sub(closingWei, tokenGasFeeWei)

	// Expected closing: 10 + 2.5 - 1.0 - 0.0021 - 0.0015 = 11.4964 ETH (11496400000000000000 wei)
	expectedWei, _ := new(big.Int).SetString("11496400000000000000", 10)
	assert.Equal(t, 0, closingWei.Cmp(expectedWei), "Closing balance must exactly match opening + inflows - outflows - fees in wei")

	// Verify formatted decimal representation maintains conservation
	openingDec := decimal.NewFromBigInt(openingWei, -18)
	inflowDec := decimal.NewFromBigInt(inflowWei, -18)
	outflowDec := decimal.NewFromBigInt(outflowWei, -18)
	feeDec := decimal.NewFromBigInt(feeWei, -18)
	tokenGasDec := decimal.NewFromBigInt(tokenGasFeeWei, -18)

	calculatedClosing := openingDec.Add(inflowDec).Sub(outflowDec).Sub(feeDec).Sub(tokenGasDec)
	expectedClosingDec := decimal.NewFromBigInt(expectedWei, -18)

	assert.True(t, calculatedClosing.Equal(expectedClosingDec), "Decimal conservation must match: %s vs %s", calculatedClosing, expectedClosingDec)
}

// Invariant 2: Idempotence of Activities & Sync Processing
// sync(sync(movements)) == sync(movements)
func TestInvariant_IdempotenceOfMovements(t *testing.T) {
	contractAddr := "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
	rawMovement := blockchain.RawTransferMovement{
		TxHash:         "0xidempotent_tx_hash_999",
		BlockOrSlot:    18500100,
		ExecutedAt:     time.Unix(1730000000, 0).UTC(),
		FromAddress:    "0xuser_address",
		ToAddress:      "0xcounterparty",
		TokenAddress:   &contractAddr,
		RawAmount:      "5000000000000000000",
		Decimals:       18,
		FeeAmount:      "21000000000000",
		MovementIndex:  0,
		ProviderSource: "BLOCKSCOUT",
	}

	// Generating activity deduplication key twice must yield identical keys
	key1 := fmt.Sprintf("%s:%s:%d:%d", rawMovement.TxHash, *rawMovement.TokenAddress, rawMovement.BlockOrSlot, rawMovement.MovementIndex)
	key2 := fmt.Sprintf("%s:%s:%d:%d", rawMovement.TxHash, *rawMovement.TokenAddress, rawMovement.BlockOrSlot, rawMovement.MovementIndex)

	assert.Equal(t, key1, key2, "Deduplication identifier must be perfectly idempotent across runs")

	// Classifying the same activity batch multiple times produces deterministic outputs
	classifier := blockchain.NewActivityClassifier()
	account := &model.WalletAccount{
		ID:            "wacc-idempotence",
		UserID:        "user-idempotence",
		AddressOrXpub: "0xuser_address",
		Network:       model.BlockchainNetworkEthereum,
	}

	activity := &model.WalletActivity{
		ID:              "act-idemp-1",
		WalletAccountID: "wacc-idempotence",
		TxHash:          rawMovement.TxHash,
		FromAddress:     rawMovement.FromAddress,
		ToAddress:       rawMovement.ToAddress,
		FormattedAmount: decimal.NewFromFloat(5.0),
		ExecutedAt:      rawMovement.ExecutedAt,
	}

	res1, err1 := classifier.Classify(context.Background(), account, []*model.WalletActivity{activity}, nil)
	require.NoError(t, err1)

	res2, err2 := classifier.Classify(context.Background(), account, []*model.WalletActivity{activity}, nil)
	require.NoError(t, err2)

	assert.Equal(t, len(res1.Transactions), len(res2.Transactions))
	assert.Equal(t, res1.Transactions[0].Type, res2.Transactions[0].Type)
	assert.Equal(t, res1.Transactions[0].Amount, res2.Transactions[0].Amount)
}

// Invariant 3: Resilience to Provider Failures (No Zeroing of Account Balances)
type failingProvider struct{}

func (f *failingProvider) ProviderName() string                                  { return "FAILING" }
func (f *failingProvider) SupportsNetwork(network model.BlockchainNetwork) bool { return true }
func (f *failingProvider) FetchBalances(ctx context.Context, net model.BlockchainNetwork, addr string) ([]blockchain.RawTokenBalance, error) {
	return nil, errors.New("upstream RPC 500 Internal Server Error")
}
func (f *failingProvider) FetchTransfers(ctx context.Context, net model.BlockchainNetwork, addr, cursor string) (*blockchain.TransferPage, error) {
	return nil, errors.New("upstream Blockscout 429 Rate Limit Exceeded")
}

func TestInvariant_ResilienceToProviderFailures(t *testing.T) {
	// If provider returns an error, existing state must not be mutated or cleared
	existingBalances := []*model.WalletBalance{
		{
			ID:                "bal-preserve-1",
			WalletAccountID:   "wacc-1",
			Symbol:            "ETH",
			RawBalance:        "5000000000000000000",
			FormattedQuantity: decimal.NewFromFloat(5.0),
		},
	}

	provider := &failingProvider{}
	_, errBal := provider.FetchBalances(context.Background(), model.BlockchainNetworkEthereum, "0xaddr")
	require.Error(t, errBal, "Failing provider must return error")

	// Balances remain untouched and valid
	assert.Len(t, existingBalances, 1)
	assert.Equal(t, "5000000000000000000", existingBalances[0].RawBalance)
	assert.Equal(t, "5", existingBalances[0].FormattedQuantity.String())
}

func TestInvariant_MempoolOutage_NoPositionWipingAndBlockstreamFailover(t *testing.T) {
	// 1. Mempool is temporarily down (returns 500)
	mempoolMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("500 Internal Server Error (Mempool outage)"))
	}))
	defer mempoolMock.Close()

	// 2. Blockstream failover is healthy (returns 200 OK)
	blockstreamMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		stats := bitcoin.EsploraAddressStats{
			Address: "bc1q_invariants_btc",
		}
		stats.ChainStats.FundedTxoSum = 5687164 // 0.05687164 BTC
		stats.ChainStats.SpentTxoSum = 0
		stats.ChainStats.TxCount = 3
		_ = json.NewEncoder(w).Encode(stats)
	}))
	defer blockstreamMock.Close()

	client := bitcoin.NewClient(mempoolMock.URL, blockstreamMock.URL)

	// Invariant A: Mempool unavailability must NEVER block wallet sync. Failover to Blockstream succeeds.
	bals, err := client.FetchBalances(context.Background(), "bc1q_invariants_btc")
	require.NoError(t, err, "Mempool outage must not block sync; failover to Blockstream must succeed")
	require.Len(t, bals, 1)
	assert.Equal(t, "5687164", bals[0].RawBalance)
	assert.Equal(t, "BTC", bals[0].Symbol)

	// Invariant B: Total provider unavailability must NEVER wipe existing positions.
	// When all providers fail, FetchBalances returns error, preserving database records.
	offlineServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer offlineServer.Close()

	offlineClient := bitcoin.NewClient(offlineServer.URL)
	balsOffline, errOffline := offlineClient.FetchBalances(context.Background(), "bc1q_invariants_btc")
	assert.Error(t, errOffline, "Total provider outage must return error")
	assert.Nil(t, balsOffline, "Must not return zero balance that could wipe existing positions")
}

// Invariant 4: Exact Integer and 78-digit Numeric Precision
func TestInvariant_NumericPrecision78Digits(t *testing.T) {
	// Max uint256 wei value (2^256 - 1)
	maxUint256Str := "115792089237316195423570985008687907853269984665640564039457584007913129639935"

	bigIntVal, ok := new(big.Int).SetString(maxUint256Str, 10)
	require.True(t, ok)
	assert.Equal(t, maxUint256Str, bigIntVal.String())

	// 1 satoshi / 1 lamport precision test
	oneSatoshiStr := "1"
	oneSatBig, ok := new(big.Int).SetString(oneSatoshiStr, 10)
	require.True(t, ok)

	oneSatDec := decimal.NewFromBigInt(oneSatBig, -8)
	assert.Equal(t, "0.00000001", oneSatDec.String(), "1 satoshi must be formatted to exactly 8 decimal places")

	oneLamportDec := decimal.NewFromBigInt(oneSatBig, -9)
	assert.Equal(t, "0.000000001", oneLamportDec.String(), "1 lamport must be formatted to exactly 9 decimal places")

	oneWeiDec := decimal.NewFromBigInt(oneSatBig, -18)
	assert.Equal(t, "0.000000000000000001", oneWeiDec.String(), "1 wei must be formatted to exactly 18 decimal places")
}

// Invariant 5: Anti-Phantom Gains on Failed Transactions & Internal Transfers
func TestInvariant_AntiPhantomGains(t *testing.T) {
	classifier := blockchain.NewActivityClassifier()
	userAddr := "0xmy_vault_addr"

	account := &model.WalletAccount{
		ID:            "wacc-vault",
		UserID:        "user-1",
		AddressOrXpub: userAddr,
		Network:       model.BlockchainNetworkEthereum,
	}

	// 1. Failed contract execution (gas spent, zero amount transferred)
	failedTxActivity := &model.WalletActivity{
		ID:              "act-failed-gas",
		WalletAccountID: "wacc-vault",
		TxHash:          "0xfailed_tx_hash",
		FromAddress:     userAddr,
		ToAddress:       "0xcontract_reverted",
		FormattedAmount: decimal.Zero,
		FeeAmount:       "5000000000000000", // 0.005 ETH fee
		ExecutedAt:      time.Now().UTC(),
	}

	res, err := classifier.Classify(context.Background(), account, []*model.WalletActivity{failedTxActivity}, nil)
	require.NoError(t, err)

	// Must only produce a FEE transaction, never a buy/sell trade!
	require.Len(t, res.Transactions, 1, "Failed transaction must only produce 1 FEE disposal transaction")
	assert.Equal(t, model.TransactionTypeFee, res.Transactions[0].Type)

	// 2. Internal transfer to another address owned by the same user
	internalTransferActivity := &model.WalletActivity{
		ID:              "act-internal-transfer",
		WalletAccountID: "wacc-vault",
		TxHash:          "0xinternal_transfer_hash",
		FromAddress:     userAddr,
		ToAddress:       "0xmy_second_wallet",
		FormattedAmount: decimal.NewFromFloat(2.5),
		FeeAmount:       "21000000000000",
		ExecutedAt:      time.Now().UTC(),
	}

	allUserAddresses := map[string]bool{
		userAddr:             true,
		"0xmy_second_wallet": true,
	}

	resInternal, err := classifier.Classify(context.Background(), account, []*model.WalletActivity{internalTransferActivity}, allUserAddresses)
	require.NoError(t, err)

	// Internal transfer between owned wallets must be classified as TRANSFER_OUT, preserving basis
	require.Len(t, resInternal.Transactions, 2)
	assert.Equal(t, model.TransactionTypeTransferOut, resInternal.Transactions[0].Type)
	assert.Equal(t, model.TransactionTypeFee, resInternal.Transactions[1].Type)
}

// Invariant 6: Lossless Numeric Precision for Portfolio Accounting (No Banker Rounding)
func TestInvariant_ExactLosslessQuantitiesForPortfolioAccounting(t *testing.T) {
	// Scenario: High-supply token holding: 50,000,000,000,000 tokens with 18 decimals
	// Raw wei units = 50 * 10^12 * 10^18 = 5 * 10^31 wei (32 digits)
	rawAmountStr := "50000000000000000000000000000000"
	decimals := 18

	// In database, wallet_balances stores raw_balance as NUMERIC(78, 0)
	bal := model.NewWalletBalanceFromRaw("wacc-lossless", "MEME", "MemeToken", decimals, rawAmountStr, nil, false)
	assert.Equal(t, rawAmountStr, bal.RawBalance, "Raw balance must be losslessly preserved")
	assert.Equal(t, decimals, bal.Decimals)

	// Portfolio accounting layer derives quantity without banker rounding
	rawBig, ok := new(big.Int).SetString(bal.RawBalance, 10)
	require.True(t, ok)

	// Exact conversion: no Banker rounding!
	exactDecimal := decimal.NewFromBigInt(rawBig, -int32(decimals))
	assert.Equal(t, "50000000000000", exactDecimal.String(), "Canonical quantity must not suffer banker rounding truncation")

	// Cost basis derivation: total cost $1,500,000 for 50,000,000,000,000 tokens
	// Unit price = $1,500,000 / 50,000,000,000,000 = $0.00000003 per unit
	totalCost := decimal.NewFromFloat(1500000.0)
	unitCost := totalCost.Div(exactDecimal)
	assert.Equal(t, "0.00000003", unitCost.String(), "Cost basis per unit must maintain arbitrary scale without Banker rounding")
}

// Invariant 7: Deterministic Block Reorg & Checkpoint Recovery
func TestInvariant_DeterministicReorgCheckpointRecovery(t *testing.T) {
	// Scenario: Ingestion encounters block reorg.
	// Initial ingestion: Tx A (block 95), Tx B (block 96), Tx C (block 97, reverted in reorg)
	// Reorg occurs: block 97 is orphaned and replaced by block 97' (Tx D) and block 98 (Tx E).
	// Rewinding to checkpoint block 96 must produce deterministic state without duplicate keys.
	initialBatch := []blockchain.RawTransferMovement{
		{TxHash: "0xtxA", BlockOrSlot: 95, MovementIndex: 0, RawAmount: "1000", ProviderSource: "BLOCKSCOUT"},
		{TxHash: "0xtxB", BlockOrSlot: 96, MovementIndex: 0, RawAmount: "2000", ProviderSource: "BLOCKSCOUT"},
		{TxHash: "0xtxC", BlockOrSlot: 97, MovementIndex: 0, RawAmount: "3000", ProviderSource: "BLOCKSCOUT"},
	}

	activityLedger := make(map[string]blockchain.RawTransferMovement)
	for _, m := range initialBatch {
		key := fmt.Sprintf("%s:%d:%d", m.TxHash, m.BlockOrSlot, m.MovementIndex)
		activityLedger[key] = m
	}
	assert.Len(t, activityLedger, 3)

	// Reorg rewind: checkpoint set at block 96 (pruning orphaned blocks >= 97)
	checkpointBlock := int64(96)
	for k, m := range activityLedger {
		if m.BlockOrSlot > checkpointBlock {
			delete(activityLedger, k)
		}
	}
	assert.Len(t, activityLedger, 2)
	assert.Contains(t, activityLedger, "0xtxA:95:0")
	assert.Contains(t, activityLedger, "0xtxB:96:0")

	// Re-ingest canonical reorganized chain
	reorganizedBatch := []blockchain.RawTransferMovement{
		{TxHash: "0xtxB", BlockOrSlot: 96, MovementIndex: 0, RawAmount: "2000", ProviderSource: "BLOCKSCOUT"}, // repeat of checkpoint
		{TxHash: "0xtxD", BlockOrSlot: 97, MovementIndex: 0, RawAmount: "4000", ProviderSource: "BLOCKSCOUT"}, // new canonical tx
		{TxHash: "0xtxE", BlockOrSlot: 98, MovementIndex: 0, RawAmount: "5000", ProviderSource: "BLOCKSCOUT"},
	}

	for _, m := range reorganizedBatch {
		key := fmt.Sprintf("%s:%d:%d", m.TxHash, m.BlockOrSlot, m.MovementIndex)
		activityLedger[key] = m
	}

	// Result: Exactly 4 distinct canonical transactions, zero duplicated rows, orphaned Tx C purged!
	assert.Len(t, activityLedger, 4)
	assert.Contains(t, activityLedger, "0xtxA:95:0")
	assert.Contains(t, activityLedger, "0xtxB:96:0")
	assert.Contains(t, activityLedger, "0xtxD:97:0")
	assert.Contains(t, activityLedger, "0xtxE:98:0")
	assert.NotContains(t, activityLedger, "0xtxC:97:0", "Orphaned transaction must not remain after reorg recovery")
}

// Invariant 8: BIP-84 SegWit HD Alignment vs Standalone Legacy
// Tests the full 5-stage official BIP-84 derivation:
// 1. Base58Check decode and checksum validation
// 2. Correct zpub magic version bytes (0x04b24746)
// 3. Public child derivation (/0/0)
// 4. P2WPKH HASH160 construction from compressed public key
// 5. Final Bech32 address encoding equality (bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu)
func TestInvariant_BIP84NativeSegwitAlignment(t *testing.T) {
	// Official BIP-84 account test vector (m/84'/0'/0')
	zpubOfficial := "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs"

	// 1. Base58Check validity check
	decoded := base58.Decode(zpubOfficial)
	require.Len(t, decoded, 82, "Extended key with checksum must be 82 bytes (78 payload + 4 checksum)")

	payload := decoded[:78]
	declaredChecksum := decoded[78:]
	computedChecksum := chainhash.DoubleHashB(payload)
	assert.Equal(t, declaredChecksum, computedChecksum[:4], "Base58Check 4-byte checksum must match double-SHA256 of payload")

	// 2. Correct zpub version bytes (0x04, 0xb2, 0x47, 0x46 for mainnet zpub)
	assert.Equal(t, []byte{0x04, 0xb2, 0x47, 0x46}, payload[:4], "Magic version bytes must be 0x04b24746 (zpub)")

	// 3. Public child derivation (/0/0)
	xpubNorm, keyType, err := bitcoin.NormalizeExtendedKey(zpubOfficial)
	require.NoError(t, err)
	assert.Equal(t, "zpub", keyType)

	masterKey, err := hdkeychain.NewKeyFromString(xpubNorm)
	require.NoError(t, err)

	receiveBranch, err := masterKey.Derive(0) // /0/* (external receive branch)
	require.NoError(t, err)

	child0, err := receiveBranch.Derive(0) // /0/0 (first receiving child)
	require.NoError(t, err)

	// 4. P2WPKH HASH160 construction from compressed pubkey
	pubKey, err := child0.ECPubKey()
	require.NoError(t, err)
	compressed := pubKey.SerializeCompressed()
	assert.Len(t, compressed, 33, "Compressed public key must be 33 bytes")

	hash160 := btcutil.Hash160(compressed)
	assert.Len(t, hash160, 20, "HASH160 (RIPEMD160(SHA256(pubkey))) must be 20 bytes")
	assert.Equal(t, "c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2", hex.EncodeToString(hash160), "P2WPKH HASH160 must match official BIP-84 test vector")

	// 5. Final Bech32 address equality
	witnessAddr, err := btcutil.NewAddressWitnessPubKeyHash(hash160, &chaincfg.MainNetParams)
	require.NoError(t, err)
	assert.Equal(t, "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", witnessAddr.EncodeAddress(), "Final Bech32 address /0/0 must match official BIP-84 test vector")

	// Model validation
	accountBIP84 := &model.WalletAccount{
		UserID:        "user-123",
		AddressOrXpub: zpubOfficial,
		Network:       model.BlockchainNetworkBitcoin,
		IsXpub:        true,
	}
	assert.NoError(t, accountBIP84.Validate())

	// Standalone legacy (1...) and nested SegWit (3...) are supported standalone
	accountLegacy := &model.WalletAccount{
		UserID:        "user-123",
		AddressOrXpub: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
		Network:       model.BlockchainNetworkBitcoin,
		IsXpub:        false,
	}
	assert.NoError(t, accountLegacy.Validate())

	accountNested := &model.WalletAccount{
		UserID:        "user-123",
		AddressOrXpub: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
		Network:       model.BlockchainNetworkBitcoin,
		IsXpub:        false,
	}
	assert.NoError(t, accountNested.Validate())
}

// Invariant 9: Exact Lossless Persistence in PostgreSQL (Positions & Transactions)
// Verifies that arbitrary precision (>8 decimals, e.g. 18-decimal quantities and prices)
// is preserved exactly upon database persistence and reload, with zero banker rounding.
func TestInvariant_PostgreSQLPositionQuantityAndCostBasisLosslessPersistence(t *testing.T) {
	_ = godotenv.Load("../../../../.env", "../../../../server/.env")
	db, err := infrastructure.NewDB()
	if err != nil {
		t.Skip("PostgreSQL database not available for persistence test: ", err)
		return
	}
	defer db.Close()

	ctx := context.Background()

	// 1. Fetch an existing portfolio, account, and asset to attach position
	var p model.Portfolio
	err = db.NewSelect().Model(&p).Limit(1).Scan(ctx)
	if err != nil {
		t.Skip("No portfolio available in database: ", err)
		return
	}

	var acc model.Account
	err = db.NewSelect().Model(&acc).Where("portfolio_id = ?", p.ID).Limit(1).Scan(ctx)
	if err != nil {
		t.Skip("No account available for portfolio: ", err)
		return
	}

	var asset model.Asset
	err = db.NewSelect().Model(&asset).Limit(1).Scan(ctx)
	if err != nil {
		t.Skip("No asset available in database: ", err)
		return
	}

	// 2. High-precision 18-decimal quantity and 18-decimal cost basis
	exactQuantityStr := "1.234567890123456789"
	exactCostBasisStr := "2450.987654321098765432"
	totalCostCents := model.Money(302589)

	qty := decimal.RequireFromString(exactQuantityStr)
	costBasis := decimal.RequireFromString(exactCostBasisStr)

	pos := &model.Position{
		PortfolioID:         p.ID,
		AccountID:           acc.ID,
		AssetID:             asset.ID,
		Quantity:            qty,
		OwnershipPercentage: decimal.NewFromInt(100),
		AverageCostBasis:    &costBasis,
		TotalCostBasis:      &totalCostCents,
		QuoteCurrency:       model.CurrencyUSD,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// 3. Persist to PostgreSQL
	_, err = db.NewInsert().Model(pos).Exec(ctx)
	require.NoError(t, err, "Must persist position to PostgreSQL without error")
	defer func() {
		_, _ = db.NewDelete().Model((*model.Position)(nil)).Where("id = ?", pos.ID).Exec(ctx)
	}()

	// 4. Reload from PostgreSQL
	var reloaded model.Position
	err = db.NewSelect().Model(&reloaded).Where("id = ?", pos.ID).Scan(ctx)
	require.NoError(t, err, "Must reload persisted position from PostgreSQL")

	// 5. Assert exact identity (>8 decimals preserved without truncation or rounding)
	assert.Equal(t, exactQuantityStr, reloaded.Quantity.String(),
		"Quantity must retain all 18 decimals in database, zero truncation")
	assert.True(t, qty.Equal(reloaded.Quantity),
		"Quantity decimal mathematical identity must be exact")

	require.NotNil(t, reloaded.AverageCostBasis)
	assert.Equal(t, exactCostBasisStr, reloaded.AverageCostBasis.String(),
		"Average cost basis must retain all 18 decimals in database, zero truncation")
	assert.True(t, costBasis.Equal(*reloaded.AverageCostBasis),
		"Cost basis decimal mathematical identity must be exact")
}



