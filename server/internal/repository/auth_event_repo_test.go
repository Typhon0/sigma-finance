package repository

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthEventRepository_Create(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	testDB.CleanupTables(context.Background()) // Clean up before test
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	t.Run("creates valid auth event", func(t *testing.T) {
		userID := "550e8400-e29b-41d4-a716-446655440000" // Valid UUID format
		event := model.NewAuthEvent(
			&userID,
			"user@example.com",
			model.AuthActionLogin,
			true,
			"192.168.1.1",
			"Mozilla/5.0",
			map[string]interface{}{"test": "data"},
		)

		err := repo.Create(ctx, event)
		assert.NoError(t, err)
		assert.NotEmpty(t, event.ID)
		assert.False(t, event.CreatedAt.IsZero())
	})

	t.Run("validates event before creation", func(t *testing.T) {
		// Create invalid event (missing action)
		event := &model.AuthEvent{
			Email:     "user@example.com",
			Success:   true,
			IPAddress: "192.168.1.1",
			UserAgent: "Mozilla/5.0",
		}

		err := repo.Create(ctx, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Action is required")
	})

	t.Run("creates event without user ID", func(t *testing.T) {
		// Security events might not have a user ID but still need an email or identifier
		event := model.NewAuthEvent(
			nil,
			"security@system.local",     // Provide a system email for security events
			model.AuthActionAccountLock, // Use a valid action type
			false,
			"192.168.1.1",
			"Mozilla/5.0",
			map[string]interface{}{"endpoint": "/api/login"},
		)

		err := repo.Create(ctx, event)
		assert.NoError(t, err)
		assert.NotEmpty(t, event.ID)
	})
}

func TestAuthEventRepository_GetByID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	t.Run("retrieves existing event", func(t *testing.T) {
		// Create an event first
		userID := "550e8400-e29b-41d4-a716-446655440000"
		originalEvent := model.NewAuthEvent(
			&userID,
			"user@example.com",
			model.AuthActionLogin,
			true,
			"192.168.1.1",
			"Mozilla/5.0",
			map[string]interface{}{"test": "data"},
		)

		err := repo.Create(ctx, originalEvent)
		require.NoError(t, err)

		// Retrieve the event
		retrievedEvent, err := repo.GetByID(ctx, originalEvent.ID)
		assert.NoError(t, err)
		assert.Equal(t, originalEvent.ID, retrievedEvent.ID)
		assert.Equal(t, originalEvent.Email, retrievedEvent.Email)
		assert.Equal(t, originalEvent.Action, retrievedEvent.Action)
		assert.Equal(t, originalEvent.Success, retrievedEvent.Success)
	})

	t.Run("returns error for non-existent event", func(t *testing.T) {
		_, err := repo.GetByID(ctx, "non-existent-id")
		assert.Error(t, err)
	})
}

func TestAuthEventRepository_GetByUserID(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	testDB.CleanupTables(context.Background()) // Clean up before test
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	userID := "550e8400-e29b-41d4-a716-446655440000"

	// Create multiple events for the user
	events := []*model.AuthEvent{
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil),
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogout, true, "192.168.1.1", "Mozilla/5.0", nil),
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, false, "192.168.1.2", "Mozilla/5.0", nil),
	}

	for _, event := range events {
		err := repo.Create(ctx, event)
		require.NoError(t, err)
	}

	t.Run("retrieves events for user", func(t *testing.T) {
		retrievedEvents, err := repo.GetByUserID(ctx, userID, 10, 0)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 3)

		// Should be ordered by created_at DESC
		assert.True(t, retrievedEvents[0].CreatedAt.After(retrievedEvents[1].CreatedAt) ||
			retrievedEvents[0].CreatedAt.Equal(retrievedEvents[1].CreatedAt))
	})

	t.Run("respects limit and offset", func(t *testing.T) {
		// Get first 2 events
		retrievedEvents, err := repo.GetByUserID(ctx, userID, 2, 0)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 2)

		// Get next event with offset
		retrievedEvents, err = repo.GetByUserID(ctx, userID, 2, 2)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 1)
	})

	t.Run("returns empty for non-existent user", func(t *testing.T) {
		nonExistentUserID := "550e8400-e29b-41d4-a716-446655440999" // Valid UUID format
		retrievedEvents, err := repo.GetByUserID(ctx, nonExistentUserID, 10, 0)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 0)
	})
}

func TestAuthEventRepository_GetByEmail(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	email := "user@example.com"
	userID := "550e8400-e29b-41d4-a716-446655440000"

	// Create events for the email
	events := []*model.AuthEvent{
		model.NewAuthEvent(&userID, email, model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil),
		model.NewAuthEvent(&userID, email, model.AuthActionRegister, true, "192.168.1.1", "Mozilla/5.0", nil),
	}

	for _, event := range events {
		err := repo.Create(ctx, event)
		require.NoError(t, err)
	}

	t.Run("retrieves events for email", func(t *testing.T) {
		retrievedEvents, err := repo.GetByEmail(ctx, email, 10, 0)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 2)

		for _, event := range retrievedEvents {
			assert.Equal(t, email, event.Email)
		}
	})
}

func TestAuthEventRepository_GetByIPAddress(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	ipAddress := "192.168.1.1"
	userID := "550e8400-e29b-41d4-a716-446655440000"
	since := time.Now().Add(-1 * time.Hour)

	// Create events from the IP
	events := []*model.AuthEvent{
		model.NewAuthEvent(&userID, "user1@example.com", model.AuthActionLogin, true, ipAddress, "Mozilla/5.0", nil),
		model.NewAuthEvent(&userID, "user2@example.com", model.AuthActionLogin, false, ipAddress, "Mozilla/5.0", nil),
	}

	for _, event := range events {
		err := repo.Create(ctx, event)
		require.NoError(t, err)
	}

	t.Run("retrieves events for IP address", func(t *testing.T) {
		retrievedEvents, err := repo.GetByIPAddress(ctx, ipAddress, since, 10)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 2)

		for _, event := range retrievedEvents {
			assert.Equal(t, ipAddress, event.IPAddress)
		}
	})

	t.Run("respects time filter", func(t *testing.T) {
		// Query for events since future time (should return none)
		futureTime := time.Now().Add(1 * time.Hour)
		retrievedEvents, err := repo.GetByIPAddress(ctx, ipAddress, futureTime, 10)
		assert.NoError(t, err)
		assert.Len(t, retrievedEvents, 0)
	})
}

func TestAuthEventRepository_GetFailedLoginAttempts(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	email := "user@example.com"
	userID := "550e8400-e29b-41d4-a716-446655440000"
	since := time.Now().Add(-15 * time.Minute)

	// Create mix of successful and failed login attempts
	events := []*model.AuthEvent{
		model.NewAuthEvent(&userID, email, model.AuthActionLogin, false, "192.168.1.1", "Mozilla/5.0", nil),    // Failed
		model.NewAuthEvent(&userID, email, model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil),     // Success
		model.NewAuthEvent(&userID, email, model.AuthActionLogin, false, "192.168.1.1", "Mozilla/5.0", nil),    // Failed
		model.NewAuthEvent(&userID, email, model.AuthActionRegister, false, "192.168.1.1", "Mozilla/5.0", nil), // Failed but not login
	}

	for _, event := range events {
		err := repo.Create(ctx, event)
		require.NoError(t, err)
	}

	t.Run("retrieves only failed login attempts", func(t *testing.T) {
		failedAttempts, err := repo.GetFailedLoginAttempts(ctx, email, since)
		assert.NoError(t, err)
		assert.Len(t, failedAttempts, 2) // Only the 2 failed login attempts

		for _, attempt := range failedAttempts {
			assert.Equal(t, email, attempt.Email)
			assert.Equal(t, model.AuthActionLogin, attempt.Action)
			assert.False(t, attempt.Success)
		}
	})
}

func TestAuthEventRepository_GetSuspiciousActivity(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	userID := "550e8400-e29b-41d4-a716-446655440000"
	since := time.Now().Add(-1 * time.Hour)

	// Create various types of events
	events := []*model.AuthEvent{
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, false, "192.168.1.1", "Mozilla/5.0", nil),         // Suspicious
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil),          // Normal
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionPasswordReset, false, "192.168.1.1", "Mozilla/5.0", nil), // Suspicious
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionAccountLock, true, "192.168.1.1", "Mozilla/5.0", nil),    // Suspicious
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogout, true, "192.168.1.1", "Mozilla/5.0", nil),         // Normal
	}

	for _, event := range events {
		err := repo.Create(ctx, event)
		require.NoError(t, err)
	}

	t.Run("retrieves suspicious activity", func(t *testing.T) {
		suspiciousEvents, err := repo.GetSuspiciousActivity(ctx, since, 10)
		assert.NoError(t, err)
		assert.Len(t, suspiciousEvents, 3) // Failed login, failed password reset, account lock

		// Verify the types of suspicious events
		actionCounts := make(map[string]int)
		for _, event := range suspiciousEvents {
			if event.Action == model.AuthActionLogin || event.Action == model.AuthActionPasswordReset {
				assert.False(t, event.Success, "Failed login/password reset should be unsuccessful")
			} else if event.Action == model.AuthActionAccountLock {
				assert.True(t, event.Success, "Account lock should be successful")
			}
			actionCounts[event.Action]++
		}

		assert.Equal(t, 1, actionCounts[model.AuthActionLogin])
		assert.Equal(t, 1, actionCounts[model.AuthActionPasswordReset])
		assert.Equal(t, 1, actionCounts[model.AuthActionAccountLock])
	})
}

func TestAuthEventRepository_DeleteOldEvents(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	userID := "550e8400-e29b-41d4-a716-446655440000"

	// Create events with different timestamps
	oldEvent := model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil)
	oldEvent.CreatedAt = time.Now().Add(-2 * time.Hour) // 2 hours ago

	recentEvent := model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil)
	recentEvent.CreatedAt = time.Now().Add(-30 * time.Minute) // 30 minutes ago

	// Insert events with custom timestamps
	_, err := testDB.DB.NewInsert().Model(oldEvent).Exec(ctx)
	require.NoError(t, err)

	_, err = testDB.DB.NewInsert().Model(recentEvent).Exec(ctx)
	require.NoError(t, err)

	t.Run("deletes old events", func(t *testing.T) {
		// Delete events older than 1 hour
		cutoffTime := time.Now().Add(-1 * time.Hour)
		deletedCount, err := repo.DeleteOldEvents(ctx, cutoffTime)
		assert.NoError(t, err)
		assert.Equal(t, int64(1), deletedCount) // Should delete only the old event

		// Verify the recent event still exists
		events, err := repo.GetByUserID(ctx, userID, 10, 0)
		assert.NoError(t, err)
		assert.Len(t, events, 1)
		assert.Equal(t, recentEvent.ID, events[0].ID)
	})
}

func TestAuthEventRepository_GetByAction(t *testing.T) {
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()
	repo := NewAuthEventRepository(testDB.DB)
	ctx := context.Background()

	userID := "550e8400-e29b-41d4-a716-446655440000"
	since := time.Now().Add(-1 * time.Hour)

	// Create events with different actions
	events := []*model.AuthEvent{
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, true, "192.168.1.1", "Mozilla/5.0", nil),
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionLogin, false, "192.168.1.1", "Mozilla/5.0", nil),
		model.NewAuthEvent(&userID, "user@example.com", model.AuthActionRegister, true, "192.168.1.1", "Mozilla/5.0", nil),
	}

	for _, event := range events {
		err := repo.Create(ctx, event)
		require.NoError(t, err)
	}

	t.Run("retrieves events by action", func(t *testing.T) {
		loginEvents, err := repo.GetByAction(ctx, model.AuthActionLogin, since, 10)
		assert.NoError(t, err)
		assert.Len(t, loginEvents, 2) // Both login events

		for _, event := range loginEvents {
			assert.Equal(t, model.AuthActionLogin, event.Action)
		}

		registerEvents, err := repo.GetByAction(ctx, model.AuthActionRegister, since, 10)
		assert.NoError(t, err)
		assert.Len(t, registerEvents, 1) // Only the register event

		assert.Equal(t, model.AuthActionRegister, registerEvents[0].Action)
	})
}
