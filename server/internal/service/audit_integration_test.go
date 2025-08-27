package service

import (
	"context"
	"testing"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"
	"sigma_finance/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditService_AuthenticationEventsIntegration(t *testing.T) {
	// Setup test database
	testDB := testutil.NewTestDB(t)
	defer testDB.Close()

	ctx := context.Background()
	defer testDB.CleanupTables(ctx)

	// Create repositories
	authEventRepo := repository.NewAuthEventRepository(testDB.DB)
	auditService := NewAuditService(authEventRepo)

	t.Run("logs standard authentication events", func(t *testing.T) {
		userID := "550e8400-e29b-41d4-a716-446655440000" // Valid UUID format
		email := "test@example.com"
		ipAddress := "192.168.1.1"
		userAgent := "Mozilla/5.0 Test Browser"

		// Test successful login event
		loginEvent := CreateLoginEvent(&userID, email, ipAddress, userAgent, true, map[string]interface{}{
			"user_id": userID,
		})

		err := auditService.LogAuthEvent(ctx, loginEvent)
		require.NoError(t, err)

		// Test failed login event
		failedLoginEvent := CreateLoginEvent(&userID, email, ipAddress, userAgent, false, map[string]interface{}{
			"reason": "invalid_password",
		})

		err = auditService.LogAuthEvent(ctx, failedLoginEvent)
		require.NoError(t, err)

		// Test registration event
		registerEvent := CreateRegisterEvent(&userID, email, ipAddress, userAgent, true, map[string]interface{}{
			"user_id": userID,
		})

		err = auditService.LogAuthEvent(ctx, registerEvent)
		require.NoError(t, err)

		// Test password reset event
		resetEvent := CreatePasswordResetEvent(&userID, email, ipAddress, userAgent, true, map[string]interface{}{
			"action": "request",
		})

		err = auditService.LogAuthEvent(ctx, resetEvent)
		require.NoError(t, err)

		// Test email verification event
		verifyEvent := CreateEmailVerifyEvent(&userID, email, ipAddress, userAgent, true, map[string]interface{}{
			"user_id": userID,
		})

		err = auditService.LogAuthEvent(ctx, verifyEvent)
		require.NoError(t, err)

		// Test account lock event
		lockEvent := CreateAccountLockEvent(&userID, email, ipAddress, userAgent, map[string]interface{}{
			"reason": "too_many_failed_attempts",
		})

		err = auditService.LogAuthEvent(ctx, lockEvent)
		require.NoError(t, err)

		// Test account unlock event
		unlockEvent := CreateAccountUnlockEvent(&userID, email, ipAddress, userAgent, map[string]interface{}{
			"admin_user_id": "admin-123",
		})

		err = auditService.LogAuthEvent(ctx, unlockEvent)
		require.NoError(t, err)

		// Retrieve events for user
		events, err := auditService.GetAuthEvents(ctx, userID, 10, 0)
		require.NoError(t, err)
		assert.Len(t, events, 7) // Should have all 7 events

		// Verify we have all expected event types
		eventTypes := make(map[string]int)
		for _, event := range events {
			eventTypes[event.Action]++
			assert.Equal(t, email, event.Email)
			assert.Equal(t, ipAddress, event.IPAddress)
			assert.Equal(t, userAgent, event.UserAgent)
		}

		assert.Equal(t, 2, eventTypes[model.AuthActionLogin]) // 1 success + 1 failure
		assert.Equal(t, 1, eventTypes[model.AuthActionRegister])
		assert.Equal(t, 1, eventTypes[model.AuthActionPasswordReset])
		assert.Equal(t, 1, eventTypes[model.AuthActionEmailVerify])
		assert.Equal(t, 1, eventTypes[model.AuthActionAccountLock])
		assert.Equal(t, 1, eventTypes[model.AuthActionAccountUnlock])
	})

	t.Run("retrieves events by email", func(t *testing.T) {
		email := "email-test@example.com"
		userID := "550e8400-e29b-41d4-a716-446655440001"

		// Create a few events for this email
		for i := 0; i < 3; i++ {
			event := CreateLoginEvent(&userID, email, "192.168.1.1", "Test Browser", i%2 == 0, map[string]interface{}{
				"attempt": i,
			})
			err := auditService.LogAuthEvent(ctx, event)
			require.NoError(t, err)
		}

		// Retrieve events by email using the repository directly (since GetByEmail is not exposed in service)
		events, err := authEventRepo.GetByEmail(ctx, email, 10, 0)
		require.NoError(t, err)
		assert.Len(t, events, 3)

		for _, event := range events {
			assert.Equal(t, email, event.Email)
			assert.Equal(t, model.AuthActionLogin, event.Action)
		}
	})
}

func TestAuditService_HelperFunctions(t *testing.T) {
	userID := "550e8400-e29b-41d4-a716-446655440000"
	email := "helper-test@example.com"
	ipAddress := "10.0.0.1"
	userAgent := "Helper Test Browser"
	metadata := map[string]interface{}{"test": "data"}

	t.Run("CreateLoginEvent creates valid login event", func(t *testing.T) {
		event := CreateLoginEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionLogin, event.Action)
		assert.True(t, event.Success)
		assert.Equal(t, ipAddress, event.IPAddress)
		assert.Equal(t, userAgent, event.UserAgent)

		// Validate the event
		err := event.Validate()
		assert.NoError(t, err)
	})

	t.Run("CreateRegisterEvent creates valid register event", func(t *testing.T) {
		event := CreateRegisterEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionRegister, event.Action)
		assert.True(t, event.Success)

		// Validate the event
		err := event.Validate()
		assert.NoError(t, err)
	})

	t.Run("CreatePasswordResetEvent creates valid password reset event", func(t *testing.T) {
		event := CreatePasswordResetEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionPasswordReset, event.Action)
		assert.True(t, event.Success)

		// Validate the event
		err := event.Validate()
		assert.NoError(t, err)
	})

	t.Run("CreateEmailVerifyEvent creates valid email verify event", func(t *testing.T) {
		event := CreateEmailVerifyEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionEmailVerify, event.Action)
		assert.True(t, event.Success)

		// Validate the event
		err := event.Validate()
		assert.NoError(t, err)
	})

	t.Run("CreateAccountLockEvent creates valid account lock event", func(t *testing.T) {
		event := CreateAccountLockEvent(&userID, email, ipAddress, userAgent, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionAccountLock, event.Action)
		assert.True(t, event.Success) // Lock events are always successful

		// Validate the event
		err := event.Validate()
		assert.NoError(t, err)
	})

	t.Run("CreateAccountUnlockEvent creates valid account unlock event", func(t *testing.T) {
		event := CreateAccountUnlockEvent(&userID, email, ipAddress, userAgent, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionAccountUnlock, event.Action)
		assert.True(t, event.Success) // Unlock events are always successful

		// Validate the event
		err := event.Validate()
		assert.NoError(t, err)
	})
}
