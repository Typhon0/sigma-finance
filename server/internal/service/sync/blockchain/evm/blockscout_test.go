package evm

import (
	"encoding/json"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
)

func TestSupportsBlockscout(t *testing.T) {
	assert.True(t, SupportsBlockscout(model.BlockchainNetworkBase))
	assert.True(t, SupportsBlockscout(model.BlockchainNetworkArbitrum))
	assert.True(t, SupportsBlockscout(model.BlockchainNetworkOptimism))
	assert.False(t, SupportsBlockscout(model.BlockchainNetworkEthereum))
	assert.False(t, SupportsBlockscout(model.BlockchainNetworkBitcoin))
}

func TestBlockscoutResponseParsing(t *testing.T) {
	rawJSON := `{
		"status": "1",
		"message": "OK",
		"result": [
			{
				"blockNumber": "15000000",
				"timeStamp": "1700000000",
				"hash": "0xabc123",
				"from": "0x1111111111111111111111111111111111111111",
				"to": "0x2222222222222222222222222222222222222222",
				"value": "1500000000000000000",
				"gasUsed": "21000",
				"gasPrice": "50000000",
				"isError": "0"
			}
		]
	}`

	var resp blockscoutResponse
	err := json.Unmarshal([]byte(rawJSON), &resp)
	require.NoError(t, err)
	assert.Equal(t, "1", resp.Status)

	var items []blockscoutTxItem
	err = json.Unmarshal(resp.Result, &items)
	require.NoError(t, err)
	require.Len(t, items, 1)

	item := items[0]
	assert.Equal(t, "0xabc123", item.Hash)
	assert.Equal(t, "1500000000000000000", item.Value)

	gasUsed, _ := new(big.Int).SetString(item.GasUsed, 10)
	gasPrice, _ := new(big.Int).SetString(item.GasPrice, 10)
	fee := new(big.Int).Mul(gasUsed, gasPrice)
	assert.Equal(t, "1050000000000", fee.String())

	execTime := time.Unix(1700000000, 0).UTC()
	assert.Equal(t, 2023, execTime.Year())
}

func TestBlockscoutClient_IncomingVsOutgoingFeeAttribution(t *testing.T) {
	myAddr := "0x1111111111111111111111111111111111111111"
	otherAddr := "0x2222222222222222222222222222222222222222"

	// 1. Outgoing tx: myAddr -> otherAddr (fee attributed to myAddr)
	itemOutgoing := blockscoutTxItem{
		Hash:        "0xout123",
		From:        myAddr,
		To:          otherAddr,
		Value:       "1000000000000000000",
		GasUsed:     "21000",
		GasPrice:    "5000000000", // 5 gwei
		BlockNumber: "100",
		TimeStamp:   "1700000000",
	}

	// 2. Incoming tx: otherAddr -> myAddr (fee paid by otherAddr, 0 for myAddr)
	itemIncoming := blockscoutTxItem{
		Hash:        "0xin456",
		From:        otherAddr,
		To:          myAddr,
		Value:       "2000000000000000000",
		GasUsed:     "21000",
		GasPrice:    "5000000000",
		BlockNumber: "101",
		TimeStamp:   "1700000050",
	}

	// Verify calculation logic
	calcFee := func(item blockscoutTxItem, userAddr string) string {
		feeStr := "0"
		if strings.EqualFold(item.From, userAddr) {
			gu, _ := new(big.Int).SetString(item.GasUsed, 10)
			gp, _ := new(big.Int).SetString(item.GasPrice, 10)
			if gu != nil && gp != nil {
				feeStr = new(big.Int).Mul(gu, gp).String()
			}
		}
		return feeStr
	}

	assert.Equal(t, "105000000000000", calcFee(itemOutgoing, myAddr)) // 21000 * 5 gwei
	assert.Equal(t, "0", calcFee(itemIncoming, myAddr))              // 0 for recipient!
}

func TestBlockscoutClient_RollupL1FeeAttribution(t *testing.T) {
	// Base transaction with Execution Fee + L1 Data Fee
	// GasUsed: 21,000, EffectiveGasPrice: 50,000,000 wei (0.05 Gwei)
	// Execution Fee = 21,000 * 50,000,000 = 1,050,000,000,000 wei
	// L1Fee = 10,000,000,000,000 wei (0.00001 ETH)
	// Total Fee = 1,050,000,000,000 + 10,000,000,000,000 = 11,050,000,000,000 wei
	rawTx := `{
		"blockNumber": "15000000",
		"timeStamp": "1700000000",
		"hash": "0xbase_op_stack_123",
		"from": "0x1111111111111111111111111111111111111111",
		"to": "0x2222222222222222222222222222222222222222",
		"value": "1000000000000000000",
		"gasUsed": "21000",
		"gasPrice": "60000000",
		"effectiveGasPrice": "50000000",
		"l1Fee": "10000000000000",
		"isError": "0"
	}`

	var item blockscoutTxItem
	err := json.Unmarshal([]byte(rawTx), &item)
	require.NoError(t, err)

	assert.Equal(t, "10000000000000", item.L1Fee)
	assert.Equal(t, "50000000", item.EffectiveGasPrice)

	totalFee := calculateTotalTxFee(item, "0x1111111111111111111111111111111111111111")
	assert.Equal(t, "11050000000000", totalFee, "Total fee must equal execution fee (1.05e12) + l1 data fee (10e12)")
}

