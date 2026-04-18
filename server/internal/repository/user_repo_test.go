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

func TestUserRepository_GetByEmail(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: false,
	}

	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)
	require.NotEmpty(t, createdUser.ID)

	tests := []struct {
		name    string
		email   string
		wantErr bool
	}{
		{
			name:    "existing email",
			email:   "test@example.com",
			wantErr: false,
		},
		{
			name:    "non-existing email",
			email:   "nonexistent@example.com",
			wantErr: true,
		},
		{
			name:    "empty email",
			email:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			foundUser, err := userRepo.GetByEmail(ctx, tt.email)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, foundUser)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, foundUser)
				assert.Equal(t, tt.email, foundUser.Email)
				assert.Equal(t, createdUser.ID, foundUser.ID)
			}
		})
	}
}

func TestUserRepository_UpdatePasswordHash(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: false,
	}

	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	tests := []struct {
		name         string
		userID       string
		passwordHash string
		wantErr      bool
	}{
		{
			name:         "valid password hash update",
			userID:       createdUser.ID,
			passwordHash: "$2a$12$hashedpassword",
			wantErr:      false,
		},
		{
			name:         "non-existing user",
			userID:       "non-existent-id",
			passwordHash: "$2a$12$hashedpassword",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := userRepo.UpdatePasswordHash(ctx, tt.userID, tt.passwordHash)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the password hash was updated
				updatedUser, err := userRepo.GetByID(ctx, tt.userID)
				require.NoError(t, err)
				assert.NotNil(t, updatedUser.PasswordHash)
				assert.Equal(t, tt.passwordHash, *updatedUser.PasswordHash)
			}
		})
	}
}

func TestUserRepository_UpdateEmailVerified(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: false,
	}

	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	tests := []struct {
		name     string
		userID   string
		verified bool
		wantErr  bool
	}{
		{
			name:     "verify email",
			userID:   createdUser.ID,
			verified: true,
			wantErr:  false,
		},
		{
			name:     "unverify email",
			userID:   createdUser.ID,
			verified: false,
			wantErr:  false,
		},
		{
			name:     "non-existing user",
			userID:   "non-existent-id",
			verified: true,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := userRepo.UpdateEmailVerified(ctx, tt.userID, tt.verified)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the email verification status was updated
				updatedUser, err := userRepo.GetByID(ctx, tt.userID)
				require.NoError(t, err)
				assert.Equal(t, tt.verified, updatedUser.EmailVerified)
			}
		})
	}
}

func TestUserRepository_IncrementFailedLoginCount(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email:            "test@example.com",
		Name:             "Test User",
		EmailVerified:    false,
		FailedLoginCount: 0,
	}

	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	tests := []struct {
		name          string
		userID        string
		initialCount  int
		expectedCount int
		expectLocked  bool
		wantErr       bool
	}{
		{
			name:          "first failed login",
			userID:        createdUser.ID,
			initialCount:  0,
			expectedCount: 1,
			expectLocked:  false,
			wantErr:       false,
		},
		{
			name:          "fifth failed login should lock account",
			userID:        createdUser.ID,
			initialCount:  4,
			expectedCount: 5,
			expectLocked:  true,
			wantErr:       false,
		},
		{
			name:    "non-existing user",
			userID:  "non-existent-id",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set initial failed login count
			if !tt.wantErr {
				_, err := userRepo.GetDB().NewUpdate().
					Model((*model.User)(nil)).
					Set("failed_login_count = ?", tt.initialCount).
					Where("id = ?", tt.userID).
					Exec(ctx)
				require.NoError(t, err)
			}

			err := userRepo.IncrementFailedLoginCount(ctx, tt.userID, 5)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the failed login count was incremented
				updatedUser, err := userRepo.GetByID(ctx, tt.userID)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedCount, updatedUser.FailedLoginCount)

				if tt.expectLocked {
					assert.NotNil(t, updatedUser.LockedUntil)
					assert.True(t, updatedUser.LockedUntil.After(time.Now()))
				}
			}
		})
	}
}

func TestUserRepository_ResetFailedLoginCount(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test user with failed logins and locked account
	lockTime := time.Now().Add(time.Hour)
	user := &model.User{
		Email:            "test@example.com",
		Name:             "Test User",
		EmailVerified:    false,
		FailedLoginCount: 5,
		LockedUntil:      &lockTime,
	}

	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	tests := []struct {
		name    string
		userID  string
		wantErr bool
	}{
		{
			name:    "reset failed login count",
			userID:  createdUser.ID,
			wantErr: false,
		},
		{
			name:    "non-existing user",
			userID:  "non-existent-id",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := userRepo.ResetFailedLoginCount(ctx, tt.userID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the failed login count was reset and account unlocked
				updatedUser, err := userRepo.GetByID(ctx, tt.userID)
				require.NoError(t, err)
				assert.Equal(t, 0, updatedUser.FailedLoginCount)
				assert.Nil(t, updatedUser.LockedUntil)
			}
		})
	}
}

func TestUserRepository_LockAccount(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test user
	user := &model.User{
		Email:         "test@example.com",
		Name:          "Test User",
		EmailVerified: false,
	}

	createdUser, err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	lockUntil := time.Now().Add(time.Hour)

	tests := []struct {
		name      string
		userID    string
		lockUntil time.Time
		wantErr   bool
	}{
		{
			name:      "lock account",
			userID:    createdUser.ID,
			lockUntil: lockUntil,
			wantErr:   false,
		},
		{
			name:      "non-existing user",
			userID:    "non-existent-id",
			lockUntil: lockUntil,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := userRepo.LockAccount(ctx, tt.userID, tt.lockUntil)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the account was locked
				updatedUser, err := userRepo.GetByID(ctx, tt.userID)
				require.NoError(t, err)
				assert.NotNil(t, updatedUser.LockedUntil)
				assert.True(t, updatedUser.LockedUntil.Equal(tt.lockUntil) || updatedUser.LockedUntil.After(tt.lockUntil.Add(-time.Second)))
			}
		})
	}
}

func TestUserRepository_GetLockedUsers(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test users - one locked, one unlocked, one with expired lock
	futureTime := time.Now().Add(time.Hour)
	pastTime := time.Now().Add(-time.Hour)

	lockedUser := &model.User{
		Email:       "locked@example.com",
		Name:        "Locked User",
		LockedUntil: &futureTime,
	}

	unlockedUser := &model.User{
		Email: "unlocked@example.com",
		Name:  "Unlocked User",
	}

	expiredLockUser := &model.User{
		Email:       "expired@example.com",
		Name:        "Expired Lock User",
		LockedUntil: &pastTime,
	}

	_, err := userRepo.Create(ctx, lockedUser)
	require.NoError(t, err)
	_, err = userRepo.Create(ctx, unlockedUser)
	require.NoError(t, err)
	_, err = userRepo.Create(ctx, expiredLockUser)
	require.NoError(t, err)

	// Get locked users
	lockedUsers, err := userRepo.GetLockedUsers(ctx)
	require.NoError(t, err)

	// Should only return the currently locked user
	assert.Len(t, lockedUsers, 1)
	assert.Equal(t, "locked@example.com", lockedUsers[0].Email)
}

func TestUserRepository_GetUsersWithFailedLogins(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	testDB.CleanupTables(ctx)

	userRepo := NewUserRepository(testDB.DB)

	// Create test users with different failed login counts
	user1 := &model.User{
		Email:            "user1@example.com",
		Name:             "User 1",
		FailedLoginCount: 3,
	}

	user2 := &model.User{
		Email:            "user2@example.com",
		Name:             "User 2",
		FailedLoginCount: 5,
	}

	user3 := &model.User{
		Email:            "user3@example.com",
		Name:             "User 3",
		FailedLoginCount: 1,
	}

	_, err := userRepo.Create(ctx, user1)
	require.NoError(t, err)
	_, err = userRepo.Create(ctx, user2)
	require.NoError(t, err)
	_, err = userRepo.Create(ctx, user3)
	require.NoError(t, err)

	// Get users with failed logins >= 3
	usersWithFailedLogins, err := userRepo.GetUsersWithFailedLogins(ctx, 3)
	require.NoError(t, err)

	// Should return user1 and user2
	assert.Len(t, usersWithFailedLogins, 2)

	emails := make([]string, len(usersWithFailedLogins))
	for i, user := range usersWithFailedLogins {
		emails[i] = user.Email
	}
	assert.Contains(t, emails, "user1@example.com")
	assert.Contains(t, emails, "user2@example.com")
	assert.NotContains(t, emails, "user3@example.com")
}
