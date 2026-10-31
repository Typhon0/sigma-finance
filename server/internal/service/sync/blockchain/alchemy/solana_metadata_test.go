package alchemy_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/service/sync/blockchain/alchemy"
)

func TestResolveSolanaTokenMetadata_USDC(t *testing.T) {
	ctx := context.Background()
	usdcMint := "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

	symbol, name, decimals := alchemy.ResolveSolanaTokenMetadata(ctx, usdcMint, nil)

	assert.Equal(t, "USDC", symbol)
	assert.Equal(t, "USD Coin", name)
	assert.Equal(t, 6, decimals)
}

func TestResolveSolanaTokenMetadata_USDT(t *testing.T) {
	ctx := context.Background()
	usdtMint := "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

	symbol, name, decimals := alchemy.ResolveSolanaTokenMetadata(ctx, usdtMint, nil)

	assert.Equal(t, "USDT", symbol)
	assert.Equal(t, "Tether USD", name)
	assert.Equal(t, 6, decimals)
}

func TestResolveSolanaTokenMetadata_WSOL(t *testing.T) {
	ctx := context.Background()
	wsolMint := "So11111111111111111111111111111111111111112"

	symbol, name, decimals := alchemy.ResolveSolanaTokenMetadata(ctx, wsolMint, nil)

	assert.Equal(t, "WSOL", symbol)
	assert.Equal(t, "Wrapped SOL", name)
	assert.Equal(t, 9, decimals)
}

func TestResolveSolanaTokenMetadata_Render(t *testing.T) {
	ctx := context.Background()
	renderMint := "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof"

	symbol, name, decimals := alchemy.ResolveSolanaTokenMetadata(ctx, renderMint, nil)

	assert.Equal(t, "RENDER", symbol)
	assert.Equal(t, "Render", name)
	assert.Equal(t, 8, decimals)
}

func TestResolveSolanaTokenMetadata_Pengu(t *testing.T) {
	ctx := context.Background()
	penguMint := "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv"

	symbol, name, decimals := alchemy.ResolveSolanaTokenMetadata(ctx, penguMint, nil)

	assert.Equal(t, "PENGU", symbol)
	assert.Equal(t, "Pudgy Penguins", name)
	assert.Equal(t, 6, decimals)
}

func TestResolveSolanaTokenMetadata_UnknownFallback(t *testing.T) {
	ctx := context.Background()
	unknownMint := "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"

	symbol, name, _ := alchemy.ResolveSolanaTokenMetadata(ctx, unknownMint, nil)

	assert.Contains(t, symbol, "SPL-")
	assert.Contains(t, name, "Unknown SPL")
}
