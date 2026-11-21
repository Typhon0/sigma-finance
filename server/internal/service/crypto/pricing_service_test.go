package crypto_test

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/service/crypto"
)

func requireLiveBinance(t *testing.T) {
	t.Helper()
	if os.Getenv("BINANCE_LIVE_TESTS") != "1" {
		t.Skip("set BINANCE_LIVE_TESTS=1 to run live Binance pricing tests")
	}
}

func TestNormalizeCryptoSymbol(t *testing.T) {
	assert.Equal(t, "RENDER", crypto.NormalizeCryptoSymbol("RNDR"))
	assert.Equal(t, "RENDER", crypto.NormalizeCryptoSymbol("render"))
	assert.Equal(t, "POL", crypto.NormalizeCryptoSymbol("MATIC"))
	assert.Equal(t, "SOL", crypto.NormalizeCryptoSymbol("WSOL"))
	assert.Equal(t, "ETH", crypto.NormalizeCryptoSymbol("WETH"))
	assert.Equal(t, "BTC", crypto.NormalizeCryptoSymbol("WBTC"))
	assert.Equal(t, "PENGU", crypto.NormalizeCryptoSymbol("pengu"))
}

func TestIsStablecoin(t *testing.T) {
	assert.True(t, crypto.IsStablecoin("USDC"))
	assert.True(t, crypto.IsStablecoin("usdt"))
	assert.True(t, crypto.IsStablecoin("DAI"))
	assert.True(t, crypto.IsStablecoin("FDUSD"))
	assert.False(t, crypto.IsStablecoin("BTC"))
	assert.False(t, crypto.IsStablecoin("SOL"))
	assert.False(t, crypto.IsStablecoin("RENDER"))
	assert.False(t, crypto.IsStablecoin("PENGU"))
}

func TestPricingService_ResolveTokenPrice_Stablecoin(t *testing.T) {
	ctx := context.Background()
	svc := crypto.NewPricingService(nil)

	res := svc.ResolveTokenPrice(ctx, "USDC", nil)
	assert.True(t, res.Found)
	assert.Equal(t, "1", res.Price.String())
	assert.Equal(t, "STABLE_PEG", res.Source)
}

func TestPricingService_ResolveTokenPrice_LiveBinance(t *testing.T) {
	requireLiveBinance(t)
	ctx := context.Background()
	svc := crypto.NewPricingService(nil)

	// Test RENDER resolution (both RNDR alias and direct RENDER)
	resRNDR := svc.ResolveTokenPrice(ctx, "RNDR", nil)
	assert.True(t, resRNDR.Found)
	assert.True(t, resRNDR.Price.IsPositive())
	assert.Equal(t, "BINANCE", resRNDR.Source)

	// Test PENGU resolution
	resPENGU := svc.ResolveTokenPrice(ctx, "PENGU", nil)
	assert.True(t, resPENGU.Found)
	assert.True(t, resPENGU.Price.IsPositive())
	assert.Equal(t, "BINANCE", resPENGU.Source)

	// Test SOL and BTC
	resSOL := svc.ResolveTokenPrice(ctx, "SOL", nil)
	assert.True(t, resSOL.Found)
	assert.True(t, resSOL.Price.IsPositive())

	resBTC := svc.ResolveTokenPrice(ctx, "BTC", nil)
	assert.True(t, resBTC.Found)
	assert.True(t, resBTC.Price.IsPositive())
}

func TestPricingService_RefreshBalances_Memory(t *testing.T) {
	requireLiveBinance(t)
	ctx := context.Background()
	svc := crypto.NewPricingService(nil)

	balRender := &model.WalletBalance{
		ID:     "b-render",
		Symbol: "RENDER",
	}
	balPengu := &model.WalletBalance{
		ID:     "b-pengu",
		Symbol: "PENGU",
	}

	err := svc.RefreshBalances(ctx, []*model.WalletBalance{balRender, balPengu})
	assert.NoError(t, err)

	assert.NotNil(t, balRender.CurrentPrice)
	assert.True(t, balRender.CurrentPrice.IsPositive())
	assert.Equal(t, "BINANCE", *balRender.PriceSource)

	assert.NotNil(t, balPengu.CurrentPrice)
	assert.True(t, balPengu.CurrentPrice.IsPositive())
	assert.Equal(t, "BINANCE", *balPengu.PriceSource)
}
