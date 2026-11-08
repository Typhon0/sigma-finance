package graphql

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
	gqlModel "sigma_finance/internal/handler/graphql/model"
	"sigma_finance/internal/handler/middleware"
)

func TestWalletResolvers_CUUsage(t *testing.T) {
	r := &Resolver{}
	qResolver := &queryResolver{r}

	ctx := context.Background()
	usage, err := qResolver.WalletCUUsage(ctx)
	require.NoError(t, err)
	require.NotNil(t, usage)

	assert.Equal(t, int32(30_000_000), usage.MaxQuota)
	assert.Equal(t, int32(0), usage.ConsumedUnits)
	assert.False(t, usage.IsThrottled)
	assert.NotEmpty(t, usage.BillingMonth)
}

func TestWalletResolvers_AuthRequired(t *testing.T) {
	r := &Resolver{}
	mResolver := &mutationResolver{r}
	qResolver := &queryResolver{r}

	emptyCtx := context.Background()

	// Mutations without auth should fail
	_, err := mResolver.CreateWalletDevice(emptyCtx, gqlModel.CreateWalletDeviceInput{
		Name:       "Test Device",
		DeviceType: gqlModel.WalletDeviceTypeHardware,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "authentication required")

	_, err = mResolver.AddWalletAccount(emptyCtx, gqlModel.AddWalletAccountInput{
		PortfolioID:   "p1",
		Network:       gqlModel.BlockchainNetworkEthereum,
		AddressOrXpub: "0x1234567890123456789012345678901234567890",
	})
	assert.Error(t, err)

	_, err = mResolver.AddMultiNetworkWallet(emptyCtx, gqlModel.AddMultiNetworkWalletInput{
		PortfolioID: "p1",
		Address:     "0x1234567890123456789012345678901234567890",
		Networks:    []gqlModel.BlockchainNetwork{gqlModel.BlockchainNetworkEthereum, gqlModel.BlockchainNetworkBase},
	})
	assert.Error(t, err)

	_, err = mResolver.AddMultiChainWallet(emptyCtx, gqlModel.AddMultiChainWalletInput{
		PortfolioID: "p1",
		Name:        "Phantom Multi-Chain",
		DeviceType:  gqlModel.WalletDeviceTypeSoftware,
	})
	assert.Error(t, err)

	_, err = mResolver.AddCustomToken(emptyCtx, gqlModel.AddCustomTokenInput{
		WalletAccountID: "wacc-1",
		TokenAddress:    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
	})
	assert.Error(t, err)

	_, err = mResolver.RemoveWalletAccount(emptyCtx, "acc-1")
	assert.Error(t, err)

	_, err = mResolver.TriggerWalletSync(emptyCtx, "acc-1")
	assert.Error(t, err)

	_, err = mResolver.ResolveWalletReview(emptyCtx, "rev-1", "APPROVE", nil)
	assert.Error(t, err)

	// Queries without auth should fail
	_, err = qResolver.WalletDevices(emptyCtx)
	assert.Error(t, err)

	_, err = qResolver.WalletAccounts(emptyCtx, nil)
	assert.Error(t, err)

	_, err = qResolver.PendingWalletReviews(emptyCtx, "p1")
	assert.Error(t, err)
}

func TestWalletResolvers_MapWalletAccountToGQL(t *testing.T) {
	now := time.Now().UTC()
	tokenAddr := "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
	acc := &model.WalletAccount{
		ID:            "wacc-123",
		Network:       model.BlockchainNetworkEthereum,
		AddressOrXpub: "0x1234567890123456789012345678901234567890",
		IsXpub:        false,
		Label:         strPtr("Main Vault"),
		IsActive:      true,
		HistoryStatus: model.WalletHistoryStatusSynced,
		CapabilityLevel: model.WalletCapabilityBalanceOnly,
		Balances: []*model.WalletBalance{
			{
				ID:                "bal-1",
				Symbol:            "USDC",
				Name:              "USD Coin",
				Decimals:          6,
				RawBalance:        "1000000000",
				FormattedQuantity: decimal.NewFromFloat(1000.0),
				TokenAddress:      &tokenAddr,
				IsSpam:            false,
				IsHidden:          false,
				IsStale:           false,
				LastUpdatedAt:     now,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	gqlAcc := mapWalletAccountToGQL(acc)
	require.NotNil(t, gqlAcc)
	assert.Equal(t, "wacc-123", gqlAcc.ID)
	assert.Equal(t, gqlModel.BlockchainNetworkEthereum, gqlAcc.Network)
	assert.Equal(t, "0x1234567890123456789012345678901234567890", gqlAcc.AddressOrXpub)
	assert.Equal(t, "SYNCED", gqlAcc.HistoryStatus)
	assert.Equal(t, model.WalletCapabilityBalanceOnly, gqlAcc.CapabilityLevel)
	assert.Len(t, gqlAcc.Balances, 1)

	b := gqlAcc.Balances[0]
	assert.Equal(t, "USDC", b.Symbol)
	assert.Equal(t, int32(6), b.Decimals)
	assert.Equal(t, 1000.0, b.FormattedQuantity)
	assert.False(t, b.IsSpam)
	assert.False(t, b.IsHidden)
}

func TestMaskAPIKey(t *testing.T) {
	assert.Equal(t, "", maskAPIKey(""))
	assert.Equal(t, "••••••••", maskAPIKey("short"))
	assert.Equal(t, "alch_6Qn••••••••iBCf", maskAPIKey("alch_6Qn5U1tVS5p-_NJlSiBCf"))
	assert.Equal(t, "1234••••••••9012", maskAPIKey("123456789012"))
}

func TestResolveAlchemyKey_EnvFallback(t *testing.T) {
	t.Setenv("ALCHEMY_API_KEY", "alch_6Qn5U1tVS5p-_NJlSiBCf")
	key, source, masked := resolveAlchemyKey(context.Background(), nil, "user-123")
	assert.Equal(t, "alch_6Qn5U1tVS5p-_NJlSiBCf", key)
	assert.Equal(t, "ENV", source)
	assert.Equal(t, "alch_6Qn••••••••iBCf", masked)

	t.Setenv("ALCHEMY_API_KEY", "")
	key2, source2, masked2 := resolveAlchemyKey(context.Background(), nil, "user-123")
	assert.Equal(t, "", key2)
	assert.Equal(t, "NONE", source2)
	assert.Equal(t, "", masked2)
}

func strPtr(s string) *string {
	return &s
}

func authedContext(userID string) context.Context {
	return context.WithValue(context.Background(), middleware.UserKey, &middleware.AuthenticatedUser{
		ID:    userID,
		Email: "test@sigma.local",
	})
}
