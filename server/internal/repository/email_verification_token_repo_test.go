package repository

import (
	"context"
	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEmailVerificationTokenRepository_GetByToken(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test token
	token := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "test-verification-token-123",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	createdToken, err := tokenRepo.Create(ctx, token)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "existing token",
			token:   "test-verification-token-123",
			wantErr: false,
		},
		{
			name:    "non-existing token",
			token:   "non-existent-token",
			wantErr: true,
		},
		{
			name:    "empty token",
			token:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			foundToken, err := tokenRepo.GetByToken(ctx, tt.token)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, foundToken)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, foundToken)
				assert.Equal(t, tt.token, foundToken.Token)
				assert.Equal(t, createdToken.ID, foundToken.ID)
			}
		})
	}
}

func TestEmailVerificationTokenRepository_GetValidTokenByUserID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create valid token
	validToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "valid-token",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	// Create expired token
	expiredToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "expired-token",
		ExpiresAt: time.Now().Add(-time.Hour),
		Used:      false,
	}

	// Create used token
	usedToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "used-token",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      true,
	}

	_, err = tokenRepo.Create(ctx, validToken)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, expiredToken)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, usedToken)
	require.NoError(t, err)

	// Get valid token
	foundToken, err := tokenRepo.GetValidTokenByUserID(ctx, createdUser.ID)
	require.NoError(t, err)
	assert.NotNil(t, foundToken)
	assert.Equal(t, "valid-token", foundToken.Token)
	assert.False(t, foundToken.Used)
	assert.False(t, foundToken.IsExpired())

	// Test with non-existing user
	_, err = tokenRepo.GetValidTokenByUserID(ctx, "non-existent-user-id")
	assert.Error(t, err)
}

func TestEmailVerificationTokenRepository_MarkTokenAsUsed(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test token
	token := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "test-token",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	createdToken, err := tokenRepo.Create(ctx, token)
	require.NoError(t, err)

	tests := []struct {
		name    string
		tokenID string
		wantErr bool
	}{
		{
			name:    "mark existing token as used",
			tokenID: createdToken.ID,
			wantErr: false,
		},
		{
			name:    "mark non-existing token as used",
			tokenID: "non-existent-id",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tokenRepo.MarkTokenAsUsed(ctx, tt.tokenID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the token is marked as used
				updatedToken, err := tokenRepo.GetByStringID(ctx, tt.tokenID)
				require.NoError(t, err)
				assert.True(t, updatedToken.Used)
			}
		})
	}
}

func TestEmailVerificationTokenRepository_DeleteExpiredTokens(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create valid token
	validToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "valid-token",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	// Create expired token
	expiredToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "expired-token",
		ExpiresAt: time.Now().Add(-time.Hour),
		Used:      false,
	}

	_, err = tokenRepo.Create(ctx, validToken)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, expiredToken)
	require.NoError(t, err)

	// Delete expired tokens
	deletedCount, err := tokenRepo.DeleteExpiredTokens(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, deletedCount)

	// Verify only valid token remains
	allTokens, err := tokenRepo.GetByUserID(ctx, createdUser.ID)
	require.NoError(t, err)
	assert.Len(t, allTokens, 1)
	assert.Equal(t, "valid-token", allTokens[0].Token)
}

func TestEmailVerificationTokenRepository_RevokeAllUserTokens(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test users
	user1 := &model.User{
		Email: "user1@example.com",
		Name:  "User 1",
	}
	user2 := &model.User{
		Email: "user2@example.com",
		Name:  "User 2",
	}

	createdUser1, err := userRepo.Create(ctx, user1)
	require.NoError(t, err)
	createdUser2, err := userRepo.Create(ctx, user2)
	require.NoError(t, err)

	// Create tokens for both users
	token1 := &model.EmailVerificationToken{
		UserID:    createdUser1.ID,
		Token:     "user1-token-1",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	token2 := &model.EmailVerificationToken{
		UserID:    createdUser1.ID,
		Token:     "user1-token-2",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	token3 := &model.EmailVerificationToken{
		UserID:    createdUser2.ID,
		Token:     "user2-token-1",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	_, err = tokenRepo.Create(ctx, token1)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, token2)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, token3)
	require.NoError(t, err)

	// Revoke all tokens for user1
	err = tokenRepo.RevokeAllUserTokens(ctx, createdUser1.ID)
	require.NoError(t, err)

	// Verify user1's tokens are marked as used
	user1Tokens, err := tokenRepo.GetByUserID(ctx, createdUser1.ID)
	require.NoError(t, err)
	for _, token := range user1Tokens {
		assert.True(t, token.Used)
	}

	// Verify user2's tokens are still valid
	validToken, err := tokenRepo.GetValidTokenByUserID(ctx, createdUser2.ID)
	require.NoError(t, err)
	assert.NotNil(t, validToken)
	assert.False(t, validToken.Used)
}

func TestEmailVerificationTokenRepository_GetValidToken(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create valid token
	validToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "valid-token-123",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
	}

	// Create expired token
	expiredToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "expired-token-123",
		ExpiresAt: time.Now().Add(-time.Hour),
		Used:      false,
	}

	// Create used token
	usedToken := &model.EmailVerificationToken{
		UserID:    createdUser.ID,
		Token:     "used-token-123",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      true,
	}

	_, err = tokenRepo.Create(ctx, validToken)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, expiredToken)
	require.NoError(t, err)
	_, err = tokenRepo.Create(ctx, usedToken)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "valid token",
			token:   "valid-token-123",
			wantErr: false,
		},
		{
			name:    "expired token",
			token:   "expired-token-123",
			wantErr: true,
		},
		{
			name:    "used token",
			token:   "used-token-123",
			wantErr: true,
		},
		{
			name:    "non-existing token",
			token:   "non-existent-token",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			foundToken, err := tokenRepo.GetValidToken(ctx, tt.token)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, foundToken)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, foundToken)
				assert.Equal(t, tt.token, foundToken.Token)
				assert.False(t, foundToken.Used)
				assert.False(t, foundToken.IsExpired())
			}
		})
	}
}

func TestEmailVerificationTokenRepository_CreateToken(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	tokenRepo := NewEmailVerificationTokenRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   *model.EmailVerificationToken
		wantErr bool
	}{
		{
			name: "valid token",
			token: &model.EmailVerificationToken{
				UserID:    createdUser.ID,
				Token:     "valid-token-123",
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Used:      false,
			},
			wantErr: false,
		},
		{
			name: "token without user ID",
			token: &model.EmailVerificationToken{
				Token:     "invalid-token-123",
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Used:      false,
			},
			wantErr: true,
		},
		{
			name: "token without token value",
			token: &model.EmailVerificationToken{
				UserID:    createdUser.ID,
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Used:      false,
			},
			wantErr: true,
		},
		{
			name: "token without expiration",
			token: &model.EmailVerificationToken{
				UserID: createdUser.ID,
				Token:  "no-expiry-token",
				Used:   false,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			createdToken, err := tokenRepo.CreateToken(ctx, tt.token)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, createdToken)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, createdToken)
				assert.NotEmpty(t, createdToken.ID)
				assert.Equal(t, tt.token.Token, createdToken.Token)
				assert.Equal(t, tt.token.UserID, createdToken.UserID)
			}
		})
	}
}
