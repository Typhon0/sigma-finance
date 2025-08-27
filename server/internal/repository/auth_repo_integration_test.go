package repository

import (
	"sigma_finance/internal/domain/model"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

// TestAuthRepositoryInterfaces verifies that all authentication repositories implement their interfaces correctly
func TestAuthRepositoryInterfaces(t *testing.T) {
	// Create a mock database connection (won't actually connect)
	db := bun.NewDB(nil, pgdialect.New())

	// Test UserRepository implements IUserRepository
	userRepo := NewUserRepository(db)
	var _ IUserRepository = userRepo

	// Test SessionRepository implements ISessionRepository
	sessionRepo := NewSessionRepository(db)
	var _ ISessionRepository = sessionRepo

	// Test PasswordResetTokenRepository implements IPasswordResetTokenRepository
	passwordResetRepo := NewPasswordResetTokenRepository(db)
	var _ IPasswordResetTokenRepository = passwordResetRepo

	// Test EmailVerificationTokenRepository implements IEmailVerificationTokenRepository
	emailVerificationRepo := NewEmailVerificationTokenRepository(db)
	var _ IEmailVerificationTokenRepository = emailVerificationRepo

	// If we get here, all interfaces are correctly implemented
	assert.True(t, true, "All authentication repositories implement their interfaces correctly")
}

// TestUserModelValidation tests the user model validation methods
func TestUserModelValidation(t *testing.T) {
	tests := []struct {
		name    string
		user    *model.User
		wantErr bool
	}{
		{
			name: "valid user",
			user: &model.User{
				Email: "test@example.com",
				Name:  "Test User",
			},
			wantErr: false,
		},
		{
			name: "invalid email",
			user: &model.User{
				Email: "invalid-email",
				Name:  "Test User",
			},
			wantErr: true,
		},
		{
			name: "empty email",
			user: &model.User{
				Email: "",
				Name:  "Test User",
			},
			wantErr: true,
		},
		{
			name: "long name",
			user: &model.User{
				Email: "test@example.com",
				Name:  string(make([]byte, 300)), // Name longer than 255 characters
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.user.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestUserAccountLocking tests the user account locking business logic
func TestUserAccountLocking(t *testing.T) {
	user := &model.User{
		Email:            "test@example.com",
		Name:             "Test User",
		FailedLoginCount: 0,
	}

	// Test account is not locked initially
	assert.False(t, user.IsAccountLocked())

	// Test incrementing failed login count
	for i := 1; i < 5; i++ {
		user.IncrementFailedLoginCount()
		assert.Equal(t, i, user.FailedLoginCount)
		assert.False(t, user.IsAccountLocked()) // Should not be locked until 5 attempts
	}

	// Test account gets locked after 5 failed attempts
	user.IncrementFailedLoginCount()
	assert.Equal(t, 5, user.FailedLoginCount)
	assert.True(t, user.IsAccountLocked())
	assert.NotNil(t, user.LockedUntil)

	// Test resetting failed login count
	user.ResetFailedLoginCount()
	assert.Equal(t, 0, user.FailedLoginCount)
	assert.False(t, user.IsAccountLocked())
	assert.Nil(t, user.LockedUntil)
}

// TestSessionValidation tests the session model validation
func TestSessionValidation(t *testing.T) {
	tests := []struct {
		name    string
		session *model.Session
		wantErr bool
	}{
		{
			name: "valid session",
			session: &model.Session{
				UserID:       "user-123",
				Token:        "token-123",
				RefreshToken: "refresh-123",
				ExpiresAt:    time.Now().Add(time.Hour),
			},
			wantErr: false,
		},
		{
			name: "missing user ID",
			session: &model.Session{
				Token:        "token-123",
				RefreshToken: "refresh-123",
				ExpiresAt:    time.Now().Add(time.Hour),
			},
			wantErr: true,
		},
		{
			name: "missing token",
			session: &model.Session{
				UserID:       "user-123",
				RefreshToken: "refresh-123",
				ExpiresAt:    time.Now().Add(time.Hour),
			},
			wantErr: true,
		},
		{
			name: "expired session",
			session: &model.Session{
				UserID:       "user-123",
				Token:        "token-123",
				RefreshToken: "refresh-123",
				ExpiresAt:    time.Now().Add(-time.Hour),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.session.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestPasswordResetTokenValidation tests the password reset token model validation
func TestPasswordResetTokenValidation(t *testing.T) {
	tests := []struct {
		name    string
		token   *model.PasswordResetToken
		wantErr bool
	}{
		{
			name: "valid token",
			token: &model.PasswordResetToken{
				UserID:    "user-123",
				Token:     "reset-token-123",
				ExpiresAt: time.Now().Add(time.Hour),
			},
			wantErr: false,
		},
		{
			name: "missing user ID",
			token: &model.PasswordResetToken{
				Token:     "reset-token-123",
				ExpiresAt: time.Now().Add(time.Hour),
			},
			wantErr: true,
		},
		{
			name: "missing token",
			token: &model.PasswordResetToken{
				UserID:    "user-123",
				ExpiresAt: time.Now().Add(time.Hour),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.token.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestPasswordValidation tests the password validation function
func TestPasswordValidation(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{
			name:     "valid password",
			password: "SecurePass123!",
			wantErr:  false,
		},
		{
			name:     "too short",
			password: "Short1!",
			wantErr:  true,
		},
		{
			name:     "no uppercase",
			password: "lowercase123!",
			wantErr:  true,
		},
		{
			name:     "no lowercase",
			password: "UPPERCASE123!",
			wantErr:  true,
		},
		{
			name:     "no number",
			password: "NoNumberPass!",
			wantErr:  true,
		},
		{
			name:     "no special character",
			password: "NoSpecialChar123",
			wantErr:  true,
		},
		{
			name:     "too long",
			password: string(make([]byte, 130)), // Longer than 128 characters
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := model.ValidatePassword(tt.password)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestTokenExpiration tests token expiration logic
func TestTokenExpiration(t *testing.T) {
	// Test session expiration
	session := &model.Session{
		ExpiresAt: time.Now().Add(-time.Hour), // Expired 1 hour ago
	}
	assert.True(t, session.IsExpired())
	assert.False(t, session.IsValid())

	session.ExpiresAt = time.Now().Add(time.Hour) // Expires in 1 hour
	assert.False(t, session.IsExpired())
	assert.True(t, session.IsValid())

	// Test password reset token expiration
	resetToken := &model.PasswordResetToken{
		ExpiresAt: time.Now().Add(-time.Hour),
		Used:      false,
	}
	assert.True(t, resetToken.IsExpired())
	assert.False(t, resetToken.IsValid())

	resetToken.ExpiresAt = time.Now().Add(time.Hour)
	assert.False(t, resetToken.IsExpired())
	assert.True(t, resetToken.IsValid())

	// Test used token
	resetToken.MarkAsUsed()
	assert.True(t, resetToken.Used)
	assert.False(t, resetToken.IsValid()) // Should be invalid even if not expired

	// Test email verification token expiration
	emailToken := &model.EmailVerificationToken{
		ExpiresAt: time.Now().Add(-time.Hour),
		Used:      false,
	}
	assert.True(t, emailToken.IsExpired())
	assert.False(t, emailToken.IsValid())

	emailToken.ExpiresAt = time.Now().Add(24 * time.Hour)
	assert.False(t, emailToken.IsExpired())
	assert.True(t, emailToken.IsValid())

	emailToken.MarkAsUsed()
	assert.True(t, emailToken.Used)
	assert.False(t, emailToken.IsValid())
}
