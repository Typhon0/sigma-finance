package bitcoin

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/base58"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Official BIP-84 account test vector (m/84'/0'/0')
const testZPub = "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs"

func TestNormalizeExtendedKey(t *testing.T) {
	xpubNorm, keyType, err := NormalizeExtendedKey(testZPub)
	require.NoError(t, err)
	assert.Equal(t, "zpub", keyType)
	assert.True(t, len(xpubNorm) > 100)
	assert.True(t, xpubNorm[:4] == "xpub")

	key, err := hdkeychain.NewKeyFromString(xpubNorm)
	require.NoError(t, err)
	require.NotNil(t, key)
}

// TestDeriveAddress_BIP84 verifies the complete 5-stage BIP-84 derivation:
// 1. Base58Check decode and checksum verification
// 2. Correct zpub magic version bytes (0x04b24746)
// 3. Public child branch & index derivation (/0/0)
// 4. P2WPKH HASH160 construction from compressed public key
// 5. Final Bech32 address encoding equality with official expected address (bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu)
func TestDeriveAddress_BIP84(t *testing.T) {
	// 1. Base58Check validity check
	decoded := base58.Decode(testZPub)
	require.Len(t, decoded, 82, "Extended key with checksum must be 82 bytes (78 payload + 4 checksum)")

	payload := decoded[:78]
	declaredChecksum := decoded[78:]
	computedChecksum := chainhash.DoubleHashB(payload)
	assert.Equal(t, declaredChecksum, computedChecksum[:4], "Base58Check 4-byte checksum must match double-SHA256 of payload")

	// 2. Correct zpub version bytes (0x04, 0xb2, 0x47, 0x46 for mainnet zpub)
	assert.Equal(t, []byte{0x04, 0xb2, 0x47, 0x46}, payload[:4], "Magic version bytes must be 0x04b24746 (zpub)")

	// 3. Public child derivation (/0/0)
	xpubNorm, keyType, err := NormalizeExtendedKey(testZPub)
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

	// Verify DeriveAddress helper produces exact matching addresses
	addr0, err := DeriveAddress(receiveBranch, keyType, 0)
	require.NoError(t, err)
	assert.Equal(t, "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", addr0)

	addr1, err := DeriveAddress(receiveBranch, keyType, 1)
	require.NoError(t, err)
	assert.Equal(t, "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g", addr1)
}

func TestClient_Failover(t *testing.T) {
	// Server 1 fails with 500
	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer server1.Close()

	// Server 2 succeeds
	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		stats := EsploraAddressStats{
			Address: "bc1qtest",
		}
		stats.ChainStats.FundedTxoSum = 50000
		stats.ChainStats.SpentTxoSum = 10000
		stats.ChainStats.TxCount = 2
		_ = json.NewEncoder(w).Encode(stats)
	}))
	defer server2.Close()

	client := NewClient(server1.URL, server2.URL)
	stats, err := client.FetchAddressStats(context.Background(), "bc1qtest")
	require.NoError(t, err)
	require.NotNil(t, stats)
	assert.Equal(t, uint64(50000), stats.ChainStats.FundedTxoSum)
	assert.Equal(t, int64(2), stats.ChainStats.TxCount)
}

func TestClient_FetchBalances_StandaloneAddress(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		stats := EsploraAddressStats{
			Address: "bc1qstandalone",
		}
		stats.ChainStats.FundedTxoSum = 100000
		stats.ChainStats.SpentTxoSum = 25000
		_ = json.NewEncoder(w).Encode(stats)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	bals, err := client.FetchBalances(context.Background(), "bc1qstandalone")
	require.NoError(t, err)
	require.Len(t, bals, 1)
	assert.Equal(t, "75000", bals[0].RawBalance)
	assert.Equal(t, "BTC", bals[0].Symbol)
	assert.Equal(t, 8, bals[0].Decimals)
}

func TestClient_FetchTransfers_MultiAddressAggregation(t *testing.T) {
	// Mock transaction with multiple inputs and change
	// Wallet addresses: addr1, addr2, addr3
	// Inputs: 100,000 (addr1) + 50,000 (addr2) = 150,000
	// Outputs: 40,000 (addr3 change) + 108,000 (external recipient)
	// Fee: 2,000
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if !strings.Contains(r.URL.Path, "/txs") {
			stats := EsploraAddressStats{
				Address: "bc1q_test",
			}
			_ = json.NewEncoder(w).Encode(stats)
			return
		}
		tx := EsploraTx{
			TxID: "tx-multispend-123",
			Fee:  2000,
			Vin: []EsploraVin{
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_addr1", Value: 100000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_addr2", Value: 50000}},
			},
			Vout: []EsploraVout{
				{ScriptpubkeyAddress: "bc1q_addr3", Value: 40000},       // change back to wallet
				{ScriptpubkeyAddress: "bc1q_external_recipient", Value: 108000}, // external payment
			},
		}
		tx.Status.Confirmed = true
		tx.Status.BlockHeight = 800000
		_ = json.NewEncoder(w).Encode([]EsploraTx{tx})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	descriptor := testZPub
	client.activeAddrCache[descriptor] = []string{"bc1q_addr1", "bc1q_addr2", "bc1q_addr3"}

	page, err := client.FetchTransfers(context.Background(), descriptor, "")
	require.NoError(t, err)
	require.NotNil(t, page)
	require.Len(t, page.Movements, 1)

	m := page.Movements[0]
	assert.Equal(t, "tx-multispend-123", m.TxHash)
	assert.Equal(t, "108000", m.RawAmount) // net outflow (150k - 40k change = 110k) minus fee (2k) = 108k external recipient!
	assert.Equal(t, "2000", m.FeeAmount)
	assert.Equal(t, 0, m.MovementIndex)
}

func TestBitcoinClient_CollaborativeTx_ProportionalFee(t *testing.T) {
	// CoinJoin scenario:
	// 5 inputs totaling 500,000 satoshis.
	// Our wallet supplied 1 input of 100,000 sat (20% of total inputs).
	// Other participants supplied 400,000 sat across 4 inputs.
	// Total miner fee is 2,500 sat.
	// Our wallet received change of 99,500 sat (net spent = 500 sat).
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		tx := EsploraTx{
			TxID: "tx-coinjoin-456",
			Fee:  2500,
			Vin: []EsploraVin{
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_my_wallet", Value: 100000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_peer1", Value: 100000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_peer2", Value: 100000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_peer3", Value: 100000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_peer4", Value: 100000}},
			},
			Vout: []EsploraVout{
				{ScriptpubkeyAddress: "bc1q_my_wallet", Value: 99500}, // change
				{ScriptpubkeyAddress: "bc1q_peer1_out", Value: 99500},
				{ScriptpubkeyAddress: "bc1q_peer2_out", Value: 99500},
				{ScriptpubkeyAddress: "bc1q_peer3_out", Value: 99500},
				{ScriptpubkeyAddress: "bc1q_peer4_out", Value: 99500},
			},
		}
		tx.Status.Confirmed = true
		tx.Status.BlockHeight = 800001
		_ = json.NewEncoder(w).Encode([]EsploraTx{tx})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	page, err := client.FetchTransfers(context.Background(), "bc1q_my_wallet", "")
	require.NoError(t, err)
	require.NotNil(t, page)
	require.Len(t, page.Movements, 1)

	m := page.Movements[0]
	assert.Equal(t, "tx-coinjoin-456", m.TxHash)
	assert.Equal(t, "0", m.RawAmount, "Should be zero external transfer (consolidation/change only)")
	// In collaborative transactions, wallet only pays its proportional share of fee: 20% of 2500 = 500 sat!
	assert.Equal(t, "500", m.FeeAmount, "Should allocate proportional fee share (500 sat), NOT total tx fee (2500 sat)")

	var meta map[string]interface{}
	errMeta := json.Unmarshal(m.RawMetadataJSON, &meta)
	require.NoError(t, errMeta)
	assert.Equal(t, true, meta["is_collaborative"], "Must be flagged as collaborative transaction")
}

func TestBitcoinClient_MempoolLimitDetection(t *testing.T) {
	// Server returns 50 mempool transactions
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if r.URL.Path == "/address/bc1q_mempool_heavy/txs/mempool" {
			txs := make([]EsploraTx, 50)
			for i := 0; i < 50; i++ {
				txs[i] = EsploraTx{
					TxID: fmt.Sprintf("mempool-tx-%d", i),
					Fee:  1000,
					Vin: []EsploraVin{
						{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_mempool_heavy", Value: 50000}},
					},
					Vout: []EsploraVout{
						{ScriptpubkeyAddress: "bc1q_ext_target", Value: 49000},
					},
				}
			}
			_ = json.NewEncoder(w).Encode(txs)
			return
		}
		_ = json.NewEncoder(w).Encode([]EsploraTx{})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	page, err := client.FetchTransfers(context.Background(), "bc1q_mempool_heavy", "")
	require.NoError(t, err)
	require.NotNil(t, page)
	assert.Len(t, page.Movements, 50, "Should successfully ingest 50 mempool movements")

	// Metadata must have mempool_truncated: true
	var meta map[string]interface{}
	errMeta := json.Unmarshal(page.Movements[0].RawMetadataJSON, &meta)
	require.NoError(t, errMeta)
	assert.Equal(t, true, meta["mempool_truncated"], "When mempool returns 50 txs, mempool_truncated must be true")
}

func TestBitcoinClient_CollaborativeTx_BigIntSafeMath(t *testing.T) {
	// 20,000 BTC input = 2,000,000,000,000 satoshis
	// Total fee = 100,000,000 satoshis (1 BTC fee)
	// (Fee * walletSpentSat) = 10^8 * 2*10^12 = 2*10^20 > math.MaxUint64 (1.84*10^19)
	// Must not overflow!
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		tx := EsploraTx{
			TxID: "tx-huge-coinjoin-999",
			Fee:  100000000, // 1 BTC fee
			Vin: []EsploraVin{
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_whale", Value: 2000000000000}}, // 20,000 BTC
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_peer_whale", Value: 2000000000000}}, // 20,000 BTC
			},
			Vout: []EsploraVout{
				{ScriptpubkeyAddress: "bc1q_whale", Value: 1999950000000}, // change
				{ScriptpubkeyAddress: "bc1q_peer_whale_out", Value: 1999950000000},
			},
		}
		tx.Status.Confirmed = true
		tx.Status.BlockHeight = 850000
		_ = json.NewEncoder(w).Encode([]EsploraTx{tx})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	page, err := client.FetchTransfers(context.Background(), "bc1q_whale", "")
	require.NoError(t, err)
	require.NotNil(t, page)
	require.Len(t, page.Movements, 1)

	// Half of 1 BTC fee = 50,000,000 satoshis
	assert.Equal(t, "50000000", page.Movements[0].FeeAmount)
}

func TestBitcoinClient_PayJoinCollaborativeTx(t *testing.T) {
	// PayJoin scenario:
	// Wallet inputs 50,000 sat, external peer inputs 150,000 sat (total input 200,000 sat).
	// Total miner fee is 10,000 sat.
	// Wallet receives 40,000 sat change.
	// Net outflow = 50,000 - 40,000 = 10,000 sat.
	// Wallet spent = 50,000 sat (25% of 200,000 sat).
	// Wallet allocated fee = (10,000 * 50,000) / 200,000 = 2,500 sat.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		tx := EsploraTx{
			TxID: "tx-payjoin-collab-101",
			Fee:  10000,
			Vin: []EsploraVin{
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_wallet_payjoin", Value: 50000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_external_sender", Value: 150000}},
			},
			Vout: []EsploraVout{
				{ScriptpubkeyAddress: "bc1q_wallet_payjoin", Value: 40000},       // change back to wallet
				{ScriptpubkeyAddress: "bc1q_merchant_recipient", Value: 150000}, // payment to merchant
			},
		}
		tx.Status.Confirmed = true
		tx.Status.BlockHeight = 860000
		_ = json.NewEncoder(w).Encode([]EsploraTx{tx})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	page, err := client.FetchTransfers(context.Background(), "bc1q_wallet_payjoin", "")
	require.NoError(t, err)
	require.NotNil(t, page)
	require.Len(t, page.Movements, 1)

	mvt := page.Movements[0]
	assert.Equal(t, "2500", mvt.FeeAmount, "Wallet fee must be proportionally allocated 2,500 sat")
	// Net outflow (10,000) - walletFee (2,500) = 7,500 external payment
	assert.Equal(t, "7500", mvt.RawAmount)

	var meta map[string]interface{}
	err = json.Unmarshal(mvt.RawMetadataJSON, &meta)
	require.NoError(t, err)

	assert.Equal(t, true, meta["is_collaborative"])
	assert.Equal(t, "proportional_input_value", meta["fee_allocation_method"])
	assert.Equal(t, true, meta["fee_is_estimated"])
}

func TestBitcoinClient_InternalUtxoConsolidation(t *testing.T) {
	// Internal UTXO consolidation scenario:
	// Wallet inputs 50,000 sat from addr1 and 50,000 sat from addr2 (total 100,000 sat).
	// Consolidated into addr3 (98,000 sat).
	// Miner fee = 2,000 sat.
	// All addresses belong to the same wallet descriptor!
	// External outflow must be 0 sat; only the 2,000 sat fee is recorded!
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if !strings.Contains(r.URL.Path, "/txs") {
			stats := EsploraAddressStats{
				Address: "bc1q_test",
			}
			_ = json.NewEncoder(w).Encode(stats)
			return
		}
		tx := EsploraTx{
			TxID: "tx-consolidation-303",
			Fee:  2000,
			Vin: []EsploraVin{
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_consol_addr1", Value: 50000}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_consol_addr2", Value: 50000}},
			},
			Vout: []EsploraVout{
				{ScriptpubkeyAddress: "bc1q_consol_addr3", Value: 98000},
			},
		}
		tx.Status.Confirmed = true
		tx.Status.BlockHeight = 860002
		_ = json.NewEncoder(w).Encode([]EsploraTx{tx})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	descriptor := testZPub
	client.activeAddrCache[descriptor] = []string{"bc1q_consol_addr1", "bc1q_consol_addr2", "bc1q_consol_addr3"}

	page, err := client.FetchTransfers(context.Background(), descriptor, "")
	require.NoError(t, err)
	require.NotNil(t, page)
	require.Len(t, page.Movements, 1)

	mvt := page.Movements[0]
	assert.Equal(t, "0", mvt.RawAmount, "Consolidation within same wallet must not produce external outflow")
	assert.Equal(t, "2000", mvt.FeeAmount, "Full transaction fee (2,000 sat) must be accounted")
	assert.Equal(t, descriptor, mvt.FromAddress)

	var meta map[string]interface{}
	err = json.Unmarshal(mvt.RawMetadataJSON, &meta)
	require.NoError(t, err)
	assert.Equal(t, false, meta["is_collaborative"])
	assert.Equal(t, "exact_sole_payer", meta["fee_allocation_method"])
	assert.Equal(t, false, meta["fee_is_estimated"])
}




func TestBitcoinClient_FeeAllocationRounding(t *testing.T) {
	// Rounding scenario:
	// Wallet inputs 33,333 sat, external inputs 66,667 sat (total input 100,000 sat).
	// Total miner fee is 1,000 sat.
	// (1,000 * 33,333) / 100,000 = 333.33 -> integer division floors to 333 sat.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		tx := EsploraTx{
			TxID: "tx-rounding-collab-202",
			Fee:  1000,
			Vin: []EsploraVin{
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_rounding_wallet", Value: 33333}},
				{Prevout: &EsploraVout{ScriptpubkeyAddress: "bc1q_ext_peer", Value: 66667}},
			},
			Vout: []EsploraVout{
				{ScriptpubkeyAddress: "bc1q_rounding_wallet", Value: 30000},
				{ScriptpubkeyAddress: "bc1q_merchant", Value: 69000},
			},
		}
		tx.Status.Confirmed = true
		tx.Status.BlockHeight = 860001
		_ = json.NewEncoder(w).Encode([]EsploraTx{tx})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	page, err := client.FetchTransfers(context.Background(), "bc1q_rounding_wallet", "")
	require.NoError(t, err)
	require.NotNil(t, page)
	require.Len(t, page.Movements, 1)

	mvt := page.Movements[0]
	assert.Equal(t, "333", mvt.FeeAmount, "Fee must be safely floored to 333 sat without overflow or overcharge")

	var meta map[string]interface{}
	err = json.Unmarshal(mvt.RawMetadataJSON, &meta)
	require.NoError(t, err)

	assert.Equal(t, true, meta["is_collaborative"])
	assert.Equal(t, "proportional_input_value", meta["fee_allocation_method"])
	assert.Equal(t, true, meta["fee_is_estimated"])
}

func TestClient_DefaultEndpoints_OrderAndFailover(t *testing.T) {
	// 1. Default constructor: Mempool primary + Blockstream failover
	cDefault := NewClient()
	require.Len(t, cDefault.Endpoints(), 2)
	assert.Equal(t, DefaultMempoolEndpoint, cDefault.Endpoints()[0], "Mempool.space must be primary default")
	assert.Equal(t, DefaultBlockstreamEndpoint, cDefault.Endpoints()[1], "Blockstream must be failover default")

	// 2. Custom Esplora endpoint provided: Custom primary + Mempool + Blockstream
	customURL := "https://custom-esplora.internal.org/api"
	cCustom := NewClient(customURL)
	require.Len(t, cCustom.Endpoints(), 3)
	assert.Equal(t, customURL, cCustom.Endpoints()[0], "Custom Esplora endpoint must be first in priority")
	assert.Equal(t, DefaultMempoolEndpoint, cCustom.Endpoints()[1], "Mempool must follow as primary public default")
	assert.Equal(t, DefaultBlockstreamEndpoint, cCustom.Endpoints()[2], "Blockstream must follow as failover default")
}

func TestClient_MempoolOutage_SeamlessBlockstreamFailover(t *testing.T) {
	mempoolCalls := 0
	blockstreamCalls := 0

	// Mempool mock returns 500
	mempoolMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mempoolCalls++
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("500 Internal Server Error (Mempool temporarily down)"))
	}))
	defer mempoolMock.Close()

	// Blockstream mock returns 200 OK
	blockstreamMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		blockstreamCalls++
		w.WriteHeader(http.StatusOK)
		stats := EsploraAddressStats{
			Address: "bc1q_failover_test",
		}
		stats.ChainStats.FundedTxoSum = 2500000 // 0.025 BTC
		stats.ChainStats.SpentTxoSum = 500000
		stats.ChainStats.TxCount = 5
		_ = json.NewEncoder(w).Encode(stats)
	}))
	defer blockstreamMock.Close()

	client := NewClient(mempoolMock.URL, blockstreamMock.URL)

	// First call triggers failover from mempool to blockstream
	stats, err := client.FetchAddressStats(context.Background(), "bc1q_failover_test")
	require.NoError(t, err, "Failover to Blockstream must succeed without error")
	require.NotNil(t, stats)
	assert.Equal(t, uint64(2500000), stats.ChainStats.FundedTxoSum)
	assert.Equal(t, int64(5), stats.ChainStats.TxCount)
	assert.Equal(t, 1, mempoolCalls)
	assert.Equal(t, 1, blockstreamCalls)

	// Second call: Mempool is in cooldown, so request goes DIRECTLY to Blockstream with 0 latency
	stats2, err2 := client.FetchAddressStats(context.Background(), "bc1q_failover_test")
	require.NoError(t, err2)
	require.NotNil(t, stats2)
	assert.Equal(t, 1, mempoolCalls, "Mempool must not be called again while in cooldown")
	assert.Equal(t, 2, blockstreamCalls, "Blockstream must serve request directly")
}

func TestClient_AntiPositionWiping_OnTotalExplorerOutage(t *testing.T) {
	// Both Mempool and Blockstream mock servers fail with 503
	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server1.Close()

	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server2.Close()

	client := NewClient(server1.URL, server2.URL)

	// 1. Standalone balance fetch must return ERROR, NEVER "0" satoshis
	bals, err := client.FetchBalances(context.Background(), "bc1q_offline_test")
	assert.Error(t, err, "FetchBalances must return error on total provider failure")
	assert.Nil(t, bals, "Must NOT return zero-balance slice that wipes existing positions")

	// 2. Persistent scan on extended key with known addresses must return ERROR, NEVER "0" satoshis
	knownCache := `{"receive_index":0,"change_index":0,"addresses":["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"]}`
	zpub := "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs"
	addrs, sat, _, errScan := client.ScanExtendedKeyPersistent(context.Background(), zpub, &knownCache)
	assert.Error(t, errScan, "ScanExtendedKeyPersistent must return error on total provider failure")
	assert.Equal(t, uint64(0), sat)
	assert.Nil(t, addrs, "Must NOT return active addresses with 0 sat balance when endpoints are failing")

	// 3. Initial ScanExtendedKey must also return error
	addrsInit, satInit, errInit := client.ScanExtendedKey(context.Background(), zpub)
	assert.Error(t, errInit, "ScanExtendedKey must return error on total provider failure")
	assert.Equal(t, uint64(0), satInit)
	assert.Nil(t, addrsInit)
}








