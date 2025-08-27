package service

import (
	"context"
	"testing"
	"time"

	"sigma_finance/internal/domain/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mocks are defined in mocks_test.go

func TestLocalAuthProvider_Name(t *testing.T) {
	userRepo := &MockLocalUserRepository{}
	securityService := &MockSecurityService{}
	provider := NewLocalAuthProvider(userRepo, securityService)

	assert.Equal(t, model.AuthProviderLocal, provider.Name())
}

func TestLocalAuthProvider_SupportsRegistration(t *testing.T) {
	userRepo := &MockLocalUserRepository{}
	securityService := &MockSecurityService{}
	provider := NewLocalAuthProvider(userRepo, securityService)

	assert.True(t, provider.SupportsRegistration())
}

func TestLocalAuthProvider_ValidateCredentials(t *testing.T) {
	tests := []struct {
		name        string
		credentials Credentials
		setupMocks  func(*MockLocalUserRepository, *MockSecurityService)
		wantErr     bool
		errCode     string
		wantUserID  string
	}{
		{
			name: "valid credentials",
			credentials: &EmailPasswordCredentials{
				Email:    "test@example.com",
				Password: "password123",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				passwordHash := "hashed_password"
				user := &model.User{
					ID:            "user-123",
					Email:         "test@example.com",
					Name:          "Test User",
					PasswordHash:  &passwordHash,
					EmailVerified: true,
				}
				userRepo.On("GetByEmail", mock.Anything, "test@example.com").Return(user, nil)
				securityService.On("VerifyPassword", "password123", passwordHash).Return(nil)
				userRepo.On("Update", mock.Anything, mock.AnythingOfType("*model.User")).Return(nil)
			},
			wantErr:    false,
			wantUserID: "user-123",
		},
		{
			name: "invalid credential type",
			credentials: &ExternalTokenCredentials{
				Provider: "google",
				Token:    "token123",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				// No mocks needed
			},
			wantErr: true,
			errCode: ErrInvalidInput,
		},
		{
			name: "user not found",
			credentials: &EmailPasswordCredentials{
				Email:    "nonexistent@example.com",
				Password: "password123",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				userRepo.On("GetByEmail", mock.Anything, "nonexistent@example.com").Return(nil, assert.AnError)
			},
			wantErr: true,
			errCode: ErrInvalidCredentials,
		},
		{
			name: "account locked",
			credentials: &EmailPasswordCredentials{
				Email:    "locked@example.com",
				Password: "password123",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				lockUntil := time.Now().Add(30 * time.Minute)
				user := &model.User{
					ID:               "user-123",
					Email:            "locked@example.com",
					FailedLoginCount: 5,
					LockedUntil:      &lockUntil,
				}
				userRepo.On("GetByEmail", mock.Anything, "locked@example.com").Return(user, nil)
			},
			wantErr: true,
			errCode: ErrAccountLocked,
		},
		{
			name: "no password hash (external auth only)",
			credentials: &EmailPasswordCredentials{
				Email:    "external@example.com",
				Password: "password123",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				user := &model.User{
					ID:           "user-123",
					Email:        "external@example.com",
					PasswordHash: nil, // No local password
				}
				userRepo.On("GetByEmail", mock.Anything, "external@example.com").Return(user, nil)
			},
			wantErr: true,
			errCode: ErrInvalidCredentials,
		},
		{
			name: "wrong password",
			credentials: &EmailPasswordCredentials{
				Email:    "test@example.com",
				Password: "wrongpassword",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				passwordHash := "hashed_password"
				user := &model.User{
					ID:           "user-123",
					Email:        "test@example.com",
					PasswordHash: &passwordHash,
				}
				userRepo.On("GetByEmail", mock.Anything, "test@example.com").Return(user, nil)
				securityService.On("VerifyPassword", "wrongpassword", passwordHash).Return(assert.AnError)
				userRepo.On("Update", mock.Anything, mock.AnythingOfType("*model.User")).Return(nil)
			},
			wantErr: true,
			errCode: ErrInvalidCredentials,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userRepo := &MockUserRepository{}
			securityService := &MockSecurityService{}
			provider := NewLocalAuthProvider(userRepo, securityService)

			tt.setupMocks(userRepo, securityService)

			userInfo, err := provider.ValidateCredentials(context.Background(), tt.credentials)

			if tt.wantErr {
				assert.Error(t, err)
				authErr, ok := err.(*AuthError)
				assert.True(t, ok, "Expected AuthError")
				assert.Equal(t, tt.errCode, authErr.Code)
				assert.Nil(t, userInfo)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, userInfo)
				assert.Equal(t, tt.wantUserID, userInfo.ID)
			}

			userRepo.AssertExpectations(t)
			securityService.AssertExpectations(t)
		})
	}
}

func TestLocalAuthProvider_Register(t *testing.T) {
	tests := []struct {
		name       string
		request    RegisterRequest
		setupMocks func(*MockUserRepository, *MockSecurityService)
		wantErr    bool
		errCode    string
	}{
		{
			name: "successful registration",
			request: RegisterRequest{
				Email:    "new@example.com",
				Password: "SecurePass123!",
				Name:     "New User",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				userRepo.On("GetByEmail", mock.Anything, "new@example.com").Return(nil, assert.AnError) // User doesn't exist
				securityService.On("HashPassword", "SecurePass123!").Return("hashed_password", nil)
				userRepo.On("Create", mock.Anything, mock.AnythingOfType("*model.User")).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "missing password",
			request: RegisterRequest{
				Email: "new@example.com",
				Name:  "New User",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				// No mocks needed
			},
			wantErr: true,
			errCode: ErrInvalidInput,
		},
		{
			name: "weak password",
			request: RegisterRequest{
				Email:    "new@example.com",
				Password: "weak",
				Name:     "New User",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				// No mocks needed - validation happens before repo calls
			},
			wantErr: true,
			errCode: ErrWeakPassword,
		},
		{
			name: "email already exists",
			request: RegisterRequest{
				Email:    "existing@example.com",
				Password: "SecurePass123!",
				Name:     "New User",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				existingUser := &model.User{
					ID:    "existing-user",
					Email: "existing@example.com",
				}
				userRepo.On("GetByEmail", mock.Anything, "existing@example.com").Return(existingUser, nil)
			},
			wantErr: true,
			errCode: ErrEmailAlreadyExists,
		},
		{
			name: "invalid email format",
			request: RegisterRequest{
				Email:    "invalid-email",
				Password: "SecurePass123!",
				Name:     "New User",
			},
			setupMocks: func(userRepo *MockUserRepository, securityService *MockSecurityService) {
				userRepo.On("GetByEmail", mock.Anything, "invalid-email").Return(nil, assert.AnError) // User doesn't exist
				securityService.On("HashPassword", "SecurePass123!").Return("hashed_password", nil)
				// Create will fail due to validation
			},
			wantErr: true,
			errCode: ErrInvalidInput,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userRepo := &MockUserRepository{}
			securityService := &MockSecurityService{}
			provider := NewLocalAuthProvider(userRepo, securityService)

			tt.setupMocks(userRepo, securityService)

			userInfo, err := provider.Register(context.Background(), tt.request)

			if tt.wantErr {
				assert.Error(t, err)
				authErr, ok := err.(*AuthError)
				assert.True(t, ok, "Expected AuthError")
				assert.Equal(t, tt.errCode, authErr.Code)
				assert.Nil(t, userInfo)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, userInfo)
				assert.Equal(t, tt.request.Email, userInfo.Email)
				assert.Equal(t, tt.request.Name, userInfo.Name)
				assert.False(t, userInfo.EmailVerified) // Should be false for new registrations
			}

			userRepo.AssertExpectations(t)
			securityService.AssertExpectations(t)
		})
	}
}
