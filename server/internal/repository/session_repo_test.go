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

func TestSessionRepository_GetByToken(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test session
	session := &model.Session{
		UserID:       createdUser.ID,
		Token:        "test-token-123",
		RefreshToken: "refresh-token-123",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	createdSession, err := sessionRepo.Create(ctx, session)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "existing token",
			token:   "test-token-123",
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
			foundSession, err := sessionRepo.GetByToken(ctx, tt.token)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, foundSession)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, foundSession)
				assert.Equal(t, tt.token, foundSession.Token)
				assert.Equal(t, createdSession.ID, foundSession.ID)
			}
		})
	}
}

func TestSessionRepository_GetByRefreshToken(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test session
	session := &model.Session{
		UserID:       createdUser.ID,
		Token:        "test-token-123",
		RefreshToken: "refresh-token-123",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	createdSession, err := sessionRepo.Create(ctx, session)
	require.NoError(t, err)

	tests := []struct {
		name         string
		refreshToken string
		wantErr      bool
	}{
		{
			name:         "existing refresh token",
			refreshToken: "refresh-token-123",
			wantErr:      false,
		},
		{
			name:         "non-existing refresh token",
			refreshToken: "non-existent-refresh-token",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			foundSession, err := sessionRepo.GetByRefreshToken(ctx, tt.refreshToken)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, foundSession)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, foundSession)
				assert.Equal(t, tt.refreshToken, foundSession.RefreshToken)
				assert.Equal(t, createdSession.ID, foundSession.ID)
			}
		})
	}
}

func TestSessionRepository_GetActiveSessionsByUserID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create active session
	activeSession := &model.Session{
		UserID:       createdUser.ID,
		Token:        "active-token",
		RefreshToken: "active-refresh-token",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	// Create expired session
	expiredSession := &model.Session{
		UserID:       createdUser.ID,
		Token:        "expired-token",
		RefreshToken: "expired-refresh-token",
		ExpiresAt:    time.Now().Add(-time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	_, err = sessionRepo.Create(ctx, activeSession)
	require.NoError(t, err)
	_, err = sessionRepo.Create(ctx, expiredSession)
	require.NoError(t, err)

	// Get active sessions
	activeSessions, err := sessionRepo.GetActiveSessionsByUserID(ctx, createdUser.ID)
	require.NoError(t, err)

	// Should only return the active session
	assert.Len(t, activeSessions, 1)
	assert.Equal(t, "active-token", activeSessions[0].Token)
}

func TestSessionRepository_RevokeSession(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test session
	session := &model.Session{
		UserID:       createdUser.ID,
		Token:        "test-token-123",
		RefreshToken: "refresh-token-123",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	_, err = sessionRepo.Create(ctx, session)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "revoke existing session",
			token:   "test-token-123",
			wantErr: false,
		},
		{
			name:    "revoke non-existing session",
			token:   "non-existent-token",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := sessionRepo.RevokeSession(ctx, tt.token)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the session is now expired
				revokedSession, err := sessionRepo.GetByToken(ctx, tt.token)
				require.NoError(t, err)
				assert.True(t, revokedSession.IsExpired())
			}
		})
	}
}

func TestSessionRepository_RevokeAllUserSessions(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
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

	// Create sessions for both users
	session1 := &model.Session{
		UserID:       createdUser1.ID,
		Token:        "user1-token-1",
		RefreshToken: "user1-refresh-1",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	session2 := &model.Session{
		UserID:       createdUser1.ID,
		Token:        "user1-token-2",
		RefreshToken: "user1-refresh-2",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	session3 := &model.Session{
		UserID:       createdUser2.ID,
		Token:        "user2-token-1",
		RefreshToken: "user2-refresh-1",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	_, err = sessionRepo.Create(ctx, session1)
	require.NoError(t, err)
	_, err = sessionRepo.Create(ctx, session2)
	require.NoError(t, err)
	_, err = sessionRepo.Create(ctx, session3)
	require.NoError(t, err)

	// Revoke all sessions for user1
	err = sessionRepo.RevokeAllUserSessions(ctx, createdUser1.ID)
	require.NoError(t, err)

	// Verify user1's sessions are expired
	user1Sessions, err := sessionRepo.GetByUserID(ctx, createdUser1.ID)
	require.NoError(t, err)
	for _, session := range user1Sessions {
		assert.True(t, session.IsExpired())
	}

	// Verify user2's sessions are still active
	user2Sessions, err := sessionRepo.GetActiveSessionsByUserID(ctx, createdUser2.ID)
	require.NoError(t, err)
	assert.Len(t, user2Sessions, 1)
	assert.False(t, user2Sessions[0].IsExpired())
}

func TestSessionRepository_RevokeExpiredSessions(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create active session
	activeSession := &model.Session{
		UserID:       createdUser.ID,
		Token:        "active-token",
		RefreshToken: "active-refresh-token",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	// Create expired session
	expiredSession := &model.Session{
		UserID:       createdUser.ID,
		Token:        "expired-token",
		RefreshToken: "expired-refresh-token",
		ExpiresAt:    time.Now().Add(-time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	_, err = sessionRepo.Create(ctx, activeSession)
	require.NoError(t, err)
	_, err = sessionRepo.Create(ctx, expiredSession)
	require.NoError(t, err)

	// Revoke expired sessions
	deletedCount, err := sessionRepo.RevokeExpiredSessions(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, deletedCount)

	// Verify only active session remains
	allSessions, err := sessionRepo.GetByUserID(ctx, createdUser.ID)
	require.NoError(t, err)
	assert.Len(t, allSessions, 1)
	assert.Equal(t, "active-token", allSessions[0].Token)
}

func TestSessionRepository_RefreshSession(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	sessionRepo := NewSessionRepository(testDB.DB)
	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email: "test@example.com",
		Name:  "Test User",
	}
	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test session
	session := &model.Session{
		UserID:       createdUser.ID,
		Token:        "old-token",
		RefreshToken: "old-refresh-token",
		ExpiresAt:    time.Now().Add(time.Hour),
		IPAddress:    "192.168.1.1",
		UserAgent:    "Test User Agent",
	}

	createdSession, err := sessionRepo.Create(ctx, session)
	require.NoError(t, err)

	newExpiresAt := time.Now().Add(2 * time.Hour)

	// Refresh the session
	err = sessionRepo.RefreshSession(ctx, createdSession.ID, "new-token", "new-refresh-token", newExpiresAt)
	require.NoError(t, err)

	// Verify the session was updated
	updatedSession, err := sessionRepo.GetByStringID(ctx, createdSession.ID)
	require.NoError(t, err)
	assert.Equal(t, "new-token", updatedSession.Token)
	assert.Equal(t, "new-refresh-token", updatedSession.RefreshToken)
	assert.True(t, updatedSession.ExpiresAt.Equal(newExpiresAt) || updatedSession.ExpiresAt.After(newExpiresAt.Add(-time.Second)))
}
