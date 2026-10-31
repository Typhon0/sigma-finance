package bitcoin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testZPub = "zpub6r8JgMt7TXTyYm3KKW1ZVr2DJZsTuaWiQoY7Kc62cEXvUbbawz6muDR9fMstL91spEszmAjVT6YgfrBTx5h63crz85cuPGNt3LBzns4rUQG"

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

func TestDeriveAddress_BIP84(t *testing.T) {
	xpubNorm, keyType, err := NormalizeExtendedKey(testZPub)
	require.NoError(t, err)

	masterKey, err := hdkeychain.NewKeyFromString(xpubNorm)
	require.NoError(t, err)

	receiveBranch, err := masterKey.Derive(0) // /0/*
	require.NoError(t, err)

	addr0, err := DeriveAddress(receiveBranch, keyType, 0)
	require.NoError(t, err)
	assert.Equal(t, "bc1qre9zy4yy3z4pc6gpyn5nc4szn0qxuktef2j227", addr0)

	addr1, err := DeriveAddress(receiveBranch, keyType, 1)
	require.NoError(t, err)
	assert.Equal(t, "bc1qll7fndc6tnwjr967gj7hlhnm7hd9xf6yjqgs0m", addr1)
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




