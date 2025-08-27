package model

import (
	"testing"
	"time"
)

func TestUser_IncrementFailedLoginCount(t *testing.T) {
	user := &User{
		FailedLoginCount: 0,
		LockedUntil:      nil,
	}

	// Test incrementing failed login count
	user.IncrementFailedLoginCount()
	if user.FailedLoginCount != 1 {
		t.Errorf("Expected FailedLoginCount to be 1, got %d", user.FailedLoginCount)
	}
	if user.LockedUntil != nil {
		t.Errorf("Expected LockedUntil to be nil for count < 5, got %v", user.LockedUntil)
	}

	// Test account locking after 5 failed attempts
	user.FailedLoginCount = 4
	user.IncrementFailedLoginCount()
	if user.FailedLoginCount != 5 {
		t.Errorf("Expected FailedLoginCount to be 5, got %d", user.FailedLoginCount)
	}
	if user.LockedUntil == nil {
		t.Error("Expected LockedUntil to be set after 5 failed attempts")
	}
	if !user.IsAccountLocked() {
		t.Error("Expected account to be locked after 5 failed attempts")
	}
}

func TestUser_ResetFailedLoginCount(t *testing.T) {
	lockTime := time.Now().Add(time.Hour)
	user := &User{
		FailedLoginCount: 5,
		LockedUntil:      &lockTime,
	}

	user.ResetFailedLoginCount()
	if user.FailedLoginCount != 0 {
		t.Errorf("Expected FailedLoginCount to be 0, got %d", user.FailedLoginCount)
	}
	if user.LockedUntil != nil {
		t.Errorf("Expected LockedUntil to be nil, got %v", user.LockedUntil)
	}
	if user.IsAccountLocked() {
		t.Error("Expected account to be unlocked after reset")
	}
}

func TestAuthMethod_ValidateExternalID(t *testing.T) {
	tests := []struct {
		name       string
		provider   string
		externalID *string
		wantErr    bool
	}{
		{
			name:       "local provider without external ID",
			provider:   AuthProviderLocal,
			externalID: nil,
			wantErr:    false,
		},
		{
			name:       "local provider with external ID (invalid)",
			provider:   AuthProviderLocal,
			externalID: stringPtr("external123"),
			wantErr:    true,
		},
		{
			name:       "external provider with external ID",
			provider:   AuthProviderGoogle,
			externalID: stringPtr("google123"),
			wantErr:    false,
		},
		{
			name:       "external provider without external ID (invalid)",
			provider:   AuthProviderGoogle,
			externalID: nil,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			am := &AuthMethod{
				Provider:   tt.provider,
				ExternalID: tt.externalID,
			}
			err := am.ValidateExternalID()
			if (err != nil) != tt.wantErr {
				t.Errorf("AuthMethod.ValidateExternalID() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAuthMethod_Validate(t *testing.T) {
	tests := []struct {
		name       string
		authMethod *AuthMethod
		wantErr    bool
	}{
		{
			name: "valid local auth method",
			authMethod: &AuthMethod{
				UserID:     "user123",
				Provider:   AuthProviderLocal,
				ExternalID: nil,
			},
			wantErr: false,
		},
		{
			name: "valid external auth method",
			authMethod: &AuthMethod{
				UserID:     "user123",
				Provider:   AuthProviderGoogle,
				ExternalID: stringPtr("google123"),
			},
			wantErr: false,
		},
		{
			name: "missing user ID",
			authMethod: &AuthMethod{
				UserID:   "",
				Provider: AuthProviderLocal,
			},
			wantErr: true,
		},
		{
			name: "invalid provider",
			authMethod: &AuthMethod{
				UserID:   "user123",
				Provider: "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.authMethod.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("AuthMethod.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSession_Validate(t *testing.T) {
	futureTime := time.Now().Add(time.Hour)

	tests := []struct {
		name    string
		session *Session
		wantErr bool
	}{
		{
			name: "valid session",
			session: &Session{
				UserID:       "user123",
				Token:        "token123",
				RefreshToken: "refresh123",
				ExpiresAt:    futureTime,
			},
			wantErr: false,
		},
		{
			name: "missing user ID",
			session: &Session{
				UserID:       "",
				Token:        "token123",
				RefreshToken: "refresh123",
				ExpiresAt:    futureTime,
			},
			wantErr: true,
		},
		{
			name: "missing token",
			session: &Session{
				UserID:       "user123",
				Token:        "",
				RefreshToken: "refresh123",
				ExpiresAt:    futureTime,
			},
			wantErr: true,
		},
		{
			name: "expired session",
			session: &Session{
				UserID:       "user123",
				Token:        "token123",
				RefreshToken: "refresh123",
				ExpiresAt:    time.Now().Add(-time.Hour),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.session.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Session.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewPasswordResetToken(t *testing.T) {
	userID := "user123"
	token := "reset-token-123"

	prt := NewPasswordResetToken(userID, token)

	if prt.UserID != userID {
		t.Errorf("Expected UserID to be %s, got %s", userID, prt.UserID)
	}

	if prt.Token != token {
		t.Errorf("Expected Token to be %s, got %s", token, prt.Token)
	}

	if prt.Used {
		t.Error("Expected Used to be false for new token")
	}

	if !prt.IsValid() {
		t.Error("Expected new token to be valid")
	}

	expectedExpiry := time.Now().Add(DefaultPasswordResetTokenExpiration)
	if prt.ExpiresAt.Before(expectedExpiry.Add(-time.Minute)) || prt.ExpiresAt.After(expectedExpiry.Add(time.Minute)) {
		t.Errorf("Expected ExpiresAt to be around %v, got %v", expectedExpiry, prt.ExpiresAt)
	}
}

func TestNewEmailVerificationToken(t *testing.T) {
	userID := "user123"
	token := "verify-token-123"

	evt := NewEmailVerificationToken(userID, token)

	if evt.UserID != userID {
		t.Errorf("Expected UserID to be %s, got %s", userID, evt.UserID)
	}

	if evt.Token != token {
		t.Errorf("Expected Token to be %s, got %s", token, evt.Token)
	}

	if evt.Used {
		t.Error("Expected Used to be false for new token")
	}

	if !evt.IsValid() {
		t.Error("Expected new token to be valid")
	}

	expectedExpiry := time.Now().Add(DefaultEmailVerificationTokenExpiration)
	if evt.ExpiresAt.Before(expectedExpiry.Add(-time.Minute)) || evt.ExpiresAt.After(expectedExpiry.Add(time.Minute)) {
		t.Errorf("Expected ExpiresAt to be around %v, got %v", expectedExpiry, evt.ExpiresAt)
	}
}

func TestAuthEvent_Validate(t *testing.T) {
	tests := []struct {
		name      string
		authEvent *AuthEvent
		wantErr   bool
	}{
		{
			name: "valid auth event",
			authEvent: &AuthEvent{
				Email:   "user@example.com",
				Action:  AuthActionLogin,
				Success: true,
			},
			wantErr: false,
		},
		{
			name: "missing email",
			authEvent: &AuthEvent{
				Email:   "",
				Action:  AuthActionLogin,
				Success: true,
			},
			wantErr: true,
		},
		{
			name: "missing action",
			authEvent: &AuthEvent{
				Email:   "user@example.com",
				Action:  "",
				Success: true,
			},
			wantErr: true,
		},
		{
			name: "invalid action",
			authEvent: &AuthEvent{
				Email:   "user@example.com",
				Action:  "invalid_action",
				Success: true,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.authEvent.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("AuthEvent.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}
