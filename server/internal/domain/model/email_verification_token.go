package model

import (
	"time"

	"github.com/uptrace/bun"
)

// EmailVerificationToken represents a token for email verification functionality
type EmailVerificationToken struct {
	bun.BaseModel `bun:"table:sigma_finance.email_verification_token"`

	ID        string    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID    string    `bun:"user_id,notnull,type:uuid"`
	Token     string    `bun:"token,unique,notnull"`
	ExpiresAt time.Time `bun:"expires_at,notnull"`
	Used      bool      `bun:"used,default:false"`
	CreatedAt time.Time `bun:"created_at,nullzero,notnull,default:current_timestamp"`

	// Relations
	User *User `bun:"rel:belongs-to,join:user_id=id"`
}

// IsExpired checks if the token has expired
func (evt *EmailVerificationToken) IsExpired() bool {
	return time.Now().After(evt.ExpiresAt)
}

// IsValid checks if the token is valid (not expired and not used)
func (evt *EmailVerificationToken) IsValid() bool {
	return !evt.IsExpired() && !evt.Used
}

// MarkAsUsed marks the token as used
func (evt *EmailVerificationToken) MarkAsUsed() {
	evt.Used = true
}

// Validate performs validation of the email verification token
func (evt *EmailVerificationToken) Validate() error {
	if evt.UserID == "" {
		return NewValidationError("user_id", "User ID is required")
	}

	if evt.Token == "" {
		return NewValidationError("token", "Token is required")
	}

	if evt.ExpiresAt.IsZero() {
		return NewValidationError("expires_at", "Expiration time is required")
	}

	return nil
}

// DefaultEmailVerificationTokenExpiration is the default expiration time for email verification tokens (24 hours)
const DefaultEmailVerificationTokenExpiration = 24 * time.Hour

// NewEmailVerificationToken creates a new email verification token with default expiration
func NewEmailVerificationToken(userID, token string) *EmailVerificationToken {
	return &EmailVerificationToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().Add(DefaultEmailVerificationTokenExpiration),
		Used:      false,
	}
}
