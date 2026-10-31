package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/infrastructure"
)

func TestLiveFrontendGraphQLQueries(t *testing.T) {
	_ = godotenv.Load("../../../.env", "../../../server/.env")
	db, err := infrastructure.NewDB()
	require.NoError(t, err, "Must connect to DB")
	defer db.Close()

	ctx := context.Background()

	// 1. Get user who owns a wallet account with balances
	var wacc model.WalletAccount
	err = db.NewSelect().Model(&wacc).
		Where("EXISTS (SELECT 1 FROM wallet_balances WHERE wallet_account_id = wallet_account.id)").
		Order("created_at ASC").
		Limit(1).
		Scan(ctx)
	if err != nil {
		// Fallback if no balances yet
		err = db.NewSelect().Model(&wacc).Limit(1).Scan(ctx)
	}
	require.NoError(t, err, "Must find at least one wallet account")
	userID := wacc.UserID

	// 2. Mint a valid JWT signed with the server's secret
	jwtSecret := []byte("your-static-jwt-secret-key-here-change-in-production")
	claims := jwt.MapClaims{
		"user_id": userID,
		"sub":     userID,
		"iss":     "sigma-finance",
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
		"jti":     uuid.New().String(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	require.NoError(t, err)

	// 3. Insert or update session in DB
	sessionID := uuid.New().String()
	sess := &model.Session{
		ID:           sessionID,
		UserID:       userID,
		Token:        tokenString,
		RefreshToken: uuid.New().String(),
		IPAddress:    "127.0.0.1",
		ExpiresAt:    time.Now().Add(24 * time.Hour),
		CreatedAt:    time.Now(),
	}
	_, err = db.NewInsert().Model(sess).Exec(ctx)
	require.NoError(t, err)
	defer func() {
		_, _ = db.NewDelete().Model((*model.Session)(nil)).Where("id = ?", sessionID).Exec(ctx)
	}()

	client := &http.Client{Timeout: 10 * time.Second}
	graphqlURL := "http://localhost:8080/graphql"

	executeGraphQL := func(t *testing.T, opName string, query string, variables map[string]interface{}) map[string]interface{} {
		payload := map[string]interface{}{
			"operationName": opName,
			"query":         query,
			"variables":     variables,
		}
		bodyBytes, err := json.Marshal(payload)
		require.NoError(t, err)

		req, err := http.NewRequest("POST", graphqlURL, bytes.NewReader(bodyBytes))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+tokenString)

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		respBytes, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		var respData map[string]interface{}
		err = json.Unmarshal(respBytes, &respData)
		require.NoError(t, err, "Response should be valid JSON: %s", string(respBytes))

		if errs, hasErr := respData["errors"]; hasErr {
			t.Fatalf("GraphQL returned errors for %s: %v\nFull body: %s", opName, errs, string(respBytes))
		}
		return respData
	}

	// ----------------------------------------------------
	// Query 1: GET_WALLET_ACCOUNTS (from client/src/graphql/queries/wallets.ts)
	// ----------------------------------------------------
	t.Run("Query: GetWalletAccounts", func(t *testing.T) {
		query := `
			query GetWalletAccounts($portfolioId: ID) {
				walletAccounts(portfolioId: $portfolioId) {
					id
					portfolioId
					network
					addressOrXpub
					isXpub
					label
					isActive
					lastSyncAt
					historyStatus
					lastSyncError
					balances {
						id
						symbol
						name
						decimals
						formattedQuantity
						rawBalance
						tokenAddress
						isSpam
						isHidden
						isStale
						lastUpdatedAt
					}
					createdAt
					updatedAt
				}
			}
		`
		res := executeGraphQL(t, "GetWalletAccounts", query, nil)
		data := res["data"].(map[string]interface{})
		accounts := data["walletAccounts"].([]interface{})
		require.NotEmpty(t, accounts, "Should return at least 1 wallet account")

		var foundAcc map[string]interface{}
		for _, accRaw := range accounts {
			acc := accRaw.(map[string]interface{})
			if acc["id"] == wacc.ID {
				foundAcc = acc
				break
			}
		}
		require.NotNil(t, foundAcc, "Target wacc should be in walletAccounts output")
		require.Equal(t, string(wacc.Network), foundAcc["network"])
		require.NotEmpty(t, foundAcc["historyStatus"])
		balances := foundAcc["balances"].([]interface{})
		require.NotEmpty(t, balances, "Should return non-empty balances for the target account")
		fmt.Printf("✅ GetWalletAccounts verified: %d accounts, %d balances found on target account %s\n", len(accounts), len(balances), wacc.ID)
	})

	// ----------------------------------------------------
	// Query 2: GET_WALLET_DEVICES (from client/src/graphql/queries/wallets.ts)
	// ----------------------------------------------------
	t.Run("Query: GetWalletDevices", func(t *testing.T) {
		query := `
			query GetWalletDevices {
				walletDevices {
					id
					name
					deviceType
					accounts {
						id
						portfolioId
						network
						addressOrXpub
						isActive
						lastSyncAt
						historyStatus
						balances {
							id
							symbol
							name
							decimals
							formattedQuantity
							rawBalance
							tokenAddress
							isSpam
							isHidden
							isStale
						}
					}
					createdAt
				}
			}
		`
		res := executeGraphQL(t, "GetWalletDevices", query, nil)
		data := res["data"].(map[string]interface{})
		devices := data["walletDevices"].([]interface{})
		fmt.Printf("✅ GetWalletDevices verified: returned %d devices without errors\n", len(devices))
	})

	// ----------------------------------------------------
	// Query 3: GET_WALLET_CU_USAGE (from client/src/graphql/queries/wallets.ts)
	// ----------------------------------------------------
	t.Run("Query: GetWalletCUUsage", func(t *testing.T) {
		query := `
			query GetWalletCUUsage {
				walletCUUsage {
					billingMonth
					consumedUnits
					maxQuota
					isThrottled
				}
			}
		`
		res := executeGraphQL(t, "GetWalletCUUsage", query, nil)
		data := res["data"].(map[string]interface{})
		cu := data["walletCUUsage"].(map[string]interface{})
		require.Equal(t, float64(30_000_000), cu["maxQuota"])
		require.Equal(t, false, cu["isThrottled"])
		fmt.Printf("✅ GetWalletCUUsage verified: maxQuota=%v consumed=%v throttled=%v\n", cu["maxQuota"], cu["consumedUnits"], cu["isThrottled"])
	})

	// ----------------------------------------------------
	// Query 4: GET_PENDING_WALLET_REVIEWS (from client/src/graphql/queries/wallets.ts)
	// ----------------------------------------------------
	t.Run("Query: GetPendingWalletReviews", func(t *testing.T) {
		query := `
			query GetPendingWalletReviews($portfolioId: ID!) {
				pendingWalletReviews(portfolioId: $portfolioId) {
					id
					walletActivityId
					reviewStatus
					suggestedType
					notes
					createdAt
				}
			}
		`
		portfolioID := "262686f8-bad8-4fb2-9842-34453fb4930c"
		res := executeGraphQL(t, "GetPendingWalletReviews", query, map[string]interface{}{"portfolioId": portfolioID})
		data := res["data"].(map[string]interface{})
		reviews := data["pendingWalletReviews"].([]interface{})
		fmt.Printf("✅ GetPendingWalletReviews verified: returned %d reviews without errors\n", len(reviews))
	})

	// ----------------------------------------------------
	// Mutation 1: TRIGGER_WALLET_SYNC in pure Keyless-First mode (Zero Alchemy Key)
	// ----------------------------------------------------
	t.Run("Mutation: TriggerWalletSync_KeylessFirst", func(t *testing.T) {
		// Ensure no Alchemy key is configured in DB for this test
		_, _ = db.NewDelete().Model((*model.MarketDataCredential)(nil)).Where("provider = 'ALCHEMY'").Exec(ctx)

		query := `
			mutation TriggerWalletSync($id: ID!) {
				triggerWalletSync(id: $id)
			}
		`
		res := executeGraphQL(t, "TriggerWalletSync", query, map[string]interface{}{"id": wacc.ID})
		data := res["data"].(map[string]interface{})
		ok := data["triggerWalletSync"].(bool)
		require.True(t, ok)
		fmt.Printf("✅ Keyless TriggerWalletSync verified (zero Alchemy key in DB): returned success=%v\n", ok)

		// Assert resulting balances and activities (not just __typename)
		accQuery := `
			query GetWalletAccountsAfterSync($portfolioId: ID) {
				walletAccounts(portfolioId: $portfolioId) {
					id
					network
					addressOrXpub
					lastSyncAt
					historyStatus
					balances {
						id
						symbol
						name
						decimals
						formattedQuantity
						rawBalance
						tokenAddress
					}
				}
			}
		`
		resAcc := executeGraphQL(t, "GetWalletAccountsAfterSync", accQuery, nil)
		dataAcc := resAcc["data"].(map[string]interface{})
		accountsAfter := dataAcc["walletAccounts"].([]interface{})
		require.NotEmpty(t, accountsAfter)

		var matchedAcc map[string]interface{}
		for _, raw := range accountsAfter {
			acc := raw.(map[string]interface{})
			if acc["id"] == wacc.ID {
				matchedAcc = acc
				break
			}
		}
		require.NotNil(t, matchedAcc, "Synchronized account must be returned")
		bals := matchedAcc["balances"].([]interface{})
		require.NotEmpty(t, bals, "Account must have synchronized balances in keyless mode")
		firstBal := bals[0].(map[string]interface{})
		require.NotEmpty(t, firstBal["symbol"], "Balance symbol must be present")
		require.NotEmpty(t, firstBal["rawBalance"], "Raw balance must be present")
		require.NotEmpty(t, firstBal["formattedQuantity"], "Formatted quantity must be present")
		fmt.Printf("✅ Keyless post-sync assertion verified: account %s has %d balances (first: %s raw=%s qty=%s)\n",
			wacc.ID, len(bals), firstBal["symbol"], firstBal["rawBalance"], firstBal["formattedQuantity"])
	})

	// ----------------------------------------------------
	// Mutation 2: CONFIGURE_ALCHEMY_KEY (Optional Commercial Tier Upgrade)
	// ----------------------------------------------------
	t.Run("Mutation: ConfigureAlchemyKey_OptionalUpgrade", func(t *testing.T) {
		query := `
			mutation ConfigureAlchemyKey($apiKey: String!) {
				configureAlchemyKey(apiKey: $apiKey)
			}
		`
		res := executeGraphQL(t, "ConfigureAlchemyKey", query, map[string]interface{}{"apiKey": "test-key-qualification-1234"})
		data := res["data"].(map[string]interface{})
		ok := data["configureAlchemyKey"].(bool)
		require.True(t, ok)
		fmt.Printf("✅ ConfigureAlchemyKey verified: returned success=%v\n", ok)
	})

	// ----------------------------------------------------
	// Mutation 3: TOGGLE_SPAM_TOKEN (from client/src/graphql/mutations/wallets.ts)
	// ----------------------------------------------------
	t.Run("Mutation: ToggleSpamToken", func(t *testing.T) {
		var bal model.WalletBalance
		err := db.NewSelect().Model(&bal).Where("wallet_account_id = ?", wacc.ID).Limit(1).Scan(ctx)
		require.NoError(t, err)

		query := `
			mutation ToggleSpamToken($balanceId: ID!, $isHidden: Boolean!) {
				toggleSpamToken(balanceId: $balanceId, isHidden: $isHidden)
			}
		`
		res := executeGraphQL(t, "ToggleSpamToken", query, map[string]interface{}{
			"balanceId": bal.ID,
			"isHidden":  true,
		})
		data := res["data"].(map[string]interface{})
		ok := data["toggleSpamToken"].(bool)
		require.True(t, ok)

		// Revert back
		executeGraphQL(t, "ToggleSpamToken", query, map[string]interface{}{
			"balanceId": bal.ID,
			"isHidden":  false,
		})
		fmt.Printf("✅ ToggleSpamToken verified: returned success=%v\n", ok)
	})
}
