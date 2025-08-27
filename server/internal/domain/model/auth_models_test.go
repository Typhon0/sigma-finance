package model

import (
	"testing"
	"time"
)

func TestUser_ValidateEmail(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		wantErr bool
	}{
		{
			name:    "valid email",
			email:   "user@example.com",
			wantErr: false,
		},
		{
			name:    "empty email",
			email:   "",
			wantErr: true,
		},
		{
			name:    "invalid email format",
			email:   "invalid-email",
			wantErr: true,
		},
		{
			name:    "email without domain",
			email:   "user@",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &User{Email: tt.email}
			err := u.ValidateEmail()
			if (err != nil) != tt.wantErr {
				t.Errorf("User.ValidateEmail() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{
			name:     "valid strong password",
			password: "StrongPass123!",
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.password)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePassword() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestUser_IsAccountLocked(t *testing.T) {
	tests := []struct {
		name        string
		lockedUntil *time.Time
		want        bool
	}{
		{
			name:        "not locked",
			lockedUntil: nil,
			want:        false,
		},
		{
			name:        "locked in future",
			lockedUntil: func() *time.Time { t := time.Now().Add(time.Hour); return &t }(),
			want:        true,
		},
		{
			name:        "lock expired",
			lockedUntil: func() *time.Time { t := time.Now().Add(-time.Hour); return &t }(),
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &User{LockedUntil: tt.lockedUntil}
			if got := u.IsAccountLocked(); got != tt.want {
				t.Errorf("User.IsAccountLocked() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSession_IsExpired(t *testing.T) {
	tests := []struct {
		name      string
		expiresAt time.Time
		want      bool
	}{
		{
			name:      "not expired",
			expiresAt: time.Now().Add(time.Hour),
			want:      false,
		},
		{
			name:      "expired",
			expiresAt: time.Now().Add(-time.Hour),
			want:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Session{ExpiresAt: tt.expiresAt}
			if got := s.IsExpired(); got != tt.want {
				t.Errorf("Session.IsExpired() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPasswordResetToken_IsValid(t *testing.T) {
	tests := []struct {
		name      string
		expiresAt time.Time
		used      bool
		want      bool
	}{
		{
			name:      "valid token",
			expiresAt: time.Now().Add(time.Hour),
			used:      false,
			want:      true,
		},
		{
			name:      "expired token",
			expiresAt: time.Now().Add(-time.Hour),
			used:      false,
			want:      false,
		},
		{
			name:      "used token",
			expiresAt: time.Now().Add(time.Hour),
			used:      true,
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prt := &PasswordResetToken{
				ExpiresAt: tt.expiresAt,
				Used:      tt.used,
			}
			if got := prt.IsValid(); got != tt.want {
				t.Errorf("PasswordResetToken.IsValid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAuthMethod_ValidateProvider(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		wantErr  bool
	}{
		{
			name:     "valid local provider",
			provider: AuthProviderLocal,
			wantErr:  false,
		},
		{
			name:     "valid external provider",
			provider: AuthProviderGoogle,
			wantErr:  false,
		},
		{
			name:     "invalid provider",
			provider: "invalid",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			am := &AuthMethod{Provider: tt.provider}
			err := am.ValidateProvider()
			if (err != nil) != tt.wantErr {
				t.Errorf("AuthMethod.ValidateProvider() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
