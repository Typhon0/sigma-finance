package evm

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"golang.org/x/crypto/sha3"
)

const (
	// Multicall3Address is the canonical deterministic deployment address across all EVM chains
	Multicall3Address = "0xcA11bde05977b3631167028862bE2a173976CA11"

	// Selectors
	SelectorAggregate3    = "82ad56cb" // aggregate3((address,bool,bytes)[])
	SelectorGetEthBalance = "4d2301cc" // getEthBalance(address)
	SelectorBalanceOf     = "70a08231" // balanceOf(address)
	SelectorDecimals      = "313ce567" // decimals()
	SelectorSymbol        = "95d89b41" // symbol()
	SelectorName          = "06fdde03" // name()
)

// Call3 represents a single Multicall3 call
type Call3 struct {
	Target       string
	AllowFailure bool
	CallData     []byte
}

// Result3 represents a single Multicall3 return result
type Result3 struct {
	Success    bool
	ReturnData []byte
}

// Keccak256 calculates the Ethereum-compatible keccak256 hash
func Keccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil)
}

// PadAddressTo32Bytes pads a 20-byte hex address to 32 bytes (12 leading zero bytes)
func PadAddressTo32Bytes(addr string) ([]byte, error) {
	addr = strings.TrimPrefix(strings.ToLower(addr), "0x")
	if len(addr) != 40 {
		return nil, fmt.Errorf("invalid address length %d, expected 40 hex chars", len(addr))
	}
	addrBytes, err := hex.DecodeString(addr)
	if err != nil {
		return nil, fmt.Errorf("failed to decode address hex: %w", err)
	}
	padded := make([]byte, 32)
	copy(padded[12:], addrBytes)
	return padded, nil
}

// PadUint256To32Bytes pads a big.Int to 32 bytes
func PadUint256To32Bytes(val *big.Int) []byte {
	padded := make([]byte, 32)
	if val == nil {
		return padded
	}
	b := val.Bytes()
	if len(b) > 32 {
		return b[len(b)-32:]
	}
	copy(padded[32-len(b):], b)
	return padded
}

// BuildGetEthBalanceCall constructs a Call3 for native ETH balance check
func BuildGetEthBalanceCall(userAddress string) (Call3, error) {
	paddedUser, err := PadAddressTo32Bytes(userAddress)
	if err != nil {
		return Call3{}, err
	}
	selectorBytes, _ := hex.DecodeString(SelectorGetEthBalance)
	callData := append(selectorBytes, paddedUser...)

	return Call3{
		Target:       Multicall3Address,
		AllowFailure: true,
		CallData:     callData,
	}, nil
}

// BuildBalanceOfCall constructs a Call3 for an ERC-20 balanceOf call
func BuildBalanceOfCall(tokenAddress, userAddress string) (Call3, error) {
	paddedUser, err := PadAddressTo32Bytes(userAddress)
	if err != nil {
		return Call3{}, err
	}
	selectorBytes, _ := hex.DecodeString(SelectorBalanceOf)
	callData := append(selectorBytes, paddedUser...)

	return Call3{
		Target:       tokenAddress,
		AllowFailure: true,
		CallData:     callData,
	}, nil
}

// EncodeAggregate3 encodes a slice of Call3 into ABI-compatible calldata for Multicall3.aggregate3
func EncodeAggregate3(calls []Call3) ([]byte, error) {
	selector, _ := hex.DecodeString(SelectorAggregate3)
	buf := new(bytes.Buffer)
	buf.Write(selector)

	// Offset to dynamic array: 32 bytes (0x20)
	buf.Write(PadUint256To32Bytes(big.NewInt(32)))

	// Array length N
	n := len(calls)
	buf.Write(PadUint256To32Bytes(big.NewInt(int64(n))))

	// We have N elements. In ABI, an array of dynamic types has N offset words,
	// where offset is relative to the start of the array data (after array length).
	// Total head size = N * 32 bytes.
	var encodedElements [][]byte
	for _, c := range calls {
		elem, err := encodeCall3(c)
		if err != nil {
			return nil, err
		}
		encodedElements = append(encodedElements, elem)
	}

	currentOffset := int64(n * 32)
	for _, elem := range encodedElements {
		buf.Write(PadUint256To32Bytes(big.NewInt(currentOffset)))
		currentOffset += int64(len(elem))
	}

	for _, elem := range encodedElements {
		buf.Write(elem)
	}

	return buf.Bytes(), nil
}

// encodeCall3 encodes a single Call3 tuple: (address, bool, bytes)
func encodeCall3(c Call3) ([]byte, error) {
	paddedTarget, err := PadAddressTo32Bytes(c.Target)
	if err != nil {
		return nil, err
	}

	allowFailureByte := byte(0)
	if c.AllowFailure {
		allowFailureByte = 1
	}
	paddedAllowFailure := make([]byte, 32)
	paddedAllowFailure[31] = allowFailureByte

	// Dynamic bytes callData offset within tuple: 3 words * 32 bytes = 96 bytes (0x60)
	paddedOffset := PadUint256To32Bytes(big.NewInt(96))

	// callData payload: length (32 bytes) + data padded to multiple of 32
	dataLen := len(c.CallData)
	paddedDataLen := PadUint256To32Bytes(big.NewInt(int64(dataLen)))

	paddingNeeded := (32 - (dataLen % 32)) % 32
	paddedCallData := append(c.CallData, make([]byte, paddingNeeded)...)

	var res []byte
	res = append(res, paddedTarget...)
	res = append(res, paddedAllowFailure...)
	res = append(res, paddedOffset...)
	res = append(res, paddedDataLen...)
	res = append(res, paddedCallData...)
	return res, nil
}

// DecodeAggregate3Results decodes raw hex or byte return data of Multicall3.aggregate3 into []Result3
func DecodeAggregate3Results(raw []byte) ([]Result3, error) {
	if len(raw) < 64 {
		return nil, errors.New("raw multicall3 return data too short")
	}

	// First word: offset to array (typically 0x20)
	offsetBig := new(big.Int).SetBytes(raw[:32])
	offset := int(offsetBig.Int64())
	if offset < 32 || offset >= len(raw) {
		return nil, fmt.Errorf("invalid multicall3 offset: %d", offset)
	}

	// Array length
	if offset+32 > len(raw) {
		return nil, errors.New("unexpected EOF reading multicall3 array length")
	}
	nBig := new(big.Int).SetBytes(raw[offset : offset+32])
	n := int(nBig.Int64())
	if n < 0 || n > 1000 {
		return nil, fmt.Errorf("invalid multicall3 array length: %d", n)
	}

	arrayBody := raw[offset+32:]
	if len(arrayBody) < n*32 {
		return nil, errors.New("unexpected EOF reading multicall3 result offsets")
	}

	results := make([]Result3, n)
	for i := 0; i < n; i++ {
		elemOffsetBig := new(big.Int).SetBytes(arrayBody[i*32 : (i+1)*32])
		elemOffset := int(elemOffsetBig.Int64())
		if elemOffset < 0 || elemOffset >= len(arrayBody) {
			continue
		}

		tupleData := arrayBody[elemOffset:]
		if len(tupleData) < 64 {
			continue
		}

		// Result3: (bool success, bytes returnData)
		success := tupleData[31] == 1

		bytesOffsetBig := new(big.Int).SetBytes(tupleData[32:64])
		bytesOffset := int(bytesOffsetBig.Int64())
		if bytesOffset < 64 || bytesOffset >= len(tupleData) {
			results[i] = Result3{Success: success, ReturnData: nil}
			continue
		}

		dataSlice := tupleData[bytesOffset:]
		if len(dataSlice) < 32 {
			results[i] = Result3{Success: success, ReturnData: nil}
			continue
		}
		dataLenBig := new(big.Int).SetBytes(dataSlice[:32])
		dataLen := int(dataLenBig.Int64())
		if dataLen < 0 || 32+dataLen > len(dataSlice) {
			results[i] = Result3{Success: success, ReturnData: nil}
			continue
		}

		returnData := make([]byte, dataLen)
		copy(returnData, dataSlice[32:32+dataLen])

		results[i] = Result3{
			Success:    success,
			ReturnData: returnData,
		}
	}

	return results, nil
}

// DecodeUint256 parses a 32-byte big-endian slice into *big.Int
func DecodeUint256(data []byte) *big.Int {
	if len(data) == 0 {
		return big.NewInt(0)
	}
	return new(big.Int).SetBytes(data)
}

// DecodeStringOrBytes32 decodes either an ABI dynamic string or a bytes32 string into a Go string
func DecodeStringOrBytes32(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	// Case 1: Standard ABI dynamic string (offset + length + bytes)
	if len(data) >= 64 {
		offset := int(new(big.Int).SetBytes(data[:32]).Int64())
		if offset == 32 && len(data) >= 64 {
			length := int(new(big.Int).SetBytes(data[32:64]).Int64())
			if length > 0 && 64+length <= len(data) {
				return string(data[64 : 64+length])
			}
		}
	}
	// Case 2: bytes32 fixed string (e.g. Maker MKR)
	trimmed := bytes.TrimRight(data, "\x00")
	return string(trimmed)
}
