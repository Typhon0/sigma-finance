package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/uptrace/bun"
)

// MockLockoutUserRepo is a mock implementation of UserRepository for lockout testing
type MockLockoutUserRepo struct {
	mock.Mock
}

func (m *MockLockoutUserRepo) Create(ctx context.Context, entity *model.User) (*model.User, error) {
	args := m.Called(ctx, entity)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) GetByID(ctx context.Context, id uint) (model.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) Update(ctx context.Context, entity *model.User) error {
	args := m.Called(ctx, entity)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) FindOneBy(ctx context.Context, options ...repository.QueryOption) (model.User, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.User, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockLockoutUserRepo) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) DeleteByStringID(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) GetByEmailWithAuthMethods(ctx context.Context, email string) (*model.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) GetByStringID(ctx context.Context, id string) (*model.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) UpdatePasswordHash(ctx context.Context, userID string, passwordHash string) error {
	args := m.Called(ctx, userID, passwordHash)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) UpdateEmailVerified(ctx context.Context, userID string, verified bool) error {
	args := m.Called(ctx, userID, verified)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) UpdateLastLogin(ctx context.Context, userID string, loginTime time.Time, ipAddress string) error {
	args := m.Called(ctx, userID, loginTime, ipAddress)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) IncrementFailedLoginCount(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) ResetFailedLoginCount(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) LockAccount(ctx context.Context, userID string, lockUntil time.Time) error {
	args := m.Called(ctx, userID, lockUntil)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) UnlockAccount(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockLockoutUserRepo) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(int), args.Error(1)
}

func (m *MockLockoutUserRepo) GetLockedUsers(ctx context.Context) ([]model.User, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockLockoutUserRepo) GetUsersWithFailedLogins(ctx context.Context, threshold int) ([]model.User, error) {
	args := m.Called(ctx, threshold)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.User), args.Error(1)
}

// MockLockoutAuditService is a mock implementation of AuditService for lockout testing
type MockLockoutAuditService struct {
	mock.Mock
}

func (m *MockLockoutAuditService) LogAuthEvent(ctx context.Context, event *model.AuthEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockLockoutAuditService) LogSecurityEvent(ctx context.Context, eventType, ipAddress, userAgent string, metadata map[string]interface{}) error {
	args := m.Called(ctx, eventType, ipAddress, userAgent, metadata)
	return args.Error(0)
}

func (m *MockLockoutAuditService) GetAuthEvents(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, userID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockLockoutAuditService) GetSecurityEvents(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, ipAddress, since, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func TestAccountLockoutService_CheckAccountLockout(t *testing.T) {
	mockUserRepo := &MockLockoutUserRepo{}
	mockAudit := &MockLockoutAuditService{}
	rateLimiter := NewInMemoryRateLimiter()
	config := DefaultAccountLockoutConfig()

	service := NewAccountLockoutService(mockUserRepo, mockAudit, rateLimiter, config)
	ctx := context.Background()

	t.Run("account not locked", func(t *testing.T) {
		user := &model.User{
			ID:               "user1",
			Email:            "test@example.com",
			FailedLoginCount: 2,
			LockedUntil:      nil,
		}

		mockUserRepo.On("GetByStringID", ctx, "user1").Return(user, nil).Once()

		err := service.CheckAccountLockout(ctx, "user1")
		assert.NoError(t, err)

		mockUserRepo.AssertExpectations(t)
	})

	t.Run("account locked", func(t *testing.T) {
		lockUntil := time.Now().Add(time.Hour)
		user := &model.User{
			ID:               "user2",
			Email:            "test@example.com",
			FailedLoginCount: 5,
			LockedUntil:      &lockUntil,
		}

		mockUserRepo.ExpectedCalls = nil // Reset expectations
		mockUserRepo.On("GetByStringID", ctx, "user2").Return(user, nil).Once()

		err := service.CheckAccountLockout(ctx, "user2")
		assert.Error(t, err)
		assert.True(t, IsAccountLockedError(err))

		mockUserRepo.AssertExpectations(t)
	})
}

func TestAccountLockoutService_HandleFailedLogin(t *testing.T) {
	mockUserRepo := &MockLockoutUserRepo{}
	mockAudit := &MockLockoutAuditService{}
	rateLimiter := NewInMemoryRateLimiter()
	config := DefaultAccountLockoutConfig()

	service := NewAccountLockoutService(mockUserRepo, mockAudit, rateLimiter, config)
	ctx := context.Background()

	t.Run("failed login within rate limit", func(t *testing.T) {
		userID := "user1"
		email := "test@example.com"
		ipAddress := "192.168.1.1"
		userAgent := "Test-Agent"

		// User after increment (not locked yet)
		userAfter := &model.User{
			ID:               userID,
			Email:            email,
			FailedLoginCount: 3,
			LockedUntil:      nil,
		}

		mockUserRepo.On("IncrementFailedLoginCount", ctx, userID).Return(nil).Once()
		mockUserRepo.On("GetByStringID", ctx, userID).Return(userAfter, nil).Once()
		mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Once()

		err := service.HandleFailedLogin(ctx, userID, email, ipAddress, userAgent)
		assert.NoError(t, err)

		mockUserRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)
	})

	t.Run("failed login causes account lock", func(t *testing.T) {
		mockUserRepo.ExpectedCalls = nil // Reset expectations
		mockAudit.ExpectedCalls = nil

		userID := "user2"
		email := "test2@example.com"
		ipAddress := "192.168.1.2"
		userAgent := "Test-Agent"

		// User after increment (now locked)
		lockUntil := time.Now().Add(30 * time.Minute)
		userAfter := &model.User{
			ID:               userID,
			Email:            email,
			FailedLoginCount: 5,
			LockedUntil:      &lockUntil,
		}

		mockUserRepo.On("IncrementFailedLoginCount", ctx, userID).Return(nil).Once()
		mockUserRepo.On("GetByStringID", ctx, userID).Return(userAfter, nil).Once()
		mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Times(2) // Login event + lock event

		err := service.HandleFailedLogin(ctx, userID, email, ipAddress, userAgent)
		assert.Error(t, err)
		assert.True(t, IsAccountLockedError(err))

		mockUserRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)
	})
}

func TestAccountLockoutService_HandleSuccessfulLogin(t *testing.T) {
	mockUserRepo := &MockLockoutUserRepo{}
	mockAudit := &MockLockoutAuditService{}
	rateLimiter := NewInMemoryRateLimiter()
	config := DefaultAccountLockoutConfig()

	service := NewAccountLockoutService(mockUserRepo, mockAudit, rateLimiter, config)
	ctx := context.Background()

	t.Run("successful login resets counters", func(t *testing.T) {
		userID := "user1"
		email := "test@example.com"
		ipAddress := "192.168.1.1"
		userAgent := "Test-Agent"

		mockUserRepo.On("ResetFailedLoginCount", ctx, userID).Return(nil).Once()
		mockUserRepo.On("UpdateLastLogin", ctx, userID, mock.AnythingOfType("time.Time"), ipAddress).Return(nil).Once()
		mockAudit.On("LogAuthEvent", ctx, mock.AnythingOfType("*model.AuthEvent")).Return(nil).Once()

		err := service.HandleSuccessfulLogin(ctx, userID, email, ipAddress, userAgent)
		assert.NoError(t, err)

		mockUserRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)

		// Verify rate limit was reset
		loginKey := LoginRateLimitKey(email)
		attempts, err := rateLimiter.GetAttempts(ctx, loginKey)
		assert.NoError(t, err)
		assert.Equal(t, 0, attempts)
	})
}

func TestAccountLockedError(t *testing.T) {
	t.Run("error message without lock time", func(t *testing.T) {
		err := NewAccountLockedError(nil)
		assert.Equal(t, "account is locked", err.Error())
		assert.True(t, IsAccountLockedError(err))
	})

	t.Run("error message with lock time", func(t *testing.T) {
		lockUntil := time.Now().Add(time.Hour)
		err := NewAccountLockedError(&lockUntil)
		assert.Contains(t, err.Error(), "account is locked until")
		assert.True(t, IsAccountLockedError(err))
	})

	t.Run("IsAccountLockedError with other error", func(t *testing.T) {
		err := assert.AnError
		assert.False(t, IsAccountLockedError(err))
	})
}

func TestDefaultAccountLockoutConfig(t *testing.T) {
	config := DefaultAccountLockoutConfig()

	assert.Equal(t, 5, config.MaxFailedAttempts)
	assert.Equal(t, 30*time.Minute, config.LockoutDuration)
	assert.Equal(t, 15*time.Minute, config.RateLimitWindow)
}
