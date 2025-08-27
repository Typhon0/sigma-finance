package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock AuthEventRepository for testing
type MockAuthEventRepository struct {
	mock.Mock
}

func (m *MockAuthEventRepository) Create(ctx context.Context, event *model.AuthEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockAuthEventRepository) GetByID(ctx context.Context, id string) (*model.AuthEvent, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) GetByUserID(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) GetByEmail(ctx context.Context, email string, limit int, offset int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, email, limit, offset)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) GetByIPAddress(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, ipAddress, since, limit)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) GetByAction(ctx context.Context, action string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, action, since, limit)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) GetFailedLoginAttempts(ctx context.Context, email string, since time.Time) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, email, since)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) GetSuspiciousActivity(ctx context.Context, since time.Time, limit int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, since, limit)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuthEventRepository) DeleteOldEvents(ctx context.Context, olderThan time.Time) (int64, error) {
	args := m.Called(ctx, olderThan)
	return args.Get(0).(int64), args.Error(1)
}

func TestAuditService_LogAuthEvent(t *testing.T) {
	mockRepo := &MockAuthEventRepository{}
	auditService := NewAuditService(mockRepo)
	ctx := context.Background()

	t.Run("logs valid auth event", func(t *testing.T) {
		userID := "user-123"
		event := model.NewAuthEvent(
			&userID,
			"user@example.com",
			model.AuthActionLogin,
			true,
			"192.168.1.1",
			"Mozilla/5.0",
			map[string]interface{}{"test": "data"},
		)

		mockRepo.On("Create", ctx, event).Return(nil)

		err := auditService.LogAuthEvent(ctx, event)
		assert.NoError(t, err)

		mockRepo.AssertExpectations(t)
	})

	t.Run("validates auth event before logging", func(t *testing.T) {
		// Create invalid event (missing action)
		event := &model.AuthEvent{
			Email:     "user@example.com",
			Success:   true,
			IPAddress: "192.168.1.1",
			UserAgent: "Mozilla/5.0",
		}

		err := auditService.LogAuthEvent(ctx, event)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Action is required")

		// Should not call repository for invalid event
		mockRepo.AssertNotCalled(t, "Create")
	})
}

func TestAuditService_LogSecurityEvent(t *testing.T) {
	mockRepo := &MockAuthEventRepository{}
	auditService := NewAuditService(mockRepo)
	ctx := context.Background()

	t.Run("logs security event", func(t *testing.T) {
		eventType := "RATE_LIMIT_EXCEEDED"
		ipAddress := "192.168.1.1"
		userAgent := "Mozilla/5.0"
		metadata := map[string]interface{}{
			"endpoint": "/api/login",
			"attempts": 5,
		}

		mockRepo.On("Create", ctx, mock.MatchedBy(func(event *model.AuthEvent) bool {
			return event.Action == eventType &&
				event.IPAddress == ipAddress &&
				event.UserAgent == userAgent &&
				!event.Success
		})).Return(nil)

		err := auditService.LogSecurityEvent(ctx, eventType, ipAddress, userAgent, metadata)
		assert.NoError(t, err)

		mockRepo.AssertExpectations(t)
	})
}

func TestAuditService_GetAuthEvents(t *testing.T) {
	mockRepo := &MockAuthEventRepository{}
	auditService := NewAuditService(mockRepo)
	ctx := context.Background()

	t.Run("retrieves auth events for user", func(t *testing.T) {
		userID := "user-123"
		limit := 10
		offset := 0

		expectedEvents := []*model.AuthEvent{
			{
				ID:      "event-1",
				UserID:  &userID,
				Email:   "user@example.com",
				Action:  model.AuthActionLogin,
				Success: true,
			},
		}

		mockRepo.On("GetByUserID", ctx, userID, limit, offset).Return(expectedEvents, nil)

		events, err := auditService.GetAuthEvents(ctx, userID, limit, offset)
		assert.NoError(t, err)
		assert.Equal(t, expectedEvents, events)

		mockRepo.AssertExpectations(t)
	})
}

func TestAuditService_GetSecurityEvents(t *testing.T) {
	mockRepo := &MockAuthEventRepository{}
	auditService := NewAuditService(mockRepo)
	ctx := context.Background()

	t.Run("retrieves security events by IP", func(t *testing.T) {
		ipAddress := "192.168.1.1"
		since := time.Now().Add(-24 * time.Hour)
		limit := 50

		expectedEvents := []*model.AuthEvent{
			{
				ID:        "event-1",
				Action:    "RATE_LIMIT_EXCEEDED",
				Success:   false,
				IPAddress: ipAddress,
			},
		}

		mockRepo.On("GetByIPAddress", ctx, ipAddress, since, limit).Return(expectedEvents, nil)

		events, err := auditService.GetSecurityEvents(ctx, ipAddress, since, limit)
		assert.NoError(t, err)
		assert.Equal(t, expectedEvents, events)

		mockRepo.AssertExpectations(t)
	})
}

func TestCreateAuthEventHelpers(t *testing.T) {
	userID := "user-123"
	email := "user@example.com"
	ipAddress := "192.168.1.1"
	userAgent := "Mozilla/5.0"
	metadata := map[string]interface{}{"test": "data"}

	t.Run("CreateLoginEvent", func(t *testing.T) {
		event := CreateLoginEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionLogin, event.Action)
		assert.True(t, event.Success)
		assert.Equal(t, ipAddress, event.IPAddress)
		assert.Equal(t, userAgent, event.UserAgent)
	})

	t.Run("CreateRegisterEvent", func(t *testing.T) {
		event := CreateRegisterEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionRegister, event.Action)
		assert.True(t, event.Success)
	})

	t.Run("CreateLogoutEvent", func(t *testing.T) {
		event := CreateLogoutEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionLogout, event.Action)
		assert.True(t, event.Success)
	})

	t.Run("CreatePasswordResetEvent", func(t *testing.T) {
		event := CreatePasswordResetEvent(&userID, email, ipAddress, userAgent, false, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionPasswordReset, event.Action)
		assert.False(t, event.Success)
	})

	t.Run("CreateEmailVerifyEvent", func(t *testing.T) {
		event := CreateEmailVerifyEvent(&userID, email, ipAddress, userAgent, true, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionEmailVerify, event.Action)
		assert.True(t, event.Success)
	})

	t.Run("CreateAccountLockEvent", func(t *testing.T) {
		event := CreateAccountLockEvent(&userID, email, ipAddress, userAgent, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionAccountLock, event.Action)
		assert.True(t, event.Success) // Lock events are always successful
	})

	t.Run("CreateAccountUnlockEvent", func(t *testing.T) {
		event := CreateAccountUnlockEvent(&userID, email, ipAddress, userAgent, metadata)

		assert.Equal(t, &userID, event.UserID)
		assert.Equal(t, email, event.Email)
		assert.Equal(t, model.AuthActionAccountUnlock, event.Action)
		assert.True(t, event.Success) // Unlock events are always successful
	})
}

func TestAuditService_Integration(t *testing.T) {
	mockRepo := &MockAuthEventRepository{}
	auditService := NewAuditService(mockRepo)
	ctx := context.Background()

	t.Run("complete audit flow for failed login", func(t *testing.T) {
		userID := "user-123"
		email := "user@example.com"
		ipAddress := "192.168.1.1"
		userAgent := "Mozilla/5.0"

		// Log failed login attempt
		loginEvent := CreateLoginEvent(&userID, email, ipAddress, userAgent, false, map[string]interface{}{
			"reason": "invalid_password",
		})

		mockRepo.On("Create", ctx, loginEvent).Return(nil)

		err := auditService.LogAuthEvent(ctx, loginEvent)
		require.NoError(t, err)

		// Log security event for suspicious activity
		mockRepo.On("Create", ctx, mock.MatchedBy(func(event *model.AuthEvent) bool {
			return event.Action == "SUSPICIOUS_LOGIN_PATTERN" &&
				event.IPAddress == ipAddress &&
				!event.Success
		})).Return(nil)

		err = auditService.LogSecurityEvent(ctx, "SUSPICIOUS_LOGIN_PATTERN", ipAddress, userAgent, map[string]interface{}{
			"failed_attempts": 3,
			"time_window":     "5 minutes",
		})
		require.NoError(t, err)

		mockRepo.AssertExpectations(t)
	})
}
