package evm

import (
	"encoding/hex"
	"math/big"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMulticallSelectors(t *testing.T) {
	// Verify that the hardcoded function selectors match keccak256
	hAggregate3 := hex.EncodeToString(Keccak256([]byte("aggregate3((address,bool,bytes)[])"))[:4])
	assert.Equal(t, SelectorAggregate3, hAggregate3)

	hGetEthBalance := hex.EncodeToString(Keccak256([]byte("getEthBalance(address)"))[:4])
	assert.Equal(t, SelectorGetEthBalance, hGetEthBalance)

	hBalanceOf := hex.EncodeToString(Keccak256([]byte("balanceOf(address)"))[:4])
	assert.Equal(t, SelectorBalanceOf, hBalanceOf)

	hDecimals := hex.EncodeToString(Keccak256([]byte("decimals()"))[:4])
	assert.Equal(t, SelectorDecimals, hDecimals)

	hSymbol := hex.EncodeToString(Keccak256([]byte("symbol()"))[:4])
	assert.Equal(t, SelectorSymbol, hSymbol)

	hName := hex.EncodeToString(Keccak256([]byte("name()"))[:4])
	assert.Equal(t, SelectorName, hName)
}

func TestBuildCallsAndEncodeAggregate3(t *testing.T) {
	userAddr := "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" // vitalik.eth
	usdcAddr := "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

	call1, err := BuildGetEthBalanceCall(userAddr)
	require.NoError(t, err)
	assert.Equal(t, Multicall3Address, call1.Target)
	assert.True(t, call1.AllowFailure)

	call2, err := BuildBalanceOfCall(usdcAddr, userAddr)
	require.NoError(t, err)
	assert.Equal(t, usdcAddr, call2.Target)
	assert.True(t, call2.AllowFailure)

	calls := []Call3{call1, call2}
	encoded, err := EncodeAggregate3(calls)
	require.NoError(t, err)
	assert.NotEmpty(t, encoded)

	// Selector is aggregate3
	assert.True(t, strings.HasPrefix(hex.EncodeToString(encoded), SelectorAggregate3))
}

func TestDecodeAggregate3Results(t *testing.T) {
	// Synthetic ABI encoded return for Result3[] with 2 elements:
	// Result 0: success = true, returnData = 32-byte 1 ether (10^18)
	// Result 1: success = true, returnData = 32-byte 500 USDC (500 * 10^6)
	val1 := big.NewInt(1000000000000000000) // 1 ETH
	val2 := big.NewInt(500000000)           // 500 USDC

	// Helper to build return payload
	var buf []byte
	// 0x00: offset to array (0x20)
	buf = append(buf, PadUint256To32Bytes(big.NewInt(32))...)
	// 0x20: array length (2)
	buf = append(buf, PadUint256To32Bytes(big.NewInt(2))...)
	// 0x40: offset to elem 0 (64 = 2 * 32)
	buf = append(buf, PadUint256To32Bytes(big.NewInt(64))...)
	// 0x60: offset to elem 1 (64 + elem0_size)
	// elem size: 32 (success) + 32 (offset 0x40=64) + 32 (len 32) + 32 (data) = 128
	buf = append(buf, PadUint256To32Bytes(big.NewInt(64+128))...)

	// Elem 0
	buf = append(buf, PadUint256To32Bytes(big.NewInt(1))...)  // success
	buf = append(buf, PadUint256To32Bytes(big.NewInt(64))...) // offset
	buf = append(buf, PadUint256To32Bytes(big.NewInt(32))...) // len
	buf = append(buf, PadUint256To32Bytes(val1)...)          // data

	// Elem 1
	buf = append(buf, PadUint256To32Bytes(big.NewInt(1))...)  // success
	buf = append(buf, PadUint256To32Bytes(big.NewInt(64))...) // offset
	buf = append(buf, PadUint256To32Bytes(big.NewInt(32))...) // len
	buf = append(buf, PadUint256To32Bytes(val2)...)          // data

	results, err := DecodeAggregate3Results(buf)
	require.NoError(t, err)
	require.Len(t, results, 2)

	assert.True(t, results[0].Success)
	res1 := DecodeUint256(results[0].ReturnData)
	assert.Equal(t, val1.String(), res1.String())

	assert.True(t, results[1].Success)
	res2 := DecodeUint256(results[1].ReturnData)
	assert.Equal(t, val2.String(), res2.String())
}

func TestDecodeStringOrBytes32(t *testing.T) {
	// Fixed bytes32 string: "USDC" followed by null bytes
	b32 := make([]byte, 32)
	copy(b32, []byte("USDC"))
	assert.Equal(t, "USDC", DecodeStringOrBytes32(b32))

	// ABI dynamic string
	var dynamicStr []byte
	dynamicStr = append(dynamicStr, PadUint256To32Bytes(big.NewInt(32))...)
	dynamicStr = append(dynamicStr, PadUint256To32Bytes(big.NewInt(8))...)
	paddedStr := make([]byte, 32)
	copy(paddedStr, []byte("USD Coin"))
	dynamicStr = append(dynamicStr, paddedStr...)

	assert.Equal(t, "USD Coin", DecodeStringOrBytes32(dynamicStr))
}

