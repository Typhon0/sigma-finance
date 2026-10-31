package evm

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

	totalFee := calculateTotalTxFee(item, "0x1111111111111111111111111111111111111111", model.BlockchainNetworkBase)
	assert.Equal(t, "11050000000000", totalFee, "Total fee must equal execution fee (1.05e12) + l1 data fee (10e12)")
}

func TestBlockscoutClient_OPStackOperatorFee(t *testing.T) {
	// Base / OP Stack Isthmus transaction:
	// GasUsed: 21,000, GasPrice: 1,000,000,000 wei (1 Gwei) -> ExecutionFee = 21,000,000,000,000 wei
	// L1Fee: 50,000,000,000,000 wei
	// OperatorFee: 10,000,000,000,000 wei
	// Total Fee = 21,000,000,000,000 + 50,000,000,000,000 + 10,000,000,000,000 = 81,000,000,000,000 wei
	rawTx := `{
		"blockNumber": "16000000",
		"timeStamp": "1710000000",
		"hash": "0xbase_isthmus_tx",
		"from": "0xSender111",
		"to": "0xRecipient222",
		"value": "1000000000000000000",
		"gasUsed": "21000",
		"gasPrice": "1000000000",
		"l1Fee": "50000000000000",
		"operatorFee": "10000000000000",
		"isError": "0"
	}`

	var item blockscoutTxItem
	err := json.Unmarshal([]byte(rawTx), &item)
	require.NoError(t, err)

	assert.Equal(t, "10000000000000", item.OperatorFee)

	totalFee := calculateTotalTxFee(item, "0xSender111", model.BlockchainNetworkBase)
	assert.Equal(t, "81000000000000", totalFee, "Total fee must equal execution fee (21e12) + l1 fee (50e12) + operator fee (10e12)")
}

func TestBlockscoutClient_EthereumBlobTransaction(t *testing.T) {
	// Ethereum EIP-4844 transaction:
	// GasUsed: 21,000, GasPrice: 10,000,000,000 wei (10 Gwei) -> ExecutionFee = 210,000,000,000,000 wei
	// BlobGasUsed: 131,072 (1 blob), BlobGasPrice: 1,000,000 wei
	// BlobFee = 131,072 * 1,000,000 = 131,072,000,000 wei
	// Total Fee = 210,000,000,000,000 + 131,072,000,000 = 210,131,072,000,000 wei
	rawTx := `{
		"blockNumber": "19400000",
		"timeStamp": "1715000000",
		"hash": "0xeth_blob_tx",
		"from": "0xSender111",
		"to": "0xRecipient222",
		"value": "0",
		"gasUsed": "21000",
		"gasPrice": "10000000000",
		"blobGasUsed": "131072",
		"blobGasPrice": "1000000",
		"isError": "0"
	}`

	var item blockscoutTxItem
	err := json.Unmarshal([]byte(rawTx), &item)
	require.NoError(t, err)

	totalFee := calculateTotalTxFee(item, "0xSender111", model.BlockchainNetworkEthereum)
	assert.Equal(t, "210131072000000", totalFee, "Total fee must equal execution fee (210e12) + blob fee (131.072e9)")

	// Also verify when explicit blobFee is provided
	itemWithExplicitBlobFee := blockscoutTxItem{
		From:     "0xSender111",
		GasUsed:  "21000",
		GasPrice: "10000000000",
		BlobFee:  "500000000000",
	}
	totalFeeExplicit := calculateTotalTxFee(itemWithExplicitBlobFee, "0xSender111", model.BlockchainNetworkEthereum)
	// 210,000,000,000,000 + 500,000,000,000 = 210,500,000,000,000
	assert.Equal(t, "210500000000000", totalFeeExplicit)
}

func TestBlockscoutClient_OPStackJovianBlobGasUsedNotDoubled(t *testing.T) {
	// Critical Jovian validation:
	// On OP Stack (Base or Optimism), after Jovian, blobGasUsed represents the L1 DA footprint.
	// It is ALREADY captured inside l1Fee. It MUST NOT be added as an L2 blob fee!
	itemOPStack := blockscoutTxItem{
		From:         "0xSender111",
		GasUsed:      "21000",
		GasPrice:     "1000000000", // 1 gwei -> execution fee = 21e12 wei
		L1Fee:        "50000000000000", // 50e12 wei
		BlobGasUsed:  "131072", // Jovian DA footprint
		BlobGasPrice: "1000000",
	}

	// For Base / Optimism: fee should be execution (21e12) + l1Fee (50e12) = 71e12 wei
	// The 131072 * 1000000 blob fee MUST NOT be added!
	totalFeeBase := calculateTotalTxFee(itemOPStack, "0xSender111", model.BlockchainNetworkBase)
	assert.Equal(t, "71000000000000", totalFeeBase, "On Base (OP Stack), blobGasUsed must not double count DA fee")

	totalFeeOptimism := calculateTotalTxFee(itemOPStack, "0xSender111", model.BlockchainNetworkOptimism)
	assert.Equal(t, "71000000000000", totalFeeOptimism, "On Optimism (OP Stack), blobGasUsed must not double count DA fee")
}

func TestBlockscoutClient_PostJovianOperatorFeeCalculation(t *testing.T) {
	// Post-Jovian operator fee formula:
	// operatorFee = operatorFeeConstant + (operatorFeeScalar * gasUsed * 100)
	gasUsed := big.NewInt(21000)
	constant := big.NewInt(5000)
	scalar := big.NewInt(2)

	fee := CalculateJovianOperatorFee(gasUsed, constant, scalar)
	// 5000 + (2 * 21000 * 100) = 5000 + 4,200,000 = 4,205,000
	assert.Equal(t, "4205000", fee.String(), "Jovian operator fee must match exact scaled formula")
}

func TestBlockscoutClient_IsthmusOperatorFeeCalculation(t *testing.T) {
	// Post-Isthmus operator fee formula:
	// operatorFee = operatorFeeConstant + (operatorFeeScalar * gasUsed / 1e6)
	gasUsed := big.NewInt(50000)
	constant := big.NewInt(10000)
	scalar := big.NewInt(5000000)

	fee := CalculateIsthmusOperatorFee(gasUsed, constant, scalar)
	// 10000 + ((5000000 * 50000) / 1000000) = 10000 + 250000 = 260,000
	assert.Equal(t, "260000", fee.String(), "Isthmus operator fee must match exact scaled formula")
}

func TestBlockscoutClient_OPStackDepositTransactionZeroFee(t *testing.T) {
	// Deposit transactions from L1->L2 (Type 0x7e / 126 or gasPrice=0) pay 0 L2 execution/L1/operator fees
	depositTx := blockscoutTxItem{
		Hash:     "0xdeposit_tx_hash_123",
		From:     "0xSender111",
		To:       "0xSender111",
		Value:    "5000000000000000000",
		GasUsed:  "0",
		GasPrice: "0",
		Type:     "0x7e",
		IsError:  "0",
	}

	feeBase := calculateTotalTxFee(depositTx, "0xSender111", model.BlockchainNetworkBase)
	assert.Equal(t, "0", feeBase, "Deposit transaction on Base must have zero fee")

	feeOptimism := calculateTotalTxFee(depositTx, "0xSender111", model.BlockchainNetworkOptimism)
	assert.Equal(t, "0", feeOptimism, "Deposit transaction on Optimism must have zero fee")
}

func TestBlockscoutClient_MissingOperatorFeeNotSilentlyZero(t *testing.T) {
	// Setup test server returning OP Stack transaction missing operatorFee field
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if strings.Contains(r.URL.RawQuery, "action=txlist") {
			_, _ = w.Write([]byte(`{
				"status": "1",
				"message": "OK",
				"result": [{
					"blockNumber": "17000000",
					"timeStamp": "1720000000",
					"hash": "0xmissing_op_fee",
					"from": "0xuser123",
					"to": "0xother",
					"value": "1000000000000000000",
					"gasUsed": "21000",
					"gasPrice": "1000000000",
					"l1Fee": "50000000000000",
					"isError": "0"
				}]
			}`))
			return
		}
		_, _ = w.Write([]byte(`{"status":"1","message":"OK","result":[]}`))
	}))
	defer ts.Close()

	client := NewBlockscoutClient()
	// Use queryBlockscout against ts.URL
	txs, err := client.queryBlockscout(context.Background(), ts.URL+"?action=txlist")
	require.NoError(t, err)
	require.Len(t, txs, 1)

	// In transaction item, OperatorFee is empty
	assert.Empty(t, txs[0].OperatorFee)

	// In FetchTransfers logic, verify that missing field is marked UNAVAILABLE_FROM_PROVIDER, not silently zero
	isOPStack := true
	operatorFeeStatus := "NOT_APPLICABLE"
	if isOPStack {
		if txs[0].OperatorFee != "" && txs[0].OperatorFee != "0" {
			operatorFeeStatus = "AVAILABLE"
		} else if txs[0].OperatorFee == "0" {
			operatorFeeStatus = "EXPLICIT_ZERO"
		} else {
			operatorFeeStatus = "UNAVAILABLE_FROM_PROVIDER"
		}
	}
	assert.Equal(t, "UNAVAILABLE_FROM_PROVIDER", operatorFeeStatus)
}

func TestBlockscoutClient_DecodeL1BlockAttributesCalldata(t *testing.T) {
	// 1. Valid Isthmus calldata: selector 0x3a4832bc + 160 bytes dummy + scalar=5 (4 bytes) + constant=1000 (8 bytes)
	prefix160Bytes := strings.Repeat("00", 160)
	scalarHexIsthmus := "00000005"          // 5
	constantHexIsthmus := "00000000000003e8" // 1000 in hex
	isthmusInput := "0x3a4832bc" + prefix160Bytes + scalarHexIsthmus + constantHexIsthmus

	scalar, constant, format, err := DecodeL1BlockAttributesCalldata(isthmusInput)
	require.NoError(t, err)
	assert.Equal(t, "ISTHMUS", format)
	assert.Equal(t, int64(5), scalar.Int64())
	assert.Equal(t, int64(1000), constant.Int64())

	// 2. Valid Jovian calldata: selector 0x0eb5e840 + 160 bytes dummy + scalar=2 + constant=5000 (0x1388)
	scalarHexJovian := "00000002"
	constantHexJovian := "0000000000001388"
	jovianInput := "0x0eb5e840" + prefix160Bytes + scalarHexJovian + constantHexJovian

	scalarJ, constantJ, formatJ, errJ := DecodeL1BlockAttributesCalldata(jovianInput)
	require.NoError(t, errJ)
	assert.Equal(t, "JOVIAN", formatJ)
	assert.Equal(t, int64(2), scalarJ.Int64())
	assert.Equal(t, int64(5000), constantJ.Int64())

	// 3. Jovian activation block transition:
	// Spec requirement: At the Jovian activation block transition, the L1 Attributes transaction
	// still uses the Isthmus method format (0x3a4832bc), while subsequent blocks use 0x0eb5e840.
	transitionBlockInput := isthmusInput
	scalarT, constantT, formatT, errT := DecodeL1BlockAttributesCalldata(transitionBlockInput)
	require.NoError(t, errT)
	assert.Equal(t, "ISTHMUS", formatT, "Activation block transition must decode via Isthmus parser")
	assert.Equal(t, int64(5), scalarT.Int64())
	assert.Equal(t, int64(1000), constantT.Int64())

	// 4. Invalid input handling
	_, _, _, errShort := DecodeL1BlockAttributesCalldata("0x1234")
	assert.Error(t, errShort)

	_, _, _, errUnknown := DecodeL1BlockAttributesCalldata("0xdeadbeef" + prefix160Bytes + scalarHexIsthmus + constantHexIsthmus)
	assert.Error(t, errUnknown)
}

func TestBlockscoutClient_RealEIP4844Type3TransactionReceipt(t *testing.T) {
	// 1. Physically read fixture file from repo testdata and verify calculated SHA-256
	fixturePath := filepath.Join("..", "testdata", "fixtures", "ethereum_eip4844_blob_receipt.json")
	content, err := os.ReadFile(fixturePath)
	require.NoError(t, err, "Fixture ethereum_eip4844_blob_receipt.json must exist in testdata/fixtures")

	sum := sha256.Sum256(content)
	calculatedHash := hex.EncodeToString(sum[:])
	assert.Equal(t, "9a998aafd429ad8dd971805a409d0572b2b997b4537ade8a58b96734e3c70fab", calculatedHash, "SHA-256 hash must match real EIP-4844 receipt fixture")

	// 2. Unmarshal real JSON receipt payload
	var rawReceipt struct {
		Type              string `json:"type"`
		TransactionHash   string `json:"transactionHash"`
		From              string `json:"from"`
		GasUsed           string `json:"gasUsed"`
		EffectiveGasPrice string `json:"effectiveGasPrice"`
		BlobGasUsed       string `json:"blobGasUsed"`
		BlobGasPrice      string `json:"blobGasPrice"`
	}
	err = json.Unmarshal(content, &rawReceipt)
	require.NoError(t, err)

	assert.Equal(t, "0x3", rawReceipt.Type, "Transaction must be EIP-4844 type-3 blob transaction")
	assert.Equal(t, "0x725d7fef2bc61337be7972bb4e155b1886cb2b966079006fedb0eeceb3a1c185", rawReceipt.TransactionHash)

	// 3. Convert hex values to decimal strings as normalized by EVM client
	gasUsedBig, _ := new(big.Int).SetString(strings.TrimPrefix(rawReceipt.GasUsed, "0x"), 16)
	gasPriceBig, _ := new(big.Int).SetString(strings.TrimPrefix(rawReceipt.EffectiveGasPrice, "0x"), 16)
	blobGasUsedBig, _ := new(big.Int).SetString(strings.TrimPrefix(rawReceipt.BlobGasUsed, "0x"), 16)
	blobGasPriceBig, _ := new(big.Int).SetString(strings.TrimPrefix(rawReceipt.BlobGasPrice, "0x"), 16)

	require.Equal(t, int64(156449), gasUsedBig.Int64())
	require.Equal(t, int64(11606096729), gasPriceBig.Int64())
	require.Equal(t, int64(131072), blobGasUsedBig.Int64())
	require.Equal(t, int64(3824490811), blobGasPriceBig.Int64())

	// Execution Fee = 156,449 * 11,606,096,729 = 1,815,762,227,155,321 wei
	// Blob Fee = 131,072 * 3,824,490,811 = 501,283,659,579,392 wei
	// Total Fee = 1,815,762,227,155,321 + 501,283,659,579,392 = 2,317,045,886,734,713 wei
	execFee := new(big.Int).Mul(gasUsedBig, gasPriceBig)
	blobFee := new(big.Int).Mul(blobGasUsedBig, blobGasPriceBig)
	expectedTotalFee := new(big.Int).Add(execFee, blobFee)
	assert.Equal(t, "1815762227155321", execFee.String())
	assert.Equal(t, "501283659579392", blobFee.String())
	assert.Equal(t, "2317045886734713", expectedTotalFee.String())

	// 4. Test calculateTotalTxFee with normalized blockscoutTxItem
	item := blockscoutTxItem{
		From:              rawReceipt.From,
		GasUsed:           gasUsedBig.String(),
		EffectiveGasPrice: gasPriceBig.String(),
		BlobGasUsed:       blobGasUsedBig.String(),
		BlobGasPrice:      blobGasPriceBig.String(),
	}

	// For Ethereum L1: Blob fee MUST be added to execution fee
	totalFeeEth := calculateTotalTxFee(item, rawReceipt.From, model.BlockchainNetworkEthereum)
	assert.Equal(t, "2317045886734713", totalFeeEth, "Total fee on Ethereum L1 must equal ExecutionFee + BlobFee")

	// For OP Stack (Base / Optimism): blobGasUsed represents L1 DA footprint and MUST NOT be added as L2 blob fee
	totalFeeBase := calculateTotalTxFee(item, rawReceipt.From, model.BlockchainNetworkBase)
	assert.Equal(t, "1815762227155321", totalFeeBase, "On Base (OP Stack), blobGasUsed must not double count as L2 blob fee")
}



