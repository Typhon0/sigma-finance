package graphql

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/handler/middleware"
	syncservice "sigma_finance/internal/service/sync"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSyncService struct {
	registerAdapterFn        func(adapter syncservice.SyncAdapter)
	triggerSyncFn            func(ctx context.Context, connectionID string) (*model.SyncRun, error)
	triggerAccountSyncFn     func(ctx context.Context, accountID string) (*model.SyncRun, error)
	registerCredentialFn     func(ctx context.Context, userID string, provider string, rawJSON string) (*model.SyncCredential, error)
	linkAccountFn            func(ctx context.Context, connectionID string, accountID string, autoCreate bool) (*model.SyncConnection, error)
	getConnectionFn          func(ctx context.Context, connectionID string) (*model.SyncConnection, error)
	listConnectionsFn        func(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error)
	listCredentialsFn        func(ctx context.Context, userID string) ([]*model.SyncCredential, error)
	getAdapterFn             func(provider string) (syncservice.SyncAdapter, bool)
	generateAggregatorLinkFn func(ctx context.Context, userID string, provider string, redirectURL string) (*syncservice.AggregatorAuthSession, error)
	completeAggregatorAuthFn func(ctx context.Context, userID string, connectionID string, sessionToken string) ([]*model.SyncConnection, error)
}

func (m *mockSyncService) RegisterAdapter(adapter syncservice.SyncAdapter) {
	if m.registerAdapterFn != nil {
		m.registerAdapterFn(adapter)
	}
}

func (m *mockSyncService) TriggerSync(ctx context.Context, connectionID string) (*model.SyncRun, error) {
	if m.triggerSyncFn != nil {
		return m.triggerSyncFn(ctx, connectionID)
	}
	return &model.SyncRun{ID: "run-1", ConnectionID: connectionID, Status: model.SyncRunStatusCompleted}, nil
}

func (m *mockSyncService) TriggerAccountSync(ctx context.Context, accountID string) (*model.SyncRun, error) {
	if m.triggerAccountSyncFn != nil {
		return m.triggerAccountSyncFn(ctx, accountID)
	}
	return &model.SyncRun{
		ID:            "run-default",
		ConnectionID:  "conn-default",
		Status:        model.SyncRunStatusCompleted,
		ItemsImported: 5,
		ItemsUpdated:  2,
		StartedAt:     time.Now().Add(-1 * time.Minute),
	}, nil
}

func (m *mockSyncService) RegisterCredential(ctx context.Context, userID string, provider string, rawJSON string) (*model.SyncCredential, error) {
	if m.registerCredentialFn != nil {
		return m.registerCredentialFn(ctx, userID, provider, rawJSON)
	}
	return &model.SyncCredential{
		ID:        "cred-default",
		UserID:    userID,
		Provider:  provider,
		Status:    model.SyncCredentialStatusActive,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

func (m *mockSyncService) LinkAccount(ctx context.Context, connectionID string, accountID string, autoCreate bool) (*model.SyncConnection, error) {
	if m.linkAccountFn != nil {
		return m.linkAccountFn(ctx, connectionID, accountID, autoCreate)
	}
	accID := accountID
	if autoCreate && accID == "" {
		accID = "acc-auto-created"
	}
	return &model.SyncConnection{
		ID:          connectionID,
		UserID:      "user-123",
		PortfolioID: "port-123",
		AccountID:   &accID,
		Provider:    model.SyncProviderKraken,
		SyncStatus:  model.SyncConnectionStatusIdle,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}, nil
}

func (m *mockSyncService) GetConnection(ctx context.Context, connectionID string) (*model.SyncConnection, error) {
	if m.getConnectionFn != nil {
		return m.getConnectionFn(ctx, connectionID)
	}
	return &model.SyncConnection{
		ID:                    connectionID,
		UserID:                "user-123",
		PortfolioID:           "port-123",
		Provider:              model.SyncProviderKraken,
		ExternalInstitutionID: "kraken-main",
		ExternalAccountID:     "krak-acc-1",
		InstitutionName:       "Kraken",
		SyncStatus:            model.SyncConnectionStatusIdle,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}, nil
}

func (m *mockSyncService) ListConnections(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
	if m.listConnectionsFn != nil {
		return m.listConnectionsFn(ctx, portfolioID)
	}
	return []*model.SyncConnection{
		{
			ID:                    "conn-1",
			UserID:                "user-123",
			PortfolioID:           portfolioID,
			Provider:              model.SyncProviderKraken,
			ExternalInstitutionID: "kraken",
			ExternalAccountID:     "ext-acc-1",
			InstitutionName:       "Kraken Spot",
			SyncStatus:            model.SyncConnectionStatusSuccess,
			CreatedAt:             time.Now(),
			UpdatedAt:             time.Now(),
		},
	}, nil
}

func (m *mockSyncService) ListCredentials(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
	if m.listCredentialsFn != nil {
		return m.listCredentialsFn(ctx, userID)
	}
	return []*model.SyncCredential{
		{
			ID:        "cred-1",
			UserID:    userID,
			Provider:  model.SyncProviderKraken,
			Status:    model.SyncCredentialStatusActive,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}, nil
}

func (m *mockSyncService) GetAdapter(provider string) (syncservice.SyncAdapter, bool) {
	if m.getAdapterFn != nil {
		return m.getAdapterFn(provider)
	}
	return nil, false
}

func (m *mockSyncService) GenerateAggregatorLink(ctx context.Context, userID string, provider string, redirectURL string) (*syncservice.AggregatorAuthSession, error) {
	if m.generateAggregatorLinkFn != nil {
		return m.generateAggregatorLinkFn(ctx, userID, provider, redirectURL)
	}
	return &syncservice.AggregatorAuthSession{
		Link:         "https://portal.snaptrade.com/auth?token=xyz",
		SessionToken: "session-xyz-123",
		Provider:     provider,
	}, nil
}

func (m *mockSyncService) CompleteAggregatorAuth(ctx context.Context, userID string, connectionID string, sessionToken string) ([]*model.SyncConnection, error) {
	if m.completeAggregatorAuthFn != nil {
		return m.completeAggregatorAuthFn(ctx, userID, connectionID, sessionToken)
	}
	return []*model.SyncConnection{
		{
			ID:                    connectionID,
			UserID:                userID,
			PortfolioID:           "port-123",
			Provider:              model.SyncProviderSnapTrade,
			ExternalInstitutionID: "trade-republic",
			ExternalAccountID:     "tr-acc-99",
			InstitutionName:       "Trade Republic",
			SyncStatus:            model.SyncConnectionStatusSuccess,
			CreatedAt:             time.Now(),
			UpdatedAt:             time.Now(),
		},
	}, nil
}

func createAuthContext(userID string) context.Context {
	return context.WithValue(context.Background(), middleware.UserKey, &middleware.AuthenticatedUser{
		ID:            userID,
		Email:         userID + "@example.com",
		EmailVerified: true,
	})
}

func TestGraphQL_TriggerAccountSyncMutation(t *testing.T) {
	t.Run("successfully triggers sync for account", func(t *testing.T) {
		mockService := &mockSyncService{
			triggerAccountSyncFn: func(ctx context.Context, accountID string) (*model.SyncRun, error) {
				assert.Equal(t, "account-123", accountID)
				now := time.Now()
				return &model.SyncRun{
					ID:            "run-123",
					ConnectionID:  "conn-456",
					Status:        model.SyncRunStatusCompleted,
					ItemsImported: 10,
					ItemsUpdated:  4,
					StartedAt:     now.Add(-30 * time.Second),
					CompletedAt:   &now,
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		run, err := r.Mutation().TriggerAccountSync(ctx, "account-123")
		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, "run-123", run.ID)
		assert.Equal(t, "conn-456", run.ConnectionID)
		assert.Equal(t, string(model.SyncRunStatusCompleted), run.Status)
		assert.Equal(t, int32(10), run.ItemsImported)
		assert.Equal(t, int32(4), run.ItemsUpdated)
	})

	t.Run("fails when unauthenticated", func(t *testing.T) {
		r := &Resolver{SyncService: &mockSyncService{}}
		ctx := context.Background()

		run, err := r.Mutation().TriggerAccountSync(ctx, "account-123")
		assert.Error(t, err)
		assert.Nil(t, run)
	})

	t.Run("fails when connection belongs to another user", func(t *testing.T) {
		mockService := &mockSyncService{
			getConnectionFn: func(ctx context.Context, connectionID string) (*model.SyncConnection, error) {
				return &model.SyncConnection{
					ID:     connectionID,
					UserID: "other-user",
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		run, err := r.Mutation().TriggerAccountSync(ctx, "account-123")
		assert.Error(t, err)
		assert.Nil(t, run)
		assert.Contains(t, err.Error(), "unauthorized")
	})
}

func TestGraphQL_RegisterSyncCredentialMutation(t *testing.T) {
	t.Run("successfully registers credentials", func(t *testing.T) {
		var capturedJSON string
		mockService := &mockSyncService{
			registerCredentialFn: func(ctx context.Context, userID, provider, rawJSON string) (*model.SyncCredential, error) {
				assert.Equal(t, "user-123", userID)
				assert.Equal(t, model.SyncProviderKraken, provider)
				capturedJSON = rawJSON
				return &model.SyncCredential{
					ID:        "cred-kraken-1",
					UserID:    userID,
					Provider:  provider,
					Status:    model.SyncCredentialStatusActive,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		cred, err := r.Mutation().RegisterSyncCredential(ctx, model.SyncProviderKraken, map[string]any{
			"apiKey":    "test-api-key",
			"apiSecret": "test-secret-key",
		})
		require.NoError(t, err)
		require.NotNil(t, cred)
		assert.Equal(t, "cred-kraken-1", cred.ID)
		assert.Equal(t, model.SyncProviderKraken, cred.Provider)
		assert.Equal(t, string(model.SyncCredentialStatusActive), cred.Status)
		assert.Contains(t, capturedJSON, "test-api-key")
	})

	t.Run("fails when unauthenticated", func(t *testing.T) {
		r := &Resolver{SyncService: &mockSyncService{}}
		ctx := context.Background()

		cred, err := r.Mutation().RegisterSyncCredential(ctx, model.SyncProviderKraken, map[string]any{"apiKey": "k"})
		assert.Error(t, err)
		assert.Nil(t, cred)
	})
}

func TestGraphQL_GenerateAggregatorLinkMutation(t *testing.T) {
	t.Run("successfully generates aggregator link", func(t *testing.T) {
		mockService := &mockSyncService{
			generateAggregatorLinkFn: func(ctx context.Context, userID, provider, redirectURL string) (*syncservice.AggregatorAuthSession, error) {
				assert.Equal(t, "user-123", userID)
				assert.Equal(t, model.SyncProviderSnapTrade, provider)
				assert.Equal(t, "https://sigma.example.com/callback", redirectURL)
				return &syncservice.AggregatorAuthSession{
					Link:         "https://portal.snaptrade.com/login?token=xyz",
					SessionToken: "session-snap-1",
					Provider:     provider,
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		session, err := r.Mutation().GenerateAggregatorLink(ctx, model.SyncProviderSnapTrade, "https://sigma.example.com/callback")
		require.NoError(t, err)
		require.NotNil(t, session)
		assert.Equal(t, "https://portal.snaptrade.com/login?token=xyz", session.Link)
		assert.Equal(t, "session-snap-1", session.SessionToken)
		assert.Equal(t, model.SyncProviderSnapTrade, session.Provider)
	})

	t.Run("fails when unauthenticated", func(t *testing.T) {
		r := &Resolver{SyncService: &mockSyncService{}}
		ctx := context.Background()

		session, err := r.Mutation().GenerateAggregatorLink(ctx, model.SyncProviderSnapTrade, "https://sigma.example.com/callback")
		assert.Error(t, err)
		assert.Nil(t, session)
	})
}

func TestGraphQL_CompleteAggregatorAuthMutation(t *testing.T) {
	t.Run("successfully completes aggregator auth", func(t *testing.T) {
		mockService := &mockSyncService{
			completeAggregatorAuthFn: func(ctx context.Context, userID, connectionID, sessionToken string) ([]*model.SyncConnection, error) {
				assert.Equal(t, "user-123", userID)
				assert.Equal(t, "conn-snap-1", connectionID)
				assert.Equal(t, "session-token-xyz", sessionToken)
				return []*model.SyncConnection{
					{
						ID:                    connectionID,
						UserID:                userID,
						PortfolioID:           "port-1",
						Provider:              model.SyncProviderSnapTrade,
						ExternalInstitutionID: "trade-republic",
						ExternalAccountID:     "tr-acc-001",
						InstitutionName:       "Trade Republic",
						SyncStatus:            model.SyncConnectionStatusSuccess,
						CreatedAt:             time.Now(),
						UpdatedAt:             time.Now(),
					},
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		conns, err := r.Mutation().CompleteAggregatorAuth(ctx, "conn-snap-1", "session-token-xyz")
		require.NoError(t, err)
		require.Len(t, conns, 1)
		assert.Equal(t, "conn-snap-1", conns[0].ID)
		assert.Equal(t, "Trade Republic", conns[0].InstitutionName)
		assert.Equal(t, string(model.SyncConnectionStatusSuccess), conns[0].SyncStatus)
	})

	t.Run("fails when unauthenticated", func(t *testing.T) {
		r := &Resolver{SyncService: &mockSyncService{}}
		ctx := context.Background()

		conns, err := r.Mutation().CompleteAggregatorAuth(ctx, "conn-1", "tok")
		assert.Error(t, err)
		assert.Nil(t, conns)
	})
}

func TestGraphQL_LinkSyncAccountMutation(t *testing.T) {
	t.Run("successfully links existing account", func(t *testing.T) {
		accID := "acc-existing-1"
		mockService := &mockSyncService{
			getConnectionFn: func(ctx context.Context, connectionID string) (*model.SyncConnection, error) {
				return &model.SyncConnection{
					ID:          connectionID,
					UserID:      "user-123",
					PortfolioID: "port-1",
				}, nil
			},
			linkAccountFn: func(ctx context.Context, connectionID, accountID string, autoCreate bool) (*model.SyncConnection, error) {
				assert.Equal(t, "conn-1", connectionID)
				assert.Equal(t, accID, accountID)
				assert.False(t, autoCreate)
				return &model.SyncConnection{
					ID:          connectionID,
					UserID:      "user-123",
					PortfolioID: "port-1",
					AccountID:   &accountID,
					Provider:    model.SyncProviderKraken,
					SyncStatus:  model.SyncConnectionStatusIdle,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		autoCreateFalse := false
		conn, err := r.Mutation().LinkSyncAccount(ctx, "conn-1", &accID, &autoCreateFalse)
		require.NoError(t, err)
		require.NotNil(t, conn)
		require.NotNil(t, conn.AccountID)
		assert.Equal(t, accID, *conn.AccountID)
	})

	t.Run("successfully auto-creates account", func(t *testing.T) {
		mockService := &mockSyncService{
			getConnectionFn: func(ctx context.Context, connectionID string) (*model.SyncConnection, error) {
				return &model.SyncConnection{
					ID:          connectionID,
					UserID:      "user-123",
					PortfolioID: "port-1",
				}, nil
			},
			linkAccountFn: func(ctx context.Context, connectionID, accountID string, autoCreate bool) (*model.SyncConnection, error) {
				assert.True(t, autoCreate)
				createdID := "acc-auto-created"
				return &model.SyncConnection{
					ID:          connectionID,
					UserID:      "user-123",
					PortfolioID: "port-1",
					AccountID:   &createdID,
					Provider:    model.SyncProviderKraken,
					SyncStatus:  model.SyncConnectionStatusIdle,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		autoCreateTrue := true
		conn, err := r.Mutation().LinkSyncAccount(ctx, "conn-1", nil, &autoCreateTrue)
		require.NoError(t, err)
		require.NotNil(t, conn)
		require.NotNil(t, conn.AccountID)
		assert.Equal(t, "acc-auto-created", *conn.AccountID)
	})

	t.Run("fails when connection belongs to another user", func(t *testing.T) {
		mockService := &mockSyncService{
			getConnectionFn: func(ctx context.Context, connectionID string) (*model.SyncConnection, error) {
				return &model.SyncConnection{
					ID:     connectionID,
					UserID: "other-user",
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		conn, err := r.Mutation().LinkSyncAccount(ctx, "conn-1", nil, nil)
		assert.Error(t, err)
		assert.Nil(t, conn)
		assert.Contains(t, err.Error(), "unauthorized")
	})
}

func TestGraphQL_SyncConnectionsQuery(t *testing.T) {
	t.Run("returns connections for authorized user", func(t *testing.T) {
		mockService := &mockSyncService{
			listConnectionsFn: func(ctx context.Context, portfolioID string) ([]*model.SyncConnection, error) {
				return []*model.SyncConnection{
					{
						ID:                    "conn-1",
						UserID:                "user-123",
						PortfolioID:           portfolioID,
						Provider:              model.SyncProviderKraken,
						ExternalInstitutionID: "kraken",
						ExternalAccountID:     "krak-01",
						InstitutionName:       "Kraken Spot",
						SyncStatus:            model.SyncConnectionStatusSuccess,
						CreatedAt:             time.Now(),
						UpdatedAt:             time.Now(),
					},
					{
						ID:                    "conn-other-user",
						UserID:                "other-user",
						PortfolioID:           portfolioID,
						Provider:              model.SyncProviderKraken,
						ExternalInstitutionID: "kraken",
						ExternalAccountID:     "krak-02",
						InstitutionName:       "Kraken Spot",
						SyncStatus:            model.SyncConnectionStatusSuccess,
						CreatedAt:             time.Now(),
						UpdatedAt:             time.Now(),
					},
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		conns, err := r.Query().SyncConnections(ctx, "port-123")
		require.NoError(t, err)
		require.Len(t, conns, 1)
		assert.Equal(t, "conn-1", conns[0].ID)
		assert.Equal(t, "Kraken Spot", conns[0].InstitutionName)
	})

	t.Run("fails when unauthenticated", func(t *testing.T) {
		r := &Resolver{SyncService: &mockSyncService{}}
		ctx := context.Background()

		conns, err := r.Query().SyncConnections(ctx, "port-123")
		assert.Error(t, err)
		assert.Nil(t, conns)
	})
}

func TestGraphQL_SyncCredentialsQuery(t *testing.T) {
	t.Run("returns credentials for user", func(t *testing.T) {
		mockService := &mockSyncService{
			listCredentialsFn: func(ctx context.Context, userID string) ([]*model.SyncCredential, error) {
				return []*model.SyncCredential{
					{
						ID:        "cred-1",
						UserID:    userID,
						Provider:  model.SyncProviderKraken,
						Status:    model.SyncCredentialStatusActive,
						CreatedAt: time.Now(),
						UpdatedAt: time.Now(),
					},
					{
						ID:        "cred-2",
						UserID:    userID,
						Provider:  model.SyncProviderSnapTrade,
						Status:    model.SyncCredentialStatusActive,
						CreatedAt: time.Now(),
						UpdatedAt: time.Now(),
					},
				}, nil
			},
		}

		r := &Resolver{SyncService: mockService}
		ctx := createAuthContext("user-123")

		creds, err := r.Query().SyncCredentials(ctx)
		require.NoError(t, err)
		require.Len(t, creds, 2)
		assert.Equal(t, "cred-1", creds[0].ID)
		assert.Equal(t, model.SyncProviderKraken, creds[0].Provider)
		assert.Equal(t, "cred-2", creds[1].ID)
		assert.Equal(t, model.SyncProviderSnapTrade, creds[1].Provider)
	})

	t.Run("fails when unauthenticated", func(t *testing.T) {
		r := &Resolver{SyncService: &mockSyncService{}}
		ctx := context.Background()

		creds, err := r.Query().SyncCredentials(ctx)
		assert.Error(t, err)
		assert.Nil(t, creds)
	})
}
