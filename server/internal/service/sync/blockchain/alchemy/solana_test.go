package alchemy

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseSolanaTransactionMovements_DexSwap(t *testing.T) {
	userAddr := "6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx"
	usdcMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

	// Mock DEX Swap transaction:
	// User spends 575.112613 USDC (959531005 -> 384418392)
	// User receives 5.625437273 SOL (50000000 -> 5675437273 lamports)
	rawJSON := `{
		"blockTime": 1793233398,
		"slot": 461459293,
		"meta": {
			"fee": 5000,
			"preBalances": [50000000, 0, 1488440],
			"postBalances": [5675437273, 0, 1488440],
			"preTokenBalances": [
				{
					"accountIndex": 2,
					"mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					"owner": "6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx",
					"uiTokenAmount": {
						"amount": "959531005",
						"decimals": 6
					}
				}
			],
			"postTokenBalances": [
				{
					"accountIndex": 2,
					"mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					"owner": "6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx",
					"uiTokenAmount": {
						"amount": "384418392",
						"decimals": 6
					}
				}
			]
		},
		"transaction": {
			"signatures": ["4NGPi5YwAx1DPSKd"],
			"message": {
				"accountKeys": [
					{"pubkey": "6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx"},
					{"pubkey": "OtherKey"},
					{"pubkey": "TokenAccountKey"}
				]
			}
		}
	}`

	var tx SolanaTransactionResult
	err := json.Unmarshal([]byte(rawJSON), &tx)
	require.NoError(t, err)

	movements := parseSolanaTransactionMovements(userAddr, "4NGPi5YwAx1DPSKd", 461459293, time.Unix(1793233398, 0).UTC(), &tx, []byte("{}"))

	require.Len(t, movements, 2)

	// Verify incoming SOL movement
	solMov := movements[0]
	assert.Equal(t, "4NGPi5YwAx1DPSKd", solMov.TxHash)
	assert.Nil(t, solMov.TokenAddress)
	assert.Equal(t, userAddr, solMov.ToAddress)
	assert.Equal(t, "5625437273", solMov.RawAmount) // +5.625437273 SOL
	assert.Equal(t, 9, solMov.Decimals)

	// Verify outgoing USDC movement
	usdcMov := movements[1]
	assert.Equal(t, "4NGPi5YwAx1DPSKd", usdcMov.TxHash)
	require.NotNil(t, usdcMov.TokenAddress)
	assert.Equal(t, usdcMint, *usdcMov.TokenAddress)
	assert.Equal(t, userAddr, usdcMov.FromAddress)
	assert.Equal(t, "575112613", usdcMov.RawAmount) // -575.112613 USDC
	assert.Equal(t, 6, usdcMov.Decimals)
}
