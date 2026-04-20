package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"
	"sigma_finance/internal/repository"

	"github.com/stretchr/testify/mock"
	"github.com/uptrace/bun"
)

// Shared mock implementations for testing

// MockUserRepository is a mock implementation of UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, user *model.User) (*model.User, error) {
	args := m.Called(ctx, user)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

// CreateSimple is for the LocalAuthProvider interface
func (m *MockUserRepository) CreateSimple(ctx context.Context, user *model.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Update(ctx context.Context, user *model.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

// UpdateSimple is for the LocalAuthProvider interface
func (m *MockUserRepository) UpdateSimple(ctx context.Context, user *model.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

// MockLocalUserRepository is a mock for the LocalAuthProvider's UserRepository interface
type MockLocalUserRepository struct {
	mock.Mock
}

func (m *MockLocalUserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockLocalUserRepository) Create(ctx context.Context, user *model.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockLocalUserRepository) Update(ctx context.Context, user *model.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) DeleteByStringID(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) GetAll(ctx context.Context) ([]model.User, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmailWithAuthMethods(ctx context.Context, email string) (*model.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) GetByStringID(ctx context.Context, id string) (*model.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) UpdatePasswordHash(ctx context.Context, userID string, passwordHash string) error {
	args := m.Called(ctx, userID, passwordHash)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateEmailVerified(ctx context.Context, userID string, verified bool) error {
	args := m.Called(ctx, userID, verified)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateLastLogin(ctx context.Context, userID string, loginTime time.Time, ipAddress string) error {
	args := m.Called(ctx, userID, loginTime, ipAddress)
	return args.Error(0)
}

func (m *MockUserRepository) IncrementFailedLoginCount(ctx context.Context, userID string, maxFailedAttempts int) error {
	args := m.Called(ctx, userID, maxFailedAttempts)
	return args.Error(0)
}

func (m *MockUserRepository) ResetFailedLoginCount(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserRepository) LockAccount(ctx context.Context, userID string, lockUntil time.Time) error {
	args := m.Called(ctx, userID, lockUntil)
	return args.Error(0)
}

func (m *MockUserRepository) UnlockAccount(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserRepository) GetLockedUsers(ctx context.Context) ([]model.User, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockUserRepository) GetUsersWithFailedLogins(ctx context.Context, threshold int) ([]model.User, error) {
	args := m.Called(ctx, threshold)
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockUserRepository) UpdateDisplayCurrency(ctx context.Context, userID string, currency model.Currency) error {
	args := m.Called(ctx, userID, currency)
	return args.Error(0)
}

// IRepository interface methods
func (m *MockUserRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockUserRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (*model.User, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.User, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.User), args.Error(1)
}

func (m *MockUserRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

// MockSecurityService is a mock implementation of SecurityService
type MockSecurityService struct {
	mock.Mock
}

func (m *MockSecurityService) HashPassword(password string) (string, error) {
	args := m.Called(password)
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) VerifyPassword(password, hash string) error {
	args := m.Called(password, hash)
	return args.Error(0)
}

func (m *MockSecurityService) GenerateJWT(userID string, expiresAt time.Time) (string, error) {
	args := m.Called(userID, expiresAt)
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) ValidateJWT(token string) (*JWTClaims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*JWTClaims), args.Error(1)
}

func (m *MockSecurityService) GenerateSecureToken() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) error {
	args := m.Called(ctx, key, limit, window)
	return args.Error(0)
}

func (m *MockSecurityService) ResetRateLimit(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockSecurityService) GetRateLimitAttempts(ctx context.Context, key string) (int, error) {
	args := m.Called(ctx, key)
	return args.Int(0), args.Error(1)
}

func (m *MockSecurityService) DecryptString(encrypted string) (string, error) {
	args := m.Called(encrypted)
	return args.String(0), args.Error(1)
}

func (m *MockSecurityService) EncryptString(plaintext string) (string, error) {
	args := m.Called(plaintext)
	return args.String(0), args.Error(1)
}

// MockAuditService is a mock implementation of AuditService
type MockAuditService struct {
	mock.Mock
}

func (m *MockAuditService) LogAuthEvent(ctx context.Context, event *model.AuthEvent) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockAuditService) LogSecurityEvent(ctx context.Context, eventType, ipAddress, userAgent string, metadata map[string]interface{}) error {
	args := m.Called(ctx, eventType, ipAddress, userAgent, metadata)
	return args.Error(0)
}

func (m *MockAuditService) GetAuthEvents(ctx context.Context, userID string, limit int, offset int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

func (m *MockAuditService) GetSecurityEvents(ctx context.Context, ipAddress string, since time.Time, limit int) ([]*model.AuthEvent, error) {
	args := m.Called(ctx, ipAddress, since, limit)
	return args.Get(0).([]*model.AuthEvent), args.Error(1)
}

// MockSessionRepository is a mock implementation of session repository
type MockSessionRepository struct {
	mock.Mock
}

func (m *MockSessionRepository) Create(ctx context.Context, session *model.Session) (*model.Session, error) {
	args := m.Called(ctx, session)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionRepository) Update(ctx context.Context, session *model.Session) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *MockSessionRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockSessionRepository) GetByID(ctx context.Context, id string) (*model.Session, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionRepository) GetAll(ctx context.Context) ([]model.Session, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionRepository) GetByToken(ctx context.Context, token string) (*model.Session, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionRepository) GetByRefreshToken(ctx context.Context, refreshToken string) (*model.Session, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionRepository) GetByUserID(ctx context.Context, userID string) ([]model.Session, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionRepository) GetActiveSessionsByUserID(ctx context.Context, userID string) ([]model.Session, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionRepository) RevokeSession(ctx context.Context, token string) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

func (m *MockSessionRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockSessionRepository) RevokeExpiredSessions(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockSessionRepository) UpdateSessionExpiry(ctx context.Context, sessionID string, expiresAt time.Time) error {
	args := m.Called(ctx, sessionID, expiresAt)
	return args.Error(0)
}

func (m *MockSessionRepository) GetExpiredSessions(ctx context.Context) ([]model.Session, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionRepository) RefreshSession(ctx context.Context, sessionID string, newToken, newRefreshToken string, expiresAt time.Time) error {
	args := m.Called(ctx, sessionID, newToken, newRefreshToken, expiresAt)
	return args.Error(0)
}

func (m *MockSessionRepository) GetByStringID(ctx context.Context, id string) (*model.Session, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

// IRepository interface methods for MockSessionRepository
func (m *MockSessionRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockSessionRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (*model.Session, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.Session, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

// MockSessionService is a mock implementation of SessionService
type MockSessionService struct {
	mock.Mock
}

func (m *MockSessionService) CreateSession(ctx context.Context, userID string, ipAddress, userAgent string) (*model.Session, error) {
	args := m.Called(ctx, userID, ipAddress, userAgent)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionService) ValidateSession(ctx context.Context, token string) (*model.Session, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionService) RefreshSession(ctx context.Context, refreshToken string) (*model.Session, error) {
	args := m.Called(ctx, refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionService) RevokeSession(ctx context.Context, token string) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

func (m *MockSessionService) RevokeAllUserSessions(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockSessionService) GetUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionService) GetActiveUserSessions(ctx context.Context, userID string) ([]model.Session, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionService) CleanupExpiredSessions(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Get(0).(int), args.Error(1)
}

func (m *MockSessionService) ExtendSession(ctx context.Context, sessionID string, duration time.Duration) error {
	args := m.Called(ctx, sessionID, duration)
	return args.Error(0)
}

// MockPasswordResetTokenRepository is a mock implementation of password reset token repository
type MockPasswordResetTokenRepository struct {
	mock.Mock
}

func (m *MockPasswordResetTokenRepository) Create(ctx context.Context, token *model.PasswordResetToken) (*model.PasswordResetToken, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) Update(ctx context.Context, token *model.PasswordResetToken) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

func (m *MockPasswordResetTokenRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPasswordResetTokenRepository) GetByID(ctx context.Context, id string) (*model.PasswordResetToken, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) GetAll(ctx context.Context) ([]model.PasswordResetToken, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) GetByToken(ctx context.Context, token string) (*model.PasswordResetToken, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) GetByUserID(ctx context.Context, userID string) ([]model.PasswordResetToken, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) GetValidTokenByUserID(ctx context.Context, userID string) (*model.PasswordResetToken, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) MarkTokenAsUsed(ctx context.Context, tokenID string) error {
	args := m.Called(ctx, tokenID)
	return args.Error(0)
}

func (m *MockPasswordResetTokenRepository) DeleteExpiredTokens(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) DeleteUsedTokens(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) RevokeAllUserTokens(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// IRepository interface methods for MockPasswordResetTokenRepository
func (m *MockPasswordResetTokenRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockPasswordResetTokenRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (*model.PasswordResetToken, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.PasswordResetToken, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.PasswordResetToken), args.Error(1)
}

func (m *MockPasswordResetTokenRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

// MockEmailVerificationTokenRepository is a mock implementation of email verification token repository
type MockEmailVerificationTokenRepository struct {
	mock.Mock
}

func (m *MockEmailVerificationTokenRepository) Create(ctx context.Context, token *model.EmailVerificationToken) (*model.EmailVerificationToken, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) Update(ctx context.Context, token *model.EmailVerificationToken) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

func (m *MockEmailVerificationTokenRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockEmailVerificationTokenRepository) GetByID(ctx context.Context, id string) (*model.EmailVerificationToken, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) GetAll(ctx context.Context) ([]model.EmailVerificationToken, error) {
	args := m.Called(ctx)
	return args.Get(0).([]model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) GetByToken(ctx context.Context, token string) (*model.EmailVerificationToken, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) GetByUserID(ctx context.Context, userID string) ([]model.EmailVerificationToken, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) GetValidTokenByUserID(ctx context.Context, userID string) (*model.EmailVerificationToken, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) MarkTokenAsUsed(ctx context.Context, tokenID string) error {
	args := m.Called(ctx, tokenID)
	return args.Error(0)
}

func (m *MockEmailVerificationTokenRepository) DeleteExpiredTokens(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) DeleteUsedTokens(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) RevokeAllUserTokens(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// IRepository interface methods for MockEmailVerificationTokenRepository
func (m *MockEmailVerificationTokenRepository) GetDB() bun.IDB {
	args := m.Called()
	return args.Get(0).(bun.IDB)
}

func (m *MockEmailVerificationTokenRepository) FindOneBy(ctx context.Context, options ...repository.QueryOption) (*model.EmailVerificationToken, error) {
	args := m.Called(ctx, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) FindAllBy(ctx context.Context, options ...repository.QueryOption) ([]model.EmailVerificationToken, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]model.EmailVerificationToken), args.Error(1)
}

func (m *MockEmailVerificationTokenRepository) Count(ctx context.Context, options ...repository.QueryOption) (int, error) {
	args := m.Called(ctx, options)
	return args.Int(0), args.Error(1)
}

// Test helper function to create authentication service with mocks
func createTestAuthService(t *testing.T) (AuthenticationService, *MockUserRepository, *MockSessionService, *MockPasswordResetTokenRepository, *MockEmailVerificationTokenRepository, *MockSecurityService, *MockAuditService, EmailService) {
	userRepo := &MockUserRepository{}
	sessionService := &MockSessionService{}
	passwordResetTokenRepo := &MockPasswordResetTokenRepository{}
	emailVerificationTokenRepo := &MockEmailVerificationTokenRepository{}
	securityService := &MockSecurityService{}
	auditService := &MockAuditService{}
	emailService := NewMockEmailService()

	authService := NewAuthenticationService(
		userRepo,
		sessionService,
		passwordResetTokenRepo,
		emailVerificationTokenRepo,
		securityService,
		auditService,
		emailService,
		[]AuthProvider{}, // No auth providers for basic tests
	)

	return authService, userRepo, sessionService, passwordResetTokenRepo, emailVerificationTokenRepo, securityService, auditService, emailService
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}

// moneyPtr is a helper for testing with model.Money pointers
func moneyPtr(amount int64) *model.Money {
	money := model.Money(amount)
	return &money
}
