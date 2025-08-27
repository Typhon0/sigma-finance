package model

import (
	"time"

	"github.com/uptrace/bun"
)

// Session represents a user session with JWT tokens
type Session struct {
	bun.BaseModel `bun:"table:sigma_finance.session"`

	ID           string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID       string    `bun:"user_id,notnull,type:uuid"`
	Token        string    `bun:"token,unique,notnull"`
	RefreshToken string    `bun:"refresh_token,unique,notnull"`
	ExpiresAt    time.Time `bun:"expires_at,notnull"`
	CreatedAt    time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`
	IPAddress    string    `bun:"ip_address"`
	UserAgent    string    `bun:"user_agent"`

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// IsExpired checks if the session has expired
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsValid checks if the session is valid (not expired)
func (s *Session) IsValid() bool {
	return !s.IsExpired()
}

// Validate performs validation of the session
func (s *Session) Validate() error {
	if s.UserID == "" {
		return NewValidationError("user_id", "User ID is required")
	}

	if s.Token == "" {
		return NewValidationError("token", "Token is required")
	}

	if s.RefreshToken == "" {
		return NewValidationError("refresh_token", "Refresh token is required")
	}

	if s.ExpiresAt.IsZero() {
		return NewValidationError("expires_at", "Expiration time is required")
	}

	if s.ExpiresAt.Before(time.Now()) {
		return NewValidationError("expires_at", "Expiration time must be in the future")
	}

	return nil
}

// ExtendExpiration extends the session expiration by the given duration
func (s *Session) ExtendExpiration(duration time.Duration) {
	s.ExpiresAt = time.Now().Add(duration)
}
